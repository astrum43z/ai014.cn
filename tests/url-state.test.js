import test from 'node:test';
import assert from 'node:assert/strict';
let instance=0;
async function setup(search='',hash='',motionMatches=true){
let drawCount=0,frameId=0,intersect,resize,lastProbe;let rect={width:600,height:414,left:0,top:0};const frames=new Map(),documentHandlers={};const tick=now=>{const [id,callback]=frames.entries().next().value;frames.delete(id);callback(now);};const els=new Map();const noop=()=>{};const ctx=new Proxy({clearRect:()=>drawCount++,arc:(x,y,r)=>{if(r===9)lastProbe={x,y,r};},createRadialGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||noop,set:(t,k,v)=>(t[k]=v,true)});function el(id){if(!els.has(id))els.set(id,{id,value:'',textContent:'',hidden:false,handlers:{},dataset:{},classList:{toggle:noop},setAttribute:noop,focus:noop,select:noop,append:noop,remove:noop,click:noop,addEventListener(n,f){this.handlers[n]=f},getBoundingClientRect:()=>rect,getContext:()=>ctx,setPointerCapture:noop,toBlob:f=>f(new Blob(['png']))});return els.get(id)}const tabs=['orbit','life','wave','fractal','walk'].map(m=>{const t=el('tab-'+m);t.dataset.mode=m;return t});globalThis.document={querySelector:s=>el(s.slice(1)),querySelectorAll:()=>tabs,createElement:()=>el('generated'),body:{append:noop},hidden:false,addEventListener:(name,callback)=>documentHandlers[name]=callback};const motion={matches:motionMatches,addEventListener:(name,handler)=>motion.change=handler};globalThis.matchMedia=()=>motion;const windowHandlers={};globalThis.addEventListener=(name,handler)=>windowHandlers[name]=handler;globalThis.location=new URL('https://example.org/'+search+hash);let writes=0;globalThis.history={state:{anchor:true},replaceState(state,title,url){writes++;globalThis.location=new URL(url,location.href);this.state=state;}};globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);globalThis.IntersectionObserver=class{constructor(callback){intersect=callback;}observe(){}};globalThis.ResizeObserver=class{constructor(callback){resize=callback;}observe(){}};globalThis.setTimeout=noop;
await import('../app.js?url='+instance++);
return {el,tabs,frames,motion,windowHandlers,tick,probe:()=>lastProbe,resize(width,height){rect={width,height,left:0,top:0};resize();},writes:()=>writes,navigate(url){globalThis.location=new URL(url,location.href);windowHandlers.popstate();},key:(key,extra={})=>el('canvas').handlers.keydown({key,preventDefault(){},...extra})};
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
 assert.equal((html.match(/class="return-to-canvas" href="#canvas"/g)||[]).length,5);
});


