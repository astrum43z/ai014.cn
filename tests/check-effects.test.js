import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const modes=['orbit','life','wave','fractal','walk'];
const click=(h,id)=>h.el(id).handlers.click();
const checkIds=['mission-check','mission-check-inline'];
const helpIds=['mission-check-help','mission-check-inline-help'];
function expectCheckVisibility(h,visible){
 for(const id of [...checkIds,...helpIds])assert.equal(h.el(id).hidden,!visible,id);
}
function snapshot(h){
 return {metrics:h.el('metrics').textContent,readings:['a','b','c'].map(x=>h.el('observation-'+x).textContent),url:location.href,share:h.el('share-link').value};
}
function block(h){
 for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
}

for(const mode of modes)test(`${mode}: check help follows active controls and checking pauses without advancing`,async()=>{
 const h=await setup('?experiment='+mode,'',false);
 expectCheckVisibility(h,false);
 click(h,'mission-start');expectCheckVisibility(h,true);
 const before=snapshot(h),drawing=h.drawing();
 click(h,'mission-check');
 assert.deepEqual(snapshot(h),before);assert.deepEqual(h.drawing(),drawing);
 assert.equal(h.frames.size,0);assert.equal(h.el('passport-count').textContent,'本次发现 0 / 5');
 click(h,'pause');assert.equal(h.frames.size,1);
 const running=snapshot(h);
 click(h,'mission-check-inline');
 assert.deepEqual(snapshot(h),running);assert.equal(h.frames.size,0);
 assert.equal(document.activeElement.id,'mission-result');
 expectCheckVisibility(h,true);
 const next=modes[(modes.indexOf(mode)+1)%modes.length];
 click(h,'tab-'+next);expectCheckVisibility(h,false);
 click(h,'tab-'+mode);expectCheckVisibility(h,true);
 h.navigate(location.search+'#canvas');expectCheckVisibility(h,true);
 const changed={orbit:'gravity=90',life:'rate=3',wave:'wavelength=40',fractal:'seed=16',walk:'seed=16'}[mode];
 h.navigate('?experiment='+mode+'&'+changed);expectCheckVisibility(h,false);
});

test('finished exploration hides both descriptions; restart brings them back without erasing notes',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');click(h,'mission-check');
 click(h,'wave-home');click(h,'mission-check-inline');
 expectCheckVisibility(h,false);assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');
 const note=h.el('field-notes-list').innerHTML;
 click(h,'tab-life');expectCheckVisibility(h,false);
 click(h,'tab-wave');expectCheckVisibility(h,false);
 click(h,'mission-start');expectCheckVisibility(h,true);
 assert.equal(h.el('field-notes-list').innerHTML,note);
});

test('Life comparison really advances and returns the original model, with no notebook write',async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');
 for(let i=0;i<4;i++){click(h,'life-toggle');click(h,'life-right');}
 const original=snapshot(h),drawing=h.drawing();
 click(h,'life-test');
 assert.match(h.el('metrics').textContent,/第 1 代 · 6 个活格子/);
 assert.match(h.el('life-test-result').textContent,/4 → 6.*4 格诞生，2 格消失/);
 assert.equal(h.frames.size,0);assert.equal(document.activeElement.id,'life-return');
 assert.equal(h.el('life-return-help').hidden,false);
 const compared=snapshot(h);click(h,'life-test');assert.deepEqual(snapshot(h),compared);
 assert.equal(h.el('passport-count').textContent,'本次发现 0 / 5');
 expectCheckVisibility(h,false);
 click(h,'life-return');assert.deepEqual(snapshot(h),original);assert.deepEqual(h.drawing(),drawing);
 assert.equal(document.activeElement.id,'canvas');
 assert.equal(h.el('life-return-help').hidden,true);
});

test('successful Life instrument comparison needs an explicit exploration check to record a discovery',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');block(h);
 click(h,'life-test');
 assert.equal(h.el('life-test-result').getAttribute('data-solved'),'true');
 assert.match(h.el('metrics').textContent,/第 1 代 · 4 个活格子/);
 assert.equal(h.el('passport-count').textContent,'本次发现 0 / 5');expectCheckVisibility(h,true);
 click(h,'life-return');assert.match(h.el('metrics').textContent,/第 0 代 · 4 个活格子/);
 const before=snapshot(h);click(h,'mission-check');assert.deepEqual(snapshot(h),before);
 assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');expectCheckVisibility(h,false);
});

