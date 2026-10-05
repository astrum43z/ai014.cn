import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup as setupHarness} from './life-challenge-harness.js';
// These checks inspect visible displacement bars; open their native drawer.
async function setup(...args){const h=await setupHarness(...args);h.el('instruments').open=true;h.el('instruments').handlers.toggle();return h;}
import {waveComponents} from '../simulations.js';

const quarter=Math.PI/6;
const click=(h,id='step')=>h.el(id).handlers.click();
const signed=h=>['left','right','combined'].map(key=>{
 const bar=h.el('wave-bar-'+key),width=Number(bar.attributes.width)/100;
 return Number(bar.attributes.x)<100?-width:width;
});
const close=(actual,expected,tolerance=1e-11)=>actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<tolerance,`${v} ≈ ${expected[i]}`));
const expected=(x,y,time,separation=100,wavelength=32)=>{
 const p=waveComponents(x,y,time*3,separation,wavelength);return [p.left,p.right,p.combined];
};
const geometry=h=>['wave-probe-reading','wave-distances','wave-difference','wave-envelope','observation-a','observation-b','observation-c'].map(id=>h.el(id).textContent);

test('wave single-step advances a quarter cycle, reverses after two and returns after four',async()=>{
 for(const [x,y,time,separation,wavelength] of [[0,0,0,100,32],[8,0,2.5,100,32],[-19,42,7.3,180,15],[300,-130,1e6,20,70]]){
  const h=await setup(`?experiment=wave&wavelength=${wavelength}&separation=${separation}&at=v1,${x},${y},${time}`);
  const before=signed(h),fixed=geometry(h),url=location.href,writes=h.writes();
  let next=time;
  for(let i=1;i<=4;i++){
   click(h);next+=quarter;close(signed(h),expected(x,y,next,separation,wavelength));
   assert.equal(h.el('status').textContent,'已暂停');assert.equal(h.frames.size,0);
   assert.deepEqual(geometry(h),fixed);assert.equal(location.href,url);assert.equal(h.writes(),writes);
   assert.match(h.el('announcement').textContent,/已暂停，推进四分之一周期；/);
   if(i===2)close(signed(h),before.map(v=>-v),1e-8);
  }
  close(signed(h),before,1e-8);
 }
});

test('quarter steps distinguish a central dark instant from persistent cancellation',async()=>{
 const darkTime=(50/32*2*Math.PI)/3;
 const h=await setup(`?experiment=wave&at=v1,0,0,${darkTime}`);
 assert.equal(h.el('wave-value-combined').textContent,'0.00');assert.match(h.el('wave-envelope').textContent,/1.00$/);
 click(h);assert.equal(h.el('wave-value-combined').textContent,'-1.00');
 click(h);assert.equal(h.el('wave-value-combined').textContent,'0.00');
 click(h);assert.equal(h.el('wave-value-combined').textContent,'+1.00');
 click(h);assert.equal(h.el('wave-value-combined').textContent,'0.00');
 click(h,'guide-start');
 for(let i=0;i<8;i++){
  assert.equal(h.el('wave-value-combined').textContent,'0.00');assert.match(h.el('wave-envelope').textContent,/0.00$/);click(h);
 }
});

test('stepping a running wave pauses at its current time without changing animation cadence',async()=>{
 const h=await setup('?experiment=wave','',false);
 h.tick(0);h.tick(50);h.el('step').focus();click(h);
 close(signed(h),expected(0,0,.05+quarter));assert.equal(h.frames.size,0);assert.equal(document.activeElement,h.el('step'));
 click(h,'pause');const message=h.el('announcement').textContent;
 h.tick(2000);h.tick(2050);close(signed(h),expected(0,0,.1+quarter));
 assert.equal(h.el('announcement').textContent,message,'animation stays quiet');
 h.motion.change({matches:true});assert.equal(h.frames.size,0);
 click(h);close(signed(h),expected(0,0,.1+quarter*2));assert.equal(h.frames.size,0);
});

