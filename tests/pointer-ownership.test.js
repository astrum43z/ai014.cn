import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
function pointer(h,type,id,x,y,extra={}){
 h.el('canvas').handlers[type]({type,pointerId:id,pointerType:'touch',isPrimary:true,button:0,
  buttons:['pointerdown','pointermove'].includes(type)?1:0,detail:type==='click'?1:0,
  clientX:(x+.5)*600/48,clientY:(y+.5)*414/32,...extra});
}
function tap(h,id,x,y,extra={}){for(const type of ['pointerdown','pointerup','click'])pointer(h,type,id,x,y,extra);}
function state(h){return {drawing:h.drawing(),draws:h.drawCount(),metrics:h.el('metrics').textContent,
 selection:h.el('life-selection').textContent,history:h.el('history-caption').textContent,
 undo:h.el('life-undo-edit').getAttribute('aria-disabled'),clear:h.el('life-undo-clear').getAttribute('aria-disabled'),
 trial:h.el('life-test-result').textContent,mission:h.el('mission-result').textContent,
 notes:h.el('notes-text').value,status:h.el('status').textContent,announcement:h.el('announcement').textContent,
 frames:[...h.frames.keys()],url:location.href,writes:h.writes(),focus:document.activeElement,captures:[...h.captures]};}
async function life(){
 const h=await setup('?experiment=life');h.captures=new Set();const canvas=h.el('canvas');
 canvas.setPointerCapture=id=>h.captures.add(id);canvas.hasPointerCapture=id=>h.captures.has(id);
 canvas.releasePointerCapture=id=>{h.captures.delete(id);pointer(h,'lostpointercapture',id,30,20);};
 click(h,'clear');canvas.focus();return h;
}
function begin(h){pointer(h,'pointerdown',1,1,1);pointer(h,'pointermove',1,3,1);assert.match(h.el('metrics').textContent,/3 个活格子/);}
function finish(h){pointer(h,'pointermove',1,5,1);pointer(h,'pointerup',1,5,1);h.captures.delete(1);pointer(h,'lostpointercapture',1,5,1);pointer(h,'click',1,5,1);assert.match(h.el('metrics').textContent,/5 个活格子/);}

for(const [name,extra] of [['secondary touch',{isPrimary:false}],['another primary device',{pointerType:'mouse'}]])test(name+': a rejected press cannot click through or replace the owning stroke recovery',async()=>{
 const h=await life();begin(h);const before=state(h);
 tap(h,2,10,10,extra);assert.deepEqual(state(h),before);
 assert.ok(h.captures.has(1));finish(h);click(h,'life-undo-edit');
 assert.match(h.el('metrics').textContent,/0 个活格子/,'undo restores the board before the entire original gesture');
});

test('a rejected pointer keeps its own delayed-click guard after the owner finishes, in either click order',async()=>{
 for(const order of [[1,2],[2,1]]){
  const h=await life();begin(h);pointer(h,'pointerdown',2,10,10,{isPrimary:false});
  pointer(h,'pointerup',2,10,10,{isPrimary:false});pointer(h,'pointerup',1,5,1);h.captures.delete(1);
  const before=state(h);for(const id of order){pointer(h,'click',id,id===1?5:10,id===1?1:10);assert.deepEqual(state(h),before);}
  click(h,'life-undo-edit');assert.match(h.el('metrics').textContent,/0 个活格子/);
 }
});

test('secondary-only touch sequences do not edit, pause, redraw or replace an earlier useful recovery',async()=>{
 const h=await life();tap(h,1,4,4);const before=state(h);
 tap(h,2,10,10,{isPrimary:false});assert.deepEqual(state(h),before);
 click(h,'life-undo-edit');assert.match(h.el('metrics').textContent,/0 个活格子/);
 click(h,'pause');const running=state(h);tap(h,3,10,10,{isPrimary:false});assert.deepEqual(state(h),running);
});

test('rejected presses cannot click into another world after an interrupted Life stroke',async()=>{
 for(const mode of ['orbit','wave','fractal','walk']){
  const h=await life();begin(h);pointer(h,'pointerdown',2,10,10,{isPrimary:false});
  click(h,'tab-'+mode);const before=state(h);
  for(const type of ['pointerup','lostpointercapture','click'])pointer(h,type,2,10,10,{isPrimary:false});
  assert.deepEqual(state(h),before,mode);pointer(h,'click',1,3,1);assert.deepEqual(state(h),before,mode);
  click(h,'tab-life');click(h,'life-undo-edit');assert.match(h.el('metrics').textContent,/0 个活格子/);
 }
});

