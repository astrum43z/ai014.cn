import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
const click=(h,id)=>h.el(id).handlers.click();
const input=(h,axis)=>h.el('life-target-'+axis);
const values=h=>['column','row'].map(a=>input(h,a).value);
const fill=h=>click(h,'life-use-current');
function position(h,column,row){for(const [axis,value] of [['column',column],['row',row]]){input(h,axis).value=String(value);input(h,axis).handlers.input();}click(h,'life-position');}
function key(el,extra={}){let prevented=false;el.handlers.keydown({key:'Enter',repeat:false,preventDefault(){prevented=true;},...extra});return prevented;}
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),frames:[...h.frames.keys()],status:h.el('status').textContent,pause:h.el('pause').textContent,metrics:h.el('metrics').textContent,selection:h.el('life-cell-position').textContent,cell:['state','next','reason'].map(x=>h.el('life-cell-'+x).textContent),history:h.el('history-line').getAttribute('points'),caption:h.el('history-caption').textContent,turnover:h.el('life-turnover').textContent,trial:h.el('life-test-result').textContent,trialHidden:h.el('life-return').hidden,edit:h.el('life-undo-edit').getAttribute('aria-disabled'),clear:h.el('life-undo-clear').getAttribute('aria-disabled'),url:location.href,writes:h.writes(),notes:h.el('notes-text').value,link:h.el('share-link').value});
function board(h){const result=new Uint8Array(1536);let color;const r=h.el('canvas').getBoundingClientRect();for(const [name,...args] of h.drawing()){if(name==='fillStyle')color=args[0];if(name==='fillRect'&&color==='#d3f35b')result[Math.round((args[1]-.6)/(r.height/32))*48+Math.round((args[0]-.6)/(r.width/48))]=1;}return result;}
function evolve(cells){return cells.map((alive,i)=>{const x=i%48,y=Math.floor(i/48);let count=0;for(const dy of [-1,0,1])for(const dx of [-1,0,1])if(dx||dy)count+=cells[((y+dy+32)%32)*48+(x+dx+48)%48];return Number(count===3||(alive&&count===2));});}
function pointer(h,type,x,y){h.el('canvas').handlers[type]({type,pointerId:7,isPrimary:true,button:0,buttons:['pointerdown','pointermove'].includes(type)?1:0,clientX:(x+.5)*600/48,clientY:(y+.5)*414/32,detail:type==='click'?1:0});}
test('all 1536 current cells fill exact 1-based drafts without moving, drawing or changing history',async()=>{
 const h=await setup('?experiment=life');let selects=0;input(h,'column').select=()=>selects++;
 for(let row=1;row<=32;row++)for(let column=1;column<=48;column++){
  position(h,column,row);input(h,'column').value='old';input(h,'row').value='old';const before=state(h);fill(h);
  assert.deepEqual(values(h),[String(column),String(row)]);assert.deepEqual(state(h),before);assert.equal(document.activeElement,input(h,'column'));
  assert.equal(h.el('announcement').textContent,`已填入当前框选：第 ${column} 列，第 ${row} 行；仅替换目标输入，实验状态未改变。`);
 }assert.equal(selects,1536);
});
test('living-cell navigation can become the draft for a single-axis edit',async()=>{
 const h=await setup('?experiment=life');click(h,'life-next-live');assert.equal(h.el('life-cell-position').textContent,'第 12 列，第 7 行');fill(h);assert.deepEqual(values(h),['12','7']);
 input(h,'row').value='8';input(h,'row').handlers.input();assert.equal(key(input(h,'row')),true);assert.equal(h.el('life-cell-position').textContent,'第 12 列，第 8 行');
 click(h,'life-left');fill(h);assert.deepEqual(values(h),['11','8']);click(h,'life-center');fill(h);assert.deepEqual(values(h),['25','17']);
 position(h,48,32);click(h,'life-right');click(h,'life-down');fill(h);assert.deepEqual(values(h),['1','1']);
});
test('filling clears both obsolete errors but keeps range validation for the next edit',async()=>{
 const h=await setup('?experiment=life');position(h,48,32);position(h,'bad','33');assert.equal(h.el('life-position-error').hidden,false);const before=state(h);fill(h);assert.deepEqual(state(h),before);assert.deepEqual(values(h),['48','32']);
 for(const axis of ['column','row'])assert.equal(input(h,axis).getAttribute('aria-invalid'),'false');assert.equal(h.el('life-position-error').hidden,true);assert.equal(h.el('life-position-error').textContent,'');
 input(h,'row').value='33';input(h,'row').handlers.input();click(h,'life-position');assert.deepEqual(state(h),before);assert.equal(input(h,'row').getAttribute('aria-invalid'),'true');assert.equal(document.activeElement,input(h,'row'));
});
test('running continuity and fractional evolution remain identical, with an independent next-board oracle',async()=>{
 const h=await setup('?experiment=life&rate=1','',false);h.tick(0);for(let i=1;i<=15;i++)h.tick(i*50);const cells=board(h),before=state(h);fill(h);assert.deepEqual(state(h),before);assert.equal(h.frames.size,1);
 for(let i=16;i<=19;i++)h.tick(i*50);assert.deepEqual(board(h),cells);h.tick(1000);assert.deepEqual(board(h),evolve(cells));const after=state(h);
 const reference=await setup('?experiment=life&rate=1','',false);reference.tick(0);for(let i=1;i<=20;i++)reference.tick(i*50);assert.deepEqual(state(reference),after);
});
test('native fresh Enter and Space remain available; held Enter cannot refill or submit after focus moves',async()=>{
 const h=await setup('?experiment=life','',false),button=h.el('life-use-current');assert.equal(key(button,{repeat:true}),true);
 for(const extra of [{},{key:' '},{key:' ',repeat:true},{key:'Tab'},{key:'ArrowRight'}])assert.equal(key(button,extra),false);
 const before=state(h);fill(h);input(h,'column').value='13';assert.equal(key(input(h,'column'),{repeat:true}),true);assert.deepEqual(state(h),before);assert.equal(input(h,'column').value,'13');
 for(const extra of [{isComposing:true},{keyCode:229},{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true}])assert.equal(key(input(h,'column'),extra),false);assert.deepEqual(state(h),before);
 assert.equal(key(input(h,'column')),true);assert.equal(h.el('life-cell-position').textContent,'第 13 列，第 17 行');assert.equal(h.frames.size,0);
});
test('filled drafts persist through redraws, evolution, resets and every retained world',async()=>{
 const h=await setup('?experiment=life');position(h,48,32);fill(h);input(h,'column').value='４';click(h,'life-center');click(h,'step');click(h,'reset');
 for(const [w,t] of [[171,240],[259.5,281.75],[0,0],[600,414]])h.resize(w,t);h.setDpr(2);h.loseContext();h.restoreContext();h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);
 for(const world of ['orbit','wave','fractal','walk']){click(h,'tab-'+world);click(h,'tab-life');}assert.deepEqual(values(h),['４','32']);fill(h);assert.deepEqual(values(h),['25','17']);
});
test('inactive action cannot change another world, errors, focus, feedback or drafts',async()=>{
 const h=await setup('?experiment=life');position(h,'bad','bad');for(const world of ['orbit','wave','fractal','walk']){click(h,'tab-'+world);h.el('tab-'+world).focus();const before={...state(h),draft:values(h),focus:document.activeElement.id,error:h.el('life-position-error').textContent,feedback:h.el('announcement').textContent};fill(h);assert.deepEqual({...state(h),draft:values(h),focus:document.activeElement.id,error:h.el('life-position-error').textContent,feedback:h.el('announcement').textContent},before);}
});
test('edit undo, clear undo, comparison return and generation rewind survive draft filling',async()=>{
 const h=await setup('?experiment=life');click(h,'step');const cells=board(h),original=h.el('life-cell-position').textContent;click(h,'life-toggle');const edited=state(h);fill(h);assert.deepEqual(state(h),edited);click(h,'life-undo-edit');assert.deepEqual(board(h),cells);assert.equal(h.el('life-cell-position').textContent,original);
 click(h,'clear');const cleared=state(h);fill(h);assert.deepEqual(state(h),cleared);click(h,'life-undo-clear');assert.deepEqual(board(h),cells);
 click(h,'life-test');const trial=state(h);fill(h);assert.deepEqual(state(h),trial);click(h,'life-return');assert.deepEqual(board(h),cells);
 click(h,'step');fill(h);click(h,'life-back');assert.deepEqual(board(h),cells);
});
for(const drag of [false,true])test(`filling does not interrupt a captured ${drag?'stroke':'tap'} or change its undo`,async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');pointer(h,'pointerdown',2,4);if(drag)pointer(h,'pointermove',5,4);const before=state(h);fill(h);assert.deepEqual(state(h),before);assert.deepEqual(values(h),[drag?'6':'24',drag?'5':'16']);
 pointer(h,'pointermove',9,4);pointer(h,'pointerup',9,4);pointer(h,'click',9,4);const cells=board(h);assert.equal(cells.reduce((a,b)=>a+b,0),8);click(h,'life-undo-edit');assert.equal(board(h).reduce((a,b)=>a+b,0),0);
});
for(const context of [false,true])test(`filling uses the live selection through ${context?'lost':'absent'} bitmap and collapsed layout`,async()=>{
 const h=await setup('?experiment=life','',true,1,context);position(h,48,32);if(context)h.loseContext();h.resize(0,0);const before=state(h);fill(h);assert.deepEqual(state(h),before);assert.deepEqual(values(h),['48','32']);h.setContextReady(true);if(context)h.restoreContext();else click(h,'canvas-retry');h.resize(600,414);assert.equal(h.el('life-cell-position').textContent,'第 48 列，第 32 行');
});
test('filling preserves discoveries and parameter sharing, superseding only obsolete asynchronous feedback',async()=>{
 let resolve;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(r=>resolve=r)}}});
 try{const h=await setup('?experiment=life');click(h,'mission-start');fill(h);assert.equal(h.el('notes-count').textContent,'0 / 5');for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const pending=click(h,'share');const before=state(h);fill(h);assert.deepEqual(state(h),before);const message=h.el('announcement').textContent;resolve();await pending;assert.equal(h.el('announcement').textContent,message);
  let finish;h.el('canvas').toBlob=callback=>finish=callback;click(h,'save');fill(h);const newest=h.el('announcement').textContent;finish(null);assert.equal(h.el('announcement').textContent,newest);
  for(const world of ['fractal','walk']){click(h,'tab-'+world);for(const repeat of [false,true]){assert.equal(key(h.el('step'),{repeat}),false);click(h,'step');}assert.match(h.el('metrics').textContent,world==='fractal'?/500 个点/:/48 步/);}
 }finally{delete globalThis.navigator;}
});
test('the explicit fill action stays in optional instruments, describes replacement and uses wrapping native targets',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<div class="coordinate-actions"><button id="life-use-current" type="button" aria-controls="life-target-column life-target-row" aria-describedby="life-position-help">填入当前行列<\/button><button id="life-position"/);
 assert.ok(html.indexOf('id="life-use-current"')>html.indexOf('id="instrument-summary"'));
 const help=html.match(/<small id="life-position-help">(.*?)<\/small>/)[1];assert.match(help,/替换两个目标并选中目标列/);assert.match(help,/不暂停、移动框选或改变图案/);
 assert.match(css,/\.coordinate-actions\{display:flex;flex-wrap:wrap;gap:8px\}/);assert.match(css,/\.coordinate-actions button\{flex:1 1 150px;max-width:100%;white-space:normal;overflow-wrap:anywhere\}/);assert.match(css,/\.life-position button\{[^}]*min-height:44px/);assert.match(html,/life-draft=current-1/);
});