test('wave observation links retain a fixed checkpoint and reproduce the new step exactly',async()=>{
 let h=await setup('?experiment=wave&at=v1,8,12,2.5','#canvas');
 const original=location.href;click(h);assert.equal(location.href,original);
 await click(h,'share');const url=new URL(h.el('share-link').value),saved=signed(h);
 assert.equal(url.searchParams.get('at'),`v1,8,12,${2.5+quarter}`);assert.equal(url.hash,'#canvas');
 click(h);const next=signed(h);assert.equal(h.el('share-link').value,url.href);assert.equal(location.href,url.href);
 h=await setup(url.search,url.hash,false);close(signed(h),saved);assert.equal(h.frames.size,0);
 click(h);close(signed(h),next);
 h.navigate('?experiment=wave&at=v1,8,12,9');close(signed(h),expected(8,12,9));
 click(h);close(signed(h),expected(8,12,9+quarter));
});

test('other worlds keep their own step sizes and names after leaving and returning to waves',async()=>{
 const h=await setup('?experiment=wave');click(h);const wave=signed(h);
 for(const [index,label,reading] of [[0,'前进一步 +',/t \+ 0.1 s/],[1,'下一代 +1',/第 1 代/],[3,'增加 100 点 +',/400/],[4,'前进 16 步 +',/32 步/]]){
  h.tabs[index].handlers.click();assert.equal(h.el('step').textContent,label);assert.equal(h.el('step').attributes['aria-label'],label);
  assert.equal(h.el('step').attributes['aria-describedby'],'');assert.equal(h.el('wave-touch').hidden,true);
  click(h);assert.match(h.el('metrics').textContent,reading);
  h.tabs[2].handlers.click();close(signed(h),wave);assert.equal(h.el('step').textContent,'推进 ¼ 周期 +');
  assert.equal(h.el('step').attributes['aria-label'],'推进四分之一周期并暂停');assert.equal(h.el('step').attributes['aria-describedby'],'wave-step-help');
 }
});

test('parameters, resets, presets, guides and resize continue from the right wave clock',async()=>{
 const h=await setup('?experiment=wave');click(h);
 h.el('wavelength').handlers.input({target:{value:'70'}});h.el('separation').handlers.input({target:{value:'180'}});
 click(h);close(signed(h),expected(0,0,quarter*2,180,70));
 const before=signed(h);h.resize(295,260);close(signed(h),before);
 click(h,'reset');close(signed(h),expected(0,0,0,180,70));click(h);close(signed(h),expected(0,0,quarter,180,70));
 (h.el('preset-select').handlers.change({target:{value:'wide'}}),h.el('load-preset').handlers.click());click(h);close(signed(h),expected(0,0,quarter,150,65));
 click(h,'guide-start');click(h);close(signed(h),expected(8,0,quarter));
});

test('stepping does not record a discovery or replace an earned note',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');click(h,'mission-check');
 for(let i=0;i<4;i++)click(h);assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'wave-home');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const note=h.el('field-notes-list').innerHTML;
 for(let i=0;i<4;i++)click(h);assert.equal(h.el('field-notes-list').innerHTML,note);
});

test('cycle guidance stays quiet beside movement and exact-position controls',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.equal((html.match(/id="wave-step-help"/g)||[]).length,1);
 const group=html.slice(html.indexOf('<div id="wave-touch"'),html.indexOf('<div id="fractal-touch"'));
 assert.match(group,/<small id="wave-step-help">/);assert.match(group,/保持参数与探针不变/);
 assert.match(group,/2 次后正负位移反转，4 次后回到相同波形/);
 assert.equal((group.match(/<button/g)||[]).length,6,'four arrows, explicit coordinate filling and exact positioning');
 assert.equal((group.match(/id="wave-position"/g)||[]).length,1);
 assert.doesNotMatch(group,/aria-live="polite"|role="status"/);
});
