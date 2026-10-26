'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createHmac,timingSafeEqual}=require('node:crypto');
const data=require('../lib/supplier-catalog-data.json');
const sandbox={window:{}};
for(const file of ['classic-cuban-pricing.js','assets/js/jewelry-catalog-model.js'])vm.runInNewContext(fs.readFileSync(path.join(process.cwd(),file),'utf8'),sandbox);
const pricing=sandbox.window.HOG_CLASSIC_CUBAN_PRICING,priceFor=sandbox.window.HOG_JEWELRY_CATALOG.priceFor,fixedRateFor=sandbox.window.HOG_JEWELRY_CATALOG.fixedRateFor;
const items=data.items.map(row=>{const item=Object.fromEntries(data.columns.map((key,i)=>[key,row[i]]));item.image=data.images[item.imageIndex];item.search=[item.sku,item.title,item.type,item.style,item.karat,item.metal,item.collection,item.widthMm?item.widthMm+'mm':'',item.lengthIn?item.lengthIn+'in':''].join(' ').toLowerCase();return item;});
const byId=new Map(items.map(item=>[[item.supplier,item.sku,item.karat].join('|'),item]));
const counts={types:{},styles:{},suppliers:{},karats:{}};
for(const item of items)for(const [group,key] of [['types','type'],['styles','style'],['suppliers','supplier'],['karats','karat']])if(item[key])counts[group][item[key]]=(counts[group][item[key]]||0)+1;
let cachedSpot=null,spotAt=0,spotPromise=null;
async function goldPrice(force=false){
  if(!force&&cachedSpot&&Date.now()-spotAt<300000)return cachedSpot;
  if(!spotPromise)spotPromise=(async()=>{try{const response=await fetch('https://api.gold-api.com/price/XAU',{signal:AbortSignal.timeout(4500),cache:'no-store'});const result=await response.json();const value=Number(result.price);if(!response.ok||!Number.isFinite(value)||value<=0)throw Error('Price unavailable');cachedSpot=value;spotAt=Date.now();}catch(_){if(force||Date.now()-spotAt>25*60000){cachedSpot=null;spotAt=0;}}finally{spotPromise=null;}return cachedSpot;})();
  return spotPromise;
}
function signingKey(){return process.env.STRIPE_SECRET_KEY||'';}
function signature(encoded){return createHmac('sha256',signingKey()).update('hog-catalog-quote-v1:'+encoded).digest('base64url');}
function makeQuote(item,price,spot,issuedAt=Date.now()){
  if(!signingKey()||!item.checkout14k||!Number.isFinite(price)||price<=0)return null;
  const payload={v:1,id:[item.supplier,item.sku,item.karat].join('|'),grams:item.grams,cents:Math.round(price*100),spot,iat:issuedAt,exp:issuedAt+25*60000};
  const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');return encoded+'.'+signature(encoded);
}
function readQuote(token,now=Date.now()){
  if(!signingKey()||typeof token!=='string'||token.length>2000||!/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(token))return null;
  try{const [encoded,sig]=token.split('.'),expected=Buffer.from(signature(encoded)),actual=Buffer.from(sig);if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return null;const quote=JSON.parse(Buffer.from(encoded,'base64url').toString());const item=byId.get(quote.id);if(quote.v!==1||!item?.checkout14k||item.karat!=='14K'||quote.grams!==item.grams||!Number.isSafeInteger(quote.cents)||quote.cents<=0||quote.cents>99999999||!Number.isFinite(quote.iat)||!Number.isFinite(quote.exp)||quote.iat>now+10000||quote.exp<=now||quote.exp-quote.iat!==25*60000)return null;return {quote,item};}catch(_){return null;}
}
function publicItem(item,spot){const {search,imageIndex,autoPrice,checkout14k,...result}=item;result.price=autoPrice?priceFor(item,spot,pricing):null;result.priceType=result.price==null?'quote':fixedRateFor(item,pricing)!=null?'weight_based':'market_estimate';result.quoteToken=process.env.CATALOG_CHECKOUT_ENABLED==='true'?makeQuote(item,result.price,spot):null;result.canBuy=Boolean(result.quoteToken);return result;}
module.exports={data,items,byId,counts,pricing,priceFor,fixedRateFor,goldPrice,publicItem,makeQuote,readQuote,pricedAt:()=>spotAt?new Date(spotAt).toISOString():null};
