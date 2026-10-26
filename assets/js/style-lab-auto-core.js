(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HOGAutoCore=factory();})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.score==null||p.score>.35);
  function mapPoint(p,source,stage,mirror=false,fit='cover'){const scale=(fit==='contain'?Math.min:Math.max)(stage.width/source.width,stage.height/source.height),dx=(stage.width-source.width*scale)/2,dy=(stage.height-source.height*scale)/2;return {x:mirror?stage.width-(p.x*scale+dx):p.x*scale+dx,y:p.y*scale+dy};}
  function ring(points){const base=points?.[13],joint=points?.[14],index=points?.[5],pinky=points?.[17];if(![base,joint,index,pinky].every(valid))return null;const palm=distance(index,pinky),finger=distance(base,joint);if(palm<12||finger<4||finger>palm*1.7)return null;return {x:base.x+(joint.x-base.x)*.28,y:base.y+(joint.y-base.y)*.28,width:palm*.30,angle:Math.atan2(joint.y-base.y,joint.x-base.x)+Math.PI/2};}
  function necklace(points,item={}){const a=points?.[5],b=points?.[6];if(![a,b].every(valid))return null;let left=a,right=b;if(a.x>b.x)[left,right]=[b,a];const span=distance(left,right);if(span<25)return null;const length=Number(item.lengthIn)||22,width=Number(item.widthMm)||4;return {x:(a.x+b.x)/2,y:(a.y+b.y)/2-span*.04,radius:span*.19,depth:span*(.14+Math.max(0,Math.min(14,length-16))*.014),thickness:Math.max(2,Math.min(span*.04,span*width/400)),angle:Math.atan2(right.y-left.y,right.x-left.x)};}
  function curve(n,t){const x=-n.radius*Math.cos(t),y=n.depth*Math.sin(t)-n.radius*.30,c=Math.cos(n.angle),s=Math.sin(n.angle);return {x:n.x+x*c-y*s,y:n.y+x*s+y*c};}
  return {distance,valid,mapPoint,ring,necklace,curve};
});