test('clear recovery, comparisons and explicit discovery records survive a rejected touch',async()=>{
 for(const action of ['clear','comparison','discovery']){
  const h=await life();
  if(action==='clear'){tap(h,1,4,4);click(h,'clear');}
  if(action==='comparison'){tap(h,1,4,4);click(h,'life-test');}
  if(action==='discovery'){
   click(h,'mission-start');for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
   click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
  }
  const before=state(h);tap(h,2,10,10,{isPrimary:false});assert.deepEqual(state(h),before,action);
  if(action==='clear'){click(h,'life-undo-clear');assert.match(h.el('metrics').textContent,/1 个活格子/);}
  if(action==='comparison'){click(h,'life-return');assert.match(h.el('metrics').textContent,/1 个活格子/);}
 }
});

test('fresh reused pointers and accepted independent taps remain usable without clearing another pending guard',async()=>{
 const h=await life();begin(h);pointer(h,'pointerdown',2,10,10,{isPrimary:false});finish(h);
 tap(h,3,12,12);assert.match(h.el('metrics').textContent,/6 个活格子/);
 const before=state(h);pointer(h,'click',2,10,10);assert.deepEqual(state(h),before);
 tap(h,2,10,10);assert.match(h.el('metrics').textContent,/7 个活格子/);
 // Pointer IDs may be recycled before an ignored sequence ever supplies a click.
 pointer(h,'pointerdown',4,15,15,{isPrimary:false});tap(h,4,15,15);assert.match(h.el('metrics').textContent,/8 个活格子/);
});

test('keyboard-style clicks bypass pointer guards without consuming them, and legacy accepted taps still work',async()=>{
 for(const id of [undefined,-1]){
  const h=await life();pointer(h,'pointerdown',2,10,10,{isPrimary:false});
  pointer(h,'click',id,4,4,{detail:0,pointerType:'',isPrimary:false});assert.match(h.el('metrics').textContent,/1 个活格子/);
  const before=state(h);pointer(h,'click',2,10,10);assert.deepEqual(state(h),before);
  pointer(h,'pointerdown',1,5,5);pointer(h,'pointerup',1,5,5);
  pointer(h,'click',undefined,5,5,{pointerType:undefined,isPrimary:undefined});assert.match(h.el('metrics').textContent,/2 个活格子/);
 }
});

test('an extra down from the owning pointer does not consume its valid tap',async()=>{
 const h=await life();pointer(h,'pointerdown',1,4,4);pointer(h,'pointerdown',1,4,4);
 pointer(h,'pointerup',1,4,4);pointer(h,'click',1,4,4);assert.match(h.el('metrics').textContent,/1 个活格子/);
});

test('a non-primary button press cannot click through, and the next primary press with its ID stays usable',async()=>{
 const h=await life();const before=state(h);
 pointer(h,'pointerdown',3,10,10,{pointerType:'mouse',button:2,buttons:2});
 pointer(h,'pointerup',3,10,10,{pointerType:'mouse',button:2});
 pointer(h,'click',3,10,10,{pointerType:'mouse'});assert.deepEqual(state(h),before);
 // No click is normally emitted for the right button. Its pending guard must
 // also be cleared by the next genuine primary-button press with the same ID.
 pointer(h,'pointerdown',3,10,10,{pointerType:'mouse',button:2,buttons:2});
 tap(h,3,10,10,{pointerType:'mouse'});assert.match(h.el('metrics').textContent,/1 个活格子/);
});

test('the existing bounded guard remains recoverable after many rejected pointer sequences',async()=>{
 const h=await life();begin(h);for(let id=2;id<=40;id++)pointer(h,'pointerdown',id,10,10,{isPrimary:false});
 const before=state(h);pointer(h,'click',40,10,10);assert.deepEqual(state(h),before);finish(h);
 tap(h,39,10,10);assert.match(h.el('metrics').textContent,/6 个活格子/);
});
