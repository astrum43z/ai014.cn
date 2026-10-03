import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const allowed=h=>h.el('orbit-recall').getAttribute('aria-disabled');
const status=h=>h.el('orbit-recall-status').textContent;
function bodyRendering(h,scale=414/450){
 const drawing=h.drawing(),trails=[];
 for(let i=0;i<drawing.length;i++)if(drawing[i][0]==='strokeStyle'&&/^#[a-f0-9]{6}75$/.test(drawing[i][1])){
  const end=drawing.findIndex((op,j)=>j>i&&op[0]==='stroke');
  trails.push(drawing.slice(i,end+1));
 }
 const positions=drawing.filter(op=>op[0]==='arc'&&Math.abs(op[3]-4.5/scale)<1e-8);
 assert.equal(positions.length,trails.length);
 return positions.map((position,i)=>({position,trail:trails[i]}));
}
const stationary=h=>({drawing:h.drawing(),metrics:h.el('metrics').textContent,frames:h.frames.size,reads:['orbit-position','orbit-speed','orbit-measured-reading','orbit-radial-reading','mission-state','mission-result','passport-count','field-notes-list','announcement'].map(id=>[id,h.el(id).textContent,h.el(id).innerHTML]),writes:h.writes(),url:location.href});

test('initial unavailability is quiet, focusable and cannot pause a running scene',async()=>{
 const h=await setup('?experiment=orbit','',false);
 assert.equal(allowed(h),'true');assert.match(status(h),/没有可撤回/);
 h.el('orbit-recall').focus();const before=stationary(h);click(h,'orbit-recall');
 assert.deepEqual(stationary(h),before);assert.equal(document.activeElement,h.el('orbit-recall'));
});

for(const method of ['pointer','keyboard','button'])test(`${method}: recall removes only the newest launch, keeps exact prior bodies and pauses`,async()=>{
 const h=await setup('?experiment=orbit');
 click(h,'step');click(h,'step');
 const before=bodyRendering(h),metrics=h.el('metrics').textContent,url=location.href,writes=h.writes();
 if(method==='pointer')h.el('canvas').handlers.click({clientX:420,clientY:220});
 if(method==='keyboard')h.key('Enter');
 if(method==='button')click(h,'orbit-fire');
 assert.equal(allowed(h),'false');assert.match(status(h),/第 4 颗/);
 assert.deepEqual(bodyRendering(h).slice(0,3),before);
 const position=h.el('orbit-position').textContent;
 h.el('orbit-recall').focus();click(h,'orbit-recall');
 assert.deepEqual(bodyRendering(h),before);assert.equal(h.el('metrics').textContent,metrics);
 assert.equal(h.el('orbit-position').textContent,position);assert.equal(h.frames.size,0);
 assert.equal(allowed(h),'true');assert.equal(document.activeElement,h.el('orbit-recall'));
 assert.match(h.el('announcement').textContent,/已撤回第 4 颗.*暂停.*其余 3 颗.*时间.*不回退/);
 assert.equal(location.href,url);assert.equal(h.writes(),writes);
 const after=stationary(h);click(h,'orbit-recall');assert.deepEqual(stationary(h),after);
});

test('after motion and parameter edits, recall preserves remaining positions, trails, elapsed time and settings',async()=>{
 const h=await setup('?experiment=orbit','',false);
 h.el('canvas').handlers.click({clientX:420,clientY:220});
 assert.equal(h.frames.size,1,'pointer launch retains running state');
 h.tick(0);for(let n=1;n<=8;n++)h.tick(n*40);
 input(h,'gravity',110);input(h,'speed',145);
 const before=bodyRendering(h),time=h.el('metrics').textContent.match(/t \+ .*$/)[0],position=h.el('orbit-position').textContent;
 const firstReading=h.el('orbit-measured-reading').textContent,radial=h.el('orbit-radial-reading').textContent,url=location.href;
 assert.equal(before.length,4);click(h,'orbit-recall');
 assert.deepEqual(bodyRendering(h),before.slice(0,3));assert.ok(h.el('metrics').textContent.endsWith(time));
 assert.equal(h.el('orbit-measured-reading').textContent,firstReading);assert.equal(h.el('orbit-radial-reading').textContent,radial);
 assert.equal(h.el('orbit-position').textContent,position);assert.equal(h.el('gravity').value,'110');assert.equal(h.el('speed').value,'145');
 assert.equal(location.href,url);assert.equal(h.frames.size,0);assert.equal(h.el('status').textContent,'已暂停');
 click(h,'step');assert.notDeepEqual(bodyRendering(h),before.slice(0,3),'ordinary integration continues after removal');
});

test('one level removes only the latest launch; a new launch creates one new opportunity',async()=>{
 const h=await setup('?experiment=orbit');
 for(let i=0;i<3;i++){click(h,'orbit-right');click(h,'orbit-fire');click(h,'step');}
 const before=bodyRendering(h);assert.equal(before.length,6);click(h,'orbit-recall');
 assert.deepEqual(bodyRendering(h),before.slice(0,5));assert.equal(allowed(h),'true');
 const after=stationary(h);for(let i=0;i<5;i++)click(h,'orbit-recall');assert.deepEqual(stationary(h),after);
 click(h,'orbit-fire');assert.equal(allowed(h),'false');assert.match(status(h),/第 6 颗/);click(h,'orbit-recall');
 assert.deepEqual(bodyRendering(h),before.slice(0,5));
});

