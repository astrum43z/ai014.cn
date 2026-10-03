import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
import {orbitStep} from '../simulations.js';

const click=(h,id)=>h.el(id).handlers.click();
const choose=(h,value)=>(h.el('preset-select').handlers.change({target:{value}}),click(h,'load-preset'));
const initial=(gravity=80,factor=1)=>({x:75,y:0,vx:0,vy:Math.sqrt(gravity*1000/75)*factor});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
const scale=h=>h.drawing().find(c=>c[0]==='scale')[1];
function strokes(commands){
 const result=[],stack=[];let style={},path=[];
 for(const [name,...args] of commands){
  if(name==='save')stack.push({...style});else if(name==='restore')style=stack.pop();
  else if(['strokeStyle','lineWidth','lineCap','lineJoin'].includes(name))style[name]=args[0];
  else if(name==='setLineDash')style.dash=args[0];
  else if(name==='beginPath')path=[];
  else if(['moveTo','lineTo','closePath'].includes(name))path.push([name,...args]);
  else if(name==='stroke')result.push({style:{...style},path:structuredClone(path)});
 }
 return result;
}
const arrow=h=>strokes(h.drawing()).find(s=>s.style.strokeStyle==='#82d6dd');
const labels=h=>h.drawing().filter(c=>c[0]==='fillText').map(c=>c[1]);
const saved=h=>({drawing:h.drawing(),metrics:h.el('metrics').textContent,reading:h.el('orbit-measured-reading').textContent,radial:h.el('orbit-radial-reading').textContent});
function check(h,body){
 const s=scale(h),a=arrow(h);assert.ok(a,'paused measured-body direction arrow');
 const start=a.path[0].slice(1),end=a.path[1].slice(1),v=Math.hypot(body.vx,body.vy);
 near((start[0]-body.x)*s,12*body.vx/v);near((start[1]-body.y)*s,12*body.vy/v);
 near((end[0]-body.x)*s,34*body.vx/v);near((end[1]-body.y)*s,34*body.vy/v);
 near(Math.hypot(end[0]-start[0],end[1]-start[1])*s,22);
 assert.equal(a.path.length,5);assert.deepEqual(a.style.dash,[]);near(a.style.lineWidth*s,2);
 const planet=h.drawing().find(c=>c[0]==='arc'&&Math.abs(c[3]-4.5/s)<1e-8);near(planet[1],body.x);near(planet[2],body.y);
 assert.match(h.el('orbit-measured-reading').textContent,new RegExp(`距中心 ${Math.hypot(body.x,body.y).toFixed(1)} · 速率 ${v.toFixed(1)}`));
 return a;
}
function advance(h,body,gravity=80,steps=1){for(let n=0;n<steps;n++){click(h,'step');for(let i=0;i<10;i++)orbitStep(body,gravity*1000,.01);}}

test('the initial arrow shows tangential motion while the radial reading remains zero',async()=>{
 const h=await setup('?experiment=orbit'),b=initial(),a=check(h,b);
 assert.equal(a.path[0][1],75);assert.equal(a.path[1][1],75);assert.ok(a.path[1][2]>a.path[0][2]);
 assert.match(h.el('orbit-radial-reading').textContent,/0\.0.*接近 0/);
 assert.match(h.el('orbit-measured-help').textContent,/蓝色箭头表示首颗行星此刻的运动方向，长度不表示速率/);
 assert.ok(labels(h).includes('首颗 · 线量距，箭头仅方向'));assert.ok(labels(h).includes('下一颗 · 10 s 预演'));
 assert.equal(h.frames.size,0);assert.equal(h.el('notes-count').textContent,'0 / 5');
});

test('stepping uses actual velocity through every quadrant and inward/outward elliptic motion',async()=>{
 const h=await setup('?experiment=orbit');choose(h,'elliptic');const b=initial(80,.65),quadrants=new Set();let inward=false,outward=false;
 for(let i=0;i<100;i++){
  advance(h,b);check(h,b);quadrants.add(`${Math.sign(b.vx)},${Math.sign(b.vy)}`);
  const radial=b.x*b.vx+b.y*b.vy;inward||=radial<-1;outward||=radial>1;
 }
 assert.equal(quadrants.size,4);assert.ok(inward&&outward);assert.equal(h.frames.size,0);
});

