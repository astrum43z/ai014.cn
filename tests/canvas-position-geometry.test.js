import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const tap=(h,clientX,clientY,extra={})=>h.el('canvas').handlers.click({clientX,clientY,detail:1,pointerId:1,...extra});
const readings=['metrics','status','announcement','orbit-position','orbit-speed','orbit-preview-reading','orbit-recall-status','wave-probe-reading','wave-value-left','wave-value-right','wave-value-combined','mission-state','mission-result','notes-count','saved-observation-reading'];
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),frames:[...h.frames.keys()],readings:readings.map(id=>h.el(id).textContent),url:location.href,writes:h.writes(),link:h.el('share-link').value,linkHidden:h.el('share-link').hidden,notes:h.el('notes-text').value,fieldNotes:h.el('field-notes-list').innerHTML,focus:document.activeElement,recall:h.el('orbit-recall').getAttribute('aria-disabled')});
const position=(h,mode)=>h.el(mode==='orbit'?'orbit-position':'wave-probe-reading').textContent;

for(const mode of ['orbit','wave'])for(const running of [false,true])test(`${mode}: malformed click coordinates leave ${running?'running':'paused'} state exactly unchanged`,async()=>{
 const h=await setup('?experiment='+mode,'#canvas',!running);h.el('canvas').focus();
 const before=state(h);
 for(const bad of [NaN,Infinity,-Infinity,undefined,null,'20'])for(const [x,y] of [[bad,20],[20,bad]]){
  tap(h,x,y);assert.deepEqual(state(h),before,`${String(x)}, ${String(y)}`);
 }
 tap(h,420,220);assert.notEqual(position(h,mode),before.readings[mode==='orbit'?3:7],'the next valid click remains usable');
 assert.equal(h.frames.size,mode==='wave'?0:running?1:0,'normal pointer pause semantics are unchanged');
});

for(const mode of ['orbit','wave'])test(`${mode}: collapsed or nonfinite DOM bounds cannot replace the current position`,async()=>{
 const h=await setup('?experiment='+mode,'',false),canvas=h.el('canvas'),valid=canvas.getBoundingClientRect;
 const before=state(h);
 for(const dimension of ['width','height'])for(const value of [0,-1,NaN,Infinity]){
  canvas.getBoundingClientRect=()=>({...valid(),[dimension]:value});
  tap(h,0,20);tap(h,20,0);assert.deepEqual(state(h),before,dimension+' '+value);
 }
 for(const offset of ['left','top'])for(const value of [NaN,Infinity,-Infinity]){
  canvas.getBoundingClientRect=()=>({...valid(),[offset]:value});tap(h,20,20);assert.deepEqual(state(h),before,offset+' '+value);
 }
 canvas.getBoundingClientRect=valid;tap(h,420,220);assert.doesNotMatch(position(h,mode),/NaN|Infinity/);
});

for(const mode of ['orbit','wave'])test(`${mode}: a collapsed observed model or nonpositive view scale rejects a late click`,async()=>{
 const h=await setup('?experiment='+mode);
 for(const [width,height] of [[0,414],[600,0],[0,0],[mode==='orbit'?68:36,414],[20,20]]){
  h.resize(width,height);const before=state(h);
  tap(h,20,20);assert.deepEqual(state(h),before,`${width} by ${height}`);
  h.resize(600,414);assert.doesNotMatch(position(h,mode),/NaN|Infinity/);
 }
 tap(h,420,220);assert.doesNotMatch(position(h,mode),/NaN|Infinity/);
});

for(const mode of ['orbit','wave'])test(`${mode}: finite inputs whose pixel or model conversion overflows are ignored`,async()=>{
 const h=await setup('?experiment='+mode),canvas=h.el('canvas'),valid=canvas.getBoundingClientRect,before=state(h);
 canvas.getBoundingClientRect=()=>({width:Number.MIN_VALUE,height:414,left:0,top:0});
 tap(h,1,20);assert.deepEqual(state(h),before,'pixel conversion overflow');
 canvas.getBoundingClientRect=valid;
 h.resize(140,140);const small=state(h);
 tap(h,Number.MAX_VALUE,20);assert.deepEqual(state(h),small,'finite client coordinate overflows model conversion');
 h.resize(600,414);const restored=state(h);
 canvas.getBoundingClientRect=()=>({width:600,height:414,left:-Number.MAX_VALUE,top:0});
 tap(h,Number.MAX_VALUE,20);assert.deepEqual(state(h),restored,'client offset overflow');
});

