import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
const click=(h,id)=>h.el(id).handlers.click();
const toggle=(h,open)=>{h.el('instruments').open=open;h.el('instruments').handlers.toggle();};
const grid=h=>Array.from({length:9},(_,i)=>h.el('life-neighbor-'+i).getAttribute('data-alive'));
function board(h){const out=new Uint8Array(1536),r=h.el('canvas').getBoundingClientRect();let color;for(const [name,...args] of h.drawing()){if(name==='fillStyle')color=args[0];if(name==='fillRect'&&color==='#d3f35b')out[Math.round((args[1]-.6)/(r.height/32))*48+Math.round((args[0]-.6)/(r.width/48))]=1;}return out;}
function local(h,cells=board(h)){const [x,y]=h.el('life-cell-position').textContent.match(/第 (\d+) 列，第 (\d+) 行/).slice(1).map(n=>Number(n)-1),out=[];for(const dy of [-1,0,1])for(const dx of [-1,0,1])out.push(String(cells[((y+dy+32)%32)*48+(x+dx+48)%48]));return out;}
function evolve(cells){return cells.map((alive,i)=>{let count=0;for(const dy of [-1,0,1])for(const dx of [-1,0,1])if(dx||dy)count+=cells[((Math.floor(i/48)+dy+32)%32)*48+(i%48+dx+48)%48];return Number(count===3||(alive&&count===2));});}
function check(h,cells=board(h)){const expected=local(h,cells),n=expected.reduce((sum,a)=>sum+Number(a),0)-Number(expected[4]);assert.deepEqual(grid(h),expected);assert.equal(h.el('life-cell-state').textContent,`当前：${Number(expected[4])?'活格':'空格'} · 活邻居 ${n} / 8`);}
function watch(h){const writes=[];for(let i=0;i<9;i++){const e=h.el('life-neighbor-'+i),set=e.setAttribute.bind(e);e.setAttribute=(...args)=>{writes.push([i,...args]);set(...args);};}return writes;}
function position(h,x,y){h.el('life-target-column').value=String(x+1);h.el('life-target-row').value=String(y+1);click(h,'life-position');}
function paint(h,x,y){h.el('canvas').handlers.click({detail:0,clientX:(x+.5)*600/48,clientY:(y+.5)*414/32});}
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),frames:[...h.frames.keys()],metrics:h.el('metrics').textContent,readings:['life-cell-position','life-cell-state','life-cell-next','life-cell-reason','life-selection','life-next-reading','life-cell-transition','life-turnover','history-caption','life-test-result','life-edit-status','life-clear-status','status','announcement'].map(id=>h.el(id).textContent),history:h.el('history-line').getAttribute('points'),focus:document.activeElement?.id,url:location.href,writes:h.writes(),drafts:['column','row'].map(a=>[h.el('life-target-'+a).value,h.el('life-target-'+a).getAttribute('aria-invalid')]),error:[h.el('life-position-error').textContent,h.el('life-position-error').hidden],recovery:['life-undo-edit','life-undo-clear','life-return','life-back'].map(id=>[h.el(id).hidden,h.el(id).getAttribute('aria-disabled')]),notes:h.el('notes-text').value,link:h.el('share-link').value});
const reveal=h=>{const before=state(h);toggle(h,true);assert.deepEqual(state(h),before);check(h);};

