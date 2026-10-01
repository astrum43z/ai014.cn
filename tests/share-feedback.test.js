import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';

async function withClipboard(clipboard,run){
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard}});
 try{await run();}finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
}
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

test('sharing shows pending and copied feedback while keeping the correct semantics for all five worlds',async()=>{
 for(const mode of ['orbit','life','wave','fractal','walk']){
  const operation=deferred(),copies=[];
  await withClipboard({writeText:url=>{copies.push(url);return operation.promise;}},async()=>{
   const h=await setup('?experiment='+mode,'#canvas',false);
   const pending=h.el('share').handlers.click();
   assert.equal(h.el('share-status').hidden,false);
   assert.match(h.el('share-status').textContent,/正在复制.*手动复制下方链接/);
   assert.equal(copies[0],h.el('share-link').value);
   assert.equal(h.el('share-link').hidden,false);
   const supported=['wave','fractal','walk'].includes(mode);
   assert.equal(h.frames.size,supported?0:1);
   assert.equal(new URL(copies[0]).searchParams.has('at'),supported);
   operation.resolve();await pending;
   assert.match(h.el('share-status').textContent,supported?/已复制观测链接.*暂停复现/:/已复制参数链接.*不包含画布图案、轨道或运行进度/);
   assert.equal(h.el('announcement').textContent,h.el('share-status').textContent);
  });
 }
});

test('missing, rejected and throwing clipboard APIs visibly recover to a focused selected readonly link',async()=>{
 for(const clipboard of [undefined,{writeText:()=>Promise.reject(Error('denied'))},{writeText:()=>{throw Error('unavailable');}}]){
  await withClipboard(clipboard,async()=>{
   const h=await setup('?experiment=walk&bias=25&seed=14&at=v1,64');let focused=0,selected=0;
   h.el('share-link').focus=()=>focused++;h.el('share-link').select=()=>selected++;
   await h.el('share').handlers.click();
   assert.match(h.el('share-status').textContent,/自动复制未完成，请复制下方观测链接/);
   assert.equal(h.el('share-status').hidden,false);assert.equal(h.el('share-link').hidden,false);
   assert.equal(focused,1);assert.equal(selected,1);
   assert.equal(h.el('announcement').textContent,h.el('share-status').textContent);
   assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),'v1,64');
   assert.match(h.el('metrics').textContent,/64 步/);
  });
 }
});

test('retry replaces fallback and an older same-link completion cannot overwrite the latest result',async()=>{
 for(const latestSuccess of [false,true]){
  const old=deferred(),latest=deferred();let calls=0;
  await withClipboard({writeText:()=>[old,latest][calls++].promise},async()=>{
   const h=await setup('?experiment=wave');const first=h.el('share').handlers.click(),second=h.el('share').handlers.click();
   if(latestSuccess)latest.resolve();else latest.reject(Error('blocked'));
   await second;const result=h.el('share-status').textContent,announcement=h.el('announcement').textContent;
   assert.match(result,latestSuccess?/已复制观测链接/:/自动复制未完成/);
   if(latestSuccess)old.reject(Error('old error'));else old.resolve();
   await first;assert.equal(h.el('share-status').textContent,result);assert.equal(h.el('announcement').textContent,announcement);
  });
 }
 await withClipboard({writeText:()=>Promise.reject(Error('blocked'))},async()=>{
  const h=await setup('?experiment=life');await h.el('share').handlers.click();
  assert.match(h.el('share-status').textContent,/自动复制未完成/);
  navigator.clipboard.writeText=async()=>{};await h.el('share').handlers.click();
  assert.match(h.el('share-status').textContent,/已复制参数链接/);
 });
});

test('parameter edits, history loads and tab round trips clear obsolete feedback and ignore late copies',async()=>{
 for(const action of ['parameter','history','tab-return','anchor']){
  const operation=deferred();
  await withClipboard({writeText:()=>operation.promise},async()=>{
   const h=await setup('?experiment=orbit&gravity=80&speed=100');const pending=h.el('share').handlers.click();
   if(action==='parameter')h.el('gravity').handlers.input({target:{value:'120'}});
   if(action==='history')h.navigate('?experiment=wave&wavelength=32&separation=100');
   if(action==='tab-return'){h.tabs[1].handlers.click();h.tabs[0].handlers.click();}
   if(action==='anchor')h.navigate(location.search+'#canvas');
   assert.equal(h.el('share-status').hidden,true,action);
   assert.equal(h.el('share-status').textContent,'',action);
   const announcement=h.el('announcement').textContent;operation.resolve();await pending;
   assert.equal(h.el('share-status').hidden,true,action);
   assert.equal(h.el('announcement').textContent,announcement,action);
  });
 }
});

test('continued exploration retains the copied fixed checkpoint without overstating current progress',async()=>{
 for(const mode of ['wave','fractal','walk'])await withClipboard({writeText:async()=>{}},async()=>{
  const h=await setup('?experiment='+mode);await h.el('share').handlers.click();
  const link=h.el('share-link').value,feedback=h.el('share-status').textContent;
  h.el('step').handlers.click();h.el('reset').handlers.click();
  assert.equal(h.el('share-link').value,link);assert.equal(h.el('share-status').textContent,feedback);
  assert.match(feedback,/打开后暂停复现这一刻/);
 });
});

test('share recovery is visible, quiet, associated with both controls, and full width on mobile',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 const status=html.match(/<p[^>]*id="share-status"[^>]*>/)?.[0];
 assert.match(status,/class="share-status"/);assert.match(status,/aria-live="off"/);assert.match(status,/hidden/);
 assert.doesNotMatch(status,/sr-only|role="(?:status|alert)"/);
 for(const id of ['share','share-link'])assert.match(html.match(new RegExp('<[^>]*id="'+id+'"[^>]*>'))?.[0],/aria-describedby="[^"]*share-status/);
 assert.match(html,/<p id="share-status"[^>]*><\/p><input id="share-link"[^>]*readonly/);
 assert.match(css,/\.controls>p\.share-status\{[^}]*grid-column:1\/-1/);
 assert.match(css,/\.controls>p\.share-status\{[^}]*font-size:13px/);
});
