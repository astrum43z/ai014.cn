import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const labels=h=>h.drawing().filter(c=>c[0]==='fillText'&&['A','B','A / B'].includes(c[1]));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ≈ ${b}`);
const readings=h=>['metrics','wave-position-current','wave-time-current','wave-instant-reading','wave-probe-reading','wave-distances','wave-difference','wave-envelope'].map(id=>h.el(id).textContent);
function position(h,x,y){for(const [axis,value] of [['x',x],['y',y]]){h.el('wave-target-'+axis).value=String(value);h.el('wave-target-'+axis).handlers.input();}click(h,'wave-position');}
function markerOps(h){const ops=h.drawing(),i=ops.findIndex(c=>['fillText','strokeText'].includes(c[0])&&['A','A / B'].includes(c[1])),start=ops.findLastIndex((c,j)=>j<i&&c[0]==='save'),end=ops.findIndex((c,j)=>j>i&&c[0]==='restore');return ops.slice(start,end+1);}
function verifyModel(h,x,y,time=0,wavelength=32,separation=100,view={x,y}){
 const r=h.el('canvas').getBoundingClientRect(),scale=Math.min(Math.min(r.width,r.height)/280,(r.width/2-18)/Math.max(1,Math.abs(view.x)),(r.height/2-18)/Math.max(1,Math.abs(view.y)));
 const arcs=markerOps(h).filter(c=>c[0]==='arc');assert.equal(arcs.length,3);
 for(const [i,sign] of [-1,1].entries()){near(arcs[i][1],r.width/2+sign*separation/2*scale);near(arcs[i][2],r.height/2);assert.equal(arcs[i][3],4);}
 near(arcs[2][1],r.width/2+x*scale);near(arcs[2][2],r.height/2+y*scale);assert.equal(arcs[2][3],9);
 const left=Math.hypot(x+separation/2,y),right=Math.hypot(x-separation/2,y),a=Math.sin(left/wavelength*2*Math.PI-time*3),b=Math.sin(right/wavelength*2*Math.PI-time*3),combined=(a+b)/2;
 const rounded=Math.abs(combined)<.005?0:combined,text=(rounded>0?'+':'')+rounded.toFixed(2);
 assert.equal(h.el('wave-instant-reading').textContent,'探针此刻 (A+B)/2 · '+text);
 assert.equal(h.el('wave-distances').textContent,`A 路程 ${left.toFixed(2)} · B 路程 ${right.toFixed(2)}`);
 return scale;
}
function isolated({width=647,height=317.9375,gap=3.055,a=7.34,b=7.34,pair=27.52}={}){
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8'),fn=source.slice(source.indexOf('function drawWaveMarkers('),source.indexOf('// Paused measuring lines'));
 const commands=[],ctx=new Proxy({measureText:label=>({width:label==='A'?a:label==='B'?b:pair})},{get:(t,k)=>t[k]||((...args)=>commands.push([k,...args])),set:(_,k,v)=>(commands.push([k,v]),true)});
 new Function('ctx','width','height','values','probe',fn+';drawWaveMarkers(1);')(ctx,width,height,{separation:gap},{x:0,y:50});
 return commands;
}

test('public distant fitted view uses one readable pair without moving either source or probe',async()=>{
 const h=await setup('?experiment=wave&at=v1,10000,0,0');h.resize(647,317.9375);near(verifyModel(h,10000,0),.03055);
 assert.deepEqual(labels(h),[['fillText','A / B',296,146.96875,639]]);
 assert.equal(h.el('status').textContent,'已暂停');assert.equal(h.el('notes-count').textContent,'0 / 5');
});

test('ordinary letters retain exact anchors and become paired only inside measured clearance',()=>{
 for(const gap of [13.339,13.34,13.341,100]){
  const ops=isolated({gap}),texts=ops.filter(c=>c[0]==='fillText');
  if(gap<13.34)assert.deepEqual(texts,[['fillText','A / B',309.74,146.96875,639]]);
  else assert.deepEqual(texts,[['fillText','A',323.5-gap/2-4,146.96875],['fillText','B',323.5+gap/2-4,146.96875]]);
 }
});

test('font measurements, safe fallback and narrow drawing bounds preserve readable pair geometry',()=>{
 for(const [a,b,pair] of [[9,18,41],[18,9,41],[NaN,0,Infinity],[undefined,-1,0]]){
  const ops=isolated({width:37,gap:1,a,b,pair}),text=ops.find(c=>c[0]==='fillText');assert.equal(text[1],'A / B');assert.equal(text[4],29);near(text[2],4);
  const outline=ops.find(c=>c[0]==='strokeText');assert.deepEqual(outline.slice(1),text.slice(1));
 }
 const at=isolated({gap:24,a:9,b:18}).filter(c=>c[0]==='fillText');assert.deepEqual(at.map(c=>c[1]),['A','B']);
 const inside=isolated({gap:23.999,a:9,b:18}).filter(c=>c[0]==='fillText');assert.deepEqual(inside.map(c=>c[1]),['A / B']);
});

test('caption shares opaque contrast, original font and baseline while marker geometry paints afterward',()=>{
 const ops=isolated(),i=ops.findIndex(c=>c[0]==='strokeText'),j=ops.findIndex(c=>c[0]==='fillText');
 assert.ok(i<j);assert.equal(ops.slice(0,i).findLast(c=>c[0]==='font')[1],'11px sans-serif');assert.equal(ops.slice(0,i).findLast(c=>c[0]==='lineWidth')[1],4);assert.equal(ops.slice(0,i).findLast(c=>c[0]==='strokeStyle')[1],'#122e29');assert.equal(ops.slice(0,j).findLast(c=>c[0]==='fillStyle')[1],'#f4f5eb');
 assert.ok(ops.findLastIndex(c=>c[0]==='arc')>j,'probe stays above the caption');assert.equal(ops.filter(c=>c[0]==='arc').length,3);assert.equal(ops.filter(c=>c[0]==='stroke').length,4);assert.equal(ops.filter(c=>c[0]==='fill').length,2);assert.deepEqual(ops.at(-1),['restore']);
});

test('all supported separations preserve independent model readings across fitted directions and phases',async()=>{
 for(const separation of [20,100,180])for(const [x,y,t] of [[10000,0,0],[-10000,10000,2.5],[0,-10000,.125]]){
  const h=await setup(`?experiment=wave&separation=${separation}&at=v1,${x},${y},${t}`);verifyModel(h,x,y,t,32,separation);assert.equal(labels(h)[0][1],'A / B');
 }
});

test('resize, density and context restoration preserve the exact checkpoint and quiet feedback',async()=>{
 const h=await setup('?experiment=wave&at=v1,10000,-10000,2.5'),before=readings(h),url=location.href,message=h.el('announcement').textContent;
 for(const [w,z] of [[37,240],[171,240],[259.5,240.25],[647,317.9375],[1200,560]])for(const dpr of [1,1.25,2,3]){h.resize(w,z);h.setDpr(dpr);verifyModel(h,10000,-10000,2.5);assert.equal(labels(h)[0][1],'A / B');assert.deepEqual(readings(h),before);assert.equal(location.href,url);assert.equal(h.el('announcement').textContent,message);}
 h.loseContext();h.restoreContext();verifyModel(h,10000,-10000,2.5);assert.deepEqual(readings(h),before);assert.equal(labels(h)[0][1],'A / B');
});

test('home, exact positioning and native keys switch presentation without changing input semantics',async()=>{
 const h=await setup('?experiment=wave&at=v1,10000,0,0');click(h,'wave-home');position(h,800,300);verifyModel(h,800,300);assert.equal(labels(h).length,2);
 position(h,10000,0);verifyModel(h,10000,0);h.el('wave-target-x').value='bad';click(h,'wave-position');verifyModel(h,10000,0);assert.equal(h.el('wave-target-x').getAttribute('aria-invalid'),'true');
 click(h,'wave-home');verifyModel(h,0,0);assert.deepEqual(labels(h).map(c=>c[1]),['A','B']);h.key('ArrowRight');verifyModel(h,2,0);h.key('Home');verifyModel(h,0,0);
 position(h,10000,0);h.key('ArrowLeft');verifyModel(h,9998,0,0,32,100,{x:10000,y:0});assert.equal(labels(h)[0][1],'A / B');
});

test('phase forward/backward, animation and pause keep source names stable and models current',async()=>{
 const h=await setup('?experiment=wave&at=v1,10000,0,0'),paired=labels(h);for(let n=1;n<=4;n++){click(h,'step');verifyModel(h,10000,0,n*Math.PI/6);assert.deepEqual(labels(h),paired);}for(let n=3;n>=0;n--){click(h,'wave-back');verifyModel(h,10000,0,n*Math.PI/6);}
 click(h,'pause');h.tick(0);h.tick(50);verifyModel(h,10000,0,.05);assert.deepEqual(labels(h),paired);click(h,'pause');assert.equal(h.frames.size,0);
});

test('fixed links, return undo, retained worlds and history keep their observations',async()=>{
 const h=await setup('?experiment=wave&at=v1,10000,0,2.5','#canvas'),url=location.href;click(h,'wave-home');const home=readings(h);click(h,'observation-return');verifyModel(h,10000,0,2.5);click(h,'observation-undo');assert.deepEqual(readings(h),home);assert.equal(labels(h).length,2);assert.equal(location.href,url);
 for(const world of ['orbit','life','fractal','walk']){click(h,'tab-'+world);click(h,'tab-wave');assert.deepEqual(readings(h),home);}
 h.navigate(url.replace('#canvas','#observation-title'));assert.deepEqual(readings(h),home);h.navigate('?experiment=wave&at=v1,-10000,0,.125');verifyModel(h,-10000,0,.125);assert.equal(labels(h)[0][1],'A / B');
});

test('distant label changes retain earned discoveries and saved-canvas requests',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');click(h,'mission-check');click(h,'wave-home');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value,result=h.el('mission-result').textContent;
 position(h,10000,0);const drawing=h.drawing();let captures=0;h.el('canvas').toBlob=()=>{captures++;};click(h,'save');assert.equal(captures,1);assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('notes-text').value,notes);assert.equal(h.el('mission-result').textContent,result);
});

test('text-only startup and recovered canvas retain the same distant observation',async()=>{
 const h=await setup('?experiment=wave&at=v1,10000,0,2.5','',true,1,false),before=readings(h);assert.deepEqual(labels(h),[]);h.setContextReady(true);click(h,'canvas-retry');verifyModel(h,10000,0,2.5);assert.deepEqual(readings(h),before);assert.equal(labels(h)[0][1],'A / B');
});

test('the presentation-only change adds no state, controls, scheduling or live announcements',()=>{
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8'),helper=source.slice(source.indexOf('function drawWaveMarkers('),source.indexOf('// Paused measuring lines')),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/app\.js\?[^"\n]*&amp;wave-sources=paired-label-1/);assert.doesNotMatch(helper,/announce\(|\.textContent|addEventListener|requestAnimationFrame|setTimeout|localStorage|sessionStorage|fetch\(|probe\.[xy]\s*=|values\.separation\s*=/);
});
