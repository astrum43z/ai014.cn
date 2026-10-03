import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';
import {paintLifeLine} from '../painting.js';

const click=(h,id)=>h.el(id).handlers.click();
const erasing=h=>h.el('life-erase').getAttribute('aria-pressed')==='true';
const metrics=h=>h.el('metrics').textContent;
function pointer(h,type,x,y,extra={}){
 const r=h.el('canvas').getBoundingClientRect();
 h.el('canvas').handlers[type]?.({type,pointerId:1,button:0,buttons:['pointerdown','pointermove'].includes(type)?1:0,isPrimary:true,clientX:r.left+(x+.5)*r.width/48,clientY:r.top+(y+.5)*r.height/32,...extra});
}
function stroke(h,from,to,extra={}){
 pointer(h,'pointerdown',...from,extra);pointer(h,'pointermove',...to,extra);
 pointer(h,'pointerup',...to,extra);pointer(h,'click',...to,extra);
}
function tap(h,x,y){pointer(h,'pointerdown',x,y);pointer(h,'pointerup',x,y);pointer(h,'click',x,y);}
const board=h=>h.drawing().filter(([type,x,y,w,height])=>type==='fillRect'&&w<20&&height<20).map(([,x,y])=>[Math.round((x-.6)/12.5),Math.round((y-.6)/(414/32))]);
const state=h=>({canvas:h.drawing(),metrics:metrics(h),history:h.el('history-line').getAttribute('points'),caption:h.el('history-caption').textContent,selection:h.el('life-selection').textContent,trial:h.el('life-test-result').textContent,trialRoute:h.el('life-trial-view').hidden,recovery:h.el('life-undo-clear').getAttribute('aria-disabled'),rewind:h.el('life-back').getAttribute('aria-disabled'),url:location.href,writes:h.writes(),frames:h.frames.size,status:h.el('status').textContent,mission:h.el('mission-result').textContent,notes:h.el('field-notes-list').innerHTML});
async function blank(){const h=await setup('?experiment=life');click(h,'life-challenge-start');return h;}
function enter(h,repeat=false){let prevented=false;h.el('life-erase').handlers.keydown?.({key:'Enter',repeat,preventDefault(){prevented=true;}});if(!prevented)click(h,'life-erase');return prevented;}

for(const [from,to] of [[{x:1,y:1},{x:7,y:1}],[{x:1,y:1},{x:1,y:7}],[{x:1,y:1},{x:7,y:7}],[{x:1,y:7},{x:7,y:1}],[{x:1,y:1},{x:7,y:4}],[{x:1,y:1},{x:4,y:7}]])test(`eraser uses exactly the connected paint path ${JSON.stringify(from)} → ${JSON.stringify(to)}`,()=>{
 const painted=new Uint8Array(81);paintLifeLine(painted,9,from,to);
 const erased=new Uint8Array(81).fill(1);paintLifeLine(erased,9,from,to,0);
 assert.deepEqual([...erased],[...painted].map(value=>1-value));
 const repeated=erased.slice();paintLifeLine(erased,9,from,to,0);assert.deepEqual(erased,repeated,'retracing does not switch any cell back on');
 const reverse=new Uint8Array(81).fill(1);paintLifeLine(reverse,9,to,from,0);
 assert.equal(reverse[from.y*9+from.x],0);assert.equal(reverse[to.y*9+to.x],0);
 assert.equal(reverse.reduce((n,v)=>n+v),erased.reduce((n,v)=>n+v));
});

test('drag erasing removes both endpoints and sparse intermediate samples, never a neighboring row',async()=>{
 const h=await blank();assert.equal(erasing(h),false);
 stroke(h,[2,4],[43,4]);stroke(h,[2,5],[43,5]);assert.match(metrics(h),/84 个活格子/);
 click(h,'life-erase');assert.equal(erasing(h),true);stroke(h,[2,4],[43,4]);
 assert.deepEqual(board(h),Array.from({length:42},(_,i)=>[i+2,5]));
 assert.match(h.el('announcement').textContent,/擦除完成.*活细胞 · 42/);
 stroke(h,[43,4],[2,4]);assert.match(metrics(h),/42 个活格子/,'repeated erasure remains empty');
 click(h,'life-erase');stroke(h,[2,4],[43,4]);assert.match(metrics(h),/84 个活格子/);
 assert.match(h.el('announcement').textContent,/绘制完成/);assert.equal(h.frames.size,0);
});

