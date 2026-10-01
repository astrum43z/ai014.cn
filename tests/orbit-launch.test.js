import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {orbitLaunchState,clampOrbitPoint} from '../orbit.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ≈ ${b}`);

test('launch speed is the circular reference times percentage, with a tangential velocity',()=>{
 for(const point of [{x:100,y:0},{x:0,y:-100},{x:-80,y:60},{x:90,y:120}]){
  for(const gravity of [30000,80000,160000])for(const percentage of [30,65,100,150]){
   const before={...point},s=orbitLaunchState(point,gravity,percentage);
   assert.equal(s.valid,true);near(s.circularSpeed**2*s.radius,gravity);
   near(Math.hypot(s.vx,s.vy),s.speed);near(s.speed,s.circularSpeed*percentage/100);
   near(point.x*s.vx+point.y*s.vy,0);assert.ok(point.x*s.vy-point.y*s.vx>0);
   assert.deepEqual(point,before);
  }
 }
});
test('launch boundaries reject the star center and keep the existing minimum radius',()=>{
 for(const point of [{x:0,y:0},{x:21.999,y:0},{x:NaN,y:0},{x:Infinity,y:1}]){
  const s=orbitLaunchState(point,80000,100);assert.equal(s.valid,false);
  assert.equal(s.speed,null);assert.equal(s.circularSpeed,null);assert.equal(s.vx,0);assert.equal(s.vy,0);
 }
 assert.equal(orbitLaunchState({x:22,y:0},80000,100).valid,true);
});
test('keyboard placement fits the full marker and arrow in desktop and phone canvases',()=>{
 for(const [width,height] of [[600,414],[320,240],[284,240],[1400,240]]){
  const scale=Math.min(width,height)/450;
  for(const point of [{x:1e6,y:1e6},{x:-1e6,y:-1e6},{x:140,y:0}]){
   const p=clampOrbitPoint(point,width,height);
   assert.ok(Math.abs(p.x)*scale+34<=width/2+1e-8);
   assert.ok(Math.abs(p.y)*scale+34<=height/2+1e-8);
   assert.deepEqual(clampOrbitPoint(p,width,height),p);
  }
 }
 assert.deepEqual(clampOrbitPoint({x:140,y:0},0,0),{x:140,y:0});
});

