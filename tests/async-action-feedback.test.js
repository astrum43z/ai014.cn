import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
async function clipboard(run){
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator'),requests=[];
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:url=>{const request={...deferred(),url};requests.push(request);return request.promise;}}}});
 try{await run(requests);}finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
}
const settle=(request,success)=>success?request.resolve():request.reject(Error('clipboard unavailable'));
const state=h=>({drawing:h.drawing(),metrics:h.el('metrics').textContent,href:location.href,frames:[...h.frames.keys()],notes:h.el('field-notes-list').innerHTML,focus:document.activeElement});
function snapshot(h){
 const callbacks=[],downloads=[];
 h.el('canvas').toBlob=callback=>callbacks.push(callback);
 h.el('generated').click=()=>downloads.push(h.el('generated').download);
 return {callbacks,downloads,finish(success){callbacks.shift()(success?new Blob(['png']):null);}};
}

for(const success of [true,false])for(const button of ['share','observation-copy'])test(`${button}: late ${success?'success':'failure'} retains the newer Walk reading and the visible fixed-link result`,async()=>clipboard(async requests=>{
 const h=await setup('?experiment=walk&at=v1,64'),pending=click(h,button);
 click(h,'walk-step-one');h.el('walk-step-one').focus();
 const latest=h.el('announcement').textContent,before=state(h);
 assert.match(latest,/65 步/);settle(requests[0],success);await pending;
 assert.equal(h.el('announcement').textContent,latest);assert.deepEqual(state(h),before);
 assert.match(h.el('share-status').textContent,success?/已复制/:/自动复制未完成/);
 assert.equal(h.el('share-status').hidden,false);
 assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),'v1,64');
}));

for(const world of ['orbit','life','wave','fractal','walk'])for(const success of [true,false])test(`${world}: delayed PNG ${success?'success':'failure'} does not replace its later step announcement`,async()=>{
 const h=await setup('?experiment='+world),s=snapshot(h);click(h,'save');click(h,'step');h.el('step').focus();
 const latest=h.el('announcement').textContent,before=state(h);s.finish(success);
 assert.equal(h.el('announcement').textContent,latest);assert.deepEqual(state(h),before);
 assert.match(h.el('save-status').textContent,success?/已发起.*下载列表/:/失败.*重试/);
 assert.equal(h.el('save-status').hidden,false);assert.equal(h.el('save').getAttribute('aria-busy'),'false');
 assert.equal(h.el('save').getAttribute('aria-disabled'),'false');
 assert.deepEqual(s.downloads,success?[`small-worlds-${world}.png`]:[]);
});

test('a late Life image keeps its original name without replacing the new Wave action',async()=>{
 const h=await setup('?experiment=life'),s=snapshot(h);click(h,'save');click(h,'tab-wave');click(h,'step');
 const latest=h.el('announcement').textContent,before=state(h);s.finish(true);
 assert.equal(h.el('announcement').textContent,latest);assert.deepEqual(state(h),before);
 assert.match(h.el('save-status').textContent,/生命的形状/);assert.deepEqual(s.downloads,['small-worlds-life.png']);
});

test('a repeated identical action message still supersedes earlier asynchronous work',async()=>clipboard(async requests=>{
 const h=await setup('?experiment=walk&at=v1,64');click(h,'reset');const reset=h.el('announcement').textContent;
 const pending=click(h,'observation-copy');click(h,'reset');assert.equal(h.el('announcement').textContent,reset);
 settle(requests[0],true);await pending;assert.equal(h.el('announcement').textContent,reset);
 const s=snapshot(h);click(h,'save');click(h,'reset');s.finish(false);assert.equal(h.el('announcement').textContent,reset);
}));

