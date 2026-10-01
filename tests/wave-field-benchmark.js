// Optional CPU-only benchmark, not a browser FPS/battery measurement.
// Run: node tests/wave-field-benchmark.js
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {waveValue} from '../simulations.js';
import {createWaveFieldCache,waveFieldValue} from '../wave-field.js';

for(const [width,height] of [[767,317.9375],[334,240]]){
 const scale=Math.min(width,height)/280,getField=createWaveFieldCache();
 const start=performance.now(),field=getField(width,height,scale,100,32),buildMs=performance.now()-start;
 const frames=120,legacy=[],cached=[];let expected,actual;
 for(let round=0;round<10;round++){
  const run=cache=>{
   const start=performance.now();let checksum=0;
   for(let f=0;f<frames;f++){
    let i=0;
    if(cache)getField(width,height,scale,100,32);
    for(let y=0;y<height;y+=5)for(let x=0;x<width;x+=5){
     checksum+=cache?waveFieldValue(field,i++,f/20):waveValue((x-width/2)/scale,(y-height/2)/scale,f/20,100,32);
    }
   }
   return {ms:(performance.now()-start)/frames,checksum};
  };
  // Alternate order; discard warm-up. Time only model field sampling.
  let a,b;if(round%2){b=run(true);a=run(false);}else{a=run(false);b=run(true);}
  expected=a.checksum;actual=b.checksum;assert.equal(actual,expected);
  if(round>=2){legacy.push(a.ms);cached.push(b.ms);}
 }
 const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
 const legacyMs=median(legacy),cachedMs=median(cached);
 console.log(JSON.stringify({width,height,samples:field.phases.length/2,retainedBytes:field.phases.byteLength,buildMs,legacyMs,cachedMs,reductionPercent:100*(1-cachedMs/legacyMs),checksumMatches:actual===expected}));
}
