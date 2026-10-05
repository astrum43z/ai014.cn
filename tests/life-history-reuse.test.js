import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLifeHistoryRecorder} from '../life-history.js';
import {lifeStep} from '../simulations.js';
import {setup} from './life-challenge-harness.js';
const click=(h,id)=>h.el(id).handlers.click();
function legacy(cells,generation,history){
 if(history.at(-1)?.generation===generation)history.pop();
 const key=[...cells].join(''),count=[...cells].filter(Boolean).length;
 const match=[...history].reverse().find(entry=>entry.generation<generation&&entry.key===key);
 const period=match?generation-match.generation:null;
 history.push({generation,key,count});if(history.length>120)history.shift();return {count,period};
}
function work(action){
 const from=Array.from,reduce=Uint8Array.prototype.reduce;let serializations=0,populations=0;
 try{Array.from=function(value,...args){if(value instanceof Uint8Array&&value.length===1536)serializations++;return from.call(this,value,...args);};Uint8Array.prototype.reduce=function(...args){if(this.length===1536)populations++;return reduce.apply(this,args);};action();return {serializations,populations};}finally{Array.from=from;Uint8Array.prototype.reduce=reduce;}
}
const historyIds=['metrics','observation-a','observation-b','observation-c','history-caption','history-maximum','history-start','history-end','life-turnover','life-rewind-status'];
const readings=h=>historyIds.map(id=>[id,h.el(id).textContent]);
function plot(h){return ['history-line','history-current'].map(id=>[id,{...h.el(id).attributes}]);}
function preset(h,value){h.el('preset-select').handlers.change({target:{value}});click(h,'load-preset');}

