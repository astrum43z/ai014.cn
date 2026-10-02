import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

// Model native Enter activation: each unprevented keydown clicks the button.
// Public-browser QA separately checks the native keydown/default-action path.
function enter(h,repeat=false){
 let prevented=false;
 h.el('life-toggle').handlers.keydown?.({key:'Enter',repeat,preventDefault(){prevented=true;}});
 if(!prevented)h.el('life-toggle').handlers.click();
 return prevented;
}
const click=(h,id)=>h.el(id).handlers.click();
const snapshot=h=>({
 readings:['metrics','life-selection','life-test-result','announcement','status'].map(id=>h.el(id).textContent),
 draws:h.drawCount(),url:location.href,writes:h.writes(),frames:h.frames.size
});

test('Life toggle button handles one Enter press once, then allows a new press',async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');click(h,'pause');
 h.el('life-toggle').focus();assert.equal(h.frames.size,1);
 assert.equal(enter(h),false,'native first activation is retained');
 assert.match(h.el('metrics').textContent,/1 个活格子/);
 assert.equal(h.frames.size,0,'editing pauses the simulation');
 const first=snapshot(h);
 for(let i=0;i<12;i++)assert.equal(enter(h,true),true);
 assert.deepEqual(snapshot(h),first,'no repeat edits, redraws, announcements or URL changes');
 assert.equal(document.activeElement,h.el('life-toggle'));
 enter(h);assert.match(h.el('metrics').textContent,/0 个活格子/);
 enter(h);assert.match(h.el('metrics').textContent,/1 个活格子/);
});

test('stray held Enter on the toggle cannot discard a Life challenge comparison',async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');enter(h);click(h,'life-test');
 const before=snapshot(h);assert.equal(h.el('life-return').hidden,false);
 for(let i=0;i<3;i++)assert.equal(enter(h,true),true);
 assert.deepEqual(snapshot(h),before);assert.equal(h.el('life-return').hidden,false);
 click(h,'life-return');assert.match(h.el('metrics').textContent,/1 个活格子/);
});

test('Space, Tab and other native keys remain untouched; separate clicks still toggle',async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');
 let prevented=0;
 for(const key of [' ','Tab','ArrowLeft','ArrowRight','Escape'])for(const repeat of [false,true]){
  h.el('life-toggle').handlers.keydown?.({key,repeat,preventDefault(){prevented++;}});
 }
 assert.equal(prevented,0,'Space keeps native keyup activation and Tab keeps navigation');
 for(const count of [1,0,1,0]){
  click(h,'life-toggle');assert.match(h.el('metrics').textContent,new RegExp(count+' 个活格子'));
 }
 click(h,'life-right');click(h,'life-right');
 assert.match(h.el('life-selection').textContent,/第 26 列，第 16 行/);
});

test('the Enter repeat guard survives tab return, reset and history restoration',async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');enter(h);
 h.tabs[0].handlers.click();const other=snapshot(h);
 assert.equal(enter(h,true),true);assert.deepEqual(snapshot(h),other);
 h.tabs[1].handlers.click();assert.match(h.el('metrics').textContent,/1 个活格子/);
 for(const action of [()=>{},()=>click(h,'reset'),()=>h.navigate('?experiment=life&rate=3&density=20')]){
  action();const before=snapshot(h);assert.equal(enter(h,true),true);assert.deepEqual(snapshot(h),before);
  enter(h);assert.notEqual(h.el('life-selection').textContent,before.readings[1]);
 }
});
