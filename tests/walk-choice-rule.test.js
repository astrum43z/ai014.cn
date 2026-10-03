import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWalk,advanceWalk,walkStats,walkPathStats} from '../walk.js';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const directions=['right','left','up','down'];
function check(h,bias){
 // Independent conditional-probability calculation: half the steps are horizontal.
 const probabilities=[.5*(.5+bias/100),.5*(.5-bias/100),.5*.5,.5*.5];
 assert.ok(Math.abs(probabilities.reduce((sum,p)=>sum+p,0)-1)<1e-12);
 for(const [i,name] of directions.entries()){
  assert.equal(h.el('walk-chance-'+name+'-value').textContent,(probabilities[i]*100).toFixed(1)+'%');
  const style=h.el('walk-chance-'+name).getAttribute('style');
  assert.match(style,/^width:[\d.]+%$/);assert.ok(Math.abs(Number(style.slice(6,-1))-probabilities[i]*100)<1e-10);
 }
 assert.equal(h.el('walk-choice-reading').textContent,`偏向 ${bias}%：在水平步中，向右机会从 50% 提高到 ${50+bias}%；每一步都有 50% 的机会走水平方向。`);
}
function snapshot(h){return [h.drawing(),h.el('metrics').textContent,h.el('walk-cancellation').textContent,h.el('walk-step-reading').textContent,h.el('walk-occupancy-reading').textContent];}
function select(h,preset){h.el('preset-select').handlers.change({target:{value:preset}});click(h,'load-preset');}

test('all 26 supported biases show conditional direction probabilities on an absolute 100-percent scale',async()=>{
 const h=await setup('?experiment=walk');
 for(let bias=0;bias<=25;bias++){input(h,'bias',bias);check(h,bias);assert.equal(h.frames.size,0);}
 input(h,'bias',0);check(h,0);assert.equal(h.el('walk-chance-right-value').textContent,'25.0%');
 input(h,'bias',1);check(h,1);assert.equal(h.el('walk-chance-left-value').textContent,'24.5%');
 input(h,'bias',25);check(h,25);assert.equal(h.el('walk-chance-right-value').textContent,'37.5%');
 assert.equal(h.el('walk-chance-left-value').textContent,'12.5%');
});

test('displayed weights match the actual sampler thresholds, including half-percentage increments',async()=>{
 // Exact BigInt modular inverse lets us place the first random draw on either
 // side of each existing branch threshold without altering advanceWalk.
 const modulus=2n**32n,a=1664525n,c=1013904223n;
 let [oldR,r,oldS,s]=[a,modulus,1n,0n];
 while(r){const q=oldR/r;[oldR,r]=[r,oldR-q*r];[oldS,s]=[s,oldS-q*s];}
 const inverse=(oldS+modulus)%modulus;
 const h=await setup('?experiment=walk');
 for(let bias=0;bias<=25;bias++){
  input(h,'bias',bias);check(h,bias);
  const right=Number(h.el('walk-chance-right-value').textContent.slice(0,-1))/100;
  const left=Number(h.el('walk-chance-left-value').textContent.slice(0,-1))/100;
  for(const [boundary,before,after] of [[right,[1,0],[-1,0]],[right+left,[-1,0],[0,1]],[.75,[0,1],[0,-1]]]){
   // The generator samples multiples of 2^-32; theoretical percentages need
   // not correspond to an integral quota in that finite sample space.
   const upper=BigInt(Math.ceil(boundary*Number(modulus)));
   for(const [draw,expected] of [[upper-1n,before],[upper,after]]){
    const state=createWalk(14,bias);state.rng=Number(((draw-c)*inverse%modulus+modulus)%modulus);
    advanceWalk(state,1);assert.deepEqual(Array.from(state.positions.slice(0,2)),expected,`${bias}/${boundary}/${draw}`);
   }
  }
 }
});

