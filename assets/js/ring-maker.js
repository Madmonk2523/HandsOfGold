(function(){
  'use strict';
  var trigger=document.getElementById('ring-maker-open');
  var dialog=document.getElementById('ring-maker');
  var close=document.getElementById('ring-maker-close');
  var frame=document.getElementById('ring-maker-frame');
  if(!trigger||!dialog||!close||!frame||typeof dialog.showModal!=='function')return;
  var previousOverflow='';
  trigger.addEventListener('click',function(event){
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;
    event.preventDefault();
    if(dialog.open)return;
    if(!frame.hasAttribute('src'))frame.src=frame.dataset.src;
    previousOverflow=document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow='hidden';
    close.focus();
  });
  close.addEventListener('click',function(){dialog.close()});
  dialog.addEventListener('click',function(event){
    if(event.target!==dialog)return;
    var bounds=dialog.getBoundingClientRect();
    if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();
  });
  dialog.addEventListener('close',function(){
    document.body.style.overflow=previousOverflow;
    trigger.focus();
  });
})();
