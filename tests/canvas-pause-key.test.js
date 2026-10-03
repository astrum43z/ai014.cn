import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
const worlds=['orbit','life','wave','fractal','walk'];
const click=(h,id)=>h.el(id).handlers.click();
function escape(h,extra={}){let prevented=false;h.key('Escape',{...extra,preventDefault(){prevented=true;}});return prevented;}
const readings=['metrics','observation-a','observation-b','observation-c','orbit-position','orbit-measured-reading','orbit-radial-reading','orbit-recall-status','life-selection','life-cell-state','history-turnover','wave-probe-reading','fractal-jump-reading','walk-step-reading','mission-state','mission-result','notes-count'];
const model=h=>({readings:readings.map(id=>h.el(id).textContent),url:location.href,writes:h.writes(),note:h.el('notes-text').value,checkpoint:h.el('saved-observation-reading').textContent});
const state=h=>({...model(h),drawing:h.drawing(),draws:h.drawCount(),frames:h.frames.size,status:h.el('status').textContent,announcement:h.el('announcement').textContent,focus:document.activeElement});
function animate(h){h.tick(0);for(let n=1;n<=7;n++)h.tick(n*40);}
function pointer(h,type,id=1,x=2,y=4){h.el('canvas').handlers[type]?.({type,pointerId:id,clientX:(x+.5)*600/48,clientY:(y+.5)*414/32,button:0,buttons:type==='pointerdown'||type==='pointermove'?1:0,isPrimary:true,detail:1});}
function trailing(h){for(const type of ['pointermove','pointerup','lostpointercapture','click'])pointer(h,type,1,30,20);}

for(const world of worlds)test(world+': focused Escape pauses exactly the current model and preserves continuation',async()=>{
 const reference=await setup('?experiment='+world,'#canvas',false);animate(reference);click(reference,'pause');const expected=model(reference),drawing=reference.drawing();click(reference,'step');const next=model(reference),nextDrawing=reference.drawing();
 const h=await setup('?experiment='+world,'#canvas',false);animate(h);h.el('canvas').focus();const before=model(h);
 assert.equal(escape(h),true);assert.equal(h.frames.size,0);assert.equal(h.el('status').textContent,'已暂停');assert.deepEqual(model(h),before);assert.deepEqual(model(h),expected);assert.deepEqual(h.drawing(),drawing);
 assert.equal(document.activeElement,h.el('canvas'));assert.match(h.el('announcement').textContent,/^已暂停；/);
 click(h,'step');assert.deepEqual(model(h),next);assert.deepEqual(h.drawing(),nextDrawing);
});

test('already-paused Escape is quiet and cannot overwrite action feedback, selection or recovery',async()=>{
 for(const world of worlds){const h=await setup('?experiment='+world);click(h,'step');h.el('canvas').focus();const before=state(h);for(let i=0;i<3;i++)assert.equal(escape(h),true);assert.deepEqual(state(h),before,world);}
});

test('held Escape is suppressed, including after explicit Continue; fresh presses still pause',async()=>{
 for(const world of worlds){const h=await setup('?experiment='+world,'',false);const running=state(h);assert.equal(escape(h,{repeat:true}),true);assert.deepEqual(state(h),running);escape(h);const paused=state(h);for(let n=0;n<5;n++)escape(h,{repeat:true});assert.deepEqual(state(h),paused);click(h,'pause');const resumed=state(h);escape(h,{repeat:true});assert.deepEqual(state(h),resumed);escape(h);assert.equal(h.frames.size,0);}
});

test('modified and composing Escape remain native in every world',async()=>{
 for(const world of worlds){const h=await setup('?experiment='+world,'',false);for(const extra of [{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true},{isComposing:true}]){const before=state(h);assert.equal(escape(h,extra),false);assert.deepEqual(state(h),before);}}
});

test('Escape ends an active Life stroke without erasing completed cells or allowing its trailing click',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');const empty=h.drawing();const captures=new Set();h.el('canvas').setPointerCapture=id=>captures.add(id);h.el('canvas').hasPointerCapture=id=>captures.has(id);h.el('canvas').releasePointerCapture=id=>{captures.delete(id);pointer(h,'lostpointercapture');};h.el('canvas').focus();pointer(h,'pointerdown');pointer(h,'pointermove',1,5,4);const before=model(h);assert.match(h.el('metrics').textContent,/4 个活格子/);assert.equal(captures.size,1);
 escape(h);assert.equal(captures.size,0);assert.deepEqual(model(h),before);assert.equal(h.el('life-undo-edit').getAttribute('aria-disabled'),'false');const after=state(h);trailing(h);assert.deepEqual(state(h),after);click(h,'life-undo-edit');assert.match(h.el('metrics').textContent,/0 个活格子/);assert.deepEqual(h.drawing(),empty);
 pointer(h,'pointerdown',1,10,10);pointer(h,'pointerup',1,10,10);pointer(h,'click',1,10,10);assert.match(h.el('metrics').textContent,/1 个活格子/);
});

test('Escape cancels a pending Life tap without committing it or discarding clear recovery',async()=>{
 const h=await setup('?experiment=life');const original=h.el('metrics').textContent;click(h,'clear');const before=model(h);pointer(h,'pointerdown');escape(h);const after=state(h);assert.deepEqual(model(h),before);trailing(h);assert.deepEqual(state(h),after);assert.equal(h.el('life-undo-clear').getAttribute('aria-disabled'),'false');click(h,'life-undo-clear');assert.equal(h.el('metrics').textContent,original);
});

