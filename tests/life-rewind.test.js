import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const generation=h=>Number(h.el('metrics').textContent.match(/^第 (\d+) 代/)[1]);
const available=h=>h.el('life-back').getAttribute('aria-disabled')==='false';
const choose=(h,value)=>(h.el('preset-select').handlers.change({target:{value}}),click(h,'load-preset'));
const history=h=>({points:h.el('history-line').getAttribute('points'),caption:h.el('history-caption').textContent});
const state=h=>({drawing:h.drawing(),metrics:h.el('metrics').textContent,history:history(h),message:h.el('announcement').textContent,status:h.el('status').textContent,frames:h.frames.size,url:location.href,writes:h.writes(),draws:h.drawCount(),focus:document.activeElement});
function enter(h,repeat=false){
 let prevented=false;
 h.el('life-back').handlers.keydown({key:'Enter',repeat,preventDefault(){prevented=true;}});
 if(!prevented)click(h,'life-back');
 return prevented;
}

test('initial and history-boundary rewinds are inert and preserve focus',async()=>{
 for(const reduced of [true,false]){
  const h=await setup('?experiment=life','',reduced);h.el('life-back').focus();
  assert.equal(available(h),false);assert.equal(h.el('life-back').hidden,false);
  assert.match(h.el('life-rewind-status').textContent,/暂无上一代记录/);
  const before=state(h);click(h,'life-back');assert.deepEqual(state(h),before);
 }
});

test('rewind restores exact pulsar boards and history; forward repeats the same transition',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');
 for(let round=0;round<4;round++){
  const before={drawing:h.drawing(),history:history(h),metrics:h.el('metrics').textContent};
  click(h,'step');const next=h.drawing();assert.equal(available(h),true);
  h.el('life-back').focus();click(h,'life-back');
  assert.deepEqual(h.drawing(),before.drawing);assert.deepEqual(history(h),before.history);
  assert.equal(h.el('metrics').textContent,before.metrics);assert.equal(document.activeElement,h.el('life-back'));
  assert.equal(h.frames.size,0);click(h,'step');assert.deepEqual(h.drawing(),next);
 }
});

test('recorded animation can rewind at most 119 generations without another archive',async()=>{
 const h=await setup('?experiment=life&rate=20','',false);choose(h,'pulsar');
 h.tick(0);for(let i=1;i<=124;i++)h.tick(i*50);
 assert.equal(generation(h),124);assert.equal(history(h).points.split(' ').length,120);
 assert.match(h.el('life-rewind-status').textContent,/可退回第 123 代；本段记录最早为第 5 代/);
 h.el('life-back').focus();
 for(let n=123;n>=5;n--){click(h,'life-back');assert.equal(generation(h),n);assert.equal(h.frames.size,0);}
 assert.equal(available(h),false);assert.equal(history(h).points.split(' ').length,1);
 const before=state(h);click(h,'life-back');assert.deepEqual(state(h),before);
 click(h,'step');assert.equal(available(h),true);click(h,'life-back');assert.equal(generation(h),5);
});

test('an extinct pattern restores its recorded cells rather than reversing the empty board',async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');click(h,'life-toggle');
 const before=h.drawing();assert.match(h.el('metrics').textContent,/第 0 代 · 1 个活格子/);
 click(h,'step');assert.match(h.el('metrics').textContent,/第 1 代 · 0 个活格子/);
 assert.match(h.el('observation-c').textContent,/全部消失/);click(h,'step');
 click(h,'life-back');assert.match(h.el('metrics').textContent,/第 1 代 · 0 个活格子/);
 click(h,'life-back');assert.match(h.el('metrics').textContent,/第 0 代 · 1 个活格子/);
 assert.deepEqual(h.drawing(),before);assert.equal(available(h),false);
 click(h,'step');assert.match(h.el('metrics').textContent,/第 1 代 · 0 个活格子/);
});

