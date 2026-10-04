// History records are immutable after creation. The application only appends,
// trims, rewinds or replaces its history; it never edits an interior record.
// The caller records the current observation first, so history is nonempty.
// Reuse one presentation across cursor/focus/layout redraws. Keep no extra
// boards or history copies, and refresh at each of those mutation boundaries.
export function createLifeHistoryView(){
 let cached=null;
 return (history,generation)=>{
  const first=history[0],last=history.at(-1),previous=history.at(-2);
  if(cached&&cached.history===history&&cached.generation===generation&&
   cached.length===history.length&&cached.first===first&&cached.last===last&&cached.previous===previous)return cached.view;
  const counts=history.map(point=>point.count);
  const low=Math.min(...counts),high=Math.max(...counts),scaleMax=Math.max(1,high);
  const span=Math.max(1,last.generation-first.generation);
  const points=history.map(point=>({x:(point.generation-first.generation)/span*600,y:64-point.count/scaleMax*56}));
  let turnover=null;
  // A generation skipped by observation is not an adjacent-board comparison.
  if(previous?.generation===generation-1){
   let born=0,died=0,survived=0;
   for(let i=0;i<last.key.length;i++){
    if(last.key[i]==='1'){if(previous.key[i]==='1')survived++;else born++;}
    else if(previous.key[i]==='1')died++;
   }
   turnover=Object.freeze({born,died,survived});
  }
  const view=Object.freeze({low,high,scaleMax,points:points.map(point=>`${point.x},${point.y}`).join(' '),x:points.at(-1).x,y:points.at(-1).y,turnover});
  cached={history,generation,length:history.length,first,last,previous,view};
  return view;
 };
}
