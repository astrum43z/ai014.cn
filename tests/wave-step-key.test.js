import test from 'node:test';
import assert from 'node:assert/strict';
import {setup as setupHarness} from './life-challenge-harness.js';
// These checks inspect visible displacement bars; open their native drawer.
async function setup(...args){const h=await setupHarness(...args);h.el('instruments').open=true;h.el('instruments').handlers.toggle();return h;}
import {waveComponents} from '../simulations.js';

const quarter=Math.PI/6;
const click=(h,id='step')=>h.el(id).handlers.click();
// Model the native Enter click only when keydown's default is not cancelled.
function key(h,name='Enter',repeat=false){
 let prevented=false;
 h.el('step').handlers.keydown({key:name,repeat,preventDefault(){prevented=true;}});
 if(name==='Enter'&&!prevented)click(h);
 return prevented;
}
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),metrics:h.el('metrics').textContent,
 readings:['wave-value-left','wave-value-right','wave-value-combined','wave-probe-reading','wave-path-context','wave-envelope','wave-distances','wave-difference','observation-a','observation-b','observation-c'].map(id=>h.el(id).textContent),
 message:h.el('announcement').textContent,status:h.el('status').textContent,frames:[...h.frames.keys()],
 focus:document.activeElement,url:location.href,writes:h.writes(),saved:h.el('saved-observation-reading').textContent,
 link:h.el('share-link').value,linkHidden:h.el('share-link').hidden,notes:h.el('notes-text').value,
 mission:h.el('mission-result').textContent,phase:h.el('mission-state').textContent});
function repeats(h){
 const before=state(h);
 for(let i=0;i<15;i++)assert.equal(key(h,'Enter',true),true);
 assert.deepEqual(state(h),before,'held repeats do not skip phases, redraw, announce, alter a checkpoint or move focus');
}
function values(h,x,y,time,separation=100,wavelength=32){
 const expected=waveComponents(x,y,time*3,separation,wavelength);
 for(const name of ['left','right','combined']){
  const bar=h.el('wave-bar-'+name),width=Number(bar.getAttribute('width'))/100;
  const actual=Number(bar.getAttribute('x'))<100?-width:width;
  assert.ok(Math.abs(actual-expected[name])<1e-10,`${name}: ${actual} = ${expected[name]}`);
 }
}

for(const [label,x,y,time,separation,wavelength] of [
 ['center',0,0,0,100,32],['cancellation',8,0,2.5,100,32],
 ['mixed',-19,42,7.3,180,15],['wide checkpoint',300,-130,1e6,20,70]
])test(`${label}: each fresh Enter advances one exact quarter while its repeats preserve the comparison`,async()=>{
 const h=await setup(`?experiment=wave&wavelength=${wavelength}&separation=${separation}&at=v1,${x},${y},${time}`);
 h.el('step').focus();let next=time;
 for(let n=1;n<=4;n++){
  assert.equal(key(h),false);next+=quarter;values(h,x,y,next,separation,wavelength);repeats(h);
  assert.equal(h.frames.size,0);assert.equal(document.activeElement,h.el('step'));
 }
});

test('an arriving repeat leaves a running wave alone; the fresh press pauses exactly its current phase',async()=>{
 const h=await setup('?experiment=wave','',false);h.tick(0);h.tick(50);h.el('step').focus();repeats(h);
 assert.equal(h.frames.size,1);values(h,0,0,.05);
 key(h);values(h,0,0,.05+quarter);assert.equal(h.frames.size,0);repeats(h);
 click(h,'pause');h.tick(2000);h.tick(2050);values(h,0,0,.1+quarter);
 h.motion.change({matches:true});repeats(h);key(h);values(h,0,0,.1+quarter*2);assert.equal(h.frames.size,0);
});

test('a shared observation stays fixed across phase steps, resize, retained worlds and history restoration',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,12,2.5','#canvas');await click(h,'share');
 const shared=h.el('share-link').value;key(h);values(h,8,12,2.5+quarter);h.el('step').focus();repeats(h);
 assert.equal(location.href,shared);assert.equal(h.el('share-link').value,shared);
 h.tabs[1].handlers.click();click(h,'life-toggle');const life=h.el('metrics').textContent;
 h.tabs[2].handlers.click();h.resize(259,240);h.navigate(location.search+'#control-title');h.el('step').focus();repeats(h);
 values(h,8,12,2.5+quarter);key(h);values(h,8,12,2.5+quarter*2);
 h.tabs[1].handlers.click();assert.equal(h.el('metrics').textContent,life);h.tabs[2].handlers.click();
 h.navigate('?experiment=wave&wavelength=65&separation=150&at=v1,20,-5,9#canvas');
 h.el('step').focus();repeats(h);key(h);values(h,20,-5,9+quarter,150,65);
});

test('parameter edits, reset, preset and guide keep the guard on the shared step control',async()=>{
 const h=await setup('?experiment=wave');
 h.el('wavelength').handlers.input({target:{value:'70'}});h.el('separation').handlers.input({target:{value:'180'}});
 h.el('step').focus();key(h);values(h,0,0,quarter,180,70);repeats(h);
 click(h,'reset');h.el('step').focus();repeats(h);key(h);values(h,0,0,quarter,180,70);
 h.el('preset-select').handlers.change({target:{value:'wide'}});click(h,'load-preset');h.el('step').focus();repeats(h);key(h);values(h,0,0,quarter,150,65);
 click(h,'guide-start');h.el('step').focus();repeats(h);key(h);values(h,8,0,quarter);
});

test('held phases cannot check an exploration or overwrite its historical note',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');click(h,'mission-check');
 h.el('step').focus();key(h);repeats(h);assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'wave-home');key(h);repeats(h);assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const note=h.el('notes-text').value;
 h.el('step').focus();key(h);repeats(h);assert.equal(h.el('notes-text').value,note);
});

test('native Space, navigation, pointer and assistive clicks remain available',async()=>{
 const h=await setup('?experiment=wave');h.el('step').focus();const before=state(h);
 for(const name of [' ','Tab','Escape','ArrowRight','Home'])for(const repeat of [false,true])assert.equal(key(h,name,repeat),false);
 assert.deepEqual(state(h),before);
 for(let n=1;n<=3;n++){click(h);values(h,0,0,n*quarter);}
 key(h);values(h,0,0,quarter*4);
});

test('Life keeps its exact generation and Orbit, Fractal and Walk keep repeatable batch steps',async()=>{
 const h=await setup('?experiment=wave');
 for(const [index,mode] of [[0,'orbit'],[1,'life'],[3,'fractal'],[4,'walk']]){
  h.tabs[index].handlers.click();h.el('step').focus();key(h);const first=h.el('metrics').textContent;
  if(mode==='life'){
   assert.equal(key(h,'Enter',true),true);assert.equal(h.el('metrics').textContent,first);
  }else{
   assert.equal(key(h,'Enter',true),false);assert.notEqual(h.el('metrics').textContent,first);
  }
  h.tabs[2].handlers.click();h.el('step').focus();repeats(h);
 }
});
