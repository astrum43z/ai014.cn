import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrbitPreview,ORBIT_PREVIEW_SECONDS} from '../orbit-preview.js';
import {orbitLaunchState} from '../orbit.js';
import {orbitStep} from '../simulations.js';

test('ten-second preview matches 100 existing manual steps and does not mutate its launch point',()=>{
 const preview=createOrbitPreview();
 for(const point of [{x:140,y:0},{x:-80,y:60},{x:22,y:0},{x:270,y:-150}]){
  for(const gravity of [30000,80000,160000])for(const speed of [30,65,100,150]){
   const before={...point},launch=orbitLaunchState(point,gravity,speed);
   const body={...point,vx:launch.vx,vy:launch.vy};
   for(let n=0;n<100;n++)for(let i=0;i<10;i++)orbitStep(body,gravity,.01);
   const result=preview(point,gravity,speed);
   assert.equal(result.seconds,10);assert.equal(ORBIT_PREVIEW_SECONDS,10);
   assert.equal(result.points.length,201);assert.deepEqual(result.points[0],[point.x,point.y]);
   assert.deepEqual(result.end,body);assert.deepEqual(result.points.at(-1),[body.x,body.y]);
   assert.deepEqual(point,before);assert.ok(result.points.flat().every(Number.isFinite));
  }
 }
});
test('one-entry cache reuses unchanged inputs and invalidates each launch variable',()=>{
 const preview=createOrbitPreview(),a=preview({x:140,y:0},80000,100);
 assert.equal(preview({x:140,y:0},80000,100),a);
 for(const [point,g,s] of [[{x:135,y:0},80000,100],[{x:135,y:5},80000,100],[{x:135,y:5},90000,100],[{x:135,y:5},90000,110]]){
  const b=preview(point,g,s);assert.notEqual(b,a);assert.equal(preview({...point},g,s),b);
 }
 assert.notEqual(preview({x:140,y:0},80000,100),a,'only one key is retained');
});
test('center and invalid inputs clear any cached path',()=>{
 const preview=createOrbitPreview();
 for(const [point,g,s] of [[{x:0,y:0},80000,100],[{x:21.99,y:0},80000,100],[{x:NaN,y:0},80000,100],[{x:140,y:0},0,100],[{x:140,y:0},Infinity,100],[{x:140,y:0},80000,NaN]]){
  preview({x:140,y:0},80000,100);assert.equal(preview(point,g,s),null);assert.equal(preview(point,g,s),null);
 }
});
test('path changes continuously with speed and can leave the viewport without being clamped',()=>{
 const preview=createOrbitPreview(),low=preview({x:140,y:0},80000,65),circle=preview({x:140,y:0},80000,100),fast=preview({x:140,y:0},80000,150);
 assert.ok(Math.hypot(low.end.x,low.end.y)<140);
 assert.ok(Math.abs(Math.hypot(circle.end.x,circle.end.y)-140)<.2);
 assert.ok(Math.hypot(fast.end.x,fast.end.y)>250);
 assert.notDeepEqual(low.points,circle.points);assert.notDeepEqual(fast.points,circle.points);
});
