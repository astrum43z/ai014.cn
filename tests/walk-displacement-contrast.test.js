import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
// An independent exact recurrence, followed by scalar moments and projection.
function oracle(seed=14,bias=0,steps=16,width=600,height=414){
 let rng=BigInt(seed);const positions=Array.from({length:256},()=>[0,0]),path=[[0,0]];
 for(let n=0;n<steps;n++){
  for(const p of positions){rng=(1664525n*rng+1013904223n)%4294967296n;const u=Number(rng)/4294967296;
   if(u<.25+bias/200)p[0]++;else if(u<.5)p[0]--;else if(u<.75)p[1]++;else p[1]--;}
  path.push([...positions[0]]);
 }
 const center=steps*bias/200;let extentX=Math.max(30,Math.abs(center)+30),extentY=30;
 for(const [x,y] of [...positions,...path]){extentX=Math.max(extentX,Math.abs(x-center)+6);extentY=Math.max(extentY,Math.abs(y)+6);}
 const scale=Math.min((width-48)/(2*extentX),(height-76)/(2*extentY)),px=x=>width/2+(x-center)*scale,py=y=>height/2-y*scale;
 const mx=positions.reduce((a,p)=>a+p[0],0)/256,my=positions.reduce((a,p)=>a+p[1],0)/256;
 const spread=Math.sqrt(positions.reduce((a,p)=>a+(p[0]-mx)**2+(p[1]-my)**2,0)/256);
 return {positions,path,scale,px,py,mx,my,spread};
}
function paints(commands){
 let style={},path=[];const stack=[],out=[];
 commands.forEach(([name,...args],index)=>{
  if(name==='save')stack.push({...style});else if(name==='restore')style=stack.pop();
  else if(['strokeStyle','fillStyle','lineWidth'].includes(name))style[name]=args[0];
  else if(name==='setLineDash')style.dash=args[0];else if(name==='beginPath')path=[];
  else if(['moveTo','lineTo','arc'].includes(name))path.push([name,...args]);
  else if(name==='stroke'||name==='fill')out.push({name,index,style:{...style},path:structuredClone(path)});
 });return out;
}
function check(h,{seed=14,bias=0,steps=16,width=600,height=414,paused=true}={}){
 const m=oracle(seed,bias,steps,width,height),all=paints(h.drawing());
 const lines=all.filter(p=>p.name==='stroke'&&JSON.stringify(p.style.dash)==='[7,4]');
 assert.equal(lines.length,paused?2:0,'only paused views have both distance strokes');
 const samples=all.find(p=>p.name==='fill'&&p.path.filter(c=>c[0]==='arc'&&c[3]===2.1).length===256);assert.ok(samples);
 samples.path.filter(c=>c[0]==='arc').forEach((c,i)=>{near(c[1],m.px(m.positions[i][0]));near(c[2],m.py(m.positions[i][1]));});
 const trace=all.find(p=>p.name==='stroke'&&p.style.strokeStyle==='#e7eee177');assert.ok(trace);
 assert.equal(trace.path.length,m.path.length);trace.path.forEach(([name,x,y],i)=>{assert.equal(name,i?'lineTo':'moveTo');near(x,m.px(m.path[i][0]));near(y,m.py(m.path[i][1]));});assert.equal(trace.style.lineWidth,1.2);
 assert.ok(trace.index<samples.index,'the original full path keeps its original stacking');
 if(paused){
  const expected=[['moveTo',m.px(0),m.py(0)],['lineTo',m.px(m.positions[0][0]),m.py(m.positions[0][1])]];
  for(const [i,p] of lines.entries()){assert.equal(p.path.length,expected.length);p.path.forEach(([name,x,y],j)=>{assert.equal(name,expected[j][0]);near(x,expected[j][1]);near(y,expected[j][2]);});assert.equal(p.style.lineWidth,i?2:5);assert.equal(p.style.strokeStyle,i?'#82d6dd':'#122e29');}
  assert.deepEqual(lines[0].path,lines[1].path);
  assert.ok(samples.index<lines[0].index&&lines[0].index<lines[1].index,'both distance layers clear the cloud');
  const reference=all.filter(p=>p.name==='stroke'&&JSON.stringify(p.style.dash)==='[4,5]');assert.equal(reference.length,2);assert.ok(reference[0].index>lines[1].index);
  const marker=all.find(p=>p.name==='fill'&&p.style.fillStyle==='#e7eee1'&&p.path[0]?.[3]===4);assert.ok(marker.index>reference[1].index);
  assert.ok(!all.some(p=>p.name==='fill'&&JSON.stringify(p.path)===JSON.stringify(expected)),'measurement stays an unfilled line');
 }
 assert.equal(h.el('metrics').textContent,`256 位漫步者 · ${steps} 步 · 偏向 ${bias}%`);
 assert.equal(h.el('walk-displacement').textContent,`${Math.hypot(...m.positions[0]).toFixed(2)} 步长`);
 assert.equal(h.el('observation-a').textContent,`实测散开程度 · ${m.spread.toFixed(2)}`);
 return m;
}
const readings=h=>['metrics','walk-step-reading','walk-spread-reading','walk-scale-reading','walk-length','walk-displacement','walk-cancellation','walk-distance-note','observation-a','observation-b','observation-c','notes-count'].map(id=>h.el(id).textContent);
const seek=(h,n)=>{h.el('walk-count').value=String(n);click(h,'walk-seek');};

