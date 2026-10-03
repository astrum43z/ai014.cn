import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWaveCycleCache,waveCyclePosition} from '../wave-cycle.js';
import {waveComponents} from '../simulations.js';
import {setup} from './life-challenge-harness.js';

const TAU=Math.PI*2,period=TAU/3,names=['left','right','combined'];
const click=(h,id)=>h.el(id).handlers.click();
const parsed=text=>text.split(' ').map(point=>point.split(',').map(Number));
const trace=(h,name)=>h.el('wave-cycle-'+name).attributes.points;
const traces=h=>Object.fromEntries(names.map(name=>[name,trace(h,name)]));
function near(a,b,epsilon=1e-10){assert.ok(Math.abs(a-b)<=epsilon,`${a} ≈ ${b}`);}
function check(h,x=0,y=0,separation=100,wavelength=32,time=0){
 for(const name of names){
  assert.equal(typeof trace(h,name),'string','the current probe has a visible full-cycle model trace');
  const points=parsed(trace(h,name));assert.equal(points.length,65);
  points.forEach(([px,py],i)=>{
   near(px,i/64*600);
   near(py,28-waveComponents(x,y,i/64*TAU,separation,wavelength)[name]*24);
  });
  const cursor=h.el('wave-cycle-cursor-'+name).attributes.transform;
  const phase=waveCyclePosition(time*3);near(Number(cursor.match(/translate\(([^ ]+) 0\)/)[1]),phase,1e-9);
  near(Number(h.el('wave-cycle-dot-'+name).attributes.cx),phase);
  near(Number(h.el('wave-cycle-dot-'+name).attributes.cy),28-waveComponents(x,y,time*3,separation,wavelength)[name]*24);
 }
 assert.equal(h.el('wave-cycle-period').textContent,`一周期 T ≈ 2.094 模型秒 · 当前周期位置约 ${(waveCyclePosition(time*3)/6).toFixed(1)}%。`);
}

test('all trace samples match the existing two-source model, including extreme fitted probes',()=>{
 const cache=createWaveCycleCache();
 for(const separation of [20,100,180])for(const wavelength of [15,32,70])for(const [x,y] of [[0,0],[8,0],[-50,0],[50,0],[12,36],[10000,-10000]]){
  const result=cache(Math.hypot(x+separation/2,y),Math.hypot(x-separation/2,y),wavelength);
  for(const name of names){
   const points=parsed(result[name]);assert.equal(points.length,65);
   points.forEach(([px,py],i)=>{near(px,i/64*600);near(py,28-waveComponents(x,y,i/64*TAU,separation,wavelength)[name]*24);assert.ok(py>=4-1e-10&&py<=52+1e-10);});
   near(points[0][1],points[64][1],1e-9);
  }
 }
});

test('cache holds one fixed geometry and consumes no random draws or phase-dependent resampling',()=>{
 const cache=createWaveCycleCache(),first=cache(50,50,32);
 const sin=Math.sin,random=Math.random;let calls=0;
 try{
  Math.sin=(...args)=>{calls++;return sin(...args);};Math.random=()=>{throw Error('no random draws');};
  for(let i=0;i<120;i++)assert.equal(cache(50,50,32),first);
  assert.equal(calls,0);
  const changed=cache(58,42,32);assert.notEqual(changed,first);assert.equal(calls,130);
  assert.equal(cache(58,42,32),changed);assert.equal(calls,130);
  assert.notEqual(cache(42,58,32),changed);assert.equal(calls,260);
  assert.notEqual(cache(42,58,64),changed);assert.equal(calls,390);
  assert.notEqual(cache(50,50,32),first,'only one geometry stays cached');
 }finally{Math.sin=sin;Math.random=random;}
 assert.equal(createWaveCycleCache()(50,50,32).combined,first.combined);
});

test('persistent cancellation and a dark instant produce visibly different complete curves',()=>{
 const cache=createWaveCycleCache(),cancel=cache(58,42,32),center=cache(50,50,32);
 for(const [x,y] of parsed(cancel.combined))near(y,28);
 for(const name of ['left','right']){
  assert.ok(Math.min(...parsed(cancel[name]).map(p=>p[1]))<4.1);
  assert.ok(Math.max(...parsed(cancel[name]).map(p=>p[1]))>51.9);
 }
 assert.equal(center.left,center.right);assert.equal(center.left,center.combined);
 // The central probe is dark at phase 50/32*2π, but still has unit amplitude.
 near(waveComponents(0,0,50/32*TAU,100,32).combined,0);
 assert.ok(Math.min(...parsed(center.combined).map(p=>p[1]))<4.1);
 assert.ok(Math.max(...parsed(center.combined).map(p=>p[1]))>51.9);
});

