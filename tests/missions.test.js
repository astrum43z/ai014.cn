import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';
import {centralGapCount,checkMission,missions} from '../missions.js';
import {createFractal,addFractalPoints} from '../fractal.js';
const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const result=h=>h.el('mission-result').textContent;
const count=h=>h.el('passport-count').textContent;
const start=h=>click(h,'mission-start');
const check=h=>click(h,'mission-check');
function block(h){for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);}

for(const mode of Object.keys(missions))test(mode+': starting or repeatedly checking is never a completed discovery',async()=>{
 const h=await setup('?experiment='+mode,'',false);
 assert.equal(h.el('mission-state').textContent,'可选探索');
 start(h);assert.equal(h.frames.size,0);assert.equal(h.el('mission-state').textContent,'探索中');
 assert.equal(count(h),'本次发现 0 / 5');
 for(let i=0;i<3;i++)check(h);
 assert.equal(count(h),'本次发现 0 / 5');assert.equal(h.el('mission-next').hidden,true);
 assert.equal(h.el('mission-check-inline').hidden,false);
});

test('fractal central-gap measurement uses actual points and excludes boundary roundoff',()=>{
 for(const seed of [1,14,15,99]){
  const state=addFractalPoints(createFractal(seed,50),1000);
  assert.equal(centralGapCount(state),0);
 }
 assert.ok(centralGapCount(addFractalPoints(createFractal(14,38),1000))>0);
 assert.equal(centralGapCount({count:3,points:new Float32Array([0,-.25,0,.5,Math.sqrt(3)/4,-.25])}),0);
 assert.equal(centralGapCount({count:1,points:new Float32Array([0,0])}),1);
});

test('fractal challenge compares identical point counts with two actual seeds',async()=>{
 const h=await setup('?experiment=fractal');start(h);check(h);
 assert.match(result(h),/当前是 300 点/);assert.equal(count(h),'本次发现 0 / 5');
 click(h,'fractal-1000');assert.match(h.el('metrics').textContent,/1000 个点/);check(h);
 assert.match(result(h),/种子 14 已记录.*中央空三角形内部 0 点/);
 input(h,'seed',16);click(h,'fractal-1000');check(h);assert.match(result(h),/种子 15/);
 input(h,'seed',15);check(h);assert.match(result(h),/300 点/);
 input(h,'jump',65);click(h,'fractal-1000');check(h);assert.match(result(h),/保持在 50%/);
 input(h,'jump',50);click(h,'fractal-1000');check(h);
 assert.equal(h.el('mission-state').textContent,'已留下发现');assert.equal(count(h),'本次发现 1 / 5');
 assert.match(h.el('field-notes-list').innerHTML,/种子 14 \/ 15.*落点为 0 \/ 0/);
 const note=h.el('field-notes-list').innerHTML;check(h);assert.equal(h.el('field-notes-list').innerHTML,note);
 assert.equal(h.frames.size,0);
});

test('wave challenge compares envelope at two positions rather than a transient zero',async()=>{
 const h=await setup('?experiment=wave');start(h);check(h);assert.match(result(h),/静区已记录.*0.00/);
 check(h);assert.match(result(h),/探针回中央/);assert.equal(count(h),'本次发现 0 / 5');
 input(h,'wavelength',64);click(h,'wave-home');check(h);assert.match(result(h),/保持波长 32/);
 input(h,'wavelength',32);click(h,'step');check(h);
 assert.match(result(h),/中央为 1.00/);assert.equal(count(h),'本次发现 1 / 5');
 assert.match(h.el('field-notes-list').innerHTML,/最大幅度 0.00；中央 1.00/);
 assert.equal(h.frames.size,0);
});

test('walk challenge records measured data and requires a fair 16-to-64 comparison',async()=>{
 const h=await setup('?experiment=walk');start(h);click(h,'walk-64');check(h);assert.match(result(h),/比较 16 步/);
 click(h,'walk-16');check(h);const before=h.el('observation-a').textContent.split(' · ')[1];
 assert.match(result(h),/16 步已记录/);
 input(h,'bias',25);click(h,'walk-64');check(h);assert.match(result(h),/偏向 0%/);
 input(h,'bias',0);click(h,'walk-64');const after=h.el('observation-a').textContent.split(' · ')[1];check(h);
 assert.ok(result(h).includes(before+' → '+after));assert.match(result(h),/理论散开程度 4.00 → 8.00/);
 assert.equal(count(h),'本次发现 1 / 5');
});

