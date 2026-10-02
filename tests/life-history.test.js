import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';

const caption=h=>h.el('history-caption').textContent;
const points=h=>h.el('history-line').getAttribute('points').split(' ').map(pair=>pair.split(',').map(Number));
const step=h=>h.el('step').handlers.click();
const choose=(h,value)=>(h.el('preset-select').handlers.change({target:{value}}),h.el('load-preset').handlers.click());
const snapshot=h=>({caption:caption(h),points:points(h),max:h.el('history-maximum').textContent,start:h.el('history-start').textContent,end:h.el('history-end').textContent,cx:h.el('history-current').getAttribute('cx'),cy:h.el('history-current').getAttribute('cy')});

test('history visibility belongs to an HTML figure, with quiet text and decorative SVG',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const figure=html.match(/<figure id="history-plot"[^>]*>[\s\S]*?<\/figure>/)?.[0];
 assert.ok(figure,'HTML hidden reflection must not be assigned to an SVG');
 assert.match(figure,/^<figure[^>]*aria-labelledby="history-caption"[^>]*hidden>/);
 assert.match(figure,/<figcaption id="history-caption" aria-live="off">/);
 assert.match(figure,/<svg[^>]*preserveAspectRatio="none"[^>]*aria-hidden="true"[^>]*focusable="false"/);
 assert.doesNotMatch(figure,/<svg[^>]*\shidden(?:\s|>)/);
 assert.doesNotMatch(figure,/<button|tabindex|aria-live="polite"|role="status"/);
 assert.match(figure,/<circle id="history-current"/,'a first or all-zero sample needs a visible marker');
 const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.match(css,/\[hidden\]\{display:none!important\}/);
 assert.match(css,/.history-chart\{[^}]*minmax\(0,1fr\)/);
 assert.match(css,/#history-caption\{[^}]*overflow-wrap:anywhere/);
 assert.match(css,/.history-chart svg\{[^}]*width:100%;height:90px/);
});

test('initial, single and empty observations have finite coordinates and accurate scales',async()=>{
 const h=await setup('?experiment=life');
 assert.equal(h.el('history-plot').hidden,false);
 assert.equal(caption(h),'活格记录 · 第 0 → 0 代；起点 10 → 当前 10 格；最少 10，最多 10 格。');
 assert.deepEqual(points(h),[[0,8]]);assert.equal(h.el('history-current').getAttribute('cx'),'0');assert.equal(h.el('history-current').getAttribute('cy'),'8');
 h.el('clear').handlers.click();
 assert.equal(caption(h),'活格记录 · 第 0 → 0 代；起点 0 → 当前 0 格；最少 0，最多 0 格。');
 assert.equal(h.el('history-maximum').textContent,'1 格');assert.deepEqual(points(h),[[0,64]]);
 step(h);assert.deepEqual(points(h),[[0,64],[600,64]]);assert.equal(h.el('history-current').getAttribute('cx'),'600');
 assert.match(caption(h),/第 0 → 1 代/);assert.match(h.el('observation-c').textContent,/全部消失/);
});

test('pulsar records a rise and fall, with generation range, min/max, current marker and numeric axes',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');
 const counts=[48,56,72,48];
 for(let i=0;i<counts.length;i++){
  if(i)step(h);
  assert.match(caption(h),new RegExp(`第 0 → ${i} 代；起点 48 → 当前 ${counts[i]} 格；最少 48，最多 ${Math.max(...counts.slice(0,i+1))} 格`));
 }
 assert.equal(h.el('history-maximum').textContent,'72 格');
 assert.equal(h.el('history-start').textContent,'第 0 代');assert.equal(h.el('history-end').textContent,'第 3 代');
 const expected=counts.map((count,i)=>[i*200,64-count/72*56]);assert.deepEqual(points(h),expected);
 assert.equal(Number(h.el('history-current').getAttribute('cy')),expected.at(-1)[1]);
 assert.match(h.el('observation-c').textContent,/重复周期 · 3 代/);
});

