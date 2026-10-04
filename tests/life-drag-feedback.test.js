import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
function pointer(h,type,x=2,extra={}){
 h.el('canvas').handlers[type]({type,pointerId:7,isPrimary:true,button:0,buttons:type==='pointerdown'||type==='pointermove'?1:0,clientX:(x+.5)*600/48,clientY:4.5*414/32,detail:type==='click'?1:0,...extra});
}
function snapshot(h){
 const callbacks=[],downloads=[];h.el('canvas').toBlob=callback=>callbacks.push(callback);
 h.el('generated').click=()=>downloads.push(h.el('generated').download);
 return {downloads,finish(success){callbacks.shift()(success?new Blob(['png']):null);}};
}
const state=h=>({drawing:h.drawing(),metrics:h.el('metrics').textContent,selection:h.el('life-selection').textContent,history:h.el('history-caption').textContent,trial:h.el('life-test-result').textContent,undo:h.el('life-undo-edit').getAttribute('aria-disabled'),clear:h.el('life-undo-clear').getAttribute('aria-disabled'),url:location.href,link:h.el('share-link').value,notes:h.el('field-notes-list').innerHTML,frames:[...h.frames.keys()],focus:document.activeElement});
async function blank(){const h=await setup('?experiment=life');click(h,'clear');h.el('canvas').focus();return h;}
const interruptions={
 active:()=>{},
 pointercancel:h=>pointer(h,'pointercancel',4),
 lostpointercapture:h=>pointer(h,'lostpointercapture',4),
 blur:h=>h.windowHandlers.blur(),
 hidden:h=>h.setHidden(true),
 geometry:h=>h.resize(233,240),
 context:h=>h.loseContext(),
 released:h=>pointer(h,'pointermove',5,{buttons:0})
};
for(const [interruption,interrupt] of Object.entries(interruptions))for(const success of [true,false])test(`a changed Life drag keeps older PNG ${success?'success':'failure'} quiet after ${interruption}`,async()=>{
 const h=await blank(),s=snapshot(h);click(h,'save');const latest=h.el('announcement').textContent;
 pointer(h,'pointerdown');pointer(h,'pointermove',4);assert.match(h.el('metrics').textContent,/3 个活格子/);
 assert.equal(h.el('announcement').textContent,latest,'drag samples must not add speech');interrupt(h);
 const before=state(h);s.finish(success);
 assert.equal(h.el('announcement').textContent,latest);assert.deepEqual(state(h),before);
 assert.match(h.el('save-status').textContent,success?/已发起.*PNG.*下载列表/:/失败.*重试/);
 assert.equal(h.el('save').getAttribute('aria-busy'),'false');assert.equal(h.el('save').getAttribute('aria-disabled'),'false');
 assert.deepEqual(s.downloads,success?['small-worlds-life.png']:[]);
 if(interruption==='context'){h.setContextReady(true);h.restoreContext();}
 if(interruption==='hidden')h.setHidden(false);
 click(h,'life-undo-edit');assert.match(h.el('metrics').textContent,/0 个活格子/);
});

for(const erase of [false,true])test(`${erase?'erasing':'painting'} each changed segment supersedes a save started mid-stroke`,async()=>{
 const h=await blank(),s=snapshot(h);
 if(erase){pointer(h,'pointerdown');pointer(h,'pointermove',8);pointer(h,'pointerup',8);click(h,'life-erase');}
 pointer(h,'pointerdown');pointer(h,'pointermove',3);
 click(h,'save');const latest=h.el('announcement').textContent;
 pointer(h,'pointermove',5);assert.equal(h.el('announcement').textContent,latest);
 const before=state(h);s.finish(false);assert.equal(h.el('announcement').textContent,latest);assert.deepEqual(state(h),before);
 pointer(h,'pointerup',5);assert.match(h.el('announcement').textContent,erase?/擦除完成/:/绘制完成/);
 const completed=state(h);pointer(h,'click',5);assert.deepEqual(state(h),completed,'trailing click stays suppressed');
 click(h,'save');s.finish(true);assert.equal(h.el('announcement').textContent,h.el('save-status').textContent,'fresh saves still announce');
});

