import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
import {readObservation} from '../observation.js';

const click=(h,id)=>h.el(id).handlers.click();
const text=(h,id)=>h.el(id).textContent;
const saved=h=>text(h,'saved-observation-reading');
const undo=h=>text(h,'observation-undo-status');
const position=(h,x,y)=>{
 for(const [id,value] of [['wave-target-x',x],['wave-target-y',y]]){h.el(id).value=String(value);h.el(id).handlers.input({target:h.el(id)});}
 click(h,'wave-position');
};
const summary=(x,y,time)=>`探针 x ${x}，y ${y} · t ${time} s`;
const checkpoint=(x,y,time)=>`?experiment=wave&at=v1,${x},${y},${time}`;

test('saved Wave coordinates and time describe the exact imported observation',async()=>{
 const h=await setup(checkpoint(13.75,-7.125,0.004));
 assert.equal(saved(h),'链接中的观测：探针 x 13.75，y -7.125 · t 0.004 s');
 assert.equal(text(h,'wave-position-current'),'当前探针 · x 13.75，y -7.125');
 assert.equal(h.el('share-link').hidden,true);assert.equal(h.frames.size,0);
});

for(const [x,y,time] of [[0,0,0],[1e-20,-1e-20,1e-20],[5e-324,-5e-324,5e-324],[9999.999999999998,-9999.999999999998,999999999.9999999],[10000,-10000,1e9]]){
 test(`Wave checkpoint summary round-trips ${x}, ${y}, ${time}`,async()=>{
  const h=await setup(checkpoint(x,y,time));
  assert.equal(saved(h),'链接中的观测：'+summary(x,y,time));
  const match=saved(h).match(/x (.+)，y (.+) · t (.+) s$/);
  assert.deepEqual(match.slice(1).map(Number),[x,y,time]);
 });
}

test('distinct nearby saved coordinates and times never collapse into the same summary',async()=>{
 const h=await setup(checkpoint(13.75,-7.125,0.003)),a=saved(h);
 h.navigate(checkpoint(13.76,-7.124,0.003));const b=saved(h);
 h.navigate(checkpoint(13.76,-7.124,0.004));const c=saved(h);
 assert.equal(new Set([a,b,c]).size,3);
 assert.equal(c,'链接中的观测：'+summary(13.76,-7.124,0.004));
});

test('return and undo distinguish nearby fractional destinations and restore exact drawings',async()=>{
 const h=await setup(checkpoint(13.75,-7.125,0.004)),original=h.drawing(),url=location.href;
 position(h,13.76,-7.124);const later=h.drawing();assert.notDeepEqual(later,original);
 click(h,'observation-return');assert.deepEqual(h.drawing(),original);
 assert.equal(undo(h),'可撤销：返回前的探针 x 13.76，y -7.124 · t 0.004 s。');
 assert.equal(saved(h),'链接中的观测：'+summary(13.75,-7.125,0.004));
 click(h,'observation-return');assert.equal(undo(h),'可撤销：返回前的'+summary(13.76,-7.124,0.004)+'。');
 h.el('observation-undo').focus();click(h,'observation-undo');assert.deepEqual(h.drawing(),later);
 assert.equal(document.activeElement,h.el('observation-undo'));assert.equal(location.href,url);
 assert.equal(h.el('wave-target-x').value,'13.76');assert.equal(undo(h),'暂无可撤销的返回。');
});

test('sharing an advanced phase describes exactly the serialized model time',async()=>{
 const h=await setup(checkpoint(13.75,-7.125,0.004));click(h,'step');const before=h.drawing();
 await click(h,'share');const observation=readObservation(location.search,'wave');
 assert.equal(observation.time,0.004+Math.PI/6);assert.equal(saved(h),'链接中的观测：'+summary(13.75,-7.125,observation.time));
 assert.deepEqual(h.drawing(),before);const link=location.href;click(h,'step');assert.equal(location.href,link);
 assert.equal(saved(h),'链接中的观测：'+summary(13.75,-7.125,observation.time));
 click(h,'observation-return');assert.deepEqual(h.drawing(),before);
 assert.equal(undo(h),'可撤销：返回前的'+summary(13.75,-7.125,observation.time+Math.PI/6)+'。');
});

