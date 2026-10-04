import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const state=h=>({metrics:h.el('metrics').textContent,status:h.el('status').textContent,readings:['observation-a','observation-b','observation-c','orbit-position','orbit-recall-status','walk-step-reading','mission-result','notes-count','saved-observation-reading','observation-undo-status'].map(id=>h.el(id).textContent),url:location.href,writes:h.writes(),notes:h.el('field-notes-list').innerHTML});
function strictArcs(h){
 const ctx=h.el('canvas').getContext('2d'),arc=ctx.arc;
 ctx.arc=(...args)=>{
  // Canvas checks nonfinite inputs before the radius, then rejects negatives.
  if(args.slice(0,5).some(value=>!Number.isFinite(value)))return;
  if(args[2]<0)throw new DOMException('The radius provided is negative','IndexSizeError');
  return arc(...args);
 };
}
for(const mode of ['orbit','walk'])test(`${mode}: unusable layouts do not throw, advance or discard paused work`,async()=>{
 const h=await setup('?experiment='+mode,'#canvas');strictArcs(h);
 if(mode==='orbit'){click(h,'orbit-fire');click(h,'step');}
 else{click(h,'walk-64');await click(h,'share');click(h,'walk-step-one');click(h,'observation-return');}
 h.el('canvas').focus();const before=state(h),picture=h.drawing();
 for(const [width,height] of [[0,0],[0,414],[600,0],[20,20],[mode==='orbit'?68:48,414],[600,mode==='orbit'?68:76]]){
  assert.doesNotThrow(()=>h.resize(width,height),`${width} × ${height}`);
  assert.deepEqual(state(h),before);assert.equal(h.frames.size,0);assert.equal(document.activeElement,h.el('canvas'));
  assert.equal(h.el(mode+'-scale-reading').textContent,'');
  assert.ok(!h.drawing().some(mark=>mark[0]==='arc'),'no model geometry is painted without a positive scale');
  h.resize(600,414);assert.deepEqual(state(h),before);assert.deepEqual(h.drawing(),picture);
 }
 if(mode==='orbit'){click(h,'orbit-recall');assert.match(h.el('metrics').textContent,/3 颗行星/);}
 else{click(h,'observation-undo');assert.match(h.el('metrics').textContent,/65 步/);}
});
for(const mode of ['orbit','walk'])test(`${mode}: small-layout frames cannot strand a running animation chain`,async()=>{
 const h=await setup('?experiment='+mode,'#canvas',false);strictArcs(h);h.tick(0);h.tick(50);
 h.resize(20,20);
 for(const now of [100,150,200]){assert.doesNotThrow(()=>h.tick(now));assert.equal(h.frames.size,1);}
 assert.equal(h.el('status').textContent,'运行中');const advanced=h.el('metrics').textContent;
 h.resize(600,414);assert.equal(h.el('metrics').textContent,advanced);assert.equal(h.frames.size,1);
 for(const now of [250,300,350,400])h.tick(now);
 assert.notEqual(h.el('metrics').textContent,advanced,'normal simulation continues after reflow');
 click(h,'pause');assert.equal(h.frames.size,0);
});
for(const mode of ['orbit','walk'])test(`${mode}: visibility, density and context recovery remain independent of collapsed layout`,async()=>{
 const h=await setup('?experiment='+mode,'',false);strictArcs(h);h.tick(0);h.tick(50);
 h.setVisible(false);h.resize(0,0);assert.equal(h.frames.size,0);const hidden=state(h);
 h.setDpr(2);h.loseContext();h.restoreContext();assert.deepEqual(state(h),hidden);assert.equal(h.frames.size,0);
 h.resize(600,414);assert.equal(h.frames.size,0);h.setVisible(true);assert.equal(h.frames.size,1);
 h.tick(90000);assert.deepEqual(state(h),hidden,'no missing-time fast-forward');
 h.setHidden(true);h.resize(20,20);h.resize(600,414);assert.equal(h.frames.size,0);
 h.setHidden(false);assert.equal(h.frames.size,1);h.motion.change({matches:true});assert.equal(h.frames.size,0);
 h.resize(20,20);h.resize(600,414);assert.equal(h.frames.size,0);
});
for(const mode of ['orbit','walk'])test(`${mode}: manual steps in a collapsed view retain accurate readings and deterministic restoration`,async()=>{
 const h=await setup('?experiment='+mode);strictArcs(h);const url=location.href;
 h.resize(20,20);click(h,'step');click(h,'step');
 assert.equal(h.frames.size,0);assert.equal(location.href,url);
 assert.match(h.el('metrics').textContent,mode==='orbit'?/t \+ 0\.2 s/:/48 步/);
 const current=state(h);h.resize(600,414);assert.deepEqual(state(h),current);
 const picture=h.drawing();
 const reference=await setup('?experiment='+mode);click(reference,'step');click(reference,'step');
 assert.deepEqual(h.drawing(),picture);assert.deepEqual(reference.drawing(),picture,'two steps reconstruct the same normal-layout drawing');
});
test('valid small and fractional layouts keep model rendering and ruler output',async()=>{
 for(const mode of ['orbit','walk'])for(const [width,height] of [[80,90],[259,240],[455.5,281.75],[600,414]]){
  const h=await setup('?experiment='+mode);strictArcs(h);h.resize(width,height);
  assert.ok(h.drawing().some(mark=>mark[0]==='arc'),mode);assert.match(h.el(mode+'-scale-reading').textContent,/左下标尺/);
 }
});
test('the updated renderer has its own cache key',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/app\.js\?v=saved-observation-copy-1&amp;walk-text=stable-1&amp;cell-position=exact-1&amp;repeat=stable-evidence-1&amp;feedback=parameter-action-1&amp;drag-feedback=meaningful-action-1&amp;render=positive-scale-1/);
});
