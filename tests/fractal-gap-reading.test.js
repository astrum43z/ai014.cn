import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
import {createFractal,addFractalPoints} from '../fractal.js';
import {centralGapCount} from '../missions.js';

const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const reading=h=>h.el('fractal-gap-reading').textContent;
function check(h,count,seed=14,jump=50,expected){
 const model=addFractalPoints(createFractal(seed,jump),count),inside=centralGapCount(model);
 if(expected!==undefined)assert.equal(inside,expected);
 assert.equal(reading(h),`中央参考区 · 内部 ${inside} / ${count} 点`);
 assert.match(h.el('metrics').textContent,new RegExp(`^${count} 个点 · 前进 ${jump}% · 种子 ${seed}$`));
 return inside;
}
function outline(h,width=600,height=414){
 const drawing=h.drawing(),start=drawing.findIndex(row=>row[0]==='setLineDash'&&JSON.stringify(row[1])==='[3,5]');
 assert.ok(start>=0,'reference triangle has its own dashed outline');
 const end=drawing.findIndex((row,i)=>i>start&&row[0]==='restore'),path=drawing.slice(start,end);
 assert.equal(path.filter(row=>row[0]==='closePath').length,1);
 assert.equal(path.filter(row=>row[0]==='stroke').length,2,'matching dark backing and pale dashed foreground');
 assert.equal(path.filter(row=>row[0]==='fill').length,0,'reference area never covers the actual sample');
 const coords=path.filter(row=>['moveTo','lineTo'].includes(row[0])),scale=Math.min(width/2.1,height/1.85),cx=width/2,cy=height/2+scale*.25;
 assert.equal(coords.length,3);
 const expected=[[-Math.sqrt(3)/4,-.25],[0,.5],[Math.sqrt(3)/4,-.25]];
 coords.forEach(([,x,y],i)=>{assert.ok(Math.abs((x-cx)/scale-expected[i][0])<1e-12);assert.ok(Math.abs((y-cy)/scale-expected[i][1])<1e-12);});
 return coords;
}

test('central reference distinguishes empty half-jumps from overlapping samples at matched point counts',async()=>{
 const h=await setup('?experiment=fractal');check(h,300,14,50,0);outline(h);
 click(h,'fractal-1000');check(h,1000,14,50,0);
 input(h,'seed',15);click(h,'fractal-1000');check(h,1000,15,50,0);
 input(h,'jump',38);check(h,300,15,38);click(h,'fractal-1000');check(h,1000,15,38,291);
 input(h,'seed',14);click(h,'fractal-1000');check(h,1000,14,38,285);
 input(h,'jump',65);click(h,'fractal-1000');check(h,1000,14,65,0);outline(h);
});

test('reference uses the fixed side midpoints at every layout and jump percentage',async()=>{
 const h=await setup('?experiment=fractal&jump=38&seed=14&at=v1,1000'),before=reading(h),message=h.el('announcement').textContent;
 for(const [w,z] of [[600,414],[756,314],[259,240],[334,240],[1200,900],[600,414]]){
  h.resize(w,z);outline(h,w,z);assert.equal(reading(h),before);assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,0);
 }
 const original=outline(h);for(const jump of [35,50,65,70]){input(h,'jump',jump);assert.deepEqual(outline(h),original);}
});

