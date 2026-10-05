import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const click=(h,id)=>h.el(id).handlers.click();
const seek=(h,time)=>{h.el('wave-time').value=String(time);click(h,'wave-time-seek');};
const open=h=>{h.el('instruments').open=true;h.el('instruments').handlers.toggle();};
const snapshot=h=>({drawing:h.drawing(),frames:[...h.frames.keys()],writes:h.writes(),search:location.search,
 readings:['metrics','status','wave-time-current','wave-position-current','wave-probe-reading','wave-distances','wave-difference','wave-path-context','wave-envelope','wave-cycle-period','mission-result','announcement','saved-observation-reading','observation-undo-status'].map(id=>h.el(id).textContent),
 values:['left','right','combined'].map(n=>[h.el('wave-value-'+n).textContent,h.el('wave-bar-'+n).getAttribute('x'),h.el('wave-bar-'+n).getAttribute('width'),h.el('wave-cycle-'+n).getAttribute('points'),h.el('wave-cycle-cursor-'+n).getAttribute('transform'),h.el('wave-cycle-dot-'+n).getAttribute('cy')]),
 drafts:['wave-time','wave-target-x','wave-target-y'].map(id=>[h.el(id).value,h.el(id).getAttribute('aria-invalid')]),
 errors:['wave-time-error','wave-position-error'].map(id=>[h.el(id).textContent,h.el(id).hidden]),
 drawer:h.el('instruments').open,notes:h.el('notes-text').value,link:h.el('share-link').value.split('#')[0]});
// The harness exercises the application's same-query history boundary only;
// native scrolling and focus are verified in the public browser separately.
const roundtrip=h=>{const before=snapshot(h);for(const hash of ['#canvas','#wave-components','#canvas','#control-title','#canvas']){h.navigate(location.search+hash);assert.deepEqual(snapshot(h),before);}};
function check(h,x,y,t,wavelength=30,separation=100){
 const left=Math.sin(Math.hypot(x+separation/2,y)*2*Math.PI/wavelength-3*t),right=Math.sin(Math.hypot(x-separation/2,y)*2*Math.PI/wavelength-3*t);
 const numbers=[left,right,(left+right)/2];
 ['left','right','combined'].forEach((name,i)=>{
  const value=Math.abs(numbers[i])<.005?0:numbers[i];
  assert.equal(h.el('wave-value-'+name).textContent,(value>0?'+':'')+value.toFixed(2));
  if(h.el('instruments').open){
   assert.ok(Math.abs(Number(h.el('wave-bar-'+name).getAttribute('width'))-Math.abs(numbers[i])*100)<1e-8);
   assert.ok(Math.abs(Number(h.el('wave-bar-'+name).getAttribute('x'))-(100+Math.min(0,numbers[i])*100))<1e-8);
  }
 });
 assert.equal(h.el('wave-time-current').textContent,`当前时刻 · t ${t} 模型秒`);
 assert.equal(h.el('wave-position-current').textContent,`当前探针 · x ${x}，y ${y}`);
}

test('Wave exact time has a unique native return before the full-cycle plots',()=>{
 const section=html.match(/<section id="wave-components"[\s\S]*?<\/section>/)?.[0];assert.ok(section);
 assert.match(section,/<p id="wave-time-error" aria-live="off" hidden><\/p><a id="wave-time-view" class="return-to-canvas" href="#canvas">回到画布，查看这一刻 ↑<\/a><\/div><figure class="wave-cycle"/);
 assert.equal((html.match(/id="wave-time-view"/g)||[]).length,1);
 assert.ok(section.indexOf('id="wave-time-seek"')<section.indexOf('id="wave-time-view"'));
 assert.match(section,/aria-labelledby="wave-components-title" hidden/);
 assert.match(html,/<canvas id="canvas" tabindex="0"/);
 assert.doesNotMatch(app,/wave-time-view/,'native navigation adds no listener or model state');
});

test('the native return wraps, keeps its 44px target and inherits the dark-surface focus ring',()=>{
 const rule=css.match(/\.wave-time-seek #wave-time-view\{([^}]+)\}/)?.[1];assert.ok(rule);
 for(const value of ['max-width:100%','white-space:normal','overflow-wrap:anywhere','font-size:13px','color:#d3f35b'])assert.ok(rule.includes(value));
 assert.match(css,/\.reading-nav a,\.return-to-canvas\{[^}]*min-height:44px/);
 assert.match(css,/a:focus-visible[^}]*outline:3px solid/);
 assert.match(css,/\.stage,\.instrument-drawer\{--focus-ring:var\(--focus-on-dark\)\}/);
 assert.match(html,/style\.css\?[^"\n]*&amp;time-view=return-1/);
});

test('returning retains the exact phase, field, independent component readings and full-cycle plot',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,13.75,-7.125,0','#wave-components');open(h);
 for(const time of [0,.125,.125+Math.PI/6,1e-7,5e-324,1e9]){seek(h,time);check(h,13.75,-7.125,time);roundtrip(h);}
 seek(h,.125);click(h,'step');check(h,13.75,-7.125,.125+Math.PI/6);roundtrip(h);click(h,'wave-back');check(h,13.75,-7.125,.125);roundtrip(h);
 h.key('ArrowRight');check(h,15.75,-7.125,.125);roundtrip(h);
});

test('returning preserves unfinished and invalid time and coordinate drafts without applying them',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,7.5,0,.125');open(h);
 for(const draft of ['unfinished','-1','1000000001','1e-999']){seek(h,draft);roundtrip(h);check(h,7.5,0,.125);assert.equal(h.el('wave-time-error').hidden,false);}
 h.el('wave-target-x').value='bad';h.el('wave-target-y').value='-';click(h,'wave-position');roundtrip(h);check(h,7.5,0,.125);
 h.el('wave-time').value='０．５';roundtrip(h);check(h,7.5,0,.125);click(h,'wave-time-seek');check(h,7.5,0,.5);roundtrip(h);
});

