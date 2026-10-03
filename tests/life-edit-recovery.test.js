import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';
import {paintLifeLine} from '../painting.js';

const click=(h,id)=>h.el(id).handlers.click();
const available=h=>h.el('life-undo-edit').getAttribute('aria-disabled')==='false';
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const drawing=h=>({canvas:h.drawing(),metrics:h.el('metrics').textContent,history:h.el('history-line').getAttribute('points'),caption:h.el('history-caption').textContent,selection:h.el('life-selection').textContent,trial:h.el('life-test-result').textContent,returnHidden:h.el('life-return').hidden,trialRoute:h.el('life-trial-view').hidden,rewind:h.el('life-back').getAttribute('aria-disabled')});
const state=h=>({drawing:drawing(h),draws:h.drawCount(),status:h.el('status').textContent,frames:h.frames.size,url:location.href,writes:h.writes(),message:h.el('announcement').textContent,notes:h.el('field-notes-list').innerHTML,mission:h.el('mission-result').textContent});
function pointer(h,type,x,y,extra={}){
 const r=h.el('canvas').getBoundingClientRect();
 h.el('canvas').handlers[type]?.({type,pointerId:1,button:0,buttons:['pointerdown','pointermove'].includes(type)?1:0,isPrimary:true,clientX:r.left+(x+.5)*r.width/48,clientY:r.top+(y+.5)*r.height/32,...extra});
}
function tap(h,x,y){pointer(h,'pointerdown',x,y);pointer(h,'pointerup',x,y);pointer(h,'click',x,y);}
function stroke(h,from,to){pointer(h,'pointerdown',...from);pointer(h,'pointermove',...to);pointer(h,'pointerup',...to);pointer(h,'click',...to);}
async function blank(){const h=await setup('?experiment=life');click(h,'life-challenge-start');return h;}

for(const [name,edit] of [['tap',h=>tap(h,2,3)],['Enter',h=>h.key('Enter')],['Space',h=>h.key(' ')],['precision button',h=>click(h,'life-toggle')]])test(`undo restores a ${name} once, including selection, history and focus`,async()=>{
 const h=await blank();const before=drawing(h),url=location.href,writes=h.writes();
 assert.equal(available(h),false);edit(h);assert.equal(available(h),true);assert.notDeepEqual(drawing(h),before);
 const button=h.el('life-undo-edit');button.focus();Object.defineProperty(button,'disabled',{set:()=>assert.fail('undo must retain native focus')});
 click(h,'life-undo-edit');assert.deepEqual(drawing(h),before);assert.equal(available(h),false);assert.equal(document.activeElement,button);
 assert.equal(h.frames.size,0);assert.equal(location.href,url);assert.equal(h.writes(),writes);assert.match(h.el('announcement').textContent,/已撤销上一笔并暂停/);
 const restored=state(h);for(let i=0;i<6;i++)click(h,'life-undo-edit');assert.deepEqual(state(h),restored);
});

test('a synthesized tap without pointerdown pauses before editing so its recovery remains usable',async()=>{
 const h=await setup('?experiment=life','',false);
 // Undo pauses: compare with the same paused board and its neighbor overlay.
 click(h,'pause');const before=drawing(h);click(h,'pause');assert.equal(h.frames.size,1);
 pointer(h,'click',4,4,{detail:0});assert.equal(h.frames.size,0);assert.equal(available(h),true);
 click(h,'life-undo-edit');assert.deepEqual(drawing(h),before);assert.equal(h.frames.size,0);
});

test('one undo covers every draw segment, retrace, final release sample and clamped edge',async()=>{
 const h=await blank();tap(h,10,20);const before=drawing(h);
 pointer(h,'pointerdown',2,3);pointer(h,'pointermove',10,3);pointer(h,'pointermove',2,3);pointer(h,'pointermove',10,11);pointer(h,'pointerup',60,40);pointer(h,'click',60,40);
 assert.equal(available(h),true);assert.notDeepEqual(drawing(h),before);click(h,'life-undo-edit');assert.deepEqual(drawing(h),before);
});

test('an eraser undo restores all erased cells and leaves the chosen tool active',async()=>{
 const h=await blank();stroke(h,[2,3],[12,3]);stroke(h,[2,4],[12,4]);const before=drawing(h);click(h,'life-erase');
 pointer(h,'pointerdown',2,3);pointer(h,'pointermove',12,3);pointer(h,'pointermove',12,4);pointer(h,'pointerup',2,4);pointer(h,'click',2,4);
 assert.match(h.el('metrics').textContent,/0 个活格子/);click(h,'life-undo-edit');assert.deepEqual(drawing(h),before);
 assert.equal(h.el('life-erase').getAttribute('aria-pressed'),'true');assert.equal(available(h),false);
});

test('only the latest edit is retained; repeated undo cannot reveal an older board',async()=>{
 const h=await blank();tap(h,1,1);const first=drawing(h);tap(h,5,5);click(h,'life-undo-edit');assert.deepEqual(drawing(h),first);
 const restored=state(h);click(h,'life-undo-edit');assert.deepEqual(state(h),restored);tap(h,8,8);click(h,'life-undo-edit');assert.deepEqual(drawing(h),first);
});

