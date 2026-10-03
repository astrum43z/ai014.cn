import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const readings=h=>['metrics','status','observation-a','observation-b','observation-c','observation-detail','announcement','passport-count','field-notes-list','history-caption','orbit-position','orbit-preview-reading','wave-probe-reading','wave-envelope','fractal-touch-reading','walk-step-reading','life-selection'].map(id=>h.el(id).textContent);
const frame=h=>h.drawing();
function assertSize(h,dpr,width=600,height=414){
 assert.equal(h.el('canvas').width,width*Math.min(dpr,2));
 assert.equal(h.el('canvas').height,height*Math.min(dpr,2));
 assert.deepEqual(h.transforms.at(-1),[Math.min(dpr,2),0,0,Math.min(dpr,2),0,0]);
}

for(const world of ['orbit','life','wave','fractal','walk'])test(`${world}: density-only changes redraw the same paused experiment without changing CSS geometry`,async()=>{
 const h=await setup('?experiment='+world);
 click(h,'step');h.el('canvas').focus();
 const before={readings:readings(h),drawing:frame(h),url:location.href,writes:h.writes()};
 for(const dpr of [2,1.25,1.5,1]){
  const draws=h.drawCount();h.setDpr(dpr);assertSize(h,dpr);
  assert.equal(h.drawCount(),draws+1,'one event-driven redraw at the new backing resolution');
  assert.deepEqual(frame(h),before.drawing,'CSS-space drawing and model coordinates stay exact');
  assert.deepEqual(readings(h),before.readings);assert.equal(location.href,before.url);assert.equal(h.writes(),before.writes);
  assert.equal(h.frames.size,0);assert.equal(document.activeElement,h.el('canvas'));
 }
});

test('density watcher re-arms one listener, skips capped changes, and still detects a return to a lower density',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,0');
 assert.equal(h.densityQueries.length,1);assert.equal(h.densityQueries[0].media,'(resolution: 1dppx)');
 const active=()=>h.densityQueries.reduce((n,media)=>n+media.listeners.size,0);
 for(const dpr of [2,3,2.5,4,1.5,1]){
  const draws=h.drawCount(),old=Math.min(devicePixelRatio,2),oldQueries=h.densityQueries.length;
  h.setDpr(dpr);assertSize(h,dpr);
  assert.equal(h.drawCount(),draws+(old===Math.min(dpr,2)?0:1));
  assert.equal(h.densityQueries.length,oldQueries+1);assert.equal(active(),1);
  assert.equal(h.densityQueries.at(-1).media,`(resolution: ${dpr}dppx)`);
  assert.ok(h.densityQueries.slice(0,-1).every(media=>media.listeners.size===0));
 }
 const draws=h.drawCount(),queries=h.densityQueries.length;h.setDpr(1);
 assert.equal(h.drawCount(),draws);assert.equal(h.densityQueries.length,queries);assert.equal(active(),1);
});

test('initial fractional and capped displays keep the existing fit and watch the raw density',async()=>{
 for(const dpr of [1.25,2,3]){
  const h=await setup('?experiment=life','',true,dpr);assertSize(h,dpr);
  assert.equal(h.transforms.length,1,'registration does not redraw an already fitted canvas');
  assert.equal(h.densityQueries.at(-1).media,`(resolution: ${dpr}dppx)`);
  h.setDpr(1);assertSize(h,1);assert.equal(h.frames.size,0);
 }
});

test('density-only redraw preserves unfitted edge probes and launch points without zooming their view',async()=>{
 for(const world of ['wave','orbit'])for(const pointer of [true,false]){
  const h=await setup('?experiment='+world);
  if(pointer)h.el('canvas').handlers.click({clientX:595,clientY:5});
  else for(let i=0;i<160;i++)h.key('ArrowRight');
  const drawing=frame(h),before=readings(h),url=location.href;
  for(const dpr of [2,1.25,1]){
   h.setDpr(dpr);assertSize(h,dpr);assert.deepEqual(frame(h),drawing);
   assert.deepEqual(readings(h),before);assert.equal(location.href,url);
  }
 }
});

test('density and layout changes cooperate without resetting saved observations or adding animation chains',async()=>{
 const h=await setup('?experiment=wave&at=v1,10000,-10000,20');
 click(h,'pause');h.tick(0);h.tick(50);
 const before=readings(h),drawing=frame(h),url=location.href;
 h.setDpr(2);assert.deepEqual(frame(h),drawing);assert.deepEqual(readings(h),before);assert.equal(h.frames.size,1);
 h.resize(334,240);assertSize(h,2,334,240);assert.deepEqual(readings(h),before);
 h.setDpr(1.25);assertSize(h,1.25,334,240);assert.deepEqual(readings(h),before);assert.equal(location.href,url);
 h.tick(100);h.tick(150);assert.equal(h.frames.size,1);assert.notEqual(h.el('metrics').textContent,before[0]);
 click(h,'pause');assert.equal(h.frames.size,0);
 h.setDpr(2);assertSize(h,2,334,240);assert.equal(h.frames.size,0);
 click(h,'observation-return');assert.match(h.el('metrics').textContent,/20.0 s/);
});

test('density changes preserve Life stroke ownership, pending undo and deterministic generation replay',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');
 const canvas=h.el('canvas'),event=(x,y)=>({pointerId:21,button:0,isPrimary:true,clientX:x,clientY:y});
 canvas.handlers.pointerdown(event(30,30));canvas.handlers.pointermove(event(70,30));
 const reading=h.el('metrics').textContent;h.setDpr(2);assert.equal(h.el('metrics').textContent,reading);
 canvas.handlers.pointermove(event(110,30));canvas.handlers.pointerup({...event(110,30),type:'pointerup'});
 assert.match(h.el('metrics').textContent,/7 个活格子/);
 const painted=frame(h);click(h,'life-undo-edit');assert.match(h.el('metrics').textContent,/0 个活格子/);
 click(h,'guide-start');click(h,'step');const next=frame(h);h.setDpr(1);assert.deepEqual(frame(h),next);
 click(h,'life-back');click(h,'step');assert.deepEqual(frame(h),next);assert.notDeepEqual(frame(h),painted);
});

test('inactive worlds, motion preference and saved links survive density changes',async()=>{
 const h=await setup('?experiment=fractal&at=v1,1000');
 const fractal=readings(h),picture=frame(h),url=location.href;
 h.tabs[4].handlers.click();click(h,'walk-64');h.setDpr(2);h.tabs[3].handlers.click();
 assert.deepEqual(frame(h),picture);assert.deepEqual(readings(h).slice(0,6),fractal.slice(0,6));assert.equal(location.href,url);
 click(h,'pause');assert.equal(h.frames.size,1);h.motion.change({matches:true});assert.equal(h.frames.size,0);
 const announcement=h.el('announcement').textContent;h.setDpr(1);assert.equal(h.frames.size,0);assert.equal(h.el('announcement').textContent,announcement);
 h.motion.change({matches:false});assert.equal(h.frames.size,0);click(h,'step');assert.match(h.el('metrics').textContent,/1100 个点/);
 h.tabs[4].handlers.click();assert.match(h.el('metrics').textContent,/64 步/);
});
