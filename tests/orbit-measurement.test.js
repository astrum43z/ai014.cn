import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
import {orbitStep} from '../simulations.js';

const click=(h,id)=>h.el(id).handlers.click();
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
const scale=h=>h.drawing().find(command=>command[0]==='scale')[1];
const reading=h=>h.el('orbit-measured-reading').textContent;
const help=h=>h.el('orbit-measured-help').textContent;
const planets=h=>h.drawing().filter(c=>c[0]==='arc'&&Math.abs(c[3]-4.5/scale(h))<1e-8).map(([,x,y])=>({x,y}));
const labels=h=>h.drawing().filter(c=>c[0]==='fillText').map(c=>c[1]);
function measurementPaths(h){
 let path=[],color,stack=[];const found=[];
 for(const [name,...args] of h.drawing()){
  if(name==='save')stack.push(color);if(name==='restore')color=stack.pop();
  if(name==='strokeStyle')color=args[0];if(name==='beginPath')path=[];
  if(['moveTo','lineTo','closePath'].includes(name))path.push([name,...args]);
  if(name==='stroke'&&color==='#e7eee1')found.push(path);
 }
 return found;
}
function check(h,body){
 const radius=Math.hypot(body.x,body.y),speed=Math.hypot(body.vx,body.vy);
 assert.match(reading(h),new RegExp(`^首颗行星 · 距中心 ${radius.toFixed(1)} · 速率 ${speed.toFixed(1)}`));
 assert.equal(h.el('observation-a').textContent,'首颗行星距离 · '+radius.toFixed(1));
 assert.equal(h.el('observation-b').textContent,'首颗行星速率 · '+speed.toFixed(1));
 near(planets(h)[0].x,body.x);near(planets(h)[0].y,body.y);
}
function expectedBody(gravity=80,factor=1){return {x:75,y:0,vx:0,vy:Math.sqrt(gravity*1000/75)*factor};}

test('the first planet gets a non-color marker and exact radial measurement beside the canvas',async()=>{
 const h=await setup('?experiment=orbit'),body=expectedBody();check(h,body);
 assert.equal(reading(h),'首颗行星 · 距中心 75.0 · 速率 32.7');
 assert.match(help(h),/白色菱形.*白色实线.*模型单位.*橙色空心圆/);
 const size=9/scale(h),paths=measurementPaths(h);
 assert.deepEqual(paths[0],[['moveTo',12,0],['lineTo',75-size,0]]);
 assert.deepEqual(paths[1],[['moveTo',75,-size],['lineTo',75+size,0],['lineTo',75,size],['lineTo',75-size,0],['closePath']]);
 assert.ok(labels(h).includes('首颗行星 · 实线量距离'));assert.ok(labels(h).includes('下一颗 · 10 s 预演'));
 assert.equal(h.el('orbit-measurement').hidden,false);assert.equal(h.frames.size,0);
 const commands=h.drawing(),legend=commands.findIndex(c=>c[0]==='fillText'&&c[1]==='首颗行星 · 实线量距离');
 assert.ok(legend>commands.findLastIndex(c=>c[0]==='arc'),'legend is above planet trails and launch marker');
});

test('measuring follows the same first body through weakened gravity and added planets',async()=>{
 const h=await setup('?experiment=orbit'),body=expectedBody();
 h.el('gravity').handlers.input({target:{value:'40'}});check(h,body);
 for(let step=0;step<80;step++){
  click(h,'step');for(let i=0;i<10;i++)orbitStep(body,40000,.01);
 }
 check(h,body);assert.ok(Math.hypot(body.x,body.y)>100);
 const measured=reading(h),before=planets(h);click(h,'orbit-fire');
 assert.equal(reading(h),measured);assert.deepEqual(planets(h).slice(0,3),before);
 h.el('speed').handlers.input({target:{value:'65'}});assert.equal(reading(h),measured);
 assert.notEqual(reading(h),h.el('orbit-touch-reading').textContent,'existing-body reading does not become the next-launch preview');
 const [line,diamond]=measurementPaths(h),r=Math.hypot(body.x,body.y),size=9/scale(h);
 near(line[0][1],body.x/r*12);near(line[1][1],body.x-body.x/r*size);near(line[1][2],body.y-body.y/r*size);
 near(diamond[0][1],body.x);near(diamond[0][2],body.y-size);
});

test('animation keeps the identity marker and quiet readings but hides the radial measuring line',async()=>{
 const h=await setup('?experiment=orbit'),el=h.el('orbit-measured-reading');
 let value=el.textContent,writes=0;Object.defineProperty(el,'textContent',{get:()=>value,set:next=>{writes++;value=next;}});
 h.resize(600,414);h.resize(259,240);assert.equal(writes,0);
 click(h,'pause');assert.equal(measurementPaths(h).length,2,'only planet diamond and legend diamond remain');
 assert.match(help(h),/暂停可显示/);assert.ok(labels(h).includes('首颗行星'));
 const message=h.el('announcement').textContent;h.tick(0);h.tick(50);
 assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,1);
 assert.notDeepEqual(planets(h)[0],{x:75,y:0});assert.equal(writes,0,'rounded equal readings retain their text nodes');
 click(h,'pause');assert.equal(measurementPaths(h).length,3);assert.equal(h.frames.size,0);
 assert.match(h.el('announcement').textContent,/首颗行星距离.*首颗行星速率/);
});