test('reference excludes boundary samples using the same tolerance as discovery checks',()=>{
 const h=Math.sqrt(3)/4;
 const model={count:9,points:new Float32Array([-h,-.25,0,.5,h,-.25,0,-.25,-h/2,.125,h/2,.125,0,0,0,-.251,0,.501])};
 assert.equal(centralGapCount(model),1,'only the strict interior sample counts, not vertices, edges or outside points');
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/setReadingText\(\$\('#fractal-gap-reading'\),`中央参考区 · 内部 \$\{centralGapCount\(fractal\)\}/,'reading shares the checked model geometry');
});

test('exact replay and progress limits update counts without changing seeded points',async()=>{
 const h=await setup('?experiment=fractal&jump=38&seed=14&at=v1,1000');check(h,1000,14,38,285);const drawing=h.drawing();
 click(h,'fractal-back');check(h,999,14,38);click(h,'fractal-forward');check(h,1000,14,38);assert.deepEqual(h.drawing(),drawing);
 click(h,'fractal-step');check(h,1001,14,38);h.key('ArrowLeft');check(h,1000,14,38);
 click(h,'step');check(h,1100,14,38);
 h.navigate('?experiment=fractal&jump=35&seed=99&at=v1,12000');check(h,12000,99,35,3691);
 const cap=reading(h);click(h,'fractal-forward');assert.equal(reading(h),cap);assert.equal(h.frames.size,0);
 click(h,'fractal-back');check(h,11999,99,35);click(h,'fractal-forward');assert.equal(reading(h),cap);
 click(h,'reset');check(h,300,99,35);click(h,'fractal-back');check(h,300,99,35);
});

test('the readout changes quietly during growth and preserves text nodes on unchanged redraws',async()=>{
 const h=await setup('?experiment=fractal&jump=38'),el=h.el('fractal-gap-reading');
 let value=el.textContent,writes=0;Object.defineProperty(el,'textContent',{get:()=>value,set:next=>{value=next;writes++;}});
 h.resize(259,240);h.resize(600,414);assert.equal(writes,0);
 click(h,'pause');const message=h.el('announcement').textContent;h.tick(0);h.tick(50);assert.equal(writes,0);
 h.tick(100);check(h,400,14,38);assert.equal(writes,1);outline(h);assert.equal(h.el('announcement').textContent,message);
 click(h,'pause');assert.equal(writes,1);assert.equal(h.frames.size,0);
});

test('presets, guide loading and parameter changes show the current sample rather than the previous comparison',async()=>{
 const h=await setup('?experiment=fractal&jump=38&seed=14&at=v1,1000');check(h,1000,14,38,285);
 input(h,'seed',15);check(h,300,15,38);input(h,'jump',50);check(h,300,15,50,0);
 h.el('preset-select').handlers.change({target:{value:'overlap'}});click(h,'load-preset');check(h,300,15,38);
 click(h,'fractal-1000');check(h,1000,15,38,291);click(h,'guide-start');check(h,300,14,50,0);
});

test('world returns, browser history and saved observation keep independent live and fixed comparisons',async()=>{
 const h=await setup('?experiment=fractal&jump=38&seed=14&at=v1,1000','#canvas');await click(h,'share');const saved=h.el('share-link').value;
 click(h,'fractal-back');const live=reading(h);check(h,999,14,38);
 for(const mode of ['orbit','life','wave','walk']){
  click(h,'tab-'+mode);assert.equal(h.el('fractal-gap').hidden,true);h.resize(259,240);
  click(h,'tab-fractal');assert.equal(h.el('fractal-gap').hidden,false);assert.equal(reading(h),live);outline(h,259,240);
 }
 assert.equal(h.el('share-link').value,saved);assert.equal(location.href,saved);
 h.navigate(saved.replace('#canvas','#observation-title'));check(h,999,14,38);
 click(h,'observation-return');check(h,1000,14,38,285);
 h.navigate('?experiment=fractal&jump=38&seed=15&at=v1,1000');check(h,1000,15,38,291);h.navigate(saved);check(h,1000,14,38,285);
});

test('showing an empty reference never completes discoveries or changes existing notebook evidence',async()=>{
 const h=await setup('?experiment=fractal');click(h,'mission-start');click(h,'fractal-1000');check(h,1000,14,50,0);
 assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');input(h,'seed',15);click(h,'fractal-1000');
 assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const notes=h.el('field-notes-list').innerHTML,result=h.el('mission-result').textContent;
 input(h,'jump',38);click(h,'fractal-1000');check(h,1000,15,38,291);h.resize(259,240);
 assert.equal(h.el('field-notes-list').innerHTML,notes);assert.equal(h.el('mission-result').textContent,result);
});

test('the quiet reference explanation wraps beside the existing comparison without extra controls',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const section=html.slice(html.indexOf('<div id="fractal-gap"'),html.indexOf('</div>',html.indexOf('<div id="fractal-gap"')));
 assert.match(section,/<p id="fractal-gap-reading" aria-live="off"><\/p>/);
 assert.match(section,/三边中点.*内部落点.*不含边界.*参数变化时参考区不变.*当前样本/);
 assert.doesNotMatch(section,/<button|<a |tabindex|role="status"|aria-live="polite"|aria-live="assertive"/);
 assert.match(css,/#fractal-gap-reading\{[^}]*overflow-wrap:anywhere/);
 assert.ok(html.includes('app.js?v=observation-return-recovery-1'));assert.ok(html.includes('style.css?v=observation-return-recovery-1'));
});
