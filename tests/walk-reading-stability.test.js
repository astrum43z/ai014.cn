import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const ids=['walk-step-reading','walk-length','walk-displacement','walk-cancellation','walk-distance-note'];
const click=(h,id)=>h.el(id).handlers.click();
const readings=h=>ids.map(id=>h.el(id).textContent);
function track(h){
 const writes=new Map(ids.map(id=>[id,0]));
 for(const id of ids){let text=h.el(id).textContent;Object.defineProperty(h.el(id),'textContent',{configurable:true,get:()=>text,set:value=>{writes.set(id,writes.get(id)+1);text=value;}});}
 return {writes,total:()=>[...writes.values()].reduce((sum,n)=>sum+n,0),reset:()=>ids.forEach(id=>writes.set(id,0))};
}
// Independent scalar LCG replay counts the first walker without reusing the
// production path-statistics or reading cache. Other walkers still consume RNG.
function expected(steps,seed=14,bias=0){
 let rng=seed,right=0,left=0,up=0,down=0,last;
 for(let step=0;step<steps;step++)for(let i=0;i<256;i++){
  rng=(Math.imul(1664525,rng)+1013904223)>>>0;
  if(i)continue;const n=rng/2**32;
  if(n<.25+bias/200){right++;last='向右';}else if(n<.5){left++;last='向左';}else if(n<.75){up++;last='向上';}else{down++;last='向下';}
 }
 return {right,left,up,down,last,x:right-left,y:up-down,distance:Math.hypot(right-left,up-down)};
}
function check(h,steps,seed=14,bias=0,paused=true){
 const p=expected(steps,seed,bias),r=readings(h);
 assert.equal(r[0],`白色漫步者 · 第 ${steps} 步 ${p.last}；累计走过 ${steps}，离起点 ${p.distance.toFixed(2)} 步长${steps>=512?'；已达 512 步上限，可退回一步、重置或比较 16 / 64 步':steps<=16?'；已回到 16 步起点':''}。`);
 assert.equal(r[1],steps+' 步长');assert.equal(r[2],p.distance.toFixed(2)+' 步长');
 const horizontal=p.x===0?'左右抵消':`净向${p.x>0?'右':'左'} ${Math.abs(p.x)} 步`,vertical=p.y===0?'上下抵消':`净向${p.y>0?'上':'下'} ${Math.abs(p.y)} 步`;
 assert.equal(r[3],`右 ${p.right} 步、左 ${p.left} 步 → ${horizontal}；上 ${p.up} 步、下 ${p.down} 步 → ${vertical}。`);
 assert.equal(r[4],p.distance===0?'这位漫步者回到了起点，直线距离为 0；走过的路仍然算数。':paused?'空心圈是起点，白点是当前位置；蓝色虚线直接连接两点，白色实线保留折返。':'运行中暂隐蓝色直线，暂停即可比较它与白色路径。');
}

test('120 unchanged paused redraws retain the five Walk text nodes instead of making 600 replacements',async()=>{
 const h=await setup('?experiment=walk&bias=20&seed=14&at=v1,64'),counter=track(h),before=readings(h),message=h.el('announcement').textContent,drawing=h.drawing();
 for(let i=0;i<120;i++)h.resize(600,414);
 assert.deepEqual(readings(h),before);assert.equal(counter.total(),0);assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('announcement').textContent,message);check(h,64,14,20);
});

test('focus, responsive redraws, density and bitmap recovery keep unchanged readings without a shadow cache',async()=>{
 const h=await setup('?experiment=walk&at=v1,73'),counter=track(h),before=readings(h);
 h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();
 for(const size of [[259,240],[233,260],[455.5,281.75],[600,414]])h.resize(...size);
 h.setDpr(2);h.loseContext();h.restoreContext();h.setDpr(1);h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);
 assert.deepEqual(readings(h),before);assert.equal(counter.total(),0);
 for(const id of ids)h.el(id).textContent='stale';counter.reset();h.resize(600,414);
 assert.deepEqual(readings(h),before);assert.deepEqual([...counter.writes.values()],[1,1,1,1,1]);
 counter.reset();h.resize(600,414);assert.equal(counter.total(),0);
});

test('animation writes only changed displayed readings and keeps the shared live region quiet',async()=>{
 const h=await setup('?experiment=walk'),counter=track(h);click(h,'pause');check(h,16,14,0,false);counter.reset();
 const changes=new Map(ids.map(id=>[id,0]));let previous=readings(h);const message=h.el('announcement').textContent;
 h.tick(0);for(let i=1;i<=120;i++){
  h.tick(i*1000/60);const current=readings(h);
  ids.forEach((id,index)=>{if(current[index]!==previous[index])changes.set(id,changes.get(id)+1);});previous=current;
 }
 assert.deepEqual(counter.writes,changes);assert.ok(counter.total()>0);assert.equal(counter.writes.get('walk-distance-note'),0);assert.equal(h.el('announcement').textContent,message);
 const steps=Number(h.el('walk-length').textContent.split(' ')[0]);check(h,steps,14,0,false);click(h,'pause');check(h,steps);assert.equal(h.frames.size,0);
});

