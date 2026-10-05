import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const parameters={orbit:[['gravity',30,160,80],['speed',30,150,100]],life:[['rate',1,20,8],['density',10,60,30]],wave:[['wavelength',15,70,32],['separation',20,180,100]],fractal:[['jump',35,70,50],['seed',1,99,14]],walk:[['bias',0,25,12],['seed',1,99,14]]};
const click=(h,id)=>h.el(id).handlers.click();
// Model native Enter activation only when keydown's default remains allowed.
function key(h,id,name='Enter',repeat=false){
 let prevented=false;h.el(id).handlers.keydown?.({key:name,repeat,preventDefault(){prevented=true;}});
 if(name==='Enter'&&!prevented)click(h,id);return prevented;
}
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),metrics:h.el('metrics').textContent,
 readings:['observation-a','observation-b','observation-c','orbit-position-current','life-selection','wave-position-current','wave-time-current','fractal-seek-current','walk-seek-current','saved-observation-reading','observation-undo-status'].map(id=>h.el(id).textContent),
 values:Object.keys(parameters).flatMap(mode=>parameters[mode].map(([id])=>[id,h.el(id).value])),status:h.el('status').textContent,
 message:h.el('announcement').textContent,frames:[...h.frames.keys()],focus:document.activeElement,url:location.href,writes:h.writes(),
 notes:h.el('notes-text').value,result:h.el('mission-result').textContent,link:h.el('share-link').value,hidden:h.el('share-link').hidden});
function repeats(h,id){const before=state(h);for(let i=0;i<12;i++)assert.equal(key(h,id,'Enter',true),true);assert.deepEqual(state(h),before,'held Enter is a complete no-op, including redraw, feedback, checkpoint, recovery and focus');}

for(const [mode,specs] of Object.entries(parameters))for(const running of [false,true])test(`${mode} ${running?'running':'paused'}: both exact nudges accept fresh Enter once and ignore repeats`,async()=>{
 const h=await setup('?experiment='+mode+'&'+specs.map(([id,,,value])=>`${id}=${value}`).join('&'),'#control-title',!running);
 for(const [id,,,initial] of specs)for(const [direction,delta] of [['increase',1],['decrease',-1]]){
  const button=direction+'-'+id,previous=Number(h.el(id).value);h.el(button).focus();repeats(h,button);
  assert.equal(key(h,button),false);assert.equal(Number(h.el(id).value),previous+delta);assert.equal(h.el('status').textContent,running?'运行中':'已暂停');
  assert.equal(document.activeElement,h.el(button));repeats(h,button);
  assert.equal(key(h,button),false);assert.equal(Number(h.el(id).value),previous+2*delta);repeats(h,button);
 }
 if(running){h.tick(0);h.tick(50);assert.equal(h.frames.size,1);}
});

for(const [mode,specs] of Object.entries(parameters))test(`${mode}: bounds preserve focus and fresh reverse adjustment`,async()=>{
 for(const [id,min,max] of specs)for(const [direction,value,limit,opposite] of [['decrease',min+1,min,'increase'],['increase',max-1,max,'decrease']]){
  const h=await setup(`?experiment=${mode}&${id}=${value}`),button=direction+'-'+id;h.el(button).focus();key(h,button);
  assert.equal(Number(h.el(id).value),limit);assert.equal(h.el(button).getAttribute('aria-disabled'),'true');repeats(h,button);
  const before=state(h);key(h,button);assert.deepEqual(state(h),before);key(h,opposite+'-'+id);assert.notEqual(Number(h.el(id).value),limit);
 }
});

test('Space, navigation, pointer and assistive clicks preserve native activation without held-key state',async()=>{
 const h=await setup('?experiment=fractal&seed=14&at=v1,1000'),id='increase-seed';h.el(id).focus();const before=state(h);
 for(const name of [' ','Tab','Escape','ArrowLeft','ArrowRight','Home','End'])for(const repeat of [false,true])assert.equal(key(h,id,name,repeat),false);
 assert.deepEqual(state(h),before);click(h,id);assert.equal(h.el('seed').value,'15');click(h,id);assert.equal(h.el('seed').value,'16');key(h,id);assert.equal(h.el('seed').value,'17');
 assert.match(h.el('metrics').textContent,/300 个点/);assert.doesNotMatch(location.search,/at=/);
});

