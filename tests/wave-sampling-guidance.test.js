import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const warning='当前视图条纹过密，色场暂隐以避免假条纹，底色不表示位移；请以探针读数为准，可试试“探针回中央”恢复近景。';
const click=(h,id)=>h.el(id).handlers.click();
const reading=h=>h.el('wave-scale-reading').textContent;
const warned=h=>reading(h).includes(warning);
const position=(h,x,y)=>{for(const [axis,value] of [['x',x],['y',y]])h.el('wave-target-'+axis).value=String(value);click(h,'wave-position');};
const observation=h=>({time:h.el('wave-time-current').textContent,position:h.el('wave-position-current').textContent,instant:h.el('wave-instant-reading').textContent,envelope:h.el('wave-envelope').textContent,paths:h.el('wave-difference').textContent,notes:h.el('field-notes-list').innerHTML,url:location.href,link:h.el('share-link').value,summary:h.el('saved-observation-reading').textContent,undo:h.el('observation-undo-status').textContent});
// Independent point-wave expression; the probe is not a color-grid lookup.
const displacement=(x,y,t,w=32,s=100)=>(Math.sin(Math.hypot(x+s/2,y)*2*Math.PI/w-t*3)+Math.sin(Math.hypot(x-s/2,y)*2*Math.PI/w-t*3))/2;

// In the baseline, a distant fitted view shows impressive false coarse bands
// but the only nearby guidance says the parameters and probe are unchanged.
test('a distant exact probe warns of false stripes while retaining the ruler and exact numerical measurement',async()=>{
 const h=await setup('?experiment=wave&wavelength=32&separation=100&at=v1,10000,0,0');
 const scale=282/10000,pixelX=300+10000*scale,pixelY=207;
 const sampleX=(Math.floor(pixelX/5)*5-300)/scale,sampleY=(Math.floor(pixelY/5)*5-207)/scale;
 assert.ok(32*scale<5,'the wavelength is smaller than one rendered sample');
 assert.ok(Math.abs(displacement(sampleX,sampleY,0)-displacement(10000,0,0))>.8,'sampled background and precise probe really disagree');
 assert.equal(h.el('wave-instant-reading').textContent,'探针此刻 (A+B)/2 · 0.00');
 assert.equal(h.el('wave-position-current').textContent,'当前探针 · x 10000，y 0');
 assert.match(reading(h),/^左下标尺：2000 模型单位；视图缩放不改变实验参数与探针位置。/);
 assert.ok(warned(h));
});

test('the sampling boundary follows CSS-space wavelength, including exactly two color samples',async()=>{
 const h=await setup('?experiment=wave&wavelength=32&separation=100');
 for(const [x,expected] of [[902,false],[902.4,true],[903,true],[10000,true],[-10000,true],[0,true]]){
  position(h,x,0);assert.equal(warned(h),expected,`x ${x}`);
 }
 assert.equal(h.el('wave-position-current').textContent,'当前探针 · x 0，y 0');
 assert.ok(warned(h),'exact coordinates retain the expanded view; only the existing Home action resets it');
 click(h,'wave-home');assert.equal(warned(h),false);
});

test('either fitted axis and every wavelength use the actual view scale',async()=>{
 for(const [x,y] of [[1000,0],[-1000,0],[0,1000],[0,-1000],[10000,-10000]]){
  const h=await setup(`?experiment=wave&at=v1,${x},${y},2.5`);
  for(const [width,height] of [[600,414],[259,240],[233.5,260.75],[767,317.9375]]){
   h.resize(width,height);
   for(const wavelength of [15,32,70]){
    h.el('wavelength').handlers.input({target:{value:String(wavelength)}});
    const scale=Math.min(width/280,height/280,(width/2-18)/Math.max(1,Math.abs(x)),(height/2-18)/Math.max(1,Math.abs(y)));
    assert.equal(warned(h),wavelength*scale<=10,`${x},${y},${width},${height},${wavelength}`);
   }
  }
 }
});

test('the existing center action restores the ordinary view without rewinding or changing source parameters',async()=>{
 const h=await setup('?experiment=wave&wavelength=32&separation=100&at=v1,10000,0,2.5');assert.ok(warned(h));
 click(h,'wave-home');assert.equal(warned(h),false);assert.equal(h.el('wave-time-current').textContent,'当前时刻 · t 2.5 模型秒');
 assert.equal(h.el('wave-position-current').textContent,'当前探针 · x 0，y 0');assert.equal(h.el('wavelength').value,'32');assert.equal(h.el('separation').value,'100');
assert.equal(h.frames.size,0);
});

