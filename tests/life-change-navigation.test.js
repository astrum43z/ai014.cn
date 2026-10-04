import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const id='life-next-change',click=(h,name=id)=>h.el(name).handlers.click();
const selected=h=>{const m=h.el('life-selection').textContent.match(/第 (\d+) 列，第 (\d+) 行/);return (Number(m[2])-1)*48+Number(m[1])-1;};
function board(h){
 const r=h.el('canvas').getBoundingClientRect(),result=new Uint8Array(1536);let color;
 for(const [name,...args] of h.drawing()){
  if(name==='fillStyle')color=args[0];
  if(name==='fillRect'&&color==='#d3f35b')result[Math.round((args[1]-.6)/(r.height/32))*48+Math.round((args[0]-.6)/(r.width/48))]=1;
 }return result;
}
function evolve(before){return before.map((alive,i)=>{
 const x=i%48,y=Math.floor(i/48);let count=0;
 for(const dy of [-1,0,1])for(const dx of [-1,0,1])if(dx||dy)count+=before[((y+dy+32)%32)*48+(x+dx+48)%48];
 return Number(count===3||(alive&&count===2));
});}
const changes=(before,after)=>Array.from(before.keys()).filter(i=>before[i]!==after[i]);
const available=(h,value)=>assert.equal(h.el(id).getAttribute('aria-disabled'),String(!value));
function preset(h,value){h.el('preset-select').handlers.change({target:{value}});click(h,'load-preset');}
function tap(h,x,y){const r=h.el('canvas').getBoundingClientRect();h.el('canvas').handlers.click({detail:0,clientX:(x+.5)*r.width/48,clientY:(y+.5)*r.height/32});}
function pointer(h,type,x,y,pointerId=7){h.el('canvas').handlers[type]({type,pointerId,isPrimary:true,button:0,buttons:type==='pointerdown'||type==='pointermove'?1:0,clientX:(x+.5)*600/48,clientY:(y+.5)*414/32,detail:type==='click'?1:0});}
const preserved=h=>({board:board(h),metrics:h.el('metrics').textContent,history:h.el('history-line').getAttribute('points'),caption:h.el('history-caption').textContent,turnover:h.el('life-turnover').textContent,trial:h.el('life-test-result').textContent,trialHidden:h.el('life-return').hidden,undo:h.el('life-undo-edit').getAttribute('aria-disabled'),clear:h.el('life-undo-clear').getAttribute('aria-disabled'),url:location.href,writes:h.writes(),mission:h.el('mission-result').textContent,notes:h.el('field-notes-list').innerHTML});
const complete=h=>({...preserved(h),selection:selected(h),message:h.el('announcement').textContent,status:h.el('status').textContent,draws:h.drawCount(),frames:[...h.frames.keys()]});
function checkCircuit(h,before,after){
 const changed=changes(before,after),unchanged=preserved(h);available(h,changed.length>0);
 assert.deepEqual(board(h),evolve(before));
 for(let step=0;step<changed.length+1;step++){
  const current=selected(h),next=changed.find(i=>i>current)??changed[0];click(h);
  assert.equal(selected(h),next);assert.deepEqual(preserved(h),unchanged);
  assert.match(h.el('life-cell-transition').textContent,after[next]?/原为空格.*因而诞生/:/原为活格.*因而消失/);
  assert.ok(h.el('announcement').textContent.includes(h.el('life-cell-transition').textContent));
 }
}

test('blinker navigation visits both births and deaths, excluding the surviving middle cell',async()=>{
 const h=await setup('?experiment=life');preset(h,'blinker');const before=board(h);click(h,'step');
 assert.match(h.el('life-change-help').textContent,/第 0 → 1 代有 4 处生灭/);
 h.el(id).focus();checkCircuit(h,before,board(h));assert.equal(document.activeElement,h.el(id));
 assert.notEqual(h.el(id).disabled,true);assert.equal(h.frames.size,0);
});

test('glider and pulsar navigation follows independently evolved boards over successive generations',async()=>{
 for(const name of ['glider','pulsar']){
  const h=await setup('?experiment=life');preset(h,name);
  for(let generation=1;generation<=4;generation++){const before=board(h);click(h,'step');checkCircuit(h,before,board(h));}
 }
});

test('wrapped edge changes follow board row order and wrap to the first actual change',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');for(const p of [[47,31],[0,31],[1,31]])tap(h,...p);
 const before=board(h);click(h,'step');checkCircuit(h,before,board(h));
 assert.deepEqual(changes(before,board(h)),[0,1440,1489,1535]);
});

test('an extinct board still offers its sole death, including a full circuit back to itself',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');tap(h,0,0);click(h,'step');
 assert.equal(board(h).reduce((a,b)=>a+b,0),0);assert.equal(h.el('life-next-live').getAttribute('aria-disabled'),'true');available(h,true);
 click(h,'life-center');click(h);assert.equal(selected(h),0);const saved=preserved(h);click(h);
 assert.match(h.el('announcement').textContent,/只有这一处生灭/);assert.match(h.el('life-cell-transition').textContent,/0 个活邻居.*因而消失/);assert.deepEqual(preserved(h),saved);
 click(h,'step');available(h,false);assert.match(h.el('life-change-help').textContent,/第 1 → 2 代没有/);
});

