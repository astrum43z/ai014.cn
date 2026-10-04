import {population,repeatPeriod} from './simulations.js';

// Record a board once, not once per focus/layout redraw. Application edits
// replace the history array; evolution/rewind replace the cells. Neither past
// history entries nor an unchanged board are mutated in place without that
// boundary. Any future mutation path must preserve this invalidation contract.
// A repeat is evidence about the recorded observation. Keep that small reading
// with its immutable entry even after its matching older board rolls out of the
// plot, or this entry is restored by rewind/undo. Weak keys retain no boards.
export function createLifeHistoryRecorder(){
 let previous=null;const readings=new WeakMap();
 return (cells,generation,history)=>{
  const last=history.at(-1);
  if(previous&&previous.cells===cells&&previous.generation===generation&&
   previous.history===history&&previous.length===history.length&&previous.last===last)return previous.reading;
  const saved=last?.generation===generation?readings.get(last):null;
  if(saved&&last.key===Array.from(cells).join('')){
   previous={cells,generation,history,length:history.length,last,reading:saved};
   return saved;
  }
  // Compare with up to 120 preceding observations before trimming the plot.
  // A changed board or a new history must earn its own repeat evidence.
  if(last?.generation===generation)history.pop();
  const count=population(cells),period=repeatPeriod(history,cells,generation);
  const entry={generation,key:Array.from(cells).join(''),count};
  history.push(entry);if(history.length>120)history.shift();
  const reading=Object.freeze({count,period});
  readings.set(entry,reading);
  previous={cells,generation,history,length:history.length,last:entry,reading};
  return reading;
 };
}
