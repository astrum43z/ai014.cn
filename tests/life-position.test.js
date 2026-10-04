import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const text=(h,id)=>h.el(id).textContent;
const type=(h,id,value)=>{h.el(id).value=String(value);h.el(id).handlers.input();};
const target=(h,column,row)=>{type(h,'life-target-column',column);type(h,'life-target-row',row);};
const select=(h,column,row)=>{target(h,column,row);click(h,'life-position');};
const selected=h=>text(h,'life-cell-position');
const key=(h,id,extra={})=>{let prevented=false;h.el(id).handlers.keydown({key:'Enter',preventDefault(){prevented=true;},...extra});return prevented;};
function board(h){
 const r=h.el('canvas').getBoundingClientRect(),result=new Uint8Array(1536);let color;
 for(const [name,...args] of h.drawing()){
  if(name==='fillStyle')color=args[0];
  if(name==='fillRect'&&color==='#d3f35b')result[Math.round((args[1]-.6)/(r.height/32))*48+Math.round((args[0]-.6)/(r.width/48))]=1;
 }return result;
}
function neighbors(cells,x,y){let n=0;for(const dy of [-1,0,1])for(const dx of [-1,0,1])if(dx||dy)n+=cells[((y+dy+32)%32)*48+(x+dx+48)%48];return n;}
const evolve=cells=>cells.map((alive,i)=>{const n=neighbors(cells,i%48,Math.floor(i/48));return Number(n===3||(alive&&n===2));});
const preserved=h=>({metrics:text(h,'metrics'),history:h.el('history-line').getAttribute('points'),caption:text(h,'history-caption'),repeat:text(h,'observation-c'),turnover:text(h,'life-turnover'),trial:text(h,'life-test-result'),trialHidden:h.el('life-return').hidden,undo:h.el('life-undo-edit').getAttribute('aria-disabled'),clear:h.el('life-undo-clear').getAttribute('aria-disabled'),url:location.href,writes:h.writes(),mission:text(h,'mission-result'),notes:h.el('field-notes-list').innerHTML,link:h.el('share-link').value});
const state=h=>({...preserved(h),selected:selected(h),drawing:h.drawing(),draws:h.drawCount(),status:text(h,'status'),frames:[...h.frames.keys()]});
function preset(h,value){h.el('preset-select').handlers.change({target:{value}});click(h,'load-preset');}
function tap(h,x,y){h.el('canvas').handlers.click({detail:0,clientX:(x+.5)*600/48,clientY:(y+.5)*414/32});}
function pointer(h,type,x,y){h.el('canvas').handlers[type]({type,pointerId:7,isPrimary:true,button:0,buttons:['pointerdown','pointermove'].includes(type)?1:0,clientX:(x+.5)*600/48,clientY:(y+.5)*414/32,detail:type==='click'?1:0});}

// The oracle uses 1-based targets and independent toroidal neighbor indexing.
test('every one of 1536 exact destinations reports the correct cell without changing the board',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');for(const [x,y] of [[0,0],[47,0],[0,31],[47,31],[14,8],[23,15],[24,15],[24,16]])tap(h,x,y);
 const cells=board(h),before=preserved(h);h.el('life-position').focus();
 for(let row=1;row<=32;row++)for(let column=1;column<=48;column++){
  select(h,column,row);const x=column-1,y=row-1,n=neighbors(cells,x,y),alive=cells[y*48+x];
  assert.equal(selected(h),`第 ${column} 列，第 ${row} 行`);
  assert.equal(text(h,'life-cell-state'),`当前：${alive?'活格':'空格'} · 活邻居 ${n} / 8`);
  assert.equal(text(h,'life-cell-next'),`下一代：${alive?(n===2||n===3?'存活':'消失'):n===3?'诞生':'仍空'}`);
  assert.deepEqual(preserved(h),before);assert.equal(document.activeElement,h.el('life-position'));
 }
 assert.deepEqual(board(h),cells);assert.equal(h.frames.size,0);
 assert.match(text(h,'announcement'),/第 48 列，第 32 行/);assert.match(text(h,'announcement'),/不改图案/);
});

for(const axis of ['column','row'])test(`invalid ${axis} targets are atomic and focus the first invalid field`,async()=>{
 const h=await setup('?experiment=life');click(h,'step');click(h,'pause');h.tick(0);h.tick(50);
 for(const bad of ['', ' ', '0','-1','+1','1.0','1.2','1e1','0x10','Infinity','NaN','1 2','1,000','①','一','١','𝟙','１．０','１，２','−１','49','9007199254740993',...(axis==='row'?['33']:[])]){
  target(h,'13','7');type(h,'life-target-'+axis,bad);const before=state(h);click(h,'life-position');
  assert.deepEqual(state(h),before,bad);assert.equal(h.el('life-target-'+axis).value,bad);assert.equal(h.el('life-target-'+axis).getAttribute('aria-invalid'),'true');assert.equal(document.activeElement,h.el('life-target-'+axis));assert.equal(h.el('life-position-error').hidden,false);
 }
 target(h,'49','33');const before=state(h);click(h,'life-position');assert.deepEqual(state(h),before);assert.equal(document.activeElement,h.el('life-target-column'));
 type(h,'life-target-column','48');assert.equal(h.el('life-position-error').hidden,false);type(h,'life-target-row','32');assert.equal(h.el('life-position-error').hidden,true);click(h,'life-position');assert.equal(selected(h),'第 48 列，第 32 行');assert.equal(h.frames.size,0);
});

