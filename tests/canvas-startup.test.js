import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const worlds=['orbit','life','wave','fractal','walk'];
const click=(h,id)=>h.el(id).handlers.click();
const text=(h,id)=>h.el(id).textContent;
const readings=h=>Object.fromEntries(['metrics','observation-a','observation-b','observation-c','orbit-position','life-cell-position','life-cell-state','life-cell-next','life-turnover','fractal-gap-reading','fractal-touch-reading','walk-step-reading','walk-occupancy-reading','wave-position-current','wave-time-current','wave-envelope','saved-observation-reading','observation-undo-status','mission-result','notes-count'].map(id=>[id,text(h,id)]));
const saved=h=>({readings:readings(h),url:location.href,notes:h.el('field-notes-list').innerHTML,link:h.el('share-link').value});
const unavailable=h=>{
 assert.equal(text(h,'status'),'画布未就绪');assert.equal(h.el('canvas-retry-panel').hidden,false);
 assert.match(text(h,'hint'),/文字观测与按钮仍可使用.*重试画面.*刷新会清空进度/);
 assert.equal(h.frames.size,0);
};

for(const world of worlds)for(const failure of [false,'throw','lost'])test(`${world}: initial ${failure===false?'null':failure} context keeps controls and readings initialized`,async()=>{
 const h=await setup('?experiment='+world,'',false,1,failure);unavailable(h);
 assert.ok(text(h,'metrics'));for(const id of ['observation-a','observation-b','observation-c'])assert.ok(text(h,id));
 assert.equal(h.contextRequests(),1);assert.equal(h.drawCount(),0);
 click(h,'step');unavailable(h);assert.equal(text(h,'pause'),'继续');
 const before=saved(h);h.resize(233,240);h.setDpr(2);h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);
 assert.deepEqual(saved(h),before);assert.equal(h.contextRequests(),1,'no timer, redraw or visibility retry loop');assert.equal(h.drawCount(),0);
 h.el('canvas-retry').focus();click(h,'canvas-retry');unavailable(h);assert.equal(h.contextRequests(),2);assert.deepEqual(saved(h),before);assert.equal(document.activeElement,h.el('canvas-retry'));
 assert.match(text(h,'announcement'),/仍未就绪.*稍后再重试/);
});

for(const world of worlds)test(`${world}: retry paints the same exact model and next step after text-only interaction`,async()=>{
 const reference=await setup('?experiment='+world);click(reference,'step');click(reference,'step');const expected=reference.drawing(),expectedReadings=readings(reference);click(reference,'step');const next=reference.drawing();
 const h=await setup('?experiment='+world,'',true,1,false);click(h,'step');click(h,'step');const before=saved(h);
 assert.deepEqual(readings(h),expectedReadings);h.el('canvas-retry').focus();h.setContextReady(true);click(h,'canvas-retry');
 assert.deepEqual(h.drawing(),expected);assert.deepEqual(saved(h),before);assert.equal(text(h,'status'),'已暂停');assert.equal(h.el('canvas-retry-panel').hidden,true);
 assert.equal(document.activeElement,h.el('canvas'));assert.equal(h.frames.size,0);assert.match(text(h,'announcement'),/画面已恢复.*保留当前实验/);
 assert.deepEqual(h.transforms.at(-1),[1,0,0,1,0,0]);click(h,'step');assert.deepEqual(h.drawing(),next);
 const requests=h.contextRequests(),draws=h.drawCount(),message=text(h,'announcement');click(h,'canvas-retry');assert.equal(h.contextRequests(),requests);assert.equal(h.drawCount(),draws);assert.equal(text(h,'announcement'),message);
});

