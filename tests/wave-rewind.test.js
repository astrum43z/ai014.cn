import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
const quarter=Math.PI/6,click=(h,id='wave-back')=>h.el(id).handlers.click();
const values=h=>['left','right','combined'].map(key=>{const b=h.el('wave-bar-'+key),v=Number(b.getAttribute('width'))/100;return Number(b.getAttribute('x'))<100?-v:v;});
// Independent two-source displacement, using distances and fixed angular speed.
function expected(x,y,t,s=100,w=32){const a=Math.sin(Math.hypot(x+s/2,y)*Math.PI*2/w-t*3),b=Math.sin(Math.hypot(x-s/2,y)*Math.PI*2/w-t*3);return [a,b,(a+b)/2];}
function close(a,b,tolerance=1e-10){a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<=tolerance,`${v} ≈ ${b[i]}`));}
const geometry=h=>['wave-probe-reading','wave-path-context','wave-distances','wave-difference','wave-envelope','observation-a','observation-b','observation-c'].map(id=>h.el(id).textContent);
const state=h=>({drawing:h.drawing(),readings:['metrics','status','announcement','wave-rewind-status','saved-observation-reading','observation-undo-status','mission-result','notes-count'].map(id=>h.el(id).textContent),frames:h.frames.size,draws:h.drawCount(),writes:h.writes(),url:location.href,focus:document.activeElement,notes:h.el('field-notes-list').innerHTML});
const savedTime=h=>Number(new URL(h.el('share-link').value).searchParams.get('at').split(',')[3]);
for(const [x,y,time,s,w] of [[0,0,quarter*4,100,32],[8,0,2.5,100,32],[-19,42,7.3,180,15],[10000,-10000,1e9,20,70]])test(`rewind evaluates the previous quarter phase at ${x},${y},t=${time}`,async()=>{
 const h=await setup(`?experiment=wave&wavelength=${w}&separation=${s}&at=v1,${x},${y},${time}`),fixed=geometry(h),url=location.href,writes=h.writes(),before=values(h);
 h.el('wave-back').focus();click(h);close(values(h),expected(x,y,time-quarter,s,w),1e-6);
 assert.deepEqual(geometry(h),fixed);assert.equal(h.el('status').textContent,'已暂停');assert.equal(h.frames.size,0);assert.equal(document.activeElement,h.el('wave-back'));assert.equal(location.href,url);assert.equal(h.writes(),writes);
 assert.match(h.el('announcement').textContent,/已暂停，退回四分之一周期；/);click(h,'step');close(values(h),before,1e-6);
 await click(h,'share');assert.equal(savedTime(h),(time-quarter)+quarter,'sharing uses the same live clock');
});
test('at zero rewind retains focus and is quiet, even before the first running frame',async()=>{
 for(const motion of [true,false]){const h=await setup('?experiment=wave','',motion),b=h.el('wave-back');Object.defineProperty(b,'disabled',{set:()=>assert.fail('native disabling loses focus')});Object.defineProperty(b,'tabIndex',{set:()=>assert.fail('keep boundary focusable')});b.focus();assert.equal(b.getAttribute('aria-disabled'),'true');assert.match(h.el('wave-rewind-status').textContent,/已在 t = 0/);const before=state(h);for(let i=0;i<3;i++)click(h);assert.deepEqual(state(h),before);click(h,'step');assert.equal(b.getAttribute('aria-disabled'),'false');click(h);close(values(h),expected(0,0,0));assert.equal(b.getAttribute('aria-disabled'),'true');assert.equal(h.frames.size,0);assert.equal(document.activeElement,b);}
});
test('a partial initial quarter stops at zero and explains the shorter move',async()=>{
 for(const time of [Number.MIN_VALUE,.01,.3,quarter-1e-9]){const h=await setup(`?experiment=wave&at=v1,8,12,${time}`),fixed=geometry(h);assert.match(h.el('wave-rewind-status').textContent,/不足 ¼ 周期/);click(h);close(values(h),expected(8,12,0));assert.deepEqual(geometry(h),fixed);assert.equal(h.el('wave-back').getAttribute('aria-disabled'),'true');assert.match(h.el('announcement').textContent,/回到 t = 0 起点（不足四分之一周期）/);const before=state(h);click(h);assert.deepEqual(state(h),before);await click(h,'share');assert.equal(savedTime(h),0);}
});
test('phase review distinguishes a dark central instant from full-cycle cancellation',async()=>{
 const dark=(50/32*2*Math.PI)/3,h=await setup(`?experiment=wave&at=v1,0,0,${dark}`);assert.equal(h.el('wave-value-combined').textContent,'0.00');click(h);assert.equal(h.el('wave-value-combined').textContent,'+1.00');assert.match(h.el('wave-envelope').textContent,/1.00$/);click(h,'guide-start');for(let i=0;i<4;i++)click(h,'step');for(let i=0;i<4;i++){click(h);assert.equal(h.el('wave-value-combined').textContent,'0.00');assert.match(h.el('wave-envelope').textContent,/0.00$/);}
});
test('rewind pauses running Waves and Continue resumes only from the revisited time',async()=>{
 const h=await setup('?experiment=wave&at=v1,12,-7,3');click(h,'pause');h.tick(0);h.tick(50);h.tick(100);click(h);let t=3+.05+.05-quarter;close(values(h),expected(12,-7,t));assert.equal(h.frames.size,0);click(h,'pause');const message=h.el('announcement').textContent;h.tick(60000);close(values(h),expected(12,-7,t));h.tick(60050);t+=.05;close(values(h),expected(12,-7,t));assert.equal(h.el('announcement').textContent,message);h.motion.change({matches:true});assert.equal(h.frames.size,0);click(h);close(values(h),expected(12,-7,t-quarter));
});
test('rewind keeps fixed links and earlier return recovery, including pending copying',async()=>{
 let finish;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(resolve=>finish=resolve)}}});
 try{const h=await setup('?experiment=wave&at=v1,8,12,2.5','#canvas'),url=location.href;click(h,'step');click(h,'step');const later=values(h);click(h,'observation-return');const recovery=h.el('observation-undo-status').textContent,pending=click(h,'observation-copy');click(h);assert.equal(location.href,url);assert.equal(h.el('share-link').value,url);assert.equal(h.el('observation-undo-status').textContent,recovery);finish();await pending;assert.match(h.el('share-status').textContent,/已复制/);click(h,'observation-undo');close(values(h),later);assert.equal(location.href,url);click(h);const copy=click(h,'share');finish();await copy;assert.equal(savedTime(h),2.5+quarter+quarter-quarter);}finally{delete globalThis.navigator;}
});
test('tabs, reflow, density, context and visibility preserve the revisited time',async()=>{
 const h=await setup('?experiment=wave&at=v1,300,-130,7.3');click(h);const time=7.3-quarter,fixed=geometry(h),saved=values(h);for(const [w,v] of [[259,240],[455.5,281.75],[600,414]]){h.resize(w,v);close(values(h),saved);assert.deepEqual(geometry(h),fixed);}h.setDpr(2);h.loseContext();h.restoreContext();h.setVisible(false);h.setHidden(true);h.setHidden(false);h.setVisible(true);assert.equal(h.frames.size,0);close(values(h),saved);
 for(const index of [0,1,3,4]){h.tabs[index].handlers.click();assert.equal(h.el('wave-back').hidden,true);assert.equal(h.el('wave-rewind-status').hidden,true);const before=state(h);click(h);assert.deepEqual(state(h),before);h.tabs[2].handlers.click();assert.equal(h.el('wave-back').hidden,false);assert.equal(h.el('wave-rewind-status').hidden,false);close(values(h),saved);}click(h,'step');close(values(h),expected(300,-130,time+quarter));
});
test('time origin follows parameter edits, resets, presets, guides and history',async()=>{
 const h=await setup('?experiment=wave&at=v1,12,7,3');click(h);let t=3-quarter;h.el('wavelength').handlers.input({target:{value:'70'}});h.el('separation').handlers.input({target:{value:'180'}});click(h);t-=quarter;close(values(h),expected(12,7,t,180,70));click(h,'reset');assert.equal(h.el('wave-back').getAttribute('aria-disabled'),'true');click(h,'step');h.el('preset-select').handlers.change({target:{value:'wide'}});click(h,'load-preset');assert.equal(h.el('wave-back').getAttribute('aria-disabled'),'true');click(h,'step');click(h,'guide-start');assert.equal(h.el('wave-back').getAttribute('aria-disabled'),'true');h.navigate('?experiment=wave&at=v1,-25,31,9');click(h);close(values(h),expected(-25,31,9-quarter));h.navigate('?experiment=wave&at=v1,-25,31,0');assert.equal(h.el('wave-back').getAttribute('aria-disabled'),'true');
});
test('phase review never checks an exploration or rewrites completed discoveries',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');click(h,'mission-check');for(let i=0;i<4;i++){click(h,'step');click(h);}assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'wave-home');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('field-notes-list').innerHTML;click(h,'step');click(h);assert.equal(h.el('field-notes-list').innerHTML,notes);
});
test('one held Enter is suppressed; fresh Enter, native Space and unrelated keys are untouched',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,3'),f=h.el('wave-back').handlers.keydown,before=state(h);for(const [e,want] of [[{key:'Enter',repeat:true},true],[{key:'Enter',repeat:false},false],[{key:' ',repeat:true},false],[{key:'ArrowLeft',repeat:true},false]]){let p=false;f({...e,preventDefault(){p=true;}});assert.equal(p,want);assert.deepEqual(state(h),before);}click(h);close(values(h),expected(0,0,3-quarter));
});
test('unchanged redraws and phase-only animation preserve quiet status text nodes',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,3');let text=h.el('wave-rewind-status').textContent,writes=0;Object.defineProperty(h.el('wave-rewind-status'),'textContent',{get:()=>text,set:v=>{writes++;text=v;}});h.resize(600,414);h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();click(h);click(h,'pause');h.tick(0);h.tick(50);h.tick(100);assert.equal(writes,0);
});
test('the 44px rewind control wraps beside the canvas and has quiet boundary guidance',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8'),b=html.match(/<button id="wave-back"[^>]*>退回 ¼ 周期 −<\/button>/)?.[0];assert.ok(b);assert.match(b,/aria-disabled="true"/);assert.match(b,/aria-label="退回四分之一周期并暂停"/);assert.match(b,/aria-describedby="wave-step-help wave-rewind-status"/);assert.doesNotMatch(b,/\sdisabled(?:[\s=>])|tabindex=/i);assert.ok(html.indexOf('id="wave-back"')<html.indexOf('id="canvas-pause-help"'));assert.ok(html.indexOf('id="wave-back"')<html.indexOf('id="instruments"'));assert.match(html,/<p id="wave-rewind-status" class="wave-rewind-status" aria-live="off" hidden><\/p>/);assert.match(html,/不足 ¼ 周期时退回起点/);assert.match(html,/不撤销参数或探针的修改/);assert.match(css,/#wave-back\{min-height:44px;white-space:normal\}/);assert.match(css,/\.stage-controls\{display:flex;flex-wrap:wrap/);assert.match(html,/app\.js\?[^\"]*&amp;wave=quarter-rewind-1/);assert.match(html,/style\.css\?[^\"]*&amp;wave=quarter-rewind-1/);
});

