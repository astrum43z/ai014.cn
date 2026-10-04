import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const text=(h,id)=>h.el(id).textContent;
const type=(h,value)=>{h.el('wave-time').value=String(value);h.el('wave-time').handlers.input();};
const seek=(h,value)=>{type(h,value);click(h,'wave-time-seek');};
const key=(h,extra={})=>{let prevented=false;h.el('wave-time').handlers.keydown({key:'Enter',preventDefault(){prevented=true;},...extra});return prevented;};
const signed=h=>['left','right','combined'].map(name=>{const bar=h.el('wave-bar-'+name),value=Number(bar.getAttribute('width'))/100;return Number(bar.getAttribute('x'))<100?-value:value;});
// Independent two-source expression: the target sets time, never source geometry.
const expected=(x,y,t,w=30,s=100)=>{const a=Math.sin(Math.hypot(x+s/2,y)*2*Math.PI/w-t*3),b=Math.sin(Math.hypot(x-s/2,y)*2*Math.PI/w-t*3);return [a,b,(a+b)/2];};
const close=(a,b,tolerance=1e-10)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<tolerance,`${v} ≈ ${b[i]}`));
const fixed=h=>({url:location.href,writes:h.writes(),summary:text(h,'saved-observation-reading'),undo:text(h,'observation-undo-status'),link:h.el('share-link').value,hidden:h.el('share-link').hidden});
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),metrics:text(h,'metrics'),time:text(h,'wave-time-current'),position:text(h,'wave-position-current'),status:text(h,'status'),frames:[...h.frames.keys()],fixed:fixed(h),notes:h.el('field-notes-list').innerHTML});
const current=t=>`当前时刻 · t ${t} 模型秒`;
const position=(h,x,y)=>{for(const [axis,value] of [['x',x],['y',y]]){h.el('wave-target-'+axis).value=String(value);h.el('wave-target-'+axis).handlers.input();}click(h,'wave-position');};

test('exact time reaches a fractional phase outside quarter-step destinations without editing a link',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&separation=100&at=v1,0,0,0');const original=h.drawing(),checkpoint=fixed(h);
 click(h,'step');assert.equal(text(h,'wave-time-current'),current(Math.PI/6));
 h.el('wave-time-seek').focus();seek(h,.125);close(signed(h),expected(0,0,.125));assert.equal(text(h,'wave-time-current'),current(.125));assert.equal(text(h,'status'),'已暂停');assert.equal(h.frames.size,0);assert.equal(document.activeElement,h.el('wave-time-seek'));assert.deepEqual(fixed(h),checkpoint);assert.notDeepEqual(h.drawing(),original);
 seek(h,0);assert.deepEqual(h.drawing(),original);assert.equal(h.el('wave-back').getAttribute('aria-disabled'),'true');
});

for(const [x,y,time,w,s] of [[0,0,.125,30,100],[7.5,0,7.125,30,100],[13.75,-7.125,123.456,32,100],[-9999.25,8000.75,999999999.9999999,70,180],[10000,-10000,1e9,15,20]])test(`time ${time} matches direct model values and a saved observation`,async()=>{
 const h=await setup(`?experiment=wave&wavelength=${w}&separation=${s}&at=v1,${x},${y},0`);const geometry=['wave-position-current','wave-distances','wave-difference','wave-envelope'].map(id=>text(h,id));seek(h,time);close(signed(h),expected(x,y,time,w,s),1e-7);
 assert.deepEqual(['wave-position-current','wave-distances','wave-difference','wave-envelope'].map(id=>text(h,id)),geometry);assert.equal(text(h,'wave-time-current'),current(time));
 await click(h,'share');assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),`v1,${x},${y},${time}`);const drawing=h.drawing(),link=location.href;h.navigate('?experiment=life');h.navigate(link);assert.deepEqual(h.drawing(),drawing);assert.equal(text(h,'wave-time-current'),current(time));
});

test('Enter normalizes an ordinary decimal target and preserves field focus',async()=>{
 const h=await setup('?experiment=wave');type(h,' +000.1250 ');h.el('wave-time').focus();assert.equal(key(h),true);assert.equal(h.el('wave-time').value,'0.125');assert.equal(document.activeElement,h.el('wave-time'));assert.match(text(h,'announcement'),/t = 0.125 模型秒；保留当前参数与探针/);
});

test('small nonzero decimals remain valid after repeat submission and stay exactly readable',async()=>{
 const h=await setup('?experiment=wave');seek(h,' 0.00000000000000000001 ');assert.equal(h.el('wave-time').value,'0.00000000000000000001');assert.equal(text(h,'wave-time-current'),current(1e-20));click(h,'wave-time-seek');assert.equal(h.el('wave-time-error').hidden,true);await click(h,'share');assert.equal(new URL(location.href).searchParams.get('at'),'v1,0,0,1e-20');
});

