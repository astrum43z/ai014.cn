import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
import {orbitLaunchState} from '../orbit.js';
import {orbitStep} from '../simulations.js';

const click=(h,id)=>h.el(id).handlers.click();
const set=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const reading=h=>h.el('orbit-escape-reading').textContent;
const expected=(gravity,radius,percent)=>`下一次发射 · 逃逸参考 ${Math.sqrt(2*gravity*1000/radius).toFixed(1)} 模型单位/秒 · 当前 ${percent}% ${percent*percent<20000?'低于':'高于'}参考`;
const choose=(h,value)=>(h.el('preset-select').handlers.change({target:{value}}),click(h,'load-preset'));
const planets=h=>{const scale=h.drawing().find(c=>c[0]==='scale')[1];return h.drawing().filter(c=>c[0]==='arc'&&Math.abs(c[3]-4.5/scale)<1e-8).map(([,x,y])=>({x,y}));};
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
function renderOnly(point,values){
 const elements=new Map(),$=selector=>{if(!elements.has(selector))elements.set(selector,{textContent:'',setAttribute(){}});return elements.get(selector);};
 const attributeSource=source.slice(source.indexOf('function setControlAttribute('),source.indexOf('function renderProgressControls('));
 const renderSource=attributeSource+source.slice(source.indexOf('function renderOrbitLaunch('),source.indexOf('function launchOrbit('));
 const render=new Function('$','setReadingText','orbitLaunchState','orbitPoint','values','orbitPrediction','bodies','paused','orbitCanRecall',renderSource+'; return renderOrbitLaunch;')($,(el,text)=>el.textContent=text,orbitLaunchState,point,values,()=>null,[],true,()=>false);
 return {render,reading:()=>$('#orbit-escape-reading').textContent};
}

test('the next launch compares its speed with a radius-specific escape reference',async()=>{
 const h=await setup('?experiment=orbit');assert.equal(reading(h),expected(80,140,100));
 assert.match(h.el('orbit-speed').textContent,/23\.9.*23\.9 × 100%/);
 assert.match(h.el('orbit-measured-reading').textContent,/距中心 75\.0.*速率 32\.7/);
 click(h,'step');assert.equal(reading(h),expected(80,140,100));
 assert.ok(h.el('announcement').textContent.includes(reading(h)));
 assert.equal(h.el('announcement').textContent.split('逃逸参考').length,2);
});

test('every supported gravity and launch percentage agrees with an independent energy threshold',()=>{
 const point={x:140,y:0},values={gravity:80,speed:100},h=renderOnly(point,values);
 for(const radius of [22,75,140,360]){
  point.x=radius;
  for(let gravity=30;gravity<=160;gravity++)for(let speed=30;speed<=150;speed++){
   values.gravity=gravity;values.speed=speed;h.render();assert.equal(h.reading(),expected(gravity,radius,speed));
  }
 }
 point.x=84;point.y=112;h.render();assert.equal(h.reading(),expected(160,140,150));assert.equal(point.x,84);assert.equal(point.y,112);
});

test('unavailable central placement never applies the unsoftened escape formula inside the core',async()=>{
 const point={x:0,y:0},h=renderOnly(point,{gravity:80,speed:150});
 for(const radius of [0,1,17.99,18,21.99]){point.x=radius;h.render();assert.equal(h.reading(),'下一次发射 · 移到有效发射位置后显示逃逸参考');assert.doesNotMatch(h.reading(),/NaN|Infinity|高于|低于/);}
 point.x=22;h.render();assert.equal(h.reading(),expected(80,22,150));
 const app=await setup('?experiment=orbit');for(let i=0;i<28;i++)click(app,'orbit-left');
 assert.match(reading(app),/移到有效发射位置/);assert.equal(app.el('orbit-fire').getAttribute('aria-disabled'),'true');
 for(let i=0;i<5;i++)click(app,'orbit-right');assert.equal(reading(app),expected(80,25,100));
});

