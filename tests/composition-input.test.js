import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const worlds=['orbit','life','wave','fractal','walk'];
const signals=[{isComposing:true},{isComposing:false,keyCode:229}];
const keys=['Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Enter',' '];
const readings=['metrics','status','announcement','orbit-position','orbit-recall-status','life-selection','life-cell-next','history-caption','life-test-result','wave-probe-reading','fractal-touch-reading','walk-step-reading','mission-state','mission-result','notes-count','saved-observation-reading'];
const click=(h,id)=>h.el(id).handlers.click();
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),frames:[...h.frames.keys()],readings:readings.map(id=>h.el(id).textContent),url:location.href,writes:h.writes(),link:h.el('share-link').value,notes:h.el('notes-text').value,fieldNotes:h.el('field-notes-list').innerHTML,focus:document.activeElement,undo:h.el('life-undo-edit').getAttribute('aria-disabled'),clear:h.el('life-undo-clear').getAttribute('aria-disabled'),trialHidden:h.el('life-return').hidden,tabs:h.tabs.map(tab=>({...tab.attributes}))});
function dispatch(h,name,extra={},target=h.el('canvas')){
 let prevented=false;
 target.handlers.keydown({key:name,...extra,preventDefault(){prevented=true;}});
 return prevented;
}
function composition(h,target=h.el('canvas')){
 for(const signal of signals)for(const key of keys)for(const repeat of [false,true]){
  assert.equal(dispatch(h,key,{...signal,repeat},target),false,JSON.stringify({key,signal,repeat}));
 }
}
function pointer(h,type,x){h.el('canvas').handlers[type]?.({type,pointerId:1,isPrimary:true,button:0,buttons:type==='pointerup'?0:1,clientX:(x+.5)*600/48,clientY:4.5*414/32,detail:1});}

for(const world of worlds)for(const running of [false,true])test(`${world}: IME canvas keys leave ${running?'running':'paused'} state and browser defaults alone`,async()=>{
 const h=await setup('?experiment='+world,'#canvas',!running);h.el('canvas').focus();
 const before=state(h);composition(h);assert.deepEqual(state(h),before);
});

for(const world of worlds)test(`${world}: IME tab navigation preserves selected world, focus and retained state`,async()=>{
 const h=await setup('?experiment='+world);click(h,'step');
 const tab=h.el('tab-'+world);tab.focus();const before=state(h);
 composition(h,tab);assert.deepEqual(state(h),before);
 assert.equal(dispatch(h,'ArrowRight',{},tab),true);
 const next=worlds[(worlds.indexOf(world)+1)%worlds.length];assert.equal(document.activeElement,h.el('tab-'+next));
 assert.equal(new URL(location.href).searchParams.get('experiment'),next);
 click(h,'tab-'+world);tab.focus();assert.equal(h.el('metrics').textContent,before.readings[0]);
});

test('IME editing and undo keys retain Life drawing, comparison and clear recoveries',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');h.el('canvas').focus();
 const cleared=state(h);composition(h);assert.deepEqual(state(h),cleared);
 click(h,'life-undo-clear');const original=h.el('metrics').textContent;
 dispatch(h,'Enter');const edited=state(h);
 for(const signal of signals)for(const repeat of [false,true])for(const modifier of ['ctrlKey','metaKey']){
  assert.equal(dispatch(h,'z',{...signal,repeat,[modifier]:true}),false);
 }
 composition(h);assert.deepEqual(state(h),edited);
 dispatch(h,'z',{ctrlKey:true});assert.equal(h.el('metrics').textContent,original);
 click(h,'life-test');h.el('canvas').focus();const trial=state(h);composition(h);assert.deepEqual(state(h),trial);
 click(h,'life-return');assert.equal(h.el('metrics').textContent,original);
});

test('IME keys never terminate or redirect an active Life stroke or its one-edit recovery',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');h.el('canvas').focus();const captures=new Set();
 h.el('canvas').setPointerCapture=id=>captures.add(id);h.el('canvas').hasPointerCapture=id=>captures.has(id);h.el('canvas').releasePointerCapture=id=>captures.delete(id);
 pointer(h,'pointerdown',2);pointer(h,'pointermove',4);const before=state(h);
 composition(h);assert.deepEqual(state(h),before);assert.equal(captures.has(1),true);
 pointer(h,'pointermove',6);pointer(h,'pointerup',6);pointer(h,'click',6);
 assert.match(h.el('metrics').textContent,/5 个活格子/);dispatch(h,'z',{ctrlKey:true});assert.match(h.el('metrics').textContent,/0 个活格子/);
});

test('IME keys preserve saved checkpoints and Orbit launch recall',async()=>{
 for(const query of ['?experiment=orbit','?experiment=life','?experiment=wave&at=v1,48,-12,1.25','?experiment=fractal&at=v1,731','?experiment=walk&at=v1,83']){
  const h=await setup(query);if(query==='?experiment=orbit')dispatch(h,'Enter');
  await click(h,'share');click(h,'step');h.el('canvas').focus();const before=state(h);
  composition(h);assert.deepEqual(state(h),before);
  if(query==='?experiment=orbit'){click(h,'orbit-recall');assert.match(h.el('metrics').textContent,/3 颗行星/);}
 }
});

test('IME keys cannot change discovery evidence or a completed notebook',async()=>{
 const h=await setup('?experiment=walk');click(h,'mission-start');click(h,'mission-check');h.el('canvas').focus();
 const active=state(h);composition(h);assert.deepEqual(state(h),active);
 click(h,'walk-64');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');h.el('canvas').focus();
 const completed=state(h);composition(h);assert.deepEqual(state(h),completed);
});

test('fresh keyboard commands resume immediately after IME flags without a stuck input lock',async()=>{
 for(const [world,key,id] of [['orbit','Enter','metrics'],['life','Enter','metrics'],['wave','ArrowRight','wave-probe-reading'],['fractal','ArrowRight','metrics'],['walk','ArrowRight','metrics']]){
  const h=await setup('?experiment='+world);h.el('canvas').focus();composition(h);const before=h.el(id).textContent;
  assert.equal(dispatch(h,key,{isComposing:false,keyCode:0}),true);assert.notEqual(h.el(id).textContent,before);
 }
 for(const world of worlds){const h=await setup('?experiment='+world,'',false);composition(h);assert.equal(dispatch(h,'Escape'),true);assert.equal(h.frames.size,0);}
});

test('ordinary held positioning, discrete guards and intentional batch repeats stay intact',async()=>{
 for(const [world,id] of [['orbit','orbit-position'],['life','life-selection'],['wave','wave-probe-reading']]){
  const h=await setup('?experiment='+world);composition(h);const before=h.el(id).textContent;
  assert.equal(dispatch(h,'ArrowRight',{repeat:true}),true);assert.notEqual(h.el(id).textContent,before);
 }
 for(const world of ['orbit','life','fractal']){
  const h=await setup('?experiment='+world);composition(h);const before=state(h);
  assert.equal(dispatch(h,world==='fractal'?'ArrowRight':'Enter',{repeat:true}),true);assert.deepEqual(state(h),before);
 }
 const walk=await setup('?experiment=walk');composition(walk);dispatch(walk,'ArrowRight',{repeat:true});assert.match(walk.el('metrics').textContent,/32 步/);
 for(const world of ['fractal','walk']){const h=await setup('?experiment='+world);composition(h);assert.equal(dispatch(h,'Enter',{repeat:true},h.el('step')),false);const before=h.el('metrics').textContent;click(h,'step');assert.notEqual(h.el('metrics').textContent,before);}
});
