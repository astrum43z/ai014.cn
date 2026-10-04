import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const reading=h=>h.el('wave-probe-reading').textContent;
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),frames:[...h.frames.keys()],reading:reading(h),metrics:h.el('metrics').textContent,status:h.el('status').textContent,message:h.el('announcement').textContent,url:location.href,writes:h.writes(),link:h.el('share-link').value,linkHidden:h.el('share-link').hidden,saved:h.el('saved-observation-reading').textContent,undo:h.el('observation-undo').getAttribute('aria-disabled'),notes:h.el('notes-text').value,mission:h.el('mission-state').textContent,focus:document.activeElement});
const directions=[['left','ArrowLeft'],['up','ArrowUp'],['down','ArrowDown'],['right','ArrowRight']];

for(const running of [false,true])for(const input of ['button','keyboard'])test(`Wave ${input} movement cannot change a ${running?'running':'paused'} observation through nonpositive view geometry`,async()=>{
 const h=await setup('?experiment=wave&at=v1,800,-300,2.5');
 if(running)click(h,'pause');
 for(const [width,height] of [[20,20],[0,414],[600,0],[0,0],[36,414],[600,36],[35.5,260]]){
  h.resize(width,height);
  for(const [id,key] of directions){
   const target=h.el(input==='button'?'wave-'+id:'canvas');target.focus();
   const before=state(h);
   if(input==='button')click(h,'wave-'+id);else h.key(key,{repeat:true});
   assert.deepEqual(state(h),before,`${width} × ${height}, ${key}`);
  }
  h.resize(600,414);assert.match(reading(h),/x 800\.0，y -300\.0/);
  assert.equal(h.frames.size,running?1:0);
 }
 click(h,'wave-right');assert.match(reading(h),/x 802\.0，y -300\.0/);
 assert.equal(h.frames.size,0,'a fresh usable command retains normal pause behavior');
});

test('Wave layout recovery keeps the exact paused field, phase and fixed checkpoint',async()=>{
 const h=await setup('?experiment=wave&wavelength=37&separation=126&at=v1,48,-12,1.25');
 click(h,'wave-right');click(h,'step');const before=state(h);
 for(const size of [[20,20],[36,414],[600,36]]){
  h.resize(...size);click(h,'wave-left');h.key('ArrowUp');h.resize(600,414);
  assert.deepEqual(h.drawing(),before.drawing);
  for(const id of ['reading','metrics','url','writes','saved'])assert.deepEqual(state(h)[id],before[id],id);
 }
 await click(h,'share');
 assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),'v1,50,-12,'+(1.25+Math.PI/6));
});

test('Wave ignored movement preserves saved-return recovery and a completed discovery through interruptions',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');click(h,'mission-check');click(h,'wave-home');click(h,'mission-check');
 assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');
 await click(h,'share');click(h,'wave-right');click(h,'step');const expected={reading:reading(h),metrics:h.el('metrics').textContent};
 click(h,'observation-return');const saved=state(h);
 h.resize(20,20);click(h,'wave-down');h.key('ArrowRight');
 h.setHidden(true);h.setHidden(false);h.loseContext();h.restoreContext();h.setDpr(2);
 h.resize(600,414);click(h,'tab-life');click(h,'tab-wave');
 assert.equal(reading(h),saved.reading);assert.equal(location.href,saved.url);
 assert.equal(h.el('notes-text').value,saved.notes);assert.equal(h.el('mission-state').textContent,saved.mission);
 assert.equal(h.el('observation-undo').getAttribute('aria-disabled'),'false');
 click(h,'observation-undo');assert.equal(reading(h),expected.reading);assert.equal(h.el('metrics').textContent,expected.metrics);
 assert.equal(location.href,saved.url);assert.equal(h.frames.size,0);
});

test('Wave center remains an explicit geometry-independent command during a collapsed view',async()=>{
 for(const input of ['button','keyboard']){
  const h=await setup('?experiment=wave&at=v1,800,-300,2.5'),url=location.href;
  click(h,'pause');h.resize(20,20);
  if(input==='button')click(h,'wave-home');else h.key('Home');
  assert.equal(reading(h),'探针 x 0.0，y 0.0 · 整周期最大幅度 1.00');
  assert.equal(h.frames.size,0);assert.equal(location.href,url);
  h.resize(600,414);click(h,'wave-right');assert.match(reading(h),/x 2\.0，y 0\.0/);
 }
});

test('Wave ordinary fractional reflow and held positioning remain exact and bounded',async()=>{
 const h=await setup('?experiment=wave&at=v1,800,-300,2.5'),url=location.href;
 h.resize(259.5,240.25);h.key('ArrowRight',{repeat:true});h.key('ArrowRight',{repeat:true});
 assert.match(reading(h),/x 804\.0，y -300\.0/);assert.equal(location.href,url);
 click(h,'wave-home');for(let i=0;i<90;i++)click(h,'wave-down');
 assert.match(reading(h),/y 140\.0/);const before=reading(h);h.key('ArrowDown',{repeat:true});assert.equal(reading(h),before);
 click(h,'wave-up');assert.match(reading(h),/y 138\.0/);
});