test('speed 141 and 142 lie on opposite sides without changing existing planets',async()=>{
 const h=await setup('?experiment=orbit'),before=planets(h),metrics=h.el('metrics').textContent;
 for(const speed of [30,100,141,142,150]){set(h,'speed',speed);assert.equal(reading(h),expected(80,140,speed));assert.deepEqual(planets(h),before);assert.equal(h.el('metrics').textContent,metrics);}
 set(h,'gravity',30);assert.equal(reading(h),expected(30,140,150));assert.deepEqual(planets(h),before);
 click(h,'orbit-left');assert.equal(reading(h),expected(30,135,150));assert.deepEqual(planets(h),before);
 click(h,'orbit-up');assert.equal(reading(h),expected(30,Math.hypot(135,5),150));
 click(h,'orbit-home');assert.equal(reading(h),expected(30,140,150));
});

test('presets, guide and the planet cap keep the reference scoped to the next launch',async()=>{
 const h=await setup('?experiment=orbit');choose(h,'escape');assert.equal(reading(h),expected(80,140,100));
 assert.match(h.el('orbit-measured-reading').textContent,/速率 47\.4/);
 set(h,'speed',150);for(let i=0;i<21;i++)click(h,'orbit-fire');assert.match(h.el('metrics').textContent,/24 颗/);assert.equal(reading(h),expected(80,140,150));
 click(h,'orbit-fire');assert.match(h.el('metrics').textContent,/24 颗/);assert.equal(h.el('orbit-fire').getAttribute('aria-disabled'),'true');
 click(h,'reset');assert.match(h.el('metrics').textContent,/3 颗/);assert.equal(reading(h),expected(80,140,150));
 click(h,'guide-start');assert.equal(reading(h),expected(80,140,100));assert.equal(h.frames.size,0);
});

test('reference drawing is quiet and stable through resizing, density, recovery and retained worlds',async()=>{
 const h=await setup('?experiment=orbit&gravity=120&speed=142');click(h,'orbit-left');const text=reading(h),url=location.href,metrics=h.el('metrics').textContent,el=h.el('orbit-escape-reading');
 let current=el.textContent,writes=0;Object.defineProperty(el,'textContent',{get:()=>current,set:next=>{current=next;writes++;}});
 h.el('canvas').focus();const message=h.el('announcement').textContent;
 for(const size of [[259,240],[1200,414],[600,414]])h.resize(...size);
 h.setDpr(2);h.loseContext();h.restoreContext();
 assert.equal(reading(h),text);assert.equal(writes,0);assert.equal(h.el('metrics').textContent,metrics);assert.equal(location.href,url);assert.equal(h.el('announcement').textContent,message);assert.equal(document.activeElement,h.el('canvas'));
 for(const mode of ['life','wave','fractal','walk']){click(h,'tab-'+mode);assert.equal(h.el('orbit-launch').hidden,true);click(h,'tab-orbit');assert.equal(h.el('orbit-launch').hidden,false);assert.equal(reading(h),text);}
 assert.equal(writes,0);assert.equal(h.frames.size,0);
 el.textContent='stale';h.resize(600,414);assert.equal(reading(h),text);assert.equal(writes,2);
});

test('animation does not rewrite or announce the unchanged reference and explicit pause includes it once',async()=>{
 const h=await setup('?experiment=orbit&speed=150','',false),el=h.el('orbit-escape-reading');assert.equal(reading(h),expected(80,140,150));
 let current=el.textContent,writes=0;Object.defineProperty(el,'textContent',{get:()=>current,set:next=>{current=next;writes++;}});
 const message=h.el('announcement').textContent;h.tick(0);for(let i=1;i<=8;i++)h.tick(i*50);
 assert.equal(writes,0);assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,1);
 click(h,'pause');assert.equal(writes,0);assert.equal(h.frames.size,0);assert.ok(h.el('announcement').textContent.includes(reading(h)));assert.equal(h.el('announcement').textContent.split('逃逸参考').length,2);
});

