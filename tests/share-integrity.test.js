import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';
import {readObservation} from '../observation.js';

const click=(h,id)=>h.el(id).handlers.click();
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const error=/当前观测超出链接可保存的范围，未生成或复制新链接/;
async function clipboard(run,write=async()=>{}){
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),copies=[];
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:url=>{copies.push(url);return write(url);}}}});
 try{await run(copies);}finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
}
function state(h){return {
 drawing:h.drawing(),draws:h.drawCount(),frames:[...h.frames.keys()],focus:document.activeElement,
 url:location.href,writes:h.writes(),link:h.el('share-link').value,linkHidden:h.el('share-link').hidden,
 saved:h.el('saved-observation-reading').textContent,savedHidden:h.el('saved-observation').hidden,
 readings:['metrics','status','wave-probe-reading','wave-value-left','wave-value-right','wave-value-combined','mission-state','mission-result','notes-count'].map(id=>h.el(id).textContent),
 notes:h.el('notes-text').value,notebook:h.el('field-notes-list').innerHTML
};}
async function refused(h,copies){
 h.el('share').focus();const before=state(h),count=copies.length;
 await click(h,'share');
 assert.equal(copies.length,count,'a failed observation must never reach the clipboard');
 assert.deepEqual(state(h),before,'refusal leaves model, prior link, checkpoint, focus and discoveries intact');
 assert.equal(h.el('share-status').hidden,false);assert.match(h.el('share-status').textContent,error);
 assert.match(h.el('share-status').textContent,/保存图片.*重置后再分享/);
 assert.equal(h.el('announcement').textContent,h.el('share-status').textContent);
 return h.el('share-status').textContent;
}

for(const [x,y,key,button] of [[10000,0,'ArrowRight','wave-right'],[-10000,0,'ArrowLeft','wave-left'],[0,10000,'ArrowDown','wave-down'],[0,-10000,'ArrowUp','wave-up']]){
 test(`Wave ${x},${y}: keyboard and precision movement cannot silently remove the checkpoint from a share`,async()=>{
  for(const useButton of [false,true])await clipboard(async copies=>{
   const h=await setup(`?experiment=wave&at=v1,${x},${y},2.5`,'#canvas');
   if(useButton)click(h,button);else h.key(key);
   await refused(h,copies);await refused(h,copies);
   click(h,'wave-home');await click(h,'share');
   assert.deepEqual(readObservation(new URL(copies.at(-1)).search,'wave'),{x:0,y:0,time:2.5});
   assert.match(h.el('share-status').textContent,/已复制观测链接/);
  });
 });
}

test('far-edge pointer measurements in a fitted view fail safely, including narrow and fractional layouts',async()=>{
 for(const [width,height] of [[600,414],[259,240],[455.5,281.75]])await clipboard(async copies=>{
  const h=await setup('?experiment=wave&at=v1,10000,-10000,2.5');h.resize(width,height);
  h.el('canvas').handlers.click({clientX:width-1,clientY:1,detail:1,pointerId:1});
  assert.match(h.el('wave-probe-reading').textContent,/探针 x /);
  await refused(h,copies);
 });
});

test('a quarter-cycle beyond the supported time retains its current phase and original checkpoint',async()=>{
 await clipboard(async copies=>{
  const h=await setup('?experiment=wave&at=v1,8,0,1000000000');
  click(h,'step');await refused(h,copies);
  assert.equal(new URL(location.href).searchParams.get('at'),'v1,8,0,1000000000');
  click(h,'observation-return');await click(h,'share');
  assert.deepEqual(readObservation(new URL(copies.at(-1)).search,'wave'),{x:8,y:0,time:1e9});
  click(h,'step');await refused(h,copies);click(h,'reset');await click(h,'share');
  assert.deepEqual(readObservation(new URL(copies.at(-1)).search,'wave'),{x:0,y:0,time:0});
 });
});

test('refusing a running overflow does not pause, redraw, consume time or schedule another frame',async()=>{
 await clipboard(async copies=>{
  const h=await setup('?experiment=wave&at=v1,0,0,1000000000');
  click(h,'pause');h.tick(0);h.tick(50);await refused(h,copies);
  assert.equal(h.el('status').textContent,'运行中');assert.equal(h.frames.size,1);
  h.tick(100);await refused(h,copies);
  h.motion.change({matches:true});await refused(h,copies);assert.equal(h.frames.size,0);
 });
});

