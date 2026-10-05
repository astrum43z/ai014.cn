import test from 'node:test';
import assert from 'node:assert/strict';
import {setup as setupHarness} from './life-challenge-harness.js';
// These contracts describe the displayed inspector; closed diagrams are covered separately.
async function setup(...args){const h=await setupHarness(...args);h.el('instruments').open=true;h.el('instruments').handlers.toggle();return h;}

const textIds=['life-cell-position','life-cell-state','life-cell-next','life-cell-reason','life-selection','life-toggle'];
const neighborIds=Array.from({length:9},(_,i)=>'life-neighbor-'+i);
const click=(h,id)=>h.el(id).handlers.click();
function toggle(h,x,y){
 const rect=h.el('canvas').getBoundingClientRect();
 h.el('canvas').handlers.click({detail:0,clientX:(x+.5)*rect.width/48,clientY:(y+.5)*rect.height/32});
}
function board(h){
 const {width,height}=h.el('canvas').getBoundingClientRect(),cells=new Uint8Array(48*32);let color;
 for(const [name,...args] of h.drawing()){
  if(name==='fillStyle')color=args[0];
  if(name==='fillRect'&&color==='#d3f35b')cells[Math.round((args[1]-.6)/(height/32))*48+Math.round((args[0]-.6)/(width/48))]=1;
 }return cells;
}
function inspect(h){
 const cells=board(h),[x,y]=h.el('life-cell-position').textContent.match(/第 (\d+) 列，第 (\d+) 行/).slice(1).map(n=>Number(n)-1);
 const local=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)local.push(cells[((y+dy+32)%32)*48+(x+dx+48)%48]);
 const alive=local[4],neighbors=local.reduce((a,b)=>a+b,0)-alive;
 const [outcome,reason]=alive?(neighbors===2||neighbors===3?['存活','活格有 2 或 3 个活邻居，下一代仍活']:neighbors<2?['消失','活格少于 2 个活邻居，下一代变空']:['消失','活格超过 3 个活邻居，下一代变空']):neighbors===3?['诞生','空格恰有 3 个活邻居，下一代变活']:['仍空','空格的活邻居不等于 3，下一代仍空'];
 assert.equal(h.el('life-cell-state').textContent,`当前：${alive?'活格':'空格'} · 活邻居 ${neighbors} / 8`);
 assert.equal(h.el('life-cell-next').textContent,'下一代：'+outcome);
 assert.equal(h.el('life-cell-reason').textContent,reason+'。');
 assert.equal(h.el('life-selection').textContent,`第 ${x+1} 列，第 ${y+1} 行 · ${alive?'活格':'空格'} · ${neighbors} 个活邻居`);
 assert.equal(h.el('life-toggle').textContent,alive?'熄灭所选格':'点亮所选格');
 assert.deepEqual(neighborIds.map(id=>Number(h.el(id).getAttribute('data-alive'))),local);
 return {cells,x,y,alive,neighbors};
}
function track(h){
 const writes=[];
 for(const id of textIds){
  const el=h.el(id);let text=el.textContent;
  Object.defineProperty(el,'textContent',{configurable:true,get:()=>text,set:next=>{writes.push([id,text,next]);text=next;}});
 }
 for(const id of neighborIds){
  const el=h.el(id),set=el.setAttribute;
  el.setAttribute=function(name,next){if(name==='data-alive')writes.push([id,this.getAttribute(name),String(next)]);set.call(this,name,next);};
 }
 return {writes,reset:()=>{writes.length=0;},minimal:()=>{for(const [id,old,next] of writes)assert.notEqual(old,next,id+' should retain unchanged DOM content');}};
}
function block(h){click(h,'clear');for(const [x,y] of [[23,15],[24,15],[23,16],[24,16]])toggle(h,x,y);}
const snapshot=h=>({drawing:h.drawing(),metrics:h.el('metrics').textContent,url:location.href,announcement:h.el('announcement').textContent,notes:h.el('field-notes-list').innerHTML});

test('120 stable Life generations retain all six inspector text nodes and nine neighborhood attributes',async()=>{
 const h=await setup('?experiment=life&rate=20');block(h);const initial=inspect(h);assert.equal(initial.neighbors,3);
 click(h,'pause');const message=h.el('announcement').textContent,monitor=track(h);
 h.tick(0);for(let i=1;i<=120;i++)h.tick(i*50);
 assert.match(h.el('metrics').textContent,/第 120 代 · 4 个活格子/);
 assert.deepEqual(inspect(h).cells,initial.cells);assert.equal(h.frames.size,1);
 assert.equal(h.el('announcement').textContent,message,'animation remains quiet');
 assert.equal(monitor.writes.length,0,'avoid 720 text replacements and 1080 unchanged attribute writes');
});

test('paused resize, focus, density and context redraws do not replace readable inspector content',async()=>{
 const h=await setup('?experiment=life'),monitor=track(h),initial=inspect(h);
 for(const [w,z] of [[600,414],[259,240],[284.5,260.25],[900,414]]){h.resize(w,z);inspect(h);}
 h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();h.setDpr(2);h.setDpr(1);
 h.loseContext();h.restoreContext();
 assert.deepEqual(inspect(h).cells,initial.cells);assert.equal(monitor.writes.length,0);
});

