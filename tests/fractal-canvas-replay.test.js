import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
function key(h,name,extra={}){
 let prevented=false;
 h.key(name,{...extra,preventDefault(){prevented=true;}});
 return prevented;
}
function count(h,n){assert.match(h.el('metrics').textContent,new RegExp(`^${n} 个点`));}
function state(h){return {drawing:h.drawing(),metrics:h.el('metrics').textContent,
 reading:h.el('fractal-touch-reading').textContent,status:h.el('status').textContent,
 announcement:h.el('announcement').textContent,draws:h.drawCount(),frames:h.frames.size,
 url:location.href,writes:h.writes(),notes:h.el('field-notes-list').innerHTML,
 focus:document.activeElement};}

for(const [seed,jump,n] of [[14,50,1000],[23,65,731],[99,35,301]]){
 test(`canvas left/right exactly replays seed ${seed}, ratio ${jump}, point ${n}`,async()=>{
  const h=await setup(`?experiment=fractal&seed=${seed}&jump=${jump}&at=v1,${n}`,'#canvas');
  h.el('canvas').focus();const before=h.drawing(),url=location.href,writes=h.writes();
  assert.equal(key(h,'ArrowLeft'),true);count(h,n-1);
  assert.equal(document.activeElement,h.el('canvas'));assert.equal(h.frames.size,0);
  assert.match(h.el('announcement').textContent,/已暂停并退回一点/);
  assert.equal(key(h,'ArrowRight'),true);count(h,n);
  assert.deepEqual(h.drawing(),before,'identical point cloud and last-jump geometry');
  assert.equal(location.href,url);assert.equal(h.writes(),writes);
  assert.equal(document.activeElement,h.el('canvas'));
 });
}

test('canvas keys and existing buttons use the same seeded forward and backward actions',async()=>{
 const h=await setup('?experiment=fractal&seed=31&jump=38&at=v1,817');
 click(h,'fractal-back');const back=h.drawing(),reading=h.el('fractal-touch-reading').textContent;
 click(h,'fractal-forward');key(h,'ArrowLeft');
 assert.deepEqual(h.drawing(),back);assert.equal(h.el('fractal-touch-reading').textContent,reading);
 key(h,'ArrowRight');const forward=h.drawing();key(h,'ArrowLeft');click(h,'fractal-step');
 assert.deepEqual(h.drawing(),forward);count(h,817);
});

test('fresh arrows pause a running model; held arrows neither skip jumps nor redraw',async()=>{
 for(const [name,delta] of [['ArrowLeft',-1],['ArrowRight',1]]){
  const h=await setup('?experiment=fractal&at=v1,731');click(h,'pause');h.el('canvas').focus();
  const running=state(h);assert.equal(h.frames.size,1);
  assert.equal(key(h,name,{repeat:true}),true);assert.deepEqual(state(h),running);
  assert.equal(key(h,name),true);count(h,731+delta);assert.equal(h.frames.size,0);
  const after=state(h);
  for(let i=0;i<12;i++)assert.equal(key(h,name,{repeat:true}),true);
  assert.deepEqual(state(h),after);
  key(h,name);count(h,731+2*delta);assert.equal(document.activeElement,h.el('canvas'));
 }
});

test('canvas replay retains the 300/12000 bounds and re-enables opposite controls',async()=>{
 for(const [n,name,opposite,delta] of [[300,'ArrowLeft','ArrowRight',1],[12000,'ArrowRight','ArrowLeft',-1]]){
  const h=await setup('?experiment=fractal&at=v1,'+n);h.el('canvas').focus();
  const atBound=state(h);
  for(let i=0;i<3;i++){assert.equal(key(h,name),true);key(h,name,{repeat:true});}
  assert.deepEqual(state(h),atBound);
  key(h,opposite);count(h,n+delta);
  assert.equal(h.el(n===300?'fractal-back':'fractal-forward').getAttribute('aria-disabled'),'false');
  key(h,name);count(h,n);assert.equal(document.activeElement,h.el('canvas'));
 }
 const h=await setup('?experiment=fractal','',false);const before=state(h);
 key(h,'ArrowLeft');assert.deepEqual(state(h),before,'unavailable rewind does not interrupt animation');
});

