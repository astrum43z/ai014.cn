import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {testStillLife} from '../life-challenge.js';
import {lifeStep} from '../simulations.js';
import {setup} from './life-challenge-harness.js';
const board=(points,cols=48,rows=32)=>{const cells=new Uint8Array(cols*rows);for(const [x,y] of points)cells[y*cols+x]=1;return cells;};
const block=[[23,15],[24,15],[23,16],[24,16]];
const tub=[[24,15],[23,16],[25,16],[24,17]];
const pattern=h=>[h.el('metrics').textContent,h.el('history-line').points,h.el('life-cell-position').textContent];
const click=(h,id)=>h.el(id).handlers.click();
const tap=(h,x,y)=>h.el('canvas').handlers.click({clientX:(x+.5)*600/48,clientY:(y+.5)*414/32});
function draw(h,points=block){click(h,'life-challenge-start');for(const [x,y] of points)tap(h,x,y);}

test('blocks, tubs and wrapped four-cell fixed points all solve without changing input',()=>{
 for(const points of [block,tub,[[47,31],[0,31],[47,0],[0,0]]]){
  const cells=board(points),before=cells.slice(),r=testStillLife(cells,48,32);
  assert.deepEqual(cells,before);assert.deepEqual(r.next,before);assert.equal(r.solved,true);assert.equal(r.changed,0);assert.equal(r.beforeCount,4);assert.equal(r.afterCount,4);
  let later=r.next;for(let n=0;n<20;n++)later=lifeStep(later,48,32);assert.deepEqual(later,before);
 }
});
test('same count does not imply same pattern, and empty/non-four fixed points do not solve',()=>{
 const blinker=testStillLife(board([[23,15],[24,15],[25,15]]),48,32);
 assert.equal(blinker.beforeCount,blinker.afterCount);assert.equal(blinker.born,2);assert.equal(blinker.died,2);assert.equal(blinker.solved,false);
 for(const points of [[],[[0,0]],[[10,10],[11,9],[12,9],[13,10],[12,11],[11,11]]])assert.equal(testStillLife(board(points),48,32).solved,false);
 // Four living positions can keep their count while exchanging members.
 let found=false;
 for(let mask=0;mask<65536;mask++){
  if(mask.toString(2).replaceAll('0','').length!==4)continue;
  const cells=board(Array.from({length:16},(_,i)=>i).filter(i=>(mask>>i)&1).map(i=>[10+i%4,10+Math.floor(i/4)]));
  const r=testStillLife(cells,48,32);
  assert.equal(r.solved,r.next.every((v,i)=>v===cells[i]));
  if(r.afterCount===4&&r.changed>0){assert.equal(r.solved,false);found=true;}
 }
 assert.ok(found);
});
test('test and return advance actual rules then restore the exact drawing and generation',async()=>{
 const h=await setup('?experiment=life');draw(h,[[23,15],[24,15],[25,15],[26,15]]);
 const before=h.drawing(),metrics=h.el('metrics').textContent,position=h.el('life-cell-position').textContent;
 click(h,'life-test');assert.match(h.el('metrics').textContent,/第 1 代 · 6 个活格子/);assert.match(h.el('life-test-result').textContent,/4 → 6.*4 格诞生，2 格消失/);assert.equal(h.el('life-trial-legend').hidden,false);
 assert.equal(h.frames.size,0);assert.equal(h.el('life-test').disabled,true);assert.equal(h.el('life-return').hidden,false);
 const after=h.drawing();click(h,'life-test');assert.deepEqual(h.drawing(),after,'double click does not advance twice');
 click(h,'life-return');assert.equal(h.el('metrics').textContent,metrics);assert.equal(h.el('life-cell-position').textContent,position);assert.deepEqual(h.drawing(),before);assert.equal(h.el('life-test').disabled,false);assert.equal(h.el('life-return').hidden,true);assert.match(h.el('announcement').textContent,/检验前/);
 click(h,'life-return');assert.equal(h.el('metrics').textContent,metrics);
});
test('success is earned by hand construction, survives inspection and ordinary tab memory',async()=>{
 const h=await setup('?experiment=life');draw(h);click(h,'life-test');assert.match(h.el('life-test-result').textContent,/找到静止结构.*4 → 4.*0 格诞生，0 格消失/);assert.equal(h.el('life-trial-legend').hidden,true);
 const result=h.el('life-test-result').textContent,reading=h.el('metrics').textContent;
 h.key('ArrowRight');h.resize(259,240);assert.equal(h.el('life-test-result').textContent,result);
 for(const tab of h.tabs)tab.handlers.click();h.tabs[1].handlers.click();assert.equal(h.el('life-test-result').textContent,result);assert.equal(h.el('metrics').textContent,reading);assert.equal(h.el('life-return').hidden,false);
 h.navigate(location.search+'#discovery-title');h.navigate(location.search+'#canvas');assert.equal(h.el('life-test-result').textContent,result);
 await click(h,'share');assert.equal(new URL(h.el('share-link').value).searchParams.has('at'),false);assert.match(h.el('share-note').textContent,/不含画布/);assert.equal(h.el('life-test-result').textContent,result);
 click(h,'life-return');assert.match(h.el('metrics').textContent,/第 0 代 · 4 个活格子/);
});
test('every replacing or advancing action clears stale results and return snapshots',async()=>{
 const changes=[h=>h.key('Enter'),h=>tap(h,0,0),h=>click(h,'step'),h=>click(h,'pause'),h=>click(h,'clear'),h=>click(h,'reset'),h=>click(h,'guide-start'),h=>click(h,'life-challenge-start'),h=>click(h,'preset'),h=>h.navigate('?experiment=life&rate=3&density=20'),h=>(h.el('preset-select').handlers.change({target:{value:'blinker'}}),h.el('load-preset').handlers.click()),h=>{const e={pointerId:1,button:0,isPrimary:true,clientX:1,clientY:1};h.el('canvas').handlers.pointerdown(e);h.el('canvas').handlers.pointermove({...e,clientX:30});}];
 for(const change of changes){const h=await setup('?experiment=life');draw(h);click(h,'life-test');change(h);assert.equal(h.el('life-return').hidden,true);assert.equal(h.el('life-test').disabled,false);assert.doesNotMatch(h.el('life-test-result').textContent,/找到静止结构/);const metrics=h.el('metrics').textContent;click(h,'life-return');assert.equal(h.el('metrics').textContent,metrics);}
});
test('test pauses a running world; pointer cancellation and repeat starts cannot leak drawing',async()=>{
 const h=await setup('?experiment=life','',false);assert.equal(h.frames.size,1);click(h,'life-test');assert.equal(h.frames.size,0);assert.match(h.el('status').textContent,/已暂停/);
 draw(h);const e={pointerId:1,button:0,isPrimary:true,clientX:1,clientY:1};h.el('canvas').handlers.pointerdown(e);click(h,'life-challenge-start');
 h.el('canvas').handlers.pointermove({...e,clientX:80});h.el('canvas').handlers.pointerup({...e,type:'pointerup',clientX:80});h.el('canvas').handlers.click({...e,clientX:80});assert.match(h.el('metrics').textContent,/第 0 代 · 0 个活格子/);
 click(h,'life-challenge-start');assert.equal(h.frames.size,0);assert.match(h.el('life-cell-position').textContent,/第 24 列，第 16 行/);
});
test('keyboard can build both solutions and parameter changes keep a valid trial',async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');for(const key of ['Enter','ArrowRight','Enter','ArrowDown','Enter','ArrowLeft','Enter'])h.key(key);
 click(h,'life-test');assert.match(h.el('life-test-result').textContent,/找到静止结构/);
 h.el('rate').handlers.input({target:{value:'20'}});h.el('density').handlers.input({target:{value:'60'}});assert.equal(h.el('life-return').hidden,false);assert.match(h.el('life-test-result').textContent,/找到静止结构/);
 for(const i of [0,2,3,4]){h.tabs[i].handlers.click();assert.equal(h.el('life-challenge').hidden,true);}h.tabs[1].handlers.click();assert.equal(h.el('life-challenge').hidden,false);
});
test('challenge is optional native disclosure with quiet results, visible replacement notice and current assets',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<details id="life-challenge" class="life-challenge" hidden><summary>/);assert.doesNotMatch(html,/<details id="life-challenge"[^>]* open/);
 assert.match(html,/id="life-test-result" tabindex="-1" aria-live="off"/);assert.match(html,/id="life-challenge-start" aria-describedby="life-challenge-replaces"/);assert.match(html,/会替换画布/);
 assert.ok(html.indexOf('class="stage-controls"')<html.indexOf('id="life-challenge"'));assert.ok(html.includes('app.js?v=wave-step-key-1'));assert.ok(html.includes('style.css?v=surface-focus-1'));
 assert.match(css,/\.life-challenge summary:focus-visible/);assert.match(css,/\.life-challenge-actions\{display:flex;flex-wrap:wrap/);assert.match(css,/\.life-challenge-actions button\{[^}]*min-height:44px/);
});

