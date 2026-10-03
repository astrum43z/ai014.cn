import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fractalRegions} from '../fractal-regions.js';
import {createFractal,addFractalPoints} from '../fractal.js';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const reading=h=>h.el('fractal-regions-reading').textContent;
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} differs from ${b}`);
// Independent barycentric oracle: a point belongs to the image at corner i
// exactly when its weight at corner i is at least the traveled fraction r.
const weights=([x,y])=>[(.5-y)/1.5,(1-(.5-y)/1.5-x*2/Math.sqrt(3))/2,(1-(.5-y)/1.5+x*2/Math.sqrt(3))/2];
function check(h,jump){
 const expected=fractalRegions(jump);
 for(let i=0;i<3;i++){
  const points=h.el('fractal-region-'+i).getAttribute('points');assert.ok(points);
  const actual=points.split(' ').map(pair=>pair.split(',').map(Number));assert.equal(actual.length,3);
  actual.forEach(([x,y],j)=>{close((x-160)/140,expected[i][j][0]);close((y-166)/140,expected[i][j][1]);});
 }
 assert.match(reading(h),new RegExp(`前进 ${jump}% → 每块边长为外框的 ${100-jump}%`));
 assert.match(reading(h),jump<50?/部分重叠/:jump===50?/只在外框的边中点相接/:/彼此分离/);
}
const shape=h=>[0,1,2].map(i=>h.el('fractal-region-'+i).getAttribute('points'));

test('every supported ratio maps each enclosing triangle to the independently derived barycentric corner region',()=>{
 for(let jump=35;jump<=70;jump++){
  const r=jump/100,regions=fractalRegions(jump);
  assert.equal(regions.length,3);
  regions.forEach((triangle,i)=>triangle.forEach((point,j)=>{
   const w=weights(point);w.forEach((v,k)=>close(v,(k===i?r:0)+(k===j?1-r:0)));
   assert.ok(w.every(v=>v>=-1e-12));close(w.reduce((a,b)=>a+b),1);
   for(let k=j+1;k<3;k++)close(Math.hypot(point[0]-triangle[k][0],point[1]-triangle[k][1]),Math.sqrt(3)*(1-r));
  }));
 }
 const first=fractalRegions(38);first[0][0][0]=999;
 assert.notEqual(fractalRegions(38)[0][0][0],999,'no shared mutable geometry');
});

test('38 percent overlaps, 50 percent meets at exactly the side midpoints, and 65 percent separates',()=>{
 for(const jump of [38,50,65]){
  const r=jump/100,regions=fractalRegions(jump);
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
   const distance=Math.hypot(regions[i][j][0]-regions[j][i][0],regions[i][j][1]-regions[j][i][1]);
   close(distance,Math.sqrt(3)*Math.abs(1-2*r));
   const midpoint=weights([(regions[i][i][0]+regions[j][j][0])/2,(regions[i][i][1]+regions[j][j][1])/2]);
   assert.equal(midpoint[i]>=r-1e-12&&midpoint[j]>=r-1e-12,jump<=50);
  }
  assert.ok([1/3,1/3,1/3].every(w=>w<r),'the centroid is still uncovered even at 38 percent');
 }
});

test('seeded samples obey the first-level enclosure without changing model coordinates, counts or random draws',()=>{
 for(const jump of [35,38,49,50,51,65,70])for(const seed of [1,14,15,99]){
  const model=createFractal(seed,jump),baseline=createFractal(seed,jump);
  for(let n=0;n<1000;n++){
   const before=structuredClone(model);fractalRegions(jump);assert.deepEqual(model,before);
   addFractalPoints(model,1);
   assert.ok(weights([model.x,model.y])[model.lastVertex]>=jump/100-1e-12);
  }
  addFractalPoints(baseline,1000);assert.deepEqual(model,baseline);
 }
});

test('the live diagram follows all ratios, presets and resets while seed and count leave its geometry fixed',async()=>{
 const h=await setup('?experiment=fractal');check(h,50);const initial=shape(h);
 click(h,'fractal-1000');input(h,'seed',15);click(h,'fractal-1000');assert.deepEqual(shape(h),initial);
 for(const jump of [35,38,49,50,51,65,70]){input(h,'jump',jump);check(h,jump);click(h,'reset');check(h,jump);}
 for(const [preset,jump] of [['half',50],['overlap',38],['islands',65]]){
  h.el('preset-select').handlers.change({target:{value:preset}});click(h,'load-preset');check(h,jump);
 }
 click(h,'guide-start');check(h,50);
});

test('animation, replay and unchanged redraws never replace identical diagram attributes or quiet text',async()=>{
 const h=await setup('?experiment=fractal&jump=38'),initial=shape(h),el=h.el('fractal-regions-reading');let writes=0,value=el.textContent;
 Object.defineProperty(el,'textContent',{get:()=>value,set:next=>{writes++;value=next;}});
 for(let i=0;i<3;i++){
  const polygon=h.el('fractal-region-'+i),set=polygon.setAttribute.bind(polygon);
  polygon.setAttribute=(name,v)=>{writes++;set(name,v);};
 }
 const note=h.el('announcement').textContent;
 h.resize(259,240);h.resize(600,414);h.el('canvas').handlers.focus();assert.equal(h.el('announcement').textContent,note);
 click(h,'fractal-forward');click(h,'fractal-back');click(h,'step');click(h,'fractal-1000');input(h,'seed',15);
 click(h,'pause');const running=h.el('announcement').textContent;h.tick(0);for(let n=1;n<=20;n++)h.tick(n*50);
 assert.equal(h.el('announcement').textContent,running);assert.deepEqual(shape(h),initial);assert.equal(writes,0);
 click(h,'pause');input(h,'jump',65);check(h,65);assert.equal(writes,4,'only three polygons and one reading update');
});

test('retained worlds, density, context recovery and reduced motion preserve the current geometry and model',async()=>{
 const h=await setup('?experiment=fractal&jump=65&seed=15&at=v1,1000');check(h,65);const initial=shape(h),model=h.drawing(),read=reading(h);
 h.el('fractal-forward').focus();
 for(const [w,z] of [[259,240],[334.5,260.2],[900,600],[600,414]]){h.resize(w,z);check(h,65);}
 h.setDpr(2);h.setDpr(3);h.setDpr(1);h.loseContext();h.restoreContext();check(h,65);assert.deepEqual(h.drawing(),model);
 assert.equal(document.activeElement,h.el('fractal-forward'));
 for(const mode of ['orbit','life','wave','walk']){
  click(h,'tab-'+mode);assert.equal(h.el('fractal-regions').hidden,true);
  click(h,'tab-fractal');assert.equal(h.el('fractal-regions').hidden,false);assert.deepEqual(shape(h),initial);assert.equal(reading(h),read);
 }
 click(h,'pause');h.tick(0);h.tick(50);h.tick(100);h.motion.change({matches:true});assert.equal(h.frames.size,0);check(h,65);
});

test('observation replay, parameter history and share checkpoints cannot be changed by reading the diagram',async()=>{
 const h=await setup('?experiment=fractal&jump=38&seed=15&at=v1,1000','#canvas');await click(h,'share');const saved=h.el('share-link').value;check(h,38);
 click(h,'fractal-back');check(h,38);assert.match(h.el('metrics').textContent,/999 个点/);assert.equal(location.href,saved);
 click(h,'observation-return');check(h,38);assert.match(h.el('metrics').textContent,/1000 个点/);
 h.navigate('?experiment=fractal&jump=65&seed=99&at=v1,12000');check(h,65);const atCap=shape(h);
 click(h,'fractal-forward');click(h,'step');assert.deepEqual(shape(h),atCap);assert.equal(h.frames.size,0);
 h.navigate(saved);check(h,38);assert.match(h.el('metrics').textContent,/1000 个点/);assert.equal(h.el('notes-count').textContent,'0 / 5');
});

test('the diagram does not award discoveries or replace saved notebook evidence',async()=>{
 const h=await setup('?experiment=fractal');click(h,'mission-start');check(h,50);click(h,'fractal-1000');click(h,'mission-check');
 input(h,'seed',15);click(h,'fractal-1000');check(h,50);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const notes=h.el('field-notes-list').innerHTML,result=h.el('mission-result').textContent;
 input(h,'jump',38);check(h,38);click(h,'fractal-1000');input(h,'jump',65);check(h,65);
 assert.equal(h.el('field-notes-list').innerHTML,notes);assert.equal(h.el('mission-result').textContent,result);
});

test('diagram is quiet, color-independent, responsive and confined to the existing instrument drawer',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const section=html.match(/<section id="fractal-regions".*?<\/section>/s)?.[0];assert.ok(section);
 assert.match(section,/aria-labelledby="fractal-regions-title" hidden/);assert.match(section,/<svg viewBox="0 0 320 266" aria-hidden="true" focusable="false">/);
 assert.doesNotMatch(section,/<button|tabindex|aria-live|role="status"/);
 assert.ok(html.indexOf(section)>html.indexOf('<div class="instrument-content">'));assert.ok(html.indexOf(section)<html.indexOf('<section id="orbit-launch"'));
 assert.match(section,/当前点的下一步只有三个候选位置.*不是已落下的点、概率或完整分形/);
 assert.match(section,/A · 上方实线.*B · 左下长虚线.*C · 右下点线/);
 assert.match(css,/\.fractal-regions svg\{[^}]*width:100%;height:auto/);
 assert.match(css,/\.fractal-region-b\{[^}]*stroke-dasharray:8 4/);assert.match(css,/\.fractal-region-c\{[^}]*stroke-dasharray:2 4/);
 assert.match(css,/@media\(max-width:720px\)\{\.fractal-regions-body\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(html,/app\.js\?v=observation-return-recovery-1/);assert.match(html,/style\.css\?v=observation-return-recovery-1/);
});
