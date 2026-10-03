import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
function trackNativeDisable(h){
 const button=h.el('save');let disabled=false,writes=0;
 // Model the native focus loss separately from the ordinary harness's plain
 // buttons. This reproduces the BODY focus observed on the public baseline.
 Object.defineProperty(button,'disabled',{get:()=>disabled,set:value=>{
  writes++;disabled=value;if(value&&document.activeElement===button)document.activeElement=document.body;
 }});
 return ()=>writes;
}
const state=h=>({drawing:h.drawing(),metrics:h.el('metrics').textContent,status:h.el('status').textContent,href:location.href,frames:[...h.frames.keys()],notes:h.el('field-notes-list').innerHTML});

test('PNG encoding preserves Save focus and suppresses duplicate pointer or assistive activations',async()=>{
 const h=await setup('?experiment=life'),writes=trackNativeDisable(h),callbacks=[];
 h.el('canvas').toBlob=callback=>callbacks.push(callback);h.el('save').focus();const before=state(h);
 click(h,'save');assert.equal(document.activeElement,h.el('save'));
 assert.equal(h.el('save').getAttribute('aria-disabled'),'true');assert.equal(h.el('save').getAttribute('aria-busy'),'true');
 for(let i=0;i<5;i++)click(h,'save');assert.equal(callbacks.length,1);assert.deepEqual(state(h),before);
 callbacks.shift()(new Blob(['png']));assert.equal(document.activeElement,h.el('save'));
 assert.equal(h.el('save').getAttribute('aria-disabled'),'false');assert.equal(h.el('save').getAttribute('aria-busy'),'false');
 assert.equal(writes(),0);assert.deepEqual(state(h),before);assert.equal(h.el('generated').download,'small-worlds-life.png');
 click(h,'save');assert.equal(callbacks.length,1);callbacks.shift()(new Blob(['png']));assert.equal(writes(),0);
});

for(const stage of ['encoding','empty result','object URL','download'])test(`PNG ${stage} failure preserves focus, exposes retry and restores availability`,async()=>{
 const h=await setup('?experiment=wave'),writes=trackNativeDisable(h),callbacks=[];
 h.el('canvas').toBlob=callback=>callbacks.push(callback);
 const create=URL.createObjectURL,download=h.el('generated').click;
 try{
  if(stage==='encoding')h.el('canvas').toBlob=()=>{throw Error('encoding');};
  if(stage==='object URL')URL.createObjectURL=()=>{throw Error('URL');};
  if(stage==='download')h.el('generated').click=()=>{throw Error('download');};
  h.el('save').focus();const before=state(h);click(h,'save');
  if(stage!=='encoding')callbacks.shift()(stage==='empty result'?null:new Blob(['png']));
  assert.equal(document.activeElement,h.el('save'));assert.equal(writes(),0);
  assert.equal(h.el('save').getAttribute('aria-disabled'),'false');assert.equal(h.el('save').getAttribute('aria-busy'),'false');
  assert.match(h.el('save-status').textContent,/波与波相遇.*失败.*重试/);assert.deepEqual(state(h),before);
 }finally{URL.createObjectURL=create;h.el('generated').click=download;}
 h.el('canvas').toBlob=callback=>callbacks.push(callback);click(h,'save');callbacks.shift()(new Blob(['png']));
 assert.match(h.el('save-status').textContent,/已发起.*波与波相遇/);assert.equal(document.activeElement,h.el('save'));
});

test('late PNG completion never steals focus after navigation, a world change or a new action',async()=>{
 for(const result of [new Blob(['png']),null])for(const destination of ['share','tab-fractal','canvas']){
  const h=await setup('?experiment=life'),writes=trackNativeDisable(h);let callback;
  h.el('canvas').toBlob=value=>callback=value;h.el('save').focus();click(h,'save');
  if(destination==='tab-fractal')click(h,destination);
  h.el(destination).focus();const before=state(h);callback(result);
  assert.equal(document.activeElement,h.el(destination));assert.equal(writes(),0);assert.deepEqual(state(h),before);
  assert.match(h.el('save-status').textContent,/生命的形状/);assert.equal(h.el('save').getAttribute('aria-disabled'),'false');
 }
});

function key(h,key,repeat=false){
 let prevented=false;
 h.el('save').handlers.keydown?.({key,repeat,preventDefault(){prevented=true;}});
 // Native Enter clicks on keydown unless prevented; Space activates on keyup.
 if(key==='Enter'&&!prevented)click(h,'save');
 return prevented;
}
test('a held Enter saves once even when PNG encoding completes before the next key repeat',async()=>{
 const h=await setup('?experiment=fractal'),writes=trackNativeDisable(h);let encodings=0,downloads=0;
 h.el('canvas').toBlob=callback=>{encodings++;callback(new Blob(['png']));};h.el('generated').click=()=>downloads++;
 h.el('save').focus();const before=state(h);assert.equal(key(h,'Enter'),false);
 for(let i=0;i<8;i++)assert.equal(key(h,'Enter',true),true);
 assert.equal(encodings,1);assert.equal(downloads,1);assert.equal(document.activeElement,h.el('save'));
 assert.equal(key(h,'Enter'),false);assert.equal(encodings,2);assert.equal(downloads,2);assert.equal(writes(),0);assert.deepEqual(state(h),before);
});

test('pending held Enter, native Space and navigation keys keep their separate behavior',async()=>{
 const h=await setup('?experiment=walk'),callbacks=[];let downloads=0;
 h.el('canvas').toBlob=callback=>callbacks.push(callback);h.el('generated').click=()=>downloads++;h.el('save').focus();
 key(h,'Enter');assert.equal(key(h,'Enter',true),true);assert.equal(callbacks.length,1);
 for(const name of [' ','Tab','ArrowLeft','Escape'])for(const repeat of [false,true])assert.equal(key(h,name,repeat),false);
 assert.equal(callbacks.length,1);callbacks.shift()(new Blob(['png']));assert.equal(downloads,1);
 click(h,'save');assert.equal(callbacks.length,1,'native Space keyup/pointer click remains usable');callbacks.shift()(new Blob(['png']));assert.equal(downloads,2);
});

test('PNG saving keeps state intact in all five running experiments and at both progress caps',async()=>{
 for(const query of ['orbit','life','wave','fractal','walk','fractal&at=v1,12000','walk&at=v1,512']){
  const h=await setup('?experiment='+query,'',false),writes=trackNativeDisable(h);let callback;
  h.el('canvas').toBlob=value=>callback=value;h.el('save').focus();const before=state(h);click(h,'save');
  assert.deepEqual(state(h),before);callback(new Blob(['png']));assert.deepEqual(state(h),before);
  assert.equal(document.activeElement,h.el('save'));assert.equal(writes(),0);
 }
});

test('PNG busy styling remains perceivable without removing keyboard focus or creating a new live region',()=>{
 const css=readFileSync(new URL('../style.css',import.meta.url),'utf8'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const rule=css.match(/#save\[aria-disabled="true"\]\{([^}]+)\}/)?.[1];assert.ok(rule);assert.match(rule,/cursor:wait/);
 assert.doesNotMatch(rule,/display:none|visibility:hidden|pointer-events:none/);
 const button=html.match(/<button id="save"[^>]*>/)?.[0];assert.ok(button);assert.doesNotMatch(button,/\sdisabled|tabindex="-1"/);
 assert.match(button,/aria-describedby="save-status"/);assert.match(html,/<p id="save-status"[^>]*aria-live="off"/);
});