test('erasing handles final release samples, diagonals and captured edge clamping without wrapping',async()=>{
 const h=await blank();stroke(h,[3,3],[7,7]);stroke(h,[7,7],[7,11]);tap(h,0,31);
 click(h,'life-erase');pointer(h,'pointerdown',3,3);pointer(h,'pointermove',7,7);pointer(h,'pointerup',7,11);pointer(h,'click',7,11);
 assert.deepEqual(board(h),[[0,31]]);
 click(h,'life-erase');stroke(h,[46,30],[70,50]);click(h,'life-erase');stroke(h,[46,30],[70,50]);
 assert.deepEqual(board(h),[[0,31]]);
 h.resize(240,160);stroke(h,[0,31],[-20,31]);assert.match(metrics(h),/0 个活格子/);
});

test('taps, same-cell jitter, canvas keys and precision toggles still toggle in erase mode',async()=>{
 const h=await blank();click(h,'life-erase');
 for(const expected of [1,0]){tap(h,3,3);assert.match(metrics(h),new RegExp(`${expected} 个活格子`));}
 pointer(h,'pointerdown',3,3);pointer(h,'pointermove',3,3);pointer(h,'pointerup',3,3);pointer(h,'click',3,3);
 assert.match(metrics(h),/1 个活格子/);
 h.key('Enter');assert.match(metrics(h),/0 个活格子/);h.key(' ');assert.match(metrics(h),/1 个活格子/);
 click(h,'life-toggle');assert.match(metrics(h),/0 个活格子/);click(h,'life-toggle');assert.match(metrics(h),/1 个活格子/);
 assert.equal(erasing(h),true);assert.match(h.el('life-drag-status').textContent,/当前拖动：擦除/);
});

test('choosing the tool leaves exact experiment, comparison, recovery and running state intact',async()=>{
 for(const kind of ['running','history','comparison','recovery']){
  const h=await setup('?experiment=life','',kind!=='running');
  if(kind==='history'){click(h,'step');click(h,'step');}
  if(kind==='comparison')click(h,'life-test');
  if(kind==='recovery')click(h,'clear');
  h.el('life-erase').focus();const before=state(h),draws=h.drawCount();
  click(h,'life-erase');assert.deepEqual(state(h),before,kind);assert.equal(h.drawCount(),draws);
  assert.equal(document.activeElement,h.el('life-erase'));assert.match(h.el('announcement').textContent,/当前拖动：擦除.*仍切换生灭/);
  click(h,'life-erase');assert.deepEqual(state(h),before,kind);
 }
});

test('switching tools interrupts the old stroke before a stale release can erase or repaint',async()=>{
 for(const startingErase of [false,true]){
  const h=await blank();stroke(h,[2,4],[10,4]);if(startingErase)click(h,'life-erase');
  const captures=new Set();h.el('canvas').setPointerCapture=id=>captures.add(id);h.el('canvas').hasPointerCapture=id=>captures.has(id);
  h.el('canvas').releasePointerCapture=id=>{captures.delete(id);pointer(h,'lostpointercapture',30,20,{pointerId:id});};
  pointer(h,'pointerdown',2,4);pointer(h,'pointermove',4,4);assert.equal(captures.size,1);
  const before=state(h);click(h,'life-erase');assert.equal(captures.size,0);assert.deepEqual(state(h),before);
  for(const type of ['pointermove','pointerup','click'])pointer(h,type,10,4);
  assert.deepEqual(state(h),before,'old coordinates cannot use the newly selected tool');
  stroke(h,[6,4],[10,4]);assert.notDeepEqual(state(h).canvas,before.canvas,'a fresh gesture uses the new tool');
 }
});

test('erase gestures retain the existing ownership, pause and cancellation rules',async()=>{
 for(const cancel of ['pointercancel','lostpointercapture','blur','resize','step','key']){
  const h=await blank();stroke(h,[2,4],[20,4]);click(h,'life-erase');click(h,'pause');assert.equal(h.frames.size,1);
  pointer(h,'pointerdown',2,4);assert.equal(h.frames.size,0);pointer(h,'pointermove',4,4);
  const owned=state(h);pointer(h,'pointermove',20,4,{pointerId:2,isPrimary:false});pointer(h,'pointerup',20,4,{pointerId:2});assert.deepEqual(state(h),owned);
  if(cancel==='blur')h.windowHandlers.blur();else if(cancel==='resize')h.resize(300,207);else if(cancel==='step')click(h,'step');else if(cancel==='key')h.key('ArrowRight');else pointer(h,cancel,20,4);
  const stopped=state(h);for(const type of ['pointermove','pointerup','click'])pointer(h,type,20,4);assert.deepEqual(state(h),stopped,cancel);
 }
});

