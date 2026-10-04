import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const type=(h,id,value)=>{const input=h.el(id);input.value=String(value);input.handlers.input({target:input});};
const text=(h,id)=>h.el(id).textContent;
const seek=(h,mode,value)=>{type(h,mode+'-count',value);click(h,mode+'-seek');};
const position=(h,x,y)=>{type(h,'wave-target-x',x);type(h,'wave-target-y',y);click(h,'wave-position');};

for(const [mode,min,target,next] of [['walk',16,137,138],['fractal',300,731,732]]){
 const id=mode+'-seek-current',unit=mode==='walk'?'步':'点',expected=n=>`当前观测 · ${n} ${unit}`;
 test(`${mode}: the local current reading distinguishes a retained target from the model`,async()=>{
  const h=await setup('?experiment='+mode);assert.equal(text(h,id),expected(min));
  type(h,mode+'-count',target);assert.equal(text(h,id),expected(min));const original=h.drawing(),url=location.href;
  h.el(mode+'-seek').focus();click(h,mode+'-seek');assert.equal(text(h,id),expected(target));assert.notDeepEqual(h.drawing(),original);assert.equal(document.activeElement,h.el(mode+'-seek'));assert.equal(location.href,url);
  click(h,mode==='walk'?'walk-step-one':'fractal-forward');assert.equal(text(h,id),expected(next));assert.equal(h.el(mode+'-count').value,String(target));
  click(h,mode+'-back');assert.equal(text(h,id),expected(target));click(h,'reset');assert.equal(text(h,id),expected(min));assert.equal(h.el(mode+'-count').value,String(target));
 });
 test(`${mode}: invalid targets keep the correct reading, frame and model`,async()=>{
  const h=await setup('?experiment='+mode);seek(h,mode,target);click(h,'pause');const drawing=h.drawing(),frames=[...h.frames.keys()],announcement=text(h,'announcement');
  type(h,mode+'-count','oops');assert.equal(text(h,id),expected(target));assert.equal(text(h,'announcement'),announcement);click(h,mode+'-seek');assert.equal(text(h,id),expected(target));assert.deepEqual(h.drawing(),drawing);assert.deepEqual([...h.frames.keys()],frames);assert.equal(h.el(mode+'-seek-error').hidden,false);
 });
 test(`${mode}: animation updates the quiet reading without editing the draft or announcing it`,async()=>{
  const h=await setup('?experiment='+mode);seek(h,mode,target);click(h,'pause');const announcement=text(h,'announcement');h.tick(0);h.tick(50);h.tick(100);
  assert.equal(text(h,id),expected(target+(mode==='walk'?4:100)));assert.equal(h.el(mode+'-count').value,String(target));assert.equal(text(h,'announcement'),announcement);
 });
 test(`${mode}: checkpoints, recovery, tabs, parameters and history refresh the local current value`,async()=>{
  const h=await setup(`?experiment=${mode}&at=v1,${target}`);seek(h,mode,next);const url=location.href;click(h,'observation-return');assert.equal(text(h,id),expected(target));click(h,'observation-undo');assert.equal(text(h,id),expected(next));assert.equal(location.href,url);
  click(h,'tab-life');click(h,'tab-'+mode);assert.equal(text(h,id),expected(next));assert.equal(h.el(mode+'-count').value,String(next));
  h.el('seed').handlers.input({target:{value:'23'}});assert.equal(text(h,id),expected(min));assert.equal(h.el(mode+'-count').value,String(next));
  h.navigate(`?experiment=${mode}&seed=14&at=v1,${target}`);assert.equal(text(h,id),expected(target));
 });
 test(`${mode}: reflow and canvas recovery preserve the model and retained target`,async()=>{
  const h=await setup('?experiment='+mode);seek(h,mode,target);const drawing=h.drawing();h.resize(233,240);h.setDpr(2);h.loseContext();h.restoreContext();h.setHidden(true);h.setVisible(false);assert.equal(text(h,id),expected(target));h.setHidden(false);h.setVisible(true);h.setDpr(1);h.resize(600,414);assert.deepEqual(h.drawing(),drawing);assert.equal(h.el(mode+'-count').value,String(target));
 });
}

