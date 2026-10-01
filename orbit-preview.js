import {orbitLaunchState} from './orbit.js';
import {orbitStep} from './simulations.js?v=wave-paths-1';

export const ORBIT_PREVIEW_SECONDS=10;
const STEPS=1000,DT=ORBIT_PREVIEW_SECONDS/STEPS,SAMPLE_EVERY=5;

// One temporary planet, the same 0.01-second integrator as manual stepping,
// and a fixed 201-point budget. Never advance or retain the real planet array.
export function createOrbitPreview(){
 let key='',cached=null;
 return function preview(point,gravity,speedPercent){
  const nextKey=[point.x,point.y,gravity,speedPercent].join(',');
  if(nextKey===key)return cached;
  key=nextKey;cached=null;
  const launch=orbitLaunchState(point,gravity,speedPercent);
  if(!launch.valid||!Number.isFinite(gravity)||gravity<=0||!Number.isFinite(speedPercent))return null;
  const body={x:point.x,y:point.y,vx:launch.vx,vy:launch.vy};
  const points=[[body.x,body.y]];
  for(let i=1;i<=STEPS;i++){
   orbitStep(body,gravity,DT);
   if(i%SAMPLE_EVERY===0)points.push([body.x,body.y]);
  }
  cached={points,end:{...body},seconds:ORBIT_PREVIEW_SECONDS};
  return cached;
 };
}
