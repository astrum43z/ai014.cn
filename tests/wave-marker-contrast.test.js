import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const reading=h=>['metrics','wave-probe-reading','wave-instant-reading','wave-distances','wave-difference','wave-envelope'].map(id=>h.el(id).textContent);
function markers(h,width=600,height=414,x=0,y=0,separation=100,scale=Math.min(width,height)/280){
 const drawing=h.drawing(),labelIndex=drawing.findIndex(row=>row[0]==='strokeText'&&['A','A / B'].includes(row[1]));
 assert.ok(labelIndex>0,'A gets a dark text outline before its light fill');
 const start=drawing.findLastIndex((row,i)=>i<labelIndex&&row[0]==='save'),end=drawing.findIndex((row,i)=>i>labelIndex&&row[0]==='restore');
 assert.ok(start>=0&&end>labelIndex,'marker styles stay inside their own save/restore');
 const ops=drawing.slice(start,end+1),strokes=[],fills=[],texts=[];let path=[],state={};
 for(const row of ops){
  if(['strokeStyle','fillStyle','lineWidth','lineJoin','font','setLineDash'].includes(row[0]))state[row[0]]=row[1];
  if(row[0]==='beginPath')path=[];
  if(['arc','moveTo','lineTo'].includes(row[0]))path.push(row);
  if(row[0]==='stroke')strokes.push({index:ops.indexOf(row),path:structuredClone(path),...state});
  if(row[0]==='fill')fills.push({index:ops.indexOf(row),path:structuredClone(path),...state});
  if(['strokeText','fillText'].includes(row[0]))texts.push({row,...state});
 }
 assert.equal(strokes.length,4);assert.equal(fills.length,2,'probe stays hollow');
 for(const [i,sign] of [-1,1].entries()){
  const sourceX=width/2+sign*separation/2*scale,sourceY=height/2;
  assert.deepEqual(strokes[i].path,[['arc',sourceX,sourceY,4,0,Math.PI*2]]);
  assert.ok(strokes[i].index<fills[i].index,'source backing is painted before its light fill');
  assert.deepEqual(fills[i].path,strokes[i].path);assert.equal(fills[i].fillStyle,'#f4f5eb');
  assert.equal(strokes[i].strokeStyle,'#122e29');assert.equal(strokes[i].lineWidth,4);
  if(separation*scale>=17){
  const probeX=width/2+x*scale,probeY=height/2+y*scale;
  const overlaps=probeX+16.5>=sourceX-6&&probeX-16.5<=sourceX+9&&probeY+16.5>=sourceY-25&&probeY-16.5<=sourceY-7;
  const baseline=sourceY+(overlaps?32:-12);
  assert.deepEqual(texts[i*2].row,['strokeText','AB'[i],sourceX-4,baseline]);
  assert.deepEqual(texts[i*2+1].row,['fillText','AB'[i],sourceX-4,baseline]);
  assert.equal(texts[i*2].strokeStyle,'#122e29');assert.equal(texts[i*2].lineWidth,4);
  assert.equal(texts[i*2+1].fillStyle,'#f4f5eb');assert.equal(texts[i*2+1].font,'11px sans-serif');
  }
 }
 if(separation*scale<17){
  assert.deepEqual(texts.map(t=>t.row),[['strokeText','A / B',(width-55)/2,height/2-12,width-8],['fillText','A / B',(width-55)/2,height/2-12,width-8]]);
  assert.equal(texts[0].lineWidth,4);assert.equal(texts[0].strokeStyle,'#122e29');assert.equal(texts[1].fillStyle,'#f4f5eb');
 }
 const px=width/2+x*scale,py=height/2+y*scale;
 assert.deepEqual(strokes[2].path,[['arc',px,py,9,0,Math.PI*2],['moveTo',px-14,py],['lineTo',px+14,py],['moveTo',px,py-14],['lineTo',px,py+14]]);
 assert.deepEqual(strokes[3].path,strokes[2].path,'one exact path is stroked twice');
 assert.equal(strokes[2].strokeStyle,'#122e29');assert.equal(strokes[2].lineWidth,5);
 assert.equal(strokes[3].strokeStyle,'#fff');assert.equal(strokes[3].lineWidth,1);
 for(const stroke of strokes)assert.deepEqual(stroke.setLineDash,[],'no dashed measuring path leaks into the marker');
 const ruler=drawing.findIndex(row=>row[0]==='fillText'&&/模型单位$/.test(row[1]));
 assert.ok(ruler<start,'markers remain above the scale and measuring lines');
 assert.equal(ops.at(-1)[0],'restore');
 return ops;
}

