import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
// Separate BigInt recurrence and scalar moments; no production walk helpers.
function oracle(seed,bias,steps,width=600,height=414){
 let rng=BigInt(seed);const positions=Array.from({length:256},()=>[0,0]),path=[[0,0]];
 for(let n=0;n<steps;n++){
  for(const point of positions){rng=(1664525n*rng+1013904223n)%4294967296n;const u=Number(rng)/4294967296;
   if(u<.25+bias/200)point[0]++;else if(u<.5)point[0]--;else if(u<.75)point[1]++;else point[1]--;}
  path.push([...positions[0]]);
 }
 const expectedX=steps*bias/100,center=expectedX/2;
 let extentX=Math.max(30,Math.abs(center)+30),extentY=30;
 for(const [x,y] of [...positions,...path]){extentX=Math.max(extentX,Math.abs(x-center)+6);extentY=Math.max(extentY,Math.abs(y)+6);}
 const scale=Math.min((width-48)/(2*extentX),(height-76)/(2*extentY));
 const px=x=>width/2+(x-center)*scale,py=y=>height/2-y*scale;
 return {positions,path,scale,px,py,x:px(expectedX),y:py(0),radius:Math.sqrt(steps*(1-(bias/100)**2))*scale};
}
function paints(commands){
 let style={},path=[];const stack=[],result=[];
 commands.forEach(([name,...args],index)=>{
  if(name==='save')stack.push({...style});else if(name==='restore')style=stack.pop();
  else if(['strokeStyle','fillStyle','lineWidth'].includes(name))style[name]=args[0];
  else if(name==='setLineDash')style.dash=args[0];else if(name==='beginPath')path=[];
  else if(['moveTo','lineTo','arc'].includes(name))path.push([name,...args]);
  else if(name==='stroke'||name==='fill')result.push({name,index,style:{...style},path:structuredClone(path)});
 });return result;
}
function check(h,{seed=14,bias=0,steps=16,width=600,height=414}={}){
 const model=oracle(seed,bias,steps,width,height),all=paints(h.drawing());
 const ring=all.filter(p=>p.name==='stroke'&&JSON.stringify(p.style.dash)==='[4,5]');
 assert.equal(ring.length,2,'the reference has a dark casing and a lilac foreground');
 for(const [i,p] of ring.entries()){
  assert.equal(p.path.length,1);const [name,x,y,r,a,b]=p.path[0];assert.equal(name,'arc');near(x,model.x);near(y,model.y);near(r,model.radius);assert.equal(a,0);assert.equal(b,Math.PI*2);
  assert.equal(p.style.strokeStyle,i?'#c7b1e8':'#122e29');assert.equal(p.style.lineWidth,i?1:3);
 }
 assert.deepEqual(ring[0].path,ring[1].path);
 const samples=all.find(p=>p.name==='fill'&&p.path.filter(c=>c[0]==='arc'&&c[3]===2.1).length===256);assert.ok(samples);
 const arcs=samples.path.filter(c=>c[0]==='arc');arcs.forEach((c,i)=>{near(c[1],model.px(model.positions[i][0]));near(c[2],model.py(model.positions[i][1]));});
 assert.ok(samples.index<ring[0].index&&ring[0].index<ring[1].index,'reference remains above all samples');
 const representative=all.find(p=>p.name==='fill'&&p.style.fillStyle==='#e7eee1'&&p.path[0]?.[3]===4);assert.ok(representative.index>ring[1].index,'exact measured markers keep priority');
 const origin=all.find(p=>p.name==='stroke'&&p.path[0]?.[0]==='arc'&&p.path[0][3]===6);if(origin)assert.ok(origin.index>ring[1].index);
 assert.ok(!all.some(p=>p.name==='fill'&&JSON.stringify(p.path)===JSON.stringify(ring[0].path)),'the reference stays hollow');
 return model;
}
const readings=h=>['metrics','walk-step-reading','walk-spread-reading','observation-a','observation-b','observation-c','walk-scale-reading','notes-count'].map(id=>h.el(id).textContent);

test('default Walk reference keeps its exact circle above overlapping samples',async()=>{
 const h=await setup('?experiment=walk');h.resize(767,317.9375);const m=check(h,{width:767,height:317.9375});
 // The right cardinal point is part of the first dash and occupied by a sample.
 assert.ok(m.positions.some(([x,y])=>x===4&&y===0));near(m.radius,16.129166666666666);
 const before=readings(h),message=h.el('announcement').textContent;for(let i=0;i<20;i++)h.resize(767,317.9375);check(h,{width:767,height:317.9375});assert.deepEqual(readings(h),before);assert.equal(h.el('announcement').textContent,message);
});

test('reference geometry uses the theoretical center and spread for biased and unbiased ensembles',async()=>{
 for(const [seed,bias,steps] of [[14,0,64],[42,25,512],[99,7,137],[50,0,16]]){
  const h=await setup(`?experiment=walk&seed=${seed}&bias=${bias}&at=v1,${steps}`);check(h,{seed,bias,steps});
  const before=h.drawing();if(steps<512){click(h,'walk-step-one');check(h,{seed,bias,steps:steps+1});click(h,'walk-back');assert.deepEqual(h.drawing(),before);}
 }
});