test('invalid targets never pause, redraw, clamp time or disturb recovery and pending frames',async()=>{
 const h=await setup('?experiment=wave&at=v1,13.75,-7.125,2.5');click(h,'step');click(h,'observation-return');click(h,'pause');h.tick(0);h.tick(50);
 for(const value of ['', ' ', '-', '.', '+', '-.5', '-1','1000000000.1','Infinity','NaN','1e+','0x10','⓪.５','1,25','12 seconds']){type(h,value);const before=state(h);click(h,'wave-time-seek');assert.deepEqual(state(h),before,value);assert.equal(h.el('wave-time').getAttribute('aria-invalid'),'true');assert.equal(h.el('wave-time-error').hidden,false);assert.equal(document.activeElement,h.el('wave-time'));}
 type(h,'.125');assert.equal(h.el('wave-time-error').hidden,true);assert.equal(h.el('wave-time').getAttribute('aria-invalid'),'false');click(h,'wave-time-seek');assert.equal(text(h,'wave-time-current'),current(.125));assert.equal(h.frames.size,0);
});

test('typing is inert and drafts survive redraw, animation, controls, tabs and replacements',async()=>{
 const h=await setup('?experiment=wave&at=v1,12,7,3');click(h,'pause');h.tick(0);const before=state(h);type(h,'0.');assert.deepEqual(state(h),before);h.tick(50);assert.equal(h.el('wave-time').value,'0.');assert.equal(text(h,'wave-time-current'),current(3.05));
 h.resize(233,240);h.setDpr(2);h.loseContext();h.restoreContext();click(h,'step');click(h,'wave-back');position(h,7.5,0);click(h,'tab-life');click(h,'tab-wave');h.el('wavelength').handlers.input({target:{value:'30'}});click(h,'reset');assert.equal(h.el('wave-time').value,'0.');assert.equal(text(h,'wave-time-current'),current(0));
 h.el('preset-select').handlers.change({target:{value:'wide'}});click(h,'load-preset');assert.equal(h.el('wave-time').value,'0.');click(h,'guide-start');assert.equal(h.el('wave-time').value,'0.');assert.equal(text(h,'wave-time-current'),current(0));
});

test('held Enter cannot repeat seeking; modified, composing and text-editing keys stay native',async()=>{
 const h=await setup('?experiment=wave');type(h,'.125');const before=state(h);assert.equal(key(h,{repeat:true}),true);
 for(const extra of [{isComposing:true},{keyCode:229},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true}])assert.equal(key(h,extra),false);
 for(const name of ['Escape',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'])assert.equal(key(h,{key:name}),false);assert.deepEqual(state(h),before);
 let prevented=false;h.el('wave-time-seek').handlers.keydown({key:'Enter',repeat:true,preventDefault(){prevented=true;}});assert.equal(prevented,true);
 for(const event of [{key:'Enter',repeat:false},{key:' ',repeat:true}])h.el('wave-time-seek').handlers.keydown({...event,preventDefault(){assert.fail('native button activation suppressed');}});
});

test('seeking the present time pauses and Continue resumes without elapsed hidden time',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,13.75,-7.125,3');click(h,'pause');h.tick(0);h.tick(50);seek(h,3.05);assert.equal(h.frames.size,0);close(signed(h),expected(13.75,-7.125,3.05));
 click(h,'pause');h.tick(90000);assert.equal(text(h,'wave-time-current'),current(3.05));h.tick(90050);close(signed(h),expected(13.75,-7.125,3.1));assert.equal(h.el('wave-time').value,'3.05');
});

test('forward and rewind use the chosen time, preserving partial rewind and limit behavior',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,7.5,4.125,3');seek(h,.125);click(h,'step');assert.equal(text(h,'wave-time-current'),current(.125+Math.PI/6));click(h,'wave-back');close(signed(h),expected(7.5,4.125,.125));click(h,'wave-back');assert.equal(text(h,'wave-time-current'),current(0));assert.equal(h.el('wave-time').value,'0.125');
 seek(h,1e9);click(h,'step');assert.equal(text(h,'wave-time-current'),current(1e9+Math.PI/6));await click(h,'share');assert.match(text(h,'share-status'),/超出链接可保存/);seek(h,1e9);await click(h,'share');assert.match(text(h,'saved-observation-reading'),/t 1000000000 s$/);
});

test('seeking leaves fixed checkpoints and one-level return undo available',async()=>{
 const h=await setup('?experiment=wave&at=v1,13.75,-7.125,.004');const origin=h.drawing();seek(h,7.125);const later=h.drawing();click(h,'observation-return');assert.deepEqual(h.drawing(),origin);const checkpoint=fixed(h);seek(h,.125);assert.deepEqual(fixed(h),checkpoint);click(h,'observation-undo');assert.deepEqual(h.drawing(),later);assert.equal(text(h,'wave-time-current'),current(7.125));assert.equal(h.el('wave-time').value,'0.125');assert.equal(location.href,checkpoint.url);
});

