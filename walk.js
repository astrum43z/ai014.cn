// Independent unit lattice steps, not a molecular fluid or a measured experiment.
export const WALK_COUNT=256;
export const WALK_LIMIT=512;
export function createWalk(seed=14,bias=0){
 seed=Number.isFinite(seed)?Math.max(1,Math.min(99,Math.round(seed))):14;
 bias=Number.isFinite(bias)?Math.max(0,Math.min(25,Math.round(bias))):0;
 return {seed,bias,rng:seed>>>0,steps:0,positions:new Float32Array(WALK_COUNT*2),path:new Float32Array((WALK_LIMIT+1)*2)};
}
export function advanceWalk(state,amount=16){
 const count=Number.isFinite(amount)?Math.max(0,Math.floor(amount)):0;
 const end=Math.min(WALK_LIMIT,state.steps+count),right=.25+state.bias/200;
 while(state.steps<end){
  for(let i=0;i<WALK_COUNT;i++){
   state.rng=(Math.imul(1664525,state.rng)+1013904223)>>>0;
   const u=state.rng/4294967296;
   if(u<right)state.positions[i*2]++;
   else if(u<.5)state.positions[i*2]--;
   else if(u<.75)state.positions[i*2+1]++;
   else state.positions[i*2+1]--;
  }
  state.steps++;
  state.path[state.steps*2]=state.positions[0];state.path[state.steps*2+1]=state.positions[1];
 }
 return state;
}
export function walkStats(state){
 let sumX=0,sumY=0,sumR2=0;
 for(let i=0;i<WALK_COUNT;i++){
  const x=state.positions[i*2],y=state.positions[i*2+1];
  sumX+=x;sumY+=y;sumR2+=x*x+y*y;
 }
 const meanX=sumX/WALK_COUNT,meanY=sumY/WALK_COUNT,n=state.steps,mu=state.bias/100;
 return {meanX,meanY,rmsDistance:Math.sqrt(sumR2/WALK_COUNT),spread:Math.sqrt(Math.max(0,sumR2/WALK_COUNT-meanX*meanX-meanY*meanY)),expectedX:n*mu,expectedRms:Math.sqrt(n+n*(n-1)*mu*mu),expectedSpread:Math.sqrt(n*(1-mu*mu))};
}

// Read the already recorded representative path; do not consume randomness or
// alter the ensemble. Positive y points upward in this exhibit.
export function walkPathStats(state){
 let right=0,left=0,up=0,down=0;
 for(let i=1;i<=state.steps;i++){
  const dx=state.path[i*2]-state.path[(i-1)*2];
  const dy=state.path[i*2+1]-state.path[(i-1)*2+1];
  if(dx>0)right++;else if(dx<0)left++;
  if(dy>0)up++;else if(dy<0)down++;
 }
 const x=state.path[state.steps*2],y=state.path[state.steps*2+1];
 return {right,left,up,down,x,y,distance:Math.hypot(x,y),length:state.steps};
}
