/* Local archival images: pointer-centred wheel zoom, drag/pinch and keyboard pan. */
(() => {
'use strict';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
class ArchiveImageViewer {
 constructor({viewport, image, plus, minus, fit, range, value}) {
  Object.assign(this, {viewport, image, plus, minus, fit, range, value});
  this.zoom=1; this.base=1; this.x=0; this.y=0; this.width=0; this.height=0;
  this.ready=false; this.points=new Map(); this.gesture=null; this.lastTap=null;
  plus.addEventListener('click', () => this.zoomAt(this.zoom*1.5));
  minus.addEventListener('click', () => this.zoomAt(this.zoom/1.5));
  fit.addEventListener('click', () => this.fitImage());
  range.addEventListener('input', () => this.zoomAt(Number(range.value)/100));
  image.addEventListener('load', () => this.imageLoaded());
  image.addEventListener('error', () => {this.ready=false;viewport.classList.remove('loading');viewport.setAttribute('aria-label','The document image could not be loaded.');});
  viewport.addEventListener('wheel', e => {
   if(!this.ready)return;
   e.preventDefault();
   const point=this.local(e.clientX,e.clientY);
   const units=e.deltaMode===1?16:e.deltaMode===2?this.height:1;
   const delta=clamp(e.deltaY*units,-240,240);
   this.zoomAt(this.zoom*Math.exp(-delta*(e.ctrlKey ? 0.012 : 0.003)),point);
  }, {passive:false});
  viewport.addEventListener('pointerdown', e => this.pointerDown(e));
  viewport.addEventListener('pointermove', e => this.pointerMove(e));
  for(const event of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(event,e=>this.pointerEnd(e));
  viewport.addEventListener('dblclick', e => {
   e.preventDefault();
   if(this.lastTouch&&performance.now()-this.lastTouch<500)return;
   this.closer(this.local(e.clientX,e.clientY));
  });
  viewport.addEventListener('keydown', e => {
   const pans={ArrowLeft:[70,0],ArrowRight:[-70,0],ArrowUp:[0,70],ArrowDown:[0,-70]};
   if(pans[e.key]){e.preventDefault();this.x+=pans[e.key][0];this.y+=pans[e.key][1];this.render();}
   else if(e.key==='+'||e.key==='='){e.preventDefault();this.zoomAt(this.zoom*1.5);}
   else if(e.key==='-'||e.key==='_'){e.preventDefault();this.zoomAt(this.zoom/1.5);}
   else if(e.key==='0'||e.key==='Home'){e.preventDefault();this.fitImage();}
  });
  this.observer=new ResizeObserver(()=>this.resize());
  this.observer.observe(viewport);
 }
 open(src, alt, region=null) {
  this.cancelGesture();this.ready=false;this.zoom=1;this.width=0;this.height=0;
  this.initialRegion=region;
  this.viewport.classList.add('loading');this.viewport.setAttribute('aria-label','Document viewer');
  this.image.alt=alt;this.image.src=src;
  if(this.image.complete&&this.image.naturalWidth)this.imageLoaded();
 }
 imageLoaded() {
  if(this.ready||!this.image.naturalWidth)return;
  this.ready=true;this.viewport.classList.remove('loading');this.fitImage();
  if(this.initialRegion){this.focusRegion(this.initialRegion);this.initialRegion=null;}
 }
 focusRegion(region) {
  if(!this.ready||!this.viewport.clientHeight)return;
  this.dimensions();
  const [left,top,right,bottom]=region;
  this.zoom=clamp(Math.min((this.width-24)/(right-left),(this.height-24)/(bottom-top))/this.base,1,16);
  this.x=this.width/2-(left+right)/2*this.base*this.zoom;
  this.y=this.height/2-(top+bottom)/2*this.base*this.zoom;
  this.render();
 }
 local(x,y) {const box=this.viewport.getBoundingClientRect();return {x:x-box.left,y:y-box.top};}
 dimensions() {
  this.width=this.viewport.clientWidth;this.height=this.viewport.clientHeight;
  this.base=Math.min((this.width-24)/this.image.naturalWidth,(this.height-24)/this.image.naturalHeight);
 }
 fitImage() {
  if(!this.ready||!this.viewport.clientHeight)return;
  this.dimensions();this.zoom=1;
  this.x=(this.width-this.image.naturalWidth*this.base)/2;
  this.y=(this.height-this.image.naturalHeight*this.base)/2;
  this.render();
 }
 resize() {
  if(!this.ready||!this.viewport.clientWidth||!this.viewport.clientHeight)return;
  if(!this.width||!this.height){this.fitImage();return;}
  if(this.width===this.viewport.clientWidth&&this.height===this.viewport.clientHeight)return;
  const scale=this.base*this.zoom;
  const centre={x:(this.width/2-this.x)/scale,y:(this.height/2-this.y)/scale};
  this.dimensions();this.x=this.width/2-centre.x*this.base*this.zoom;this.y=this.height/2-centre.y*this.base*this.zoom;
  this.render();this.resetGesture();
 }
 zoomAt(next, point={x:this.width/2,y:this.height/2}) {
  if(!this.ready)return;
  next=clamp(next,1,16);
  const ratio=next/this.zoom;
  this.x=point.x-(point.x-this.x)*ratio;
  this.y=point.y-(point.y-this.y)*ratio;
  this.zoom=next;this.render();
 }
 closer(point) {if(this.zoom>=8)this.fitImage();else this.zoomAt(this.zoom*2,point);}
 render() {
  if(!this.ready)return;
  const scale=this.base*this.zoom;
  const w=this.image.naturalWidth*scale,h=this.image.naturalHeight*scale;
  this.x=w<=this.width?(this.width-w)/2:clamp(this.x,this.width-w-12,12);
  this.y=h<=this.height?(this.height-h)/2:clamp(this.y,this.height-h-12,12);
  this.image.style.width=this.image.naturalWidth+'px';
  this.image.style.height=this.image.naturalHeight+'px';
  this.image.style.transform=`translate(${this.x}px,${this.y}px) scale(${scale})`;
  this.range.value=String(Math.round(this.zoom*100));
  this.value.textContent=Math.round(this.zoom*100)+'%';
  this.range.setAttribute('aria-valuetext',Math.round(this.zoom*100)+' percent of fitted size');
  this.minus.disabled=this.zoom<=1;this.plus.disabled=this.zoom>=16;
  this.viewport.classList.toggle('can-pan',w>this.width||h>this.height);
 }
 resetGesture() {
  const points=[...this.points.values()];
  if(!points.length){this.gesture=null;return;}
  const middle=points.length>1?{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2}:points[0];
  this.gesture={middle,distance:points.length>1?Math.max(1,Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y)):0,x:this.x,y:this.y,zoom:this.zoom};
 }
 pointerDown(e) {
  if(!this.ready||(e.pointerType==='mouse'&&e.button!==0))return;
  e.preventDefault();this.viewport.focus({preventScroll:true});
  const point=this.local(e.clientX,e.clientY);
  this.points.set(e.pointerId,point);this.viewport.setPointerCapture(e.pointerId);
  this.viewport.classList.add('dragging');
  if(this.points.size===1)this.tapStart={point,time:performance.now(),moved:false};
  else if(this.tapStart)this.tapStart.moved=true;
  this.resetGesture();
 }
 pointerMove(e) {
  if(!this.points.has(e.pointerId)||!this.gesture)return;
  const point=this.local(e.clientX,e.clientY);this.points.set(e.pointerId,point);
  if(this.tapStart&&Math.hypot(point.x-this.tapStart.point.x,point.y-this.tapStart.point.y)>8)this.tapStart.moved=true;
  const points=[...this.points.values()],g=this.gesture;
  if(points.length>1){
   const distance=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y);
   const middle={x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2};
   const next=clamp(g.zoom*distance/g.distance,1,16),ratio=next/g.zoom;
   this.zoom=next;this.x=middle.x-(g.middle.x-g.x)*ratio;this.y=middle.y-(g.middle.y-g.y)*ratio;
  }else{this.x=g.x+point.x-g.middle.x;this.y=g.y+point.y-g.middle.y;}
  this.render();
 }
 pointerEnd(e) {
  if(!this.points.has(e.pointerId))return;
  this.points.delete(e.pointerId);
  if(e.pointerType==='touch')this.lastTouch=performance.now();
  if(e.type==='pointerup'&&e.pointerType==='touch'&&!this.points.size&&this.tapStart&&!this.tapStart.moved&&performance.now()-this.tapStart.time<300){
   const point=this.local(e.clientX,e.clientY),now=performance.now();
   if(this.lastTap&&now-this.lastTap.time<350&&Math.hypot(point.x-this.lastTap.point.x,point.y-this.lastTap.point.y)<25){this.closer(point);this.lastTap=null;}
   else this.lastTap={point,time:now};
  }else this.lastTap=null;
  if(this.viewport.hasPointerCapture(e.pointerId))this.viewport.releasePointerCapture(e.pointerId);
  if(!this.points.size)this.viewport.classList.remove('dragging');
  this.resetGesture();
 }
 cancelGesture() {
  for(const id of this.points.keys())if(this.viewport.hasPointerCapture(id))this.viewport.releasePointerCapture(id);
  this.points.clear();this.gesture=null;this.lastTap=null;this.tapStart=null;
  this.viewport.classList.remove('dragging');
 }
}
window.ArchiveImageViewer=ArchiveImageViewer;
})();
