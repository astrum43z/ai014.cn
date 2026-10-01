import test from 'node:test';
import assert from 'node:assert/strict';
let instance=0;
async function setup(search='',hash=''){
let drawCount=0,frameId=0,intersect,arcs=[];const frames=new Map(),documentHandlers={};const tick=now=>{const [id,callback]=frames.entries().next().value;frames.delete(id);callback(now);};const els=new Map();const noop=()=>{};const ctx=new Proxy({clearRect:()=>{drawCount++;arcs=[];},arc:(x,y,r)=>arcs.push({x,y,r}),createRadialGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||noop,set:(t,k,v)=>(t[k]=v,true)});function el(id){if(!els.has(id))els.set(id,{id,value:'',textContent:'',hidden:false,handlers:{},dataset:{},classList:{toggle:noop},setAttribute:noop,focus:noop,select:noop,append:noop,remove:noop,click:noop,addEventListener(n,f){this.handlers[n]=f},getBoundingClientRect:()=>({width:600,height:414,left:0,top:0}),getContext:()=>ctx,setPointerCapture:noop,toBlob:f=>f(new Blob(['png']))});return els.get(id)}const tabs=['orbit','life','wave','fractal','walk'].map(m=>{const t=el('tab-'+m);t.dataset.mode=m;return t});globalThis.document={querySelector:s=>el(s.slice(1)),querySelectorAll:()=>tabs,createElement:()=>el('generated'),body:{append:noop},hidden:false,addEventListener:(name,callback)=>documentHandlers[name]=callback};const motion={matches:true,addEventListener:(name,handler)=>motion.change=handler};globalThis.matchMedia=()=>motion;const windowHandlers={};globalThis.addEventListener=(name,handler)=>windowHandlers[name]=handler;globalThis.location=new URL('https://example.org/'+search+hash);let writes=0;globalThis.history={state:{anchor:true},replaceState(state,title,url){writes++;globalThis.location=new URL(url,location.href);this.state=state;}};globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);globalThis.IntersectionObserver=class{constructor(callback){intersect=callback;}observe(){}};globalThis.ResizeObserver=class{observe(){}};globalThis.setTimeout=noop;
await import('../app.js?fractal='+instance++);
return {el,tabs,frames,motion,windowHandlers,tick,documentHandlers,arcs:()=>arcs,setVisible(value){intersect([{isIntersecting:value}]);},writes:()=>writes,navigate(url){globalThis.location=new URL(url,location.href);windowHandlers.popstate();},key:(key,extra={})=>el('canvas').handlers.keydown({key,preventDefault(){},...extra})};
}



