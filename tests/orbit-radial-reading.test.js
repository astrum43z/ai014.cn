import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as orbit from '../orbit.js';
import {orbitStep} from '../simulations.js';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const reading=h=>h.el('orbit-radial-reading').textContent;
const body=(gravity=80,factor=1)=>({x:75,y:0,vx:0,vy:Math.sqrt(gravity*1000/75)*factor});
const advance=(h,b,gravity=80,steps=1)=>{for(let n=0;n<steps;n++){click(h,'step');for(let i=0;i<10;i++)orbitStep(b,gravity*1000,.01);}};
function check(h,b){
 const r=Math.hypot(b.x,b.y),radial=(b.x*b.vx+b.y*b.vy)/r,rounded=Number(radial.toFixed(1));
 const expected=`距离变化率 ${rounded>0?'+':''}${rounded.toFixed(1)} 模型单位/秒 · ${rounded>0?'此刻远离中心':rounded<0?'此刻靠近中心':'此刻径向变化接近 0'}`;
 assert.equal(reading(h),expected);
 const scale=h.drawing().find(c=>c[0]==='scale')[1],planet=h.drawing().find(c=>c[0]==='arc'&&Math.abs(c[3]-4.5/scale)<1e-8);
 assert.ok(Math.abs(planet[1]-b.x)<1e-9&&Math.abs(planet[2]-b.y)<1e-9,'reading uses the exact simulated first body');
 assert.doesNotMatch(reading(h),/-0\.0|NaN|Infinity|已经逃逸|保持圆轨道|停止运动/);
 assert.match(h.el('orbit-measured-reading').textContent,new RegExp(`距中心 ${r.toFixed(1)} · 速率 ${Math.hypot(b.vx,b.vy).toFixed(1)}`));
 return radial;
}

test('radial projection separates outward, inward and tangential velocities without changing the body',()=>{
 assert.equal(typeof orbit.orbitRadialVelocity,'function');
 for(const [input,expected] of [[{x:3,y:4,vx:3,vy:4},5],[{x:3,y:4,vx:-3,vy:-4},-5],[{x:3,y:4,vx:-4,vy:3},0],[{x:3,y:4,vx:7,vy:-2},2.6],[{x:-3,y:-4,vx:-7,vy:2},2.6],[{x:75,y:0,vx:0,vy:32.7},0]]){
  const original={...input};assert.ok(Math.abs(orbit.orbitRadialVelocity(input)-expected)<1e-12);assert.deepEqual(input,original);
 }
});

test('radial velocity agrees with an independent centered derivative of distance and is rotation invariant',()=>{
 assert.equal(typeof orbit.orbitRadialVelocity,'function');
 for(let i=0;i<24;i++){
  const angle=i*Math.PI/12,c=Math.cos(angle),s=Math.sin(angle),input={x:3*c-4*s,y:3*s+4*c,vx:7*c+2*s,vy:7*s-2*c};
  const h=1e-5,derivative=(Math.hypot(input.x+h*input.vx,input.y+h*input.vy)-Math.hypot(input.x-h*input.vx,input.y-h*input.vy))/(2*h);
  assert.ok(Math.abs(orbit.orbitRadialVelocity(input)-derivative)<1e-8);assert.ok(Math.abs(orbit.orbitRadialVelocity(input)-2.6)<1e-12);
 }
});

test('the center and invalid state are undefined, while close or distant finite positions remain measurable',()=>{
 assert.equal(typeof orbit.orbitRadialVelocity,'function');
 for(const input of [{x:0,y:0,vx:0,vy:0},{x:0,y:0,vx:1,vy:2},{x:Infinity,y:1,vx:1,vy:1},{x:1,y:1,vx:NaN,vy:1}])assert.equal(orbit.orbitRadialVelocity(input),null);
 assert.equal(orbit.orbitRadialVelocity({x:1e-12,y:0,vx:2,vy:3}),2);
 assert.equal(orbit.orbitRadialVelocity({x:1e200,y:0,vx:2,vy:3}),2,'unit-vector projection avoids overflowing the dot product');
});

test('initial tangential motion has zero radial reading despite a nonzero total speed',async()=>{
 const h=await setup('?experiment=orbit'),b=body();assert.equal(check(h,b),0);
 assert.match(h.el('orbit-measured-reading').textContent,/速率 32\.7/);assert.match(reading(h),/0\.0.*接近 0/);
 advance(h,b);check(h,b);assert.equal(h.frames.size,0);
 assert.ok(h.el('announcement').textContent.includes(reading(h)),'explicit Step announces the current radial reading once');
 assert.equal(h.el('announcement').textContent.split('距离变化率').length,2);
});

