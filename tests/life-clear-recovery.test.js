import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const available=h=>h.el('life-undo-clear').getAttribute('aria-disabled')==='false';
const tap=(h,x,y)=>h.el('canvas').handlers.click({clientX:(x+.5)*600/48,clientY:(y+.5)*414/32});
const drawing=h=>({canvas:h.drawing(),metrics:h.el('metrics').textContent,history:h.el('history-line').getAttribute('points'),historyLabel:h.el('history-caption').textContent,position:h.el('life-cell-position').textContent,selection:h.el('life-selection').textContent,trial:h.el('life-test-result').textContent,returnHidden:h.el('life-return').hidden});
const state=h=>({drawing:drawing(h),draws:h.drawCount(),url:location.href,writes:h.writes(),frames:h.frames.size,announcement:h.el('announcement').textContent,notes:h.el('field-notes-list').innerHTML,mission:h.el('mission-state').textContent});

function pattern(h){
 click(h,'life-challenge-start');
 for(const [x,y] of [[0,0],[1,0],[0,1],[1,1],[25,17],[26,17],[27,17]])tap(h,x,y);
 click(h,'step');click(h,'step');
 h.key('ArrowDown');
}

test('Undo Clear restores exact cells, generation, cursor, history and paused state once',async()=>{
 const h=await setup('?experiment=life');pattern(h);const before=drawing(h),url=location.href,writes=h.writes();
 const undo=h.el('life-undo-clear');
 Object.defineProperty(undo,'disabled',{get:()=>false,set:()=>assert.fail('recovery must retain native focus')});
 assert.equal(available(h),false);click(h,'clear');
 assert.match(h.el('metrics').textContent,/第 0 代 · 0 个活格子/);assert.equal(available(h),true);
 assert.match(h.el('life-clear-status').textContent,/恢复第 2 代的 7 个活格/);
 assert.match(h.el('announcement').textContent,/撤销清空/);
 undo.focus();click(h,'life-undo-clear');
 assert.deepEqual(drawing(h),before);assert.equal(available(h),false);assert.equal(h.frames.size,0);
 assert.equal(document.activeElement,undo);assert.equal(location.href,url);assert.equal(h.writes(),writes);
 assert.match(h.el('announcement').textContent,/已撤销清空.*暂停/);
 const restored=state(h);for(let i=0;i<8;i++)click(h,'life-undo-clear');assert.deepEqual(state(h),restored);
});

test('repeated clear keeps the original snapshot and a later clear captures the newer board',async()=>{
 const h=await setup('?experiment=life');pattern(h);const before=drawing(h);
 for(let i=0;i<8;i++)click(h,'clear');assert.equal(available(h),true);
 click(h,'life-undo-clear');assert.deepEqual(drawing(h),before);
 tap(h,12,12);click(h,'step');const later=drawing(h);assert.notDeepEqual(later,before);
 click(h,'clear');click(h,'life-undo-clear');assert.deepEqual(drawing(h),later);
 click(h,'life-challenge-start');click(h,'clear');assert.equal(available(h),false,'an untouched empty start needs no recovery');
});

test('a cleared comparison recovers its exact overlay and the original return-to-editing snapshot',async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');
 for(const [x,y] of [[2,2],[3,2],[4,2],[9,9]])tap(h,x,y);
 const original=drawing(h);click(h,'life-test');const compared=drawing(h);
 assert.equal(h.el('life-return').hidden,false);click(h,'clear');assert.equal(h.el('life-return').hidden,true);
 click(h,'life-undo-clear');assert.deepEqual(drawing(h),compared);
 click(h,'life-return');assert.deepEqual(drawing(h),original);assert.equal(available(h),false);
});

test('cursor, resize, parameter edits, sharing and tab visits retain the recovery without reverting settings',async()=>{
 const h=await setup('?experiment=life');pattern(h);const before=drawing(h);click(h,'clear');
 h.key('ArrowRight');click(h,'life-down');h.resize(286,245);input(h,'rate',20);input(h,'density',60);
 await h.el('share').handlers.click();const shared=h.el('share-link').value;
 for(const tab of h.tabs){tab.handlers.click();if(tab.dataset.mode!=='life'){assert.equal(h.el('life-undo-clear').hidden,true);assert.equal(h.el('life-clear-status').hidden,true);}}
 h.tabs[1].handlers.click();assert.equal(available(h),true);assert.equal(h.el('life-undo-clear').hidden,false);
 h.navigate(location.search+'#observation-title');assert.equal(available(h),true);
 const url=location.href,writes=h.writes();h.resize(600,414);click(h,'life-undo-clear');assert.deepEqual(drawing(h),before);
 assert.equal(h.el('rate').value,'20');assert.equal(h.el('density').value,'60');assert.equal(location.href,url);assert.equal(h.writes(),writes);
 assert.equal(new URL(shared).searchParams.has('at'),false);assert.equal(h.el('share-link').hidden,false);
});

