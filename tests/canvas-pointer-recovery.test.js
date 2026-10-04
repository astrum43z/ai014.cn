import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const worlds=['orbit','life','wave'];
const textIds=['metrics','pause','status','hint','announcement','orbit-position','orbit-recall-status','life-selection','life-test-result','history-caption','life-clear-status','wave-probe-reading','wave-seek-current','saved-observation-reading','observation-undo-reading','mission-state','mission-result','notes-count'];
const picture=h=>createHash('sha256').update(JSON.stringify(h.drawing())).digest('hex');
const state=h=>({text:textIds.map(id=>h.el(id).textContent),drawing:picture(h),draws:h.drawCount(),url:location.href,writes:h.writes(),link:h.el('share-link').value,notes:h.el('field-notes-list').innerHTML,frames:[...h.frames.keys()],undo:h.el('life-undo-edit').getAttribute('aria-disabled'),clear:h.el('life-undo-clear').getAttribute('aria-disabled'),focus:document.activeElement?.id});
function pointer(h,type,id=7,extra={}){
 h.el('canvas').handlers[type]({type,pointerId:id,pointerType:'mouse',isPrimary:true,button:0,buttons:type==='pointerdown'||type==='pointermove'?1:0,clientX:420,clientY:220,detail:type==='click'?1:0,...extra});
}
const tap=(h,id=7)=>{for(const type of ['pointerdown','pointerup','click'])pointer(h,type,id);};
const recover=h=>{h.setContextReady(true);h.restoreContext();};

for(const world of worlds)for(const running of [false,true])test(`${world}: blank-canvas taps, drags and standalone clicks leave ${running?'running intent':'paused work'} unchanged`,async()=>{
 const h=await setup('?experiment='+world,'#canvas',!running);h.el('canvas').focus();
 click(h,'step');if(running)click(h,'pause');h.loseContext();const before=state(h);
 let captures=0;h.el('canvas').setPointerCapture=()=>captures++;
 tap(h);pointer(h,'pointerdown',8);pointer(h,'pointermove',8,{clientX:460});pointer(h,'pointerup',8,{clientX:460});pointer(h,'click',8,{clientX:460});
 pointer(h,'click',9);pointer(h,'click',undefined,{pointerId:undefined,detail:0});
 assert.deepEqual(state(h),before);assert.equal(captures,0);assert.equal(h.frames.size,0);
 recover(h);const previousPicture=picture(h),metrics=h.el('metrics').textContent;
 tap(h);assert.notEqual(picture(h),previousPicture,'a fresh visible-canvas gesture remains usable');
 if(world!=='wave')assert.notEqual(h.el('metrics').textContent,metrics);
});

for(const world of worlds)for(const initial of [false,true])test(`${world}: a press on ${initial?'initially unavailable':'later lost'} canvas cannot click through after recovery`,async()=>{
 const h=await setup('?experiment='+world,'',true,1,!initial);if(!initial)h.loseContext();
 pointer(h,'pointerdown',17);recover(h);const before=state(h);
 for(const type of ['pointermove','pointerup','lostpointercapture','click'])pointer(h,type,17,{clientX:450});
 assert.deepEqual(state(h),before);tap(h,17);assert.notEqual(picture(h),before.drawing,'a new press may reuse the pointer ID');
});

for(const world of worlds)test(`${world}: loss interrupts an already pressed gesture even when its release arrives after restoration`,async()=>{
 const h=await setup('?experiment='+world),canvas=h.el('canvas');
 pointer(h,'pointerdown',12);h.loseContext();recover(h);const before=state(h);
 for(const type of ['pointermove','pointerup','click'])pointer(h,type,12,{clientX:455});assert.deepEqual(state(h),before);
 tap(h,12);assert.notEqual(picture(h),before.drawing);assert.equal(canvas,h.el('canvas'));
});

for(const world of ['orbit','wave'])for(const order of [[11,12],[12,11]])test(`${world}: concurrent primary devices both lose their pending taps (${order.join(',')})`,async()=>{
 const h=await setup('?experiment='+world);pointer(h,'pointerdown',11,{pointerType:'touch'});pointer(h,'pointerdown',12,{pointerType:'mouse'});
 h.loseContext();recover(h);const before=state(h);
 for(const id of order){pointer(h,'pointerup',id);pointer(h,'click',id);assert.deepEqual(state(h),before);}
 tap(h,11);assert.notEqual(picture(h),before.drawing);const first=picture(h);tap(h,12);if(world==='orbit')assert.notEqual(picture(h),first);
});

test('rejected identities remain independent across recovery, tab changes and legacy clicks',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');h.loseContext();
 pointer(h,'pointerdown',21);pointer(h,'pointerdown',22,{isPrimary:false});recover(h);h.tabs[0].handlers.click();
 tap(h,23);const before=state(h);pointer(h,'click',21);pointer(h,'click',22);assert.deepEqual(state(h),before);
 h.loseContext();pointer(h,'pointerdown',24);recover(h);const restored=state(h);
 pointer(h,'click',undefined,{pointerId:undefined});assert.deepEqual(state(h),restored,'legacy click uses the most recent canvas pointer');
 tap(h,24);assert.match(h.el('metrics').textContent,/5 颗行星/);
});