test('failed new attempts retain a previous visible link, selection and saved return destination',async()=>{
 await clipboard(async copies=>{
  const h=await setup('?experiment=wave&at=v1,10000,0,2.5');await click(h,'share');
  const input=h.el('share-link'),saved=input.value;let selected=0;
  input.select=()=>selected++;input.selectionStart=4;input.selectionEnd=17;
  h.key('ArrowRight');await refused(h,copies);
  assert.equal(input.value,saved);assert.equal(selected,0);assert.equal(input.selectionStart,4);assert.equal(input.selectionEnd,17);
  click(h,'observation-return');assert.match(h.el('wave-probe-reading').textContent,/x 10000.0，y 0.0/);
  await click(h,'share');assert.equal(copies.at(-1),saved);
 });
});

test('a failed attempt invalidates older pending success or failure without moving focus',async()=>{
 for(const succeeds of [true,false]){
  const pending=deferred();let calls=0;await clipboard(async copies=>{
   const h=await setup('?experiment=wave&at=v1,10000,0,2.5');const first=click(h,'share');
   h.key('ArrowRight');const message=await refused(h,copies);h.el('wave-home').focus();
   if(succeeds)pending.resolve();else pending.reject(Error('late denial'));
   await first;assert.equal(h.el('share-status').textContent,message);assert.equal(h.el('announcement').textContent,message);
   assert.equal(document.activeElement,h.el('wave-home'));assert.equal(copies.length,1);
  },()=>calls++===0?pending.promise:Promise.resolve());
 }
});

test('tab, resize, anchor, parameter and history changes cannot turn an unsupported observation into a misleading share',async()=>{
 await clipboard(async copies=>{
  const h=await setup('?experiment=wave&at=v1,10000,0,2.5','#canvas');h.key('ArrowRight');await refused(h,copies);
  h.tabs[1].handlers.click();click(h,'life-toggle');const life=h.el('metrics').textContent;
  h.resize(295,260);h.tabs[2].handlers.click();h.navigate(location.search+'#control-title');await refused(h,copies);
  h.el('wavelength').handlers.input({target:{value:'70'}});assert.equal(h.el('saved-observation').hidden,true);await refused(h,copies);
  h.tabs[1].handlers.click();assert.equal(h.el('metrics').textContent,life);h.tabs[2].handlers.click();await refused(h,copies);
  h.navigate('?experiment=wave&at=v1,-10000,0,2.5#canvas');h.key('ArrowLeft');await refused(h,copies);
  h.navigate('?experiment=wave&at=v1,8,0,2.5#canvas');await click(h,'share');
  assert.deepEqual(readObservation(new URL(copies.at(-1)).search,'wave'),{x:8,y:0,time:2.5});
 });
});

test('completed discoveries and an in-progress mission in another world survive failed sharing',async()=>{
 await clipboard(async copies=>{
  const h=await setup('?experiment=wave');click(h,'mission-start');click(h,'mission-check');click(h,'wave-home');click(h,'mission-check');
  assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;
  h.tabs[3].handlers.click();click(h,'mission-start');click(h,'fractal-1000');click(h,'mission-check');const result=h.el('mission-result').textContent;
  h.navigate('?experiment=wave&at=v1,10000,0,2.5');h.key('ArrowRight');await refused(h,copies);
  assert.equal(h.el('notes-text').value,notes);h.tabs[3].handlers.click();assert.equal(h.el('mission-result').textContent,result);
 });
});

test('inclusive Wave coordinate/time boundaries still produce complete observation links',async()=>{
 for(const x of [-10000,10000])for(const y of [-10000,10000])await clipboard(async copies=>{
  const h=await setup(`?experiment=wave&at=v1,${x},${y},1000000000`);await click(h,'share');
  assert.deepEqual(readObservation(new URL(copies[0]).search,'wave'),{x,y,time:1e9});
  assert.match(h.el('share-status').textContent,/已复制观测链接/);
 });
});

test('all five ordinary worlds keep their existing sharing and pause behavior',async()=>{
 for(const mode of ['orbit','life','wave','fractal','walk'])await clipboard(async copies=>{
  const h=await setup('?experiment='+mode,'',false);await click(h,'share');
  const observation=['wave','fractal','walk'].includes(mode);
  assert.equal(new URL(copies[0]).searchParams.has('at'),observation);
  assert.equal(h.frames.size,observation?0:1);
  assert.match(h.el('share-status').textContent,observation?/已复制观测链接/:/已复制参数链接/);
  assert.equal(document.activeElement,h.el('share-link'));
 });
});
