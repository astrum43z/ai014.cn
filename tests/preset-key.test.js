import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const modes=['orbit','life','wave','fractal','walk'];
const click=(h,id)=>h.el(id).handlers.click();
// Native buttons click on Enter keydown only when its default is not prevented.
function key(h,key='Enter',repeat=false,id='preset'){
 let prevented=false;
 h.el(id).handlers.keydown?.({key,repeat,preventDefault(){prevented=true;}});
 if(key==='Enter'&&!prevented)click(h,id);
 return prevented;
}
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),metrics:h.el('metrics').textContent,
 choice:h.el('preset-select').value,announcement:h.el('announcement').textContent,
 status:h.el('status').textContent,frames:[...h.frames.keys()],url:location.href,writes:h.writes(),
 history:h.el('history-caption').textContent,trial:h.el('life-test-result').textContent,
 recovery:h.el('life-undo-edit').getAttribute('aria-disabled'),clear:h.el('life-undo-clear').getAttribute('aria-disabled'),
 saved:h.el('saved-observation-reading').textContent,link:h.el('share-link').value,linkHidden:h.el('share-link').hidden,
 notes:h.el('notes-text').value,mission:h.el('mission-result').textContent,focus:document.activeElement});
function repeats(h){
 const before=state(h);
 for(let i=0;i<12;i++)assert.equal(key(h,'Enter',true),true);
 assert.deepEqual(state(h),before,'ignored keydowns do not replace, redraw, announce, write history or steal focus');
}

for(const [mode,first,second] of [['orbit','elliptic','escape'],['wave','wide','close'],['fractal','overlap','islands'],['walk','drift','another']])test(`${mode}: one held quick-preset Enter keeps the first chosen world`,async()=>{
 const h=await setup('?experiment='+mode);h.el('preset').focus();
 assert.equal(key(h),false);assert.equal(h.el('preset-select').value,first);repeats(h);
 assert.equal(key(h),false);assert.equal(h.el('preset-select').value,second);repeats(h);
 assert.equal(document.activeElement,h.el('preset'));assert.equal(h.frames.size,0);
 if(mode==='walk')assert.equal(h.el('seed').value,'15','a fresh second press chooses just one new group');
});

test('Life holds the first random board and consumes one sample per cell until a fresh press',async t=>{
 const h=await setup('?experiment=life&density=30');let calls=0;
 t.mock.method(Math,'random',()=>Math.floor(calls++/1536)%2?.8:.2);
 h.el('preset').focus();assert.equal(key(h),false);
 assert.equal(calls,1536);assert.equal(h.el('metrics').textContent,'第 0 代 · 1536 个活格子');repeats(h);assert.equal(calls,1536);
 assert.equal(key(h),false);assert.equal(calls,3072);assert.equal(h.el('metrics').textContent,'第 0 代 · 0 个活格子');repeats(h);assert.equal(calls,3072);
 assert.equal(h.el('preset-select').value,'random');assert.equal(document.activeElement,h.el('preset'));
});

test('first quick replacements retain each running world and repeats do not reset its new progress',async t=>{
 t.mock.method(Math,'random',()=>.2);
 for(const mode of modes){
  const h=await setup('?experiment='+mode,'',false);h.el('preset').focus();key(h);
  assert.equal(h.frames.size,1,mode);assert.equal(h.el('status').textContent,'运行中',mode);
  h.tick(0);for(let i=1;i<=4;i++)h.tick(i*50);
  repeats(h);assert.equal(h.frames.size,1,mode);
 }
});

test('a repeated-only activation leaves a Life comparison and both recovery paths usable',async()=>{
 for(const action of ['comparison','edit','clear']){
  const h=await setup('?experiment=life');
  if(action==='comparison')click(h,'life-test');
  if(action==='edit')click(h,'life-toggle');
  if(action==='clear')click(h,'clear');
  h.el('preset').focus();repeats(h);
  if(action==='comparison'){assert.equal(h.el('life-return').hidden,false);click(h,'life-return');assert.match(h.el('metrics').textContent,/第 0 代 · 10/);}
  if(action==='edit'){assert.equal(h.el('life-undo-edit').getAttribute('aria-disabled'),'false');click(h,'life-undo-edit');assert.match(h.el('metrics').textContent,/10 个活格子/);}
  if(action==='clear'){assert.equal(h.el('life-undo-clear').getAttribute('aria-disabled'),'false');click(h,'life-undo-clear');assert.match(h.el('metrics').textContent,/10 个活格子/);}
 }
});