test('seeds, batches, comparisons, rewind and limit replay retain the rule and exact ensemble',async()=>{
 const h=await setup('?experiment=walk&bias=13&seed=42&at=v1,16');check(h,13);const initial=snapshot(h);
 click(h,'walk-step-one');check(h,13);click(h,'walk-back');assert.deepEqual(snapshot(h),initial);
 click(h,'walk-64');check(h,13);const expected=walkStats(advanceWalk(createWalk(42,13),64));
 assert.equal(h.el('observation-a').textContent,'实测散开程度 · '+expected.spread.toFixed(2));
 const path=walkPathStats(advanceWalk(createWalk(42,13),64));
 assert.equal(h.el('walk-length').textContent,path.length+' 步长');
 h.key('ArrowRight');check(h,13);click(h,'step');check(h,13);h.key('Home');assert.deepEqual(snapshot(h),initial);
 for(const seed of [1,14,50,99]){input(h,'seed',seed);check(h,13);}
 h.navigate('?experiment=walk&bias=25&seed=42&at=v1,512');check(h,25);const end=snapshot(h);
 for(const id of ['walk-step-one','step','pause']){click(h,id);check(h,25);assert.deepEqual(snapshot(h),end);}
 click(h,'walk-back');click(h,'walk-step-one');assert.deepEqual(snapshot(h),end);
});

test('presets, exact nudge buttons, reset, guide and mission use their current model bias',async()=>{
 const h=await setup('?experiment=walk&bias=7&seed=99&at=v1,73');check(h,7);
 click(h,'increase-bias');check(h,8);click(h,'decrease-bias');check(h,7);
 click(h,'reset');check(h,7);select(h,'drift');check(h,25);select(h,'another');check(h,0);
 select(h,'unbiased');check(h,0);input(h,'bias',18);click(h,'guide-start');check(h,0);
 input(h,'bias',23);click(h,'mission-start');check(h,0);
});

test('unchanged redraws and animation preserve probability nodes and never announce the chart',async()=>{
 const h=await setup('?experiment=walk&bias=7');check(h,7);let writes=0;
 for(const id of ['walk-choice-reading',...directions.map(d=>'walk-chance-'+d+'-value')]){
  const el=h.el(id);let value=el.textContent;Object.defineProperty(el,'textContent',{get:()=>value,set:v=>{writes++;value=v;}});
 }
 for(const d of directions){const bar=h.el('walk-chance-'+d),set=bar.setAttribute;bar.setAttribute=function(...args){writes++;return set.apply(this,args);};}
 const first=snapshot(h);h.resize(259,240);h.resize(600,414);h.el('canvas').handlers.focus();assert.deepEqual(snapshot(h),first);assert.equal(writes,0);
 click(h,'walk-step-one');click(h,'walk-back');input(h,'seed',15);check(h,7);assert.equal(writes,0);
 click(h,'pause');const announcement=h.el('announcement').textContent;h.tick(0);h.tick(100);h.tick(200);check(h,7);
 assert.equal(writes,0);assert.equal(h.el('announcement').textContent,announcement);
 input(h,'bias',8);check(h,8);assert.equal(writes,5,'only two numbers, two widths and conditional explanation change');
});

test('context, density, visibility, reduced motion and responsive redraws leave weights and model alone',async()=>{
 const h=await setup('?experiment=walk&bias=1&seed=42&at=v1,73');check(h,1);const first=snapshot(h);h.el('walk-step-one').focus();
 const announcement=h.el('announcement').textContent;
 for(const [w,z] of [[0,0],[259,240],[334.5,260.2],[1200,900],[600,414]]){h.resize(w,z);check(h,1);}
 for(const dpr of [1.25,2,3,1]){h.setDpr(dpr);check(h,1);}
 h.loseContext();check(h,1);h.restoreContext();check(h,1);assert.deepEqual(snapshot(h),first);
 h.setVisible(false);h.setVisible(true);h.setHidden(true);h.setHidden(false);
 assert.equal(document.activeElement,h.el('walk-step-one'));assert.equal(h.el('announcement').textContent,announcement);
 h.motion.change({matches:true});check(h,1);assert.match(h.el('announcement').textContent,/减少动态效果偏好暂停/);assert.equal(h.frames.size,0);
});