test('even a solved standalone comparison leaves the optional exploration idle',async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');block(h);click(h,'life-test');
 assert.equal(h.el('life-test-result').getAttribute('data-solved'),'true');
 assert.equal(h.el('mission-state').textContent,'可选探索');
 assert.equal(h.el('passport-count').textContent,'本次发现 0 / 5');expectCheckVisibility(h,false);
 click(h,'tab-orbit');click(h,'tab-life');
 assert.equal(h.el('life-test-result').getAttribute('data-solved'),'true');
 assert.equal(h.el('passport-count').textContent,'本次发现 0 / 5');
});

test('return-specific help follows retained trials and disappears when their return snapshot is discarded',async()=>{
 const changes=[h=>click(h,'step'),h=>click(h,'pause'),h=>click(h,'clear'),h=>click(h,'reset'),h=>click(h,'preset'),h=>click(h,'mission-start'),h=>click(h,'life-challenge-start'),h=>h.key('Enter'),h=>h.navigate('?experiment=life&rate=3')];
 for(const change of changes){
  const h=await setup('?experiment=life');click(h,'life-challenge-start');
  assert.equal(h.el('life-return-help').hidden,true);
  block(h);click(h,'life-test');assert.equal(h.el('life-return-help').hidden,false);
  click(h,'tab-wave');assert.equal(h.el('life-challenge').hidden,true);
  click(h,'tab-life');assert.equal(h.el('life-challenge').hidden,false);
  assert.equal(h.el('life-return-help').hidden,false);
  change(h);assert.equal(h.el('life-return').hidden,true);assert.equal(h.el('life-return-help').hidden,true);
 }
});

for(const mode of ['wave','fractal','walk'])test(`${mode}: inspection keeps a saved observation fixed`,async()=>{
 const h=await setup('?experiment='+mode);click(h,'mission-start');
 if(mode==='fractal')click(h,'fractal-1000');
 await click(h,'share');const saved=snapshot(h);
 click(h,'mission-check');assert.deepEqual(snapshot(h),saved);
 click(h,'mission-check-inline');assert.deepEqual(snapshot(h),saved);
});

test('check help is quiet and unchanged by animation or resize',async()=>{
 const h=await setup('?experiment=orbit','',false);click(h,'mission-start');
 let changes=0;
 for(const id of helpIds){const el=h.el(id);let hidden=el.hidden;Object.defineProperty(el,'hidden',{get:()=>hidden,set:value=>{changes++;hidden=value;},configurable:true});}
 click(h,'pause');const announcement=h.el('announcement').textContent;
 h.tick(0);for(let i=1;i<=90;i++)h.tick(i*1000/60);
 h.resize(420,400);assert.equal(changes,0);assert.equal(h.el('announcement').textContent,announcement);
});

test('effect descriptions are visible, associated with their controls, and add no focus or live regions',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 for(const [button,help] of [['mission-check','mission-check-help'],['mission-check-inline','mission-check-inline-help'],['life-test','life-test-help'],['life-return','life-return-help']]){
  assert.match(html,new RegExp(`<button id="${button}" aria-describedby="${help}"`));
 }
 assert.match(html,/<button id="life-test"[^>]*>前进一代并对比 →<\/button>/);
 assert.match(html,/<small id="mission-check-help" hidden>检查会暂停，不推进模拟；完成探索后才写入本次发现。<\/small>/);
 assert.match(html,/<small id="mission-check-inline-help" hidden>检查会暂停、不推进；回到上方查看结果。<\/small>/);
 assert.match(html,/<small id="life-test-help">对比会暂停并前进一代，可返回原图修改；继续、单步或编辑会结束这次对比。这项对比不写入本次发现。<\/small>/);
 assert.match(html,/<small id="life-return-help" hidden>返回会恢复这次对比前的图案与代数，并保持暂停；不会写入本次发现。<\/small>/);
 assert.match(html,/<small id="life-challenge-replaces">“清空并开始”会替换画布。<\/small>/);
 for(const id of [...helpIds,'life-test-help','life-return-help']){
  const tag=html.match(new RegExp(`<small id="${id}"[^>]*>`))[0];
  assert.doesNotMatch(tag,/tabindex|aria-live|role=/);
 }
 const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(css,/\.experiment-shortcuts small\{[^}]*flex-basis:100%/);
 assert.match(css,/\.life-challenge-actions\{display:flex;flex-wrap:wrap/);
});
