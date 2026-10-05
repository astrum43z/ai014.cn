import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
const click=(h,id)=>h.el(id).handlers.click();
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ≈ ${b}`);
const labels=h=>h.drawing().filter(c=>c[0]==='fillText'&&['A','B','A / B'].includes(c[1]));
const readings=h=>['metrics','wave-position-current','wave-time-current','wave-instant-reading','wave-probe-reading','wave-distances','wave-difference','wave-envelope'].map(id=>h.el(id).textContent);
function position(h,x,y){for(const [axis,value] of [['x',x],['y',y]]){h.el('wave-target-'+axis).value=String(value);h.el('wave-target-'+axis).handlers.input();}click(h,'wave-position');}
function geometry(h,x,y,time=0,separation=100,wavelength=32,view={x,y}){
 const r=h.el('canvas').getBoundingClientRect(),scale=Math.min(Math.min(r.width,r.height)/280,(r.width/2-18)/Math.max(1,Math.abs(view.x)),(r.height/2-18)/Math.max(1,Math.abs(view.y)));
 const commands=h.drawing(),ops=commands.slice(commands.findLastIndex(c=>c[0]==='save')),arcs=ops.filter(c=>c[0]==='arc');assert.equal(arcs.length,3);
 for(const [i,sign] of [-1,1].entries()){near(arcs[i][1],r.width/2+sign*separation/2*scale);near(arcs[i][2],r.height/2);assert.equal(arcs[i][3],4);}
 const px=r.width/2+x*scale,py=r.height/2+y*scale;near(arcs[2][1],px);near(arcs[2][2],py);assert.equal(arcs[2][3],9);
 const strokes=ops.filter(c=>c[0]==='stroke');assert.equal(strokes.length,4);assert.equal(ops.filter(c=>c[0]==='fill').length,2);
 for(const c of labels(h)){
  const w=Math.min(c[1].length*11,c[4]??Infinity),[,label,l,baseline]=c;
  assert.ok(!(px+16.5>=l-2&&px-16.5<=l+w+2&&py+16.5>=baseline-13&&py-16.5<=baseline+5),`${label} clears the full probe envelope`);
  assert.ok(baseline-13>=2&&baseline+5<=r.height-2);
  assert.deepEqual(ops.find(o=>o[0]==='strokeText'&&o[1]===label).slice(1),c.slice(1));
 }
 const left=Math.hypot(x+separation/2,y),right=Math.hypot(x-separation/2,y),a=Math.sin(left/wavelength*2*Math.PI-time*3),b=Math.sin(right/wavelength*2*Math.PI-time*3),v=(a+b)/2,rounded=Math.abs(v)<.005?0:v;
 assert.equal(h.el('wave-instant-reading').textContent,'探针此刻 (A+B)/2 · '+(rounded>0?'+':'')+rounded.toFixed(2));
 assert.equal(h.el('wave-distances').textContent,`A 路程 ${left.toFixed(2)} · B 路程 ${right.toFixed(2)}`);
 return {scale,ops};
}
function isolated({width=647,height=317.9375,x=-50,y=-20,gap=100,a=7.34,b=7.34,pair=27.52}={}){
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8'),fn=source.slice(source.indexOf('function drawWaveMarkers('),source.indexOf('// Paused measuring lines'));
 const commands=[],ctx=new Proxy({measureText:label=>({width:label==='A'?a:label==='B'?b:pair})},{get:(t,k)=>t[k]||((...args)=>commands.push([k,...args])),set:(_,k,v)=>(commands.push([k,v]),true)});
 new Function('ctx','width','height','values','probe',fn+';drawWaveMarkers(1);')(ctx,width,height,{separation:gap},{x,y});return commands;
}
const texts=ops=>ops.filter(c=>c[0]==='fillText');

test('public probe at (-50,-20) no longer erases A; B keeps its original anchor',async()=>{
 const h=await setup('?experiment=wave&at=v1,-50,-20,0');h.resize(647,317.9375);const {scale}=geometry(h,-50,-20);
 assert.deepEqual(labels(h),[['fillText','A',323.5-50*scale-4,158.96875+32],['fillText','B',323.5+50*scale-4,158.96875-12]]);
 assert.equal(h.el('status').textContent,'已暂停');assert.equal(h.el('notes-count').textContent,'0 / 5');
});
test('both source names and a paired caption use the original baseline when it is clear',()=>{
 for(const x of [-50,50]){
  const ops=texts(isolated({x,y:-20}));assert.equal(ops.find(c=>c[1]===(x<0?'A':'B'))[3],190.96875);assert.equal(ops.find(c=>c[1]===(x<0?'B':'A'))[3],146.96875);
 }
 assert.deepEqual(texts(isolated({x:0,y:50})).map(c=>c[3]),[146.96875,146.96875]);
 assert.equal(texts(isolated({gap:3,x:0,y:-20}))[0][3],190.96875);
 assert.equal(texts(isolated({gap:3,x:0,y:50}))[0][3],146.96875);
});
test('inclusive text and probe casing boundaries select the other side',()=>{
 // Source A starts at -54; its right outlined edge is -44.66 relative to center.
 for(const delta of [-.001,0,.001]){
  const c=texts(isolated({x:-28.16+delta,y:-20})).find(c=>c[1]==='A');
  assert.equal(c[3],158.96875+(delta<=0?32:-12));
 }
 for(const delta of [-.001,0,.001]){
  const c=texts(isolated({x:-50,y:-41.5+delta})).find(c=>c[1]==='A');
  assert.equal(c[3],158.96875+(delta>=0?32:-12));
 }
});
test('when both sides collide only the duplicate name is omitted, with exact markers retained',()=>{
 for(const gap of [100,3]){
  const ops=isolated({gap,x:gap===100?-50:0,y:5}),names=texts(ops).map(c=>c[1]);
  assert.deepEqual(names,gap===100?['B']:[]);assert.equal(ops.filter(c=>c[0]==='arc').length,3);assert.equal(ops.filter(c=>c[0]==='stroke').length,4);assert.equal(ops.filter(c=>c[0]==='fill').length,2);
 }
});
test('short views and invalid font measurements retain bounded names or omit them without shrinking type',()=>{
 for(const height of [0,20,50,80,240])for(const metric of [NaN,0,Infinity,undefined]){
  const ops=isolated({height,gap:3,x:0,y:0,a:metric,b:metric,pair:metric});assert.equal(ops.find(c=>c[0]==='font')[1],'11px sans-serif');
  for(const c of texts(ops)){assert.ok(c[3]-13>=2&&c[3]+5<=height-2);assert.equal(c[4],639);}
 }
});
test('positions across the sources retain independent values and exact source/probe geometry',async()=>{
 const h=await setup('?experiment=wave');
 for(const separation of [20,100,180]){
  click(h,'wave-home');
  h.el('separation').handlers.input({target:{value:String(separation)}});
  for(const [x,y] of [[-separation/2,-20],[separation/2,-20],[-separation/2,0],[-separation/2,4],[0,0],[10000,0]]){position(h,x,y);geometry(h,x,y,0,separation);}
 }
});
test('resizing, density and simulated context recovery keep the observation and quiet feedback',async()=>{
 const h=await setup('?experiment=wave&at=v1,-50,-20,2.5'),before=readings(h),message=h.el('announcement').textContent,url=location.href;
 for(const [w,z] of [[37,240],[171,240],[259.5,240.25],[647,317.9375],[1200,560]])for(const dpr of [1,1.25,2,3]){h.resize(w,z);h.setDpr(dpr);geometry(h,-50,-20,2.5);assert.deepEqual(readings(h),before);}
 h.loseContext();h.restoreContext();geometry(h,-50,-20,2.5);assert.equal(location.href,url);assert.equal(h.el('announcement').textContent,message);
});
test('quarter-step, rewind and animation retain label placement without changing timing',async()=>{
 const h=await setup('?experiment=wave&at=v1,-50,-20,0'),before=labels(h);
 for(let i=1;i<=4;i++){click(h,'step');geometry(h,-50,-20,i*Math.PI/6);assert.deepEqual(labels(h),before);}for(let i=3;i>=0;i--){click(h,'wave-back');geometry(h,-50,-20,i*Math.PI/6);}
 click(h,'pause');h.tick(0);h.tick(50);geometry(h,-50,-20,.05);assert.deepEqual(labels(h),before);const message=h.el('announcement').textContent;
 h.setVisible(false);h.setVisible(true);h.tick(100000);geometry(h,-50,-20,.05);h.setHidden(true);h.setHidden(false);h.tick(200000);geometry(h,-50,-20,.05);assert.equal(h.el('announcement').textContent,message);
 click(h,'pause');assert.equal(h.frames.size,0);
});
test('invalid drafts, excluded Enter events and ordinary probe keys preserve their input boundaries',async()=>{
 const h=await setup('?experiment=wave&at=v1,-50,-20,0'),before=readings(h),original=labels(h);
 h.el('wave-target-x').value='1e';click(h,'wave-position');assert.deepEqual(readings(h),before);assert.deepEqual(labels(h),original);
 for(const extra of [{repeat:true},{isComposing:true},{keyCode:229},{ctrlKey:true},{altKey:true},{metaKey:true},{shiftKey:true}])h.el('wave-target-x').handlers.keydown({key:'Enter',preventDefault(){},...extra});
 assert.deepEqual(readings(h),before);h.key('ArrowRight');geometry(h,-48,-20);h.key('ArrowDown');geometry(h,-48,-18);h.key('Home');geometry(h,0,0);assert.equal(labels(h)[0][3],195);
});
test('saved return/undo, retained worlds and anchor navigation preserve each exact observation',async()=>{
 const h=await setup('?experiment=wave&at=v1,-50,-20,2.5','#canvas'),url=location.href;position(h,50,-20);const other=readings(h);click(h,'observation-return');geometry(h,-50,-20,2.5);click(h,'observation-undo');assert.deepEqual(readings(h),other);geometry(h,50,-20,2.5);
 for(const world of ['orbit','life','fractal','walk']){click(h,'tab-'+world);click(h,'tab-wave');assert.deepEqual(readings(h),other);geometry(h,50,-20,2.5);}
 h.navigate(url.replace('#canvas','#observation-title'));assert.deepEqual(readings(h),other);assert.equal(h.el('observation-undo').getAttribute('aria-disabled'),'true');
});
test('discovery evidence, exact target drafts and capture requests stay unchanged',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');click(h,'mission-check');click(h,'wave-home');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value,result=h.el('mission-result').textContent;
 position(h,-50,-20);const drawing=h.drawing();let captures=0;h.el('canvas').toBlob=()=>{captures++;};click(h,'save');assert.equal(captures,1);assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('notes-text').value,notes);assert.equal(h.el('mission-result').textContent,result);
});
test('text-only startup recovers the same source collision without resetting model or target',async()=>{
 const h=await setup('?experiment=wave&at=v1,-50,-20,2.5','',true,1,false),before=readings(h);assert.deepEqual(labels(h),[]);h.setContextReady(true);click(h,'canvas-retry');geometry(h,-50,-20,2.5);assert.deepEqual(readings(h),before);
});
test('the label change adds no mutable state, controls, live feedback or scheduling',()=>{
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8'),fn=source.slice(source.indexOf('function drawWaveMarkers('),source.indexOf('// Paused measuring lines')),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/&amp;source-probe=clear-1/);assert.doesNotMatch(fn,/announce\(|\.textContent|addEventListener|requestAnimationFrame|setTimeout|localStorage|sessionStorage|fetch\(|probe\.[xy]\s*=|values\.separation\s*=/);
});
