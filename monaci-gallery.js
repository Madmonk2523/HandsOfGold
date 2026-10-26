
/* Relative jewelry size illustrations; product specifications remain authoritative. */
(() => {
  "use strict";
  const NS="http://www.w3.org/2000/svg";
  function render(container, selection){
    const width=Number(selection.widthMm), length=Number(selection.lengthIn);
    if(!Number.isFinite(width)||!Number.isFinite(length)) return;
    const bracelet=selection.type==="bracelet", kind=bracelet?"bracelet":"necklace";
    const band=Math.max(4,Math.min(22,width*.72+2));
    const radiusX=66+(Math.max(7,Math.min(10,length))-7)*10;
    const radiusY=27+(Math.max(7,Math.min(10,length))-7)*8;
    const bottom=bracelet?170+radiusY:185+(Math.max(16,Math.min(24,length))-16)*9;
    const backdrop=bracelet
      ? '<path d="M236 307 L249 200 Q254 171 249 143 L239 65 Q234 30 256 12 L344 12 Q366 30 361 65 L351 143 Q346 171 351 200 L364 307 Z" fill="#e8e5df" stroke="#d5d0c6" stroke-width="2"/><path d="M250 132 Q300 144 350 132" fill="none" stroke="#d0c9be" stroke-width="2"/>'
      : '<path d="M250 12 L250 62 Q246 84 220 94 L145 126 Q116 144 105 184 L84 307 L516 307 L495 184 Q484 144 455 126 L380 94 Q354 84 350 62 L350 12" fill="#e8e5df" stroke="#d5d0c6" stroke-width="2"/><path d="M220 94 Q300 122 380 94" fill="none" stroke="#d0c9be" stroke-width="2"/>';
    const shape=bracelet
      ? `M${300-radiusX} 170 A${radiusX} ${radiusY} 0 1 0 ${300+radiusX} 170 A${radiusX} ${radiusY} 0 1 0 ${300-radiusX} 170 Z`
      : `M245 75 C235 125 225 ${bottom} 300 ${bottom} C375 ${bottom} 365 125 355 75`;
    container.setAttribute("aria-label",`Approximate ${kind} size illustration: ${width} millimeters wide, ${length} inches long. Actual fit varies.`);
    container.dataset.previewType=kind;
    container.dataset.previewWidth=String(width);
    container.dataset.previewLength=String(length);
    container.querySelector(".cc-preview-dimensions").textContent=`${width} mm wide · ${length}" long`;
    container.querySelector("small").textContent=bracelet?"Fit varies by wrist size.":"Fit varies by neck size.";
    const svg=container.querySelector("svg");
    svg.innerHTML=`
      <defs><linearGradient id="cc-size-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#946218"/><stop offset=".24" stop-color="#efd18b"/>
        <stop offset=".45" stop-color="#fff1bf"/><stop offset=".64" stop-color="#bd872d"/>
        <stop offset=".85" stop-color="#f2d58b"/><stop offset="1" stop-color="#a46b18"/>
      </linearGradient></defs>
      ${backdrop}
      <path class="cc-preview-chain-path" d="${shape}" fill="none" stroke="#a97423" stroke-width="${band*.65}" stroke-linecap="round"/>
      <g class="cc-preview-links"></g>
      <rect x="${300-band*1.1}" y="${bottom-band*.42}" width="${band*2.2}" height="${band*.84}" rx="${band*.2}" fill="url(#cc-size-gold)" stroke="#ad7a28" stroke-width="1"/>
    `;
    const path=svg.querySelector(".cc-preview-chain-path"), group=svg.querySelector(".cc-preview-links");
    const total=path.getTotalLength(), count=Math.max(16,Math.round(total/(band*.9)));
    for(let i=0;i<(bracelet?count:count+1);i++){
      const at=total*i/count, p=path.getPointAtLength(at);
      const before=path.getPointAtLength(Math.max(0,at-.75)), after=path.getPointAtLength(Math.min(total,at+.75));
      const angle=Math.atan2(after.y-before.y,after.x-before.x)*180/Math.PI+32;
      const link=document.createElementNS(NS,"ellipse");
      link.setAttribute("rx",String(band*.88));link.setAttribute("ry",String(band*.4));
      link.setAttribute("transform",`translate(${p.x} ${p.y}) rotate(${angle})`);
      link.setAttribute("fill","none");link.setAttribute("stroke","url(#cc-size-gold)");
      link.setAttribute("stroke-width",String(Math.max(1.2,band*.25)));
      group.appendChild(link);
    }
  }
  window.HOG_MONACI_SIZE_PREVIEW={render};
})();