test('Wave source dots, A/B text and hollow probe retain exact geometry with contrasting backings',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,0');markers(h);
 const original=markers(h),texts=reading(h);h.resize(600,414);assert.deepEqual(markers(h),original);assert.deepEqual(reading(h),texts);
 click(h,'wave-right');markers(h,600,414,2,0);click(h,'wave-up');markers(h,600,414,2,-2);
 click(h,'wave-home');assert.deepEqual(markers(h),original);
});

test('both contrast edges remain identical at bright, dark, positive and negative phases',async()=>{
 const h=await setup('?experiment=wave&at=v1,0,0,0'),original=markers(h);const seen=[];
 for(let i=0;i<5;i++){seen.push(h.el('wave-instant-reading').textContent);assert.deepEqual(markers(h),original);click(h,'step');}
 assert.ok(seen.some(x=>x.includes('+0.92')));assert.ok(seen.some(x=>x.includes('-0.92')));
 h.navigate('?experiment=wave&at=v1,8,0,0');const cancellation=markers(h,600,414,8,0);
 for(let i=0;i<4;i++){click(h,'step');assert.deepEqual(markers(h,600,414,8,0),cancellation);assert.match(h.el('wave-instant-reading').textContent,/0.00$/);}
 const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
 assert.ok(contrast([255,255,255],[193,223,96])<1.6,'plain white lost contrast on the brightest field');
 assert.ok(contrast([244,245,235],[18,46,41])>12,'source and letter foregrounds contrast with their opaque outline');
 assert.ok(contrast([255,255,255],[18,46,41])>12);
});

test('screen-size halos survive narrow, fractional and extreme fitted views without moving probes',async()=>{
 for(const [x,y] of [[0,0],[8,0],[800,-300],[-10000,10000]]){
  const h=await setup(`?experiment=wave&at=v1,${x},${y},2.5`),before=reading(h),message=h.el('announcement').textContent;
  for(const [w,z] of [[600,414],[756,317.9375],[259,240],[334,240],[1200,900]]){
   h.resize(w,z);const scale=Math.min(Math.min(w,z)/280,(w/2-18)/Math.max(1,Math.abs(x)),(z/2-18)/Math.max(1,Math.abs(y)));
   markers(h,w,z,x,y,100,scale);assert.deepEqual(reading(h),before);assert.equal(h.el('announcement').textContent,message);
  }
 }
});

test('markers remain quiet during animation, pause and reduced motion',async()=>{
 const h=await setup('?experiment=wave','',false),original=markers(h),message=h.el('announcement').textContent;
 h.tick(0);for(let i=1;i<=12;i++){h.tick(i*50);assert.deepEqual(markers(h),original);}
 assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,1);
 h.motion.change({matches:true});assert.equal(h.frames.size,0);assert.deepEqual(markers(h),original);
 click(h,'pause');h.tick(0);h.tick(50);click(h,'pause');assert.deepEqual(markers(h),original);assert.equal(h.frames.size,0);
});

test('parameters, preset replacement and reset use current source positions with the same marker shape',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,0');
 for(const separation of [20,180,100]){input(h,'separation',separation);markers(h,600,414,8,0,separation);}
 input(h,'wavelength',70);markers(h,600,414,8,0);
 h.el('preset-select').handlers.change({target:{value:'wide'}});click(h,'load-preset');markers(h,600,414,0,0,150);
 click(h,'guide-start');markers(h,600,414,8,0);click(h,'reset');markers(h);
});

