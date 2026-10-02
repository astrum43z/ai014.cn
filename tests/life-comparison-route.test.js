import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const visible=(h,on)=>{
 for(const id of ['life-trial-view','life-trial-result-link'])assert.equal(h.el(id).hidden,!on,id);
};
const snapshot=h=>({
 metrics:h.el('metrics').textContent,trial:h.el('life-test-result').textContent,
 solved:h.el('life-test-result').getAttribute('data-solved'),returnHidden:h.el('life-return').hidden,
 history:h.el('history-caption').textContent,selection:h.el('life-selection').textContent,
 notes:h.el('field-notes-list').innerHTML,mission:h.el('mission-state').textContent,
 drawing:h.drawing(),frames:h.frames.size,status:h.el('status').textContent,
 announcement:h.el('announcement').textContent,draws:h.drawCount(),writes:h.writes(),
 search:location.search,
});
function makeTrial(h,solved=false){
 click(h,'life-challenge-start');
 for(const id of solved?['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle']:['life-toggle','life-right','life-toggle','life-right','life-toggle','life-right','life-toggle'])click(h,id);
 click(h,'life-test');
}

test('native Life routes identify reading-only navigation and a focusable result',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<a id="life-trial-result-link" href="#life-test-result" hidden>回到本次对比结果 ↓<\/a>/);
 assert.match(html,/<p id="life-test-result" tabindex="-1" aria-live="off">/);
 assert.match(html,/<div id="life-trial-view" class="life-trial-view" hidden><a class="return-to-canvas" href="#canvas" aria-describedby="life-trial-view-help">查看画布中的这一代 ↑<\/a>/);
 assert.match(html,/id="life-trial-view-help">只移动阅读位置，保留本次对比；“返回修改”才会恢复原图。/);
 assert.match(html,/<canvas id="canvas" tabindex="0"/);
 assert.ok(html.indexOf('id="life-test-result"')<html.indexOf('id="life-trial-view"'));
 assert.ok(html.indexOf('id="life-trial-result-link"')<html.indexOf('<aside class="controls">'));
 for(const id of ['life-trial-view','life-trial-result-link','life-trial-view-help'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 assert.doesNotMatch(app,/\$\('#life-trial-(?:view|result-link)'\)\.addEventListener/,'native navigation has no model-changing handler');
 assert.match(css,/\.reading-nav a,\.return-to-canvas\{[^}]*min-height:44px/);
 assert.match(css,/\.experiment-shortcuts a\{[^}]*min-height:44px/);
 assert.match(css,/#life-test-result:focus-visible\{outline:3px solid #ffac86/);
 assert.match(css,/\.life-trial-view \.return-to-canvas\{[^}]*max-width:100%;[^}]*white-space:normal;overflow-wrap:anywhere/);
});

for(const solved of [false,true])test(`comparison route preserves the ${solved?'unchanged':'changed'} board, overlay and return snapshot`,async()=>{
 const h=await setup('?experiment=life','#instruments');visible(h,false);
 makeTrial(h,solved);visible(h,true);
 assert.equal(h.el('life-test-result').getAttribute('data-solved'),String(solved));
 assert.equal(h.el('life-trial-legend').hidden,solved);
 const before=snapshot(h);
 for(const hash of ['#canvas','#life-test-result','#canvas','#instruments','#life-test-result']){
  h.navigate(location.search+hash);assert.deepEqual(snapshot(h),before);visible(h,true);
 }
 click(h,'life-return');visible(h,false);
 assert.match(h.el('metrics').textContent,/第 0 代 · 4 个活格子/);
 assert.equal(h.el('passport-count').textContent,'本次发现 0 / 5');
 assert.equal(h.el('life-test').disabled,false);
});

test('result routes follow a retained Life comparison and hide in all other worlds',async()=>{
 const h=await setup('?experiment=life');makeTrial(h);const before=snapshot(h);
 for(const mode of ['wave','fractal','walk','orbit']){
  click(h,'tab-'+mode);assert.equal(h.el('life-trial-result-link').hidden,true);
  assert.equal(h.el('life-challenge').hidden,true);
  click(h,'tab-life');visible(h,true);
  assert.equal(h.el('life-test-result').textContent,before.trial);
  assert.deepEqual(h.drawing(),before.drawing);
  assert.equal(h.el('status').textContent,'已暂停');
 }
});

