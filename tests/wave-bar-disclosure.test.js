import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
const names=['left','right','combined'],click=(h,id)=>h.el(id).handlers.click();
const toggle=(h,open)=>{h.el('instruments').open=open;h.el('instruments').handlers.toggle();};
const seek=(h,t)=>{h.el('wave-time').value=String(t);click(h,'wave-time-seek');};
const position=(h,x,y)=>{h.el('wave-target-x').value=String(x);h.el('wave-target-y').value=String(y);click(h,'wave-position');};
const bars=h=>names.map(n=>{const e=h.el('wave-bar-'+n);return [e.getAttribute('x'),e.getAttribute('width')];});
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),frames:[...h.frames.keys()],time:h.el('wave-time-current').textContent,position:h.el('wave-position-current').textContent,metrics:h.el('metrics').textContent,status:h.el('status').textContent,values:names.map(n=>h.el('wave-value-'+n).textContent),near:h.el('wave-instant-reading').textContent,feedback:h.el('announcement').textContent,focus:document.activeElement?.id,url:location.href,writes:h.writes(),saved:h.el('saved-observation-reading').textContent,undo:h.el('observation-undo-status').textContent,notes:h.el('notes-text').value});
function watch(h){const writes=[];for(const n of names){const e=h.el('wave-bar-'+n),set=e.setAttribute.bind(e);e.setAttribute=(...a)=>{writes.push([n,...a]);set(...a);};}return writes;}
function check(h,x=0,y=0,t=0,w=32,s=100){
 const a=Math.sin(Math.hypot(x+s/2,y)*2*Math.PI/w-t*3),b=Math.sin(Math.hypot(x-s/2,y)*2*Math.PI/w-t*3);
 for(const [i,v] of [a,b,(a+b)/2].entries()){
  const actual=bars(h)[i].map(Number),expected=[100+Math.min(0,v)*100,Math.abs(v)*100];
  for(let j=0;j<2;j++)assert.ok(Math.abs(actual[j]-expected[j])<1e-5,`${names[i]}: ${actual[j]} ≈ ${expected[j]}`);
  const rounded=Math.abs(v)<.005?0:v;assert.equal(h.el('wave-value-'+names[i]).textContent,(rounded>0?'+':'')+rounded.toFixed(2));
 }
}
test('closed startup leaves bar geometry untouched while readings and quarter-step feedback stay current',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,.125');assert.deepEqual(bars(h),names.map(()=>[null,null]));
 assert.equal(h.el('wave-time-current').textContent,'当前时刻 · t 0.125 模型秒');click(h,'step');assert.match(h.el('announcement').textContent,/推进四分之一周期/);assert.deepEqual(bars(h),names.map(()=>[null,null]));
 const before=state(h);toggle(h,true);assert.deepEqual(state(h),before);check(h,8,12,.125+Math.PI/6);
});
test('120 closed animated frames remove the measured 534 bar writes without changing model frames or text',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,0');toggle(h,true);check(h);toggle(h,false);const old=bars(h),writes=watch(h);click(h,'pause');h.tick(0);const draws=h.drawCount();let t=0;
 for(let i=1;i<=120;i++){h.tick(i*1000/60);t+=(i*1000/60-(i-1)*1000/60)/1000;}
 assert.equal(h.drawCount()-draws,120);assert.equal(writes.length,0);assert.deepEqual(bars(h),old);assert.equal(h.el('wave-time-current').textContent,`当前时刻 · t ${t} 模型秒`);assert.equal(h.frames.size,1);
 const before=state(h);toggle(h,true);assert.deepEqual(state(h),before);check(h,0,0,t);assert.ok(writes.length>0);writes.length=0;h.tick(121*1000/60);assert.ok(writes.length>0);check(h,0,0,t+1/60);
});
test('opening refreshes exact signs, cancellation, extremes and tiny values after hidden edits',async()=>{
 const h=await setup('?experiment=wave');
 for(const [x,y,t,w,s] of [[-50,0,0,32,100],[0,0,Math.PI/6,32,100],[7.5,0,.125,30,100],[10000,-10000,1e9,15,20],[-10000,10000,.125,70,180],[1e-7,-1e-7,5e-324,32,100]]){
  toggle(h,false);const old=bars(h);h.el('wavelength').handlers.input({target:{value:String(w)}});h.el('separation').handlers.input({target:{value:String(s)}});position(h,x,y);seek(h,t);assert.deepEqual(bars(h),old);toggle(h,true);check(h,x,y,t,w,s);
 }
});
test('native coalesced toggles and retained worlds use current open state, never a stale event',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5');toggle(h,true);const old=bars(h);toggle(h,false);position(h,-240,110);
 h.el('instruments').open=true;h.el('instruments').open=false;h.el('instruments').handlers.toggle({newState:'open'});assert.deepEqual(bars(h),old);
 for(const world of ['orbit','life','fractal','walk']){click(h,'tab-'+world);const before=state(h);toggle(h,true);assert.deepEqual(state(h),before);assert.deepEqual(bars(h),old);toggle(h,false);click(h,'tab-wave');assert.deepEqual(bars(h),old);}
 toggle(h,true);check(h,-240,110,2.5);click(h,'tab-life');click(h,'tab-wave');check(h,-240,110,2.5);
});
test('opening stays quiet, keeps focus, errors and drafts, and repairs only altered attributes',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5');seek(h,'unfinished');position(h,'bad','1e+');h.el('instrument-summary').focus();const before=state(h),writes=watch(h);toggle(h,true);check(h,8,12,2.5);assert.deepEqual(state(h),before);
 assert.equal(h.el('wave-time').value,'unfinished');assert.equal(h.el('wave-target-x').value,'bad');assert.equal(h.el('wave-time-error').hidden,false);assert.equal(h.el('wave-position-error').hidden,false);
 writes.length=0;for(let i=0;i<5;i++){toggle(h,false);toggle(h,true);}assert.equal(writes.length,0);const expected=bars(h);toggle(h,false);h.el('wave-bar-left').attributes.x='broken';delete h.el('wave-bar-right').attributes.width;toggle(h,true);assert.deepEqual(bars(h),expected);assert.deepEqual(writes.map(w=>w.slice(0,2)),[['left','x'],['right','width']]);
});
test('opening neither consumes a pending animation interval nor advances an offscreen, hidden or unavailable canvas',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5');click(h,'pause');h.tick(0);h.tick(20);let t=2.52;const before=state(h);toggle(h,true);assert.deepEqual(state(h),before);check(h,8,12,t);h.tick(50);t+=.03;check(h,8,12,t);
 for(const [suspend,resume] of [[()=>h.setVisible(false),()=>h.setVisible(true)],[()=>h.setHidden(true),()=>h.setHidden(false)],[()=>h.loseContext(),()=>h.restoreContext()]]){suspend();toggle(h,false);const before=state(h);toggle(h,true);assert.deepEqual(state(h),before);check(h,8,12,t);resume();h.tick(100000);check(h,8,12,t);}
 click(h,'pause');assert.equal(h.frames.size,0);
});
test('fixed links, return undo, pending sharing and navigation retain exact current bars',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5','#canvas');position(h,-240,110);seek(h,.125);click(h,'observation-return');const url=location.href;toggle(h,true);check(h,8,12,2.5);toggle(h,false);click(h,'observation-undo');toggle(h,true);check(h,-240,110,.125);assert.equal(location.href,url);
 toggle(h,false);let resolve;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(r=>resolve=r)}}});
 try{const pending=click(h,'share');seek(h,3);const before=state(h);toggle(h,true);assert.deepEqual(state(h),before);resolve();await pending;check(h,-240,110,3);assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),'v1,-240,110,0.125');}finally{delete globalThis.navigator;}
 h.navigate(location.search+'#instruments');check(h,-240,110,3);toggle(h,false);h.navigate('?experiment=wave&wavelength=15&separation=20&at=v1,1,2,3');toggle(h,true);check(h,1,2,3,15,20);
});
test('reset, presets, guides, discoveries and captures do not depend on hidden geometry',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');click(h,'mission-check');click(h,'wave-home');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;toggle(h,true);check(h);toggle(h,false);
 h.el('preset-select').handlers.change({target:{value:'wide'}});click(h,'load-preset');toggle(h,true);check(h,0,0,0,65,150);toggle(h,false);click(h,'guide-start');toggle(h,true);check(h,8);toggle(h,false);click(h,'reset');toggle(h,true);check(h);assert.equal(h.el('notes-text').value,notes);
 toggle(h,false);let captures=0;h.el('canvas').toBlob=cb=>{captures++;cb(null);};click(h,'save');assert.equal(captures,1);toggle(h,true);check(h);
});
for(const context of [false,'throw'])test(`text-only startup (${context}) and display recovery refresh current open bars`,async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5','',true,1,context);assert.deepEqual(bars(h),names.map(()=>[null,null]));toggle(h,true);check(h,8,12,2.5);toggle(h,false);seek(h,.125);const old=bars(h);
 for(const [w,z] of [[0,0],[163,240],[259.5,240.25],[647,317.9375]])h.resize(w,z);h.setDpr(2);h.setContextReady(true);click(h,'canvas-retry');h.loseContext();h.restoreContext();assert.deepEqual(bars(h),old);const before=state(h);toggle(h,true);assert.deepEqual(state(h),before);check(h,8,12,.125);
});
test('native disclosure, quiet values, held batch keys and parameter sliders keep their existing behavior',async()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/<details id="instruments" class="instrument-drawer">/);assert.match(html,/bar-drawer=idle-1/);
 const h=await setup('?experiment=wave');for(const world of ['fractal','walk']){click(h,'tab-'+world);toggle(h,true);for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional repetition changed');}});click(h,'step');}assert.match(h.el('metrics').textContent,world==='fractal'?/500 个点/:/48 步/);}
 h.el('bias').value='4';h.el('bias').handlers.input({target:h.el('bias')});assert.equal(new URL(location.href).searchParams.get('bias'),'4');
});
