import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const text=(h,id)=>h.el(id).textContent;
const type=(h,id,value)=>{h.el(id).value=value;h.el(id).handlers.input();};
const position=(h,x,y)=>{type(h,'wave-target-x',x);type(h,'wave-target-y',y);click(h,'wave-position');};
const seek=(h,id,value)=>{type(h,id,value);click(h,id==='wave-time'?'wave-time-seek':id.replace('count','seek'));};
const key=(h,id,extra={})=>{let prevented=false;h.el(id).handlers.keydown({key:'Enter',preventDefault(){prevented=true;},...extra});return prevented;};
const fixed=h=>({url:location.href,writes:h.writes(),link:h.el('share-link').value,summary:text(h,'saved-observation-reading'),undo:text(h,'observation-undo-status'),notes:h.el('field-notes-list').innerHTML});
const state=h=>({fixed:fixed(h),drawing:h.drawing(),draws:h.drawCount(),frames:[...h.frames.keys()],status:text(h,'status')});
const full=value=>String(value).replace(/[0-9+.eE-]/g,char=>String.fromCharCode(char.charCodeAt(0)+0xFEE0));

for(const [x,y,time] of [['13.75','-7.125','.004'],['+1E-7','-2e-8','5e-324'],['10000','-10000','1e9'],['0e9999','-0E-9999','0E9999']])test(`full-width Wave numbers reproduce ASCII readings and geometry: ${x}`,async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,0');position(h,x,y);seek(h,'wave-time',time);
 const expected=h.drawing(),readings=[text(h,'wave-position-current'),text(h,'wave-time-current')],saved=fixed(h);
 position(h,'　'+full(x)+'　',full(y).replace('－','−'));seek(h,'wave-time',full(time));
 assert.equal(h.el('wave-position-error').hidden,true);assert.equal(h.el('wave-time-error').hidden,true);assert.deepEqual(h.drawing(),expected);assert.deepEqual([text(h,'wave-position-current'),text(h,'wave-time-current')],readings);assert.deepEqual(fixed(h),saved);
 for(const id of ['wave-target-x','wave-target-y','wave-time'])assert.doesNotMatch(h.el(id).value,/[０-９＋－．Ｅｅ−]/);
 // Repeating normalized tiny/scientific fields is still valid and stable.
 click(h,'wave-position');click(h,'wave-time-seek');assert.deepEqual(h.drawing(),expected);
 await click(h,'share');assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),`v1,${Number(x)},${Number(y)},${Number(time)}`);
});

test('mixed-width digits and mathematical exponent signs retain their exact values',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,0');position(h,'１e-7','1e−7');seek(h,'wave-time','０.５');
 assert.equal(text(h,'wave-position-current'),'当前探针 · x 1e-7，y 1e-7');assert.equal(text(h,'wave-time-current'),'当前时刻 · t 0.5 模型秒');
 assert.equal(h.el('wave-target-x').value,'1e-7');assert.equal(h.el('wave-target-y').value,'1e-7');assert.equal(h.el('wave-time').value,'0.5');
 position(h,'７.５','-.２５');assert.equal(text(h,'wave-position-current'),'当前探针 · x 7.5，y -0.25');
 click(h,'tab-fractal');seek(h,'fractal-count','7３1');assert.equal(h.el('fractal-count').value,'731');
 click(h,'tab-walk');seek(h,'walk-count','1３7');assert.equal(h.el('walk-count').value,'137');
});

for(const [mode,counts] of [['fractal',[300,731,12000]],['walk',[16,137,512]]])test(`${mode} accepts full-width whole digits and exactly replays the ASCII destination`,async()=>{
 const h=await setup(`?experiment=${mode}&seed=37&at=v1,${counts[0]}`),id=mode+'-count';
 for(const count of counts){seek(h,id,String(count));const expected=h.drawing(),saved=fixed(h);seek(h,id,'　００'+full(count)+'　');assert.equal(h.el(id).value,String(count));assert.equal(h.el(id).getAttribute('aria-invalid'),'false');assert.equal(h.frames.size,0);assert.deepEqual(h.drawing(),expected);assert.deepEqual(fixed(h),saved);}
});

test('only the specified numeric glyphs normalize; malformed Wave drafts stay atomic while running',async()=>{
 const h=await setup('?experiment=wave&at=v1,13.75,-7.125,.004');click(h,'step');click(h,'observation-return');click(h,'pause');h.tick(0);h.tick(50);
 const bad=['１，０００','１,０００','１。５','１．２．３','１／２','①','²','𝟙','١','一','﹣１','–１','—１','１ ２','１\u200b２','１\u200e２','１ｍ','１％','０ｘ１０','Ｉｎｆｉｎｉｔｙ','ＮａＮ','１Ｅ','１Ｅ＋','１Ｅ−','１Ｅ２Ｅ３','１Ｅ＋−２','１Ｅ９９９９','１Ｅ−９９９９','１Ｅ−３２４','１．０００１Ｅ４','０．'+'０'.repeat(323)+'１'];
 for(const axis of ['x','y'])for(const value of bad){type(h,'wave-target-x','７．５');type(h,'wave-target-y','−１２．５');type(h,'wave-target-'+axis,value);const before=state(h);click(h,'wave-position');assert.deepEqual(state(h),before,axis+': '+value);assert.equal(h.el('wave-target-'+axis).value,value);assert.equal(h.el('wave-target-'+axis).getAttribute('aria-invalid'),'true');assert.equal(document.activeElement,h.el('wave-target-'+axis));}
 for(const value of [...bad.filter(v=>v!=='１．０００１Ｅ４'),'１．０００１Ｅ９','−０','－０Ｅ０','−１Ｅ−７']){type(h,'wave-time',value);const before=state(h);click(h,'wave-time-seek');assert.deepEqual(state(h),before,value);assert.equal(h.el('wave-time').value,value);assert.equal(h.el('wave-time').getAttribute('aria-invalid'),'true');assert.equal(document.activeElement,h.el('wave-time'));}
 position(h,'＋７．５','−１２．５');seek(h,'wave-time','＋０．１２５');assert.equal(h.frames.size,0);assert.equal(h.el('wave-position-error').hidden,true);assert.equal(h.el('wave-time-error').hidden,true);
});

