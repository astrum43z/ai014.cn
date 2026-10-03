import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const picture=h=>createHash('sha256').update(JSON.stringify(h.drawing())).digest('hex');
const worlds=['orbit','life','wave','fractal','walk'];
const readings=h=>['metrics','status','announcement','observation-a','observation-b','observation-c','observation-detail','passport-count','field-notes-list','history-caption','orbit-position','wave-probe-reading','fractal-touch-reading','walk-step-reading','life-selection'].map(id=>h.el(id).textContent);
const recover=h=>{assert.equal(h.loseContext(),false,'allow the browser to restore its 2D context');h.restoreContext();};

for(const world of worlds)test(`${world}: restored paused canvas repaints the exact model and density without changing progress`,async()=>{
 const h=await setup('?experiment='+world,'',true,2);click(h,'step');h.el('canvas').focus();
 const drawing=picture(h),before=readings(h),url=location.href,writes=h.writes();
 for(let i=0;i<3;i++){
  recover(h);assert.deepEqual(picture(h),drawing);assert.deepEqual(readings(h),before);
  assert.deepEqual(h.transforms.at(-1),[2,0,0,2,0,0]);assert.equal(h.frames.size,0);
  assert.equal(document.activeElement,h.el('canvas'));assert.equal(location.href,url);assert.equal(h.writes(),writes);
 }
});

for(const world of worlds)test(`${world}: loss suspends one running frame chain and recovery excludes the missing interval`,async()=>{
 const h=await setup('?experiment='+world,'',false,1.25);h.tick(0);h.tick(50);
 const before=readings(h),drawing=picture(h);
 assert.equal(h.loseContext(),false);assert.equal(h.frames.size,0);
 h.restoreContext();assert.equal(h.frames.size,1);assert.deepEqual(readings(h),before);assert.deepEqual(picture(h),drawing);
 assert.deepEqual(h.transforms.at(-1),[1.25,0,0,1.25,0,0]);
 h.tick(90000);assert.deepEqual(readings(h),before);assert.deepEqual(picture(h),drawing);
 for(const now of [90050,90100,90150,90200])h.tick(now);
 assert.notDeepEqual(readings(h),before,'the recovered model actually advances again');assert.equal(h.frames.size,1);
 click(h,'pause');assert.equal(h.frames.size,0);
});

test('context recovery respects pause, visibility, offscreen and reduced-motion changes during loss',async()=>{
 for(const gate of ['pause','hidden','offscreen','motion']){
  const h=await setup('?experiment=wave','',false);h.tick(0);h.tick(50);h.loseContext();
  if(gate==='pause')click(h,'pause');
  if(gate==='hidden')h.setHidden(true);
  if(gate==='offscreen')h.setVisible(false);
  if(gate==='motion')h.motion.change({matches:true});
  h.restoreContext();assert.equal(h.frames.size,0,gate);assert.ok(h.drawing().length);
  if(gate==='pause')click(h,'pause');
  if(gate==='hidden')h.setHidden(false);
  if(gate==='offscreen')h.setVisible(true);
  if(gate==='motion'){h.motion.change({matches:false});assert.equal(h.frames.size,0);click(h,'pause');}
  assert.equal(h.frames.size,1);h.tick(90000);assert.match(h.el('metrics').textContent,/0\.1 s/);
 }
});

test('Continue, visibility and world changes cannot restart animation before the context returns',async()=>{
 const h=await setup('?experiment=orbit');h.loseContext();click(h,'pause');
 h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);
 assert.equal(h.frames.size,0);h.tabs[2].handlers.click();assert.equal(h.frames.size,0);
 const before=readings(h);h.restoreContext();assert.deepEqual(readings(h),before);assert.equal(h.frames.size,1);
});

