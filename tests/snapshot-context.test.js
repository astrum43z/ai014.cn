import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const state=h=>({drawing:h.drawing(),metrics:h.el('metrics').textContent,status:h.el('status').textContent,href:location.href,frames:[...h.frames.keys()],notes:h.el('field-notes-list').innerHTML,selected:h.el('life-selection').textContent});
const names={orbit:'引力游乐场',life:'生命的形状',wave:'波与波相遇',fractal:'随机长出秩序',walk:'漫步也会扩散'};
function capture(h){
 const callbacks=[],downloads=[],pictures=[];
 h.el('canvas').toBlob=callback=>{pictures.push(h.drawing());callbacks.push(callback);};
 h.el('generated').click=()=>downloads.push(h.el('generated').download);
 return {callbacks,downloads,pictures};
}

for(const [world,title] of Object.entries(names))test(`${world}: unavailable canvas rejects PNG capture without changing the experiment or focus`,async()=>{
 const h=await setup('?experiment='+world,'',false),s=capture(h);click(h,'step');h.el('save').focus();
 h.loseContext();const before=state(h);
 for(let i=0;i<3;i++)click(h,'save');
 assert.equal(s.callbacks.length,0,'do not encode a missing canvas bitmap');assert.deepEqual(s.downloads,[]);
 assert.equal(h.el('save-status').hidden,false);assert.match(h.el('save-status').textContent,new RegExp(title+'.*画布暂时不可用.*未生成图片.*恢复后.*保存这一刻'));
 assert.equal(h.el('announcement').textContent,h.el('save-status').textContent);
 assert.notEqual(h.el('save').getAttribute('aria-disabled'),'true');assert.notEqual(h.el('save').getAttribute('aria-busy'),'true');
 assert.equal(document.activeElement,h.el('save'));assert.deepEqual(state(h),before);
});

for(const [world,title] of Object.entries(names))test(`${world}: recovery never auto-downloads; a fresh save captures the repainted current canvas`,async()=>{
 const h=await setup('?experiment='+world,'',true,2),s=capture(h);h.loseContext();click(h,'save');
 click(h,'step');const metrics=h.el('metrics').textContent,url=location.href;h.restoreContext();
 assert.equal(s.callbacks.length,0);assert.deepEqual(s.downloads,[]);
 const before=state(h);click(h,'save');assert.equal(s.callbacks.length,1);assert.deepEqual(s.pictures[0],before.drawing);
 assert.equal(h.el('save-status').textContent,`正在生成「${title}」PNG 图片…`);
 s.callbacks.shift()(new Blob(['png']));assert.deepEqual(s.downloads,[`small-worlds-${world}.png`]);
 assert.equal(h.el('save-status').textContent,`已发起「${title}」PNG 图片下载，请查看浏览器下载列表`);
 assert.equal(h.el('save').getAttribute('aria-disabled'),'false');assert.equal(h.el('save').getAttribute('aria-busy'),'false');
 assert.equal(h.el('metrics').textContent,metrics);assert.equal(location.href,url);assert.deepEqual(state(h),before);
});

test('an already captured PNG finishes with its original name during loss; repeats leave its pending feedback intact',async()=>{
 for(const success of [true,false]){
  const h=await setup('?experiment=life'),s=capture(h);h.el('save').focus();click(h,'save');
  const pending=h.el('save-status').textContent,pixels=s.pictures[0];h.loseContext();h.tabs[2].handlers.click();h.el('tab-wave').focus();
  click(h,'save');assert.equal(s.callbacks.length,1);assert.equal(h.el('save-status').textContent,pending);
  assert.equal(h.el('save').getAttribute('aria-busy'),'true');
  s.callbacks.shift()(success?new Blob(['png']):null);
  assert.deepEqual(s.downloads,success?['small-worlds-life.png']:[]);assert.ok(pixels.length);
  assert.match(h.el('save-status').textContent,success?/已发起.*生命的形状/:/生命的形状.*失败/);
  assert.equal(document.activeElement,h.el('tab-wave'));assert.equal(h.el('save').getAttribute('aria-busy'),'false');
  click(h,'save');assert.equal(s.callbacks.length,0);assert.match(h.el('save-status').textContent,/波与波相遇.*画布暂时不可用/);
  h.restoreContext();assert.equal(s.callbacks.length,0);click(h,'save');s.callbacks.shift()(new Blob(['png']));
  assert.equal(s.downloads.at(-1),'small-worlds-wave.png');assert.match(h.el('save-status').textContent,/已发起.*波与波相遇/);
 }
});

test('blocked saving preserves a partial Life stroke recovery, generation history and completed discovery',async()=>{
 const h=await setup('?experiment=life'),s=capture(h);click(h,'mission-start');
 for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 click(h,'mission-check');assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');
 const note=h.el('field-notes-list').innerHTML;click(h,'step');const stable=h.el('metrics').textContent;
 const canvas=h.el('canvas'),event=(x,y)=>({pointerId:91,button:0,isPrimary:true,clientX:x,clientY:y});
 canvas.handlers.pointerdown(event(30,30));canvas.handlers.pointermove(event(70,30));
 h.loseContext();click(h,'save');assert.equal(s.callbacks.length,0);h.restoreContext();click(h,'life-undo-edit');
 assert.equal(h.el('metrics').textContent,stable);assert.equal(h.el('field-notes-list').innerHTML,note);
 assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');click(h,'life-back');assert.match(h.el('metrics').textContent,/第 0 代/);
 click(h,'save');s.callbacks.shift()(new Blob(['png']));assert.deepEqual(s.downloads,['small-worlds-life.png']);
});

test('Enter recovery requires a fresh press; held repeats do not trigger a delayed download',async()=>{
 const h=await setup('?experiment=fractal&at=v1,1000'),s=capture(h);h.el('save').focus();h.loseContext();
 const key=repeat=>{let prevented=false;h.el('save').handlers.keydown({key:'Enter',repeat,preventDefault(){prevented=true;}});if(!prevented)click(h,'save');return prevented;};
 assert.equal(key(false),false);assert.equal(s.callbacks.length,0);h.restoreContext();
 for(let i=0;i<5;i++)assert.equal(key(true),true);assert.equal(s.callbacks.length,0);
 assert.equal(key(false),false);assert.equal(s.callbacks.length,1);s.callbacks.shift()(new Blob(['png']));
 assert.deepEqual(s.downloads,['small-worlds-fractal.png']);assert.equal(document.activeElement,h.el('save'));
 assert.equal(new URL(location.href).searchParams.get('at'),'v1,1000');assert.match(h.el('metrics').textContent,/1,?000|1000/);
});