for(const [mode,valid,bounds] of [['fractal','７３１',['２９９','１２００１']],['walk','１３７',['１５','５１３']]])test(`${mode} retains strict unsigned integer grammar after normalization`,async()=>{
 const h=await setup(`?experiment=${mode}`),id=mode+'-count';click(h,'pause');h.tick(0);
 for(const value of [...bounds,valid+'．０',valid+'．５','＋'+valid,'－'+valid,'−'+valid,'１ｅ３','１Ｅ２','１，０００','①③⑦','１２３ 步','１ ３７','９００７１９９２５４７４０９９３']){type(h,id,value);const before=state(h);click(h,mode+'-seek');assert.deepEqual(state(h),before,value);assert.equal(h.el(id).value,value);assert.equal(h.el(id).getAttribute('aria-invalid'),'true');assert.equal(document.activeElement,h.el(id));}
 seek(h,id,valid);assert.equal(h.el(id).getAttribute('aria-invalid'),'false');assert.equal(h.frames.size,0);
});

test('drafts remain literal through redraws and composition; only a fresh unmodified Enter submits',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,0');
 for(const [mode,targets] of [['wave',[['wave-target-x','−７．１２５'],['wave-target-y','１Ｅ−７'],['wave-time','０．１２５']]],['fractal',[['fractal-count','７３１']]],['walk',[['walk-count','１３７']]]]){
  click(h,'tab-'+mode);click(h,'pause');h.tick(0);const beforeTyping=state(h);
  for(const [id,value] of targets){type(h,id,value);assert.deepEqual(state(h),beforeTyping);}
  h.tick(50);h.resize(233,240);h.setDpr(2);click(h,'tab-life');click(h,'tab-'+mode);
  for(const [id,value] of targets){assert.equal(h.el(id).value,value);const beforeKeys=state(h);assert.equal(key(h,id,{repeat:true}),true);for(const extra of [{isComposing:true},{keyCode:229},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{key:'Escape'},{key:'ArrowLeft'}])assert.equal(key(h,id,extra),false);assert.deepEqual(state(h),beforeKeys);assert.equal(h.el(id).value,value);}
  for(const [id] of targets){h.el(id).focus();assert.equal(key(h,id),true);assert.equal(document.activeElement,h.el(id));assert.equal(h.el(id).getAttribute('aria-invalid'),'false');assert.doesNotMatch(h.el(id).value,/[０-９＋－．Ｅｅ−]/);}
 }
});

test('normalized edits preserve checkpoint recovery, fixed copy payload and page-only discoveries',async()=>{
 const pending=[];Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:value=>new Promise(resolve=>pending.push({value,resolve}))}}});
 try{const h=await setup('?experiment=wave&at=v1,13.75,-7.125,.004');click(h,'step');const later=h.drawing();click(h,'observation-return');const copy=click(h,'observation-copy'),saved=fixed(h);position(h,'１Ｅ−７','−２ｅ−８');seek(h,'wave-time','０．１２５');assert.deepEqual(fixed(h),saved);assert.match(pending[0].value,/v1%2C13.75%2C-7.125%2C0.004/);pending[0].resolve();await copy;click(h,'observation-undo');assert.deepEqual(h.drawing(),later);assert.equal(h.el('wave-target-x').value,'1E-7');assert.equal(h.el('wave-time').value,'0.125');assert.equal(text(h,'notes-count'),'0 / 5');}finally{delete globalThis.navigator;}
});

test('localized help states supported glyphs without broad Unicode normalization or extra live regions',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 for(const id of ['wave-position-help','wave-time-help','fractal-seek-help','walk-seek-help'])assert.match(html.match(new RegExp(`<small id="${id}">([^<]+)</small>`))[1],/全角数字/);
 for(const id of ['wave-position-help','wave-time-help'])assert.match(html.match(new RegExp(`<small id="${id}">([^<]+)</small>`))[1],/＋－．Ｅｅ.*负号 −.*不支持千位分隔符/);
 assert.doesNotMatch(app,/\.normalize\(/);
 for(const id of ['wave-position-error','wave-time-error','fractal-seek-error','walk-seek-error'])assert.match(html,new RegExp(`<p id="${id}" aria-live="off" hidden>`));
});
