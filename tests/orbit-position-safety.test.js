import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const reading=h=>h.el('orbit-touch-reading').textContent;
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),frames:[...h.frames.keys()],reading:reading(h),metrics:h.el('metrics').textContent,status:h.el('status').textContent,message:h.el('announcement').textContent,url:location.href,writes:h.writes(),link:h.el('share-link').value,linkHidden:h.el('share-link').hidden,recall:h.el('orbit-recall').getAttribute('aria-disabled'),recallStatus:h.el('orbit-recall-status').textContent,notes:h.el('notes-text').value,mission:h.el('mission-state').textContent,result:h.el('mission-result').textContent,focus:document.activeElement});
const directions=[['left','ArrowLeft'],['up','ArrowUp'],['down','ArrowDown'],['right','ArrowRight']];
function select(h){
 for(let i=0;i<28;i++)click(h,'orbit-right');
 for(let i=0;i<30;i++)click(h,'orbit-up');
 h.resize(600,414);
 assert.match(reading(h),/x 280\.0，y -150\.0/);
}

for(const running of [false,true])for(const input of ['button','keyboard'])test(`Orbit ${input} ignores directional movement through unusable geometry while ${running?'running':'paused'}`,async()=>{
 const h=await setup('?experiment=orbit');select(h);click(h,'orbit-fire');click(h,'step');
 if(running)click(h,'pause');
 for(const [width,height] of [[20,20],[0,414],[600,0],[0,0],[68,414],[600,68],[67.5,260]]){
  h.resize(width,height);
  for(const [id,key] of directions){
   h.el(input==='button'?'orbit-'+id:'canvas').focus();
   const before=state(h);
   if(input==='button')click(h,'orbit-'+id);else h.key(key,{repeat:true});
   assert.deepEqual(state(h),before,`${width} × ${height}, ${key}`);
  }
  h.resize(600,414);assert.match(reading(h),/x 280\.0，y -150\.0/);
  assert.equal(h.frames.size,running?1:0);
 }
 click(h,'orbit-left');assert.match(reading(h),/x 275\.0，y -150\.0/);
 assert.equal(h.frames.size,0,'the next usable command pauses normally');
});

test('Orbit recovery keeps the exact launch preview, bodies, trails, time and next integration',async()=>{
 const h=await setup('?experiment=orbit&gravity=113&speed=68');select(h);click(h,'orbit-fire');
 for(let i=0;i<4;i++)click(h,'step');
 const before=state(h),preview=h.el('orbit-preview-reading').textContent;
 for(const size of [[20,20],[68,414],[600,68]]){
  h.resize(...size);click(h,'orbit-left');h.key('ArrowUp');h.resize(600,414);
  assert.deepEqual(h.drawing(),before.drawing);
  for(const id of ['reading','metrics','url','writes','recall','recallStatus'])assert.deepEqual(state(h)[id],before[id],id);
  assert.equal(h.el('orbit-preview-reading').textContent,preview);
 }
 click(h,'step');const next=h.drawing();
 const control=await setup('?experiment=orbit&gravity=113&speed=68');select(control);click(control,'orbit-fire');
 for(let i=0;i<5;i++)click(control,'step');
 assert.deepEqual(next,control.drawing());
});

test('Orbit nonfinite observed dimensions cannot bypass directional bounds validation',async()=>{
 const h=await setup('?experiment=orbit');select(h);click(h,'pause');
 for(const size of [[NaN,414],[600,NaN],[Infinity,414],[600,Infinity],[-Infinity,414],[600,-Infinity]]){
  h.resize(...size);const before=state(h);click(h,'orbit-left');h.key('ArrowUp');assert.deepEqual(state(h),before);
  h.resize(600,414);assert.match(reading(h),/x 280\.0，y -150\.0/);assert.equal(h.frames.size,1);
 }
});

