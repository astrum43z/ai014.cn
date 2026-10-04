import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
const click=(h,id)=>h.el(id).handlers.click();
const field=(h,axis)=>h.el('wave-target-'+axis);
function type(h,axis,value){field(h,axis).value=String(value);field(h,axis).handlers.input();}
function position(h,x,y){type(h,'x',x);type(h,'y',y);click(h,'wave-position');}
function key(h,axis,extra={}){let prevented=false;field(h,axis).handlers.keydown({key:'Enter',preventDefault(){prevented=true;},...extra});return prevented;}
const values=h=>['left','right','combined'].map(key=>{const bar=h.el('wave-bar-'+key),value=Number(bar.getAttribute('width'))/100;return Number(bar.getAttribute('x'))<100?-value:value;});
// Independent two-source expression, not the implementation's field helpers.
function expected(x,y,time,wavelength=30,separation=100){const a=Math.sin(Math.hypot(x+separation/2,y)*2*Math.PI/wavelength-time*3),b=Math.sin(Math.hypot(x-separation/2,y)*2*Math.PI/wavelength-time*3);return [a,b,(a+b)/2];}
function close(actual,want){actual.forEach((v,i)=>assert.ok(Math.abs(v-want[i])<1e-10,`${v} ≈ ${want[i]}`));}
const saved=h=>({url:location.href,writes:h.writes(),link:h.el('share-link').value,summary:h.el('saved-observation-reading').textContent,recovery:h.el('observation-undo-status').textContent,hidden:h.el('share-link').hidden});
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),metrics:h.el('metrics').textContent,reading:h.el('wave-probe-reading').textContent,status:h.el('status').textContent,frames:[...h.frames.keys()],saved:saved(h),notes:h.el('field-notes-list').innerHTML});
const observation=h=>new URL(h.el('share-link').value).searchParams.get('at').split(',').slice(1).map(Number);

test('fractional positioning reaches cancellation that two-unit arrows cannot select',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&separation=100&at=v1,0,0,2.5');
 for(let i=0;i<4;i++)click(h,'wave-right');assert.match(h.el('wave-probe-reading').textContent,/x 8.0，y 0.0.*0.10$/);
 const fixed=saved(h);h.el('wave-position').focus();position(h,7.5,0);
 assert.match(h.el('wave-probe-reading').textContent,/x 7.5，y 0.0.*0.00$/);assert.match(h.el('wave-path-context').textContent,/15.00 ÷ 波长 30 ≈ 0.50/);
 assert.equal(document.activeElement,h.el('wave-position'));assert.equal(h.el('status').textContent,'已暂停');assert.equal(h.frames.size,0);assert.deepEqual(saved(h),fixed);
 for(let i=0;i<4;i++){close(values(h),expected(7.5,0,2.5+i*Math.PI/6));assert.equal(h.el('wave-value-combined').textContent,'0.00');click(h,'step');}
});

for(const [x,y,time,w,s] of [[-7.5,0,0,30,100],[12.375,-4.125,7.3,70,180],[-10000,10000,9,15,20],[10000,-10000,3.4,32,100],[.0001,-.0002,0,30,100]])test(`position ${x},${y} preserves phase and exact shareable coordinates`,async()=>{
 const h=await setup(`?experiment=wave&wavelength=${w}&separation=${s}&at=v1,0,0,${time}`);position(h,x,y);
 close(values(h),expected(x,y,time,w,s));assert.equal(h.el('wavelength').value,String(w));assert.equal(h.el('separation').value,String(s));
 await click(h,'share');assert.deepEqual(observation(h),[x,y,time]);
 const original=h.drawing(),link=h.el('share-link').value;h.navigate('?experiment=fractal');h.navigate(link);close(values(h),expected(x,y,time,w,s));assert.deepEqual(h.drawing(),original);
});

test('both target fields accept Enter, trim and normalize signed decimal input without losing focus',async()=>{
 for(const axis of ['x','y']){const h=await setup('?experiment=wave');type(h,'x',' +007.500 ');type(h,'y','-.50');field(h,axis).focus();assert.equal(key(h,axis),true);assert.equal(document.activeElement,field(h,axis));assert.equal(field(h,'x').value,'7.5');assert.equal(field(h,'y').value,'-0.5');assert.match(h.el('announcement').textContent,/x 7.5，y -0.5；保留参数与时刻/);}
});

