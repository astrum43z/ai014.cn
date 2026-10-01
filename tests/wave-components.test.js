import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {waveComponents,waveValue} from '../simulations.js';

test('probe components exactly match field normalization across parameters and phases',()=>{
 for(const separation of [20,100,180])for(const wavelength of [15,32,70])for(const x of [-90,0,8,90])for(const y of [-50,0,70])for(const phase of [0,.3,2,10]){
  const p=waveComponents(x,y,phase,separation,wavelength);
  assert.equal(p.combined,waveValue(x,y,phase,separation,wavelength));
  assert.ok(Math.abs(p.combined)<=p.envelope+1e-12);
  assert.ok(Math.abs(p.left)<=1&&Math.abs(p.right)<=1);
  const reflected=waveComponents(-x,y,phase,separation,wavelength);
  assert.equal(p.left,reflected.right);
  assert.equal(p.right,reflected.left);
 }
});

test('opposite phases cancel throughout a cycle while a central dark instant is not cancellation',()=>{
 for(let phase=0;phase<Math.PI*2;phase+=.1){
  const p=waveComponents(8,0,phase,100,32);
  assert.ok(Math.abs(p.combined)<1e-14);
  assert.ok(p.envelope<1e-14);
 }
 const darkPhase=50/32*2*Math.PI;
 const dark=waveComponents(0,0,darkPhase,100,32);
 assert.equal(dark.combined,0);
 assert.equal(dark.envelope,1);
 const bright=waveComponents(0,0,darkPhase-Math.PI/2,100,32);
 assert.equal(bright.combined,1);
 assert.equal(bright.envelope,1);
});

test('continuous phase envelope is the analytical maximum, including partial interference',()=>{
 for(const x of [0,4,8,14,65]){
  const leftPhase=Math.hypot(x+50,12)/32*2*Math.PI;
  const rightPhase=Math.hypot(x-50,12)/32*2*Math.PI;
  const atPeak=waveComponents(x,12,(leftPhase+rightPhase)/2-Math.PI/2,100,32);
  assert.ok(Math.abs(Math.abs(atPeak.combined)-atPeak.envelope)<1e-12);
 }
});

test('wave readout is bounded, labeled, silent during animation and uses cache-refreshed dependencies',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.equal((html.match(/id="wave-components"/g)||[]).length,1);
 for(const key of ['left','right','combined']){
  assert.ok(html.includes('aria-live="off" id="wave-value-'+key+'"'));
  assert.ok(html.includes('id="wave-bar-'+key+'"'));
 }
 assert.ok(html.indexOf('class="stage-controls"')<html.indexOf('id="wave-components"'),'existing controls stay directly under the canvas');
 assert.ok(html.includes('单源振幅各为 1'));
 assert.ok(html.includes('画面 (A+B)/2'));
 assert.ok(app.includes('./simulations.js?v=wave-components-1'));
 assert.ok(app.includes('./guides.js?v=wave-components-1'));
 assert.ok(css.includes('minmax(35px,1fr)'));
});
