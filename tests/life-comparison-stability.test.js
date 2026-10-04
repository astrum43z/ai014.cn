import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const result=h=>h.el('life-test-result');
const block=[[23,15],[24,15],[23,16],[24,16]];
const changed=[[20,15],[21,15],[22,15],[20,16]];
function draw(h,points=block){
 click(h,'life-challenge-start');
 for(const [x,y] of points)h.el('canvas').handlers.click({clientX:(x+.5)*600/48,clientY:(y+.5)*414/32});
}
function track(h){
 const el=result(h);let text=el.textContent,writes=0,attributes=0;
 Object.defineProperty(el,'textContent',{get:()=>text,set:value=>{text=value;writes++;}});
 const set=el.setAttribute;el.setAttribute=function(key,value){if(key==='data-solved')attributes++;set.call(this,key,value);};
 return {counts:()=>({writes,attributes}),reset(){writes=0;attributes=0;}};
}
function state(h){return {text:result(h).textContent,solved:result(h).getAttribute('data-solved'),metrics:h.el('metrics').textContent,returnHidden:h.el('life-return').hidden,testDisabled:h.el('life-test').disabled,history:h.el('history-line').getAttribute('points'),notes:h.el('notes-text').value,url:location.href};}
// Independent set-based B3/S23 oracle; production evolution and challenge
// helpers are deliberately not imported for the result's expected evidence.
function oracle(points){
 const before=new Set(points.map(([x,y])=>y*48+x)),after=new Set();
 for(let y=0;y<32;y++)for(let x=0;x<48;x++){
  let neighbors=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)neighbors+=before.has(((y+dy+32)%32)*48+(x+dx+48)%48);
  const i=y*48+x;if(neighbors===3||neighbors===2&&before.has(i))after.add(i);
 }
 let born=0,died=0;for(const i of after)if(!before.has(i))born++;for(const i of before)if(!after.has(i))died++;
 return {before:before.size,after:after.size,born,died,solved:before.size===4&&born+died===0};
}
function expectTrial(h,points){
 const r=oracle(points),evidence=`${r.before} → ${r.after} 个活格；${r.born} 格诞生，${r.died} 格消失。`;
 const text=r.solved?'找到静止结构了！'+evidence+'位置完全相同；只要不编辑，以后每一代也都相同。':evidence+(r.before!==4?'这次起点不是 4 格。返回修改，再试一次。':r.before===r.after?'数量没变，位置却变了。返回修改，试着让每一格都留在原处。':'还没留住原来的形状。返回修改，用下方邻居读数找找原因。');
 assert.equal(result(h).textContent,text);assert.equal(result(h).getAttribute('data-solved'),String(r.solved));assert.equal(h.el('metrics').textContent,`第 1 代 · ${r.after} 个活格子`);
 assert.equal(h.el('life-return').hidden,false);assert.equal(h.el('life-test').disabled,true);assert.equal(h.frames.size,0);
}

test('120 unchanged redraws retain Life comparison evidence instead of replacing it 120 times',async()=>{
 const h=await setup('?experiment=life');click(h,'life-test');const counts=track(h),before=state(h),drawing=h.drawing(),message=h.el('announcement').textContent;
 for(let i=0;i<120;i++)h.resize(600,414);
 assert.deepEqual(counts.counts(),{writes:0,attributes:0});assert.deepEqual(state(h),before);assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('announcement').textContent,message);
});

test('both construction prompts and every outcome retain unchanged nodes with independent rule evidence',async()=>{
 for(const points of [[],[[0,0]],block,[[47,31],[0,31],[47,0],[0,0]],changed,[[20,15],[21,15],[22,15],[23,15]]]){
  const h=await setup('?experiment=life');draw(h,points);const counts=track(h);
  assert.equal(result(h).textContent,`当前 ${points.length} 个活格 · 目标 4 个。画好后，检验它能否保持原样。`);
  h.resize(600,414);assert.deepEqual(counts.counts(),{writes:0,attributes:0});
  click(h,'life-test');expectTrial(h,points);assert.deepEqual(counts.counts(),{writes:1,attributes:oracle(points).solved?1:0});counts.reset();
  h.resize(600,414);click(h,'life-test');assert.deepEqual(counts.counts(),{writes:0,attributes:0});expectTrial(h,points);
 }
});

