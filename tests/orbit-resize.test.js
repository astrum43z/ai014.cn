import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';
import {clampOrbitPoint} from '../orbit.js';
import {createOrbitPreview} from '../orbit-preview.js';

const click=(h,id)=>h.el(id).handlers.click();
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
const scale=h=>h.drawing().find(command=>command[0]==='scale')[1];
const reading=h=>h.el('orbit-touch-reading').textContent;
function launcher(h){
 const s=scale(h),arc=h.drawing().find(command=>command[0]==='arc'&&Math.abs(command[3]-8/s)<1e-8);
 assert.ok(arc,'launcher is drawn at the current scale');
 return {x:arc[1],y:arc[2]};
}
function planets(h){
 const s=scale(h);
 return h.drawing().filter(command=>command[0]==='arc'&&Math.abs(command[3]-4.5/s)<1e-8).map(([,x,y])=>({x,y}));
}
function visible(h,width,height){
 const p=launcher(h),s=scale(h);
 assert.ok(Math.abs(p.x)*s+34<=width/2+1e-8,'marker and direction arrow fit horizontally');
 assert.ok(Math.abs(p.y)*s+34<=height/2+1e-8,'marker and direction arrow fit vertically');
}
function selectWidePoint(h){
 for(let i=0;i<28;i++)click(h,'orbit-right');
 for(let i=0;i<30;i++)click(h,'orbit-up');
 assert.deepEqual(launcher(h),{x:280,y:-150});
}

test('resizing fits a paused launch without changing position, speed, preview, bodies or time',async()=>{
 const h=await setup('?experiment=orbit');selectWidePoint(h);
 const before={reading:reading(h),preview:h.el('orbit-preview-reading').textContent,metrics:h.el('metrics').textContent,planets:planets(h),url:location.href,writes:h.writes(),message:h.el('announcement').textContent};
 h.el('orbit-right').focus();
 for(const [width,height] of [[259,414],[295,240],[600,240],[240,600],[600,414]]){
  h.resize(width,height);visible(h,width,height);
  assert.equal(reading(h),before.reading);assert.equal(h.el('orbit-preview-reading').textContent,before.preview);
  assert.equal(h.el('metrics').textContent,before.metrics);assert.deepEqual(planets(h),before.planets);
  assert.equal(location.href,before.url);assert.equal(h.writes(),before.writes);assert.equal(h.frames.size,0);
  assert.equal(h.el('announcement').textContent,before.message);assert.equal(document.activeElement,h.el('orbit-right'));
 }
});

test('a running world and a hidden-world resize preserve the selected launch and stored view',async()=>{
 const h=await setup('?experiment=orbit');selectWidePoint(h);click(h,'pause');
 h.tick(0);h.tick(50);const before=reading(h),metrics=h.el('metrics').textContent,url=location.href,initial=planets(h);
 h.resize(259,414);visible(h,259,414);assert.equal(h.frames.size,1);assert.equal(reading(h),before);
 assert.equal(h.el('metrics').textContent,metrics);assert.deepEqual(planets(h),initial);assert.equal(location.href,url);
 h.tabs[2].handlers.click();h.resize(240,600);h.tabs[0].handlers.click();
 visible(h,240,600);assert.equal(reading(h),before);assert.equal(h.frames.size,1);
 assert.equal(h.el('metrics').textContent,metrics);assert.deepEqual(planets(h),initial);assert.equal(location.href,url);
 click(h,'pause');assert.equal(h.frames.size,0);
 const fitted=scale(h);click(h,'orbit-left');const moved=reading(h);
 h.tabs[1].handlers.click();h.tabs[0].handlers.click();
 assert.equal(reading(h),moved);assert.equal(scale(h),fitted,'tab round trip retains the wider selected view');
});

test('all pointer-selected quadrants retain exact coordinates and readable launch arrows on resize',async()=>{
 for(const [clientX,clientY] of [[575,25],[25,25],[25,389],[575,389]]){
  const h=await setup('?experiment=orbit');h.el('canvas').handlers.click({clientX,clientY});
  const point=launcher(h),before=reading(h),preview=h.el('orbit-preview-reading').textContent;
  for(const [width,height] of [[259,414],[600,240],[284.5,260.25]]){
   h.resize(width,height);visible(h,width,height);assert.deepEqual(launcher(h),point);
   assert.equal(reading(h),before);assert.equal(h.el('orbit-preview-reading').textContent,preview);
  }
 }
});

