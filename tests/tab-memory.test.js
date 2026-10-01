import test from 'node:test';
import assert from 'node:assert/strict';
let instance=0;
async function setup(search='',hash='',motionMatches=true){
let drawCount=0,frameId=0,intersect,resize,lastProbe;const drawing=[];let rect={width:600,height:414,left:0,top:0};const frames=new Map(),documentHandlers={};const tick=now=>{const [id,callback]=frames.entries().next().value;frames.delete(id);callback(now);};const els=new Map();const noop=()=>{};const ctx=new Proxy({clearRect:(...args)=>{drawCount++;drawing.length=0;drawing.push(["clearRect",...args]);},arc:(x,y,r,...rest)=>{drawing.push(['arc',x,y,r,...rest]);if(r===9)lastProbe={x,y,r};},createRadialGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||((...args)=>drawing.push([k,...args])),set:(t,k,v)=>(drawing.push([k,typeof v==="object"?"gradient":v]),t[k]=v,true)});function el(id){if(!els.has(id))els.set(id,{id,value:'',textContent:'',get innerHTML(){return this.markup||'';},set innerHTML(markup){this.markup=markup;if(id==='preset-select')this.value=markup.match(/value="([^"]+)"/)?.[1]||'';if(id==='sliders')for(const match of markup.matchAll(/<input id="([^"]+)"[^>]*value="([^"]+)"/g))el(match[1]).value=match[2];},hidden:false,handlers:{},dataset:{},classList:{toggle:noop},setAttribute:noop,focus:noop,select:noop,append:noop,remove:noop,click:noop,addEventListener(n,f){this.handlers[n]=f},getBoundingClientRect:()=>rect,getContext:()=>ctx,setPointerCapture:noop,toBlob:f=>f(new Blob(['png']))});return els.get(id)}const tabs=['orbit','life','wave','fractal','walk'].map(m=>{const t=el('tab-'+m);t.dataset.mode=m;return t});globalThis.document={querySelector:s=>el(s.slice(1)),querySelectorAll:()=>tabs,createElement:()=>el('generated'),body:{append:noop},hidden:false,addEventListener:(name,callback)=>documentHandlers[name]=callback};const motion={matches:motionMatches,addEventListener:(name,handler)=>motion.change=handler};globalThis.matchMedia=()=>motion;const windowHandlers={};globalThis.addEventListener=(name,handler)=>windowHandlers[name]=handler;globalThis.location=new URL('https://example.org/'+search+hash);let writes=0;globalThis.history={state:{anchor:true},replaceState(state,title,url){writes++;globalThis.location=new URL(url,location.href);this.state=state;}};globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);globalThis.IntersectionObserver=class{constructor(callback){intersect=callback;}observe(){}};globalThis.ResizeObserver=class{constructor(callback){resize=callback;}observe(){}};globalThis.setTimeout=noop;
await import('../app.js?tabs='+instance++);
return {el,tabs,frames,motion,drawing:()=>structuredClone(drawing),windowHandlers,tick,probe:()=>lastProbe,resize(width,height){rect={width,height,left:0,top:0};resize();},writes:()=>writes,navigate(url){globalThis.location=new URL(url,location.href);windowHandlers.popstate();},key:(key,extra={})=>el('canvas').handlers.keydown({key,preventDefault(){},...extra})};
}

const modes=['orbit','life','wave','fractal','walk'];
const readings=['metrics','observation-a','observation-b','observation-c','observation-detail','status'];
const snapshot=h=>({readings:readings.map(id=>h.el(id).textContent),drawing:h.drawing(),sliders:[...h.el('sliders').innerHTML.matchAll(/<input id="([^"]+)"/g)].map(match=>[match[1],String(h.el(match[1]).value)]),preset:h.el('preset-select').value});
function prepare(h,mode){
 h.el('guide-start').handlers.click();
 const [id,value]={orbit:['gravity',120],life:['rate',4],wave:['wavelength',45],fractal:['seed',23],walk:['bias',20]}[mode];
 h.el(id).value=String(value);h.el(id).handlers.input({target:h.el(id)});
 for(let i=0;i<3;i++)h.el('step').handlers.click();
 if(mode==='orbit'){h.key('ArrowDown');h.key('Enter');}
 if(mode==='life'){h.key('ArrowRight');h.key('Enter');}
 if(mode==='wave')h.key('ArrowDown');
 if(mode==='fractal')h.el('fractal-step').handlers.click();
}

test('all five tabs retain exact canvas, parameters, preset and paused progress after a full tour',async()=>{
 for(const [index,mode] of modes.entries()){
  const h=await setup('?experiment='+mode);prepare(h,mode);
  const before=snapshot(h);
  for(let round=0;round<3;round++){
   for(let i=1;i<modes.length;i++){h.tabs[(index+i)%5].handlers.click();h.el('step').handlers.click();}
   h.tabs[index].handlers.click();
   assert.deepEqual(snapshot(h),before,mode+' round '+round);
   assert.equal(h.frames.size,0);assert.match(h.el('announcement').textContent,/保留离开时/);
   assert.equal(new URL(location.href).searchParams.get('experiment'),mode);
  }
 }
});

test('the next step after returning is identical, including seeded RNG, Life rules and orbit trails',async()=>{
 for(const [index,mode] of modes.entries()){
  let h=await setup('?experiment='+mode);prepare(h,mode);h.el('step').handlers.click();
  const expected=snapshot(h);
  h=await setup('?experiment='+mode);prepare(h,mode);
  h.tabs[(index+1)%5].handlers.click();h.el('step').handlers.click();h.tabs[index].handlers.click();
  h.el('step').handlers.click();assert.deepEqual(snapshot(h),expected,mode);
 }
});

test('running tabs resume only their own clock without catch-up; paused tabs stay paused',async()=>{
 const h=await setup('?experiment=orbit','',false);
 h.tick(0);h.tick(50);const before=h.el('metrics').textContent;
 h.tabs[2].handlers.click();assert.equal(h.frames.size,1);
 h.tick(1000);h.tick(1050);h.el('pause').handlers.click();assert.equal(h.frames.size,0);
 h.tabs[0].handlers.click();assert.equal(h.frames.size,1);assert.equal(h.el('metrics').textContent,before);
 h.tick(60000);assert.equal(h.el('metrics').textContent,before,'first resumed frame has no elapsed time');
 h.tick(60050);assert.match(h.el('metrics').textContent,/t \+ 0.1 s/);
 h.tabs[2].handlers.click();assert.equal(h.frames.size,0);assert.equal(h.el('status').textContent,'已暂停');
});

test('reduced motion pauses inactive worlds as well and disabling it never resumes them',async()=>{
 const h=await setup('?experiment=orbit','',false);h.tabs[3].handlers.click();h.tabs[4].handlers.click();
 h.motion.matches=true;h.motion.change({matches:true});
 h.motion.matches=false;h.motion.change({matches:false});
 for(const index of [0,3,4]){h.tabs[index].handlers.click();assert.equal(h.frames.size,0);assert.equal(h.el('status').textContent,'已暂停');}
 h.el('pause').handlers.click();assert.equal(h.frames.size,1);h.tabs[0].handlers.click();h.tabs[4].handlers.click();assert.equal(h.frames.size,1,'explicit Continue still opts in');
});

test('explicit guide and history loads replace their target while retaining other worlds',async()=>{
 const h=await setup('?experiment=life');prepare(h,'life');const life=snapshot(h);
 h.tabs[3].handlers.click();h.el('step').handlers.click();h.tabs[4].handlers.click();
 h.el('journey-start').handlers.click();assert.match(h.el('metrics').textContent,/300 个点/);assert.equal(h.frames.size,0);
 h.tabs[1].handlers.click();assert.deepEqual(snapshot(h),life);
 h.navigate('?experiment=fractal&jump=65&seed=99&at=v1,888');assert.match(h.el('metrics').textContent,/888 个点/);
 h.tabs[1].handlers.click();assert.deepEqual(snapshot(h),life);
 h.tabs[3].handlers.click();assert.match(h.el('metrics').textContent,/888 个点/);
 h.el('reset').handlers.click();h.tabs[1].handlers.click();h.tabs[3].handlers.click();assert.match(h.el('metrics').textContent,/300 个点/);
});

test('fixed observation links and reading anchors survive tab returns without overstating sharing',async()=>{
 for(const [index,mode] of modes.entries()){
  const h=await setup('?experiment='+mode,'#canvas');prepare(h,mode);
  await h.el('share').handlers.click();const saved=h.el('share-link').value;
  h.el('step').handlers.click();const current=snapshot(h);
  h.tabs[(index+1)%5].handlers.click();h.tabs[index].handlers.click();
  assert.deepEqual(snapshot(h),current,mode);assert.equal(location.href,saved);
  assert.equal(h.el('share-link').value,saved);assert.equal(h.el('share-link').hidden,false);
  h.navigate(location.search+'#discovery-title');h.navigate(location.search+'#canvas');
  assert.deepEqual(snapshot(h),current,mode+' anchor traversal');
  if(['orbit','life'].includes(mode)){assert.equal(new URL(saved).searchParams.has('at'),false);assert.match(h.el('share-note').textContent,/不含画布/);}
 }
});

test('shared wide wave probe remains visible when returning on a narrow viewport',async()=>{
 const h=await setup('?experiment=wave&wavelength=32&separation=100&at=v1,300,-130,0.2');
 const expected=readings.map(id=>h.el(id).textContent);
 h.tabs[1].handlers.click();h.resize(259,240);h.tabs[2].handlers.click();
 assert.deepEqual(readings.map(id=>h.el(id).textContent),expected);
 assert.ok(h.probe().x>=14&&h.probe().x<=245);assert.ok(h.probe().y>=14&&h.probe().y<=226);
});

test('unfinished Life strokes cannot resume after leaving and returning',async()=>{
 const h=await setup('?experiment=life');h.el('clear').handlers.click();
 const event=(x,y)=>({pointerId:1,button:0,isPrimary:true,clientX:x,clientY:y});
 h.el('canvas').handlers.pointerdown(event(10,10));h.el('canvas').handlers.pointermove(event(60,10));
 const before=snapshot(h);h.tabs[0].handlers.click();h.tabs[1].handlers.click();
 h.el('canvas').handlers.pointermove(event(160,10));h.el('canvas').handlers.pointerup({...event(180,10),type:'pointerup'});h.el('canvas').handlers.click(event(180,10));
 assert.deepEqual(snapshot(h),before);
});

test('progress caps remain terminal across tab returns and repeated switching has one frame chain',async()=>{
 for(const [index,mode,at] of [[3,'fractal',12000],[4,'walk',512]]){
  const h=await setup('?experiment='+mode+'&at=v1,'+at,'',false);const before=snapshot(h);
  for(let i=0;i<25;i++){h.tabs[0].handlers.click();h.tabs[index].handlers.click();assert.equal(h.frames.size,0);}
  assert.deepEqual(snapshot(h),before);h.el('pause').handlers.click();assert.equal(h.frames.size,0);
 }
 const h=await setup('?experiment=orbit','',false);
 for(let i=0;i<50;i++){h.tabs[i%5].handlers.click();assert.equal(h.frames.size,1);}
});


test('guided and checkpoint navigation pause their destination without pausing an outgoing world',async()=>{
 for(const enter of [h=>h.el('journey-start').handlers.click(),h=>h.navigate('?experiment=walk&at=v1,64')]){
  const h=await setup('?experiment=orbit','',false);h.tick(0);h.tick(50);const before=h.el('metrics').textContent;
  enter(h);assert.equal(h.frames.size,0);h.tabs[0].handlers.click();assert.equal(h.frames.size,1);assert.equal(h.el('metrics').textContent,before);
 }
});

test('refresh-equivalent initialization never imports a previous page session',async()=>{
 let h=await setup('?experiment=life');h.el('clear').handlers.click();h.key('Enter');assert.match(h.el('metrics').textContent,/1 个活格子/);
 h.tabs[3].handlers.click();h.el('step').handlers.click();h.tabs[1].handlers.click();assert.match(h.el('metrics').textContent,/1 个活格子/);
 h=await setup('?experiment=life');assert.match(h.el('metrics').textContent,/10 个活格子/);h.tabs[3].handlers.click();assert.match(h.el('metrics').textContent,/300 个点/);
});
