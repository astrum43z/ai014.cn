import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWalk,advanceWalk,walkStats,walkPathStats,walkOccupancy} from '../walk.js';
import {createWalkReadings} from '../walk-readings.js';
import {setup} from './life-challenge-harness.js';
const click=(h,id)=>h.el(id).handlers.click();
function expected(state){
 const stats=walkStats(state),center=stats.expectedX/2;
 const points=[...Array.from({length:256},(_,i)=>[state.positions[2*i],state.positions[2*i+1]]),...Array.from({length:state.steps+1},(_,i)=>[state.path[2*i],state.path[2*i+1]])];
 return {stats,path:walkPathStats(state),occupancy:walkOccupancy(state),center,extentX:Math.max(30,Math.abs(center)+30,...points.map(([x])=>Math.abs(x-center)+6)),extentY:Math.max(30,...points.map(([,y])=>Math.abs(y)+6))};
}
function reads(state){let count=0;for(const name of ['positions','path'])state[name]=new Proxy(state[name],{get(target,key){if(/^\d+$/.test(String(key)))count++;return Reflect.get(target,key,target);}});return {count:()=>count,reset(){count=0;}};}
function work(action){
 const sqrt=Math.sqrt,set=Map.prototype.set;let roots=0,sites=0;
 try{Math.sqrt=value=>{roots++;return sqrt(value);};Map.prototype.set=function(key,value){if(typeof key==='string'&&/^-?\d+,-?\d+$/.test(key))sites++;return set.call(this,key,value);};action();return {roots,sites};}finally{Math.sqrt=sqrt;Map.prototype.set=set;}
}
function seek(h,n){h.el('walk-count').value=String(n);click(h,'walk-seek');}
function check(h,n,seed=14,bias=0){
 const r=expected(advanceWalk(createWalk(seed,bias),n));
 assert.equal(h.el('metrics').textContent,`256 位漫步者 · ${n} 步 · 偏向 ${bias}%`);
 assert.equal(h.el('walk-spread-reading').textContent,`整群散开 · 第 ${n} 步：实测 ${r.stats.spread.toFixed(2)} / 理论 ${r.stats.expectedSpread.toFixed(2)} 步长`);
 assert.equal(h.el('walk-occupancy-reading').textContent,`256 位漫步者 · 占据 ${r.occupancy.sites} 个格点 · 单格最多 ${r.occupancy.maximum} 位。多个漫步者可重合；按模型位置计数，不是屏幕上可分辨的点数。`);
 assert.equal(h.el('walk-length').textContent,n+' 步长');assert.equal(h.el('walk-displacement').textContent,r.path.distance.toFixed(2)+' 步长');
}
test('summary exactly matches original measurements and independent bounds across supported seeds, biases and counts',()=>{
 const read=createWalkReadings();for(let seed=1;seed<=99;seed++)for(const bias of [0,1,13,25]){const state=createWalk(seed,bias);for(const n of [0,16,17,64,127,511,512]){advanceWalk(state,n-state.steps);assert.deepEqual(read(state),expected(state));}}
});
test('unchanged models perform no coordinate reads; only one summary is retained',()=>{
 const read=createWalkReadings(),a=advanceWalk(createWalk(42,25),512),b=advanceWalk(createWalk(14),512),counter=reads(a);
 const first=read(a);assert.ok(counter.count()>0);counter.reset();for(let i=0;i<120;i++)assert.equal(read(a),first);assert.equal(counter.count(),0);
 read(b);const again=read(a);assert.notEqual(again,first,'the single entry was replaced');assert.deepEqual(again,first);assert.ok(counter.count()>0);
 for(const value of [first,first.stats,first.path,first.occupancy])assert.ok(Object.isFrozen(value));assert.throws(()=>{first.stats.meanX=100;},TypeError);assert.equal(read(a).stats.meanX,first.stats.meanX);
});
test('in-place advancement, step reduction, replaced buffers, changed bias and equal-count replay refresh summaries',()=>{
 const read=createWalkReadings(),state=advanceWalk(createWalk(42,25),16);let previous=read(state);const fresh=()=>{const next=read(state);assert.notEqual(next,previous);assert.deepEqual(next,expected(state));previous=next;};
 advanceWalk(state,1);fresh();advanceWalk(state,47);fresh();state.steps=16;fresh();state.positions=state.positions.slice();state.positions[0]++;fresh();state.path=state.path.slice();state.path[1]++;fresh();state.bias=0;fresh();
 const replay=advanceWalk(createWalk(1,25),16);assert.notEqual(read(replay),previous);assert.deepEqual(read(replay),expected(replay));
});
test('reading never mutates the model or consumes randomness; batching and exact continuation stay identical',()=>{
 const read=createWalkReadings(),a=createWalk(99,25),b=createWalk(99,25);for(let i=0;i<511;i++){advanceWalk(a,1);const before=structuredClone(a);read(a);read(a);assert.deepEqual(a,before);}
 advanceWalk(b,511);assert.deepEqual(a,b);advanceWalk(a,1);read(a);advanceWalk(b,1);assert.deepEqual(a,b);const capped=read(a);advanceWalk(a,16);assert.equal(read(a),capped);
});
test('paused focus, resize, density and simulated context recovery reuse all Walk measurements',async()=>{
 const h=await setup('?experiment=walk&bias=25&seed=42&at=v1,512','#canvas');check(h,512,42,25);const before=h.drawing(),url=location.href,message=h.el('announcement').textContent;h.el('walk-back').focus();
 assert.deepEqual(work(()=>{for(const [w,z] of [[0,0],[259,240],[334.5,260.2],[1200,900],[600,414]])h.resize(w,z);h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();for(const dpr of [1.25,2,3,1])h.setDpr(dpr);h.loseContext();h.restoreContext();}),{roots:0,sites:0});
 assert.deepEqual(h.drawing(),before);assert.equal(location.href,url);assert.equal(h.el('announcement').textContent,message);assert.equal(document.activeElement,h.el('walk-back'));assert.equal(h.frames.size,0);check(h,512,42,25);
});
test('a draw and action announcement share one new summary; replay invalidates at both boundaries',async()=>{
 const h=await setup('?experiment=walk');check(h,16);assert.deepEqual(work(()=>click(h,'walk-step-one')),{roots:4,sites:256});check(h,17);assert.deepEqual(work(()=>click(h,'walk-back')),{roots:4,sites:256});check(h,16);assert.deepEqual(work(()=>click(h,'walk-back')),{roots:0,sites:0});
 seek(h,511);check(h,511);assert.deepEqual(work(()=>click(h,'walk-step-one')),{roots:4,sites:256});check(h,512);for(const id of ['walk-step-one','step','pause'])assert.deepEqual(work(()=>click(h,id)),{roots:0,sites:0});assert.deepEqual(work(()=>click(h,'walk-back')),{roots:4,sites:256});check(h,511);
});
test('animation updates once per new batch and visibility gates retain measurements without catch-up',async()=>{
 const h=await setup('?experiment=walk');click(h,'pause');const message=h.el('announcement').textContent;h.tick(0);assert.deepEqual(work(()=>h.tick(50)),{roots:0,sites:0});assert.deepEqual(work(()=>h.tick(100)),{roots:4,sites:256});check(h,20);
 h.setVisible(false);assert.equal(h.frames.size,0);h.setVisible(true);h.tick(1000);check(h,20);h.setHidden(true);assert.equal(h.frames.size,0);h.setHidden(false);h.tick(2000);check(h,20);assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,1);
 assert.deepEqual(work(()=>h.motion.change({matches:true})),{roots:0,sites:0});assert.equal(h.frames.size,0);
});
test('equal-count parameter changes, resets and presets never reuse another ensemble',async()=>{
 const h=await setup('?experiment=walk&seed=42&bias=25&at=v1,64');check(h,64,42,25);h.el('seed').handlers.input({target:{value:'50'}});check(h,16,50,25);h.el('bias').handlers.input({target:{value:'7'}});check(h,16,50,7);click(h,'walk-64');check(h,64,50,7);click(h,'reset');check(h,16,50,7);
 h.el('preset-select').handlers.change({target:{value:'another'}});click(h,'load-preset');check(h,16,51,0);click(h,'guide-start');check(h,16);
});
test('fixed share return, undo, exact drafts and retained worlds preserve their distinct current observations',async()=>{
 const h=await setup('?experiment=walk&seed=42&bias=25&at=v1,73','#canvas');check(h,73,42,25);await click(h,'share');const saved=h.el('share-link').value;h.el('walk-count').value='511';click(h,'walk-back');check(h,72,42,25);const before=h.drawing();
 for(const mode of ['orbit','life','wave','fractal']){click(h,'tab-'+mode);click(h,'tab-walk');check(h,72,42,25);}assert.deepEqual(h.drawing(),before);assert.equal(h.el('walk-count').value,'511');assert.equal(h.el('share-link').value,saved);
 click(h,'observation-return');check(h,73,42,25);click(h,'observation-undo');check(h,72,42,25);assert.deepEqual(h.drawing(),before);h.navigate(saved.replace('#canvas','#observation-title'));check(h,72,42,25);h.navigate('?experiment=walk&seed=1&bias=0&at=v1,72');check(h,72,1,0);h.navigate(saved);check(h,73,42,25);
});
test('discovery checks reuse the exact observations without completing or replacing notes automatically',async()=>{
 const h=await setup('?experiment=walk');click(h,'mission-start');check(h,16);assert.deepEqual(work(()=>click(h,'mission-check')),{roots:0,sites:0});click(h,'walk-64');check(h,64);assert.equal(h.el('notes-count').textContent,'0 / 5');assert.deepEqual(work(()=>click(h,'mission-check')),{roots:0,sites:0});assert.equal(h.el('notes-count').textContent,'1 / 5');
 const notes=h.el('field-notes-list').innerHTML;click(h,'walk-back');click(h,'walk-step-one');assert.equal(h.el('field-notes-list').innerHTML,notes);
});
test('fresh entry loads the readout cache while original simulation dependencies remain versioned',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),app=readFileSync(new URL('../app.js',import.meta.url),'utf8');assert.match(html,/app\.js\?[^"\n]+&amp;walk=read-once-1&amp;life=record-once-1"/);assert.match(app,/import \{createWalkReadings\} from '\.\/walk-readings\.js'/);assert.match(app,/\.\/walk\.js\?v=occupancy-reading-1/);assert.doesNotMatch(app,/walkStats\(walk\)|walkPathStats\(walk\)|walkOccupancy\(walk\)/);
});
