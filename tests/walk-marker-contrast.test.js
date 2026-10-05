import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
import {createWalk,advanceWalk,walkStats} from '../walk.js';

const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const readings=h=>['metrics','walk-step-reading','walk-spread-reading','observation-a','observation-b','observation-c','walk-scale-reading'].map(id=>h.el(id).textContent);

function markers(h,{steps=64,seed=14,bias=0,width=600,height=414,paused=true}={}){
 const model=advanceWalk(createWalk(seed,bias),steps),stats=walkStats(model),center=stats.expectedX/2;
 let extentX=Math.max(30,Math.abs(center)+30),extentY=30;
 for(let i=0;i<model.positions.length;i+=2){extentX=Math.max(extentX,Math.abs(model.positions[i]-center)+6);extentY=Math.max(extentY,Math.abs(model.positions[i+1])+6);}
 for(let i=0;i<=model.steps;i++){extentX=Math.max(extentX,Math.abs(model.path[i*2]-center)+6);extentY=Math.max(extentY,Math.abs(model.path[i*2+1])+6);}
 const scale=Math.min((width-48)/(extentX*2),(height-76)/(extentY*2));
 const px=x=>width/2+(x-center)*scale,py=y=>height/2-y*scale,drawing=h.drawing();
 const label=drawing.findIndex(row=>row[0]==='strokeText'&&row[1]==='起点');
 assert.ok(label>=0,'the origin label gets a dark backing');
 const start=drawing.findLastIndex((row,i)=>i<label&&row[0]==='save'),end=drawing.findIndex((row,i)=>i>label&&row[0]==='restore');
 assert.ok(start>=0&&end>label,'all marker styles are isolated');
 const ops=drawing.slice(start,end+1),strokes=[],fills=[],texts=[];let path=[],state={};
 for(const [index,row] of ops.entries()){
  if(['strokeStyle','fillStyle','lineWidth','lineJoin','font','setLineDash'].includes(row[0]))state[row[0]]=row[1];
  if(row[0]==='beginPath')path=[];
  if(['arc','moveTo','lineTo'].includes(row[0]))path.push(row);
  if(row[0]==='stroke')strokes.push({index,path:structuredClone(path),...state});
  if(row[0]==='fill')fills.push({index,path:structuredClone(path),...state});
  if(['strokeText','fillText'].includes(row[0]))texts.push({index,row,...state});
 }
 assert.equal(strokes.length,paused?5:3);
 assert.equal(fills.length,1,'the origin ring stays hollow');
 let offset=0;
 if(paused){
  const origin=[['arc',px(0),py(0),6,0,Math.PI*2]];
  assert.deepEqual(strokes[0].path,origin);assert.deepEqual(strokes[1].path,origin);
  assert.equal(strokes[0].strokeStyle,'#122e29');assert.equal(strokes[0].lineWidth,4.5);
  assert.equal(strokes[1].strokeStyle,'#e7eee1');assert.equal(strokes[1].lineWidth,1.5);offset=2;
 }
 const mx=px(stats.meanX),my=py(stats.meanY),cross=[['moveTo',mx-7,my],['lineTo',mx+7,my],['moveTo',mx,my-7],['lineTo',mx,my+7]];
 assert.deepEqual(strokes[offset].path,cross);assert.deepEqual(strokes[offset+1].path,cross);
 assert.equal(strokes[offset].strokeStyle,'#122e29');assert.equal(strokes[offset].lineWidth,5);
 assert.equal(strokes[offset+1].strokeStyle,'#f59c80');assert.equal(strokes[offset+1].lineWidth,2);
 const representative=[['arc',px(model.positions[0]),py(model.positions[1]),4,0,Math.PI*2]];
 assert.deepEqual(strokes[offset+2].path,representative);assert.deepEqual(fills[0].path,representative);
 assert.equal(strokes[offset+2].strokeStyle,'#122e29');assert.equal(strokes[offset+2].lineWidth,4);
 assert.ok(strokes[offset+2].index<fills[0].index);assert.equal(fills[0].fillStyle,'#e7eee1');
 assert.deepEqual(texts.map(t=>t.row),[['strokeText','起点',px(0)+6,py(0)+17],['fillText','起点',px(0)+6,py(0)+17]]);
 assert.equal(texts[0].strokeStyle,'#122e29');assert.equal(texts[0].lineWidth,3);assert.equal(texts[1].fillStyle,'#a9bfab');
 assert.equal(texts[1].font,'11px sans-serif');assert.equal(texts[0].lineJoin,'round');
 assert.ok(texts[1].index<strokes[0].index,'all measurement shapes remain above the origin label, including overlapping endpoints');
 for(const stroke of strokes)assert.deepEqual(stroke.setLineDash,[],'measurement edges stay solid');
 const walkers=drawing.map((row,index)=>({row,index})).filter(({row})=>row[0]==='arc'&&row[3]===2.1);
 assert.equal(walkers.length,256);
 for(let i=0;i<walkers.length;i++){
  assert.deepEqual(walkers[i].row,['arc',px(model.positions[i*2]),py(model.positions[i*2+1]),2.1,0,Math.PI*2]);
  assert.ok(walkers[i].index<start,'all measurement anchors are above the sample cloud');
 }
 assert.equal(drawing[walkers.at(-1).index+1][0],'fill');
 assert.equal(drawing.filter(row=>row[0]==='arc'&&row[3]===6).length,paused?1:0,'no old origin ring remains below the cloud');
 assert.equal(ops.at(-1)[0],'restore');
 assert.equal(h.el('metrics').textContent,`256 位漫步者 · ${steps} 步 · 偏向 ${bias}%`);
 assert.equal(h.el('walk-spread-reading').textContent,`整群散开 · 第 ${steps} 步：实测 ${stats.spread.toFixed(2)} / 理论 ${stats.expectedSpread.toFixed(2)} 步长`);
 return ops;
}

