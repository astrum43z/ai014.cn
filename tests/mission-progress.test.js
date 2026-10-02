import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
import {missions} from '../missions.js';

const modes=Object.keys(missions);
const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const start=h=>click(h,'mission-start');
const check=h=>click(h,'mission-check');
const steps=h=>Array.from({length:3},(_,i)=>{
 const el=h.el('mission-step-'+i);
 return {text:el.textContent,current:el.getAttribute('aria-current'),done:el.getAttribute('data-done'),visualCurrent:el.getAttribute('data-current')};
});
function expectSteps(h,mode,states){
 assert.deepEqual(steps(h),states.map((state,i)=>({
  text:missions[mode].steps[i]+(state==='done'?' · 已完成':state==='current'?' · 当前步骤':''),
  current:state==='current'?'step':'false',done:String(state==='done'),visualCurrent:String(state==='current')
 })));
 assert.equal(steps(h).filter(step=>step.current==='step').length,states.includes('current')?1:0);
}
function firstCheck(h,mode){
 if(mode==='fractal')click(h,'fractal-1000');
 if(mode!=='life')check(h);
}
function finish(h,mode){
 if(mode==='orbit'){input(h,'gravity',40);for(let i=0;i<70;i++)click(h,'step');}
 if(mode==='life')for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 if(mode==='wave')click(h,'wave-home');
 if(mode==='fractal'){input(h,'seed',15);click(h,'fractal-1000');}
 if(mode==='walk')click(h,'walk-64');
 check(h);assert.equal(h.el('mission-state').textContent,'已留下发现');
}

for(const mode of modes)test(`${mode}: labels and aria-current follow verified start, comparison, completion and restart`,async()=>{
 const h=await setup('?experiment='+mode);
 expectSteps(h,mode,['pending','pending','pending']);
 start(h);expectSteps(h,mode,mode==='life'?['done','current','pending']:['current','pending','pending']);
 assert.equal(h.frames.size,0);
 firstCheck(h,mode);expectSteps(h,mode,['done','current','pending']);
 const before=steps(h);check(h);assert.deepEqual(steps(h),before,'failed/repeated check must not imply progress');
 assert.equal(h.el('passport-count').textContent,'本次发现 0 / 5');
 finish(h,mode);expectSteps(h,mode,['done','done','done']);
 const note=h.el('field-notes-list').innerHTML;
 check(h);expectSteps(h,mode,['done','done','done']);
 assert.equal(h.el('field-notes-list').innerHTML,note);
 start(h);expectSteps(h,mode,mode==='life'?['done','current','pending']:['current','pending','pending']);
 assert.equal(h.el('field-notes-list').innerHTML,note,'a restart does not discard historical evidence');
});

test('Fractal does not mark unverified growth or parameter edits complete',async()=>{
 const h=await setup('?experiment=fractal');start(h);
 for(let i=0;i<3;i++)check(h);
 expectSteps(h,'fractal',['current','pending','pending']);
 click(h,'fractal-1000');expectSteps(h,'fractal',['current','pending','pending']);
 check(h);expectSteps(h,'fractal',['done','current','pending']);
 input(h,'seed',15);click(h,'fractal-1000');expectSteps(h,'fractal',['done','current','pending']);
 check(h);expectSteps(h,'fractal',['done','done','done']);
});

test('retained and idle worlds replace recycled step semantics without changing their state',async()=>{
 const h=await setup('?experiment=fractal','#mission');start(h);firstCheck(h,'fractal');
 input(h,'seed',15);click(h,'fractal-1000');await click(h,'share');click(h,'fractal-forward');
 const saved={steps:steps(h),metrics:h.el('metrics').textContent,drawing:h.drawing(),url:location.href,share:h.el('share-link').value,feedback:h.el('mission-result').textContent};
 for(const mode of ['orbit','life','wave','walk']){
  click(h,'tab-'+mode);expectSteps(h,mode,['pending','pending','pending']);
  start(h);expectSteps(h,mode,mode==='life'?['done','current','pending']:['current','pending','pending']);
  click(h,'tab-fractal');
  assert.deepEqual({steps:steps(h),metrics:h.el('metrics').textContent,drawing:h.drawing(),url:location.href,share:h.el('share-link').value,feedback:h.el('mission-result').textContent},saved);
 }
 assert.match(saved.metrics,/1001 个点/);assert.equal(new URL(saved.url).searchParams.get('at'),'v1,1000');
});

test('anchor history retains step state while a different URL clears it but keeps historical notes',async()=>{
 const h=await setup('?experiment=wave','#mission');start(h);firstCheck(h,'wave');finish(h,'wave');
 const note=h.el('field-notes-list').innerHTML;
 for(const hash of ['#canvas','#control-title','#mission']){
  h.navigate(location.search+hash);expectSteps(h,'wave',['done','done','done']);
 }
 h.navigate('?experiment=wave&wavelength=40&separation=100#mission');
 expectSteps(h,'wave',['pending','pending','pending']);
 assert.equal(h.el('mission-state').textContent,'可选探索');assert.equal(h.el('field-notes-list').innerHTML,note);
 start(h);expectSteps(h,'wave',['current','pending','pending']);
});

test('a completed exploration remains completed after further simulation and a tab return',async()=>{
 const h=await setup('?experiment=walk');start(h);firstCheck(h,'walk');finish(h,'walk');
 click(h,'walk-step-one');expectSteps(h,'walk',['done','done','done']);
 click(h,'tab-life');expectSteps(h,'life',['pending','pending','pending']);
 click(h,'tab-walk');expectSteps(h,'walk',['done','done','done']);
 assert.match(h.el('metrics').textContent,/65 步/);
});

test('quiet progress text is neither rewritten nor announced by animation and resize',async()=>{
 const h=await setup('?experiment=orbit','',false);start(h);firstCheck(h,'orbit');
 let writes=0;
 for(let i=0;i<3;i++){
  const el=h.el('mission-step-'+i);let text=el.textContent;
  Object.defineProperty(el,'textContent',{get:()=>text,set:value=>{writes++;text=value;},configurable:true});
 }
 click(h,'pause');const announcement=h.el('announcement').textContent,initial=steps(h);
 h.tick(0);for(let i=1;i<=120;i++)h.tick(i*1000/60);
 h.resize(420,400);
 assert.equal(writes,0);assert.deepEqual(steps(h),initial);
 assert.equal(h.el('announcement').textContent,announcement);assert.equal(h.frames.size,1);
});

test('step states keep native list structure, no new keyboard stops or live region, and wrapping',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<ol class="mission-steps" aria-label="探索步骤"><li id="mission-step-0"><\/li><li id="mission-step-1"><\/li><li id="mission-step-2"><\/li><\/ol>/);
 assert.match(css,/\.mission-steps\{[^}]*flex-wrap:wrap/);
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const render=app.slice(app.indexOf('function renderMission(){'),app.indexOf('function inspectMission('));
 assert.doesNotMatch(render,/aria-live|tabindex|\.focus\(|announce\(/);
});
