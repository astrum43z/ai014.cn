import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
import {createFractal,addFractalPoints,fractalVertices} from '../fractal.js';
import {centralGapCount} from '../missions.js';

const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
function operations(drawing){
 let state={setLineDash:[]},path=[],stack=[];const strokes=[],fills=[];
 for(const [index,row] of drawing.entries()){
  if(row[0]==='save')stack.push(structuredClone(state));
  if(row[0]==='restore')state=stack.pop();
  if(['strokeStyle','fillStyle','lineWidth','setLineDash'].includes(row[0]))state[row[0]]=row[1];
  if(row[0]==='beginPath')path=[];
  if(['arc','rect','moveTo','lineTo','closePath'].includes(row[0]))path.push(row);
  if(row[0]==='stroke')strokes.push({index,path:structuredClone(path),...structuredClone(state)});
  if(row[0]==='fill')fills.push({index,path:structuredClone(path),...structuredClone(state)});
 }
 return {strokes,fills};
}
function check(h,{count=12000,seed=14,jump=38,width=600,height=414,paused=true}={}){
 const model=addFractalPoints(createFractal(seed,jump),count),drawing=h.drawing(),{strokes,fills}=operations(drawing);
 const scale=Math.min(width/2.1,height/1.85),cx=width/2,cy=height/2+scale*.25;
 const x=v=>cx+v*scale,y=v=>cy+v*scale;
 const sample=fills.find(s=>s.path.length===count&&s.path[0][0]==='rect');assert.ok(sample,'all seeded points remain visible in the model layer');
 for(let i=0;i<count;i++)assert.deepEqual(sample.path[i],['rect',x(model.points[i*2]),y(model.points[i*2+1]),1.3,1.3]);
 const reference=strokes.filter(s=>JSON.stringify(s.setLineDash)==='[3,5]');assert.equal(reference.length,2);
 const triangle=fractalVertices.map(([vx,vy],i)=>{const next=fractalVertices[(i+1)%3];return [i?'lineTo':'moveTo',x((vx+next[0])/2),y((vy+next[1])/2)];});triangle.push(['closePath']);
 function pair(rows,path,color,backWidth,width,dash){
  assert.equal(rows.length,2);assert.deepEqual(rows[0].path,path);assert.deepEqual(rows[1].path,path);
  assert.equal(rows[0].strokeStyle,'#122e29');assert.equal(rows[0].lineWidth,backWidth);
  assert.equal(rows[1].strokeStyle,color);assert.equal(rows[1].lineWidth,width);
  assert.deepEqual(rows[0].setLineDash,dash);assert.deepEqual(rows[1].setLineDash,dash);
  assert.ok(rows[0].index<rows[1].index);assert.ok(sample.index<rows[0].index);
 }
 pair(reference,triangle,'#8bbaca',3,1,[3,5]);assert.ok(!fills.some(s=>JSON.stringify(s.path)===JSON.stringify(triangle)),'central region stays unfilled');
 const trace=strokes.filter(s=>JSON.stringify(s.setLineDash)==='[4,4]');
 if(paused){
  const [vx,vy]=fractalVertices[model.lastVertex],from=['moveTo',x(model.previousX),y(model.previousY)];
  pair(trace,[from,['lineTo',x(vx),y(vy)]],'#d9e4cf',4,1,[4,4]);assert.ok(reference[1].index<trace[0].index);
  const segment=strokes.filter(s=>s.path.length===2&&s.path[0][0]==='moveTo'&&s.path[1][0]==='lineTo'&&s.setLineDash.length===0);
  pair(segment,[from,['lineTo',x(model.x),y(model.y)]],'#ffac86',5,2,[]);assert.ok(trace[1].index<segment[0].index);
  const arcs=r=>strokes.filter(s=>s.path.length===1&&s.path[0][0]==='arc'&&s.path[0][3]===r);
  const previous=arcs(5);assert.equal(previous.length,1);assert.deepEqual(previous[0].path,[['arc',x(model.previousX),y(model.previousY),5,0,Math.PI*2]]);
  assert.equal(previous[0].strokeStyle,'#e7eee1');assert.equal(previous[0].lineWidth,2);
  const hollow=fills.find(s=>s.path[0]?.[0]==='arc'&&s.path[0][3]===5);assert.equal(hollow.fillStyle,'#122e29');assert.ok(segment[1].index<hollow.index&&hollow.index<previous[0].index);
  const landing=arcs(4);assert.equal(landing.length,1);assert.deepEqual(landing[0].path,[['arc',x(model.x),y(model.y),4,0,Math.PI*2]]);assert.equal(landing[0].strokeStyle,'#122e29');assert.equal(landing[0].lineWidth,4);
  const point=fills.find(s=>s.path.length===1&&s.fillStyle==='#ffac86');assert.deepEqual(point.path,landing[0].path);assert.ok(previous[0].index<landing[0].index&&landing[0].index<point.index);
  pair(arcs(8),[['arc',x(vx),y(vy),8,0,Math.PI*2]],'#ffac86',5,2,[]);assert.ok(point.index<arcs(8)[0].index);
 }else{assert.equal(trace.length,0);assert.equal(strokes.filter(s=>s.path[0]?.[0]==='arc').length,0);}
 const vertices=fills.filter(s=>s.path.length===1&&s.path[0][0]==='arc'&&s.path[0][3]===4&&s.fillStyle!=='#ffac86');assert.equal(vertices.length,3);
 vertices.forEach((v,i)=>assert.deepEqual(v.path,[['arc',x(fractalVertices[i][0]),y(fractalVertices[i][1]),4,0,Math.PI*2]]));
 assert.equal(h.el('metrics').textContent,`${count} 个点 · 前进 ${jump}% · 种子 ${seed}`);
 assert.equal(h.el('fractal-gap-reading').textContent,`中央参考区 · 内部 ${centralGapCount(model)} / ${count} 点`);
 return drawing;
}