test('absent history and unchanged live or empty boards are strict no-ops, even while running',async()=>{
 const h=await setup('?experiment=life');available(h,false);assert.match(h.el('life-change-help').textContent,/暂无相邻上一代/);
 for(const shape of ['initial','empty','block']){
  if(shape!=='initial'){click(h,'clear');if(shape==='block')for(const p of [[23,15],[24,15],[23,16],[24,16]])tap(h,...p);click(h,'step');}
  available(h,false);h.el(id).focus();
  for(const running of [false,true]){if(running)click(h,'pause');const before=complete(h);click(h);click(h);assert.deepEqual(complete(h),before);assert.equal(document.activeElement,h.el(id));if(running)click(h,'pause');}
 }
});

test('rewind and identical replay update destinations, and the oldest retained record has none',async()=>{
 const h=await setup('?experiment=life');preset(h,'blinker');click(h,'step');const first=board(h);click(h,'step');const second=board(h);
 click(h,'life-back');assert.deepEqual(board(h),first);available(h,true);click(h);const selectedFirst=selected(h);
 click(h,'step');checkCircuit(h,first,second);click(h,'life-back');assert.deepEqual(board(h),first);click(h);
 assert.ok(changes(second,first).includes(selected(h)));assert.ok(changes(second,first).includes(selectedFirst));
 for(let i=1;i<124;i++)click(h,'step');for(let i=0;i<119;i++)click(h,'life-back');
 available(h,false);const before=complete(h);click(h);assert.deepEqual(complete(h),before);
});

test('edits, clear and their undo respect comparison boundaries without discarding recovery',async()=>{
 const h=await setup('?experiment=life');preset(h,'blinker');click(h,'step');const original=preserved(h);
 click(h,'life-toggle');available(h,false);let before=complete(h);click(h);assert.deepEqual(complete(h),before);
 click(h,'life-undo-edit');available(h,true);assert.deepEqual(preserved(h),original);click(h);
 click(h,'clear');available(h,false);before=complete(h);click(h);assert.deepEqual(complete(h),before);
 click(h,'life-undo-clear');available(h,true);assert.deepEqual(preserved(h),original);
 for(const action of ['reset','guide-start','life-challenge-start']){click(h,action);available(h,false);}
});

test('construction trials navigate their retained original board and return exactly',async()=>{
 const h=await setup('?experiment=life');preset(h,'blinker');click(h,'step');const original=preserved(h),selection=selected(h),before=board(h);
 click(h,'life-test');checkCircuit(h,before,board(h));click(h,'life-return');
 assert.deepEqual(preserved(h),original);assert.equal(selected(h),selection);available(h,true);
 click(h,'clear');click(h,'life-test');available(h,false);const saved=complete(h);click(h);assert.deepEqual(complete(h),saved);
});

test('navigation pauses without resetting the fractional generation or its next deterministic step',async()=>{
 const h=await setup('?experiment=life&rate=1');preset(h,'blinker');click(h,'step');const before=board(h);click(h,'pause');h.tick(0);for(let i=1;i<=15;i++)h.tick(i*50);
 const original=preserved(h);click(h);assert.deepEqual(preserved(h),original);assert.equal(h.frames.size,0);
 click(h,'pause');h.tick(800);for(let i=17;i<=20;i++)h.tick(i*50);assert.deepEqual(board(h),before);
 h.tick(1050);assert.deepEqual(board(h),evolve(before));
});

test('successful navigation interrupts a pending tap or unchanged stroke and suppresses its trailing click',async()=>{
 for(const drag of [false,true]){
  const h=await setup('?experiment=life');preset(h,'blinker');click(h,'step');click(h,'life-erase');
  pointer(h,'pointerdown',0,0);if(drag)pointer(h,'pointermove',1,0);available(h,true);
  click(h);const saved=complete(h);pointer(h,'pointerup',1,0);pointer(h,'click',1,0);assert.deepEqual(complete(h),saved);
 }
});

test('an unavailable activation leaves an edited in-progress stroke and its undo intact',async()=>{
 const h=await setup('?experiment=life');preset(h,'blinker');click(h,'step');const original=board(h);
 pointer(h,'pointerdown',0,0);pointer(h,'pointermove',1,0);available(h,false);const before=complete(h);click(h);assert.deepEqual(complete(h),before);
 pointer(h,'pointermove',2,0);pointer(h,'pointerup',2,0);assert.equal(board(h)[2],1);click(h,'life-undo-edit');assert.deepEqual(board(h),original);available(h,true);
});

