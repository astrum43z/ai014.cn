// Retain one CSS-space sample path, not a bitmap. Model points are append-only
// within a Fractal state; replay, parameter changes and resets replace it.
// A new projection, point buffer or shorter prefix requires a fresh path.
export function createFractalPathCache(Path=typeof Path2D==='function'?Path2D:null){
 let disabled=typeof Path!=='function',previous=null,points=null,path=null,count=0,projection=[];
 return function samplePath(state,scale,cx,cy){
  if(disabled)return null;
  try{
   if(previous!==state||points!==state.points||state.count<count||projection[0]!==scale||projection[1]!==cx||projection[2]!==cy){
    path=new Path();count=0;previous=state;points=state.points;projection=[scale,cx,cy];
   }
   for(;count<state.count;count++)path.rect(cx+points[count*2]*scale,cy+points[count*2+1]*scale,1.3,1.3);
   return path;
  }catch{
   // An optional native allocation must not take away the ordinary drawing
   // route. Stop retrying this cache; the caller can still paint every point.
   disabled=true;previous=null;points=null;path=null;return null;
  }
 };
}