for(const cancel of [false,true])test(`older ${cancel?'cancelled':'pending'} presses cannot evict a newer rejected device during loss`,async()=>{
 const h=await setup('?experiment=orbit');
 for(let id=1;id<=16;id++){pointer(h,'pointerdown',id,{pointerType:'touch'});if(cancel)pointer(h,'pointercancel',id);}
 h.tabs[1].handlers.click();click(h,'clear');pointer(h,'pointerdown',17,{pointerType:'touch'});pointer(h,'pointerdown',18,{pointerType:'mouse'});
 h.loseContext();recover(h);const before=state(h);pointer(h,'pointerup',18);pointer(h,'click',18);assert.deepEqual(state(h),before);
 pointer(h,'pointerup',17);pointer(h,'click',17);assert.deepEqual(state(h),before);tap(h,18);assert.match(h.el('metrics').textContent,/1 个活格子/);
});

test('bounded pointer history keeps newer pending taps ahead of older rejected sequences',async()=>{
 const h=await setup('?experiment=orbit');
 for(let id=1;id<=16;id++)pointer(h,'pointerdown',id,{isPrimary:false});
 for(let id=17;id<=32;id++)pointer(h,'pointerdown',id);
 h.loseContext();recover(h);const before=state(h);
 for(let id=17;id<=32;id++){pointer(h,'pointerup',id);pointer(h,'click',id);assert.deepEqual(state(h),before);}
 tap(h,32);assert.match(h.el('metrics').textContent,/4 颗行星/);
});

test('Life retains partial-stroke undo, clear recovery, comparison and discovery evidence',async()=>{
 for(const variant of ['stroke','clear','comparison','discovery']){
  const h=await setup('?experiment=life');click(h,'clear');
  if(variant==='stroke'){pointer(h,'pointerdown',1,{clientX:20,clientY:20});pointer(h,'pointermove',1,{clientX:80,clientY:20});}
  if(variant==='clear'){tap(h);click(h,'clear');}
  if(variant==='comparison'){tap(h);click(h,'life-test');}
  if(variant==='discovery'){click(h,'mission-start');for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');}
  h.loseContext();const before=state(h);tap(h,31);assert.deepEqual(state(h),before,variant);recover(h);
  if(variant==='stroke'){click(h,'life-undo-edit');assert.match(h.el('metrics').textContent,/0 个活格子/);}
  if(variant==='clear'){click(h,'life-undo-clear');assert.match(h.el('metrics').textContent,/1 个活格子/);}
  if(variant==='comparison'){click(h,'life-return');assert.match(h.el('metrics').textContent,/1 个活格子/);}
  if(variant==='discovery')assert.equal(h.el('field-notes-list').innerHTML,before.notes);
 }
});

test('explicit controls, keyboard, targets and saved return undo stay useful while the bitmap is absent',async()=>{
 const h=await setup('?experiment=wave&at=v1,13.75,-7.125,0.125');h.loseContext();h.key('ArrowRight');
 const moved=h.el('wave-probe-reading').textContent;click(h,'observation-return');assert.notEqual(h.el('wave-probe-reading').textContent,moved);
 click(h,'observation-undo');assert.equal(h.el('wave-probe-reading').textContent,moved);
 h.el('wave-target-x').value='8';h.el('wave-target-y').value='0';click(h,'wave-position');assert.match(h.el('wave-probe-reading').textContent,/x 8\.0，y 0\.0/);
 const url=location.href;tap(h);assert.equal(location.href,url);recover(h);assert.match(h.el('wave-probe-reading').textContent,/x 8\.0，y 0\.0/);
 for(const [world,control] of [['orbit','orbit-fire'],['life','life-toggle']]){h.tabs[worlds.indexOf(world)].handlers.click();h.loseContext();const before=h.el('metrics').textContent;click(h,control);assert.notEqual(h.el('metrics').textContent,before);recover(h);}
});

test('Fractal and Walk intentional held batch stepping remains unchanged during loss',async()=>{
 for(const [world,start,end] of [['fractal',300,500],['walk',16,48]]){
  const h=await setup('?experiment='+world);h.loseContext();assert.match(h.el('metrics').textContent,new RegExp(start));
  for(const repeat of [false,true]){let prevented=false;h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){prevented=true;}});assert.equal(prevented,false);if(!prevented)click(h,'step');}assert.match(h.el('metrics').textContent,new RegExp(end));
  const before=state(h);tap(h);assert.deepEqual(state(h),before);recover(h);assert.match(h.el('metrics').textContent,new RegExp(end));
 }
});

test('published module URL invalidates the changed interaction code',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');const src=html.match(/<script type="module" src="(app\.js\?[^"]+)"/)?.[1];assert.ok(src);assert.match(src,/&amp;canvas-pointer=loss-safe-1(?:&amp;|$)/);
});
