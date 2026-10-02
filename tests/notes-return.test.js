import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';
const modes=['orbit','life','wave','fractal','walk'];
const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
function complete(h,mode){
 click(h,'mission-start');
 if(mode==='life'){
  for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 }else if(mode==='fractal'){
  click(h,'fractal-1000');click(h,'mission-check');input(h,'seed',15);click(h,'fractal-1000');
 }else{
  click(h,'mission-check');
  if(mode==='wave')click(h,'wave-home');
  if(mode==='walk')click(h,'walk-64');
  if(mode==='orbit'){input(h,'gravity',40);for(let i=0;i<70;i++)click(h,'step');}
 }
 click(h,'mission-check');assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');
}
const snapshot=h=>({metrics:h.el('metrics').textContent,readings:['a','b','c'].map(k=>h.el('observation-'+k).textContent),status:h.el('status').textContent,drawing:h.drawing(),url:location.href,notes:h.el('field-notes-list').innerHTML,mission:h.el('mission-state').textContent});
const returnTo=(h,mode)=>h.el('field-notes-list').handlers.click({target:{closest:selector=>{assert.equal(selector,'[data-return-world]');return {dataset:{returnWorld:mode}};}}});
for(const mode of modes)test(mode+': note return preserves later progress, checkpoint, mission and other worlds',async()=>{
 const h=await setup('?experiment='+mode,'#field-notes');complete(h,mode);
 await h.el('share').handlers.click();
 click(h,'step'); // The current world is newer than its historical note and shared checkpoint.
 const before=snapshot(h);
 const other=modes[(modes.indexOf(mode)+1)%modes.length];click(h,'tab-'+other);click(h,'step');const otherBefore=snapshot(h);
 let scrolled=0,focused=0;
 h.el('panel').scrollIntoView=options=>{assert.deepEqual(options,{block:'start'});scrolled++;};
 h.el('canvas').focus=options=>{assert.deepEqual(options,{preventScroll:true});focused++;};
 returnTo(h,mode);assert.deepEqual(snapshot(h),before);assert.equal(h.frames.size,0);
 assert.match(h.el('announcement').textContent,/保留当前画布与参数.*完成时的记录.*已暂停/);
 returnTo(h,mode);assert.deepEqual(snapshot(h),before,'active world return does not reset');
 assert.equal(scrolled,2);assert.equal(focused,2);
 click(h,'tab-'+other);assert.deepEqual(snapshot(h),otherBefore,'outgoing world is retained');
});

test('returning to a running world retains its clock and one frame chain',async()=>{
 const h=await setup('?experiment=walk');complete(h,'walk');click(h,'pause');h.tick(0);h.tick(50);const before=h.el('metrics').textContent;
 click(h,'tab-life');click(h,'pause');assert.equal(h.frames.size,0);
 returnTo(h,'walk');assert.equal(h.frames.size,1);assert.equal(h.el('metrics').textContent,before);
 h.tick(90000);assert.equal(h.el('metrics').textContent,before,'no catch-up after returning');
 assert.match(h.el('announcement').textContent,/继续运行/);
 for(let i=0;i<10;i++)returnTo(h,'walk');assert.equal(h.frames.size,1);
});

test('text clicks, invalid worlds and worlds without notes do nothing',async()=>{
 const h=await setup('?experiment=wave');complete(h,'wave');const before=snapshot(h);
 h.el('field-notes-list').handlers.click({target:{closest:()=>null}});
 for(const mode of ['life','unknown','__proto__'])returnTo(h,mode);
 assert.deepEqual(snapshot(h),before);
});

test('each completed note has a named native button, contextual explanation and 44px target',async()=>{
 for(const mode of modes){
  const h=await setup('?experiment='+mode);complete(h,mode);
  assert.match(h.el('field-notes-list').innerHTML,new RegExp('<button data-return-world="'+mode+'" aria-label="回到这个世界：[^"<>]+，保留当前进度" aria-describedby="notes-return-help">回到这个世界 ↑</button>'));
 }
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<small id="notes-return-help">笔记记录完成时的发现；回到世界会保留当前进度，不会重新开始。/);
 const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.match(css,/\.field-notes li button\{[^}]*min-height:44px;[^}]*max-width:100%;[^}]*white-space:normal/);
});