test('displayed rounding treats both signs symmetrically and does not invent a direction at the center',()=>{
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const renderSource=source.slice(source.indexOf('function renderOrbitMeasurement('),source.indexOf('function drawOrbitMeasurement('));
 for(const [vx,number,trend] of [[-.051,'-0.1','靠近中心'],[-.049,'0.0','径向变化接近 0'],[-0,'0.0','径向变化接近 0'],[.049,'0.0','径向变化接近 0'],[.051,'+0.1','远离中心']]){
  const elements=new Map(),$=key=>{if(!elements.has(key))elements.set(key,{});return elements.get(key);};
  const render=new Function('$','setReadingText','orbitRadialVelocity','bodies','orbitMeasuredBodyVisible','paused',renderSource+'; return renderOrbitMeasurement;')($,(el,text)=>el.textContent=text,orbit.orbitRadialVelocity,[{x:75,y:0,vx,vy:10}],()=>true,true);
  render(75,Math.hypot(vx,10));const text=$('#orbit-radial-reading').textContent;
  assert.equal(text,`距离变化率 ${number} 模型单位/秒 · 此刻${trend}`);assert.doesNotMatch(text,/-0\.0/);
 }
 const elements={},render=new Function('$','setReadingText','orbitRadialVelocity','bodies','orbitMeasuredBodyVisible','paused',renderSource+'; return renderOrbitMeasurement;')(key=>elements[key]??=( {}),(el,text)=>el.textContent=text,orbit.orbitRadialVelocity,[{x:0,y:0,vx:1,vy:2}],()=>true,true);
 render(0,Math.sqrt(5));assert.match(elements['#orbit-radial-reading'].textContent,/暂不可定义/);assert.doesNotMatch(elements['#orbit-radial-reading'].textContent,/0\.0|NaN|Infinity/);
});

test('changing gravity measures the same first body, not the next launch or total speed',async()=>{
 const h=await setup('?experiment=orbit'),b=body();h.el('gravity').handlers.input({target:{value:'40'}});
 check(h,b);advance(h,b,40,80);assert.ok(check(h,b)>1);assert.match(reading(h),/此刻远离中心$/);
 const text=reading(h),url=location.href;click(h,'orbit-fire');h.key('ArrowLeft');h.el('speed').handlers.input({target:{value:'65'}});
 assert.equal(reading(h),text);assert.notEqual(location.href,url,'only the deliberate speed edit rewrites parameters');
 assert.equal(h.el('notes-count').textContent,'0 / 5');
});

test('elliptic motion shows approaching then receding without claiming a circular or escaping orbit',async()=>{
 const h=await setup('?experiment=orbit');h.el('preset-select').handlers.change({target:{value:'elliptic'}});click(h,'load-preset');
 const b=body(80,.65);check(h,b);advance(h,b,80,10);assert.ok(check(h,b)<-1);assert.match(reading(h),/此刻靠近中心$/);
 let outward=false;for(let n=0;n<150;n++){advance(h,b);if(check(h,b)>.1){outward=true;break;}}
 assert.ok(outward,'a periapsis passage changes the instantaneous radial sign');assert.match(reading(h),/此刻远离中心$/);
});

test('a first body outside the canvas retains its radial reading across responsive fitting',async()=>{
 const h=await setup('?experiment=orbit');h.el('preset-select').handlers.change({target:{value:'escape'}});click(h,'load-preset');const b=body(80,1.45);
 advance(h,b,80,300);check(h,b);assert.match(h.el('orbit-measured-reading').textContent,/画外/);
 const before={text:reading(h),metrics:h.el('metrics').textContent,url:location.href};
 for(const size of [[259,240],[284.5,260.25],[2500,414],[600,414]]){h.resize(...size);check(h,b);assert.equal(reading(h),before.text);assert.equal(h.el('metrics').textContent,before.metrics);assert.equal(location.href,before.url);}
 click(h,'reset');check(h,body());
});

test('animation updates quietly, identical redraws retain text and explicit Pause announces one reading',async()=>{
 const h=await setup('?experiment=orbit'),b=body();h.el('gravity').handlers.input({target:{value:'40'}});const el=h.el('orbit-radial-reading');
 let text=el.textContent,writes=0;Object.defineProperty(el,'textContent',{get:()=>text,set:next=>{writes++;text=next;}});
 h.resize(600,414);h.resize(259,240);h.setDpr(2);assert.equal(writes,0);
 click(h,'pause');const message=h.el('announcement').textContent;h.tick(0);h.tick(50);
 for(let i=0;i<4;i++)orbitStep(b,40000,.0125);
 check(h,b);assert.equal(writes,1);assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,1);
 click(h,'pause');assert.equal(h.frames.size,0);assert.equal(writes,1);assert.ok(h.el('announcement').textContent.includes(reading(h)));
 h.resize(600,414);assert.equal(writes,1);
 el.textContent='stale';h.resize(600,414);check(h,b);assert.equal(writes,3,'compare actual text rather than cached state');
});