test('shared parameters restore their existing default launch position without implying orbit sharing',async()=>{
 const h=await setup('?experiment=orbit&gravity=40&speed=142');click(h,'orbit-left');assert.equal(reading(h),expected(40,135,142));
 await click(h,'share');assert.equal(reading(h),expected(40,135,142));const shared=h.el('share-link').value;
 assert.ok(shared.includes('speed=142'));assert.ok(!shared.includes('at='));
 h.navigate('?experiment=life');h.navigate(shared);assert.equal(reading(h),expected(40,140,142));assert.match(h.el('share-note').textContent,/不含画布图案、轨道或进度/);
});

test('the reference never changes launch velocities or subsequent numerical integration',async()=>{
 const h=await setup('?experiment=orbit&gravity=30&speed=150');click(h,'orbit-fire');assert.equal(reading(h),expected(30,140,150));
 const body={x:140,y:0,vx:0,vy:1.5*Math.sqrt(30000/140)};
 for(let n=0;n<20;n++){click(h,'step');for(let i=0;i<10;i++)orbitStep(body,30000,.01);assert.deepEqual(planets(h).at(-1),{x:body.x,y:body.y});}
 assert.equal(reading(h),expected(30,140,150));assert.equal(h.el('notes-count').textContent,'0 / 5');
});

test('the existing gravity discovery requires its measured evidence and retains the earned note',async()=>{
 const h=await setup('?experiment=orbit');click(h,'mission-start');click(h,'mission-check');set(h,'speed',142);assert.equal(reading(h),expected(80,140,142));
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'0 / 5');set(h,'speed',100);set(h,'gravity',40);
 for(let i=0;i<80;i++)click(h,'step');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const notes=h.el('field-notes-list').innerHTML;assert.ok(notes.length>0);set(h,'speed',141);assert.equal(reading(h),expected(40,140,141));assert.equal(h.el('field-notes-list').innerHTML,notes);click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
});

test('the quiet reference stays in the existing launch instrument with scope and approximation explained',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const section=html.slice(html.indexOf('<section id="orbit-launch"'),html.indexOf('</section>',html.indexOf('<section id="orbit-launch"')));
 assert.match(section,/<p id="orbit-escape-reading" aria-live="off" aria-describedby="orbit-escape-help"><\/p>/);
 assert.match(section,/id="orbit-escape-help"/);assert.match(section,/引力保持不变/);assert.match(section,/√2，对应速度滑块约 141\.4%/);assert.match(section,/只针对橙色标记的新发射/);assert.match(section,/不判断已有行星/);assert.match(section,/数值模拟存在近似/);
 assert.doesNotMatch(section,/tabindex|role="status"|aria-live="polite"/);
 assert.match(html,/src="app\.js\?v=saved-observation-copy-1&amp;preview-launcher=clear-1&amp;orbit-legend=compact-1&amp;vertex-label=inset-1&amp;walk-distance=contrast-1&amp;fractal-path=append-once-1&amp;legend-endpoint=clear-1&amp;walk-reference=contrast-1&amp;launcher=contrast-1&amp;orbit-target=exact-1&amp;walk-text=stable-1&amp;fractal-text=stable-1&amp;preview-caption=clear-1&amp;trial-text=stable-1&amp;cell-position=exact-1&amp;repeat=stable-evidence-1&amp;feedback=parameter-action-1&amp;drag-feedback=meaningful-action-1&amp;render=positive-scale-1&amp;orbit-marker=contrast-1&amp;cell-history=explain-1&amp;change-browse=1&amp;wave=quarter-rewind-1&amp;probe=usable-view-1&amp;launch=usable-view-1&amp;browse=living-cells-1&amp;seek=exact-count-1&amp;home=exact-orbit-1&amp;position=exact-wave-1&amp;replay=exact-walk-1&amp;target-reading=1&amp;checkpoint-reading=1&amp;time=exact-wave-1&amp;number=cn-target-glyphs-1&amp;fractal-limit=rewind-guidance-1&amp;canvas-pointer=loss-safe-1&amp;population=shared-1&amp;gap=count-once-1&amp;availability=quiet-1&amp;walk=read-once-1&amp;life=record-once-1&amp;history=read-once-1&amp;colors=wave-once-1&amp;orbit-fit=first-body-1&amp;canvas-start=retry-1&amp;sampling=wave-field-fallback-1"/);
});