test('fresh edits, generation advance, playback and replacement invalidate recovery before undo can overwrite work',async()=>{
 const edits=[
  h=>h.key('Enter'),h=>h.key(' '),h=>tap(h,0,0),h=>click(h,'life-toggle'),
  h=>click(h,'step'),h=>click(h,'pause'),h=>click(h,'life-test'),h=>click(h,'reset'),
  h=>click(h,'preset'),h=>(h.el('preset-select').handlers.change({target:{value:'blinker'}}),h.el('load-preset').handlers.click()),
  h=>click(h,'life-challenge-start'),h=>click(h,'guide-start'),h=>click(h,'mission-start'),
  h=>h.navigate('?experiment=life&rate=3&density=20'),
  h=>{const event={pointerId:1,button:0,isPrimary:true,clientX:1,clientY:1};h.el('canvas').handlers.pointerdown(event);h.el('canvas').handlers.pointermove({...event,buttons:1,clientX:30});}
 ];
 for(const edit of edits){
  const h=await setup('?experiment=life');click(h,'clear');assert.equal(available(h),true);
  edit(h);assert.equal(available(h),false);const current=state(h);click(h,'life-undo-clear');assert.deepEqual(state(h),current);
 }
});

test('clear and undo cancel an interrupted pointer stroke and reject stale release clicks',async()=>{
 const h=await setup('?experiment=life');const e={pointerId:12,button:0,isPrimary:true,clientX:1,clientY:1};
 h.el('canvas').handlers.pointerdown(e);h.el('canvas').handlers.pointermove({...e,buttons:1,clientX:45});
 const before=drawing(h);click(h,'clear');click(h,'life-undo-clear');assert.deepEqual(drawing(h),before);
 const restored=state(h);
 h.el('canvas').handlers.pointermove({...e,buttons:1,clientX:100});h.el('canvas').handlers.pointerup({...e,type:'pointerup',clientX:100});h.el('canvas').handlers.click({...e,clientX:100});
 assert.deepEqual(state(h),restored);
 // A new pointerdown without a changed cell retains recovery until an actual edit.
 click(h,'clear');h.el('canvas').handlers.pointerdown({...e,pointerId:13});click(h,'life-undo-clear');
 assert.deepEqual(drawing(h),before);
});

test('restoring after a rate change retains the saved fractional generation and never auto-resumes',async()=>{
 const h=await setup('?experiment=life&rate=1','',false);h.tick(0);for(let t=50;t<=900;t+=50)h.tick(t);
 assert.match(h.el('metrics').textContent,/第 0 代/);click(h,'clear');assert.equal(h.frames.size,0);
 input(h,'rate',20);click(h,'life-undo-clear');assert.match(h.el('metrics').textContent,/第 0 代/);assert.equal(h.frames.size,0);
 click(h,'pause');h.tick(5000);h.tick(5010);assert.match(h.el('metrics').textContent,/第 1 代/);
});

test('empty boards at a later generation can be recovered without inventing cells',async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');tap(h,1,1);click(h,'step');
 assert.match(h.el('metrics').textContent,/第 1 代 · 0 个活格子/);const before=drawing(h);click(h,'clear');
 assert.equal(available(h),true);assert.match(h.el('life-clear-status').textContent,/恢复第 1 代的 0 个活格/);
 click(h,'life-undo-clear');assert.deepEqual(drawing(h),before);
});

test('clear recovery leaves earned notes, active discovery checks and other worlds unchanged',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');
 for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 click(h,'mission-check');const notes=h.el('field-notes-list').innerHTML,mission=h.el('mission-state').textContent;
 click(h,'clear');click(h,'life-undo-clear');assert.equal(h.el('field-notes-list').innerHTML,notes);assert.equal(h.el('mission-state').textContent,mission);
 click(h,'clear');for(const i of [0,2,3,4]){
  h.tabs[i].handlers.click();const before=state(h);click(h,'clear');click(h,'life-undo-clear');assert.deepEqual(state(h),before);
 }
 h.tabs[1].handlers.click();assert.equal(available(h),true);
 const fresh=await setup('?experiment=life');assert.equal(available(fresh),false);
});

test('undo is a quiet described native button near Clear with a wrapping 44px target and current assets',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<button id="life-undo-clear" aria-disabled="true" aria-describedby="life-clear-status" hidden>撤销清空 ↶<\/button>/);
 assert.match(html,/<p id="life-clear-status" class="life-clear-status" aria-live="off" hidden>/);
 assert.ok(html.indexOf('id="clear"')<html.indexOf('id="life-undo-clear"'));
 assert.ok(html.indexOf('id="life-undo-clear"')<html.indexOf('id="life-touch"'));
 assert.ok(html.includes('app.js?v=fractal-choice-reading-1'));assert.ok(html.includes('style.css?v=life-turnover-1'));
 const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.match(css,/#life-undo-clear\{min-height:44px;white-space:normal\}/);
 assert.match(css,/#life-undo-clear\[aria-disabled="true"\]/);assert.match(css,/\.life-clear-status\{[^}]*overflow-wrap:anywhere/);
});