test('updated assets have explicit cache versions',async()=>{
 const {readFile}=await import('node:fs/promises');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(html.includes('href="style.css?v=saved-observation-copy-1&amp;orbit-target=exact-1&amp;cell-position=exact-1&amp;cell-history=explain-1&amp;change-browse=2&amp;browse=living-cells-1&amp;seek=exact-count-1&amp;wave=quarter-rewind-1&amp;position=exact-wave-1&amp;replay=exact-walk-1&amp;target-reading=1&amp;time=exact-wave-1&amp;instruments=narrow-reflow-1&amp;worlds-return=1&amp;life-grid=flexible-1&amp;orbit-fit=first-body-1&amp;canvas-start=retry-1&amp;life-inspector=stack-1&amp;walk-probability=stack-1"'));
 assert.ok(html.includes('src="app.js?v=saved-observation-copy-1&amp;source-probe=clear-1&amp;wave-bars=stable-1&amp;wave-ruler=probe-clear-1&amp;ruler-endpoint=clear-1&amp;wave-sources=paired-label-1&amp;preview-launcher=clear-1&amp;orbit-legend=compact-1&amp;vertex-label=inset-1&amp;walk-distance=contrast-1&amp;fractal-path=append-once-1&amp;legend-endpoint=clear-1&amp;walk-reference=contrast-1&amp;launcher=contrast-1&amp;orbit-target=exact-1&amp;walk-text=stable-1&amp;fractal-text=stable-1&amp;preview-caption=clear-1&amp;trial-text=stable-1&amp;cell-position=exact-1&amp;repeat=stable-evidence-1&amp;feedback=parameter-action-1&amp;drag-feedback=meaningful-action-1&amp;render=positive-scale-1&amp;orbit-marker=contrast-1&amp;cell-history=explain-1&amp;change-browse=2&amp;wave=quarter-rewind-1&amp;probe=usable-view-1&amp;launch=usable-view-1&amp;browse=living-cells-1&amp;seek=exact-count-1&amp;home=exact-orbit-1&amp;position=exact-wave-1&amp;replay=exact-walk-1&amp;target-reading=1&amp;checkpoint-reading=1&amp;time=exact-wave-1&amp;number=cn-target-glyphs-1&amp;fractal-limit=rewind-guidance-1&amp;canvas-pointer=loss-safe-1&amp;population=shared-1&amp;gap=count-once-1&amp;availability=quiet-1&amp;walk=read-once-1&amp;life=record-once-1&amp;history=read-once-1&amp;colors=wave-once-1&amp;orbit-fit=first-body-1&amp;canvas-start=retry-1&amp;sampling=wave-field-fallback-1&amp;nudge=single-enter-1&amp;walk-batch=reverse-1"'));
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

test('sharing wave cancellation restores the exact probe and phase, paused even without reduced motion',async()=>{
 let h=await setup('?experiment=wave&wavelength=32&separation=100','#canvas',false);
 h.el('guide-start').handlers.click();h.el('step').handlers.click();h.key('ArrowDown');
 const ids=['metrics','observation-a','observation-b','observation-c','wave-value-left','wave-value-right','wave-value-combined','wave-envelope'];
 const expected=ids.map(id=>h.el(id).textContent);
 await h.el('share').handlers.click();const url=new URL(h.el('share-link').value);
 assert.ok(url.searchParams.has('at'));assert.equal(url.hash,'#canvas');
 assert.equal(h.el('status').textContent,'已暂停');assert.equal(h.frames.size,0);
 h=await setup(url.search,url.hash,false);
 assert.deepEqual(ids.map(id=>h.el(id).textContent),expected);
 assert.equal(h.el('status').textContent,'已暂停');assert.equal(h.frames.size,0);
 assert.equal(location.href,url.href);assert.match(h.el('announcement').textContent,/复现/);
 h.el('step').handlers.click();assert.match(h.el('metrics').textContent,/t \+ 1.0 s/);
});
test('seeded exhibit links restore non-default progress and readings and can continue identically',async()=>{
 for(const [mode,search,steps] of [['fractal','jump=65&seed=23',9],['walk','bias=25&seed=99',5]]){
  let h=await setup('?experiment='+mode+'&'+search,'',false);
  for(let n=0;n<steps;n++)h.el('step').handlers.click();
  const ids=['metrics','observation-a','observation-b','observation-c','observation-detail'];
  const expected=ids.map(id=>h.el(id).textContent);
  await h.el('share').handlers.click();const url=new URL(h.el('share-link').value);
  h.el('step').handlers.click();const next=ids.map(id=>h.el(id).textContent);
  assert.equal(h.el('share-link').value,url.href,'saved link remains a fixed checkpoint while exploring');
  h=await setup(url.search,'',false);
  assert.deepEqual(ids.map(id=>h.el(id).textContent),expected,mode);
  assert.equal(h.frames.size,0);h.el('step').handlers.click();
  assert.deepEqual(ids.map(id=>h.el(id).textContent),next,mode+' resumes seeded sequence');
 }
});
test('same-parameter history restores different checkpoints while anchor navigation preserves newer work',async()=>{
 const h=await setup('?experiment=walk&bias=25&seed=14&at=v1,64');
 h.el('step').handlers.click();assert.match(h.el('metrics').textContent,/80 步/);
 h.navigate(location.search+'#observation-title');h.navigate(location.search+'#canvas');
 assert.match(h.el('metrics').textContent,/80 步/);
 h.navigate('?experiment=walk&bias=25&seed=14&at=v1,128#canvas');assert.match(h.el('metrics').textContent,/128 步/);
 h.navigate('?experiment=walk&bias=25&seed=14&at=v1,64#canvas');assert.match(h.el('metrics').textContent,/64 步/);
 h.navigate('?experiment=walk&bias=25&seed=14');assert.match(h.el('metrics').textContent,/16 步/);
 assert.equal(h.frames.size,0);
});
test('sharing a running seeded exhibit pauses it; parameter edits discard obsolete checkpoint links',async()=>{
 const h=await setup('?experiment=fractal','',false);
 assert.equal(h.frames.size,1);h.tick(0);h.tick(50);h.tick(100);
 assert.match(h.el('metrics').textContent,/400 个点/);
 await h.el('share').handlers.click();assert.equal(h.frames.size,0);
 assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),'v1,400');
 h.el('jump').handlers.input({target:{value:'65'}});
 assert.equal(new URL(location.href).searchParams.has('at'),false);assert.equal(h.el('share-link').hidden,true);
 assert.match(h.el('metrics').textContent,/300 个点/);
 await h.el('share').handlers.click();assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),'v1,300');
 assert.match(h.el('share-link').value,/jump=65/);
});
test('legacy parameter links preserve their startup behavior and explicitly exclude drawings',async()=>{
 for(const mode of ['orbit','life']){
  const h=await setup('?experiment='+mode,'',false);
  assert.equal(h.frames.size,1);await h.el('share').handlers.click();
  assert.equal(new URL(h.el('share-link').value).searchParams.has('at'),false);
  assert.equal(h.frames.size,1,'parameter-only sharing does not pause '+mode);
  assert.match(h.el('share-note').textContent,/不含画布/);
 }
 for(const mode of ['wave','fractal','walk']){
  const h=await setup('?experiment='+mode,'',false);
  assert.equal(h.frames.size,1,mode+' old links continue as before');
 }
});
test('malformed checkpoint falls back to bounded parameter state without carrying the bad payload',async()=>{
 for(const [mode,at,metric] of [['walk','v1,999999999','16 步'],['fractal','v1,Infinity','300 个点'],['wave','v1,NaN,0,0','t + 0.0 s']]){
  const h=await setup('?experiment='+mode+'&at='+encodeURIComponent(at));
  assert.ok(h.el('metrics').textContent.includes(metric));assert.equal(location.search.includes('at='),false);
 }
});
test('copy fallback remains selectable and a late clipboard response cannot announce for a different exhibit',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');let resolve;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(r=>resolve=r)}}});
 try{
  const h=await setup('?experiment=walk&at=v1,64');
  const pending=h.el('share').handlers.click();assert.equal(h.el('share-link').hidden,false);
  h.tabs[1].handlers.click();const notice=h.el('announcement').textContent;
  resolve();await pending;assert.equal(h.el('announcement').textContent,notice);
  globalThis.navigator.clipboard.writeText=async()=>{throw Error('clipboard unavailable');};
  h.tabs[2].handlers.click();await h.el('share').handlers.click();
  assert.match(h.el('announcement').textContent,/请复制下方观测链接/);assert.equal(h.el('share-link').hidden,false);
 }finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
});


