import test from 'node:test';
import assert from 'node:assert/strict';
let instance=0;
async function setup(search='',hash=''){
let drawCount=0,frameId=0,intersect;const frames=new Map(),documentHandlers={};const tick=now=>{const [id,callback]=frames.entries().next().value;frames.delete(id);callback(now);};const els=new Map();const noop=()=>{};const ctx=new Proxy({clearRect:()=>drawCount++,createRadialGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||noop,set:(t,k,v)=>(t[k]=v,true)});function el(id){if(!els.has(id))els.set(id,{id,value:'',textContent:'',hidden:false,handlers:{},dataset:{},classList:{toggle:noop},setAttribute:noop,focus:noop,select:noop,append:noop,remove:noop,click:noop,addEventListener(n,f){this.handlers[n]=f},getBoundingClientRect:()=>({width:600,height:414,left:0,top:0}),getContext:()=>ctx,setPointerCapture:noop,toBlob:f=>f(new Blob(['png']))});return els.get(id)}const tabs=['orbit','life','wave','fractal','walk'].map(m=>{const t=el('tab-'+m);t.dataset.mode=m;return t});globalThis.document={querySelector:s=>el(s.slice(1)),querySelectorAll:()=>tabs,createElement:()=>el('generated'),body:{append:noop},hidden:false,addEventListener:(name,callback)=>documentHandlers[name]=callback};const motion={matches:true,addEventListener:(name,handler)=>motion.change=handler};globalThis.matchMedia=()=>motion;const windowHandlers={};globalThis.addEventListener=(name,handler)=>windowHandlers[name]=handler;globalThis.location=new URL('https://example.org/'+search+hash);let writes=0;globalThis.history={state:{anchor:true},replaceState(state,title,url){writes++;globalThis.location=new URL(url,location.href);this.state=state;}};globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);globalThis.IntersectionObserver=class{constructor(callback){intersect=callback;}observe(){}};globalThis.ResizeObserver=class{observe(){}};globalThis.setTimeout=noop;
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

test('reading links preserve each experiment through repeated anchor-only Back/Forward',async()=>{
 for(const mode of ['orbit','life','wave','fractal','walk']){
  const h=await setup('?experiment='+mode);
  h.el('guide-start').handlers.click();
  h.el('step').handlers.click();
  if(mode==='life')h.key('Enter');
  if(mode==='wave')h.key('ArrowDown');
  const snapshot=['metrics','observation-a','observation-b','observation-c','status'].map(id=>h.el(id).textContent);
  const writes=h.writes();
  for(const hash of ['#canvas','#observation-title','#discovery-title','#canvas','#discovery-title','#observation-title']){
   h.navigate(location.search+hash);
   assert.deepEqual(['metrics','observation-a','observation-b','observation-c','status'].map(id=>h.el(id).textContent),snapshot,mode+hash);
   assert.equal(h.frames.size,0,'reading navigation does not resume animation');
  }
  assert.equal(h.writes(),writes,'anchor traversal never rewrites simulation settings');
 }
});
test('section deep links survive initialization, parameter edits and sharing',async()=>{
 for(const hash of ['#lab','#about','#canvas','#observation-title','#discovery-title']){
  const h=await setup('?experiment=wave&wavelength=32&separation=100',hash);
  assert.equal(location.hash,hash);
  h.el('wavelength').handlers.input({target:{value:'40'}});
  assert.equal(location.hash,hash);
  await h.el('share').handlers.click();
  assert.equal(h.el('share-link').value,location.href);
  assert.match(h.el('share-link').value,/wavelength=40/);
  assert.equal(new URL(h.el('share-link').value).hash,hash);
 }
});
test('reading navigation has native links, reachable focus targets and visible return paths',async()=>{
 const {readFile}=await import('node:fs/promises');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const nav=html.match(/<nav class="reading-nav"[^>]*>(.*?)<\/nav>/)[1];
 for(const id of ['canvas','observation-title','discovery-title'])assert.ok(nav.includes('href="#'+id+'"'));
 for(const id of ['observation-title','discovery-title'])assert.ok(html.includes('id="'+id+'" tabindex="-1"'));
 assert.equal((html.match(/class="return-to-canvas" href="#canvas"/g)||[]).length,2);
});


