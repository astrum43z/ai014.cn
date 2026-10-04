import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const parameters={orbit:[['gravity',80,30,160],['speed',100,30,150]],life:[['rate',8,1,20],['density',30,10,60]],wave:[['wavelength',32,15,70],['separation',100,20,180]],fractal:[['jump',50,35,70],['seed',14,1,99]],walk:[['bias',0,0,25],['seed',14,1,99]]};
function snapshot(h){
 const callbacks=[],downloads=[];h.el('canvas').toBlob=callback=>callbacks.push(callback);
 h.el('generated').click=()=>downloads.push(h.el('generated').download);
 return {downloads,finish(success){callbacks.shift()(success?new Blob(['png']):null);}};
}
const state=h=>({drawing:h.drawing(),metrics:h.el('metrics').textContent,href:location.href,frames:[...h.frames.keys()],notes:h.el('field-notes-list').innerHTML,focus:document.activeElement,draws:h.drawCount()});

for(const [world,sliders] of Object.entries(parameters))for(const [id,initial] of sliders)for(const success of [true,false])test(`${world} ${id}: native change supersedes an earlier PNG ${success?'success':'failure'} without adding range announcements`,async()=>{
 const h=await setup('?experiment='+world,'#canvas',false),s=snapshot(h);
 click(h,'save');const old=h.el('announcement').textContent;
 h.el(id).focus();input(h,id,initial+1);
 assert.equal(h.el(id).value,String(initial+1));assert.match(location.search,new RegExp(id+'='+(initial+1)));
 const latest=h.el('announcement').textContent,before=state(h);
 if(!['fractal','walk'].includes(world))assert.equal(latest,old,'native range value remains its own feedback');
 s.finish(success);
 assert.equal(h.el('announcement').textContent,latest,'an older save must not take over native parameter feedback');
 assert.deepEqual(state(h),before);assert.equal(h.el('save-status').hidden,false);
 assert.match(h.el('save-status').textContent,success?/已发起.*PNG.*下载列表/:/失败.*重试/);
 assert.equal(h.el('save').getAttribute('aria-busy'),'false');assert.equal(h.el('save').getAttribute('aria-disabled'),'false');
 assert.deepEqual(s.downloads,success?[`small-worlds-${world}.png`]:[]);
 // A fresh Save after the edit still owns its result, including retries.
 click(h,'save');s.finish(!success);assert.equal(h.el('announcement').textContent,h.el('save-status').textContent);
});

for(const [world,sliders] of Object.entries(parameters))for(const [id,initial,min,max] of sliders)test(`${world} ${id}: same, invalid and clamped no-op inputs keep an accepted PNG eligible`,async()=>{
 const h=await setup('?experiment='+world),s=snapshot(h);
 for(const value of [initial,min,max]){
  input(h,id,value);click(h,'save');const before=state(h);
  for(const noOp of [value,NaN,Infinity,-Infinity,'invalid',...(value===min?[min-1]:value===max?[max+1]:[])])input(h,id,noOp);
  assert.deepEqual(state(h),before);s.finish(false);
  assert.equal(h.el('announcement').textContent,h.el('save-status').textContent);
 }
});

for(const world of Object.keys(parameters))test(`${world}: nudges and ranges agree while obsolete other-world controls are inert`,async()=>{
 const [id,initial]=parameters[world][0];let h=await setup('?experiment='+world),s=snapshot(h);
 click(h,'save');h.el('increase-'+id).focus();click(h,'increase-'+id);
 const next=h.el('announcement').textContent;assert.match(next,new RegExp('：'+(initial+1)));
 s.finish(false);assert.equal(h.el('announcement').textContent,next);
 const oldInput=h.el(id).handlers.input;click(h,'tab-'+(world==='wave'?'orbit':'wave'));
 s=snapshot(h);click(h,'save');const before=state(h);oldInput({target:{value:initial+2}});
 assert.deepEqual(state(h),before);s.finish(false);assert.equal(h.el('announcement').textContent,h.el('save-status').textContent);
});

test('only a real parameter change owns feedback during repeated input and quiet redraws',async()=>{
 const h=await setup('?experiment=wave'),s=snapshot(h);click(h,'save');
 input(h,'wavelength',33);input(h,'wavelength',34);input(h,'separation',99);
 const latest=h.el('announcement').textContent;
 h.resize(233.5,240);h.setDpr(2);s.finish(false);assert.equal(h.el('announcement').textContent,latest);
 click(h,'save');input(h,'wavelength',34);h.resize(600,414);h.setDpr(1);
 s.finish(true);assert.equal(h.el('announcement').textContent,h.el('save-status').textContent);
});

test('pending copy and PNG settle independently after a native parameter change',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');let copied;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(resolve=>{copied=resolve;})}}});
 try{
  const h=await setup('?experiment=wave&at=v1,7.5,0,2.5'),s=snapshot(h);
  click(h,'save');const pending=click(h,'observation-copy');input(h,'wavelength',33);
  const latest=h.el('announcement').textContent,before=state(h);
  copied();await pending;s.finish(false);
  assert.equal(h.el('announcement').textContent,latest);assert.deepEqual(state(h),before);
  assert.equal(h.el('share-status').hidden,true);assert.equal(h.el('share-link').hidden,true);
  assert.doesNotMatch(location.search,/at=/);assert.match(h.el('save-status').textContent,/失败.*重试/);
 }finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
});