for(const gate of ['running','pause','hidden','offscreen','reduced'])test(`recovery respects ${gate} intent and never catches up for unavailable time`,async()=>{
 const h=await setup('?experiment=wave','',false,1.25,false);unavailable(h);
 if(gate==='pause')click(h,'pause');if(gate==='hidden')h.setHidden(true);if(gate==='offscreen')h.setVisible(false);if(gate==='reduced')h.motion.change({matches:true});
 h.setContextReady(true);click(h,'canvas-retry');assert.equal(h.frames.size,gate==='running'?1:0);
 assert.equal(text(h,'status'),['pause','reduced'].includes(gate)?'已暂停':'运行中');
 if(gate==='pause'||gate==='reduced')click(h,'pause');if(gate==='hidden')h.setHidden(false);if(gate==='offscreen')h.setVisible(true);
 assert.equal(h.frames.size,1);const before=readings(h);h.tick(90000);assert.deepEqual(readings(h),before);h.tick(90050);assert.equal(text(h,'wave-time-current'),'当前时刻 · t 0.05 模型秒');
 assert.deepEqual(h.transforms.at(-1),[1.25,0,0,1.25,0,0]);
});

test('all worlds retain their text-only progress and exact targets across tabs and recovery',async()=>{
 const h=await setup('?experiment=orbit','',true,1,false),metrics={};
 for(const world of worlds){click(h,'tab-'+world);click(h,'step');metrics[world]=text(h,'metrics');unavailable(h);}
 h.el('walk-count').value='137';h.el('walk-count').handlers.input();click(h,'walk-seek');metrics.walk=text(h,'metrics');
 click(h,'tab-wave');h.el('wave-target-x').value='13.75';h.el('wave-target-y').value='-7.125';click(h,'wave-position');h.el('wave-time').value='0.125';click(h,'wave-time-seek');metrics.wave=text(h,'metrics');
 h.setContextReady(true);click(h,'canvas-retry');
 for(const world of worlds){click(h,'tab-'+world);assert.equal(text(h,'metrics'),metrics[world]);assert.equal(h.el('canvas-retry-panel').hidden,true);assert.equal(h.frames.size,0);}
 assert.equal(h.el('walk-count').value,'137');assert.equal(h.el('wave-target-x').value,'13.75');assert.equal(h.el('wave-time').value,'0.125');
});

test('saved observations, return undo and pending sharing survive a retry without recapturing',async()=>{
 const pending=[];Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(resolve=>pending.push(resolve))}}});
 try{
  const h=await setup('?experiment=wave&at=v1,13.75,-7.125,0.004','',true,1,false);
  click(h,'step');click(h,'observation-return');const before=saved(h),copy=click(h,'observation-copy'),link=h.el('share-link').value;
  h.setContextReady(true);click(h,'canvas-retry');assert.deepEqual(saved(h),{...before,link});assert.equal(location.href,before.url);assert.equal(h.el('share-link').value,link);
  pending.shift()();await copy;assert.match(text(h,'share-status'),/已复制/);click(h,'observation-undo');assert.match(text(h,'wave-time-current'),/0\.5275987755982988/);
 }finally{delete globalThis.navigator;}
});

test('Life keyboard editing, one-generation comparison and discovery notes survive initial absence',async()=>{
 const h=await setup('?experiment=life','',true,1,false);click(h,'mission-start');
 for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 click(h,'mission-check');assert.equal(text(h,'notes-count'),'1 / 5');const note=h.el('field-notes-list').innerHTML;
 click(h,'step');assert.match(text(h,'life-transition-legend'),/没有格子新生或消失/);const before=readings(h);
 click(h,'life-test');assert.match(text(h,'life-test-result'),/不变|静止|仍有/);click(h,'life-return');
 h.setContextReady(true);click(h,'canvas-retry');assert.deepEqual(readings(h),before);assert.equal(h.el('field-notes-list').innerHTML,note);
 click(h,'life-back');assert.match(text(h,'metrics'),/第 0 代/);
});

test('blank canvas pointer input is inert while explicit keyboard controls stay usable',async()=>{
 for(const world of ['life','orbit','wave']){
  const h=await setup('?experiment='+world,'',false,1,false),before=saved(h),pause=text(h,'pause'),canvas=h.el('canvas');
  const event={pointerId:9,button:0,isPrimary:true,clientX:100,clientY:100};
  canvas.handlers.pointerdown(event);canvas.handlers.pointermove({...event,clientX:150});canvas.handlers.pointerup({...event,type:'pointerup'});canvas.handlers.click({...event,detail:1});
  assert.deepEqual(saved(h),before);assert.equal(text(h,'pause'),pause);h.key('ArrowRight');assert.notDeepEqual(readings(h),before.readings);unavailable(h);
 }
});

