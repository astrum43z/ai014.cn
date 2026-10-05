import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const generation=h=>Number(h.el('metrics').textContent.match(/^第 (\d+) 代/)[1]);
const batch=h=>click(h,'life-back-batch');
const available=h=>h.el('life-back-batch').getAttribute('aria-disabled')==='false';
const choose=(h,name)=>{h.el('preset-select').handlers.change({target:{value:name}});click(h,'load-preset');};
function board(h,w=600,z=414){
 const result=Array(1536).fill(0),cw=w/48,ch=z/32;
 for(const c of h.drawing())if(c[0]==='fillRect'&&Math.abs(c[3]-Math.max(1,cw-1.2))<1e-9&&Math.abs(c[4]-Math.max(1,ch-1.2))<1e-9){
  const x=Math.round((c[1]-.6)/cw),y=Math.round((c[2]-.6)/ch);assert.ok(x>=0&&x<48&&y>=0&&y<32);result[y*48+x]=1;
 }
 return result;
}
// Independent whole-board toroidal oracle; no application model imports.
function next(before){return before.map((alive,i)=>{
 let neighbors=0;for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)if(x||y)neighbors+=before[((Math.floor(i/48)+y+32)%32)*48+(i%48+x+48)%48];
 return Number(neighbors===3||(alive&&neighbors===2));
});}
const history=h=>[h.el('history-line').getAttribute('points'),h.el('history-caption').textContent];
const state=h=>({board:h.drawing(),metrics:h.el('metrics').textContent,history:history(h),message:h.el('announcement').textContent,status:h.el('status').textContent,frames:[...h.frames.keys()],url:location.href,writes:h.writes(),draws:h.drawCount(),focus:document.activeElement?.id});

test('one recorded batch replaces ten presses and resumes the same independently evolved boards',async()=>{
 for(const preset of ['glider','blinker','pulsar']){
  const h=await setup('?experiment=life');choose(h,preset);const boards=[board(h)],histories=[history(h)];
  for(let i=1;i<=24;i++){boards.push(next(boards.at(-1)));click(h,'step');assert.deepEqual(board(h),boards[i]);histories.push(history(h));}
  h.el('life-back-batch').focus();batch(h);assert.equal(generation(h),14);assert.deepEqual(board(h),boards[14]);assert.deepEqual(history(h),histories[14]);assert.equal(document.activeElement,h.el('life-back-batch'));assert.equal(h.frames.size,0);
  assert.match(h.el('announcement').textContent,/已暂停并退回 10 代；第 14 代/);
  for(let i=15;i<=24;i++){click(h,'step');assert.deepEqual(board(h),boards[i]);}
  batch(h);batch(h);assert.equal(generation(h),4);batch(h);assert.equal(generation(h),0);assert.deepEqual(board(h),boards[0]);assert.match(h.el('announcement').textContent,/退回 4 代/);assert.equal(available(h),false);
  const before=state(h);batch(h);assert.deepEqual(state(h),before);
 }
});

test('running and paused initial boundaries do nothing; one to nine records form a partial batch',async()=>{
 for(const reduced of [true,false]){
  const h=await setup('?experiment=life','',reduced);h.el('life-back-batch').focus();assert.equal(available(h),false);const before=state(h);batch(h);assert.deepEqual(state(h),before);
 }
 for(let n=1;n<=9;n++){
  const h=await setup('?experiment=life');const initial=board(h);for(let i=0;i<n;i++)click(h,'step');batch(h);assert.equal(generation(h),0);assert.deepEqual(board(h),initial);assert.match(h.el('announcement').textContent,new RegExp(`退回 ${n} 代`));
 }
});

test('the 120-observation cap permits eleven full batches and a final nine-generation return',async()=>{
 const h=await setup('?experiment=life&rate=20','',false);choose(h,'glider');let expected=board(h);const boards=[expected];
 h.tick(0);for(let i=1;i<=124;i++){expected=next(expected);boards.push(expected);h.tick(i*50);assert.deepEqual(board(h),expected);}
 assert.equal(generation(h),124);assert.equal(history(h)[0].split(' ').length,120);
 for(let n=114;n>=14;n-=10){batch(h);assert.equal(generation(h),n);assert.deepEqual(board(h),boards[n]);}
 batch(h);assert.equal(generation(h),5);assert.deepEqual(board(h),boards[5]);assert.equal(history(h)[0].split(' ').length,1);assert.equal(available(h),false);
 const before=state(h);batch(h);assert.deepEqual(state(h),before);click(h,'step');assert.deepEqual(board(h),boards[6]);
});

