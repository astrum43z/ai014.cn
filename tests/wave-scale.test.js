import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const reading=h=>h.el('wave-scale-reading').textContent;
function ruler(h,scale,height){
 const marks=h.drawing(),label=marks.find(item=>item[0]==='fillText'&&/^\d+(?:\.\d+)? 模型单位$/.test(item[1]));
 assert.ok(label,'the canvas has a model-unit ruler');
 const units=Number(label[1].split(' ')[0]),at=marks.indexOf(label);
 const pathMark=marks.findIndex(item=>item[0]==='setLineDash'&&JSON.stringify(item[1])==='[7,5]');
 if(pathMark>=0)assert.ok(pathMark<at,'measuring paths cannot cross the readable ruler label');
 const path=marks.slice(at+1).find(item=>item[0]==='lineTo');
 assert.ok(path);assert.equal(path[2],height-21);
 assert.ok(Math.abs(path[1]-24-units*scale)<1e-9,'drawn length equals the labelled model length times the actual view scale');
 assert.ok(units*scale>31.99&&units*scale<=80.0000001,'a readable 1/2/5 ruler fits the same small corner');
 const mantissa=units/10**Math.floor(Math.log10(units));
 assert.ok([1,2,5].some(n=>Math.abs(n-mantissa)<1e-8));
 assert.equal(reading(h),`左下标尺：${units} 模型单位；视图缩放不改变实验参数与探针位置。`);
 assert.ok(marks.findIndex(item=>item[0]==='arc'&&item[3]===9)>at,'probe is drawn above the ruler, including overlapping corner measurements');
 return units;
}
function state(h){return {metrics:h.el('metrics').textContent,probe:h.el('wave-probe-reading').textContent,envelope:h.el('wave-envelope').textContent,instant:h.el('wave-instant-reading').textContent,url:location.href,notes:h.el('field-notes-list').innerHTML,mission:h.el('mission-result').textContent};}

test('ordinary Wave layouts have an exact readable ruler without changing the measured observation',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,2.5'),before=state(h),message=h.el('announcement').textContent;
 for(const [width,height] of [[600,414],[756,314],[259,240],[334,240],[295,260],[1000,700],[600,414]]){
  h.resize(width,height);ruler(h,Math.min(width,height)/280,height);
  assert.deepEqual(state(h),before);assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,0);
 }
 h.resize(0,0);assert.equal(reading(h),'','a temporarily unlaid-out canvas has no misleading ruler');
 h.resize(600,414);ruler(h,414/280,414);assert.deepEqual(state(h),before);
});

test('wide saved views use their fitted scale and keep extreme probes visible above the ruler',async()=>{
 for(const [x,y] of [[800,-300],[10000,10000],[-10000,10000],[-10000,-10000],[0,10000]]){
  const h=await setup(`?experiment=wave&at=v1,${x},${y},2.5`),before=state(h);
  for(const [width,height] of [[600,414],[259,240],[756,314]]){
   h.resize(width,height);ruler(h,Math.min(Math.min(width,height)/280,(width/2-18)/Math.max(1,Math.abs(x)),(height/2-18)/Math.max(1,Math.abs(y))),height);
   assert.deepEqual(state(h),before);
  }
 }
});

test('returning to center or resetting restores ordinary scale without changing its unit definition',async()=>{
 const h=await setup('?experiment=wave&at=v1,10000,10000,2.5');h.resize(600,414);
 assert.ok(ruler(h,189/10000,414)>=2000);
 click(h,'wave-home');assert.equal(ruler(h,414/280,414),50);
 h.navigate('?experiment=wave&at=v1,-10000,10000,2.5');ruler(h,189/10000,414);
 click(h,'reset');assert.equal(ruler(h,414/280,414),50);
});

test('parameter and phase changes keep scale stable while the field changes',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,2.5'),url=location.href;h.resize(600,414);
 const original=reading(h),units=ruler(h,414/280,414);
 click(h,'step');assert.equal(location.href,url);assert.equal(reading(h),original);
 for(const [id,value] of [['wavelength',70],['separation',180],['wavelength',15],['separation',20]]){
  h.el(id).handlers.input({target:{value:String(value)}});assert.equal(ruler(h,414/280,414),units);assert.equal(reading(h),original);
 }
 click(h,'wave-right');assert.equal(reading(h),original);
});

test('ruler updates quietly without repeated DOM writes while Wave animates',async()=>{
 const h=await setup('?experiment=wave','',false),el=h.el('wave-scale-reading');
 let value=el.textContent,writes=0;Object.defineProperty(el,'textContent',{get:()=>value,set:next=>{writes++;value=next;}});
 const message=h.el('announcement').textContent;h.tick(0);for(let i=1;i<=30;i++)h.tick(i*40);
 ruler(h,414/280,414);assert.equal(writes,0);assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,1);
 h.resize(1000,1000);assert.equal(writes,1);ruler(h,1000/280,1000);assert.equal(h.frames.size,1);
});

test('Wave ruler follows hidden-world resizes and returns with its field',async()=>{
 const h=await setup('?experiment=wave&at=v1,800,-300,2.5'),before=state(h);
 for(const index of [0,1,3,4]){
  h.tabs[index].handlers.click();assert.equal(h.el('wave-key').hidden,true);
  if(index!==0)assert.ok(!h.drawing().some(item=>item[0]==='fillText'&&/模型单位$/.test(item[1])),'only Orbit also has a model-unit ruler');
  h.resize(259,240);h.tabs[2].handlers.click();assert.equal(h.el('wave-key').hidden,false);
  ruler(h,Math.min((259/2-18)/800,(240/2-18)/300),240);assert.deepEqual(state(h),before);
 }
});

test('a fixed checkpoint, notebook result and completed exploration survive ruler resizes',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');click(h,'mission-check');click(h,'wave-home');click(h,'mission-check');
 await click(h,'share');const before=state(h),shared=h.el('share-link').value;
 assert.equal(h.el('notes-count').textContent,'1 / 5');
 for(const [width,height] of [[259,240],[1200,900],[600,414]]){
  h.resize(width,height);ruler(h,Math.min(width,height)/280,height);assert.deepEqual(state(h),before);assert.equal(h.el('share-link').value,shared);
 }
 click(h,'step');click(h,'observation-return');ruler(h,414/280,414);assert.deepEqual(state(h),before);
});

test('the text equivalent wraps beside the field without new controls or live announcements',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const key=html.slice(html.indexOf('<div id="wave-key"'),html.indexOf('<div id="walk-legend"'));
 assert.match(key,/<small id="wave-scale-reading" aria-live="off"><\/small>/);
 assert.doesNotMatch(key,/<button|<a |tabindex|role="status"|aria-live="polite"|aria-live="assertive"/);
 assert.match(css,/\.wave-key\{[^}]*overflow-wrap:anywhere/);
 assert.ok(html.includes('app.js?v=wave-cycle-traces-1'));
});
