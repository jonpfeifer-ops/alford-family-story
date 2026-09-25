/* Read-only pedigree: reviewed relationships; probable links remain visibly qualified. */
(() => {
'use strict';
const E = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const personIcon = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="10" r="5"/><path d="M6 29v-5a10 10 0 0 1 20 0v5Z"/></svg>';
window.AlfordTree = class {
 constructor(root, data, start) {
  this.root = root;
  this.data = data;
  this.people = Object.fromEntries(data.people.map(p => [p.id, p]));
  this.edges = data.edges.filter(e => ['parent', 'spouse'].includes(e.kind));
  this.mobile = matchMedia('(max-width:600px)').matches;
  this.focus = this.people[start] ? start : 'christine';
  this.selected = this.focus;
  this.orientation = 'vertical';
  this.generations = this.mobile ? 2 : 4;
  this.showSpouses = !this.mobile;
  this.showLikely = true;
  this.expanded = new Set();
  this.shown = new Set();
  this.highlight = new Set();
  this.points = new Map();
  this.z = 1; this.x = 0; this.y = 0;
  this.renderShell(); this.reset(); this.bind();
 }
 adjacent(id, kind) {
  return this.edges.filter(e => this.showLikely || e.certainty !== 'likely').filter(e => kind === 'parents' ? e.kind === 'parent' && e.to === id : kind === 'children' ? e.kind === 'parent' && e.from === id : kind === 'spouses' ? e.kind === 'spouse' && [e.from,e.to].includes(id) : [e.from,e.to].includes(id)).map(e => e.from === id ? e.to : e.from);
 }
 renderShell() {
  this.root.innerHTML = `<div class="pedigree-toolbar">
   <label class="pedigree-person-picker"><span>Person</span><select id="tree-focus" aria-label="Starting person">${this.data.people.map(p => `<option value="${p.id}">${E(p.name)}</option>`).join('')}</select></label>
   <div class="pedigree-view-switch" role="group" aria-label="Tree layout"><button data-tree="vertical" aria-pressed="true">↑ Vertical</button><button data-tree="horizontal" aria-pressed="false">→ Horizontal</button></div>
   <label class="pedigree-generation-picker"><span>Generations</span><select id="tree-generations">${[2,3,4,5,6,7].map(n => `<option value="${n}">${n}</option>`).join('')}</select></label>
   <label class="pedigree-spouse-toggle"><input type="checkbox" id="tree-spouses"> Spouse</label>
   <label class="pedigree-spouse-toggle"><input type="checkbox" id="tree-likely" checked> Likely links</label>
   <button data-tree="home" class="pedigree-home">Christine’s tree</button>
  </div>
  <div class="pedigree-stage">
   <div class="tree-viewport" tabindex="0" role="region" aria-label="Interactive ancestor tree" aria-describedby="tree-help"><div class="tree-world"></div></div>
   <div class="pedigree-zoom" role="group" aria-label="Tree controls"><button data-tree="plus" aria-label="Zoom in">+</button><output class="tree-zoom-value" aria-label="Zoom level">100%</output><button data-tree="minus" aria-label="Zoom out">−</button><button data-tree="fit">Fit</button><button data-tree="center" aria-label="Center starting person">⌖</button><button data-tree="fullscreen" aria-label="Expand tree to fill window">⛶</button></div>
   <p class="pedigree-focus-caption"></p>
   <aside class="tree-details" aria-label="Person details" hidden></aside>
  </div>
  <div class="pedigree-footer"><p id="tree-help">Ancestors branch above the starting person. Use the arrows to open or close a branch. Drag to move; scroll or pinch to zoom.</p><span class="pedigree-count" aria-live="polite"></span></div>
  <p class="pedigree-legend"><span aria-hidden="true"></span>Dashed gold line: likely relationship</p>
  <p class="tree-path" aria-live="polite" hidden></p>
  <details class="accessible-tree"><summary>Relationships & source notes</summary><p class="small">Lines show the relationships included in this collection. Their supporting records and qualifications appear below. Missing branches mean no parent is recorded here.</p><ul></ul></details>`;
  this.viewport = this.root.querySelector('.tree-viewport');
  this.world = this.root.querySelector('.tree-world');
  this.panel = this.root.querySelector('.tree-details');
 }
 openGenerations(id, depth, seen = new Set()) {
  if (!depth || seen.has(id)) return;
  seen.add(id);
  const parents = this.adjacent(id, 'parents');
  if (parents.length) this.expanded.add(id);
  for (const parent of parents) this.openGenerations(parent, depth - 1, seen);
 }
 reset() {
  this.expanded.clear(); this.highlight.clear(); this.selected = this.focus;
  this.openGenerations(this.focus, this.generations - 1);
  this.panel.hidden = true;
  this.root.querySelector('.tree-path').hidden = true;
  this.draw(); this.fit();
 }
 setFocus(id) {
  if (!this.people[id]) return;
  this.focus = id; this.reset();
 }
 snapshot() {
  return {focus:this.focus, selected:this.selected, orientation:this.orientation, generations:this.generations, showSpouses:this.showSpouses, showLikely:this.showLikely, expanded:[...this.expanded], highlight:[...this.highlight], z:this.z, x:this.x, y:this.y, detailsOpen:!this.panel.hidden,fullScreen:this.root.classList.contains('tree-expanded')};
 }
 restore(state) {
  if (!state?.focus || !this.people[state.focus]) return;
  for (const key of ['focus','selected','orientation','generations','showSpouses']) this[key] = state[key];
  this.showLikely = state.showLikely !== false;
  this.expanded = new Set(state.expanded); this.highlight = new Set(state.highlight);
  this.root.classList.toggle('tree-expanded',!!state.fullScreen);document.body.classList.toggle('tree-fullscreen',!!state.fullScreen);
  this.draw(); this.z = state.z; this.x = state.x; this.y = state.y; this.transform();
  if (state.detailsOpen) this.details();
 }
 layout() {
  this.cardW = this.mobile ? (this.viewport.clientWidth<300?136:146) : 184; this.cardH = this.mobile ? 96 : 90;
  this.root.style.setProperty('--pedigree-card-width',this.cardW+'px');this.root.style.setProperty('--pedigree-card-height',this.cardH+'px');
  const vertical = this.orientation === 'vertical';
  const crossSize = vertical ? this.cardW : this.cardH;
  const siblingGap = vertical ? (this.mobile?18:26) : 32;
  const generationGap = vertical ? 156 : 256;
  const nodes = [], connectors = [];
  let maxDepth = 0;
  const branch = (id, depth, trail = []) => {
   const parents = this.expanded.has(id) && !trail.includes(id) ? this.adjacent(id,'parents').map(p => branch(p, depth + 1, [...trail,id])) : [];
   maxDepth = Math.max(maxDepth, depth);
   return {id, depth, parents, span:parents.length ? Math.max(crossSize, parents.reduce((sum,p) => sum+p.span,0) + siblingGap*(parents.length-1)) : crossSize};
  };
  const trunk = branch(this.focus,0);
  const arrange = (part, start) => {
   let cursor = start;
   for (const parent of part.parents) { arrange(parent,cursor); cursor += parent.span+siblingGap; }
   part.cross = part.parents.length ? (part.parents[0].cross+part.parents.at(-1).cross)/2 : start+part.span/2;
   const node = {id:part.id, depth:part.depth, x:vertical ? part.cross-this.cardW/2 : part.depth*generationGap, y:vertical ? (maxDepth-part.depth)*generationGap : part.cross-this.cardH/2, spouse:false};
   nodes.push(node);
   if (part.parents.length) connectors.push({child:node, parentIds:part.parents.map(p => p.id)});
  };
  arrange(trunk,0);
  const rootNode = nodes.find(n => n.id===this.focus);
  if (this.showSpouses) {
   this.adjacent(this.focus,'spouses').forEach((id,i) => nodes.push({id,depth:0,spouse:true,x:rootNode.x+(vertical?(i+1)*(this.cardW+52):0),y:rootNode.y+(vertical?0:(i+1)*(this.cardH+42))}));
  }
  const minX = Math.min(...nodes.map(n=>n.x)), minY = Math.min(...nodes.map(n=>n.y));
  nodes.forEach(n=>{n.x=n.x-minX+(this.mobile?12:40);n.y=n.y-minY+45;});
  this.width = Math.max(...nodes.map(n=>n.x))+this.cardW+(this.mobile?12:45);
  this.height = Math.max(...nodes.map(n=>n.y))+this.cardH+45;
  this.nodes = nodes; this.connectors = connectors;
  this.positions = Object.fromEntries(nodes.map(n => [n.id,n]));
  this.shown = new Set(nodes.map(n=>n.id));
 }
 draw() {
  this.layout();
  const vertical = this.orientation==='vertical';
  this.root.dataset.orientation = this.orientation;
  const path = (d,cls='') => `<path class="${cls}" d="${d}"/>`;
  let lines = '', connectionLabels = '';
  const likelyEdge=(parent,child)=>this.edges.some(e=>e.kind==='parent'&&e.from===parent&&e.to===child&&e.certainty==='likely');
  for (const c of this.connectors) {
   const child=c.child, parents=c.parentIds.map(id=>this.positions[id]);
   const active=this.highlight.has(child.id)&&parents.some(p=>this.highlight.has(p.id));
   const allLikely=parents.every(p=>likelyEdge(p.id,child.id));
   const lineClass=(p)=>[active&&(p?this.highlight.has(p.id):true)?'highlight':'',(p?likelyEdge(p.id,child.id):allLikely)?'likely':''].filter(Boolean).join(' ');
   for(const p of parents.filter(p=>likelyEdge(p.id,child.id))){
    const lx=vertical?p.x+this.cardW/2+15:child.x+this.cardW+8, ly=vertical?p.y+this.cardH+13:child.y+this.cardH/2-35;
    connectionLabels+=`<span class="pedigree-likely-label" style="left:${lx}px;top:${ly}px">Likely</span>`;
   }
   if (vertical) {
    const x=child.x+this.cardW/2, y=child.y, joint=y-38;
    lines+=path(`M${x},${y}V${joint}`,lineClass());
    for (const p of parents) lines+=path(`M${p.x+this.cardW/2},${p.y+this.cardH}V${joint}H${x}`,lineClass(p));
   } else {
    const x=child.x+this.cardW,y=child.y+this.cardH/2,joint=x+34;
    lines+=path(`M${x},${y}H${joint}`,lineClass());
    for (const p of parents) lines+=path(`M${p.x},${p.y+this.cardH/2}H${joint}V${y}`,lineClass(p));
   }
  }
  const rootNode=this.positions[this.focus];
  for (const n of this.nodes.filter(n=>n.spouse)) lines+=path(vertical?`M${rootNode.x+this.cardW},${rootNode.y+this.cardH/2}H${n.x}`:`M${rootNode.x+this.cardW/2},${rootNode.y+this.cardH}V${n.y}`,'spouse');
  this.world.innerHTML=`<svg class="tree-lines" width="${this.width}" height="${this.height}" aria-hidden="true">${lines}</svg>${connectionLabels}`+this.nodes.map(n=>{
   const p=this.people[n.id], parents=this.adjacent(n.id,'parents'), expanded=this.expanded.has(n.id);
   const title=p.graphicName||p.name;
   return `<div class="pedigree-card${n.id===this.focus?' is-focus':''}${n.spouse?' is-spouse':''}" style="left:${n.x}px;top:${n.y}px">
    ${n.id===this.focus?'<span class="pedigree-root-label">Starting person</span>':n.spouse?'<span class="pedigree-root-label">Spouse</span>':''}
    <button class="tree-node${n.id===this.selected?' selected':''}${this.highlight.has(n.id)?' on-path':''}" id="tree-node-${n.id}" data-node="${n.id}" aria-pressed="${n.id===this.selected}" title="${E(p.name)} · ${E(p.dates)}"><span class="pedigree-avatar">${personIcon}</span><span class="pedigree-card-copy"><strong>${E(title)}</strong><small>${E(p.dates)}</small></span></button>
    ${!n.spouse&&parents.length?`<button class="branch-toggle" data-branch="${n.id}" aria-label="${expanded?'Collapse':'Expand'} parents of ${E(p.name)}" aria-expanded="${expanded}" title="${expanded?'Collapse':'Expand'} this branch">${expanded?'−':vertical?'⌃':'›'}</button>`:''}
   </div>`;
  }).join('');
  const visibleEdges=this.edges.filter(e=>e.kind==='parent'?this.connectors.some(c=>c.child.id===e.to&&c.parentIds.includes(e.from)):this.showSpouses&&[e.from,e.to].includes(this.focus));
  this.root.querySelector('.accessible-tree ul').innerHTML=visibleEdges.map(e=>`<li><a href="#person/${e.from}">${E(this.people[e.from].name)}</a> ${e.kind==='spouse'?'and':'→'} <a href="#person/${e.to}">${E(this.people[e.to].name)}</a>. ${E(e.qualification)} ${e.records.map(k=>`<a href="#record/${k}">Source ↗</a>`).join(' · ')}</li>`).join('')||'<li>No parent or spouse is recorded for this person in this collection.</li>';
  this.root.querySelector('#tree-focus').value=this.focus;
  this.root.querySelector('#tree-generations').value=this.generations;
  this.root.querySelector('#tree-spouses').checked=this.showSpouses;
  this.root.querySelector('#tree-likely').checked=this.showLikely;
  this.root.querySelectorAll('[data-tree="vertical"],[data-tree="horizontal"]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tree===this.orientation));
  this.root.querySelector('.pedigree-count').textContent=`${this.shown.size} people shown`;
  this.root.querySelector('.pedigree-focus-caption').textContent=`Ancestors of ${this.people[this.focus].name}`;
  this.root.querySelector('#tree-help').textContent=`Ancestors branch ${vertical?'upward':'to the right'}. Use the arrows to open or close a branch. Drag to move; scroll or pinch to zoom. Keyboard: arrows, + / −, and 0 to fit.`;
  this.transform();
 }
 select(id) {
  this.selected=id;
  this.world.querySelectorAll('[data-node]').forEach(b=>{b.classList.toggle('selected',b.dataset.node===id);b.setAttribute('aria-pressed',b.dataset.node===id);});
  this.details();
 }
 details() {
  const p=this.people[this.selected];
  const groups=[['parents','Parents'],['spouses','Spouses'],['children','Children']];
  const relations=this.edges.filter(e=>[e.from,e.to].includes(p.id));
  this.panel.innerHTML=`<button class="pedigree-panel-close" data-tree="close-details" aria-label="Close person details">×</button><p class="eyebrow">${E(p.relationship)}</p><h2>${E(p.name)}</h2><p>${E(p.dates)}</p>${p.dateNote?`<p class="pedigree-date-note">${E(p.dateNote)}</p>`:''}<div class="pedigree-person-actions"><a class="action-link primary" href="#person/${p.id}">Profile ↗</a><button class="action-link" data-root="${p.id}">View their tree</button></div>
   ${groups.map(([kind,label])=>{const ids=this.adjacent(p.id,kind);return ids.length?`<section class="pedigree-relatives"><h3>${label}</h3>${ids.map(id=>`<button data-relative="${id}">${E(this.people[id].graphicName||this.people[id].name)} ${this.edges.some(e=>e.certainty==='likely'&&[e.from,e.to].includes(id)&&[e.from,e.to].includes(p.id))?'<small class="likely-badge">Likely</small>':''}<span>→</span></button>`).join('')}</section>`:'';}).join('')}
   ${!this.adjacent(p.id,'parents').length?`<p class="small">${relations.some(e=>e.kind==='parent'&&e.to===p.id)?'Turn on Likely links to see the earlier family.':'No parents are recorded for this person in this collection.'}</p>`:''}
   <button class="pedigree-connection" data-tree="connection">Connection to Christine ↗</button>
   <div class="pedigree-connection-result" role="status"></div><details class="pedigree-evidence"><summary>Relationship sources</summary>${relations.map(e=>`<p><strong>${E(e.label)}</strong><br>${E(e.qualification)}<br>${e.records.map(k=>`<a href="#record/${k}">Read the record ↗</a>`).join(' · ')}</p>`).join('')||'<p>No connecting relationship is established.</p>'}</details>`;
  this.panel.hidden=false;
 }
 toggleBranch(id) {
  const old=this.positions[id],anchor={x:old.x*this.z+this.x,y:old.y*this.z+this.y};
  if(this.expanded.has(id))this.expanded.delete(id);else this.expanded.add(id);
  this.draw();const p=this.positions[id];this.x=anchor.x-p.x*this.z;this.y=anchor.y-p.y*this.z;this.transform();
  this.world.querySelector(`[data-branch="${id}"]`)?.focus({preventScroll:true});
 }
 fit() {
  this.z=Math.min(1.1,(this.viewport.clientWidth-30)/this.width,(this.viewport.clientHeight-70)/this.height);
  this.x=(this.viewport.clientWidth-this.width*this.z)/2;
  this.y=(this.viewport.clientHeight-this.height*this.z)/2-6;
  this.transform();
 }
 center() {
  const p=this.positions[this.focus];
  this.x=this.viewport.clientWidth/2-(p.x+this.cardW/2)*this.z;
  this.y=this.viewport.clientHeight*(this.orientation==='vertical'?.72:.5)-(p.y+this.cardH/2)*this.z;
  this.transform();
 }
 transform() {
  this.world.style.transform=`translate(${this.x}px,${this.y}px) scale(${this.z})`;
  this.root.querySelector('.tree-zoom-value').textContent=Math.round(this.z*100)+'%';
 }
 zoom(factor,point) {
  const p=point||{x:this.viewport.clientWidth/2,y:this.viewport.clientHeight/2},before=this.z;
  this.z=Math.max(.2,Math.min(2.8,this.z*factor));
  this.x=p.x-(p.x-this.x)*this.z/before;this.y=p.y-(p.y-this.y)*this.z/before;this.transform();
 }
 connection() {
  const q=[[this.selected]],seen=new Set([this.selected]);let found;
  while(q.length){const p=q.shift(),last=p.at(-1);if(last==='christine'){found=p;break;}for(const id of this.adjacent(last))if(!seen.has(id)){seen.add(id);q.push([...p,id]);}}
  const box=this.root.querySelector('.tree-path');box.hidden=false;
  if(!found){box.textContent='No established connecting path to Christine in this collection. The person’s profile explains any proposed association.';this.panel.querySelector('.pedigree-connection-result').textContent=box.textContent;return;}
  const hasLikely=found.some((id,i)=>i&&this.edges.some(e=>e.certainty==='likely'&&[e.from,e.to].includes(id)&&[e.from,e.to].includes(found[i-1])));
  box.innerHTML='<strong>Connection to Christine'+(hasLikely?' · includes a likely link':'')+'</strong><br>'+found.map(id=>`<a href="#person/${id}">${E(this.people[id].name)}</a>`).join(' → ');
  this.panel.querySelector('.pedigree-connection-result').innerHTML=box.innerHTML;this.highlight=new Set(found);this.draw();
 }
 resize() {this.mobile=matchMedia('(max-width:600px)').matches;this.draw();this.fit();}
 bind() {
  this.root.addEventListener('click',e=>{
   if(this.didDrag||performance.now()<(this.ignoreClickUntil||0)){this.didDrag=false;this.ignoreClickUntil=0;e.preventDefault();e.stopPropagation();return;}
   const branch=e.target.closest('[data-branch]');if(branch){this.toggleBranch(branch.dataset.branch);return;}
   const node=e.target.closest('[data-node]');if(node){this.select(node.dataset.node);return;}
   const root=e.target.closest('[data-root]');if(root){this.setFocus(root.dataset.root);return;}
   const relative=e.target.closest('[data-relative]');if(relative){this.select(relative.dataset.relative);return;}
   const action=e.target.closest('[data-tree]')?.dataset.tree;
   if(action==='plus')this.zoom(1.25);else if(action==='minus')this.zoom(.8);else if(action==='fit')this.fit();else if(action==='center')this.center();
   else if(action==='home')this.setFocus('christine');
   else if(action==='close-details'){this.panel.hidden=true;this.world.querySelector(`[data-node="${this.selected}"]`)?.focus({preventScroll:true});}
   else if(action==='connection')this.connection();
   else if(['vertical','horizontal'].includes(action)){this.orientation=action;this.draw();this.fit();}
   else if(action==='fullscreen'){this.root.classList.toggle('tree-expanded');document.body.classList.toggle('tree-fullscreen',this.root.classList.contains('tree-expanded'));this.resize();}
  });
  this.root.querySelector('#tree-focus').addEventListener('change',e=>this.setFocus(e.target.value));
  this.root.querySelector('#tree-generations').addEventListener('change',e=>{this.generations=Number(e.target.value);this.reset();});
  this.root.querySelector('#tree-likely').addEventListener('change',e=>{this.showLikely=e.target.checked;this.highlight.clear();this.root.querySelector('.tree-path').hidden=true;this.draw();this.fit();if(!this.panel.hidden)this.details();});
  this.root.querySelector('#tree-spouses').addEventListener('change',e=>{this.showSpouses=e.target.checked;this.draw();this.fit();});
  this.viewport.addEventListener('wheel',e=>{e.preventDefault();const r=this.viewport.getBoundingClientRect();this.zoom(Math.exp(-Math.max(-200,Math.min(200,e.deltaY))*.003),{x:e.clientX-r.left,y:e.clientY-r.top});},{passive:false});
  this.viewport.addEventListener('pointerdown',e=>{
   if(e.button>0)return;
   // Buttons keep native click/keyboard behavior. Dragging the background pans.
   if(e.target.closest('button')&&e.pointerType!=='touch')return;
   this.points.set(e.pointerId,{x:e.clientX,y:e.clientY});this.startGesture();
   this.downNode=e.target.closest('[data-node]')?.dataset.node;this.downBranch=e.target.closest('[data-branch]')?.dataset.branch;
   this.viewport.setPointerCapture(e.pointerId);this.viewport.classList.add('dragging');this.didDrag=false;
  });
  this.viewport.addEventListener('pointermove',e=>{
   if(!this.points.has(e.pointerId))return;
   this.points.set(e.pointerId,{x:e.clientX,y:e.clientY});const p=[...this.points.values()],g=this.gesture;
   if(p.length===2&&g.distance){const r=this.viewport.getBoundingClientRect(),center={x:(p[0].x+p[1].x)/2-r.left,y:(p[0].y+p[1].y)/2-r.top};this.z=Math.max(.2,Math.min(2.8,g.z*Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)/g.distance));this.x=center.x-g.world.x*this.z;this.y=center.y-g.world.y*this.z;this.didDrag=true;}
   else if(p.length===1){const dx=p[0].x-g.point.x,dy=p[0].y-g.point.y;if(Math.abs(dx)+Math.abs(dy)>4)this.didDrag=true;this.x=g.x+dx;this.y=g.y+dy;}
   this.transform();
  });
  for(const type of ['pointerup','pointercancel'])this.viewport.addEventListener(type,e=>{
   if(type==='pointerup'&&!this.didDrag){if(this.downBranch||this.downNode)this.ignoreClickUntil=performance.now()+400;if(this.downBranch)this.toggleBranch(this.downBranch);else if(this.downNode)this.select(this.downNode);}
   this.downBranch=null;this.downNode=null;this.points.delete(e.pointerId);this.startGesture();if(!this.points.size)this.viewport.classList.remove('dragging');
  });
  this.root.addEventListener('keydown',e=>{
   if(e.key==='Escape'){
    if(!this.panel.hidden){this.panel.hidden=true;this.world.querySelector(`[data-node="${this.selected}"]`)?.focus({preventScroll:true});}
    else if(this.root.classList.contains('tree-expanded')){this.root.classList.remove('tree-expanded');document.body.classList.remove('tree-fullscreen');this.resize();this.root.querySelector('[data-tree="fullscreen"]').focus();}return;
   }
   if(e.target!==this.viewport)return;
   const delta={ArrowLeft:[60,0],ArrowRight:[-60,0],ArrowUp:[0,60],ArrowDown:[0,-60]}[e.key];
   if(delta){e.preventDefault();this.x+=delta[0];this.y+=delta[1];this.transform();}else if(['+','=','-','0'].includes(e.key)){e.preventDefault();if(e.key==='0')this.fit();else this.zoom(e.key==='-'?.8:1.25);}
  });
  this.viewport.addEventListener('focusin',e=>{
   const id=e.target.dataset.node||e.target.dataset.branch;if(!id)return;
   const p=this.positions[id],left=p.x*this.z+this.x,top=p.y*this.z+this.y;
   if(left<0||left+this.cardW*this.z>this.viewport.clientWidth||top<30||top+this.cardH*this.z>this.viewport.clientHeight){this.x=this.viewport.clientWidth/2-(p.x+this.cardW/2)*this.z;this.y=this.viewport.clientHeight/2-(p.y+this.cardH/2)*this.z;this.transform();}
  });
 }
 startGesture() {
  const p=[...this.points.values()],r=this.viewport.getBoundingClientRect();this.gesture={point:p[0],x:this.x,y:this.y,z:this.z};
  if(p.length===2){const center={x:(p[0].x+p[1].x)/2-r.left,y:(p[0].y+p[1].y)/2-r.top};this.gesture.distance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);this.gesture.world={x:(center.x-this.x)/this.z,y:(center.y-this.y)/this.z};}
 }
};
})();
