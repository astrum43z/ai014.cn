import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';
const click=(h,id)=>h.el(id).handlers.click();
const plot=h=>['history-line','history-current'].map(id=>[id,{...h.el(id).attributes}]);
const readings=h=>['metrics','history-caption','history-maximum','history-start','history-end','life-turnover','life-rewind-status'].map(id=>h.el(id).textContent);
function activity(h,action){
 let maps=0,writes=0;const original=Array.prototype.map,restores=[];
 for(const id of ['history-line','history-current']){const el=h.el(id),set=el.setAttribute;el.setAttribute=function(...args){writes++;return set.apply(this,args);};restores.push(()=>el.setAttribute=set);}
 try{Array.prototype.map=function(...args){if(this[0]?.key?.length===1536&&Object.hasOwn(this[0],'generation'))maps++;return original.apply(this,args);};action();return {maps,writes};}
 finally{Array.prototype.map=original;restores.forEach(restore=>restore());}
}
test('unchanged full Life history redraws do not remap history or rewrite plot attributes',async()=>{
 const h=await setup('?experiment=life');for(let i=0;i<119;i++)click(h,'step');const before=readings(h),chart=plot(h),drawing=h.drawing(),message=h.el('announcement').textContent;h.el('life-back').focus();
 assert.deepEqual(activity(h,()=>{for(let i=0;i<120;i++)h.resize(600,414);}),{maps:0,writes:0});
 assert.deepEqual(readings(h),before);assert.deepEqual(plot(h),chart);assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('announcement').textContent,message);assert.equal(document.activeElement,h.el('life-back'));
});

