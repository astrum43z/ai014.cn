import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const generation=h=>Number(h.el('metrics').textContent.match(/^第 (\d+) 代/)[1]);
// Native buttons activate on Enter keydown, including uncancelled repeats.
function enter(h,repeat=false){
 let prevented=false;
 h.el('step').handlers.keydown?.({key:'Enter',repeat,preventDefault(){prevented=true;}});
 if(!prevented)click(h,'step');
 return prevented;
}
const state=h=>({drawing:h.drawing(),metrics:h.el('metrics').textContent,
 history:h.el('history-line').getAttribute('points'),caption:h.el('history-caption').textContent,
 status:h.el('status').textContent,message:h.el('announcement').textContent,
 draws:h.drawCount(),frames:h.frames.size,url:location.href,writes:h.writes(),
 focus:document.activeElement,notes:h.el('field-notes-list').innerHTML,
 trial:h.el('life-test-result').textContent,returnHidden:h.el('life-return').hidden,
 edit:h.el('life-undo-edit').getAttribute('aria-disabled'),clear:h.el('life-undo-clear').getAttribute('aria-disabled')});

for(const pattern of ['glider','blinker','pulsar'])test(`${pattern}: held Enter keeps the first next generation and its exact rewind`,async()=>{
 const h=await setup('?experiment=life');
 h.el('preset-select').handlers.change({target:{value:pattern}});click(h,'load-preset');
 h.el('step').focus();const original=h.drawing();
 assert.equal(enter(h),false);assert.equal(generation(h),1);assert.equal(h.frames.size,0);
 const first=state(h);
 for(let i=0;i<15;i++)assert.equal(enter(h,true),true);
 assert.deepEqual(state(h),first,'no skipped generations, redraws or replaced announcement');
 assert.equal(document.activeElement,h.el('step'));
 click(h,'life-back');assert.equal(generation(h),0);assert.deepEqual(h.drawing(),original);
 enter(h);assert.equal(generation(h),1);assert.deepEqual(h.drawing(),first.drawing);
 enter(h);assert.equal(generation(h),2,'a separate press advances again');
});

test('the first press pauses a running board once; an arriving repeat cannot pause it',async()=>{
 const h=await setup('?experiment=life&rate=20','',false);h.tick(0);h.tick(50);
 assert.equal(generation(h),1);h.el('step').focus();const running=state(h);
 assert.equal(enter(h,true),true);assert.deepEqual(state(h),running);
 enter(h);assert.equal(generation(h),2);assert.equal(h.frames.size,0);
 const first=state(h);for(let i=0;i<8;i++)enter(h,true);assert.deepEqual(state(h),first);
});

test('repeats preserve a comparison and both recovery paths before a fresh step',async()=>{
 for(const prepare of [h=>click(h,'life-test'),h=>click(h,'clear'),h=>click(h,'life-toggle')]){
  const h=await setup('?experiment=life');prepare(h);h.el('step').focus();const before=state(h);
  assert.equal(enter(h,true),true);assert.deepEqual(state(h),before);
  enter(h);assert.equal(generation(h),Number(before.metrics.match(/^第 (\d+) 代/)[1])+1);
  assert.equal(h.el('life-return').hidden,true);
  assert.equal(h.el('life-undo-edit').getAttribute('aria-disabled'),'true');
  assert.equal(h.el('life-undo-clear').getAttribute('aria-disabled'),'true');
 }
});

test('a repeated Enter leaves an unfinished drawing stroke alone',async()=>{
 const h=await setup('?experiment=life');const canvas=h.el('canvas');
 const pointer={pointerId:7,button:0,buttons:1,isPrimary:true,clientX:20,clientY:20};
 canvas.handlers.pointerdown(pointer);canvas.handlers.pointermove({...pointer,clientX:60});
 h.el('step').focus();const before=state(h);assert.equal(enter(h,true),true);assert.deepEqual(state(h),before);
 canvas.handlers.pointermove({...pointer,clientX:100});assert.notDeepEqual(h.drawing(),before.drawing);
 enter(h);assert.equal(generation(h),1);const after=state(h);
 canvas.handlers.pointerup({...pointer,type:'pointerup',clientX:200});
 canvas.handlers.click({...pointer,detail:1,clientX:200});assert.deepEqual(state(h),after);
});

test('sharing, anchor navigation, resize and world returns retain one-press stepping',async()=>{
 const h=await setup('?experiment=life','#canvas');enter(h);
 await h.el('share').handlers.click();const shared=h.el('share-link').value;
 for(const index of [0,2,3,4]){h.tabs[index].handlers.click();h.tabs[1].handlers.click();}
 h.navigate('#observation-title');h.resize(300,240);h.el('step').focus();const before=state(h);
 assert.equal(enter(h,true),true);assert.deepEqual(state(h),before);
 enter(h);assert.equal(generation(h),2);assert.equal(location.href,before.url);assert.equal(h.writes(),before.writes);
 assert.equal(new URL(h.el('share-link').value).search,new URL(shared).search);
 h.navigate('?experiment=life&rate=3&density=20#canvas');enter(h);assert.equal(generation(h),1);
 const replacement=state(h);enter(h,true);assert.deepEqual(state(h),replacement);
});

test('step repeats cannot complete a discovery or replace a completed note',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');
 for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 enter(h);assert.equal(enter(h,true),true);assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const notes=h.el('field-notes-list').innerHTML;h.el('step').focus();enter(h);const before=state(h);
 enter(h,true);assert.deepEqual(state(h),before);assert.equal(h.el('field-notes-list').innerHTML,notes);
});

test('Space, navigation and native clicks remain unchanged on the Life step button',async()=>{
 const h=await setup('?experiment=life');h.el('step').focus();const before=state(h);
 for(const key of [' ','Tab','Escape','ArrowRight','Home'])for(const repeat of [false,true]){
  let prevented=false;h.el('step').handlers.keydown?.({key,repeat,preventDefault(){prevented=true;}});
  assert.equal(prevented,false,key+' retains its native default');
 }
 assert.deepEqual(state(h),before);
 for(let n=1;n<=3;n++){click(h,'step');assert.equal(generation(h),n);}
});

test('Orbit and seeded batch worlds retain their repeatable primary-step behavior',async()=>{
 for(const mode of ['orbit','fractal','walk']){
  const h=await setup('?experiment='+mode);h.el('step').focus();
  assert.equal(enter(h),false);const first=h.el('metrics').textContent;
  assert.equal(enter(h,true),false);assert.notEqual(h.el('metrics').textContent,first);
 }
});
