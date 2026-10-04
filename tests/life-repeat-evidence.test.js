import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLifeHistoryRecorder} from '../life-history.js';
import {setup} from './life-challenge-harness.js';

const patterns=[
 {x:5,y:4,rows:['OOO...','OOO...','OOO...','...OOO','...OOO','...OOO'],period:8},
 {x:25,y:18,rows:['..O....O..','OO.OOOO.OO','..O....O..'],period:15}
];
const points=pattern=>pattern.rows.flatMap((row,y)=>[...row].flatMap((cell,x)=>cell==='O'?[[pattern.x+x,pattern.y+y]]:[]));
function initial(list=patterns){const cells=new Uint8Array(1536);for(const p of list)for(const [x,y] of points(p))cells[y*48+x]=1;return cells;}
// Independent B3/S23 oracle, rather than testing the recorder against itself.
function evolve(cells){return cells.map((alive,index)=>{
 const x=index%48,y=Math.floor(index/48);let neighbors=0;
 for(const dy of [-1,0,1])for(const dx of [-1,0,1])if(dx||dy)neighbors+=cells[((y+dy+32)%32)*48+(x+dx+48)%48];
 return Number(neighbors===3||(alive&&neighbors===2));
});}
const click=(h,id)=>h.el(id).handlers.click();
const state=h=>({metrics:h.el('metrics').textContent,repeat:h.el('observation-c').textContent,caption:h.el('history-caption').textContent,points:h.el('history-line').getAttribute('points'),turnover:h.el('life-turnover').textContent,url:location.href,notes:h.el('field-notes-list').innerHTML});
function drawPattern(h){
 click(h,'clear');
 for(const p of patterns)for(const [x,y] of points(p))h.el('canvas').handlers.click({detail:0,clientX:(x+.5)*600/48,clientY:(y+.5)*414/32});
}
async function ready(context=true){const h=await setup('?experiment=life&rate=20','',true,1,context);if(!context){h.setContextReady(true);click(h,'canvas-retry');}drawPattern(h);for(let i=0;i<120;i++)click(h,'step');assert.equal(h.el('observation-c').textContent,'重复周期 · 120 代');return h;}

test('separated real oscillators first repeat at 8, 15 and jointly 120 generations',()=>{
 for(const [list,period] of [[patterns.slice(0,1),8],[patterns.slice(1),15],[patterns,120]]){
  const start=initial(list);let cells=start;
  for(let generation=1;generation<=period;generation++){cells=evolve(cells);assert.equal(cells.every((v,i)=>v===start[i]),generation===period);}
 }
});

test('the 120-generation result survives quiet focus, pointer selection, layout and canvas recovery',async()=>{
 const h=await ready(),before=state(h),message=h.el('announcement').textContent,canvas=h.el('canvas');
 for(let i=0;i<120;i++)h.resize(600,414);
 canvas.handlers.focus();canvas.handlers.blur();h.resize(233,260);h.setDpr(2);h.loseContext();h.restoreContext();h.setDpr(1);h.resize(600,414);
 h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);
 assert.deepEqual(state(h),before);assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,0);
 click(h,'life-right');assert.deepEqual(state(h),before);assert.equal(h.el('history-line').getAttribute('points').split(' ').length,120);
 assert.match(before.caption,/第 1 → 120 代/);
});

for(const [name,actions] of [
 ['edit undo',['life-toggle','life-undo-edit']],['clear undo',['clear','life-undo-clear']],
 ['comparison return',['life-test','life-return']],['rewind',['step','life-back']]
])test(`verified evidence follows its original observation through ${name}`,async()=>{
 const h=await ready(),before=state(h),drawing=h.drawing();for(const id of actions)click(h,id);
 if(name==='rewind'){
  // Advancing beyond a full plot legitimately evicts its first row; rewind
  // retains 119 rows rather than inventing that discarded historical board.
  assert.match(h.el('history-caption').textContent,/第 2 → 120 代/);
  assert.equal(h.el('history-line').getAttribute('points').split(' ').length,119);
  for(const key of ['metrics','repeat','turnover','url','notes'])assert.equal(state(h)[key],before[key]);
 }else assert.deepEqual(state(h),before);
 assert.deepEqual(h.drawing(),drawing);const restored=state(h);h.resize(600,414);assert.deepEqual(state(h),restored);
});

