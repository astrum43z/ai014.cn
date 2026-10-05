import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const primary=[['pause','aria-disabled'],['step','aria-disabled'],['pause','aria-describedby'],['step','aria-describedby']];
const worldControls={orbit:['orbit-fire','orbit-recall'],life:['life-previous-live','life-next-live','life-back','life-undo-edit','life-undo-clear'],wave:[],fractal:['fractal-back','fractal-forward','fractal-step'],walk:['walk-back','walk-step-one']};
const fields=mode=>[...primary,...worldControls[mode].map(id=>[id,'aria-disabled'])];
const state=(h,mode)=>fields(mode).map(([id,name])=>[id,name,h.el(id).getAttribute(name)]);
function track(h,mode){
 const events=[];
 for(const id of new Set(fields(mode).map(([id])=>id))){
  const element=h.el(id),original=element.setAttribute;
  element.setAttribute=function(name,value){
   if(fields(mode).some(([target,attribute])=>target===id&&attribute===name))events.push({id,name,before:this.getAttribute(name),after:String(value)});
   return original.call(this,name,value);
  };
 }
 return {events,reset:()=>{events.length=0;}};
}
function available(h,id,value){assert.equal(h.el(id).getAttribute('aria-disabled'),String(!value),id);assert.notEqual(h.el(id).disabled,true);}

for(const mode of Object.keys(worldControls)){
 test(`${mode}: 120 animation frames only write changed availability attributes`,async()=>{
  const h=await setup('?experiment='+mode,'',false),counter=track(h,mode),initial=h.el('metrics').textContent,announcement=h.el('announcement').textContent;
  h.tick(0);for(let i=1;i<=120;i++)h.tick(i*1000/60);
  assert.notEqual(h.el('metrics').textContent,initial,'simulation must advance normally');
  assert.equal(counter.events.filter(e=>e.before===e.after).length,0,'unchanged ARIA values must not be rewritten');
  assert.equal(counter.events.length,['life','fractal','walk'].includes(mode)?1:0,'only leaving the initial rewind boundary changes availability');
  assert.equal(h.el('announcement').textContent,announcement,'animation stays quiet');assert.equal(h.frames.size,1);
  click(h,'pause');assert.equal(h.frames.size,0);
  counter.reset();h.resize(259,240);h.resize(600,414);assert.equal(counter.events.length,0);
 });
 test(`${mode}: unchanged redraws keep availability intact and stale DOM attributes repair once`,async()=>{
  const h=await setup('?experiment='+mode),counter=track(h,mode),expected=state(h,mode),drawing=h.drawing(),url=location.href,writes=h.writes(),announcement=h.el('announcement').textContent;
  h.el('step').focus();
  for(const [w,z] of [[259,240],[600,414]])h.resize(w,z);
  h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();
  assert.equal(counter.events.length,0);
  for(const [id,name] of fields(mode))h.el(id).setAttribute(name,'stale');
  counter.reset();h.resize(600,414);
  assert.deepEqual(state(h,mode),expected);assert.equal(counter.events.length,fields(mode).length,'read the actual DOM, without a shadow state cache');
  counter.reset();h.resize(600,414);assert.equal(counter.events.length,0);
  assert.deepEqual(h.drawing(),drawing);assert.equal(location.href,url);assert.equal(h.writes(),writes);assert.equal(h.el('announcement').textContent,announcement);assert.equal(document.activeElement,h.el('step'));assert.equal(h.frames.size,0);
 });
}