test('the public 64-step overlap keeps the exact blue measurement above occupied sites',async()=>{
 const h=await setup('?experiment=walk&at=v1,64');h.resize(767,317.9375);const m=check(h,{steps:64,width:767,height:317.9375});
 assert.deepEqual(m.positions[0],[10,-4]);const length=Math.hypot(10,-4)*m.scale;
 // Interior samples coincide with an actual on-dash interval, not merely its bounding box.
 const overlaps=m.positions.filter(([x,y])=>{const along=(10*x-4*y)/Math.hypot(10,-4)*m.scale,across=Math.abs(4*x+10*y)/Math.hypot(10,-4)*m.scale;return along>7&&along<length-7&&across<3.1&&along%11<7;});
 assert.ok(overlaps.length>0);assert.ok(overlaps.some(([x,y])=>x===4&&y===-2));
 const before=readings(h),message=h.el('announcement').textContent,drawing=h.drawing();
 for(let i=0;i<30;i++)h.resize(767,317.9375);
 assert.deepEqual(readings(h),before);assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('announcement').textContent,message);
});

test('independent seeded positions and full trajectories remain exact across biased and unbiased views',async()=>{
 for(const [seed,bias,steps] of [[14,0,16],[14,0,64],[23,7,137],[42,25,512],[99,25,511],[50,0,16]]){
  const h=await setup(`?experiment=walk&seed=${seed}&bias=${bias}&at=v1,${steps}`);check(h,{seed,bias,steps});
 }
});

test('zero displacement stays zero without an invented minimum-length dash',async()=>{
 const h=await setup('?experiment=walk&seed=50');const m=check(h,{seed:50});assert.deepEqual(m.positions[0],[0,0]);
 const lines=paints(h.drawing()).filter(p=>JSON.stringify(p.style.dash)==='[7,4]');
 for(const p of lines)assert.deepEqual(p.path[0].slice(1),p.path[1].slice(1));assert.match(h.el('walk-distance-note').textContent,/回到了起点/);
});

test('responsive and density changes retain exact endpoints and CSS stroke sizes',async()=>{
 const h=await setup('?experiment=walk&seed=42&bias=25&at=v1,512'),before=readings(h).filter((_,i)=>i!==3),message=h.el('announcement').textContent;
 for(const [width,height] of [[171,240],[259,240],[350.3333435058594,240],[544.5,240],[767,317.9375],[1200,560]])for(const dpr of [1,1.25,2,3]){
  h.resize(width,height);h.setDpr(dpr);check(h,{seed:42,bias:25,steps:512,width,height});assert.deepEqual(readings(h).filter((_,i)=>i!==3),before);assert.equal(h.el('announcement').textContent,message);
 }
});

