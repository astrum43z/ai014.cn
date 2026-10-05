import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
const click=(h,id)=>h.el(id).handlers.click();
const input=(h,w,a)=>h.el(`${w}-target-${a}`);
const apply=(h,w)=>click(h,w==='orbit'?'orbit-position-apply':'wave-position');
const fill=(h,w)=>click(h,w+'-use-current');
const values=(h,w)=>['x','y'].map(a=>input(h,w,a).value);
function position(h,w,x,y){for(const [a,n] of [['x',x],['y',y]]){input(h,w,a).value=String(n);input(h,w,a).handlers.input();}apply(h,w);}
function state(h){return {drawing:h.drawing(),draws:h.drawCount(),frames:[...h.frames.keys()],status:h.el('status').textContent,pause:h.el('pause').textContent,metrics:h.el('metrics').textContent,readings:['a','b','c'].map(k=>h.el('observation-'+k).textContent),time:h.el('wave-time-current').textContent,orbit:h.el('orbit-position-current').textContent,wave:h.el('wave-position-current').textContent,url:location.href,writes:h.writes(),undo:h.el('observation-undo-status').textContent,recall:h.el('orbit-recall-status').textContent,notes:h.el('notes-text').value};}
function key(el,extra){let prevented=false;el.handlers.keydown({key:'Enter',repeat:false,preventDefault(){prevented=true;},...extra});return prevented;}
for(const w of ['orbit','wave']){
 test(`${w}: filling uses exact live coordinates, selects x, clears old errors and never changes the model`,async()=>{
  const h=await setup('?experiment='+w);for(const [x,y] of [[137.5,-42.5],[10000,-10000],[1e-7,-2e-8],[5e-324,-5e-324],[0,0]]){
   position(h,w,x,y);position(h,w,'unfinished','-');assert.equal(h.el(w+'-position-error').hidden,false);let selects=0;input(h,w,'x').select=()=>selects++;
   const before=state(h);fill(h,w);assert.deepEqual(values(h,w),[String(x),String(y)]);assert.equal(selects,1);assert.equal(document.activeElement,input(h,w,'x'));assert.deepEqual(state(h),before);
   assert.equal(h.el(w+'-position-error').hidden,true);assert.equal(h.el(w+'-position-error').textContent,'');for(const a of ['x','y'])assert.equal(input(h,w,a).getAttribute('aria-invalid'),'false');
   assert.equal(h.el('announcement').textContent,`已填入当前坐标：x ${x}，y ${y}；仅替换目标输入，实验状态未改变。`);
   apply(h,w);assert.deepEqual(state(h).drawing,before.drawing);assert.equal(h.el(w+'-position-error').hidden,true);
  }
 });
 test(`${w}: one-axis editing starts from the current point, not an old target`,async()=>{
  const h=await setup('?experiment='+w);position(h,w,8,12);click(h,w+'-right');input(h,w,'x').value='old';input(h,w,'y').value='old';fill(h,w);assert.deepEqual(values(h,w),[w==='orbit'?'13':'10','12']);
  input(h,w,'x').value='7.5';input(h,w,'x').handlers.input();assert.equal(key(input(h,w,'x')),true);assert.match(h.el(w+'-position-current').textContent,/x 7.5，y 12/);assert.equal(input(h,w,'y').value,'12');
 });
 test(`${w}: running frame and exact next frame match a reference without refilling`,async()=>{
  const h=await setup('?experiment='+w,'',false);h.tick(0);h.tick(50);const before=state(h);fill(h,w);assert.deepEqual(state(h),before);assert.equal(h.frames.size,1);h.tick(100);const after={drawing:h.drawing(),metrics:h.el('metrics').textContent};
  const reference=await setup('?experiment='+w,'',false);reference.tick(0);reference.tick(50);reference.tick(100);assert.deepEqual({drawing:reference.drawing(),metrics:reference.el('metrics').textContent},after);
 });
 test(`${w}: held Enter cannot refill or submit after focus changes; other native keys stay available`,async()=>{
  const h=await setup('?experiment='+w,'',false),button=h.el(w+'-use-current');assert.equal(key(button,{repeat:true}),true);for(const e of [{},{key:' '},{key:' ',repeat:true},{key:'Tab'},{key:'ArrowRight'}])assert.equal(key(button,e),false);
  const before=state(h);fill(h,w);input(h,w,'x').value='173.25';assert.equal(key(input(h,w,'x'),{repeat:true}),true);assert.equal(input(h,w,'x').value,'173.25');assert.deepEqual(state(h),before);
  for(const e of [{isComposing:true},{keyCode:229},{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true}])assert.equal(key(input(h,w,'x'),e),false);assert.deepEqual(state(h),before);
  assert.equal(key(input(h,w,'x')),true);assert.equal(h.frames.size,0);assert.match(h.el(w+'-position-current').textContent,/x 173.25/);
 });
 test(`${w}: ordinary redraws and new positions never overwrite a filled draft`,async()=>{
  const h=await setup('?experiment='+w);position(h,w,137.5,-42.5);fill(h,w);input(h,w,'x').value='137.';click(h,w+'-home');
  for(const [a,b] of [[171,240],[259.5,281.75],[0,0],[600,414]])h.resize(a,b);h.setDpr(2);h.loseContext();h.restoreContext();h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);
  for(const other of ['orbit','life','wave','fractal','walk'].filter(x=>x!==w)){click(h,'tab-'+other);click(h,'tab-'+w);}
  assert.deepEqual(values(h,w),['137.','-42.5']);fill(h,w);assert.deepEqual(values(h,w),[w==='orbit'?'140':'0','0']);
 });
 test(`${w}: inactive action cannot alter another world, draft, errors, focus or feedback`,async()=>{
  const h=await setup('?experiment='+w);position(h,w,'bad','bad');for(const other of ['orbit','life','wave','fractal','walk'].filter(x=>x!==w)){
   click(h,'tab-'+other);h.el('tab-'+other).focus();const before={...state(h),draft:values(h,w),message:h.el('announcement').textContent,focus:document.activeElement.id,error:h.el(w+'-position-error').textContent};fill(h,w);
   assert.deepEqual({...state(h),draft:values(h,w),message:h.el('announcement').textContent,focus:document.activeElement.id,error:h.el(w+'-position-error').textContent},before);
  }
 });
 test(`${w}: text-only startup, collapsed layout and context loss still fill model coordinates`,async()=>{
  const h=await setup('?experiment='+w,'',true,1,false);position(h,w,1e-7,-137.5);h.resize(0,0);const before=state(h);fill(h,w);assert.deepEqual(values(h,w),['1e-7','-137.5']);assert.deepEqual(state(h),before);h.setContextReady(true);click(h,'canvas-retry');h.resize(600,414);h.loseContext();fill(h,w);h.restoreContext();assert.deepEqual(values(h,w),['1e-7','-137.5']);assert.match(h.el(w+'-position-current').textContent,/x 1e-7，y -137.5/);
 });
}
test('saved Wave checkpoint, one-level return recovery, latest position and history remain distinct',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5','#canvas');fill(h,'wave');assert.deepEqual(values(h,'wave'),['8','12']);position(h,'wave',7.5,-42.5);click(h,'observation-return');const before=state(h);fill(h,'wave');assert.deepEqual(state(h),before);assert.deepEqual(values(h,'wave'),['8','12']);click(h,'observation-undo');assert.match(h.el('wave-position-current').textContent,/x 7.5，y -42.5/);fill(h,'wave');assert.deepEqual(values(h,'wave'),['7.5','-42.5']);assert.equal(new URL(location.href).searchParams.get('at'),'v1,8,12,2.5');assert.equal(h.el('saved-observation-reading').textContent,'链接中的观测：探针 x 8，y 12 · t 2.5 s');
 h.navigate(location.search+'#instruments');assert.deepEqual(values(h,'wave'),['7.5','-42.5']);h.navigate('?experiment=wave&at=v1,-28,61,.125');assert.deepEqual(values(h,'wave'),['7.5','-42.5']);fill(h,'wave');assert.deepEqual(values(h,'wave'),['-28','61']);assert.equal(h.el('wave-time-current').textContent,'当前时刻 · t 0.125 模型秒');
});
test('filling an out-of-editor-range fitted probe neither clamps nor silently applies it',async()=>{
 const h=await setup('?experiment=wave');position(h,'wave',10000,10000);click(h,'wave-right');assert.match(h.el('wave-position-current').textContent,/x 10002，y 10000/);const before=state(h);fill(h,'wave');assert.deepEqual(values(h,'wave'),['10002','10000']);assert.deepEqual(state(h),before);apply(h,'wave');assert.deepEqual(state(h),before);assert.equal(input(h,'wave','x').getAttribute('aria-invalid'),'true');assert.equal(input(h,'wave','y').getAttribute('aria-invalid'),'false');
});
test('Orbit filling preserves a launched body, its recall and current integration',async()=>{
 const h=await setup('?experiment=orbit');position(h,'orbit',137.5,-42.5);click(h,'orbit-fire');click(h,'step');click(h,'orbit-right');const before=state(h);fill(h,'orbit');assert.deepEqual(state(h),before);assert.deepEqual(values(h,'orbit'),['142.5','-42.5']);click(h,'orbit-recall');assert.match(h.el('metrics').textContent,/3 颗行星/);assert.deepEqual(values(h,'orbit'),['142.5','-42.5']);
});
test('pending sharing and capture cannot overwrite newer refill feedback; links stay fixed',async()=>{
 let resolve;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(r=>resolve=r)}}});
 try{const h=await setup('?experiment=wave&at=v1,8,12,2.5');const pending=click(h,'share');position(h,'wave',7.5,-42.5);const before=state(h);fill(h,'wave');assert.deepEqual(state(h),before);const message=h.el('announcement').textContent;resolve();await pending;assert.equal(h.el('announcement').textContent,message);assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),'v1,8,12,2.5');
  let finish;h.el('canvas').toBlob=cb=>finish=cb;click(h,'save');fill(h,'wave');const latest=h.el('announcement').textContent;finish(null);assert.equal(h.el('announcement').textContent,latest);
 }finally{delete globalThis.navigator;}
});
test('refilling never records a discovery and leaves earned notes and other-world batch repetition intact',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');fill(h,'wave');assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');click(h,'wave-home');fill(h,'wave');assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;fill(h,'wave');assert.equal(h.el('notes-text').value,notes);
 for(const w of ['fractal','walk']){click(h,'tab-'+w);for(const repeat of [false,true]){assert.equal(key(h.el('step'),{repeat}),false);click(h,'step');}assert.match(h.el('metrics').textContent,w==='fractal'?/500 个点/:/48 步/);}assert.equal(h.el('notes-text').value,notes);
});
test('explicit controls describe replacement and focus, retain native semantics and wrap without shrinking targets',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 for(const w of ['orbit','wave']){
  assert.match(html,new RegExp(`<div class="coordinate-actions"><button id="${w}-use-current" type="button" aria-controls="${w}-target-x ${w}-target-y" aria-describedby="${w}-position-help">填入当前坐标</button><button`));
  const help=html.match(new RegExp(`<small id="${w}-position-help">(.*?)</small>`))[1];assert.match(help,/替换两个目标并选中目标 x/);assert.match(help,/不暂停或改变实验/);assert.match(help,/之后仍需按上述范围定位/);
 }
 assert.match(css,/\.coordinate-actions\{display:flex;flex-wrap:wrap;gap:8px\}/);assert.match(css,/\.coordinate-actions button\{flex:1 1 150px;max-width:100%;white-space:normal;overflow-wrap:anywhere\}/);assert.match(css,/\.wave-touch button\{[^}]*min-height:44px/);assert.match(css,/\.orbit-target button\{[^}]*min-height:44px/);assert.equal((html.match(/coordinate-draft=current-1/g)||[]).length,2);
});