test('selection, rate, density, resize and sharing preserve the comparison reading route',async()=>{
 const h=await setup('?experiment=life');makeTrial(h);h.navigate(location.search+'#life-test-result');
 const result=h.el('life-test-result').textContent,metrics=h.el('metrics').textContent;
 for(const action of [()=>click(h,'life-right'),()=>input(h,'rate',3),()=>input(h,'density',45),()=>h.resize(334,240),()=>click(h,'share')]){
  await action();visible(h,true);assert.equal(h.el('life-test-result').textContent,result);
  assert.equal(h.el('metrics').textContent,metrics);assert.equal(location.hash,'#life-test-result');
 }
 assert.match(h.el('share-note').textContent,/不含画布/);
 assert.equal(new URL(h.el('share-link').value).hash,'#life-test-result');
 h.navigate(location.search+'#canvas');h.navigate(location.search+'#life-test-result');visible(h,true);
 click(h,'life-return');assert.match(h.el('metrics').textContent,/第 0 代 · 4 个活格子/);
 assert.equal(h.el('rate').value,'3');assert.equal(h.el('density').value,'45');
});

for(const [name,action] of [
 ['Return',h=>click(h,'life-return')],['Continue',h=>click(h,'pause')],['Step',h=>click(h,'step')],
 ['Rewind',h=>click(h,'life-back')],['Clear',h=>click(h,'clear')],['Reset',h=>click(h,'reset')],
 ['edit',h=>click(h,'life-toggle')],['preset',h=>{h.el('preset-select').handlers.change({target:{value:'blinker'}});click(h,'load-preset');}],
 ['random sow',h=>click(h,'preset')],['guide',h=>click(h,'guide-start')],['mission',h=>click(h,'mission-start')],
 ['challenge restart',h=>click(h,'life-challenge-start')],['new URL',h=>h.navigate('?experiment=life&rate=3')]
])test(`${name} removes reading routes when it ends the comparison`,async()=>{
 const h=await setup('?experiment=life');makeTrial(h);visible(h,true);
 action(h);visible(h,false);assert.equal(h.el('life-return').hidden,true);
});

test('clear recovery restores both routes with the exact comparison, while navigation never consumes recovery',async()=>{
 const h=await setup('?experiment=life');makeTrial(h);const result=h.el('life-test-result').textContent,drawing=h.drawing();
 click(h,'clear');visible(h,false);
 h.navigate(location.search+'#canvas');h.navigate(location.search+'#life-test-result');
 assert.equal(h.el('life-undo-clear').getAttribute('aria-disabled'),'false');
 click(h,'life-undo-clear');visible(h,true);
 assert.equal(h.el('life-test-result').textContent,result);assert.deepEqual(h.drawing(),drawing);
 click(h,'life-return');visible(h,false);assert.match(h.el('metrics').textContent,/第 0 代 · 4 个活格子/);
});

test('a running start pauses once; reading navigation neither resumes nor records the trial',async()=>{
 const h=await setup('?experiment=life','#instruments',false);assert.equal(h.frames.size,1);
 click(h,'life-test');visible(h,true);assert.equal(h.frames.size,0);assert.match(h.el('metrics').textContent,/第 1 代/);
 const before=snapshot(h);
 for(const hash of ['#canvas','#life-test-result','#canvas']){h.navigate(location.search+hash);assert.deepEqual(snapshot(h),before);}
 assert.equal(h.el('passport-count').textContent,'本次发现 0 / 5');
});

test('reading a solved trial does not check the exploration or replace historical notebook entries',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');
 for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 click(h,'life-test');visible(h,true);
 h.navigate(location.search+'#canvas');h.navigate(location.search+'#life-test-result');
 assert.equal(h.el('passport-count').textContent,'本次发现 0 / 5');
 click(h,'mission-check');assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');
 const notes=h.el('field-notes-list').innerHTML;
 h.navigate(location.search+'#canvas');h.navigate(location.search+'#life-test-result');
 assert.equal(h.el('field-notes-list').innerHTML,notes);visible(h,true);
 click(h,'life-return');visible(h,false);assert.equal(h.el('field-notes-list').innerHTML,notes);
});
