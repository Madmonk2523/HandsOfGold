(() => {
  'use strict';
  const model=window.HOG_JEWELRY_CATALOG,config=window.HOG_CLASSIC_CUBAN_PRICING||{};
  const products=model.variants(window.HOG_CLASSIC_CUBAN_PRODUCTS||[]);
  const form=document.getElementById('jc-filters'),grid=document.getElementById('jc-grid'),sort=document.getElementById('jc-sort');
  const dialog=document.getElementById('jc-dialog'),request=document.getElementById('jc-request'),requestStatus=document.getElementById('jc-request-status');
  const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
  let spot=null,pricedAt=0,page=1,selected=null,lastOpener=null,loading=false,expiryTimer,filterTimer,requestSequence=0;
  const PER_PAGE=18,quoteMs=(Number(config.quoteMinutes)||25)*60000;
  const keys=['q','type','karat','gmin','gmax','pmin','pmax'];
  const filterPanel=document.querySelector('.jc-filters'),filterToggle=document.getElementById('jc-filter-toggle');
  function setFiltersExpanded(expanded){filterPanel.classList.toggle('is-collapsed',!expanded);filterToggle.setAttribute('aria-expanded',String(expanded));filterToggle.textContent=expanded?'Hide filters':'Filter by type, weight, karat & price';}
  setFiltersExpanded(!window.matchMedia('(max-width:760px)').matches);
  filterToggle.addEventListener('click',()=>setFiltersExpanded(filterToggle.getAttribute('aria-expanded')!=='true'));
  function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;}
  function track(event,data){(window.dataLayer=window.dataLayer||[]).push({event,...data});}
  function currentSpot(){return pricedAt&&Date.now()-pricedAt<quoteMs?spot:null;}
  function detailLink(p){return '/classic-cuban-collection.html?'+new URLSearchParams({type:p.type,width:p.widthMm,length:p.lengthIn,karat:p.karat});}
  function readFilters(){
    const f={};keys.forEach(k=>{const val=form.elements[k].value.trim();f[k]=['gmin','gmax','pmin','pmax'].includes(k)?(val===''?null:Number(val)):val;});return f;
  }
  function syncURL(f){const url=new URL(location.href);keys.forEach(k=>{const v=f[k];if(v!==''&&v!=null)url.searchParams.set(k,v);else url.searchParams.delete(k);});if(sort.value!=='recommended')url.searchParams.set('sort',sort.value);else url.searchParams.delete('sort');history.replaceState(null,'',url);}
  function loadURL(){const q=new URLSearchParams(location.search);keys.forEach(k=>{const val=q.get(k);if(val!=null)form.elements[k].value=val.slice(0,100);});if(q.has('sort'))sort.value=q.get('sort');if(!sort.value)sort.value='recommended';}
  function updatePriceStatus(){
    const el=document.getElementById('jc-price-status');
    el.textContent=loading?'Updating retail prices…':currentSpot()?`Retail prices updated ${new Date(pricedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}. 14K prices use the selected weight; confirm final availability with the store.`:pricedAt?'Prices expired. Refresh prices to search by budget.':'Current prices are unavailable. Browse by type, weight and karat, or request a price from the store.';
  }
  function render(){
    const f=readFilters();syncURL(f);
    const invalid=(f.gmin!=null&&f.gmax!=null&&f.gmin>f.gmax)||(f.pmin!=null&&f.pmax!=null&&f.pmin>f.pmax)||['gmin','gmax','pmin','pmax'].some(k=>f[k]!=null&&(!Number.isFinite(f[k])||f[k]<0));
    const rows=products.map(p=>({...p,price:model.priceFor(p,currentSpot(),config)}));
    let matching=invalid?[]:model.matching(rows,f);
    if(sort.value.startsWith('price'))matching.sort((a,b)=>a.price==null?b.price==null?0:1:b.price==null?-1:(a.price-b.price)*(sort.value==='price-desc'?-1:1));
    if(sort.value.startsWith('weight'))matching.sort((a,b)=>(a.grams-b.grams)*(sort.value==='weight-desc'?-1:1));
    const totalPages=Math.max(1,Math.ceil(matching.length/PER_PAGE));page=Math.min(page,totalPages);
    document.getElementById('jc-count').textContent=`${matching.length} of ${products.length} catalog options`;
    document.querySelectorAll('[data-jc-type]').forEach(a=>a.setAttribute('aria-current',a.dataset.jcType===f.type?'true':'false'));
    grid.replaceChildren();
    matching.slice((page-1)*PER_PAGE,page*PER_PAGE).forEach(p=>{
      const card=node('article','jc-card');card.dataset.sku=p.sku;card.dataset.karat=p.karat;card.dataset.grams=p.grams;if(p.price!=null)card.dataset.price=p.price;
      const photo=node('a','jc-card-photo');photo.href=detailLink(p);photo.setAttribute('aria-label',`View ${p.karat} ${p.widthMm}mm ${p.lengthIn} inch ${p.title}`);
      const img=node('img');img.src='/'+p.image.replace(/^\//,'');img.alt=`${p.title}, ${p.widthMm}mm wide and ${p.lengthIn} inches long`;img.loading='lazy';img.decoding='async';img.width=600;img.height=600;photo.append(img);
      const copy=node('div','jc-card-copy');copy.append(node('h2','',p.title),node('p','jc-spec',`${p.karat} · ${p.widthMm}mm × ${p.lengthIn}in · approx. ${p.grams.toFixed(2)}g`),node('p','jc-sku','Style '+p.sku),node('p','jc-price',p.price==null?'Request price':money.format(p.price)),node('p','jc-availability','Hollow gold · confirm availability'));
      const actions=node('div','jc-card-actions'),ask=node('button','','Request availability');ask.type='button';ask.setAttribute('aria-label',`Request ${p.karat} ${p.widthMm}mm ${p.lengthIn}in ${p.type==='bracelet'?'bracelet':'chain'}`);ask.addEventListener('click',()=>openRequest(p,ask));
      const view=node('a','','View exact piece →');view.href=detailLink(p);actions.append(ask,view);copy.append(actions);card.append(photo,copy);grid.append(card);
    });
    document.getElementById('jc-empty').hidden=matching.length!==0;
    document.getElementById('jc-empty-note').textContent=invalid?'Minimum values must be less than or equal to maximum values.':!currentSpot()&&(f.pmin!=null||f.pmax!=null)?'Price filtering needs current retail prices. Refresh prices, or clear the price range to see catalog options.':'Try widening your weight or price range, or clearing a filter.';
    document.getElementById('jc-pagination').hidden=matching.length===0;
    document.getElementById('jc-page').textContent=`Page ${page} of ${totalPages}`;document.getElementById('jc-prev').disabled=page===1;document.getElementById('jc-next').disabled=page===totalPages;
    updatePriceStatus();
  }
  async function loadPrices(){
    if(loading)return;loading=true;document.getElementById('jc-refresh').disabled=true;updatePriceStatus();
    try{
      const response=await fetch('https://api.gold-api.com/price/XAU',{cache:'no-store',signal:AbortSignal.timeout(7000)});
      const data=await response.json();if(!response.ok||!Number.isFinite(Number(data.price))||Number(data.price)<=0)throw Error('Price unavailable');
      spot=Number(data.price);pricedAt=Date.now();clearTimeout(expiryTimer);expiryTimer=setTimeout(render,quoteMs+100);
    }catch(_){spot=null;pricedAt=0;}finally{loading=false;document.getElementById('jc-refresh').disabled=false;render();}
  }
  function openRequest(p,opener){
    selected=p;lastOpener=opener;requestSequence++;request.reset();requestStatus.textContent='';const button=request.querySelector('button[type=submit]');button.disabled=false;button.textContent='Send My Request';
    const price=model.priceFor(p,currentSpot(),config);
    document.getElementById('jc-selected').textContent=`${p.title}\n${p.karat} · ${p.widthMm}mm × ${p.lengthIn}in · approx. ${p.grams.toFixed(2)} grams\nStyle ${p.sku}\n${price==null?'Ask us for current pricing':'Displayed retail price: '+money.format(price)}\nHollow gold · store confirms availability`;
    dialog.classList.add('is-open');dialog.showModal();request.elements.name.focus();track('catalog_inquiry_opened',{item_id:p.sku,karat:p.karat});
  }
  function closeRequest(){dialog.classList.remove('is-open');dialog.close();if(lastOpener?.isConnected)lastOpener.focus();}
  document.getElementById('jc-close').addEventListener('click',closeRequest);
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeRequest();});
  request.addEventListener('submit',async event=>{
    event.preventDefault();if(!selected||!request.reportValidity())return;
    const data=new FormData(request),phone=String(data.get('phone')||'').trim();
    if(!/^[+\d\s().-]+$/.test(phone)||phone.replace(/\D/g,'').length<10||phone.replace(/\D/g,'').length>15){requestStatus.textContent='Please enter a valid phone number.';return;}
    const sequence=requestSequence,button=request.querySelector('button[type=submit]');button.disabled=true;requestStatus.textContent='Sending your jewelry request…';
    const p=selected,price=model.priceFor(p,currentSpot(),config),shownPrice=price==null?'Current price requested':money.format(price)+' displayed '+new Date(pricedAt).toISOString();
    const body={leadType:'product_inquiry',source:'jewelry_catalog',name:String(data.get('name')||'').trim(),phone,consent:data.get('consent')==='on',website:String(data.get('website')||''),product:p.title,productSlug:p.sku,karat:p.karat,approxWeight:p.grams.toFixed(2)+' grams',size_dimensions:p.widthMm+'mm x '+p.lengthIn+'in',offer:shownPrice,offer_terms:'Approximate catalog weight; hollow gold; store confirms current price and availability.',details:'Supplier collection: Monaci',message:String(data.get('message')||'').trim()||'Please confirm price and availability for this exact piece.',page:location.origin+detailLink(p)};
    try{
      const response=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)}),result=await response.json();
      if(sequence!==requestSequence)return;
      if(!response.ok||!result.success)throw Error(result.error||'We could not send your request. Please call (631) 264-6610.');
      requestStatus.textContent='Request received. Our team will contact you about this exact piece. Reference '+result.leadId+'.';button.textContent='Request Sent ✓';track('catalog_inquiry_sent',{item_id:p.sku,karat:p.karat,value:price||undefined});
    }catch(error){if(sequence!==requestSequence)return;requestStatus.textContent=error.message||'Unable to send. Call (631) 264-6610.';button.disabled=false;}
  });
  function resetFilters(){keys.forEach(k=>{form.elements[k].value='';});sort.value='recommended';page=1;render();}
  form.addEventListener('submit',event=>{event.preventDefault();page=1;render();if(window.matchMedia('(max-width:760px)').matches){setFiltersExpanded(false);document.querySelector('.jc-results-head').scrollIntoView({behavior:'smooth',block:'start'});}});
  form.addEventListener('input',()=>{clearTimeout(filterTimer);filterTimer=setTimeout(()=>{page=1;render();},160);});
  form.addEventListener('change',()=>{page=1;render();});
  form.addEventListener('reset',event=>{event.preventDefault();resetFilters();});
  sort.addEventListener('change',()=>{page=1;render();});document.getElementById('jc-empty-clear').addEventListener('click',resetFilters);
  document.getElementById('jc-refresh').addEventListener('click',loadPrices);
  document.querySelectorAll('[data-jc-type]').forEach(a=>a.addEventListener('click',event=>{event.preventDefault();form.elements.type.value=a.dataset.jcType;page=1;render();}));
  for(const direction of ['prev','next'])document.getElementById('jc-'+direction).addEventListener('click',()=>{page+=direction==='next'?1:-1;render();document.querySelector('.jc-results-head').scrollIntoView({behavior:'smooth',block:'start'});});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
  window.addEventListener('popstate',()=>{keys.forEach(k=>{form.elements[k].value='';});sort.value='recommended';loadURL();page=1;render();});
  loadURL();render();loadPrices();
})();
