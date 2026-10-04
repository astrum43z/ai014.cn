import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const field=(h,axis)=>h.el('orbit-target-'+axis);
const type=(h,axis,value)=>{field(h,axis).value=String(value);field(h,axis).handlers.input();};
function position(h,x,y){type(h,'x',x);type(h,'y',y);click(h,'orbit-position-apply');}
function key(h,axis,extra={}){let prevented=false;field(h,axis).handlers.keydown({key:'Enter',preventDefault(){prevented=true;},...extra});return prevented;}
const scale=h=>h.drawing().find(c=>c[0]==='scale')?.[1];
const bodies=h=>{const s=scale(h);return h.drawing().filter(c=>c[0]==='arc'&&Math.abs(c[3]*s-4.5)<1e-9).map(c=>c.slice(1,3));};
function trails(h){let active=false,result=[];for(const c of h.drawing()){if(c[0]==='strokeStyle')active=/^#[a-f\d]{6}75$/.test(c[1]);if(active&&['moveTo','lineTo'].includes(c[0]))result.push(c);}return result;}
function model(h){return {bodies:bodies(h),trails:trails(h),metrics:h.el('metrics').textContent,readings:['a','b','c'].map(k=>h.el('observation-'+k).textContent),recall:h.el('orbit-recall-status').textContent,notes:h.el('notes-text').value,url:location.href};}
function state(h){return {...model(h),drawing:h.drawing(),frames:h.frames.size,point:h.el('orbit-position-current').textContent};}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
function checkPoint(h,x,y){assert.equal(h.el('orbit-position-current').textContent,`当前发射点 x ${x}，y ${y}；输入框保留目标。`);assert.equal(h.el('orbit-position-error').hidden,true);}
// Independent scalar integration of the existing tangential initial velocity.
function move(x,y,steps,gravity=80,percentage=100){const r=Math.hypot(x,y),v=Math.sqrt(gravity*1000/r)*percentage/100;let vx=-y/r*v,vy=x/r*v;for(let i=0;i<steps;i++){const d=Math.max(Math.hypot(x,y),18);vx-=gravity*1000*x/(d*d*d)*.01;vy-=gravity*1000*y/(d*d*d)*.01;x+=vx*.01;y+=vy*.01;}return [x,y];}

for(const [x,y] of [[137.5,-42.5],[-280,-55],[10000,-10000],[-10000,10000],[0,0],[1e-7,-2e-8],[5e-324,22]])test(`exact selection ${x}, ${y} preserves all planets and time`,async()=>{
 const h=await setup('?experiment=orbit');click(h,'orbit-fire');for(let i=0;i<3;i++)click(h,'step');const before=model(h);position(h,x,y);checkPoint(h,x,y);assert.deepEqual(model(h),before);assert.equal(h.frames.size,0);assert.match(h.el('announcement').textContent,/未添加行星，保留轨迹与时刻/);
 const s=scale(h),r=h.el('canvas').getBoundingClientRect();assert.ok(Math.abs(x*s)+34<=r.width/2+1e-8);assert.ok(Math.abs(y*s)+34<=r.height/2+1e-8);
});

test('exact selected launch and preview match independent physics; old bodies keep their next step',async()=>{
 const h=await setup('?experiment=orbit&gravity=30&speed=65');position(h,137.5,-42.5);const old=bodies(h),s=scale(h),end=move(137.5,-42.5,1000,30,65),square=h.drawing().find(c=>c[0]==='strokeRect');close(square[1]+4/s,end[0]);close(square[2]+4/s,end[1]);
 click(h,'orbit-fire');assert.deepEqual(bodies(h).slice(0,3),old);assert.deepEqual(bodies(h).at(-1),[137.5,-42.5]);click(h,'step');const actual=bodies(h).at(-1),expected=move(137.5,-42.5,10,30,65);actual.forEach((n,i)=>close(n,expected[i]));
 position(h,-85.25,19.75);click(h,'orbit-recall');assert.match(h.el('metrics').textContent,/3 颗行星 · t \+ 0.1 s/);assert.equal(h.el('orbit-recall').getAttribute('aria-disabled'),'true');
 const reference=await setup('?experiment=orbit&gravity=30&speed=65');click(reference,'step');assert.deepEqual(bodies(h),bodies(reference));assert.deepEqual(trails(h),trails(reference));
});

test('invalid coordinates never partially move, pause, refit or replace an active model',async()=>{
 const h=await setup('?experiment=orbit','',false);h.tick(0);h.tick(50);
 for(const axis of ['x','y'])for(const value of ['', ' ', '-', '.', '-.', '10000.01','-10001','Infinity','NaN','1e+','1e999','1e-9999','0x10','⑦.５','7,5','7 units']){
  type(h,'x','137.5');type(h,'y','-42.5');type(h,axis,value);const before=state(h);click(h,'orbit-position-apply');assert.deepEqual(state(h),before,axis+' '+value);assert.equal(field(h,axis).getAttribute('aria-invalid'),'true');assert.equal(field(h,axis==='x'?'y':'x').getAttribute('aria-invalid'),'false');assert.equal(document.activeElement,field(h,axis));assert.equal(h.el('orbit-position-error').hidden,false);
 }
 type(h,'x','-');type(h,'y','-');click(h,'orbit-position-apply');assert.equal(document.activeElement,field(h,'x'));type(h,'x','137.5');assert.equal(h.el('orbit-position-error').hidden,false);type(h,'y','-42.5');assert.equal(h.el('orbit-position-error').hidden,true);assert.equal(h.el('orbit-position-error').textContent,'');click(h,'orbit-position-apply');checkPoint(h,137.5,-42.5);assert.equal(h.frames.size,0);
});

test('both fields accept full-width, signed decimal and scientific Enter without stealing focus',async()=>{
 for(const axis of ['x','y']){const h=await setup('?experiment=orbit');type(h,'x',' ＋００１３７．５ ');type(h,'y','−４．２５Ｅ＋１');field(h,axis).focus();assert.equal(key(h,axis),true);assert.equal(document.activeElement,field(h,axis));checkPoint(h,137.5,-42.5);assert.equal(field(h,'x').value,'137.5');assert.equal(field(h,'y').value,'-42.5');}
 const h=await setup('?experiment=orbit');position(h,' ０．００００００１ ','−２ｅ−８');checkPoint(h,1e-7,-2e-8);assert.equal(field(h,'x').value,'0.0000001');assert.equal(field(h,'y').value,'-2e-8');click(h,'orbit-position-apply');checkPoint(h,1e-7,-2e-8);position(h,'-0','0e-9999');checkPoint(h,0,0);
});

test('held, modified and composing Enter leaves drafts and model untouched',async()=>{
 const h=await setup('?experiment=orbit');type(h,'x','137.5');type(h,'y','-42.5');const before=state(h);
 for(const axis of ['x','y']){assert.equal(key(h,axis,{repeat:true}),true);for(const extra of [{isComposing:true},{keyCode:229},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true}])assert.equal(key(h,axis,extra),false);for(const k of ['Escape',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'])assert.equal(key(h,axis,{key:k}),false);}
 assert.deepEqual(state(h),before);let p=false;h.el('orbit-position-apply').handlers.keydown({key:'Enter',repeat:true,preventDefault(){p=true;}});assert.equal(p,true);for(const e of [{key:'Enter',repeat:false},{key:' ',repeat:true}])h.el('orbit-position-apply').handlers.keydown({...e,preventDefault(){assert.fail('native activation suppressed');}});
});

test('drafts survive animation, pointer launches, arrows, Home, reset, presets and retained worlds',async()=>{
 const h=await setup('?experiment=orbit','',false);h.tick(0);type(h,'x','137.');type(h,'y','-.');h.tick(50);click(h,'orbit-left');checkPoint(h,135,0);h.key('ArrowUp');checkPoint(h,135,-5);click(h,'orbit-home');checkPoint(h,140,0);
 const s=scale(h);h.el('canvas').handlers.click({detail:1,clientX:300-80*s,clientY:207+60*s});const pointer=h.el('orbit-position-current').textContent.match(/x ([^，]+)，y ([^；]+)/);close(Number(pointer[1]),-80);close(Number(pointer[2]),60);
 click(h,'reset');checkPoint(h,140,0);h.el('preset-select').handlers.change({target:{value:'elliptic'}});click(h,'load-preset');checkPoint(h,140,0);
 for(const world of ['life','wave','fractal','walk']){click(h,'tab-'+world);click(h,'tab-orbit');checkPoint(h,140,0);}assert.equal(field(h,'x').value,'137.');assert.equal(field(h,'y').value,'-.');
});

test('selecting the same point pauses, and Continue resumes without elapsed-time jumps',async()=>{
 const h=await setup('?experiment=orbit','',false);h.tick(0);h.tick(50);const before=model(h);position(h,140,0);assert.deepEqual(model(h),before);assert.equal(h.frames.size,0);click(h,'pause');h.tick(90000);assert.deepEqual(model(h),before);h.tick(90050);assert.notDeepEqual(bodies(h),before.bodies);assert.match(h.el('metrics').textContent,/t \+ 0.1 s/);
});

test('center validity and body cap preserve correction guidance and existing recall',async()=>{
 const h=await setup('?experiment=orbit');click(h,'orbit-fire');for(const x of [0,21.999,22]){position(h,x,0);assert.equal(h.el('orbit-fire').getAttribute('aria-disabled'),String(x<22));const before=model(h);if(x<22){click(h,'orbit-fire');assert.deepEqual(model(h),before);assert.match(h.el('orbit-launch-note').textContent,/至少 22/);}}
 click(h,'orbit-recall');assert.match(h.el('metrics').textContent,/3 颗行星/);position(h,137.5,-42.5);for(let i=0;i<21;i++)click(h,'orbit-fire');assert.match(h.el('metrics').textContent,/24 颗行星/);position(h,0,22);assert.equal(h.el('orbit-fire').getAttribute('aria-disabled'),'true');assert.equal(h.el('orbit-preview-reading').hidden,true);click(h,'orbit-recall');assert.equal(h.el('orbit-fire').getAttribute('aria-disabled'),'false');assert.equal(h.el('orbit-preview-reading').hidden,false);
});

test('narrow, fractional and density changes fit the same exact target without rewriting drafts',async()=>{
 const h=await setup('?experiment=orbit');position(h,9000.125,-7654.5);const before=model(h);type(h,'x','-');type(h,'y','12.');
 for(const [w,v] of [[171,240],[259,240],[334.5,281.75],[600,414]])for(const dpr of [1,1.25,2,3]){h.resize(w,v);h.setDpr(dpr);assert.deepEqual(model(h),before);checkPoint(h,9000.125,-7654.5);const s=scale(h);assert.ok(Math.abs(9000.125*s)+34<=w/2+1e-8);assert.ok(Math.abs(-7654.5*s)+34<=v/2+1e-8);}
 assert.equal(field(h,'x').value,'-');assert.equal(field(h,'y').value,'12.');click(h,'orbit-home');assert.ok(scale(h)>.5);checkPoint(h,140,0);
});

test('unavailable bitmap and collapsed layout keep model-space selection available',async()=>{
 const h=await setup('?experiment=orbit','',true,1,false);position(h,137.5,-42.5);checkPoint(h,137.5,-42.5);assert.equal(h.drawCount(),0);h.setContextReady(true);click(h,'canvas-retry');const before=model(h);h.resize(0,0);position(h,-85.25,19.75);checkPoint(h,-85.25,19.75);h.resize(600,414);assert.deepEqual(model(h),before);h.loseContext();position(h,137.5,-42.5);h.restoreContext();checkPoint(h,137.5,-42.5);assert.deepEqual(model(h),before);
});

test('quiet exact readings repair stale text but avoid identical writes and announcements',async()=>{
 const h=await setup('?experiment=orbit');position(h,137.5,-42.5);const el=h.el('orbit-position-current');let value=el.textContent,writes=0;Object.defineProperty(el,'textContent',{get:()=>value,set:next=>{value=next;writes++;}});const message=h.el('announcement').textContent;
 for(let i=0;i<20;i++)h.resize(600,414);h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();assert.equal(writes,0);assert.equal(h.el('announcement').textContent,message);value='stale';h.resize(600,414);checkPoint(h,137.5,-42.5);assert.equal(writes,1);
});

test('inactive Orbit targets cannot change another world, its feedback or recovery',async()=>{
 const h=await setup('?experiment=orbit');position(h,137.5,-42.5);for(const world of ['life','wave','fractal','walk']){click(h,'tab-'+world);const before=state(h),message=h.el('announcement').textContent;click(h,'orbit-position-apply');key(h,'x');assert.deepEqual(state(h),before);assert.equal(h.el('announcement').textContent,message);click(h,'tab-orbit');checkPoint(h,137.5,-42.5);}
});

test('positioning preserves parameter-only sharing and latest-action asynchronous feedback',async()=>{
 const pending=[];Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:text=>new Promise(resolve=>pending.push({text,resolve}))}}});
 try{const h=await setup('?experiment=orbit');const copy=click(h,'share');position(h,137.5,-42.5);const message=h.el('announcement').textContent;pending[0].resolve();await copy;assert.equal(h.el('announcement').textContent,message);assert.match(h.el('share-status').textContent,/已复制/);assert.equal(new URL(pending[0].text).searchParams.has('at'),false);assert.equal(new URL(pending[0].text).searchParams.has('x'),false);
 let finish;h.el('canvas').toBlob=cb=>finish=cb;click(h,'save');position(h,-85.25,19.75);const latest=h.el('announcement').textContent;finish(null);assert.equal(h.el('announcement').textContent,latest);
 }finally{delete globalThis.navigator;}
});

