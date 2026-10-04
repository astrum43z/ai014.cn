import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const position=(h,x,y)=>{for(const [axis,value] of [['x',x],['y',y]])h.el('wave-target-'+axis).value=String(value);click(h,'wave-position');};
const pixels=h=>h.drawing().filter(c=>c[0]==='fillRect'&&c[3]===5&&c[4]===5);
const caption=h=>h.drawing().filter(c=>c[0]==='fillText').map(c=>c[1]);
const hidden=h=>caption(h).includes('色场暂隐 · 条纹过密');
const fixed=h=>[location.href,h.el('share-link').value,h.el('saved-observation-reading').textContent,h.el('observation-undo-status').textContent];

test('an unresolved field omits false stripes and draws a self-contained no-data explanation inside the exported canvas',async()=>{
 const h=await setup('?experiment=wave&wavelength=32&separation=100&at=v1,10000,0,0');
 assert.equal(pixels(h).length,0);
 assert.ok(hidden(h));assert.ok(caption(h).includes('底色不表示位移'));
 assert.equal(h.el('wave-instant-reading').textContent,'探针此刻 (A+B)/2 · 0.00');
 assert.deepEqual(h.probe(),{x:582,y:207,r:9});
 assert.ok(h.drawing().some(c=>c[0]==='fillText'&&c[1]==='2000 模型单位'));
 let captured;
 h.el('canvas').toBlob=callback=>{captured=h.drawing();callback(null);};
 click(h,'save');assert.deepEqual(captured,h.drawing(),'save captures the already annotated canvas without redrawing or changing the experiment');
});

test('the omission uses the same exact CSS sampling boundary as the HTML guidance and returns with Home',async()=>{
 const h=await setup('?experiment=wave&wavelength=32&separation=100');
 for(const [x,expected] of [[902,false],[902.4,true],[903,true],[10000,true],[-10000,true],[0,true]]){
  position(h,x,0);assert.equal(hidden(h),expected,`x ${x}`);assert.equal(pixels(h).length===0,expected);
  assert.equal(h.el('wave-scale-reading').textContent.includes('色场暂隐'),expected);
 }
 click(h,'wave-home');assert.equal(hidden(h),false);assert.equal(pixels(h).length,9960);
});

test('both axes, fractional responsive views and all parameter limits preserve omission and caption geometry',async()=>{
 for(const [x,y] of [[1000,0],[-1000,0],[0,1000],[0,-1000],[10000,-10000]]){
  const h=await setup(`?experiment=wave&at=v1,${x},${y},2.5`);
  for(const [width,height] of [[600,414],[259,240],[233.5,260.75],[767,317.9375]]){
   h.resize(width,height);
   for(const wavelength of [15,32,70]){
    h.el('wavelength').handlers.input({target:{value:String(wavelength)}});
    const scale=Math.min(width/280,height/280,(width/2-18)/Math.max(1,Math.abs(x)),(height/2-18)/Math.max(1,Math.abs(y)));
    const expected=wavelength*scale<=10;
    assert.equal(hidden(h),expected);assert.equal(pixels(h).length===0,expected);
    if(expected)for(const c of h.drawing().filter(c=>c[0]==='fillText'&&/色场暂隐|底色/.test(c[1]))){assert.equal(c[2],16);assert.ok(c[2]+c[4]<=width-16);}
   }
  }
 }
});

test('unresolved animation keeps exact probe readings with no field trigonometry, paths remain paused-only and markers stay on top',async()=>{
 const h=await setup('?experiment=wave&at=v1,10000,0,2.5');
 const commands=h.drawing(),captionEnd=commands.findLastIndex(c=>c[0]==='fillText'&&c[1]==='底色不表示位移');
 assert.ok(commands.findIndex(c=>c[0]==='arc'&&c[3]===9)>captionEnd);
 assert.ok(commands.findIndex(c=>c[0]==='setLineDash'&&c[1]?.[0]===7)>captionEnd);
 click(h,'pause');h.tick(0);const message=h.el('announcement').textContent,sin=Math.sin,hypot=Math.hypot;let sines=0,distances=0;
 try{Math.sin=(...args)=>{sines++;return sin(...args);};Math.hypot=(...args)=>{distances++;return hypot(...args);};for(let i=1;i<=20;i++)h.tick(i*50);}finally{Math.sin=sin;Math.hypot=hypot;}
 assert.equal(sines,40);assert.ok(distances<=240);assert.equal(pixels(h).length,0);assert.ok(hidden(h));
 assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,1);
 assert.ok(!h.drawing().some(c=>c[0]==='setLineDash'&&c[1]?.[0]===7));
 assert.notEqual(h.el('wave-instant-reading').textContent,'探针此刻 (A+B)/2 · 0.00');
});

