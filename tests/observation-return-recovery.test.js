import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const query={wave:'?experiment=wave&wavelength=37&separation=126&at=v1,48,-12,1.25',fractal:'?experiment=fractal&jump=65&seed=23&at=v1,731',walk:'?experiment=walk&bias=7&seed=29&at=v1,83'};
const available=h=>h.el('observation-undo').getAttribute('aria-disabled')==='false';
const reading=h=>['metrics','wave-probe-reading','observation-a','observation-b','observation-c'].map(id=>h.el(id).textContent);
const saved=h=>({url:location.href,link:h.el('share-link').value,hidden:h.el('share-link').hidden,writes:h.writes(),summary:h.el('saved-observation-reading').textContent});
const quiet=h=>({drawing:h.drawing(),draws:h.drawCount(),readings:reading(h),frames:[...h.frames.keys()],announcement:h.el('announcement').textContent,saved:saved(h)});
function progress(h,mode){click(h,'step');if(mode==='wave'){click(h,'wave-right');click(h,'wave-down');}}
function recoverable(h,mode){progress(h,mode);const before={drawing:h.drawing(),reading:reading(h)};click(h,'observation-return');assert.equal(available(h),true);return before;}

for(const mode of Object.keys(query))test(mode+' can undo an accidental checkpoint return, restoring the exact drawing and next model update',async()=>{
 const h=await setup(query[mode]);progress(h,mode);const drawing=h.drawing(),readings=reading(h),address=saved(h);
 click(h,'step');const next=h.drawing();click(h,'observation-return');
 // Establish the desired pre-return moment again independently of the recovery.
 progress(h,mode);assert.deepEqual(h.drawing(),drawing);click(h,'observation-return');
 assert.equal(available(h),true);assert.match(h.el('observation-undo-status').textContent,/可撤销：返回前的/);
 const button=h.el('observation-undo');button.focus();click(h,'observation-undo');
 assert.deepEqual(h.drawing(),drawing);assert.deepEqual(reading(h),readings);assert.deepEqual(saved(h),address);
 assert.equal(h.el('status').textContent,'已暂停');assert.equal(h.frames.size,0);assert.equal(document.activeElement,button);
 assert.equal(available(h),false);assert.match(h.el('announcement').textContent,/已撤销返回/);
 const after=quiet(h);click(h,'observation-undo');assert.deepEqual(quiet(h),after,'consumed recovery is inert');
 click(h,'step');assert.deepEqual(h.drawing(),next,'the next seeded draw or physical phase is identical');
});

test('repeated return at the same checkpoint preserves the useful recovery; later changed returns replace only one level',async()=>{
 for(const mode of Object.keys(query)){
  const h=await setup(query[mode]);const before=recoverable(h,mode),status=h.el('observation-undo-status').textContent;
  click(h,'observation-return');click(h,'observation-return');assert.equal(h.el('observation-undo-status').textContent,status);
  click(h,'observation-undo');assert.deepEqual(h.drawing(),before.drawing);
  progress(h,mode);const latest=h.drawing();click(h,'observation-return');click(h,'observation-undo');
  assert.deepEqual(h.drawing(),latest);assert.equal(available(h),false);
 }
});

test('ordinary exploration after return does not lose its one recovery',async()=>{
 for(const mode of Object.keys(query)){
  const h=await setup(query[mode]),before=recoverable(h,mode);progress(h,mode);
  click(h,'pause');h.tick(0);h.tick(50);h.tick(100);h.tick(150);
  assert.equal(available(h),true);click(h,'observation-undo');assert.deepEqual(h.drawing(),before.drawing);assert.equal(h.frames.size,0);
 }
});

test('a running pre-return moment is recovered paused, with the same model and retained fractional batch time',async()=>{
 for(const mode of Object.keys(query)){
  const h=await setup(query[mode]);click(h,'pause');h.tick(0);h.tick(50);h.tick(100);h.tick(150);
  // Pause changes the overlays only; it does not consume the fractional batch.
  click(h,'pause');const expected=h.drawing();click(h,'pause');click(h,'observation-return');click(h,'observation-undo');
  assert.deepEqual(h.drawing(),expected,mode);assert.equal(h.frames.size,0);
  if(mode==='fractal'||mode==='walk'){
   const before=h.el('metrics').textContent;click(h,'pause');h.tick(0);h.tick(50);
   assert.notEqual(h.el('metrics').textContent,before,'restored partial batch combines with the next frame');
  }
 }
});