test('inspection, exact selection and parameter changes preserve trial evidence while local readings update',async()=>{
 const h=await setup('?experiment=life');draw(h,changed);click(h,'life-test');const counts=track(h),before=state(h);
 const selection=h.el('life-cell-position').textContent;h.key('ArrowRight');assert.notEqual(h.el('life-cell-position').textContent,selection);
 click(h,'life-next-change');click(h,'life-next-live');click(h,'life-previous-live');click(h,'life-center');
 h.el('life-target-column').value='48';h.el('life-target-row').value='32';click(h,'life-position');assert.equal(h.el('life-cell-position').textContent,'第 48 列，第 32 行');
 h.el('rate').handlers.input({target:{value:'20'}});h.el('density').handlers.input({target:{value:'60'}});
 assert.deepEqual(counts.counts(),{writes:0,attributes:0});expectTrial(h,changed);assert.equal(result(h).textContent,before.text);assert.equal(h.el('notes-text').value,before.notes);
});

test('focus, fractional reflow, pixel density, visibility and context redraws preserve trial and repair stale DOM',async()=>{
 const h=await setup('?experiment=life');draw(h);click(h,'life-test');const counts=track(h),before=state(h),message=h.el('announcement').textContent;
 h.el('life-return').focus();h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();
 for(const [w,z] of [[171,240],[259,240],[455.5,281.75],[600,414]])h.resize(w,z);
 for(const density of [1.25,2,3,1])h.setDpr(density);h.loseContext();h.restoreContext();h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);
 assert.deepEqual(counts.counts(),{writes:0,attributes:0});assert.deepEqual(state(h),before);assert.equal(h.el('announcement').textContent,message);assert.equal(document.activeElement,h.el('life-return'));
 result(h).textContent='stale';result(h).setAttribute('data-solved','false');counts.reset();h.resize(600,414);
 assert.deepEqual(state(h),before);assert.deepEqual(counts.counts(),{writes:1,attributes:1});counts.reset();h.resize(600,414);assert.deepEqual(counts.counts(),{writes:0,attributes:0});
});

test('return restores the original drawing once, then a changed trial replaces the evidence',async()=>{
 const h=await setup('?experiment=life');draw(h,changed);const original=h.drawing();click(h,'life-test');expectTrial(h,changed);const counts=track(h);
 click(h,'life-return');assert.deepEqual(h.drawing(),original);assert.equal(result(h).textContent,'当前 4 个活格 · 目标 4 个。画好后，检验它能否保持原样。');assert.equal(h.el('life-test').disabled,false);assert.equal(h.el('life-return').hidden,true);assert.deepEqual(counts.counts(),{writes:1,attributes:0});
 counts.reset();click(h,'life-return');assert.deepEqual(counts.counts(),{writes:0,attributes:0});
 draw(h);click(h,'life-test');expectTrial(h,block);assert.equal(h.el('notes-count').textContent,'0 / 5');
});

test('advancing, editing and replacing still invalidate solved evidence and its return snapshot',async()=>{
 const changes=[h=>h.key('Enter'),h=>click(h,'step'),h=>click(h,'pause'),h=>click(h,'clear'),h=>click(h,'reset'),h=>click(h,'life-challenge-start'),h=>click(h,'mission-start'),h=>h.navigate('?experiment=life&rate=3&density=20')];
 for(const change of changes){const h=await setup('?experiment=life');draw(h);click(h,'life-test');expectTrial(h,block);const counts=track(h);change(h);
  assert.equal(result(h).getAttribute('data-solved'),'false');assert.doesNotMatch(result(h).textContent,/找到静止结构/);assert.equal(h.el('life-return').hidden,true);assert.equal(h.el('life-test').disabled,false);assert.equal(counts.counts().attributes,1);
  const before=state(h);click(h,'life-return');assert.deepEqual(state(h),before);
 }
});