test('saved wave probe stays fully visible after narrow resizing without changing the observation',async()=>{
 const h=await setup('?experiment=wave&wavelength=32&separation=100&at=v1,300,-130,0.2');
 const ids=['wave-value-left','wave-value-right','wave-value-combined','observation-a','observation-b'];
 const readings=ids.map(id=>h.el(id).textContent);
 for(const [width,height] of [[1200,414],[393,300],[295,240],[600,414]]){
  h.resize(width,height);const probe=h.probe();
  assert.ok(probe.x>=18&&probe.x<=width-18+1e-8,'probe horizontal crosshair stays visible');
  assert.ok(probe.y>=18&&probe.y<=height-18+1e-8,'probe vertical crosshair stays visible');
  assert.deepEqual(ids.map(id=>h.el(id).textContent),readings);
 }
 h.key('Home');assert.match(h.el('observation-b').textContent,/0.00/);
 h.key('ArrowRight');assert.match(h.el('announcement').textContent,/x 2.0，y 0.0/);
});

test('modified tab shortcuts preserve experiment progress and remain available to the browser',async()=>{
 for(const [i,mode] of ['orbit','life','wave','fractal','walk'].entries()){
  const h=await setup('?experiment='+mode);
  h.el('guide-start').handlers.click();h.el('step').handlers.click();
  if(mode==='wave')h.key('ArrowDown');
  await h.el('share').handlers.click();
  let prevented=0,focused=0;
  for(const tab of h.tabs)tab.focus=()=>focused++;
  const ids=['stage-title','metrics','observation-a','observation-b','observation-c','status','announcement'];
  for(const running of [false,true]){
   if(running)h.el('pause').handlers.click();
   const expected=ids.map(id=>h.el(id).textContent),url=location.href,writes=h.writes(),frames=h.frames.size;
   for(const key of ['ArrowLeft','ArrowRight','Home','End'])for(const modifier of ['altKey','ctrlKey','metaKey','shiftKey']){
    h.tabs[i].handlers.keydown({key,[modifier]:true,preventDefault(){prevented++;}});
    assert.deepEqual(ids.map(id=>h.el(id).textContent),expected,mode+' '+modifier+' '+key);
    assert.equal(location.href,url);assert.equal(h.writes(),writes);
    assert.equal(h.frames.size,frames);assert.equal(h.el('share-link').hidden,false);
    assert.equal(h.el('share-link').value,url);
   }
  }
  assert.equal(prevented,0,'browser and assistive shortcuts are not cancelled');
  assert.equal(focused,0,'modified shortcuts do not move tab focus');
 }
});
