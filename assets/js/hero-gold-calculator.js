(() => {
  'use strict';
  const register=document.getElementById('hero-gold-register');
  const calculator=document.getElementById('hero-gold-calculate');
  const status=document.getElementById('hero-gold-status');
  const result=document.getElementById('hero-gold-result');
  if(!register||!calculator||!status||!result)return;
  let token='';
  register.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!register.reportValidity())return;
    const fields=new FormData(register),phone=String(fields.get('phone')||'').trim();
    if(!/^[+\d\s().-]+$/.test(phone)||phone.replace(/\D/g,'').length<10||phone.replace(/\D/g,'').length>15){status.textContent='Please enter a valid phone number.';return;}
    const button=register.querySelector('button');button.disabled=true;status.textContent='Registering and notifying the store…';
    try{
      const response=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({leadType:'gold_calculator_hero',name:String(fields.get('name')||'').trim(),phone,consent:fields.get('consent')==='on',website:String(fields.get('website')||''),service:'Gold buying calculator',source:'homepage_hero_gold_calculator',page:location.origin+location.pathname,message:'Customer registered to use the homepage gold buying calculator and requested an estimate. Contact consent: call or text about selling gold; message and data rates may apply.'})});
      const data=await response.json();
      if(!response.ok||!data.success||!data.stored||!data.emailSent||!data.smsSent||!data.calculatorToken)throw Error(data.error||'Registration could not be completed. Please try again.');
      token=data.calculatorToken;register.hidden=true;calculator.hidden=false;status.textContent='Registered. Your details were sent to the store.';calculator.elements.weight.focus();
    }catch(error){status.textContent=error.message||'Unable to register. Please call (631) 264-6610.';}
    finally{button.disabled=false;}
  });
  calculator.addEventListener('submit',async event=>{
    event.preventDefault();if(!token||!calculator.reportValidity())return;
    const button=calculator.querySelector('button'),fields=new FormData(calculator);button.disabled=true;result.textContent='Calculating…';status.textContent='';
    try{
      const values={token,karat:fields.get('karat'),weight:fields.get('weight'),unit:fields.get('unit')};
      const response=await fetch('/api/gold-estimate?op=hero',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)}),data=await response.json();
      if(response.status===403){token='';calculator.hidden=true;register.hidden=false;throw Error(data.error||'Please register again.');}
      if(!response.ok||!Number.isFinite(data.estimate))throw Error(data.error||'Estimate unavailable. Please call (631) 264-6610.');
      result.textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(data.estimate);
      status.textContent=data.alertSent?'Your weight and estimate were sent to the store.':'Your estimate is ready. Please call (631) 264-6610 to discuss it.';
    }catch(error){result.textContent='';status.textContent=error.message;}
    finally{button.disabled=false;}
  });
})();
