import test from 'node:test';
import assert from 'node:assert/strict';
let instance=0;
async function setup(search='',hash=''){
let rect={width:600,height:414,left:0,top:0},resize;let drawCount=0,frameId=0,intersect,strokes=[],path=[],dash=[];const frames=new Map(),documentHandlers={};const tick=now=>{const [id,callback]=frames.entries().next().value;frames.delete(id);callback(now);};const els=new Map();const noop=()=>{};const ctx=new Proxy({clearRect:()=>{drawCount++;strokes=[];},beginPath:()=>path=[],moveTo:(x,y)=>path.push(['M',x,y]),lineTo:(x,y)=>path.push(['L',x,y]),arc:(x,y,r)=>path.push(['A',x,y,r]),setLineDash:value=>dash=[...value],stroke:()=>strokes.push({color:ctx.strokeStyle,dash:[...dash],path:[...path]}),createRadialGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||noop,set:(t,k,v)=>(t[k]=v,true)});function el(id){if(!els.has(id))els.set(id,{id,value:'',textContent:'',hidden:false,handlers:{},dataset:{},classList:{toggle:noop},setAttribute:noop,focus:noop,select:noop,append:noop,remove:noop,click:noop,addEventListener(n,f){this.handlers[n]=f},getBoundingClientRect:()=>rect,getContext:()=>ctx,setPointerCapture:noop,toBlob:f=>f(new Blob(['png']))});return els.get(id)}const tabs=['orbit','life','wave','fractal','walk'].map(m=>{const t=el('tab-'+m);t.dataset.mode=m;return t});globalThis.document={querySelector:s=>el(s.slice(1)),querySelectorAll:()=>tabs,createElement:()=>el('generated'),body:{append:noop},hidden:false,addEventListener:(name,callback)=>documentHandlers[name]=callback};const motion={matches:true,addEventListener:(name,handler)=>motion.change=handler};globalThis.matchMedia=()=>motion;const windowHandlers={};globalThis.addEventListener=(name,handler)=>windowHandlers[name]=handler;globalThis.location=new URL('https://example.org/'+search+hash);let writes=0;globalThis.history={state:{anchor:true},replaceState(state,title,url){writes++;globalThis.location=new URL(url,location.href);this.state=state;}};globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);globalThis.IntersectionObserver=class{constructor(callback){intersect=callback;}observe(){}};globalThis.ResizeObserver=class{constructor(callback){resize=callback;}observe(){}};globalThis.setTimeout=noop;
await import('../app.js?wave-paths='+instance++);
return {resize(width,height){rect={width,height,left:0,top:0};resize();},el,tabs,strokes:()=>strokes,frames,motion,windowHandlers,tick,documentHandlers,setVisible(value){intersect([{isIntersecting:value}]);},writes:()=>writes,navigate(url){globalThis.location=new URL(url,location.href);windowHandlers.popstate();},key:(key,extra={})=>el('canvas').handlers.keydown({key,preventDefault(){},...extra})};
}



import {wavePathDifference,waveComponents,waveValue} from '../simulations.js';
import {readFile} from 'node:fs/promises';

const lines=h=>h.strokes().filter(s=>s.color==='#c7b1e8'||s.color==='#f59c80');
const readings=h=>['wave-distances','wave-difference','wave-value-left','wave-value-right','wave-value-combined','wave-envelope'].map(id=>h.el(id).textContent);

