import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const modes=['orbit','life','wave','fractal','walk'];
const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
function trackResult(h){
 const events=[],result=h.el('mission-result');
 h.el('mission').scrollIntoView=options=>events.push({target:'mission',options});
 result.scrollIntoView=options=>events.push({target:'result',options,hidden:result.hidden,text:result.textContent});
 const focus=result.focus;
 result.focus=options=>{events.push({target:'focus',options});focus.call(result);};
 return events;
}
function expectRevealed(h,events){
 assert.deepEqual(events,[
  {target:'result',options:{block:'center'},hidden:false,text:h.el('mission-result').textContent},
  {target:'focus',options:{preventScroll:true}}
 ]);
 assert.equal(document.activeElement,h.el('mission-result'));
 assert.ok(h.el('mission-result').textContent);
}
function model(h){
 return {metrics:h.el('metrics').textContent,url:location.href,link:h.el('share-link').value,readings:['a','b','c'].map(x=>h.el('observation-'+x).textContent)};
}
function firstCheck(h,mode){
 if(mode==='fractal')click(h,'fractal-1000');
 if(mode!=='life')click(h,'mission-check');
}
function prepareCompletion(h,mode){
 firstCheck(h,mode);
 if(mode==='orbit'){input(h,'gravity',40);for(let i=0;i<70;i++)click(h,'step');}
 if(mode==='life')for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 if(mode==='wave')click(h,'wave-home');
 if(mode==='fractal'){input(h,'seed',15);click(h,'fractal-1000');}
 if(mode==='walk')click(h,'walk-64');
}

for(const mode of modes)test(`${mode}: inline checks reveal the rendered result for progress and corrections`,async()=>{
 for(const reduced of [true,false]){
  const h=await setup('?experiment='+mode,'#canvas',reduced);click(h,'mission-start');
  if(mode==='fractal')click(h,'fractal-1000');
  const events=trackResult(h),before=model(h),drawing=h.drawing();
  h.el('mission-check-inline').focus();click(h,'mission-check-inline');
  expectRevealed(h,events);assert.deepEqual(model(h),before);assert.deepEqual(h.drawing(),drawing);
  assert.equal(h.frames.size,0);assert.equal(h.el('passport-count').textContent,'本次发现 0 / 5');
  events.length=0;click(h,'mission-check-inline');expectRevealed(h,events);
  assert.deepEqual(model(h),before);assert.equal(h.el('passport-count').textContent,'本次发现 0 / 5');
 }
});

for(const mode of modes)test(`${mode}: completing either check reveals feedback after hiding the check buttons`,async()=>{
 for(const id of ['mission-check','mission-check-inline']){
  const h=await setup('?experiment='+mode);click(h,'mission-start');prepareCompletion(h,mode);
  const events=trackResult(h),before=model(h);h.el(id).focus();click(h,id);
  assert.equal(h.el('mission-state').textContent,'已留下发现');
  assert.equal(h.el('mission-check').hidden,true);assert.equal(h.el('mission-check-inline').hidden,true);
  expectRevealed(h,events);assert.deepEqual(model(h),before);
  assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');
  const note=h.el('field-notes-list').innerHTML;events.length=0;click(h,id);
  assert.deepEqual(events,[]);assert.equal(h.el('field-notes-list').innerHTML,note);
 }
});

test('nonterminal upper checks keep the button focus and do not force a scroll',async()=>{
 for(const mode of modes){
  const h=await setup('?experiment='+mode);click(h,'mission-start');
  if(mode==='fractal')click(h,'fractal-1000');
  const events=trackResult(h);h.el('mission-check').focus();
  for(let attempt=0;attempt<2;attempt++){
   click(h,'mission-check');assert.deepEqual(events,[]);assert.equal(document.activeElement,h.el('mission-check'));
  }
 }
});

test('inactive checks are inert and a retained exploration still reveals the current result',async()=>{
 const h=await setup('?experiment=wave');const events=trackResult(h);
 click(h,'mission-check-inline');assert.deepEqual(events,[]);
 click(h,'mission-start');await click(h,'share');const saved=location.href;
 click(h,'tab-life');events.length=0;click(h,'mission-check-inline');assert.deepEqual(events,[]);
 click(h,'tab-wave');h.navigate(location.search+'#canvas');const before=model(h);
 events.length=0;click(h,'mission-check-inline');expectRevealed(h,events);assert.deepEqual(model(h),before);
 assert.equal(new URL(saved).search,new URL(location.href).search);
 assert.equal(h.el('share-link').hidden,false);
});

test('result remains a quiet programmatic focus target with a visible keyboard focus ring',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<p id="mission-result" tabindex="-1" aria-live="off" hidden><\/p>/);
 assert.match(css,/#mission-result:focus-visible\{outline:3px solid var\(--focus-ring\);outline-offset:5px\}/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{html\{scroll-behavior:auto\}/);
});
