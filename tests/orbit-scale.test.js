import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const reading=h=>h.el('orbit-scale-reading').textContent;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
const model=h=>({metrics:h.el('metrics').textContent,measured:h.el('orbit-measured-reading').textContent,launch:h.el('orbit-touch-reading').textContent,preview:h.el('orbit-preview-reading').textContent,url:location.href,notes:h.el('field-notes-list').innerHTML,result:h.el('mission-result').textContent});
function check(h,width=600,height=414,view={x:140,y:0}){
 const marks=h.drawing(),s=Math.min(Math.min(width,height)/450,(width/2-34)/Math.max(1,Math.abs(view.x)),(height/2-34)/Math.max(1,Math.abs(view.y)));
 near(marks.find(row=>row[0]==='scale')[1],s);
 const labelIndex=marks.findIndex(row=>row[0]==='fillText'&&/^\d+(?:\.\d+)? 模型单位$/.test(row[1]));
 assert.ok(labelIndex>=0,'Orbit labels the actual model-unit scale');
 const start=marks.findLastIndex((row,i)=>i<labelIndex&&row[0]==='save'),end=marks.findIndex((row,i)=>i>labelIndex&&row[0]==='restore');
 const ops=marks.slice(start,end+1),label=marks[labelIndex],units=Number(label[1].split(' ')[0]);
 const left=-width/(2*s)+22/s,bottom=height/(2*s)-22/s;
 near(label[2],left);near(label[3],bottom-11/s);
 const lines=ops.filter(row=>['moveTo','lineTo'].includes(row[0]));
 const expected=[['moveTo',left,bottom],['lineTo',left+units,bottom],['moveTo',left,bottom-4/s],['lineTo',left,bottom+4/s],['moveTo',left+units,bottom-4/s],['lineTo',left+units,bottom+4/s]];
 assert.equal(lines.length,6);lines.forEach((row,i)=>{assert.equal(row[0],expected[i][0]);near(row[1],expected[i][1]);near(row[2],expected[i][2]);});
 assert.ok(units*s>=32-1e-8&&units*s<=80+1e-8,'ruler is 32–80 CSS pixels');
 assert.ok([1,2,5].some(n=>Math.abs(units/10**Math.floor(Math.log10(units))-n)<1e-8));
 assert.ok(ops.some(row=>row[0]==='setLineDash'&&row[1].length===0));
 near(ops.find(row=>row[0]==='lineWidth')[1]*s,1);near(Number(ops.find(row=>row[0]==='font')[1].split('px')[0])*s,11);
 assert.equal(ops.at(-1)[0],'restore','styles do not leak into other marks');
 assert.equal(reading(h),`左下标尺：${units} 模型单位；同心圆半径为 50、100、150、200。视图缩放不改变实际距离。`);
 const rings=marks.filter(row=>row[0]==='arc'&&row[1]===0&&row[2]===0&&[50,100,150,200].includes(row[3]));
 assert.deepEqual(rings.map(row=>row[3]),[50,100,150,200]);
 return {units,s,ops};
}
function selectWide(h){for(let i=0;i<28;i++)click(h,'orbit-right');for(let i=0;i<30;i++)click(h,'orbit-up');}

test('Orbit ruler matches concentric model distances at ordinary, narrow and fractional layouts',async()=>{
 const h=await setup('?experiment=orbit'),before=model(h),message=h.el('announcement').textContent;
 for(const [w,z] of [[600,414],[756,318],[259,240],[284.5,260.25],[1000,700],[600,414]]){
  h.resize(w,z);check(h,w,z);assert.deepEqual(model(h),before);assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,0);
 }
});

test('a distant launch fitted on resize updates ruler units without moving the launch or measured planet',async()=>{
 const h=await setup('?experiment=orbit');selectWide(h);const before=model(h);const units=check(h).units;
 h.el('orbit-right').focus();
 for(const [w,z] of [[259,240],[600,240],[240,600],[600,414]]){
  h.resize(w,z);const ruler=check(h,w,z,{x:280,y:-150});
  if(w===259)assert.ok(ruler.units>units);
  assert.deepEqual(model(h),before);assert.equal(document.activeElement,h.el('orbit-right'));
 }
 h.resize(259,240);click(h,'orbit-left');check(h,259,240,{x:280,y:-150});
 assert.match(h.el('orbit-position').textContent,/x 275.0/,'ordinary moves keep the retained view');
});

test('pointer-selected corner launches share the same ruler scale after responsive fitting',async()=>{
 for(const [clientX,clientY] of [[575,25],[25,25],[25,389],[575,389]]){
  const h=await setup('?experiment=orbit'),s=414/450;
  h.el('canvas').handlers.click({clientX,clientY});const before=model(h),view={x:(clientX-300)/s,y:(clientY-207)/s};
  h.resize(259,240);check(h,259,240,view);assert.deepEqual(model(h),before);
 }
});

test('running and paused redraws keep fixed scale text nodes and never announce the ruler',async()=>{
 const h=await setup('?experiment=orbit','',false),el=h.el('orbit-scale-reading'),original=check(h).ops;
 let text=el.textContent,writes=0;Object.defineProperty(el,'textContent',{get:()=>text,set:value=>{text=value;writes++;}});
 const message=h.el('announcement').textContent;h.tick(0);
 for(let i=1;i<=60;i++){h.tick(i*1000/60);assert.deepEqual(check(h).ops,original);}
 assert.equal(writes,0);assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,1);
 click(h,'pause');check(h);h.resize(600,414);assert.equal(writes,0);assert.equal(h.frames.size,0);
 click(h,'step');check(h);assert.equal(writes,0);
 h.resize(259,240);check(h,259,240);assert.equal(writes,1);
 h.resize(259,240);assert.equal(writes,1);
});

