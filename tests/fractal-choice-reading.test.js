import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFractal,addFractalPoints,FRACTAL_LIMIT} from '../fractal.js';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const reading=h=>h.el('fractal-choice-reading').textContent;
// Exact integer arithmetic and interval comparisons form an independent oracle
// for the existing 32-bit generator. Do not read the new model counters here.
function expected(seed,count){
 let rng=BigInt(seed);const counts=[0,0,0];
 for(let i=0;i<count;i++){
  rng=(1664525n*rng+1013904223n)%4294967296n;
  counts[rng*3n<4294967296n?0:rng*3n<8589934592n?1:2]++;
 }
 return counts;
}
function check(h,count,seed=14){
 const counts=expected(seed,count);
 assert.equal(reading(h),`当前序列前 ${count} 次 · A ${counts[0]} 次，B ${counts[1]} 次，C ${counts[2]} 次`);
 assert.match(h.el('metrics').textContent,new RegExp(`^${count} 个点.*种子 ${seed}$`));
 return counts;
}

test('vertex counts match independently computed choices for every supported seed',()=>{
 for(let seed=1;seed<=99;seed++){
  const model=addFractalPoints(createFractal(seed,50),FRACTAL_LIMIT);
  assert.deepEqual(model.vertexCounts,expected(seed,FRACTAL_LIMIT));
  assert.equal(model.vertexCounts.reduce((a,b)=>a+b,0),model.count);
 }
 assert.deepEqual(addFractalPoints(createFractal(14),300).vertexCounts,[90,117,93]);
 assert.deepEqual(addFractalPoints(createFractal(14),301).vertexCounts,[90,117,94]);
 assert.deepEqual(addFractalPoints(createFractal(14),1000).vertexCounts,[320,350,330]);
 assert.deepEqual(addFractalPoints(createFractal(15),1000).vertexCounts,[336,342,322]);
});

test('each generated point increments only its already selected vertex and caps exactly',()=>{
 const model=createFractal(14);
 assert.deepEqual(model.vertexCounts,[0,0,0]);
 for(let i=0;i<FRACTAL_LIMIT;i++){
  const before=[...model.vertexCounts];addFractalPoints(model,1);
  assert.deepEqual(model.vertexCounts,before.map((n,index)=>n+Number(index===model.lastVertex)));
 }
 const capped=structuredClone(model);addFractalPoints(model,1000);assert.deepEqual(model,capped);
 const initial=createFractal(15),unchanged=structuredClone(initial);
 for(const amount of [0,-1,.9]){addFractalPoints(initial,amount);assert.deepEqual(initial,unchanged);}
 const a=createFractal(14),b=createFractal(14);addFractalPoints(a,1);assert.deepEqual(b.vertexCounts,[0,0,0],'each model owns its counters');
});

test('sampling is batch-independent and unchanged by jump ratio at equal counts',()=>{
 for(const seed of [1,14,15,99])for(const jump of [35,38,50,65,70]){
  const whole=addFractalPoints(createFractal(seed,jump),1000),batched=createFractal(seed,jump);
  for(const n of [300,1,99,500,100])addFractalPoints(batched,n);
  assert.deepEqual(whole,batched);
  const other=addFractalPoints(createFractal(seed,jump===50?65:50),1000);
  assert.deepEqual(whole.vertexCounts,other.vertexCounts);assert.equal(whole.rng,other.rng);
  assert.notDeepEqual(whole.points,other.points,'same choices still yield different geometry');
 }
});

test('visible counts include initial samples and follow single points, batches, replay and limits',async()=>{
 const h=await setup('?experiment=fractal');check(h,300);
 const first=h.drawing();click(h,'fractal-back');check(h,300);assert.deepEqual(h.drawing(),first);
 click(h,'fractal-step');check(h,301);click(h,'fractal-back');check(h,300);assert.deepEqual(h.drawing(),first);
 h.key('ArrowRight');check(h,301);h.key('ArrowRight',{repeat:true});check(h,301);
 click(h,'step');check(h,401);click(h,'fractal-1000');check(h,1000);
 const drawing=h.drawing();click(h,'fractal-back');check(h,999);click(h,'fractal-forward');check(h,1000);assert.deepEqual(h.drawing(),drawing);
 h.navigate('?experiment=fractal&seed=99&at=v1,11999');check(h,11999,99);click(h,'fractal-forward');check(h,12000,99);
 for(const id of ['fractal-forward','fractal-step','step','pause']){click(h,id);check(h,12000,99);assert.equal(h.frames.size,0);}
 click(h,'fractal-back');check(h,11999,99);click(h,'fractal-forward');check(h,12000,99);
});