test('positioning uses a stable fitted view and the same five-unit keyboard/button bounds',async()=>{
 const h=await setup('?experiment=orbit');selectWidePoint(h);h.resize(259,414);const fitted=scale(h);
 click(h,'orbit-left');assert.deepEqual(launcher(h),{x:275,y:-150});
 h.key('ArrowDown');assert.deepEqual(launcher(h),{x:275,y:-145});assert.equal(scale(h),fitted);
 for(let i=0;i<200;i++){click(h,'orbit-right');click(h,'orbit-down');}
 const boundary=launcher(h);near(boundary.x,280);visible(h,259,414);assert.equal(scale(h),fitted);
 for(let i=0;i<10;i++){h.key('ArrowRight');h.key('ArrowDown');}
 assert.deepEqual(launcher(h),boundary);assert.equal(scale(h),fitted,'repeated movement cannot grow the view');
 near(clampOrbitPoint({x:1e6,y:1e6},259,414,fitted).x,boundary.x);
 near(clampOrbitPoint({x:1e6,y:1e6},259,414,fitted).y,boundary.y);
});

test('pointer launches use the displayed fitted scale and match the explicit launch after resizing',async()=>{
 const h=await setup('?experiment=orbit');selectWidePoint(h);h.resize(259,414);
 const s=scale(h),before=planets(h),point={x:280,y:-150};
 click(h,'orbit-fire');assert.deepEqual(planets(h).slice(0,3),before);assert.deepEqual(planets(h).at(-1),point);
 h.el('canvas').handlers.click({clientX:259/2+point.x*s,clientY:414/2+point.y*s});
 near(launcher(h).x,point.x);near(launcher(h).y,point.y);
 const expected=createOrbitPreview()(point,80000,100);
 for(let n=0;n<100;n++)click(h,'step');
 const bodies=planets(h);for(const body of bodies.slice(-2)){near(body.x,expected.end.x);near(body.y,expected.end.y);}
 assert.match(h.el('metrics').textContent,/5 颗行星 · t \+ 10.0 s/);assert.equal(h.frames.size,0);
});

test('Home, reset, presets, guides and changed URL settings release the expanded view',async()=>{
 const h=await setup('?experiment=orbit');
 for(const release of [()=>click(h,'orbit-home'),()=>h.key('Home'),()=>click(h,'reset'),()=>h.el('preset-select').handlers.change({target:{value:'elliptic'}}),()=>click(h,'guide-start'),()=>h.navigate('?experiment=orbit&gravity=40&speed=65')]){
  h.resize(600,414);click(h,'orbit-home');selectWidePoint(h);h.resize(259,414);
  assert.ok(scale(h)<259/450);release();
  near(scale(h),259/450);assert.deepEqual(launcher(h),{x:140,y:0});
  visible(h,259,414);assert.equal(h.frames.size,0);
 }
});

test('invalid center and the planet cap retain their semantics after resizing',async()=>{
 const h=await setup('?experiment=orbit');
 for(let i=0;i<28;i++)click(h,'orbit-left');h.resize(259,414);
 assert.deepEqual(launcher(h),{x:0,y:0});assert.equal(h.el('orbit-fire').getAttribute('aria-disabled'),'true');
 click(h,'orbit-fire');assert.match(h.el('metrics').textContent,/3 颗行星/);
 click(h,'orbit-home');h.resize(600,414);selectWidePoint(h);
 for(let i=0;i<24;i++)click(h,'orbit-fire');h.resize(259,414);
 visible(h,259,414);assert.equal(h.el('orbit-fire').getAttribute('aria-disabled'),'true');
 assert.equal(h.el('orbit-preview-reading').hidden,true);assert.match(h.el('metrics').textContent,/24 颗行星/);
 click(h,'reset');assert.equal(h.el('orbit-fire').getAttribute('aria-disabled'),'false');
});