test('updated reading assets have explicit matching cache versions',async()=>{
 const {readFile}=await import('node:fs/promises');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(html.includes('href="style.css?v=contact-footer-1"'));
 assert.ok(html.includes('src="app.js?v=preserve-active-tab-1"'));
});

test('re-selecting any active tab preserves parameters, canvas progress, and pause state',async()=>{
 for(const [i,mode] of ['orbit','life','wave','fractal','walk'].entries()){
  const h=await setup('?experiment='+mode);
  h.el('guide-start').handlers.click();
  h.el('step').handlers.click();
  const slider={orbit:'gravity',life:'rate',wave:'wavelength',fractal:'jump',walk:'bias'}[mode];
  h.el(slider).handlers.input({target:{value:{orbit:'120',life:'4',wave:'45',fractal:'60',walk:'20'}[mode]}});
  h.el('step').handlers.click();
  if(mode==='life')h.key('Enter');
  if(mode==='wave')h.key('ArrowDown');
  await h.el('share').handlers.click();
  const readings=['metrics','observation-a','observation-b','observation-c','status','announcement','wave-value-left','wave-value-right','wave-value-combined'];
  const snapshot=readings.map(id=>h.el(id).textContent);
  const url=location.href,writes=h.writes(),sliders=h.el('sliders').innerHTML;
  for(let repeat=0;repeat<3;repeat++)h.tabs[i].handlers.click();
  assert.deepEqual(readings.map(id=>h.el(id).textContent),snapshot,mode);
  assert.equal(location.href,url,mode+' retains parameter URL');
  assert.equal(h.writes(),writes,mode+' does not rewrite history');
  assert.equal(h.el('sliders').innerHTML,sliders,mode+' retains controls');
  assert.equal(h.el('share-link').hidden,false,mode+' keeps its visible share link');
  assert.equal(h.el('share-link').value,url);
  assert.equal(h.frames.size,0,mode+' stays paused');
  h.el('pause').handlers.click();
  h.tabs[i].handlers.click();
  assert.equal(h.frames.size,1,mode+' keeps running when already running');
 }
});

test('Home/End on the selected boundary tab preserve progress and still focus the tab',async()=>{
 for(const [mode,key,i] of [['orbit','Home',0],['walk','End',4]]){
  const h=await setup('?experiment='+mode);h.el('step').handlers.click();
  const before=h.el('metrics').textContent,writes=h.writes();let focused=0,prevented=0;
  h.tabs[i].focus=()=>focused++;
  for(let repeat=0;repeat<3;repeat++)h.tabs[i].handlers.keydown({key,preventDefault(){prevented++;}});
  assert.equal(h.el('metrics').textContent,before);
  assert.equal(h.writes(),writes);
  assert.equal(focused,3);assert.equal(prevented,3);
  assert.equal(h.frames.size,0);
 }
});

test('tab navigation still changes worlds, while Reset and guided starts intentionally reset',async()=>{
 const h=await setup('?experiment=orbit');
 h.tabs[0].handlers.keydown({key:'ArrowLeft',preventDefault(){}});
 assert.match(h.el('stage-title').textContent,/漫步/);
 h.tabs[4].handlers.keydown({key:'ArrowRight',preventDefault(){}});
 assert.match(h.el('stage-title').textContent,/引力/);
 h.tabs[0].handlers.keydown({key:'End',preventDefault(){}});
 h.el('step').handlers.click();assert.match(h.el('metrics').textContent,/32 步/);
 h.el('reset').handlers.click();assert.match(h.el('metrics').textContent,/16 步/);
 h.el('step').handlers.click();h.el('guide-start').handlers.click();
 assert.match(h.el('metrics').textContent,/16 步/);
 h.tabs[4].handlers.keydown({key:'Home',preventDefault(){}});
 assert.match(h.el('stage-title').textContent,/引力/);
 h.tabs[1].handlers.click();assert.match(h.el('stage-title').textContent,/生命/);
});
