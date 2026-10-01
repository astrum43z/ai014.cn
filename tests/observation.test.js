import test from 'node:test';
import assert from 'node:assert/strict';
import {canShareObservation,readObservation,writeObservation} from '../observation.js';

test('versioned observation state round-trips without losing floating-point probe or time',()=>{
 for(const [mode,state] of [['wave',{x:-123.45678901234567,y:31.01,time:3.700000000000002}],['fractal',{count:12000}],['walk',{count:512}]]){
  const query=writeObservation(mode,state);
  assert.deepEqual(readObservation('?experiment='+mode+'&'+query,mode),state);
  assert.equal(writeObservation(mode,readObservation(query,mode)),query);
 }
 assert.equal(canShareObservation('orbit'),false);assert.equal(canShareObservation('life'),false);
 assert.equal(writeObservation('life',{count:100}), '');
});
test('malformed, duplicate, future and unbounded observations are ignored as a whole',()=>{
 for(const [mode,bad] of [
  ['wave','v2,8,0,0'],['wave','v1,8,0'],['wave','v1,8,0,0,1'],['wave','v1,,0,0'],
  ['wave','v1,Infinity,0,0'],['wave','v1,NaN,0,0'],['wave','v1,1e20,0,0'],
  ['wave','v1,0,0,-1'],['wave','v1,0,0,1e100'],['wave','v1,0,0,<script>'],
  ['fractal','v1,12001'],['fractal','v1,299'],['fractal','v1,300.5'],
  ['walk','v1,15'],['walk','v1,513'],['walk','v1,64,32'],['walk','v1,'+'1'.repeat(200)],
  ['orbit','v1,32'],['life','v1,32']
 ])assert.equal(readObservation(new URLSearchParams({at:bad}).toString(),mode),null,mode+' '+bad);
 assert.equal(readObservation('at=v1,64&at=v1,16','walk'),null);
 assert.equal(readObservation('','walk'),null);
});
