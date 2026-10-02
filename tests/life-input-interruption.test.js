import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

function pointer(h,type,id=1,x=8,y=4,extra={}){
 h.el('canvas').handlers[type]?.({type,pointerId:id,clientX:(x+.5)*600/48,clientY:(y+.5)*414/32,button:0,buttons:type==='pointerdown'||type==='pointermove'?1:0,isPrimary:true,...extra});
}
async function drawing({tap=false,trial=false}={}){
 const h=await setup('?experiment=life');
 const captures=new Set();h.captures=captures;
 h.el('canvas').setPointerCapture=id=>captures.add(id);
 h.el('canvas').hasPointerCapture=id=>captures.has(id);
 h.el('canvas').releasePointerCapture=id=>{
  captures.delete(id);
  // Capture loss can be delivered during release; the owner must be cleared first.
  pointer(h,'lostpointercapture',id,30,20);
 };
 h.el('clear').handlers.click();
 if(trial){h.el('life-toggle').handlers.click();h.el('life-test').handlers.click();}
 h.el('canvas').focus();pointer(h,'pointerdown',1,2,4);
 if(!tap)pointer(h,'pointermove',1,4,4);
 assert.equal(captures.has(1),true);
 return h;
}
function state(h){return {drawing:h.drawing(),metrics:h.el('metrics').textContent,selection:h.el('life-selection').textContent,inspector:h.el('life-cell-state').textContent,trial:h.el('life-test-result').textContent,history:h.el('history-line').getAttribute('points'),announcement:h.el('announcement').textContent,status:h.el('status').textContent,frames:h.frames.size,href:location.href,focus:document.activeElement};}
function trailing(h){
 pointer(h,'pointermove',1,30,20);pointer(h,'pointerup',1,30,20);pointer(h,'lostpointercapture',1,30,20);pointer(h,'click',1,30,20);
}
function freshTap(h){
 const before=h.el('metrics').textContent;
 pointer(h,'pointerdown',1,10,10);pointer(h,'pointerup',1,10,10);pointer(h,'click',1,10,10);
 assert.notEqual(h.el('metrics').textContent,before,'same pointer can start a fresh edit');
 assert.equal(h.el('status').textContent,'已暂停');
}

test('Next generation ends an active Life stroke before advancing and suppresses its trailing release/click',async()=>{
 for(const tap of [false,true]){
  const h=await drawing({tap});h.el('step').focus();h.el('step').handlers.click();
  assert.equal(h.captures.has(1),false);
  assert.match(h.el('metrics').textContent,/第 1 代/);
  const after=state(h);trailing(h);assert.deepEqual(state(h),after);
  freshTap(h);
 }
});

test('Continue ends an active Life stroke before animation resumes, including a later generation',async()=>{
 for(const elapsed of [false,true]){
  const h=await drawing();h.el('pause').focus();h.el('pause').handlers.click();
  assert.equal(h.captures.has(1),false);assert.equal(h.frames.size,1);
  if(elapsed){h.tick(0);for(let n=1;n<=3;n++)h.tick(n*50);assert.match(h.el('metrics').textContent,/第 1 代/);}
  const after=state(h);trailing(h);assert.deepEqual(state(h),after);
  freshTap(h);
 }
});

for(const key of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '])test(`Life canvas ${JSON.stringify(key)} owns the edit after interrupting an active stroke`,async()=>{
 const h=await drawing();h.key(key);
 assert.equal(h.captures.has(1),false);
 const after=state(h);trailing(h);assert.deepEqual(state(h),after);
 assert.equal(document.activeElement,h.el('canvas'));assert.equal(h.frames.size,0);
 freshTap(h);
});

test('unhandled keys and suppressed held toggles leave the current stroke intact',async()=>{
 for(const [key,extra] of [['Tab',{}],['Home',{}],['Escape',{}],['ArrowRight',{altKey:true}],['ArrowLeft',{ctrlKey:true}],['Enter',{metaKey:true}],['Enter',{repeat:true}],[' ',{repeat:true}]]){
  const h=await drawing();const before=state(h);h.key(key,extra);
  assert.equal(h.captures.has(1),true,key);assert.deepEqual(state(h),before,key);
  pointer(h,'pointermove',1,6,4);assert.match(h.el('metrics').textContent,/5 个活格子/);
 }
});

test('fresh repeated navigation cancels once, and a cancelled pointer cannot bridge to keyboard selection',async()=>{
 const h=await drawing();h.key('ArrowRight',{repeat:true});h.key('ArrowDown',{repeat:true});
 assert.equal(h.captures.size,0);const before=state(h);trailing(h);assert.deepEqual(state(h),before);
 freshTap(h);
});

test('interrupted challenge tap retains comparison when moving selection but ends it when stepping or continuing',async()=>{
 for(const action of ['selection','step','continue']){
  const h=await drawing({tap:true,trial:true});const comparison=h.el('life-test-result').textContent;
  if(action==='selection')h.key('ArrowRight');else h.el(action==='step'?'step':'pause').handlers.click();
  assert.equal(h.captures.size,0);
  if(action==='selection'){assert.equal(h.el('life-return').hidden,false);assert.equal(h.el('life-test-result').textContent,comparison);}
  else assert.equal(h.el('life-return').hidden,true);
  const after=state(h);trailing(h);assert.deepEqual(state(h),after);
 }
});

test('single-step and Continue keep existing behavior without an active gesture in all five worlds',async()=>{
 for(const world of ['orbit','life','wave','fractal','walk']){
  const h=await setup('?experiment='+world);const href=location.href;
  h.el('step').focus();h.el('step').handlers.click();assert.equal(h.frames.size,0);assert.equal(document.activeElement,h.el('step'));
  h.el('pause').focus();h.el('pause').handlers.click();assert.equal(h.frames.size,1);assert.equal(document.activeElement,h.el('pause'));
  h.el('pause').handlers.click();assert.equal(h.frames.size,0);assert.equal(location.href,href);
 }
});

test('completed drag click suppression survives a later step and no-pointer keyboard action',async()=>{
 for(const action of ['step','key','continue']){
  const h=await drawing();pointer(h,'pointerup',1,4,4);
  if(action==='step')h.el('step').handlers.click();else if(action==='continue')h.el('pause').handlers.click();else h.key('ArrowRight');
  const after=state(h);pointer(h,'click',1,4,4);assert.deepEqual(state(h),after);
 }
});


test('a delayed release alone cannot append the last segment after another command',async()=>{
 for(const action of ['step','continue','key']){
  const h=await drawing();
  if(action==='key')h.key('ArrowDown');else h.el(action==='step'?'step':'pause').handlers.click();
  const after=state(h);pointer(h,'pointerup',1,30,20);pointer(h,'click',1,30,20);assert.deepEqual(state(h),after);
 }
});

test('rate and density adjustments keep the active stroke and its intended next segment',async()=>{
 for(const [id,value] of [['rate','3'],['density','45']]){
  const h=await drawing();h.el(id).handlers.input({target:{value}});
  assert.equal(h.captures.has(1),true);pointer(h,'pointermove',1,6,4);assert.match(h.el('metrics').textContent,/5 个活格子/);
 }
});
