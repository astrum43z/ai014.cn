import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const reading=h=>h.el('life-cell-transition').textContent;
const absent='刚才这一代 · 暂无相邻上一代记录；前进一代后可查看所选格怎样变化。';
const choose=(h,value)=>{h.el('preset-select').handlers.change({target:{value}});click(h,'load-preset');};
function board(h){
 const {width,height}=h.el('canvas').getBoundingClientRect(),cells=new Uint8Array(1536);let color;
 for(const [name,...args] of h.drawing()){
  if(name==='fillStyle')color=args[0];
  if(name==='fillRect'&&color==='#d3f35b')cells[Math.round((args[1]-.6)/(height/32))*48+Math.round((args[0]-.6)/(width/48))]=1;
 }return cells;
}
function tap(h,x,y){const r=h.el('canvas').getBoundingClientRect();h.el('canvas').handlers.click({detail:0,clientX:(x+.5)*r.width/48,clientY:(y+.5)*r.height/32});}
function select(h,x,y){
 const position=()=>h.el('life-cell-position').textContent.match(/第 (\d+) 列，第 (\d+) 行/).slice(1).map(n=>Number(n)-1);
 while(position()[0]!==x)h.key('ArrowRight');
 while(position()[1]!==y)h.key('ArrowDown');
}
// Independent neighborhood and simultaneous-rule oracle. The result is checked
// against actual painted cells; no history key or application rule is imported.
function expected(before,after,x,y,generation){
 const i=y*48+x,n=[-1,0,1].flatMap(dy=>[-1,0,1].filter(dx=>dx||dy).map(dx=>before[((y+dy+32)%32)*48+(x+dx+48)%48])).reduce((a,b)=>a+b,0);
 assert.equal(after[i],Number(n===3||(before[i]===1&&n===2)));
 const outcome=before[i]?(after[i]?'存活':'消失'):(after[i]?'诞生':'仍空');
 const reason=before[i]?(n<2?'少于 2':n>3?'超过 3':'为 2 或 3'):(n===3?'恰好为 3':'不等于 3');
 return `刚才这一代 · 第 ${generation-1} → ${generation} 代：原为${before[i]?'活格':'空格'}，当时 ${n} 个活邻居；${reason}，因而${outcome}。`;
}
function assertCell(h,before,after,x,y,generation){select(h,x,y);assert.equal(reading(h),expected(before,after,x,y,generation));}
const state=h=>({board:board(h),metrics:h.el('metrics').textContent,history:h.el('history-line').getAttribute('points'),url:location.href,notes:h.el('field-notes-list').innerHTML,trial:h.el('life-test-result').textContent});

test('blinker explains past death with one old neighbor separately from next birth with three current neighbors',async()=>{
 const h=await setup('?experiment=life');choose(h,'blinker');assert.equal(reading(h),absent);const before=board(h);click(h,'step');
 assert.equal(reading(h),expected(before,board(h),22,14,1));
 assert.match(reading(h),/原为活格，当时 1 个活邻居；少于 2，因而消失/);
 assert.match(h.el('life-selection').textContent,/空格 · 3 个活邻居/);assert.match(h.el('life-next-reading').textContent,/下一代：诞生/);
});

test('every old live/dead state and 0–8 neighbor count explains the independently verified result',async()=>{
 const h=await setup('?experiment=life');const offsets=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
 for(const alive of [0,1])for(let n=0;n<=8;n++){
  click(h,'clear');for(const [dx,dy] of offsets.slice(0,n))tap(h,24+dx,16+dy);if(alive)tap(h,24,16);select(h,24,16);
  const before=board(h);click(h,'step');assert.equal(reading(h),expected(before,board(h),24,16,1));
 }
});

test('edge and corner explanations count wrapped old neighbors and exclude the selected cell',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');for(const p of [[47,31],[0,31],[47,0],[0,0],[1,0],[0,1]])tap(h,...p);
 const before=board(h);click(h,'step');const after=board(h);
 for(const p of [[0,0],[47,0],[0,31],[47,31],[1,0],[1,1]])assertCell(h,before,after,...p,1);
});

test('glider and pulsar explanations follow actual observed transitions while selection preserves the board',async()=>{
 for(const name of ['glider','pulsar']){
  const h=await setup('?experiment=life');choose(h,name);let before=board(h);
  for(let generation=1;generation<=6;generation++){
   click(h,'step');const after=board(h),saved=state(h);
   for(const p of [[22,14],[23,14],[23,15],[24,16]])assertCell(h,before,after,...p,generation);
   assert.deepEqual(state(h),saved);before=after;
  }
 }
});

test('rewind and identical replay use the matching predecessor, with no invented oldest history',async()=>{
 const h=await setup('?experiment=life');choose(h,'blinker');click(h,'step');const first=reading(h);click(h,'step');const second=reading(h);
 click(h,'life-back');assert.equal(reading(h),first);click(h,'step');assert.equal(reading(h),second);
 for(let i=2;i<124;i++)click(h,'step');assert.match(reading(h),/第 123 → 124 代/);
 for(let i=0;i<119;i++)click(h,'life-back');assert.equal(h.el('life-back').getAttribute('aria-disabled'),'true');assert.equal(reading(h),absent);
});

test('edit and clear boundaries remove old evidence while their existing undo restores it',async()=>{
 const h=await setup('?experiment=life');choose(h,'blinker');click(h,'step');const saved=reading(h),before=state(h);
 click(h,'life-toggle');assert.equal(reading(h),absent);click(h,'life-undo-edit');assert.equal(reading(h),saved);assert.deepEqual(state(h),before);
 click(h,'clear');assert.equal(reading(h),absent);click(h,'life-undo-clear');assert.equal(reading(h),saved);assert.deepEqual(state(h),before);
 click(h,'reset');assert.equal(reading(h),absent);click(h,'step');assert.notEqual(reading(h),absent);
 choose(h,'pulsar');assert.equal(reading(h),absent);click(h,'step');click(h,'guide-start');assert.equal(reading(h),absent);
});