import {readFileSync} from 'node:fs';
import {createLifeHistoryView} from '../life-history-view.js';
import {createLifeHistoryRecorder} from '../life-history.js';
import {lifeStep} from '../simulations.js';
function oracle(history,generation){
 const first=history[0],last=history.at(-1),previous=history.at(-2);let low=Infinity,high=-Infinity;
 for(const entry of history){low=Math.min(low,entry.count);high=Math.max(high,entry.count);}
 const scaleMax=Math.max(1,high),points=[];
 for(const entry of history)points.push([(entry.generation-first.generation)/Math.max(1,last.generation-first.generation)*600,64-entry.count/scaleMax*56]);
 let turnover=null;
 if(previous?.generation===generation-1){
  const before=new Set([...previous.key].flatMap((v,i)=>v==='1'?[i]:[])),after=new Set([...last.key].flatMap((v,i)=>v==='1'?[i]:[]));
  const survived=[...before].filter(i=>after.has(i)).length;turnover={born:after.size-survived,died:before.size-survived,survived};
 }
 return {low,high,scaleMax,points:points.map(p=>p.join(',')).join(' '),x:points.at(-1)[0],y:points.at(-1)[1],turnover};
}
const choose=(h,value)=>{h.el('preset-select').handlers.change({target:{value}});click(h,'load-preset');};
const saved=h=>({readings:readings(h),plot:plot(h),drawing:h.drawing(),url:location.href,notes:h.el('field-notes-list').innerHTML});
test('history geometry and turnover match independent observations through growth, trimming and rewind',()=>{
 for(const seed of [0,1,14,99]){
  const read=createLifeHistoryView(),record=createLifeHistoryRecorder(),history=[];let cells=Uint8Array.from({length:1536},(_,i)=>seed&&((i*37+seed*19)%101<29)?1:0);
  for(let generation=0;generation<245;generation++){
   record(cells,generation,history);const before=structuredClone(history),view=read(history,generation);assert.deepEqual(view,oracle(history,generation));assert.equal(read(history,generation),view);assert.deepEqual(history,before);cells=lifeStep(cells,48,32);
  }
  while(history.length>1){history.pop();const generation=history.at(-1).generation;assert.deepEqual(read(history,generation),oracle(history,generation));}
 }
});
test('unchanged history reads reuse a frozen one-entry result without recounting cells or history samples',()=>{
 const read=createLifeHistoryView();let accesses=0;
 const entry=(generation,key)=>({generation,get key(){accesses++;return key;},get count(){accesses++;return [...key].filter(x=>x==='1').length;}});
 const history=Array.from({length:120},(_,i)=>entry(i,String(i%2).repeat(1536)));const view=read(history,119);assert.ok(accesses>1536);assert.deepEqual(view.turnover,{born:1536,died:0,survived:0});assert.ok(Object.isFrozen(view));assert.ok(Object.isFrozen(view.turnover));
 accesses=0;for(let i=0;i<120;i++)assert.equal(read(history,119),view);assert.equal(accesses,0);assert.throws(()=>view.turnover.born=42,TypeError);assert.throws(()=>view.points='stale',TypeError);
 const other=history.slice();assert.notEqual(read(other,119),view);assert.notEqual(read(history,119),view,'returning replaces the one cached entry rather than retaining all histories');
});
test('append, trim, rewind, entry replacement and generation discontinuities invalidate the derived view',()=>{
 const read=createLifeHistoryView();let history=Array.from({length:120},(_,generation)=>({generation,key:'0'.repeat(1536),count:0})),generation=119,last=read(history,generation);
 const verify=()=>{const next=read(history,generation);assert.notEqual(next,last);assert.deepEqual(next,oracle(history,generation));last=next;};
 history.push({generation:120,key:'1'.repeat(1536),count:1536});generation=120;verify();history.shift();verify();
 history.pop();generation=119;verify();history[0]={...history[0],count:5};verify();history[history.length-2]={...history.at(-2),generation:117};verify();assert.equal(last.turnover,null);
 history[history.length-1]={...history.at(-1),count:2};verify();generation=120;verify();assert.equal(last.turnover,null);history=history.slice();verify();
 history=[{generation:2,key:'0'.repeat(1536),count:0},{generation:7,key:'0'.repeat(1536),count:0}];generation=7;verify();assert.equal(last.turnover,null);assert.equal(last.scaleMax,1);
});
test('cursor, focus, parameter and display redraws refresh the canvas without touching unchanged history geometry',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');click(h,'step');const before=readings(h),chart=plot(h),original=h.drawing();
 assert.deepEqual(activity(h,()=>{
  click(h,'life-right');click(h,'life-left');h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();
  h.el('rate').handlers.input({target:{value:'20'}});h.el('density').handlers.input({target:{value:'60'}});
  for(const [width,height] of [[233,240],[334.5,260.25],[0,0],[600,414]])h.resize(width,height);
  h.setDpr(2);h.setDpr(3);h.setDpr(1);h.loseContext();h.restoreContext();
 }),{maps:0,writes:0});assert.deepEqual(readings(h),before);assert.deepEqual(plot(h),chart);assert.deepEqual(h.drawing(),original);
});
test('changed or missing SVG attributes are repaired from the current view on the next redraw',async()=>{
 const h=await setup('?experiment=life');click(h,'step');const chart=plot(h);
 h.el('history-line').attributes.points='bad';delete h.el('history-current').attributes.cx;h.el('history-current').attributes.cy='bad';
 assert.deepEqual(activity(h,()=>h.resize(600,414)),{maps:0,writes:3});assert.deepEqual(plot(h),chart);assert.deepEqual(activity(h,()=>h.resize(600,414)),{maps:0,writes:0});
});
test('rewind, comparison return, edit undo and clear recovery restore the exact plot, turnover and canvas',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');click(h,'step');click(h,'step');const original=saved(h);
 click(h,'step');click(h,'life-back');assert.deepEqual(saved(h),original);
 click(h,'life-test');click(h,'life-return');assert.deepEqual(saved(h),original);
 h.key('Enter');assert.match(h.el('life-turnover').textContent,/本段还没有/);h.key('z',{ctrlKey:true});assert.deepEqual(saved(h),original);
 click(h,'clear');assert.match(h.el('life-turnover').textContent,/本段还没有/);click(h,'life-undo-clear');assert.deepEqual(saved(h),original);
 for(const mode of ['orbit','wave','fractal','walk']){click(h,'tab-'+mode);click(h,'tab-life');assert.deepEqual(saved(h),original);}
 assert.deepEqual(activity(h,()=>h.resize(600,414)),{maps:0,writes:0});
});
test('animation updates actual generations while visibility and reduced motion retain the established cadence',async()=>{
 const h=await setup('?experiment=life', '', false);choose(h,'blinker');h.tick(0);for(let i=1;i<=20;i++)h.tick(i*50);assert.match(h.el('metrics').textContent,/第 8 代/);const before=readings(h),chart=plot(h),message=h.el('announcement').textContent;
 h.setHidden(true);assert.equal(h.frames.size,0);h.setHidden(false);h.tick(90000);assert.deepEqual(readings(h),before);h.setVisible(false);assert.equal(h.frames.size,0);h.setVisible(true);h.tick(180000);assert.deepEqual(plot(h),chart);assert.equal(h.el('announcement').textContent,message);
 h.motion.change({matches:true});assert.equal(h.frames.size,0);assert.deepEqual(activity(h,()=>h.resize(600,414)),{maps:0,writes:0});click(h,'step');assert.match(h.el('metrics').textContent,/第 9 代/);assert.match(h.el('life-turnover').textContent,/第 8 → 9 代/);
});
test('history reads preserve parameter links, discoveries, pending sharing and other worlds',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');for(const [x,y] of [[2,2],[3,2],[2,3],[3,3]])h.el('canvas').handlers.click({clientX:(x+.5)*600/48,clientY:(y+.5)*414/32});
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('field-notes-list').innerHTML;click(h,'step');let resolve;Object.defineProperty(globalThis,'navigator',{value:{clipboard:{writeText:()=>new Promise(r=>resolve=r)}},configurable:true});const sharing=click(h,'share'),url=location.href;const chart=plot(h);click(h,'life-right');h.resize(233,240);resolve();await sharing;assert.equal(location.href,url);assert.deepEqual(plot(h),chart);assert.equal(h.el('field-notes-list').innerHTML,notes);
 click(h,'tab-fractal');h.el('step').handlers.keydown({key:'Enter',repeat:true,preventDefault(){assert.fail('intentional batch suppressed');}});click(h,'step');assert.match(h.el('metrics').textContent,/400 个点/);click(h,'tab-walk');h.key('ArrowRight',{repeat:true});assert.match(h.el('metrics').textContent,/32 步/);click(h,'tab-life');assert.deepEqual(plot(h),chart);assert.equal(h.el('field-notes-list').innerHTML,notes);
});
test('fresh app entry imports the history view and keeps existing controls and quiet semantics',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(html,/app\.js\?[^"\n]+&amp;history=read-once-1/);assert.match(app,/import \{createLifeHistoryView\} from '\.\/life-history-view\.js'/);assert.match(app,/const readLifeHistory=createLifeHistoryView\(\)/);assert.match(html,/id="life-turnover" aria-live="off"/);assert.match(html,/id="history-caption" aria-live="off"/);
});
