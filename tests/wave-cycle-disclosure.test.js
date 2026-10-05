import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
const names=['left','right','combined'],TAU=2*Math.PI;
const click=(h,id)=>h.el(id).handlers.click();
const toggle=(h,open)=>{h.el('instruments').open=open;h.el('instruments').handlers.toggle();};
const seek=(h,time)=>{h.el('wave-time').value=String(time);click(h,'wave-time-seek');};
const position=(h,x,y)=>{h.el('wave-target-x').value=String(x);h.el('wave-target-y').value=String(y);click(h,'wave-position');};
const presentation=h=>names.map(n=>[h.el('wave-cycle-'+n).getAttribute('points'),h.el('wave-cycle-cursor-'+n).getAttribute('transform'),h.el('wave-cycle-dot-'+n).getAttribute('cx'),h.el('wave-cycle-dot-'+n).getAttribute('cy')]).concat(h.el('wave-cycle-period').textContent);
const unchanged=h=>({drawing:h.drawing(),draws:h.drawCount(),time:h.el('wave-time-current').textContent,metrics:h.el('metrics').textContent,position:h.el('wave-position-current').textContent,message:h.el('announcement').textContent,status:h.el('status').textContent,frames:[...h.frames.keys()],url:location.href,writes:h.writes(),notes:h.el('notes-text').value,undo:h.el('observation-undo-status').textContent,focus:document.activeElement?.id});
function watch(h){const writes=[];for(const n of names)for(const prefix of ['wave-cycle-','wave-cycle-cursor-','wave-cycle-dot-']){const e=h.el(prefix+n),set=e.setAttribute.bind(e);e.setAttribute=(...args)=>{writes.push([prefix+n,...args]);set(...args);};}let text=h.el('wave-cycle-period').textContent;Object.defineProperty(h.el('wave-cycle-period'),'textContent',{get:()=>text,set:value=>{writes.push(['caption',value]);text=value;}});return writes;}
function check(h,x=0,y=0,time=0,w=32,s=100){
 const a=Math.hypot(x+s/2,y)/w*TAU,b=Math.hypot(x-s/2,y)/w*TAU;
 const parts=phase=>[Math.sin(a-phase),Math.sin(b-phase),(Math.sin(a-phase)+Math.sin(b-phase))/2];
 const fraction=((time*3%TAU)+TAU)%TAU/TAU,px=(fraction<1e-10||1-fraction<1e-10?0:fraction)*600;
 const near=(actual,expected)=>assert.ok(Math.abs(Number(actual)-expected)<1e-8,`${actual} ≈ ${expected}`);
 names.forEach((n,j)=>{const points=h.el('wave-cycle-'+n).getAttribute('points').split(' ').map(p=>p.split(','));assert.equal(points.length,65);points.forEach(([x,y],i)=>{near(x,i/64*600);near(y,28-parts(i/64*TAU)[j]*24);});assert.equal(h.el('wave-cycle-cursor-'+n).getAttribute('transform'),`translate(${px} 0)`);near(h.el('wave-cycle-dot-'+n).getAttribute('cx'),px);near(h.el('wave-cycle-dot-'+n).getAttribute('cy'),28-parts(time*3)[j]*24);});
 assert.equal(h.el('wave-cycle-period').textContent,`一周期 T ≈ 2.094 模型秒 · 当前周期位置约 ${(px/6).toFixed(1)}%。`);
}
test('closed startup avoids optional traces but keeps exact current readings and action feedback',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,.125');assert.equal(h.el('wave-cycle-left').getAttribute('points'),null);assert.equal(h.el('wave-cycle-period').textContent,'');
 assert.equal(h.el('wave-time-current').textContent,'当前时刻 · t 0.125 模型秒');assert.match(h.el('wave-probe-reading').textContent,/探针 x 8.0/);click(h,'step');assert.match(h.el('announcement').textContent,/推进四分之一周期/);assert.equal(h.el('wave-cycle-left').getAttribute('points'),null);
 const before=unchanged(h);toggle(h,true);assert.deepEqual(unchanged(h),before);check(h,8,0,.125+Math.PI/6);
});
test('120 closed animated frames avoid the 1080 SVG writes while model and near-canvas readings advance',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,0');toggle(h,true);check(h);toggle(h,false);const before=presentation(h),writes=watch(h);click(h,'pause');h.tick(0);const draws=h.drawCount();let time=0;
 for(let i=1;i<=120;i++){h.tick(i*1000/60);time+=(i*1000/60-(i-1)*1000/60)/1000;}
 assert.equal(h.drawCount()-draws,120);assert.equal(writes.length,0);assert.deepEqual(presentation(h),before);assert.ok(h.el('metrics').textContent.includes('2.0 s'));assert.notEqual(h.el('wave-instant-reading').textContent,'探针此刻 (A+B)/2 · -0.38');
 const state=unchanged(h);toggle(h,true);assert.deepEqual(unchanged(h),state);check(h,0,0,time);assert.equal(writes.filter(w=>w[0]!=='caption').length,9);
 writes.length=0;h.tick(121*1000/60);assert.equal(writes.filter(w=>w[0]!=='caption').length,9);
});
test('closed geometry and time edits refresh all 65 samples on open, including extremes and tiny times',async()=>{
 const h=await setup('?experiment=wave');for(const [x,y,t,w,s] of [[8,0,.125,32,100],[-50,0,4,70,180],[10000,-10000,1e9,15,20],[1e-7,-1e-7,1e-7,32,100]]){toggle(h,false);const old=presentation(h);h.el('wavelength').handlers.input({target:{value:String(w)}});h.el('separation').handlers.input({target:{value:String(s)}});position(h,x,y);seek(h,t);assert.deepEqual(presentation(h),old);toggle(h,true);check(h,x,y,t,w,s);}
});
test('disclosure tasks use current open and world state, including rapid changes and closed-world return',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5');toggle(h,true);const before=presentation(h);toggle(h,false);position(h,-240,110);
 h.el('instruments').open=true;h.el('instruments').open=false;h.el('instruments').handlers.toggle({newState:'open'});assert.deepEqual(presentation(h),before);
 for(const world of ['orbit','life','fractal','walk']){click(h,'tab-'+world);const state=unchanged(h);toggle(h,true);assert.deepEqual(unchanged(h),state);assert.deepEqual(presentation(h),before);toggle(h,false);click(h,'tab-wave');assert.deepEqual(presentation(h),before);}
 toggle(h,true);check(h,-240,110,2.5);click(h,'tab-life');click(h,'tab-wave');check(h,-240,110,2.5);
});
test('opening is quiet, idempotent and keeps focus, pause, drafts and invalid-input feedback',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5');h.el('wave-time').value='unfinished';click(h,'wave-time-seek');const error=h.el('wave-time-error').textContent;h.el('instrument-summary').focus();const state=unchanged(h),writes=watch(h);toggle(h,true);check(h,8,12,2.5);assert.deepEqual(unchanged(h),state);assert.equal(h.el('wave-time').value,'unfinished');assert.equal(h.el('wave-time-error').textContent,error);
 writes.length=0;for(let i=0;i<5;i++){toggle(h,false);toggle(h,true);}assert.equal(writes.length,0);assert.deepEqual(unchanged(h),state);
});
test('fixed observations, return undo, hash navigation and pending sharing retain the right current plot',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5','#canvas');position(h,-240,110);seek(h,.125);click(h,'observation-return');const url=location.href;toggle(h,true);check(h,8,12,2.5);toggle(h,false);click(h,'observation-undo');toggle(h,true);check(h,-240,110,.125);assert.equal(location.href,url);
 toggle(h,false);let resolve;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(r=>resolve=r)}}});try{const pending=click(h,'share');seek(h,3);const before=unchanged(h);toggle(h,true);assert.deepEqual(unchanged(h),before);resolve();await pending;check(h,-240,110,3);assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),'v1,-240,110,0.125');}finally{delete globalThis.navigator;}
 h.navigate(location.search+'#instruments');check(h,-240,110,3);toggle(h,false);h.navigate('?experiment=wave&wavelength=15&separation=20&at=v1,1,2,3');toggle(h,true);check(h,1,2,3,15,20);
});
test('reset, presets, guides and completed discoveries do not rely on hidden curves',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');click(h,'mission-check');click(h,'wave-home');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;toggle(h,true);check(h);toggle(h,false);
 h.el('preset-select').handlers.change({target:{value:'wide'}});click(h,'load-preset');toggle(h,true);check(h,0,0,0,65,150);toggle(h,false);click(h,'guide-start');toggle(h,true);check(h,8);assert.equal(h.el('notes-text').value,notes);toggle(h,false);click(h,'reset');toggle(h,true);check(h);
});
test('hidden display/context interruptions, text-only startup and canvas capture preserve fresh open plots',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5','',true,1,false);assert.equal(h.el('wave-cycle-left').getAttribute('points'),null);toggle(h,true);check(h,8,12,2.5);toggle(h,false);seek(h,.125);const old=presentation(h);
 for(const [w,z] of [[0,0],[163,240],[259.5,240.25],[647,317.9375]])h.resize(w,z);h.setDpr(2);h.setContextReady(true);click(h,'canvas-retry');h.loseContext();h.restoreContext();h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);assert.deepEqual(presentation(h),old);const state=unchanged(h);toggle(h,true);assert.deepEqual(unchanged(h),state);check(h,8,12,.125);
 toggle(h,false);let captures=0;h.el('canvas').toBlob=cb=>{captures++;cb(null);};click(h,'save');assert.equal(captures,1);toggle(h,true);check(h,8,12,.125);
});
test('native disclosure, existing quiet semantics, visible controls and intentional batch repeats are retained',async()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/<details id="instruments" class="instrument-drawer">/);assert.match(html,/<p id="wave-cycle-period" aria-live="off">/);assert.match(html,/cycle=disclosure-1/);
 const h=await setup('?experiment=wave');for(const world of ['fractal','walk']){click(h,'tab-'+world);toggle(h,true);for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional batch repetition changed');}});click(h,'step');}assert.ok(h.el('metrics').textContent.includes(world==='fractal'?'500 个点':'48 步'));}
});