test('world returns, parameter edits and anchor navigation preserve evidence without earning discoveries',async()=>{
 const h=await ready(),before=state(h),drawing=h.drawing();
 for(const world of ['orbit','wave','fractal','walk']){click(h,'tab-'+world);click(h,'tab-life');assert.deepEqual(state(h),before);assert.deepEqual(h.drawing(),drawing);}
 h.el('density').handlers.input({target:{value:'60'}});h.el('rate').handlers.input({target:{value:'1'}});h.navigate(location.search+'#observation-title');
 assert.equal(h.el('observation-c').textContent,before.repeat);assert.equal(h.el('metrics').textContent,before.metrics);assert.equal(h.el('notes-count').textContent,'0 / 5');
});

test('rewinding to an earlier unproven record does not inherit a later repeat result',async()=>{
 const h=await ready();click(h,'life-back');assert.equal(h.el('observation-c').textContent,'状态 · 尚未发现重复');
 click(h,'step');assert.equal(h.el('observation-c').textContent,'状态 · 尚未发现重复','generation zero is no longer available after discarding the proven record');
 click(h,'step');assert.equal(h.el('observation-c').textContent,'重复周期 · 120 代');h.resize(600,414);assert.equal(h.el('observation-c').textContent,'重复周期 · 120 代');
});

test('edits, reset, presets, new guides and replacement URLs must earn new evidence',async()=>{
 for(const change of ['life-toggle','reset','load-preset','guide-start','mission-start','url']){
  const h=await ready();if(change==='load-preset')h.el('preset-select').handlers.change({target:{value:'pulsar'}});
  if(change==='url')h.navigate('?experiment=life&rate=3&density=11');else click(h,change);
  assert.notEqual(h.el('observation-c').textContent,'重复周期 · 120 代');assert.equal(h.el('history-line').getAttribute('points').split(' ').length,1);
 }
});

test('animation retains evidence through a pause and next generation without an extra announcement',async()=>{
 const h=await ready();click(h,'pause');h.tick(0);const message=h.el('announcement').textContent;
 h.tick(50);assert.match(h.el('metrics').textContent,/第 121 代/);assert.equal(h.el('observation-c').textContent,'重复周期 · 120 代');assert.equal(h.el('announcement').textContent,message);
 click(h,'pause');const before=state(h);h.resize(600,414);assert.deepEqual(state(h),before);assert.equal(h.frames.size,0);
});

test('a pending image completion and parameter sharing do not change the proven board',async()=>{
 const h=await ready();let finish;h.el('canvas').toBlob=callback=>finish=callback;click(h,'save');click(h,'life-right');const before=state(h),message=h.el('announcement').textContent;
 finish(new Blob(['png']));assert.deepEqual(state(h),before);assert.equal(h.el('announcement').textContent,message);
 await click(h,'share');assert.equal(h.el('observation-c').textContent,before.repeat);assert.match(h.el('share-note').textContent,/不含画布图案/);
});

test('restoring an entry validates its board and does not transfer proof to copied or foreign records',()=>{
 const record=createLifeHistoryRecorder(),history=[];let cells=initial();
 for(let g=0;g<=120;g++){record(cells,g,history);if(g<120)cells=evolve(cells);}
 const entry=history.at(-1),saved=record(cells,120,history),copy=history.slice();assert.equal(saved.period,120);
 record(new Uint8Array(1536),0,[]);assert.equal(record(cells.slice(),120,copy),saved);assert.equal(copy.at(-1),entry);
 const changed=cells.slice();changed[0]^=1;assert.equal(record(changed,120,history.slice()).period,null);
 const foreign=history.map(row=>({...row}));assert.equal(record(cells,120,foreign).period,null);assert.equal(foreign.length,120);
 assert.equal(createLifeHistoryRecorder()(cells,120,history.slice()).period,null);
});

test('null, still-life and short-period records remain accurate and bounded across cache replacements',()=>{
 const record=createLifeHistoryRecorder();for(const shape of [[],[[4,4],[5,4],[4,5],[5,5]],[[4,4],[5,4],[6,4]]]){
  let cells=new Uint8Array(1536);for(const [x,y] of shape)cells[y*48+x]=1;const history=[];
  for(let g=0;g<=245;g++){
   const expected=g<(shape.length===3?2:1)?null:shape.length===3?2:1;
   const reading=record(cells,g,history);assert.equal(reading.period,expected);assert.ok(history.length<=120);
   record(new Uint8Array(1536),0,[]);assert.equal(record(cells.slice(),g,history.slice()),reading);cells=evolve(cells);
  }
 }
});

test('fresh entry loads the repaired recorder and explains stored evidence without new controls',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(app,/life-history\.js\?v=stable-repeat-1/);assert.match(html,/app\.js\?[^"\n]*&amp;repeat=stable-evidence-1/);
 assert.match(app,/每次记录时与此前最多 120 次观测比较，已确认的本代周期随该记录保留/);
});