test('Life touch controls allow a precise 4-cell solution without tiny-grid targeting',async()=>{
 const h=await setup('?experiment=life');start(h);block(h);
 assert.match(h.el('metrics').textContent,/第 0 代 · 4 个活格子/);
 const before=h.drawing();check(h);assert.equal(count(h),'本次发现 1 / 5');
 assert.match(result(h),/新生 0 格、消失 0 格/);assert.match(h.el('metrics').textContent,/第 0 代/);
 assert.deepEqual(h.drawing(),before,'checking evaluates a next generation without replacing the drawing');
 assert.equal(h.frames.size,0);
});

test('Life challenge distinguishes stable position from merely having four live cells',async()=>{
 const h=await setup('?experiment=life');start(h);
 for(let i=0;i<4;i++){click(h,'life-toggle');click(h,'life-right');}
 check(h);assert.match(result(h),/新生 4 格、消失 2 格/);assert.equal(count(h),'本次发现 0 / 5');
 click(h,'life-toggle');check(h);assert.match(result(h),/5 个活格子/);
});

test('touch movement wraps, pauses, and does not edit while moving the Life cursor',async()=>{
 const h=await setup('?experiment=life','',false);start(h);
 for(let i=0;i<24;i++)click(h,'life-left');
 assert.match(h.el('life-cell-position').textContent,/第 48 列/);
 click(h,'life-right');assert.match(h.el('life-cell-position').textContent,/第 1 列/);
 for(let i=0;i<16;i++)click(h,'life-up');
 assert.match(h.el('life-cell-position').textContent,/第 32 行/);
 click(h,'life-down');assert.match(h.el('life-cell-position').textContent,/第 1 行/);
 assert.match(h.el('metrics').textContent,/0 个活格子/);
 click(h,'pause');click(h,'life-toggle');assert.equal(h.frames.size,0);assert.match(h.el('metrics').textContent,/1 个活格子/);
});

test('orbit discovery requires recorded starting state, changed gravity, and measured motion',async()=>{
 const h=await setup('?experiment=orbit');start(h);check(h);assert.match(result(h),/距中心 75.0/);
 check(h);assert.match(result(h),/引力设为 40/);
 input(h,'gravity',40);check(h);assert.match(result(h),/再继续运行/);
 for(let i=0;i<70;i++)click(h,'step');
 check(h);assert.equal(count(h),'本次发现 1 / 5');assert.match(result(h),/距离从 75.0 变成/);
 assert.match(h.el('field-notes-list').innerHTML,/引力 80 → 40/);assert.equal(h.frames.size,0);
});

test('orbit restart and preset replacement cannot reuse a mismatched baseline',async()=>{
 const h=await setup('?experiment=orbit');start(h);click(h,'step');check(h);assert.match(result(h),/原始起点/);
 start(h);check(h);click(h,'reset');input(h,'gravity',40);check(h);assert.match(result(h),/起点已被重置/);
 start(h);check(h);click(h,'preset');check(h);assert.match(result(h),/起点已被重置/);
 assert.equal(count(h),'本次发现 0 / 5');
});

test('unfinished mission, model, and captured evidence survive a tab round trip',async()=>{
 const h=await setup('?experiment=wave');start(h);check(h);click(h,'wave-home');
 const metrics=h.el('metrics').textContent;
 h.tabs[1].handlers.click();assert.equal(h.el('mission-state').textContent,'可选探索');
 h.tabs[2].handlers.click();assert.equal(h.el('metrics').textContent,metrics);assert.match(h.el('mission-instruction').textContent,/探针回中央/);
 check(h);assert.equal(count(h),'本次发现 1 / 5');
});

test('mission anchors do not reset work and different URL settings end the old task',async()=>{
 const h=await setup('?experiment=wave');start(h);check(h);click(h,'wave-home');
 for(const hash of ['#mission','#control-title','#instruments','#field-notes','#home'])h.navigate(location.search+hash);
 assert.match(h.el('mission-instruction').textContent,/探针回中央/);check(h);assert.equal(count(h),'本次发现 1 / 5');
 h.navigate('?experiment=wave&wavelength=40&separation=100');
 assert.equal(h.el('mission-state').textContent,'可选探索');assert.equal(count(h),'本次发现 1 / 5','previous observations are historical notes');
});

test('notebook retains discoveries through a replay, never duplicates or persists them',async()=>{
 const h=await setup('?experiment=life');start(h);block(h);check(h);start(h);
 assert.equal(count(h),'本次发现 1 / 5');block(h);check(h);
 assert.equal(count(h),'本次发现 1 / 5');assert.equal((h.el('field-notes-list').innerHTML.match(/<li>/g)||[]).length,1);
 const fresh=await setup('?experiment=life');assert.equal(count(fresh),'本次发现 0 / 5');
});

