import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as model from '../walk.js';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const reading=h=>h.el('walk-occupancy-reading').textContent;
// An independent sorted run count, not the implementation's keyed map.
function expected(walk){
 const points=Array.from({length:256},(_,i)=>[walk.positions[2*i],walk.positions[2*i+1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 let sites=0,maximum=0,run=0,previous=null;
 for(const point of points){
  if(previous&&point[0]===previous[0]&&point[1]===previous[1])run++;
  else{sites++;run=1;}
  maximum=Math.max(maximum,run);previous=point;
 }
 return {sites,maximum};
}
function check(h,steps,seed=14,bias=0){
 const walk=model.advanceWalk(model.createWalk(seed,bias),steps),counts=expected(walk);
 assert.equal(reading(h),`256 位漫步者 · 占据 ${counts.sites} 个格点 · 单格最多 ${counts.maximum} 位。多个漫步者可重合；按模型位置计数，不是屏幕上可分辨的点数。`);
 assert.match(h.el('metrics').textContent,new RegExp(`^256 位漫步者 · ${steps} 步 · 偏向 ${bias}%$`));
 return counts;
}

test('occupied model sites and maximum multiplicity match an independent count for all supported seeds',()=>{
 for(let seed=1;seed<=99;seed++)for(const bias of [0,1,7,25]){
  const walk=model.createWalk(seed,bias);
  for(const steps of [0,16,17,64,127,511,512]){
   model.advanceWalk(walk,steps-walk.steps);
   assert.deepEqual(model.walkOccupancy(walk),expected(walk),`${seed}/${bias}/${steps}`);
  }
 }
 for(const [steps,seed,bias,sites,maximum] of [[16,14,0,79,15],[64,14,0,148,9],[512,14,0,230,3],[64,14,25,154,7],[16,50,0,76,10]]){
  assert.deepEqual(model.walkOccupancy(model.advanceWalk(model.createWalk(seed,bias),steps)),{sites,maximum});
 }
});

test('coincident, distinct, negative and easily confused coordinate pairs remain exact and nonmutating',()=>{
 const walk=model.createWalk(14);
 assert.deepEqual(model.walkOccupancy(walk),{sites:1,maximum:256});
 for(let i=0;i<256;i++){walk.positions[2*i]=i-128;walk.positions[2*i+1]=128-i;}
 assert.deepEqual(model.walkOccupancy(walk),{sites:256,maximum:1});
 for(let i=0;i<256;i++){
  const point=[[1,23],[12,3],[-1,23],[1,-23]][i%4];walk.positions.set(point,i*2);
 }
 const before=structuredClone(walk);
 for(let i=0;i<10;i++)assert.deepEqual(model.walkOccupancy(walk),{sites:4,maximum:64});
 assert.deepEqual(walk,before,'reading cannot move walkers, consume randomness or alter the recorded path');
});

test('reads leave the seeded path, ensemble, next random draw and batching unchanged',()=>{
 const a=model.createWalk(42,25),b=model.createWalk(42,25);
 for(let i=0;i<512;i++){
  model.advanceWalk(a,1);model.walkOccupancy(a);
 }
 model.advanceWalk(b,512);assert.deepEqual(a,b);
 const saved=structuredClone(a);model.walkOccupancy(a);model.advanceWalk(a,16);assert.deepEqual(a,saved);
});

test('the default crowded cloud is explained and counts follow comparison, replay, batches and limits',async()=>{
 const h=await setup('?experiment=walk');assert.deepEqual(check(h,16),{sites:79,maximum:15});const first=h.drawing();
 click(h,'walk-back');check(h,16);assert.deepEqual(h.drawing(),first);
 click(h,'walk-step-one');check(h,17);click(h,'walk-back');check(h,16);assert.deepEqual(h.drawing(),first);
 click(h,'walk-64');check(h,64);h.key('ArrowRight');check(h,80);click(h,'step');check(h,96);h.key('Home');check(h,16);
 h.navigate('?experiment=walk&bias=25&seed=42&at=v1,511');check(h,511,42,25);
 click(h,'walk-step-one');check(h,512,42,25);const last=h.drawing(),text=reading(h);
 for(const id of ['walk-step-one','step','pause']){click(h,id);assert.equal(reading(h),text);assert.equal(h.frames.size,0);}
 click(h,'walk-back');check(h,511,42,25);click(h,'walk-step-one');check(h,512,42,25);assert.deepEqual(h.drawing(),last);
});

test('parameters, resets, named presets and guided starts count their own new ensemble',async()=>{
 const h=await setup('?experiment=walk&bias=25&seed=99&at=v1,73');check(h,73,99,25);
 input(h,'seed',50);check(h,16,50,25);input(h,'bias',0);check(h,16,50,0);
 click(h,'walk-64');click(h,'reset');check(h,16,50,0);
 h.el('preset-select').handlers.change({target:{value:'another'}});click(h,'load-preset');check(h,16,51,0);
 h.el('preset-select').handlers.change({target:{value:'drift'}});click(h,'load-preset');check(h,16,51,25);
 click(h,'guide-start');check(h,16);assert.equal(h.frames.size,0);
});

test('running updates are quiet and unchanged redraws preserve the reading text node',async()=>{
 const h=await setup('?experiment=walk'),el=h.el('walk-occupancy-reading');check(h,16);
 let value=el.textContent,writes=0;Object.defineProperty(el,'textContent',{get:()=>value,set:next=>{value=next;writes++;}});
 h.resize(259,240);h.resize(600,414);h.el('canvas').handlers.focus();assert.equal(writes,0);
 click(h,'pause');const message=h.el('announcement').textContent;h.tick(0);h.tick(50);assert.equal(writes,0);
 h.tick(100);check(h,20);assert.equal(writes,1);assert.equal(h.el('announcement').textContent,message);
 h.tick(150);h.tick(200);check(h,24);assert.equal(writes,2);assert.equal(h.el('announcement').textContent,message);
 h.setHidden(true);assert.equal(h.frames.size,0);h.setHidden(false);assert.equal(h.frames.size,1);
 h.motion.change({matches:true});assert.equal(h.frames.size,0);assert.equal(writes,2);
});

test('pixel density, view scale, context recovery and focus do not change model occupancy',async()=>{
 const h=await setup('?experiment=walk&bias=25&seed=42&at=v1,512');const counts=check(h,512,42,25);h.el('walk-back').focus();
 const first=h.drawing(),message=h.el('announcement').textContent;
 for(const [w,z] of [[0,0],[259,240],[334.5,260.2],[1200,900],[600,414]]){h.resize(w,z);assert.deepEqual(check(h,512,42,25),counts);}
 for(const dpr of [1.25,2,3,1]){h.setDpr(dpr);check(h,512,42,25);}
 h.loseContext();h.restoreContext();check(h,512,42,25);assert.deepEqual(h.drawing(),first);
 assert.equal(document.activeElement,h.el('walk-back'));assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,0);
});

test('retained worlds keep the same cloud while its occupancy is hidden elsewhere',async()=>{
 const h=await setup('?experiment=walk&seed=50&at=v1,65');check(h,65,50);const drawing=h.drawing(),text=reading(h);
 for(const mode of ['orbit','life','wave','fractal']){
  click(h,'tab-'+mode);assert.equal(h.el('walk-legend').hidden,true);h.resize(259,240);
  click(h,'tab-walk');assert.equal(h.el('walk-legend').hidden,false);check(h,65,50);assert.equal(reading(h),text);
 }
 h.resize(600,414);assert.deepEqual(h.drawing(),drawing);
});

test('shared checkpoints and history reconstruct occupancy without rewriting a saved observation',async()=>{
 const h=await setup('?experiment=walk&seed=42&bias=25&at=v1,73','#canvas');check(h,73,42,25);
 await click(h,'share');const saved=h.el('share-link').value;click(h,'walk-back');check(h,72,42,25);
 assert.equal(h.el('share-link').value,saved);assert.equal(location.href,saved);
 h.navigate(saved.replace('#canvas','#observation-title'));check(h,72,42,25);
 click(h,'observation-return');check(h,73,42,25);
 h.navigate('?experiment=walk&seed=1&at=v1,512');check(h,512,1);h.navigate(saved);check(h,73,42,25);
});

test('occupancy never completes a discovery or changes its stored measured evidence',async()=>{
 const h=await setup('?experiment=walk');click(h,'mission-start');check(h,16);click(h,'mission-check');
 click(h,'walk-64');check(h,64);assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const result=h.el('mission-result').textContent,notes=h.el('field-notes-list').innerHTML,text=h.el('notes-text').value;
 click(h,'walk-back');check(h,63);click(h,'walk-step-one');check(h,64);h.resize(259,240);
 assert.equal(h.el('mission-result').textContent,result);assert.equal(h.el('field-notes-list').innerHTML,notes);assert.equal(h.el('notes-text').value,text);
});

test('the existing quiet wrapping legend explains lattice positions without claiming visible-pixel counts',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const legend=html.slice(html.indexOf('<div id="walk-legend"'),html.indexOf('<div class="stage-bottom"'));
 assert.match(legend,/<small id="walk-occupancy-reading" aria-live="off"><\/small>/);
 assert.equal((html.match(/id="walk-occupancy-reading"/g)||[]).length,1);
 assert.doesNotMatch(legend,/<button|<a |tabindex|role="status"|aria-live="polite"|aria-live="assertive"/);
 assert.match(css,/#walk-scale-reading,#walk-occupancy-reading\{[^}]*flex-basis:100%[^}]*min-width:0[^}]*overflow-wrap:anywhere/);
 assert.ok(html.includes('app.js?v=canvas-pause-1'));assert.ok(html.includes('style.css?v=canvas-pause-1'));
});
