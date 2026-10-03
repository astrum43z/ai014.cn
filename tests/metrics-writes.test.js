import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
function track(h){
 const element=h.el('metrics');let text=element.textContent,writes=0;
 Object.defineProperty(element,'textContent',{configurable:true,get:()=>text,set:value=>{writes++;text=value;}});
 return {writes:()=>writes,reset:()=>{writes=0;}};
}

for(const mode of ['orbit','wave'])test(`${mode}: 120 animation frames update the stage clock only when its displayed tenth changes`,async()=>{
 const h=await setup('?experiment='+mode,'',false),counter=track(h),initial=h.el('metrics').textContent;
 let changes=0,previous=initial;
 h.tick(0);
 for(let i=1;i<=120;i++){
  h.tick(i*1000/60);
  const current=h.el('metrics').textContent;
  if(current!==previous)changes++;
  previous=current;
 }
 assert.equal(changes,20,'the displayed clock still reaches every tenth through two seconds');
 assert.equal(counter.writes(),changes,'no replacement of an unchanged visible clock');
 assert.match(previous,/t \+ 2.0 s$/);assert.equal(h.frames.size,1);
 click(h,'pause');assert.equal(h.frames.size,0);
 assert.equal(counter.writes(),changes,'pausing must not replace the same metric text');
});

for(const mode of ['orbit','life','wave','fractal','walk'])test(`${mode}: identical and resized paused drawings keep the stage text node`,async()=>{
 const h=await setup('?experiment='+mode),counter=track(h),metric=h.el('metrics').textContent;
 for(const [width,height] of [[600,414],[259,240],[455.5,281.75],[767,318]])h.resize(width,height);
 assert.equal(h.el('metrics').textContent,metric);assert.equal(counter.writes(),0);
 h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();
 assert.equal(counter.writes(),0,'a focus-only redraw keeps the readout');
 // Compare the real DOM value, not a parallel cache that could leave stale text.
 h.el('metrics').textContent='stale';counter.reset();h.resize(600,414);
 assert.equal(h.el('metrics').textContent,metric);assert.equal(counter.writes(),1);
});

test('Life cursor-only movement stays quiet while editing, generation, undo and clear refresh exact counts',async()=>{
 const h=await setup('?experiment=life'),counter=track(h),initial=h.el('metrics').textContent;
 h.key('ArrowRight');click(h,'life-down');assert.equal(counter.writes(),0);
 click(h,'life-toggle');assert.notEqual(h.el('metrics').textContent,initial);assert.equal(counter.writes(),1);
 h.key('z',{ctrlKey:true});assert.equal(h.el('metrics').textContent,initial);assert.equal(counter.writes(),2);
 click(h,'step');assert.match(h.el('metrics').textContent,/^第 1 代/);assert.equal(counter.writes(),3);
 click(h,'life-back');assert.equal(h.el('metrics').textContent,initial);assert.equal(counter.writes(),4);
 click(h,'clear');assert.equal(h.el('metrics').textContent,'第 0 代 · 0 个活格子');assert.equal(counter.writes(),5);
 click(h,'life-undo-clear');assert.equal(h.el('metrics').textContent,initial);assert.equal(counter.writes(),6);
});

test('shared checkpoints, retained worlds, replay, presets and parameters always show the current world',async()=>{
 const h=await setup('?experiment=fractal&jump=38&seed=15&at=v1,12000','#canvas'),counter=track(h);
 assert.equal(h.el('metrics').textContent,'12000 个点 · 前进 38% · 种子 15');
 click(h,'fractal-back');assert.match(h.el('metrics').textContent,/^11999 个点/);
 click(h,'fractal-forward');assert.match(h.el('metrics').textContent,/^12000 个点/);
 const checkpoint=location.href;h.tabs[4].handlers.click();assert.equal(h.el('metrics').textContent,'256 位漫步者 · 16 步 · 偏向 0%');
 click(h,'walk-step-one');assert.match(h.el('metrics').textContent,/17 步/);
 h.tabs[3].handlers.click();assert.equal(location.href,checkpoint);assert.match(h.el('metrics').textContent,/^12000 个点/);
 h.navigate('?experiment=walk&bias=25&seed=99&at=v1,512#canvas');assert.equal(h.el('metrics').textContent,'256 位漫步者 · 512 步 · 偏向 25%');
 click(h,'walk-back');assert.match(h.el('metrics').textContent,/511 步/);
 click(h,'observation-return');assert.match(h.el('metrics').textContent,/512 步/);
 h.el('bias').handlers.input({target:{value:'10'}});assert.equal(h.el('metrics').textContent,'256 位漫步者 · 16 步 · 偏向 10%');
 h.el('preset-select').handlers.change({target:{value:'unbiased'}});click(h,'load-preset');assert.equal(h.el('metrics').textContent,'256 位漫步者 · 16 步 · 偏向 0%');
 h.navigate('?experiment=wave&wavelength=70&separation=180&at=v1,8,0,1000000000#canvas');
 assert.equal(h.el('metrics').textContent,'2 个同频波源 · 波长 70 · t + 1000000000.0 s');
 click(h,'step');assert.match(h.el('metrics').textContent,/1000000000.5 s$/);
 click(h,'reset');assert.match(h.el('metrics').textContent,/t \+ 0.0 s$/);assert.ok(counter.writes()>0);
});
