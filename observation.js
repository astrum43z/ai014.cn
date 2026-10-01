import {FRACTAL_LIMIT} from './fractal.js';
import {WALK_LIMIT} from './walk.js';

// Versioned, bounded model state only. No images, storage, account, or user data.
export const canShareObservation = mode => ['wave','fractal','walk'].includes(mode);
export function readObservation(search,mode){
 const query=new URLSearchParams(search),tokens=query.getAll('at');
 if(!canShareObservation(mode)||tokens.length!==1||tokens[0].length>160)return null;
 const parts=tokens[0].split(',');
 if(parts.shift()!=='v1'||parts.some(value=>value.trim()===''))return null;
 const numbers=parts.map(Number);
 if(numbers.some(value=>!Number.isFinite(value)))return null;
 if(mode==='wave'){
  const [x,y,time]=numbers;
  return numbers.length===3&&Math.abs(x)<=10000&&Math.abs(y)<=10000&&time>=0&&time<=1e9?{x,y,time}:null;
 }
 const [count]=numbers,limit=mode==='fractal'?FRACTAL_LIMIT:WALK_LIMIT,min=mode==='fractal'?300:16;
 return numbers.length===1&&Number.isInteger(count)&&count>=min&&count<=limit?{count}:null;
}
export function writeObservation(mode,observation){
 if(!observation||!canShareObservation(mode))return '';
 const numbers=mode==='wave'?[observation.x,observation.y,observation.time]:[observation.count];
 const query=new URLSearchParams({at:['v1',...numbers].join(',')}).toString();
 return readObservation(query,mode)?query:'';
}