for(const c of [{mode:'fractal',limit:12000,back:'fractal-back',one:'fractal-forward',reading:'fractal-touch-reading'}, {mode:'walk',limit:512,back:'walk-back',one:'walk-step-one',reading:'walk-step-reading'}]){
 test(`${c.mode}: cap, rewind, checkpoint return and undo change availability without losing focus or the saved link`,async()=>{
  const h=await setup(`?experiment=${c.mode}&at=v1,${c.limit}`,'#canvas'),counter=track(h,c.mode),saved=location.href;
  for(const id of ['pause','step',c.one])available(h,id,false);
  h.el(c.back).focus();click(h,c.back);assert.equal(document.activeElement,h.el(c.back));
  for(const id of ['pause','step',c.one])available(h,id,true);
  assert.equal(h.el('pause').getAttribute('aria-describedby'),'');assert.equal(location.href,saved);
  click(h,'observation-return');for(const id of ['pause','step',c.one])available(h,id,false);
  assert.equal(h.el('pause').getAttribute('aria-describedby'),c.reading);
  click(h,'observation-undo');for(const id of ['pause','step',c.one])available(h,id,true);
  click(h,c.one);for(const id of ['pause','step',c.one])available(h,id,false);
  assert.equal(counter.events.filter(e=>e.before===e.after).length,0);assert.equal(location.href,saved);assert.equal(h.frames.size,0);
  const before=h.drawing();h.el('pause').focus();click(h,'pause');assert.deepEqual(h.drawing(),before);assert.equal(document.activeElement,h.el('pause'));
  click(h,'tab-wave');available(h,'pause',true);available(h,'step',true);assert.equal(h.el('step').getAttribute('aria-describedby'),'wave-step-help');
  click(h,'tab-'+c.mode);for(const id of ['pause','step',c.one])available(h,id,false);
  click(h,'reset');for(const id of ['pause','step',c.one])available(h,id,true);available(h,c.back,false);
 });
}

test('Orbit fire and recall follow invalid center, launch, cap, recall and reset',async()=>{
 const h=await setup('?experiment=orbit'),counter=track(h,'orbit');
 available(h,'orbit-fire',true);available(h,'orbit-recall',false);
 for(let i=0;i<28;i++)click(h,'orbit-left');available(h,'orbit-fire',false);
 click(h,'orbit-home');available(h,'orbit-fire',true);
 for(let i=0;i<21;i++)click(h,'orbit-fire');available(h,'orbit-fire',false);available(h,'orbit-recall',true);
 h.el('orbit-recall').focus();click(h,'orbit-recall');available(h,'orbit-fire',true);available(h,'orbit-recall',false);assert.equal(document.activeElement,h.el('orbit-recall'));
 click(h,'orbit-fire');available(h,'orbit-fire',false);available(h,'orbit-recall',true);
 click(h,'reset');available(h,'orbit-fire',true);available(h,'orbit-recall',false);
 assert.equal(counter.events.filter(e=>e.before===e.after).length,0);
});

test('Life live-cell navigation, edit undo, generation rewind and clear undo follow their current models',async()=>{
 const h=await setup('?experiment=life'),counter=track(h,'life');
 available(h,'life-back',false);available(h,'life-undo-edit',false);available(h,'life-undo-clear',false);
 for(const id of ['life-previous-live','life-next-live'])available(h,id,true);
 click(h,'life-toggle');available(h,'life-undo-edit',true);click(h,'life-undo-edit');available(h,'life-undo-edit',false);
 click(h,'step');available(h,'life-back',true);click(h,'life-back');available(h,'life-back',false);
 click(h,'clear');for(const id of ['life-previous-live','life-next-live'])available(h,id,false);available(h,'life-undo-clear',true);
 h.el('life-undo-clear').focus();click(h,'life-undo-clear');for(const id of ['life-previous-live','life-next-live'])available(h,id,true);available(h,'life-undo-clear',false);assert.equal(document.activeElement,h.el('life-undo-clear'));
 assert.equal(counter.events.filter(e=>e.before===e.after).length,0);
});

test('visibility, reduced motion and simulated context loss preserve quiet availability',async()=>{
 const h=await setup('?experiment=orbit','',false),counter=track(h,'orbit'),initial=state(h,'orbit');
 h.tick(0);h.tick(50);h.setVisible(false);assert.equal(h.frames.size,0);h.setVisible(true);assert.equal(h.frames.size,1);
 h.setHidden(true);assert.equal(h.frames.size,0);h.setHidden(false);assert.equal(h.frames.size,1);
 h.loseContext();assert.equal(h.frames.size,0);h.restoreContext();assert.equal(h.frames.size,1);
 h.motion.change({matches:true});assert.equal(h.frames.size,0);assert.deepEqual(state(h,'orbit'),initial);assert.equal(counter.events.length,0);
});

test('fresh public app URL invalidates the old entry without changing dependencies',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/app\.js\?[^"\n]+&amp;availability=quiet-1&amp;walk=read-once-1&amp;life=record-once-1&amp;history=read-once-1&amp;colors=wave-once-1&amp;orbit-fit=first-body-1&amp;canvas-start=retry-1&amp;sampling=wave-field-fallback-1&amp;nudge=single-enter-1&amp;walk-batch=reverse-1&amp;fractal-batch=reverse-1"/);
});
