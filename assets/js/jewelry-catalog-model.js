(function(root){
  'use strict';
  const purity={'10K':0.417,'14K':0.585,'18K':0.75,'21K':0.875,'22K':0.9167};
  function variants(products){
    return products.flatMap(p=>Object.entries(p.weights||{}).filter(([k,g])=>purity[k]&&Number.isFinite(Number(g))&&Number(g)>0).map(([karat,grams])=>({...p,karat,grams:Number(grams),id:p.sku+'|'+karat,title:'Monaci Hollow Cuban '+(p.type==='bracelet'?'Bracelet':'Chain')})));
  }
  function fixedRateFor(p,config){
    const w=Number(p.grams),tiers=config.weightRates?.[p.karat];
    if(!Number.isFinite(w)||w<=0||!Array.isArray(tiers))return null;
    const tier=tiers.find(t=>(t.lt==null||w<t.lt)&&(t.lte==null||w<=t.lte));
    const rate=Number(tier?.rate);return Number.isFinite(rate)&&rate>0?rate:null;
  }
  function priceFor(p,spot,config){
    if(!config.retailEnabled||!Number.isFinite(p.grams)||p.grams<=0)return null;
    const fixedRate=fixedRateFor(p,config);
    if(fixedRate!=null){const total=Math.round((p.grams*fixedRate+Number.EPSILON)*100)/100,cap=Number(config.maxAutoPrice);return total>0&&!(cap>0&&total>cap)?total:null;}
    if(!Number.isFinite(spot)||spot<=0)return null;
    const w=p.grams,spg=spot/31.1034768,fee=Number(config.flatFee)||0;
    let total;
    if(config.mode==='spotPlus'){
      if(Array.isArray(config.spotPlusKarats)&&!config.spotPlusKarats.includes(p.karat))return null;
      total=w*(spg+(Number(config.spotPlusPerGram)||0))+fee;
    }else if(config.mode==='perGram'){
      const rate=Number(config.retailPerGram?.[p.karat]);if(!Number.isFinite(rate)||rate<=0)return null;total=w*rate+fee;
    }else total=spg*w*purity[p.karat]*(1+(Number(config.markupPercent)||0)/100)+w*(Number(config.laborPerGram)||0)+fee;
    const round=Number(config.roundTo)||1;total=Math.round(total/round)*round;
    const cap=Number(config.maxAutoPrice);return Number.isFinite(total)&&total>0&&!(cap>0&&total>cap)?total:null;
  }
  function matching(rows,f){
    const terms=String(f.q||'').toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter(p=>{
      const text=[p.title,p.sku,p.karat,p.widthMm+'mm',p.lengthIn+'in',p.grams+'g','Monaci hollow Cuban'].join(' ').toLowerCase();
      return (!f.type||p.type===f.type)&&(!f.karat||p.karat===f.karat)&&terms.every(t=>text.includes(t))&&
        (f.gmin==null||p.grams>=f.gmin)&&(f.gmax==null||p.grams<=f.gmax)&&
        (f.pmin==null||(p.price!=null&&p.price>=f.pmin))&&(f.pmax==null||(p.price!=null&&p.price<=f.pmax));
    });
  }
  root.HOG_JEWELRY_CATALOG={variants,priceFor,fixedRateFor,matching};
})(window);