test('Home, reset, presets, guide and history restore the default view and matching ruler',async()=>{
 const h=await setup('?experiment=orbit');
 for(const release of [()=>click(h,'orbit-home'),()=>h.key('Home'),()=>click(h,'reset'),()=>{h.el('preset-select').handlers.change({target:{value:'elliptic'}});click(h,'load-preset');},()=>click(h,'guide-start'),()=>h.navigate('?experiment=orbit&gravity=40&speed=65')]){
  h.resize(600,414);click(h,'orbit-home');selectWide(h);h.resize(259,240);check(h,259,240,{x:280,y:-150});
  release();check(h,259,240);assert.equal(h.frames.size,0);
 }
 for(let i=0;i<28;i++)click(h,'orbit-left');check(h,259,240);assert.equal(h.el('orbit-fire').getAttribute('aria-disabled'),'true');
 click(h,'orbit-home');for(let i=0;i<21;i++)click(h,'orbit-fire');check(h,259,240);assert.match(h.el('metrics').textContent,/24 颗/);
 click(h,'pause');h.motion.change({matches:true});check(h,259,240);assert.equal(h.frames.size,0);
});

test('retained Orbit views keep the scale while other experiments have no Orbit ruler or reading',async()=>{
 const h=await setup('?experiment=orbit');selectWide(h);h.resize(259,240);const before=model(h),original=check(h,259,240,{x:280,y:-150});
 for(const world of ['life','wave','fractal','walk']){
  click(h,'tab-'+world);assert.equal(h.el('orbit-measurement').hidden,true);
  assert.ok(!h.drawing().some(row=>row[0]==='fillText'&&row[1]===`${original.units} 模型单位`));
  click(h,'tab-orbit');assert.equal(h.el('orbit-measurement').hidden,false);check(h,259,240,{x:280,y:-150});assert.deepEqual(model(h),before);
 }
});

test('ruler updates preserve parameter-only links and never earn or rewrite a discovery',async()=>{
 const h=await setup('?experiment=orbit');click(h,'mission-start');check(h);click(h,'mission-check');
 h.el('gravity').handlers.input({target:{value:'40'}});for(let n=0;n<150;n++)click(h,'step');
 assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 await click(h,'share');const before=model(h),url=h.el('share-link').value;assert.equal(new URL(url).searchParams.has('at'),false);
 h.resize(259,240);check(h,259,240);assert.deepEqual(model(h),before);assert.equal(h.el('share-link').value,url);
});

test('scale explanation is quiet wrapping text beside the existing measurement, without a new control',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const section=html.slice(html.indexOf('<div id="orbit-measurement"'),html.indexOf('<div id="orbit-touch"'));
 assert.match(section,/<small id="orbit-scale-reading" aria-live="off"><\/small>/);
 assert.doesNotMatch(section,/button|role="status"|tabindex|aria-live="polite"|aria-live="assertive"/);
 assert.match(css,/\.orbit-measurement small\{[^}]*display:block[^}]*overflow-wrap:anywhere/);
 assert.match(css,/@media\(max-width:720px\)\{\.orbit-measurement\{padding:12px\}\.orbit-measurement small\{font-size:13px\}\}/);
});

test('a dark ruler backing stays above crossing trails while every planet and marker remains above it',async()=>{
 const h=await setup('?experiment=orbit');h.resize(259,240);
 for(let n=0;n<190;n++)click(h,'step');
 const {s,ops}=check(h,259,240),marks=h.drawing();
 const plate=ops.find(row=>row[0]==='fillRect');assert.ok(plate);
 near(plate[1]*s+259/2,16);near(plate[2]*s+240/2,184);near(plate[3]*s,132);near(plate[4]*s,46);
 assert.equal(ops.find(row=>row[0]==='fillStyle')[1],'#122e29');
 const plateIndex=marks.findIndex(row=>row[0]==='fillRect'&&row[1]===plate[1]&&row[2]===plate[2]);
 const bodies=marks.map((row,i)=>row[0]==='arc'&&Math.abs(row[3]-4.5/s)<1e-8?i:-1).filter(i=>i>=0);
 assert.equal(bodies.length,3);assert.ok(bodies.every(i=>i>plateIndex),'every planet stays visible above the label plate');
 const third=marks[bodies[2]],screenX=third[1]*s+259/2,screenY=third[2]*s+240/2;
 assert.ok(screenX>16&&screenX<148&&screenY>184&&screenY<230,'this regression includes a planet directly over the plate');
 const trails=marks.map((row,i)=>row[0]==='strokeStyle'&&['#d3f35b75','#f59c8075','#e7eee175'].includes(row[1])?i:-1).filter(i=>i>=0);
 assert.equal(trails.length,3);assert.ok(trails.every(i=>i<plateIndex),'all trails stay under the label plate');
 const after=marks.slice(plateIndex),diamond=after.findIndex(row=>row[0]==='closePath');
 assert.ok(diamond>0,'the first-body diamond remains visible above the plate');
 assert.ok(after.some(row=>row[0]==='arc'&&Math.abs(row[3]-8/s)<1e-8),'the launch marker also stays above the plate');
 assert.ok(after.some(row=>row[0]==='fillText'&&row[1]==='首颗行星 · 实线量距离'));
});