test('changing ratio, seed, presets and guide resets current-sequence totals consistently',async()=>{
 const h=await setup('?experiment=fractal&at=v1,1000');const first=check(h,1000);
 input(h,'jump',38);check(h,300);click(h,'fractal-1000');assert.deepEqual(check(h,1000),first);
 input(h,'seed',15);check(h,300,15);click(h,'fractal-1000');assert.notDeepEqual(check(h,1000,15),first);
 h.el('preset-select').handlers.change({target:{value:'islands'}});click(h,'load-preset');check(h,300,15);
 click(h,'fractal-1000');assert.deepEqual(check(h,1000,15),[336,342,322]);
 click(h,'reset');check(h,300,15);click(h,'guide-start');check(h,300);
});

test('running, paused and unchanged redraws update quietly without replacing equal text',async()=>{
 const h=await setup('?experiment=fractal'),el=h.el('fractal-choice-reading');let value=el.textContent,writes=0;
 Object.defineProperty(el,'textContent',{get:()=>value,set:next=>{value=next;writes++;}});
 h.resize(259,240);h.resize(600,414);h.el('canvas').handlers.focus();assert.equal(writes,0);
 click(h,'pause');const message=h.el('announcement').textContent;h.tick(0);h.tick(50);assert.equal(writes,0);
 h.tick(100);check(h,400);assert.equal(writes,1);assert.equal(h.el('announcement').textContent,message);
 h.tick(150);h.tick(200);check(h,500);assert.equal(writes,2);
 h.motion.change({matches:true});assert.equal(h.frames.size,0);assert.equal(writes,2);
 click(h,'fractal-back');check(h,499);assert.equal(writes,3);assert.equal(h.frames.size,0);
});

test('saved observations and browser history reconstruct the same counts without rewriting a checkpoint',async()=>{
 const h=await setup('?experiment=fractal&jump=38&seed=15&at=v1,1000','#canvas');await click(h,'share');const saved=h.el('share-link').value;
 click(h,'fractal-back');check(h,999,15);assert.equal(h.el('share-link').value,saved);assert.equal(location.href,saved);
 h.navigate(saved.replace('#canvas','#observation-title'));check(h,999,15);
 click(h,'observation-return');check(h,1000,15);
 h.navigate('?experiment=fractal&jump=70&seed=99&at=v1,12000');check(h,12000,99);h.navigate(saved);check(h,1000,15);
 h.navigate('?experiment=fractal&jump=50&seed=14');check(h,300);
});

test('retained worlds, resizing, density and canvas recovery leave the sequence intact',async()=>{
 const h=await setup('?experiment=fractal&jump=65&seed=14&at=v1,1001');const initial=reading(h);h.el('fractal-step').focus();
 for(const [w,z] of [[259,240],[334.5,260.2],[600,414]]){h.resize(w,z);assert.equal(reading(h),initial);}
 h.setDpr(2);h.setDpr(3);h.setDpr(1);assert.equal(reading(h),initial);
 h.loseContext();h.restoreContext();assert.equal(reading(h),initial);assert.equal(h.frames.size,0);assert.equal(document.activeElement,h.el('fractal-step'));
 for(const mode of ['orbit','life','wave','walk']){
  click(h,'tab-'+mode);assert.equal(h.el('fractal-jump').hidden,true);click(h,'tab-fractal');check(h,1001);assert.equal(reading(h),initial);
 }
 click(h,'pause');h.tick(0);h.tick(100);h.tick(150);check(h,1101);h.loseContext();assert.equal(h.frames.size,0);h.restoreContext();h.tick(90000);check(h,1101);
});

test('reading and replay cannot complete discoveries or alter historical notebook evidence',async()=>{
 const h=await setup('?experiment=fractal');click(h,'mission-start');click(h,'fractal-1000');check(h,1000);
 assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');input(h,'seed',15);click(h,'fractal-1000');check(h,1000,15);
 click(h,'fractal-back');click(h,'fractal-forward');assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const notes=h.el('field-notes-list').innerHTML,result=h.el('mission-result').textContent;
 input(h,'jump',38);click(h,'fractal-1000');check(h,1000,15);h.resize(259,240);
 assert.equal(h.el('field-notes-list').innerHTML,notes);assert.equal(h.el('mission-result').textContent,result);
});

test('sampling explanation remains quiet, readable and inside the existing instrument',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const section=html.match(/<section id="fractal-jump".*?<\/section>/s)?.[0];assert.ok(section);
 assert.match(section,/<p id="fractal-choice-reading"><\/p>/);
 assert.match(section,/三等分规则.*有限次数不必各占三分之一.*相同种子、相同点数.*只改前进比例.*抽中次数不变.*不是图形面积/);
 assert.doesNotMatch(section,/aria-live|role="status"|<svg|<canvas/);
 assert.equal((section.match(/<button/g)||[]).length,1,'no new control');
 assert.match(css,/\.fractal-jump p\{[^}]*line-height:1\.7/);assert.match(css,/\.fractal-jump small\{display:block/);
 assert.match(html,/app\.js\?v=orbit-motion-arrow-1/);
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');assert.match(app,/fractal\.js\?v=vertex-counts-1/);
});
