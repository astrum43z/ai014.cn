import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const click=(h,id)=>h.el(id).handlers.click();
const select=(h,column,row)=>{h.el('life-target-column').value=String(column);h.el('life-target-row').value=String(row);click(h,'life-position');};
const snapshot=h=>({drawing:h.drawing(),frames:[...h.frames.keys()],writes:h.writes(),search:location.search,
 readings:['metrics','status','life-cell-position','life-cell-state','life-cell-next','life-cell-reason','life-turnover','history-caption','life-test-result','mission-result','announcement'].map(id=>h.el(id).textContent),
 history:h.el('history-line').getAttribute('points'),drawer:h.el('instruments').open,
 drafts:['life-target-column','life-target-row'].map(id=>[h.el(id).value,h.el(id).getAttribute('aria-invalid')]),
 error:[h.el('life-position-error').textContent,h.el('life-position-error').hidden],
 recovery:['life-undo-edit','life-undo-clear','life-back'].map(id=>h.el(id).getAttribute('aria-disabled')),
 trial:h.el('life-return').hidden,notes:h.el('notes-text').value,link:h.el('share-link').value.split('#')[0]});
const roundtrip=h=>{const before=snapshot(h);for(const hash of ['#canvas','#life-inspector','#canvas','#control-title','#canvas']){h.navigate(location.search+hash);assert.deepEqual(snapshot(h),before);}};
function board(h){const {width,height}=h.el('canvas').getBoundingClientRect(),cells=new Uint8Array(1536);let color;for(const [op,...a] of h.drawing()){if(op==='fillStyle')color=a[0];if(op==='fillRect'&&color==='#d3f35b')cells[Math.round((a[1]-.6)/(height/32))*48+Math.round((a[0]-.6)/(width/48))]=1;}return cells;}
function evolve(cells){return cells.map((alive,i)=>{let n=0;const x=i%48,y=Math.floor(i/48);for(const dy of [-1,0,1])for(const dx of [-1,0,1])if(dx||dy)n+=cells[((y+dy+32)%32)*48+(x+dx+48)%48];return Number(n===3||(alive&&n===2));});}
function check(h,column,row){assert.equal(h.el('life-cell-position').textContent,`第 ${column} 列，第 ${row} 行`);const cells=board(h),x=column-1,y=row-1;let n=0;for(const dy of [-1,0,1])for(const dx of [-1,0,1])if(dx||dy)n+=cells[((y+dy+32)%32)*48+(x+dx+48)%48];assert.equal(h.el('life-cell-state').textContent,`当前：${cells[y*48+x]?'活格':'空格'} · 活邻居 ${n} / 8`);}

test('Life exact selection ends with a unique native return to the focusable canvas',()=>{
 const section=html.match(/<section id="life-inspector"[\s\S]*?<\/section>/)?.[0];assert.ok(section);
 assert.match(section,/<p id="life-position-error" aria-live="off" hidden><\/p><a id="life-position-view" class="return-to-canvas" href="#canvas">回到画布，查看框选格 ↑<\/a>/);
 assert.equal((html.match(/id="life-position-view"/g)||[]).length,1);
 assert.ok(section.indexOf('id="life-position"')<section.indexOf('id="life-position-view"'));
 assert.match(section,/aria-labelledby="life-inspector-title" hidden/);
 assert.match(html,/<canvas id="canvas" tabindex="0"/);
 assert.doesNotMatch(app,/life-position-view/,'native navigation adds no listener or model state');
});