test('context and visibility interruptions preserve radial state and do not advance a paused body',async()=>{
 const h=await setup('?experiment=orbit'),b=body();advance(h,b,80,35);check(h,b);
 const before={text:reading(h),drawing:h.drawing(),metrics:h.el('metrics').textContent,url:location.href,message:h.el('announcement').textContent};
 h.el('step').focus();h.loseContext();h.resize(259,240);h.setDpr(2);h.restoreContext();h.resize(600,414);h.setDpr(1);
 check(h,b);assert.equal(reading(h),before.text);assert.deepEqual(h.drawing(),before.drawing);assert.equal(h.el('metrics').textContent,before.metrics);assert.equal(location.href,before.url);assert.equal(h.el('announcement').textContent,before.message);assert.equal(document.activeElement,h.el('step'));
 h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);assert.equal(h.frames.size,0);check(h,b);
});

test('running interruptions resume from the same radial state without adding hidden or lost time',async()=>{
 const h=await setup('?experiment=orbit'),b=body();h.el('gravity').handlers.input({target:{value:'40'}});click(h,'pause');h.tick(0);h.tick(50);
 for(let i=0;i<4;i++)orbitStep(b,40000,.0125);check(h,b);
 let now=50;
 for(const [stop,start] of [[()=>h.setHidden(true),()=>h.setHidden(false)],[()=>h.setVisible(false),()=>h.setVisible(true)],[()=>h.loseContext(),()=>h.restoreContext()]]){
  const text=reading(h),metrics=h.el('metrics').textContent;stop();assert.equal(h.frames.size,0);start();assert.equal(h.frames.size,1);
  now+=90000;h.tick(now);check(h,b);assert.equal(reading(h),text);assert.equal(h.el('metrics').textContent,metrics);
  now+=50;h.tick(now);for(let i=0;i<4;i++)orbitStep(b,40000,.0125);check(h,b);
 }
 click(h,'pause');assert.equal(h.frames.size,0);assert.ok(h.el('announcement').textContent.includes(reading(h)));
});

test('tab memory and anchor history retain motion while changed URL settings, presets and guides replace it correctly',async()=>{
 const h=await setup('?experiment=orbit'),b=body();advance(h,b,80,35);const text=reading(h);await click(h,'share');const saved=h.el('share-link').value;
 assert.equal(new URL(saved).searchParams.has('at'),false);
 for(const index of [1,2,3,4]){h.tabs[index].handlers.click();assert.equal(h.el('orbit-measurement').hidden,true);h.tabs[0].handlers.click();assert.equal(h.el('orbit-measurement').hidden,false);check(h,b);assert.equal(reading(h),text);}
 h.navigate(saved+'#observation-title');check(h,b);
 h.navigate('?experiment=orbit&gravity=160&speed=150');check(h,body(160));
 click(h,'guide-start');check(h,body());assert.equal(h.frames.size,0);
});

test('the reading does not record discoveries or rewrite their historical evidence',async()=>{
 const h=await setup('?experiment=orbit'),b=body();click(h,'mission-start');click(h,'mission-check');h.el('gravity').handlers.input({target:{value:'40'}});advance(h,b,40,80);check(h,b);
 assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const note=h.el('field-notes-list').innerHTML,result=h.el('mission-result').textContent;advance(h,b,40);check(h,b);
 assert.equal(h.el('field-notes-list').innerHTML,note);assert.equal(h.el('mission-result').textContent,result);
});

test('near-canvas radial text stays quiet, wraps and explains the distinction without new controls',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const section=html.slice(html.indexOf('<div id="orbit-measurement"'),html.indexOf('<div id="orbit-touch"'));
 assert.match(section,/<p id="orbit-radial-reading" aria-live="off"><\/p>/);
 assert.match(section,/正值为远离，负值为靠近/);assert.match(section,/显示为 0\.0 不代表停住/);assert.match(section,/瞬时趋势也不判断是否逃逸/);
 assert.ok(section.indexOf('id="orbit-measured-reading"')<section.indexOf('id="orbit-radial-reading"'));
 assert.doesNotMatch(section,/button|tabindex|role="status"|aria-live="polite"|aria-live="assertive"/);
 assert.match(css,/\.orbit-measurement p\{[^}]*overflow-wrap:anywhere/);
 assert.match(html,/app\.js\?v=life-inspector-2/);
});