test('phase cursor wraps quarter cycles and remains bounded for supported extreme time',()=>{
 for(let i=0;i<=40;i++)near(waveCyclePosition(i*Math.PI/2),(i%4)*150,1e-9);
 for(const phase of [-TAU,-Math.PI/2,0,1,Math.PI,3e9,3e9+Math.PI/2]){
  const x=waveCyclePosition(phase);assert.ok(x>=0&&x<600);
  near(Math.sin(TAU*x/600),Math.sin(phase),2e-7);
 }
 near(waveCyclePosition(TAU-1e-12),0);near(waveCyclePosition(TAU+1e-12),0);
 assert.ok(waveCyclePosition(TAU-1e-7)>599.99,'real near-boundary phases are not prematurely wrapped');
});

test('the three rows have common readable axes, non-color identities and quiet model-curve help',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<figure class="wave-cycle" aria-labelledby="wave-cycle-title" aria-describedby="wave-cycle-period wave-cycle-help wave-envelope">/);
 for(const name of names)assert.equal((html.match(new RegExp('id="wave-cycle-'+name+'"','g'))||[]).length,1);
 assert.ok(html.includes('A · 左源'));assert.ok(html.includes('B · 右源'));assert.ok(html.includes('(A+B)/2'));
 const chart=html.slice(html.indexOf('<figure class="wave-cycle"'),html.indexOf('<div class="wave-path-reading">'));
 assert.equal((chart.match(/viewBox="0 0 600 56" preserveAspectRatio="none" aria-hidden="true" focusable="false"/g)||[]).length,3);
 assert.equal((chart.match(/<span>\+1<\/span><span>0<\/span><span>−1<\/span>/g)||[]).length,3);
 assert.ok(chart.includes('<span>T/4</span>'));assert.ok(chart.includes('<span>3T/4</span>'));
 assert.ok(chart.includes('模型曲线，不是运行记录'));assert.ok(chart.includes('A、B 各自仍在振动'));
 assert.ok(chart.includes('画布移出屏幕时，模拟与游标都停止推进'));
 assert.ok(!chart.includes('<button'));assert.ok(!chart.includes('aria-live="polite"'));
 assert.ok(css.includes('vector-effect:non-scaling-stroke'));assert.ok(css.includes('.wave-cycle-trace.right{stroke:#f59c80;stroke-dasharray:5 3}'));
 assert.match(css,/wave-cycle-row\{[^}]*minmax\(0,1fr\)/);
});

test('real app shows a cancellation curve, with quarter steps moving markers without changing samples',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,0','#canvas'),original=traces(h),url=location.href;
 check(h,8);h.el('step').focus();
 for(let i=1;i<=8;i++){
  click(h,'step');check(h,8,0,100,32,i*period/4);assert.deepEqual(traces(h),original);
  assert.equal(document.activeElement,h.el('step'));assert.equal(h.frames.size,0);assert.equal(location.href,url);
 }
});

test('probe buttons, keys and pointer update only fixed-probe curves while keeping the clock',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,2.5'),clock=h.el('metrics').textContent;
 check(h,8,0,100,32,2.5);click(h,'wave-home');check(h,0,0,100,32,2.5);
 click(h,'wave-right');check(h,2,0,100,32,2.5);h.key('ArrowUp');check(h,2,-2,100,32,2.5);
 h.el('canvas').handlers.click({clientX:300-8*414/280,clientY:207});check(h,-8,0,100,32,2.5);
 assert.equal(h.el('metrics').textContent,clock);assert.equal(h.frames.size,0);
});

test('parameter edits, presets, reset and guides refresh the same model curves',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,1');check(h,8,0,100,32,1);
 h.el('wavelength').handlers.input({target:{value:'70'}});check(h,8,0,100,70,1);
 click(h,'increase-separation');check(h,8,0,101,70,1);
 h.el('preset-select').handlers.change({target:{value:'wide'}});click(h,'load-preset');check(h,0,0,150,65,0);
 click(h,'guide-start');check(h,8,0,100,32,0);click(h,'reset');check(h);
});

