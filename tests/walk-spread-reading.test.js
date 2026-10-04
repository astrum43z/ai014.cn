import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
import {createWalk,advanceWalk,walkStats} from '../walk.js';

const click=(h,id)=>h.el(id).handlers.click();
const reading=h=>h.el('walk-spread-reading').textContent;
function check(h,steps,seed=14,bias=0){
 const stats=walkStats(advanceWalk(createWalk(seed,bias),steps));
 assert.equal(reading(h),`整群散开 · 第 ${steps} 步：实测 ${stats.spread.toFixed(2)} / 理论 ${stats.expectedSpread.toFixed(2)} 步长`);
 assert.equal(h.el('observation-a').textContent,'实测散开程度 · '+stats.spread.toFixed(2));
 assert.equal(h.el('observation-b').textContent,'理论散开程度 · '+stats.expectedSpread.toFixed(2));
 return stats;
}

test('near-canvas comparison reports the whole ensemble at 16 and 64 steps',async()=>{
 const h=await setup('?experiment=walk'),initial=check(h,16);
 assert.match(reading(h),/理论 4.00 步长$/);
 click(h,'walk-64');const later=check(h,64);assert.match(reading(h),/理论 8.00 步长$/);
 assert.notEqual(later.spread.toFixed(2),h.el('walk-displacement').textContent.split(' ')[0],'population spread is not one walker\'s distance');
 assert.notEqual(initial.spread,4,'finite-sample reading is not replaced by the theory');
 click(h,'walk-16');check(h,16);assert.equal(h.frames.size,0);
});

test('biased and seeded observations retain centered spread rather than drift from the origin',async()=>{
 for(const [seed,bias,steps] of [[1,0,16],[99,1,73],[42,25,512],[14,25,64]]){
  const h=await setup(`?experiment=walk&seed=${seed}&bias=${bias}&at=v1,${steps}`),stats=check(h,steps,seed,bias);
  assert.equal(stats.expectedSpread,Math.sqrt(steps*(1-(bias/100)**2)));
  if(bias===25)assert.notEqual(stats.spread.toFixed(2),stats.rmsDistance.toFixed(2),'drift must not be counted as centered spreading');
 }
});

test('one-step replay, batch keys and limits refresh the same quiet population reading',async()=>{
 const h=await setup('?experiment=walk&seed=42&bias=25&at=v1,511');check(h,511,42,25);
 click(h,'walk-step-one');check(h,512,42,25);const final=reading(h),drawing=h.drawing();
 click(h,'walk-step-one');assert.equal(reading(h),final);
 click(h,'walk-back');check(h,511,42,25);click(h,'walk-step-one');assert.equal(reading(h),final);assert.deepEqual(h.drawing(),drawing);
 click(h,'walk-16');click(h,'walk-back');check(h,16,42,25);
 h.key('ArrowRight');check(h,32,42,25);click(h,'step');check(h,48,42,25);h.key('Home');check(h,16,42,25);
});

test('animation updates measurements without announcements and unchanged redraws retain text nodes',async()=>{
 const h=await setup('?experiment=walk'),el=h.el('walk-spread-reading');check(h,16);
 let value=el.textContent,writes=0;Object.defineProperty(el,'textContent',{get:()=>value,set:next=>{writes++;value=next;}});
 h.resize(600,414);h.resize(259,240);assert.equal(writes,0);
 click(h,'pause');const message=h.el('announcement').textContent;
 h.tick(0);h.tick(50);assert.equal(writes,0);h.tick(100);check(h,20);
 assert.equal(writes,1);assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,1);
 click(h,'pause');assert.equal(h.frames.size,0);assert.equal(writes,1);
 h.resize(1200,900);assert.equal(writes,1);
});

test('parameter edits, reset, presets and the discovery start refresh the existing ensemble',async()=>{
 const h=await setup('?experiment=walk&bias=25&seed=99&at=v1,73');check(h,73,99,25);
 h.el('seed').handlers.input({target:{value:'50'}});check(h,16,50,25);
 click(h,'walk-64');h.el('bias').handlers.input({target:{value:'7'}});check(h,16,50,7);
 h.el('preset-select').handlers.change({target:{value:'unbiased'}});click(h,'load-preset');check(h,16,50,0);
 click(h,'walk-step-one');click(h,'reset');check(h,16,50,0);
 click(h,'guide-start');check(h,16);assert.equal(h.frames.size,0);
});

test('resize, all tab returns, fixed observations and browser history preserve comparison state',async()=>{
 const h=await setup('?experiment=walk&seed=42&bias=25&at=v1,73','#canvas');check(h,73,42,25);
 await click(h,'share');const saved=h.el('share-link').value;click(h,'walk-back');check(h,72,42,25);
 const text=reading(h),draw=h.drawing(),writes=h.writes();
 for(const index of [0,1,2,3]){
  h.tabs[index].handlers.click();assert.equal(h.el('walk-comparison').hidden,true);h.resize(259,240);
  h.tabs[4].handlers.click();assert.equal(h.el('walk-comparison').hidden,false);assert.equal(reading(h),text);
 }
 h.resize(600,414);assert.deepEqual(h.drawing(),draw);assert.equal(h.el('share-link').value,saved);
 assert.equal(new URL(location.href).searchParams.get('at'),'v1,73');
 h.navigate(saved.replace('#canvas','#observation-title'));check(h,72,42,25);
 click(h,'observation-return');check(h,73,42,25);
 h.navigate('?experiment=walk&seed=1&bias=0&at=v1,64');check(h,64,1,0);
 h.navigate(saved);check(h,73,42,25);assert.ok(h.writes()>=writes);
});

test('showing a correct comparison never records a discovery without its explicit checks',async()=>{
 const h=await setup('?experiment=walk');click(h,'mission-start');check(h,16);click(h,'mission-check');
 click(h,'walk-64');check(h,64);assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const notes=h.el('field-notes-list').innerHTML,result=h.el('mission-result').textContent;
 click(h,'walk-back');check(h,63);h.resize(259,240);click(h,'walk-step-one');check(h,64);
 assert.equal(h.el('field-notes-list').innerHTML,notes);assert.equal(h.el('mission-result').textContent,result);
});

test('the whole-group reading stays beside comparison buttons, quiet, wrapping and distinct from the white walker',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const section=html.slice(html.indexOf('<div id="walk-comparison"'),html.indexOf('<div class="stage-controls"'));
 assert.match(section,/<p id="walk-spread-reading" aria-live="off"><\/p>/);
 assert.ok(section.indexOf('id="walk-64"')<section.indexOf('id="walk-spread-reading"'));
 assert.ok(section.indexOf('id="walk-spread-reading"')<section.indexOf('id="walk-step-reading"'));
 assert.match(section,/散开程度以点云中心为基准；256 个样本会有波动。/);
 const comparisonRow=section.slice(section.indexOf('<div class="button-row"'),section.indexOf('<small id="walk-replaces"'));
 assert.equal((comparisonRow.match(/<button /g)||[]).length,4,'the existing comparison row keeps its four controls');
 assert.equal((section.match(/<button /g)||[]).length,5,'one separate exact-destination control');
 assert.doesNotMatch(section,/role="status"|aria-live="polite"|aria-live="assertive"|tabindex/);
 assert.match(css,/#walk-spread-reading,#walk-step-reading\{[^}]*overflow-wrap:anywhere/);
});