test('rewind resets partial generation time and resumes without background catch-up',async()=>{
 const h=await setup('?experiment=life&rate=1','',false);
 h.tick(0);for(let ms=50;ms<=1950;ms+=50)h.tick(ms);
 assert.equal(generation(h),1);click(h,'life-back');assert.equal(generation(h),0);assert.equal(h.frames.size,0);
 click(h,'pause');h.tick(60000);
 for(let ms=60050;ms<=60950;ms+=50)h.tick(ms);
 assert.equal(generation(h),0);h.tick(61000);assert.equal(generation(h),1);
});

test('new edits establish a boundary at the edited generation',async()=>{
 const edits=[h=>h.key('Enter'),h=>click(h,'life-toggle'),h=>h.el('canvas').handlers.click({clientX:20,clientY:20})];
 for(const edit of edits){
  const h=await setup('?experiment=life');choose(h,'blinker');for(let n=0;n<3;n++)click(h,'step');
  edit(h);assert.equal(generation(h),3);assert.equal(available(h),false);const drawing=h.drawing();
  click(h,'step');assert.match(h.el('life-rewind-status').textContent,/最早为第 3 代/);
  click(h,'life-back');assert.equal(generation(h),3);assert.deepEqual(h.drawing(),drawing);assert.equal(available(h),false);
 }
});

test('replacement actions cannot rewind to a prior drawing',async()=>{
 for(const replace of [h=>click(h,'clear'),h=>click(h,'reset'),h=>choose(h,'glider'),h=>click(h,'preset'),h=>click(h,'guide-start'),h=>click(h,'mission-start'),h=>click(h,'life-challenge-start'),h=>h.navigate('?experiment=life&rate=3&density=20')]){
  const h=await setup('?experiment=life');click(h,'step');assert.equal(available(h),true);replace(h);
  assert.equal(available(h),false);const before=state(h);click(h,'life-back');assert.deepEqual(state(h),before);
 }
});

test('selection, parameter edits, sharing, tabs and resizing preserve recorded boards',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');click(h,'step');click(h,'step');
 h.key('ArrowRight');click(h,'life-down');h.el('rate').handlers.input({target:{value:20}});h.el('density').handlers.input({target:{value:60}});
 await h.el('share').handlers.click();const url=location.href,shared=h.el('share-link').value,writes=h.writes();
 const before=history(h);h.resize(320,240);
 for(const index of [0,2,3,4]){
  h.tabs[index].handlers.click();assert.equal(h.el('life-back').hidden,true);assert.equal(h.el('life-rewind-status').hidden,true);
  const other=state(h);click(h,'life-back');assert.deepEqual(state(h),other);
  h.tabs[1].handlers.click();assert.equal(h.el('life-back').hidden,false);assert.deepEqual(history(h),before);
 }
 const selected=h.el('life-cell-position').textContent;h.navigate(location.search+'#observation-title');
 const currentURL=location.href,currentWrites=h.writes();click(h,'life-back');
 assert.equal(generation(h),1);assert.equal(h.el('life-cell-position').textContent,selected);
 assert.equal(h.el('rate').value,'20');assert.equal(h.el('density').value,'60');
 assert.equal(location.href,currentURL);assert.equal(h.writes(),currentWrites);
 assert.equal(new URL(shared).search,url.slice(url.indexOf('?')));assert.equal(new URL(shared).searchParams.has('at'),false);
 assert.ok(h.writes()>=writes);assert.equal(h.el('share-link').value,currentURL);
});

test('clear undo restores rewind history, while comparison rewind exits the overlay safely',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');click(h,'step');const before=h.drawing(),beforeHistory=history(h);
 click(h,'clear');assert.equal(available(h),false);click(h,'life-undo-clear');assert.equal(available(h),true);
 assert.deepEqual(h.drawing(),before);assert.deepEqual(history(h),beforeHistory);
 click(h,'life-test');assert.equal(h.el('life-return').hidden,false);assert.equal(generation(h),2);
 click(h,'life-back');assert.equal(h.el('life-return').hidden,true);assert.deepEqual(h.drawing(),before);
 assert.deepEqual(history(h),beforeHistory);assert.equal(h.el('life-test').disabled,false);
 assert.equal(h.el('life-undo-clear').getAttribute('aria-disabled'),'true');
 click(h,'life-test');assert.equal(h.el('life-return').hidden,false);click(h,'life-return');assert.deepEqual(h.drawing(),before);
});

