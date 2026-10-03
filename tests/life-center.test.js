import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click?.();
const cells=h=>h.drawing().filter(([op,, ,w])=>op==='fillRect'&&w!==600);
const board=h=>({cells:cells(h),metrics:h.el('metrics').textContent,history:h.el('history-caption').textContent,turnover:h.el('life-turnover').textContent,trial:h.el('life-test-result').textContent,trialHidden:h.el('life-return').hidden,undo:h.el('life-undo-edit').getAttribute('aria-disabled'),clear:h.el('life-undo-clear').getAttribute('aria-disabled'),url:location.href,writes:h.writes(),mission:h.el('mission-result').textContent,notes:h.el('field-notes-list').innerHTML});
const state=h=>({...board(h),selection:h.el('life-selection').textContent,draws:h.drawCount(),frames:h.frames.size,announcement:h.el('announcement').textContent,draw:h.drawing()});
function home(h,extra={}){let prevented=false;h.key('Home',{preventDefault(){prevented=true;},...extra});return prevented;}
function pointer(h,type,x,y,id=7){h.el('canvas').handlers[type]({type,pointerId:id,isPrimary:true,button:0,buttons:type==='pointerup'?0:1,clientX:(x+.5)*600/48,clientY:(y+.5)*414/32});}
function preset(h,name){h.el('preset-select').handlers.change({target:{value:name}});click(h,'load-preset');}
function center(h){assert.match(h.el('life-selection').textContent,/第 25 列，第 17 行/);assert.equal(h.el('status').textContent,'已暂停');assert.equal(h.frames.size,0);}

for(const method of ['Home','button'])test(`${method} selects the central Life cell without replacing a running board`,async()=>{
 const h=await setup('?experiment=life','',false);preset(h,'blinker');h.el('canvas').focus();
 const before=board(h),focus=method==='Home'?h.el('canvas'):h.el('life-center');focus.focus();
 if(method==='Home')assert.equal(home(h),true);else click(h,'life-center');
 center(h);assert.deepEqual(board(h),before);assert.equal(document.activeElement,focus);
 assert.match(h.el('announcement').textContent,/框选回到中央.*未改动图案/);
 click(h,'step');assert.match(h.el('metrics').textContent,/第 1 代 · 3 个活格子/);
 click(h,'life-back');assert.deepEqual(cells(h),before.cells);
});

test('Home reaches the same default central cell from every edge and remains deterministic after resize',async()=>{
 const h=await setup('?experiment=life');
 for(const [x,y] of [[0,0],[47,0],[0,31],[47,31]]){
  pointer(h,'click',x,y);const before=board(h);assert.equal(home(h),true);center(h);assert.deepEqual(board(h),before);
 }
 h.resize(280,210);h.key('ArrowLeft');h.key('ArrowUp');home(h);center(h);
 h.resize(600,414);center(h);
});

test('held Home and modified or composing Home do not consume browser keys or mutate Life state',async()=>{
 const h=await setup('?experiment=life');preset(h,'pulsar');const before=state(h);
 for(const extra of [{repeat:true},{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true},{isComposing:true}]){
  assert.equal(home(h,extra),Boolean(extra.repeat));assert.deepEqual(state(h),before);
 }
 home(h);const selected=state(h);home(h,{repeat:true});assert.deepEqual(state(h),selected);
});

test('the center button leaves the first Enter native and suppresses held Enter activation',async()=>{
 const h=await setup('?experiment=life');const button=h.el('life-center');button.focus();
 for(const [key,repeat,expected] of [['Enter',false,false],['Enter',true,true],[' ',true,false],['Tab',false,false]]){
  let prevented=false;button.handlers.keydown?.({key,repeat,preventDefault(){prevented=true;}});assert.equal(prevented,expected);
 }
});

test('central selection preserves one-level edit undo and clear recovery',async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');const empty=board(h);
 h.key('Enter');h.key('ArrowRight');h.key('Enter');const drawn=board(h);
 home(h);center(h);assert.deepEqual(board(h),drawn);
 click(h,'life-undo-edit');assert.match(h.el('metrics').textContent,/1 个活格子/);
 click(h,'clear');const cleared=board(h);home(h);assert.deepEqual(board(h),cleared);
 click(h,'life-undo-clear');assert.match(h.el('metrics').textContent,/1 个活格子/);
 assert.notDeepEqual(cells(h),empty.cells);
});

test('central selection retains a completed Life comparison and its original-board return',async()=>{
 const h=await setup('?experiment=life');preset(h,'blinker');const original=board(h);click(h,'life-test');const trial=board(h);
 home(h);center(h);assert.deepEqual(board(h),trial);click(h,'life-return');assert.deepEqual(cells(h),original.cells);assert.equal(h.el('metrics').textContent,original.metrics);
});

for(const drag of [false,true])test(`Home safely ends an active ${drag?'stroke':'pending tap'} without a trailing edit`,async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');const captures=new Set();
 h.el('canvas').setPointerCapture=id=>captures.add(id);h.el('canvas').hasPointerCapture=id=>captures.has(id);h.el('canvas').releasePointerCapture=id=>captures.delete(id);
 pointer(h,'pointerdown',2,4);if(drag)pointer(h,'pointermove',4,4);const before=board(h);
 home(h);center(h);assert.equal(captures.size,0);assert.deepEqual(board(h),before);
 pointer(h,'pointermove',8,4);pointer(h,'pointerup',8,4);pointer(h,'click',8,4);assert.deepEqual(board(h),before);center(h);
 if(drag){click(h,'life-undo-edit');assert.match(h.el('metrics').textContent,/0 个活格子/);}
});

test('the button interrupts an existing stroke using the same non-editing path',async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');pointer(h,'pointerdown',2,4);pointer(h,'pointermove',5,4);const before=board(h);
 click(h,'life-center');pointer(h,'pointerup',9,4);pointer(h,'click',9,4);center(h);assert.deepEqual(board(h),before);click(h,'life-undo-edit');assert.match(h.el('metrics').textContent,/0 个活格子/);
});

test('center selection retains discovery evidence, parameter links and per-world sessions',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');
 for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');await click(h,'share');const shared=h.el('share-link').value,before=board(h);
 home(h);center(h);assert.deepEqual(board(h),before);assert.equal(h.el('share-link').value,shared);
 h.tabs[2].handlers.click();h.tabs[1].handlers.click();center(h);assert.deepEqual(cells(h),before.cells);assert.equal(h.el('notes-count').textContent,'1 / 5');
});

test('visibility, density and context restoration preserve the central selection and pause',async()=>{
 const h=await setup('?experiment=life','',false);preset(h,'pulsar');home(h);const before=board(h);
 h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);h.setDpr(2);h.loseContext();h.restoreContext();
 center(h);assert.deepEqual(board(h),before);
});

test('a stale Life center button does nothing in the other worlds',async()=>{
 for(const mode of ['orbit','wave','fractal','walk']){
  const h=await setup('?experiment='+mode),before=state(h);click(h,'life-center');assert.deepEqual(state(h),before);
 }
});

test('the center control is explicit, associated and outside the narrow arrow grid',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<p class="life-center-actions"><button id="life-center" type="button" aria-controls="canvas" aria-describedby="life-center-help">框选回中央<\/button><small id="life-center-help">[^<]*Home[^<]*第 25 列[^<]*第 17 行[^<]*不改动图案/);
 assert.match(css,/\.life-touch \.life-center-actions\{[^}]*flex-wrap:wrap/);
 assert.match(css,/\.life-touch #life-center\{[^}]*min-height:44px/);
});
