import test from 'node:test';
import assert from 'node:assert/strict';
let instance=0;
async function setup(reduced=false){
let drawCount=0,frameId=0,intersect,painted=[];const frames=new Map(),documentHandlers={};const tick=now=>{const [id,callback]=frames.entries().next().value;frames.delete(id);callback(now);};const els=new Map();const captures=new Set();const noop=()=>{};const ctx=new Proxy({clearRect:()=>{drawCount++;painted=[];},fillRect:(x,y,w,h)=>{if(w<20&&h<20)painted.push([Math.round((x-.6)/12.5),Math.round((y-.6)/(414/32))]);},createRadialGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||noop,set:(t,k,v)=>(t[k]=v,true)});function el(id){if(!els.has(id))els.set(id,{id,value:'',textContent:'',hidden:false,handlers:{},dataset:{},classList:{toggle:noop},setAttribute:noop,focus:noop,select:noop,append:noop,remove:noop,click:noop,addEventListener(n,f){this.handlers[n]=f},getBoundingClientRect:()=>({width:600,height:414,left:0,top:0}),getContext:()=>ctx,setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),toBlob:f=>f(new Blob(['png']))});return els.get(id)}const tabs=['orbit','life','wave','fractal','walk'].map(m=>{const t=el('tab-'+m);t.dataset.mode=m;return t});globalThis.document={querySelector:s=>el(s.slice(1)),querySelectorAll:()=>tabs,createElement:()=>el('generated'),body:{append:noop},hidden:false,addEventListener:(name,callback)=>documentHandlers[name]=callback};const motion={matches:reduced,addEventListener:(name,handler)=>motion.change=handler};globalThis.matchMedia=()=>motion;globalThis.location={search:'',hash:'',href:'https://example.org/'};globalThis.history={replaceState:noop};const windowHandlers={};globalThis.addEventListener=(name,handler)=>windowHandlers[name]=handler;globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);globalThis.IntersectionObserver=class{constructor(callback){intersect=callback;}observe(){}};globalThis.ResizeObserver=class{observe(){}};globalThis.setTimeout=noop;
await import('../app.js?pointer='+instance++);
return {el,tabs,frames,motion,captures,documentHandlers,windowHandlers,painted:()=>painted,key:(key,extra={})=>el('canvas').handlers.keydown({key,preventDefault(){},...extra})};
}

