import {walkStats,walkPathStats,walkOccupancy} from './walk.js?v=occupancy-reading-1';

// The application only changes a walk through advanceWalk (which increases
// steps) or by replacing it with a replay. Keep one read-only summary for that
// revision, independent of viewport, pause state and DOM. Never cache pixels.
export function createWalkReadings(){
 let previous=null,steps,bias,positions,path,reading;
 return function readWalk(state){
  if(previous===state&&steps===state.steps&&bias===state.bias&&positions===state.positions&&path===state.path)return reading;
  const stats=walkStats(state),journey=walkPathStats(state),occupancy=walkOccupancy(state),center=stats.expectedX/2;
  let extentX=Math.max(30,Math.abs(center)+30),extentY=30;
  for(let i=0;i<state.positions.length;i+=2){extentX=Math.max(extentX,Math.abs(state.positions[i]-center)+6);extentY=Math.max(extentY,Math.abs(state.positions[i+1])+6);}
  for(let i=0;i<=state.steps;i++){extentX=Math.max(extentX,Math.abs(state.path[i*2]-center)+6);extentY=Math.max(extentY,Math.abs(state.path[i*2+1])+6);}
  reading=Object.freeze({stats:Object.freeze(stats),path:Object.freeze(journey),occupancy:Object.freeze(occupancy),center,extentX,extentY});
  previous=state;steps=state.steps;bias=state.bias;positions=state.positions;path=state.path;
  return reading;
 };
}
