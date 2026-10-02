import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const cases=[
 ['fractal','fractal-back',731,-1],
 ['fractal','fractal-forward',731,1],
 ['fractal','fractal-step',731,1],
 ['walk','walk-back',73,-1],
 ['walk','walk-step-one',73,1]
];
const click=(h,id)=>h.el(id).handlers.click();
// Native buttons click on Enter keydown unless that keydown is cancelled.
function enter(h,id,repeat=false){
 let prevented=false;
 h.el(id).handlers.keydown?.({key:'Enter',repeat,preventDefault(){prevented=true;}});
 if(!prevented)click(h,id);
 return prevented;
}
function snapshot(h){
 return {drawing:h.drawing(),metrics:h.el('metrics').textContent,
  reading:h.el('announcement').textContent,status:h.el('status').textContent,
  draws:h.drawCount(),frames:h.frames.size,url:location.href,writes:h.writes(),
  notes:h.el('field-notes-list').innerHTML,focus:document.activeElement};
}
function count(h,mode,n){
 assert.match(h.el('metrics').textContent,mode==='fractal'?new RegExp(`^${n} 个点`):new RegExp(`· ${n} 步 ·`));
}

for(const [mode,id,start,delta] of cases)test(`${id}: a held Enter performs exactly one seeded replay action`,async()=>{
 for(const running of [false,true]){
  const h=await setup(`?experiment=${mode}&seed=23&${mode==='fractal'?'jump=65':'bias=7'}&at=v1,${start}`,'#canvas');
  await h.el('share').handlers.click();const saved=h.el('share-link').value;
  if(running)click(h,'pause');
  const button=h.el(id);button.focus();
  assert.equal(enter(h,id),false);count(h,mode,start+delta);
  assert.equal(h.frames.size,0);assert.equal(document.activeElement,button);
  const after=snapshot(h);
  for(let i=0;i<12;i++)assert.equal(enter(h,id,true),true);
  assert.deepEqual(snapshot(h),after,'repeats neither skip events nor redraw or announce');
  assert.equal(h.el('share-link').value,saved);
  assert.equal(enter(h,id),false);count(h,mode,start+2*delta);
  const opposite=mode==='fractal'?(delta>0?'fractal-back':'fractal-forward'):(delta>0?'walk-back':'walk-step-one');
  click(h,opposite);count(h,mode,start+delta);
  assert.deepEqual(h.drawing(),after.drawing,'fresh forward/backward restores the exact seeded drawing');
 }
});

test('one-step guards preserve focus, limits and re-enable the opposite direction',async()=>{
 for(const [mode,id,,delta] of cases){
  const low=mode==='fractal'?300:16,high=mode==='fractal'?12000:512;
  const limit=delta<0?low:high,start=limit-delta;
  const h=await setup(`?experiment=${mode}&at=v1,${start}`);h.el(id).focus();
  enter(h,id);count(h,mode,limit);
  assert.equal(h.el(id).getAttribute('aria-disabled'),'true');
  const after=snapshot(h);
  for(let i=0;i<3;i++){enter(h,id,true);enter(h,id);}
  assert.deepEqual(snapshot(h),after);
  const opposite=mode==='fractal'?(delta>0?'fractal-back':'fractal-forward'):(delta>0?'walk-back':'walk-step-one');
  enter(h,opposite);assert.equal(h.el(id).getAttribute('aria-disabled'),'false');
  enter(h,id);count(h,mode,limit);
 }
});

test('Space, pointer and assistive-style clicks keep the native one-action path',async()=>{
 for(const [mode,id,start,delta] of cases){
  const h=await setup(`?experiment=${mode}&at=v1,${start}`);h.el(id).focus();
  const before=snapshot(h);
  for(const key of [' ','Tab','Escape','ArrowRight','Home'])for(const repeat of [false,true]){
   let prevented=false;
   h.el(id).handlers.keydown?.({key,repeat,preventDefault(){prevented=true;}});
   assert.equal(prevented,false,key+' keeps its native default');
  }
  assert.deepEqual(snapshot(h),before,'keydown alone does not synthesize clicks');
  // Model Space's single keyup activation and ordinary click activation.
  for(let i=1;i<=3;i++){click(h,id);count(h,mode,start+i*delta);}
 }
});

test('a repeat arriving after focus changes cannot interrupt a running experiment',async()=>{
 for(const [mode,id,start] of cases){
  const h=await setup(`?experiment=${mode}&at=v1,${start}`);click(h,'pause');h.el(id).focus();
  const before=snapshot(h);
  assert.equal(enter(h,id,true),true);assert.deepEqual(snapshot(h),before);
  assert.equal(h.frames.size,1);
  enter(h,id);assert.equal(h.frames.size,0);
 }
});

test('tab, anchor, resize and a new URL keep repeat handling free of stale key state',async()=>{
 for(const [mode,id,start,delta] of cases){
  const h=await setup(`?experiment=${mode}&at=v1,${start}`,'#canvas');
  enter(h,id);h.tabs[2].handlers.click();const wave=snapshot(h);
  enter(h,id,true);assert.deepEqual(snapshot(h),wave);
  h.tabs[mode==='fractal'?3:4].handlers.click();count(h,mode,start+delta);
  h.navigate('#observation-title');h.resize(300,240);h.el(id).focus();
  const after=snapshot(h);enter(h,id,true);assert.deepEqual(snapshot(h),after);
  enter(h,id);count(h,mode,start+2*delta);
  h.navigate(`?experiment=${mode}&seed=99&at=v1,${start}#canvas`);
  enter(h,id);count(h,mode,start+delta);
 }
});

test('replay and held keys cannot complete unchecked discoveries or replace notes',async()=>{
 for(const mode of ['fractal','walk']){
  const h=await setup(`?experiment=${mode}`);click(h,'mission-start');
  if(mode==='fractal')click(h,'fractal-1000');
  click(h,'mission-check');
  if(mode==='fractal'){h.el('seed').handlers.input({target:{value:'15'}});click(h,'fractal-1000');}
  else click(h,'walk-64');
  const id=mode==='fractal'?'fractal-back':'walk-back',forward=mode==='fractal'?'fractal-forward':'walk-step-one';
  enter(h,id);for(let i=0;i<6;i++)enter(h,id,true);enter(h,forward);
  assert.equal(h.el('notes-count').textContent,'0 / 5');
  click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
  const notes=h.el('field-notes-list').innerHTML;
  enter(h,id);enter(h,id,true);enter(h,forward);
  assert.equal(h.el('field-notes-list').innerHTML,notes);
 }
});

test('batch stepping and directional navigation retain their existing repeat behavior',async()=>{
 for(const [mode,batch] of [['fractal',100],['walk',16]]){
  const h=await setup(`?experiment=${mode}`),start=mode==='fractal'?300:16;
  enter(h,'step');enter(h,'step',true);count(h,mode,start+2*batch);
 }
 const h=await setup('?experiment=wave');h.key('ArrowRight');h.key('ArrowRight',{repeat:true});
 assert.match(h.el('wave-probe-reading').textContent,/x 4.0/);
});