test('return to editing reveals the restored canvas before focusing it without extra scroll',async()=>{
 for(const reducedMotion of [false,true]){
  const h=await setup('?experiment=life','',reducedMotion);draw(h);
  click(h,'step');click(h,'step');
  const before=h.drawing(),metrics=h.el('metrics').textContent,position=h.el('life-cell-position').textContent;
  click(h,'life-test');
  const actions=[];
  h.el('canvas').scrollIntoView=options=>actions.push(['scroll',options,h.el('metrics').textContent]);
  h.el('canvas').focus=options=>actions.push(['focus',options]);
  click(h,'life-return');
  assert.deepEqual(actions,[['scroll',{block:'center'},metrics],['focus',{preventScroll:true}]]);
  assert.deepEqual(h.drawing(),before);assert.equal(h.el('metrics').textContent,metrics);
  assert.equal(h.el('life-cell-position').textContent,position);assert.equal(h.frames.size,0);
  assert.equal(h.el('life-return').hidden,true);assert.equal(h.el('life-test').disabled,false);
  // A stale/repeated activation must not move the reader or replace a later edit.
  h.key('Enter');const edited=h.drawing();actions.length=0;click(h,'life-return');
  assert.deepEqual(actions,[]);assert.deepEqual(h.drawing(),edited);
 }
});