test('recorder matches the legacy history and repeat readings through 245 generations and redraws',()=>{
 for(const seed of [0,1,14,42,99]){
  const record=createLifeHistoryRecorder();let cells=Uint8Array.from({length:1536},(_,i)=>seed&&((i*37+seed*19)%101<29)?1:0),a=[],b=[];
  for(let generation=0;generation<245;generation++){
   for(let redraw=0;redraw<3;redraw++){assert.deepEqual(record(cells,generation,a),legacy(cells,generation,b));assert.deepEqual(a,b);assert.ok(a.length<=120);}
   cells=lifeStep(cells,48,32);
  }
 }
});
test('an evicted sole repeat remains attached to the unchanged observation',()=>{
 const record=createLifeHistoryRecorder(),cells=new Uint8Array(1536);cells[0]=1;const key=[...cells].join('');
 const history=[{generation:0,key,count:1},...Array.from({length:119},(_,i)=>({generation:i+1,key:'unrelated-'+i,count:0}))];
 const reading=record(cells,120,history),entry=history.at(-1);
 assert.deepEqual(reading,{count:1,period:120});assert.equal(history.length,120);assert.equal(history[0].generation,1);
 for(let i=0;i<3;i++){assert.equal(record(cells,120,history),reading);assert.equal(history.at(-1),entry);}
});
test('unchanged observations allocate no board strings, do not recount and retain their exact history entry',()=>{
 const record=createLifeHistoryRecorder(),cells=new Uint8Array(1536),history=[];cells[42]=1;
 const reading=record(cells,14,history),entry=history[0],before=cells.slice();assert.ok(Object.isFrozen(reading));assert.throws(()=>reading.count=4,TypeError);
 assert.deepEqual(work(()=>{for(let i=0;i<120;i++)assert.equal(record(cells,14,history),reading);}),{serializations:0,populations:0});assert.equal(history[0],entry);assert.deepEqual(cells,before);
});
test('new observations invalidate the cache while restored immutable entries keep their verified reading',()=>{
 const record=createLifeHistoryRecorder();let cells=new Uint8Array(1536),history=[],generation=0,previous=record(cells,generation,history);
 function refresh(restored=false){let next;assert.deepEqual(work(()=>{next=record(cells,generation,history);}),restored?{serializations:1,populations:0}:{serializations:2,populations:1});if(restored)assert.deepEqual(next,previous);else assert.notEqual(next,previous);previous=next;}
 cells=cells.slice();refresh(true);generation++;refresh();history=history.slice();refresh(true);history[history.length-1]={...history.at(-1)};refresh();history.unshift({generation:-1,key:'',count:0});refresh(true);
 cells[4]=1;history=[];refresh();assert.equal(previous.count,1);const saved={cells:cells.slice(),history:history.slice(),generation};const savedReading=previous;
 cells[8]=1;history=[];refresh();assert.equal(previous.count,2);({cells,history,generation}=saved);previous=savedReading;refresh(true);assert.equal(previous.count,1);
 const other=[];record(new Uint8Array(1536),0,other);refresh(true);
});
test('paused focus, selection, resize and simulated density/context redraws do not rerecord the board',async()=>{
 const h=await setup('?experiment=life');for(let i=0;i<7;i++)click(h,'step');const before=readings(h),chart=plot(h),drawing=h.drawing(),url=location.href;h.el('life-back').focus();
 assert.deepEqual(work(()=>{for(let i=0;i<120;i++)h.resize(600,414);}),{serializations:0,populations:0});
 const announcement=h.el('announcement').textContent;assert.deepEqual(work(()=>{h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();}),{serializations:0,populations:0});assert.equal(h.el('announcement').textContent,announcement);
 assert.equal(work(()=>{for(const [w,z] of [[0,0],[259,240],[334.5,260.2],[1200,900],[600,414]])h.resize(w,z);for(const dpr of [1.25,2,3,1])h.setDpr(dpr);h.loseContext();h.restoreContext();}).serializations,0);
 assert.deepEqual(readings(h),before);assert.deepEqual(plot(h),chart);assert.deepEqual(h.drawing(),drawing);assert.equal(location.href,url);assert.equal(document.activeElement,h.el('life-back'));assert.equal(h.frames.size,0);
 assert.equal(work(()=>h.key('ArrowRight')).serializations,0);assert.deepEqual(readings(h),before);
});
test('new generations and rewind update once; unchanged redraws retain the correct board and plot',async()=>{
 const h=await setup('?experiment=life');preset(h,'blinker');const initial=readings(h),chart=plot(h);assert.equal(work(()=>click(h,'step')).serializations,2);assert.match(h.el('metrics').textContent,/第 1 代/);assert.match(h.el('life-turnover').textContent,/新生 2，消失 2，存活 1/);
 click(h,'step');assert.equal(h.el('observation-c').textContent,'重复周期 · 2 代');const evolved=readings(h),evolvedPlot=plot(h);assert.equal(work(()=>h.resize(259,240)).serializations,0);assert.deepEqual(readings(h),evolved);assert.deepEqual(plot(h),evolvedPlot);
 click(h,'life-back');assert.match(h.el('metrics').textContent,/第 1 代/);click(h,'life-back');assert.deepEqual(readings(h),initial);assert.deepEqual(plot(h),chart);assert.equal(work(()=>click(h,'life-back')).serializations,0);
});
test('in-place keyboard, click and drag edits reset the record and edit/clear recovery restores it',async()=>{
 const h=await setup('?experiment=life');for(let i=0;i<3;i++)click(h,'step');const before=readings(h),chart=plot(h),canvas=h.el('canvas');
 assert.equal(work(()=>h.key('Enter')).serializations,2);assert.match(h.el('history-caption').textContent,/第 3 → 3 代/);assert.match(h.el('life-rewind-status').textContent,/暂无上一代/);click(h,'life-undo-edit');assert.deepEqual(readings(h),before);assert.deepEqual(plot(h),chart);
 canvas.handlers.click({clientX:12,clientY:12,detail:0});assert.notDeepEqual(readings(h),before);click(h,'life-undo-edit');assert.deepEqual(readings(h),before);
 canvas.handlers.pointerdown({pointerId:3,button:0,clientX:12,clientY:12});canvas.handlers.pointermove({pointerId:3,buttons:1,clientX:180,clientY:12});canvas.handlers.pointerup({pointerId:3,clientX:180,clientY:12});assert.match(h.el('life-rewind-status').textContent,/暂无上一代/);click(h,'life-undo-edit');assert.deepEqual(readings(h),before);
 click(h,'clear');assert.equal(h.el('observation-a').textContent,'活细胞 · 0');click(h,'life-undo-clear');assert.deepEqual(readings(h),before);assert.deepEqual(plot(h),chart);
});
test('comparison return, presets, sharing and retained worlds keep the recorded history distinct',async()=>{
 const h=await setup('?experiment=life');for(let i=0;i<5;i++)click(h,'step');const before=readings(h),chart=plot(h);click(h,'life-test');assert.match(h.el('metrics').textContent,/第 6 代/);click(h,'life-return');assert.deepEqual(readings(h),before);assert.deepEqual(plot(h),chart);
 await click(h,'share');const saved=h.el('share-link').value;for(const mode of ['orbit','wave','fractal','walk']){click(h,'tab-'+mode);click(h,'tab-life');assert.deepEqual(readings(h),before);assert.deepEqual(plot(h),chart);assert.equal(h.el('share-link').value,saved);}
 h.el('density').handlers.input({target:{value:'44'}});assert.deepEqual(readings(h),before);h.el('rate').handlers.input({target:{value:'13'}});assert.deepEqual(readings(h),before);
 preset(h,'pulsar');assert.equal(h.el('observation-a').textContent,'活细胞 · 48');assert.match(h.el('history-caption').textContent,/第 0 → 0 代/);click(h,'reset');assert.equal(h.el('observation-a').textContent,'活细胞 · 10');
 click(h,'mission-start');assert.equal(h.el('observation-a').textContent,'活细胞 · 0');assert.equal(h.el('notes-count').textContent,'0 / 5');h.key('Enter');h.key('ArrowRight');h.key('Enter');h.key('ArrowDown');h.key('Enter');h.key('ArrowLeft');h.key('Enter');assert.equal(h.el('observation-a').textContent,'活细胞 · 4');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
});
test('animation, visibility and reduced motion retain the existing generation cadence and bounded history',async()=>{
 const h=await setup('?experiment=life');preset(h,'blinker');click(h,'pause');h.tick(0);const quiet=h.el('announcement').textContent;assert.equal(work(()=>h.tick(50)).serializations,0);h.tick(100);assert.equal(work(()=>h.tick(150)).serializations,2);
 h.setVisible(false);assert.equal(h.frames.size,0);h.setVisible(true);h.tick(1000);assert.match(h.el('metrics').textContent,/第 1 代/);h.setHidden(true);h.setHidden(false);h.tick(2000);assert.match(h.el('metrics').textContent,/第 1 代/);assert.equal(h.el('announcement').textContent,quiet);
 h.motion.change({matches:true});for(let i=0;i<130;i++)click(h,'step');assert.match(h.el('history-caption').textContent,/第 12 → 131 代/);const before=readings(h);assert.equal(work(()=>h.resize(600,414)).serializations,0);assert.deepEqual(readings(h),before);assert.equal(h.frames.size,0);
});
test('fresh app entry loads the recorder while simulation code and intentional batch actions stay unchanged',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),app=readFileSync(new URL('../app.js',import.meta.url),'utf8');assert.match(html,/app\.js\?[^"\n]+&amp;life=record-once-1&amp;history=read-once-1&amp;colors=wave-once-1&amp;orbit-fit=first-body-1&amp;canvas-start=retry-1&amp;sampling=wave-field-fallback-1&amp;nudge=single-enter-1&amp;walk-batch=reverse-1&amp;fractal-batch=reverse-1&amp;cycle=disclosure-1&amp;coordinate-draft=current-1&amp;life-draft=current-1&amp;bar-drawer=idle-1&amp;time-draft=current-1"/);assert.match(app,/import \{createLifeHistoryRecorder\} from '\.\/life-history\.js\?v=stable-repeat-1'/);assert.match(app,/const \{count,period\}=recordLifeHistory\(cells,generation,lifeHistory\)/);assert.match(app,/\.\/simulations\.js\?v=wave-paths-1&browse=living-cells-1/);
});
