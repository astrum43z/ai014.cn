import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
import {createWalk,advanceWalk,walkStats} from '../walk.js';

const click=(h,id)=>h.el(id).handlers.click();
const reading=h=>h.el('walk-scale-reading').textContent;
const snapshot=h=>({metrics:h.el('metrics').textContent,spread:h.el('walk-spread-reading').textContent,step:h.el('walk-step-reading').textContent,observations:['a','b','c'].map(k=>h.el('observation-'+k).textContent),url:location.href,notes:h.el('field-notes-list').innerHTML,result:h.el('mission-result').textContent});

function check(h,width,height,steps=64,seed=14,bias=0){
 const model=advanceWalk(createWalk(seed,bias),steps),stats=walkStats(model),marks=h.drawing();
 const circleIndex=marks.findIndex(mark=>mark[0]==='setLineDash'&&JSON.stringify(mark[1])==='[4,5]');
 assert.ok(circleIndex>=0);
 const circle=marks.slice(circleIndex).find(mark=>mark[0]==='arc'),scale=circle[3]/stats.expectedSpread;
 const labelIndex=marks.findIndex(mark=>mark[0]==='fillText'&&/^\d+(?:\.\d+)? 步长$/.test(mark[1]));
 assert.ok(labelIndex>=0,'the current canvas labels the ruler');
 const label=marks[labelIndex],units=Number(label[1].split(' ')[0]);
 const begin=marks.slice(0,labelIndex).findLastIndex(mark=>mark[0]==='beginPath');
 const lines=marks.slice(begin,labelIndex).filter(mark=>['moveTo','lineTo'].includes(mark[0]));
 const end=22+units*scale,y=height-23;
 const expected=[['moveTo',22,y],['lineTo',end,y],['moveTo',22,y-4],['lineTo',22,y+4],['moveTo',end,y-4],['lineTo',end,y+4]];
 assert.equal(lines.length,expected.length);
 lines.forEach((line,i)=>{assert.equal(line[0],expected[i][0]);assert.ok(Math.abs(line[1]-expected[i][1])<1e-9);assert.equal(line[2],expected[i][2]);});
 assert.ok(units*scale>31.999999&&units*scale<=80.000001,'the exact unit length stays between 32 and 80 CSS pixels');
 const mantissa=units/10**Math.floor(Math.log10(units));
 assert.ok([1,2,5].some(n=>Math.abs(n-mantissa)<1e-9));
 assert.deepEqual(label.slice(2),[22,height-32]);
 assert.ok(end<width-22,'the ruler stays within its corner');
 assert.equal(reading(h),`左下标尺：${units} 步长；1 步长是每次移动的长度。视图缩放不改变实际位置。`);
 // Confirm the ruler shares the actual view transform of all 256 model points.
 const walkers=marks.filter(mark=>mark[0]==='arc'&&mark[3]===2.1);
 assert.equal(walkers.length,256);
 for(let i=0;i<walkers.length;i++){
  assert.ok(Math.abs(walkers[i][1]-(circle[1]+(model.positions[i*2]-stats.expectedX)*scale))<1e-9);
  assert.ok(Math.abs(walkers[i][2]-(height/2-model.positions[i*2+1]*scale))<1e-9);
 }
 return {units,scale};
}

test('ordinary comparisons retain exact scale across narrow and wide layouts',async()=>{
 const h=await setup('?experiment=walk&at=v1,64'),before=snapshot(h),message=h.el('announcement').textContent;
 for(const [width,height] of [[600,414],[756,314],[259,240],[334,240],[295,260],[1000,700],[600,414]]){
  h.resize(width,height);check(h,width,height);assert.deepEqual(snapshot(h),before);assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,0);
 }
});

test('long biased walks replace unreadably short ten-step bars with exact useful scales',async()=>{
 for(const seed of [1,14,42,99]){
  const h=await setup(`?experiment=walk&bias=25&seed=${seed}&at=v1,512`),before=snapshot(h);
  for(const [width,height] of [[259,240],[334,240],[600,414],[756,314]]){
   h.resize(width,height);const {units,scale}=check(h,width,height,512,seed,25);
   if(width===259){assert.ok(10*scale<12,'the previous fixed scale is too short');assert.ok(units>10);}
   assert.deepEqual(snapshot(h),before);assert.equal(h.frames.size,0);
  }
 }
});

test('single-step replay and limits reproduce the same ruler and seeded drawing',async()=>{
 const h=await setup('?experiment=walk&bias=25&seed=42&at=v1,511');h.resize(259,240);check(h,259,240,511,42,25);
 click(h,'walk-step-one');check(h,259,240,512,42,25);const drawing=h.drawing(),text=reading(h);
 click(h,'walk-step-one');assert.equal(reading(h),text);click(h,'walk-back');check(h,259,240,511,42,25);
 click(h,'walk-step-one');assert.deepEqual(h.drawing(),drawing);assert.equal(reading(h),text);
 click(h,'walk-16');check(h,259,240,16,42,25);click(h,'walk-back');check(h,259,240,16,42,25);
});

