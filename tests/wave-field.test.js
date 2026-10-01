import test from 'node:test';
import assert from 'node:assert/strict';
import {createWaveFieldCache,waveFieldValue,WAVE_GRID_STEP} from '../wave-field.js';
import {waveValue} from '../simulations.js';

test('cached grid preserves every original sample exactly, including fractional sizes and extreme saved times',()=>{
 const getField=createWaveFieldCache();
 for(const [width,height,scale] of [[600,360,360/280],[767,317.9375,317.9375/280],[259,240,259/280],[259,240,.01]]){
  for(const [separation,wavelength] of [[20,15],[100,32],[180,70]]){
   const field=getField(width,height,scale,separation,wavelength);
   assert.equal(field.phases.length,Math.ceil(width/5)*Math.ceil(height/5)*2);
   for(const phase of [0,.3,Math.PI,27.14,3000000000]){
    let i=0;
    for(let y=0;y<height;y+=5)for(let x=0;x<width;x+=5){
     assert.equal(waveFieldValue(field,i++,phase),waveValue((x-width/2)/scale,(y-height/2)/scale,phase,separation,wavelength));
    }
   }
  }
 }
 assert.equal(WAVE_GRID_STEP,5,'retain the existing field resolution');
});

test('only matching geometry is reused; every geometry input replaces the single retained grid',()=>{
 const getField=createWaveFieldCache(),keys=[600,360,360/280,100,32];
 const original=getField(...keys);
 assert.equal(getField(...keys),original);
 for(let i=0;i<keys.length;i++){
  const changed=keys.map((v,k)=>k===i?v+1:v),field=getField(...changed);
  assert.notEqual(field,original);assert.equal(getField(...changed),field);
  assert.notEqual(getField(...keys),original,'the previous size/parameters are not accumulated');
 }
 assert.equal(original.phases.byteLength,600/5*360/5*16);
});

test('steady geometry needs no distance calculations after its first draw',()=>{
 const getField=createWaveFieldCache(),hypot=Math.hypot;let calls=0;
 try{
  Math.hypot=(...args)=>{calls++;return hypot(...args)};
  const field=getField(334,240,240/280,100,32),built=calls;
  assert.equal(built,Math.ceil(334/5)*48*2);
  for(let frame=0;frame<120;frame++){
   assert.equal(getField(334,240,240/280,100,32),field);
   for(let i=0;i<field.phases.length/2;i++)waveFieldValue(field,i,frame/20);
  }
  assert.equal(calls,built,'time and draws do not rebuild the geometry');
 }finally{Math.hypot=hypot;}
});

test('zero-sized canvas creates no field samples',()=>{
 const getField=createWaveFieldCache();
 assert.equal(getField(0,0,0,100,32).phases.length,0);
 assert.equal(getField(0,240,0,100,32).phases.length,0);
});
