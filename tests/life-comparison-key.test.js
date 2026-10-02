import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
// Native Enter activates the focused button on keydown, including repeats.
// Re-read focus each time: Compare transfers it to Return, then to the canvas.
function enter(repeat=false){
 const target=document.activeElement;let prevented=false;
 target.handlers.keydown?.({key:'Enter',repeat,preventDefault(){prevented=true;}});
 if(!prevented&&!target.disabled)target.handlers.click?.();
 return prevented;
}
const snapshot=h=>({
 metrics:h.el('metrics').textContent,result:h.el('life-test-result').textContent,
 solved:h.el('life-test-result').getAttribute('data-solved'),
 returnHidden:h.el('life-return').hidden,helpHidden:h.el('life-return-help').hidden,
 selection:h.el('life-selection').textContent,history:h.el('history-caption').textContent,
 announcement:h.el('announcement').textContent,focus:document.activeElement?.id,
 status:h.el('status').textContent,frames:h.frames.size,draws:h.drawCount(),
 url:location.href,writes:h.writes(),notes:h.el('field-notes-list').innerHTML,
 mission:h.el('mission-state').textContent,steps:h.el('mission-steps').innerHTML
});
function compare(h){h.el('life-test').focus();assert.equal(enter(),false);assert.equal(document.activeElement.id,'life-return');}
function retainHeldComparison(h){
 const after=snapshot(h),drawing=h.drawing();
 for(let i=0;i<12;i++)assert.equal(enter(true),true,'cancel native repeated activation after focus transfers');
 assert.deepEqual(snapshot(h),after);assert.deepEqual(h.drawing(),drawing);
}

test('held Compare Enter preserves both failed and successful results until a fresh Return press',async()=>{
 for(const solved of [false,true]){
  const h=await setup('?experiment=life');click(h,'life-challenge-start');
  const actions=solved?['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle']:['life-toggle','life-right','life-toggle','life-right','life-toggle','life-right','life-toggle'];
  for(const id of actions)click(h,id);
  const original={metrics:h.el('metrics').textContent,selection:h.el('life-selection').textContent,history:h.el('history-caption').textContent};
  compare(h);assert.equal(h.el('life-test-result').getAttribute('data-solved'),String(solved));
  assert.match(h.el('metrics').textContent,solved?/第 1 代 · 4 个活格子/:/第 1 代 · 6 个活格子/);
  retainHeldComparison(h);
  assert.equal(enter(),false,'release and press again intentionally returns');
  assert.equal(document.activeElement.id,'canvas');assert.equal(h.el('life-return').hidden,true);
  assert.deepEqual({metrics:h.el('metrics').textContent,selection:h.el('life-selection').textContent,history:h.el('history-caption').textContent},original);
  const returned=snapshot(h);for(let i=0;i<8;i++)assert.equal(enter(true),true);
  assert.deepEqual(snapshot(h),returned,'held Return must not edit the now-focused canvas');
  compare(h);retainHeldComparison(h);
 }
});

test('comparison entered from a running model remains paused once at different rates',async()=>{
 for(const rate of [1,8,20]){
  const h=await setup('?experiment=life&rate='+rate,'#instruments',false);
  assert.equal(h.frames.size,1);compare(h);
  assert.match(h.el('metrics').textContent,/第 1 代/);assert.equal(h.frames.size,0);
  assert.equal(h.el('status').textContent,'已暂停');retainHeldComparison(h);
  enter();assert.equal(h.frames.size,0);assert.match(h.el('metrics').textContent,/第 0 代/);
 }
});

test('tab, anchor, resize and clear recovery retain a comparison without stale key state',async()=>{
 const h=await setup('?experiment=life');compare(h);
 const result=h.el('life-test-result').textContent;
 click(h,'tab-wave');click(h,'tab-life');
 h.navigate(location.search+'#canvas');h.resize(360,414);
 click(h,'clear');click(h,'life-undo-clear');
 assert.equal(h.el('life-test-result').textContent,result);assert.equal(h.el('life-return').hidden,false);
 h.el('life-return').focus();retainHeldComparison(h);
 enter();assert.equal(h.el('life-return').hidden,true);
 compare(h);retainHeldComparison(h);
});

test('fresh clicks and Space retain native behavior; other keys are not intercepted',async()=>{
 const h=await setup('?experiment=life');compare(h);
 for(const key of [' ','Tab','Escape','ArrowRight'])for(const repeat of [false,true]){
  let prevented=false;const before=snapshot(h);
  h.el('life-return').handlers.keydown?.({key,repeat,preventDefault(){prevented=true;}});
  assert.equal(prevented,false);assert.deepEqual(snapshot(h),before);
 }
 click(h,'life-return');assert.equal(h.el('life-return').hidden,true);
 compare(h);
 // Space's native keyup click and pointer/assistive clicks keep the same handler.
 click(h,'life-return');assert.equal(document.activeElement.id,'canvas');
 compare(h);assert.equal(enter(),false);assert.equal(h.el('life-return').hidden,true);
});

test('a guarded repeat does not affect discovery progress, notes or parameter sharing',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');
 for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 await click(h,'share');const link=h.el('share-link').value;
 compare(h);retainHeldComparison(h);
 assert.equal(h.el('passport-count').textContent,'本次发现 0 / 5');
 assert.equal(h.el('share-link').value,link);assert.equal(h.el('share-link').hidden,false);
 enter();click(h,'mission-check');assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');
});
