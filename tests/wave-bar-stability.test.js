import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';
const names=['left','right','combined'],click=(h,id)=>h.el(id).handlers.click();
function bars(h){return names.map(name=>{const el=h.el('wave-bar-'+name);return [el.getAttribute('x'),el.getAttribute('width')];});}
function watch(h){const writes=[];for(const name of names){const el=h.el('wave-bar-'+name),set=el.setAttribute.bind(el);el.setAttribute=(key,value)=>{writes.push([name,key,String(value)]);set(key,value);};}return writes;}
function check(h,x=0,y=0,t=0,wavelength=32,separation=100){
 const a=Math.sin(Math.hypot(x+separation/2,y)/wavelength*2*Math.PI-t*3),b=Math.sin(Math.hypot(x-separation/2,y)/wavelength*2*Math.PI-t*3);
 const expected=[a,b,(a+b)/2];
 for(const [i,name] of names.entries()){
  const value=expected[i],el=h.el('wave-bar-'+name);
  assert.equal(el.getAttribute('x'),String(100+Math.min(0,value)*100));
  assert.equal(el.getAttribute('width'),String(Math.abs(value)*100));
  const rounded=Math.abs(value)<.005?0:value;
  assert.equal(h.el('wave-value-'+name).textContent,(rounded>0?'+':'')+rounded.toFixed(2));
 }
 return bars(h);
}
function position(h,x,y){for(const [axis,value] of [['x',x],['y',y]]){h.el('wave-target-'+axis).value=String(value);h.el('wave-target-'+axis).handlers.input();}click(h,'wave-position');}
function seek(h,t){h.el('wave-time').value=String(t);h.el('wave-time').handlers.input();click(h,'wave-time-seek');}

test('120 unchanged redraws avoid all 720 redundant bar attribute writes',async()=>{
 const h=await setup('?experiment=wave&at=v1,-240,110,.125'),before=check(h,-240,110,.125),writes=watch(h),message=h.el('announcement').textContent,url=location.href;
 h.el('wave-position').focus();const draws=h.drawCount();
 for(let n=0;n<120;n++)h.resize(600,414);
 assert.equal(h.drawCount()-draws,120,'the canvas still paints each requested redraw');
 assert.equal(writes.length,0);assert.deepEqual(bars(h),before);assert.equal(h.el('announcement').textContent,message);assert.equal(document.activeElement,h.el('wave-position'));assert.equal(location.href,url);assert.equal(h.frames.size,0);
});

test('independent geometry preserves negative, positive, near-zero and boundary readings without rounding',async()=>{
 const h=await setup('?experiment=wave');
 for(const [x,y,wavelength,separation,t] of [[-50,0,32,100,0],[0,0,32,100,0],[7.5,0,30,100,0],[0,0,32,100,50/32*2*Math.PI/3],[10000,-10000,15,180,1e9],[-10000,10000,70,20,.125],[1e-7,-1e-7,32,100,1e-7]]){
  h.el('wavelength').handlers.input({target:{value:String(wavelength)}});h.el('separation').handlers.input({target:{value:String(separation)}});position(h,x,y);seek(h,t);check(h,x,y,t,wavelength,separation);
 }
});

test('only changed attributes update and missing or altered DOM attributes are repaired',async()=>{
 const h=await setup('?experiment=wave'),writes=watch(h);check(h);
 click(h,'step');check(h,0,0,Math.PI/6);assert.equal(writes.length,6);
 writes.length=0;click(h,'step');check(h,0,0,Math.PI/3);assert.equal(writes.length,3,'positive bars keep x = 100');
 writes.length=0;const expected=bars(h);h.el('wave-bar-left').attributes.x='broken';delete h.el('wave-bar-right').attributes.width;
 h.resize(600,414);assert.deepEqual(bars(h),expected);assert.deepEqual(writes.map(w=>w.slice(0,2)),[['left','x'],['right','width']]);
 writes.length=0;h.resize(600,414);assert.equal(writes.length,0);
});

test('focus, resizing, density and simulated context interruptions retain quiet exact bars',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5'),writes=watch(h),before=check(h,8,12,2.5),message=h.el('announcement').textContent;
 h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();
 for(const [w,z] of [[0,0],[20,20],[163,240],[259.5,240.25],[647,317.9375],[1200,560]])h.resize(w,z);
 for(const dpr of [1.25,2,3,1])h.setDpr(dpr);
 h.loseContext();h.restoreContext();h.setVisible(false);h.setVisible(true);h.setHidden(true);h.setHidden(false);
 assert.equal(writes.length,0);assert.deepEqual(bars(h),before);assert.equal(h.el('announcement').textContent,message);
});

test('animation remains exact while visibility and recovery never fast-forward it',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,0'),writes=watch(h);click(h,'pause');assert.equal(writes.length,0);h.tick(0);
 let time=0;for(let i=1;i<=20;i++){h.tick(i*50);time+=.05;check(h,8,0,time);}assert.ok(writes.length>0);
 const before=bars(h);writes.length=0;h.setVisible(false);h.setVisible(true);h.tick(100000);assert.deepEqual(bars(h),before);
 h.setHidden(true);h.setHidden(false);h.tick(200000);assert.deepEqual(bars(h),before);
 h.loseContext();h.restoreContext();h.tick(300000);assert.deepEqual(bars(h),before);assert.equal(writes.length,0);
 click(h,'pause');assert.equal(h.frames.size,0);assert.equal(writes.length,0);
});

