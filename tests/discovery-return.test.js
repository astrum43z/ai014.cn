import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';
const modes=['orbit','life','wave','fractal','walk'];
const previous={orbit:'walk',life:'wave',wave:'orbit',fractal:'life',walk:'fractal'};
const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const select=(h,mode)=>click(h,'tab-'+mode);
function partial(h,mode){
 select(h,mode);click(h,'mission-start');
 if(mode==='life'){
  for(const id of ['life-toggle','life-right','life-toggle'])click(h,id);
 }else{
  click(h,'mission-check');
  if(mode==='orbit'){input(h,'gravity',40);for(let i=0;i<10;i++)click(h,'step');}
  if(mode==='wave'){click(h,'wave-home');click(h,'step');}
  if(mode==='fractal'){click(h,'fractal-1000');click(h,'mission-check');input(h,'seed',15);click(h,'fractal-1000');}
  if(mode==='walk')click(h,'walk-64');
 }
}
function finish(h,mode){
 if(mode==='life')for(const id of ['life-down','life-toggle','life-left','life-toggle'])click(h,id);
 if(mode==='orbit')for(let i=0;i<60;i++)click(h,'step');
 click(h,'mission-check');assert.equal(h.el('mission-state').textContent,'已留下发现');
}
function complete(h,mode){partial(h,mode);finish(h,mode);}
const snapshot=h=>({metrics:h.el('metrics').textContent,readings:['a','b','c'].map(k=>h.el('observation-'+k).textContent),status:h.el('status').textContent,drawing:h.drawing(),url:location.href,checkpoint:h.el('share-link').value,shareHidden:h.el('share-link').hidden,instruction:h.el('mission-instruction').textContent,feedback:h.el('mission-result').textContent,mission:h.el('mission-state').textContent});

test('homepage resumes first comparison and current sample, including repeated same-world entry',async()=>{
 const h=await setup('?experiment=life','#home');click(h,'journey-start');
 click(h,'fractal-1000');click(h,'mission-check');input(h,'seed',15);click(h,'fractal-1000');
 await h.el('share').handlers.click();click(h,'fractal-forward');const before=snapshot(h);
 assert.match(h.el('journey-start').innerHTML,/继续探索：随机长出秩序/);
 assert.match(h.el('journey-replaces').textContent,/保留当前画布、参数与探索记录.*状态保持不变/);
 for(let i=0;i<3;i++){click(h,'journey-start');assert.deepEqual(snapshot(h),before);assert.equal(document.activeElement.id,'mission-title');}
 select(h,'life');click(h,'life-toggle');const life=snapshot(h);
 click(h,'journey-start');assert.deepEqual(snapshot(h),before);assert.equal(document.activeElement.id,'mission-title');
 click(h,'fractal-back');click(h,'mission-check');assert.equal(h.el('mission-state').textContent,'已留下发现');
 select(h,'life');assert.deepEqual(snapshot(h),life,'outgoing world retains its own model');
});

for(const mode of modes)test(mode+': next discovery resumes active model, evidence and fixed checkpoint',async()=>{
 const h=await setup('?experiment='+mode,'#mission');partial(h,mode);
 await h.el('share').handlers.click();const before=snapshot(h);
 complete(h,previous[mode]);
 assert.equal(h.el('mission-next').hidden,false);assert.equal(h.el('mission-next-help').hidden,false);
 assert.match(h.el('mission-next').textContent,/^继续探索 · /);
 assert.match(h.el('mission-next-help').textContent,/接着上次的探索；保留当前/);
 click(h,'mission-next');assert.deepEqual(snapshot(h),before);assert.equal(document.activeElement.id,'mission-title');
 assert.equal(h.frames.size,0);finish(h,mode);assert.equal(h.el('passport-count').textContent,'本次发现 2 / 5');
});

for(const mode of modes)test(mode+': completed return keeps historical feedback and newer canvas',async()=>{
 const h=await setup('?experiment='+mode,'#mission');complete(h,mode);click(h,'step');
 await h.el('share').handlers.click();click(h,'step');const before=snapshot(h);
 complete(h,previous[mode]);const notes=h.el('field-notes-list').innerHTML;
 assert.match(h.el('mission-next').textContent,/^回看发现 · /);
 assert.match(h.el('mission-next-help').textContent,/回看已完成的发现；保留当前/);
 click(h,'mission-next');assert.deepEqual(snapshot(h),before);assert.equal(document.activeElement.id,'mission-result');
 assert.equal(h.el('mission-result').hidden,false);assert.equal(h.el('field-notes-list').innerHTML,notes);
 assert.equal(h.el('mission-check').hidden,true);assert.equal(h.el('passport-count').textContent,'本次发现 2 / 5');
 if(mode==='fractal'){
  assert.match(h.el('journey-start').innerHTML,/回看发现：/);
  click(h,'journey-start');assert.deepEqual(snapshot(h),before);assert.equal(document.activeElement.id,'mission-result');
 }
});

