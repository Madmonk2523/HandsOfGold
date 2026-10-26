(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HOGPhotoCore=factory();})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const types={necklace:'Chain',bracelet:'Bracelet',rings:'Ring',pendants:'Pendant',earrings:'Earrings'};
  // Only alpha is changed: jewelry colors and geometry stay as photographed.
  // Gentle mode removes border-connected white while keeping enclosed white details.
  function cutout(data,width,height,mode='gentle'){
    if(!(width>0&&height>0)||data.length!==width*height*4||!['gentle','strong'].includes(mode))throw Error('Invalid photo pixels');
    const count=width*height,mask=new Uint8Array(count),queue=new Uint32Array(count);let head=0,tail=0;
    const white=i=>{const j=i*4,min=Math.min(data[j],data[j+1],data[j+2]),max=Math.max(data[j],data[j+1],data[j+2]);return min>=231&&max-min<=20;};
    const add=i=>{if(!mask[i]&&white(i)){mask[i]=1;queue[tail++]=i;}};
    if(mode==='strong'){for(let i=0;i<count;i++)if(white(i))mask[i]=1;}
    else{for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}for(let y=1;y<height-1;y++){add(y*width);add(y*width+width-1);}while(head<tail){const i=queue[head++],x=i%width;if(x)add(i-1);if(x<width-1)add(i+1);if(i>=width)add(i-width);if(i<count-width)add(i+width);}}
    for(let i=0;i<count;i++)if(mask[i])data[i*4+3]=0;
    // A soft one-pixel fringe keeps the outside of the cutout from looking jagged.
    for(let i=0;i<count;i++)if(!mask[i]){const x=i%width,j=i*4,min=Math.min(data[j],data[j+1],data[j+2]),max=Math.max(data[j],data[j+1],data[j+2]);if(min>205&&max-min<28&&((x&&mask[i-1])||(x<width-1&&mask[i+1])||(i>=width&&mask[i-width])||(i<count-width&&mask[i+width])))data[j+3]=Math.min(data[j+3],Math.round((255-min)/50*255));}
    let left=width,top=height,right=-1,bottom=-1;for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>20){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    if(right<0)throw Error('No visible jewelry in this photo');const pad=3;left=Math.max(0,left-pad);top=Math.max(0,top-pad);right=Math.min(width-1,right+pad);bottom=Math.min(height-1,bottom+pad);return {x:left,y:top,width:right-left+1,height:bottom-top+1};
  }
  function supported(p){return Boolean(p&&types[p.type]&&typeof p.sku==='string'&&typeof p.image==='string'&&p.image);}
  return {types,cutout,supported};
});