for(const mode of ['orbit','wave'])test(`${mode}: valid shifted, fractional, scaled and finite outside clicks keep the original conversion`,async()=>{
 for(const rect of [{width:600,height:414,left:0,top:0},{width:300,height:207,left:85,top:-120},{width:455.5,height:281.75,left:-2.5,top:88.25}]){
  const h=await setup('?experiment='+mode);h.el('canvas').getBoundingClientRect=()=>rect;
  const scale=414/(mode==='orbit'?450:280),x=100,y=-30;
  tap(h,rect.left+(300+x*scale)/600*rect.width,rect.top+(207+y*scale)/414*rect.height);
  assert.match(position(h,mode),/x 100\.0，y -30\.0/);
  const metrics=h.el('metrics').textContent;
  tap(h,rect.left+rect.width+10,rect.top+rect.height/2);
  assert.doesNotMatch(position(h,mode),/NaN|Infinity/);
  if(mode==='orbit')assert.notEqual(h.el('metrics').textContent,metrics,'finite outside coordinates retain launch semantics');
 }
});

test('Orbit invalid geometry retains launched-body recall, time and discovery evidence through recovery',async()=>{
 const h=await setup('?experiment=orbit');click(h,'mission-start');click(h,'mission-check');click(h,'orbit-fire');click(h,'step');
 await click(h,'share');h.el('canvas').focus();const before=state(h),canvas=h.el('canvas'),valid=canvas.getBoundingClientRect;
 canvas.getBoundingClientRect=()=>({width:0,height:414,left:0,top:0});tap(h,0,20);assert.deepEqual(state(h),before);
 canvas.getBoundingClientRect=valid;h.resize(295,260);h.resize(600,414);h.tabs[2].handlers.click();h.tabs[0].handlers.click();
 assert.equal(position(h,'orbit'),before.readings[3]);assert.equal(h.el('metrics').textContent,before.readings[0]);
 assert.equal(h.el('orbit-recall').getAttribute('aria-disabled'),'false');
 click(h,'orbit-recall');assert.match(h.el('metrics').textContent,/3 颗行星 · t \+ 0\.1 s/);
 assert.equal(h.el('mission-state').textContent,before.readings[11]);assert.equal(h.el('field-notes-list').innerHTML,before.fieldNotes);
});

test('Wave invalid geometry preserves a saved observation and completed note, then allows a new valid reading',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');click(h,'mission-check');click(h,'wave-home');click(h,'mission-check');
 assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');
 h.key('ArrowRight');await click(h,'share');click(h,'pause');h.el('canvas').focus();
 const before=state(h),canvas=h.el('canvas'),valid=canvas.getBoundingClientRect;
 canvas.getBoundingClientRect=()=>({width:600,height:0,left:0,top:0});tap(h,20,0);assert.deepEqual(state(h),before);
 canvas.getBoundingClientRect=valid;h.setHidden(true);h.setHidden(false);h.setDpr(2);h.loseContext();h.restoreContext();
 h.tabs[0].handlers.click();h.tabs[2].handlers.click();assert.equal(position(h,'wave'),before.readings[7]);
 assert.equal(location.href,before.url);assert.equal(h.el('field-notes-list').innerHTML,before.fieldNotes);
 tap(h,300+8*414/280,207);assert.match(position(h,'wave'),/x 8\.0，y 0\.0 · 整周期最大幅度 0\.00/);
 assert.equal(h.frames.size,0);assert.equal(location.href,before.url,'saved checkpoint stays fixed until sharing again');
});

test('pointer-specific delayed-click suppression stays ahead of conversion and leaves fresh clicks usable',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');const canvas=h.el('canvas');
 canvas.handlers.pointerdown({pointerId:1,button:0,isPrimary:true,clientX:20,clientY:20});
 canvas.handlers.pointermove({pointerId:1,buttons:1,clientX:80,clientY:20});
 h.tabs[0].handlers.click();const before=state(h);tap(h,NaN,20);assert.deepEqual(state(h),before,'old Life click is consumed first');
 canvas.handlers.pointerdown({pointerId:1,button:0,isPrimary:true,clientX:420,clientY:220});tap(h,420,220);
 assert.match(h.el('metrics').textContent,/4 颗行星/);
});

test('Life editing and intentional Fractal/Walk repeats remain separate from continuous-position clicks',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');tap(h,20,20);assert.match(h.el('metrics').textContent,/1 个活格子/);
 h.key('z',{ctrlKey:true});assert.match(h.el('metrics').textContent,/0 个活格子/);
 for(const [tab,pattern] of [[3,/500 个点/],[4,/48 步/]]){
  h.tabs[tab].handlers.click();const before=state(h);tap(h,NaN,20);tap(h,20,20);assert.deepEqual(state(h),before);
  click(h,'step');click(h,'step');assert.match(h.el('metrics').textContent,pattern);
 }
});
