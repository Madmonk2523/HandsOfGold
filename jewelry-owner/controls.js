'use strict';
window.HOGPreferences = (() => {
  const $ = id => document.getElementById(id), coins = ['btc','eth','sol','ltc','doge','xrp']; let cardId, data;
  const message = text => { $('pref-message').textContent = text; };
  async function request(url, body, method) { const r = await fetch(url, { method: method || (body ? 'POST' : 'GET'), cache: 'no-store', ...(body ? {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {}) }); const value = await r.json(); if (!r.ok) throw Error(value.error || 'Please try again.'); return value; }
  function node(tag, text, parent) { const e = document.createElement(tag); if (text) e.textContent = text; if (parent) parent.append(e); return e; }
  function field(parent, text, id, type='text') { const label=node('label',text,parent); label.htmlFor=id; const e=node('input','',parent);e.id=id;e.type=type;return e; }
  function button(parent,text,onclick) {const b=node('button',text,parent);b.type='button';b.onclick=async()=>{b.disabled=true;try{await onclick();}catch(e){message(e.message);}finally{b.disabled=false;}};return b;}
  function selected(root) { return Object.fromEntries(coins.map(c=>[c,root.querySelector(`[data-coin="${c}"]`)?.checked===true])); }
  function switches(parent, current={}) {
    for(const coin of data.linkedCoins){const c=coin.toLowerCase(),label=node('label','',parent);label.className='consent';const check=node('input','',label);check.type='checkbox';check.dataset.coin=c;check.checked=current[c]===true;node('span',`${coin} — Show balance`,label);}
  }
  async function post(body) { return request('/api/card-preferences',{id:cardId,...body}); }
  async function load(id) {
    cardId=id; data=await request('/api/card-preferences?card='+encodeURIComponent(id));
    if($('pref-preview'))$('pref-preview').hidden=!data.preview;
    if($('owner-login-panel'))$('owner-login-panel').hidden=true;
    if($('owner-signout'))$('owner-signout').hidden=false;
    if($('owner-public-link')){$('owner-public-link').hidden=false;$('owner-public-link').href='/bitcoin/?card='+id;}
    const root=$('preference-root');root.replaceChildren();
    const panel=node('section','',root);panel.className='panel';node('h2','Balance visibility',panel);
    const label=node('label','Mode',panel);label.htmlFor='pref-mode';const mode=node('select','',panel);mode.id='pref-mode';for(const [value,text]of[['flex_all','Flex all'],['private','Private']]){const o=node('option',text,mode);o.value=value;}mode.value=data.balanceMode;
    const choices=node('div','',panel);choices.id='pref-coins';switches(choices,data.showCoins);choices.hidden=mode.value!=='private';
    mode.onchange=()=>{choices.hidden=mode.value!=='private';if(mode.value==='private')for(const e of choices.querySelectorAll('input'))e.checked=false;};
    node('p','Anyone with your address can still look it up on a blockchain explorer.',panel).className='small';
    node('p','Tagged XRP account balances are always hidden. Turning a coin ON emails the verified owner.',panel).className='small';
    button(panel,'Save visibility',async()=>{const result=await post({action:'save',balanceMode:mode.value,showCoins:mode.value==='private'?selected(choices):Object.fromEntries(coins.map(c=>[c,false]))});await load(cardId);message(result.notification==='queued'?'Saved. The owner notification is queued for retry.':data.preview?'Saved in preview only. Any notification is captured as a test message.':'Visibility saved.');});
    const addressPanel=node('section','',root);addressPanel.className='panel';node('h2','Receiving addresses',addressPanel);
    const assetLabel=node('label','Coin / mainnet',addressPanel);assetLabel.htmlFor='pref-asset';const asset=node('select','',addressPanel);asset.id='pref-asset';for(const c of coins){const o=node('option',c.toUpperCase(),asset);o.value=c.toUpperCase();}
    const address=field(addressPanel,'New receiving address','pref-address');address.autocomplete='off';address.spellcheck=false;
    const tag=field(addressPanel,'XRP destination tag (optional; preserve tag 0)','pref-tag');tag.inputMode='numeric';
    node('p','Verify the complete address and mainnet in your wallet before saving. This changes where future payments from the displayed QR are received; it cannot move existing funds.',addressPanel).className='small';
    const consent=node('label','',addressPanel);consent.className='consent';const confirm=node('input','',consent);confirm.type='checkbox';confirm.id='pref-address-confirm';node('span','I checked the address and network in my wallet.',consent);
    button(addressPanel,'Save receiving address',async()=>{if(!confirm.checked||!address.value.trim())throw Error('Enter an address and confirm the network check.');await request('/api/bitcoin-card',{id:cardId,asset:asset.value,address:address.value.trim(),...(asset.value==='XRP'?{destinationTag:tag.value.trim()}:{})});address.value='';tag.value='';confirm.checked=false;await load(cardId);message(data.preview?'Address saved to a separate preview record. The live wallet was not changed.':'Receiving address saved.');});
    if(data.role==='staff'){
      const staff=node('section','',root);staff.className='panel';node('h2','Store handoff',staff);
      node('p',data.owner?`Assigned owner: ${data.owner.email} · ${data.owner.verified?'email verified':'email not verified yet'}`:'No owner email assigned.',staff);
      const email=field(staff,'Owner email (verify at the counter)','pref-owner-email','email');email.value=data.owner?.email||'';
      button(staff,'Assign owner email',async()=>{await post({action:'assign-owner',email:email.value.trim()});await load(cardId);message('Owner email assigned. The owner must sign in with its email code to verify it.');});
      const ownerLink=node('a','Open owner sign-in for this card',staff);ownerLink.href='/jewelry-owner/?card='+cardId;
      node('h3','Would you like the balances turned off?',staff);
      const question=node('div','',staff);const choose=node('div','',staff);choose.hidden=true;switches(choose);
      for(const [value,text]of[['keep-flex','Keep flex (show all)'],['private-coins','Private – choose coins'],['private-none','Private – show none']]){const l=node('label','',question);l.className='consent';const radio=node('input','',l);radio.type='radio';radio.name='handoff-choice';radio.value=value;radio.onchange=()=>{choose.hidden=value!=='private-coins';};node('span',text,l);}
      node('p','Public balance displays can reveal holdings to anyone who opens the jewelry link. Record the customer’s choice before completing handoff.',staff).className='small';
      const finish=button(staff,data.handoff?'Handoff already recorded':'Complete sale / handoff',async()=>{const answer=question.querySelector('input:checked');if(!answer)throw Error('Answer the balance question before completing handoff.');await post({action:'handoff',choice:answer.value,showCoins:selected(choose)});await load(cardId);message(data.preview?'Handoff recorded in preview only.':'Handoff recorded with the staff account and time.');});finish.disabled=Boolean(data.handoff);
      if(data.handoff)node('p',`${data.handoff.choice} · ${data.handoff.staff} · ${new Date(data.handoff.at).toLocaleString()}`,staff);
      button(staff,'Retry queued owner notifications',async()=>{const r=await post({action:'retry-notifications'});message(`Processed ${r.processed} queued notification(s).`);});
      if(data.preview){node('h3','Preview email inbox — no messages sent',staff);for(const mail of data.previewEmails||[]){if(!mail)continue;node('p',mail.subject,staff);node('pre',mail.text,staff).className='mail-preview';}}
    }
    const history=node('details','',root);node('summary','Recent card audit log',history);for(const row of data.audit||[]){try{const fields=row[1],entry=JSON.parse(fields[fields.indexOf('event')+1]);node('p',`${entry.at} · ${entry.type} · ${entry.actor?.role||''} ${entry.actor?.id||''}${entry.choice?' · '+entry.choice:''}`,history).className='small';}catch(_){}}
    return data;
  }
  if($('owner-login')){
    request('/api/jewelry-admin').then(r=>{if($('pref-preview'))$('pref-preview').hidden=!r.preview;}).catch(()=>{});
    const initial=new URLSearchParams(location.search).get('card');if(initial&&/^[a-f0-9]{32}$/.test(initial))$('owner-id').value=initial;
    $('owner-send').onclick=async()=>{try{const r=await request('/api/owner-auth',{action:'request-code',id:$('owner-id').value.trim(),email:$('owner-email').value.trim()});message(r.message);if($('pref-preview'))$('pref-preview').hidden=!r.preview;}catch(e){message(e.message);}};
    $('owner-login').onsubmit=async e=>{e.preventDefault();try{await request('/api/owner-auth',{action:'verify-code',id:$('owner-id').value.trim(),email:$('owner-email').value.trim(),code:$('owner-code').value.trim()});$('owner-code').value='';await load($('owner-id').value.trim());message('Signed in.');}catch(e){message(e.message);}};
    $('owner-signout').onclick=async()=>{await request('/api/owner-auth',null,'DELETE');location.reload();};
    if(initial)load(initial).catch(()=>message('Sign in with the email assigned by the store.'));
  }
  return {load};
})();