for(const order of ['copy then image','image then copy'])for(const newestFirst of [true,false])test(`${order}: the newer pending request owns speech even when it ${newestFirst?'finishes first':'finishes last'}`,async()=>clipboard(async requests=>{
 const h=await setup('?experiment=walk&at=v1,64'),s=snapshot(h);let copy;
 if(order==='copy then image'){copy=click(h,'observation-copy');click(h,'save');}
 else{click(h,'save');copy=click(h,'observation-copy');}
 const before=h.el('announcement').textContent;
 const finishCopy=async()=>{settle(requests[0],true);await copy;};
 const finishImage=async()=>s.finish(true);
 const newest=order==='copy then image'?finishImage:finishCopy,oldest=order==='copy then image'?finishCopy:finishImage;
 if(newestFirst){await newest();const result=h.el('announcement').textContent;await oldest();assert.equal(h.el('announcement').textContent,result);}
 else{await oldest();assert.equal(h.el('announcement').textContent,before);await newest();}
 assert.match(h.el('announcement').textContent,order==='copy then image'?/已发起.*PNG/:/已复制链接中的观测/);
 assert.match(h.el('share-status').textContent,/已复制链接中的观测/);assert.match(h.el('save-status').textContent,/已发起.*PNG/);
 assert.deepEqual(s.downloads,['small-worlds-walk.png']);
}));

test('an ignored busy Save activation cannot steal the newer copy request announcement',async()=>clipboard(async requests=>{
 const h=await setup('?experiment=walk&at=v1,64'),s=snapshot(h);click(h,'save');const pending=click(h,'observation-copy');
 click(h,'save');assert.equal(s.callbacks.length,1);settle(requests[0],false);await pending;
 const latest=h.el('announcement').textContent;assert.match(latest,/自动复制未完成/);
 s.finish(true);assert.equal(h.el('announcement').textContent,latest);
}));

test('quiet redraws and ordinary running frames leave the latest pending result eligible',async()=>clipboard(async requests=>{
 const h=await setup('?experiment=orbit','',false),s=snapshot(h);const pending=click(h,'share');
 h.resize(233,240);h.setDpr(2);h.tick(0);h.tick(20);h.el('share-link').focus();
 settle(requests[0],true);await pending;assert.equal(h.el('announcement').textContent,h.el('share-status').textContent);
 click(h,'save');h.resize(600,414);h.setDpr(1);h.tick(40);h.tick(60);s.finish(true);
 assert.equal(h.el('announcement').textContent,h.el('save-status').textContent);assert.equal(h.frames.size,1);
}));

test('validation errors and automatic caps retain precedence over a late export',async()=>{
 const h=await setup('?experiment=fractal&at=v1,11999'),s=snapshot(h);click(h,'save');
 h.el('fractal-count').value='oops';click(h,'fractal-seek');const error=h.el('announcement').textContent;
 s.finish(false);assert.equal(h.el('announcement').textContent,error);assert.equal(h.el('fractal-count').getAttribute('aria-invalid'),'true');
 click(h,'pause');click(h,'save');h.tick(0);h.tick(50);h.tick(100);const limit=h.el('announcement').textContent;
 assert.match(limit,/12,000.*退回一点/);s.finish(true);assert.equal(h.el('announcement').textContent,limit);assert.equal(h.frames.size,0);
});

test('a latest synchronous capture error still announces and does not queue a capture',async()=>{
 const h=await setup('?experiment=life'),s=snapshot(h);h.loseContext();click(h,'save');
 assert.equal(s.callbacks.length,0);assert.equal(h.el('announcement').textContent,h.el('save-status').textContent);
 assert.match(h.el('announcement').textContent,/画布暂时不可用/);
});

test('the app and snapshot cache keys change while one polite action region and quiet outcome regions remain',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(html,/app\.js\?[^"]*&amp;feedback=latest-action-1/);assert.match(app,/snapshot\.js\?[^']*&feedback=latest-action-1/);
 assert.match(html,/<p id="announcement" class="sr-only" aria-live="polite" aria-atomic="true"><\/p>/);
 for(const id of ['share-status','save-status'])assert.match(html,new RegExp(`<p id="${id}"[^>]*aria-live="off"`));
});
