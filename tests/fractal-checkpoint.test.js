import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const checkpoint=()=>new URL(location.href).searchParams.get('at');
const sharing=h=>({url:location.href,value:h.el('share-link').value,hidden:h.el('share-link').hidden,status:h.el('share-status').textContent,statusHidden:h.el('share-status').hidden});
const compare=h=>click(h,'fractal-1000');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
async function withClipboard(clipboard,run){
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard}});
 try{await run();}finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
}

test('1,000-point comparison preserves opened and explicitly shared checkpoints at every progress boundary',async()=>{
 for(const count of [300,731,1000,12000])for(const shown of [false,true]){
  const h=await setup(`?experiment=fractal&jump=65&seed=23&at=v1,${count}`,'#canvas',false);
  if(shown)await click(h,'share');
  const before=sharing(h),writes=h.writes();
  h.el('preset-select').handlers.change({target:{value:'overlap'}});
  h.el('fractal-1000').focus();compare(h);
  assert.match(h.el('metrics').textContent,/^1000 个点 · 前进 65% · 种子 23$/);
  assert.deepEqual(sharing(h),before);assert.equal(h.writes(),writes);
  assert.equal(h.el('preset-select').value,'overlap');
  assert.equal(h.el('status').textContent,'已暂停');assert.equal(h.frames.size,0);
  assert.equal(document.activeElement,h.el('fractal-1000'));
  assert.equal(h.el('fractal-forward').getAttribute('aria-disabled'),'false');
 }
});

test('comparison pauses running growth and repeated comparison/replay keeps the exact seeded model and fixed link',async()=>{
 const h=await setup('?experiment=fractal&jump=38&seed=99&at=v1,731');await click(h,'share');
 const before=sharing(h);click(h,'pause');h.tick(0);h.tick(50);h.tick(100);
 assert.match(h.el('metrics').textContent,/831 个点/);compare(h);
 const thousand=h.drawing();assert.equal(h.frames.size,0);assert.deepEqual(sharing(h),before);
 for(let i=0;i<3;i++){click(h,'fractal-forward');compare(h);assert.deepEqual(h.drawing(),thousand);assert.deepEqual(sharing(h),before);}
 click(h,'fractal-back');click(h,'fractal-forward');assert.deepEqual(h.drawing(),thousand);
 click(h,'fractal-forward');const next=h.drawing();
 const reference=await setup('?experiment=fractal&jump=38&seed=99&at=v1,1001');
 assert.deepEqual(reference.drawing(),next,'comparison keeps the same next seeded draw');
});

test('parameter-only starts stay parameter-only, and Share explicitly records the new 1,000-point result',async()=>{
 for(const motion of [false,true]){
  const h=await setup('?experiment=fractal&jump=50&seed=14','#canvas',motion),before=location.href,writes=h.writes();
  compare(h);assert.equal(location.href,before);assert.equal(h.writes(),writes);assert.equal(checkpoint(),null);
  assert.equal(h.el('share-link').hidden,true);assert.equal(h.frames.size,0);
  await click(h,'share');assert.equal(checkpoint(),'v1,1000');assert.equal(h.el('share-link').hidden,false);
 }
 const h=await setup('?experiment=fractal&at=v1,731');await click(h,'share');const original=h.el('share-link').value;
 compare(h);assert.equal(h.el('share-link').value,original);await click(h,'share');
 const updated=h.el('share-link').value;assert.notEqual(updated,original);assert.equal(checkpoint(),'v1,1000');
 const drawing=h.drawing(),reopened=await setup(new URL(updated).search);
 assert.deepEqual(reopened.drawing(),drawing);assert.equal(reopened.frames.size,0);
});

test('tab returns retain the live comparison separately from its saved observation',async()=>{
 const h=await setup('?experiment=fractal&jump=65&seed=23&at=v1,731','#canvas');await click(h,'share');
 const saved=h.el('share-link').value;compare(h);const drawing=h.drawing();
 for(const world of ['orbit','life','wave','walk']){
  click(h,'tab-'+world);click(h,'step');const metrics=h.el('metrics').textContent;
  compare(h);assert.equal(h.el('metrics').textContent,metrics,'hidden comparison is guarded');
  click(h,'tab-fractal');assert.deepEqual(h.drawing(),drawing);assert.equal(location.href,saved);
  assert.equal(h.el('share-link').value,saved);assert.equal(h.el('share-link').hidden,false);
  assert.equal(h.frames.size,0);
 }
});