test('invalid launch attempts retain recovery and cap recovery immediately permits another launch',async()=>{
 const h=await setup('?experiment=orbit');click(h,'orbit-fire');
 for(let i=0;i<28;i++)click(h,'orbit-left');h.key('Enter');click(h,'orbit-fire');
 assert.equal(allowed(h),'false');assert.match(status(h),/第 4 颗/);click(h,'orbit-recall');assert.equal(bodyRendering(h).length,3);
 click(h,'orbit-home');for(let i=0;i<21;i++)click(h,'orbit-fire');assert.equal(bodyRendering(h).length,24);
 assert.match(h.el('orbit-touch-status').textContent,/撤回最近发射/);
 h.key('Enter');assert.match(h.el('announcement').textContent,/撤回最近发射/);
 assert.equal(allowed(h),'false');const before=bodyRendering(h);click(h,'orbit-recall');
 assert.deepEqual(bodyRendering(h),before.slice(0,23));assert.equal(h.el('orbit-fire').getAttribute('aria-disabled'),'false');
 assert.equal(h.el('orbit-preview-reading').hidden,false);click(h,'orbit-fire');assert.equal(bodyRendering(h).length,24);
});

test('reset, preset, guide and changed URL expire recovery; anchor navigation preserves it',async()=>{
 const h=await setup('?experiment=orbit');
 for(const replace of [()=>click(h,'reset'),()=>click(h,'preset'),()=>click(h,'guide-start'),()=>click(h,'mission-start'),()=>h.navigate('?experiment=orbit&gravity=81&speed=100#canvas')]){
  click(h,'orbit-fire');assert.equal(allowed(h),'false');replace();assert.equal(allowed(h),'true');
  const before=stationary(h);click(h,'orbit-recall');assert.deepEqual(stationary(h),before);
 }
 click(h,'orbit-fire');const before=bodyRendering(h);
 for(const hash of ['#control-title','#canvas','#lab'])h.navigate(location.search+hash);
 assert.equal(allowed(h),'false');click(h,'orbit-recall');assert.deepEqual(bodyRendering(h),before.slice(0,-1));
});

test('tab restoration keeps the exact launch reference; a hidden action cannot alter another world',async()=>{
 const h=await setup('?experiment=orbit');click(h,'orbit-fire');click(h,'step');const before=bodyRendering(h);
 for(const mode of ['life','wave','fractal','walk']){
  click(h,'tab-'+mode);click(h,'step');const other=stationary(h);click(h,'orbit-recall');assert.deepEqual(stationary(h),other);
  click(h,'tab-orbit');assert.equal(allowed(h),'false');assert.deepEqual(bodyRendering(h),before);
 }
 click(h,'orbit-recall');assert.deepEqual(bodyRendering(h),before.slice(0,-1));
 click(h,'tab-life');click(h,'tab-orbit');assert.equal(allowed(h),'true');
});

test('layout, density and context restoration keep recovery, and no-op renders leave its status quiet',async()=>{
 const h=await setup('?experiment=orbit');click(h,'orbit-fire');
 let writes=0,value=status(h);Object.defineProperty(h.el('orbit-recall-status'),'textContent',{get:()=>value,set:next=>{writes++;value=next;}});
 const announcement=h.el('announcement').textContent;
 h.resize(284,240);h.setDpr(2);h.loseContext();h.restoreContext();
 assert.equal(writes,0);assert.equal(h.el('announcement').textContent,announcement);assert.equal(allowed(h),'false');
 click(h,'orbit-recall');assert.match(h.el('metrics').textContent,/3 颗/);assert.equal(allowed(h),'true');assert.equal(writes,1);
});

test('recall keeps a live mission baseline and never records or erases discoveries',async()=>{
 const h=await setup('?experiment=orbit');click(h,'mission-start');click(h,'mission-check');
 assert.match(h.el('mission-result').textContent,/75/);click(h,'orbit-fire');click(h,'orbit-recall');
 assert.equal(h.el('passport-count').textContent,'本次发现 0 / 5');input(h,'gravity',40);
 for(let i=0;i<140;i++)click(h,'step');
 click(h,'mission-check');assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');
 const note=h.el('field-notes-list').innerHTML,result=h.el('mission-result').textContent;
 click(h,'orbit-fire');click(h,'orbit-recall');
 assert.equal(h.el('field-notes-list').innerHTML,note);assert.equal(h.el('mission-result').textContent,result);
});

test('repeated Enter is guarded while fresh Enter, Space, navigation and pointer defaults remain native',async()=>{
 const h=await setup('?experiment=orbit');
 for(const [key,repeat,expected] of [['Enter',true,true],['Enter',false,false],[' ',true,false],[' ',false,false],['Tab',true,false],['Escape',true,false]]){
  let prevented=false;h.el('orbit-recall').handlers.keydown({key,repeat,preventDefault(){prevented=true;}});assert.equal(prevented,expected);
 }
});

test('recall has one quiet described native button, bounded disclosure and wrapping 44px targets',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.equal((html.match(/id="orbit-recall"/g)||[]).length,1);
 assert.match(html,/<button id="orbit-recall" aria-disabled="true" aria-describedby="orbit-recall-status orbit-recall-help">撤回最近发射 ↶<\/button>/);
 assert.match(html,/<p id="orbit-recall-status" aria-live="off"><\/p>/);
 assert.match(html,/<small id="orbit-recall-help">[^<]*仅撤回最近一次成功发射[^<]*暂停[^<]*其他行星[^<]*时间不回退[^<]*重置[^<]*载入[^<]*<\/small>/);
 assert.match(css,/\.orbit-touch button\{[^}]*min-width:44px;min-height:44px/);
 assert.match(css,/\.orbit-touch \.orbit-actions\{[^}]*flex-wrap:wrap/);
 assert.match(css,/\.orbit-touch \.orbit-actions button\{[^}]*flex:1 1 130px/);
 assert.match(css,/#orbit-recall\[aria-disabled="true"\]/);
});
