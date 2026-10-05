import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
const click=(h,id)=>h.el(id).handlers.click();
const batch=h=>click(h,'life-forward-batch');
const generation=h=>Number(h.el('metrics').textContent.match(/^第 (\d+) 代/)[1]);
const choose=(h,name)=>{h.el('preset-select').handlers.change({target:{value:name}});click(h,'load-preset');};
function board(h,w=600,z=414){
 const result=Array(1536).fill(0),cw=w/48,ch=z/32;
 for(const c of h.drawing())if(c[0]==='fillRect'&&Math.abs(c[3]-Math.max(1,cw-1.2))<1e-9&&Math.abs(c[4]-Math.max(1,ch-1.2))<1e-9){
  const x=Math.round((c[1]-.6)/cw),y=Math.round((c[2]-.6)/ch);assert.ok(x>=0&&x<48&&y>=0&&y<32);result[y*48+x]=1;
 }
 return result;
}
// Independent simultaneous B3/S23 update, wrapping each axis of the board.
function next(before){return before.map((alive,i)=>{
 let neighbors=0;for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)if(x||y)neighbors+=before[((Math.floor(i/48)+y+32)%32)*48+(i%48+x+48)%48];
 return Number(neighbors===3||(alive&&neighbors===2));
});}
const history=h=>[h.el('history-line').getAttribute('points'),h.el('history-caption').textContent];
const state=h=>({drawing:h.drawing(),metrics:h.el('metrics').textContent,history:history(h),message:h.el('announcement').textContent,status:h.el('status').textContent,frames:[...h.frames.keys()],url:location.href,writes:h.writes(),draws:h.drawCount(),focus:document.activeElement?.id});