test('construction comparison reads its original board and returning restores the prior reading',async()=>{
 const h=await setup('?experiment=life');choose(h,'blinker');click(h,'step');const first=reading(h),before=board(h);
 click(h,'life-test');const after=board(h);assert.equal(reading(h),expected(before,after,22,14,2));assert.equal(h.el('life-return').hidden,false);
 select(h,23,13);assert.equal(reading(h),expected(before,after,23,13,2));click(h,'life-return');assert.equal(reading(h),first);assert.deepEqual(board(h),before);
 click(h,'life-challenge-start');assert.equal(reading(h),absent);click(h,'life-test');assert.match(reading(h),/原为空格，当时 0 个活邻居；不等于 3，因而仍空/);
});

test('the new reading adds no announcements, focus moves or extra updates during unchanged redraws',async()=>{
 const h=await setup('?experiment=life');choose(h,'blinker');click(h,'step');const output=h.el('life-cell-transition');let text=output.textContent,writes=0;
 Object.defineProperty(output,'textContent',{get:()=>text,set:value=>{text=value;writes++;}});
 h.el('life-next-live').focus();const message=h.el('announcement').textContent;
 for(const size of [[600,414],[233,260],[284.5,260.25],[600,414]])h.resize(...size);
 h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();h.setDpr(2);h.setDpr(1);h.loseContext();h.restoreContext();
 assert.equal(writes,0);assert.equal(h.el('announcement').textContent,message);assert.equal(document.activeElement,h.el('life-next-live'));
 output.textContent='stale';h.resize(600,414);assert.notEqual(reading(h),'stale');assert.equal(writes,2);h.resize(600,414);assert.equal(writes,2);
});

test('running observations stay quiet and visibility/context interruptions retain their evidence',async()=>{
 const h=await setup('?experiment=life&rate=20');choose(h,'blinker');click(h,'pause');const before=board(h),message=h.el('announcement').textContent;
 h.tick(0);h.tick(50);assert.equal(reading(h),expected(before,board(h),22,14,1));assert.equal(h.el('announcement').textContent,message);
 const after=board(h),saved=reading(h);h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);h.loseContext();h.restoreContext();
 assert.equal(reading(h),saved);h.tick(90000);assert.equal(reading(h),saved);h.tick(90050);assert.equal(reading(h),expected(after,board(h),22,14,2));
 h.key('Escape');const paused=state(h);h.resize(600,414);assert.deepEqual(state(h),paused);
});

test('retained worlds, parameters and native anchors preserve a valid prior generation',async()=>{
 const h=await setup('?experiment=life');choose(h,'blinker');click(h,'step');const saved=reading(h),before=state(h);
 for(const world of ['orbit','wave','fractal','walk']){click(h,'tab-'+world);assert.equal(h.el('life-touch').hidden,true);click(h,'tab-life');assert.equal(reading(h),saved);assert.deepEqual(board(h),before.board);}
 for(const [id,value] of [['rate','11'],['density','60']]){h.el(id).handlers.input({target:{value}});assert.equal(reading(h),saved);assert.deepEqual(board(h),before.board);}
 h.navigate(location.href.replace(/#.*/,'')+'#observation-title');assert.equal(reading(h),saved);
 h.navigate('?experiment=life&rate=1&density=20');assert.equal(reading(h),absent);
});

test('reading works with no initial canvas and reappears unchanged when drawing recovers',async()=>{
 const h=await setup('?experiment=life','',true,1,false);choose(h,'blinker');click(h,'step');assert.match(reading(h),/原为活格，当时 1 个活邻居；少于 2，因而消失/);
 const saved=reading(h);h.setContextReady(true);click(h,'canvas-retry');assert.equal(reading(h),saved);assert.equal(board(h).reduce((a,b)=>a+b,0),3);
});

test('selected-cell explanations cannot earn discoveries or alter saved parameter links',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');for(const p of [[23,15],[24,15],[23,16],[24,16]])tap(h,...p);
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');await click(h,'share');const link=h.el('share-link').value,notes=h.el('field-notes-list').innerHTML;
 click(h,'step');const before=board(h);select(h,23,15);assert.match(reading(h),/当时 3 个活邻居；为 2 或 3，因而存活/);click(h,'life-next-live');
 assert.equal(h.el('share-link').value,link);assert.equal(location.href,link);assert.equal(h.el('field-notes-list').innerHTML,notes);assert.deepEqual(board(h),before);
});

test('markup distinguishes past and future in the existing quiet, wrapping selected-cell group',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<p id="life-selection" aria-live="off"><\/p><p id="life-cell-transition" aria-live="off"><\/p><p id="life-next-reading" aria-live="off"><\/p>/);
 assert.equal((html.match(/id="life-cell-transition"/g)||[]).length,1);
 assert.equal((html.match(/&amp;cell-history=explain-1/g)||[]).length,2,'both changed runtime assets have a fresh cache key');
 assert.match(css,/\.life-touch #life-cell-transition,\.life-touch #life-next-reading\{[^}]*line-height:1\.6[^}]*overflow-wrap:anywhere/);
 const el=html.match(/<p id="life-cell-transition"[^>]*>/)[0];assert.doesNotMatch(el,/tabindex|role="(?:status|alert)"/);
});
