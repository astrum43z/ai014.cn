import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const fill=h=>click(h,'wave-time-current-fill');
const text=(h,id)=>h.el(id).textContent;
const type=(h,value)=>{h.el('wave-time').value=String(value);h.el('wave-time').handlers.input();};
const seek=(h,value)=>{type(h,value);click(h,'wave-time-seek');};
const key=(el,extra={})=>{let prevented=false;el.handlers.keydown({key:'Enter',repeat:false,preventDefault(){prevented=true;},...extra});return prevented;};
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),frames:[...h.frames.keys()],status:text(h,'status'),pause:text(h,'pause'),metrics:text(h,'metrics'),time:text(h,'wave-time-current'),position:text(h,'wave-position-current'),values:['left','right','combined'].map(n=>text(h,'wave-value-'+n)),url:location.href,writes:h.writes(),saved:text(h,'saved-observation-reading'),undo:text(h,'observation-undo-status'),link:h.el('share-link').value,notes:h.el('notes-text').value});
const current=t=>`当前时刻 · t ${t} 模型秒`;
const open=h=>{h.el('instruments').open=true;h.el('instruments').handlers.toggle();};
function checkBars(h,x,y,t,w=30,s=100){
 const a=Math.sin(Math.hypot(x+s/2,y)*2*Math.PI/w-t*3),b=Math.sin(Math.hypot(x-s/2,y)*2*Math.PI/w-t*3);
 ['left','right','combined'].forEach((n,i)=>{
  const value=[a,b,(a+b)/2][i],bar=h.el('wave-bar-'+n);
  assert.ok(Math.abs(Number(bar.getAttribute('width'))-Math.abs(value)*100)<1e-8);
  assert.ok(Math.abs(Number(bar.getAttribute('x'))-(value<0?100+value*100:100))<1e-8);
 });
}

test('explicit fill captures exact current time, clears only time errors and selects the field without changing state',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,13.75,-7.125,0');open(h);
 for(const time of [0,.125,.125+Math.PI/6,1e-7,1e-20,5e-324,999999999.9999999,1e9]){
  seek(h,time);seek(h,'unfinished');assert.equal(h.el('wave-time-error').hidden,false);
  let selects=0;h.el('wave-time').select=()=>selects++;
  const before=state(h);fill(h);assert.deepEqual(state(h),before);assert.equal(h.el('wave-time').value,String(time));
  assert.equal(document.activeElement,h.el('wave-time'));assert.equal(selects,1);assert.equal(h.el('wave-time').getAttribute('aria-invalid'),'false');assert.equal(h.el('wave-time-error').hidden,true);assert.equal(text(h,'wave-time-error'),'');
  assert.equal(text(h,'announcement'),`已填入当前时刻：t = ${time} 模型秒；仅替换目标输入，实验状态未改变。`);
  click(h,'wave-time-seek');assert.equal(text(h,'wave-time-current'),current(time));assert.deepEqual(h.drawing(),before.drawing);checkBars(h,13.75,-7.125,time);
 }
});

test('filled draft revisits the exact observed phase after quarter stepping',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,7.5,0,.125');open(h);click(h,'step');
 const observed=.125+Math.PI/6,drawing=h.drawing();assert.equal(text(h,'wave-time-current'),current(observed));fill(h);
 click(h,'step');assert.equal(h.el('wave-time').value,String(observed));assert.notDeepEqual(h.drawing(),drawing);
 assert.equal(key(h.el('wave-time')),true);assert.deepEqual(h.drawing(),drawing);checkBars(h,7.5,0,observed);
});

test('fill does not pause, redraw, reschedule or change the next animated frame',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,13.75,-7.125,3');open(h);click(h,'pause');h.tick(0);h.tick(50);
 const before=state(h);fill(h);assert.deepEqual(state(h),before);assert.equal(h.el('wave-time').value,'3.05');h.tick(100);
 const actual={drawing:h.drawing(),time:text(h,'wave-time-current'),frames:h.frames.size};checkBars(h,13.75,-7.125,3.1);
 const reference=await setup('?experiment=wave&wavelength=30&at=v1,13.75,-7.125,3');open(reference);click(reference,'pause');reference.tick(0);reference.tick(50);reference.tick(100);
 assert.deepEqual({drawing:reference.drawing(),time:text(reference,'wave-time-current'),frames:reference.frames.size},actual);
});