test('inline check returns to result and next discovery loads the connected world paused',async()=>{
 const h=await setup('?experiment=wave');start(h);check(h);click(h,'wave-home');
 let scrolled=0,focused=0;h.el('mission-result').scrollIntoView=()=>scrolled++;h.el('mission-result').focus=()=>focused++;
 click(h,'mission-check-inline');assert.equal(scrolled,1);assert.equal(focused,1);
 click(h,'mission-next');assert.match(location.search,/experiment=life/);assert.equal(h.el('mission-state').textContent,'探索中');assert.match(h.el('metrics').textContent,/0 个活格子/);assert.equal(h.frames.size,0);
});

test('mobile precision controls are scoped to their own experiments',async()=>{
 const h=await setup('?experiment=orbit');const before=h.el('metrics').textContent;
 for(const id of ['life-toggle','life-left','wave-home','fractal-1000'])click(h,id);
 assert.equal(h.el('metrics').textContent,before);
 for(const [i,mode] of ['orbit','life','wave','fractal','walk'].entries()){
  h.tabs[i].handlers.click();assert.equal(h.el('life-touch').hidden,mode!=='life');assert.equal(h.el('wave-home').hidden,mode!=='wave');assert.equal(h.el('fractal-1000').hidden,mode!=='fractal');
 }
});

test('structural UI keeps instruments after primary controls and explains session-only evidence',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(html.indexOf('id="mission"')<html.indexOf('id="canvas"'));
 assert.ok(html.indexOf('id="sliders"')<html.indexOf('id="instruments"'));
 assert.ok(html.indexOf('id="instruments"')<html.indexOf('id="observation-title"'));
 assert.match(html,/id="mission-result" tabindex="-1" aria-live="off"/);
 assert.match(html,/id="mission-start" aria-describedby="mission-replaces"/);
 assert.match(html,/刷新后清空.*不会上传/);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 for(const id of ['life-left','life-up','life-down','life-right'])assert.match(html,new RegExp(`id="${id}" aria-label="框选`));
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
});

test('discovery notes report measured evidence and never stamp contradictory central-gap data',()=>{
 const good={values:{jump:50,seed:15},count:1000,gapCount:0};
 assert.equal(checkMission('fractal',1,{...good,gapCount:1},{evidence:{gapCount:0}}).kind,'wait');
 assert.equal(checkMission('fractal',1,good,{evidence:{gapCount:2}}).kind,'wait');
 const wave=checkMission('wave',1,{values:{wavelength:32,separation:100},x:0,y:0,envelope:.987},{evidence:{envelope:.001}});
 assert.match(wave.note,/最大幅度 0.00；中央 0.99/);
});


test('primary completion moves focus to the result before hiding its check control',async()=>{
 const h=await setup('?experiment=life');start(h);block(h);
 let focused=0;h.el('mission-result').focus=()=>focused++;
 check(h);assert.equal(focused,1);assert.equal(h.el('mission-check').hidden,true);
 assert.equal(h.el('mission-result').hidden,false);
});

test('progress only marks verified milestones, with Life blank setup as the exception',async()=>{
 const h=await setup('?experiment=fractal');
 const steps=Array.from({length:3},(_,i)=>{const attributes={};h.el('mission-step-'+i).setAttribute=(key,value)=>attributes[key]=value;return attributes;});
 start(h);assert.equal(steps[0]['data-current'],'true');assert.equal(steps[0]['data-done'],'false');assert.equal(steps[1]['data-current'],'false');
 click(h,'fractal-1000');check(h);assert.equal(steps[0]['data-done'],'true');assert.equal(steps[1]['data-current'],'true');
 input(h,'seed',15);click(h,'fractal-1000');check(h);assert.ok(steps.every(s=>s['data-done']==='true'));
 h.tabs[1].handlers.click();start(h);assert.equal(steps[0]['data-done'],'true');assert.equal(steps[1]['data-current'],'true');assert.equal(steps[1]['data-done'],'false');
});

test('very narrow Life precision controls retain large targets in a directional grid',async()=>{
 const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.match(css,/@media\(max-width:380px\)\{\.life-touch>div\{display:grid;grid-template-columns:44px minmax\(100px,1fr\) 44px/);
 assert.match(css,/grid-template-areas:"\. up \." "left toggle right" "\. down \."/);
 for(const id of ['left','up','toggle','down','right'])assert.match(css,new RegExp('\\.life-touch #life-'+id+'\\{grid-area:'+id+'\\}'));
});