test('recoveries belong to individual retained worlds and never replace Life or Orbit work',async()=>{
 const h=await setup(query.wave),wave=recoverable(h,'wave');
 click(h,'tab-orbit');click(h,'orbit-fire');const orbit=h.drawing();
 click(h,'tab-life');click(h,'life-toggle');const life=h.drawing();
 for(const mode of ['fractal','walk']){h.navigate(query[mode]);recoverable(h,mode);}
 click(h,'tab-wave');assert.equal(available(h),true);click(h,'observation-undo');assert.deepEqual(h.drawing(),wave.drawing);
 click(h,'tab-fractal');assert.equal(available(h),true);click(h,'observation-undo');assert.match(h.el('metrics').textContent,/^831 个点/);
 click(h,'tab-walk');assert.equal(available(h),true);click(h,'observation-undo');assert.match(h.el('metrics').textContent,/99/);
 click(h,'tab-orbit');assert.equal(available(h),false);assert.deepEqual(h.drawing(),orbit);
 click(h,'tab-life');assert.equal(available(h),false);assert.deepEqual(h.drawing(),life);
});

test('reset, real parameter changes and new starting points expire recovery',async()=>{
 for(const mode of Object.keys(query))for(const action of ['reset','parameter','preset','guide-start','mission-start']){
  const h=await setup(query[mode]);recoverable(h,mode);
  if(action==='parameter')input(h,mode==='wave'?'wavelength':mode==='fractal'?'jump':'bias',mode==='wave'?38:mode==='fractal'?66:8);
  else click(h,action);
  assert.equal(available(h),false,mode+' '+action);const before=quiet(h);click(h,'observation-undo');assert.deepEqual(quiet(h),before);
 }
});

test('unchanged or invalid parameters preserve recovery; changed history and refresh clear it',async()=>{
 for(const mode of Object.keys(query)){
  const h=await setup(query[mode]),before=recoverable(h,mode),id=mode==='wave'?'wavelength':mode==='fractal'?'jump':'bias';
  input(h,id,h.el(id).value);input(h,id,'NaN');assert.equal(available(h),true);
  h.navigate(location.search+'#field-notes');assert.equal(available(h),true);click(h,'observation-undo');assert.deepEqual(h.drawing(),before.drawing);
  recoverable(h,mode);const next=new URL(query[mode],location.href);next.searchParams.set(mode==='wave'?'at':'seed',mode==='wave'?'v1,0,0,2':'44');h.navigate(next.href);
  assert.equal(available(h),false);
  const fresh=await setup(query[mode]);assert.equal(available(fresh),false);
 }
});

test('a successful new share expires recovery without altering the restored checkpoint',async()=>{
 for(const mode of Object.keys(query)){
  const h=await setup(query[mode]);recoverable(h,mode);await click(h,'share');assert.equal(available(h),false);
  assert.equal(h.el('saved-observation').hidden,false);const before=quiet(h);click(h,'observation-undo');assert.deepEqual(quiet(h),before);
 }
});

test('Wave recovers valid in-page progress beyond URL coordinate and time bounds, including its fitted view',async()=>{
 const h=await setup('?experiment=wave&at=v1,10000,-10000,1000000000');click(h,'wave-right');click(h,'step');
 const before=h.drawing(),readings=reading(h),address=saved(h);click(h,'observation-return');
 assert.equal(available(h),true);click(h,'wave-right');await click(h,'share');
 assert.match(h.el('share-status').textContent,/超出链接可保存/);assert.equal(available(h),true,'refused sharing preserves the recovery');
 click(h,'observation-undo');assert.deepEqual(h.drawing(),before);assert.deepEqual(reading(h),readings);assert.deepEqual(saved(h),address);
});

test('Wave can undo a view-only return even when its probe and time already match the checkpoint',async()=>{
 const h=await setup('?experiment=wave&at=v1,10000,0,2');click(h,'wave-right');h.resize(600,414);click(h,'wave-left');
 const before=JSON.stringify(h.drawing());click(h,'observation-return');assert.notEqual(JSON.stringify(h.drawing()),before);assert.equal(available(h),true);
 const status=h.el('observation-undo-status').textContent;click(h,'observation-return');assert.equal(h.el('observation-undo-status').textContent,status);
 click(h,'observation-undo');assert.equal(JSON.stringify(h.drawing()),before);
});

test('Wave preserves an intentionally edge-positioned probe without refitting an unchanged viewport',async()=>{
 const h=await setup('?experiment=wave&at=v1,10000,0,2');click(h,'wave-right');const before=h.drawing();
 click(h,'observation-return');click(h,'observation-undo');assert.equal(JSON.stringify(h.drawing()),JSON.stringify(before));
});

test('Wave recovers its prior wide view after Home rather than merely fitting the recovered probe',async()=>{
 const h=await setup('?experiment=wave&at=v1,8000,-5000,2');click(h,'wave-home');click(h,'step');
 const before=h.drawing();click(h,'observation-return');click(h,'observation-undo');assert.deepEqual(h.drawing(),before);
});