test('saved checkpoint return and undo keep their exact phase across native history',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,13.75,-7.125,.004');open(h);const original=h.drawing();
 seek(h,7.125);const later=h.drawing();click(h,'observation-return');roundtrip(h);assert.deepEqual(h.drawing(),original);check(h,13.75,-7.125,.004);
 seek(h,.125);roundtrip(h);click(h,'observation-undo');roundtrip(h);assert.deepEqual(h.drawing(),later);check(h,13.75,-7.125,7.125);
 assert.equal(h.el('wave-time').value,'0.125');assert.equal(new URLSearchParams(location.search).get('at'),'v1,13.75,-7.125,0.004');
});

test('running navigation keeps the running choice and resumes with visibility-safe timing',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,13.75,-7.125,.125');open(h);click(h,'pause');h.tick(0);h.tick(50);check(h,13.75,-7.125,.175);roundtrip(h);
 h.setVisible(false);roundtrip(h);assert.equal(h.frames.size,0);assert.equal(h.el('pause').textContent,'暂停');
 h.setVisible(true);h.tick(1000);h.tick(1050);check(h,13.75,-7.125,.22499999999999998);roundtrip(h);assert.equal(h.frames.size,1);
 click(h,'pause');roundtrip(h);assert.equal(h.frames.size,0);
});

test('closed instruments remain idle across navigation and reveal exact bars and plots when reopened',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,13.75,-7.125,0');open(h);
 h.el('instruments').open=false;h.el('instruments').handlers.toggle();const bars=['left','right','combined'].map(n=>h.el('wave-bar-'+n).getAttribute('width'));
 seek(h,.125);roundtrip(h);check(h,13.75,-7.125,.125);assert.deepEqual(['left','right','combined'].map(n=>h.el('wave-bar-'+n).getAttribute('width')),bars);
 open(h);check(h,13.75,-7.125,.125);roundtrip(h);
});

test('retained worlds keep phase, instruments and drafts while changed queries restore their own checkpoint',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,13.75,-7.125,0');open(h);seek(h,.125);
 for(const mode of ['orbit','life','fractal','walk']){click(h,'tab-'+mode);assert.equal(h.el('wave-components').hidden,true);click(h,'tab-wave');check(h,13.75,-7.125,.125);roundtrip(h);}
 h.navigate('?experiment=wave&wavelength=30&at=v1,7.5,0,2.5#wave-components');check(h,7.5,0,2.5);roundtrip(h);assert.equal(h.el('wave-time').value,'0.125');
});

test('display and context interruptions preserve exact readings and normal continuation',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,13.75,-7.125,.125');open(h);const normal=h.drawing();
 for(const size of [[171,240],[259,240],[455.5,281.75],[600,414]]){h.resize(...size);check(h,13.75,-7.125,.125);roundtrip(h);}
 h.setDpr(2);h.loseContext();roundtrip(h);h.restoreContext();check(h,13.75,-7.125,.125);roundtrip(h);
 h.resize(0,0);roundtrip(h);h.resize(600,414);h.setDpr(1);assert.deepEqual(h.drawing(),normal);click(h,'step');check(h,13.75,-7.125,.125+Math.PI/6);
});

test('text-only startup retains exact time and recovers the same canvas observation',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,13.75,-7.125,0','#wave-components',true,1,false);open(h);seek(h,.125);check(h,13.75,-7.125,.125);roundtrip(h);
 h.setContextReady(true);click(h,'canvas-retry');check(h,13.75,-7.125,.125);roundtrip(h);const drawing=h.drawing();
 const reference=await setup('?experiment=wave&wavelength=30&at=v1,13.75,-7.125,.125');assert.deepEqual(reference.drawing(),drawing);
});

test('pending sharing retains its captured checkpoint and cannot replace newer navigation-era feedback',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,13.75,-7.125,.125');let finish,captured;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:value=>{captured=value;return new Promise(r=>finish=r);}}}});
 try{const pending=click(h,'share');seek(h,7.125);roundtrip(h);const message=h.el('announcement').textContent;finish();await pending;assert.equal(h.el('announcement').textContent,message);assert.equal(new URL(captured).searchParams.get('at'),'v1,13.75,-7.125,0.125');check(h,13.75,-7.125,7.125);roundtrip(h);}finally{delete globalThis.navigator;}
});

test('navigation does not earn a discovery or alter completed notes and intentional seeded batch repeats',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');seek(h,.125);roundtrip(h);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');click(h,'wave-home');seek(h,.25);roundtrip(h);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;seek(h,7.125);roundtrip(h);assert.equal(h.el('notes-text').value,notes);
 for(const mode of ['fractal','walk']){click(h,'tab-'+mode);for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional held batch changed');}});click(h,'step');}roundtrip(h);}
});