test('recovery uses current density and pending layout without fitting unchanged edge views',async()=>{
 for(const world of ['orbit','wave']){
  const h=await setup('?experiment='+world);h.el('canvas').handlers.click({clientX:595,clientY:5});
  const before=readings(h),drawing=picture(h);h.loseContext();h.setDpr(3);h.restoreContext();
  assert.deepEqual(picture(h),drawing);assert.deepEqual(readings(h),before);
  assert.equal(h.el('canvas').width,1200);assert.deepEqual(h.transforms.at(-1),[2,0,0,2,0,0]);
  h.loseContext();h.setRect(334,240);h.restoreContext();
  assert.equal(h.el('canvas').width,668);assert.equal(h.el('canvas').height,480);assert.deepEqual(readings(h),before);
 }
});

test('Life loss ends a partial stroke, suppresses its trailing click and preserves drawing undo',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');
 const canvas=h.el('canvas'),event=(x,y)=>({pointerId:21,button:0,isPrimary:true,clientX:x,clientY:y});
 canvas.handlers.pointerdown(event(30,30));canvas.handlers.pointermove(event(70,30));
 const before=readings(h),drawing=picture(h);h.loseContext();h.restoreContext();
 assert.deepEqual(picture(h),drawing);assert.deepEqual(readings(h),before);
 canvas.handlers.pointermove(event(200,30));canvas.handlers.pointerup({...event(200,30),type:'pointerup'});
 canvas.handlers.click({...event(200,30),detail:1});assert.deepEqual(picture(h),drawing);
 click(h,'life-undo-edit');assert.match(h.el('metrics').textContent,/0 个活格子/);
 canvas.handlers.pointerdown(event(100,100));canvas.handlers.pointerup({...event(100,100),type:'pointerup'});
 canvas.handlers.click({...event(100,100),detail:1});assert.match(h.el('metrics').textContent,/1 个活格子/);
});

test('saved observations, retained worlds and explicit changes during loss survive recovery',async()=>{
 const h=await setup('?experiment=fractal&at=v1,1000');const original=picture(h),url=location.href;
 h.loseContext();click(h,'fractal-step');h.tabs[4].handlers.click();click(h,'walk-64');h.restoreContext();
 assert.match(h.el('metrics').textContent,/64/);h.tabs[3].handlers.click();assert.match(h.el('metrics').textContent,/1001/);
 assert.equal(location.href,url);click(h,'observation-return');assert.deepEqual(picture(h),original);
 const notes=h.el('passport-count').textContent;h.loseContext();click(h,'mission-start');click(h,'mission-check');
 const changed=picture(h),before=readings(h);h.restoreContext();assert.deepEqual(picture(h),changed);assert.deepEqual(readings(h),before);
 assert.equal(h.el('passport-count').textContent,notes);
});

test('context recovery preserves a Life comparison and generation replay history',async()=>{
 const h=await setup('?experiment=life');click(h,'guide-start');click(h,'step');click(h,'life-test');
 const before=readings(h),drawing=picture(h);recover(h);assert.deepEqual(picture(h),drawing);assert.deepEqual(readings(h),before);
 click(h,'life-return');click(h,'step');const next=picture(h);recover(h);click(h,'life-back');click(h,'step');
 assert.deepEqual(picture(h),next);assert.equal(h.frames.size,0);
});

test('a completed discovery keeps its exact notebook entry, result and return action through recovery',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');
 for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 click(h,'mission-check');assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');
 const note=h.el('field-notes-list').innerHTML,result=h.el('mission-result').textContent,before=picture(h);
 assert.equal((note.match(/<li>/g)||[]).length,1);recover(h);
 assert.equal(h.el('field-notes-list').innerHTML,note);assert.equal(h.el('mission-result').textContent,result);
 assert.equal(picture(h),before);h.tabs[2].handlers.click();recover(h);h.tabs[1].handlers.click();
 assert.equal(h.el('field-notes-list').innerHTML,note);assert.equal(h.el('mission-result').textContent,result);
 assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');assert.equal(picture(h),before);
});