test('unchanged redraws preserve traces, marker attributes, caption text and action announcements',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5'),original=traces(h);let writes=0;
 for(const name of names)for(const prefix of ['wave-cycle-','wave-cycle-cursor-','wave-cycle-dot-']){
  const el=h.el(prefix+name),set=el.setAttribute.bind(el);el.setAttribute=(...args)=>{writes++;set(...args);};
 }
 let text=h.el('wave-cycle-period').textContent;Object.defineProperty(h.el('wave-cycle-period'),'textContent',{get:()=>text,set:value=>{writes++;text=value;}});
 const announcement=h.el('announcement').textContent;
 h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();
 for(const [w,height] of [[259,240],[295.5,260.25],[600,414],[767,318]])h.resize(w,height);
 for(const dpr of [1.5,2,3,1])h.setDpr(dpr);
 h.loseContext();h.restoreContext();
 assert.deepEqual(traces(h),original);check(h,8,12,100,32,2.5);assert.equal(writes,0);
 assert.equal(h.el('announcement').textContent,announcement);assert.equal(h.frames.size,0);
});

test('animation updates only current markers and respects interruption and reduced motion',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,0'),original=traces(h);let samples=0;
 for(const name of names){const el=h.el('wave-cycle-'+name),set=el.setAttribute.bind(el);el.setAttribute=(...args)=>{samples++;set(...args);};}
 click(h,'pause');const announcement=h.el('announcement').textContent;h.tick(0);
 for(let i=1;i<=20;i++)h.tick(i*50);
 check(h,8,0,100,32,1);assert.deepEqual(traces(h),original);assert.equal(samples,0);
 assert.equal(h.el('announcement').textContent,announcement);assert.equal(h.frames.size,1);
 h.setVisible(false);assert.equal(h.frames.size,0);check(h,8,0,100,32,1);
 h.setVisible(true);h.tick(100000);check(h,8,0,100,32,1);
 h.setHidden(true);assert.equal(h.frames.size,0);h.setHidden(false);h.tick(150000);check(h,8,0,100,32,1);
 h.loseContext();assert.equal(h.frames.size,0);h.restoreContext();h.tick(200000);check(h,8,0,100,32,1);
 h.motion.change({matches:true});assert.equal(h.frames.size,0);check(h,8,0,100,32,1);
 h.motion.change({matches:false});assert.equal(h.frames.size,0);
});

test('shared moments stay fixed while traces follow current geometry and return exactly',async()=>{
 const h=await setup('?experiment=wave&at=v1,1000,-700,1000000000','#canvas');check(h,1000,-700,100,32,1e9);
 const original=traces(h),url=location.href;click(h,'wave-home');check(h,0,0,100,32,1e9);
 click(h,'step');check(h,0,0,100,32,1e9+period/4);assert.equal(location.href,url);
 click(h,'observation-return');check(h,1000,-700,100,32,1e9);assert.deepEqual(traces(h),original);
 await click(h,'share');const link=h.el('share-link').value;assert.ok(link.includes('at='));
 h.navigate('?experiment=wave&wavelength=15&separation=20&at=v1,-10000,10000,2.5#canvas');check(h,-10000,10000,20,15,2.5);
 h.navigate(link);check(h,1000,-700,100,32,1e9);
});

test('retained worlds keep their exact progress and restore Wave curves without navigation side effects',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5','#canvas'),original=traces(h),url=location.href;
 for(const index of [0,1,3,4]){
  h.tabs[index].handlers.click();assert.equal(h.el('wave-components').hidden,true);
  click(h,'step');const metric=h.el('metrics').textContent;
  h.tabs[2].handlers.click();assert.equal(h.el('wave-components').hidden,false);check(h,8,12,100,32,2.5);
  assert.deepEqual(traces(h),original);assert.equal(location.href,url);
  h.tabs[index].handlers.click();assert.equal(h.el('metrics').textContent,metric);
  h.tabs[2].handlers.click();check(h,8,12,100,32,2.5);
 }
});

test('the optional discovery still requires actual checks and records unchanged evidence',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');check(h,8);
 const before=h.el('notes-count').textContent;
 for(let i=0;i<4;i++)click(h,'step');check(h,8,0,100,32,period);assert.equal(h.el('notes-count').textContent,before);
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,before);
 click(h,'wave-home');check(h,0,0,100,32,period);click(h,'mission-check');
 assert.equal(h.el('notes-count').textContent,'1 / 5');
 assert.match(h.el('notes-text').value,/0\.00/);assert.match(h.el('notes-text').value,/1\.00/);
 const note=h.el('notes-text').value;click(h,'wave-right');click(h,'step');assert.equal(h.el('notes-text').value,note);
});
