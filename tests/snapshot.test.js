import test from 'node:test';
import assert from 'node:assert/strict';
import {createSnapshotSaver} from '../snapshot.js';
function setup(){
  const callbacks=[],messages=[],downloads=[],timers=[],revoked=[];
  const status={textContent:'',hidden:true};
  const button={disabled:false,setAttribute(name,value){this[name]=value;}};
  const canvas={toBlob(callback,type){assert.equal(type,'image/png');callbacks.push(callback);}};
  const link={remove(){this.removed=true;},click(){downloads.push(this.download);}};
  const document={createElement(){return link;},body:{append(){}}};
  const urlApi={createObjectURL(){return 'blob:snapshot';},revokeObjectURL(url){revoked.push(url);}};
  const save=createSnapshotSaver({canvas,button,status,announce:text=>messages.push(text),document,urlApi,delay:callback=>timers.push(callback)});
  return {save,callbacks,messages,downloads,timers,revoked,button,canvas,link,urlApi,status};
}
test('pending snapshots keep their original filename and reject repeated saves',()=>{
  const s=setup();s.save('small-worlds-orbit.png');
  assert.equal(s.button['aria-disabled'],'true');assert.equal(s.button['aria-busy'],'true');
  s.save('small-worlds-wave.png');assert.equal(s.callbacks.length,1);
  s.callbacks.shift()(new Blob(['png']));
  assert.deepEqual(s.downloads,['small-worlds-orbit.png']);
  assert.equal(s.button['aria-disabled'],'false');assert.equal(s.button['aria-busy'],'false');
  assert.equal(s.link.removed,true);assert.deepEqual(s.revoked,[]);
  s.timers.shift()();assert.deepEqual(s.revoked,['blob:snapshot']);
  assert.match(s.messages.at(-1),/已发起/);
  s.save('small-worlds-life.png');s.callbacks.shift()(new Blob(['png']));
  assert.deepEqual(s.downloads,['small-worlds-orbit.png','small-worlds-life.png']);
});
test('null encoding result gives feedback and allows retry',()=>{
  const s=setup();s.save('first.png');s.callbacks.shift()(null);
  assert.match(s.messages.at(-1),/失败.*重试/);assert.equal(s.button['aria-disabled'],'false');
  assert.deepEqual(s.downloads,[]);assert.equal(s.timers.length,0);
  s.save('retry.png');s.callbacks.shift()(new Blob(['png']));assert.deepEqual(s.downloads,['retry.png']);
});
test('synchronous encoding errors restore the save control',()=>{
  const s=setup();s.canvas.toBlob=()=>{throw new Error('encoding unavailable');};
  assert.doesNotThrow(()=>s.save('first.png'));assert.equal(s.button['aria-disabled'],'false');
  assert.match(s.messages.at(-1),/失败.*重试/);
  s.canvas.toBlob=callback=>callback(new Blob(['png']));s.save('retry.png');
  assert.deepEqual(s.downloads,['retry.png']);
});
for(const stage of ['object URL','download'])test(`${stage} errors do not leak a link or block retry`,()=>{
  const s=setup();
  if(stage==='object URL')s.urlApi.createObjectURL=()=>{throw new Error('URL unavailable');};
  else s.link.click=()=>{throw new Error('download unavailable');};
  s.save('first.png');assert.doesNotThrow(()=>s.callbacks.shift()(new Blob(['png'])));
  assert.equal(s.button['aria-disabled'],'false');assert.match(s.messages.at(-1),/失败.*重试/);
  if(stage==='download'){assert.equal(s.link.removed,true);s.timers.shift()();assert.deepEqual(s.revoked,['blob:snapshot']);}
  else assert.equal(s.timers.length,0);
  s.urlApi.createObjectURL=()=> 'blob:retry';s.link.click=()=>s.downloads.push(s.link.download);
  s.save('retry.png');s.callbacks.shift()(new Blob(['png']));assert.deepEqual(s.downloads,['retry.png']);
});


test('visible progress identifies the captured experiment without announcing premature success',()=>{
  const s=setup();s.save('small-worlds-life.png','生命的形状');
  assert.equal(s.status.hidden,false);
  assert.equal(s.status.textContent,'正在生成「生命的形状」PNG 图片…');
  assert.deepEqual(s.messages,[],'pending feedback does not add another live announcement');
  s.save('small-worlds-wave.png','波与波相遇');
  assert.equal(s.status.textContent,'正在生成「生命的形状」PNG 图片…');
  assert.equal(s.callbacks.length,1);
  s.callbacks.shift()(new Blob(['png']));
  assert.equal(s.status.textContent,'已发起「生命的形状」PNG 图片下载，请查看浏览器下载列表');
  assert.deepEqual(s.messages,[s.status.textContent]);
  assert.deepEqual(s.downloads,['small-worlds-life.png']);
  assert.doesNotMatch(s.status.textContent,/下载成功|已保存/,'cannot confirm browser or disk completion');
});

test('visible failure explains retry and the next attempt replaces stale feedback',()=>{
  const s=setup();s.save('small-worlds-orbit.png','引力游乐场');s.callbacks.shift()(null);
  assert.equal(s.status.hidden,false);
  assert.match(s.status.textContent,/引力游乐场.*失败.*保存这一刻.*重试/);
  assert.equal(s.messages.at(-1),s.status.textContent);
  s.save('small-worlds-wave.png','波与波相遇');
  assert.equal(s.status.textContent,'正在生成「波与波相遇」PNG 图片…');
  s.callbacks.shift()(new Blob(['png']));
  assert.match(s.status.textContent,/已发起.*波与波相遇.*下载列表/);
  assert.equal(s.messages.at(-1),s.status.textContent);
  assert.deepEqual(s.downloads,['small-worlds-wave.png']);
});

for(const stage of ['encoding','object URL','download'])test(`${stage} errors produce the same visible and spoken retry guidance`,()=>{
  const s=setup();
  if(stage==='encoding')s.canvas.toBlob=()=>{throw new Error('encoding unavailable');};
  if(stage==='object URL')s.urlApi.createObjectURL=()=>{throw new Error('URL unavailable');};
  if(stage==='download')s.link.click=()=>{throw new Error('download unavailable');};
  s.save('small-worlds-fractal.png','随机长出秩序');
  if(stage!=='encoding')s.callbacks.shift()(new Blob(['png']));
  assert.equal(s.status.hidden,false);
  assert.match(s.status.textContent,/随机长出秩序.*失败.*重试/);
  assert.deepEqual(s.messages,[s.status.textContent]);
  assert.equal(s.button['aria-disabled'],'false');assert.equal(s.button['aria-busy'],'false');
});