/* Monaci photo gallery (Oct 2026). Standalone: does not change pricing or checkout.
   To add a photo: upload it to the Vercel Blob store "hog-site-media" and add one line to PHOTOS. */
(() => {
"use strict";
const DIR = "https://fbsxmcmwt0dohcwz.public.blob.vercel-storage.com/";
const PHOTOS = [
  { src:"monaci-bracelet-flat.jpg",    thumb:"monaci-bracelet-flat-thumb.jpg",    for:"bracelet", alt:"Monaci Cuban bracelet in yellow gold with pavé box clasp" },
  { src:"monaci-bracelet-on-wrist.jpg",thumb:"monaci-bracelet-on-wrist-thumb.jpg",for:"bracelet", alt:"Monaci Cuban bracelet worn on the wrist", cover:true },
  { src:"monaci-bracelet-render.jpg",  thumb:"monaci-bracelet-render-thumb.jpg",  for:"bracelet", alt:"Monaci Cuban bracelet showing the signature box clasp" },
  { src:"monaci-chain-clasp.jpg",      thumb:"monaci-chain-clasp-thumb.jpg",      for:"necklace", alt:"Monaci Cuban chain with pavé box clasp, front view" },
  { src:"monaci-chain-studio.jpg",     thumb:"monaci-chain-studio-thumb.jpg",     for:"necklace", alt:"Monaci Cuban chain in yellow gold" },
  { video:"monaci-chain-clasp-video.mp4", poster:"monaci-chain-clasp-video-poster.jpg", for:"necklace", alt:"Video of the Monaci Cuban chain and clasp" }
];

function init(){
  if(!document.querySelector('link[href="/monaci-gallery.css?v=20261019-size-preview"]')){
    const styles=document.createElement("link");styles.rel="stylesheet";styles.href="/monaci-gallery.css?v=20261019-size-preview";document.head.appendChild(styles);
  }
  const holder=document.querySelector(".cc-product-image");
  if(!holder) return;
  const gallery=document.createElement("div");
  gallery.className="cc-gallery";
  gallery.innerHTML=
    '<div class="cc-gallery-stage"><img alt="" decoding="async"><video playsinline muted loop controls preload="none" hidden></video><div class="cc-size-preview" role="img" hidden><strong class="cc-preview-label">Approximate size illustration</strong><svg viewBox="0 0 600 320" aria-hidden="true"></svg><span class="cc-preview-dimensions"></span><small>Fit varies by neck size.</small></div></div>'+
    '<div class="cc-gallery-thumbs" role="list" aria-label="Monaci photos"></div>'+
    '<p class="cc-gallery-note" aria-live="polite"></p>';
  holder.replaceChildren(gallery);
  const stageImg=gallery.querySelector(".cc-gallery-stage img");
  const stageVid=gallery.querySelector(".cc-gallery-stage video");
  const preview=gallery.querySelector(".cc-size-preview");
  const thumbs=gallery.querySelector(".cc-gallery-thumbs");
  const note=gallery.querySelector(".cc-gallery-note");
  const buttons=[];
  let selection=null;
  let showingCatalog=false;
  const currentButton=document.createElement("button");
  currentButton.type="button";
  currentButton.className="cc-gallery-current";
  currentButton.setAttribute("role","listitem");
  currentButton.setAttribute("aria-label","Catalog image for selected size");
  const currentThumb=document.createElement("img");
  currentThumb.alt="";
  currentThumb.style.objectFit="contain";
  currentButton.appendChild(currentThumb);
  const previewButton=document.createElement("button");
  previewButton.type="button";previewButton.className="cc-preview-thumb";
  previewButton.setAttribute("role","listitem");previewButton.setAttribute("aria-label","Size illustration for selected necklace");
  previewButton.textContent="Size preview";
  function markActive(index){
    previewButton.classList.toggle("is-active",index===-2);
    previewButton.setAttribute("aria-pressed",String(index===-2));
    currentButton.classList.toggle("is-active",index===-1);
    currentButton.setAttribute("aria-pressed",String(index===-1));
    buttons.forEach((button,i)=>{
      button.classList.toggle("is-active",i===index);
      button.setAttribute("aria-pressed",String(i===index));
    });
  }
  function showCatalog(){
    if(!selection) return;
    preview.hidden=true;
    showingCatalog=true;
    stageVid.pause(); stageVid.hidden=true;
    stageImg.hidden=false;
    stageImg.classList.remove("is-cover");
    stageImg.src=selection.image;
    stageImg.alt=`Monaci Cuban ${selection.type} catalog image, ${selection.widthMm} mm × ${selection.lengthIn} inch, SKU ${selection.sku}`;
    note.textContent=`Selected size: ${selection.widthMm} mm × ${selection.lengthIn}" · ${selection.sku}. Catalog image; other photos show the Monaci style and clasp.`;
    markActive(-1);
  }
  function showReference(i){
    const photo=PHOTOS[i];
    preview.hidden=true;
    showingCatalog=false;
    markActive(i);
    note.textContent=`Style reference. Selected size: ${selection.widthMm} mm × ${selection.lengthIn}" · ${selection.sku}. See the specifications below for your piece.`;
    if(photo.video){
      stageImg.hidden=true; stageVid.hidden=false;
      if(!stageVid.getAttribute("src")){stageVid.poster=DIR+photo.poster;stageVid.src=DIR+photo.video;}
      stageVid.play().catch(()=>{});
    }else{
      stageVid.pause(); stageVid.hidden=true;
      stageImg.hidden=false; stageImg.src=DIR+photo.src; stageImg.alt=photo.alt;
      stageImg.classList.toggle("is-cover",!!photo.cover);
    }
  }
  function showPreview(){
    if(!selection || !window.HOG_MONACI_SIZE_PREVIEW) return;
    showingCatalog=false;
    stageVid.pause();stageVid.hidden=true;stageImg.hidden=true;preview.hidden=false;
    window.HOG_MONACI_SIZE_PREVIEW.render(preview,selection);
    markActive(-2);
    note.textContent=`Approximate illustration of relative width and length · ${selection.sku}. Choose a photo thumbnail to see the actual Monaci style.`;
  }
  previewButton.onclick=showPreview;
  currentButton.onclick=showCatalog;
  PHOTOS.forEach((photo,i)=>{
    const button=document.createElement("button");
    button.type="button";button.setAttribute("role","listitem");button.setAttribute("aria-label",photo.alt);
    if(photo.video) button.classList.add("cc-gallery-play");
    const thumb=document.createElement("img");thumb.loading="lazy";thumb.alt="";thumb.src=DIR+(photo.thumb||photo.poster);
    button.appendChild(thumb);button.onclick=()=>showReference(i);buttons[i]=button;
  });
  stageImg.addEventListener("error",()=>{
    if(!showingCatalog || !selection) return;
    const first=PHOTOS.findIndex(photo=>photo.for===selection.type && !photo.video);
    if(first>=0){showReference(first);note.textContent="The catalog image for this size is unavailable. Showing a Monaci style reference; use the selected dimensions below.";}
  });
  function update(next){
    if(!next || !next.image) return;
    selection=next;
    if(next.type!=="necklace") currentThumb.src=next.image;
    previewButton.setAttribute("aria-label",`Size illustration for selected ${next.type}`);
    currentButton.setAttribute("aria-label",`Catalog image for selected size: ${next.widthMm} mm × ${next.lengthIn} inch`);
    const referenceButtons=buttons.filter((button,i)=>PHOTOS[i].for===next.type);
    if(next.type==="necklace"){
      thumbs.replaceChildren(previewButton,...referenceButtons);
      showPreview();
    }else{
      thumbs.replaceChildren(previewButton,currentButton,...referenceButtons);
      showPreview();
    }
  }
  document.addEventListener("hog:monaci-selection",event=>update(event.detail));
  update(window.HOG_MONACI_SELECTION);
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
})();