let instance=0;
async function setup(reduced=false){
 const frames=new Map(),els=new Map(),noop=()=>{};let frameId=0,arcs=[],resize,width=600,height=414;
 const ctx=new Proxy({clearRect:()=>arcs=[],arc:(x,y,r)=>arcs.push({x,y,r}),createRadialGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||noop,set:(t,k,v)=>(t[k]=v,true)});
 function el(id){if(!els.has(id))els.set(id,{id,value:'',textContent:'',hidden:false,handlers:{},dataset:{},classList:{toggle:noop},setAttribute:noop,focus:noop,select:noop,append:noop,remove:noop,click:noop,addEventListener(n,f){this.handlers[n]=f},getBoundingClientRect:()=>({width,height,left:0,top:0}),getContext:()=>ctx,setPointerCapture:noop,toBlob:f=>f(new Blob(['png']))});return els.get(id);}
 const tabs=['orbit','life','wave','fractal','walk'].map(mode=>{const t=el('tab-'+mode);t.dataset.mode=mode;return t;});
 globalThis.document={querySelector:s=>el(s.slice(1)),querySelectorAll:()=>tabs,createElement:()=>el('generated'),body:{append:noop},hidden:false,addEventListener:noop};
 globalThis.matchMedia=()=>({matches:reduced});globalThis.location={search:'',hash:'',href:'https://example.org/'};globalThis.history={replaceState:noop};globalThis.addEventListener=noop;globalThis.devicePixelRatio=1;
 globalThis.requestAnimationFrame=cb=>{frames.set(++frameId,cb);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 globalThis.IntersectionObserver=class{observe(){}};globalThis.ResizeObserver=class{constructor(cb){resize=cb;}observe(){}};
 await import('../app.js?orbit-launch-test='+instance++);
 return {el,frames,key:(key,extra={})=>el('canvas').handlers.keydown({key,preventDefault(){},...extra}),planets:()=>arcs.filter(a=>Math.abs(a.r-4.5/(Math.min(width,height)/450))<1e-8),resize:(w,h)=>{width=w;height=h;resize();}};
}

test('keyboard chooses a visible paused launch position without adding planets or advancing time',async()=>{
 const h=await setup();assert.equal(h.frames.size,1);
 const initial=h.el('metrics').textContent;
 h.key('ArrowLeft');h.key('ArrowUp');
 assert.equal(h.frames.size,0);assert.equal(h.el('metrics').textContent,initial);
 assert.match(h.el('orbit-position').textContent,/x 135.0，y -5.0/);
 assert.match(h.el('announcement').textContent,/已暂停；发射位置/);
 h.key('ArrowDown');h.key('ArrowRight');h.key('Home');
 assert.match(h.el('orbit-position').textContent,/x 140.0，y 0.0/);
 for(let i=0;i<200;i++){h.key('ArrowRight');h.key('ArrowDown');}
 assert.match(h.el('orbit-position').textContent,/x 289.1，y 188.0/);
 h.resize(284,240);assert.match(h.el('orbit-position').textContent,/x 202.5，y 161.3/);
 h.key('Home');assert.match(h.el('orbit-position').textContent,/x 140.0，y 0.0/);
});
test('Enter and Space launch one planet, held keys do not repeat, and the cap is preserved',async()=>{
 const h=await setup();h.key('Enter');assert.match(h.el('metrics').textContent,/4 颗行星/);
 assert.equal(h.frames.size,0);assert.match(h.el('announcement').textContent,/已添加第 4 颗/);
 h.key('Enter',{repeat:true});h.key(' ',{repeat:true});assert.match(h.el('metrics').textContent,/4 颗行星/);
 h.key(' ');assert.match(h.el('metrics').textContent,/5 颗行星/);
 for(let i=0;i<25;i++)h.key('Enter');assert.match(h.el('metrics').textContent,/24 颗行星/);
 assert.match(h.el('announcement').textContent,/最多放入 24/);assert.match(h.el('orbit-launch-note').textContent,/24 颗上限/);
 h.el('reset').handlers.click();assert.match(h.el('metrics').textContent,/3 颗行星/);
 assert.match(h.el('orbit-position').textContent,/x 140.0，y 0.0/);assert.equal(h.frames.size,0);
});
test('inside-star placement stays visible, gives a correction, and never creates a planet',async()=>{
 const h=await setup(true);for(let i=0;i<28;i++)h.key('ArrowLeft');
 assert.match(h.el('orbit-speed').textContent,/离中心太近/);
 h.key('Enter');assert.match(h.el('metrics').textContent,/3 颗行星/);assert.match(h.el('announcement').textContent,/至少 22/);
 for(let i=0;i<5;i++)h.key('ArrowRight');h.key(' ');assert.match(h.el('metrics').textContent,/4 颗行星/);
 assert.equal(h.frames.size,0);
});
test('pointer and keyboard share launch coordinates and velocity without changing existing bodies',async()=>{
 const h=await setup(true);h.el('speed').handlers.input({target:{value:'65'}});
 assert.match(h.el('orbit-speed').textContent,/15.5.*23.9 × 65%/);
 const initial=h.planets();h.key('Enter');assert.deepEqual(h.planets().slice(0,3),initial);
 assert.deepEqual(h.planets().at(-1),{x:140,y:0,r:4.5/(414/450)});
 h.el('canvas').handlers.click({clientX:300+140*414/450,clientY:207});
 assert.match(h.el('metrics').textContent,/5 颗行星/);assert.equal(h.frames.size,0);
 h.el('step').handlers.click();const after=h.planets();assert.deepEqual(after[3],after[4]);
 assert.ok(after[3].y>1.5&&after[3].y<1.6,'both bodies receive the previewed tangential speed');
 const beforeSlider=h.planets();h.el('speed').handlers.input({target:{value:'150'}});
 assert.deepEqual(h.planets(),beforeSlider,'changing launch speed never teleports existing planets');
 h.el('pause').handlers.click();h.el('canvas').handlers.click({clientX:100,clientY:200});
 assert.equal(h.frames.size,1,'pointer launch preserves the existing running state');
});
test('modified keys and unrelated keys remain available; mode changes hide and retain the launcher',async()=>{
 const h=await setup();const before=h.el('orbit-position').textContent;
 for(const key of ['ArrowLeft','ArrowRight','Home','Enter',' '])for(const modifier of ['altKey','ctrlKey','metaKey','shiftKey'])h.key(key,{[modifier]:true,preventDefault(){assert.fail('modified shortcut intercepted');}});
 h.key('Tab',{preventDefault(){assert.fail('Tab intercepted');}});
 assert.equal(h.frames.size,1);assert.equal(h.el('orbit-position').textContent,before);assert.match(h.el('metrics').textContent,/3 颗行星/);
 h.key('ArrowDown');
 for(const mode of ['life','wave','fractal','walk']){h.el('tab-'+mode).handlers.click();assert.equal(h.el('orbit-launch').hidden,true);h.el('step').handlers.click();}
 h.el('tab-orbit').handlers.click();assert.equal(h.el('orbit-launch').hidden,false);assert.match(h.el('orbit-position').textContent,/x 140.0，y 5.0/);
 assert.equal(h.frames.size,0);
});
test('launcher is a quiet labeled reading with direction, units and keyboard guidance',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const panel=html.match(/<section id="orbit-launch".*?<\/section>/s)?.[0];assert.ok(panel);
 assert.match(panel,/aria-labelledby="orbit-launch-title"/);assert.doesNotMatch(panel,/aria-live|role="status"|<button/);
 for(const id of ['position','speed','launch-note'])assert.ok(panel.includes('id="orbit-'+id+'"'));
 assert.match(panel,/方向键每次移动 5/);assert.match(panel,/Enter 或空格/);assert.match(panel,/模型单位/);
});