test('running has no distance overlay and pausing restores the current exact endpoints',async()=>{
 const h=await setup('?experiment=walk','',false);check(h,{paused:false});h.tick(0);h.tick(50);h.tick(100);check(h,{steps:20,paused:false});
 click(h,'pause');check(h,{steps:20});const drawing=h.drawing();click(h,'walk-step-one');check(h,{steps:21});click(h,'walk-back');assert.deepEqual(h.drawing(),drawing);
 click(h,'pause');check(h,{steps:20,paused:false});h.motion.change({matches:true});check(h,{steps:20});h.motion.change({matches:false});assert.equal(h.frames.size,0);
});

test('explicit targets, lower and upper limits and repeated controls retain their original rules',async()=>{
 const h=await setup('?experiment=walk');check(h);click(h,'walk-back');check(h);seek(h,512);check(h,{steps:512});click(h,'walk-step-one');click(h,'step');check(h,{steps:512});
 click(h,'walk-back');check(h,{steps:511});click(h,'walk-step-one');check(h,{steps:512});seek(h,137);check(h,{steps:137});
 h.el('walk-count').value='１３８';h.el('walk-count').handlers.keydown({key:'Enter',preventDefault(){}});check(h,{steps:138});
 for(const extra of [{repeat:true},{isComposing:true},{keyCode:229},{ctrlKey:true},{altKey:true},{shiftKey:true},{metaKey:true}]){h.el('walk-count').value='140';h.el('walk-count').handlers.keydown({key:'Enter',preventDefault(){},...extra});check(h,{steps:138});}
 for(const value of ['', '15','513','16.5','NaN']){seek(h,value);assert.equal(h.el('walk-count').getAttribute('aria-invalid'),'true');check(h,{steps:138});}
});

test('saved return and undo restore exact line, point cloud, path and next random update',async()=>{
 const h=await setup('?experiment=walk&seed=23&bias=7&at=v1,73');check(h,{seed:23,bias:7,steps:73});click(h,'step');check(h,{seed:23,bias:7,steps:89});const drawing=h.drawing();
 click(h,'observation-return');check(h,{seed:23,bias:7,steps:73});click(h,'observation-undo');assert.deepEqual(h.drawing(),drawing);click(h,'walk-step-one');check(h,{seed:23,bias:7,steps:90});
 await click(h,'share');const saved=h.el('share-link').value;assert.equal(new URL(saved).searchParams.get('at'),'v1,90');click(h,'step');check(h,{seed:23,bias:7,steps:106});h.navigate('?experiment=fractal');h.navigate(saved);check(h,{seed:23,bias:7,steps:90});
});

test('world returns, focus and simulated graphics and visibility recovery preserve the whole observation',async()=>{
 const h=await setup('?experiment=walk&at=v1,64'),drawing=h.drawing(),text=readings(h),message=h.el('announcement').textContent;h.el('walk-step-one').focus();
 h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();h.loseContext();h.restoreContext();h.setVisible(false);h.setVisible(true);h.setHidden(true);h.setHidden(false);
 assert.deepEqual(h.drawing(),drawing);assert.deepEqual(readings(h),text);assert.equal(h.el('announcement').textContent,message);assert.equal(document.activeElement,h.el('walk-step-one'));
 for(const world of ['orbit','life','wave','fractal']){click(h,'tab-'+world);click(h,'tab-walk');assert.deepEqual(h.drawing(),drawing);assert.deepEqual(readings(h),text);}
 check(h,{steps:64});
});