test('full-width integers, leading zeroes and outer spaces normalize only on valid submission',async()=>{
 const h=await setup('?experiment=life');target(h,'　００４８　','０３2');assert.equal(h.el('life-target-column').value,'　００４８　');click(h,'life-position');
 assert.equal(selected(h),'第 48 列，第 32 行');assert.equal(h.el('life-target-column').value,'48');assert.equal(h.el('life-target-row').value,'32');
 select(h,'００１','　１ ');assert.equal(selected(h),'第 1 列，第 1 行');
});

for(const id of ['life-target-column','life-target-row'])test(`${id}: fresh Enter submits while composing, modified, repeat and editing keys do not`,async()=>{
 const h=await setup('?experiment=life');target(h,13,7);click(h,'pause');h.el(id).focus();const before=state(h);
 assert.equal(key(h,id,{repeat:true}),true);for(const extra of [{isComposing:true},{keyCode:229},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{key:'Escape'},{key:'ArrowLeft'},{key:' '}])assert.equal(key(h,id,extra),false);
 assert.deepEqual(state(h),before);assert.equal(key(h,id),true);assert.equal(document.activeElement,h.el(id));assert.equal(selected(h),'第 13 列，第 7 行');assert.equal(h.frames.size,0);
});

test('button keeps native fresh Enter and Space, cancels held Enter and keeps focus on success',async()=>{
 const h=await setup('?experiment=life');target(h,13,7);h.el('life-position').focus();const before=state(h);
 assert.equal(key(h,'life-position',{repeat:true}),true);assert.equal(key(h,'life-position'),false);assert.equal(key(h,'life-position',{key:' ',repeat:true}),false);assert.deepEqual(state(h),before);
 click(h,'life-position');assert.equal(document.activeElement,h.el('life-position'));assert.equal(selected(h),'第 13 列，第 7 行');
});

test('typing and retained drafts are quiet through redraw, evolution, reset and all-world returns',async()=>{
 const h=await setup('?experiment=life');const before=state(h),message=text(h,'announcement');target(h,'４８','３２');assert.deepEqual(state(h),before);assert.equal(text(h,'announcement'),message);
 click(h,'pause');h.tick(0);h.tick(50);h.tick(100);h.tick(150);const runningMessage=text(h,'announcement');
 h.resize(259,240);h.setDpr(2);h.loseContext();h.restoreContext();h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);
 assert.equal(text(h,'announcement'),runningMessage);for(const world of ['orbit','wave','fractal','walk']){click(h,'tab-'+world);click(h,'tab-life');}
 assert.equal(h.el('life-target-column').value,'４８');assert.equal(h.el('life-target-row').value,'３２');click(h,'reset');assert.equal(h.el('life-target-column').value,'４８');
 select(h,48,32);click(h,'life-center');assert.equal(selected(h),'第 25 列，第 17 行');assert.equal(h.el('life-target-column').value,'48');
});

test('selection pauses without losing fractional evolution time or changing the next generation',async()=>{
 const h=await setup('?experiment=life&rate=1');preset(h,'blinker');click(h,'pause');h.tick(0);for(let i=1;i<=15;i++)h.tick(i*50);
 const cells=board(h),saved=preserved(h);select(h,1,1);assert.deepEqual(board(h),cells);assert.deepEqual(preserved(h),saved);assert.equal(h.frames.size,0);
 click(h,'pause');h.tick(800);for(let i=17;i<=20;i++)h.tick(i*50);assert.deepEqual(board(h),cells);h.tick(1050);assert.deepEqual(board(h),evolve(cells));
 select(h,1,1);assert.equal(h.frames.size,0);assert.deepEqual(board(h),evolve(cells));
});

test('edit undo, clear undo, comparison return and rewind remain exact after selecting another cell',async()=>{
 const h=await setup('?experiment=life');preset(h,'blinker');click(h,'step');const cells=board(h),old=selected(h),saved=preserved(h);
 click(h,'life-toggle');const edited=preserved(h);select(h,48,32);assert.deepEqual(preserved(h),edited);click(h,'life-undo-edit');assert.deepEqual(board(h),cells);assert.equal(selected(h),old);assert.deepEqual(preserved(h),saved);
 click(h,'clear');const cleared=preserved(h);select(h,1,1);assert.deepEqual(preserved(h),cleared);click(h,'life-undo-clear');assert.deepEqual(board(h),cells);assert.equal(selected(h),old);assert.deepEqual(preserved(h),saved);
 click(h,'life-test');const compared=preserved(h);select(h,31,17);assert.deepEqual(preserved(h),compared);click(h,'life-return');assert.deepEqual(board(h),cells);assert.equal(selected(h),old);assert.deepEqual(preserved(h),saved);
 click(h,'step');select(h,48,32);click(h,'life-back');assert.deepEqual(board(h),cells);assert.equal(selected(h),'第 48 列，第 32 行');
});