test('record gaps stop a batch instead of inventing skipped history, with a ten-entry scan bound',()=>{
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const implementation=source.slice(source.indexOf('function rewindLifeGenerations('),source.indexOf("for(const [id,limit] of [['life-back',1]"));
 for(const [records,current,expected,steps] of [[[0,1,2,7,8,9],9,7,2],[[1,2,10],10,10,0],[Array.from({length:120},(_,i)=>i),119,109,10]]){
  let draws=0,announced='';const context={mode:'life',generation:current,lifeHistory:records.map(n=>({generation:n,key:String(n%2)})),cells:new Uint8Array([current%2]),acc:.4,paused:false,lifeTrial:'trial',lifeCleared:'clear',lifeEdited:'edit',Uint8Array,Number,cancelPainting(){},updatePause(){},draw(){draws++;},announce(s){announced=s;},observationReading:()=>''};
  vm.runInNewContext(implementation+'\nrewindLifeGenerations(10);',context);
  assert.equal(context.generation,expected);assert.equal(context.lifeHistory.at(-1).generation,expected);assert.equal(draws,Number(steps>0));assert.equal(context.acc,steps?0:.4);assert.equal(context.paused,steps>0);assert.equal(announced,steps?`已暂停并退回 ${steps} 代；`:'');
 }
});

test('rewind clears fractional animation time, pauses once and never catches up during absence',async()=>{
 const h=await setup('?experiment=life&rate=1','',false);choose(h,'glider');const initial=board(h);h.tick(0);
 for(let ms=50;ms<=3950;ms+=50)h.tick(ms);assert.equal(generation(h),3);batch(h);assert.equal(generation(h),0);assert.deepEqual(board(h),initial);assert.equal(h.frames.size,0);
 click(h,'pause');h.tick(60000);for(let ms=60050;ms<=60950;ms+=50)h.tick(ms);assert.equal(generation(h),0);h.tick(61000);assert.equal(generation(h),1);assert.deepEqual(board(h),next(initial));
});

test('extinction rewinds recorded cells; edits and replacement actions establish hard boundaries',async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');click(h,'life-toggle');const alive=board(h);for(let i=0;i<5;i++)click(h,'step');assert.equal(board(h).reduce((a,b)=>a+b),0);batch(h);assert.deepEqual(board(h),alive);
 for(const replace of [h=>click(h,'life-toggle'),h=>h.key('Enter'),h=>click(h,'clear'),h=>click(h,'reset'),h=>choose(h,'glider'),h=>click(h,'preset'),h=>click(h,'guide-start'),h=>click(h,'mission-start'),h=>click(h,'life-challenge-start'),h=>h.navigate('?experiment=life&rate=3&density=20')]){
  const h=await setup('?experiment=life');for(let i=0;i<4;i++)click(h,'step');replace(h);assert.equal(available(h),false);const before=state(h);batch(h);assert.deepEqual(state(h),before);click(h,'step');batch(h);assert.equal(h.el('metrics').textContent,before.metrics);
 }
});

test('clear and edit undo restore recorded batches; valid rewind exits the same one-level recoveries',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');const initial=board(h);for(let i=0;i<12;i++)click(h,'step');const evolved=board(h),caption=history(h);
 click(h,'clear');assert.equal(available(h),false);click(h,'life-undo-clear');assert.deepEqual(board(h),evolved);assert.deepEqual(history(h),caption);assert.equal(available(h),true);
 click(h,'life-toggle');assert.equal(available(h),false);click(h,'life-undo-edit');assert.deepEqual(board(h),evolved);assert.deepEqual(history(h),caption);
 click(h,'life-test');assert.equal(h.el('life-return').hidden,false);batch(h);assert.equal(generation(h),3);assert.deepEqual(board(h),initial);assert.equal(h.el('life-return').hidden,true);assert.equal(h.el('life-undo-clear').getAttribute('aria-disabled'),'true');assert.equal(h.el('life-undo-edit').getAttribute('aria-disabled'),'true');
});

test('batch retains selected cell, target drafts, errors, parameters and fixed shared worlds',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,.125');click(h,'step');click(h,'observation-return');const saved=h.el('saved-observation-reading').textContent;click(h,'tab-life');for(let i=0;i<12;i++)click(h,'step');
 click(h,'life-right');click(h,'life-down');const selected=h.el('life-selection').textContent.split(' · ')[0];h.el('life-column').value='bad';h.el('life-row').value='7';click(h,'life-position');const error=h.el('life-position-error').textContent;
 h.el('rate').handlers.input({target:{value:'20'}});h.el('density').handlers.input({target:{value:'60'}});const url=location.href,writes=h.writes();batch(h);assert.equal(generation(h),2);assert.equal(h.el('life-selection').textContent.split(' · ')[0],selected);assert.equal(h.el('life-column').value,'bad');assert.equal(h.el('life-row').value,'7');assert.equal(h.el('life-position-error').textContent,error);assert.equal(h.el('rate').value,'20');assert.equal(h.el('density').value,'60');assert.equal(location.href,url);assert.equal(h.writes(),writes);
 click(h,'tab-wave');assert.equal(h.el('saved-observation-reading').textContent,saved);click(h,'observation-undo');assert.match(h.el('wave-time-current').textContent,/0.6485987755982988/);
});

