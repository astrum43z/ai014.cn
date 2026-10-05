import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup as setupHarness} from './life-challenge-harness.js';
// These checks inspect visible displacement bars; open their native drawer.
async function setup(...args){const h=await setupHarness(...args);h.el('instruments').open=true;h.el('instruments').handlers.toggle();return h;}

const click=(h,id)=>h.el(id).handlers.click();
const text=(h,id)=>h.el(id).textContent;
const type=(h,id,value)=>{h.el(id).value=String(value);h.el(id).handlers.input();};
const position=(h,x,y)=>{type(h,'wave-target-x',x);type(h,'wave-target-y',y);click(h,'wave-position');};
const seek=(h,time)=>{type(h,'wave-time',time);click(h,'wave-time-seek');};
const current=h=>[text(h,'wave-position-current'),text(h,'wave-time-current')];
const fixed=h=>({url:location.href,writes:h.writes(),link:h.el('share-link').value,summary:text(h,'saved-observation-reading'),undo:text(h,'observation-undo-status'),notes:h.el('field-notes-list').innerHTML});
const state=h=>({current:current(h),fixed:fixed(h),drawing:h.drawing(),draws:h.drawCount(),frames:[...h.frames.keys()],status:text(h,'status')});
const payload=h=>new URL(h.el('share-link').value).searchParams.get('at');
const key=(h,id,extra={})=>{let prevented=false;h.el(id).handlers.keydown({key:'Enter',preventDefault(){prevented=true;},...extra});return prevented;};

// Exercise exactly the number strings visitors can read, not a parallel parser.
for(const value of [1e-7,1e-20,Number.MIN_VALUE])test(`displayed Wave coordinates round-trip exactly: ${value}`,async()=>{
 const h=await setup(`?experiment=wave&at=v1,${value},${-value},0`);const original=h.drawing(),saved=fixed(h);
 const parts=text(h,'wave-position-current').match(/x (.+)，y (.+)$/);position(h,parts[1],parts[2]);
 assert.equal(h.el('wave-target-x').getAttribute('aria-invalid'),'false');assert.equal(h.el('wave-target-y').getAttribute('aria-invalid'),'false');assert.equal(h.el('wave-position-error').hidden,true);assert.deepEqual(h.drawing(),original);assert.deepEqual(fixed(h),saved);
 click(h,'wave-position');assert.equal(h.el('wave-position-error').hidden,true);await click(h,'share');assert.equal(payload(h),`v1,${value},${-value},0`);
});

for(const value of [1e-7,1e-20,Number.MIN_VALUE])test(`displayed Wave time round-trips exactly: ${value}`,async()=>{
 const h=await setup(`?experiment=wave&at=v1,13.75,-7.125,${value}`);const original=h.drawing(),saved=fixed(h);
 seek(h,text(h,'wave-time-current').match(/t (.+) 模型秒$/)[1]);assert.equal(h.el('wave-time').getAttribute('aria-invalid'),'false');assert.equal(h.el('wave-time-error').hidden,true);assert.deepEqual(h.drawing(),original);assert.deepEqual(fixed(h),saved);
 click(h,'wave-time-seek');assert.equal(h.el('wave-time-error').hidden,true);await click(h,'share');assert.equal(payload(h),`v1,13.75,-7.125,${value}`);
});

for(const [x,y,t,expected] of [
 [' +7.5E+0 ','-.125e2','1.25e-1',[7.5,-12.5,.125]],
 ['1e4','-1E4','1e9',[10000,-10000,1e9]],
 ['.5e-323','-5e-324','5E-324',[Number.MIN_VALUE,-Number.MIN_VALUE,Number.MIN_VALUE]],
 ['0e9999','-0e-9999','+0E+9999',[0,0,0]]
])test(`bounded scientific targets evaluate the same wave and save the same numbers: ${x}`,async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,0,0,0');position(h,x,y);seek(h,t);assert.equal(h.el('wave-position-error').hidden,true);assert.equal(h.el('wave-time-error').hidden,true);
 const [px,py,time]=expected;assert.deepEqual(current(h),[`当前探针 · x ${px}，y ${py}`,`当前时刻 · t ${time} 模型秒`]);
 const a=Math.sin(Math.hypot(px+50,py)*2*Math.PI/30-time*3),b=Math.sin(Math.hypot(px-50,py)*2*Math.PI/30-time*3);
 for(const [id,expectedValue] of [['left',a],['right',b],['combined',(a+b)/2]]){const bar=h.el('wave-bar-'+id),actual=Number(bar.getAttribute('width'))/100*(Number(bar.getAttribute('x'))<100?-1:1);assert.ok(Math.abs(actual-expectedValue)<1e-6);}
 await click(h,'share');assert.equal(payload(h),`v1,${px},${py},${time}`);const drawing=h.drawing(),url=location.href;h.navigate('?experiment=life');h.navigate(url);assert.deepEqual(h.drawing(),drawing);
});

