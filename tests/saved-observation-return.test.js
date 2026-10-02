import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const saved=h=>({url:location.href,link:h.el('share-link').value,hidden:h.el('share-link').hidden,summary:h.el('saved-observation-reading').textContent});
const observations={wave:'?experiment=wave&wavelength=37&separation=126&at=v1,48,-12,1.25',fractal:'?experiment=fractal&jump=65&seed=23&at=v1,731',walk:'?experiment=walk&bias=7&seed=29&at=v1,83'};

test('opened observations expose a quiet, accurate return destination; parameter-only and invalid links do not',async()=>{
 for(const mode of ['orbit','life','wave','fractal','walk']){
  const h=await setup('?experiment='+mode);
  assert.equal(h.el('saved-observation').hidden,true,mode);
 }
 for(const [mode,query] of Object.entries(observations)){
  const h=await setup(query);
  assert.equal(h.el('saved-observation').hidden,false,mode);
  assert.match(h.el('saved-observation-reading').textContent,mode==='wave'?/48.*-12.*1\.25/:mode==='fractal'?/731 点/:/83 步/);
  assert.equal(h.el('share-link').hidden,true,'opening does not claim copying');
 }
 for(const query of ['?experiment=fractal&at=v1,299','?experiment=walk&at=v1,513','?experiment=wave&at=v1,0,0,-1','?experiment=wave&at=v1,0,0,1&at=v1,0,0,2']){
  const h=await setup(query);assert.equal(h.el('saved-observation').hidden,true);
 }
});

for(const [mode,query] of Object.entries(observations))test(mode+' returns exactly to its fixed observation after running, replay, reset and repeated activation',async()=>{
 const h=await setup(query,'#control-title');
 const drawing=h.drawing(),metrics=h.el('metrics').textContent,before=saved(h),writes=h.writes();
 let scrolls=0;h.el('canvas').scrollIntoView=()=>{scrolls++;assert.equal(h.el('metrics').textContent,metrics,'render precedes scrolling');};
 for(const action of ['step','run','reset']){
  if(action==='run'){click(h,'pause');h.tick(0);h.tick(50);h.tick(100);}
  else click(h,action);
  click(h,'observation-return');
  assert.deepEqual(h.drawing(),drawing,action);assert.equal(h.frames.size,0);assert.equal(h.el('status').textContent,'已暂停');
  assert.deepEqual(saved(h),before);assert.equal(h.writes(),writes);assert.equal(document.activeElement,h.el('canvas'));
  assert.match(h.el('announcement').textContent,/已回到链接中的观测/);
 }
 click(h,'observation-return');assert.deepEqual(h.drawing(),drawing);assert.equal(scrolls,4);
 click(h,'step');const next=h.drawing();click(h,'observation-return');click(h,'step');assert.deepEqual(h.drawing(),next,'same next model update');
});

test('sharing updates the return destination while ordinary progression does not; parameter changes hide it',async()=>{
 for(const [mode,query] of Object.entries(observations)){
  const h=await setup(query);click(h,'step');await click(h,'share');
  const drawing=h.drawing(),before=saved(h);click(h,'step');
  assert.deepEqual(saved(h),before);click(h,'observation-return');assert.deepEqual(h.drawing(),drawing);assert.deepEqual(saved(h),before);
  input(h,mode==='wave'?'wavelength':mode==='fractal'?'jump':'bias',mode==='wave'?38:mode==='fractal'?66:8);
  assert.equal(h.el('saved-observation').hidden,true);const after=h.drawing(),url=location.href;click(h,'observation-return');
  assert.deepEqual(h.drawing(),after);assert.equal(location.href,url,'hidden action is inert');
 }
});

test('tab returns retain each checkpoint, new history selects a new destination, and resize restores a visible wave probe',async()=>{
 const h=await setup(observations.wave);await click(h,'share');click(h,'wave-right');const wave=saved(h);
 click(h,'tab-fractal');await click(h,'share');click(h,'step');const fractal=saved(h);
 click(h,'tab-wave');assert.deepEqual(saved(h),wave);h.resize(250,350);click(h,'observation-return');
 assert.match(h.el('wave-probe-reading').textContent,/x 48\.0，y -12\.0/);
 const probe=h.probe();assert.ok(probe.x>=0&&probe.x<=250&&probe.y>=0&&probe.y<=350);
 click(h,'tab-fractal');assert.deepEqual(saved(h),fractal);click(h,'observation-return');assert.match(h.el('metrics').textContent,/^300 个点/);
 h.navigate('?experiment=walk&at=v1,512#canvas');assert.match(h.el('saved-observation-reading').textContent,/512 步/);
 click(h,'walk-back');click(h,'observation-return');assert.equal(h.el('pause').getAttribute('aria-disabled'),'true');
 h.navigate(location.search+'#field-notes');assert.equal(h.el('saved-observation').hidden,false);
 h.navigate('?experiment=life');assert.equal(h.el('saved-observation').hidden,true);
});