test('pending copy remains fixed until a new Share captures the selected time',async()=>{
 const pending=[];Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:value=>new Promise(resolve=>pending.push({value,resolve}))}}});
 try{const h=await setup('?experiment=wave&at=v1,13.75,-7.125,.004');const copy=click(h,'observation-copy');seek(h,.125);assert.match(pending[0].value,/v1%2C13.75%2C-7.125%2C0.004/);pending[0].resolve();await copy;assert.match(text(h,'share-status'),/已复制/);const share=click(h,'share');assert.match(pending[1].value,/v1%2C13.75%2C-7.125%2C0.125/);pending[1].resolve();await share;}finally{delete globalThis.navigator;}
});

test('current time refreshes through return, undo, session revisit and browser history',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,.004');seek(h,.125);click(h,'observation-return');assert.equal(text(h,'wave-time-current'),current(.004));click(h,'observation-undo');assert.equal(text(h,'wave-time-current'),current(.125));click(h,'tab-walk');click(h,'tab-wave');assert.equal(text(h,'wave-time-current'),current(.125));
 h.navigate('?experiment=wave&at=v1,0,0,7.125');assert.equal(text(h,'wave-time-current'),current(7.125));assert.equal(h.el('wave-time').value,'0.125');
});

test('unchanged time readings retain their nodes and animation adds no live announcement',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,.125');let writes=0,value=text(h,'wave-time-current');Object.defineProperty(h.el('wave-time-current'),'textContent',{get:()=>value,set:next=>{writes++;value=next;},configurable:true});
 h.resize(600,414);h.setDpr(2);click(h,'wave-right');h.loseContext();h.restoreContext();assert.equal(writes,0);click(h,'pause');const announcement=text(h,'announcement');h.tick(0);h.tick(50);assert.equal(writes,1);assert.equal(text(h,'announcement'),announcement);
});

test('model-space time remains valid through simulated collapse, density and context recovery',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,13.75,-7.125,3');seek(h,.125);const original=h.drawing();h.resize(20,20);seek(h,7.125);h.setDpr(2);h.loseContext();h.restoreContext();h.setHidden(true);h.setVisible(false);h.resize(233.5,280.75);assert.equal(text(h,'wave-time-current'),current(7.125));h.resize(600,414);h.setDpr(1);h.setHidden(false);h.setVisible(true);seek(h,.125);assert.deepEqual(h.drawing(),original);assert.equal(h.frames.size,0);
});

test('stale time actions leave other worlds untouched and batch repeats remain intentional',async()=>{
 const h=await setup('?experiment=wave');seek(h,.125);for(const mode of ['orbit','life','fractal','walk']){click(h,'tab-'+mode);const before=state(h);click(h,'wave-time-seek');assert.deepEqual(state(h),before);click(h,'tab-wave');assert.equal(text(h,'wave-time-current'),current(.125));}
 click(h,'tab-fractal');for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('fractal batch repeat suppressed');}});click(h,'step');}assert.match(text(h,'metrics'),/500 个点/);click(h,'tab-walk');h.key('ArrowRight');h.key('ArrowRight',{repeat:true});assert.match(text(h,'metrics'),/48 步/);
});

test('phase review does not award or overwrite discoveries without explicit checks',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');seek(h,.125);assert.equal(text(h,'notes-count'),'0 / 5');click(h,'mission-check');click(h,'wave-home');seek(h,.25);assert.equal(text(h,'notes-count'),'0 / 5');click(h,'mission-check');assert.equal(text(h,'notes-count'),'1 / 5');const notes=h.el('field-notes-list').innerHTML;seek(h,7.125);assert.equal(h.el('field-notes-list').innerHTML,notes);
});

test('optional instruments contain labeled decimal input, quiet associated feedback and wrapping targets',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');assert.ok(html.indexOf('id="wave-time"')>html.indexOf('id="instruments"'));assert.ok(html.indexOf('id="wave-time"')<html.indexOf('id="wave-cycle-title"'));
 assert.match(html,/<label for="wave-time">目标时刻（模型秒）<\/label>/);assert.match(html,/<input id="wave-time" type="text" inputmode="decimal"[^>]*aria-describedby="wave-time-current wave-time-help wave-time-error"/);assert.match(html,/<button id="wave-time-seek" type="button" aria-describedby="wave-time-current wave-time-help">回到时刻并暂停<\/button>/);
 for(const id of ['current','error'])assert.match(html,new RegExp(`<p id="wave-time-${id}" aria-live="off"`));assert.match(html,/输入 0–1000000000 模型秒，可含小数/);assert.match(css,/\.wave-time-seek>div\{display:flex;flex-wrap:wrap/);assert.match(css,/\.wave-time-seek input\{[^}]*min-width:0;min-height:44px/);assert.match(css,/\.wave-time-seek button\{[^}]*min-width:0;min-height:44px[^}]*white-space:normal;overflow-wrap:anywhere/);
});