test('single-step, replay, exact target and cap keep numerical readings and boundary guidance current',async()=>{
 const h=await setup('?experiment=walk'),counter=track(h);check(h,16);
 click(h,'walk-step-one');check(h,17);click(h,'walk-back');check(h,16);
 click(h,'walk-64');check(h,64);h.el('walk-count').value='511';click(h,'walk-seek');check(h,511);click(h,'walk-step-one');check(h,512);
 counter.reset();click(h,'walk-step-one');click(h,'step');h.resize(600,414);assert.equal(counter.total(),0);
 click(h,'walk-back');check(h,511);click(h,'walk-16');check(h,16);assert.equal(h.el('walk-count').value,'511');
});

test('equal-count seed and bias edits, reset, presets and changed URLs refresh the actual path',async()=>{
 const h=await setup('?experiment=walk&seed=42&bias=25&at=v1,64');check(h,64,42,25);
 h.el('seed').handlers.input({target:{value:'50'}});check(h,16,50,25);const biased=readings(h);h.el('bias').handlers.input({target:{value:'0'}});check(h,16,50,0);assert.notDeepEqual(readings(h),biased);
 click(h,'walk-64');check(h,64,50,0);click(h,'reset');check(h,16,50,0);
 h.el('preset-select').handlers.change({target:{value:'another'}});click(h,'load-preset');check(h,16,51,0);
 h.navigate('?experiment=walk&seed=1&bias=0&at=v1,16');check(h,16,1,0);click(h,'guide-start');check(h,16);
});

test('saved return, undo, retained worlds and anchor history preserve readings and fixed link',async()=>{
 const h=await setup('?experiment=walk&seed=42&bias=25&at=v1,73','#canvas');await click(h,'share');const link=h.el('share-link').value;
 click(h,'walk-back');check(h,72,42,25);const before=readings(h),drawing=h.drawing();
 for(const world of ['orbit','life','wave','fractal']){click(h,'tab-'+world);click(h,'tab-walk');assert.deepEqual(readings(h),before);}
 assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('share-link').value,link);
 click(h,'observation-return');check(h,73,42,25);click(h,'observation-undo');check(h,72,42,25);
 const counter=track(h);h.navigate(link.replace('#canvas','#observation-title'));assert.deepEqual(readings(h),before);assert.equal(counter.total(),0);
});

test('text-only startup and collapsed rendering still update exact readings before recovery',async()=>{
 const h=await setup('?experiment=walk&at=v1,64','',true,1,false),counter=track(h);check(h,64);
 click(h,'walk-step-one');check(h,65);h.resize(0,0);click(h,'walk-back');check(h,64);
 counter.reset();h.setContextReady(true);click(h,'canvas-retry');h.resize(600,414);assert.equal(counter.total(),0);check(h,64);
});

test('discovery checks and intentional held batch stepping keep their original effects',async()=>{
 const h=await setup('?experiment=walk');click(h,'mission-start');click(h,'mission-check');click(h,'walk-64');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const notes=h.el('field-notes-list').innerHTML;h.key('ArrowRight');h.key('ArrowRight',{repeat:true});check(h,96);assert.equal(h.el('field-notes-list').innerHTML,notes);
 click(h,'tab-fractal');for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional batch blocked');}});click(h,'step');}assert.match(h.el('metrics').textContent,/500 个点/);
});


test('zero-distance readings survive quiet redraws and pause toggles, then update on leaving and returning',async()=>{
 const h=await setup('?experiment=walk&seed=1&bias=0&at=v1,20'),counter=track(h);check(h,20,1);
 assert.equal(h.el('walk-displacement').textContent,'0.00 步长');assert.match(h.el('walk-distance-note').textContent,/回到了起点/);
 h.resize(259,240);h.el('canvas').handlers.focus();click(h,'pause');check(h,20,1,0,false);click(h,'pause');check(h,20,1);assert.equal(counter.total(),0);
 click(h,'walk-step-one');check(h,21,1);assert.equal(h.el('walk-displacement').textContent,'1.00 步长');assert.ok(counter.total()>0);
 click(h,'walk-back');check(h,20,1);counter.reset();h.resize(600,414);assert.equal(counter.total(),0);
});

test('fresh entry loads stable Walk readings with no new live region or control',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/app\.js\?[^"\n]*&amp;walk-text=stable-1/);
});