import {createFractal,addFractalPoints,FRACTAL_LIMIT,fractalVertices} from '../fractal.js';
test('seeded points are reproducible regardless of batch size',()=>{
 const a=addFractalPoints(createFractal(14,50),1000),b=createFractal(14,50);
 for(let i=0;i<10;i++)addFractalPoints(b,100);
 assert.deepEqual(a,b);
 assert.notDeepEqual(a.points,addFractalPoints(createFractal(15,50),1000).points);
});
test('each new point follows the selected vertex contraction rule',()=>{
 const a=createFractal(14,50),x=a.x,y=a.y;addFractalPoints(a,1);
 const [vx,vy]=fractalVertices[a.lastVertex];
 assert.equal(a.x,(x+vx)/2);assert.equal(a.y,(y+vy)/2);
});
test('point storage is bounded and points stay inside triangle',()=>{
 for(const jump of [35,50,70]){
  const a=addFractalPoints(createFractal(99,jump),100000);
  assert.equal(a.count,FRACTAL_LIMIT);assert.equal(a.points.length,FRACTAL_LIMIT*2);
  for(let i=0;i<a.count;i++){
   const x=a.points[i*2],y=a.points[i*2+1];
   assert.ok(y>=-1&&y<=.500001);assert.ok(Math.abs(x)<=(y+1)/Math.sqrt(3)+1e-6);
  }
  const before={...a};addFractalPoints(a,100);assert.deepEqual(a,before);
 }
});
test('fourth experiment guide, step, parameters, presets and history stay synchronized',async()=>{
 const h=await setup('?experiment=fractal&jump=65&seed=23');
 assert.match(h.el('stage-title').textContent,/04/);
 assert.match(h.el('metrics').textContent,/300 个点 · 前进 65% · 种子 23/);
 h.el('guide-start').handlers.click();assert.equal(h.frames.size,0);
 assert.equal(location.search,'?experiment=fractal&jump=50&seed=14');
 h.el('step').handlers.click();assert.match(h.el('metrics').textContent,/400 个点/);
 h.el('seed').handlers.input({target:{value:'15'}});
 assert.match(h.el('metrics').textContent,/300 个点.*种子 15/);
 h.el('preset-select').handlers.change({target:{value:'islands'}});
 assert.equal(h.el('out-jump').textContent,'65%');assert.match(h.el('observation-detail').textContent,/当前不是 50%/);
 h.navigate('?experiment=wave');h.navigate('?experiment=fractal&jump=50&seed=14');
 assert.match(h.el('metrics').textContent,/300 个点 · 前进 50% · 种子 14/);
 assert.equal(h.frames.size,0);
 h.el('guide-start').handlers.click();assert.equal(h.el('preset-select').value,'half');
});
test('fourth experiment stops at cap and resumes only after resetting',async()=>{
 const h=await setup('?experiment=fractal');
 for(let i=0;i<125;i++)h.el('step').handlers.click();
 assert.match(h.el('metrics').textContent,/12000 个点/);assert.equal(h.frames.size,0);
 h.el('pause').handlers.click();assert.equal(h.frames.size,0);
 assert.match(h.el('announcement').textContent,/已达到/);
 h.el('reset').handlers.click();assert.match(h.el('metrics').textContent,/300 个点/);
 h.el('pause').handlers.click();assert.equal(h.frames.size,1);
 h.motion.change({matches:true});assert.equal(h.frames.size,0);
});
test('five tabs participate in arrow wrapping and End navigation',async()=>{
 const h=await setup();const key=k=>({key:k,preventDefault(){}});
 h.tabs[0].handlers.keydown(key('End'));assert.match(h.el('stage-title').textContent,/05/);
 h.tabs[4].handlers.keydown(key('ArrowRight'));assert.match(h.el('stage-title').textContent,/01/);
 h.tabs[0].handlers.keydown(key('ArrowLeft'));assert.match(h.el('stage-title').textContent,/05/);
 h.tabs[4].handlers.keydown(key('Home'));assert.match(h.el('stage-title').textContent,/01/);
});

test('fractal animation is throttled, suspends while invisible and stops at cap',async()=>{
 const h=await setup('?experiment=fractal');h.el('pause').handlers.click();
 h.tick(0);h.tick(40);assert.match(h.el('metrics').textContent,/300 个点/);
 h.tick(80);h.tick(120);assert.match(h.el('metrics').textContent,/400 个点/);
 document.hidden=true;h.documentHandlers.visibilitychange();assert.equal(h.frames.size,0);
 document.hidden=false;h.documentHandlers.visibilitychange();assert.equal(h.frames.size,1);
 h.tick(90000);assert.match(h.el('metrics').textContent,/400 个点/);
 h.setVisible(false);assert.equal(h.frames.size,0);h.setVisible(true);assert.equal(h.frames.size,1);
 let time=100000;h.tick(time);
 while(h.frames.size){time+=50;h.tick(time);assert.ok(time<150000);}
 assert.match(h.el('metrics').textContent,/12000 个点/);
 assert.equal(h.el('status').textContent,'已暂停');
});
test('fractal share link stays current and snapshot keeps its experiment name',async()=>{
 const h=await setup('?experiment=fractal');
 await h.el('share').handlers.click();assert.match(h.el('share-link').value,/experiment=fractal/);
 h.el('seed').handlers.input({target:{value:'15'}});assert.match(h.el('share-link').value,/seed=15/);
 let encoded;h.el('canvas').toBlob=callback=>{encoded=callback;};
 h.el('save').handlers.click();h.tabs[0].handlers.click();encoded(new Blob(['png']));
 assert.equal(h.el('generated').download,'small-worlds-fractal.png');
});