test('target typing, invalid inputs and excluded Enter events remain inert',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,.125'),before=check(h,8,0,.125),writes=watch(h);click(h,'pause');const frames=[...h.frames.keys()];
 h.el('wave-target-x').value='unfinished';h.el('wave-target-x').handlers.input();click(h,'wave-position');
 h.el('wave-time').value='1e';h.el('wave-time').handlers.input();click(h,'wave-time-seek');
 for(const extra of [{repeat:true},{isComposing:true},{keyCode:229},{ctrlKey:true},{altKey:true},{metaKey:true},{shiftKey:true}])h.el('wave-time').handlers.keydown({key:'Enter',preventDefault(){},...extra});
 assert.deepEqual(bars(h),before);assert.equal(writes.length,0);assert.deepEqual([...h.frames.keys()],frames);assert.equal(h.el('status').textContent,'运行中');
});

test('probe keys, exact targets and quarter replay update immediately with unchanged model time',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,0');h.key('ArrowUp');check(h,8,-2);click(h,'wave-left');check(h,6,-2);h.key('Home');check(h);position(h,7.5,-3.25);check(h,7.5,-3.25);
 for(let i=1;i<=4;i++){click(h,'step');check(h,7.5,-3.25,i*Math.PI/6);}for(let i=3;i>=0;i--){click(h,'wave-back');check(h,7.5,-3.25,i*Math.PI/6);}
 seek(h,.125);check(h,7.5,-3.25,.125);click(h,'wave-back');check(h,7.5,-3.25,0);
});

test('parameters, reset, presets and guides refresh the same bars',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,1');
 for(const wavelength of [15,32,70])for(const separation of [20,100,180]){h.el('wavelength').handlers.input({target:{value:String(wavelength)}});h.el('separation').handlers.input({target:{value:String(separation)}});check(h,8,0,1,wavelength,separation);}
 click(h,'reset');check(h,0,0,0,70,180);h.el('preset-select').handlers.change({target:{value:'wide'}});click(h,'load-preset');check(h,0,0,0,65,150);click(h,'guide-start');check(h,8);
});

test('fixed checkpoints, return undo and same-query history keep the correct current observation',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5','#canvas'),url=location.href,saved=check(h,8,12,2.5);position(h,-240,110);seek(h,.125);const edited=check(h,-240,110,.125);
 click(h,'observation-return');assert.deepEqual(bars(h),saved);click(h,'observation-undo');assert.deepEqual(bars(h),edited);assert.equal(location.href,url);
 h.navigate(url.replace('#canvas','#observation-title'));assert.deepEqual(bars(h),edited);h.navigate('?experiment=wave&wavelength=15&separation=20&at=v1,1,2,3');check(h,1,2,3,15,20);
});

test('pending share captures the fixed observation while newer bars and action feedback survive',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5');let resolve;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(r=>resolve=r)}}});
 const pending=click(h,'share'),url=h.el('share-link').value;position(h,-240,110);check(h,-240,110,2.5);const message=h.el('announcement').textContent;resolve();await pending;
 assert.equal(h.el('share-link').value,url);assert.equal(h.el('announcement').textContent,message);check(h,-240,110,2.5);click(h,'observation-return');check(h,8,12,2.5);
});

test('retained worlds, startup recovery and capture requests preserve bar state',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5','',true,1,false),original=check(h,8,12,2.5),writes=watch(h);
 h.setContextReady(true);click(h,'canvas-retry');assert.deepEqual(bars(h),original);assert.equal(writes.length,0);
 for(const name of ['orbit','life','fractal','walk']){click(h,'tab-'+name);click(h,'step');const reading=h.el('metrics').textContent;click(h,'tab-wave');assert.deepEqual(bars(h),original);click(h,'tab-'+name);assert.equal(h.el('metrics').textContent,reading);click(h,'tab-wave');}
 assert.equal(writes.length,0);let captured=false;h.el('canvas').toBlob=cb=>{captured=true;check(h,8,12,2.5);cb(null);};click(h,'save');assert.ok(captured);assert.equal(writes.length,0);
});

test('discovery evidence and intentional Fractal/Walk held batches stay unchanged',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');check(h,8);click(h,'mission-check');click(h,'wave-home');check(h);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;
 position(h,-240,110);seek(h,.125);check(h,-240,110,.125);assert.equal(h.el('notes-text').value,notes);
 for(const [name,end] of [['fractal','500 个点'],['walk','48 步']]){click(h,'tab-'+name);for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional repeat blocked');}});click(h,'step');}assert.ok(h.el('metrics').textContent.includes(end));}
});


test('repeating an explicit same-time action still produces fresh feedback without changing bars',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,.125'),writes=watch(h);h.el('announcement').textContent='Earlier action';seek(h,.125);check(h,8,12,.125);assert.match(h.el('announcement').textContent,/已暂停并回到 t = 0.125/);assert.equal(writes.length,0);
 h.el('announcement').textContent='Another action';seek(h,.125);assert.match(h.el('announcement').textContent,/已暂停并回到 t = 0.125/);assert.equal(writes.length,0);
});