test('PNG generation remains refused until a fresh request after retry',async()=>{
 const h=await setup('?experiment=fractal&at=v1,1000','',true,1,false),callbacks=[];h.el('canvas').toBlob=callback=>callbacks.push(callback);
 click(h,'save');assert.equal(callbacks.length,0);assert.match(text(h,'save-status'),/画布暂时不可用.*未生成图片/);
 h.setContextReady(true);click(h,'canvas-retry');assert.equal(callbacks.length,0);click(h,'save');assert.equal(callbacks.length,1);callbacks[0](new Blob(['png']));assert.match(text(h,'save-status'),/已发起/);
});

test('fresh Enter can retry once, held Enter and unrelated keys never allocate',async()=>{
 const h=await setup('?experiment=orbit','',true,1,false);h.el('canvas-retry').focus();
 const key=(key,repeat)=>{let prevented=false;h.el('canvas-retry').handlers.keydown({key,repeat,preventDefault(){prevented=true;}});if(key==='Enter'&&!prevented)click(h,'canvas-retry');return prevented;};
 const requests=h.contextRequests();assert.equal(key('Enter',true),true);assert.equal(h.contextRequests(),requests);
 assert.equal(key('Enter',false),false);assert.equal(h.contextRequests(),requests+1);h.setContextReady(true);assert.equal(key('Enter',true),true);unavailable(h);
 for(const k of [' ','Escape','Tab','ArrowRight'])assert.equal(key(k,true),false);assert.equal(h.contextRequests(),requests+1);
 assert.equal(key('Enter',false),false);assert.equal(h.el('canvas-retry-panel').hidden,true);assert.equal(document.activeElement,h.el('canvas'));
});

test('restoration event can recover an initial failure without stealing unrelated focus or looping',async()=>{
 const h=await setup('?experiment=wave&at=v1,13.75,-7.125,0.004','',true,2,false);h.restoreContext();unavailable(h);
 h.el('wave-target-x').focus();h.setRect(253,240);h.setContextReady(true);h.restoreContext();
 assert.equal(document.activeElement,h.el('wave-target-x'));assert.equal(h.el('canvas').width,506);assert.equal(h.el('canvas').height,480);assert.equal(h.frames.size,0);
 assert.equal(text(h,'wave-position-current'),'当前探针 · x 13.75，y -7.125');assert.equal(text(h,'wave-time-current'),'当前时刻 · t 0.004 模型秒');
 h.loseContext();assert.equal(text(h,'status'),'画布待恢复');assert.equal(h.el('canvas-retry-panel').hidden,true);h.restoreContext();assert.equal(text(h,'status'),'已暂停');
});

test('healthy startup adds no visible action, retry allocation, model or markup side effects',async()=>{
 const h=await setup('?experiment=orbit');assert.equal(h.el('canvas-retry-panel').hidden,true);const before=saved(h),picture=h.drawing();
 click(h,'canvas-retry');assert.deepEqual(saved(h),before);assert.deepEqual(h.drawing(),picture);assert.equal(h.contextRequests(),1);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<div id="canvas-retry-panel" class="canvas-retry" hidden>/);assert.match(html,/<button id="canvas-retry" type="button" aria-describedby="canvas-retry-help">重试画面 ↻<\/button>/);
 assert.match(css,/\.canvas-retry\{[^}]*min-width:0/);assert.match(css,/\.canvas-retry button\{[^}]*max-width:100%[^}]*min-width:44px;min-height:44px[^}]*white-space:normal;overflow-wrap:anywhere/);
 assert.match(html,/app\.js\?[^"\n]+&amp;canvas-start=retry-1/);assert.match(html,/style\.css\?[^"\n]+&amp;canvas-start=retry-1/);
});