test('held Enter cannot refill or accidentally submit after focus changes; native keys remain available',async()=>{
 const h=await setup('?experiment=wave','',false),button=h.el('wave-time-current-fill');
 assert.equal(key(button,{repeat:true}),true);
 for(const event of [{},{key:' '},{key:' ',repeat:true},{key:'Tab'},{key:'ArrowRight'}])assert.equal(key(button,event),false);
 fill(h);type(h,'0.125');const before=state(h);assert.equal(key(h.el('wave-time'),{repeat:true}),true);
 for(const event of [{isComposing:true},{keyCode:229},{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true},{key:'ArrowLeft'},{key:'Home'},{key:'End'},{key:'Escape'}])assert.equal(key(h.el('wave-time'),event),false);
 assert.deepEqual(state(h),before);assert.equal(h.el('wave-time').value,'0.125');assert.equal(key(h.el('wave-time')),true);assert.equal(text(h,'wave-time-current'),current(.125));assert.equal(h.frames.size,0);
});

test('fill retains out-of-range live time exactly and leaves validation to the seek action',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,1000000000');click(h,'step');const time=1e9+Math.PI/6;
 const before=state(h);fill(h);assert.deepEqual(state(h),before);assert.equal(h.el('wave-time').value,String(time));assert.equal(h.el('wave-time-error').hidden,true);
 click(h,'wave-time-seek');assert.deepEqual(state(h),before);assert.equal(h.el('wave-time').getAttribute('aria-invalid'),'true');assert.equal(h.el('wave-time-error').hidden,false);assert.match(text(h,'wave-time-error'),/1000000000/);
});

test('coordinate drafts, errors, probe and parameters are independent of time fill',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5');h.el('wave-target-x').value='bad';h.el('wave-target-y').value='-';click(h,'wave-position');
 const error={x:h.el('wave-target-x').getAttribute('aria-invalid'),y:h.el('wave-target-y').getAttribute('aria-invalid'),text:text(h,'wave-position-error'),hidden:h.el('wave-position-error').hidden};
 fill(h);assert.deepEqual({x:h.el('wave-target-x').getAttribute('aria-invalid'),y:h.el('wave-target-y').getAttribute('aria-invalid'),text:text(h,'wave-position-error'),hidden:h.el('wave-position-error').hidden},error);assert.equal(h.el('wave-target-x').value,'bad');assert.equal(h.el('wave-target-y').value,'-');
});

test('drafts remain independent through running, toggles, controls, parameter changes and world visits',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5');fill(h);type(h,'2.');click(h,'pause');h.tick(0);h.tick(50);open(h);h.el('instruments').open=false;h.el('instruments').handlers.toggle();click(h,'step');click(h,'wave-home');
 for(const mode of ['orbit','life','fractal','walk']){click(h,'tab-'+mode);click(h,'tab-wave');}
 h.el('wavelength').handlers.input({target:{value:'31'}});click(h,'reset');h.el('preset-select').handlers.change({target:{value:'wide'}});click(h,'load-preset');
 assert.equal(h.el('wave-time').value,'2.');fill(h);assert.equal(h.el('wave-time').value,'0');
});

test('inactive fill changes no other world, draft, error, focus or announcement',async()=>{
 const h=await setup('?experiment=wave');seek(h,'bad');
 for(const mode of ['orbit','life','fractal','walk']){
  click(h,'tab-'+mode);h.el('tab-'+mode).focus();const before=state(h),announcement=text(h,'announcement');fill(h);
  assert.deepEqual(state(h),before);assert.equal(text(h,'announcement'),announcement);assert.equal(document.activeElement,h.el('tab-'+mode));assert.equal(h.el('wave-time').value,'bad');assert.equal(h.el('wave-time').getAttribute('aria-invalid'),'true');
 }
});