test('flat counts retain scale and do not claim an unchanged board',async()=>{
 const h=await setup('?experiment=life');choose(h,'blinker');step(h);step(h);
 assert.match(caption(h),/起点 3 → 当前 3 格；最少 3，最多 3 格/);
 assert.equal(h.el('history-maximum').textContent,'3 格');assert.match(h.el('observation-c').textContent,/重复周期 · 2 代/);
 h.el('clear').handlers.click();
 // A 2 × 2 block at the selected cell stays still, with a different count scale.
 for(const key of ['Enter','ArrowRight','Enter','ArrowDown','Enter','ArrowLeft','Enter'])h.key(key);
 step(h);assert.match(caption(h),/起点 4 → 当前 4 格；最少 4，最多 4 格/);
 assert.equal(h.el('history-maximum').textContent,'4 格');assert.match(h.el('observation-c').textContent,/静止图案/);
});

test('history keeps only 120 observations and redraws do not add or discard generations',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');
 for(let i=0;i<124;i++)step(h);
 assert.equal(points(h).length,120);assert.match(caption(h),/第 5 → 124 代/);
 assert.equal(points(h)[0][0],0);assert.equal(points(h).at(-1)[0],600);
 const before=snapshot(h),url=location.href,frames=h.frames.size;
 for(let i=0;i<10;i++){h.resize(320+i,600);h.key('ArrowRight');}
 h.el('rate').handlers.input({target:{value:'20'}});h.el('density').handlers.input({target:{value:'60'}});
 assert.deepEqual(snapshot(h),before);assert.equal(h.frames.size,frames);assert.notEqual(location.href,url,'only requested parameter changes update URL');
 h.key('Enter');assert.equal(points(h).length,1);assert.match(caption(h),/第 124 → 124 代/);
});

test('clear undo and one-generation test return restore the complete original chart',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');step(h);step(h);
 const before=snapshot(h),url=location.href;
 h.el('clear').handlers.click();assert.match(caption(h),/当前 0 格/);
 h.el('life-undo-clear').handlers.click();assert.deepEqual(snapshot(h),before);
 h.el('life-test').handlers.click();assert.match(caption(h),/第 0 → 3 代/);
 h.el('life-return').handlers.click();assert.deepEqual(snapshot(h),before);assert.equal(location.href,url);
});

test('chart is hidden in every other world and retained on tab return without model changes',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');step(h);step(h);const before=snapshot(h);
 for(const index of [0,2,3,4]){
  h.tabs[index].handlers.click();assert.equal(h.el('history-plot').hidden,true);
  const metrics=h.el('metrics').textContent,url=location.href;
  h.resize(900,500);assert.equal(h.el('metrics').textContent,metrics);assert.equal(location.href,url);
  h.tabs[1].handlers.click();assert.equal(h.el('history-plot').hidden,false);assert.deepEqual(snapshot(h),before);
 }
 h.navigate('?experiment=life&rate=9&density=31#observation-title');assert.match(caption(h),/第 0 → 0 代；起点 10 → 当前 10/);
 h.el('reset').handlers.click();assert.equal(points(h).length,1);
});

test('animation refreshes the quiet history without extra announcements or frames',async()=>{
 const h=await setup('?experiment=life&rate=20','',false);choose(h,'pulsar');
 const announcement=h.el('announcement').textContent,url=location.href;
 h.tick(0);for(let i=1;i<=6;i++)h.tick(i*50);
 assert.match(caption(h),/第 0 → 6 代/);assert.equal(points(h).length,7);
 assert.equal(h.el('announcement').textContent,announcement);assert.equal(location.href,url);assert.equal(h.frames.size,1);
 h.el('pause').handlers.click();const before=snapshot(h);h.resize(320,700);assert.deepEqual(snapshot(h),before);assert.equal(h.frames.size,0);
 const element=h.el('history-caption');let writes=0,text=element.textContent;
 Object.defineProperty(element,'textContent',{get:()=>text,set:value=>{writes++;text=value;}});
 h.resize(600,414);h.key('ArrowRight');assert.equal(writes,0,'unchanged summary preserves its text node');
});