test('saved return, undo, retained worlds and layout transitions reconstruct the correct rendering without altering fixed observations',async()=>{
 const h=await setup('?experiment=wave&at=v1,600,0,2.5');click(h,'step');click(h,'observation-return');
 const before=fixed(h),message=h.el('announcement').textContent;assert.equal(hidden(h),false);
 h.resize(259,240);assert.ok(hidden(h));assert.deepEqual(fixed(h),before);assert.equal(h.el('announcement').textContent,message);
 h.setDpr(2);h.setDpr(1);assert.ok(hidden(h));h.resize(600,414);assert.equal(hidden(h),false);
 position(h,10000,0);const changed=fixed(h);for(const world of ['life','orbit','fractal','walk']){click(h,'tab-'+world);assert.equal(hidden(h),false);click(h,'tab-wave');assert.ok(hidden(h));assert.deepEqual(fixed(h),changed);}
 click(h,'observation-return');assert.equal(hidden(h),false);click(h,'observation-undo');assert.ok(hidden(h));
 h.navigate('?experiment=wave&at=v1,0,0,2.5');assert.equal(hidden(h),false);
});

test('unavailable layout/context cannot produce stale colors; text-only startup recovers the annotated field',async()=>{
 const h=await setup('?experiment=wave&at=v1,10000,0,2.5');const before=fixed(h);
 for(const [w,z] of [[0,0],[20,20]]){h.resize(w,z);assert.equal(pixels(h).length,0);assert.equal(hidden(h),false);assert.equal(h.el('wave-scale-reading').textContent,'');}
 h.resize(600,414);assert.ok(hidden(h));h.loseContext();h.restoreContext();assert.ok(hidden(h));assert.deepEqual(fixed(h),before);
 const unavailable=await setup('?experiment=wave&at=v1,10000,0,2.5','',true,1,false);assert.equal(hidden(unavailable),false);
 unavailable.setContextReady(true);click(unavailable,'canvas-retry');assert.ok(hidden(unavailable));assert.equal(pixels(unavailable).length,0);
});

test('time and parameter changes while hidden cannot revive stale colors when a resolved view returns',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,0');const initial=pixels(h).length;position(h,10000,0);
 h.el('wave-time').value='7.125';click(h,'wave-time-seek');h.el('separation').handlers.input({target:{value:'180'}});h.el('wavelength').handlers.input({target:{value:'70'}});
 assert.ok(hidden(h));click(h,'wave-home');assert.equal(hidden(h),false);assert.equal(pixels(h).length,initial);
 // Independent expression and color arithmetic, including a point where the
 // time, wavelength and source changes all matter. No cached sampler as oracle.
 const expected=[];let color;
 for(let y=0;y<414;y+=5)for(let x=0;x<600;x+=5){const mx=(x-300)/(414/280),my=(y-207)/(414/280),v=(Math.sin(Math.hypot(mx-90,my)*2*Math.PI/70-7.125*3)+Math.sin(Math.hypot(mx+90,my)*2*Math.PI/70-7.125*3))/2,a=Math.abs(v);expected.push([x,y,v>0?`rgb(${18+a*175},${46+a*177},${41+a*55})`:`rgb(${18+a*56},${46+a*107},${41+a*112})`]);}
 const actual=[];for(const c of h.drawing()){if(c[0]==='fillStyle')color=c[1];if(c[0]==='fillRect'&&c[3]===5&&c[4]===5)actual.push([c[1],c[2],color]);}
 // The expression's operation order may differ by floating-point roundoff;
 // compare channel values rather than forcing identical decimal spellings.
 assert.equal(actual.length,expected.length);
 actual.forEach((entry,i)=>{assert.deepEqual(entry.slice(0,2),expected[i].slice(0,2));const numbers=s=>s.match(/[\d.]+/g).map(Number);numbers(entry[2]).forEach((v,j)=>assert.ok(Math.abs(v-numbers(expected[i][2])[j])<1e-10));});
 assert.equal(h.el('wave-time-current').textContent,'当前时刻 · t 7.125 模型秒');
});

test('the caption stays opposite the probe and clear of both measuring paths and the ruler at supported canvas sizes',async()=>{
 for(const [x,y] of [[-10000,-6702],[10000,-10000],[0,-10000],[-10000,10000],[10000,0],[0,10000]]){
  const h=await setup(`?experiment=wave&at=v1,${x},${y},0`);
  for(const [width,height] of [[600,414],[259,240],[233.5,260.75],[767,317.9375]]){
   h.resize(width,height);assert.ok(hidden(h));
   const labels=h.drawing().filter(c=>c[0]==='fillText'&&/色场暂隐|底色/.test(c[1]));assert.equal(labels.length,2);
   for(const c of labels){
    if(y<0){assert.ok(c[3]-12>height/2+4,'all text pixels below source row and paths');assert.ok(c[3]+4<height-56,'caption above ruler');}
    else assert.ok(c[3]+4<height/2-4,'caption above both paths');
   }
  }
 }
});