test('fixed links and return undo keep their original model while a filled draft follows explicit observations',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5');const original=h.drawing();seek(h,7.125);const later=h.drawing();click(h,'observation-return');
 const before=state(h);fill(h);assert.deepEqual(state(h),before);assert.deepEqual(h.drawing(),original);assert.equal(h.el('wave-time').value,'2.5');
 click(h,'observation-undo');assert.deepEqual(h.drawing(),later);assert.equal(h.el('wave-time').value,'2.5');fill(h);assert.equal(h.el('wave-time').value,'7.125');assert.match(location.href,/2.5/);
 h.navigate('?experiment=wave&at=v1,0,0,.125');assert.equal(h.el('wave-time').value,'7.125');fill(h);assert.equal(h.el('wave-time').value,'0.125');
});

test('filling during pending sharing never edits the captured checkpoint',async()=>{
 const pending=[];Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:value=>new Promise(resolve=>pending.push({value,resolve}))}}});
 try{
  const h=await setup('?experiment=wave&at=v1,8,12,2.5');const copy=click(h,'observation-copy');seek(h,.125);fill(h);assert.match(pending[0].value,/v1%2C8%2C12%2C2.5/);pending[0].resolve();await copy;
  const share=click(h,'share');click(h,'step');fill(h);assert.match(pending[1].value,/v1%2C8%2C12%2C0.125/);pending[1].resolve();await share;assert.match(text(h,'saved-observation-reading'),/t 0.125 s$/);assert.equal(h.el('wave-time').value,String(.125+Math.PI/6));
 }finally{delete globalThis.navigator;}
});

test('fill stays model-only through simulated context, visibility, density and collapsed display interruptions',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,.125');click(h,'pause');h.tick(0);h.tick(50);h.setVisible(false);h.setHidden(true);h.loseContext();h.resize(0,0);h.setDpr(2);
 const before=state(h);fill(h);assert.deepEqual(state(h),before);assert.equal(h.el('wave-time').value,'0.175');
 h.resize(233.5,281.75);h.restoreContext();h.setHidden(false);h.setVisible(true);h.tick(90000);h.tick(90050);assert.equal(text(h,'wave-time-current'),current(.22499999999999998));assert.equal(h.el('wave-time').value,'0.175');
});

test('text-only startup can capture and seek the same exact model time before canvas recovery',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,1e-7','',true,1,false);const before=state(h);fill(h);assert.deepEqual(state(h),before);assert.equal(h.el('wave-time').value,'1e-7');click(h,'wave-time-seek');assert.equal(text(h,'wave-time-current'),current(1e-7));h.setContextReady(true);click(h,'canvas-retry');assert.equal(h.el('wave-time').value,'1e-7');assert.equal(text(h,'wave-time-current'),current(1e-7));
});

test('filling does not record discoveries or suppress intentional batch repetition',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');fill(h);assert.equal(text(h,'notes-count'),'0 / 5');click(h,'mission-check');click(h,'wave-home');fill(h);assert.equal(text(h,'notes-count'),'0 / 5');click(h,'mission-check');assert.equal(text(h,'notes-count'),'1 / 5');const notes=h.el('notes-text').value;fill(h);assert.equal(h.el('notes-text').value,notes);
 for(const mode of ['fractal','walk']){click(h,'tab-'+mode);for(const repeat of [false,true]){assert.equal(key(h.el('step'),{repeat}),false);click(h,'step');}assert.match(text(h,'metrics'),mode==='fractal'?/500 个点/:/48 步/);}
 assert.equal(h.el('notes-text').value,notes);
});

test('native fill action is inside the existing optional, wrapping exact time editor with clear help',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<button id="wave-time-current-fill" type="button" aria-controls="wave-time" aria-describedby="wave-time-help">填入当前时刻<\/button><button id="wave-time-seek"/);
 assert.ok(html.indexOf('id="wave-time-current-fill"')>html.indexOf('id="instruments"'));assert.ok(html.indexOf('id="wave-time-current-fill"')<html.indexOf('id="wave-cycle-title"'));
 const help=html.match(/<small id="wave-time-help">(.*?)<\/small>/)[1];assert.match(help,/替换并选中目标时刻/);assert.match(help,/不暂停或改变实验/);assert.match(help,/仍需按上述范围回到时刻/);
 assert.match(css,/\.wave-time-seek>div\{display:flex;flex-wrap:wrap/);assert.match(css,/\.wave-time-seek button\{[^}]*min-height:44px[^}]*white-space:normal;overflow-wrap:anywhere/);assert.match(html,/time-draft=current-1/);
});