test('modified arrows and unrelated keys keep browser defaults and the running canvas untouched',async()=>{
 const h=await setup('?experiment=fractal&at=v1,731');click(h,'pause');h.el('canvas').focus();
 const before=state(h);
 for(const name of ['ArrowLeft','ArrowRight'])for(const modifier of ['altKey','ctrlKey','metaKey','shiftKey'])for(const repeat of [false,true]){
  assert.equal(key(h,name,{[modifier]:true,repeat}),false);
  assert.deepEqual(state(h),before);
 }
 for(const name of ['ArrowUp','ArrowDown','Home','End','Enter',' ','Tab']){
  assert.equal(key(h,name),false);assert.deepEqual(state(h),before);
 }
});

test('tab, resize and anchor navigation retain replay while URL and parameter changes stay authoritative',async()=>{
 const h=await setup('?experiment=fractal&seed=23&jump=65&at=v1,731','#canvas');
 await click(h,'share');const shared=h.el('share-link').value;key(h,'ArrowLeft');
 const drawing=h.drawing();click(h,'tab-life');click(h,'tab-fractal');count(h,730);
 assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('share-link').value,shared);
 h.navigate('#observation-title');h.resize(320,240);h.el('canvas').focus();
 key(h,'ArrowRight');count(h,731);key(h,'ArrowLeft');count(h,730);
 h.navigate(shared);count(h,730); // Same state, another anchor: do not replay.
 h.navigate('?experiment=wave');h.navigate(shared);count(h,731);
 key(h,'ArrowLeft');count(h,730);
 h.el('seed').handlers.input({target:{value:'15'}});count(h,300);
 key(h,'ArrowLeft');count(h,300);key(h,'ArrowRight');count(h,301);
 assert.equal(new URL(location.href).searchParams.get('at'),null);
});

test('keyboard replay does not award a discovery or change recorded notes',async()=>{
 const h=await setup('?experiment=fractal');click(h,'mission-start');click(h,'fractal-1000');
 key(h,'ArrowLeft');count(h,999);click(h,'mission-check');
 assert.equal(h.el('notes-count').textContent,'0 / 5');
 assert.match(h.el('mission-result').textContent,/当前是 999 点/);
 key(h,'ArrowRight');click(h,'mission-check');
 h.el('seed').handlers.input({target:{value:'15'}});click(h,'fractal-1000');
 key(h,'ArrowLeft');key(h,'ArrowRight');assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const note=h.el('field-notes-list').innerHTML;
 key(h,'ArrowLeft');key(h,'ArrowRight');assert.equal(h.el('field-notes-list').innerHTML,note);
});

test('Fractal exposes both keys and their existing help only while its canvas is active',async()=>{
 const h=await setup('?experiment=fractal');
 const check=()=>{
  assert.equal(h.el('canvas').getAttribute('aria-keyshortcuts'),'Escape ArrowLeft ArrowRight');
  assert.equal(h.el('canvas').getAttribute('aria-describedby'),'canvas-pause-help fractal-touch-help');
  assert.match(h.el('hint').textContent,/← 退一点.*→ 添一点/);
  assert.match(h.el('canvas').getAttribute('aria-label'),/← 退一点.*→ 添一点/);
 };
 check();
 for(const mode of ['life','wave','walk','orbit']){
  click(h,'tab-'+mode);
  assert.equal(h.el('canvas').getAttribute('aria-keyshortcuts'),mode==='life'?'Escape Control+z Meta+z':'Escape');
  assert.equal(h.el('canvas').getAttribute('aria-describedby'),mode==='life'?'canvas-pause-help life-edit-help':'canvas-pause-help');
  click(h,'tab-fractal');check();
 }
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<small id="fractal-touch-help">[^<]*聚焦画布[^<]*← 退一点、→ 添一点[^<]*300 点/);
 assert.match(html,/<small id="fractal-step-help">[^<]*← 退回一点，焦点留在画布/);
});