test('blinker generations and rewinds update exactly the changed displayed fields',async()=>{
 const h=await setup('?experiment=life');click(h,'guide-start');const initial=inspect(h),monitor=track(h);
 for(let i=0;i<12;i++){click(h,'step');inspect(h);monitor.minimal();monitor.reset();}
 assert.deepEqual(inspect(h).cells,initial.cells);
 for(let i=0;i<12;i++){click(h,'life-back');inspect(h);monitor.minimal();monitor.reset();}
 assert.deepEqual(inspect(h),initial);
});

test('all local neighbor counts refresh rule, button and mini-grid without redundant writes',async()=>{
 const h=await setup('?experiment=life'),monitor=track(h);
 const offsets=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
 for(const alive of [0,1])for(let count=0;count<=8;count++){
  click(h,'clear');for(const [dx,dy] of offsets.slice(0,count))toggle(h,24+dx,16+dy);
  toggle(h,24,16);if(!alive)toggle(h,24,16);
  const cell=inspect(h);assert.equal(cell.alive,alive);assert.equal(cell.neighbors,count);monitor.minimal();monitor.reset();
 }
});

test('wrapped selection movement updates location while unchanged rules and neighborhoods retain nodes',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');const monitor=track(h);
 for(let i=0;i<48;i++)h.key('ArrowRight');for(let i=0;i<32;i++)h.key('ArrowDown');
 assert.equal(monitor.writes.length,160,'only location and concise selection change for each of 80 moves');monitor.minimal();
 for(const entry of monitor.writes)assert.ok(['life-cell-position','life-selection'].includes(entry[0]));
 toggle(h,47,31);toggle(h,0,31);toggle(h,47,0);
 while(inspect(h).x!==0)h.key('ArrowRight');while(inspect(h).y!==0)h.key('ArrowDown');
 assert.equal(inspect(h).neighbors,3);assert.match(h.el('life-cell-next').textContent,/诞生/);monitor.minimal();
});

test('edit undo, clear recovery, comparison return and presets refresh the actual current board',async()=>{
 const h=await setup('?experiment=life'),monitor=track(h);block(h);const stable=inspect(h);
 click(h,'life-toggle');inspect(h);click(h,'life-undo-edit');assert.deepEqual(inspect(h),stable);
 click(h,'clear');inspect(h);click(h,'life-undo-clear');assert.deepEqual(inspect(h),stable);
 click(h,'life-test');inspect(h);click(h,'life-return');assert.deepEqual(inspect(h),stable);
 for(const preset of ['blinker','pulsar','glider']){h.el('preset-select').handlers.change({target:{value:preset}});click(h,'load-preset');inspect(h);}
 click(h,'reset');inspect(h);monitor.minimal();
});

test('retained worlds and parameter-only history never leave another Life reading cached',async()=>{
 const h=await setup('?experiment=life');block(h);const original=inspect(h),monitor=track(h);
 for(const tab of [0,2,3,4]){h.tabs[tab].handlers.click();h.tabs[1].handlers.click();assert.deepEqual(inspect(h),original);}
 assert.equal(monitor.writes.length,0,'other worlds do not alter the Life inspector');
 h.navigate('?experiment=life&rate=1&density=60#canvas');inspect(h);monitor.minimal();
 const state=snapshot(h),cells=board(h);h.el('density').handlers.input({target:{value:'59'}});assert.deepEqual(inspect(h).cells,cells);
 assert.equal(h.el('metrics').textContent,state.metrics);monitor.minimal();
});

test('DOM comparison repairs stale or missing displayed data without a shadow cache',async()=>{
 const h=await setup('?experiment=life'),expected=textIds.map(id=>h.el(id).textContent),neighbors=neighborIds.map(id=>h.el(id).getAttribute('data-alive'));
 for(const id of textIds)h.el(id).textContent='stale';for(const id of neighborIds)delete h.el(id).attributes['data-alive'];
 const monitor=track(h);h.resize(600,414);inspect(h);
 assert.deepEqual(textIds.map(id=>h.el(id).textContent),expected);assert.deepEqual(neighborIds.map(id=>h.el(id).getAttribute('data-alive')),neighbors);
 assert.equal(monitor.writes.length,15);monitor.minimal();monitor.reset();h.resize(600,414);assert.equal(monitor.writes.length,0);
});

test('running interruptions and explicit Escape pause retain inspector content and model',async()=>{
 const h=await setup('?experiment=life');block(h);click(h,'pause');const monitor=track(h);
 h.tick(0);h.tick(50);h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);h.loseContext();h.restoreContext();
 const before=inspect(h);h.key('Escape');assert.equal(h.frames.size,0);assert.deepEqual(inspect(h),before);
 const paused=snapshot(h);h.key('Escape');assert.deepEqual(snapshot(h),paused);assert.equal(monitor.writes.length,0);
});

test('inspector redraws preserve sharing, completed discoveries and focus',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');for(const [x,y] of [[23,15],[24,15],[23,16],[24,16]])toggle(h,x,y);
 click(h,'mission-check');assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');await click(h,'share');
 const before=snapshot(h),monitor=track(h),focused=h.el('life-toggle');focused.focus();
 h.resize(259,240);h.setDpr(2);h.tabs[2].handlers.click();h.tabs[1].handlers.click();inspect(h);
 assert.equal(document.activeElement,focused);assert.equal(location.href,before.url);assert.equal(h.el('share-link').value,location.href);
 assert.equal(h.el('field-notes-list').innerHTML,before.notes);assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');assert.equal(monitor.writes.length,0);
});
