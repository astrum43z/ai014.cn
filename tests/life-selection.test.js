import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';
const click=(h,id)=>h.el(id).handlers.click();
const selection=h=>h.el('life-selection').textContent;
function consistent(h){
 const position=h.el('life-cell-position').textContent;
 const state=h.el('life-cell-state').textContent.match(/当前：(活格|空格) · 活邻居 (\d) \/ 8/);
 assert.equal(selection(h),`${position} · ${state[1]} · ${state[2]} 个活邻居`);
 assert.equal(h.el('life-toggle').textContent,state[1]==='活格'?'熄灭所选格':'点亮所选格');
}
function pointer(h,type,x,y){h.el('canvas').handlers[type]({type,pointerId:1,clientX:(x+.5)*600/48,clientY:(y+.5)*414/32,button:0,isPrimary:true});}

test('near-canvas readout describes the empty mission start and repeated toggle actions',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');
 assert.equal(selection(h),'第 24 列，第 16 行 · 空格 · 0 个活邻居');consistent(h);
 for(let i=0;i<4;i++){click(h,'life-toggle');consistent(h);}
 assert.match(selection(h),/空格/);assert.equal(h.frames.size,0);
});

test('precise movement updates coordinates and neighbors without editing the board',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');click(h,'life-toggle');click(h,'life-right');
 assert.equal(selection(h),'第 25 列，第 16 行 · 空格 · 1 个活邻居');consistent(h);
 click(h,'life-left');assert.match(selection(h),/活格 · 0 个活邻居/);consistent(h);
 for(let i=0;i<24;i++)click(h,'life-left');
 assert.match(selection(h),/^第 48 列，第 16 行/);consistent(h);
 assert.match(h.el('metrics').textContent,/1 个活格子/);
});

test('keyboard edits, pointer taps, and drag endpoints refresh the same readout',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');h.key('Enter');consistent(h);
 h.key('ArrowRight');consistent(h);h.key(' ');consistent(h);
 pointer(h,'pointerdown',0,0);pointer(h,'pointerup',0,0);pointer(h,'click',0,0);
 assert.equal(selection(h),'第 1 列，第 1 行 · 活格 · 0 个活邻居');consistent(h);
 pointer(h,'pointerdown',2,4);pointer(h,'pointermove',7,4);pointer(h,'pointerup',7,4);pointer(h,'click',7,4);
 assert.equal(selection(h),'第 8 列，第 5 行 · 活格 · 1 个活邻居');consistent(h);
});

test('generations, presets, resets, and clearing never leave stale selected-cell state',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');click(h,'life-toggle');
 click(h,'step');assert.match(selection(h),/空格 · 0 个活邻居/);consistent(h);
 for(const id of ['preset','reset','clear','guide-start','life-test','life-return']){click(h,id);consistent(h);}
});

test('animation updates quietly and tab return restores the selected cell',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');click(h,'life-toggle');
 const saved=selection(h);h.tabs[0].handlers.click();assert.equal(h.el('life-touch').hidden,true);
 h.tabs[1].handlers.click();assert.equal(selection(h),saved);assert.equal(h.el('life-touch').hidden,false);consistent(h);
 click(h,'pause');const announcement=h.el('announcement').textContent;
 for(let t=0;t<=2000;t+=40)h.tick(t);
 consistent(h);assert.match(selection(h),/空格/);assert.equal(h.el('announcement').textContent,announcement);
});

test('new URL state and repeated mission starts replace stale editing feedback',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');click(h,'life-toggle');
 h.navigate('?experiment=life&rate=3&density=20');consistent(h);
 for(let i=0;i<2;i++){click(h,'mission-start');assert.equal(selection(h),'第 24 列，第 16 行 · 空格 · 0 个活邻居');consistent(h);}
});

test('readout is outside collapsed instruments, quiet, wrapped, and associated with the toggle',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<p id="life-selection" aria-live="off"><\/p>/);
 assert.match(html,/<button id="life-toggle" aria-describedby="life-selection">点亮所选格<\/button>/);
 assert.ok(html.indexOf('id="life-selection"')<html.indexOf('id="instrument-summary"'));
 assert.match(css,/\.life-touch #life-selection\{[^}]*overflow-wrap:anywhere/);
});