test('sub-centisecond progress remains distinct from the checkpoint in the recovery description',async()=>{
 const h=await setup(checkpoint(0,0,0.003));click(h,'pause');h.tick(0);h.tick(1);click(h,'pause');const before=h.drawing();
 click(h,'observation-return');assert.equal(saved(h),'链接中的观测：'+summary(0,0,0.003));
 assert.equal(undo(h),'可撤销：返回前的'+summary(0,0,0.004)+'。');
 click(h,'observation-undo');assert.deepEqual(h.drawing(),before);
});

test('recovery beyond share bounds stays accurate and a refused new share preserves it',async()=>{
 const h=await setup(checkpoint(10000,-10000,1e9));click(h,'wave-right');click(h,'step');const before=h.drawing();
 click(h,'observation-return');assert.equal(undo(h),'可撤销：返回前的'+summary(10002,-10000,1e9+Math.PI/6)+'。');
 click(h,'step');await click(h,'share');assert.match(text(h,'share-status'),/超出链接可保存/);
 assert.equal(undo(h),'可撤销：返回前的'+summary(10002,-10000,1e9+Math.PI/6)+'。');
 click(h,'observation-undo');assert.deepEqual(h.drawing(),before);
});

test('fixed summaries remain quiet while the current model animates and redraws',async()=>{
 const h=await setup(checkpoint(13.75,-7.125,0.004));position(h,13.76,-7.124);click(h,'observation-return');
 const counts={};for(const id of ['saved-observation-reading','observation-undo-status']){
  const element=h.el(id);let value=element.textContent;counts[id]=0;
  Object.defineProperty(element,'textContent',{get:()=>value,set:next=>{counts[id]++;value=next;},configurable:true});
 }
 click(h,'pause');const message=text(h,'announcement'),fixed=saved(h),recovery=undo(h),url=location.href;
 h.tick(0);h.tick(50);h.tick(100);h.resize(233,240);h.setDpr(2);h.loseContext();h.restoreContext();
 assert.equal(saved(h),fixed);assert.equal(undo(h),recovery);assert.deepEqual(counts,{'saved-observation-reading':0,'observation-undo-status':0});
 assert.equal(text(h,'announcement'),message);assert.equal(location.href,url);assert.equal(h.frames.size,1);
});

test('retained worlds and history keep each fixed destination and its recovery separate',async()=>{
 const h=await setup(checkpoint(13.75,-7.125,0.004));position(h,13.76,-7.124);click(h,'observation-return');const wave=[saved(h),undo(h)];
 click(h,'tab-fractal');await click(h,'share');click(h,'fractal-forward');click(h,'observation-return');assert.equal(saved(h),'链接中的观测：300 点');assert.equal(undo(h),'可撤销：返回前的301 点。');
 click(h,'tab-walk');await click(h,'share');click(h,'walk-step-one');click(h,'observation-return');assert.equal(saved(h),'链接中的观测：16 步');assert.equal(undo(h),'可撤销：返回前的17 步。');
 click(h,'tab-wave');assert.deepEqual([saved(h),undo(h)],wave);h.navigate(location.search+'#canvas');assert.deepEqual([saved(h),undo(h)],wave);
 h.navigate(checkpoint(13.77,-7.123,0.006));assert.equal(saved(h),'链接中的观测：'+summary(13.77,-7.123,0.006));assert.equal(undo(h),'暂无可撤销的返回。');
 h.el('wavelength').handlers.input({target:{value:'33'}});assert.equal(h.el('saved-observation').hidden,true);assert.equal(saved(h),'');
});

test('invalid and parameter-only observations remain hidden without a misleading summary',async()=>{
 for(const query of ['?experiment=wave','?experiment=life','?experiment=orbit',checkpoint(0,0,-1),checkpoint('NaN',0,0),checkpoint(10001,0,0)]){
  const h=await setup(query);assert.equal(saved(h),'');assert.equal(h.el('saved-observation').hidden,true);
 }
});

test('precise descriptions retain quiet control associations and wrapping for long numbers',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 for(const id of ['saved-observation-reading','observation-undo-status'])assert.match(html,new RegExp(`<p id="${id}" aria-live="off">`));
 assert.match(html,/<button id="observation-return"[^>]*aria-describedby="saved-observation-reading observation-return-help"/);
 assert.match(html,/<button id="observation-undo"[^>]*aria-describedby="observation-undo-status observation-undo-help"/);
 assert.match(css,/\.saved-observation\{[^}]*min-width:0/);assert.match(css,/\.saved-observation p\{[^}]*overflow-wrap:anywhere/);
});
