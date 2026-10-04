import {population,repeatPeriod} from './simulations.js';

// Record a board once, not once per focus/layout redraw. Application edits
// replace the history array; evolution/rewind replace the cells. Neither past
// history entries nor an unchanged board are mutated in place without that
// boundary. Any future mutation path must preserve this invalidation contract.
// Keep only one reading; the caller still owns the existing 120-entry history.
export function createLifeHistoryRecorder(){
 let previous=null;
 return (cells,generation,history)=>{
  const last=history.at(-1);
  if(previous&&previous.cells===cells&&previous.generation===generation&&
   previous.history===history&&previous.length===history.length&&previous.last===last)return previous.reading;
  // Preserve the original replacement and repeat-search order, including the
  // oldest record participating in a search before a full history is trimmed.
  if(last?.generation===generation)history.pop();
  const count=population(cells),period=repeatPeriod(history,cells,generation);
  history.push({generation,key:Array.from(cells).join(''),count});
  const removed=history.length>120?history.shift():null;
  const reading=Object.freeze({count,period});
  // Legacy repeat detection can see the just-evicted oldest board once.
  // Its next redraw sees only retained records and reports no match.
  const retainedReading=removed&&period!==null&&removed.generation===generation-period?Object.freeze({count,period:null}):reading;
  previous={cells,generation,history,length:history.length,last:history.at(-1),reading:retainedReading};
  return reading;
 };
}