test('unstarted next destination still gets its disclosed paused start',async()=>{
 const h=await setup('?experiment=life','',false);click(h,'clear');click(h,'life-toggle');
 complete(h,'wave');assert.match(h.el('mission-next').textContent,/^下一个发现 · /);
 assert.match(h.el('mission-next-help').textContent,/载入生命的形状.*暂停.*替换/);
 click(h,'mission-next');assert.match(h.el('metrics').textContent,/第 0 代 · 0 个活格子/);
 assert.equal(h.el('mission-state').textContent,'探索中');assert.equal(h.frames.size,0);assert.equal(document.activeElement.id,'mission-title');
 assert.equal(h.el('mission-next-help').hidden,true);
});

test('historical note alone does not resurrect a mission invalidated by a real URL load',async()=>{
 const h=await setup('?experiment=fractal','#home');complete(h,'fractal');const note=h.el('field-notes-list').innerHTML;
 h.navigate('?experiment=fractal&jump=65&seed=9&at=v1,888#home');assert.equal(h.el('mission-state').textContent,'可选探索');
 assert.match(h.el('journey-start').innerHTML,/先试一个：/);assert.match(h.el('journey-replaces').textContent,/替换/);
 click(h,'journey-start');assert.match(h.el('metrics').textContent,/300 个点.*50%.*14/);assert.equal(h.el('mission-result').hidden,true);
 assert.equal(h.el('field-notes-list').innerHTML,note);assert.equal(h.frames.size,0);
});

test('explicit restart resets evidence and model while anchor-only navigation keeps them',async()=>{
 const h=await setup('?experiment=fractal');partial(h,'fractal');const before=snapshot(h);
 h.navigate(location.search+'#home');click(h,'journey-start');assert.deepEqual(snapshot(h),{...before,url:location.href});
 click(h,'mission-start');assert.match(h.el('metrics').textContent,/300 个点.*种子 14/);
 assert.equal(h.el('mission-result').hidden,true);assert.match(h.el('mission-instruction').textContent,/先点画布/);
 assert.match(h.el('journey-start').innerHTML,/继续探索：/);assert.equal(h.frames.size,0);
});

test('returning through the shortcut keeps running state, one frame chain and no catch-up',async()=>{
 const h=await setup('?experiment=fractal');click(h,'journey-start');click(h,'pause');h.tick(0);h.tick(50);
 const before=h.el('metrics').textContent;select(h,'life');click(h,'life-toggle');const life=snapshot(h);
 click(h,'journey-start');assert.equal(h.el('status').textContent,'运行中');assert.equal(h.frames.size,1);
 assert.equal(h.el('metrics').textContent,before);h.tick(90000);assert.equal(h.el('metrics').textContent,before);
 for(let i=0;i<5;i++)click(h,'journey-start');assert.equal(h.frames.size,1);assert.equal(h.el('metrics').textContent,before);
 select(h,'life');assert.deepEqual(snapshot(h),life);h.motion.matches=true;h.motion.change({matches:true});
 click(h,'journey-start');assert.equal(h.el('status').textContent,'已暂停');assert.equal(h.frames.size,0);
});

test('refresh clears shortcut continuation and structural descriptions name their actions',async()=>{
 let h=await setup('?experiment=fractal');complete(h,'fractal');h=await setup('?experiment=fractal');
 assert.match(h.el('journey-start').innerHTML,/先试一个：/);assert.equal(h.el('passport-count').textContent,'本次发现 0 / 5');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<button id="journey-start" aria-describedby="journey-replaces">/);
 assert.match(html,/<button id="mission-next" aria-describedby="mission-next-help" hidden>/);
 assert.match(html,/<small id="mission-next-help" hidden><\/small>/);
 assert.match(html,/id="mission-start" aria-describedby="mission-replaces"/);
 assert.match(html,/id="mission-title" tabindex="-1"/);assert.match(html,/id="mission-result" tabindex="-1" aria-live="off"/);
});

test('return places active instructions or completed result in view before moving focus',async()=>{
 const h=await setup('?experiment=fractal');partial(h,'fractal');const events=[];
 h.el('mission').scrollIntoView=options=>events.push(['instructions',options]);
 h.el('mission-result').scrollIntoView=options=>events.push(['result',options]);
 h.el('mission-title').focus=options=>events.push(['title-focus',options]);
 h.el('mission-result').focus=options=>events.push(['result-focus',options]);
 click(h,'journey-start');assert.deepEqual(events,[['instructions',{block:'start'}],['title-focus',{preventScroll:true}]]);
 finish(h,'fractal');events.length=0;click(h,'journey-start');
 assert.deepEqual(events,[['result',{block:'center'}],['result-focus',{preventScroll:true}]]);
});