test('path distances name left A and right B without changing the field or interference',()=>{
 for(const separation of [20,35,100,150,180])for(const wavelength of [15,28,32,65,70])for(const x of [-1000,-90,-8,0,8,90,1000])for(const y of [-1000,-80,0,80,1000]){
  const p=wavePathDifference(x,y,separation,wavelength),mirror=wavePathDifference(-x,y,separation,wavelength);
  assert.equal(p.leftDistance,Math.hypot(x+separation/2,y));
  assert.equal(p.rightDistance,Math.hypot(x-separation/2,y));
  assert.equal(p.leftDistance,mirror.rightDistance);assert.equal(p.rightDistance,mirror.leftDistance);
  assert.equal(p.difference,Math.abs(p.leftDistance-p.rightDistance));
  assert.ok(p.difference<=separation+1e-10,'triangle inequality bounds path difference');
  assert.equal(p.cycles,p.difference/wavelength);
  for(const phase of [0,.3,10]){
   const expected=(Math.sin(p.leftDistance/wavelength*2*Math.PI-phase)+Math.sin(p.rightDistance/wavelength*2*Math.PI-phase))/2;
   assert.equal(waveValue(x,y,phase,separation,wavelength),expected);
   assert.equal(waveComponents(x,y,phase,separation,wavelength).combined,expected);
  }
 }
 const guide=wavePathDifference(8,0,100,32);assert.equal(guide.leftDistance,58);assert.equal(guide.rightDistance,42);assert.equal(guide.cycles,.5);
 for(const x of [-50,50]){const p=wavePathDifference(x,0,100,32);assert.equal(Math.min(p.leftDistance,p.rightDistance),0);assert.equal(p.difference,100);}
});

test('guided path overlay joins each source to the probe with independent line patterns',async()=>{
 const h=await setup('?experiment=wave');h.el('guide-start').handlers.click();
 const scale=414/280;
 assert.equal(h.el('wave-distances').textContent,'A 路程 58.00 · B 路程 42.00');
 assert.equal(h.el('wave-difference').textContent,'两条路相差 16.00 ÷ 波长 32 ≈ 0.50 个波长');
 assert.deepEqual(lines(h),[
  {color:'#c7b1e8',dash:[],path:[['M',300-50*scale,207],['L',300+8*scale,207]]},
  {color:'#f59c80',dash:[7,5],path:[['M',300+50*scale,207],['L',300+8*scale,207]]}
 ]);
 assert.deepEqual(h.strokes().at(-1).dash,[],'probe crosshair must not inherit a dash');
 h.key('Home');assert.equal(h.el('wave-distances').textContent,'A 路程 50.00 · B 路程 50.00');assert.match(h.el('wave-difference').textContent,/0.00 个波长/);
 assert.match(h.el('announcement').textContent,/A 路程 50.00 · B 路程 50.00/);
});

test('tap while running pauses at the same time and repeated taps keep stable readings',async()=>{
 const h=await setup('?experiment=wave');h.el('pause').handlers.click();h.tick(0);h.tick(50);
 const time=h.el('metrics').textContent;assert.equal(h.frames.size,1);assert.equal(lines(h).length,0);
 h.el('canvas').handlers.click({clientX:300+8*414/280,clientY:207});
 assert.equal(h.frames.size,0);assert.equal(h.el('metrics').textContent,time);assert.equal(lines(h).length,2);
 assert.match(h.el('announcement').textContent,/已暂停；测量探针已移动；A 路程 58.00 · B 路程 42.00/);
 const first=readings(h);h.el('canvas').handlers.click({clientX:300+8*414/280,clientY:207});assert.deepEqual(readings(h),first);
 h.el('pause').handlers.click();assert.equal(lines(h).length,0);assert.match(h.el('wave-path-note').textContent,/轻点画布即可暂停/);
 h.el('pause').handlers.click();assert.equal(lines(h).length,2);assert.deepEqual(readings(h),first);
 assert.match(h.el('wave-path-note').textContent,/实线 A、虚线 B/);
});

test('step changes wave phase but geometry stays fixed; sliders and presets update geometry',async()=>{
 const h=await setup('?experiment=wave');h.el('guide-start').handlers.click();const geometry=lines(h),start=h.el('wave-value-left').textContent;
 for(let i=0;i<10;i++){h.el('step').handlers.click();assert.deepEqual(lines(h),geometry);assert.equal(h.el('wave-value-combined').textContent,'0.00');assert.match(h.el('announcement').textContent,/相差 16.00/);}
 assert.notEqual(h.el('wave-value-left').textContent,start);
 h.el('wavelength').handlers.input({target:{value:'64'}});assert.match(h.el('wave-difference').textContent,/16.00 ÷ 波长 64 ≈ 0.25/);assert.deepEqual(lines(h),geometry);
 h.el('separation').handlers.input({target:{value:'20'}});assert.equal(h.el('wave-distances').textContent,'A 路程 18.00 · B 路程 2.00');
 h.el('reset').handlers.click();assert.equal(h.el('wave-distances').textContent,'A 路程 10.00 · B 路程 10.00');
 h.el('preset-select').handlers.change({target:{value:'wide'}});assert.equal(h.el('wave-distances').textContent,'A 路程 75.00 · B 路程 75.00');
 h.el('guide-start').handlers.click();assert.deepEqual(lines(h),geometry);assert.equal(h.el('wave-value-left').textContent,start);
});

