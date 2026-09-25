/* Animation and navigation only. Historical text is generated from content/*.md. */
(() => {
'use strict';
const $=id=>document.getElementById(id), data=window.ALFORD_WALK;
const {scenes,people,records}=data;
let settledScene=null;
const sceneFor=id=>scenes.find(s=>s.id===id)||scenes.find(s=>data.structure.groups.find(g=>g.id===s.id)?.segments.some(v=>(typeof v==='string'?v:v.id)===id));
const reduced=matchMedia('(prefers-reduced-motion: reduce)'), narrow=matchMedia('(max-width:700px)');
const clamp=n=>Math.max(0,Math.min(1,n)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const overview=[1650,2900,4600,7000],claim=[2250,450,4050,2300],john=[1100,4350,3550,2750],both=[1200,4850,3950,3650];
const defaults={camera:overview,map:0,grid:.58,jacob:0,john:0,later:0,seaborn:0,key:0,labels:[],image:null,familyVisible:0,graphic:0,regional:0};
const settings={
 map:{map:.85,labels:['river']},claim:{camera:claim,map:1,jacob:1,labels:['jacob']},
 john:{camera:john,map:1,john:1,labels:['john','riverSouth'],key:1},
 seaborn:{camera:both,map:1,john:1,later:1,seaborn:1,labels:['john','seaborn','riverSouth'],key:1},
 'all-land':{camera:overview,map:1,jacob:1,john:1,later:1,seaborn:1,labels:['jacob','john','seaborn','river'],key:1},
 image:{map:.035},family:{map:.06,familyVisible:1},regional:{regional:1},'river-home':{graphic:1},twins:{map:.12,graphic:1},farm:{map:.15,graphic:1},households:{map:.035,graphic:1},timeline:{map:.035,graphic:1},cities:{graphic:1},'adult-census':{map:.035,graphic:1},lineage:{map:.035,graphic:1}
};
const states=scenes.map(s=>{const year=Number(s.year.match(/\d{4}/)?.[0]);const context={john:year>=1858?1:0,later:year>=1861?1:0,seaborn:year>=1881?1:0,camera:year===1831?claim:year>=1858?both:overview};return {...defaults,...context,...settings[s.visual],...s};});
const labels=data.mapLabels.labels.map(l=>({...l}));
const ns='http://www.w3.org/2000/svg';
function svgEl(name,attrs){const el=document.createElementNS(ns,name);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));return el;}
const world=$('map-world'),grid=svgEl('g',{'class':'grids'});world.appendChild(grid);
for(const f of window.ALfordLandscape.features.filter(f=>f.kind==='grid'))grid.appendChild(svgEl('path',{d:f.d,'class':'land-grid'}));
for(const type of ['river-bank','river-water','river-center'])world.appendChild(svgEl('path',{d:window.ALfordLandscape.river,'class':type}));
const tractEls={},tractOutlines={};
for(const f of window.ALfordLandscape.features.filter(f=>f.kind==='tract')){
 const family=f.id==='T-JA-54'?'jacob':f.id==='T-SLA-1881'?'seaborn':'john';
 const el=svgEl('path',{d:f.d,'class':'land-tract '+family});world.appendChild(el);tractEls[f.id]=el;
 const outline=svgEl('path',{d:f.d,'class':'tract-reveal '+family,pathLength:1});world.appendChild(outline);tractOutlines[f.id]=outline;
}
for(const l of labels){const el=document.createElement('div');el.className='map-label '+l.class;el.innerHTML=`<span class="label-title">${l.title}</span><span class="label-sub">${l.sub}</span>`;$('map-labels').appendChild(el);l.el=el;}
for(const id of ['land-map','map-labels','map-key','map-compass','map-scale','geographic-context','map-source-label'])$(id).setAttribute('aria-hidden','true');
const riverAtlas=new AlfordRiverAtlas($('river-atlas'),data.riverAtlas,window.ALfordLandscape,records);
const beats=[...document.querySelectorAll('.beat')];
let anchors=[],width=innerWidth,height=innerHeight,docWidth=0,docHeight=0,queued=false,active=-1,shownId='',frameState=null,lastSaved=0,saveEnabled=false;
function measure(){
 width=$('landscape').clientWidth;height=$('landscape').clientHeight;
 anchors=beats.map((e,i)=>i===0?0:e.getBoundingClientRect().top+scrollY-(narrow.matches?200:165)-1);
 docWidth=$('document-stage').clientWidth;docHeight=$('document-stage').clientHeight;schedule();
}
function cameraFrame(c){const mobile=narrow.matches,w=width*(mobile?.83:.47),h=height*(mobile?.36:.68),scale=Math.min(w/c[2],h/c[3]);return {scale,x:width*(mobile?.49:.72)-c[0]*scale,y:height*(mobile?.30:.50)-c[1]*scale};}
function imageTransform(roi){const scale=Math.min(docWidth/(roi[2]-roi[0]),docHeight/(roi[3]-roi[1]));return {scale,x:(docWidth-(roi[2]-roi[0])*scale)/2-roi[0]*scale,y:(docHeight-(roi[3]-roi[1])*scale)/2-roi[1]*scale};}
function imageROI(s){const r=records[s.image];return s.roi||(Array.isArray(s.focus)?s.focus:null)||r.transcript?.focus||[0,0,...r.dimensions];}
function imageLayer(slot,s,opacity,progress=0,to=null,t=0){
 const holder=$(`image-${slot}-window`),img=$(`image-${slot}`);holder.style.opacity=opacity;
 if(!s.image||opacity<=0)return;
 const r=records[s.image],dims=r.dimensions,idx=states.indexOf(s),previous=states[idx-1];
 const start=previous?.image&&records[previous.image].image===r.image?imageROI(previous):[0,0,...dims];
 const target=imageROI(s),phase=reduced.matches?1:smooth(clamp((progress-.06)/.65));
 let roi=start.map((v,i)=>mix(v,target[i],phase));
 if(to)roi=roi.map((v,i)=>mix(v,imageROI(to)[i],t));
 // Use the held full-resolution image for a real discovery zoom, never enlarge a small crop.
 const src=r.transcript||s.roi||s.focus?r.image:(r.display||r.image);
 if(img.getAttribute('src')!==src){img.style.visibility='hidden';img.onload=()=>{img.style.visibility='visible';};img.src=src;img.alt=r.title;}if(img.complete&&img.naturalWidth)img.style.visibility='visible';
 const tr=imageTransform(roi);holder.style.clipPath=s.documentMode==='portrait'?`inset(${Math.max(0,tr.y+roi[1]*tr.scale)}px ${Math.max(0,docWidth-tr.x-roi[2]*tr.scale)}px ${Math.max(0,docHeight-tr.y-roi[3]*tr.scale)}px ${Math.max(0,tr.x+roi[0]*tr.scale)}px)`:'none';img.style.width=dims[0]+'px';img.style.height=dims[1]+'px';img.style.transform=`translate(${tr.x}px,${tr.y}px) scale(${tr.scale})`;
 if(slot==='a'){
  const hi=$('document-highlight');hi.hidden=!s.highlight;
  if(s.highlight){const [l,top,r,b]=s.highlight;hi.style.left=(tr.x+l*tr.scale)+'px';hi.style.top=(tr.y+top*tr.scale)+'px';hi.style.width=((r-l)*tr.scale)+'px';hi.style.height=((b-top)*tr.scale)+'px';hi.style.opacity=opacity*(reduced.matches?1:clamp((progress-.2)/.3));}
  const overview=$('document-overview'),thumb=$('overview-image'),mark=$('overview-box'),show=!['photograph','portrait'].includes(s.documentMode);
  overview.hidden=!show;overview.style.opacity=opacity;
  if(show){if(thumb.getAttribute('src')!==r.image)thumb.src=r.image;const w=narrow.matches?45:70,h=Math.min(narrow.matches?64:100,w*dims[1]/dims[0]),actualW=h*dims[0]/dims[1];overview.style.width=actualW+'px';overview.style.height=h+'px';
   mark.style.left=100*roi[0]/dims[0]+'%';mark.style.top=100*roi[1]/dims[1]+'%';mark.style.width=100*(roi[2]-roi[0])/dims[0]+'%';mark.style.height=100*(roi[3]-roi[1])/dims[1]+'%';}
 }

}
function directedCamera(s,p){
 const start=s.cameraStart||s.camera,phase=reduced.matches?1:smooth(clamp(p/.78));
 return cameraFrame(start.map((v,i)=>mix(v,s.camera[i],phase)));
}
const journeyLayer=svgEl('g',{'class':'journey-lines'});$('regional-world').appendChild(journeyLayer);
const journeyLabels=document.createElement('div');journeyLabels.className='journey-labels';$('regional-stage').appendChild(journeyLabels);
const contextLabels=document.createElement('div');contextLabels.className='atlas-labels';$('regional-stage').appendChild(contextLabels);
const contextItems=data.mapContext.labels.map(l=>{const el=document.createElement('div');el.className='atlas-label atlas-'+l.kind;el.textContent=l.name;contextLabels.appendChild(el);const dot=l.kind==='town'?svgEl('circle',{cx:l.point[0],cy:l.point[1],r:1.5,'class':'atlas-town-dot'}):null;if(dot)$('regional-world').appendChild(dot);return {...l,el,dot};}).sort((a,b)=>a.priority-b.priority);
const atlasFurniture=document.createElement('div');atlasFurniture.className='atlas-furniture';atlasFurniture.innerHTML='<span class="atlas-north" aria-hidden="true">N<span>↑</span></span><span class="atlas-scale"><i></i><small></small></span><button class="atlas-about" data-source="landscape">About this map ↗</button>';$('regional-stage').appendChild(atlasFurniture);
const journeyInset=document.createElement('aside');journeyInset.className='journey-inset';$('regional-stage').appendChild(journeyInset);
let journeyKey='';
function drawJourney(s,p){
 if(!s.journey)return;
 const j=s.journey,nodes=j.nodes,phase=reduced.matches?1:smooth(clamp((p-.08)/.7));
 if(journeyKey!==s.id){journeyKey=s.id;journeyInset.hidden=!s.mapInset;journeyInset.innerHTML=s.mapInset?`<small>${esc(s.mapInset.title)}</small><div>${s.mapInset.names.map((name,i)=>`<span><b>${esc(name)}</b><em>${esc(s.mapInset.captions[i])}</em></span>`).join('')}</div>`:'';journeyLayer.replaceChildren();journeyLabels.replaceChildren();
  nodes.forEach((node,i)=>{
   if(i)journeyLayer.appendChild(svgEl('path',{'class':'journey-path','data-leg':i}));
   journeyLayer.appendChild(svgEl('circle',{cx:node.point[0],cy:node.point[1],r:3,'class':'journey-stop','data-node':i}));
   const label=document.createElement('div');label.className='journey-label';label.innerHTML=`<strong>${esc(node.title)}</strong><small>${esc(node.date)}</small>`;journeyLabels.appendChild(label);
  });
 }
 const box=$('regional-stage').getBoundingClientRect(),w=box.width,h=box.height,caption=$('regional-label');
 caption.textContent=j.note;const bottom=caption.offsetHeight+18;
 $('regional-map').setAttribute('viewBox',`0 0 ${w} ${h}`);
 function frame(points){const xs=points.map(n=>n[0]),ys=points.map(n=>n[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);return {x:(minX+maxX)/2,y:(minY+maxY)/2,scale:Math.min((w-32)/(maxX-minX),(h-bottom-24)/(maxY-minY))};}
 const previous=states[states.indexOf(s)-1],b=frame(j.bounds),a=previous?.journey?frame(previous.journey.bounds):{...b,scale:b.scale*1.14};
 const scale=mix(a.scale,b.scale,phase),cx=mix(a.x,b.x,phase),cy=mix(a.y,b.y,phase);
 $('regional-world').setAttribute('transform',`translate(${w*.5-cx*scale} ${(h-bottom)*.5-cy*scale}) scale(${scale})`);
 for(const path of journeyLayer.querySelectorAll('path')){const leg=+path.dataset.leg,a=nodes[leg-1].point,b=nodes[leg].point,c=[(a[0]+b[0])/2,a[1]+(b[1]-a[1])*.24],t=leg<=j.from?1:phase,end=a.map((v,i)=>(1-t)*(1-t)*v+2*(1-t)*t*c[i]+t*t*b[i]),control=a.map((v,i)=>mix(v,c[i],t));path.setAttribute('d',`M${a} Q${control} ${end}`);}
 const matrix=$('regional-world').getScreenCTM(),occupied=[];
 function project(point){const q=new DOMPoint(...point).matrixTransform(matrix);return [q.x-box.left,q.y-box.top];}
 function overlaps(r){return occupied.some(o=>r.x<o.x+o.w+6&&r.x+r.w+6>o.x&&r.y<o.y+o.h+4&&r.y+r.h+4>o.y);}
 function place(el,x,y,preferred,mandatory=false){
  const ew=el.offsetWidth,eh=el.offsetHeight;
  const choices=[preferred,[10,-eh-7],[10,8],[-ew-10,8],[-ew-10,-eh-7],[10,-eh/2],[-ew-10,-eh/2],[7,23],[7,-eh-23],[-ew-7,23]];
  for(const [dx,dy] of choices){const r={x:x+dx,y:y+dy,w:ew,h:eh};
   if(r.x<6||r.x+r.w>w-6||r.y<8||r.y+r.h>h-bottom||overlaps(r))continue;
   el.style.left=r.x+'px';el.style.top=r.y+'px';el.style.opacity=1;occupied.push(r);return true;
  }
  if(mandatory){const r={x:Math.max(6,Math.min(w-ew-6,x+10)),y:Math.max(8,Math.min(h-bottom-eh,y+8)),w:ew,h:eh};el.style.left=r.x+'px';el.style.top=r.y+'px';el.style.opacity=1;occupied.push(r);return true;}
  el.style.opacity=0;return false;
 }
 nodes.forEach((node,i)=>{const [x,y]=project(node.point),el=journeyLabels.children[i],alpha=i<=j.from?1:clamp(phase*2-.3);place(el,x,y,[node.dx,node.dy],true);el.style.opacity=(x<5||x>w-5||y<5||y>h-bottom)?0:alpha;const circle=journeyLayer.querySelector(`[data-node="${i}"]`);circle.setAttribute('r',4/scale);circle.style.opacity=alpha;});
 let count=0;
 const priorities=s.region==='LA'?{'New Orleans':0,'Baton Rouge':1,'Mississippi River':2,'Pearl River':2,'Natchez':3,'Savannah':4,'GEORGIA':5,'ALABAMA':5,'MISSISSIPPI':5,'LOUISIANA':5}:s.region==='GA'?{'Savannah':0,'Augusta':1,'Oconee River':2,'Altamaha River':2,'Savannah River':3,'GEORGIA':4,'SOUTH CAROLINA':4}:null;
 const ordered=priorities?[...contextItems].sort((a,b)=>(priorities[a.name]??10+a.priority)-(priorities[b.name]??10+b.priority)):contextItems;
 for(const l of ordered){const [x,y]=project(l.point);l.el.style.opacity=0;if(l.dot){l.dot.style.opacity=0;l.dot.setAttribute('r',1.7/scale);}
  if(x<16||x>w-16||y<16||y>h-bottom-16||count>=(narrow.matches?8:16))continue;
  if(place(l.el,x,y,l.kind==='river'?[6,-17]:l.kind==='state'?[-l.el.offsetWidth/2,0]:[7,3])){count++;if(l.dot)l.dot.style.opacity=1;}
 }
 // Scale at the current latitude; this is a regional orientation map.
 const km=narrow.matches?(s.region==='NC'?50:200):(s.region==='NC'?50:100),pixels=km/6371*1850*scale;
 atlasFurniture.querySelector('i').style.width=pixels+'px';atlasFurniture.querySelector('small').textContent='≈ '+km+' km';atlasFurniture.querySelector('.atlas-north').style.transform=`rotate(${s.region==='NC'?-4:s.region==='GA'?-2:1}deg)`;
 $('regional-stage').dataset.region=s.region;$('regional-stage').dataset.pin='hidden';
}
function revealGraphic(s,p){
 const phase=reduced.matches?1:clamp(p/.65),elements=$('graphic-stage').querySelectorAll('.milestones>div,.household-card,.lineage-row,.census-adults>div');
 elements.forEach((el,i)=>{el.style.opacity=1;el.style.transform='none';});
 const blocks=$('graphic-stage').querySelectorAll('.farm-blocks i');blocks.forEach(el=>{el.style.opacity=1;});
 for(const path of $('graphic-stage').querySelectorAll('.city-connection,.river-home-flow')){path.style.strokeDasharray=path.getTotalLength();path.style.strokeDashoffset=path.getTotalLength()*(1-phase);}
 for(const el of $('graphic-stage').querySelectorAll('.inheritance-heir,.child-dots i'))el.style.opacity=1;
 const family=$('family-stage');if(s.family){family.querySelector('.family-child')?.style.setProperty('opacity','1');family.querySelector('.descent-line')?.style.setProperty('transform','scaleY(1)');}
}
function personButton(k,cls=''){return `<button class="family-person ${cls}" data-person="${k}" id="${cls.includes('line-person')||cls.includes('partner-person')?'lineage':'graphic'}-person-${k}"><span>${esc(people[k].graphicName||people[k].name)}</span><small>${esc(people[k].dates)}</small></button>`;}
const generations=[['john','margaret'],['seaborn','laura'],['esco','mary-lou'],['christine']];
function familyPosition(key){return generations.findIndex(row=>row.includes(key));}
function familyTrail(key){const at=familyPosition(key);return `<div class="generation-trail" aria-label="Place in Christine’s family">${generations.map((r,i)=>`<span class="${i===at?'current':''}">${esc(people[r[0]].name.split(' ')[0])}</span>${i<3?'<i aria-hidden="true">→</i>':''}`).join('')}</div>`;}
function familyHTML(s){const f=s.family;return `<div class="family-frame">${familyTrail(f[0])}<p class="family-overline">${esc(s.year)} · ${esc(s.familyCaption||'Marriage')}</p><div class="couple">${personButton(f[0])}<span class="couple-join" aria-hidden="true">&</span>${personButton(f[1])}</div>${f[2]&&s.child?`<div class="family-child"><span class="descent-line"></span><small>${esc(s.childLabel||'THEIR CHILD')}</small>${personButton(f[2],'child-card')}</div>`:f[2]?'<div class="family-child-space" aria-hidden="true"></div>':''}<p class="family-context">Select a name to see the records <span aria-hidden="true">↗</span></p></div>`;}
function graphicHTML(s){
 if(s.visual==='river-home'){const r=s.riverHome;return `<div class="inheritance-heading"><small>${esc(s.year)}</small><h3>${esc(r.family)}</h3><p>${esc(r.place)}</p></div><svg class="river-home-diagram" viewBox="0 0 600 340" role="img" aria-label="Diagram of inheritance: Julius and Lucy’s plantation, on both banks of the Tar River, left to their son Jacob"><defs><pattern id="bank-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(25)"><path d="M0 0V9" stroke="#9f9577" stroke-width="1" opacity=".35"/></pattern></defs><path class="inheritance-bank" d="M75 55Q150 40 256 65L290 202Q170 240 75 215Z M323 68Q435 40 523 65L523 218Q431 233 352 205Z"/><path class="river-home-bank" d="M278 5C240 65 343 91 306 155S272 229 332 270"/><path class="river-home-water" d="M278 5C240 65 343 91 306 155S272 229 332 270"/><path class="river-home-flow" d="M278 5C240 65 343 91 306 155S272 229 332 270"/><text class="river-home-river" x="357" y="152">${esc(r.river)}</text><text class="inheritance-bank-label" x="74" y="302">${esc(r.bankLabel)}</text></svg><div class="inheritance-heir"><small>${esc(r.transferLabel)}</small><span>${esc(r.inheritance)}</span></div><p class="graphic-note">${esc(r.note)}</p>`;}
 if(s.visual==='timeline'){
  const big=s.careerYears?`<div class="career-total"><strong>${s.careerYears}</strong><span>${esc(s.careerLabel)}<small>${esc(s.careerNote)}</small></span></div>`:'';
  return `${s.graphicTitle?`<p class="graphic-overline">${esc(s.graphicTitle)}</p>`:''}${big}<div class="milestones ${s.childCounts?'with-children':''}">${s.milestones.map((m,i)=>`<div><time>${esc(m[0])}</time><span class="milestone-dot" aria-hidden="true"></span><section><h3>${esc(m[1])}</h3>${s.childCounts?`<div class="child-dots" aria-label="${s.childCounts[i]} children">${Array.from({length:s.childCounts[i]},()=>'<i aria-hidden="true"></i>').join('')}</div>`:''}<p>${esc(m[2])}</p></section></div>`).join('')}</div>`;
 }
 if(s.visual==='farm'){const v=s.farmValues,total=v.improved+v.unimproved;return `<div class="farm-heading"><span class="graphic-overline">${esc(s.year)} · REPORTED FARM ACREAGE</span><h3>${esc(s.graphicTitle)}</h3></div><div class="farm-blocks" role="img" aria-label="${v.improved} improved acres and ${v.unimproved} unimproved acres, out of ${total}">${Array.from({length:total/v.unit},(_,i)=>`<i class="${i<v.improved/v.unit?'improved':''}"></i>`).join('')}</div><div class="farm-legend"><div><strong>${v.improved}</strong><span>improved acres</span></div><div><strong>${v.unimproved}</strong><span>unimproved acres</span></div></div><div class="farm-produce">${s.farmItems.map(t=>`<span>${esc(t)}</span>`).join('')}</div><p class="graphic-note">${esc(s.graphicLabels[2])}</p>`;}
 if(s.visual==='lineage')return `<p class="graphic-overline">${esc(s.graphicTitle)}</p><div class="lineage-summary">${generations.map((row,i)=>`<div class="lineage-row"><small class="generation-name">${esc(s.generationLabels[i])}</small><div class="lineage-couple">${row.map(k=>personButton(k,k===row[0]?'line-person':'partner-person')).join('<span class="lineage-join" aria-hidden="true">&</span>')}</div></div>${i<3?'<span class="lineage-link" aria-hidden="true"></span>':''}`).join('')}</div><p class="graphic-note">Select any name to explore this line.</p>`;
 if(s.visual==='cities'){
  const xy=(lon,lat)=>[65+(lon+91.75)*270,38+(31.27-lat)*315],pts=s.locations.map(p=>({...p,xy:xy(...p.coordinates)}));
  const riverPaths=data.christineMap.rivers.map(r=>{let d='';for(const line of r.lines){let pen=false;for(const p of line){if(p[0]<-92||p[0]>-89.5||p[1]<29.65||p[1]>31.5){pen=false;continue;}d+=(pen?'L':'M')+xy(...p).join(',');pen=true;}}return `<path d="${d}" class="context-river"/>`;}).join('');
  const offsets=[[12,-5],[-18,18],[-18,-8]];
  const riverText=[['Mississippi',[-91.05,30.2],43],['Pearl',[-89.85,30.9],76]].map(([name,target,angle])=>{const points=data.christineMap.rivers.filter(r=>r.name===name).flatMap(r=>r.lines.flat());const p=points.reduce((a,b)=>Math.hypot(a[0]-target[0],a[1]-target[1])<Math.hypot(b[0]-target[0],b[1]-target[1])?a:b),[x,y]=xy(...p);return `<text class="city-water-label" x="${x+10}" y="${y}" transform="rotate(${angle} ${x+10} ${y})">${name} River</text>`;}).join('');
  return `<p class="graphic-overline">${esc(s.graphicTitle)}</p><svg viewBox="0 0 630 560" class="cities-map" role="img" aria-label="Christine’s three places beside the Mississippi, Pearl and Bogue Chitto rivers"><defs><clipPath id="cities-clip"><rect x="0" y="0" width="630" height="560"/></clipPath></defs><g clip-path="url(#cities-clip)">${riverPaths}<path class="city-connection" d="M${pts.map(p=>p.xy.join(' ')).join(' L')}"/></g>${riverText}${pts.map((p,i)=>`<g transform="translate(${p.xy.join(' ')})" class="city-stop"><circle r="7"/><text class="city-number" y="3">${i+1}</text><g transform="translate(${offsets[i].join(' ')})" text-anchor="${i>0?'end':'start'}"><text y="-15">${esc(p.year)}</text><text class="city-name" y="6">${esc(p.name)}</text><text class="city-caption" y="25">${esc(p.role)}</text></g></g>`).join('')}<path d="M28 510H140" class="city-scale"/><text class="city-caption" x="28" y="533">≈ 40 km</text></svg><p class="graphic-note">${esc(s.graphicNote)}</p>`;
 }
 if(s.visual==='adult-census')return `<p class="graphic-overline">${esc(s.graphicLabel)}</p><div class="census-adults">${s.adults.map((p,i)=>`<div><span class="occupation-index">0${i+1}</span><h3>${esc(p[0])}</h3><div class="occupation-role">${esc(s.occupationLabels[i])}</div><p>${esc(s.workplaces[i])}</p><small>${esc(s.workDetails[i])}</small></div>`).join('')}</div><p class="graphic-note">${esc(s.graphicNote)}</p>`;
 if(s.visual==='twins'||s.visual==='households')return `<p class="graphic-overline">${esc(s.diagramHeading||s.year)}</p><div class="household-sequence">${s.cards.map((c,i)=>`${i?`<div class="household-link"><span></span><small>${esc(s.diagramLink||'')}</small><span></span></div>`:''}<div class="household-card"><small>${esc(c[0])}</small><h3>${i===0&&s.diagramPartner?`${esc(s.diagramPartner)} <em>&</em> `:''}${esc(c[1])}</h3><p>${esc(c[2])}</p></div>`).join('')}</div><p class="graphic-note">${esc(s.graphicNote)}</p>`;
 return '';
}
function draw(){
 // Document heights can change after fonts, disclosures, and dialog restoration.
 anchors=beats.map((e,i)=>i===0?0:e.getBoundingClientRect().top+scrollY-(narrow.matches?200:165)-2);
 queued=false;let i=0;while(i<anchors.length-1&&scrollY>=anchors[i+1])i++;
 const a=states[i],b=states[Math.min(i+1,states.length-1)],segment=clamp((scrollY-anchors[i])/((anchors[i+1]??(anchors[i]+beats[i].offsetHeight))-anchors[i]));
 const t=reduced.matches?0:smooth(clamp((segment-.68)/.32)),val=k=>mix(a[k],b[k],t),shown=t>.5?b:a;
 const ca=directedCamera(a,a.id===settledScene?1:segment),cb=directedCamera(b,0),cam={scale:mix(ca.scale,cb.scale,t),x:mix(ca.x,cb.x,t),y:mix(ca.y,cb.y,t)};
 world.setAttribute('transform',`translate(${cam.x},${cam.y}) scale(${cam.scale})`);$('land-map').style.opacity=val('map');grid.style.opacity=val('grid');
 for(const [id,el] of Object.entries(tractEls)){
  const opacity=val(id==='T-JA-54'?'jacob':id==='T-SLA-1881'?'seaborn':id==='T-JSA-1861'?'later':'john');el.style.opacity=opacity;
  const drawing=a.drawTract===id||(a.drawTract==='john'&&id.startsWith('T-JSA'));
  tractOutlines[id].style.opacity=drawing?opacity:0;tractOutlines[id].style.strokeDashoffset=reduced.matches?0:1-clamp(segment/.7);
 }
 labels.forEach(l=>{l.el.style.opacity=mix(a.labels.includes(l.id)?1:0,b.labels.includes(l.id)?1:0,t)*val('map');l.el.style.left=(cam.x+l.p[0]*cam.scale)+'px';l.el.style.top=(cam.y+l.p[1]*cam.scale-(narrow.matches?(l.id==='john'?30:l.id==='jacob'?22:0):0))+'px';});
 ['map-compass','map-scale','geographic-context','map-source-label'].forEach(id=>$(id).style.opacity=clamp((val('map')-.25)/.75));
 $('map-key').style.opacity=narrow.matches&&(shown.mapSteps||shown.mapQuote)?0:val('key')*val('map');$('map-evidence').style.opacity=shown.mapSteps||shown.mapQuote?val('map'):0;
 [...$('map-key').children].forEach((el,k)=>el.style.display=val(['jacob','john','seaborn'][k])>.02?'flex':'none');
 $('scale-bar').style.width=(804.672*cam.scale)+'px';$('scale-text').textContent='½ mile';
 // A grouped passage can change its photograph when its next dated section arrives.
 let visualA=a;
 if(a.id==='war'&&$('port-hudson').getBoundingClientRect().top<innerHeight*.6){visualA={...a,...data.allScenes.find(s=>s.id==='port-hudson'),id:a.id};}
 const same=visualA.image&&b.image&&records[visualA.image].image===records[b.image].image;
 imageLayer('a',visualA,same?1:(visualA.image?1-t:0),a.id===settledScene?1:segment,same?b:null,same?t:0);imageLayer('b',b,!same&&b.image?t:0,0);
 $('document-stage').dataset.mode=shown.documentMode||'record';
 const imageOpacity=mix(a.image?1:0,b.image?1:0,t);$('document-stage').style.opacity=imageOpacity;
 const record=shown===a?visualA.image:shown.image;const open=$('document-open');open.hidden=!record||imageOpacity<.45;
 $('document-stage').style.pointerEvents='none';open.style.pointerEvents=open.hidden?'none':'auto';
 $('document-focus-label').textContent=record?((shown===a?visualA:shown).focusLabel||records[record].transcript?.excerpts[records[record].transcript?.storyExcerpt||0]?.label||''):'';
 if(record){open.dataset.source=record;open.setAttribute('aria-label',`Expand ${records[record].title} to zoom and pan`);open.querySelector('span').innerHTML=esc(data.structure.recordInvitations[record]||('Explore '+records[record].title))+' <b aria-hidden="true">↗</b>';$('document-caption').textContent=records[record].caption||records[record].title;}
 $('family-stage').style.opacity=val('familyVisible');$('graphic-stage').style.opacity=val('graphic');
 $('family-stage').inert=!shown.family;$('graphic-stage').inert=!shown.graphic;
 $('regional-stage').style.opacity=val('regional');$('regional-stage').inert=!shown.regional;
 if(shown.regional){drawJourney(shown,shown.id===settledScene?1:shown===a?segment:0);}
 if(shownId!==shown.id){shownId=shown.id;
  if(shown.family)$('family-stage').innerHTML=familyHTML(shown);
  if(shown.graphic)$('graphic-stage').innerHTML='<div class="graphic-composition">'+graphicHTML(shown)+'</div>';
  $('graphic-stage').dataset.kind=shown.visual;$('graphic-stage').dataset.scene=shown.id;
  $('map-evidence').innerHTML=shown.mapSteps?`<div class="map-step-row">${shown.mapSteps.map(m=>`<span><b>${esc(m[0])}</b><small>${esc(m[1])}</small></span>`).join('')}</div>${shown.mapStepNote?`<p>${esc(shown.mapStepNote)}</p>`:''}`:shown.mapQuote?`<blockquote>${esc(shown.mapQuote)}</blockquote><small>${esc(shown.mapQuoteSource)}</small>`:'';

  document.body.dataset.visual=shown.visual;
  const context=$('geographic-context').children;context[0].textContent=shown.mapHeading||'WASHINGTON PARISH';context[1].textContent=shown.mapPlace||'Louisiana · Bogue Chitto River';
 }
 revealGraphic(shown,shown===a?segment:0);
 const riverActive=riverAtlas.update(a.id,a.id===settledScene?1:segment);
 document.body.dataset.riverAtlas=riverActive?'active':'inactive';
 $('progress-fill').style.transform=`scaleX(${clamp(scrollY/(document.documentElement.scrollHeight-innerHeight))})`;
 if(active!==i){active=i;$('current-year').textContent=a.year;document.querySelector('.header-place').textContent=a.place;document.body.dataset.scene=a.id;
  $('family-orientation').hidden=a.id==='beginning';
  const who={earlier:'Julius & Jacob · likely earlier ancestry',john:'John & Margaret · Christine’s great-grandparents',seaborn:'Seaborn & Laura · Christine’s grandparents',esco:'Esco & Mary Lou · Christine’s parents',christine:'Christine · the next generation'};
  $('family-context').innerHTML=`<span class="family-desktop">${esc(who[a.focus]||'')}</span><span class="chapter-mobile">${a.chapter?'Chapter '+a.part+' · '+esc(data.chapters.find(c=>c.id===a.chapter).title):''}</span>`;
  $('family-orientation').querySelectorAll('[data-person]').forEach(e=>{e.classList.toggle('current',e.dataset.person===a.focus);if(e.dataset.person===a.focus)e.setAttribute('aria-current','true');else e.removeAttribute('aria-current');});
  document.querySelectorAll('.chapter-contents').forEach(d=>{if(d.dataset.chapter===a.chapter)d.open=true;});
  document.querySelectorAll('#contents-dialog nav a').forEach(el=>{if(el.hash==='#'+a.id)el.setAttribute('aria-current','location');else el.removeAttribute('aria-current');});
 }
 if(saveEnabled&&active>0&&performance.now()-lastSaved>1000&&!document.querySelector('dialog[open]')){lastSaved=performance.now();try{localStorage.setItem('alford-reading-place',JSON.stringify(storyPosition()));}catch{}}
 frameState={scene:a.id,blend:t,camera:cam,index:i};
}
function schedule(){if(!queued){queued=true;requestAnimationFrame(draw);}}
addEventListener('scroll',schedule,{passive:true});addEventListener('resize',measure);reduced.addEventListener('change',schedule);narrow.addEventListener('change',measure);
const viewer=new ArchiveImageViewer({viewport:$('record-scroller'),image:$('source-image'),plus:$('zoom-in'),minus:$('zoom-out'),fit:$('zoom-fit'),range:$('zoom-range'),value:$('zoom-value')});
// The history entry owns the story position; changing the detail view never changes it.
let current=null,focusOrigin=null;
history.scrollRestoration='manual';
function storyPosition(){const i=Math.max(0,active),el=beats[i];return {id:el.id,offset:scrollY-(el.getBoundingClientRect().top+scrollY),y:scrollY};}
function revealTarget(id){const el=$(id);for(let p=el;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;measure();return el;}
function restore(pos){if(!pos)return;const el=revealTarget(pos.id);const y=el?el.getBoundingClientRect().top+scrollY+pos.offset:pos.y;scrollTo({top:y,behavior:'instant'});draw();}
function closeSurfaces(){for(const d of document.querySelectorAll('dialog[open]'))d.close();viewer.cancelGesture();document.body.classList.remove('dialog-open');}
function showRoute(state){
 const prev=current;closeSurfaces();current=state;
 if(!state||state.kind==='story'){
  if(state?.story)restore(state.story);
  if(prev?.focus){const target=document.getElementById(prev.focus);target?.focus({preventScroll:true});}
  return;
 }
 const dialog=$(state.kind==='person'?'person-dialog':state.kind==='record'?'source-dialog':'contents-dialog');
 if(state.kind==='person'){
  const p=people[state.key];if(!p)return;
  $('person-title').textContent=p.name;$('person-dates').textContent=p.dates;$('person-relationship').textContent=p.relationship;$('person-body').innerHTML=p.html;
  $('person-records').innerHTML=`<a class="profile-link explore-link" href="explore.html#person/${state.key}">Life, family & places ↗</a>`+p.records.map(k=>`<button class="preview-record" data-source="${k}" id="preview-record-${k}">${esc(records[k].title)}<span aria-hidden="true">↗</span></button>`).join('');
 }
 if(state.kind==='record'){
  const r=records[state.key];if(!r)return;
  const chapter=sceneFor(state.story?.id)?.chapter;let keys=[...new Set(scenes.filter(s=>s.chapter===chapter).flatMap(s=>s.records))];if(!keys.includes(state.key))keys=Object.keys(records);const at=keys.indexOf(state.key);$('source-sequence').innerHTML=[at>0?`<button data-adjacent-record="${keys[at-1]}">← ${esc(records[keys[at-1]].title)}</button>`:'<span></span>',at<keys.length-1?`<button data-adjacent-record="${keys[at+1]}">${esc(records[keys[at+1]].title)} →</button>`:''].join('');
  $('source-date').textContent=r.caption||'RECORD & SOURCES';$('source-title').textContent=r.title;
  $('source-note').innerHTML=r.html+(r.url?`<p><a href="${esc(r.url)}" target="_blank" rel="noopener">Collection record ↗</a></p>`:'');
  $('source-citation').textContent=r.citation+' · Archive: '+r.refs;
  dialog.classList.toggle('has-image',!!r.image);
  dialog.classList.toggle('has-transcript',!!r.transcript);
  $('record-workspace').hidden=!r.image;
  $('source-transcript').hidden=!r.transcript;
  $('source-transcript').innerHTML=r.transcript?`<h3 id="transcript-title">${esc(r.transcript.label)}</h3>${r.transcript.excerpts.map(e=>`${e.label?`<p class="excerpt-label">${esc(e.label)}</p>`:''}<blockquote>${esc(e.text)}</blockquote>`).join('')}${r.transcript.note?`<p class="transcription-note">${esc(r.transcript.note)}</p>`:''}${r.transcript.focus?'<button id="transcript-focus" type="button">Show these lines in the image ↗</button>':''}`:'';
  $('source-transcript').scrollTop=0;
  for(const id of ['record-tools','record-scroller','viewer-help','source-original'])$(id).hidden=!r.image;
  $('source-details').open=!r.image;
  $('back-preview').hidden=!state.person;
  if(state.person)$('back-preview').textContent='← Back to '+people[state.person].name;
  if(r.image)$('source-original').href=r.image;
 }
 const scene=scenes.find(s=>s.id===state.story?.id)||scenes[1];
 dialog.querySelectorAll('.return-story').forEach(b=>b.textContent=(state.direct?'Read this part of the story':'Return to story')+' · '+scene.year+' · '+scene.title);
 document.body.classList.add('dialog-open');dialog.showModal();dialog.scrollTop=0;
 if(state.kind==='record'&&records[state.key].image)viewer.open(records[state.key].image,records[state.key].title,state.roi);
 if(state.focusInDialog)document.getElementById(state.focusInDialog)?.focus({preventScroll:true});
}
function openDetail(kind,key,button){
 stopPlayback();
 if((kind==='person'&&!people[key])||(kind==='record'&&!records[key]))return;
 const existing=current&&current.kind!=='story'?current:null;
 const story=existing?.story||storyPosition();
 if(!existing){focusOrigin=button?.id||null;history.replaceState({kind:'story',story,focus:focusOrigin},'', '#'+story.id);}
 else if(button?.id){history.replaceState({...current,focusInDialog:button.id},'');}
 const scene=scenes.find(s=>s.id===(button?.id==='document-open'?shownId:story.id));
 const next={kind,key,story,depth:(existing?.depth||0)+1,focus:existing?.focus||focusOrigin,person:existing?.kind==='person'?existing.key:null,roi:button?.id==='document-open'&&scene?.image?imageROI(scene):null};
 history.pushState(next,'',kind==='contents'?'#contents':`#${kind}/${key}`);showRoute(next);
}
function backOne(){if(current?.direct)returnToStory();else history.back();}
function returnToStory(){if(current?.direct){const s=current.story;history.replaceState({kind:'story',story:s},'','#'+s.id);showRoute(history.state);}else if(current?.depth)history.go(-current.depth);}
function goPassage(id,{smoothScroll=true}={}){
 stopPlayback();
 const target=revealTarget(id);if(!target)return;closeSurfaces();current=null;settledScene=sceneFor(id)?.id;
 const gap=innerWidth<=700?140:145;const story={id,offset:-gap,y:target.getBoundingClientRect().top+scrollY-gap};
 const state={kind:'story',story};history.pushState(state,'','#'+id);current=state;
 scrollTo({top:story.y,behavior:smoothScroll&&!reduced.matches?'smooth':'instant'});target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
}
let playing=false,playFrame=0,playLast=0;
function stopPlayback(){playing=false;cancelAnimationFrame(playFrame);$('play-walk').setAttribute('aria-pressed','false');$('play-walk').innerHTML='Play <span aria-hidden="true">▷</span>';}
function playTick(now){if(!playing)return;const delta=Math.min(50,now-playLast);playLast=now;scrollBy({top:delta*.045,behavior:'instant'});if(scrollY>=document.documentElement.scrollHeight-innerHeight-2){stopPlayback();return;}playFrame=requestAnimationFrame(playTick);}
$('play-walk').hidden=reduced.matches;
$('play-walk').addEventListener('click',()=>{if(playing){stopPlayback();return;}playing=true;playLast=performance.now();$('play-walk').setAttribute('aria-pressed','true');$('play-walk').innerHTML='Pause <span aria-hidden="true">Ⅱ</span>';playFrame=requestAnimationFrame(playTick);});
for(const event of ['wheel','touchstart'])addEventListener(event,stopPlayback,{passive:true});
addEventListener('keydown',e=>{if(!e.target.closest?.('#play-walk')&&['Escape','ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key))stopPlayback();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlayback();});
reduced.addEventListener('change',()=>{stopPlayback();$('play-walk').hidden=reduced.matches;});
$('contents-button').addEventListener('click',e=>openDetail('contents',null,e.currentTarget));
$('back-preview').addEventListener('click',backOne);
document.addEventListener('click',e=>{
 if(e.target.closest('#transcript-focus')){const region=records[current?.key]?.transcript?.focus;if(region){viewer.focusRegion(region);$('record-scroller').scrollIntoView({block:'nearest',behavior:'instant'});$('record-scroller').focus({preventScroll:true});}return;}
 const explore=e.target.closest('a.explore-link');if(explore){try{sessionStorage.setItem('alford-explore-return',JSON.stringify({story:current?.story||storyPosition(),focus:e.target.id||focusOrigin}));}catch{}const u=new URL(explore.href,location.href);u.searchParams.set('from','story');explore.href=u.href;return;}
 const play=e.target.closest('[data-play-story]');if(play){if(reduced.matches)return;closeSurfaces();if(active===0)goPassage('north-carolina',{smoothScroll:false});$('play-walk').click();return;}
 const person=e.target.closest('[data-person]');if(person){e.preventDefault();openDetail('person',person.dataset.person,person);return;}
 const adjacent=e.target.closest('[data-adjacent-record]');if(adjacent){const state={...current,key:adjacent.dataset.adjacentRecord,roi:null};history.replaceState(state,'','#record/'+state.key);showRoute(state);return;}
 const source=e.target.closest('[data-source]');if(source){e.preventDefault();openDetail('record',source.dataset.source,source);return;}
 if(e.target.closest('.return-story')){returnToStory();return;}
 if(e.target.closest('.close-dialog')){backOne();return;}
 const anchor=e.target.closest('a[href^="#"]');if(anchor&&$(anchor.hash.slice(1))){e.preventDefault();goPassage(anchor.hash.slice(1));}
});
for(const dialog of document.querySelectorAll('dialog')){
 dialog.addEventListener('cancel',e=>{e.preventDefault();backOne();});
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)backOne();});
}
addEventListener('popstate',e=>{
 if(e.state)showRoute(e.state);else{closeSurfaces();current=null;const target=$(location.hash.slice(1));if(target)scrollTo({top:target.getBoundingClientRect().top+scrollY-77,behavior:'instant'});else scrollTo({top:0,behavior:'instant'});}
});
function initialRoute(){
 saveEnabled=false;active=-1;measure();const hash=decodeURIComponent(location.hash.slice(1)),[kind,key]=hash.split('/');
 if((kind==='person'&&people[key])||(kind==='record'&&records[key])){
  const scene=(kind==='record'&&scenes.find(s=>s.image===key))||scenes.find(s=>!s.hero&&(kind==='person'?s.people.includes(key):s.records.includes(key)))||scenes[1];
  const story={id:scene.id,offset:-77,y:0};restore(story);
  const state={kind,key,story,direct:true,depth:0};history.replaceState(state,'');showRoute(state);
 }else if(new URLSearchParams(location.search).has('resume')){try{const saved=JSON.parse(sessionStorage.getItem('alford-explore-return'));if(saved?.story){settledScene=sceneFor(saved.story.id)?.id;history.replaceState({kind:'story',story:saved.story},'','#'+saved.story.id);showRoute(history.state);if(saved.focus)$(saved.focus)?.focus({preventScroll:true});}}catch{}if(!current){const id=hash&&$(hash)?hash:'beginning';settledScene=sceneFor(id)?.id;showRoute({kind:'story',story:{id,offset:id==='beginning'?0:-145,y:0}});}}else if(hash&&$(hash)){settledScene=sceneFor(hash)?.id;revealTarget(hash);const story={id:hash,offset:innerWidth<=700?-140:-145,y:0};history.replaceState({kind:'story',story},'');showRoute(history.state);}
 else{history.replaceState({kind:'story',story:{id:'beginning',offset:0,y:0}},'');showRoute(history.state);}
 try{const saved=JSON.parse(localStorage.getItem('alford-reading-place'));if(saved&&$(saved.id)&&saved.id!=='beginning'){$('resume-link').hidden=false;$('resume-link').href='#'+saved.id;$('resume-link').textContent='Resume · '+scenes.find(s=>s.id===saved.id).year;$('resume-link').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();history.pushState({kind:'story',story:saved},'','#'+saved.id);showRoute(history.state);});}}catch{}
 draw();saveEnabled=true;
}
document.addEventListener('toggle',e=>{if(e.target.matches('.passage-records,.story-detail'))measure();},true);
addEventListener('pagehide',()=>{if(saveEnabled&&active>0&&!document.querySelector('dialog[open]'))try{localStorage.setItem('alford-reading-place',JSON.stringify(storyPosition()));}catch{}});
addEventListener('hashchange',()=>{const hash=decodeURIComponent(location.hash.slice(1)),[kind,key]=hash.split('/'),s=history.state;if((s?.kind===kind&&s?.key===key)||(s?.kind==='story'&&s?.story?.id===hash))return;initialRoute();});
addEventListener('load',()=>{initialRoute();saveEnabled=true;});measure();
window.alfordWalk={riverAtlas,getState:()=>frameState,states,sourceNotes:records,refresh:measure,viewer};
})();