test('ten forward generations equal independent updates with one redraw and all intermediate returns',async()=>{
 for(const preset of ['glider','blinker','pulsar',null]){
  const h=await setup('?experiment=life');if(preset)choose(h,preset);const boards=[board(h)];for(let i=0;i<20;i++)boards.push(next(boards.at(-1)));
  h.el('life-forward-batch').focus();const draws=h.drawCount();batch(h);assert.equal(generation(h),10);assert.deepEqual(board(h),boards[10]);assert.equal(h.drawCount(),draws+1);assert.equal(document.activeElement,h.el('life-forward-batch'));assert.equal(h.frames.size,0);assert.match(h.el('announcement').textContent,/已暂停并前进 10 代；第 10 代/);
  assert.equal(history(h)[0].split(' ').length,11);assert.match(h.el('life-turnover').textContent,/第 9 → 10 代/);
  for(let n=9;n>=0;n--){click(h,'life-back');assert.equal(generation(h),n);assert.deepEqual(board(h),boards[n]);}
  batch(h);batch(h);assert.equal(generation(h),20);assert.deepEqual(board(h),boards[20]);click(h,'life-back-batch');assert.equal(generation(h),10);assert.deepEqual(board(h),boards[10]);click(h,'step');assert.deepEqual(board(h),boards[11]);
 }
});
test('population and periodic evidence match single stepping, including a three-generation oscillator',async()=>{
 for(const preset of ['glider','blinker','pulsar']){
  const ordinary=await setup('?experiment=life');choose(ordinary,preset);for(let n=0;n<10;n++)click(ordinary,'step');const expected=[history(ordinary),ordinary.el('observation-c').textContent,ordinary.el('life-turnover').textContent];
  const h=await setup('?experiment=life');choose(h,preset);batch(h);assert.deepEqual([history(h),h.el('observation-c').textContent,h.el('life-turnover').textContent],expected);
 }
});
test('120 observations remain bounded and every retained generation matches its independent board',async()=>{
 const h=await setup('?experiment=life');choose(h,'glider');const boards=[board(h)];for(let i=0;i<130;i++)boards.push(next(boards.at(-1)));
 for(let n=10;n<=130;n+=10){batch(h);assert.equal(generation(h),n);assert.deepEqual(board(h),boards[n]);assert.equal(history(h)[0].split(' ').length,Math.min(120,n+1));}
 for(let n=129;n>=11;n--){click(h,'life-back');assert.equal(generation(h),n);assert.deepEqual(board(h),boards[n]);}
 assert.equal(h.el('life-back').getAttribute('aria-disabled'),'true');const before=state(h);click(h,'life-back');assert.deepEqual(state(h),before);
});
test('running batch clears fractional evolution and resumes without elapsed-time catch-up',async()=>{
 const h=await setup('?experiment=life&rate=1','',false);choose(h,'glider');const boards=[board(h)];for(let i=0;i<12;i++)boards.push(next(boards.at(-1)));
 h.tick(0);for(let ms=50;ms<=950;ms+=50)h.tick(ms);assert.equal(generation(h),0);batch(h);assert.equal(generation(h),10);assert.deepEqual(board(h),boards[10]);assert.equal(h.frames.size,0);
 click(h,'pause');h.tick(60000);for(let ms=60050;ms<=60950;ms+=50)h.tick(ms);assert.equal(generation(h),10);h.tick(61000);assert.equal(generation(h),11);assert.deepEqual(board(h),boards[11]);
});
test('extinct and still boards advance exactly ten times rather than stopping early',async()=>{
 for(const living of [false,true]){
  const h=await setup('?experiment=life');click(h,'mission-start');if(living)for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
  const initial=board(h);batch(h);assert.equal(generation(h),10);assert.deepEqual(board(h),initial);assert.equal(history(h)[0].split(' ').length,11);click(h,'life-back-batch');assert.deepEqual(board(h),initial);assert.equal(generation(h),0);
 }
 const h=await setup('?experiment=life');click(h,'mission-start');click(h,'life-toggle');const initial=board(h);batch(h);assert.equal(generation(h),10);assert.equal(board(h).reduce((a,b)=>a+b),0);click(h,'life-back-batch');assert.deepEqual(board(h),initial);
});
test('edit, clear and replacement boundaries retain the new ten-generation segment; trial recovery ends',async()=>{
 for(const action of [h=>click(h,'life-toggle'),h=>click(h,'clear'),h=>click(h,'reset'),h=>choose(h,'pulsar'),h=>click(h,'mission-start')]){
  const h=await setup('?experiment=life');batch(h);action(h);const start=generation(h),initial=board(h);let expected=initial;for(let i=0;i<10;i++)expected=next(expected);batch(h);assert.equal(generation(h),start+10);assert.deepEqual(board(h),expected);assert.equal(h.el('life-undo-edit').getAttribute('aria-disabled'),'true');assert.equal(h.el('life-undo-clear').getAttribute('aria-disabled'),'true');click(h,'life-back-batch');assert.equal(generation(h),start);assert.deepEqual(board(h),initial);assert.equal(h.el('life-back').getAttribute('aria-disabled'),'true');
 }
 const h=await setup('?experiment=life');choose(h,'blinker');click(h,'life-test');assert.equal(h.el('life-return').hidden,false);const initial=board(h);batch(h);assert.equal(generation(h),11);assert.equal(h.el('life-return').hidden,true);assert.deepEqual(board(h),initial);assert.match(h.el('life-turnover').textContent,/第 10 → 11 代/);
});
test('selection, drafts, validation, parameters and saved observations in another world survive',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,.125');click(h,'step');click(h,'observation-return');const saved=h.el('saved-observation-reading').textContent;click(h,'tab-life');click(h,'life-right');click(h,'life-down');const selected=h.el('life-selection').textContent.split(' · ')[0];h.el('life-column').value='bad';h.el('life-row').value='7';click(h,'life-position');const error=h.el('life-position-error').textContent;h.el('rate').handlers.input({target:{value:'20'}});h.el('density').handlers.input({target:{value:'60'}});const url=location.href,writes=h.writes();
 batch(h);assert.equal(h.el('life-selection').textContent.split(' · ')[0],selected);assert.equal(h.el('life-column').value,'bad');assert.equal(h.el('life-row').value,'7');assert.equal(h.el('life-position-error').textContent,error);assert.equal(h.el('rate').value,'20');assert.equal(h.el('density').value,'60');assert.equal(location.href,url);assert.equal(h.writes(),writes);click(h,'tab-wave');assert.equal(h.el('saved-observation-reading').textContent,saved);click(h,'observation-undo');assert.match(h.el('wave-time-current').textContent,/0.6485987755982988/);
});
test('inactive worlds ignore batch; tab/history/visibility changes retain the evolved Life board',async()=>{
 const h=await setup('?experiment=life');batch(h);const evolved=board(h),hist=history(h);
 for(const world of ['orbit','wave','fractal','walk']){click(h,'tab-'+world);assert.equal(h.el('life-forward-batch').hidden,true);assert.equal(h.el('life-forward-help').hidden,true);const before=state(h);batch(h);assert.deepEqual(state(h),before);click(h,'tab-life');assert.equal(h.el('life-forward-batch').hidden,false);assert.equal(h.el('life-forward-help').hidden,false);assert.deepEqual(board(h),evolved);assert.deepEqual(history(h),hist);}
 h.navigate(location.search+'#canvas');h.setVisible(false);h.setVisible(true);h.setHidden(true);h.setHidden(false);assert.deepEqual(board(h),evolved);assert.deepEqual(history(h),hist);click(h,'step');assert.deepEqual(board(h),next(evolved));
});
test('batch works before canvas startup and across context loss, density and fractional reflow',async()=>{
 for(const ready of [false,'throw',true]){
  const h=await setup('?experiment=life','',true,1,ready);batch(h);assert.equal(generation(h),10);if(ready!==true){assert.equal(h.drawCount(),0);h.setContextReady(true);click(h,'canvas-retry');}
  const expected=board(h);h.loseContext();batch(h);assert.equal(generation(h),20);h.restoreContext();let evolved=expected;for(let i=0;i<10;i++)evolved=next(evolved);assert.deepEqual(board(h),evolved);h.setDpr(2);h.resize(163,240);assert.deepEqual(board(h,163,240),evolved);h.resize(259.5,240.25);assert.deepEqual(board(h,259.5,240.25),evolved);h.resize(0,0);h.resize(600,414);click(h,'life-back-batch');assert.deepEqual(board(h),expected);
 }
});
test('captured painting ends before evolution and rejects all delayed stroke events',async()=>{
 const h=await setup('?experiment=life');const captures=new Set(),canvas=h.el('canvas');canvas.setPointerCapture=id=>captures.add(id);canvas.hasPointerCapture=id=>captures.has(id);canvas.releasePointerCapture=id=>{captures.delete(id);canvas.handlers.lostpointercapture({type:'lostpointercapture',pointerId:id});};
 const event={pointerId:7,button:0,buttons:1,isPrimary:true,clientX:20,clientY:20};canvas.handlers.pointerdown(event);canvas.handlers.pointermove({...event,clientX:50,clientY:50});assert.equal(captures.size,1);let expected=board(h);for(let i=0;i<10;i++)expected=next(expected);batch(h);assert.equal(captures.size,0);assert.deepEqual(board(h),expected);const after=state(h);canvas.handlers.pointermove({...event,clientX:200});canvas.handlers.pointerup({...event,type:'pointerup',clientX:200});canvas.handlers.click({...event,detail:1,clientX:200});assert.deepEqual(state(h),after);
});
test('held Enter advances once, fresh Enter and Space stay native, intentional batch repeats remain',async()=>{
 const h=await setup('?experiment=life');h.el('life-forward-batch').focus();const key=(key,repeat)=>{let prevented=false;h.el('life-forward-batch').handlers.keydown({key,repeat,preventDefault(){prevented=true;}});return prevented;};
 assert.equal(key('Enter',false),false);batch(h);const before=state(h);for(let i=0;i<12;i++)assert.equal(key('Enter',true),true);assert.deepEqual(state(h),before);for(const name of [' ','Tab','Escape','ArrowRight'])for(const repeat of [false,true])assert.equal(key(name,repeat),false);batch(h);assert.equal(generation(h),20);assert.equal(document.activeElement,h.el('life-forward-batch'));
 for(const world of ['fractal','walk']){click(h,'tab-'+world);for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional repeat blocked');}});click(h,'step');}assert.match(h.el('metrics').textContent,world==='fractal'?/500 个点/:/48 步/);}
});
test('batch does not award discoveries, preserves completed notes and owns asynchronous share feedback',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);batch(h);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;
 let resolve;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(r=>resolve=r)}}});try{const pending=click(h,'share');batch(h);const message=h.el('announcement').textContent;resolve();await pending;assert.equal(h.el('announcement').textContent,message);assert.equal(h.el('notes-text').value,notes);assert.equal(new URL(h.el('share-link').value).searchParams.has('at'),false);}finally{delete globalThis.navigator;}
});
test('forward button exposes a wrapping 44-pixel target with its recording and pause contract',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<button id="life-forward-batch" aria-describedby="life-forward-help" hidden>前进 10 代 \+<\/button>/);assert.match(html,/<p id="life-forward-help" class="canvas-pause-help" hidden>.*前进 10 代并暂停.*记录每一代.*按住 Enter 只前进一次/);assert.match(css,/#life-forward-batch\{min-height:44px;white-space:normal\}/);assert.match(css,/\.stage-controls\{[^}]*flex-wrap:wrap/);assert.equal((html.match(/life-forward=recorded-1/g)||[]).length,2);
});
