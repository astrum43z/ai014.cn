import test from 'node:test';
import assert from 'node:assert/strict';
let instance=0;
async function setup(search='',hash=''){
let drawCount=0,frameId=0,intersect;const frames=new Map(),documentHandlers={};const tick=now=>{const [id,callback]=frames.entries().next().value;frames.delete(id);callback(now);};const els=new Map();const noop=()=>{};const ctx=new Proxy({clearRect:()=>drawCount++,createRadialGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||noop,set:(t,k,v)=>(t[k]=v,true)});function el(id){if(!els.has(id))els.set(id,{id,value:'',textContent:'',hidden:false,handlers:{},dataset:{},classList:{toggle:noop},setAttribute:noop,focus:noop,select:noop,append:noop,remove:noop,click:noop,addEventListener(n,f){this.handlers[n]=f},getBoundingClientRect:()=>({width:600,height:414,left:0,top:0}),getContext:()=>ctx,setPointerCapture:noop,toBlob:f=>f(new Blob(['png']))});return els.get(id)}const tabs=['orbit','life','wave','fractal'].map(m=>{const t=el('tab-'+m);t.dataset.mode=m;return t});globalThis.document={querySelector:s=>el(s.slice(1)),querySelectorAll:()=>tabs,createElement:()=>el('generated'),body:{append:noop},hidden:false,addEventListener:(name,callback)=>documentHandlers[name]=callback};const motion={matches:true,addEventListener:(name,handler)=>motion.change=handler};globalThis.matchMedia=()=>motion;const windowHandlers={};globalThis.addEventListener=(name,handler)=>windowHandlers[name]=handler;globalThis.location=new URL('https://example.org/'+search+hash);let writes=0;globalThis.history={state:{anchor:true},replaceState(state,title,url){writes++;globalThis.location=new URL(url,location.href);this.state=state;}};globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);globalThis.IntersectionObserver=class{constructor(callback){intersect=callback;}observe(){}};globalThis.ResizeObserver=class{observe(){}};globalThis.setTimeout=noop;
await import('../app.js?guides='+instance++);
return {el,tabs,frames,motion,windowHandlers,writes:()=>writes,navigate(url){globalThis.location=new URL(url,location.href);windowHandlers.popstate();},key:(key,extra={})=>el('canvas').handlers.keydown({key,preventDefault(){},...extra})};
}


test('guided orbit start resets parameters, pauses, and retains velocity when gravity changes',async()=>{
 const h=await setup('?experiment=orbit&gravity=140&speed=30');
 h.el('pause').handlers.click();
 h.el('guide-start').handlers.click();
 assert.equal(h.frames.size,0);
 assert.equal(h.el('preset-select').value,'circular');
 assert.equal(location.search,'?experiment=orbit&gravity=80&speed=100');
 assert.match(h.el('observation-a').textContent,/75.0/);
 const speed=h.el('observation-b').textContent;
 h.el('gravity').handlers.input({target:{value:'40'}});
 assert.equal(h.el('observation-b').textContent,speed);
 for(let i=0;i<20;i++)h.el('step').handlers.click();
 assert.ok(Number(h.el('observation-a').textContent.split(' · ')[1])>75);
 h.el('guide-start').handlers.click();
 assert.match(h.el('observation-a').textContent,/75.0/);
 assert.equal(location.search,'?experiment=orbit&gravity=80&speed=100');
 assert.equal(h.frames.size,0);
});
test('Life guide demonstrates constant population and a two-generation exact-state period',async()=>{
 const h=await setup('?experiment=life&rate=20&density=60');
 h.el('guide-start').handlers.click();
 assert.equal(h.el('preset-select').value,'blinker');
 assert.equal(location.search,'?experiment=life&rate=2&density=30');
 assert.match(h.el('metrics').textContent,/第 0 代 · 3 个活格子/);
 h.el('step').handlers.click();
 assert.match(h.el('metrics').textContent,/第 1 代 · 3 个活格子/);
 h.el('step').handlers.click();
 assert.match(h.el('metrics').textContent,/第 2 代 · 3 个活格子/);
 assert.equal(h.el('observation-c').textContent,'重复周期 · 2 代');
 h.el('guide-start').handlers.click();
 assert.match(h.el('metrics').textContent,/第 0 代 · 3 个活格子/);
 assert.equal(h.el('observation-c').textContent,'状态 · 尚未发现重复');
 assert.equal(h.frames.size,0);
});
test('wave guide contrasts half-wavelength cancellation with central-axis reinforcement',async()=>{
 const h=await setup('?experiment=wave&wavelength=65&separation=150');
 h.el('guide-start').handlers.click();
 assert.equal(h.el('preset-select').value,'ripple');
 assert.equal(location.search,'?experiment=wave&wavelength=32&separation=100');
 assert.equal(h.el('observation-b').textContent,'Δr / λ · 0.50');
 assert.equal(h.el('observation-c').textContent,'相遇方式 · 接近抵消');
 h.el('step').handlers.click();
 assert.equal(h.el('observation-b').textContent,'Δr / λ · 0.50');
 h.el('canvas').handlers.click({clientX:300,clientY:207});
 assert.equal(h.el('observation-b').textContent,'Δr / λ · 0.00');
 assert.equal(h.el('observation-c').textContent,'相遇方式 · 接近加强');
 h.tabs[1].handlers.click();
 assert.match(h.el('guide-title').textContent,/数量不变/);
 h.tabs[2].handlers.click();
 h.el('guide-start').handlers.click();
 assert.equal(h.el('observation-b').textContent,'Δr / λ · 0.50');
 assert.equal(h.frames.size,0);
});
test('guide cancels an active drawing stroke and mode changes replace its instructions',async()=>{
 const h=await setup('?experiment=life');
 h.el('canvas').handlers.pointerdown({pointerId:1,button:0});
 h.el('canvas').handlers.pointermove({pointerId:1,clientX:20,clientY:20});
 h.el('guide-start').handlers.click();
 h.el('canvas').handlers.pointermove({pointerId:1,clientX:50,clientY:50});
 h.el('canvas').handlers.click({pointerId:1,clientX:50,clientY:50});
 assert.match(h.el('metrics').textContent,/3 个活格子/);
 h.tabs[0].handlers.click();
 assert.match(h.el('challenge').textContent,/引力从 80 调到 40/);
 assert.match(h.el('guide-title').textContent,/引力改变/);
 assert.equal(h.frames.size,0);
});