test('checkpoints, keyboard batches, reset and parameters use the current view scale',async()=>{
 const h=await setup('?experiment=walk&bias=25&seed=99&at=v1,512');h.resize(259,240);check(h,259,240,512,99,25);
 click(h,'walk-16');check(h,259,240,16,99,25);click(h,'walk-64');check(h,259,240,64,99,25);
 h.key('ArrowRight');check(h,259,240,80,99,25);h.key('Home');check(h,259,240,16,99,25);
 click(h,'step');check(h,259,240,32,99,25);click(h,'reset');check(h,259,240,16,99,25);
 h.el('bias').handlers.input({target:{value:'0'}});check(h,259,240,16,99,0);
 h.el('seed').handlers.input({target:{value:'1'}});check(h,259,240,16,1,0);
 h.el('preset-select').handlers.change({target:{value:'unbiased'}});click(h,'load-preset');check(h,259,240,16,1,0);
 click(h,'guide-start');check(h,259,240,16);
});

test('animation keeps the ruler accurate and quiet without rewriting unchanged units',async()=>{
 const h=await setup('?experiment=walk'),el=h.el('walk-scale-reading');check(h,600,414,16);
 let value=el.textContent,writes=0;Object.defineProperty(el,'textContent',{get:()=>value,set:next=>{writes++;value=next;}});
 h.resize(600,414);assert.equal(writes,0);click(h,'pause');const message=h.el('announcement').textContent;
 h.tick(0);h.tick(50);h.tick(100);check(h,600,414,20);assert.equal(writes,0);
 for(let i=2;i<=12;i++){h.tick(i*100-50);h.tick(i*100);check(h,600,414,16+i*4);}
 assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,1);
 h.resize(259,240);check(h,259,240,64);assert.equal(writes,1);h.resize(259,240);assert.equal(writes,1);
});

test('hidden-world resizes and every tab return preserve the walk and its scaled ruler',async()=>{
 const h=await setup('?experiment=walk&bias=25&seed=42&at=v1,512'),before=snapshot(h);
 for(const index of [0,1,2,3]){
  h.tabs[index].handlers.click();assert.equal(h.el('walk-legend').hidden,true);h.resize(259,240);
  h.tabs[4].handlers.click();assert.equal(h.el('walk-legend').hidden,false);check(h,259,240,512,42,25);assert.deepEqual(snapshot(h),before);
 }
});

test('fixed shared observations and history recover their exact walk and ruler',async()=>{
 const h=await setup('?experiment=walk&bias=25&seed=42&at=v1,512','#canvas');h.resize(259,240);check(h,259,240,512,42,25);
 await click(h,'share');const url=h.el('share-link').value,before=snapshot(h),drawing=h.drawing();
 click(h,'walk-16');check(h,259,240,16,42,25);assert.equal(h.el('share-link').value,url);
 click(h,'observation-return');check(h,259,240,512,42,25);assert.deepEqual(snapshot(h),before);assert.deepEqual(h.drawing(),drawing);
 h.navigate('?experiment=walk&bias=0&seed=1&at=v1,64');check(h,259,240,64,1,0);
 h.navigate(url);check(h,259,240,512,42,25);assert.deepEqual(snapshot(h),before);
});

test('ruler changes do not advance an exploration or rewrite earned field notes',async()=>{
 const h=await setup('?experiment=walk');click(h,'mission-start');click(h,'mission-check');click(h,'walk-64');
 h.resize(259,240);check(h,259,240);assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const before=snapshot(h);
 for(const [width,height] of [[600,414],[334,240],[1200,900]]){h.resize(width,height);check(h,width,height);assert.deepEqual(snapshot(h),before);}
});

test('unlaid-out views clear the ruler text and restore it on the next valid layout',async()=>{
 const h=await setup('?experiment=walk&at=v1,64');check(h,600,414);const before=snapshot(h);
 h.resize(0,0);assert.equal(reading(h),'');assert.ok(!h.drawing().some(mark=>mark[0]==='fillText'&&/ 步长$/.test(mark[1])));
 h.resize(259,240);check(h,259,240);assert.deepEqual(snapshot(h),before);
});

test('the ruler text wraps within the existing legend without controls or live announcements',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const legend=html.slice(html.indexOf('<div id="walk-legend"'),html.indexOf('<div class="stage-bottom"'));
 assert.match(legend,/<small id="walk-scale-reading" aria-live="off"><\/small>/);
 assert.doesNotMatch(legend,/<button|<a |tabindex|role="status"|aria-live="polite"|aria-live="assertive"/);
 assert.match(css,/#walk-scale-reading\{[^}]*flex-basis:100%[^}]*min-width:0[^}]*overflow-wrap:anywhere/);
 assert.match(css,/\.walk-legend span:last-of-type\{color:#d9e4cf\}/);
 assert.ok(html.includes('app.js?v=walk-scale-1'));assert.ok(html.includes('style.css?v=walk-scale-1'));
});