function pointer(h,type,id,x=20,y=20,extra={}){
  h.el('canvas').handlers[type]?.({type,pointerId:id,clientX:x,clientY:y,button:0,buttons:['pointerdown','pointermove'].includes(type)?1:0,isPrimary:true,...extra});
}
async function life(){const h=await setup();h.tabs[1].handlers.click();h.el('clear').handlers.click();return h;}
function count(h,n){assert.match(h.el('metrics').textContent,new RegExp(`\\b${n} 个活格子`));}
// Cell centers keep geometry assertions independent of edge-rounding.
function at(h,type,id,x,y,extra={}){pointer(h,type,id,(x+.5)*12.5,(y+.5)*414/32,extra);}
function stroke(h,id,from,to){at(h,'pointerdown',id,...from);at(h,'pointermove',id,...to);at(h,'pointerup',id,...to);at(h,'click',id,...to);}
test('fast horizontal drawing joins sparse samples and keeps both endpoint cells',async()=>{
 const h=await life();stroke(h,1,[2,4],[43,4]);count(h,42);
 assert.deepEqual(h.painted(),Array.from({length:42},(_,i)=>[i+2,4]));
 assert.equal(h.el('status').textContent,'已暂停');assert.equal(h.frames.size,0);
 assert.match(h.el('announcement').textContent,/绘制完成.*活细胞 · 42/);
 stroke(h,2,[43,4],[2,4]);count(h,42);
 h.el('step').handlers.click();assert.match(h.el('metrics').textContent,/第 1 代/);
});
test('diagonal and vertical segments stay connected and include the final release sample',async()=>{
 const h=await life();at(h,'pointerdown',1,3,3);at(h,'pointermove',1,7,7);at(h,'pointerup',1,7,11);at(h,'click',1,7,11);
 assert.deepEqual(h.painted(),[[3,3],[4,4],[5,5],[6,6],[7,7],[7,8],[7,9],[7,10],[7,11]]);
 h.el('clear').handlers.click();at(h,'pointerdown',2,5,8);at(h,'pointerup',2,5,3);at(h,'click',2,5,3);
 assert.deepEqual(h.painted(),[[5,3],[5,4],[5,5],[5,6],[5,7],[5,8]]);
});
test('taps and within-cell jitter toggle once, while drag clicks do not erase',async()=>{
 const h=await life();
 for(const expected of [1,0]){
  pointer(h,'pointerdown',1,20,20);pointer(h,'pointermove',1,21,21);pointer(h,'pointerup',1,22,22);pointer(h,'click',1,22,22);count(h,expected);
 }
 at(h,'pointerdown',2,1,1);at(h,'pointermove',2,5,1);at(h,'pointerup',2,5,1);
 pointer(h,'lostpointercapture',2);at(h,'click',2,5,1);count(h,5);
 at(h,'pointerdown',3,5,1);at(h,'pointerup',3,5,1);at(h,'click',3,5,1);count(h,4);
 pointer(h,'pointerdown',4,80,80,{button:2});pointer(h,'pointermove',4,90,80);count(h,4);
});
test('only the owning primary pointer can draw or end a stroke',async()=>{
 const h=await life();at(h,'pointerdown',1,1,1);
 at(h,'pointerdown',2,10,10,{isPrimary:false});at(h,'pointermove',2,20,20);count(h,0);
 for(const type of ['pointerup','pointercancel','lostpointercapture'])at(h,type,2,20,20);
 at(h,'pointermove',1,3,1);count(h,3);
 at(h,'pointerup',1,3,1);at(h,'pointermove',1,8,1);count(h,3);
});
test('cancellation and capture loss never extend to their event coordinates',async()=>{
 for(const type of ['pointercancel','lostpointercapture']){
  const h=await life();at(h,'pointerdown',1,1,1);at(h,'pointermove',1,3,1);count(h,3);
  at(h,type,1,30,20);at(h,'pointermove',1,30,20);at(h,'click',1,30,20);count(h,3);
  stroke(h,2,[6,1],[8,1]);count(h,6);
 }
});
test('clear, reset and experiment switches discard unfinished drawing and trailing clicks',async()=>{
 const h=await life();at(h,'pointerdown',1,1,1);at(h,'pointermove',1,3,1);assert.ok(h.captures.has(1));
 h.el('clear').handlers.click();assert.equal(h.captures.has(1),false);
 at(h,'pointerup',1,10,1);at(h,'click',1,10,1);at(h,'pointermove',1,20,1);count(h,0);
 at(h,'pointerdown',2,1,1);at(h,'pointermove',2,3,1);h.el('reset').handlers.click();const resetMetrics=h.el('metrics').textContent;
 assert.equal(h.captures.has(2),false);at(h,'pointerup',2,10,1);at(h,'click',2,10,1);assert.equal(h.el('metrics').textContent,resetMetrics);
 at(h,'pointerdown',3,1,1);at(h,'pointermove',3,3,1);h.tabs[0].handlers.click();
 assert.equal(h.captures.has(3),false);at(h,'pointerup',3,10,1);at(h,'click',3,10,1);assert.match(h.el('metrics').textContent,/3 颗行星/);
 pointer(h,'pointerdown',4);pointer(h,'click',4);assert.match(h.el('metrics').textContent,/4 颗行星/);
 h.tabs[1].handlers.click();h.el('clear').handlers.click();at(h,'pointermove',3,20,1);count(h,0);
 for(const type of ['pointercancel','lostpointercapture']){at(h,'pointerdown',5,1,1);at(h,type,5,10,1);at(h,'click',5,10,1);count(h,0);}
 stroke(h,6,[1,1],[3,1]);count(h,3);
});
test('captured out-of-bounds movement clamps to the edge without wrapping',async()=>{
 const h=await life();at(h,'pointerdown',1,1,1);at(h,'pointermove',1,-20,1);at(h,'pointerup',1,-20,1);at(h,'click',1,-20,1);
 assert.deepEqual(h.painted(),[[0,1],[1,1]]);
 h.el('clear').handlers.click();at(h,'pointerdown',2,46,30);at(h,'pointermove',2,70,50);at(h,'pointerup',2,70,50);at(h,'click',2,70,50);
 assert.deepEqual(h.painted(),[[46,30],[47,31]]);
});
test('drawing uses the actual mobile canvas bounds and preserves the starting cell',async()=>{
 const h=await life();h.el('canvas').getBoundingClientRect=()=>({left:50,top:60,width:240,height:160});
 pointer(h,'pointerdown',1,62.5,82.5);pointer(h,'pointermove',1,102.5,82.5);pointer(h,'pointerup',1,102.5,82.5);pointer(h,'click',1,102.5,82.5);
 assert.deepEqual(h.painted(),Array.from({length:9},(_,i)=>[i+2,4]));
});

test('invalid coordinates and collapsed bounds never enter line interpolation',async()=>{
 const h=await life();
 for(const extra of [{clientX:NaN},{clientY:Infinity}]){
  pointer(h,'pointerdown',1,20,20,extra);at(h,'pointermove',1,10,10);at(h,'pointercancel',1,10,10);count(h,0);
 }
 at(h,'pointerdown',2,1,1);h.el('canvas').getBoundingClientRect=()=>({left:0,top:0,width:0,height:0});
 pointer(h,'pointermove',2,0,0);pointer(h,'pointerup',2,0,0);count(h,0);
});