test('resize, density and redraw warning updates preserve model, recovery, fixed link and announcement',async()=>{
 const h=await setup('?experiment=wave&at=v1,600,0,2.5');click(h,'step');click(h,'observation-return');
 const before=observation(h),message=h.el('announcement').textContent;assert.equal(warned(h),false);
 h.resize(259,240);assert.ok(warned(h));assert.deepEqual(observation(h),before);assert.equal(h.el('announcement').textContent,message);
 h.setDpr(2);assert.ok(warned(h));assert.deepEqual(observation(h),before);
 h.resize(600,414);h.setDpr(1);assert.equal(warned(h),false);assert.deepEqual(observation(h),before);
});

test('animation, quarter stepping and paused redraws do not rewrite or announce unchanged guidance',async()=>{
 const h=await setup('?experiment=wave&at=v1,10000,0,2.5');const element=h.el('wave-scale-reading');let text=element.textContent,writes=0;
 Object.defineProperty(element,'textContent',{configurable:true,get:()=>text,set:value=>{writes++;text=value;}});
 for(let i=0;i<20;i++)h.resize(600,414);click(h,'step');click(h,'wave-back');assert.equal(writes,0);
 click(h,'pause');const message=h.el('announcement').textContent;h.tick(0);for(let i=1;i<=20;i++)h.tick(i*50);
 assert.ok(warned(h));assert.equal(writes,0);assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,1);
 click(h,'pause');element.textContent='stale';writes=0;h.resize(600,414);assert.ok(warned(h));assert.equal(writes,1);
});

test('saved return, undo, world retention and address replacement restore the corresponding warning',async()=>{
 const h=await setup('?experiment=wave&at=v1,10000,0,2.5');const link=location.href;assert.ok(warned(h));
 click(h,'wave-home');click(h,'observation-return');assert.ok(warned(h));click(h,'observation-undo');assert.equal(warned(h),false);
 position(h,10000,0);const before=observation(h);
 for(const world of ['life','orbit','walk','fractal']){click(h,'tab-'+world);assert.equal(h.el('wave-key').hidden,true);click(h,'tab-wave');assert.ok(warned(h));assert.deepEqual(observation(h),before);}
 h.navigate('?experiment=wave&at=v1,0,0,2.5');assert.equal(warned(h),false);h.navigate(link);assert.ok(warned(h));
 click(h,'reset');assert.equal(warned(h),false);
});

test('unavailable geometry and text-only startup show no stale view-specific guidance',async()=>{
 const h=await setup('?experiment=wave&at=v1,10000,0,2.5');const before=observation(h);
 h.resize(0,0);assert.equal(reading(h),'');assert.deepEqual(observation(h),before);
 h.resize(20,20);assert.equal(reading(h),'');h.resize(600,414);assert.ok(warned(h));
 h.loseContext();h.restoreContext();assert.ok(warned(h));assert.deepEqual(observation(h),before);
 const unavailable=await setup('?experiment=wave&at=v1,10000,0,2.5','',true,1,false);assert.equal(reading(unavailable),'');
 unavailable.setContextReady(true);click(unavailable,'canvas-retry');assert.ok(warned(unavailable));
});

test('invalid target input and explicit discovery checks retain their existing effects',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');click(h,'mission-check');click(h,'wave-home');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 position(h,10000,0);const before=observation(h);position(h,'invalid',0);assert.deepEqual(observation(h),before);assert.ok(warned(h));
 click(h,'tab-fractal');for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('batch repeat suppressed');}});click(h,'step');}assert.match(h.el('metrics').textContent,/500 个点/);
 click(h,'tab-walk');h.key('ArrowRight');h.key('ArrowRight',{repeat:true});assert.match(h.el('metrics').textContent,/48 步/);
});

test('guidance uses the existing quiet wrapping scale reading with no new control or live region',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<small id="wave-scale-reading" aria-live="off"><\/small>/);
 assert.match(css,/\.wave-key\{[^}]*overflow-wrap:anywhere/);
 assert.match(html,/<script type="module" src="app\.js\?[^"]*&amp;sampling=wave-field-fallback-1&amp;nudge=single-enter-1&amp;walk-batch=reverse-1&amp;fractal-batch=reverse-1&amp;cycle=disclosure-1&amp;coordinate-draft=current-1&amp;life-draft=current-1&amp;bar-drawer=idle-1&amp;time-draft=current-1&amp;count-draft=current-1&amp;life-batch=recorded-1&amp;life-forward=recorded-1&amp;preview-fit=whole-path-1"/);
 assert.doesNotMatch(html,/<link rel="stylesheet"[^>]*sampling=/);
});
