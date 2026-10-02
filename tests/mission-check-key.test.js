import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const modes=['orbit','life','wave','fractal','walk'];
const checks=['mission-check','mission-check-inline'];
const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
// Native buttons activate on Enter keydown unless its default is prevented.
function enter(h,id,repeat=false){
 let prevented=false;
 h.el(id).handlers.keydown?.({key:'Enter',repeat,preventDefault(){prevented=true;}});
 if(!prevented)click(h,id);
 return prevented;
}
function snapshot(h){
 return {drawing:h.drawing(),draws:h.drawCount(),metrics:h.el('metrics').textContent,
  result:h.el('mission-result').textContent,announcement:h.el('announcement').textContent,
  state:h.el('mission-state').textContent,steps:[0,1,2].map(i=>h.el('mission-step-'+i).textContent),
  status:h.el('status').textContent,frames:h.frames.size,notes:h.el('field-notes-list').innerHTML,
  count:h.el('passport-count').textContent,url:location.href,link:h.el('share-link').value,
  writes:h.writes(),focus:document.activeElement};
}
function prepareBaseline(h,mode){
 click(h,'mission-start');if(mode==='fractal')click(h,'fractal-1000');
}
function prepareCompletion(h,mode){
 if(mode==='orbit'){input(h,'gravity',40);for(let i=0;i<70;i++)click(h,'step');}
 if(mode==='life')for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 if(mode==='wave')click(h,'wave-home');
 if(mode==='fractal'){input(h,'seed',15);click(h,'fractal-1000');}
 if(mode==='walk')click(h,'walk-64');
}

for(const mode of modes)test(`${mode}: a held upper Check preserves its first result and model`,async()=>{
 const h=await setup('?experiment='+mode);prepareBaseline(h,mode);
 await click(h,'share');const saved=location.href;
 h.el('mission-check').focus();
 assert.equal(enter(h,'mission-check'),false);
 const after=snapshot(h);
 if(mode!=='life'){
  assert.match(after.result,/已记录/);
  assert.match(after.steps[0],/已完成/);assert.match(after.steps[1],/当前步骤/);
 }
 assert.equal(after.count,'本次发现 0 / 5');
 for(let i=0;i<12;i++)assert.equal(enter(h,'mission-check',true),true);
 assert.deepEqual(snapshot(h),after,'held Enter must not redraw, reannounce or replace successful feedback');
 assert.equal(location.href,saved);assert.equal(document.activeElement,h.el('mission-check'));
 // A separate press intentionally rechecks, and the earlier baseline still supports completion.
 assert.equal(enter(h,'mission-check'),false);
 if(mode!=='life')assert.notEqual(h.el('mission-result').textContent,after.result);
 prepareCompletion(h,mode);enter(h,'mission-check');
 assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');
 assert.equal(h.el('mission-state').textContent,'已留下发现');
 assert.equal(document.activeElement,h.el('mission-result'));
});

for(const mode of modes)test(`${mode}: either Check suppresses repeats before activation and preserves completion focus`,async()=>{
 for(const id of checks){
  const h=await setup('?experiment='+mode);prepareBaseline(h,mode);
  if(mode!=='life')click(h,'mission-check');
  prepareCompletion(h,mode);click(h,'pause');h.el(id).focus();
  const events=[],result=h.el('mission-result');
  result.scrollIntoView=options=>events.push({options,text:result.textContent,hidden:result.hidden});
  const before=snapshot(h);
  assert.equal(enter(h,id,true),true);assert.deepEqual(snapshot(h),before);assert.deepEqual(events,[]);
  assert.equal(enter(h,id),false);
  assert.equal(h.el('mission-state').textContent,'已留下发现');assert.equal(h.frames.size,0);
  assert.deepEqual(events,[{options:{block:'center'},text:result.textContent,hidden:false}]);
  assert.equal(document.activeElement,result);assert.equal(h.el(id).hidden,true);
  const after=snapshot(h);events.length=0;
  assert.equal(enter(h,id,true),true);assert.deepEqual(snapshot(h),after);assert.deepEqual(events,[]);
 }
});

test('Space and ordinary keys remain native; pointer and assistive-style clicks still check',async()=>{
 for(const id of checks){
  const h=await setup('?experiment=fractal');prepareBaseline(h,'fractal');h.el(id).focus();
  const before=snapshot(h);
  for(const key of [' ','Tab','Escape','ArrowRight','Home'])for(const repeat of [false,true]){
   let prevented=false;h.el(id).handlers.keydown?.({key,repeat,preventDefault(){prevented=true;}});
   assert.equal(prevented,false,key+' retains native default');
  }
  assert.deepEqual(snapshot(h),before,'keydown does not synthesize a click');
  // Model native Space keyup, then a deliberate independent click.
  click(h,id);assert.match(h.el('mission-result').textContent,/种子 14 已记录/);
  click(h,id);assert.match(h.el('mission-result').textContent,/需要种子 15/);
  prepareCompletion(h,'fractal');click(h,id);assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');
 }
});

test('tab, anchor, resize, restart and new URL cannot leave stale key state',async()=>{
 const h=await setup('?experiment=fractal','#canvas');prepareBaseline(h,'fractal');enter(h,'mission-check');
 const feedback=h.el('mission-result').textContent;
 click(h,'tab-wave');prepareBaseline(h,'wave');h.el('mission-check').focus();
 let before=snapshot(h);enter(h,'mission-check',true);assert.deepEqual(snapshot(h),before);
 enter(h,'mission-check');assert.match(h.el('mission-result').textContent,/静区已记录/);
 click(h,'tab-fractal');assert.equal(h.el('mission-result').textContent,feedback);
 h.navigate('#observation-title');h.resize(300,240);h.el('mission-check').focus();
 before=snapshot(h);enter(h,'mission-check',true);assert.deepEqual(snapshot(h),before);
 click(h,'mission-start');click(h,'fractal-1000');enter(h,'mission-check');
 assert.match(h.el('mission-result').textContent,/种子 14 已记录/);
 h.navigate('?experiment=walk&seed=99#canvas');
 const inactive=snapshot(h);enter(h,'mission-check',true);enter(h,'mission-check');assert.deepEqual(snapshot(h),inactive);
 prepareBaseline(h,'walk');enter(h,'mission-check');assert.match(h.el('mission-result').textContent,/16 步已记录/);
});

test('inline progress still reveals and focuses the rendered result once',async()=>{
 for(const mode of modes){
  const h=await setup('?experiment='+mode);prepareBaseline(h,mode);
  const events=[],result=h.el('mission-result');
  result.scrollIntoView=options=>events.push({options,text:result.textContent,hidden:result.hidden});
  h.el('mission-check-inline').focus();enter(h,'mission-check-inline');
  assert.deepEqual(events,[{options:{block:'center'},text:result.textContent,hidden:false}]);
  assert.equal(document.activeElement,result);const after=snapshot(h);events.length=0;
  enter(h,'mission-check-inline',true);assert.deepEqual(snapshot(h),after);assert.deepEqual(events,[]);
 }
});