test('the return wraps at narrow widths and retains a 44px target and dark focus ring',()=>{
 const rule=css.match(/\.life-position #life-position-view\{([^}]+)\}/)?.[1];assert.ok(rule);
 for(const value of ['max-width:100%','white-space:normal','overflow-wrap:anywhere','font-size:13px','color:#d3f35b'])assert.ok(rule.includes(value));
 assert.match(css,/\.reading-nav a,\.return-to-canvas\{[^}]*min-height:44px/);
 assert.match(css,/a:focus-visible[^}]*outline:3px solid/);
 assert.match(css,/\.stage,\.instrument-drawer\{--focus-ring:var\(--focus-on-dark\)\}/);
 assert.match(html,/style\.css\?[^"\n]*&amp;cell-view=return-1/);
});

test('returning after exact selection preserves the board and all border and interior cell readings',async()=>{
 const h=await setup('?experiment=life','#life-inspector');h.el('instruments').open=true;const cells=board(h);
 for(const [column,row] of [[48,32],[1,1],[48,1],[1,32],[12,7],[25,17]]){select(h,column,row);check(h,column,row);roundtrip(h);assert.deepEqual(board(h),cells);}
 h.key('ArrowLeft');check(h,24,17);roundtrip(h);h.key('ArrowRight');check(h,25,17);assert.deepEqual(board(h),cells);
});

test('unfinished and invalid targets survive return navigation without applying or clearing them',async()=>{
 const h=await setup('?experiment=life','#life-inspector');select(h,48,32);
 h.el('life-target-column').value='unfinished';h.el('life-target-row').value='33';click(h,'life-position');roundtrip(h);check(h,48,32);
 assert.equal(h.el('life-target-column').getAttribute('aria-invalid'),'true');assert.equal(h.el('life-position-error').hidden,false);
 h.el('life-target-column').value='１２';h.el('life-target-row').value='７';roundtrip(h);check(h,48,32);click(h,'life-position');check(h,12,7);roundtrip(h);
});

test('return navigation preserves edit undo, clear recovery, comparison return and history rewind',async()=>{
 const h=await setup('?experiment=life','#life-inspector');h.el('instruments').open=true;select(h,12,7);const initial=board(h);
 click(h,'life-toggle');const edited=board(h);roundtrip(h);click(h,'life-undo-edit');assert.deepEqual(board(h),initial);roundtrip(h);
 click(h,'life-toggle');assert.deepEqual(board(h),edited);click(h,'clear');roundtrip(h);click(h,'life-undo-clear');assert.deepEqual(board(h),edited);roundtrip(h);
 click(h,'life-test');assert.deepEqual(board(h),evolve(edited));roundtrip(h);click(h,'life-return');assert.deepEqual(board(h),edited);roundtrip(h);
 click(h,'step');assert.deepEqual(board(h),evolve(edited));roundtrip(h);click(h,'life-back');assert.deepEqual(board(h),edited);check(h,12,7);roundtrip(h);
});

test('running navigation retains timing and visibility suspension; resumed evolution is the same model',async()=>{
 const h=await setup('?experiment=life&rate=1','#life-inspector',false);h.el('instruments').open=true;const initial=board(h);
 h.tick(0);for(let i=1;i<=15;i++)h.tick(i*50);roundtrip(h);assert.equal(h.frames.size,1);h.setVisible(false);roundtrip(h);assert.equal(h.frames.size,0);
 h.setVisible(true);h.tick(1000);for(let i=1;i<=6;i++)h.tick(1000+i*50);assert.deepEqual(board(h),evolve(initial));roundtrip(h);
 click(h,'pause');roundtrip(h);assert.equal(h.frames.size,0);
});

test('reflow, density and context recovery preserve selection and native return history',async()=>{
 const h=await setup('?experiment=life','#life-inspector');select(h,48,32);const initial=board(h);
 for(const size of [[171,240],[259,240],[455.5,281.75],[600,414]]){h.resize(...size);roundtrip(h);check(h,48,32);assert.deepEqual(board(h),initial);}
 h.setDpr(2);h.loseContext();roundtrip(h);h.restoreContext();roundtrip(h);check(h,48,32);assert.deepEqual(board(h),initial);
 h.resize(0,0);roundtrip(h);h.resize(600,414);check(h,48,32);assert.deepEqual(board(h),initial);
});

test('retained worlds preserve Life while a changed query uses its normal reset boundary',async()=>{
 const h=await setup('?experiment=life','#life-inspector');select(h,48,32);click(h,'step');const cells=board(h);h.el('instruments').open=true;
 for(const world of ['orbit','wave','fractal','walk']){click(h,'tab-'+world);assert.equal(h.el('life-inspector').hidden,true);click(h,'tab-life');roundtrip(h);check(h,48,32);assert.deepEqual(board(h),cells);}
 h.navigate('?experiment=life&rate=1#life-inspector');roundtrip(h);assert.match(h.el('metrics').textContent,/第 0 代/);assert.equal(h.el('instruments').open,true);
});

test('text-only startup supports exact readings and recovers the unchanged selected cell',async()=>{
 const h=await setup('?experiment=life','#life-inspector',true,1,false);select(h,48,32);roundtrip(h);assert.equal(h.el('life-cell-position').textContent,'第 48 列，第 32 行');
 h.setContextReady(true);click(h,'canvas-retry');roundtrip(h);check(h,48,32);assert.match(h.el('metrics').textContent,/第 0 代 · 10 个活格子/);
});

test('a pending share and completed discovery keep their captured data across return navigation',async()=>{
 const h=await setup('?experiment=life','#life-inspector');click(h,'mission-start');for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);roundtrip(h);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;let finish;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(r=>finish=r)}}});
 try{const pending=click(h,'share');select(h,48,32);roundtrip(h);const message=h.el('announcement').textContent;finish();await pending;assert.equal(h.el('announcement').textContent,message);assert.equal(h.el('notes-text').value,notes);check(h,48,32);roundtrip(h);}finally{delete globalThis.navigator;}
});

test('native navigation leaves fresh editing and intentional held seeded batches unchanged',async()=>{
 const h=await setup('?experiment=life','#life-inspector');select(h,48,32);roundtrip(h);const cells=board(h);h.key('Enter');const expected=cells.slice();expected[1535]^=1;assert.deepEqual(board(h),expected);roundtrip(h);
 for(const world of ['fractal','walk']){click(h,'tab-'+world);for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional held batch changed');}});click(h,'step');}roundtrip(h);}
});