test('next preset advances from the manually selected preset in every experiment',async()=>{
 const h=await setup('?experiment=fractal');
 for(const [mode,last,first,second] of [
  ['fractal','islands','half','overlap'],
  ['orbit','escape','circular','elliptic'],
  ['life','random','glider','blinker'],
  ['wave','close','ripple','wide']
 ]){
  h.el('tab-'+mode).handlers.click();
  h.el('preset-select').value=last;
  h.el('preset-select').handlers.change({target:{value:last}});
  h.el('preset').handlers.click();
  assert.equal(h.el('preset-select').value,first,mode+' wraps after a manual selection');
  h.el('preset').handlers.click();
  assert.equal(h.el('preset-select').value,second,mode+' continues in display order');
 }
});


test('last jump retains exact preceding coordinates and the seeded sequence is unchanged',()=>{
 for(const seed of [1,14,99])for(const jump of [35,50,70]){
  const state=createFractal(seed,jump),legacy={rng:seed,x:0,y:-1};
  for(let i=0;i<12000;i++){
   const {x,y}=state;
   addFractalPoints(state,1);
   assert.equal(state.previousX,x);assert.equal(state.previousY,y);
   legacy.rng=(Math.imul(1664525,legacy.rng)+1013904223)>>>0;
   const vertex=Math.floor(legacy.rng/4294967296*3),[vx,vy]=fractalVertices[vertex];
   legacy.x+=(vx-legacy.x)*jump/100;legacy.y+=(vy-legacy.y)*jump/100;
   assert.ok(Math.abs(state.x-legacy.x)<1e-14);assert.ok(Math.abs(state.y-legacy.y)<1e-14);
   assert.equal(state.rng,legacy.rng);assert.equal(state.lastVertex,vertex);
   const distance=Math.hypot(vx-x,vy-y),traveled=Math.hypot(state.x-x,state.y-y);
   assert.ok(Math.abs(traveled-distance*jump/100)<1e-14);
  }
  const before={...state};addFractalPoints(state,1);assert.deepEqual(state,before);
 }
});
test('one-point control and canvas shortcut pause without replacing the existing batch step',async()=>{
 const h=await setup('?experiment=fractal');
 const initial=addFractalPoints(createFractal(14,50),300);
 assert.match(h.el('fractal-jump-reading').textContent,new RegExp('第 300 点，抽中顶点 '+'ABC'[initial.lastVertex]));
 h.el('pause').handlers.click();assert.equal(h.frames.size,1);
 assert.match(h.el('fractal-jump-note').textContent,/运行中暂隐连线/);
 h.el('fractal-step').handlers.click();assert.equal(h.frames.size,0);
 assert.match(h.el('metrics').textContent,/301 个点/);
 assert.match(h.el('announcement').textContent,/已暂停.*第 301 点.*前进 50%，余下 50%/);
 assert.match(h.el('fractal-jump-note').textContent,/空心圈是出发点/);
 h.key('ArrowRight');assert.match(h.el('metrics').textContent,/302 个点/);
 h.key('ArrowRight',{repeat:true});assert.match(h.el('metrics').textContent,/302 个点/);
 for(const modifier of ['altKey','ctrlKey','metaKey','shiftKey'])h.key('ArrowRight',{[modifier]:true,preventDefault(){assert.fail('modified shortcut intercepted');}});
 h.key('Home',{preventDefault(){assert.fail('unrelated key intercepted');}});
 assert.match(h.el('metrics').textContent,/302 个点/);
 h.el('step').handlers.click();assert.match(h.el('metrics').textContent,/402 个点/);
 h.el('pause').handlers.click();h.el('pause').handlers.click();
 assert.match(h.el('fractal-jump-note').textContent,/空心圈是出发点/);
 assert.match(h.el('announcement').textContent,/第 402 点/);
});
test('single-point observations reproduce their last jump and preserve anchor navigation',async()=>{
 const h=await setup('?experiment=fractal&jump=65&seed=23');
 h.el('fractal-step').handlers.click();await h.el('share').handlers.click();
 const url=h.el('share-link').value,reading=h.el('fractal-jump-reading').textContent;
 assert.equal(new URL(url).searchParams.get('at'),'v1,301');
 h.el('fractal-step').handlers.click();assert.match(h.el('metrics').textContent,/302 个点/);
 h.navigate(url+'#observation-title');assert.match(h.el('metrics').textContent,/302 个点/);
 h.navigate('?experiment=walk');assert.equal(h.el('fractal-jump').hidden,true);
 const other=h.el('metrics').textContent;h.el('fractal-step').handlers.click();assert.equal(h.el('metrics').textContent,other);
 h.navigate(url);assert.equal(h.el('fractal-jump').hidden,false);
 assert.equal(h.el('fractal-jump-reading').textContent,reading);assert.equal(h.frames.size,0);
 h.el('seed').handlers.input({target:{value:'15'}});
 assert.match(h.el('fractal-jump-reading').textContent,/第 300 点.*65%，余下 35%/);
 assert.equal(h.el('share-link').hidden,true);
 h.el('preset-select').handlers.change({target:{value:'overlap'}});
 assert.match(h.el('fractal-jump-reading').textContent,/第 300 点.*38%，余下 62%/);
 h.el('guide-start').handlers.click();assert.match(h.el('fractal-jump-reading').textContent,/第 300 点.*50%，余下 50%/);
 h.el('fractal-step').handlers.click();h.el('reset').handlers.click();
 assert.match(h.el('fractal-jump-reading').textContent,/第 300 点/);
});
test('single-point limit and reduced-motion pause keep the last jump visible and quiet',async()=>{
 const h=await setup('?experiment=fractal&at=v1,11999');
 h.el('fractal-step').handlers.click();const reading=h.el('fractal-jump-reading').textContent;
 assert.match(reading,/第 12000 点/);assert.match(h.el('announcement').textContent,/已达到上限/);
 h.el('fractal-step').handlers.click();h.key('ArrowRight');assert.equal(h.el('fractal-jump-reading').textContent,reading);
 h.el('pause').handlers.click();assert.equal(h.frames.size,0);
 h.el('reset').handlers.click();h.el('pause').handlers.click();
 const message=h.el('announcement').textContent;
 h.tick(0);h.tick(50);h.tick(100);h.tick(150);
 assert.equal(h.el('announcement').textContent,message,'animation stays silent');
 assert.match(h.el('fractal-jump-note').textContent,/运行中暂隐连线/);
 h.motion.change({matches:true});assert.equal(h.frames.size,0);
 assert.match(h.el('fractal-jump-note').textContent,/空心圈是出发点/);
});
test('jump inspection has a quiet text alternative and a labeled, keyboard-operable control',async()=>{
 const {readFile}=await import('node:fs/promises');const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const panel=html.match(/<section id="fractal-jump".*?<\/section>/s)?.[0];assert.ok(panel);
 assert.match(panel,/aria-labelledby="fractal-jump-title"/);assert.doesNotMatch(panel,/aria-live|role="status"/);
 assert.match(panel,/<button id="fractal-step" aria-describedby="fractal-step-help">只走一步 \+1<\/button>/);
 assert.match(panel,/可以连续选中同一顶点/);
});


test('paused trace renders the exact final endpoints and selected vertex, then hides immediately on Continue',async()=>{
 const h=await setup('?experiment=fractal&jump=65&seed=23&at=v1,301');
 const state=addFractalPoints(createFractal(23,65),301),scale=Math.min(600/2.1,414/1.85),cx=300,cy=207+scale*.25;
 const [vx,vy]=fractalVertices[state.lastVertex];
 assert.deepEqual(h.arcs().slice(0,3),[
  {x:cx+state.previousX*scale,y:cy+state.previousY*scale,r:5},
  {x:cx+state.x*scale,y:cy+state.y*scale,r:4},
  {x:cx+vx*scale,y:cy+vy*scale,r:8}
 ]);
 h.el('pause').handlers.click();assert.equal(h.arcs().length,3,'only the triangle vertices remain while running');
 h.el('pause').handlers.click();assert.equal(h.arcs().length,6,'Pause restores the last jump without advancing');
 assert.match(h.el('metrics').textContent,/301 个点/);
 h.el('pause').handlers.click();h.motion.change({matches:true});assert.equal(h.arcs().length,6);
});
