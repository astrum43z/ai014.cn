import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as missions from '../missions.js';
import {createFractal,addFractalPoints} from '../fractal.js';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const counter=()=>{assert.equal(typeof missions.createCentralGapCounter,'function');return missions.createCentralGapCounter();};
const full=missions.centralGapCount;
function observed(state){
 let reads=0;
 const points=new Proxy(state.points,{get(target,key){if(typeof key==='string'&&/^\d+$/.test(key))reads++;return Reflect.get(target,key,target);}});
 return {source:{points,count:state.count},reads:()=>reads};
}
function check(h,count,seed=14,jump=38){
 const expected=addFractalPoints(createFractal(seed,jump),count);
 assert.equal(h.el('fractal-gap-reading').textContent,`中央参考区 · 内部 ${full(expected)} / ${count} 点`);
 return h.drawing();
}
function absCalls(action){
 const abs=Math.abs;let calls=0;
 try{Math.abs=value=>{calls++;return abs(value);};action();}finally{Math.abs=abs;}
 return calls;
}

test('an append-only run reads each coordinate once instead of revisiting its entire prefix',()=>{
 const getCount=counter(),state=createFractal(14,38),o=observed(state);let baselineChecks=0;
 for(let n=300;n<=12000;n+=100){
  addFractalPoints(state,n-state.count);o.source.count=n;
  assert.equal(getCount(o.source),full(state));baselineChecks+=n;
  assert.equal(getCount(o.source),full(state),'unchanged read is stable');
 }
 assert.equal(baselineChecks,725700);
 assert.equal(o.reads(),24000,'12,000 points are inspected once across all 118 readings');
 assert.equal(getCount(o.source),3471);assert.equal(o.reads(),24000);
});

test('every supported jump and representative seeds retain exact full-scan counts and seeded state',()=>{
 const getCount=counter();
 for(let jump=35;jump<=70;jump++)for(const seed of [1,14,15,50,99]){
  const state=createFractal(seed,jump);
  for(const count of [0,1,299,300,301,999,1000,1001,8191,11999,12000]){
   addFractalPoints(state,count-state.count);
   const before={rng:state.rng,x:state.x,y:state.y,previousX:state.previousX,previousY:state.previousY,lastVertex:state.lastVertex,vertexCounts:[...state.vertexCounts],count:state.count};
   assert.equal(getCount(state),full(state),`jump ${jump}, seed ${seed}, count ${count}`);
   assert.deepEqual({rng:state.rng,x:state.x,y:state.y,previousX:state.previousX,previousY:state.previousY,lastVertex:state.lastVertex,vertexCounts:[...state.vertexCounts],count:state.count},before);
  }
 }
});

test('same-count replacements, count rewinds and replaced buffers rebuild while separate models stay independent',()=>{
 const getCount=counter(),a=addFractalPoints(createFractal(14,38),1000),b=addFractalPoints(createFractal(15,50),1000);
 assert.equal(getCount(a),285);assert.equal(getCount(b),0);assert.equal(getCount(a),285);
 a.count=731;assert.equal(getCount(a),full(a));a.count=1000;assert.equal(getCount(a),285);
 a.points=b.points;assert.equal(getCount(a),0);
 const c=addFractalPoints(createFractal(15,38),1000);assert.equal(getCount(c),291);
 const unchanged=observed(c);getCount(unchanged.source);const reads=unchanged.reads();
 getCount(b);getCount(unchanged.source);assert.equal(unchanged.reads(),reads);
});

test('boundary tolerance and Float32 rounding remain identical when samples arrive in pieces',()=>{
 const h=Math.sqrt(3)/4,epsilon=1e-6;
 const points=new Float32Array([-h,-.25,0,.5,h,-.25,0,-.25,-h/2,.125,h/2,.125,0,0,0,-.251,0,.501,0,-.25+epsilon/2,0,-.25+epsilon*2,0,.5-epsilon/2,0,.5-epsilon*2]);
 const state={points,count:0},getCount=counter();
 for(let count=0;count<=points.length/2;count++){state.count=count;assert.equal(getCount(state),full(state));}
 assert.equal(getCount(state),3);
});

test('unchanged redraws and discovery checks do not rescan the Fractal sample',async()=>{
 const h=await setup('?experiment=fractal&jump=38&seed=14&at=v1,12000');check(h,12000);
 const before=h.el('announcement').textContent;
 assert.equal(absCalls(()=>{h.resize(259,240);h.resize(600,414);h.setDpr(2);h.setDpr(1);h.loseContext();h.restoreContext();}),0);
 assert.equal(h.el('announcement').textContent,before);check(h,12000);
 click(h,'mission-start');click(h,'fractal-1000');check(h,1000,14,50);
 assert.equal(absCalls(()=>click(h,'mission-check')),0,'checking reuses the exact count already displayed');
 input(h,'seed',15);click(h,'fractal-1000');
 assert.equal(absCalls(()=>click(h,'mission-check')),0);assert.equal(h.el('notes-count').textContent,'1 / 5');
});