test('Orbit rejected commands leave the scheduled animation able to advance and explicit recall available',async()=>{
 const h=await setup('?experiment=orbit');click(h,'orbit-fire');click(h,'pause');h.tick(0);h.tick(40);
 h.resize(20,20);const before=state(h);click(h,'orbit-right');h.key('ArrowDown');
 assert.deepEqual(state(h),before);h.tick(80);assert.equal(h.frames.size,1);
 assert.match(h.el('metrics').textContent,/t \+ 0\.1 s/);
 h.resize(600,414);assert.match(reading(h),/x 140\.0，y 0\.0/);
 const time=h.el('metrics').textContent.match(/t \+ .*$/)[0];click(h,'orbit-recall');
 assert.match(h.el('metrics').textContent,/3 颗行星/);assert.ok(h.el('metrics').textContent.endsWith(time));
 assert.equal(h.frames.size,0);assert.equal(h.el('orbit-recall').getAttribute('aria-disabled'),'true');
});

test('Orbit ignored movement preserves sharing and discovery evidence across interruptions and retained worlds',async()=>{
 const h=await setup('?experiment=orbit');click(h,'mission-start');click(h,'mission-check');
 h.el('gravity').handlers.input({target:{value:'40'}});for(let i=0;i<140;i++)click(h,'step');click(h,'mission-check');
 assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');
 select(h);click(h,'orbit-fire');await click(h,'share');const saved=state(h),note=h.el('field-notes-list').innerHTML;
 h.resize(20,20);click(h,'orbit-down');h.key('ArrowRight');
 h.setHidden(true);h.setHidden(false);h.loseContext();h.restoreContext();h.setDpr(2);
 h.resize(600,414);click(h,'tab-life');click(h,'tab-orbit');
 assert.equal(reading(h),saved.reading);assert.equal(location.href,saved.url);assert.equal(h.el('share-link').value,saved.link);
 assert.equal(h.el('notes-text').value,saved.notes);assert.equal(h.el('field-notes-list').innerHTML,note);
 assert.equal(h.el('mission-state').textContent,saved.mission);assert.equal(h.el('mission-result').textContent,saved.result);
 assert.equal(h.el('orbit-recall').getAttribute('aria-disabled'),'false');click(h,'orbit-recall');
 assert.match(h.el('metrics').textContent,/3 颗行星/);assert.equal(location.href,saved.url);
});

test('Orbit Home and explicit launch remain model-space actions in a collapsed view',async()=>{
 for(const input of ['button','keyboard']){
  const h=await setup('?experiment=orbit');select(h);click(h,'pause');h.resize(20,20);const url=location.href;
  if(input==='button')click(h,'orbit-home');else h.key('Home');
  assert.match(reading(h),/x 140\.0，y 0\.0/);assert.equal(h.frames.size,0);assert.equal(location.href,url);
  if(input==='button')click(h,'orbit-fire');else h.key('Enter');
  assert.match(h.el('metrics').textContent,/4 颗行星/);assert.equal(h.el('orbit-recall').getAttribute('aria-disabled'),'false');
  h.resize(600,414);click(h,'orbit-left');assert.match(reading(h),/x 135\.0，y 0\.0/);
 }
});

test('Orbit normal fractional reflow, edge clamping and held directional keys remain exact',async()=>{
 const h=await setup('?experiment=orbit');select(h);h.resize(259.5,240.25);const url=location.href;
 h.key('ArrowLeft',{repeat:true});h.key('ArrowDown',{repeat:true});
 assert.match(reading(h),/x 275\.0，y -145\.0/);assert.equal(location.href,url);
 for(let i=0;i<100;i++)click(h,'orbit-right');assert.match(reading(h),/x 280\.0，y -145\.0/);
 const boundary=reading(h);h.key('ArrowRight',{repeat:true});assert.equal(reading(h),boundary);
 h.key('ArrowLeft');assert.match(reading(h),/x 275\.0，y -145\.0/);
});

test('Orbit native modified and composing keys remain untouched, and hidden-world controls stay inert',async()=>{
 const h=await setup('?experiment=orbit');click(h,'pause');h.resize(20,20);const before=state(h);
 for(const extra of [{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true},{isComposing:true},{keyCode:229}]){
  let prevented=false;h.key('ArrowLeft',{...extra,preventDefault(){prevented=true;}});assert.equal(prevented,false);assert.deepEqual(state(h),before);
 }
 h.resize(600,414);click(h,'tab-wave');const wave=state(h);
 for(const [id] of directions)click(h,'orbit-'+id);assert.deepEqual(state(h),wave);
});
