import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

function pointer(h,type,id=1,x=4,y=4,extra={}){
 h.el('canvas').handlers[type]?.({type,pointerId:id,pointerType:'mouse',detail:type==='click'?1:0,clientX:(x+.5)*600/48,clientY:(y+.5)*414/32,button:0,buttons:['pointerdown','pointermove'].includes(type)?1:0,isPrimary:true,...extra});
}
function click(h,id){h.el(id).handlers.click();}
function tap(h,id=1,x=10,y=10){for(const type of ['pointerdown','pointerup','click'])pointer(h,type,id,x,y);}
async function completedDrag(){
 const h=await setup('?experiment=life');click(h,'clear');h.el('canvas').focus();
 pointer(h,'pointerdown',1,2,4);pointer(h,'pointermove');pointer(h,'pointerup');
 assert.match(h.el('metrics').textContent,/3 个活格子/);
 return h;
}
function state(h){
 const ids=['metrics','life-selection','life-cell-state','life-test-result','life-clear-status','mission-result','announcement','status','orbit-position','wave-probe-position'];
 return {...Object.fromEntries(ids.map(id=>[id,h.el(id).textContent])),drawing:h.drawing(),history:h.el('history-line').getAttribute('points'),trialHidden:h.el('life-return').hidden,clearDisabled:h.el('life-undo-clear').getAttribute('aria-disabled'),frames:h.frames.size,href:location.href,focus:document.activeElement};
}
function delayedClickDoesNothing(h,extra={}){
 const before=state(h);pointer(h,'lostpointercapture');pointer(h,'click',1,4,4,extra);assert.deepEqual(state(h),before);
}

const commands=[
 ['move selected cell',h=>click(h,'life-right')],
 ['toggle selected cell',h=>click(h,'life-toggle')],
 ['clear drawing',h=>click(h,'clear')],
 ['undo clear',h=>{click(h,'clear');click(h,'life-undo-clear');}],
 ['reset',h=>click(h,'reset')],
 ['load preset',h=>{h.el('preset-select').handlers.change({target:{value:'blinker'}});click(h,'load-preset');}],
 ['random sow',h=>click(h,'preset')],
 ['load guide',h=>click(h,'guide-start')],
 ['start challenge',h=>click(h,'life-challenge-start')],
 ['test challenge',h=>click(h,'life-test')],
 ['return challenge',h=>{click(h,'life-test');click(h,'life-return');}],
 ['start discovery',h=>click(h,'mission-start')],
 ['check discovery',h=>click(h,'mission-check')],
 ['next generation',h=>click(h,'step')],
 ['continue',h=>click(h,'pause')],
 ['keyboard movement',h=>h.key('ArrowRight')],
 ['keyboard edit',h=>h.key('Enter')],
 ['restore address',h=>h.navigate('?experiment=life&rate=3&density=45')],
 ['repeat replacement commands',h=>{click(h,'clear');click(h,'reset');click(h,'life-right');}]
];
for(const [name,command] of commands)test(`a completed Life drag cannot click through ${name}`,async()=>{
 const h=await completedDrag();command(h);delayedClickDoesNothing(h);
 const before=h.el('metrics').textContent;tap(h);assert.notEqual(h.el('metrics').textContent,before,'a fresh same-pointer tap still edits');
});

for(const world of ['orbit','wave','fractal','walk'])test(`a completed Life drag cannot act in ${world} after switching tabs`,async()=>{
 const h=await completedDrag();click(h,'tab-'+world);delayedClickDoesNothing(h);
 click(h,'tab-life');assert.match(h.el('metrics').textContent,/3 个活格子/);tap(h);assert.match(h.el('metrics').textContent,/4 个活格子/);
});

test('suppression survives a world round trip and repeated controls before the delayed click',async()=>{
 const h=await completedDrag();click(h,'tab-orbit');click(h,'reset');click(h,'tab-wave');click(h,'wave-home');click(h,'tab-life');click(h,'life-right');
 delayedClickDoesNothing(h);assert.match(h.el('metrics').textContent,/3 个活格子/);
});