test('dense Fractal reference and final-jump guides use matching narrow dark edges without moving any sample',async()=>{
 const h=await setup('?experiment=fractal&jump=38&seed=14&at=v1,12000');check(h);
});

test('guide colors contrast with the opaque edge where direct sample contrast is weak',()=>{
 const lum=hex=>hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
 for(const color of ['8bbaca','d9e4cf','ffac86']){assert.ok(ratio(color,'d3f35b')<1.7);assert.ok(ratio(color,'122e29')>6.8);}
});

test('screen-size edges retain exact geometry for narrow and fractional views across jump ratios',async()=>{
 for(const [seed,jump,count] of [[14,38,12000],[23,50,1000],[99,70,301],[1,35,731]]){
  const h=await setup(`?experiment=fractal&jump=${jump}&seed=${seed}&at=v1,${count}`),message=h.el('announcement').textContent;
  for(const [width,height] of [[259,240],[334,240],[756,317.9375],[1200,900],[600,414]]){h.resize(width,height);check(h,{seed,jump,count,width,height});assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,0);}
 }
});

test('rewind and advance reproduce all measuring geometry exactly at both limits',async()=>{
 for(const [seed,jump,count] of [[14,38,11999],[23,50,1000],[99,70,300]]){
  const h=await setup(`?experiment=fractal&jump=${jump}&seed=${seed}&at=v1,${count}`);const before=check(h,{seed,jump,count});
  click(h,'fractal-forward');const next=check(h,{seed,jump,count:count+1});click(h,'fractal-back');assert.deepEqual(h.drawing(),before);
  h.key('ArrowRight');assert.deepEqual(h.drawing(),next);h.key('ArrowLeft');assert.deepEqual(h.drawing(),before);
  if(count===300){click(h,'fractal-back');assert.deepEqual(h.drawing(),before);}else if(count===11999){click(h,'fractal-forward');click(h,'fractal-forward');assert.deepEqual(h.drawing(),next);}
 }
});

test('animation retains only the reference and restores jump guides quietly when paused',async()=>{
 const h=await setup('?experiment=fractal&jump=38','',false);check(h,{count:300,paused:false});const message=h.el('announcement').textContent;
 h.tick(0);h.tick(50);h.tick(100);check(h,{count:400,paused:false});assert.equal(h.el('announcement').textContent,message);
 click(h,'pause');const before=check(h,{count:400}),reading=h.el('fractal-touch-reading').textContent;click(h,'pause');check(h,{count:400,paused:false});
 h.motion.change({matches:true});assert.deepEqual(h.drawing(),before);assert.equal(h.frames.size,0);assert.equal(h.el('fractal-touch-reading').textContent,reading);
});

test('resizing is quiet and resets, presets and parameters update the same current model',async()=>{
 const h=await setup('?experiment=fractal&jump=38&seed=14&at=v1,12000'),before=check(h),message=h.el('announcement').textContent;
 const el=h.el('fractal-gap-reading');let value=el.textContent,writes=0;Object.defineProperty(el,'textContent',{get:()=>value,set:next=>{value=next;writes++;}});
 h.resize(600,414);assert.deepEqual(h.drawing(),before);assert.equal(writes,0);assert.equal(h.el('announcement').textContent,message);
 click(h,'reset');check(h,{count:300});input(h,'seed',23);check(h,{count:300,seed:23});input(h,'jump',50);check(h,{count:300,seed:23,jump:50});
 h.el('preset-select').handlers.change({target:{value:'islands'}});click(h,'load-preset');check(h,{count:300,seed:23,jump:65});click(h,'fractal-1000');check(h,{count:1000,seed:23,jump:65});
 click(h,'guide-start');check(h,{count:300,jump:50});
});

test('fixed observations, hidden-world resize and history restore the same reference and jump',async()=>{
 const h=await setup('?experiment=fractal&jump=38&seed=14&at=v1,12000','#canvas');const before=check(h);await click(h,'share');const url=h.el('share-link').value;
 click(h,'fractal-back');check(h,{count:11999});assert.equal(h.el('share-link').value,url);click(h,'observation-return');assert.deepEqual(h.drawing(),before);
 for(const mode of ['orbit','life','wave','walk']){click(h,'tab-'+mode);h.resize(259,240);click(h,'tab-fractal');check(h,{width:259,height:240});}
 h.resize(600,414);assert.deepEqual(h.drawing(),before);h.navigate('?experiment=fractal&jump=65&seed=23&at=v1,731');check(h,{jump:65,seed:23,count:731});h.navigate(url);assert.deepEqual(h.drawing(),before);
});

test('guides never earn discoveries or change saved notebook evidence without an explicit check',async()=>{
 const h=await setup('?experiment=fractal');click(h,'mission-start');click(h,'fractal-1000');check(h,{jump:50,count:1000});assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'mission-check');input(h,'seed',15);click(h,'fractal-1000');check(h,{jump:50,count:1000,seed:15});assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('field-notes-list').innerHTML;
 input(h,'jump',38);click(h,'fractal-1000');check(h,{count:1000,seed:15});click(h,'fractal-back');click(h,'fractal-forward');h.resize(259,240);assert.equal(h.el('field-notes-list').innerHTML,notes);
});

test('the new application asset keeps the existing stylesheet and has no new controls',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.ok(html.includes('app.js?v=preset-key-1'));assert.ok(html.includes('style.css?v=focus-safe-copy-1'));
});
