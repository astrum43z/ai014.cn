import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const available=h=>h.el('life-undo-edit').getAttribute('aria-disabled')==='false';
const board=h=>({drawing:h.drawing(),metrics:h.el('metrics').textContent,selection:h.el('life-selection').textContent,history:h.el('history-caption').textContent,trial:h.el('life-test-result').textContent,returnHidden:h.el('life-return').hidden});
const state=h=>({board:board(h),draws:h.drawCount(),frames:h.frames.size,announcement:h.el('announcement').textContent,url:location.href,writes:h.writes(),notes:h.el('field-notes-list').innerHTML,mission:h.el('mission-result').textContent});
function key(h,extra={}){
 let prevented=false;
 h.key('z',{ctrlKey:true,preventDefault(){prevented=true;},...extra});
 return prevented;
}
function pointer(h,type,x,y,extra={}){
 const r=h.el('canvas').getBoundingClientRect();
 h.el('canvas').handlers[type]?.({type,pointerId:1,button:0,buttons:['pointerdown','pointermove'].includes(type)?1:0,isPrimary:true,clientX:r.left+(x+.5)*r.width/48,clientY:r.top+(y+.5)*r.height/32,...extra});
}
async function blank(){const h=await setup('?experiment=life');click(h,'life-challenge-start');h.el('canvas').focus();return h;}

for(const [name,extra] of [['Control',{}],['Meta',{ctrlKey:false,metaKey:true}],['Caps Lock',{key:'Z'}]])test(`${name}+Z restores a keyboard edit and keeps focus ready to draw`,async()=>{
 const h=await blank(),before=board(h),url=location.href,writes=h.writes();
 h.key('Enter');assert.equal(available(h),true);assert.notDeepEqual(board(h),before);
 assert.equal(key(h,extra),true);assert.deepEqual(board(h),before);assert.equal(available(h),false);
 assert.equal(document.activeElement,h.el('canvas'));assert.equal(h.frames.size,0);assert.equal(location.href,url);assert.equal(h.writes(),writes);
 assert.match(h.el('announcement').textContent,/已撤销上一笔并暂停/);
 h.key('ArrowRight');h.key(' ');assert.equal(available(h),true);assert.match(h.el('metrics').textContent,/1 个活格子/);
});

test('held undo never consumes a later edit; a separate press can recover it',async()=>{
 const h=await blank();h.key('Enter');key(h);const undone=state(h);
 for(let i=0;i<8;i++)assert.equal(key(h,{repeat:true}),true);
 assert.deepEqual(state(h),undone);
 h.key('ArrowRight');const before=board(h);h.key('Enter');const later=state(h);
 assert.equal(key(h,{repeat:true}),true);assert.deepEqual(state(h),later);assert.equal(available(h),true);
 key(h);assert.deepEqual(board(h),before);assert.equal(available(h),false);
});

test('unavailable undo is quiet and cannot pause or redraw a running simulation',async()=>{
 const h=await setup('?experiment=life','',false);h.el('canvas').focus();assert.equal(available(h),false);const before=state(h);
 for(let i=0;i<3;i++)assert.equal(key(h),true);
 assert.deepEqual(state(h),before);assert.equal(h.frames.size,1);
});

test('unmodified Z, redo, AltGr, IME and unrelated modified keys retain their defaults',async()=>{
 const h=await blank();h.key('Enter');const before=state(h);
 for(const extra of [{ctrlKey:false},{shiftKey:true},{altKey:true},{isComposing:true},{key:'y'},{key:'Escape'},{key:'Z',shiftKey:true},{ctrlKey:false,metaKey:true,shiftKey:true},{ctrlKey:false,metaKey:true,isComposing:true}]){
  assert.equal(key(h,extra),false,JSON.stringify(extra));assert.deepEqual(state(h),before);assert.equal(available(h),true);
 }
});

test('undo shares the existing full-stroke recovery, including erasing and pointer cancellation',async()=>{
 const h=await blank();pointer(h,'pointerdown',2,3);pointer(h,'pointermove',12,3);pointer(h,'pointerup',12,3);pointer(h,'click',12,3);
 const before=board(h);click(h,'life-erase');pointer(h,'pointerdown',2,3);pointer(h,'pointermove',12,3);
 assert.match(h.el('metrics').textContent,/0 个活格子/);assert.equal(key(h),true);assert.deepEqual(board(h),before);
 assert.equal(h.el('life-erase').getAttribute('aria-pressed'),'true');assert.equal(document.activeElement,h.el('canvas'));
 const restored=state(h);for(const type of ['pointermove','pointerup','click'])pointer(h,type,20,20);assert.deepEqual(state(h),restored);
});

