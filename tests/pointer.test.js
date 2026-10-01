import test from 'node:test';
import assert from 'node:assert/strict';
let instance=0;
async function setup(reduced=false){
let drawCount=0,frameId=0,intersect;const frames=new Map(),documentHandlers={};const tick=now=>{const [id,callback]=frames.entries().next().value;frames.delete(id);callback(now);};const els=new Map();const captures=new Set();const noop=()=>{};const ctx=new Proxy({clearRect:()=>drawCount++,createRadialGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||noop,set:(t,k,v)=>(t[k]=v,true)});function el(id){if(!els.has(id))els.set(id,{id,value:'',textContent:'',hidden:false,handlers:{},dataset:{},classList:{toggle:noop},setAttribute:noop,focus:noop,select:noop,append:noop,remove:noop,click:noop,addEventListener(n,f){this.handlers[n]=f},getBoundingClientRect:()=>({width:600,height:414,left:0,top:0}),getContext:()=>ctx,setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),toBlob:f=>f(new Blob(['png']))});return els.get(id)}const tabs=['orbit','life','wave','fractal','walk'].map(m=>{const t=el('tab-'+m);t.dataset.mode=m;return t});globalThis.document={querySelector:s=>el(s.slice(1)),querySelectorAll:()=>tabs,createElement:()=>el('generated'),body:{append:noop},hidden:false,addEventListener:(name,callback)=>documentHandlers[name]=callback};const motion={matches:reduced,addEventListener:(name,handler)=>motion.change=handler};globalThis.matchMedia=()=>motion;globalThis.location={search:'',hash:'',href:'https://example.org/'};globalThis.history={replaceState:noop};globalThis.addEventListener=noop;globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);globalThis.IntersectionObserver=class{constructor(callback){intersect=callback;}observe(){}};globalThis.ResizeObserver=class{observe(){}};globalThis.setTimeout=noop;
await import('../app.js?pointer='+instance++);
return {el,tabs,frames,motion,captures,key:(key,extra={})=>el('canvas').handlers.keydown({key,preventDefault(){},...extra})};
}

function pointer(h,type,id,x=20,y=20,extra={}){
  h.el('canvas').handlers[type]?.({type,pointerId:id,clientX:x,clientY:y,button:0,isPrimary:true,...extra});
}
async function life(){const h=await setup();h.tabs[1].handlers.click();h.el('clear').handlers.click();return h;}
function count(h,n){assert.match(h.el('metrics').textContent,new RegExp(`\\b${n} 个活格子`));}
test('lost pointer capture ends a Life stroke until another pointerdown',async()=>{
 const h=await life();
 pointer(h,'pointerdown',1);pointer(h,'pointermove',1);count(h,1);
 pointer(h,'lostpointercapture',1);
 pointer(h,'pointermove',1,80,80);count(h,1);
 pointer(h,'pointerdown',2);pointer(h,'pointermove',2,80,80);count(h,2);
});
test('only the owning primary pointer can draw or end a Life stroke',async()=>{
 const h=await life();
 pointer(h,'pointerdown',1);
 pointer(h,'pointerdown',2,80,80,{isPrimary:false});
 pointer(h,'pointermove',2,80,80);count(h,0);
 for(const type of ['pointerup','pointercancel','lostpointercapture'])pointer(h,type,2);
 pointer(h,'pointermove',1);count(h,1);
 pointer(h,'pointerup',1);pointer(h,'pointermove',1,80,80);count(h,1);
});
test('cancel and experiment reset discard stale drawing gestures',async()=>{
 const h=await life();
 pointer(h,'pointerdown',1);pointer(h,'pointermove',1);pointer(h,'pointercancel',1);
 pointer(h,'pointermove',1,80,80);count(h,1);
 pointer(h,'pointerdown',2);assert.ok(h.captures.has(2));h.el('clear').handlers.click();assert.equal(h.captures.has(2),false);
 pointer(h,'pointermove',2,80,80);count(h,0);
 pointer(h,'pointerdown',3);h.tabs[0].handlers.click();assert.equal(h.captures.has(3),false);h.tabs[1].handlers.click();
 const before=h.el('metrics').textContent;
 pointer(h,'pointermove',3,80,80);assert.equal(h.el('metrics').textContent,before);
 pointer(h,'pointerdown',4);h.el('reset').handlers.click();assert.equal(h.captures.has(4),false);
 pointer(h,'pointermove',4,80,80);assert.equal(h.el('metrics').textContent,before);
});
test('normal taps toggle and drag-generated clicks do not erase the stroke',async()=>{
 const h=await life();
 pointer(h,'pointerdown',1);pointer(h,'pointerup',1);pointer(h,'click',1);count(h,1);
 pointer(h,'pointerdown',2);pointer(h,'pointerup',2);pointer(h,'click',2);count(h,0);
 pointer(h,'pointerdown',3);pointer(h,'pointermove',3);pointer(h,'pointerup',3);
 pointer(h,'lostpointercapture',3);pointer(h,'click',3);count(h,1);
 pointer(h,'pointerdown',4,80,80,{button:2});pointer(h,'pointermove',4,80,80);count(h,1);
});

test('interrupted gestures cannot click into a cleared board or a different experiment',async()=>{
 const h=await life();
 pointer(h,'pointerdown',1);pointer(h,'pointermove',1);h.el('clear').handlers.click();
 pointer(h,'pointerup',1);pointer(h,'click',1);count(h,0);
 pointer(h,'pointerdown',6);pointer(h,'pointermove',6);h.el('reset').handlers.click();
 const resetMetrics=h.el('metrics').textContent;
 pointer(h,'pointerup',6);pointer(h,'click',6);assert.equal(h.el('metrics').textContent,resetMetrics);
 pointer(h,'pointerdown',2);pointer(h,'pointermove',2);h.tabs[0].handlers.click();
 pointer(h,'pointerup',2);pointer(h,'click',2);assert.match(h.el('metrics').textContent,/3 颗行星/);
 pointer(h,'pointerdown',3);pointer(h,'click',3);assert.match(h.el('metrics').textContent,/4 颗行星/);
 h.tabs[1].handlers.click();h.el('clear').handlers.click();
 for(const type of ['pointercancel','lostpointercapture']){
   pointer(h,'pointerdown',4);pointer(h,type,4);pointer(h,'click',4);count(h,0);
 }
 pointer(h,'pointerdown',5);pointer(h,'pointerup',5);pointer(h,'click',5);count(h,1);
});