test('repeated forward/back quarter steps reach the actual origin, not an enabled rounding residue',async()=>{
 for(const count of [3,4,7,10,100,1000]){const h=await setup('?experiment=wave');for(let i=0;i<count;i++)click(h,'step');for(let i=0;i<count;i++)click(h);assert.equal(h.el('wave-back').getAttribute('aria-disabled'),'true',String(count));assert.match(h.el('wave-rewind-status').textContent,/已在 t = 0/);await click(h,'share');assert.equal(savedTime(h),0,String(count));}
});
test('small positive shared times are not rounded before use, and resolved post-rewind times remain positive',async()=>{
 for(const time of [Number.MIN_VALUE,1e-14,1e-12]){const h=await setup(`?experiment=wave&at=v1,0,0,${time}`);assert.equal(h.el('wave-back').getAttribute('aria-disabled'),'false');await click(h,'share');assert.equal(savedTime(h),time);click(h);assert.equal(h.el('wave-back').getAttribute('aria-disabled'),'true');}
 for(const residue of [1e-11,1e-9,.001]){const t=quarter+residue,h=await setup(`?experiment=wave&at=v1,0,0,${t}`);click(h);assert.equal(h.el('wave-back').getAttribute('aria-disabled'),'false');await click(h,'share');assert.equal(savedTime(h),t-quarter);}
});
