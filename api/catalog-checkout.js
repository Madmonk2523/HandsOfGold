'use strict';
const {createHash}=require('node:crypto');
const {isIP}=require('node:net');
const core=require('./_lib/catalog-core');
const payments=require('./_lib/catalog-payments');
const RATE_SCRIPT="local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n";
module.exports=async function(req,res){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const ready=Boolean(process.env.CATALOG_CHECKOUT_ENABLED==='true'&&process.env.STRIPE_SECRET_KEY&&payments.redis.configured());
  if(req.method==='GET'){
    const id=new URL(req.url,'https://www.handsofgoldny.com').searchParams.get('session_id');
    if(!id)return res.status(200).json({available:ready});
    if(!/^cs_(?:live|test)_[a-zA-Z0-9]{12,180}$/.test(id))return res.status(400).json({error:'Invalid order reference.'});
    try{return res.status(200).json(await payments.publicStatus(id));}catch(_){return res.status(404).json({error:'We could not verify this order yet. Check your Stripe payment confirmation or call (631) 264-6610.'});}
  }
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
  if(!ready)return res.status(503).json({error:'Online checkout is unavailable. Please call (631) 264-6610.'});
  const headers=req.headers||{};
  if(!/^application\/json(?:\s*;|$)/i.test(headers['content-type']||'')||headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'Please start checkout from the website.'});
  const allowed=new Set(['https://www.handsofgoldny.com','https://handsofgoldny.com']);if(process.env.VERCEL_URL)allowed.add('https://'+process.env.VERCEL_URL);
  if(!headers.origin||!allowed.has(headers.origin))return res.status(403).json({error:'Please start checkout from the website.'});
  let body;try{const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(!raw||Buffer.byteLength(raw)>4096)throw Error();body=JSON.parse(raw);}catch(_){return res.status(400).json({error:'Invalid checkout request.'});}
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body?.attemptId||''))return res.status(400).json({error:'Please choose the item again to start checkout.'});
  const verified=core.readQuote(body?.quoteToken);if(!verified)return res.status(409).json({error:'This price has expired. Refresh prices and choose the item again.',refresh:true});
  try{
    const ip=process.env.VERCEL?String(headers['x-vercel-forwarded-for']||'').split(',')[0].trim():req.socket?.remoteAddress;
    if(!isIP(ip||''))throw Error('Request unavailable');
    const rate=Number(await payments.redis.command('EVAL',RATE_SCRIPT,1,'hog:catalog:rate:'+createHash('sha256').update(ip).digest('hex'),600));
    if(!Number.isSafeInteger(rate)||rate<1)throw Error('Request unavailable');if(rate>20){res.setHeader('Retry-After','600');return res.status(429).json({error:'Too many checkout attempts. Please try later or call the store.'});}
    const fixedRate=core.fixedRateFor(verified.item,core.pricing);
    const spot=fixedRate!=null?verified.quote.spot:await core.goldPrice(true);if(fixedRate==null&&!spot)return res.status(503).json({error:'Current gold pricing is unavailable. Please try again shortly.'});
    const current=core.priceFor(verified.item,spot,core.pricing);if(!Number.isFinite(current)||(fixedRate!=null?Math.round(current*100)!==verified.quote.cents:Math.abs(current*100-verified.quote.cents)>current*100*0.015))return res.status(409).json({error:'Pricing changed. Refresh prices before checking out.',refresh:true});
    return res.status(200).json(await payments.createCheckout(verified.item,verified.quote,body.quoteToken,body.attemptId));
  }catch(error){console.error('[hog-catalog-checkout]',error.type||error.name);return res.status(503).json({error:'Checkout could not start. Please call (631) 264-6610. No payment was taken.'});}
};
