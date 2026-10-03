import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
import {readObservation} from '../observation.js';

const click=(h,id)=>h.el(id).handlers.click?.();
const inputs={wave:'?experiment=wave&wavelength=37&separation=126&at=v1,48,-12,1.25',fractal:'?experiment=fractal&jump=65&seed=23&at=v1,731',walk:'?experiment=walk&bias=7&seed=29&at=v1,83'};
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),frames:[...h.frames.keys()],url:location.href,writes:h.writes(),metrics:h.el('metrics').textContent,status:h.el('status').textContent,saved:h.el('saved-observation-reading').textContent,recovery:h.el('observation-undo-status').textContent,undo:h.el('observation-undo').getAttribute('aria-disabled'),focus:document.activeElement,notes:h.el('notes-text').value,notebook:h.el('field-notes-list').innerHTML,mission:h.el('mission-result').textContent,missionState:h.el('mission-state').textContent});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});promise.catch(()=>{});return {promise,resolve,reject};};
async function clipboard(run,write=async()=>{}){
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),copies=[];
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:url=>{copies.push(url);return write(url);}}}});
 try{await run(copies);}finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
}

for(const mode of Object.keys(inputs))for(const running of [false,true])test(`${mode}: copying a fixed observation preserves the ${running?'running':'paused'} later moment exactly`,async()=>{
 await clipboard(async copies=>{
  const h=await setup(inputs[mode]);click(h,'step');if(running){click(h,'pause');h.tick(0);h.tick(50);}
  h.el('observation-copy').focus();const before=state(h);let selects=0;h.el('share-link').select=()=>selects++;
  await click(h,'observation-copy');assert.equal(copies.length,1);assert.equal(copies[0],before.url);
  assert.deepEqual(readObservation(new URL(copies[0]).search,mode),readObservation(inputs[mode],mode));
  assert.deepEqual(state(h),before);assert.equal(selects,0,'copy never grabs a field selection');
  assert.equal(h.el('share-link').hidden,false);assert.equal(h.el('share-link').value,before.url);
  assert.match(h.el('share-status').textContent,/已复制链接中的观测.*当前实验未改变/);
  assert.equal(h.el('announcement').textContent,h.el('share-status').textContent);
  if(running){h.tick(100);h.tick(150);assert.notEqual(h.el('metrics').textContent,before.metrics,'animation remains live');}
 });
});

for(const mode of Object.keys(inputs))test(`${mode}: copying keeps a pre-return recovery and the exact next seeded/model step`,async()=>{
 await clipboard(async()=>{
  const h=await setup(inputs[mode]);click(h,'step');click(h,'step');const later=h.drawing();
  click(h,'step');const next=h.drawing();click(h,'observation-return');click(h,'observation-undo');
  // Establish recovery at a known later moment again.
  click(h,'observation-return');h.el('observation-copy').focus();const before=state(h);
  await click(h,'observation-copy');assert.deepEqual(state(h),before);assert.equal(before.undo,'false');
  click(h,'observation-undo');assert.deepEqual(h.drawing(),next);assert.notDeepEqual(h.drawing(),later);
  click(h,'step');const following=h.drawing();click(h,'observation-return');click(h,'observation-undo');assert.deepEqual(h.drawing(),following);
 });
});

test('a valid fixed Wave link remains copyable when the later probe or time is outside the share format',async()=>{
 for(const [query,action] of [['?experiment=wave&at=v1,10000,0,2.5','wave-right'],['?experiment=wave&at=v1,8,0,1000000000','step']])await clipboard(async copies=>{
  const h=await setup(query);click(h,action);h.el('observation-copy').focus();const before=state(h);
  await click(h,'observation-copy');assert.deepEqual(state(h),before);assert.equal(copies[0],before.url);
  await click(h,'share');assert.equal(copies.length,1);assert.match(h.el('share-status').textContent,/超出链接可保存的范围/);
 });
});

test('clipboard rejection and missing API expose the fixed manual-copy field without stealing later focus',async()=>{
 for(const missing of [false,true])await clipboard(async copies=>{
  if(missing)delete navigator.clipboard;
  const h=await setup(inputs.walk);click(h,'step');h.el('observation-copy').focus();const before=state(h);
  const pending=click(h,'observation-copy');h.el('walk-step-one').focus();await pending;
  assert.deepEqual({...state(h),focus:before.focus},before);assert.equal(document.activeElement,h.el('walk-step-one'));
  assert.equal(h.el('share-link').value,before.url);assert.equal(h.el('share-link').hidden,false);
  assert.match(h.el('share-status').textContent,/自动复制未完成.*上方观测链接.*当前实验未改变/);
 },()=>Promise.reject(Error('clipboard denied')));
});

test('a hidden copy command is inert for parameter-only worlds, missing, malformed and replaced checkpoints',async()=>{
 await clipboard(async copies=>{
  for(const query of ['?experiment=orbit','?experiment=life','?experiment=wave','?experiment=fractal&at=v1,299','?experiment=walk&at=v1,513']){
   const h=await setup(query);h.el('observation-copy').focus();const before=state(h),announcement=h.el('announcement').textContent;
   await click(h,'observation-copy');assert.deepEqual(state(h),before);assert.equal(h.el('announcement').textContent,announcement);
  }
  const h=await setup(inputs.walk);h.el('bias').handlers.input({target:{value:'8'}});const before=state(h);
  await click(h,'observation-copy');assert.deepEqual(state(h),before);assert.equal(copies.length,0);
 });
});