test('tiny decimal targets remain valid after repeated submission without exponent-format drift',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,0');position(h,' 0.0000001 ','-0.00000002');
 assert.equal(field(h,'x').value,'0.0000001');assert.equal(field(h,'y').value,'-0.00000002');
 click(h,'wave-position');assert.equal(h.el('wave-position-error').hidden,true);await click(h,'share');assert.deepEqual(observation(h),[1e-7,-2e-8,0]);
});

test('invalid or incomplete coordinates never partly move or pause a running model',async()=>{
 const h=await setup('?experiment=wave&at=v1,12,7,3');click(h,'step');click(h,'observation-return');click(h,'pause');h.tick(0);h.tick(50);
 for(const axis of ['x','y'])for(const value of ['', ' ', '-', '.', '-.', '10000.01','-10001','Infinity','NaN','1e2','0x10','７.５','7,5','7 units']){
  type(h,'x','7.5');type(h,'y','-3.25');type(h,axis,value);const before=state(h);click(h,'wave-position');assert.deepEqual(state(h),before,axis+' '+value);assert.equal(field(h,axis).getAttribute('aria-invalid'),'true');assert.equal(field(h,axis==='x'?'y':'x').getAttribute('aria-invalid'),'false');assert.equal(document.activeElement,field(h,axis));assert.equal(h.el('wave-position-error').hidden,false);
 }
 type(h,'x','-');type(h,'y','-');click(h,'wave-position');assert.equal(document.activeElement,field(h,'x'));type(h,'x','7.5');assert.equal(h.el('wave-position-error').hidden,false);type(h,'y','0');assert.equal(h.el('wave-position-error').hidden,true);assert.equal(h.el('wave-position-error').textContent,'');click(h,'wave-position');assert.equal(h.frames.size,0);
});

test('drafts survive animation, redraws, coordinates from other controls, tabs and parameter resets',async()=>{
 const h=await setup('?experiment=wave&at=v1,12,7,3');click(h,'pause');h.tick(0);type(h,'x','-7.');type(h,'y','-.');const before=state(h);type(h,'x','-7.');assert.deepEqual(state(h),before);h.tick(50);
 h.resize(259,240);h.setDpr(2);h.loseContext();h.restoreContext();click(h,'wave-home');click(h,'wave-right');click(h,'tab-fractal');click(h,'tab-wave');h.el('wavelength').handlers.input({target:{value:'30'}});click(h,'reset');
 assert.equal(field(h,'x').value,'-7.');assert.equal(field(h,'y').value,'-.');type(h,'y','0');click(h,'wave-position');assert.equal(field(h,'x').value,'-7');assert.match(h.el('wave-probe-reading').textContent,/x -7.0，y 0.0/);
});

test('held, modified or composing Enter and ordinary text-navigation keys stay independent',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,0');type(h,'x','7.5');type(h,'y','0');const before=state(h);
 for(const axis of ['x','y']){assert.equal(key(h,axis,{repeat:true}),true);for(const extra of [{isComposing:true},{keyCode:229},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true}])assert.equal(key(h,axis,extra),false);for(const k of ['Escape',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'])assert.equal(key(h,axis,{key:k}),false);}
 assert.deepEqual(state(h),before);let p=false;h.el('wave-position').handlers.keydown({key:'Enter',repeat:true,preventDefault(){p=true;}});assert.equal(p,true);
 for(const e of [{key:'Enter',repeat:false},{key:' ',repeat:true}])h.el('wave-position').handlers.keydown({...e,preventDefault(){assert.fail('native activation suppressed');}});
});

test('positioning pauses once and Continue resumes the existing time without fast-forwarding',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,0,0,3');click(h,'pause');h.tick(0);h.tick(50);position(h,7.5,12.25);close(values(h),expected(7.5,12.25,3.05));assert.equal(h.frames.size,0);
 click(h,'pause');h.tick(90000);close(values(h),expected(7.5,12.25,3.05));h.tick(90050);close(values(h),expected(7.5,12.25,3.1));position(h,7.5,12.25);assert.equal(h.frames.size,0);
});

