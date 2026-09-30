import test from 'node:test';
import assert from 'node:assert/strict';
import {createSnapshotSaver} from '../snapshot.js';
function setup(){
  const callbacks=[],messages=[],downloads=[],timers=[],revoked=[];
  const button={disabled:false,setAttribute(name,value){this[name]=value;}};
  const canvas={toBlob(callback,type){assert.equal(type,'image/png');callbacks.push(callback);}};
  const link={remove(){this.removed=true;},click(){downloads.push(this.download);}};
  const document={createElement(){return link;},body:{append(){}}};
  const urlApi={createObjectURL(){return 'blob:snapshot';},revokeObjectURL(url){revoked.push(url);}};
  const save=createSnapshotSaver({canvas,button,announce:text=>messages.push(text),document,urlApi,delay:callback=>timers.push(callback)});
  return {save,callbacks,messages,downloads,timers,revoked,button,canvas,link,urlApi};
}
test('pending snapshots keep their original filename and reject repeated saves',()=>{
  const s=setup();s.save('small-worlds-orbit.png');
  assert.equal(s.button.disabled,true);assert.equal(s.button['aria-busy'],'true');
  s.save('small-worlds-wave.png');assert.equal(s.callbacks.length,1);
  s.callbacks.shift()(new Blob(['png']));
  assert.deepEqual(s.downloads,['small-worlds-orbit.png']);
  assert.equal(s.button.disabled,false);assert.equal(s.button['aria-busy'],'false');
  assert.equal(s.link.removed,true);assert.deepEqual(s.revoked,[]);
  s.timers.shift()();assert.deepEqual(s.revoked,['blob:snapshot']);
  assert.match(s.messages.at(-1),/已发起/);
  s.save('small-worlds-life.png');s.callbacks.shift()(new Blob(['png']));
  assert.deepEqual(s.downloads,['small-worlds-orbit.png','small-worlds-life.png']);
});
test('null encoding result gives feedback and allows retry',()=>{
  const s=setup();s.save('first.png');s.callbacks.shift()(null);
  assert.match(s.messages.at(-1),/失败.*重试/);assert.equal(s.button.disabled,false);
  assert.deepEqual(s.downloads,[]);assert.equal(s.timers.length,0);
  s.save('retry.png');s.callbacks.shift()(new Blob(['png']));assert.deepEqual(s.downloads,['retry.png']);
});
test('synchronous encoding errors restore the save control',()=>{
  const s=setup();s.canvas.toBlob=()=>{throw new Error('encoding unavailable');};
  assert.doesNotThrow(()=>s.save('first.png'));assert.equal(s.button.disabled,false);
  assert.match(s.messages.at(-1),/失败.*重试/);
  s.canvas.toBlob=callback=>callback(new Blob(['png']));s.save('retry.png');
  assert.deepEqual(s.downloads,['retry.png']);
});
for(const stage of ['object URL','download'])test(`${stage} errors do not leak a link or block retry`,()=>{
  const s=setup();
  if(stage==='object URL')s.urlApi.createObjectURL=()=>{throw new Error('URL unavailable');};
  else s.link.click=()=>{throw new Error('download unavailable');};
  s.save('first.png');assert.doesNotThrow(()=>s.callbacks.shift()(new Blob(['png'])));
  assert.equal(s.button.disabled,false);assert.match(s.messages.at(-1),/失败.*重试/);
  if(stage==='download'){assert.equal(s.link.removed,true);s.timers.shift()();assert.deepEqual(s.revoked,['blob:snapshot']);}
  else assert.equal(s.timers.length,0);
  s.urlApi.createObjectURL=()=> 'blob:retry';s.link.click=()=>s.downloads.push(s.link.download);
  s.save('retry.png');s.callbacks.shift()(new Blob(['png']));assert.deepEqual(s.downloads,['retry.png']);
});