test('growth scans only new points, preserves the original model and stops at the existing cap',async()=>{
 const h=await setup('?experiment=fractal&jump=38&seed=14&at=v1,11900');check(h,11900);
 click(h,'pause');h.tick(0);h.tick(50);
 assert.ok(absCalls(()=>h.tick(100))<=100,'one hundred new samples, never the existing 11,900');
 check(h,12000);assert.equal(h.frames.size,0);assert.equal(h.el('status').textContent,'已暂停');
 assert.equal(h.el('fractal-forward').getAttribute('aria-disabled'),'true');
 click(h,'fractal-back');check(h,11999);click(h,'fractal-forward');const drawing=check(h,12000);
 assert.equal(absCalls(()=>h.resize(600,414)),0);assert.deepEqual(h.drawing(),drawing);
});

test('seek, reverse/forward replay, return undo, tabs, presets and history replace counts without stale cache data',async()=>{
 const h=await setup('?experiment=fractal&jump=38&seed=14&at=v1,1000','#canvas');const original=check(h,1000);
 await click(h,'share');const saved=h.el('share-link').value;
 h.el('fractal-count').value='731';click(h,'fractal-seek');check(h,731);const live=h.drawing();
 click(h,'fractal-back');check(h,730);click(h,'fractal-forward');assert.deepEqual(check(h,731),live);
 assert.equal(h.el('share-link').value,saved);click(h,'observation-return');assert.deepEqual(check(h,1000),original);
 click(h,'observation-undo');assert.deepEqual(check(h,731),live);
 for(const world of ['life','wave','orbit','walk']){click(h,'tab-'+world);click(h,'tab-fractal');assert.deepEqual(check(h,731),live);}
 assert.equal(h.el('fractal-count').value,'731');assert.equal(h.el('share-link').value,saved);
 input(h,'seed',15);check(h,300,15);input(h,'jump',65);check(h,300,15,65);
 h.el('preset-select').handlers.change({target:{value:'overlap'}});click(h,'load-preset');check(h,300,15);
 h.navigate(saved);check(h,1000);click(h,'reset');check(h,300);
 assert.equal(h.el('notes-count').textContent,'0 / 5');
});

test('visibility gates and held batch growth retain cadence and quiet feedback',async()=>{
 const h=await setup('?experiment=fractal&jump=38','#canvas',false);h.tick(0);h.tick(50);check(h,300);h.tick(100);check(h,400);
 const announcement=h.el('announcement').textContent;h.setVisible(false);assert.equal(h.frames.size,0);
 h.setVisible(true);h.tick(90000);check(h,400);h.tick(90050);check(h,400);h.tick(90100);check(h,500);
 assert.equal(h.el('announcement').textContent,announcement);
 for(let i=0;i<3;i++)click(h,'step');check(h,800);
 let prevented=false;h.el('step').handlers.keydown({key:'Enter',repeat:true,preventDefault(){prevented=true;}});
 assert.equal(prevented,false,'intentional held Fractal batch repeat is unchanged');
});

test('cache wiring versions both the entry module and its changed dependency without altering UI markup',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(app,/createCentralGapCounter.*from '\.\/missions\.js\?v=discovery-passport-1&gap=count-once-1'/);
 assert.match(app,/const centralGapCount=createCentralGapCounter\(\)/);
 assert.match(html,/app\.js\?[^"\n]+&amp;gap=count-once-1&amp;availability=quiet-1&amp;walk=read-once-1&amp;life=record-once-1&amp;history=read-once-1&amp;colors=wave-once-1&amp;orbit-fit=first-body-1&amp;canvas-start=retry-1&amp;sampling=wave-field-fallback-1&amp;nudge=single-enter-1&amp;walk-batch=reverse-1&amp;fractal-batch=reverse-1&amp;cycle=disclosure-1&amp;coordinate-draft=current-1&amp;life-draft=current-1&amp;bar-drawer=idle-1&amp;time-draft=current-1&amp;count-draft=current-1&amp;life-batch=recorded-1&amp;life-forward=recorded-1&amp;preview-fit=whole-path-1&amp;neighborhood=disclosure-1&amp;region-drawer=idle-1"/);
});