test('active and completed discoveries survive return without recording a new finding or touching other worlds',async()=>{
 const h=await setup('?experiment=walk');click(h,'mission-start');click(h,'mission-check');await click(h,'share');
 const mission=h.el('mission-result').textContent,steps=[0,1,2].map(i=>h.el('mission-step-'+i).textContent);
 click(h,'walk-64');click(h,'observation-return');assert.equal(h.el('mission-result').textContent,mission);
 assert.deepEqual([0,1,2].map(i=>h.el('mission-step-'+i).textContent),steps);assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'walk-64');click(h,'mission-check');const notes=h.el('notes-text').value;
 click(h,'tab-life');click(h,'step');const life=h.drawing();click(h,'tab-walk');click(h,'observation-return');
 assert.equal(h.el('mission-state').textContent,'已留下发现');assert.equal(h.el('notes-text').value,notes);assert.equal(h.el('notes-count').textContent,'1 / 5');
 click(h,'tab-life');assert.deepEqual(h.drawing(),life);
});

test('replacements clear stale destinations and cap checkpoints remain recoverable',async()=>{
 for(const action of ['preset','guide-start','mission-start']){
  const h=await setup(observations.fractal);click(h,action);assert.equal(h.el('saved-observation').hidden,true,action);
 }
 for(const [mode,count] of [['fractal',12000],['walk',512]]){
  const h=await setup('?experiment='+mode+'&at=v1,'+count);click(h,mode==='fractal'?'fractal-back':'walk-back');
  click(h,'observation-return');assert.equal(h.el('pause').getAttribute('aria-disabled'),'true');assert.equal(h.frames.size,0);
 }
});

test('return cancels obsolete pending clipboard feedback without copying again or overwriting its own announcement',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 try{
  for(const success of [true,false]){
   let finish,copies=0;
   const operation=new Promise((resolve,reject)=>{finish=()=>success?resolve():reject(Error('blocked'));});
   Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>{copies++;return operation;}}}});
   const h=await setup(observations.fractal),pending=click(h,'share'),before=saved(h);
   click(h,'step');click(h,'observation-return');const announcement=h.el('announcement').textContent;
   assert.equal(h.el('share-status').hidden,true);assert.equal(h.el('share-status').textContent,'');
   finish();await pending;
   assert.equal(copies,1);assert.equal(h.el('announcement').textContent,announcement);assert.equal(h.el('share-status').hidden,true);
   assert.deepEqual(saved(h),before);assert.match(h.el('metrics').textContent,/^731 个点/);
  }
 }finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
});

test('the saved destination stays quiet through animation and guards unsupported-world activations',async()=>{
 for(const [mode,query] of Object.entries(observations)){
  const h=await setup(query),summary=h.el('saved-observation-reading').textContent;click(h,'pause');const announcement=h.el('announcement').textContent;
  h.tick(0);h.tick(50);h.tick(100);
  assert.equal(h.el('saved-observation-reading').textContent,summary,mode);assert.equal(h.el('announcement').textContent,announcement,mode);
 }
 for(const mode of ['orbit','life']){
  const h=await setup('?experiment='+mode),drawing=h.drawing(),before=location.href;click(h,'observation-return');
  assert.deepEqual(h.drawing(),drawing);assert.equal(location.href,before);assert.equal(h.el('notes-count').textContent,'0 / 5');
 }
});

test('return guards held Enter while keeping ordinary native input and a named visible canvas destination',async()=>{
 const h=await setup(observations.fractal);const handler=h.el('observation-return').handlers.keydown;
 for(const [key,repeat,expected] of [['Enter',true,true],['Enter',false,false],[' ',true,false],['Tab',false,false]]){
  let prevented=false;handler({key,repeat,preventDefault(){prevented=true;}});assert.equal(prevented,expected);
 }
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<div id="saved-observation" class="saved-observation" hidden>/);
 assert.match(html,/<p id="saved-observation-reading" aria-live="off">/);
 assert.match(html,/<button id="observation-return"[^>]*aria-describedby="saved-observation-reading observation-return-help"/);
 assert.match(html,/返回会替换当前画布并暂停，不刷新页面；保留探索进度与本次发现/);
 assert.match(css,/\.saved-observation\{[^}]*grid-column:1\/-1/);
 assert.match(css,/\.saved-observation p[^}]*overflow-wrap:anywhere/);
});
