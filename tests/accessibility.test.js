import test from 'node:test';
import assert from 'node:assert/strict';
let instance=0;
async function setup(reduced=false){
let drawCount=0,frameId=0,intersect;const frames=new Map(),documentHandlers={};const tick=now=>{const [id,callback]=frames.entries().next().value;frames.delete(id);callback(now);};const els=new Map();const noop=()=>{};const ctx=new Proxy({clearRect:()=>drawCount++,createRadialGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||noop,set:(t,k,v)=>(t[k]=v,true)});function el(id){if(!els.has(id))els.set(id,{id,value:'',textContent:'',hidden:false,handlers:{},dataset:{},classList:{toggle:noop},setAttribute:noop,focus:noop,select:noop,append:noop,remove:noop,click:noop,addEventListener(n,f){this.handlers[n]=f},getBoundingClientRect:()=>({width:600,height:414,left:0,top:0}),getContext:()=>ctx,setPointerCapture:noop,toBlob:f=>f(new Blob(['png']))});return els.get(id)}const tabs=['orbit','life','wave','fractal'].map(m=>{const t=el('tab-'+m);t.dataset.mode=m;return t});globalThis.document={querySelector:s=>el(s.slice(1)),querySelectorAll:()=>tabs,createElement:()=>el('generated'),body:{append:noop},hidden:false,addEventListener:(name,callback)=>documentHandlers[name]=callback};const motion={matches:reduced,addEventListener:(name,handler)=>motion.change=handler};globalThis.matchMedia=()=>motion;globalThis.location={search:'',hash:'',href:'https://example.org/'};globalThis.history={replaceState:noop};globalThis.addEventListener=noop;globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);globalThis.IntersectionObserver=class{constructor(callback){intersect=callback;}observe(){}};globalThis.ResizeObserver=class{observe(){}};globalThis.setTimeout=noop;
await import('../app.js?accessibility='+instance++);
return {el,tabs,frames,motion,key:(key,extra={})=>el('canvas').handlers.keydown({key,preventDefault(){},...extra})};
}
test('new reduced-motion preference stops active frames and never auto-resumes',async()=>{
  const h=await setup();
  assert.equal(h.frames.size,1);
  h.motion.change({matches:true});
  assert.equal(h.frames.size,0);
  assert.equal(h.el('status').textContent,'已暂停');
  assert.match(h.el('announcement').textContent,/减少动态效果/);
  h.motion.change({matches:false});
  assert.equal(h.frames.size,0);
  h.el('pause').handlers.click();
  assert.equal(h.frames.size,1,'explicit Continue can resume');
  h.motion.change({matches:true});
  h.motion.change({matches:true});
  assert.equal(h.frames.size,0,'repeated preference events stay idle');
  h.el('step').handlers.click();
  assert.equal(h.frames.size,0,'single-step remains available without animation');
});
test('reduced-motion initial state stays idle through resets and mode changes',async()=>{
  const h=await setup(true);
  assert.equal(h.frames.size,0);
  for(const tab of h.tabs){
    tab.handlers.click();
    h.el('reset').handlers.click();
    assert.equal(h.frames.size,0);
    assert.equal(h.el('status').textContent,'已暂停');
  }
});
test('Life keyboard navigation and edits pause first, wrap, and announce position',async()=>{
  const h=await setup();
  h.tabs[1].handlers.click();
  assert.equal(h.frames.size,1);
  h.key('ArrowLeft');
  assert.equal(h.frames.size,0);
  assert.match(h.el('announcement').textContent,/已暂停；第 24 列，第 17 行/);
  h.el('clear').handlers.click();
  h.el('pause').handlers.click();
  h.key('Enter');
  assert.equal(h.frames.size,0);
  assert.match(h.el('metrics').textContent,/1 个活格子/);
  h.key(' ');
  assert.match(h.el('metrics').textContent,/0 个活格子/);
  for(let i=0;i<24;i++)h.key('ArrowLeft');
  assert.match(h.el('announcement').textContent,/第 48 列/);
  h.el('pause').handlers.click();
  h.key('ArrowRight',{ctrlKey:true});
  h.key('Tab');
  assert.equal(h.frames.size,1,'modified shortcuts and Tab remain untouched');
  h.tabs[0].handlers.click();
  h.key('ArrowLeft');
  assert.equal(h.frames.size,1,'Life editing behavior is scoped to Life');
});


test('wave probe keyboard completes the guided comparison and announces measurements',async()=>{
  const h=await setup();
  h.tabs[2].handlers.click();
  h.el('guide-start').handlers.click();
  assert.match(h.el('observation-b').textContent,/0.50/);
  h.el('pause').handlers.click();
  h.key('Home');
  assert.equal(h.frames.size,0,'probe navigation pauses the simulation');
  assert.match(h.el('announcement').textContent,/已暂停；探针 x 0.0，y 0.0/);
  assert.match(h.el('announcement').textContent,/0.00；相遇方式 · 接近加强/);
  for(let i=0;i<4;i++)h.key('ArrowRight');
  assert.match(h.el('announcement').textContent,/x 8.0，y 0.0/);
  assert.match(h.el('announcement').textContent,/0.50；相遇方式 · 接近抵消/);
  h.key('ArrowDown');
  assert.match(h.el('announcement').textContent,/x 8.0，y 2.0/);
  h.key('ArrowUp');h.key('ArrowLeft');
  assert.match(h.el('announcement').textContent,/x 6.0，y 0.0/);
  h.key('Home');h.key('Home');
  assert.match(h.el('observation-b').textContent,/0.00/);
  assert.equal(h.frames.size,0,'repeated navigation never resumes animation');
});
test('wave probe stays on the canvas and leaves modified keys and Tab alone',async()=>{
  const h=await setup();h.tabs[2].handlers.click();
  for(const [key,extra] of [['Home',{ctrlKey:true}],['ArrowRight',{altKey:true}],['ArrowUp',{metaKey:true}],['ArrowDown',{shiftKey:true}],['Tab',{}]])h.key(key,extra);
  assert.equal(h.frames.size,1);
  for(let i=0;i<200;i++)h.key('ArrowRight');
  assert.match(h.el('announcement').textContent,/x 202.9，y 0.0/);
  for(let i=0;i<200;i++)h.key('ArrowDown');
  assert.match(h.el('announcement').textContent,/y 140.0/);
  for(let i=0;i<400;i++){h.key('ArrowLeft');h.key('ArrowUp');}
  assert.match(h.el('announcement').textContent,/x -202.9，y -140.0/);
  h.el('reset').handlers.click();h.key('ArrowRight');
  assert.match(h.el('announcement').textContent,/x 2.0，y 0.0/);
});