for(const erase of [false,true])test(`${erase?'empty erase':'occupied paint'} no-op segments keep the latest save eligible`,async()=>{
 const h=await blank(),s=snapshot(h);
 if(erase)click(h,'life-erase');
 pointer(h,'pointerdown');pointer(h,'pointermove',4);pointer(h,'pointerup',4);
 click(h,'save');pointer(h,'pointerdown');pointer(h,'pointermove',4);pointer(h,'pointercancel',4);
 const before=state(h);s.finish(false);assert.equal(h.el('announcement').textContent,h.el('save-status').textContent);assert.deepEqual(state(h),before);
});

test('same-cell, invalid and unrelated pointer samples leave a pending save eligible',async()=>{
 for(const extra of [{},{clientX:NaN},{clientX:Infinity},{pointerId:8}]){
  const h=await blank(),s=snapshot(h);click(h,'save');pointer(h,'pointerdown');pointer(h,'pointermove',2,extra);
  pointer(h,'pointercancel');const before=state(h);s.finish(false);
  assert.equal(h.el('announcement').textContent,h.el('save-status').textContent);assert.deepEqual(state(h),before);
 }
});

test('a save started after the last edit remains eligible through quiet redraws and cancellation',async()=>{
 const h=await blank(),s=snapshot(h);pointer(h,'pointerdown');pointer(h,'pointermove',4);click(h,'save');
 pointer(h,'pointermove',4);h.setDpr(2);pointer(h,'pointercancel',4);
 const before=state(h);s.finish(true);assert.equal(h.el('announcement').textContent,h.el('save-status').textContent);assert.deepEqual(state(h),before);
});

test('a completed drag still announces once and retains precedence over an older save',async()=>{
 const h=await blank(),s=snapshot(h);click(h,'save');pointer(h,'pointerdown');pointer(h,'pointermove',4);pointer(h,'pointerup',4);
 const latest=h.el('announcement').textContent;assert.match(latest,/绘制完成.*3/);s.finish(true);assert.equal(h.el('announcement').textContent,latest);
});

test('a pending Life parameter copy keeps its fixed URL and visible outcome after drawing',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');let finish;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(resolve=>finish=resolve)}}});
 try{
  const h=await blank(),pending=click(h,'share'),url=h.el('share-link').value,latest=h.el('announcement').textContent;
  h.el('canvas').focus();pointer(h,'pointerdown');pointer(h,'pointermove',4);pointer(h,'pointercancel',4);const before=state(h);
  finish();await pending;assert.equal(h.el('announcement').textContent,latest);assert.deepEqual(state(h),before);
  assert.equal(h.el('share-link').value,url);assert.match(h.el('share-status').textContent,/已复制.*参数链接/);
 }finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
});

test('the published module key invalidates changed drag feedback code',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/&amp;drag-feedback=meaningful-action-1(?:&amp;|\")/);
});

for(const success of [true,false])test(`a running Life press supersedes older PNG ${success?'success':'failure'} when it pauses without editing`,async()=>{
 const h=await blank(),s=snapshot(h);click(h,'pause');click(h,'save');const latest=h.el('announcement').textContent;
 pointer(h,'pointerdown');pointer(h,'pointercancel');assert.equal(h.el('status').textContent,'已暂停');assert.match(h.el('metrics').textContent,/0 个活格子/);
 const before=state(h);s.finish(success);assert.equal(h.el('announcement').textContent,latest);assert.deepEqual(state(h),before);
});

test('selection-only dragging owns newer readings without claiming a board edit',async()=>{
 const h=await blank(),s=snapshot(h);click(h,'life-erase');click(h,'save');const latest=h.el('announcement').textContent;
 pointer(h,'pointerdown');pointer(h,'pointermove',4);pointer(h,'pointercancel',4);
 assert.match(h.el('metrics').textContent,/0 个活格子/);assert.match(h.el('life-selection').textContent,/第 5 列，第 5 行/);
 assert.equal(h.el('life-undo-edit').getAttribute('aria-disabled'),'true');
 const before=state(h);s.finish(false);assert.equal(h.el('announcement').textContent,latest);assert.deepEqual(state(h),before);
});