test('button and shortcut consume the same single recovery without exposing older edits',async()=>{
 const h=await blank();h.key('Enter');const one=board(h);h.key('ArrowRight');h.key('Enter');click(h,'life-undo-edit');
 assert.match(h.el('metrics').textContent,/1 个活格子/);const first=state(h);key(h);assert.deepEqual(state(h),first);
 h.key('ArrowLeft');assert.deepEqual(board(h),one);h.key('Enter');key(h);const second=state(h);click(h,'life-undo-edit');assert.deepEqual(state(h),second);
});

test('shortcut restores recorded generations and comparison overlays through the same undo',async()=>{
 const h=await setup('?experiment=life');click(h,'step');click(h,'step');click(h,'life-test');const before=board(h);h.el('canvas').focus();
 h.key('Enter');assert.equal(h.el('life-return').hidden,true);key(h);assert.deepEqual(board(h),before);assert.equal(h.el('life-return').hidden,false);
 assert.equal(document.activeElement,h.el('canvas'));click(h,'life-return');assert.match(h.el('metrics').textContent,/第 2 代/);
});

test('retained recovery and shortcut description follow tab and anchor returns without rewriting a link',async()=>{
 const h=await blank(),before=board(h);h.key('Enter');await click(h,'share');const shared=h.el('share-link').value;
 h.tabs[2].handlers.click();assert.equal(h.el('canvas').getAttribute('aria-keyshortcuts')||'','');assert.equal(h.el('canvas').getAttribute('aria-describedby')||'','');
 h.tabs[1].handlers.click();h.navigate(location.search+'#canvas');h.el('canvas').focus();const url=location.href,writes=h.writes();
 key(h);assert.deepEqual(board(h),before);assert.equal(location.href,url);assert.equal(h.writes(),writes);assert.equal(new URL(shared).searchParams.has('undo'),false);
 assert.equal(h.el('canvas').getAttribute('aria-keyshortcuts'),'Control+z Meta+z');assert.equal(h.el('canvas').getAttribute('aria-describedby'),'life-edit-help');
});

test('expired undo cannot roll back a model step, a Clear recovery or a replacement URL',async()=>{
 for(const expire of [h=>click(h,'step'),h=>click(h,'clear'),h=>h.navigate('?experiment=life&rate=3&density=40')]){
  const h=await blank();h.key('Enter');expire(h);const before=state(h);assert.equal(available(h),false);key(h);assert.deepEqual(state(h),before);
 }
});

for(const experiment of ['orbit','wave','fractal','walk'])test(`undo shortcut is not intercepted in ${experiment}`,async()=>{
 const h=await setup('?experiment='+experiment,'',false),before=state(h);
 assert.equal(key(h),false);assert.equal(key(h,{ctrlKey:false,metaKey:true}),false);assert.deepEqual(state(h),before);
 assert.equal(h.el('canvas').getAttribute('aria-keyshortcuts')||'',experiment==='fractal'?'ArrowLeft ArrowRight':'');
 assert.equal(h.el('canvas').getAttribute('aria-describedby')||'',experiment==='fractal'?'fractal-touch-help':'');
});

test('shortcut never checks an exploration or rewrites earned notebook entries',async()=>{
 const h=await blank();click(h,'mission-start');for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 const block=board(h);h.key('ArrowLeft');h.key('Enter');key(h);assert.match(h.el('metrics').textContent,/4 个活格子/);assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('field-notes-list').innerHTML,mission=h.el('mission-result').textContent;
 h.key('Enter');key(h);assert.equal(h.el('field-notes-list').innerHTML,notes);assert.equal(h.el('mission-result').textContent,mission);assert.equal(h.el('metrics').textContent,block.metrics);
});

test('shortcut is canvas-scoped with quiet visible help and no global keyboard listener',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),source=await readFile(new URL('../app.js',import.meta.url),'utf8');
 assert.match(html,/<small id="life-edit-help">聚焦画布时，Ctrl \+ Z（Mac：⌘ \+ Z）撤销上一笔，焦点留在画布。只保留最后一次绘制/);
 assert.doesNotMatch(source,/(?:document\.|window\.)?addEventListener\('keydown',.*undoLifeEdit/);
 assert.equal((source.match(/function undoLifeEdit\(/g)||[]).length,1);
 assert.match(source,/\$\('#life-undo-edit'\)\.addEventListener\('click',undoLifeEdit\)/);
 assert.match(html,/app\.js\?v=life-turnover-1/);
});