test('Escape retains Orbit recall and every inactive world through tab round trips',async()=>{
 const h=await setup('?experiment=orbit');click(h,'orbit-fire');click(h,'pause');animate(h);escape(h);const orbit=h.el('metrics').textContent;assert.equal(h.el('orbit-recall').getAttribute('aria-disabled'),'false');
 for(const world of worlds.slice(1)){click(h,'tab-'+world);click(h,'step');const other=model(h);click(h,'tab-orbit');assert.equal(h.el('metrics').textContent,orbit);escape(h);click(h,'tab-'+world);assert.deepEqual(model(h),{...other,writes:h.writes()},world);}
 click(h,'tab-orbit');click(h,'orbit-recall');assert.match(h.el('metrics').textContent,/3 颗行星/);
});

test('fixed checkpoints and parameter-only links stay unchanged by Escape',async()=>{
 for(const query of ['?experiment=orbit','?experiment=life','?experiment=wave&at=v1,48,-12,1.25','?experiment=fractal&at=v1,731','?experiment=walk&at=v1,83']){const h=await setup(query);await click(h,'share');const link=h.el('share-link').value,checkpoint=h.el('saved-observation-reading').textContent,writes=h.writes();click(h,'pause');animate(h);escape(h);assert.equal(h.el('share-link').value,link);assert.equal(location.href,link);assert.equal(h.el('saved-observation-reading').textContent,checkpoint);assert.equal(h.writes(),writes);}
});

test('Escape preserves active discovery evidence and completed notebook content',async()=>{
 const h=await setup('?experiment=walk');click(h,'mission-start');click(h,'mission-check');const baseline=h.el('mission-result').textContent;click(h,'pause');escape(h);assert.equal(h.el('mission-result').textContent,baseline);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'walk-64');click(h,'mission-check');const notes=h.el('notes-text').value,result=h.el('mission-result').textContent;assert.equal(h.el('notes-count').textContent,'1 / 5');click(h,'pause');animate(h);escape(h);assert.equal(h.el('notes-text').value,notes);assert.equal(h.el('mission-result').textContent,result);
});

test('limits, context recovery, density and visibility cannot resume a canvas paused with Escape',async()=>{
 for(const world of worlds){const h=await setup('?experiment='+world,'',false);animate(h);h.setVisible(false);escape(h);assert.equal(h.el('status').textContent,'已暂停');h.setVisible(true);h.setHidden(true);h.setHidden(false);h.resize(284,240);h.setDpr(2);h.loseContext();h.restoreContext();assert.equal(h.frames.size,0);assert.equal(h.el('status').textContent,'已暂停');click(h,'pause');assert.equal(h.frames.size,1);h.loseContext();escape(h);h.restoreContext();assert.equal(h.frames.size,0);}
 for(const query of ['?experiment=walk&at=v1,512','?experiment=fractal&at=v1,12000']){const h=await setup(query);click(h,'pause');const before=state(h);escape(h);assert.deepEqual(state(h),before);}
});

test('existing continuous positioning and intentional batch-step repeats are unchanged',async()=>{
 for(const world of ['fractal','walk']){const h=await setup('?experiment='+world);escape(h);let prevented=false;h.el('step').handlers.keydown({key:'Enter',repeat:true,preventDefault(){prevented=true;}});assert.equal(prevented,false);const before=h.el('metrics').textContent;click(h,'step');assert.notEqual(h.el('metrics').textContent,before);}
 for(const world of ['orbit','life','wave']){const h=await setup('?experiment='+world);escape(h);const id=world==='orbit'?'orbit-position':world==='life'?'life-selection':'wave-probe-reading';const before=h.el(id).textContent;h.key('ArrowRight',{repeat:true});assert.notEqual(h.el(id).textContent,before);}
});

test('shortcut is scoped to the canvas and has visible wrapping help associated with it',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<canvas[^>]*aria-describedby="canvas-pause-help"[^>]*aria-keyshortcuts="Escape"/);
 assert.match(html,/<p id="canvas-pause-help" class="canvas-pause-help">聚焦画布时，Esc 暂停；不推进或重置。继续请用“继续”按钮。<\/p>/);
 assert.match(css,/\.canvas-pause-help\{[^}]*font-size:14px[^}]*overflow-wrap:anywhere/);
 const help=html.match(/<p id="canvas-pause-help"[^>]*>/)[0];assert.doesNotMatch(help,/tabindex|aria-live|role=/);
});


test('runtime canvas metadata combines shared pause help with mode-specific shortcuts after every return',async()=>{
 for(const initial of worlds){const h=await setup('?experiment='+initial);for(const world of [initial,...worlds,...[...worlds].reverse()]){if(world!==initial)click(h,'tab-'+world);else click(h,'tab-'+initial);assert.equal(h.el('canvas').getAttribute('aria-keyshortcuts'),'Escape'+(world==='life'?' Home Control+z Meta+z':world==='fractal'?' ArrowLeft ArrowRight':''));assert.equal(h.el('canvas').getAttribute('aria-describedby'),'canvas-pause-help'+(world==='life'?' life-center-help life-edit-help':world==='fractal'?' fractal-touch-help':''));}}
});

test('modified, composing and repeated Escape cannot interrupt an active Life stroke',async()=>{
 for(const extra of [{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true},{isComposing:true},{repeat:true}]){
  const h=await setup('?experiment=life');click(h,'clear');let captured=false;h.el('canvas').setPointerCapture=()=>{captured=true;};h.el('canvas').hasPointerCapture=()=>captured;h.el('canvas').releasePointerCapture=()=>{captured=false;};pointer(h,'pointerdown');pointer(h,'pointermove',1,5,4);const before=state(h);
  assert.equal(escape(h,extra),Boolean(extra.repeat));assert.deepEqual(state(h),before);assert.equal(captured,true);pointer(h,'pointermove',1,7,4);assert.match(h.el('metrics').textContent,/6 个活格子/);escape(h);assert.equal(captured,false);
 }
});
