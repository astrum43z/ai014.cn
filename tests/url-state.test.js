import test from 'node:test';
import assert from 'node:assert/strict';
let instance=0;
async function setup(search='',hash=''){
let drawCount=0,frameId=0,intersect;const frames=new Map(),documentHandlers={};const tick=now=>{const [id,callback]=frames.entries().next().value;frames.delete(id);callback(now);};const els=new Map();const noop=()=>{};const ctx=new Proxy({clearRect:()=>drawCount++,createRadialGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||noop,set:(t,k,v)=>(t[k]=v,true)});function el(id){if(!els.has(id))els.set(id,{id,value:'',textContent:'',hidden:false,handlers:{},dataset:{},classList:{toggle:noop},setAttribute:noop,focus:noop,select:noop,append:noop,remove:noop,click:noop,addEventListener(n,f){this.handlers[n]=f},getBoundingClientRect:()=>({width:600,height:414,left:0,top:0}),getContext:()=>ctx,setPointerCapture:noop,toBlob:f=>f(new Blob(['png']))});return els.get(id)}const tabs=['orbit','life','wave','fractal'].map(m=>{const t=el('tab-'+m);t.dataset.mode=m;return t});globalThis.document={querySelector:s=>el(s.slice(1)),querySelectorAll:()=>tabs,createElement:()=>el('generated'),body:{append:noop},hidden:false,addEventListener:(name,callback)=>documentHandlers[name]=callback};const motion={matches:true,addEventListener:(name,handler)=>motion.change=handler};globalThis.matchMedia=()=>motion;const windowHandlers={};globalThis.addEventListener=(name,handler)=>windowHandlers[name]=handler;globalThis.location=new URL('https://example.org/'+search+hash);let writes=0;globalThis.history={state:{anchor:true},replaceState(state,title,url){writes++;globalThis.location=new URL(url,location.href);this.state=state;}};globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);globalThis.IntersectionObserver=class{constructor(callback){intersect=callback;}observe(){}};globalThis.ResizeObserver=class{observe(){}};globalThis.setTimeout=noop;
await import('../app.js?url='+instance++);
return {el,tabs,frames,motion,windowHandlers,writes:()=>writes,navigate(url){globalThis.location=new URL(url,location.href);windowHandlers.popstate();},key:(key,extra={})=>el('canvas').handlers.keydown({key,preventDefault(){},...extra})};
}

test('Back/Forward restores the experiment, sliders and canvas from its URL',async()=>{
 const h=await setup('?experiment=life&rate=3&density=45','#lab');
 h.tabs[2].handlers.click();
 h.navigate('?experiment=life&rate=3&density=45#lab');
 assert.match(h.el('stage-title').textContent,/生命/);
 assert.ok(h.el('sliders').innerHTML.includes('id="out-rate" for="rate">3 代/秒</output>'));
 assert.ok(h.el('sliders').innerHTML.includes('id="out-density" for="density">45%</output>'));
 assert.match(h.el('metrics').textContent,/第 0 代/);
 assert.equal(location.hash,'#lab');
 h.navigate('?experiment=wave&wavelength=65&separation=150');
 assert.match(h.el('stage-title').textContent,/波与波/);
 assert.ok(h.el('sliders').innerHTML.includes('id="out-wavelength" for="wavelength">65</output>'));
 assert.equal(h.frames.size,0,'navigation must preserve the current pause');
});
test('anchor-only history traversal does not reset an experiment',async()=>{
 const h=await setup('?experiment=life&rate=3&density=45');
 h.el('step').handlers.click();
 const writes=h.writes();
 h.navigate(location.search+'#lab');
 assert.match(h.el('metrics').textContent,/第 1 代/);
 assert.equal(h.writes(),writes,'no history rewrite is needed for unchanged settings');
});
test('visible share link tracks parameter edits without destroying history state',async()=>{
 const h=await setup('?experiment=orbit&gravity=80&speed=100');
 await h.el('share').handlers.click();
 h.el('gravity').handlers.input({target:{value:'120'}});
 assert.equal(h.el('share-link').value,location.href);
 assert.match(h.el('share-link').value,/gravity=120/);
 assert.deepEqual(history.state,{anchor:true});
});
test('history restoration validates malformed values before rendering',async()=>{
 const h=await setup();
 h.navigate('?experiment=wave&wavelength=Infinity&separation=9999');
 assert.ok(h.el('sliders').innerHTML.includes('id="out-wavelength" for="wavelength">32</output>'));
 assert.ok(h.el('sliders').innerHTML.includes('id="out-separation" for="separation">180</output>'));
 assert.equal(location.search,'?experiment=wave&wavelength=32&separation=180');
});
