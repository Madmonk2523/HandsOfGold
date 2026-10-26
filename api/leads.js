'use strict';
const redis=require('./lib/redis');
const {randomBytes}=require('node:crypto');
const {command,configured}=redis;
const {parseBody,validate,checkRate}=require('./lib/lead-protection');
const DEFAULT_EMAIL='handsofgoldlongisland@gmail.com';
function conceptImageLink(value){
  if(typeof value!=='string')return '';
  const input=value.trim();
  if(!input||input.length>600||/[\u0000-\u0020\u007f\\]/.test(input))return '';
  try{
    const base=new URL(process.env.SITE_URL||'https://www.handsofgoldny.com');
    if(base.protocol!=='https:'||base.username||base.password)return '';
    const relative=input.startsWith('/')&&!input.startsWith('//');
    if(!relative&&!/^https:\/\//i.test(input))return '';
    const url=new URL(input,base.origin);
    if(url.protocol!=='https:'||url.username||url.password)return '';
    return url.href;
  }catch(_){return '';}
}
function clean(v,max=1200){return String(v==null?'':v).replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim().slice(0,max)}
function safeFields(body){const allowed=['catalogSource','chainStyle','details','goldKarat','approxWeight','repairType','stoneType','ringSize','engravingType','pieceType','length','width','karat','leadType','name','email','phone','message','service','source','page','utm_source','utm_campaign','offer','offer_terms','product','productSlug','piece','metal','stones','budget','size_dimensions','design_notes','request_summary','concept_id','concept_image_url','revision_notes','contact_time','consent','submitted_at','referrer'];const out={};for(const k of allowed){const v=clean(body[k],k==='design_notes'||k==='message'?3000:k==='concept_image_url'?600:800);if(v)out[k]=v}return out}
function notificationRecipients(){return [...new Set([process.env.LEAD_EMAIL||DEFAULT_EMAIL,process.env.LEAD_CC_EMAIL||''].flatMap(v=>v.split(',')).map(v=>v.trim().toLowerCase()).filter(Boolean))]}
async function formSubmit(payload,to){const inbox=encodeURIComponent(to);const r=await fetch('https://formsubmit.co/ajax/'+inbox,{method:'POST',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({_subject:payload.subject,_template:'table',_captcha:'false',...payload.fields})});const d=await r.json().catch(()=>({}));if(!r.ok||!([true,'true'].includes(d.success)))throw new Error('FormSubmit '+r.status+': not accepted');return true}
async function notifyGoldSms(fields,leadId){
  const key=process.env.TEXTBELT_API_KEY;
  const phone=process.env.LEAD_SMS_TO;
  if(!key||!phone){console.error('[hog-gold-sms]',leadId,'not configured');return false;}
  const name=clean(fields.name,50).normalize('NFKD').replace(/[^a-zA-Z0-9 '\-]/g,' ').replace(/\s+/g,' ').trim();
  const number=clean(fields.phone,25).replace(/[^+\d]/g,'').slice(0,16);
  const catalogSku=clean(fields.productSlug,35).replace(/[^a-zA-Z0-9-]/g,' ');
  const catalogWeight=clean(fields.approxWeight,18).replace(/[^0-9. a-zA-Z]/g,'');
  const catalogBrand=fields.catalogSource==='quality_gold'?'Quality Gold':fields.catalogSource==='monaci'?'Monaci':'Hands of Gold';
  const catalogSize=clean(fields.size_dimensions,60);
  const message=fields.catalog_alert ? `Hands of Gold inquiry\n${name.slice(0,22)}\nPhone ${number}\n${catalogBrand} ${clean(fields.karat,8)} ${catalogWeight}\n${catalogSku}\n${catalogSize}\nReply STOP to opt out` : fields.gold_grams ? `Hands of Gold estimate\n${name.slice(0,30)}\nPhone ${number}\n${fields.gold_grams} grams | ${fields.gold_karat}K | approx ${fields.estimate_usd}\nReply STOP to opt out` : `Hands of Gold - New gold calculator lead\nName: ${name}\nPhone: ${number}\nReply STOP to opt out`;
  const response=await fetch('https://textbelt.com/text',{method:'POST',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({key,phone,sender:'Hands of Gold',message}).toString()});
  const receipt=await response.json();
  if(!response.ok||receipt.success!==true||!receipt.textId){console.error('[hog-gold-sms]',leadId,'not accepted',JSON.stringify({status:response.status,reason:/URLs/i.test(receipt.error||'')?'url_filter':'provider_rejected'}));return false;}
  await command('SET','hog:gold-alert:'+leadId,JSON.stringify({textId:String(receipt.textId),sent_at:new Date().toISOString()}),'EX',604800);
  console.log('[hog-gold-sms-accepted]',JSON.stringify({leadId,textId:String(receipt.textId),quotaRemaining:receipt.quotaRemaining}));
  return true;
}
async function notifyStaff(payload){
  try{if(await resend(payload))return true}catch(e){console.error('[hog-lead-email]',payload.leadId,e.message)}
  const fallback=await Promise.allSettled(notificationRecipients().map(to=>formSubmit(payload,to)));
  const accepted=fallback.filter(r=>r.status==='fulfilled'&&r.value===true).length;
  console.log('[hog-lead-email-fallback]',JSON.stringify({leadId:payload.leadId,accepted,total:fallback.length}));
  if(accepted!==fallback.length)console.error('[hog-lead-email-incomplete]',payload.leadId);
  return accepted>0;
}
async function notifyRepairSms(fields,leadId){
  const key=process.env.TEXTBELT_API_KEY,phone=process.env.REPAIR_SMS_TO||'16315066697';
  if(!key){console.error('[hog-repair-sms]',leadId,'not configured');return false;}
  const ascii=(value,max)=>clean(value,max).normalize('NFKD').replace(/[^a-zA-Z0-9 .,'+()\/-]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
  const name=ascii(fields.name,20),number=clean(fields.phone,25).replace(/[^+\d]/g,'').slice(0,16);
  const repair=ascii(fields.repairType||'Jewelry/watch repair',25),details=ascii(fields.details||fields.message||'Please contact customer',35);
  const message=`Hands of Gold repair - Javier\n${name} ${number}\n${repair}\n${details}\nReply STOP to opt out`;
  const response=await fetch('https://textbelt.com/text',{method:'POST',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({key,phone,sender:'Hands of Gold',message}).toString()});
  const receipt=await response.json();
  if(!response.ok||receipt.success!==true||!receipt.textId){console.error('[hog-repair-sms]',leadId,'not accepted');return false;}
  // Record delivery separately from the lead so a receipt-store failure cannot
  // turn a successful text into a false failure or trigger a duplicate text.
  try{await command('SET','hog:repair-alert:'+leadId,JSON.stringify({textId:String(receipt.textId),sent_at:new Date().toISOString()}),'EX',604800);}catch(_){console.error('[hog-repair-sms-receipt]',leadId,'storage unavailable');}
  console.log('[hog-repair-sms-accepted]',JSON.stringify({leadId,textId:String(receipt.textId),quotaRemaining:receipt.quotaRemaining}));return true;
}
async function resend(payload){
  if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM_EMAIL)return false;
  const to=notificationRecipients();
  const rows=Object.entries(payload.fields).map(([k,v])=>`<tr><th align="left">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
  const image=conceptImageLink(payload.fields.concept_image_link);
  const imageHtml=image?`<p><a href="${esc(image)}"><img src="${esc(image)}" alt="Customer jewelry concept" width="480" style="width:100%;max-width:480px;border-radius:8px"></a></p><p><a href="${esc(image)}">View full-size design</a></p>`:'';
  const text=[payload.subject,...Object.entries(payload.fields).map(([k,v])=>`${k}: ${v}`)].join('\n');
  const r=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(8000),headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':'lead-'+payload.leadId},body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL,to,reply_to:payload.fields.email||process.env.LEAD_EMAIL||DEFAULT_EMAIL,subject:payload.subject,html:`<h2>${esc(payload.subject)}</h2>${imageHtml}<table>${rows}</table>`,text})});
  if(!r.ok)throw new Error(`Resend ${r.status}`);
  const receipt=await r.json();
  if(!receipt.id)throw new Error('Resend missing receipt');
  console.log('[hog-lead-email-accepted]',JSON.stringify({leadId:payload.leadId,emailId:receipt.id,recipients:to.length}));
  return true;
}
async function webhook(payload){if(!process.env.LEAD_WEBHOOK_URL)return false;const r=await fetch(process.env.LEAD_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json','User-Agent':'HandsOfGold-Leads/2.0'},body:JSON.stringify(payload)});if(!r.ok)throw new Error(`Webhook ${r.status}`);return true}

/* ---- Customer copy of their AI concept ------------------------------------
   Sends the design back to the person who made it, so the concept does not
   vanish when they close the tab and so it keeps selling for us in their
   inbox. Transactional only, sent solely to the address they typed, and only
   for a custom jewelry lead that actually carries a concept.
   Requires RESEND_API_KEY + RESEND_FROM_EMAIL. Never blocks or fails a lead. */
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function customerCopy(fields,leadId){
  if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM_EMAIL)return false;
  const to=clean(fields.email,240);
  const conceptId=clean(fields.concept_id,40);
  if(!to||to.indexOf('@')<1||!conceptId)return false;
  const img=conceptImageLink(fields.concept_image_link||fields.concept_image_url);
  const showImg=/^https:\/\//i.test(img);
  const first=esc((clean(fields.name,120).split(' ')[0])||'there');
  const rows=[['Piece',fields.piece],['Metal',fields.metal],['Stones',fields.stones],['Size / dimensions',fields.size_dimensions],['Budget',fields.budget]]
    .filter(r=>r[1]).map(r=>`<tr><td style="padding:4px 14px 4px 0;color:#8d8778;font-size:13px">${esc(r[0])}</td><td style="padding:4px 0;color:#F6F3EC;font-size:13px;font-weight:700">${esc(r[1])}</td></tr>`).join('');
  const html=`<div style="margin:0;padding:24px 12px;background:#0b0e14;font-family:Helvetica,Arial,sans-serif"><div style="max-width:560px;margin:0 auto;background:#080B12;border:1px solid rgba(199,150,56,.45);border-radius:14px;overflow:hidden"><div style="height:3px;background:linear-gradient(90deg,#0A2E73,#C79638 55%,#0A2E73)"></div><div style="padding:26px 24px"><p style="margin:0 0 4px;color:#C79638;font-size:11px;letter-spacing:.2em;text-transform:uppercase;font-weight:700">Hands of Gold</p><h1 style="margin:0 0 14px;color:#F6F3EC;font-size:24px;line-height:1.2;font-weight:700">Your custom concept, ${first}</h1><p style="margin:0 0 18px;color:rgba(246,243,236,.8);font-size:14px;line-height:1.55">Here is the design you created in our Custom Jewelry Studio. Keep this email &mdash; it is the easiest way to pick up where you left off.</p>${showImg?`<a href="${esc(img)}"><img src="${esc(img)}" alt="Your custom jewelry concept" width="512" style="width:100%;max-width:512px;border-radius:10px;border:1px solid rgba(199,150,56,.35);display:block"></a>`:''}<p style="margin:14px 0 6px"><span style="display:inline-block;padding:5px 11px;border-radius:999px;background:#0A2E73;border:1px solid rgba(199,150,56,.4);color:#F6F3EC;font-size:12px;font-weight:700;letter-spacing:.05em">Concept ID: ${esc(conceptId)}</span></p><table style="border-collapse:collapse;margin:14px 0 6px">${rows}</table><p style="margin:16px 0 18px;color:rgba(246,243,236,.55);font-size:11px;line-height:1.5">Concept image for visualization only. Final dimensions, stone counts, weights, construction, pricing and CAD may change after review by Hands of Gold. This email is not an order and not a price quote. Your concept image stays available for 45 days.</p><a href="tel:6312646610" style="display:inline-block;padding:13px 22px;border-radius:8px;background:#C79638;color:#080B12;font-size:15px;font-weight:800;text-decoration:none">Call (631) 264-6610</a><p style="margin:20px 0 0;color:rgba(246,243,236,.55);font-size:12px;line-height:1.6">A jeweler will follow up about your design. Mention Concept ID ${esc(conceptId)} and we will pull it straight up.<br>Hands of Gold Jewelry and Repairs &middot; 494 Oak St, Copiague, NY 11726</p></div></div><p style="max-width:560px;margin:12px auto 0;color:#5d6472;font-size:11px;text-align:center">You received this because you sent a custom design request to Hands of Gold. Reference ${esc(leadId)}.</p></div>`;
  const text=`Your custom concept from Hands of Gold\n\nConcept ID: ${conceptId}\n${showImg?'View your concept: '+img+'\n':''}\nConcept image for visualization only. Final dimensions, stone counts, weights, construction, pricing and CAD may change after review. This is not an order and not a price quote. Your concept image stays available for 45 days.\n\nQuestions? Call (631) 264-6610.\nHands of Gold Jewelry and Repairs, 494 Oak St, Copiague, NY 11726\nReference ${leadId}`;
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL,to:[to],reply_to:process.env.LEAD_EMAIL||DEFAULT_EMAIL,subject:`Your Hands of Gold concept - ${conceptId}`,html,text})});
  if(!r.ok)throw new Error('Resend customer copy '+r.status);
  return true;
}

function isSellGold(fields){return fields.leadType==='service'&&String(fields.service||'').trim().toLowerCase()==='sell gold';}
async function sellGoldCustomerCopy(fields,leadId){
  if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM_EMAIL)return false;
  const to=clean(fields.email,254);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))return false;
  const name=clean(fields.name,160),karat=clean(fields.goldKarat,80),weight=clean(fields.approxWeight,160),details=clean(fields.details,800);
  const rows=[['Karat',karat],['Approximate weight',weight],['Your description',details]].filter(row=>row[1]);
  const subject='We received your Sell Gold request — Hands of Gold';
  const text=`Hi ${name},\n\nThank you for contacting Hands of Gold. We received your Sell Gold request. Our team will follow up by phone or email.\n\n${rows.map(([label,value])=>label+': '+value).join('\n')}\n\nThis is a request confirmation, not a purchase offer or an appointment confirmation. Final offers are made in store after testing purity and weighing the gold.\n\nQuestions? Call (631) 264-6610.\n494 Oak Street, Copiague, NY 11726\nMon–Sat 10 AM–7 PM; Sunday 1 PM–5 PM\nReference: ${leadId}`;
  const html=`<div style="background:#0b0e14;padding:24px;font-family:Arial,sans-serif"><div style="max-width:560px;margin:auto;padding:26px;border:1px solid #c79638;border-radius:12px;background:#111722;color:#f6f3ec"><p style="color:#e3c17e;letter-spacing:.12em;font-size:12px">HANDS OF GOLD</p><h1 style="font-size:25px">We received your Sell Gold request.</h1><p>Hi ${esc(name)},</p><p>Thank you for contacting us. Our team will follow up by phone or email.</p><table style="border-collapse:collapse">${rows.map(([label,value])=>`<tr><th align="left" style="padding:7px 14px 7px 0;color:#e3c17e">${esc(label)}</th><td style="padding:7px 0">${esc(value)}</td></tr>`).join('')}</table><p style="font-size:13px;line-height:1.6">This is a request confirmation, not a purchase offer or an appointment confirmation. Final offers are made in store after testing purity and weighing the gold.</p><p><a style="color:#e3c17e" href="tel:6312646610">Call (631) 264-6610</a></p><p style="font-size:12px;line-height:1.6">494 Oak Street, Copiague, NY 11726<br>Mon–Sat 10 AM–7 PM · Sunday 1 PM–5 PM<br>Reference: ${esc(leadId)}</p></div></div>`;
  const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(8000),headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':'sell-gold-confirmation-'+leadId},body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL,to:[to],reply_to:process.env.LEAD_EMAIL||DEFAULT_EMAIL,subject,text,html})});
  const receipt=await response.json().catch(()=>({}));if(!response.ok||!receipt.id)throw Error('Sell Gold confirmation not accepted');
  console.log('[hog-sell-gold-customer-email-accepted]',JSON.stringify({leadId,emailId:receipt.id}));return true;
}

module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store,max-age=0');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({success:false,error:'Method not allowed.'})}
  let body;try{body=parseBody(req)}catch(_){return res.status(400).json({success:false,error:'Invalid request.'})}
  const heroRegistration=body.leadType==='gold_calculator_hero';
  const catalogInquiry=body.leadType==='product_inquiry'&&body.source==='jewelry_catalog';
  const repairInquiry=body.leadType==='service'&&(body.service==='Jewelry & Watch Repair'||body.source==='HandsOfGoldNY.com jewelry-repair page');
  if(repairInquiry&&(!String(body.phone||'').trim()||!body.consent))return res.status(400).json({success:false,error:'Please include your phone number and contact consent.'});
  if(catalogInquiry&&(!String(body.phone||'').trim()||body.consent!==true))return res.status(400).json({success:false,error:'Please include your phone number and contact consent.'});
  if(heroRegistration&&(!String(body.phone||'').trim()||body.consent!==true))return res.status(400).json({success:false,error:'Please include your phone number and contact consent.'});
  const validationError=validate(req,body);
  if(validationError)return res.status(400).json({success:false,error:validationError});
  try{
    if(!await checkRate(req,body,redis)){
      res.setHeader('Retry-After','3600');
      return res.status(429).json({success:false,error:'Too many requests. Please try later or call (631) 264-6610.'});
    }
  }catch(e){
    console.error('[hog-lead-protection] unavailable');
    return res.status(503).json({success:false,error:'We cannot receive online requests right now. Please call (631) 264-6610.'});
  }
  const fields=safeFields(body),name=clean(fields.name,160),email=clean(fields.email,240),phone=clean(fields.phone,80);
  if(!name||(!email&&!phone))return res.status(400).json({success:false,error:'Please include your name and either an email or phone number.'});
  const leadType=clean(fields.leadType||'website_lead',80); const subjectMap={gold_calculator_hero:'New Gold Calculator Registration — HandsOfGoldNY.com',welcome_offer:'New Hands of Gold 10% Website Lead',labor_day_25:'New Hands of Gold Labor Day 25% Website Lead',custom_jewelry:'NEW CUSTOM JEWELRY REQUEST — HandsOfGoldNY.com',product_inquiry:`Product Inquiry — ${clean(fields.product||'Hands of Gold',140)}`,service:`Service Inquiry — ${clean(fields.service||'Hands of Gold',140)}`};
  const leadId=`HOG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`; const now=new Date().toISOString(); fields.lead_id=leadId; fields.received_at_utc=now;
  if(repairInquiry)fields.assigned_to='Javier';
  const imageLink=conceptImageLink(fields.concept_image_url);
  if(imageLink)fields.concept_image_link=imageLink;
  const lead={id:leadId,lead_type:leadType,name,email,phone,status:'new',created_at:now,assigned_to:repairInquiry?'Javier':'',next_follow_up:'',notes:'',payload:fields}; const payload={leadId,leadType,subject:repairInquiry?'Repair Request for Javier — Hands of Gold':subjectMap[leadType]||'New Hands of Gold Website Lead',fields};
  console.log('[hog-lead]',JSON.stringify({leadId,leadType,name,email,phone,product:fields.product||'',service:fields.service||'',page:fields.page||''}));
  let stored=false; if(configured()){try{await command('LPUSH','hog:leads',JSON.stringify(lead));await command('LTRIM','hog:leads','0','1999');stored=true}catch(e){console.error('[hog-lead-storage]',e.message)}}
  const results=await Promise.allSettled([notifyStaff(payload),webhook(payload)]); const delivered=results.some(r=>r.status==='fulfilled'&&r.value===true);
  if(!delivered&&!stored)return res.status(502).json({success:false,error:'We could not deliver your request. Please call (631) 264-6610.'});
  if(repairInquiry){
    let smsSent=false;
    try{smsSent=await notifyRepairSms(fields,leadId);}catch(_){console.error('[hog-repair-sms]',leadId,'notification unavailable');}
    return res.status(200).json({success:true,leadId,stored,emailSent:results[0].status==='fulfilled'&&results[0].value===true,smsSent});
  }
  if(heroRegistration){
    const emailSent=results[0].status==='fulfilled'&&results[0].value===true;
    if(!stored||!emailSent)return res.status(503).json({success:false,leadId,error:'We could not complete registration and notify the store. Please try again or call (631) 264-6610.'});
    let smsSent=false;
    try{smsSent=await notifyGoldSms(fields,leadId)}catch(e){console.error('[hog-gold-sms]',leadId,'notification unavailable')}
    if(!smsSent)return res.status(503).json({success:false,leadId,error:'Your details were saved and emailed, but the text alert could not be sent. Please call (631) 264-6610 for your estimate.'});
    try{
      const calculatorToken=randomBytes(24).toString('hex');
      await command('SET','hog:gold-calculator:'+calculatorToken,leadId,'EX',1800);
      await command('SET','hog:gold-contact:'+leadId,JSON.stringify({name,phone}),'EX',1800);
      return res.status(200).json({success:true,leadId,stored:true,emailSent:true,smsSent:true,calculatorToken});
    }catch(e){console.error('[hog-gold-registration]',leadId,'session unavailable');return res.status(503).json({success:false,error:'Registration received. Please call (631) 264-6610 for your estimate.'});}
  }
  if(catalogInquiry){
    const emailSent=results[0].status==='fulfilled'&&results[0].value===true;
    if(!stored||!emailSent)return res.status(503).json({success:false,leadId,error:'We could not complete your jewelry request. Please call (631) 264-6610.'});
    let smsSent=false;
    try{smsSent=await notifyGoldSms({...fields,catalog_alert:true},leadId)}catch(_){console.error('[hog-catalog-sms]',leadId,'notification unavailable')}
    return res.status(200).json({success:true,leadId,stored,emailSent,smsSent});
  }
  /* Customer copy is best-effort: the lead is already safe at this point. */
  let customerCopySent=false;
  try{customerCopySent=isSellGold(fields)?await sellGoldCustomerCopy(fields,leadId):await customerCopy(fields,leadId)}catch(e){console.error('[hog-lead-customer-copy]',e.message)}
  return res.status(200).json({success:true,leadId,stored,emailSent:results[0].status==='fulfilled'&&results[0].value===true,customerCopy:customerCopySent});
};

// Shared by the authenticated calculator route; no additional public endpoint.
module.exports.notifyStaff=notifyStaff;
module.exports.notifyGoldSms=notifyGoldSms;