test('malformed, overflowing, out-of-range and nonzero underflow targets are atomic while running',async()=>{
 const h=await setup('?experiment=wave&at=v1,13.75,-7.125,.004');click(h,'step');click(h,'observation-return');click(h,'pause');h.tick(0);h.tick(50);
 const bad=['1e','1e+','1e-','e2','.e2','1e2e3','1 e2','1e 2','1e2.5','1e+-2','Infinity','NaN','0x1e2','①e2','1e9999','1e-9999','1e-324','-1e-9999','1.0001e4'];
 for(const axis of ['x','y'])for(const value of bad){type(h,'wave-target-x','7.5e0');type(h,'wave-target-y','-1.25e1');type(h,'wave-target-'+axis,value);const before=state(h);click(h,'wave-position');assert.deepEqual(state(h),before,axis+': '+value);assert.equal(h.el('wave-target-'+axis).getAttribute('aria-invalid'),'true');assert.equal(document.activeElement,h.el('wave-target-'+axis));}
 for(const value of [...bad.filter(v=>v!=='1.0001e4'),'1.0001e9','-1e-7','-0e0']){type(h,'wave-time',value);const before=state(h);click(h,'wave-time-seek');assert.deepEqual(state(h),before,'time: '+value);assert.equal(h.el('wave-time').getAttribute('aria-invalid'),'true');assert.equal(document.activeElement,h.el('wave-time'));}
 // Underflow is equally unsafe in decimal notation: it must not quietly seek 0.
 const decimal='0.'+'0'.repeat(323)+'1';for(const id of ['wave-target-x','wave-time']){type(h,id,decimal);const before=state(h);click(h,id==='wave-time'?'wave-time-seek':'wave-position');assert.deepEqual(state(h),before);assert.equal(h.el(id).getAttribute('aria-invalid'),'true');}
 position(h,'1e-7','-2e-8');seek(h,'1.25e-1');assert.equal(h.frames.size,0);assert.equal(h.el('wave-position-error').hidden,true);assert.equal(h.el('wave-time-error').hidden,true);
});

test('scientific drafts are inert, retain keyboard exclusions, and use native fresh Enter focus',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,0');click(h,'pause');h.tick(0);const before=state(h);type(h,'wave-target-x','1e-');type(h,'wave-target-y','-2e-8');type(h,'wave-time','1e-');assert.deepEqual(state(h),before);
 h.tick(50);h.resize(233,240);h.setDpr(2);click(h,'tab-life');click(h,'tab-wave');assert.equal(h.el('wave-target-x').value,'1e-');assert.equal(h.el('wave-time').value,'1e-');
 type(h,'wave-target-x','1e-7');type(h,'wave-time','1.25e-1');
 for(const id of ['wave-target-x','wave-target-y','wave-time']){const beforeKeys=state(h);assert.equal(key(h,id,{repeat:true}),true);for(const extra of [{isComposing:true},{keyCode:229},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{key:'ArrowLeft'},{key:'Home'},{key:'Escape'}])assert.equal(key(h,id,extra),false);assert.deepEqual(state(h),beforeKeys);h.el(id).focus();assert.equal(key(h,id),true);assert.equal(document.activeElement,h.el(id));assert.equal(h.el(id).getAttribute('aria-invalid'),'false');}
 assert.deepEqual(current(h),['当前探针 · x 1e-7，y -2e-8','当前时刻 · t 0.125 模型秒']);
});

test('scientific edits preserve fixed links, pending copy, return undo and page-only discoveries',async()=>{
 const pending=[];Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:value=>new Promise(resolve=>pending.push({value,resolve}))}}});
 try{const h=await setup('?experiment=wave&at=v1,13.75,-7.125,.004');click(h,'step');const later=h.drawing();click(h,'observation-return');const copy=click(h,'observation-copy'),saved=fixed(h);position(h,'1e-7','-2e-8');seek(h,'1.25e-1');assert.deepEqual(fixed(h),saved);assert.match(pending[0].value,/v1%2C13.75%2C-7.125%2C0.004/);pending[0].resolve();await copy;click(h,'observation-undo');assert.deepEqual(h.drawing(),later);assert.equal(h.el('wave-target-x').value,'1e-7');assert.equal(h.el('wave-time').value,'0.125');assert.equal(text(h,'notes-count'),'0 / 5');}finally{delete globalThis.navigator;}
});

test('scientific targets are isolated from strict integer editors and stale-world actions',async()=>{
 const h=await setup('?experiment=wave');position(h,'1e-7','-2e-8');seek(h,'1.25e-1');
 for(const mode of ['orbit','life','fractal','walk']){click(h,'tab-'+mode);const before=state(h);click(h,'wave-position');click(h,'wave-time-seek');assert.deepEqual(state(h),before);}
 for(const [mode,value] of [['fractal','1e3'],['walk','1e2']]){click(h,'tab-'+mode);type(h,mode+'-count',value);const before=state(h);click(h,mode+'-seek');assert.deepEqual(state(h),before);assert.equal(h.el(mode+'-count').getAttribute('aria-invalid'),'true');}
 click(h,'tab-wave');assert.deepEqual(current(h),['当前探针 · x 1e-7，y -2e-8','当前时刻 · t 0.125 模型秒']);
});

test('Wave help explains scientific notation beside all affected editors without new live regions',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 for(const id of ['wave-position-help','wave-time-help']){const content=html.match(new RegExp(`<small id="${id}">([^<]+)</small>`))[1];assert.match(content,/1e-7/);assert.match(content,/0.0000001/);assert.match(content,/过小.*0/);}
 for(const id of ['wave-position-error','wave-time-error'])assert.match(html,new RegExp(`<p id="${id}" aria-live="off" hidden>`));
});
