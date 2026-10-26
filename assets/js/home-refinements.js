(()=>{
  'use strict';
  const reviews=document.getElementById('reviews');
  if(reviews){
    reviews.querySelectorAll('.review-card').forEach((card,index)=>{
      const quote=card.querySelector('p'),name=card.querySelector('h3');
      if(!quote||!name)return;
      quote.id='customer-review-'+(index+1);
      const button=document.createElement('button');button.type='button';button.className='review-expand';button.textContent='Read more';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',quote.id);button.setAttribute('aria-label','Read full review by '+name.textContent.trim());
      button.addEventListener('click',()=>{const open=card.classList.toggle('review-expanded');button.setAttribute('aria-expanded',String(open));button.textContent=open?'Read less':'Read more';button.setAttribute('aria-label',(open?'Collapse review by ':'Read full review by ')+name.textContent.trim());});
      card.append(button);
    });
    reviews.classList.add('reviews-mobile-ready');
  }
  const videos=Array.from(document.querySelectorAll('.jc-category-video')),button=document.querySelector('.jc-video-toggle');
  if(!videos.length||!button)return;
  const root=document.documentElement,reduce=matchMedia('(prefers-reduced-motion: reduce)'),visible=new Set();
  // Category previews start automatically; a saved background-animation preference
  // must not prevent the owner-requested video previews from starting.
  let categoryPaused=false;
  function paused(){return categoryPaused;}
  function sync(){
    button.textContent=paused()?'Play videos':'Pause videos';button.setAttribute('aria-label',paused()?'Play category videos':'Pause category videos');button.setAttribute('aria-pressed',String(!paused()));
    videos.forEach(video=>{
      if(paused()||document.hidden||!visible.has(video)){video.pause();return;}
      const source=video.querySelector('source');
      if(!source.src){source.src=source.dataset.src;video.load();}
      video.muted=true;const play=video.play();if(play)play.catch(()=>{});
    });
  }
  button.hidden=false;
  button.addEventListener('click',()=>{categoryPaused=!categoryPaused;sync();});
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting)visible.add(entry.target);else visible.delete(entry.target);});sync();},{threshold:.1});videos.forEach(video=>observer.observe(video));}
  // Without intersection support, the category posters remain lightweight fallbacks.
  // A new explicit site-wide motion choice still controls the category clips.
  new MutationObserver(()=>{categoryPaused=root.dataset.hogMotion==='paused';sync();}).observe(root,{attributes:true,attributeFilter:['data-hog-motion']});
  reduce.addEventListener('change',()=>{categoryPaused=reduce.matches;sync();});
  document.addEventListener('visibilitychange',sync);sync();
})();
