import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '];
const board=h=>({drawing:h.drawing(),metrics:h.el('metrics').textContent,selection:h.el('life-selection').textContent,history:h.el('history-caption').textContent,trial:h.el('life-test-result').textContent,returnHidden:h.el('life-return').hidden});
const state=h=>({board:board(h),draws:h.drawCount(),frames:h.frames.size,status:h.el('status').textContent,announcement:h.el('announcement').textContent,url:location.href,writes:h.writes(),undo:h.el('life-undo-edit').getAttribute('aria-disabled'),clear:h.el('life-undo-clear').getAttribute('aria-disabled'),mission:h.el('mission-result').textContent,notes:h.el('field-notes-list').innerHTML});
function key(h,key,extra={}){
 let prevented=false;
 h.key(key,{preventDefault(){prevented=true;},...extra});
 return prevented;
}
async function blank(){const h=await setup('?experiment=life');click(h,'life-challenge-start');h.el('canvas').focus();return h;}
function shiftedKeys(h){for(const name of keys)for(const repeat of [false,true])assert.equal(key(h,name,{shiftKey:true,repeat}),false,name);}

for(const name of keys)test(`Shift+${JSON.stringify(name)} leaves browser navigation and Life state untouched`,async()=>{
 for(const running of [false,true]){
  const h=await setup('?experiment=life','',!running);h.el('canvas').focus();const before=state(h);
  for(const repeat of [false,true,true])assert.equal(key(h,name,{shiftKey:true,repeat}),false);
  assert.deepEqual(state(h),before);assert.equal(document.activeElement,h.el('canvas'));
 }
});

test('modified navigation retains the current drawing recovery instead of replacing it',async()=>{
 const h=await blank(),empty=board(h);h.key('Enter');const edited=state(h);
 shiftedKeys(h);assert.deepEqual(state(h),edited);
 assert.equal(key(h,'z',{ctrlKey:true}),true);assert.deepEqual(board(h),empty);
 h.key(' ');const next=board(h);h.key('ArrowRight');h.key('Enter');
 const newer=state(h);shiftedKeys(h);assert.deepEqual(state(h),newer);
 assert.equal(key(h,'z',{metaKey:true}),true);h.key('ArrowLeft');assert.deepEqual(board(h),next);
});

test('browser navigation does not discard a comparison or its original-board return',async()=>{
 const h=await blank();h.key('Enter');h.key('ArrowRight');h.key('Enter');h.key('ArrowRight');h.key('Enter');
 const original=board(h);click(h,'life-test');assert.equal(h.el('life-return').hidden,false);const trial=state(h);
 shiftedKeys(h);assert.deepEqual(state(h),trial);assert.equal(h.el('life-trial-result-link').hidden,false);
 click(h,'life-return');assert.equal(h.el('metrics').textContent,original.metrics);
 assert.deepEqual(h.drawing(),original.drawing);
});

test('Shift+Space preserves Clear recovery and recorded generations',async()=>{
 const h=await setup('?experiment=life');click(h,'step');click(h,'step');const before=board(h);
 click(h,'clear');assert.equal(h.el('life-undo-clear').getAttribute('aria-disabled'),'false');const cleared=state(h);
 shiftedKeys(h);assert.deepEqual(state(h),cleared);
 click(h,'life-undo-clear');assert.deepEqual(board(h),before);
});

test('all modifier combinations remain unhandled while plain keys still move and toggle once',async()=>{
 const h=await blank(),before=state(h);
 for(const name of keys)for(const extra of [{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true,ctrlKey:true},{shiftKey:true,metaKey:true},{shiftKey:true,altKey:true}]){
  assert.equal(key(h,name,extra),false);assert.deepEqual(state(h),before);
 }
 assert.equal(key(h,'ArrowRight'),true);assert.match(h.el('life-selection').textContent,/第 25 列，第 16 行/);
 assert.equal(key(h,' '),true);assert.match(h.el('metrics').textContent,/1 个活格子/);
 const edited=state(h);assert.equal(key(h,' ',{repeat:true}),true);assert.deepEqual(state(h),edited);
 assert.equal(key(h,'Enter'),true);assert.match(h.el('metrics').textContent,/0 个活格子/);
});

test('a Shift-modified key does not terminate or redirect an active pointer stroke',async()=>{
 const h=await blank();const captures=new Set();
 h.el('canvas').setPointerCapture=id=>captures.add(id);h.el('canvas').hasPointerCapture=id=>captures.has(id);h.el('canvas').releasePointerCapture=id=>captures.delete(id);
 const pointer=(type,x)=>h.el('canvas').handlers[type]({type,pointerId:1,isPrimary:true,button:0,buttons:type==='pointerup'?0:1,clientX:(x+.5)*600/48,clientY:4.5*414/32});
 pointer('pointerdown',2);pointer('pointermove',4);const before=state(h);
 shiftedKeys(h);assert.deepEqual(state(h),before);assert.equal(captures.has(1),true);
 pointer('pointermove',6);pointer('pointerup',6);assert.match(h.el('metrics').textContent,/5 个活格子/);
 h.key('z',{ctrlKey:true});assert.match(h.el('metrics').textContent,/0 个活格子/);
});

test('Shift navigation preserves a retained experiment, parameter link and earned discovery',async()=>{
 const h=await blank();click(h,'mission-start');
 for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 h.navigate(location.search+'#canvas');await click(h,'share');const shared=h.el('share-link').value;
 h.tabs[2].handlers.click();h.tabs[1].handlers.click();h.navigate(location.search+'#canvas');h.el('canvas').focus();
 const before=state(h);shiftedKeys(h);assert.deepEqual(state(h),before);assert.equal(h.el('share-link').value,shared);
 assert.equal(h.el('notes-count').textContent,'1 / 5');
});

test('Shift navigation never changes the other four experiments',async()=>{
 for(const world of ['orbit','wave','fractal','walk']){
  const h=await setup('?experiment='+world,'',false),before=state(h);
  shiftedKeys(h);assert.deepEqual(state(h),before);
 }
});
