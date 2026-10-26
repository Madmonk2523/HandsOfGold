'use strict';
const StripeClient=require('stripe');
const redis=require('../lib/redis');
const leads=require('../leads');
const {createHash}=require('node:crypto');
const CHANNEL='hog_catalog_14k',ORIGIN='https://www.handsofgoldny.com';
const ORDER_TTL=90*86400;
let client;
function stripe(){if(!process.env.STRIPE_SECRET_KEY)throw Error('Checkout unavailable');return client||(client=new StripeClient(process.env.STRIPE_SECRET_KEY,{timeout:10000,maxNetworkRetries:1}));}
function unpack(value){if(typeof value!=='string')return value;try{return JSON.parse(value)}catch(_){return null}}
function hookKey(){return 'hog:catalog:webhook:'+(/_live_/.test(process.env.STRIPE_SECRET_KEY||'')?'live':'test');}
async function hookRecord(){return unpack(await redis.command('GET',hookKey()));}
async function ensureWebhook(){
  const existing=await hookRecord();if(existing?.id&&existing?.secret)return existing;
  const lock=await redis.command('SET',hookKey()+':lock','1','NX','EX',45);if(!lock)throw Error('Checkout is preparing. Please try again.');
  try{
    const current=await hookRecord();if(current?.secret)return current;
    const endpoint=await stripe().webhookEndpoints.create({url:ORIGIN+'/api/catalog-payment',enabled_events:['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed'],description:'Hands of Gold catalog pickup orders'},{idempotencyKey:'hog-catalog-webhook-v1-'+hookKey().split(':').pop()});
    if(!endpoint.id||!endpoint.secret)throw Error('Payment notifications unavailable');
    const record={id:endpoint.id,secret:endpoint.secret};await redis.command('SET',hookKey(),JSON.stringify(record));console.log('[hog-catalog-webhook-ready]',endpoint.id);return record;
  }finally{await redis.command('DEL',hookKey()+':lock');}
}
function orderKey(id){return 'hog:catalog:order:'+id;}
async function getOrder(id){return unpack(await redis.command('GET',orderKey(id)));}
async function saveOrder(order){await redis.command('SET',orderKey(order.sessionId),JSON.stringify(order),'EX',ORDER_TTL);}
function integration(fingerprint){return 'hog_catalog_'+[...Buffer.from(fingerprint,'hex').subarray(0,8)].map(n=>String.fromCharCode(97+n%26)).join('');}
function dimensions(item){return [item.widthMm?item.widthMm+' mm wide':'',item.lengthIn?item.lengthIn+' in long':'',item.size?'Size '+item.size:''].filter(Boolean).join(' · ');}
async function createCheckout(item,quote,token,attemptId){
  await ensureWebhook();
  const fingerprint=createHash('sha256').update(token+':'+attemptId).digest('hex');
  const existing=unpack(await redis.command('GET','hog:catalog:checkout:'+fingerprint));if(existing?.url)return existing;
  const taxRate=Number(process.env.SALES_TAX_RATE||0.0875);if(!Number.isFinite(taxRate)||taxRate<0||taxRate>0.2)throw Error('Tax configuration unavailable');
  const taxCents=Math.round(quote.cents*taxRate),totalCents=quote.cents+taxCents;
  const description=['Style '+item.sku,dimensions(item),'Approx. '+item.grams.toFixed(2)+' g '+item.karat,'Special order; in-store pickup after confirmation'].filter(Boolean).join(' · ');
  const metadata={channel:CHANNEL,sku:item.sku,collection:item.supplier,karat:item.karat,grams:String(item.grams),price_cents:String(quote.cents),tax_cents:String(taxCents),fulfillment:'in-store pickup'};
  const session=await stripe().checkout.sessions.create({
    mode:'payment',integration_identifier:integration(fingerprint),
    success_url:ORIGIN+'/catalog-order.html?session_id={CHECKOUT_SESSION_ID}',
    cancel_url:ORIGIN+'/?'+new URLSearchParams({q:item.sku,supplier:item.supplier,karat:item.karat})+'#jewelry-catalog',
    billing_address_collection:'required',phone_number_collection:{enabled:true},customer_creation:'always',
    payment_method_options:{card:{request_three_d_secure:'any'}},expires_at:Math.floor(quote.exp/1000)+1800,
    line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:quote.cents,product_data:{name:item.title.slice(0,250),description:description.slice(0,500)}}},...(taxCents?[{quantity:1,price_data:{currency:'usd',unit_amount:taxCents,product_data:{name:'NY pickup sales tax ('+(taxRate*100).toFixed(3).replace(/0+$/,'')+'%)'}}}]:[])],
    custom_text:{submit:{message:'Special-order jewelry for pickup at 494 Oak St, Copiague. Availability and final specifications require store confirmation. We will contact you when your piece is ready. Bring photo ID matching the payment card.'}},
    metadata,payment_intent_data:{description:(item.title+' · '+item.sku+' · pickup').slice(0,500),metadata}
  },{idempotencyKey:'hog-catalog-'+fingerprint});
  if(!session.id||!session.url?.startsWith('https://checkout.stripe.com/'))throw Error('Checkout could not start');
  const order={sessionId:session.id,status:'pending',createdAt:new Date().toISOString(),sku:item.sku,title:item.title,supplier:item.supplier,karat:item.karat,grams:item.grams,dimensions:dimensions(item),priceCents:quote.cents,taxCents,totalCents,live:session.livemode};
  await saveOrder(order);const result={url:session.url,sessionId:session.id};await redis.command('SET','hog:catalog:checkout:'+fingerprint,JSON.stringify(result),'EX',2100);return result;
}
async function processPaid(sessionId){
  const session=await stripe().checkout.sessions.retrieve(sessionId);
  if(session.metadata?.channel!==CHANNEL)return {ignored:true};
  if(session.payment_status!=='paid')return {status:session.payment_status==='unpaid'?'pending':'processing'};
  let order=await getOrder(sessionId);if(!order||session.amount_total!==order.totalCents||session.currency!=='usd'||session.metadata.sku!==order.sku||session.livemode!==order.live)throw Error('Order validation failed');
  if(order.notified)return {status:'paid',order};
  const lock=await redis.command('SET',orderKey(sessionId)+':lock','1','NX','EX',60);if(!lock)throw Error('Order confirmation is processing');
  try{
    order=await getOrder(sessionId);if(order.notified)return {status:'paid',order};
    order.status='paid';order.paidAt=order.paidAt||new Date().toISOString();
    const contact=session.customer_details||{};
    const leadId='HOG-ORDER-'+sessionId.slice(-18);
    const fields={leadType:'catalog_order',source:'catalog_stripe_checkout',name:contact.name||'Stripe customer',email:contact.email||'',phone:contact.phone||'',product:order.title,productSlug:order.sku,karat:order.karat,approxWeight:order.grams.toFixed(2)+' grams',size_dimensions:order.dimensions,offer:'Paid $'+(order.totalCents/100).toFixed(2)+' USD including pickup tax',details:'Stripe-verified paid special order. Confirm availability and exact specifications before preparing pickup. Session: '+sessionId,page:ORIGIN+'/?'+new URLSearchParams({q:order.sku,karat:order.karat})+'#jewelry-catalog'};
    if(!order.stored){await redis.command('LPUSH','hog:leads',JSON.stringify({id:leadId,lead_type:'catalog_order',name:fields.name,email:fields.email,phone:fields.phone,status:'new',created_at:order.paidAt,payload:fields}));await redis.command('LTRIM','hog:leads','0','1999');order.stored=true;await saveOrder(order);}
    if(!await leads.notifyStaff({leadId,leadType:'catalog_order',subject:'PAID Catalog Order — '+order.sku,fields}))throw Error('Paid order staff alert unavailable');
    order.notified=true;await saveOrder(order);console.log('[hog-catalog-order-paid]',JSON.stringify({leadId,sku:order.sku}));return {status:'paid',order};
  }finally{await redis.command('DEL',orderKey(sessionId)+':lock');}
}
async function publicStatus(sessionId){const result=await processPaid(sessionId);if(result.ignored)throw Error('Unknown order');const order=result.order||await getOrder(sessionId);if(!order)throw Error('Unknown order');return {status:result.status,title:order.title,sku:order.sku,karat:order.karat,grams:order.grams,dimensions:order.dimensions,total:order.totalCents/100,currency:'USD',fulfillment:'In-store pickup after store confirmation'};}
module.exports={stripe,redis,unpack,ensureWebhook,hookRecord,createCheckout,processPaid,publicStatus,CHANNEL};