test('fixed CSS-pixel arrow geometry survives fractional, narrow and fitted views without moving the body',async()=>{
 const h=await setup('?experiment=orbit'),b=initial();advance(h,b,80,19);
 for(let i=0;i<28;i++)click(h,'orbit-right');for(let i=0;i<30;i++)click(h,'orbit-up');
 const metrics=h.el('metrics').textContent,url=location.href,launch=h.el('orbit-touch-reading').textContent;
 for(const [w,height] of [[259,240],[284.5,260.25],[600,414],[1200,560]]){
  h.resize(w,height);check(h,b);h.setDpr(2);check(h,b);h.setDpr(1.25);check(h,b);
  assert.equal(h.el('metrics').textContent,metrics);assert.equal(location.href,url);assert.equal(h.el('orbit-touch-reading').textContent,launch);
 }
});

test('changing the next launch and reaching the body cap never repoints the first-body arrow',async()=>{
 const h=await setup('?experiment=orbit'),b=initial();h.el('gravity').handlers.input({target:{value:'40'}});advance(h,b,40,30);const before=check(h,b);
 h.el('speed').handlers.input({target:{value:'30'}});h.key('ArrowUp');click(h,'orbit-fire');assert.deepEqual(check(h,b),before);
 for(let i=0;i<20;i++)click(h,'orbit-fire');assert.match(h.el('metrics').textContent,/24 颗/);assert.deepEqual(check(h,b),before);assert.ok(labels(h).includes('首颗 · 线量距，箭头仅方向'));
 click(h,'reset');check(h,initial(40));for(let i=0;i<28;i++)click(h,'orbit-left');assert.equal(h.el('orbit-fire').getAttribute('aria-disabled'),'true');check(h,initial(40));
});

test('the paused cue hides while running and resumes at the exact current model velocity',async()=>{
 const h=await setup('?experiment=orbit'),b=initial();check(h,b);click(h,'pause');
 assert.equal(arrow(h),undefined);assert.ok(!labels(h).includes('首颗 · 线量距，箭头仅方向'));assert.match(h.el('orbit-measured-help').textContent,/暂停可显示.*运动方向箭头/);
 const message=h.el('announcement').textContent;h.tick(0);h.tick(50);for(let i=0;i<4;i++)orbitStep(b,80000,.0125);
 assert.equal(arrow(h),undefined);assert.equal(h.frames.size,1);assert.equal(h.el('announcement').textContent,message);
 click(h,'pause');check(h,b);assert.equal(h.frames.size,0);
});

test('an offscreen planet has no clamped direction arrow or misleading direction legend',async()=>{
 const h=await setup('?experiment=orbit');choose(h,'escape');const b=initial(80,1.45);advance(h,b,80,300);
 assert.match(h.el('orbit-measured-reading').textContent,/画外/);assert.equal(arrow(h),undefined);assert.ok(!labels(h).includes('首颗 · 线量距，箭头仅方向'));assert.ok(labels(h).includes('首颗行星 · 当前在画外'));
 const metrics=h.el('metrics').textContent;h.resize(259,240);assert.equal(arrow(h),undefined);assert.equal(h.el('metrics').textContent,metrics);
 click(h,'reset');check(h,initial());
});

test('dark casing and drawing order preserve direction across bright marks, with an explanatory canvas legend',async()=>{
 const h=await setup('?experiment=orbit'),commands=h.drawing(),all=strokes(commands),i=all.findIndex(s=>s.style.strokeStyle==='#82d6dd');
 assert.ok(i>0);assert.deepEqual(all[i-1].path,all[i].path);assert.equal(all[i-1].style.strokeStyle,'#122e29');near(all[i-1].style.lineWidth*scale(h),5);assert.equal(all[i].style.lineCap,'round');assert.equal(all[i].style.lineJoin,'round');
 const motion=commands.findIndex(c=>c[0]==='strokeStyle'&&c[1]==='#82d6dd'),lastPlanet=commands.findLastIndex(c=>c[0]==='arc'&&Math.abs(c[3]-4.5/scale(h))<1e-8),legend=commands.findIndex(c=>c[0]==='fillText'&&c[1]==='首颗 · 线量距，箭头仅方向');
 assert.ok(motion>lastPlanet);assert.ok(legend>commands.findLastIndex(c=>c[0]==='arc'));
 assert.ok(commands.some(c=>c[0]==='fillRect'&&Math.abs(c[3]*scale(h)-196)<1e-8&&Math.abs(c[4]*scale(h)-23)<1e-8),'direction explanation stays inside the existing legend footprint');
});

