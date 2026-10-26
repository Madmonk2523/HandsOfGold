(()=>{
  'use strict';
  const title=document.getElementById('order-title'),message=document.getElementById('order-message'),details=document.getElementById('order-details'),button=document.getElementById('order-refresh');
  const sessionId=new URLSearchParams(location.search).get('session_id');
  async function check(){
    if(!sessionId){title.textContent='Check your order';message.textContent='Open the confirmation link from Stripe, or call us with your payment reference.';button.hidden=true;return;}
    button.disabled=true;message.textContent='Checking the payment with Stripe…';
    try{
      const response=await fetch('/api/catalog-checkout?session_id='+encodeURIComponent(sessionId),{cache:'no-store'});const result=await response.json();if(!response.ok)throw Error(result.error||'Payment status is temporarily unavailable.');
      title.textContent=result.status==='paid'?'Payment confirmed':'Payment is pending';
      message.textContent=result.status==='paid'?'We received your payment. Our team will contact you about availability and pickup.':'Stripe has not confirmed a completed payment for this order. Please check your payment confirmation before trying again.';
      details.replaceChildren();for(const text of [result.title,'Style '+result.sku,[result.karat,result.grams+' grams',result.dimensions].filter(Boolean).join(' · '),'Total including pickup tax: '+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(result.total)]){const paragraph=document.createElement('p');paragraph.textContent=text;details.append(paragraph);}details.hidden=false;
      if(result.status==='paid'){try{const key='hog-paid-'+sessionId;if(!sessionStorage.getItem(key)){(window.dataLayer=window.dataLayer||[]).push({event:'purchase',transaction_id:sessionId,value:result.total,currency:'USD'});sessionStorage.setItem(key,'1');}}catch(_){}button.hidden=true;}
    }catch(error){title.textContent='Payment verification needs attention';message.textContent=error.message+' Call (631) 264-6610 for help.';}
    finally{button.disabled=false;}
  }
  button.addEventListener('click',check);check();
})();
