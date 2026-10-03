import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const reading=h=>h.el('wave-path-context').textContent;
function expected(x,y,separation=100,wavelength=32){
 const difference=Math.abs(Math.hypot(x+separation/2,y)-Math.hypot(x-separation/2,y));
 const cycles=difference/wavelength,fraction=cycles-Math.floor(cycles);
 const kind=Math.min(fraction,1-fraction)<.1?'接近加强':Math.abs(fraction-.5)<.1?'接近抵消':'部分叠加';
 return `波程差 ${difference.toFixed(2)} ÷ 波长 ${wavelength} ≈ ${cycles.toFixed(2)} 个波长 · ${kind}`;
}
function check(h,x,y,separation=100,wavelength=32){
 assert.equal(reading(h),expected(x,y,separation,wavelength));
 assert.ok(reading(h).endsWith(h.el('observation-c').textContent.split(' · ')[1]));
 assert.ok(reading(h).includes(h.el('wave-difference').textContent.replace('两条路相差 ','')));
}

test('the near-probe comparison explains center, mixed and half-wave readings without opening instruments',async()=>{
 const h=await setup('?experiment=wave');check(h,0,0);
 assert.equal(reading(h),'波程差 0.00 ÷ 波长 32 ≈ 0.00 个波长 · 接近加强');
 for(let i=1;i<=4;i++){click(h,'wave-right');check(h,i*2,0);}
 assert.equal(reading(h),'波程差 16.00 ÷ 波长 32 ≈ 0.50 个波长 · 接近抵消');
 assert.match(h.el('wave-probe-reading').textContent,/整周期最大幅度 0.00$/);
 click(h,'wave-home');check(h,0,0);assert.equal(h.frames.size,0);
});

test('classification comes from unrounded path geometry at either side of its boundaries',async()=>{
 const h=await setup('?experiment=wave');
 for(const x of [1.599,1.601,6.399,6.401,9.599,9.601,14.399,14.401,17.599,17.601]){
  h.navigate(`?experiment=wave&at=v1,${x},0,0`);check(h,x,0);
 }
 h.navigate('?experiment=wave&at=v1,6.399,0,0');assert.match(reading(h),/0.40 个波长 · 部分叠加$/);
 h.navigate('?experiment=wave&at=v1,6.401,0,0');assert.match(reading(h),/0.40 个波长 · 接近抵消$/);
});

test('both source positions, overlapping paths and far fitted probes use actual distances',async()=>{
 const h=await setup('?experiment=wave');
 for(const [x,y,separation,wavelength] of [[50,0,100,32],[-50,0,100,32],[100,0,100,32],[-100,0,100,32],[800,-300,180,15],[-1000,1000,20,70],[0,140,100,32]]){
  h.navigate(`?experiment=wave&separation=${separation}&wavelength=${wavelength}&at=v1,${x},${y},2.5`);check(h,x,y,separation,wavelength);
  const before={text:reading(h),metrics:h.el('metrics').textContent,url:location.href};
  for(const [width,height] of [[259,240],[295.5,260.25],[600,414],[756,314]]){
   h.resize(width,height);assert.equal(reading(h),before.text);assert.equal(h.el('metrics').textContent,before.metrics);assert.equal(location.href,before.url);
  }
 }
});

test('pointer, exact buttons and canvas keys keep the same comparison without advancing phase',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,2.5'),time=h.el('metrics').textContent;
 h.el('canvas').handlers.click({clientX:300+8*414/280,clientY:207});check(h,8,0);
 click(h,'wave-down');check(h,8,2);h.key('ArrowLeft');check(h,6,2);h.key('Home');check(h,0,0);
 assert.equal(h.el('metrics').textContent,time);assert.equal(h.frames.size,0);
});