test('zero, invalid and offscreen velocities draw nothing; valid directions are normalized without mutation',()=>{
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('function drawOrbitVelocity('),source.indexOf('// Keep the measured planet visible'));
 assert.ok(fn.length>0,'direction renderer exists');
 for(const [body,paused,visible,scaleValue,expected] of [
  [{x:0,y:0,vx:0,vy:0},true,true,1,false],[{x:0,y:0,vx:Infinity,vy:1},true,true,1,false],
  [{x:0,y:0,vx:NaN,vy:1},true,true,1,false],[{x:0,y:0,vx:3,vy:4},false,true,1,false],
  [{x:1000,y:1000,vx:3,vy:4},true,false,1,false],[{x:0,y:0,vx:3,vy:4},true,true,0,false],
  [{x:0,y:0,vx:3,vy:4},true,true,1,true],[{x:10,y:-20,vx:3e200,vy:4e200},true,true,.5,true],
  [{x:10,y:-20,vx:3e-200,vy:4e-200},true,true,2,true]
 ]){
  const before={...body},commands=[],ctx=new Proxy({}, {get:(_,name)=>(...args)=>commands.push([name,...args]),set:(_,name,value)=>(commands.push([name,value]),true)});
  const draw=new Function('paused','orbitMeasuredBodyVisible','bodies','ctx',fn+'; return drawOrbitVelocity;')(paused,()=>visible,[body],ctx);draw(scaleValue);
  assert.equal(commands.length>0,expected);assert.deepEqual(body,before);
  if(expected){const a=strokes(commands).at(-1),end=a.path[1];near((end[1]-body.x)*scaleValue,20.4);near((end[2]-body.y)*scaleValue,27.2);}
 }
});

test('redraws, focus, context recovery and visibility retain the same cue without extra announcements',async()=>{
 const h=await setup('?experiment=orbit'),b=initial();advance(h,b,80,15);const before=saved(h),url=location.href,message=h.el('announcement').textContent;
 const el=h.el('orbit-measured-help');let text=el.textContent,writes=0;Object.defineProperty(el,'textContent',{get:()=>text,set:value=>{text=value;writes++;}});
 h.el('step').focus();h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();h.setDpr(2);h.setDpr(1);h.loseContext();h.restoreContext();h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);
 assert.deepEqual(saved(h),before);check(h,b);assert.equal(location.href,url);assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,0);assert.equal(document.activeElement,h.el('step'));assert.equal(writes,0);
});

test('retained worlds and parameter-only sharing preserve motion, while replacement actions refresh it',async()=>{
 const h=await setup('?experiment=orbit'),b=initial();advance(h,b,80,27);const before=saved(h);await click(h,'share');assert.equal(new URL(h.el('share-link').value).searchParams.has('at'),false);
 for(const world of ['life','wave','fractal','walk']){click(h,'tab-'+world);assert.equal(h.el('orbit-measurement').hidden,true);assert.ok(!labels(h).includes('首颗 · 线量距，箭头仅方向'));click(h,'tab-orbit');assert.deepEqual(saved(h),before);check(h,b);}
 h.navigate(location.search+'#observation-title');assert.deepEqual(saved(h),before);
 choose(h,'elliptic');check(h,initial(80,.65));h.navigate('?experiment=orbit&gravity=160&speed=150');check(h,initial(160));click(h,'guide-start');check(h,initial(80));
 assert.equal(h.el('notes-count').textContent,'0 / 5');
});

test('direction cues do not record or alter discovery evidence',async()=>{
 const h=await setup('?experiment=orbit');click(h,'mission-start');click(h,'mission-check');h.el('gravity').handlers.input({target:{value:'40'}});for(let i=0;i<150;i++)click(h,'step');
 assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const notes=h.el('field-notes-list').innerHTML,result=h.el('mission-result').textContent;click(h,'step');h.resize(259,240);click(h,'orbit-fire');
 assert.equal(h.el('field-notes-list').innerHTML,notes);assert.equal(h.el('mission-result').textContent,result);
});


test('the combined legend preserves the old footprint and leaves the mobile 90-step arrow visible',async()=>{
 const h=await setup('?experiment=orbit'),b=initial();advance(h,b,80,90);h.resize(259,240);const a=check(h,b),s=scale(h);
 const ys=a.path.map(([,x,y])=>120+y*s);assert.ok(Math.min(...ys)-2.5>61,'the entire cased arrow stays below the old preview-offset legend');
 const boxes=h.drawing().filter(c=>c[0]==='fillRect'&&Math.abs(c[3]*s-196)<1e-8);assert.equal(boxes.length,1);near(boxes[0][4]*s,23);
 assert.ok(labels(h).includes('首颗 · 线量距，箭头仅方向'));
});