test('Walk origin, centroid, tracked point and label retain geometry with contrasting edges above the cloud',async()=>{
 const h=await setup('?experiment=walk&at=v1,64');markers(h);
 const before=h.drawing(),text=readings(h),message=h.el('announcement').textContent;
 h.resize(600,414);assert.deepEqual(h.drawing(),before);assert.deepEqual(readings(h),text);assert.equal(h.el('announcement').textContent,message);
});

test('dark edges distinguish measurement colors from densely overlapping bright samples',()=>{
 const lum=hex=>hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
 assert.ok(contrast('e7eee1','d3f35b')<1.2,'the previous plain white point loses contrast over dense sample dots');
 assert.ok(contrast('f59c80','d3f35b')<2,'the previous centroid stroke also loses contrast');
 for(const color of ['e7eee1','f59c80','a9bfab'])assert.ok(contrast(color,'122e29')>6,'each foreground contrasts with the opaque edge');
});

test('marker sizes and model positions survive narrow, fractional and drift-expanded views',async()=>{
 for(const [seed,bias,steps] of [[14,0,16],[14,0,64],[42,25,512],[99,25,511]]){
  const h=await setup(`?experiment=walk&seed=${seed}&bias=${bias}&at=v1,${steps}`),message=h.el('announcement').textContent;
  for(const [width,height] of [[259,240],[334,240],[756,317.9375],[1200,900],[600,414]]){
   h.resize(width,height);markers(h,{seed,bias,steps,width,height});assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,0);
  }
 }
});

test('a representative returning to the origin remains exactly coincident without false offsets',async()=>{
 const h=await setup('?experiment=walk&seed=50&at=v1,16');markers(h,{steps:16,seed:50});
 assert.equal(h.el('walk-displacement').textContent,'0.00 步长');assert.match(h.el('walk-distance-note').textContent,/回到了起点/);
 const drawing=h.drawing(),origin=drawing.find(row=>row[0]==='arc'&&row[3]===6),point=drawing.find(row=>row[0]==='arc'&&row[3]===4);
 assert.deepEqual(origin.slice(1,3),point.slice(1,3));
 click(h,'walk-step-one');markers(h,{steps:17,seed:50});click(h,'walk-back');assert.deepEqual(h.drawing(),drawing);
});

test('single-step replay and both limits restore every marker and model point exactly',async()=>{
 for(const [seed,bias,steps] of [[14,0,16],[23,7,73],[42,25,511]]){
  const h=await setup(`?experiment=walk&seed=${seed}&bias=${bias}&at=v1,${steps}`);markers(h,{seed,bias,steps});const before=h.drawing();
  click(h,'walk-step-one');markers(h,{seed,bias,steps:steps+1});const next=h.drawing();
  click(h,'walk-back');assert.deepEqual(h.drawing(),before);click(h,'walk-step-one');assert.deepEqual(h.drawing(),next);
  if(steps===511){click(h,'walk-step-one');assert.deepEqual(h.drawing(),next);}
 }
 const h=await setup('?experiment=walk');markers(h,{steps:16});const before=h.drawing();click(h,'walk-back');assert.deepEqual(h.drawing(),before);
});

test('animation retains centroid and tracked-point contrast, pausing restores the hollow origin quietly',async()=>{
 const h=await setup('?experiment=walk','',false);markers(h,{steps:16,paused:false});const message=h.el('announcement').textContent;
 h.tick(0);h.tick(50);h.tick(100);markers(h,{steps:20,paused:false});assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,1);
 click(h,'pause');markers(h,{steps:20});const before=readings(h);click(h,'pause');markers(h,{steps:20,paused:false});assert.deepEqual(readings(h),before);
 h.motion.change({matches:true});markers(h,{steps:20});assert.equal(h.frames.size,0);
});

