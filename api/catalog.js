'use strict';
const {data,items,counts,pricing,priceFor,goldPrice,publicItem,pricedAt}=require('./_lib/catalog-core');
const homeWatches=require('./lib/home-watch-references.js');
module.exports=async function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'});}
  try{
    const query=new URL(req.url,'https://www.handsofgoldny.com').searchParams;
    const home=query.get('home')==='1',catalogItems=home?items.concat(homeWatches):items;
    const limits={};
    for(const key of ['gmin','gmax','pmin','pmax','wmin','wmax','lmin','lmax']){
      const raw=query.get(key);limits[key]=raw==null||raw===''?null:Number(raw);
      if(limits[key]!=null&&(!Number.isFinite(limits[key])||limits[key]<0||limits[key]>100000))return res.status(400).json({error:'Please use valid positive filter values.'});
    }
    for(const prefix of ['g','p','w','l'])if(limits[prefix+'min']!=null&&limits[prefix+'max']!=null&&limits[prefix+'min']>limits[prefix+'max'])return res.status(400).json({error:'Minimum values must be less than or equal to maximum values.'});
    const spot=await goldPrice(query.get('refresh')==='1');
    const filters={};for(const key of ['supplier','type','style','karat'])filters[key]=(query.get(key)||'').slice(0,60);
    const terms=(query.get('q')||'').slice(0,100).trim().toLowerCase().split(/\s+/).filter(Boolean);
    const selectedSku=(query.get('item')||'').slice(0,100);
    function inRange(value,min,max){return (min==null&&max==null)||(value!=null&&(min==null||value>=min)&&(max==null||value<=max));}
    let matches=[];
    for(const item of catalogItems){
      if(selectedSku&&item.sku!==selectedSku)continue;
      if(query.get('buyable')==='1'&&!item.checkout14k)continue;
      if(Object.entries(filters).some(([key,value])=>value&&item[key]!==value))continue;
      if(!terms.every(term=>item.search.includes(term)))continue;
      if(!inRange(item.grams,limits.gmin,limits.gmax)||!inRange(item.widthMm,limits.wmin,limits.wmax)||!inRange(item.lengthIn,limits.lmin,limits.lmax))continue;
      const price=item.autoPrice?priceFor(item,spot,pricing):null;
      if(!inRange(price,limits.pmin,limits.pmax))continue;
      matches.push({item,price});
    }
    const sort=query.get('sort')||'recommended';
    if(sort==='recommended')matches.sort((a,b)=>Number(a.price==null)-Number(b.price==null));
    if(sort==='price-asc'||sort==='price-desc')matches.sort((a,b)=>a.price==null?b.price==null?0:1:b.price==null?-1:(a.price-b.price)*(sort==='price-desc'?-1:1));
    if(sort==='weight-asc'||sort==='weight-desc')matches.sort((a,b)=>a.item.grams==null?b.item.grams==null?0:1:b.item.grams==null?-1:(a.item.grams-b.item.grams)*(sort==='weight-desc'?-1:1));
    // Merchandising applies only to the unfiltered homepage's default order.
    if(home&&sort==='recommended'&&!selectedSku&&!terms.length&&!Object.values(filters).some(Boolean)&&!Object.values(limits).some(v=>v!=null)&&query.get('buyable')!=='1'){
      const showcase=["LCB080-22","030S-22","FFL100-22","FRA080-22","BC100-22","BOX250-22","BC173-22","FBU100-22","BIZ070-22","SLK040-24","BC187-22","BC149-20","DCU120-22","BC154-22","040S-22","LFG160-22","BC137-22","BC186-22","016L-22","050-22"];
      const featured=showcase.map(sku=>matches.find(row=>row.item.sku===sku)).filter(Boolean);
      const featuredItems=new Set(featured.map(row=>row.item));
      matches=featured.concat(matches.filter(row=>!featuredItems.has(row.item)));
    }
    const limit=home?20:24,total=matches.length,pages=Math.max(1,Math.ceil(total/limit));
    const page=Math.min(pages,Math.max(1,Number.parseInt(query.get('page'),10)||1));
    res.setHeader('Cache-Control',query.get('refresh')==='1'?'no-store':'public, s-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({total,totalCatalog:catalogItems.length,page,pages,items:matches.slice((page-1)*limit,page*limit).map(({item})=>({...publicItem(item,spot),...(home&&item.type==='necklace'&&item.style&&item.style!=='other'?{cardTitle:item.widthMm+' mm '+({cuban:'Cuban',rope:'Rope',figaro:'Figaro',franco:'Franco',mariner:'Mariner',box:'Box',wheat:'Wheat',curb:'Curb',byzantine:'Byzantine',herringbone:'Herringbone',cable:'Cable',singapore:'Singapore'}[item.style]||item.style)+' Chain'}:{})})),counts:home?{...counts,types:{...counts.types,watches:counts.types.watches+homeWatches.length},suppliers:{...counts.suppliers,hands_of_gold:homeWatches.length},karats:{...counts.karats,Other:(counts.karats.Other||0)+homeWatches.length}}:counts,sourceAsOf:data.sourceAsOf,pricedAt:spot?pricedAt():matches.some(p=>p.price!=null)?new Date().toISOString():null,quoteMinutes:Number(pricing.quoteMinutes)||25});
  }catch(error){console.error('[hog-catalog]',error.name);return res.status(503).json({error:'The catalog is temporarily unavailable. Please call (631) 264-6610.'});}
};