test('rewind cancels a pending pointer tap and rejects its delayed events',async()=>{
 const h=await setup('?experiment=life');click(h,'step');const captures=new Set();
 const canvas=h.el('canvas');canvas.setPointerCapture=id=>captures.add(id);canvas.hasPointerCapture=id=>captures.has(id);
 canvas.releasePointerCapture=id=>{captures.delete(id);canvas.handlers.lostpointercapture({type:'lostpointercapture',pointerId:id});};
 const event={pointerId:7,button:0,buttons:1,isPrimary:true,clientX:20,clientY:20};
 canvas.handlers.pointerdown(event);assert.equal(captures.has(7),true);click(h,'life-back');assert.equal(captures.size,0);
 const after=state(h);canvas.handlers.pointermove({...event,clientX:200});canvas.handlers.pointerup({...event,type:'pointerup',clientX:200});canvas.handlers.click({...event,detail:1,clientX:200});
 assert.deepEqual(state(h),after);
 canvas.handlers.pointerdown(event);canvas.handlers.pointerup({...event,type:'pointerup'});canvas.handlers.click({...event,detail:1});
 assert.notEqual(h.el('metrics').textContent,after.metrics);assert.equal(available(h),false);
});

test('held Enter rewinds once; Space and fresh presses retain native activation',async()=>{
 const h=await setup('?experiment=life');for(let n=0;n<4;n++)click(h,'step');h.el('life-back').focus();
 assert.equal(enter(h),false);assert.equal(generation(h),3);const before=state(h);
 for(let n=0;n<12;n++)assert.equal(enter(h,true),true);assert.deepEqual(state(h),before);
 for(const key of [' ','Tab','Escape','ArrowRight'])for(const repeat of [false,true]){
  let prevented=false;h.el('life-back').handlers.keydown({key,repeat,preventDefault(){prevented=true;}});assert.equal(prevented,false);
 }
 assert.deepEqual(state(h),before);click(h,'life-back');assert.equal(generation(h),2);enter(h);assert.equal(generation(h),1);
 h.tabs[2].handlers.click();h.tabs[1].handlers.click();enter(h);assert.equal(generation(h),0);assert.equal(available(h),false);
});

test('rewind never completes a discovery or replaces earned evidence',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');
 for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 click(h,'step');click(h,'life-back');assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const note=h.el('field-notes-list').innerHTML,mission=h.el('mission-state').textContent;
 click(h,'step');click(h,'life-back');assert.equal(h.el('field-notes-list').innerHTML,note);assert.equal(h.el('mission-state').textContent,mission);
});

test('the described native rewind control is near Step, quiet, wrapping and touch-sized',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<button id="life-back" aria-disabled="true" aria-describedby="life-rewind-status" hidden>退回一代 −1<\/button>/);
 assert.match(html,/<p id="life-rewind-status" class="life-clear-status" aria-live="off" hidden><\/p>/);
 assert.ok(html.indexOf('id="step"')<html.indexOf('id="life-back"'));assert.ok(html.indexOf('id="life-back"')<html.indexOf('id="reset"'));
 assert.match(css,/#life-back\{min-height:44px;white-space:normal\}/);assert.match(css,/\.stage-controls\{[^}]*flex-wrap:wrap/);
 assert.match(css,/\.life-clear-status\{[^}]*overflow-wrap:anywhere/);
 assert.ok(html.includes('app.js?v=orbit-measurement-1'));assert.ok(html.includes('style.css?v=orbit-measurement-1'));
});