test('source and overlapping paths stay finite and distinct; modified keyboard actions do not move',async()=>{
 const h=await setup('?experiment=wave&at=v1,50,0,0');
 assert.equal(h.el('wave-distances').textContent,'A 路程 100.00 · B 路程 0.00');
 assert.deepEqual(lines(h)[1].path[0].slice(1),lines(h)[1].path[1].slice(1));
 h.navigate('?experiment=wave&at=v1,100,0,0');assert.equal(h.el('wave-distances').textContent,'A 路程 150.00 · B 路程 50.00');
 assert.deepEqual(lines(h)[0].dash,[]);assert.deepEqual(lines(h)[1].dash,[7,5]);
 const before=readings(h);for(const extra of [{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true}])h.key('Home',extra);assert.deepEqual(readings(h),before);
 h.key('ArrowUp');assert.equal(lines(h)[0].path[1][2],207-2*414/280);
 for(let i=0;i<150;i++)h.key('ArrowRight');assert.ok(lines(h)[0].path[1][1]<=600);
});

test('shared path observations preserve geometry across anchors, navigation and narrow resize',async()=>{
 const h=await setup('?experiment=wave&at=v1,800,-300,2.5');const before=readings(h);
 h.resize(295,260);assert.deepEqual(readings(h),before);
 for(const line of lines(h)){for(const [_,x,y] of line.path){assert.ok(x>=0&&x<=295);assert.ok(y>=0&&y<=260);}}
 await h.el('share').handlers.click();const url=h.el('share-link').value;assert.equal(new URL(url).searchParams.get('at'),'v1,800,-300,2.5');
 h.navigate(location.search+'#observation-title');h.navigate(location.search+'#canvas');assert.deepEqual(readings(h),before);
 h.tabs[1].handlers.click();assert.equal(h.el('wave-components').hidden,true);assert.equal(lines(h).length,0);
 h.navigate(url);assert.equal(h.el('wave-components').hidden,false);assert.deepEqual(readings(h),before);assert.equal(h.frames.size,0);
 h.key('Home');assert.equal(h.el('wave-distances').textContent,'A 路程 50.00 · B 路程 50.00');
});

test('animation remains quiet and reduced motion immediately restores paused lines',async()=>{
 const h=await setup('?experiment=wave');h.el('pause').handlers.click();const message=h.el('announcement').textContent;
 h.tick(0);h.tick(50);h.tick(100);assert.equal(h.el('announcement').textContent,message);assert.equal(lines(h).length,0);
 h.motion.change({matches:true});assert.equal(h.frames.size,0);assert.equal(lines(h).length,2);assert.match(h.el('wave-path-note').textContent,/实线 A/);
 h.motion.change({matches:false});assert.equal(h.frames.size,0);assert.equal(lines(h).length,2);
});

test('path readings are quiet text inside the existing panel and preserve primary control order',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 for(const id of ['wave-distances','wave-difference','wave-path-note'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 const reading=html.match(/<div class="wave-path-reading">(.*?)<\/div>/)[1];assert.doesNotMatch(reading,/aria-live|role="status"|<button|<input/);
 assert.ok(html.indexOf('class="stage-controls"')<html.indexOf('class="wave-path-reading"'));
 assert.ok(html.includes('app.js?v=orbit-touch-1'));assert.ok(html.includes('style.css?v=orbit-touch-1'));
});