test('tap, stroke, Enter and wrapped keyboard selection keep the Life inspector current',async()=>{
 const h=await life();
 at(h,'pointerdown',1,0,0);at(h,'pointerup',1,0,0);at(h,'click',1,0,0);
 assert.equal(h.el('life-cell-position').textContent,'第 1 列，第 1 行');
 assert.match(h.el('life-cell-state').textContent,/当前：活格 · 活邻居 0 \/ 8/);
 assert.equal(h.el('life-cell-next').textContent,'下一代：消失');
 h.key('ArrowLeft');assert.equal(h.el('life-cell-position').textContent,'第 48 列，第 1 行');
 assert.match(h.el('life-cell-state').textContent,/当前：空格 · 活邻居 1 \/ 8/);
 h.key('Enter');assert.match(h.el('life-cell-state').textContent,/当前：活格 · 活邻居 1 \/ 8/);
 h.el('clear').handlers.click();stroke(h,2,[2,4],[6,4]);
 assert.equal(h.el('life-cell-position').textContent,'第 7 列，第 5 行');
 assert.match(h.el('life-cell-state').textContent,/当前：活格 · 活邻居 1 \/ 8/);
 assert.match(h.el('announcement').textContent,/绘制完成.*下一代：消失/);
});


test('window interruption ends the stroke without extending or toggling on return',async()=>{
 const h=await life();stroke(h,2,[8,4],[10,4]);
 at(h,'pointerdown',1,1,1);at(h,'pointermove',1,3,1);count(h,6);
 const before=h.painted();h.windowHandlers.blur?.();
 assert.equal(h.captures.has(1),false);
 at(h,'pointermove',1,20,1);at(h,'pointerup',1,20,1);at(h,'click',1,20,1);
 assert.deepEqual(h.painted(),before);count(h,6);
 assert.equal(h.el('status').textContent,'已暂停');assert.equal(h.frames.size,0);
 stroke(h,1,[5,1],[7,1]);count(h,9);
});

test('hiding the page ends a stroke but visible notifications leave an active stroke alone',async()=>{
 const h=await life();at(h,'pointerdown',1,1,1);at(h,'pointermove',1,3,1);
 document.hidden=false;h.documentHandlers.visibilitychange();
 assert.equal(h.captures.has(1),true);at(h,'pointermove',1,5,1);count(h,5);
 document.hidden=true;h.documentHandlers.visibilitychange();
 assert.equal(h.captures.has(1),false);
 document.hidden=false;h.documentHandlers.visibilitychange();
 at(h,'pointermove',1,20,1);at(h,'pointerup',1,20,1);at(h,'click',1,20,1);count(h,5);
 stroke(h,1,[8,1],[10,1]);count(h,8);
});

test('a released primary button ends stale drawing even if another button stays held',async()=>{
 for(const buttons of [0,2,4]){
  const h=await life();at(h,'pointerdown',1,1,1);at(h,'pointermove',1,3,1);count(h,3);
  at(h,'pointermove',1,20,1,{buttons});
  assert.equal(h.captures.has(1),false);count(h,3);
  at(h,'pointerup',1,20,1);at(h,'click',1,20,1);at(h,'pointermove',1,30,1,{buttons:0});count(h,3);
  stroke(h,1,[6,1],[8,1]);count(h,6);
 }
});

test('secondary pointer release and held-button combinations cannot cancel the owner',async()=>{
 const h=await life();at(h,'pointerdown',1,1,1);at(h,'pointermove',1,3,1);
 at(h,'pointermove',2,20,1,{buttons:0,isPrimary:false});assert.equal(h.captures.has(1),true);
 at(h,'pointermove',1,5,1,{buttons:3});count(h,5);
 at(h,'pointerup',1,5,1);at(h,'click',1,5,1);count(h,5);
});

test('window interruptions do not reset completed drawings, pending drag-click suppression or running worlds',async()=>{
 const h=await life();at(h,'pointerdown',1,1,1);at(h,'pointermove',1,3,1);at(h,'pointerup',1,3,1);
 h.windowHandlers.blur?.();at(h,'click',1,3,1);count(h,3);
 h.windowHandlers.blur?.();document.hidden=true;h.documentHandlers.visibilitychange();
 document.hidden=false;h.documentHandlers.visibilitychange();count(h,3);
 h.tabs[0].handlers.click();if(h.el('status').textContent==='已暂停')h.el('pause').handlers.click();
 const status=h.el('status').textContent,metrics=h.el('metrics').textContent;assert.equal(status,'运行中');
 h.windowHandlers.blur?.();assert.equal(h.el('status').textContent,status);assert.equal(h.el('metrics').textContent,metrics);
 h.tabs[1].handlers.click();count(h,3);
});


test('an interrupted tap leaves no cell and a fresh tap with the same pointer works',async()=>{
 const h=await life();at(h,'pointerdown',1,1,1);
 h.windowHandlers.blur();h.windowHandlers.blur();
 document.hidden=true;h.documentHandlers.visibilitychange();
 document.hidden=false;h.documentHandlers.visibilitychange();
 at(h,'pointerup',1,1,1);at(h,'click',1,1,1);count(h,0);
 at(h,'pointerdown',1,1,1);at(h,'pointerup',1,1,1);at(h,'click',1,1,1);count(h,1);
});