test('anchor-only history keeps the comparison while an actual observation restoration reopens the saved point count',async()=>{
 const h=await setup('?experiment=fractal&jump=50&seed=14&at=v1,731','#canvas');await click(h,'share');
 const saved=h.el('share-link').value;compare(h);const drawing=h.drawing();
 h.navigate(location.search+'#observation-title');assert.deepEqual(h.drawing(),drawing);assert.equal(checkpoint(),'v1,731');
 h.navigate(location.search+'#canvas');assert.deepEqual(h.drawing(),drawing);assert.equal(location.href,saved);
 h.navigate('?experiment=wave&at=v1,0,0,0.2');h.navigate(saved);
 assert.match(h.el('metrics').textContent,/^731 个点/);assert.equal(h.frames.size,0);
});

test('comparison retains completed and fallback copy feedback, including a still-pending copy of the original checkpoint',async()=>{
 for(const success of [true,false])await withClipboard({writeText:()=>success?Promise.resolve():Promise.reject(Error('blocked'))},async()=>{
  const h=await setup('?experiment=fractal&at=v1,731');await click(h,'share');const before=sharing(h);
  compare(h);assert.deepEqual(sharing(h),before);
  assert.match(h.el('share-status').textContent,success?/已复制观测链接/:/自动复制未完成/);
 });
 for(const success of [true,false]){
  const operation=deferred(),copies=[];
  await withClipboard({writeText:url=>{copies.push(url);return operation.promise;}},async()=>{
   const h=await setup('?experiment=fractal&at=v1,731'),pending=click(h,'share'),before=sharing(h);
   compare(h);assert.deepEqual(sharing(h),before);
   if(success)operation.resolve();else operation.reject(Error('blocked'));await pending;
   assert.equal(h.el('share-link').value,copies[0]);assert.equal(checkpoint(),'v1,731');
   assert.match(h.el('share-status').textContent,success?/已复制观测链接/:/自动复制未完成/);
   assert.match(h.el('metrics').textContent,/^1000 个点/);
  });
 }
});

test('a newer Share supersedes an old pending copy after comparison',async()=>{
 const old=deferred(),latest=deferred();let calls=0;
 await withClipboard({writeText:()=>[old,latest][calls++].promise},async()=>{
  const h=await setup('?experiment=fractal&at=v1,731'),first=click(h,'share');compare(h);
  const second=click(h,'share');latest.resolve();await second;
  assert.equal(checkpoint(),'v1,1000');const before=sharing(h),announcement=h.el('announcement').textContent;
  old.reject(Error('stale'));await first;
  assert.deepEqual(sharing(h),before);assert.equal(h.el('announcement').textContent,announcement);
 });
});

test('parameter, preset, guide and explicit new-observation replacements retain their existing invalidation behavior',async()=>{
 for(const replace of [h=>input(h,'seed',15),h=>input(h,'jump',65),h=>{h.el('preset-select').handlers.change({target:{value:'islands'}});click(h,'load-preset');},h=>click(h,'guide-start'),h=>click(h,'mission-start')]){
  const h=await setup('?experiment=fractal&at=v1,731');await click(h,'share');compare(h);replace(h);
  assert.equal(checkpoint(),null);assert.equal(h.el('share-link').hidden,true);assert.equal(h.el('share-status').hidden,true);
  assert.match(h.el('metrics').textContent,/^300 个点/);
 }
 const h=await setup('?experiment=fractal&at=v1,731');compare(h);h.navigate('?experiment=fractal&at=v1,888');
 assert.equal(checkpoint(),'v1,888');assert.match(h.el('metrics').textContent,/^888 个点/);
});

test('comparison preserves exploration evidence and never completes or overwrites a historical discovery by itself',async()=>{
 const h=await setup('?experiment=fractal');click(h,'mission-start');compare(h);click(h,'mission-check');
 input(h,'seed',15);click(h,'fractal-forward');await click(h,'share');const saved=location.href;
 const instruction=h.el('mission-instruction').textContent,feedback=h.el('mission-result').textContent;
 compare(h);assert.equal(h.el('mission-instruction').textContent,instruction);assert.equal(h.el('mission-result').textContent,feedback);
 assert.equal(h.el('notes-count').textContent,'0 / 5');assert.equal(location.href,saved);
 click(h,'mission-check');assert.equal(h.el('mission-state').textContent,'已留下发现');
 const notes=h.el('field-notes-list').innerHTML;click(h,'fractal-forward');compare(h);
 assert.equal(h.el('field-notes-list').innerHTML,notes);assert.equal(h.el('notes-count').textContent,'1 / 5');assert.equal(location.href,saved);
});
