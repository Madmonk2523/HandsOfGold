(() => {
  'use strict';
  const form=document.getElementById('jc-filters'),grid=document.getElementById('jc-grid'),sort=document.getElementById('jc-sort');
  const dialog=document.getElementById('jc-dialog'),request=document.getElementById('jc-request'),status=document.getElementById('jc-request-status');
  const keys=['q','type','style','supplier','karat','buyable','gmin','gmax','pmin','pmax','wmin','wmax','lmin','lmax'];
  const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
  const labels={necklace:'Chains & necklaces',bracelet:'Bracelets',rings:'Rings',earrings:'Earrings',pendants:'Pendants & charms',anklet:'Anklets',watches:'Watches',sets:'Jewelry sets',mountings:'Settings & mountings',findings:'Findings',body:'Body jewelry',other:'Other jewelry'};
  const filterPanel=document.querySelector('.jc-filters'),toggle=document.getElementById('jc-filter-toggle');
  let page=1,lastResponse=null,controller=null,sequence=0,filterTimer,expiryTimer,selected=null,lastOpener=null,requestSequence=0;
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
  function collection(p){return p.referenceOnly?(p.brand||'Rolex')+' · by request':p.supplier==='monaci'?'Monaci':'Hands of Gold';}
  function track(event,data){(window.dataLayer=window.dataLayer||[]).push({event,...data});}
  function expanded(value){filterPanel.classList.toggle('is-collapsed',!value);toggle.setAttribute('aria-expanded',String(value));toggle.textContent=value?'Hide filters':'Filter by style, size, weight & price';}
  expanded(!window.matchMedia('(max-width:760px)').matches);
  toggle.addEventListener('click',()=>expanded(toggle.getAttribute('aria-expanded')!=='true'));
  function filters(){const p=new URLSearchParams();keys.forEach(key=>{const value=form.elements[key].value.trim();if(value)p.set(key,value);});if(sort.value!=='recommended')p.set('sort',sort.value);if(page>1)p.set('page',page);return p;}
  function sync(){const p=new URLSearchParams(location.search);[...keys,'sort','page','refresh'].forEach(key=>p.delete(key));for(const [key,value] of filters())p.set(key,value);history.replaceState(null,'',location.pathname+(p.size?'?'+p:'')+location.hash);}
  function fromURL(){const p=new URLSearchParams(location.search);keys.forEach(key=>{form.elements[key].value=(p.get(key)||'').slice(0,100);});sort.value=p.get('sort')||'recommended';if(!sort.value)sort.value='recommended';page=Math.max(1,Number.parseInt(p.get('page'),10)||1);}
  function dimensions(p){return [p.widthMm?p.widthMm+' mm wide':'',p.lengthIn?p.lengthIn+' in long':'',p.size?'Size '+p.size:'',p.diamondCarats?Number(p.diamondCarats).toFixed(2)+' ct total diamonds':''].filter(Boolean).join(' · ');}
  function weight(p){return p.referenceOnly?'Exact watch and price confirmed before purchase':p.grams==null?'Weight confirmed by store':'Approx. '+p.grams.toFixed(2)+' g catalog weight';}
  function priceValid(p){return p.price!=null&&p.pricedAt&&Date.now()-Date.parse(p.pricedAt)<25*60000;}
  function price(p){return priceValid(p)?money.format(p.price):'Request a quote';}
  function photo(p,cls){const img=el('img',cls);img.src=p.image;img.alt=p.title+(p.referenceOnly?' — reference photo':' — supplier style photo');img.loading='lazy';img.decoding='async';img.width=500;img.height=500;if(p.imageRotation===90){img.style.transform='rotate(90deg)';img.style.padding='24px';}return img;}
  function render(data){
    lastResponse=data;page=data.page;sync();grid.replaceChildren();
    document.getElementById('jc-total').textContent=data.totalCatalog.toLocaleString()+' catalog options';
    document.getElementById('jc-count').textContent=data.total.toLocaleString()+' matching options';
    document.querySelectorAll('[data-jc-type]').forEach(a=>a.setAttribute('aria-current',a.dataset.jcType===form.elements.type.value?'true':'false'));
    document.querySelectorAll('[data-chain-style]').forEach(a=>a.setAttribute('aria-current',a.dataset.chainStyle===form.elements.style.value?'true':'false'));
    for(const p of data.items){
      p.pricedAt=data.pricedAt;
      const card=el('article','jc-card');card.dataset.sku=p.sku;card.dataset.supplier=p.supplier;if(p.price!=null)card.dataset.price=p.price;
      const view=el('button','jc-card-photo');view.type='button';view.setAttribute('aria-label','View '+p.title+', style '+p.sku);view.append(photo(p));view.addEventListener('click',()=>openRequest(p,view));
      const copy=el('div','jc-card-copy');copy.append(el('p','jc-collection',collection(p)),el('h2','',p.cardTitle||p.title),el('p','jc-spec',p.metal),el('p','jc-spec',dimensions(p)),el('p','jc-spec',weight(p)),el('p','jc-sku','Style '+p.sku),el('p','jc-price',price(p)),el('p','jc-availability',[p.construction,'Confirm availability'].filter(Boolean).join(' · ')));
      const actions=el('div','jc-card-actions'),ask=el('button','','View & request');ask.type='button';ask.setAttribute('aria-label','Request '+p.title+', style '+p.sku);ask.addEventListener('click',()=>openRequest(p,ask));actions.append(ask);
      if(['necklace','bracelet','rings','pendants','earrings'].includes(p.type)&&!p.referenceOnly){const tryOn=el('a','','Try on photo');tryOn.href='/style-lab.html?'+new URLSearchParams({item:p.sku,supplier:p.supplier})+'#try-on';tryOn.setAttribute('aria-label','Try on photo of '+p.title);actions.append(tryOn);}
      if(['necklace','bracelet','pendants'].includes(p.type)&&!p.referenceOnly){const set=el('a','','Build a set +');set.href='/style-lab.html?'+new URLSearchParams({item:p.sku,supplier:p.supplier})+'#set';set.setAttribute('aria-label','Build a set with '+p.title);actions.append(set);}
      if(p.supplier==='monaci'){const configure=el('a','','Monaci size builder →');configure.href='/classic-cuban-collection.html?'+new URLSearchParams({type:p.type,width:p.widthMm,length:p.lengthIn,karat:p.karat});actions.append(configure);}
      if(p.canBuy&&priceValid(p)){const buy=el('button','jc-buy','Buy Now · '+price(p));buy.type='button';buy.setAttribute('aria-label','Buy '+p.title+', style '+p.sku+' with Stripe');buy.addEventListener('click',()=>startCheckout(p,buy));actions.prepend(buy);copy.append(el('p','jc-availability','Special order · In-store pickup'));}
      copy.append(actions);card.append(view,copy);grid.append(card);
    }
    document.getElementById('jc-empty').hidden=data.total!==0;
    document.getElementById('jc-pagination').hidden=data.total===0;
    document.getElementById('jc-page').textContent='Page '+page.toLocaleString()+' of '+data.pages.toLocaleString();
    document.getElementById('jc-prev').disabled=page<=1;document.getElementById('jc-next').disabled=page>=data.pages;
    document.getElementById('jc-price-status').textContent=data.pricedAt?'Prices updated '+new Date(data.pricedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})+'. Request your selection to confirm the final price and availability.':'Live gold estimates are unavailable. Browse the catalog and request a current quote.';
    clearTimeout(expiryTimer);if(data.pricedAt)expiryTimer=setTimeout(()=>load(),Math.max(1000,Date.parse(data.pricedAt)+(data.quoteMinutes||25)*60000-Date.now()+200));
  }
  async function load(refresh=false){
    controller?.abort();controller=new AbortController();const current=++sequence;
    document.getElementById('jc-results').setAttribute('aria-busy','true');document.getElementById('jc-count').textContent='Searching catalog…';document.getElementById('jc-error').hidden=true;
    const params=filters();if(document.body.classList.contains('home-page'))params.set('home','1');if(refresh)params.set('refresh','1');
    try{
      const response=await fetch('/api/catalog?'+params,{signal:controller.signal});const data=await response.json();
      if(current!==sequence)return;if(!response.ok)throw Error(data.error||'Unable to load the catalog.');render(data);
    }catch(error){if(error.name==='AbortError'||current!==sequence)return;document.getElementById('jc-error').textContent=error.message+' Call (631) 264-6610 for help.';document.getElementById('jc-error').hidden=false;document.getElementById('jc-count').textContent='Catalog search needs attention';}
    finally{if(current===sequence)document.getElementById('jc-results').setAttribute('aria-busy','false');}
  }
  function reset(){keys.forEach(key=>{form.elements[key].value='';});sort.value='recommended';page=1;}
  function resultsIntoView(){document.getElementById('jc-results').scrollIntoView({behavior:'smooth',block:'start'});}
  form.addEventListener('submit',event=>{event.preventDefault();page=1;load();if(window.matchMedia('(max-width:760px)').matches)expanded(false);resultsIntoView();});
  form.addEventListener('input',()=>{clearTimeout(filterTimer);filterTimer=setTimeout(()=>{page=1;load();},220);});
  form.addEventListener('change',()=>{clearTimeout(filterTimer);page=1;load();});
  form.addEventListener('reset',event=>{event.preventDefault();reset();load();});sort.addEventListener('change',()=>{page=1;load();});
  document.getElementById('jc-empty-clear').addEventListener('click',()=>{reset();load();});document.getElementById('jc-refresh').addEventListener('click',()=>load(true));
  document.querySelectorAll('[data-chain-style]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();reset();form.elements.type.value='necklace';form.elements.style.value=link.dataset.chainStyle;load();resultsIntoView();}));
  document.querySelectorAll('[data-jc-type]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();form.elements.type.value=link.dataset.jcType;if(!['necklace','bracelet','anklet',''].includes(link.dataset.jcType))form.elements.style.value='';page=1;load();resultsIntoView();}));
  for(const direction of ['prev','next'])document.getElementById('jc-'+direction).addEventListener('click',()=>{page+=direction==='next'?1:-1;load();resultsIntoView();});
  window.addEventListener('popstate',()=>{reset();fromURL();load();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&lastResponse?.pricedAt&&Date.now()-Date.parse(lastResponse.pricedAt)>25*60000)load();});
  function watchCredit(p,copy){
    const credits={
      "RM-030-REFERENCE":["RM_030_Automatic.jpg","Y.Leclercq","CC BY-SA 4.0"],
      "RM-017-REFERENCE":["RM_017_Tourbillon.jpg","Y.Leclercq","CC BY-SA 4.0"],
      "AP-ROYAL-OAK-REFERENCE":["Audemars_Piguet_Royal_Oak_ref._15202.jpg","OpaleHorse","CC BY-SA 4.0"],
      "AP-OFFSHORE-REFERENCE":["Royal_Oak_Offshore_watch_by_Audemars_Piguet.JPG","Eternalsleeper / Peripitus","CC BY 3.0"],
      "ROLEX-DEEPSEA-ICED":["Fully_diamond_covered_ROLEX_DeepSea_Sea-Dweller_watch_customized_bu_TraxNYC.jpg","Marc Jacob","CC BY-SA 4.0"],
      "ROLEX-DAYTONA-DIAMOND":["Black_and_diamonds_(26404429138).jpg","Thomas Quine","CC BY 2.0"],
      "ROLEX-DATEJUST-DIAMOND":["Rolex_Datejust_16200.jpg","gabihil","Public domain"],
      'ROLEX-DAY-DATE':['Rolex_Day_Date.jpg','WALLI1912','CC BY-SA 3.0'],
      'ROLEX-DATEJUST':['Rolex_Datejust_16013.jpg','anna2005','CC0'],
      'ROLEX-SUBMARINER':['Rolex-Submariner.jpg','FrankWilliams','Public domain'],
      'ROLEX-DAYTONA':['Daytona_16528.jpg','Alesili','CC BY-SA 3.0']
    },credit=credits[p.sku];
    if(!credit)return;
    const note=el('p','jc-note'),source=el('a','','Photo: '+credit[1]);source.href='https://commons.wikimedia.org/wiki/File:'+credit[0];source.target='_blank';source.rel='noopener noreferrer';note.append(source,' · ');
    const license=el('a','',credit[2]);license.href=({'CC BY-SA 3.0':'https://creativecommons.org/licenses/by-sa/3.0/','CC BY-SA 4.0':'https://creativecommons.org/licenses/by-sa/4.0/','CC BY 3.0':'https://creativecommons.org/licenses/by/3.0/','CC BY 2.0':'https://creativecommons.org/licenses/by/2.0/','CC0':'https://creativecommons.org/publicdomain/zero/1.0/'}[credit[2]]||'https://commons.wikimedia.org/wiki/File:'+credit[0]);license.target='_blank';license.rel='noopener noreferrer';note.append(license,p.imageRotation===90?'. Rotated for display.':'. Photo unmodified.');
    copy.append(note,el('p','jc-note','Hands of Gold is an independent retailer and is not affiliated with Rolex, Richard Mille or Audemars Piguet.'));
  }
  function openRequest(p,opener){
    selected=p;lastOpener=opener;requestSequence++;request.reset();status.textContent='';const submit=request.querySelector('button[type=submit]');submit.disabled=false;submit.textContent='Send My Request';
    const detail=document.getElementById('jc-selected');detail.replaceChildren(photo(p,'jc-dialog-photo'));
    const copy=el('div');copy.append(el('h3','',p.title),el('p','',p.metal),el('p','',dimensions(p)),el('p','',weight(p)),el('p','jc-sku','Style '+p.sku),el('p','jc-price',price(p)),el('p','jc-note',p.referenceOnly?p.detail:'Supplier style photo. The store confirms your exact size, finish, current price and availability.'));detail.append(copy);if(p.referenceOnly)watchCredit(p,copy);
    if(p.canBuy&&priceValid(p)){copy.append(el('p','jc-note','Special order for in-store pickup. We confirm availability and exact specifications before preparing your piece. Pickup tax is added at Stripe checkout.'));const buy=el('button','jc-submit jc-buy','Buy Now · '+price(p));buy.type='button';buy.addEventListener('click',()=>startCheckout(p,buy));copy.append(buy);}
    dialog.classList.add('is-open');dialog.showModal();request.elements.name.focus();track('catalog_inquiry_opened',{item_id:p.sku,collection:p.supplier});
  }
  function close(){dialog.classList.remove('is-open');dialog.close();if(lastOpener?.isConnected)lastOpener.focus();}
  document.getElementById('jc-close').addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  request.addEventListener('submit',async event=>{
    event.preventDefault();if(!selected||!request.reportValidity())return;
    const fields=new FormData(request),phone=String(fields.get('phone')||'').trim();
    if(!/^[+\d\s().-]+$/.test(phone)||phone.replace(/\D/g,'').length<10||phone.replace(/\D/g,'').length>15){status.textContent='Please enter a valid phone number.';return;}
    const current=requestSequence,p=selected,button=request.querySelector('button[type=submit]');button.disabled=true;status.textContent='Sending your jewelry request…';
    const body={leadType:'product_inquiry',source:'jewelry_catalog',catalogSource:p.supplier,chainStyle:p.style,name:String(fields.get('name')||'').trim(),phone,budget:String(fields.get('budget')||''),consent:fields.get('consent')==='on',website:String(fields.get('website')||''),product:p.title,productSlug:p.sku,karat:p.karat,metal:p.metal,approxWeight:p.grams==null?'Weight confirmation requested':p.grams.toFixed(2)+' grams',size_dimensions:dimensions(p),offer:priceValid(p)?money.format(p.price)+' website estimate; price time '+p.pricedAt:'Current price requested',offer_terms:'Approximate catalog weight; supplier reference photo; store confirms final price, specifications and availability.',details:p.referenceOnly?p.detail:'Collection: '+collection(p)+'; '+p.collection+'; '+(p.construction||'construction confirmation requested'),message:String(fields.get('message')||'').trim()||'Please confirm the price and availability for this piece.',page:p.referenceOnly?location.origin+'/#jewelry-catalog':location.origin+'/jewelry-catalog.html?'+new URLSearchParams({q:p.sku,supplier:p.supplier,karat:p.karat})};
    try{
      const response=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)});const result=await response.json();
      if(current!==requestSequence)return;if(!response.ok||!result.success)throw Error(result.error||'Unable to send. Please call (631) 264-6610.');
      status.textContent='Request received. Our team will contact you about this piece. Reference '+result.leadId+'.';button.textContent='Request Sent ✓';track('catalog_inquiry_sent',{item_id:p.sku,collection:p.supplier});
    }catch(error){if(current!==requestSequence)return;status.textContent=error.message;button.disabled=false;}
  });
  document.querySelectorAll('[data-jc-buyable]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();reset();form.elements.karat.value='14K';form.elements.buyable.value='1';load();resultsIntoView();}));
  async function startCheckout(p,button){
    const original=button.textContent,errorBox=document.getElementById('jc-error');
    if(!priceValid(p)||!p.quoteToken){errorBox.textContent='Refresh prices and select the item again before checkout.';errorBox.hidden=false;return;}
    p.checkoutAttemptId=p.checkoutAttemptId||crypto.randomUUID();button.disabled=true;button.textContent='Opening Stripe…';if(dialog.open)status.textContent='Opening secure checkout…';
    try{
      const response=await fetch('/api/catalog-checkout',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({quoteToken:p.quoteToken,attemptId:p.checkoutAttemptId})});
      const result=await response.json();if(!response.ok){if(result.refresh){if(dialog.open)close();await load(true);}throw Error(result.error||'Checkout could not start. Please call the store.');}
      if(typeof result.url!=='string'||!result.url.startsWith('https://checkout.stripe.com/'))throw Error('Checkout could not start. Please call the store.');
      track('begin_checkout',{item_id:p.sku,value:p.price,currency:'USD'});location.assign(result.url);
    }catch(error){if(dialog.open)status.textContent=error.message;else{errorBox.textContent=error.message;errorBox.hidden=false;resultsIntoView();}button.disabled=false;button.textContent=original;}
  }
  fromURL();load();
})();
