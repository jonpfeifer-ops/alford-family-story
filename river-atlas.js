/* A continuous river landscape. Geometry and wording come from reviewed data. */
(() => {
'use strict';
const ns='http://www.w3.org/2000/svg', clamp=x=>Math.max(0,Math.min(1,x)), ease=x=>x*x*(3-2*x), lerp=(a,b,t)=>a+(b-a)*t;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function svg(tag,attrs,parent){const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);parent?.appendChild(el);return el;}
window.AlfordRiverAtlas=class {
 constructor(container,config,geometry,records){
  this.el=container;this.config=config;this.geometry=geometry;this.records=records;this.key='';this.wide=false;this.motion=matchMedia('(prefers-reduced-motion: reduce)');this.replayFrame=0;
  container.innerHTML=`<header class="river-atlas-heading"><span class="river-atlas-eyebrow"></span><h3></h3><p></p></header><div class="river-atlas-canvas"><svg class="river-atlas-map" role="img"><title></title><defs><pattern id="atlas-lot-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V7" stroke="#84613d" stroke-opacity=".19" stroke-width="1"/></pattern></defs><g class="river-atlas-world"></g></svg><div class="river-atlas-labels" aria-hidden="true"></div><span class="river-atlas-north" aria-hidden="true">N<br>↑</span><div class="river-atlas-scale"><i></i><span></span></div><aside class="river-atlas-locator" aria-label="Location within the family’s land"><svg viewBox="-1500 -650 7200 7800" aria-hidden="true"><g></g><rect class="locator-frame"/></svg><span>The same valley</span></aside><button id="atlas-survey-open" class="river-survey" data-source="survey" aria-label="Open the 1831 survey and its transcription"><span class="river-survey-window"><img draggable="false" alt="Drawing of the tract from the 1831 heirs’ survey"></span><span class="river-survey-caption"><b>${escape(config.survey.title)}</b><q>${escape(config.survey.transcription)}</q><span>Open survey & transcription ↗</span></span></button></div><footer class="river-atlas-footer"><div class="river-atlas-legend"></div><div class="river-atlas-actions"><button class="atlas-wider" type="button" aria-pressed="false">Wider view</button><button class="atlas-replay" type="button">↻ Replay map</button><button id="atlas-record-open" class="atlas-record" type="button">Land record ↗</button></div><p>${escape(config.sourceNote)}</p></footer>`;
  this.canvas=container.querySelector('.river-atlas-canvas');this.map=container.querySelector('.river-atlas-map');this.world=container.querySelector('.river-atlas-world');this.labelLayer=container.querySelector('.river-atlas-labels');this.mini=container.querySelector('.river-atlas-locator g');
  const river=geometry.river;
  for(const f of geometry.features.filter(f=>f.kind==='grid'))svg('path',{d:f.d,class:'river-atlas-grid'},this.world);
  for(const cls of ['river-atlas-valley','river-atlas-bank','river-atlas-water','river-atlas-light'])svg('path',{d:river,class:cls},this.world);
  svg('path',{d:river,class:'locator-river'},this.mini);
  this.border=svg('path',{d:'M-45000 0H18000',class:'river-atlas-border'},this.world);
  this.tracts=geometry.features.filter(f=>f.kind==='tract').map(f=>{
   const family=f.id==='T-JA-54'?'jacob':f.id==='T-SLA-1881'?'seaborn':'john';
   return {...f,family,el:svg('path',{d:f.d,class:'river-atlas-tract '+family,pathLength:1},this.world),ink:svg('path',{d:f.d,class:'river-atlas-ink '+family,pathLength:1},this.world),mini:svg('path',{d:f.d,class:'locator-tract '+family},this.mini)};
  });
  this.sectionLabels=geometry.context.filter(f=>f.kind==='section').map(f=>({...f,el:this.makeLabel('river-section',f.name)}));
  this.labels=config.labels.map(f=>({...f,el:this.makeLabel('river-person '+f.family,`<b>${escape(f.title)}</b><small>${escape(f.sub)}</small>`)}));
  this.riverLabel=this.makeLabel('river-name','Bogue Chitto');this.stateLabel=this.makeLabel('river-state-line','Present-day Louisiana–Mississippi line');
  this.town=geometry.context.find(f=>f.kind==='town'&&f.name==='Osyka');
  this.townLabel=this.makeLabel('river-person osyka',`<b>${escape(config.orientation.town)}</b><small>${escape(config.orientation.townSub)}</small>`);
  this.townDot=svg('circle',{r:4,class:'river-town-dot'},this.map);
  this.northLabel=this.makeLabel('river-orientation-state',escape(config.orientation.north));this.southLabel=this.makeLabel('river-orientation-state',escape(config.orientation.south));
  this.distance=svg('path',{class:'river-distance'},this.map);this.distanceLabel=this.makeLabel('river-distance-label',escape(config.orientation.distance));
  this.cemetery=geometry.context.find(f=>f.kind==='cemetery');this.cemeteryEl=this.makeLabel('river-cemetery',`<span aria-hidden="true">✧</span><b>${escape(config.cemetery.title)}</b><small>${escape(config.cemetery.sub)}</small>`);
  this.cemeteryDot=svg('circle',{r:6,class:'river-cemetery-dot'},this.map);
  this.survey=container.querySelector('.river-survey');this.surveyImage=this.survey.querySelector('img');this.surveyImage.src=records.survey.image;
  container.querySelector('.atlas-wider').addEventListener('click',()=>this.toggleView());
  container.querySelector('.atlas-replay').addEventListener('click',()=>this.replay());
 }
 makeLabel(cls,html){const el=document.createElement('div');el.className=cls;el.innerHTML=html;this.labelLayer.append(el);return el;}
 update(id,p){
  const scene=this.config.scenes[id];this.el.hidden=!scene;this.el.inert=!scene;
  if(!scene){cancelAnimationFrame(this.replayFrame);this.replayFrame=0;this.cameraOverride=null;return false;}
  if(this.key!==id){cancelAnimationFrame(this.replayFrame);this.replayFrame=0;this.key=id;this.scene=scene;this.wide=false;this.cameraOverride=null;
   this.el.dataset.scene=id;this.el.querySelector('.river-atlas-eyebrow').textContent=scene.eyebrow;this.el.querySelector('h3').textContent=scene.title;this.el.querySelector('.river-atlas-heading p').textContent=scene.summary;this.map.querySelector('title').textContent=scene.title+'. '+this.config.scope;
   this.el.querySelector('.atlas-record').dataset.source=scene.record;
   this.el.querySelector('.atlas-record').textContent=scene.recordLabel||'Land record ↗';
   this.el.querySelector('.atlas-wider').hidden=scene.frame==='origins';
   this.el.querySelector('.river-atlas-legend').innerHTML=[['jacob','Jacob · 1807'],['john','John · 1858'],['seaborn','Seaborn · 1881']].filter(([k])=>scene[k]).map(([k,t])=>`<span class="${k}"><i></i>${t}</span>`).join('');
  }
  if(this.replayFrame&&Math.abs(p-(this.scrollProgress??p))>.005){cancelAnimationFrame(this.replayFrame);this.replayFrame=0;this.cameraOverride=null;}this.scrollProgress=p;
  if(!this.replayFrame)this.paint(p);
  return true;
 }
 toggleView(){
  cancelAnimationFrame(this.replayFrame);const from=[...this.camera],start=performance.now();this.wide=!this.wide;const to=this.config.frames[this.wide?(this.scene.wideFrame||'valley'):this.scene.frame];
  const tick=now=>{const p=this.motion.matches?1:clamp((now-start)/850);this.cameraOverride=from.map((v,i)=>lerp(v,to[i],ease(p)));this.paint(this.progress);this.replayFrame=p<1?requestAnimationFrame(tick):0;if(p===1)this.cameraOverride=null;};
  this.replayFrame=requestAnimationFrame(tick);
 }
 replay(){
  cancelAnimationFrame(this.replayFrame);const start=performance.now();this.wide=false;this.cameraOverride=null;
  const tick=now=>{const p=clamp((now-start)/5200);this.paint(p);this.replayFrame=p<1?requestAnimationFrame(tick):0;};
  this.replayFrame=requestAnimationFrame(tick);
 }
 paint(progress){
  this.progress=progress;const s=this.scene,mobile=innerWidth<=700,p=this.motion.matches?1:clamp(progress),phase=ease(clamp(p/.68));
  const w=this.canvas.clientWidth,h=this.canvas.clientHeight;this.map.setAttribute('viewBox',`0 0 ${w} ${h}`);
  const target=this.config.frames[this.wide?(s.wideFrame||'valley'):s.frame],start=this.config.frames[s.previous];const c=this.cameraOverride||target.map((v,i)=>this.wide?v:lerp(start[i],v,phase));this.camera=[...c];
  const origins=c[2]>16000;this.el.dataset.orientation=origins?'origins':'local';
  this.map.querySelector('title').textContent=origins?'Osyka, Mississippi, is about 16 miles west of Jacob Alford’s Bogue Chitto claim. The twins were born nearby in Louisiana; their exact birthplace is unknown.':s.title+'. '+this.config.scope;
  const scale=Math.min((w-(mobile?35:70))/c[2],(h-(mobile?55:65))/c[3]);
  const x=w*.5-c[0]*scale,y=h*.47-c[1]*scale;this.world.setAttribute('transform',`translate(${x} ${y}) scale(${scale})`);
  const project=pt=>[x+pt[0]*scale,y+pt[1]*scale];
  const draw=ease(clamp((p-.12)/.5));
  for(const t of this.tracts){
   const visible=s[t.family]&&!(t.id==='T-JSA-1861'&&s.year<'1861');
   const active=(this.key==='river'&&t.family==='jacob')||(this.key==='john-land'&&t.family==='john')||(this.key==='homestead'&&t.family==='seaborn');
   t.el.style.opacity=visible?(active?.18+.82*draw:1):0;t.ink.style.opacity=visible&&active?1:0;t.ink.style.strokeDashoffset=1-draw;t.mini.style.opacity=visible?1:0;
  }
  const mini=this.el.querySelector('.river-atlas-locator');mini.hidden=origins;
  const occupied=origins?[]:[{x:w-mini.offsetWidth-(mobile?9:14),y:h-mini.offsetHeight-(mobile?9:13),w:mini.offsetWidth,h:mini.offsetHeight}];
  if(s.survey){const r=ease(clamp((p-.12)/.54)),sw=lerp(w-24,mobile?w*.47:w*.45,r),sh=lerp(h-20,mobile?h*.57:h*.64,r);if(r>.5)occupied.push({x:14,y:h-sh-24,w:sw,h:sh});}
  const place=(el,pt,offset=[12,0],required=false)=>{
   const [px,py]=project(pt),ew=el.offsetWidth,eh=el.offsetHeight;
   if(px<0||py<0||px>w||py>h){el.style.opacity=0;return;}
   const positions=[offset,[12,-eh-9],[12,12],[-ew-12,-eh-9],[-ew-12,8],[12,-eh/2]];
   for(const [dx,dy] of positions){const r={x:px+dx,y:py+dy,w:ew,h:eh};
    if(r.x<8||r.x+ew>w-8||r.y<8||r.y+eh>h-25||occupied.some(o=>r.x<o.x+o.w+7&&r.x+ew+7>o.x&&r.y<o.y+o.h+5&&r.y+eh+5>o.y))continue;
    el.style.left=r.x+'px';el.style.top=r.y+'px';el.style.opacity=1;occupied.push(r);return;
   }
   if(required){el.style.left=Math.max(8,Math.min(w-ew-8,px-ew/2))+'px';el.style.top=Math.max(8,Math.min(h-eh-28,py+12))+'px';el.style.opacity=1;}else el.style.opacity=0;
  };
  for(const label of this.labels){label.el.style.opacity=0;if(label.family==='john')label.el.querySelector('small').textContent=s.year>'1861'?'Patents · 1858 & 1861':'Patents · 1858';if(s[label.family])place(label.el,s.survey&&!origins&&label.family==='jacob'?[3150,180]:label.point,origins&&label.family==='jacob'?[-95,18]:s.survey&&label.family==='jacob'?[-40,-50]:label.offset,true);}
  this.townLabel.style.opacity=0;this.townDot.style.opacity=origins?1:0;this.distance.style.opacity=origins?1:0;this.distanceLabel.style.opacity=0;this.northLabel.style.opacity=0;this.southLabel.style.opacity=0;
  if(origins){
   const [tx,ty]=project(this.town.point),[jx,jy]=project(this.labels.find(l=>l.id==='jacob').point),borderY=project([0,0])[1];
   this.townDot.setAttribute('cx',tx);this.townDot.setAttribute('cy',ty);place(this.townLabel,this.town.point,[-25,-52],true);
   for(const [el,dy] of [[this.northLabel,-23],[this.southLabel,9]]){el.style.opacity=1;el.style.left=(w*.46-el.offsetWidth/2)+'px';el.style.top=(borderY+dy)+'px';}
   const rulerY=Math.min(h-42,Math.max(ty,jy)+90);this.distance.setAttribute('d',`M${tx} ${rulerY-4}V${rulerY+4}M${tx} ${rulerY}H${jx}M${jx} ${rulerY-4}V${rulerY+4}`);
   this.distanceLabel.style.opacity=1;this.distanceLabel.style.left=((tx+jx-this.distanceLabel.offsetWidth)/2)+'px';this.distanceLabel.style.top=(rulerY+8)+'px';
  }
  const cemeteryVisible=s.john&&!this.wide;this.cemeteryEl.style.opacity=0;this.cemeteryDot.style.opacity=cemeteryVisible?1:0;
  if(cemeteryVisible){const [cx,cy]=project(this.cemetery.point);this.cemeteryDot.setAttribute('cx',cx);this.cemeteryDot.setAttribute('cy',cy);place(this.cemeteryEl,this.cemetery.point,[Math.max(8-cx,mobile?-150:-167),16],true);}
  const verticalRiver=origins||(s.frame!=='claim'&&!this.wide);this.riverLabel.classList.toggle('is-vertical',verticalRiver);
  this.riverLabel.style.opacity=0;place(this.riverLabel,verticalRiver?[2700,3950]:this.wide?[3600,2400]:[3800,1050],verticalRiver?[22,-50]:[-40,-15]);
  this.stateLabel.style.opacity=0;if(!origins&&project([0,0])[1]>10)place(this.stateLabel,[1000,-40],[-65,-48]);
  for(const section of this.sectionLabels){section.el.style.opacity=0;if(!this.wide&&s.john)place(section.el,section.point,[-20,0]);}
  const rect=this.el.querySelector('.locator-frame');rect.setAttribute('x',-x/scale);rect.setAttribute('y',-y/scale);rect.setAttribute('width',w/scale);rect.setAttribute('height',h/scale);
  const metres=origins?8046.72:this.wide?1609.344:(804.672*scale>115?402.336:804.672);this.el.querySelector('.river-atlas-scale i').style.width=(metres*scale)+'px';this.el.querySelector('.river-atlas-scale span').textContent=origins?'5 miles':this.wide?'1 mile':metres<500?'¼ mile':'½ mile';
  this.el.querySelector('.river-atlas-footer>p').textContent=origins?this.config.orientation.note:this.config.sourceNote;
  this.el.querySelector('.atlas-wider').textContent=this.wide?'Close view':'Wider view';this.el.querySelector('.atlas-wider').setAttribute('aria-pressed',this.wide);this.el.querySelector('.atlas-replay').hidden=this.motion.matches||s.frame==='origins';
  this.survey.hidden=!s.survey;
  if(s.survey){
   const reveal=ease(clamp((p-.12)/.54));this.el.dataset.comparison=reveal>.45?'map':'survey';
   const sw=lerp(w-24,mobile?w*.47:w*.45,reveal),sh=lerp(h-20,mobile?h*.57:h*.64,reveal);
   this.survey.style.width=sw+'px';this.survey.style.height=sh+'px';this.survey.style.left=lerp(12,14,reveal)+'px';this.survey.style.top=lerp(5,h-sh-24,reveal)+'px';
   const viewport=this.survey.querySelector('.river-survey-window'),r=this.config.survey.roi,dims=this.records.survey.dimensions,k=Math.min(viewport.clientWidth/(r[2]-r[0]),viewport.clientHeight/(r[3]-r[1]));
   this.surveyImage.style.width=dims[0]+'px';this.surveyImage.style.height=dims[1]+'px';this.surveyImage.style.transform=`translate(${(viewport.clientWidth-(r[2]-r[0])*k)/2-r[0]*k}px,${(viewport.clientHeight-(r[3]-r[1])*k)/2-r[1]*k}px) scale(${k})`;
   this.el.querySelector('.river-atlas-heading p').textContent=reveal>.45?this.config.survey.note:s.summary;
  }
  this.el.dataset.progress=p.toFixed(3);
 }
};
})();
