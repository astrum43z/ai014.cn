import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
import {waveComponents} from '../simulations.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
const click=(h,id='step')=>h.el(id).handlers.click();
const reading=h=>h.el('wave-instant-reading').textContent;
function expectReading(h,value){
 const rounded=Math.abs(value)<.005?0:value,number=(rounded>0?'+':'')+rounded.toFixed(2);
 assert.equal(reading(h),'探针此刻 (A+B)/2 · '+number);
 assert.equal(reading(h).split(' · ')[1],h.el('wave-value-combined').textContent);
}
function track(element){
 let value=element.textContent,writes=0;
 Object.defineProperty(element,'textContent',{get:()=>value,set:next=>{value=next;writes++;}});
 return ()=>writes;
}
test('wave color key is adjacent to the field, quiet, labelled without color and not interactive',()=>{
 const start=html.indexOf('<div id="wave-key"'),end=html.indexOf('<div id="walk-legend"');
 assert.ok(start>html.indexOf('</canvas>')&&end>start&&end<html.indexOf('class="stage-controls"'));
 const key=html.slice(start,end);
 assert.match(key,/class="wave-key" hidden/);
 assert.match(key,/class="wave-key-scale" role="group" aria-label="画面颜色与位移正负"/);
 for(const text of ['蓝绿 · 负位移','深绿 · 零位移','黄绿 · 正位移','颜色与亮暗表示此刻的位移，不是整周期幅度','暗处也可能只是经过零'])assert.ok(key.includes(text));
 assert.match(key,/<output id="wave-instant-reading" aria-live="off"><\/output>/);
 assert.equal((key.match(/aria-hidden="true"/g)||[]).length,3);
 assert.doesNotMatch(key,/<button|<a |tabindex|role="status"|aria-live="polite"|aria-live="assertive"/);
 assert.match(css,/\.wave-key-scale\{[^}]*flex-wrap:wrap/);
 assert.match(css,/\.wave-key\{[^}]*overflow-wrap:anywhere/);
 assert.match(css,/\.wave-key output\{[^}]*font-variant-numeric:tabular-nums/);
 assert.ok(html.includes('app.js?v=life-turnover-1')&&html.includes('style.css?v=life-turnover-1'));
});
test('legend swatches match actual field colors at negative, zero and positive displacement',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,0'),darkTime=(50/32*2*Math.PI)/3;
 for(const [kind,time] of [['zero',darkTime],['negative',darkTime+Math.PI/6],['positive',darkTime+Math.PI/2]]){
  h.navigate('?experiment=wave&at=v1,0,0,'+time);h.resize(600,400);
  let fill,color;
  for(const item of h.drawing()){
   if(item[0]==='fillStyle')fill=item[1];
   if(item[0]==='fillRect'&&item[1]===300&&item[2]===200&&item[3]===5)color=fill;
  }
  const hex=css.match(new RegExp('\\.wave-key-'+kind+'\\{background:#([a-f0-9]{6})'))?.[1];
  assert.ok(hex&&color,kind+' has a field sample and swatch');
  const expected=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)),actual=color.match(/[\d.]+/g).map(Number);
  actual.forEach((channel,i)=>assert.ok(Math.abs(channel-expected[i])<1e-10,kind+' channel '+i));
 }
});
test('signed near-canvas reading reverses after two quarter cycles and returns after four',async()=>{
 for(const [x,y,time,separation,wavelength] of [[0,0,0,100,32],[8,0,2.5,100,32],[-19,42,7.3,180,15]]){
  const h=await setup(`?experiment=wave&wavelength=${wavelength}&separation=${separation}&at=v1,${x},${y},${time}`);
  const initial=reading(h),url=location.href,geometry=h.el('wave-probe-reading').textContent;
  for(let n=0;n<5;n++){
   expectReading(h,waveComponents(x,y,(time+n*Math.PI/6)*3,separation,wavelength).combined);
   assert.equal(h.el('wave-key').hidden,false);assert.equal(h.frames.size,0);
   assert.equal(location.href,url);assert.equal(h.el('wave-probe-reading').textContent,geometry);
   if(n<4)click(h);
  }
  assert.equal(reading(h),initial);
 }
});
test('instantaneous darkness and persistent cancellation remain distinct, with no negative zero',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,'+(50/32*2*Math.PI)/3);
 expectReading(h,0);assert.match(h.el('wave-probe-reading').textContent,/1.00$/);
 for(const value of [-1,0,1,0]){click(h);expectReading(h,value);assert.doesNotMatch(reading(h),/-0\.00/);}
 click(h,'guide-start');
 for(let i=0;i<8;i++){expectReading(h,0);assert.match(h.el('wave-probe-reading').textContent,/0.00$/);click(h);}
});
test('running readings update quietly and unchanged redraws do not replace their text',async()=>{
 const h=await setup('?experiment=wave','',false),writes=track(h.el('wave-instant-reading')),announcements=track(h.el('announcement'));
 h.tick(0);for(let i=1;i<=120;i++)h.tick(i*1000/60);
 assert.ok(writes()>50);assert.equal(announcements(),0);assert.equal(h.frames.size,1);
 click(h,'pause');const count=writes();assert.equal(announcements(),1);
 h.resize(600,414);h.resize(600,414);assert.equal(writes(),count);
 assert.equal(h.frames.size,0);assert.equal(announcements(),1);
});
test('the key is Wave-only through repeated world round trips and history changes',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5');click(h);
 const before=reading(h),metrics=h.el('metrics').textContent;
 for(let round=0;round<2;round++)for(const index of [0,1,3,4]){
  h.tabs[index].handlers.click();assert.equal(h.el('wave-key').hidden,true);
  click(h);h.tabs[2].handlers.click();assert.equal(h.el('wave-key').hidden,false);
  assert.equal(reading(h),before);assert.equal(h.el('metrics').textContent,metrics);
 }
 h.navigate('?experiment=life');assert.equal(h.el('wave-key').hidden,true);
 h.navigate('?experiment=wave&at=v1,0,0,9');assert.equal(h.el('wave-key').hidden,false);
 expectReading(h,waveComponents(0,0,27,100,32).combined);
});
test('probe movement, parameter edits, presets, reset and guide refresh the same signed value',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,0');
 h.key('ArrowRight');expectReading(h,waveComponents(2,0,0,100,32).combined);
 click(h,'wave-up');expectReading(h,waveComponents(2,-2,0,100,32).combined);
 h.el('wavelength').handlers.input({target:{value:'70'}});expectReading(h,waveComponents(2,-2,0,100,70).combined);
 h.el('separation').handlers.input({target:{value:'180'}});expectReading(h,waveComponents(2,-2,0,180,70).combined);
 click(h,'reset');expectReading(h,waveComponents(0,0,0,180,70).combined);
 (h.el('preset-select').handlers.change({target:{value:'wide'}}),h.el('load-preset').handlers.click());expectReading(h,waveComponents(0,0,0,150,65).combined);
 click(h,'guide-start');expectReading(h,0);assert.equal(h.el('wave-key').hidden,false);
});
test('shared readings reproduce exactly and a running tab return does not catch up time',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5');click(h);
 await click(h,'share');const url=new URL(h.el('share-link').value),checkpoint=reading(h);
 click(h);assert.equal(h.el('share-link').value,url.href);assert.notEqual(reading(h),checkpoint);
 const restored=await setup(url.search,url.hash,false);assert.equal(reading(restored),checkpoint);assert.equal(restored.frames.size,0);
 click(restored,'pause');restored.tick(1000);restored.tick(1050);const running=reading(restored);
 restored.tabs[0].handlers.click();restored.tick(3000);restored.tick(3050);restored.tabs[2].handlers.click();
 assert.equal(reading(restored),running);assert.equal(restored.frames.size,1);restored.tick(9000);assert.equal(reading(restored),running);
 restored.tick(9050);expectReading(restored,waveComponents(8,12,(2.5+Math.PI/6+.1)*3,100,32).combined);
 restored.motion.change({matches:true});assert.equal(restored.frames.size,0);assert.equal(restored.el('wave-key').hidden,false);
});
