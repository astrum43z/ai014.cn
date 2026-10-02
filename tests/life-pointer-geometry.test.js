import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

function pointer(h,type,x,y,extra={}){
 h.el('canvas').handlers[type]?.({type,pointerId:1,button:0,buttons:['pointerdown','pointermove'].includes(type)?1:0,isPrimary:true,clientX:x,clientY:y,...extra});
}
function cell(h,type,x,y){
 const r=h.el('canvas').getBoundingClientRect();
 pointer(h,type,r.left+(x+.5)*r.width/48,r.top+(y+.5)*r.height/32);
}
async function setupLife({tap=false}={}){
 const h=await setup('?experiment=life');h.el('clear').handlers.click();
 const capture=new Set();h.capture=capture;
 h.el('canvas').setPointerCapture=id=>capture.add(id);
 h.el('canvas').hasPointerCapture=id=>capture.has(id);
 h.el('canvas').releasePointerCapture=id=>{capture.delete(id);pointer(h,'lostpointercapture',400,300,{pointerId:id});};
 h.el('canvas').focus();cell(h,'pointerdown',8,4);if(!tap)cell(h,'pointermove',10,4);
 return h;
}
const state=h=>Object.fromEntries(['metrics','life-selection','life-test-result','history-caption','history-line','life-clear-status','mission-instruction','mission-result','announcement','status'].map(id=>[id,id==='history-line'?h.el(id).getAttribute('points'):h.el(id).textContent]).concat([['href',location.href],['focus',document.activeElement],['frames',h.frames.size]]));
function trailing(h){pointer(h,'pointermove',131.25,58.21875);pointer(h,'pointerup',131.25,58.21875);pointer(h,'click',131.25,58.21875);}
function freshTap(h,x=20,y=12){const before=h.el('metrics').textContent;cell(h,'pointerdown',x,y);cell(h,'pointerup',x,y);cell(h,'click',x,y);assert.notEqual(h.el('metrics').textContent,before);assert.match(h.el('life-selection').textContent,new RegExp(`第 ${x+1} 列，第 ${y+1} 行`));}

for(const [width,height] of [[300,414],[600,207],[300,207],[320,700],[455.5,281.75],[0,0]])test(`Life geometry ${width}×${height} ends only the active stroke and retains its existing cells`,async()=>{
 for(const tap of [true,false]){
  const h=await setupLife({tap}),before=state(h);
  h.resize(width,height);
  assert.equal(h.capture.size,0,'release capture before drawing with new dimensions');assert.deepEqual(state(h),before);
  trailing(h);assert.deepEqual(state(h),before,'old release and synthetic click must not edit the resized grid');
  if(width===0)h.resize(300,207);
  freshTap(h);
 }
});

test('geometry changes before ResizeObserver, including page shifts, never join unrelated grid positions',async()=>{
 for(const type of ['pointermove','pointerup'])for(const rect of [{width:300,height:414,left:0,top:0},{width:600,height:207,left:0,top:0},{width:600,height:414,left:80,top:0},{width:600,height:414,left:0,top:-120}]){
  const h=await setupLife(),before=state(h);h.el('canvas').getBoundingClientRect=()=>rect;
  pointer(h,type,131.25,58.21875);assert.equal(h.capture.size,0);trailing(h);assert.deepEqual(state(h),before);
  freshTap(h);
 }
});

test('same-size observer callbacks and DPR-only changes keep a valid stroke',async()=>{
 const h=await setupLife();h.resize(600,414);globalThis.devicePixelRatio=2;h.resize(600,414);
 assert.equal(h.capture.size,1);cell(h,'pointermove',12,4);cell(h,'pointerup',12,4);cell(h,'click',12,4);
 assert.match(h.el('metrics').textContent,/5 个活格子/);assert.match(h.el('life-selection').textContent,/第 13 列，第 5 行/);
});

test('resize preserves completed drag click suppression and running state without a gesture',async()=>{
 const h=await setupLife();cell(h,'pointerup',10,4);h.resize(300,207);const before=state(h);
 pointer(h,'click',131.25,58.21875);assert.deepEqual(state(h),before);
 h.el('pause').handlers.click();h.resize(600,414);assert.equal(h.el('status').textContent,'运行中');assert.equal(h.frames.size,1);
 h.el('pause').handlers.click();assert.equal(h.frames.size,0);
});

test('a tap interrupted by geometry preserves clear recovery and challenge comparison',async()=>{
 for(const trial of [false,true]){
  const h=await setupLife({tap:true});pointer(h,'pointercancel',0,0);pointer(h,'click',0,0);
  if(trial){h.el('life-undo-clear').handlers.click();h.el('life-test').handlers.click();}
  cell(h,'pointerdown',8,4);const before=state(h),canReturn=h.el('life-return').hidden,canUndo=h.el('life-undo-clear').getAttribute('aria-disabled');
  h.resize(300,207);trailing(h);assert.deepEqual(state(h),before);assert.equal(h.el('life-return').hidden,canReturn);assert.equal(h.el('life-undo-clear').getAttribute('aria-disabled'),canUndo);
 }
});

for(const [x,y,px,py] of [[0,4,-1,58.21875],[47,4,601,58.21875],[4,0,56.25,-1],[4,31,56.25,415]])test(`Life captured edge tap remains at cell ${x},${y} instead of wrapping`,async()=>{
 const h=await setupLife({tap:true});pointer(h,'pointercancel',0,0);pointer(h,'click',0,0);
 cell(h,'pointerdown',x,y);pointer(h,'pointermove',px,py);pointer(h,'pointerup',px,py);pointer(h,'click',px,py);
 assert.match(h.el('metrics').textContent,/1 个活格子/);assert.match(h.el('life-selection').textContent,new RegExp(`第 ${x+1} 列，第 ${y+1} 行 · 活格`));
 h.key('Enter');assert.match(h.el('metrics').textContent,/0 个活格子/,'keyboard targets the exact cell toggled by the tap');
});

test('invalid click coordinates or collapsed DOM bounds leave Life and its recovery unchanged',async()=>{
 const h=await setupLife({tap:true});pointer(h,'pointercancel',0,0);pointer(h,'click',0,0);const before=state(h);
 for(const [x,y] of [[NaN,0],[0,Infinity],[undefined,20]]){pointer(h,'click',x,y);assert.deepEqual(state(h),before);}
 for(const rect of [{width:0,height:414,left:0,top:0},{width:600,height:0,left:0,top:0}]){h.el('canvas').getBoundingClientRect=()=>rect;pointer(h,'click',1,1);assert.deepEqual(state(h),before);}
});

test('geometry fitting leaves all other worlds, fixed observations and pause states unchanged',async()=>{
 for(const world of ['orbit','wave','fractal','walk']){
  const h=await setup('?experiment='+world);h.el('step').handlers.click();await h.el('share').handlers.click();
  const before=state(h);h.resize(300,500);h.resize(600,414);assert.deepEqual(state(h),before);
  h.el('pause').handlers.click();const metrics=h.el('metrics').textContent;h.resize(320,600);assert.equal(h.el('metrics').textContent,metrics);assert.equal(h.frames.size,1);
 }
});
