// Seeded chaos game. All model points stay in the convex hull of the vertices.
export const FRACTAL_LIMIT=12000;
export const fractalVertices=[[0,-1],[-Math.sqrt(3)/2,.5],[Math.sqrt(3)/2,.5]];
export function createFractal(seed=14,jump=50){
 return {rng:seed>>>0,jump:jump/100,x:0,y:-1,previousX:0,previousY:-1,count:0,lastVertex:0,vertexCounts:[0,0,0],points:new Float32Array(FRACTAL_LIMIT*2)};
}
export function addFractalPoints(state,amount){
 const end=Math.min(FRACTAL_LIMIT,state.count+Math.max(0,Math.floor(amount)));
 while(state.count<end){
  state.rng=(Math.imul(1664525,state.rng)+1013904223)>>>0;
  const vertex=Math.floor(state.rng/4294967296*3),[x,y]=fractalVertices[vertex];
  state.previousX=state.x;state.previousY=state.y;
  state.x+=(x-state.x)*state.jump;state.y+=(y-state.y)*state.jump;
  state.points[state.count*2]=state.x;state.points[state.count*2+1]=state.y;
  // Count the draw already made; never sample again for the instrument.
  state.vertexCounts[vertex]++;state.lastVertex=vertex;state.count++;
 }
 return state;
}
