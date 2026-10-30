/* Atelier motion layer — intentionally isolated from storefront commerce code. */
(function(){
  'use strict';
  function init(){
    var root=document.querySelector('.hog26');
    if(!root)return;
    var nodes=root.querySelectorAll('[data-hog26-reveal]');
    if(!('IntersectionObserver' in window)||window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      nodes.forEach(function(n){n.classList.add('hog26-visible')});
    }else{
      var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add('hog26-visible');io.unobserve(e.target)}})},{threshold:.08,rootMargin:'0px 0px -35px 0px'});
      nodes.forEach(function(n){io.observe(n)});
    }
    var visual=root.querySelector('.hog26-hero-visual');
    if(visual&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&window.matchMedia('(pointer:fine)').matches){
      var img=visual.querySelector('img');
      visual.addEventListener('pointermove',function(e){
        var b=visual.getBoundingClientRect();
        var x=(e.clientX-b.left)/b.width-.5;
        var y=(e.clientY-b.top)/b.height-.5;
        if(img)img.style.objectPosition=(50+x*5)+'% '+(50+y*5)+'%';
      },{passive:true});
      visual.addEventListener('pointerleave',function(){if(img)img.style.objectPosition='center center'});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