test('world returns, same-query history, drawing recovery and fractional reflow retain exact boards',async()=>{
 const h=await setup('?experiment=life');choose(h,'glider');const boards=[board(h)];for(let i=1;i<=12;i++){boards.push(next(boards.at(-1)));click(h,'step');}
 for(const world of ['orbit','wave','fractal','walk']){click(h,'tab-'+world);assert.equal(h.el('life-back-batch').hidden,true);assert.equal(h.el('life-batch-help').hidden,true);const before=state(h);batch(h);assert.deepEqual(state(h),before);click(h,'tab-life');assert.equal(h.el('life-back-batch').hidden,false);}
 h.navigate(location.search+'#canvas');h.setVisible(false);h.setVisible(true);h.setHidden(true);h.setHidden(false);h.loseContext();h.restoreContext();h.setDpr(2);h.resize(163,240);batch(h);assert.equal(generation(h),2);assert.deepEqual(board(h,163,240),boards[2]);h.resize(259.5,240.25);assert.deepEqual(board(h,259.5,240.25),boards[2]);click(h,'step');assert.deepEqual(board(h,259.5,240.25),boards[3]);
});

test('text-only startup supports recorded batches before drawing is restored',async()=>{
 for(const context of [false,'throw']){
  const h=await setup('?experiment=life','',true,1,context);for(let i=0;i<12;i++)click(h,'step');batch(h);assert.equal(generation(h),2);assert.equal(h.drawCount(),0);h.setContextReady(true);click(h,'canvas-retry');const actual=board(h);h.resize(0,0);h.resize(600,414);assert.deepEqual(board(h),actual);click(h,'step');assert.deepEqual(board(h),next(actual));
 }
});

test('rewind interrupts pointer capture and rejects every delayed event from that stroke',async()=>{
 const h=await setup('?experiment=life');for(let i=0;i<12;i++)click(h,'step');const captures=new Set(),canvas=h.el('canvas');canvas.setPointerCapture=id=>captures.add(id);canvas.hasPointerCapture=id=>captures.has(id);canvas.releasePointerCapture=id=>{captures.delete(id);canvas.handlers.lostpointercapture({type:'lostpointercapture',pointerId:id});};
 const event={pointerId:7,button:0,buttons:1,isPrimary:true,clientX:20,clientY:20};canvas.handlers.pointerdown(event);assert.equal(captures.size,1);batch(h);assert.equal(captures.size,0);assert.equal(generation(h),2);const after=state(h);
 canvas.handlers.pointermove({...event,clientX:200});canvas.handlers.pointerup({...event,type:'pointerup',clientX:200});canvas.handlers.click({...event,detail:1,clientX:200});assert.deepEqual(state(h),after);
});

test('held Enter cannot consume another batch; native fresh Enter, Space and editing keys remain available',async()=>{
 const h=await setup('?experiment=life');for(let i=0;i<24;i++)click(h,'step');h.el('life-back-batch').focus();
 let prevented=false;h.el('life-back-batch').handlers.keydown({key:'Enter',repeat:false,preventDefault(){prevented=true;}});assert.equal(prevented,false);batch(h);assert.equal(generation(h),14);const before=state(h);
 for(let i=0;i<12;i++){prevented=false;h.el('life-back-batch').handlers.keydown({key:'Enter',repeat:true,preventDefault(){prevented=true;}});assert.equal(prevented,true);}assert.deepEqual(state(h),before);
 for(const key of [' ','Tab','Escape','ArrowRight'])for(const repeat of [false,true])h.el('life-back-batch').handlers.keydown({key,repeat,preventDefault(){assert.fail('native key consumed');}});
 batch(h);assert.equal(generation(h),4);click(h,'life-back');assert.equal(generation(h),3);
 for(const world of ['fractal','walk']){click(h,'tab-'+world);for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional batch repetition blocked');}});click(h,'step');}assert.match(h.el('metrics').textContent,world==='fractal'?/500 个点/:/48 步/);}
});

test('batch navigation never awards discoveries or lets an older copy replace its feedback',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 for(let i=0;i<12;i++)click(h,'step');batch(h);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;
 let resolve;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(r=>resolve=r)}}});
 try{const pending=click(h,'share');batch(h);const message=h.el('announcement').textContent;resolve();await pending;assert.equal(h.el('announcement').textContent,message);assert.equal(h.el('notes-text').value,notes);assert.equal(new URL(h.el('share-link').value).searchParams.has('at'),false);}finally{delete globalThis.navigator;}
});

test('native batch control describes boundaries and inherits a wrapping 44-pixel minimum target',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<button id="life-back-batch" aria-disabled="true" aria-describedby="life-rewind-status life-batch-help" hidden>退回最多 10 代<\/button>/);assert.match(html,/<p id="life-batch-help" class="canvas-pause-help" hidden>.*已有的相邻记录边界.*移除后续观测.*按住 Enter 只回看一次/);
 assert.match(css,/#life-back-batch\{min-height:44px;white-space:normal\}/);assert.match(css,/\.stage-controls\{[^}]*flex-wrap:wrap/);assert.equal((html.match(/life-batch=recorded-1/g)||[]).length,2);
});