test('an actual erasing edit invalidates old comparison and clear recovery, while Clear undo keeps the edited board',async()=>{
 const h=await blank();stroke(h,[2,4],[6,4]);click(h,'life-test');click(h,'life-erase');
 assert.equal(h.el('life-return').hidden,false);stroke(h,[2,4],[6,4]);assert.equal(h.el('life-return').hidden,true);
 assert.equal(h.el('life-trial-view').hidden,true);assert.equal(h.el('life-back').getAttribute('aria-disabled'),'true');
 const before=state(h);click(h,'clear');assert.equal(h.el('life-undo-clear').getAttribute('aria-disabled'),'false');
 click(h,'life-undo-clear');assert.equal(erasing(h),true);assert.deepEqual(state(h),before);
 click(h,'clear');stroke(h,[2,4],[6,4]);assert.equal(h.el('life-undo-clear').getAttribute('aria-disabled'),'false','erasing empty cells does not replace recovery');
 tap(h,2,4);assert.equal(h.el('life-undo-clear').getAttribute('aria-disabled'),'true');
 const edited=state(h);click(h,'life-undo-clear');assert.deepEqual(state(h),edited);
});

test('held Enter selects the drag tool once; fresh Enter, native Space and clicks remain available',async()=>{
 const h=await blank();h.el('life-erase').focus();assert.equal(enter(h),false);assert.equal(erasing(h),true);
 const before=state(h),message=h.el('announcement').textContent;
 for(let i=0;i<12;i++)assert.equal(enter(h,true),true);
 assert.equal(erasing(h),true);assert.deepEqual(state(h),before);assert.equal(h.el('announcement').textContent,message);
 assert.equal(enter(h),false);assert.equal(erasing(h),false);
 for(const key of [' ','Tab','ArrowRight','Escape'])for(const repeat of [false,true]){
  let prevented=false;h.el('life-erase').handlers.keydown({key,repeat,preventDefault(){prevented=true;}});assert.equal(prevented,false);
 }
 click(h,'life-erase');assert.equal(erasing(h),true);
});

test('the page-only choice survives reset, guide, presets, tabs and URL restoration, never enters links',async()=>{
 const h=await blank();click(h,'life-erase');
 for(const id of ['clear','reset','guide-start','mission-start','preset']){click(h,id);assert.equal(erasing(h),true,id);}
 h.el('preset-select').handlers.change({target:{value:'blinker'}});click(h,'load-preset');assert.equal(erasing(h),true);
 await click(h,'share');assert.equal(new URL(h.el('share-link').value).searchParams.has('erase'),false);
 for(const index of [0,2,3,4]){
  h.tabs[index].handlers.click();assert.equal(h.el('life-touch').hidden,true);
  const before=state(h);click(h,'life-erase');assert.deepEqual(state(h),before,'stray hidden tool activation is inert');
  h.tabs[1].handlers.click();assert.equal(erasing(h),true);assert.equal(h.el('life-touch').hidden,false);
 }
 h.navigate('?experiment=life&rate=2&density=40#canvas');assert.equal(erasing(h),true);
 const fresh=await setup('?experiment=life');assert.equal(erasing(fresh),false,'a new page starts with ordinary painting');
});

test('erasing never completes a discovery and preserves earned notebook entries',async()=>{
 const h=await blank();click(h,'mission-start');stroke(h,[2,4],[7,4]);click(h,'life-erase');stroke(h,[2,4],[3,4]);
 assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'mission-start');for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const note=h.el('field-notes-list').innerHTML;
 stroke(h,[23,15],[24,15]);assert.equal(h.el('field-notes-list').innerHTML,note);
});

test('eraser is a described native toggle with a quiet visible state and wrapping 44px target',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<button id="life-erase" type="button" aria-pressed="false" aria-controls="canvas" aria-describedby="life-drag-status life-drag-help">拖动擦除<\/button>/);
 assert.match(html,/<span id="life-drag-status" aria-live="off">当前拖动：点亮<\/span>/);
 assert.match(html,/<small id="life-drag-help">开关只改变拖动：关闭时点亮，开启时擦除。轻点、Enter 与逐格按钮仍切换生灭。<\/small>/);
 const group=html.slice(html.indexOf('id="life-touch"'),html.indexOf('id="wave-touch"'));
 assert.ok(group.includes('id="life-erase"'));assert.doesNotMatch(group,/aria-live="polite"|role="status"/);
 assert.match(css,/\.life-touch \.life-drag-tool\{[^}]*flex-wrap:wrap/);
 assert.match(css,/\.life-touch #life-erase\{[^}]*min-height:44px;white-space:normal/);
 assert.match(html,/app\.js\?v=life-cursor-contrast-1/);assert.match(html,/style\.css\?v=focus-safe-copy-1/);
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');assert.match(app,/painting\.js\?v=edit-recovery-1/);
});