test('narrow fractional fitted and density layouts retain fixed CSS widths and exact model points',async()=>{
 const h=await setup('?experiment=walk&seed=42&bias=25&at=v1,512'),before=readings(h),message=h.el('announcement').textContent;
 for(const [width,height] of [[171,240],[259,240],[284.5,260.25],[600,414],[767,317.9375],[1200,560]])for(const dpr of [1,1.25,2,3]){h.resize(width,height);h.setDpr(dpr);check(h,{seed:42,bias:25,steps:512,width,height});assert.deepEqual(readings(h).slice(0,6),before.slice(0,6));assert.equal(h.el('announcement').textContent,message);}
});

test('running animation and pause change the ensemble normally while the reference stays visible',async()=>{
 const h=await setup('?experiment=walk','',false);check(h);const message=h.el('announcement').textContent;h.tick(0);h.tick(50);h.tick(100);check(h,{steps:20});assert.equal(h.el('announcement').textContent,message);
 click(h,'pause');check(h,{steps:20});const before=h.drawing();click(h,'walk-step-one');check(h,{steps:21});click(h,'walk-back');assert.deepEqual(h.drawing(),before);
});

test('fixed checkpoint return and undo preserve exact subsequent seeded positions and sharing',async()=>{
 const h=await setup('?experiment=walk&seed=23&bias=7&at=v1,73');check(h,{seed:23,bias:7,steps:73});click(h,'step');check(h,{seed:23,bias:7,steps:89});const before=h.drawing();
 click(h,'observation-return');check(h,{seed:23,bias:7,steps:73});click(h,'observation-undo');assert.deepEqual(h.drawing(),before);
 await click(h,'share');assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),'v1,89');check(h,{seed:23,bias:7,steps:89});click(h,'walk-step-one');check(h,{seed:23,bias:7,steps:90});
});

test('focus world retention and simulated context interruption do not change reference or model',async()=>{
 const h=await setup('?experiment=walk&at=v1,64');check(h,{steps:64});const before=h.drawing(),text=readings(h),message=h.el('announcement').textContent;h.el('walk-step-one').focus();
 h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();h.loseContext();h.restoreContext();h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);
 assert.deepEqual(h.drawing(),before);assert.deepEqual(readings(h),text);assert.equal(h.el('announcement').textContent,message);assert.equal(document.activeElement,h.el('walk-step-one'));
 for(const world of ['orbit','life','wave','fractal']){click(h,'tab-'+world);click(h,'tab-walk');assert.deepEqual(h.drawing(),before);assert.deepEqual(readings(h),text);}
});

test('collapsed and absent bitmap skip the reference without interrupting text or recovery',async()=>{
 const h=await setup('?experiment=walk&at=v1,64','',true,1,false);assert.equal(h.drawCount(),0);assert.match(h.el('metrics').textContent,/64 步/);h.setContextReady(true);click(h,'canvas-retry');check(h,{steps:64});
 const before=h.drawing();for(const [w,z] of [[0,414],[600,0],[48,76]]){h.resize(w,z);assert.ok(!paints(h.drawing()).some(p=>JSON.stringify(p.style.dash)==='[4,5]'));}
 h.resize(600,414);assert.deepEqual(h.drawing(),before);
});

test('explicit discoveries captures and intentional primary batch repeats retain their behavior',async()=>{
 const h=await setup('?experiment=walk');click(h,'mission-start');click(h,'mission-check');click(h,'walk-64');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');check(h,{steps:64});const notes=h.el('notes-text').value;
 let captured=false;h.el('canvas').toBlob=cb=>{captured=true;check(h,{steps:64});cb(null);};click(h,'save');assert.ok(captured);
 for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional batch repeat suppressed');}});click(h,'step');}check(h,{steps:96});assert.equal(h.el('notes-text').value,notes);
 click(h,'tab-fractal');for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional batch repeat suppressed');}});click(h,'step');}assert.match(h.el('metrics').textContent,/500 个点/);
});

test('the new circle isolates its styling and adds only one casing stroke without filling the reference',()=>{
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');assert.match(source,/function drawWalkReference\(/);
 const fn=source.slice(source.indexOf('function drawWalkReference('),source.indexOf('// Measurements must stay identifiable'));
 const commands=[],ctx=new Proxy({}, {get:(_,name)=>(...args)=>commands.push([name,...args]),set:(_,name,value)=>(commands.push([name,value]),true)});
 const draw=new Function('ctx',fn+';return drawWalkReference;')(ctx);draw(x=>20+x*3,y=>40-y*3,{expectedX:7,expectedSpread:5},3);
 assert.equal(commands[0][0],'save');assert.equal(commands.at(-1)[0],'restore');assert.equal(commands.filter(c=>c[0]==='stroke').length,2);assert.ok(!commands.some(c=>['fill','fillRect','fillText'].includes(c[0])));
 const pair=paints(commands);assert.deepEqual(pair[0].path,[['arc',41,40,15,0,Math.PI*2]]);assert.deepEqual(pair[0].path,pair[1].path);
});

test('fresh public pages request the contrast-safe reference module',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),src=html.match(/<script type="module" src="(app\.js\?[^"]+)"/)?.[1];assert.ok(src);assert.equal(new URL(src.replaceAll('&amp;','&'),'https://example.org').searchParams.get('walk-reference'),'contrast-1');
});