function pointer(h,type,x,id=7){
 h.el('canvas').handlers[type]({type,pointerId:id,clientX:(x+.5)*600/48,clientY:4.5*414/32,button:0,buttons:type==='pointerdown'||type==='pointermove'?1:0,isPrimary:true,detail:1});
}
test('ignored Enter does not interrupt a stroke; a fresh replacement safely ends it and rejects delayed input',async t=>{
 const h=await setup('?experiment=life'),captures=new Set();t.mock.method(Math,'random',()=>.8);
 const canvas=h.el('canvas');canvas.setPointerCapture=id=>captures.add(id);canvas.hasPointerCapture=id=>captures.has(id);
 canvas.releasePointerCapture=id=>{captures.delete(id);pointer(h,'lostpointercapture',30,id);};
 click(h,'clear');pointer(h,'pointerdown',2);pointer(h,'pointermove',4);h.el('preset').focus();
 repeats(h);assert.equal(captures.has(7),true);pointer(h,'pointermove',6);assert.match(h.el('metrics').textContent,/5 个活格子/);
 key(h);assert.equal(captures.size,0);const after=state(h);
 pointer(h,'pointermove',20);pointer(h,'pointerup',20);pointer(h,'click',20);assert.deepEqual(state(h),after);
 assert.match(h.el('metrics').textContent,/0 个活格子/);repeats(h);
});

for(const [mode,at] of [['wave','v1,8,0,2'],['fractal','v1,12000'],['walk','v1,512']])test(`${mode}: held quick-preset input preserves a checkpoint until a fresh replacement`,async()=>{
 const h=await setup('?experiment='+mode+'&at='+at);await click(h,'share');h.el('preset').focus();
 repeats(h);assert.equal(new URL(location.href).searchParams.get('at'),at);
 key(h);assert.equal(new URL(location.href).searchParams.has('at'),false);assert.equal(h.el('saved-observation').hidden,true);
 assert.equal(h.el('share-link').hidden,true);repeats(h);
});

test('historical discoveries and the active exploration survive suppressed repeats and intentional replacements',async t=>{
 const h=await setup('?experiment=life');t.mock.method(Math,'random',()=>.8);click(h,'mission-start');
 for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 click(h,'mission-check');assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');const note=h.el('notes-text').value;
 click(h,'mission-start');click(h,'life-toggle');h.el('preset').focus();repeats(h);
 assert.equal(h.el('mission-state').textContent,'探索中');key(h);repeats(h);
 assert.equal(h.el('notes-text').value,note);assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');
 click(h,'mission-check');assert.equal(h.el('mission-state').textContent,'探索中');assert.equal(h.el('notes-text').value,note);
});

test('returning tabs, resize and history keep the guard on the current quick-action button',async()=>{
 const h=await setup('?experiment=walk');key(h);key(h);assert.equal(h.el('seed').value,'15');
 h.tabs[2].handlers.click();key(h);h.tabs[4].handlers.click();h.resize(320,240);h.el('preset').focus();repeats(h);
 assert.equal(h.el('seed').value,'15');h.navigate('?experiment=fractal&jump=65&seed=99&at=v1,1000#canvas');
 h.el('preset').focus();repeats(h);assert.match(h.el('metrics').textContent,/1000 个点/);key(h);assert.equal(h.el('preset-select').value,'overlap');
});

test('fresh Enter, native Space keyup and pointer clicks remain available; explicit Load keeps its guard',async t=>{
 const h=await setup('?experiment=life');let samples=0;t.mock.method(Math,'random',()=>{samples++;return .2;});
 for(const id of ['preset','load-preset']){
  for(const name of [' ','Tab','Escape','ArrowLeft'])for(const repeat of [false,true]){
   const before=state(h);assert.equal(key(h,name,repeat,id),false);assert.deepEqual(state(h),before);
  }
 }
 key(h);assert.equal(samples,1536);click(h,'preset');assert.equal(samples,3072,'native Space keyup still reaches the click handler');
 click(h,'preset');assert.equal(samples,4608,'pointer and assistive-style clicks remain unchanged');
 assert.equal(key(h,'Enter',true,'load-preset'),true);assert.equal(samples,4608);
 assert.equal(key(h,'Enter',false,'load-preset'),false);assert.equal(samples,6144);
});