test('quiet redraws repair stale attributes but retain unchanged text and live feedback',async()=>{
 const h=await setup('?experiment=life');preset(h,'blinker');click(h,'step');click(h);h.el(id).focus();
 const message=h.el('announcement').textContent,help=h.el('life-change-help');let value=help.textContent,writes=0,attributes=0;
 Object.defineProperty(help,'textContent',{get:()=>value,set:v=>{value=v;writes++;}});const set=h.el(id).setAttribute;
 h.el(id).setAttribute=function(...args){attributes++;return set.apply(this,args);};
 const saved=preserved(h),selection=selected(h);
 for(let i=0;i<120;i++)h.resize(600,414);
 h.resize(233,260);h.setDpr(2);h.setDpr(1);h.resize(600,414);h.loseContext();h.restoreContext();h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);
 assert.equal(writes,0);assert.equal(attributes,0);assert.deepEqual(preserved(h),saved);assert.equal(selected(h),selection);assert.equal(h.el('announcement').textContent,message);assert.equal(document.activeElement,h.el(id));
 help.textContent='stale';h.el(id).attributes['aria-disabled']='true';h.resize(600,414);assert.notEqual(help.textContent,'stale');available(h,true);assert.equal(attributes,1);
});

test('retained worlds, parameter changes and native anchor history preserve current evidence',async()=>{
 const h=await setup('?experiment=life');preset(h,'blinker');click(h,'step');click(h);const original=board(h),selection=selected(h);
 for(const world of ['orbit','wave','fractal','walk']){click(h,'tab-'+world);const inactive=complete(h);click(h);assert.deepEqual(complete(h),inactive);click(h,'tab-life');available(h,true);assert.deepEqual(board(h),original);assert.equal(selected(h),selection);}
 h.el('rate').handlers.input({target:{value:'20'}});h.el('density').handlers.input({target:{value:'60'}});available(h,true);assert.deepEqual(board(h),original);
 h.navigate(location.search+'#observation-title');available(h,true);h.navigate('?experiment=life&rate=1&density=20');available(h,false);
});

test('text-only startup supports navigation and restores the same selection with the canvas',async()=>{
 const h=await setup('?experiment=life','',true,1,false);preset(h,'blinker');click(h,'step');available(h,true);click(h);
 const selection=selected(h),message=h.el('life-cell-transition').textContent;h.setContextReady(true);click(h,'canvas-retry');
 assert.equal(selected(h),selection);assert.equal(h.el('life-cell-transition').textContent,message);assert.equal(board(h).reduce((a,b)=>a+b,0),3);
});

test('navigation cannot earn discoveries, change historical notes or rewrite fixed parameter links',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');for(const p of [[23,15],[24,15],[23,16],[24,16]])tap(h,...p);
 click(h);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 preset(h,'blinker');click(h,'step');await click(h,'share');const saved=preserved(h),link=h.el('share-link').value;
 for(let i=0;i<5;i++)click(h);assert.deepEqual(preserved(h),saved);assert.equal(h.el('share-link').value,link);
});

for(const success of [true,false])test(`a ${success?'successful':'failed'} old PNG cannot overwrite new navigation, but an unavailable activation stays quiet`,async()=>{
 const h=await setup('?experiment=life');preset(h,'blinker');click(h,'step');let finish;h.el('canvas').toBlob=callback=>{finish=callback;};
 click(h,'save');click(h);const message=h.el('announcement').textContent;finish(success?new Blob(['png']):null);assert.equal(h.el('announcement').textContent,message);assert.equal(h.el('save-status').hidden,false);
 click(h,'reset');click(h,'save');click(h);finish(success?new Blob(['png']):null);assert.match(h.el('announcement').textContent,success?/已发起.*PNG/:/失败/);
});

test('held Enter is ignored while native click and Space keep their normal activation path',async()=>{
 const h=await setup('?experiment=life');
 for(const [key,repeat,expected] of [['Enter',false,false],['Enter',true,true],[' ',true,false],['Tab',false,false]]){
  let prevented=false;h.el(id).handlers.keydown({key,repeat,preventDefault(){prevented=true;}});assert.equal(prevented,expected);
 }
});

test('a named quiet native control wraps independently of the directional grid with the existing stage focus ring',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<p class="life-change-actions"><button id="life-next-change" type="button" aria-controls="canvas" aria-disabled="true" aria-describedby="life-change-help">下一处生灭<\/button><small id="life-change-help" aria-live="off"><\/small><\/p>/);
 assert.equal((html.match(/id="life-next-change"/g)||[]).length,1);assert.equal((html.match(/&amp;change-browse=1/g)||[]).length,2);
 assert.match(css,/\.life-touch \.life-change-actions\{[^}]*flex-wrap:wrap/);assert.match(css,/\.life-touch #life-next-change\{[^}]*min-height:44px[^}]*overflow-wrap:anywhere/);
 assert.match(css,/\.stage,\.instrument-drawer\{--focus-ring:var\(--focus-on-dark\)\}/);
});