test('positioning retains fixed checkpoints and exact one-level return undo',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,7.5,0,2.5');position(h,84.125,-55.75);click(h,'step');const old=h.drawing();click(h,'observation-return');const checkpoint=saved(h);position(h,-40.5,18.25);assert.deepEqual(saved(h),checkpoint);click(h,'observation-undo');assert.deepEqual(h.drawing(),old);assert.equal(h.el('observation-undo').getAttribute('aria-disabled'),'true');assert.equal(location.href,checkpoint.url);
});

test('pending copies keep their checkpoint until explicit sharing captures the new position',async()=>{
 const pending=[];Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:text=>new Promise(resolve=>pending.push({text,resolve}))}}});
 try{const h=await setup('?experiment=wave&wavelength=30&at=v1,0,0,3');const copy=click(h,'observation-copy');position(h,7.5,0);assert.match(pending[0].text,/v1%2C0%2C0%2C3/);pending[0].resolve();await copy;assert.match(h.el('share-status').textContent,/已复制/);const next=click(h,'share');assert.match(pending[1].text,/v1%2C7.5%2C0%2C3/);pending[1].resolve();await next;assert.deepEqual(observation(h),[7.5,0,3]);}finally{delete globalThis.navigator;}
});

test('resizing fits the exact probe, later arrow movement stays two units, and Home releases the wider view',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,0,0,2.5');const centered=h.drawing();position(h,800,-300);const fixed=values(h);
 for(const [w,v] of [[259,240],[171,300],[334.5,281.75]]){h.resize(w,v);close(values(h),fixed);assert.match(h.el('wave-probe-reading').textContent,/x 800.0，y -300.0/);}
 click(h,'wave-right');close(values(h),expected(802,-300,2.5));h.resize(600,414);click(h,'wave-home');assert.deepEqual(h.drawing(),centered);
});

test('model-space entry is valid through temporary collapse and context interruptions',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&at=v1,0,0,2.5');h.resize(20,20);position(h,7.5,-3.25);h.setDpr(2);h.loseContext();h.restoreContext();h.setHidden(true);h.setVisible(false);h.resize(600,414);h.setHidden(false);h.setVisible(true);assert.equal(h.frames.size,0);close(values(h),expected(7.5,-3.25,2.5));
});

test('other worlds reject stale position activation without changing their model or inputs',async()=>{
 const h=await setup('?experiment=wave');position(h,7.5,0);
 for(const mode of ['orbit','life','fractal','walk']){click(h,'tab-'+mode);const before=state(h);click(h,'wave-position');assert.deepEqual(state(h),before);click(h,'tab-wave');assert.match(h.el('wave-probe-reading').textContent,/x 7.5，y 0.0/);}
});

test('exact positions can support discoveries but never write a note without an explicit check',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');position(h,8,0);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');position(h,0,0);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('field-notes-list').innerHTML;position(h,7.5,2.25);assert.equal(h.el('field-notes-list').innerHTML,notes);
});

test('new positioning does not consume intentional Fractal or Walk batch repeats',async()=>{
 const h=await setup('?experiment=fractal');for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('batch repeat suppressed');}});click(h,'step');}assert.match(h.el('metrics').textContent,/500 个点/);click(h,'tab-walk');h.key('ArrowRight');h.key('ArrowRight',{repeat:true});assert.match(h.el('metrics').textContent,/48 步/);
});

test('both coordinates have labels, shared quiet errors and wrapping 44px controls outside instruments',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 for(const axis of ['x','y']){assert.ok(html.indexOf(`id="wave-target-${axis}"`)<html.indexOf('id="instruments"'));assert.match(html,new RegExp(`<label for="wave-target-${axis}">目标 ${axis}<input id="wave-target-${axis}" type="text" inputmode="decimal" value="0"[^>]*aria-describedby="wave-position-current wave-position-help wave-position-error"`));}
 assert.match(html,/<button id="wave-position" type="button" aria-describedby="wave-position-current wave-position-help">定位探针并暂停<\/button>/);assert.match(html,/<p id="wave-position-error" aria-live="off" hidden>/);assert.match(html,/输入 −10000 到 10000 的坐标，可含小数/);assert.match(css,/\.wave-touch>div\{display:flex;flex-wrap:wrap/);assert.match(css,/\.wave-position-fields\{display:flex;flex-wrap:wrap/);assert.match(css,/\.wave-position input\{[^}]*min-width:0;min-height:44px/);assert.match(css,/\.wave-position #wave-position\{[^}]*white-space:normal/);
});
