import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const choose=(h,value)=>(h.el('preset-select').handlers.change({target:{value}}),h.el('load-preset').handlers.click());
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});

test('random sow always samples a full Life board, regardless of selected preset',async t=>{
 const h=await setup('?experiment=life&density=30');
 let calls=0;t.mock.method(Math,'random',()=>{calls++;return .2;});
 for(const preset of ['glider','blinker','pulsar','random']){
  choose(h,preset);calls=0;
  click(h,'preset');
  assert.equal(calls,48*32,preset);
  assert.equal(h.el('preset-select').value,'random',preset);
  assert.equal(h.el('metrics').textContent,'第 0 代 · 1536 个活格子',preset);
  assert.equal(h.el('announcement').textContent,'已载入预设：随机花园');
 }
});

test('sowing uses the latest per-cell density with strict threshold comparison',async t=>{
 const h=await setup('?experiment=life&density=30');
 const samples=[.0999,.1,.2999,.3,.5999,.6];let calls=0;
 t.mock.method(Math,'random',()=>samples[calls++%samples.length]);
 for(const [density,count] of [[10,256],[30,768],[60,1280]]){
  const before=h.el('metrics').textContent;
  input(h,'density',density);
  assert.equal(h.el('metrics').textContent,before,'density alone never changes the current drawing');
  calls=0;click(h,'preset');
  assert.equal(calls,1536);
  assert.equal(h.el('metrics').textContent,`第 0 代 · ${count} 个活格子`);
  assert.equal(new URL(location.href).searchParams.get('density'),String(density));
  assert.equal(h.el('density').getAttribute('aria-valuetext'),density+'%');
 }
});

test('repeated sowing makes a fresh generation-zero board and retains focus and pause',async t=>{
 const h=await setup('?experiment=life&rate=4&density=30');
 let random=.2;t.mock.method(Math,'random',()=>random);
 h.el('preset').focus();click(h,'preset');
 assert.equal(h.el('metrics').textContent,'第 0 代 · 1536 个活格子');
 click(h,'step');assert.match(h.el('metrics').textContent,/第 1 代/);
 random=.8;click(h,'preset');
 assert.equal(h.el('metrics').textContent,'第 0 代 · 0 个活格子');
 assert.equal(h.el('preset-select').value,'random');
 assert.equal(h.el('pause').textContent,'继续');
 assert.equal(h.frames.size,0);
 assert.equal(document.activeElement,h.el('preset'));
 assert.equal(h.el('life-return').hidden,true);
 assert.equal(h.el('observation-c').textContent,'状态 · 全部消失');
});

test('sowing preserves running state and a random board survives an experiment round trip',async t=>{
 const h=await setup('?experiment=life&rate=4&density=30');
 t.mock.method(Math,'random',()=>.2);
 click(h,'pause');assert.equal(h.frames.size,1);
 click(h,'preset');assert.equal(h.el('pause').textContent,'暂停');assert.equal(h.frames.size,1);
 click(h,'pause');const drawing=h.drawing();
 h.tabs[2].handlers.click();h.tabs[1].handlers.click();
 assert.equal(h.el('preset-select').value,'random');
 assert.equal(h.el('metrics').textContent,'第 0 代 · 1536 个活格子');
 assert.deepEqual(h.drawing(),drawing);
 assert.equal(h.el('pause').textContent,'继续');
});

test('named Life patterns remain directly selectable without sampling randomness',async t=>{
 const h=await setup('?experiment=life');
 let calls=0;t.mock.method(Math,'random',()=>{calls++;return .2;});
 click(h,'preset');calls=0;
 for(const [name,count] of [['glider',5],['blinker',3],['pulsar',48]]){
  choose(h,name);
  assert.equal(h.el('preset-select').value,name);
  assert.equal(h.el('metrics').textContent,`第 0 代 · ${count} 个活格子`);
 }
 assert.equal(calls,0);
});

test('other experiments still cycle through their original preset sequences',async()=>{
 const h=await setup();
 for(const [index,sequence] of [[0,['elliptic','escape','circular']],[2,['wide','close','ripple']],[3,['overlap','islands','half']],[4,['drift','another','unbiased']]]){
  h.tabs[index].handlers.click();
  for(const name of sequence){click(h,'preset');assert.equal(h.el('preset-select').value,name);}
 }
});