test('Orbit discovery evidence and intentional seeded batch repeats remain independent',async()=>{
 const h=await setup('?experiment=orbit');click(h,'mission-start');click(h,'mission-check');position(h,137.5,-42.5);assert.equal(h.el('notes-count').textContent,'0 / 5');h.el('gravity').handlers.input({target:{value:'40'}});for(let i=0;i<80;i++)click(h,'step');position(h,10000,-10000);click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;
 click(h,'tab-fractal');for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('batch repeat suppressed');}});click(h,'step');}assert.match(h.el('metrics').textContent,/500 个点/);click(h,'tab-walk');h.key('ArrowRight');h.key('ArrowRight',{repeat:true});assert.match(h.el('metrics').textContent,/48 步/);assert.equal(h.el('notes-text').value,notes);
});

test('optional exact controls use labels, quiet current/error readings, 44px targets and reflow',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8'),panel=html.match(/<section id="orbit-launch".*?<\/section>/s)?.[0];assert.ok(panel);assert.ok(html.indexOf('id="orbit-target-x"')>html.indexOf('id="instruments"'));
 for(const axis of ['x','y'])assert.match(panel,new RegExp(`<label for="orbit-target-${axis}">目标 ${axis}<input id="orbit-target-${axis}" type="text" inputmode="decimal"[^>]*aria-invalid="false" aria-describedby="orbit-position-current orbit-position-help orbit-position-error"`));
 assert.match(panel,/<button id="orbit-position-apply" type="button" aria-controls="canvas"/);assert.match(panel,/<p id="orbit-position-current" aria-live="off">/);assert.match(panel,/<p id="orbit-position-error" aria-live="off" hidden>/);assert.match(panel,/只选位、不发射/);assert.match(panel,/距中心至少 22.*24 颗上限/);assert.match(panel,/href="#canvas">回到画布预演/);assert.doesNotMatch(panel,/aria-live="(?:polite|assertive)"|role="status"/);
 assert.match(css,/\.orbit-target-fields\{display:flex;flex-wrap:wrap/);assert.match(css,/\.orbit-target input\{[^}]*min-width:0;min-height:44px/);assert.match(css,/\.orbit-target button\{[^}]*min-height:44px[^}]*white-space:normal/);assert.match(html,/app\.js\?[^"\n]*&amp;orbit-target=exact-1/);assert.match(html,/style\.css\?[^"\n]*&amp;orbit-target=exact-1/);
});