test('rebuilt controls retain the guard across world returns, parameter history, presets and guide starts',async()=>{
 const h=await setup('?experiment=fractal&seed=14&at=v1,1000'),oldClick=h.el('increase-seed').handlers.click;
 for(const mode of ['orbit','life','wave','walk','fractal']){click(h,'tab-'+mode);for(const [id] of parameters[mode])repeats(h,'increase-'+id);}
 h.navigate('?experiment=walk&bias=25&seed=42&at=v1,64');repeats(h,'decrease-seed');const before=state(h);oldClick();assert.deepEqual(state(h),before);
 h.el('preset-select').handlers.change({target:{value:'unbiased'}});click(h,'load-preset');repeats(h,'increase-seed');
 click(h,'guide-start');repeats(h,'increase-seed');key(h,'increase-seed');assert.equal(h.el('seed').value,'15');
});

test('a repeated-only event retains saved return/undo and drafts, while a real parameter edit keeps existing invalidation',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5','#canvas');click(h,'wave-home');click(h,'observation-return');
 h.el('wave-target-x').value='1e';h.el('increase-wavelength').focus();repeats(h,'increase-wavelength');assert.equal(h.el('observation-undo').getAttribute('aria-disabled'),'false');
 click(h,'observation-undo');assert.equal(h.el('wave-position-current').textContent,'当前探针 · x 0，y 0');
 key(h,'increase-wavelength');assert.equal(h.el('wavelength').value,'33');assert.equal(h.el('observation-undo').getAttribute('aria-disabled'),'true');assert.doesNotMatch(location.search,/at=/);assert.equal(h.el('wave-target-x').value,'1e');
});

test('the seed-14-to-15 discovery remains an exact comparison and later repeats do not rewrite its note',async()=>{
 const h=await setup('?experiment=fractal');click(h,'mission-start');click(h,'fractal-1000');click(h,'mission-check');
 h.el('increase-seed').focus();key(h,'increase-seed');repeats(h,'increase-seed');assert.equal(h.el('seed').value,'15');assert.match(h.el('metrics').textContent,/300 个点/);
 click(h,'fractal-1000');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const note=h.el('notes-text').value;
 repeats(h,'increase-seed');key(h,'increase-seed');assert.equal(h.el('notes-text').value,note);assert.equal(h.el('seed').value,'16');
});

test('resize, density, simulated recovery and reduced motion do not arm or release extra adjustments',async()=>{
 const h=await setup('?experiment=walk&seed=14&at=v1,64'),id='increase-seed';h.el(id).focus();key(h,id);const before=state(h);
 for(const [w,z] of [[171,240],[259.5,240.25],[647,317.9375]]){h.resize(w,z);h.setDpr(2);repeats(h,id);}
 h.loseContext();h.restoreContext();repeats(h,id);assert.equal(h.el('seed').value,'15');assert.equal(h.el('metrics').textContent,before.metrics);
 h.motion.change({matches:true});repeats(h,id);key(h,id);assert.equal(h.el('seed').value,'16');
});

test('range updates and intentional Orbit/Fractal/Walk primary Step repeats retain their original paths',async()=>{
 for(const mode of ['orbit','fractal','walk']){
  const h=await setup('?experiment='+mode),id=mode==='orbit'?'gravity':'seed';h.el(id).handlers.input({target:{value:'15'}});
  // Native range events still reach setParameter; only native nudge keydown is guarded.
  assert.equal(h.el(id).value,mode==='orbit'?'30':'15');const before=h.el('metrics').textContent;
  assert.equal(key(h,'step'),false);assert.equal(key(h,'step','Enter',true),false);assert.notEqual(h.el('metrics').textContent,before);
  if(mode==='fractal')assert.match(h.el('metrics').textContent,/500 个点/);if(mode==='walk')assert.match(h.el('metrics').textContent,/48 步/);
 }
});

test('the local repeat guard adds no global keyboard interception, timer, state or new control',()=>{
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8'),body=source.slice(source.indexOf('function renderParameters()'),source.indexOf('function changeMode('));
 assert.match(body,/addEventListener\('keydown',event=>\{\s*if\(event\.repeat&&event\.key==='Enter'\)event\.preventDefault\(\);/);
 assert.doesNotMatch(body,/keyup|setTimeout|setInterval|requestAnimationFrame|stopPropagation|document\.addEventListener|window\.addEventListener/);
});