test('phase-only steps and animation neither rewrite the comparison nor announce extra messages',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,0'),el=h.el('wave-path-context');
 let value=el.textContent,writes=0;Object.defineProperty(el,'textContent',{get:()=>value,set:next=>{writes++;value=next;}});
 const initial=reading(h);for(let i=0;i<8;i++)click(h,'step');assert.equal(reading(h),initial);assert.equal(writes,0);
 click(h,'pause');const message=h.el('announcement').textContent;
 h.tick(0);h.tick(50);h.tick(100);assert.equal(writes,0);assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,1);
 h.motion.change({matches:true});assert.equal(reading(h),initial);assert.equal(writes,0);assert.equal(h.frames.size,0);
 h.motion.change({matches:false});assert.equal(h.frames.size,0);
 click(h,'wave-left');check(h,6,0);assert.equal(writes,1);h.resize(259,240);assert.equal(writes,1);
});

test('parameter edits, presets, guide and reset refresh the comparison from the new geometry',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,1');
 h.el('wavelength').handlers.input({target:{value:'64'}});check(h,8,12,100,64);
 click(h,'increase-wavelength');check(h,8,12,100,65);
 h.el('separation').handlers.input({target:{value:'20'}});check(h,8,12,20,65);
 click(h,'decrease-separation');check(h,8,12,20,65);
 click(h,'reset');check(h,0,0,20,65);
 h.el('preset-select').handlers.change({target:{value:'wide'}});click(h,'load-preset');check(h,0,0,150,65);
 click(h,'guide-start');check(h,8,0);click(h,'mission-start');check(h,8,0);
});

test('retained tabs, fixed shared observations and history keep the correct comparison',async()=>{
 const h=await setup('?experiment=wave&at=v1,800,-300,2.5','#canvas'),original=reading(h);
 await click(h,'share');const shared=h.el('share-link').value;
 click(h,'wave-home');check(h,0,0);assert.equal(h.el('share-link').value,shared);
 click(h,'observation-return');assert.equal(reading(h),original);assert.equal(h.el('share-link').value,shared);
 for(const index of [0,1,3,4]){
  h.tabs[index].handlers.click();assert.equal(h.el('wave-touch').hidden,true);h.resize(259,240);
  h.tabs[2].handlers.click();assert.equal(h.el('wave-touch').hidden,false);assert.equal(reading(h),original);assert.equal(h.frames.size,0);
 }
 h.navigate('?experiment=wave&wavelength=70&separation=20&at=v1,-10,0,1');check(h,-10,0,20,70);
 h.navigate(shared);assert.equal(reading(h),original);
 h.navigate(location.search+'#observation-title');assert.equal(reading(h),original);
});

test('seeing classifications does not earn discoveries or rewrite historical notes',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');check(h,8,0);assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'mission-check');click(h,'wave-home');check(h,0,0);assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const note=h.el('field-notes-list').innerHTML,result=h.el('mission-result').textContent;
 for(let i=0;i<4;i++)click(h,'wave-right');check(h,8,0);click(h,'step');h.resize(259,240);
 assert.equal(h.el('field-notes-list').innerHTML,note);assert.equal(h.el('mission-result').textContent,result);
});

test('the new context is quiet wrapping text within the existing precision group and adds no control',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 for(const id of ['wave-path-context','wave-path-help'])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1);
 const group=html.slice(html.indexOf('<div id="wave-touch"'),html.indexOf('<div id="fractal-touch"'));
 assert.match(group,/<p id="wave-path-context" aria-live="off"><\/p>/);
 assert.ok(group.indexOf('id="wave-probe-reading"')<group.indexOf('id="wave-path-context"'));
 assert.ok(group.indexOf('id="wave-path-context"')<group.indexOf('id="wave-left"'));
 assert.match(group,/暂停时，A 实线、B 虚线.*整数个波长.*半整数.*不到 0.1 个波长/);
 assert.equal((group.match(/<button /g)||[]).length,4);assert.doesNotMatch(group,/aria-live="polite"|aria-live="assertive"|tabindex|role="status"/);
 assert.match(css,/\.wave-touch p\{[^}]*font-variant-numeric:tabular-nums;overflow-wrap:anywhere/);
 assert.ok(html.includes('app.js?v=fractal-regions-1'));assert.ok(html.includes('style.css?v=fractal-regions-1'));
});