test('closed startup and next generation leave hidden geometry idle while all text stays current',async()=>{
 const h=await setup('?experiment=life');assert.deepEqual(grid(h),Array(9).fill(null));const first=board(h);click(h,'step');assert.deepEqual(board(h),evolve(first));assert.deepEqual(grid(h),Array(9).fill(null));assert.match(h.el('life-selection').textContent,/活格 · 3 个活邻居/);assert.match(h.el('announcement').textContent,/第 1 代/);reveal(h);
});
test('120 closed blinker generations remove 360 measured writes while preserving all 120 board frames',async()=>{
 const h=await setup('?experiment=life');click(h,'guide-start');h.el('rate').handlers.input({target:{value:'20'}});reveal(h);toggle(h,false);const old=grid(h),writes=watch(h);let expected=board(h);click(h,'pause');h.tick(0);const draws=h.drawCount();
 for(let i=1;i<=120;i++){h.tick(i*50);expected=evolve(expected);assert.deepEqual(board(h),expected);}
 assert.equal(h.drawCount()-draws,120);assert.equal(writes.length,0);assert.deepEqual(grid(h),old);assert.match(h.el('metrics').textContent,/第 120 代 · 3 个活格子/);assert.equal(h.frames.size,1);reveal(h);h.tick(6050);check(h,evolve(expected));assert.equal(writes.length,3);
});
test('all 512 local patterns and toroidal edge placements refresh exactly on opening',async()=>{
 const h=await setup('?experiment=life');for(const [x,y] of [[24,16],[0,0],[47,31]])for(let mask=0;mask<512;mask++){
  toggle(h,false);const old=grid(h);click(h,'clear');let i=0;for(const dy of [-1,0,1])for(const dx of [-1,0,1]){if(mask&(1<<i))paint(h,(x+dx+48)%48,(y+dy+32)%32);i++;}position(h,x,y);assert.deepEqual(grid(h),old);reveal(h);assert.deepEqual(grid(h),Array.from({length:9},(_,j)=>String((mask>>j)&1)));
 }
});
test('opening keeps focus, drafts, validation errors and feedback and only repairs changed attributes',async()=>{
 const h=await setup('?experiment=life');position(h,'bad',32);h.el('instrument-summary').focus();reveal(h);assert.equal(h.el('life-position-error').hidden,false);const expected=grid(h),writes=watch(h);
 for(let i=0;i<5;i++){toggle(h,false);reveal(h);}assert.equal(writes.length,0);toggle(h,false);h.el('life-neighbor-2').attributes['data-alive']='stale';delete h.el('life-neighbor-7').attributes['data-alive'];reveal(h);assert.deepEqual(grid(h),expected);assert.deepEqual(writes.map(w=>w[0]),[2,7]);
});
test('coalesced toggles and every retained world use the current mode, board and open state',async()=>{
 const h=await setup('?experiment=life');reveal(h);toggle(h,false);const old=grid(h);click(h,'step');h.el('instruments').open=true;h.el('instruments').open=false;h.el('instruments').handlers.toggle({newState:'open'});assert.deepEqual(grid(h),old);
 for(const mode of ['orbit','wave','fractal','walk']){click(h,'tab-'+mode);const before=state(h);toggle(h,true);assert.deepEqual(state(h),before);assert.deepEqual(grid(h),old);toggle(h,false);click(h,'tab-life');assert.deepEqual(grid(h),old);}reveal(h);click(h,'tab-wave');click(h,'tab-life');check(h);
});
test('edit undo, clear recovery, comparison return and generation rewind keep current hidden and visible neighborhoods',async()=>{
 const h=await setup('?experiment=life');reveal(h);toggle(h,false);const original=board(h);click(h,'life-toggle');reveal(h);toggle(h,false);click(h,'life-undo-edit');assert.deepEqual(board(h),original);reveal(h);
 toggle(h,false);click(h,'clear');reveal(h);toggle(h,false);click(h,'life-undo-clear');assert.deepEqual(board(h),original);reveal(h);
 toggle(h,false);click(h,'life-test');reveal(h);toggle(h,false);click(h,'life-return');assert.deepEqual(board(h),original);reveal(h);
 toggle(h,false);click(h,'life-forward-batch');reveal(h);toggle(h,false);click(h,'life-back-batch');assert.deepEqual(board(h),original);reveal(h);
});
test('opening does not consume partial running time or advance an offscreen, hidden or lost canvas',async()=>{
 const h=await setup('?experiment=life&rate=1','',false);h.tick(0);for(let i=1;i<=15;i++)h.tick(i*50);const cells=board(h);reveal(h);for(let i=16;i<=19;i++)h.tick(i*50);assert.deepEqual(board(h),cells);h.tick(1000);assert.deepEqual(board(h),evolve(cells));check(h);
 for(const [suspend,resume] of [[()=>h.setVisible(false),()=>h.setVisible(true)],[()=>h.setHidden(true),()=>h.setHidden(false)]]){suspend();toggle(h,false);reveal(h);resume();h.tick(100000);check(h);}
 const expected=grid(h);h.loseContext();toggle(h,false);const before=state(h);toggle(h,true);assert.deepEqual(state(h),before);assert.deepEqual(grid(h),expected);h.restoreContext();h.tick(200000);check(h);
});
test('presets, same-query history and changed parameter history refresh from the actual current selection',async()=>{
 const h=await setup('?experiment=life');for(const preset of ['glider','blinker','pulsar']){toggle(h,false);const old=grid(h);h.el('preset-select').handlers.change({target:{value:preset}});click(h,'load-preset');assert.deepEqual(grid(h),old);reveal(h);}
 toggle(h,false);position(h,47,31);h.navigate(location.search+'#instruments');reveal(h);toggle(h,false);h.navigate('?experiment=life&rate=1&density=60#canvas');reveal(h);toggle(h,false);click(h,'reset');reveal(h);
});
test('discoveries, fixed observations in other worlds, pending sharing and captures survive disclosure',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,.125');click(h,'step');click(h,'observation-return');click(h,'tab-life');click(h,'mission-start');for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);reveal(h);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;
 let finish;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(r=>finish=r)}}});try{toggle(h,false);const pending=click(h,'share');click(h,'step');reveal(h);const message=h.el('announcement').textContent;finish();await pending;assert.equal(h.el('announcement').textContent,message);assert.equal(new URL(h.el('share-link').value).searchParams.has('at'),false);}finally{delete globalThis.navigator;}
 toggle(h,false);let captures=0;h.el('canvas').toBlob=cb=>{captures++;cb(null);};click(h,'save');reveal(h);assert.equal(captures,1);assert.equal(h.el('notes-text').value,notes);click(h,'tab-wave');click(h,'observation-undo');assert.equal(h.el('wave-time-current').textContent,`当前时刻 · t ${.125+Math.PI/6} 模型秒`);
});
for(const context of [false,'throw'])test(`text-only startup (${context}), reflow and context recovery reveal the same current neighborhood`,async()=>{
 const h=await setup('?experiment=life','',true,1,context);assert.deepEqual(grid(h),Array(9).fill(null));click(h,'step');const expected=['0','1','0','1','1','0','1','0','0'];const before=state(h);toggle(h,true);assert.deepEqual(state(h),before);assert.deepEqual(grid(h),expected);toggle(h,false);click(h,'life-toggle');const old=grid(h);
 for(const [w,z] of [[0,0],[163,240],[259.5,240.25],[647,317.9375]])h.resize(w,z);h.setDpr(2);h.setContextReady(true);click(h,'canvas-retry');h.loseContext();h.restoreContext();assert.deepEqual(grid(h),old);reveal(h);
});
test('native disclosure stays quiet and intentional seeded batch and parameter repetition stays available',async()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/<details id="instruments" class="instrument-drawer">/);assert.match(html,/class="life-neighborhood" aria-hidden="true"/);assert.match(html,/neighborhood=disclosure-1/);
 const h=await setup('?experiment=life');for(const mode of ['fractal','walk']){click(h,'tab-'+mode);toggle(h,true);for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional held batch changed');}});click(h,'step');}assert.match(h.el('metrics').textContent,mode==='fractal'?/500 个点/:/48 步/);}h.el('bias').handlers.input({target:{value:'4'}});assert.equal(new URL(location.href).searchParams.get('bias'),'4');
});
