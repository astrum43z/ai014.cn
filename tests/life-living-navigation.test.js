import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as model from '../simulations.js';
import {setup} from './life-challenge-harness.js';
const click=(h,id)=>h.el(id).handlers.click?.();
const selected=h=>{const m=h.el('life-selection').textContent.match(/第 (\d+) 列，第 (\d+) 行/);return (Number(m[2])-1)*48+Number(m[1])-1;};
function board(h){
 const r=h.el('canvas').getBoundingClientRect(),cw=r.width/48,ch=r.height/32,result=new Uint8Array(1536);let color;
 for(const [name,...args] of h.drawing()){
  if(name==='fillStyle')color=args[0];
  if(name==='fillRect'&&color==='#d3f35b')result[Math.round((args[1]-.6)/ch)*48+Math.round((args[0]-.6)/cw)]=1;
 }return result;
}
const preserved=h=>({board:board(h),metrics:h.el('metrics').textContent,history:h.el('history-line').getAttribute('points'),caption:h.el('history-caption').textContent,turnover:h.el('life-turnover').textContent,trial:h.el('life-test-result').textContent,trialHidden:h.el('life-return').hidden,undo:h.el('life-undo-edit').getAttribute('aria-disabled'),clear:h.el('life-undo-clear').getAttribute('aria-disabled'),url:location.href,writes:h.writes(),mission:h.el('mission-result').textContent,notes:h.el('field-notes-list').innerHTML});
const complete=h=>({...preserved(h),selection:selected(h),announcement:h.el('announcement').textContent,status:h.el('status').textContent,draws:h.drawCount(),frames:h.frames.size});
function tap(h,x,y){const r=h.el('canvas').getBoundingClientRect();h.el('canvas').handlers.click({detail:0,clientX:(x+.5)*r.width/48,clientY:(y+.5)*r.height/32});}
function preset(h,value){h.el('preset-select').handlers.change({target:{value}});click(h,'load-preset');}
function pointer(h,type,x,y,id=7){h.el('canvas').handlers[type]({type,pointerId:id,isPrimary:true,button:0,buttons:type==='pointerup'?0:1,clientX:(x+.5)*600/48,clientY:(y+.5)*414/32});}
const buttons=['life-previous-live','life-next-live'];
function available(h,value){for(const id of buttons)assert.equal(h.el(id).getAttribute('aria-disabled'),String(!value));}
for(const positions of [[],[0],[11],[0,2,4,11],Array.from({length:12},(_,i)=>i)])test(`living-cell search matches independent reading-order oracle: ${positions.join(',')||'empty'}`,()=>{
 const cells=new Uint8Array(12);positions.forEach(i=>cells[i]=1);const copy=cells.slice();
 for(let start=0;start<12;start++)for(const direction of [-1,1]){
  const ordered=[...positions].sort((a,b)=>direction*(a-b));
  const expected=ordered.find(i=>direction*(i-start)>0)??ordered[0]??-1;
  assert.equal(model.findLivingCell(cells,start,direction),expected);
 }assert.deepEqual(cells,copy);
});
test('search terminates on empty arrays and invalid input without mutation',()=>{
 assert.equal(model.findLivingCell(new Uint8Array(),0,1),-1);const cells=new Uint8Array([1,0,1]);
 for(const start of [-1,3,NaN,Infinity,.5])assert.equal(model.findLivingCell(cells,start,1),-1);
 for(const direction of [0,2,-2,NaN])assert.equal(model.findLivingCell(cells,1,direction),-1);
});
test('full-size search uses the actual board boundary and at most one circuit',()=>{
 const cells=new Uint8Array(1536);cells[1535]=1;assert.equal(model.findLivingCell(cells,0),1535);assert.equal(model.findLivingCell(cells,1535,-1),1535);
 let reads=0;const empty=new Proxy({length:1536},{get(target,key){if(key==='length')return target.length;reads++;return 0;}});
 assert.equal(model.findLivingCell(empty,1535,-1),-1);assert.equal(reads,1536);
});
test('finds a moving glider from a now-empty selection without altering its eight generations',async()=>{
 const h=await setup('?experiment=life');preset(h,'glider');for(let i=0;i<8;i++)click(h,'step');
 assert.match(h.el('life-selection').textContent,/空格 · 0 个活邻居/);const before=preserved(h),expected=model.findLivingCell(board(h),selected(h),1);
 h.el('life-next-live').focus();click(h,'life-next-live');assert.equal(selected(h),expected);assert.match(h.el('life-selection').textContent,/活格/);
 assert.deepEqual(preserved(h),before);assert.equal(document.activeElement,h.el('life-next-live'));assert.match(h.el('announcement').textContent,/已暂停，已找到下一个活格/);assert.equal(h.frames.size,0);available(h,true);
});
test('both buttons visit every live square in row order and wrap at either edge',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');const positions=[0,47,48,49,1535];for(const i of positions)tap(h,i%48,Math.floor(i/48));const before=preserved(h);
 for(const expected of positions){click(h,'life-next-live');assert.equal(selected(h),expected);assert.deepEqual(preserved(h),before);}
 for(const expected of [49,48,47,0,1535]){click(h,'life-previous-live');assert.equal(selected(h),expected);assert.deepEqual(preserved(h),before);}
});
test('a sole cell can be found from elsewhere and explains a complete circuit back to itself',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');tap(h,0,0);click(h,'life-center');const before=preserved(h);available(h,true);
 click(h,'life-next-live');assert.equal(selected(h),0);assert.deepEqual(preserved(h),before);click(h,'life-previous-live');assert.equal(selected(h),0);assert.match(h.el('announcement').textContent,/只有这一个活格/);assert.deepEqual(preserved(h),before);
 click(h,'pause');assert.equal(h.frames.size,1);click(h,'life-next-live');assert.equal(h.frames.size,0);assert.match(h.el('announcement').textContent,/只有这一个活格/);
});
test('empty navigation stays focusable and is a strict no-op even while an empty board runs',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');available(h,false);assert.match(h.el('life-find-help').textContent,/当前没有活格/);
 for(const running of [false,true]){if(running)click(h,'pause');for(const id of buttons){h.el(id).focus();const before=complete(h);click(h,id);click(h,id);assert.deepEqual(complete(h),before);assert.equal(document.activeElement,h.el(id));assert.notEqual(h.el(id).disabled,true);}}
});
test('finding a live cell pauses without losing the fractional generation or history',async()=>{
 const h=await setup('?experiment=life&rate=1','',false);preset(h,'blinker');h.tick(0);for(let i=1;i<=15;i++)h.tick(i*50);
 assert.match(h.el('metrics').textContent,/第 0 代/);const before=preserved(h);click(h,'life-next-live');assert.deepEqual(preserved(h),before);assert.equal(h.frames.size,0);
 click(h,'pause');h.tick(800);for(let i=17;i<=20;i++)h.tick(i*50);assert.match(h.el('metrics').textContent,/第 0 代/);h.tick(1050);assert.match(h.el('metrics').textContent,/第 1 代/);
});
test('navigation preserves edit undo, clear recovery, and next-generation comparison return',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');tap(h,2,2);tap(h,4,4);let before=preserved(h);click(h,'life-next-live');assert.deepEqual(preserved(h),before);
 click(h,'life-undo-edit');assert.equal(board(h)[2*48+2],1);assert.equal(board(h)[4*48+4],0);click(h,'clear');before=complete(h);click(h,'life-next-live');assert.deepEqual(complete(h),before);click(h,'life-undo-clear');assert.equal(board(h)[2*48+2],1);
 preset(h,'blinker');const original=board(h);click(h,'life-test');before=preserved(h);click(h,'life-next-live');assert.deepEqual(preserved(h),before);click(h,'life-return');assert.deepEqual(board(h),original);
});
for(const drag of [false,true])test(`navigation ends an active ${drag?'stroke':'pending tap'} and keeps its trailing-click guard`,async()=>{
 const h=await setup('?experiment=life');click(h,'clear');tap(h,1,1);pointer(h,'pointerdown',2,4);if(drag)pointer(h,'pointermove',5,4);const before=preserved(h);
 click(h,'life-next-live');const next=selected(h);assert.deepEqual(preserved(h),before);pointer(h,'pointermove',8,4);pointer(h,'pointerup',8,4);pointer(h,'click',8,4);assert.deepEqual(preserved(h),before);assert.equal(selected(h),next);
 if(drag){click(h,'life-undo-edit');assert.equal(board(h).reduce((a,b)=>a+b),1);}
});
test('availability follows editing, extinction, rewind, reset, presets, and Life session return',async()=>{
 const h=await setup('?experiment=life');available(h,true);click(h,'clear');available(h,false);tap(h,0,0);available(h,true);click(h,'step');available(h,false);click(h,'life-back');available(h,true);
 click(h,'clear');available(h,false);click(h,'tab-wave');click(h,'tab-life');available(h,false);click(h,'reset');available(h,true);preset(h,'pulsar');available(h,true);
 click(h,'life-next-live');const selection=selected(h),before=preserved(h);click(h,'tab-fractal');click(h,'tab-life');assert.equal(selected(h),selection);const after=preserved(h);assert.deepEqual(after.board,before.board);assert.equal(after.metrics,before.metrics);
});
test('quiet resizing and canvas recovery keep selection and availability without repeated announcements',async()=>{
 const h=await setup('?experiment=life');click(h,'life-next-live');const next=selected(h),before=preserved(h),message=h.el('announcement').textContent;
 const element=h.el('life-find-help');let text=element.textContent,writes=0;Object.defineProperty(element,'textContent',{get:()=>text,set:value=>{text=value;writes++;}});
 for(const [width,height] of [[259,240],[284.5,260.25],[600,414]])h.resize(width,height);
 h.setDpr(2);h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);h.loseContext();h.restoreContext();assert.equal(selected(h),next);assert.deepEqual(preserved(h),before);available(h,true);assert.equal(h.el('announcement').textContent,message);assert.equal(writes,0);
});
test('finding living cells never completes discoveries or rewrites earned notes or parameter links',async()=>{
 const h=await setup('?experiment=life','#canvas');click(h,'mission-start');for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 click(h,'life-next-live');assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');await click(h,'share');const before=preserved(h),link=h.el('share-link').value;
 click(h,'life-next-live');click(h,'life-previous-live');assert.deepEqual(preserved(h),before);assert.equal(h.el('share-link').value,link);h.navigate(location.search+'#observation-title');h.navigate(location.search+'#canvas');assert.deepEqual(preserved(h),before);
});
test('stale Life navigation handlers do nothing in every other world',async()=>{
 const h=await setup('?experiment=life');for(const mode of ['orbit','wave','fractal','walk']){click(h,'tab-'+mode);const before=complete(h);for(const id of buttons)click(h,id);assert.deepEqual(complete(h),before);}
});
test('native press selects one cell while held Enter does not race around the pattern',async()=>{
 const h=await setup('?experiment=life');for(const id of buttons)for(const [key,repeat,expected] of [['Enter',false,false],['Enter',true,true],[' ',true,false],['Tab',false,false]]){let prevented=false;h.el(id).handlers.keydown?.({key,repeat,preventDefault(){prevented=true;}});assert.equal(prevented,expected);}
});
test('navigation is named, quiet, described, and outside the narrow directional grid',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<p class="life-find-actions"><button id="life-previous-live" type="button" aria-controls="canvas" aria-describedby="life-selection life-find-help">上一个活格<\/button><button id="life-next-live" type="button" aria-controls="canvas" aria-describedby="life-selection life-find-help">下一个活格<\/button><\/p><small id="life-find-help" aria-live="off"><\/small>/);
 assert.match(css,/\.life-touch \.life-find-actions\{[^}]*flex-wrap:wrap/);assert.match(css,/\.life-touch \.life-find-actions button\{[^}]*min-height:44px[^}]*overflow-wrap:anywhere/);assert.match(css,/\.life-touch \.life-find-actions button\[aria-disabled="true"\]\{[^}]*cursor:default/);
});