for(const drag of [false,true])test(`valid selection ends a pending ${drag?'stroke':'tap'} and ignores its trailing events`,async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');const empty=board(h);pointer(h,'pointerdown',2,4);if(drag)pointer(h,'pointermove',5,4);const cells=board(h),before=preserved(h);
 select(h,48,32);assert.deepEqual(board(h),cells);assert.deepEqual(preserved(h),before);
 for(const action of ['pointermove','pointerup','click'])pointer(h,action,9,4);assert.deepEqual(board(h),cells);assert.equal(selected(h),'第 48 列，第 32 行');
 if(drag){click(h,'life-undo-edit');assert.deepEqual(board(h),empty);}
});

test('invalid selection does not cancel a captured stroke or replace its undo',async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');pointer(h,'pointerdown',2,4);pointer(h,'pointermove',5,4);target(h,49,32);const before=state(h);click(h,'life-position');assert.deepEqual(state(h),before);
 pointer(h,'pointermove',9,4);pointer(h,'pointerup',9,4);pointer(h,'click',9,4);assert.equal(board(h).reduce((n,v)=>n+v,0),8);click(h,'life-undo-edit');assert.equal(board(h).reduce((n,v)=>n+v,0),0);
});

for(const context of [false,true])test(`exact selection works through ${context?'lost':'absent'} bitmap and restores its unchanged board`,async()=>{
 const h=await setup('?experiment=life','',true,1,context);if(context)h.loseContext();const before=preserved(h);select(h,48,32);assert.equal(selected(h),'第 48 列，第 32 行');assert.deepEqual(preserved(h),before);assert.equal(h.frames.size,0);
 h.setContextReady(true);if(context)h.restoreContext();else click(h,'canvas-retry');assert.equal(selected(h),'第 48 列，第 32 行');assert.match(text(h,'metrics'),/10 个活格子/);const cells=board(h);h.resize(0,0);select(h,1,1);h.resize(259.5,240.25);h.setDpr(2);h.resize(600,414);assert.deepEqual(board(h),cells);assert.equal(selected(h),'第 1 列，第 1 行');
});

test('a completed discovery and parameter-only share remain untouched by direct selection',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);click(h,'mission-check');assert.equal(text(h,'notes-count'),'1 / 5');await click(h,'share');const before=preserved(h),cells=board(h);
 select(h,1,1);assert.deepEqual(preserved(h),before);assert.deepEqual(board(h),cells);assert.equal(text(h,'notes-count'),'1 / 5');
 click(h,'tab-wave');click(h,'tab-life');assert.equal(selected(h),'第 1 列，第 1 行');assert.deepEqual({...preserved(h),writes:before.writes},before);assert.deepEqual(board(h),cells);
});

test('selection supersedes an old image announcement, while an inert stale-world activation does not alter that world',async()=>{
 const h=await setup('?experiment=life');let finish;h.el('canvas').toBlob=callback=>finish=callback;const pending=click(h,'save');select(h,48,32);const message=text(h,'announcement');finish(new Blob(['png']));await pending;assert.equal(text(h,'announcement'),message);
 for(const world of ['orbit','wave','fractal','walk']){click(h,'tab-'+world);const before=state(h),message=text(h,'announcement');click(h,'life-position');assert.deepEqual(state(h),before);assert.equal(text(h,'announcement'),message);}
});

test('exact targets stay in optional instruments with labels, quiet errors and wrapping 44px controls',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const inspector=html.slice(html.indexOf('<section id="life-inspector"'),html.indexOf('<section id="wave-components"'));
 assert.ok(html.indexOf('id="life-target-column"')>html.indexOf('id="instrument-summary"'));
 for(const axis of ['column','row']){assert.match(inspector,new RegExp(`<label for="life-target-${axis}">目标`));assert.match(inspector,new RegExp(`id="life-target-${axis}" type="text" inputmode="numeric"[^>]*aria-describedby="life-cell-position life-position-help life-position-error"`));}
 assert.match(inspector,/<p id="life-position-error" aria-live="off" hidden>/);assert.match(inspector,/只移动橙框，不点亮或熄灭格子/);assert.match(inspector,/上方读数显示当前框选/);
 assert.match(css,/\.life-position-fields\{[^}]*flex-wrap:wrap/);assert.match(css,/\.life-position input\{[^}]*min-height:44px/);assert.match(css,/\.life-position button\{[^}]*min-height:44px/);assert.match(css,/\.life-position #life-position-help\{[^}]*overflow-wrap:anywhere/);
 assert.match(html,/cell-position=exact-1/);
});