test('no-op strokes do not replace a useful edit, clear recovery, comparison or recorded generations',async()=>{
 const h=await blank();const blankBoard=drawing(h);stroke(h,[2,3],[12,3]);stroke(h,[2,3],[12,3]);click(h,'life-undo-edit');assert.deepEqual(drawing(h),blankBoard);
 stroke(h,[2,3],[12,3]);click(h,'clear');click(h,'life-erase');stroke(h,[2,3],[12,3]);
 assert.equal(h.el('life-undo-clear').getAttribute('aria-disabled'),'false');assert.equal(available(h),false);
 click(h,'life-undo-clear');click(h,'step');click(h,'life-test');const result=h.el('life-test-result').textContent,history=h.el('history-caption').textContent;
 stroke(h,[40,25],[45,25]);assert.equal(h.el('life-return').hidden,false);assert.equal(h.el('life-test-result').textContent,result);assert.equal(h.el('history-caption').textContent,history);
 assert.equal(available(h),false);
});

test('a drag that first crosses unchanged cells still restores the gesture-start selection and board',async()=>{
 const h=await blank();stroke(h,[2,3],[6,3]);h.key('ArrowDown');const before=drawing(h);
 pointer(h,'pointerdown',2,3);pointer(h,'pointermove',6,3);pointer(h,'pointermove',12,3);pointer(h,'pointerup',12,3);pointer(h,'click',12,3);
 click(h,'life-undo-edit');assert.deepEqual(drawing(h),before);
});

test('cancelled partial strokes remain recoverable and their delayed events cannot reapply the edit',async()=>{
 for(const cancel of ['pointercancel','lostpointercapture','blur','resize','tool','key']){
  const h=await blank();const before=drawing(h);pointer(h,'pointerdown',2,3);pointer(h,'pointermove',10,3);
  if(cancel==='blur')h.windowHandlers.blur();else if(cancel==='resize')h.resize(300,207);else if(cancel==='tool')click(h,'life-erase');else if(cancel==='key')h.key('ArrowDown');else pointer(h,cancel,20,20);
  if(cancel==='resize')h.resize(600,414);
  assert.equal(available(h),true,cancel);click(h,'life-undo-edit');assert.deepEqual(drawing(h),before,cancel);
  const restored=state(h);for(const type of ['pointermove','pointerup','click'])pointer(h,type,20,20);assert.deepEqual(state(h),restored,cancel);
 }
});

test('undo during a captured stroke cancels it before restoring; a fresh tap starts new recovery',async()=>{
 const h=await blank(),captures=new Set(),canvas=h.el('canvas');
 canvas.setPointerCapture=id=>captures.add(id);canvas.hasPointerCapture=id=>captures.has(id);canvas.releasePointerCapture=id=>{captures.delete(id);pointer(h,'lostpointercapture',10,3,{pointerId:id});};
 const before=drawing(h);pointer(h,'pointerdown',2,3);pointer(h,'pointermove',10,3);click(h,'life-undo-edit');assert.equal(captures.size,0);assert.deepEqual(drawing(h),before);
 const restored=state(h);for(const type of ['pointermove','pointerup','click'])pointer(h,type,20,20);assert.deepEqual(state(h),restored);
 tap(h,5,5);assert.equal(available(h),true);click(h,'life-undo-edit');assert.deepEqual(drawing(h),before);
});

test('a cancelled contact with no edit retains the previous undo',async()=>{
 const h=await blank(),before=drawing(h);tap(h,5,5);pointer(h,'pointerdown',8,8);pointer(h,'pointercancel',8,8);pointer(h,'click',8,8);
 click(h,'life-undo-edit');assert.deepEqual(drawing(h),before);
});

test('undo restores comparison overlays and the existing return-to-original drawing',async()=>{
 const h=await blank();stroke(h,[2,3],[4,3]);tap(h,9,9);const original=drawing(h);click(h,'life-test');const compared=drawing(h);
 tap(h,20,20);assert.equal(h.el('life-return').hidden,true);click(h,'life-undo-edit');assert.deepEqual(drawing(h),compared);
 click(h,'life-return');assert.deepEqual(drawing(h),original);assert.equal(available(h),false);
});

test('undo restores pre-edit generation history and its rewind availability',async()=>{
 const h=await setup('?experiment=life');click(h,'step');click(h,'step');const before=drawing(h);tap(h,4,4);
 assert.equal(h.el('life-back').getAttribute('aria-disabled'),'true');click(h,'life-undo-edit');assert.deepEqual(drawing(h),before);
 click(h,'life-back');assert.match(h.el('metrics').textContent,/第 1 代/);assert.equal(available(h),false);
});