test('retained tabs, saved checkpoints and history preserve readings independently of the visual outline',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,2.5','#canvas');await click(h,'share');const saved=h.el('share-link').value;
 click(h,'wave-right');const live=reading(h),original=markers(h,600,414,10,0);
 for(const world of ['orbit','life','fractal','walk']){
  click(h,'tab-'+world);assert.ok(!h.drawing().some(row=>row[0]==='strokeText'&&row[1]==='A'));
  click(h,'tab-wave');assert.deepEqual(reading(h),live);assert.deepEqual(markers(h,600,414,10,0),original);
 }
 assert.equal(h.el('share-link').value,saved);assert.equal(location.href,saved);
 h.navigate(saved.replace('#canvas','#observation-title'));assert.deepEqual(reading(h),live);
 click(h,'observation-return');markers(h,600,414,8,0);
 h.navigate('?experiment=wave&separation=20&at=v1,0,0,0');markers(h,600,414,0,0,20);h.navigate(saved);markers(h,600,414,8,0);
});

test('visual measurement never completes a discovery and preserves already earned notebook evidence',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');markers(h,600,414,8,0);click(h,'mission-check');click(h,'wave-home');markers(h);
 assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const notes=h.el('field-notes-list').innerHTML,result=h.el('mission-result').textContent;
 click(h,'step');click(h,'wave-right');h.resize(259,240);markers(h,259,240,2,0);
 assert.equal(h.el('field-notes-list').innerHTML,notes);assert.equal(h.el('mission-result').textContent,result);
});

test('marker rendering retains explicit asset versions and adds no live messages',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.ok(html.includes('src="app.js?v=saved-observation-copy-1&amp;source-probe=clear-1&amp;wave-bars=stable-1&amp;wave-ruler=probe-clear-1&amp;ruler-endpoint=clear-1&amp;wave-sources=paired-label-1&amp;preview-launcher=clear-1&amp;orbit-legend=compact-1&amp;vertex-label=inset-1&amp;walk-distance=contrast-1&amp;fractal-path=append-once-1&amp;legend-endpoint=clear-1&amp;walk-reference=contrast-1&amp;launcher=contrast-1&amp;orbit-target=exact-1&amp;walk-text=stable-1&amp;fractal-text=stable-1&amp;preview-caption=clear-1&amp;trial-text=stable-1&amp;cell-position=exact-1&amp;repeat=stable-evidence-1&amp;feedback=parameter-action-1&amp;drag-feedback=meaningful-action-1&amp;render=positive-scale-1&amp;orbit-marker=contrast-1&amp;cell-history=explain-1&amp;change-browse=2&amp;wave=quarter-rewind-1&amp;probe=usable-view-1&amp;launch=usable-view-1&amp;browse=living-cells-1&amp;seek=exact-count-1&amp;home=exact-orbit-1&amp;position=exact-wave-1&amp;replay=exact-walk-1&amp;target-reading=1&amp;checkpoint-reading=1&amp;time=exact-wave-1&amp;number=cn-target-glyphs-1&amp;fractal-limit=rewind-guidance-1&amp;canvas-pointer=loss-safe-1&amp;population=shared-1&amp;gap=count-once-1&amp;availability=quiet-1&amp;walk=read-once-1&amp;life=record-once-1&amp;history=read-once-1&amp;colors=wave-once-1&amp;orbit-fit=first-body-1&amp;canvas-start=retry-1&amp;sampling=wave-field-fallback-1&amp;nudge=single-enter-1&amp;walk-batch=reverse-1&amp;fractal-batch=reverse-1&amp;cycle=disclosure-1"'));assert.ok(html.includes('href="style.css?v=saved-observation-copy-1&amp;orbit-target=exact-1&amp;cell-position=exact-1&amp;cell-history=explain-1&amp;change-browse=2&amp;browse=living-cells-1&amp;seek=exact-count-1&amp;wave=quarter-rewind-1&amp;position=exact-wave-1&amp;replay=exact-walk-1&amp;target-reading=1&amp;time=exact-wave-1&amp;instruments=narrow-reflow-1&amp;worlds-return=1&amp;life-grid=flexible-1&amp;orbit-fit=first-body-1&amp;canvas-start=retry-1&amp;life-inspector=stack-1&amp;walk-probability=stack-1"'));
 const helper=app.slice(app.indexOf('function drawWaveMarkers'),app.indexOf('// Paused measuring lines'));
 assert.doesNotMatch(helper,/announce\(|\.textContent|addEventListener|setTimeout|requestAnimationFrame/);
});