test('legacy mouse clicks without pointer identity are suppressed after a world change',async()=>{
 const h=await completedDrag();click(h,'tab-orbit');delayedClickDoesNothing(h,{pointerId:undefined,pointerType:undefined});
 const before=h.el('metrics').textContent;tap(h);assert.notEqual(h.el('metrics').textContent,before);
});

test('a different pointer click edits once without consuming the original pending drag click',async()=>{
 for(const withDown of [false,true]){
  const h=await completedDrag();click(h,'life-right');
  if(withDown)tap(h,2);else pointer(h,'click',2,10,10);
  assert.match(h.el('metrics').textContent,/4 个活格子/);delayedClickDoesNothing(h);
 }
});

test('a fresh same-pointer tap replaces an unconsumed drag-click guard in Life, Orbit and Wave',async()=>{
 for(const world of ['life','orbit','wave']){
  const h=await completedDrag();click(h,'tab-'+world);const before=state(h);tap(h);
  assert.notDeepEqual(state(h),before,'fresh physical interaction must be accepted');
  if(world==='life')assert.match(h.el('metrics').textContent,/4 个活格子/);
  if(world==='orbit')assert.match(h.el('metrics').textContent,/4 颗行星/);
 }
});

test('keyboard-style clicks do not consume or trigger pointer drag suppression',async()=>{
 for(const pointerId of [undefined,-1]){
  const h=await completedDrag();pointer(h,'click',pointerId,10,10,{detail:0,pointerId,pointerType:''});
  assert.match(h.el('metrics').textContent,/4 个活格子/);delayedClickDoesNothing(h);
 }
});

test('completed tap clicks remain ordinary single toggles',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');
 for(const expected of [1,0]){tap(h);assert.match(h.el('metrics').textContent,new RegExp(expected+' 个活格子'));}
});

test('a matching trailing click is consumed only once',async()=>{
 const h=await completedDrag();delayedClickDoesNothing(h);pointer(h,'click');assert.match(h.el('metrics').textContent,/2 个活格子/);
});

test('another pointer owns its legacy click without clearing the earlier pointer guard',async()=>{
 for(const cancelled of [false,true]){
  const h=await completedDrag();
  if(cancelled){pointer(h,'pointerdown',1,6,4);click(h,'life-right');}
  pointer(h,'pointerdown',2,10,10);pointer(h,'pointerup',2,10,10);
  pointer(h,'click',2,10,10,{pointerId:undefined,pointerType:undefined});
  assert.match(h.el('metrics').textContent,/4 个活格子/);delayedClickDoesNothing(h);
 }
});

test('two pending completed drags retain independent click guards in either release-click order',async()=>{
 for(const order of [[1,2],[2,1]]){
  const h=await completedDrag();pointer(h,'pointerdown',2,8,4);pointer(h,'pointermove',2,10,4);pointer(h,'pointerup',2,10,4);
  assert.match(h.el('metrics').textContent,/6 个活格子/);click(h,'tab-orbit');const before=state(h);
  for(const id of order){pointer(h,'click',id,id===1?4:10,4);assert.deepEqual(state(h),before);}
  tap(h,1);assert.match(h.el('metrics').textContent,/4 颗行星/);
 }
});

test('many cancelled touches keep the newest guard and never block fresh reused pointers',async()=>{
 const h=await completedDrag();
 for(let id=2;id<=40;id++){pointer(h,'pointerdown',id,10,10);pointer(h,'pointercancel',id,10,10);}
 const before=state(h);pointer(h,'click',40,10,10);assert.deepEqual(state(h),before);
 tap(h,1);assert.match(h.el('metrics').textContent,/4 个活格子/);
 tap(h,39);assert.match(h.el('metrics').textContent,/3 个活格子/);
});