test('resizing, density, visibility and bitmap recovery retain the same recoverable model',async()=>{
 for(const mode of Object.keys(query)){
  const h=await setup(query[mode]);progress(h,mode);h.resize(259,240);const expected=h.drawing();
  click(h,'observation-return');h.resize(455.5,281.75);h.setDpr(2);h.setVisible(false);h.setHidden(true);
  assert.equal(h.loseContext(),false);h.restoreContext();h.setHidden(false);h.setVisible(true);h.resize(259,240);
  assert.equal(available(h),true);click(h,'observation-undo');assert.deepEqual(h.drawing(),expected);assert.equal(h.frames.size,0);
 }
});

test('Wave fits a recovered extreme probe when Undo itself occurs at different dimensions',async()=>{
 for(const [x,y,move] of [[10000,0,'wave-right'],[-10000,0,'wave-left'],[0,10000,'wave-down'],[0,-10000,'wave-up']]){
  const address=`?experiment=wave&at=v1,${x},${y},2`;
  const reference=await setup(address);click(reference,move);reference.resize(259,240);const expected=JSON.stringify(reference.drawing());
  const h=await setup(address);click(h,move);click(h,'observation-return');h.resize(259,240);click(h,'observation-undo');
  assert.equal(JSON.stringify(h.drawing()),expected);assert.equal(available(h),false);assert.equal(h.frames.size,0);
  const probe=h.probe();assert.ok(probe.x>=0&&probe.x<=259&&probe.y>=0&&probe.y<=240);
 }
});

test('upper and lower checkpoints remain reversible and restore capped control availability',async()=>{
 for(const [mode,min,max,back] of [['fractal',300,12000,'fractal-back'],['walk',16,512,'walk-back']]){
  const h=await setup(`?experiment=${mode}&at=v1,${max}`);click(h,back);const before=h.drawing();click(h,'observation-return');
  assert.equal(h.el('pause').getAttribute('aria-disabled'),'true');click(h,'observation-undo');assert.deepEqual(h.drawing(),before);
  assert.equal(h.el('pause').getAttribute('aria-disabled'),'false');
  h.navigate(`?experiment=${mode}&at=v1,${min}`);progress(h,mode);const after=h.drawing();click(h,'observation-return');click(h,'observation-undo');assert.deepEqual(h.drawing(),after);
 }
});

test('mission baseline, recorded notes and notebook focus do not change on return recovery',async()=>{
 const h=await setup('?experiment=walk');click(h,'mission-start');click(h,'mission-check');await click(h,'share');click(h,'walk-64');click(h,'mission-check');
 const notes=h.el('notes-text').value,result=h.el('mission-result').textContent,count=h.el('notes-count').textContent;
 click(h,'observation-return');click(h,'observation-undo');assert.equal(h.el('notes-text').value,notes);assert.equal(h.el('mission-result').textContent,result);assert.equal(h.el('notes-count').textContent,count);
 assert.match(h.el('metrics').textContent,/64/);
});

test('undo invalidates old pending copy feedback without copying, navigation or another live region',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 try{
  for(const success of [true,false]){
   let finish,copies=0;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>{copies++;return new Promise((resolve,reject)=>{finish=()=>success?resolve():reject(Error('late'));});}}}});
   const h=await setup(query.fractal);const pending=click(h,'share');recoverable(h,'fractal');click(h,'observation-undo');
   const announcement=h.el('announcement').textContent;finish();await pending;
   assert.equal(copies,1);assert.equal(h.el('announcement').textContent,announcement);assert.equal(h.el('share-status').hidden,true);
  }
 }finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});

test('recovery feedback remains quiet and unchanged through redraws, and unavailable activations never pause',async()=>{
 const h=await setup(query.wave);recoverable(h,'wave');const status=h.el('observation-undo-status');let text=status.textContent,writes=0;
 Object.defineProperty(status,'textContent',{get:()=>text,set:value=>{text=value;writes++;}});
 h.resize(600,414);click(h,'pause');const announcement=h.el('announcement').textContent;h.tick(0);h.tick(50);h.tick(100);
 assert.equal(writes,0);assert.equal(h.el('announcement').textContent,announcement);click(h,'observation-undo');
 click(h,'pause');const before=quiet(h);click(h,'observation-undo');assert.deepEqual(quiet(h),before);
});

test('new recovery control keeps native input, held-Enter protection, descriptive status and narrow wrapping',async()=>{
 const h=await setup(query.fractal),handler=h.el('observation-undo').handlers.keydown;assert.equal(typeof handler,'function');
 for(const [key,repeat,expected] of [['Enter',true,true],['Enter',false,false],[' ',true,false],['Tab',false,false]]){
  let prevented=false;handler({key,repeat,preventDefault(){prevented=true;}});assert.equal(prevented,expected);
 }
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<button id="observation-undo"[^>]*aria-disabled="true"[^>]*aria-describedby="observation-undo-status observation-undo-help"/);
 assert.match(html,/<p id="observation-undo-status" aria-live="off">/);assert.match(html,/改参数、重置、载入新起点或再次分享后失效/);
 assert.match(css,/#observation-undo\{[^}]*white-space:normal;overflow-wrap:anywhere/);
});