test('resets, presets, parameters, guides and comparisons use the current measured ensemble',async()=>{
 const h=await setup('?experiment=walk&seed=99&bias=25&at=v1,512');markers(h,{seed:99,bias:25,steps:512});
 click(h,'walk-16');markers(h,{seed:99,bias:25,steps:16});click(h,'walk-64');markers(h,{seed:99,bias:25,steps:64});
 h.key('ArrowRight');markers(h,{seed:99,bias:25,steps:80});h.key('Home');markers(h,{seed:99,bias:25,steps:16});
 input(h,'seed',50);markers(h,{seed:50,bias:25,steps:16});input(h,'bias',0);markers(h,{seed:50,steps:16});
 h.el('preset-select').handlers.change({target:{value:'another'}});click(h,'load-preset');markers(h,{seed:51,steps:16});
 click(h,'step');markers(h,{seed:51,steps:32});click(h,'reset');markers(h,{seed:51,steps:16});click(h,'guide-start');markers(h,{steps:16});
});

test('fixed observations, history and hidden-world resize restore the same measurement anchors',async()=>{
 const h=await setup('?experiment=walk&seed=42&bias=25&at=v1,73','#canvas');markers(h,{seed:42,bias:25,steps:73});await click(h,'share');
 const saved=h.el('share-link').value,before=h.drawing();click(h,'walk-back');assert.equal(h.el('share-link').value,saved);
 click(h,'observation-return');assert.deepEqual(h.drawing(),before);
 for(const index of [0,1,2,3]){h.tabs[index].handlers.click();h.resize(259,240);h.tabs[4].handlers.click();markers(h,{seed:42,bias:25,steps:73,width:259,height:240});}
 h.resize(600,414);assert.deepEqual(h.drawing(),before);h.navigate('?experiment=walk&seed=1&at=v1,16');markers(h,{seed:1,steps:16});h.navigate(saved);assert.deepEqual(h.drawing(),before);
});

test('visual measurement changes cannot earn or rewrite a discovery without an explicit successful check',async()=>{
 const h=await setup('?experiment=walk');click(h,'mission-start');click(h,'mission-check');click(h,'walk-64');markers(h);
 h.resize(259,240);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const notes=h.el('field-notes-list').innerHTML;click(h,'walk-step-one');click(h,'walk-back');markers(h,{width:259,height:240});h.resize(600,414);markers(h);assert.equal(h.el('field-notes-list').innerHTML,notes);
});

test('application and stylesheet assets retain explicit release versions',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(html.includes('src="app.js?v=saved-observation-copy-1&amp;source-probe=clear-1&amp;wave-bars=stable-1&amp;wave-ruler=probe-clear-1&amp;ruler-endpoint=clear-1&amp;wave-sources=paired-label-1&amp;preview-launcher=clear-1&amp;orbit-legend=compact-1&amp;vertex-label=inset-1&amp;walk-distance=contrast-1&amp;fractal-path=append-once-1&amp;legend-endpoint=clear-1&amp;walk-reference=contrast-1&amp;launcher=contrast-1&amp;orbit-target=exact-1&amp;walk-text=stable-1&amp;fractal-text=stable-1&amp;preview-caption=clear-1&amp;trial-text=stable-1&amp;cell-position=exact-1&amp;repeat=stable-evidence-1&amp;feedback=parameter-action-1&amp;drag-feedback=meaningful-action-1&amp;render=positive-scale-1&amp;orbit-marker=contrast-1&amp;cell-history=explain-1&amp;change-browse=2&amp;wave=quarter-rewind-1&amp;probe=usable-view-1&amp;launch=usable-view-1&amp;browse=living-cells-1&amp;seek=exact-count-1&amp;home=exact-orbit-1&amp;position=exact-wave-1&amp;replay=exact-walk-1&amp;target-reading=1&amp;checkpoint-reading=1&amp;time=exact-wave-1&amp;number=cn-target-glyphs-1&amp;fractal-limit=rewind-guidance-1&amp;canvas-pointer=loss-safe-1&amp;population=shared-1&amp;gap=count-once-1&amp;availability=quiet-1&amp;walk=read-once-1&amp;life=record-once-1&amp;history=read-once-1&amp;colors=wave-once-1&amp;orbit-fit=first-body-1&amp;canvas-start=retry-1&amp;sampling=wave-field-fallback-1&amp;nudge=single-enter-1&amp;walk-batch=reverse-1&amp;fractal-batch=reverse-1&amp;cycle=disclosure-1&amp;coordinate-draft=current-1&amp;life-draft=current-1&amp;bar-drawer=idle-1&amp;time-draft=current-1&amp;count-draft=current-1&amp;life-batch=recorded-1"'));assert.ok(html.includes('href="style.css?v=saved-observation-copy-1&amp;orbit-target=exact-1&amp;cell-position=exact-1&amp;cell-history=explain-1&amp;change-browse=2&amp;browse=living-cells-1&amp;seek=exact-count-1&amp;wave=quarter-rewind-1&amp;position=exact-wave-1&amp;replay=exact-walk-1&amp;target-reading=1&amp;time=exact-wave-1&amp;instruments=narrow-reflow-1&amp;worlds-return=1&amp;life-grid=flexible-1&amp;orbit-fit=first-body-1&amp;canvas-start=retry-1&amp;life-inspector=stack-1&amp;walk-probability=stack-1&amp;coordinate-draft=current-1&amp;life-batch=recorded-1"'));
});
