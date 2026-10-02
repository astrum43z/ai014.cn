import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const cases=[{mode:'fractal',limit:12000,before:11999,back:'fractal-back',one:'fractal-forward',reading:'fractal-touch-reading'},
 {mode:'walk',limit:512,before:511,back:'walk-back',one:'walk-step-one',reading:'walk-step-reading'}];
const click=(h,id)=>h.el(id).handlers.click();
function availability(h,disabled,description=''){
 for(const id of ['pause','step']){
  assert.equal(h.el(id).getAttribute('aria-disabled'),String(disabled),id);
  assert.notEqual(h.el(id).disabled,true,'availability must preserve native focus');
  assert.equal(h.el(id).getAttribute('aria-describedby'),description,id+' description');
 }
}
const snapshot=h=>({draws:h.drawCount(),drawing:h.drawing(),metrics:h.el('metrics').textContent,frames:[...h.frames.keys()],href:location.href,writes:h.writes(),notes:h.el('notes-text').value});
for(const c of cases){
 test(`${c.mode}: restored upper limit exposes the primary controls as unavailable with the current explanation`,async()=>{
  const h=await setup(`?experiment=${c.mode}&at=v1,${c.limit}`);
  availability(h,true,c.reading);assert.equal(h.frames.size,0);
  const before=snapshot(h);
  for(const id of ['pause','step']){
   h.el(id).focus();for(let i=0;i<5;i++)click(h,id);
   assert.equal(document.activeElement,h.el(id));assert.deepEqual(snapshot(h),before);
  }
 });
 for(const action of ['step',c.one])test(`${c.mode}: reaching the cap with ${action} keeps focus, and rewind restores both primary controls`,async()=>{
  const h=await setup(`?experiment=${c.mode}&at=v1,${c.before}`);
  availability(h,false);
  for(const id of ['pause','step']){
   Object.defineProperty(h.el(id),'disabled',{set(){assert.fail('do not natively disable a focused button');},get:()=>false});
   Object.defineProperty(h.el(id),'tabIndex',{set(){assert.fail('keep native focusability');}});
  }
  h.el(action).focus();click(h,action);availability(h,true,c.reading);
  assert.equal(document.activeElement,h.el(action));assert.equal(h.frames.size,0);
  const saved=location.href;click(h,c.back);availability(h,false);
  assert.equal(location.href,saved,'rewinding keeps the saved observation fixed');
  click(h,'pause');assert.equal(h.frames.size,1);click(h,'pause');assert.equal(h.frames.size,0);
  click(h,'step');availability(h,true,c.reading);
 });
 test(`${c.mode}: automatic completion and tab return synchronize the primary controls`,async()=>{
  const h=await setup(`?experiment=${c.mode}&at=v1,${c.before}`);
  h.el('pause').focus();click(h,'pause');h.tick(0);h.tick(50);h.tick(100);
  availability(h,true,c.reading);assert.equal(h.frames.size,0);assert.equal(document.activeElement,h.el('pause'));
  click(h,'tab-life');availability(h,false);click(h,'tab-'+c.mode);availability(h,true,c.reading);
  h.resize(320,360);availability(h,true,c.reading);
  const saved=location.href;h.navigate(saved.replace(/#.*/, '')+'#observation-title');availability(h,true,c.reading);
 });
 test(`${c.mode}: resets, parameters, presets, comparisons and history remove stale unavailable state`,async()=>{
  const h=await setup(`?experiment=${c.mode}&at=v1,${c.limit}`);
  const restore=()=>{h.navigate(`?experiment=${c.mode}&at=v1,${c.before}`);h.navigate(`?experiment=${c.mode}&at=v1,${c.limit}`);};
  for(const reset of [()=>click(h,'reset'),()=>h.el('seed').handlers.input({target:{value:'15'}}),()=>click(h,'preset'),()=>click(h,'guide-start'),()=>click(h,'mission-start'),()=>click(h,c.mode==='fractal'?'fractal-1000':'walk-64')]){
   availability(h,true,c.reading);reset();availability(h,false);restore();
  }
  h.navigate(`?experiment=${c.mode}&at=v1,${c.before}`);availability(h,false);
 });
}

test('other worlds remain usable and wave step retains its quarter-cycle description after leaving a cap',async()=>{
 const h=await setup('?experiment=walk&at=v1,512');
 for(const mode of ['orbit','life','wave']){
  click(h,'tab-'+mode);
  for(const id of ['pause','step'])assert.equal(h.el(id).getAttribute('aria-disabled'),'false');
  assert.equal(h.el('pause').getAttribute('aria-describedby'),'');
  assert.equal(h.el('step').getAttribute('aria-describedby'),mode==='wave'?'wave-step-help':'');
  const before=h.el('metrics').textContent;click(h,'step');assert.notEqual(h.el('metrics').textContent,before);
  click(h,'pause');assert.equal(h.frames.size,1);click(h,'pause');assert.equal(h.frames.size,0);
 }
});

test('primary unavailable styling preserves legibility, focus and pointer-event delivery',()=>{
 const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const style=css.match(/\.stage-controls button\[aria-disabled="true"\]\{([^}]+)\}/)?.[1];
 assert.ok(style);assert.match(style,/background:#8b9d85;color:#213b36;cursor:not-allowed/);
 assert.doesNotMatch(style,/opacity|outline|filter|pointer-events/);
 assert.match(css,/button:focus-visible[^}]*outline:3px solid/);
});