test('animation changes construction evidence only when population changes and adds no announcements',async()=>{
 const h=await setup('?experiment=life&rate=20');draw(h,changed);const counts=track(h);click(h,'pause');let previous=result(h).textContent,expected=0;
 const message=h.el('announcement').textContent;h.tick(0);for(let i=1;i<=30;i++){h.tick(i*50);const now=result(h).textContent;if(now!==previous)expected++;previous=now;}
 assert.ok(expected>0);assert.deepEqual(counts.counts(),{writes:expected,attributes:0});assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,1);
 click(h,'pause');counts.reset();h.resize(600,414);assert.deepEqual(counts.counts(),{writes:0,attributes:0});assert.equal(h.frames.size,0);
});

test('edit and clear undo restore the exact prompt or trial that belongs to their saved board',async()=>{
 const h=await setup('?experiment=life');draw(h);const start=result(h).textContent;h.key('ArrowRight');h.key('Enter');assert.notEqual(result(h).textContent,start);h.key('z',{ctrlKey:true});assert.equal(result(h).textContent,start);
 click(h,'life-test');expectTrial(h,block);const trial=state(h);h.key('Enter');assert.equal(result(h).getAttribute('data-solved'),'false');h.key('z',{ctrlKey:true});assert.deepEqual(state(h),trial);
 click(h,'clear');assert.match(result(h).textContent,/当前 0 个活格/);click(h,'life-undo-clear');assert.deepEqual(state(h),trial);expectTrial(h,block);
});

test('retained worlds, anchors and parameter-only sharing leave the comparison intact and quiet',async()=>{
 const h=await setup('?experiment=life');draw(h,changed);click(h,'life-test');const counts=track(h),before=state(h);await click(h,'share');assert.equal(new URL(h.el('share-link').value).searchParams.has('at'),false);
 for(const world of ['orbit','wave','fractal','walk']){click(h,'tab-'+world);click(h,'tab-life');expectTrial(h,changed);}
 h.navigate(location.search+'#observation-title');h.navigate(location.search+'#canvas');assert.equal(result(h).textContent,before.text);assert.equal(h.el('notes-text').value,before.notes);assert.deepEqual(counts.counts(),{writes:0,attributes:0});
});

test('text-only canvas startup and collapse preserve the result through safe recovery',async()=>{
 const h=await setup('?experiment=life','',true,1,false);click(h,'life-test');const counts=track(h),before=state(h);assert.equal(h.drawCount(),0);
 h.setContextReady(true);click(h,'canvas-retry');assert.deepEqual(state(h),before);h.resize(0,0);h.resize(600,414);assert.deepEqual(state(h),before);assert.deepEqual(counts.counts(),{writes:0,attributes:0});
});

test('discovery evidence and intentional Fractal and Walk primary-step repeats stay unchanged',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');for(const key of ['Enter','ArrowRight','Enter','ArrowDown','Enter','ArrowLeft','Enter'])h.key(key);
 click(h,'life-test');expectTrial(h,block);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;
 click(h,'tab-fractal');for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional repeat suppressed');}});click(h,'step');}assert.match(h.el('metrics').textContent,/500 个点/);
 click(h,'tab-walk');h.key('ArrowRight');h.key('ArrowRight',{repeat:true});assert.match(h.el('metrics').textContent,/48 步/);assert.equal(h.el('notes-text').value,notes);
});

test('fresh pages request the stable comparison application without new UI or live regions',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/app\.js\?[^"\n]*&amp;trial-text=stable-1/);assert.match(html,/id="life-test-result" tabindex="-1" aria-live="off"/);
});
