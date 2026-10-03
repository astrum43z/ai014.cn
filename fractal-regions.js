import {fractalVertices} from './fractal.js?v=vertex-counts-1';

// For the supported jump percentages, map the enclosing triangle toward each
// chosen vertex. This is the one-step affine image of every possible start,
// not a claim that an iterated sample fills the image. Never touch model state.
export function fractalRegions(jump){
 const ratio=jump/100;
 return fractalVertices.map(([vx,vy])=>fractalVertices.map(([x,y])=>[
  (1-ratio)*x+ratio*vx,(1-ratio)*y+ratio*vy
 ]));
}