test('cursor, tool, resize, parameters, sharing, anchor navigation and tab visits retain undo',async()=>{
 const h=await setup('?experiment=life');click(h,'step');const before=drawing(h);tap(h,4,4);h.key('ArrowRight');click(h,'life-down');click(h,'life-erase');
 h.resize(286,245);input(h,'rate',20);input(h,'density',60);await click(h,'share');const shared=h.el('share-link').value;
 for(const index of [0,2,3,4]){h.tabs[index].handlers.click();const other=state(h);click(h,'life-undo-edit');assert.deepEqual(state(h),other);h.tabs[1].handlers.click();assert.equal(available(h),true);}
 h.navigate(location.search+'#observation-title');h.resize(600,414);const url=location.href,writes=h.writes();click(h,'life-undo-edit');assert.deepEqual(drawing(h),before);
 assert.equal(h.el('rate').value,'20');assert.equal(h.el('density').value,'60');assert.equal(h.el('life-erase').getAttribute('aria-pressed'),'true');assert.equal(location.href,url);assert.equal(h.writes(),writes);
 assert.equal(new URL(shared).searchParams.has('undo'),false);assert.equal(new URL(shared).searchParams.has('at'),false);
});

test('continuing, advancing, clearing, comparison and replacement expire edit recovery',async()=>{
 const actions=[h=>click(h,'pause'),h=>click(h,'step'),h=>click(h,'clear'),h=>click(h,'life-test'),h=>click(h,'reset'),h=>click(h,'preset'),h=>{h.el('preset-select').handlers.change({target:{value:'blinker'}});click(h,'load-preset');},h=>click(h,'guide-start'),h=>click(h,'mission-start'),h=>click(h,'life-challenge-start'),h=>h.navigate('?experiment=life&rate=3&density=40')];
 for(const action of actions){const h=await blank();tap(h,4,4);assert.equal(available(h),true);action(h);assert.equal(available(h),false);const after=state(h);click(h,'life-undo-edit');assert.deepEqual(state(h),after);}
});

test('Clear and Undo Clear do not build a chain of past drawing recoveries',async()=>{
 const h=await blank();tap(h,5,5);const before=drawing(h);click(h,'clear');assert.equal(available(h),false);click(h,'life-undo-clear');assert.deepEqual(drawing(h),before);assert.equal(available(h),false);
 click(h,'clear');tap(h,4,4);click(h,'life-undo-edit');assert.equal(available(h),false);assert.equal(h.el('life-undo-clear').getAttribute('aria-disabled'),'true');
});

test('undo preserves the interrupted fractional generation through a later rate change',async()=>{
 const h=await setup('?experiment=life&rate=1','',false);h.tick(0);for(let t=50;t<=900;t+=50)h.tick(t);
 tap(h,4,4);input(h,'rate',20);click(h,'life-undo-edit');assert.match(h.el('metrics').textContent,/第 0 代/);assert.equal(h.frames.size,0);
 click(h,'pause');h.tick(5000);h.tick(5010);assert.match(h.el('metrics').textContent,/第 1 代/);
});

test('drawing undo neither completes a discovery nor changes earned notes',async()=>{
 const h=await blank();click(h,'mission-start');for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 const block=drawing(h);tap(h,1,1);click(h,'life-undo-edit');assert.deepEqual(drawing(h),block);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const notes=h.el('field-notes-list').innerHTML,mission=h.el('mission-result').textContent;tap(h,1,1);click(h,'life-undo-edit');assert.equal(h.el('field-notes-list').innerHTML,notes);assert.equal(h.el('mission-result').textContent,mission);
 const fresh=await setup('?experiment=life');assert.equal(available(fresh),false);
});

test('paint helper counts only cells whose state actually changes',()=>{
 const cells=new Uint8Array(81);assert.equal(paintLifeLine(cells,9,{x:1,y:1},{x:7,y:1}),7);assert.equal(paintLifeLine(cells,9,{x:1,y:1},{x:7,y:1}),0);
 assert.equal(paintLifeLine(cells,9,{x:5,y:1},{x:8,y:1}),1);assert.equal(paintLifeLine(cells,9,{x:1,y:1},{x:8,y:1},0),8);assert.equal(paintLifeLine(cells,9,{x:1,y:1},{x:8,y:1},0),0);
});

test('undo has a quiet described native control beside drawing tools, with a wrapping 44px target',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 const group=html.slice(html.indexOf('id="life-touch"'),html.indexOf('id="wave-touch"'));
 assert.match(group,/<button id="life-undo-edit" type="button" aria-disabled="true" aria-controls="canvas" aria-describedby="life-edit-status life-edit-help">撤销上一笔 ↶<\/button>/);
 assert.match(group,/<span id="life-edit-status" aria-live="off">/);assert.doesNotMatch(group,/aria-live="polite"|role="status"/);
 assert.match(group,/继续、推进、对比、清空或载入图案后失效/);assert.match(css,/\.life-touch \.life-edit-actions\{[^}]*flex-wrap:wrap/);assert.match(css,/\.life-touch #life-undo-edit\{[^}]*min-height:44px;white-space:normal/);
 assert.match(html,/app\.js\?v=walk-marker-contrast-1/);assert.match(html,/style\.css\?v=walk-scale-1/);
});