test('the instrument remains hidden in other worlds and returns with retained parameters and progress',async()=>{
 const h=await setup('?experiment=walk&bias=19&seed=50&at=v1,65');check(h,19);const first=snapshot(h);
 for(const mode of ['orbit','life','wave','fractal']){
  click(h,'tab-'+mode);assert.equal(h.el('walk-distance').hidden,true);
  click(h,'tab-walk');assert.equal(h.el('walk-distance').hidden,false);check(h,19);assert.deepEqual(snapshot(h),first);
 }
});

test('shared checkpoints and history refresh the rule without rewriting an existing observation',async()=>{
 const h=await setup('?experiment=walk&bias=25&seed=42&at=v1,73','#canvas');check(h,25);const first=snapshot(h);
 await click(h,'share');const saved=h.el('share-link').value;click(h,'walk-back');check(h,25);assert.equal(h.el('share-link').value,saved);
 h.navigate(saved.replace('#canvas','#instruments'));check(h,25);assert.match(h.el('metrics').textContent,/72 步/);
 click(h,'observation-return');assert.deepEqual(snapshot(h),first);
 h.navigate('?experiment=walk&bias=1&seed=99&at=v1,512');check(h,1);h.navigate(saved);check(h,25);assert.deepEqual(snapshot(h),first);
});

test('probability explanations never complete a discovery or change stored measured evidence',async()=>{
 const h=await setup('?experiment=walk&bias=25');click(h,'mission-start');check(h,0);click(h,'mission-check');
 click(h,'walk-64');check(h,0);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');
 assert.equal(h.el('notes-count').textContent,'1 / 5');const evidence=[h.el('mission-result').textContent,h.el('field-notes-list').innerHTML,h.el('notes-text').value];
 input(h,'bias',25);check(h,25);click(h,'walk-step-one');click(h,'walk-back');h.resize(259,240);
 assert.deepEqual([h.el('mission-result').textContent,h.el('field-notes-list').innerHTML,h.el('notes-text').value],evidence);
});

test('chart has labeled text alternatives, common scale, quiet semantics and readable narrow-screen styles',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const section=html.slice(html.indexOf('<div class="walk-choices"'),html.indexOf('<section id="fractal-jump"'));
 assert.match(section,/aria-label="每位漫步者每步的理论方向概率"/);assert.equal((section.match(/<li>/g)||[]).length,4);
 for(const [name,label] of [['right','向右 →'],['left','向左 ←'],['up','向上 ↑'],['down','向下 ↓']]){
  assert.ok(section.includes(label));assert.match(section,new RegExp(`<span id="walk-chance-${name}-value"></span>`));
  assert.equal((html.match(new RegExp(`id="walk-chance-${name}"`,'g'))||[]).length,1);
 }
 assert.equal((section.match(/class="walk-choice-track" aria-hidden="true"/g)||[]).length,4);
 assert.match(section,/每条满宽代表 100%/);assert.match(section,/不是上方这条路径或当前点云的实测比例/);assert.match(section,/有限次选择不必刚好凑齐/);
 assert.doesNotMatch(section,/<button|<a |tabindex|role="status"|aria-live="polite"|aria-live="assertive"/);
 assert.match(css,/\.walk-choice-bars li\{[^}]*grid-template-columns:4.5em minmax\(0,1fr\) 5ch[^}]*font-size:13px/);
 assert.match(css,/\.walk-choices small\{[^}]*font-size:13px[^}]*overflow-wrap:anywhere/);
 assert.match(css,/@media\(max-width:720px\)\{\.walk-choices h5,\.walk-choices #walk-choice-reading\{font-size:14px\}/);
 assert.ok(html.includes('app.js?v=canvas-pause-1'));assert.ok(html.includes('style.css?v=canvas-pause-1'));
});