test('Wave shows actual unrounded coordinates beside decimal targets',async()=>{
 const h=await setup('?experiment=wave');assert.equal(text(h,'wave-position-current'),'当前探针 · x 0，y 0');
 position(h,'13.75','-7.125');assert.equal(text(h,'wave-position-current'),'当前探针 · x 13.75，y -7.125');assert.match(text(h,'wave-probe-reading'),/x 13.8，y -7.1/);
 click(h,'wave-right');assert.equal(text(h,'wave-position-current'),'当前探针 · x 15.75，y -7.125');assert.equal(h.el('wave-target-x').value,'13.75');
 click(h,'wave-home');assert.equal(text(h,'wave-position-current'),'当前探针 · x 0，y 0');assert.equal(h.el('wave-target-y').value,'-7.125');
});
test('Wave draft edits and invalid submission never masquerade as current coordinates',async()=>{
 const h=await setup('?experiment=wave');position(h,13.75,-7.125);click(h,'pause');const current=text(h,'wave-position-current'),drawing=h.drawing(),frames=[...h.frames.keys()];
 type(h,'wave-target-x','-');type(h,'wave-target-y','10001');click(h,'wave-position');assert.equal(text(h,'wave-position-current'),current);assert.deepEqual(h.drawing(),drawing);assert.deepEqual([...h.frames.keys()],frames);assert.equal(h.el('wave-position-error').hidden,false);
});
test('Wave keeps small nonzero coordinates legible without false zero or frame-by-frame writes',async()=>{
 const h=await setup('?experiment=wave');position(h,'0.00000000000000000001','-0.00000000000000000001');const element=h.el('wave-position-current');assert.equal(element.textContent,'当前探针 · x 1e-20，y -1e-20');let writes=0,value=element.textContent;
 Object.defineProperty(element,'textContent',{get:()=>value,set:next=>{writes++;value=next},configurable:true});click(h,'pause');const announcement=text(h,'announcement');h.tick(0);h.tick(50);h.tick(100);assert.equal(writes,0);assert.equal(text(h,'announcement'),announcement);assert.equal(h.el('wave-target-x').value,'0.00000000000000000001');
});
test('Wave current coordinates follow saved return, undo, tabs, resize, reset and URL restoration',async()=>{
 const h=await setup('?experiment=wave&at=v1,13.75,-7.125,0');assert.equal(text(h,'wave-position-current'),'当前探针 · x 13.75，y -7.125');position(h,21.25,-11.875);click(h,'observation-return');assert.equal(text(h,'wave-position-current'),'当前探针 · x 13.75，y -7.125');click(h,'observation-undo');assert.equal(text(h,'wave-position-current'),'当前探针 · x 21.25，y -11.875');
 click(h,'tab-fractal');click(h,'tab-wave');h.resize(233,240);h.setDpr(2);h.loseContext();h.restoreContext();assert.equal(text(h,'wave-position-current'),'当前探针 · x 21.25，y -11.875');assert.equal(h.el('wave-target-x').value,'21.25');click(h,'reset');assert.equal(text(h,'wave-position-current'),'当前探针 · x 0，y 0');assert.equal(h.el('wave-target-x').value,'21.25');
 h.navigate('?experiment=wave&at=v1,1.25,-2.5,0');assert.equal(text(h,'wave-position-current'),'当前探针 · x 1.25，y -2.5');
});
test('each field and submit button describes the quiet local readout, before help and errors',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 for(const kind of ['walk-seek','fractal-seek','wave-position']){
  assert.match(html,new RegExp(`<p id="${kind}-current" class="target-current" aria-live="off"></p><small id="${kind}-help">`));
  assert.match(html,new RegExp(`aria-describedby="${kind}-current ${kind}-help ${kind}-error"`));
  assert.match(html,new RegExp(`<button id="${kind}" type="button" aria-describedby="${kind}-current ${kind}-help"`));
 }
 assert.match(css,/(?:^|\n)\.stage \.target-current\{[^}]*overflow-wrap:anywhere/);
 assert.match(css,/\.wave-touch>\.wave-position\{/);
});