test('copies follow retained per-world checkpoints and anchors, while new-share still replaces the checkpoint',async()=>{
 await clipboard(async copies=>{
  const h=await setup(inputs.wave);click(h,'step');await click(h,'observation-copy');const wave=copies.at(-1);
  click(h,'tab-fractal');click(h,'step');await click(h,'share');const fractal=copies.at(-1);click(h,'step');await click(h,'observation-copy');assert.equal(copies.at(-1),fractal);
  click(h,'tab-wave');h.navigate(location.search+'#control-title');await click(h,'observation-copy');
  assert.equal(new URL(copies.at(-1)).search,new URL(wave).search);assert.equal(new URL(copies.at(-1)).hash,'#control-title');
  assert.deepEqual(readObservation(location.search,'wave'),readObservation(inputs.wave,'wave'));
  await click(h,'share');assert.notEqual(new URL(copies.at(-1)).search,new URL(wave).search);assert.equal(h.el('status').textContent,'已暂停');assert.equal(document.activeElement,h.el('share-link'));
 });
});

test('copying preserves completed notebook evidence, active exploration, resize and context recovery',async()=>{
 await clipboard(async()=>{
  const h=await setup('?experiment=walk');click(h,'mission-start');click(h,'mission-check');await click(h,'share');
  click(h,'walk-64');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
  click(h,'observation-return');h.resize(280,210);h.setDpr(2);h.loseContext();h.restoreContext();h.el('observation-copy').focus();const before=state(h);
  await click(h,'observation-copy');assert.deepEqual(state(h),before);click(h,'observation-undo');assert.match(h.el('metrics').textContent,/64 步/);assert.equal(h.el('notes-count').textContent,'1 / 5');
 });
});

for(const succeeds of [false,true])test(`obsolete ${succeeds?'success':'failure'} cannot replace newer checkpoint-copy or share feedback`,async()=>{
 for(const next of ['observation-copy','share']){
  const old=deferred();let call=0;await clipboard(async copies=>{
   const h=await setup(inputs.fractal);const pending=click(h,'observation-copy');click(h,'step');await click(h,next);const message=h.el('share-status').textContent;
   h.el('fractal-forward').focus();if(succeeds)old.resolve();else old.reject(Error('late failure'));await pending;
   assert.equal(h.el('share-status').textContent,message);assert.equal(h.el('announcement').textContent,message);assert.equal(document.activeElement,h.el('fractal-forward'));assert.equal(copies.length,2);
  },()=>call++===0?old.promise:Promise.resolve());
 }
});

test('obsolete existing-share feedback cannot overwrite a fixed-checkpoint copy',async()=>{
 const old=deferred();let call=0;await clipboard(async()=>{
  const h=await setup(inputs.wave),pending=click(h,'share');click(h,'step');await click(h,'observation-copy');const message=h.el('share-status').textContent;
  old.resolve();await pending;assert.equal(h.el('share-status').textContent,message);assert.match(message,/链接中的观测/);
 },()=>call++===0?old.promise:Promise.resolve());
});

test('return, undo, world round trips, parameter replacement and navigation cancel stale clipboard feedback',async()=>{
 for(const change of ['return','undo','tabs','parameter','navigation']){
  const old=deferred();await clipboard(async()=>{
   const h=await setup(inputs.walk);click(h,'step');if(change==='undo')click(h,'observation-return');const pending=click(h,'observation-copy');
   if(change==='return')click(h,'observation-return');if(change==='undo')click(h,'observation-undo');
   if(change==='tabs'){click(h,'tab-wave');click(h,'tab-walk');}
   if(change==='parameter')h.el('bias').handlers.input({target:{value:'8'}});
   if(change==='navigation')h.navigate('?experiment=walk&at=v1,120#canvas');
   const before={status:h.el('share-status').textContent,hidden:h.el('share-status').hidden,announcement:h.el('announcement').textContent,focus:document.activeElement};
   old.resolve();await pending;assert.deepEqual({status:h.el('share-status').textContent,hidden:h.el('share-status').hidden,announcement:h.el('announcement').textContent,focus:document.activeElement},before,change);
  },()=>old.promise);
 }
});

test('one Enter press copies once; other keys retain native behavior and copy controls are explicitly described',async()=>{
 const h=await setup(inputs.walk),button=h.el('observation-copy');
 for(const [key,repeat,expected] of [['Enter',true,true],['Enter',false,false],[' ',true,false],['Tab',false,false]]){
  let prevented=false;button.handlers.keydown?.({key,repeat,preventDefault(){prevented=true;}});assert.equal(prevented,expected);
 }
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<button id="observation-copy" type="button" aria-controls="share-link" aria-describedby="saved-observation-reading observation-copy-help share-status">复制这条观测链接<\/button>/);
 assert.match(html,/<small id="observation-copy-help">[^<]*不暂停、不改当前画布[^<]*保留撤销返回/);
 assert.match(css,/\.saved-observation button\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
});
