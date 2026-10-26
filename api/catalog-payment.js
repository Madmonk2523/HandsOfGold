'use strict';
const payments=require('./_lib/catalog-payments');
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'});}
  const signature=req.headers?.['stripe-signature'];if(typeof signature!=='string')return res.status(400).json({error:'Invalid signature.'});
  let event;
  try{
    // Never access the req.body getter: Stripe requires the original bytes.
    const chunks=[];let length=0;for await(const chunk of req){const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);length+=bytes.length;if(length>1024*1024)throw Error('Body too large');chunks.push(bytes);}
    const record=await payments.hookRecord();if(!record?.secret)throw Error('Webhook unavailable');
    event=payments.stripe().webhooks.constructEvent(Buffer.concat(chunks),signature,record.secret);
  }catch(_){return res.status(400).json({error:'Invalid webhook.'});}
  if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))return res.status(200).json({received:true});
  if(event.data?.object?.metadata?.channel!==payments.CHANNEL)return res.status(200).json({received:true});
  try{await payments.processPaid(event.data.object.id);return res.status(200).json({received:true});}catch(_){console.error('[hog-catalog-order]','confirmation pending');return res.status(500).json({error:'Please retry delivery.'});}
};
