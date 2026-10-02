import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

// Native buttons click on Enter keydown, including repeats unless cancelled.
function enter(h,repeat=false){
 let prevented=false;
 h.el('pause').handlers.keydown?.({key:'Enter',repeat,preventDefault(){prevented=true;}});
 if(!prevented)h.el('pause').handlers.click();
 return prevented;
}
const snapshot=h=>({
 status:h.el('status').textContent,label:h.el('pause').getAttribute('aria-label'),
 metrics:h.el('metrics').textContent,announcement:h.el('announcement').textContent,
 frames:h.frames.size,draws:h.drawCount(),url:location.href,writes:h.writes(),
 focus:document.activeElement
});

test('holding Enter pauses each running world once and cannot resume it',async()=>{
 for(const mode of ['orbit','life','wave','fractal','walk']){
  const h=await setup('?experiment='+mode,'#canvas',false);
  h.el('pause').focus();assert.equal(h.frames.size,1);
  assert.equal(enter(h),false,'the first native activation remains enabled');
  assert.equal(h.el('status').textContent,'已暂停');assert.equal(h.frames.size,0);
  const after=snapshot(h);
  for(let repeat=0;repeat<8;repeat++)assert.equal(enter(h,true),true);
  assert.deepEqual(snapshot(h),after,mode+' remains exactly as first paused');
  enter(h);assert.equal(h.el('status').textContent,'运行中');assert.equal(h.frames.size,1);
 }
});

test('holding Enter continues once, keeping one animation chain and a fixed shared checkpoint',async()=>{
 for(const mode of ['orbit','life','wave','fractal','walk']){
  const h=await setup('?experiment='+mode,'#canvas');
  await h.el('share').handlers.click();const link=h.el('share-link').value;
  h.el('pause').focus();enter(h);
  assert.equal(h.el('status').textContent,'运行中');assert.equal(h.frames.size,1);
  const after=snapshot(h);
  for(let repeat=0;repeat<8;repeat++)assert.equal(enter(h,true),true);
  assert.deepEqual(snapshot(h),after,mode+' continues without repeated toggles');
  assert.equal(h.el('share-link').value,link);assert.equal(h.el('share-link').hidden,false);
  enter(h);assert.equal(h.el('status').textContent,'已暂停');assert.equal(h.frames.size,0);
 }
});

test('a held key cannot override a newly enabled reduced-motion pause',async()=>{
 const h=await setup('?experiment=wave','',false);
 h.el('pause').focus();enter(h);enter(h);
 h.motion.matches=true;h.motion.change({matches:true});
 const after=snapshot(h);
 assert.equal(after.status,'已暂停');assert.equal(after.frames,0);
 for(let repeat=0;repeat<5;repeat++)assert.equal(enter(h,true),true);
 assert.deepEqual(snapshot(h),after);
 enter(h);assert.equal(h.frames.size,1,'a fresh press is still explicit opt-in');
});

test('repeat suppression leaves progress-limit feedback and Life comparisons undisturbed',async()=>{
 for(const [mode,count] of [['fractal',12000],['walk',512]]){
  const h=await setup('?experiment='+mode+'&at=v1,'+count);
  enter(h);const after=snapshot(h);assert.match(after.announcement,/已达到/);
  for(let repeat=0;repeat<5;repeat++)assert.equal(enter(h,true),true);
  assert.deepEqual(snapshot(h),after);assert.equal(h.frames.size,0);
 }
 const h=await setup('?experiment=life');h.el('life-test').handlers.click();
 const result=h.el('life-test-result').textContent,after=snapshot(h);
 assert.equal(enter(h,true),true);
 assert.deepEqual(snapshot(h),after);assert.equal(h.el('life-test-result').textContent,result);
 assert.equal(h.el('life-return').hidden,false);
 enter(h);assert.equal(h.el('life-return').hidden,true,'intentional Continue still clears the trial');
});

test('Space, navigation, pointer clicks and fresh presses retain native behavior after tab returns',async()=>{
 const h=await setup('?experiment=life');
 assert.equal(typeof h.el('pause').handlers.keydown,'function');
 for(const key of [' ','Tab','Escape','ArrowRight'])for(const repeat of [false,true]){
  let prevented=false;const after=snapshot(h);
  h.el('pause').handlers.keydown({key,repeat,preventDefault(){prevented=true;}});
  assert.equal(prevented,false,key+' is left native');assert.deepEqual(snapshot(h),after);
 }
 h.el('pause').handlers.click();assert.equal(h.frames.size,1);
 h.el('pause').handlers.click();assert.equal(h.frames.size,0);
 enter(h);h.tabs[2].handlers.click();h.tabs[1].handlers.click();
 assert.equal(h.frames.size,1);enter(h);assert.equal(h.frames.size,0);
 assert.equal(enter(h,true),true);enter(h);assert.equal(h.frames.size,1);
});
