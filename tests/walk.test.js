import test from 'node:test';
import assert from 'node:assert/strict';
import {createWalk,advanceWalk,walkStats,WALK_COUNT,WALK_LIMIT} from '../walk.js';

test('walk starts at origin and every first step has unit length',()=>{
 const a=createWalk();assert.equal(a.steps,0);assert.equal(walkStats(a).spread,0);
 advanceWalk(a,1);
 for(let i=0;i<WALK_COUNT;i++)assert.equal(a.positions[i*2]**2+a.positions[i*2+1]**2,1);
 assert.equal(walkStats(a).rmsDistance,1);
 assert.equal(walkStats(a).expectedRms,1);
});
test('walk seed reproduces every coordinate regardless of batching',()=>{
 const a=advanceWalk(createWalk(14,25),64),b=createWalk(14,25);
 for(let i=0;i<16;i++)advanceWalk(b,4);
 assert.deepEqual(a,b);
 assert.notDeepEqual(a.positions,advanceWalk(createWalk(15,25),64).positions);
 assert.equal(a.path[128],a.positions[0]);assert.equal(a.path[129],a.positions[1]);
 for(let i=1;i<=64;i++)assert.equal(Math.abs(a.path[i*2]-a.path[(i-1)*2])+Math.abs(a.path[i*2+1]-a.path[(i-1)*2+1]),1);
});
test('random walk storage and progress are bounded with no wrap or reflection',()=>{
 const a=advanceWalk(createWalk(99,25),100000),before=structuredClone(a);
 assert.equal(a.steps,WALK_LIMIT);assert.equal(a.positions.length,WALK_COUNT*2);assert.equal(a.path.length,(WALK_LIMIT+1)*2);
 advanceWalk(a,16);assert.deepEqual(a,before);
 for(const v of a.positions){assert.equal(Number.isInteger(v),true);assert.ok(Math.abs(v)<=WALK_LIMIT);}
 assert.ok(walkStats(a).meanX>100,'walk moves beyond the drawing minimum range, rather than wrapping');
});
test('theoretical moments distinguish centered spreading from drift',()=>{
 let stats=walkStats(advanceWalk(createWalk(14,0),16));assert.equal(stats.expectedSpread,4);assert.equal(stats.expectedRms,4);assert.equal(stats.expectedX,0);
 stats=walkStats(advanceWalk(createWalk(14,0),64));assert.equal(stats.expectedSpread,8);assert.equal(stats.expectedRms,8);
 stats=walkStats(advanceWalk(createWalk(14,25),64));assert.equal(stats.expectedX,16);assert.equal(stats.expectedSpread,Math.sqrt(60));assert.equal(stats.expectedRms,Math.sqrt(316));
 assert.ok(Math.abs(stats.rmsDistance**2-stats.spread**2-stats.meanX**2-stats.meanY**2)<1e-9,'sample second-moment decomposition is exact');
});
test('seeded ensemble approximates predicted spreading and bias across fixed seeds',()=>{
 for(const seed of [1,14,99])for(const bias of [0,25]){
  const stats=walkStats(advanceWalk(createWalk(seed,bias),512));
  assert.ok(Math.abs(stats.spread/stats.expectedSpread-1)<.1);
  assert.ok(Math.abs(stats.meanX-stats.expectedX)<3);
  assert.ok(Math.abs(stats.meanY)<3);
 }
});
test('invalid public model inputs do not allocate or run unbounded work',()=>{
 assert.equal(createWalk(NaN,Infinity).seed,14);assert.equal(createWalk(NaN,Infinity).bias,0);
 assert.equal(createWalk(999,-10).seed,99);assert.equal(createWalk(0,99).bias,25);
 const a=createWalk();for(const n of [-1,NaN,Infinity])advanceWalk(a,n);assert.equal(a.steps,0);
});