test('the first body can leave the view without being clamped, relabeled or claimed to escape',async()=>{
 const h=await setup('?experiment=orbit');h.el('preset-select').handlers.change({target:{value:'escape'}});click(h,'load-preset');
 const body=expectedBody(80,1.45);
 for(let n=0;n<300;n++){click(h,'step');for(let i=0;i<10;i++)orbitStep(body,80000,.01);}
 check(h,body);assert.match(reading(h),/（当前在画外）$/);assert.match(help(h),/画外仍继续计算，离开画面不代表逃逸/);
 assert.ok(labels(h).includes('首颗行星 · 当前在画外'));
 assert.equal(measurementPaths(h).filter(path=>path.at(-1)?.[0]==='closePath').length,1,'only legend diamond remains, never an edge-clamped body');
 const before=planets(h),metrics=h.el('metrics').textContent,url=location.href;
 h.resize(259,240);assert.deepEqual(planets(h),before);assert.equal(h.el('metrics').textContent,metrics);assert.equal(location.href,url);
 h.resize(2500,414);check(h,body);
 click(h,'reset');check(h,expectedBody());assert.doesNotMatch(reading(h),/画外/);
});

test('resizes fit marker size to pixels without changing body measurements or the selected view',async()=>{
 const h=await setup('?experiment=orbit');for(let i=0;i<28;i++)click(h,'orbit-right');for(let i=0;i<30;i++)click(h,'orbit-up');
 const before={reading:reading(h),launch:h.el('orbit-touch-reading').textContent,planets:planets(h),url:location.href,metrics:h.el('metrics').textContent};
 for(const [width,height] of [[259,240],[600,240],[284.5,260.25],[600,414]]){
  h.resize(width,height);assert.equal(reading(h),before.reading);assert.equal(h.el('orbit-touch-reading').textContent,before.launch);
  assert.deepEqual(planets(h),before.planets);assert.equal(location.href,before.url);assert.equal(h.el('metrics').textContent,before.metrics);
  const diamond=measurementPaths(h)[1];near((diamond[1][1]-75)*scale(h),9);near(-diamond[0][2]*scale(h),9);
 }
});

test('retained worlds, parameter-only links, presets and reduced motion keep measurements current',async()=>{
 const h=await setup('?experiment=orbit');click(h,'step');const before={reading:reading(h),draw:h.drawing()};
 await click(h,'share');const shared=h.el('share-link').value;assert.equal(new URL(shared).searchParams.has('at'),false);
 for(const index of [1,2,3,4]){h.tabs[index].handlers.click();assert.equal(h.el('orbit-measurement').hidden,true);assert.equal(labels(h).includes('首颗行星 · 实线量距离'),false);h.tabs[0].handlers.click();assert.equal(h.el('orbit-measurement').hidden,false);assert.equal(reading(h),before.reading);assert.deepEqual(h.drawing(),before.draw);}
 h.el('preset-select').handlers.change({target:{value:'elliptic'}});click(h,'load-preset');check(h,expectedBody(80,.65));
 h.navigate('?experiment=orbit&gravity=160&speed=150');check(h,expectedBody(160));
 click(h,'pause');assert.equal(h.frames.size,1);h.motion.change({matches:true});assert.equal(h.frames.size,0);assert.match(help(h),/白色实线/);
 h.motion.change({matches:false});assert.equal(h.frames.size,0);
});

test('invalid launch positions and the planet cap do not hide the existing measured planet',async()=>{
 const h=await setup('?experiment=orbit');for(let i=0;i<28;i++)click(h,'orbit-left');
 assert.equal(h.el('orbit-fire').getAttribute('aria-disabled'),'true');assert.equal(h.el('orbit-preview-reading').hidden,true);
 check(h,expectedBody());assert.ok(labels(h).includes('首颗行星 · 实线量距离'));
 click(h,'orbit-home');for(let i=0;i<21;i++)click(h,'orbit-fire');
 assert.match(h.el('metrics').textContent,/24 颗/);check(h,expectedBody());assert.equal(measurementPaths(h).length,3);
 assert.equal(h.el('orbit-preview-reading').hidden,true);assert.ok(labels(h).includes('首颗行星 · 实线量距离'));
});

test('visible measurement never completes a discovery or rewrites a recorded finding',async()=>{
 const h=await setup('?experiment=orbit');click(h,'mission-start');click(h,'mission-check');
 h.el('gravity').handlers.input({target:{value:'40'}});for(let i=0;i<150;i++)click(h,'step');
 assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const note=h.el('field-notes-list').innerHTML,result=h.el('mission-result').textContent;
 click(h,'step');h.resize(259,240);click(h,'orbit-fire');
 assert.equal(h.el('field-notes-list').innerHTML,note);assert.equal(h.el('mission-result').textContent,result);
});

test('the existing planet reading precedes launch controls, wraps and adds no action or live region',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const start=html.indexOf('<div id="orbit-measurement"'),end=html.indexOf('<div id="orbit-touch"');assert.ok(start>0&&start<end);
 const section=html.slice(start,end);assert.match(section,/<p id="orbit-measured-reading" aria-live="off"><\/p>/);assert.match(section,/<small id="orbit-measured-help" aria-live="off"><\/small>/);
 assert.doesNotMatch(section,/button|tabindex|role="status"|aria-live="polite"|aria-live="assertive"/);
 assert.match(css,/\.orbit-measurement p\{[^}]*font-variant-numeric:tabular-nums;overflow-wrap:anywhere/);
 assert.match(css,/@media\(max-width:720px\)\{\.orbit-measurement\{padding:12px\}\.orbit-measurement small\{font-size:13px\}\}/);
});
