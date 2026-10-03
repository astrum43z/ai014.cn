import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
import {lifeStep} from '../simulations.js';

const click=(h,id)=>h.el(id).handlers.click();
const choose=(h,value)=>(h.el('preset-select').handlers.change({target:{value}}),click(h,'load-preset'));
const reading=h=>h.el('life-turnover').textContent;
const empty=/本段还没有相邻两代记录/;
const tap=(h,x,y)=>h.el('canvas').handlers.click({clientX:(x+.5)*600/48,clientY:(y+.5)*414/32});
const cellsAt=points=>{const cells=new Uint8Array(48*32);for(const [x,y] of points)cells[y*48+x]=1;return cells;};
function expected(before,after,generation){
 let born=0,died=0,survived=0;
 for(let i=0;i<before.length;i++)if(after[i]){if(before[i])survived++;else born++;}else if(before[i])died++;
 const old=before.reduce((a,b)=>a+b,0),now=after.reduce((a,b)=>a+b,0);
 const outcome=born+died===0?(now?'图案保持不变。':'空棋盘保持不变。'):old===now?`总数仍为 ${now} 格，但位置已改变。`:`总数 ${old} → ${now} 格。`;
 return `第 ${generation-1} → ${generation} 代 · 新生 ${born}，消失 ${died}，存活 ${survived} 格。${outcome}`;
}
const snapshot=h=>({reading:reading(h),drawing:h.drawing(),metrics:h.el('metrics').textContent,caption:h.el('history-caption').textContent,points:h.el('history-line').getAttribute('points')});

test('births and deaths explain a flat blinker graph without calling it still',async()=>{
 const h=await setup('?experiment=life');choose(h,'blinker');assert.match(reading(h),empty);
 for(let generation=1;generation<=3;generation++){
  click(h,'step');assert.equal(reading(h),`第 ${generation-1} → ${generation} 代 · 新生 2，消失 2，存活 1 格。总数仍为 3 格，但位置已改变。`);
  assert.match(h.el('history-caption').textContent,/起点 3 → 当前 3 格/);
 }
 assert.match(h.el('observation-c').textContent,/重复周期 · 2 代/);
});

test('a still block, extinction and an empty next generation have distinct truthful readings',async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');
 for(const [x,y] of [[2,2],[3,2],[2,3],[3,3]])tap(h,x,y);
 click(h,'step');assert.equal(reading(h),'第 0 → 1 代 · 新生 0，消失 0，存活 4 格。图案保持不变。');
 click(h,'clear');tap(h,4,4);click(h,'step');assert.equal(reading(h),'第 0 → 1 代 · 新生 0，消失 1，存活 0 格。总数 1 → 0 格。');
 click(h,'step');assert.equal(reading(h),'第 1 → 2 代 · 新生 0，消失 0，存活 0 格。空棋盘保持不变。');
});

test('turnover counts real toroidal board transitions rather than only the population delta',async()=>{
 const patterns=[[[47,0],[0,0],[1,0]],[[0,31],[0,0],[0,1]],[[47,31],[0,31],[47,0],[0,0]],[[0,0],[1,0],[2,0],[1,1],[10,9]]];
 for(const pattern of patterns){
  const h=await setup('?experiment=life');click(h,'life-challenge-start');for(const [x,y] of pattern)tap(h,x,y);
  let before=cellsAt(pattern);
  for(let generation=1;generation<=4;generation++){
   const after=lifeStep(before,48,32);click(h,'step');assert.equal(reading(h),expected(before,after,generation));before=after;
  }
 }
});

test('pulsar turnover keeps the actual populations and survivors through one complete cycle',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');const points=[];
 for(const a of [2,3,4,8,9,10])for(const b of [0,5,7,12])points.push([a+17,b+9],[b+17,a+9]);
 let before=cellsAt(points);
 for(let generation=1;generation<=3;generation++){
  const after=lifeStep(before,48,32);click(h,'step');assert.equal(reading(h),expected(before,after,generation));before=after;
 }
 assert.match(reading(h),/总数 72 → 48 格/);
});

test('rewind and forward reproduce the corresponding transition, including the oldest retained boundary',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');click(h,'step');const first=snapshot(h);click(h,'step');const second=snapshot(h);
 click(h,'life-back');assert.deepEqual(snapshot(h),first);click(h,'step');assert.deepEqual(snapshot(h),second);
 for(let i=2;i<124;i++)click(h,'step');assert.match(reading(h),/^第 123 → 124 代/);
 for(let i=124;i>5;i--)click(h,'life-back');assert.match(reading(h),empty);assert.match(h.el('metrics').textContent,/第 5 代/);
 click(h,'step');assert.match(reading(h),/^第 5 → 6 代/);
});