test('text-only startup and collapsed layouts omit bitmap geometry while preserving controls and readings',async()=>{
 const h=await setup('?experiment=walk&at=v1,64','',true,1,false);assert.equal(h.drawCount(),0);click(h,'walk-step-one');assert.match(h.el('metrics').textContent,/65 步/);
 h.setContextReady(true);click(h,'canvas-retry');check(h,{steps:65});const drawing=h.drawing();
 for(const [w,z] of [[0,414],[600,0],[48,76],[20,20]]){h.resize(w,z);assert.ok(!paints(h.drawing()).some(p=>JSON.stringify(p.style.dash)==='[7,4]'));assert.match(h.el('metrics').textContent,/65 步/);}
 h.resize(600,414);assert.deepEqual(h.drawing(),drawing);check(h,{steps:65});
});

test('presets, resets, parameter changes and navigation never reuse stale endpoints',async()=>{
 const h=await setup('?experiment=walk&seed=99&bias=25&at=v1,512');check(h,{seed:99,bias:25,steps:512});
 input(h,'bias',7);check(h,{seed:99,bias:7});input(h,'seed',50);check(h,{seed:50,bias:7});
 h.el('preset-select').handlers.change({target:{value:'unbiased'}});click(h,'load-preset');check(h,{seed:50});click(h,'walk-64');check(h,{seed:50,steps:64});click(h,'reset');check(h,{seed:50});
 h.key('ArrowRight');check(h,{seed:50,steps:32});h.key('Home');check(h,{seed:50});click(h,'guide-start');check(h);
});

test('discoveries, capture requests and intentional batch repeats retain their evidence and behavior',async()=>{
 const h=await setup('?experiment=walk');click(h,'mission-start');click(h,'mission-check');click(h,'walk-64');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');check(h,{steps:64});
 const notes=h.el('notes-text').value;let captured=false;h.el('canvas').toBlob=cb=>{captured=true;check(h,{steps:64});cb(null);};click(h,'save');assert.ok(captured);
 for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional batch repeat blocked');}});click(h,'step');}check(h,{steps:96});assert.equal(h.el('notes-text').value,notes);
 click(h,'tab-fractal');for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional batch repeat blocked');}});click(h,'step');}assert.match(h.el('metrics').textContent,/500 个点/);
});

test('the drawing helper isolates its style and adds no geometry, timers, fills or state changes',()=>{
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8'),fn=source.slice(source.indexOf('function drawWalkDisplacement('),source.indexOf('// Samples can overlap the theoretical scale itself.'));
 assert.ok(fn.startsWith('function drawWalkDisplacement('));const commands=[],ctx=new Proxy({}, {get:(_,name)=>(...args)=>commands.push([name,...args]),set:(_,name,value)=>(commands.push([name,value]),true)});
 const walk=Object.freeze({positions:Object.freeze([10,-4])}),draw=new Function('ctx','paused','walk',fn+';return drawWalkDisplacement;')(ctx,true,walk);draw(x=>100+x*3,y=>80-y*3);
 assert.equal(commands[0][0],'save');assert.equal(commands.at(-1)[0],'restore');assert.equal(commands.filter(c=>c[0]==='stroke').length,2);assert.equal(commands.filter(c=>c[0]==='lineTo').length,1);
 const p=paints(commands);assert.deepEqual(p[0].path,[['moveTo',100,80],['lineTo',130,92]]);assert.deepEqual(p[0].path,p[1].path);
 assert.doesNotMatch(fn,/localStorage|sessionStorage|fetch\(|setTimeout|requestAnimationFrame|fill\(|\.rng|advanceWalk/);
 commands.length=0;new Function('ctx','paused','walk',fn+';return drawWalkDisplacement;')(ctx,false,walk)(x=>x,y=>y);assert.equal(commands.length,0);
});

test('fresh public pages request the contrast-safe distance overlay',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),src=html.match(/<script type="module" src="(app\.js\?[^"]+)"/)?.[1];assert.ok(src);
 assert.equal(new URL(src.replaceAll('&amp;','&'),'https://example.org').searchParams.get('walk-distance'),'contrast-1');
});