test('edited and replacement boards begin a new comparison rather than showing stale births',async()=>{
 const actions=[h=>h.key('Enter'),h=>click(h,'life-toggle'),h=>tap(h,2,2),h=>click(h,'clear'),h=>click(h,'reset'),h=>choose(h,'glider'),h=>click(h,'preset'),h=>click(h,'guide-start'),h=>click(h,'mission-start'),h=>click(h,'life-challenge-start'),h=>h.navigate('?experiment=life&rate=3&density=20')];
 for(const replace of actions){const h=await setup('?experiment=life');choose(h,'blinker');click(h,'step');assert.match(reading(h),/新生 2/);replace(h);assert.match(reading(h),empty);click(h,'step');assert.match(reading(h),/新生 \d+，消失 \d+，存活 \d+ 格/);}
});

test('undo drawing and clear restore the previous measured transition exactly',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');click(h,'step');click(h,'step');const before=snapshot(h);
 h.key('Enter');assert.match(reading(h),empty);h.key('z',{ctrlKey:true});assert.deepEqual(snapshot(h),before);
 click(h,'clear');assert.match(reading(h),empty);click(h,'life-undo-clear');assert.deepEqual(snapshot(h),before);
});

test('one-generation challenge comparison and return use their existing board histories',async()=>{
 const h=await setup('?experiment=life');choose(h,'blinker');click(h,'step');const before=snapshot(h);
 click(h,'life-test');assert.equal(reading(h),'第 1 → 2 代 · 新生 2，消失 2，存活 1 格。总数仍为 3 格，但位置已改变。');
 click(h,'life-return');assert.deepEqual(snapshot(h),before);
});

test('quiet redraws keep the same text and selection while parameters, density and recovery preserve the transition',async()=>{
 const h=await setup('?experiment=life');choose(h,'blinker');click(h,'step');const before=reading(h),el=h.el('life-turnover');assert.match(before,/新生 2，消失 2，存活 1 格/);
 let text=el.textContent,writes=0;Object.defineProperty(el,'textContent',{get:()=>text,set:value=>{text=value;writes++;}});
 const message=h.el('announcement').textContent;h.el('canvas').focus();
 h.resize(259,240);h.setDpr(2);h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();
 h.el('rate').handlers.input({target:{value:'20'}});h.el('density').handlers.input({target:{value:'60'}});
 h.loseContext();h.restoreContext();assert.equal(reading(h),before);assert.equal(writes,0);assert.equal(h.el('announcement').textContent,message);assert.equal(document.activeElement,h.el('canvas'));assert.equal(h.frames.size,0);
 el.textContent='stale';writes=0;h.resize(600,414);assert.equal(reading(h),before);assert.equal(writes,1);
});

test('animation updates quiet evidence without creating announcements or an extra frame chain',async()=>{
 const h=await setup('?experiment=life&rate=20','',false);choose(h,'blinker');const message=h.el('announcement').textContent,url=location.href;
 h.tick(0);for(let generation=1;generation<=6;generation++){h.tick(generation*50);assert.match(reading(h),new RegExp(`^第 ${generation-1} → ${generation} 代 · 新生 2，消失 2，存活 1 格`));}
 assert.equal(h.el('announcement').textContent,message);assert.equal(location.href,url);assert.equal(h.frames.size,1);
 click(h,'pause');const before=snapshot(h);h.resize(600,414);assert.deepEqual(snapshot(h),before);assert.equal(h.frames.size,0);
});

test('tab return, history anchors and parameter-only sharing retain the same reading and never earn a note',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');click(h,'step');click(h,'step');const before=snapshot(h);assert.match(before.reading,/^第 1 → 2 代 · 新生/);
 await click(h,'share');const shared=h.el('share-link').value;assert.equal(new URL(shared).searchParams.has('at'),false);
 for(const world of ['orbit','wave','fractal','walk']){click(h,'tab-'+world);assert.equal(h.el('history-plot').hidden,true);click(h,'tab-life');assert.equal(h.el('history-plot').hidden,false);assert.deepEqual(snapshot(h),before);}
 h.navigate(location.search+'#observation-title');assert.deepEqual(snapshot(h),before);assert.equal(h.el('notes-count').textContent,'0 / 5');assert.equal(h.el('share-link').value,location.href);
});

test('turnover text belongs to the existing quiet, wrapping Life figure without another control',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const figure=html.match(/<figure id="history-plot"[^>]*>[\s\S]*?<\/figure>/)[0];
 assert.match(figure,/<p id="life-turnover" aria-live="off"><\/p>/);assert.doesNotMatch(figure,/button|tabindex|role="status"|aria-live="polite"/);
 assert.match(css,/#life-turnover\{[^}]*font-size:14px[^}]*line-height:1\.8[^}]*overflow-wrap:anywhere/);
});
