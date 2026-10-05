import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
const click=(h,id='fractal-back-batch')=>h.el(id).handlers.click();
const count=h=>Number(h.el('metrics').textContent.match(/^\d+/)[0]);
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),status:h.el('status').textContent,frames:[...h.frames.keys()],url:location.href,writes:h.writes(),message:h.el('announcement').textContent,notes:h.el('field-notes-list').innerHTML});
const seek=(h,n)=>{h.el('fractal-count').value=String(n);click(h,'fractal-seek');};
// Independent integer recurrence, vertex selection and Float32 projection.
// No imports from the model or cached rendering helpers.
function oracle(seed,jump,n){
 let rng=BigInt(seed),x=0,y=-1,px=x,py=y,last=0;
 const vertices=[[0,-1],[-Math.sqrt(3)/2,.5],[Math.sqrt(3)/2,.5]],points=[],counts=[0,0,0],ratio=jump/100;
 for(let i=0;i<n;i++){
  rng=(1664525n*rng+1013904223n)%4294967296n;last=Number(rng*3n/4294967296n);
  px=x;py=y;x+=(vertices[last][0]-x)*ratio;y+=(vertices[last][1]-y)*ratio;
  points.push([Math.fround(x),Math.fround(y)]);counts[last]++;
 }
 const scale=Math.min(600/2.1,414/1.85),project=([x,y])=>[300+x*scale,207+scale*.25+y*scale];
 return {points:points.map(project),from:project([px,py]),to:project([x,y]),chosen:project(vertices[last]),counts,last};
}
function check(h,n,seed=14,jump=50){
 const expected=oracle(seed,jump,n),drawing=h.drawing(),points=drawing.filter(c=>c[0]==='rect');
 assert.equal(count(h),n);assert.equal(h.frames.size,0);assert.equal(points.length,n);
 const pair=(actual,wanted)=>wanted.forEach((v,i)=>assert.ok(Math.abs(actual[i]-v)<1e-9,`${actual[i]} ≈ ${v}`));
 points.forEach((p,i)=>{pair(p.slice(1,3),expected.points[i]);assert.deepEqual(p.slice(3),[1.3,1.3]);});
 const arcs=drawing.filter(c=>c[0]==='arc');
 pair(arcs.find(c=>c[3]===5).slice(1,3),expected.from);pair(arcs.find(c=>c[3]===4).slice(1,3),expected.to);pair(arcs.find(c=>c[3]===8).slice(1,3),expected.chosen);
 assert.equal(h.el('fractal-choice-reading').textContent,`当前序列前 ${n} 次 · A ${expected.counts[0]} 次，B ${expected.counts[1]} 次，C ${expected.counts[2]} 次`);
 assert.match(h.el('fractal-touch-reading').textContent,new RegExp(`第 ${n} 点，抽中顶点 ${'ABC'[expected.last]}`));
 assert.equal(h.el('fractal-back-batch').getAttribute('aria-disabled'),String(n===300));
 assert.equal(h.el('fractal-back').getAttribute('aria-disabled'),String(n===300));
 assert.equal(h.el('fractal-forward').getAttribute('aria-disabled'),String(n===12000));
}

for(const [seed,jump,n] of [[14,50,400],[1,35,301],[99,70,12000],[23,65,731],[37,53,399]])test(`batch rewind recreates every point and last jump at ${Math.max(300,n-100)} (${seed}, ${jump})`,async()=>{
 const h=await setup(`?experiment=fractal&seed=${seed}&jump=${jump}&at=v1,${n}`);h.el('fractal-back-batch').focus();click(h);check(h,Math.max(300,n-100),seed,jump);
 assert.equal(document.activeElement,h.el('fractal-back-batch'));assert.notEqual(h.el('fractal-back-batch').disabled,true);assert.match(h.el('announcement').textContent,/已暂停并分批退回/);
});
test('all 36 ratios replay the exact prefix, next random draw and forward batch',async()=>{
 for(let jump=35;jump<=70;jump++){
  const h=await setup(`?experiment=fractal&seed=51&jump=${jump}&at=v1,731`),original=h.drawing();
  click(h);check(h,631,51,jump);click(h,'step');assert.deepEqual(h.drawing(),original);
  click(h,'fractal-forward');const next=h.drawing();click(h);check(h,632,51,jump);click(h,'step');assert.deepEqual(h.drawing(),next);
 }
});
test('repeated batches reach the start, stay quiet there and leave native Enter repetition available',async()=>{
 const h=await setup('?experiment=fractal&at=v1,731');
 for(const n of [631,531,431,331,300]){click(h);check(h,n);}
 const before=state(h);for(let i=0;i<5;i++)click(h);assert.deepEqual(state(h),before);
 assert.equal(h.el('fractal-back-batch').handlers.keydown,undefined);
 for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional primary batch suppressed');}});click(h,'step');}
 check(h,500);
});
test('unavailable batch does not pause or redraw even a running initial model',async()=>{
 const h=await setup('?experiment=fractal');
 for(const running of [false,true]){if(running)click(h,'pause');const before=state(h);click(h);assert.deepEqual(state(h),before);}
});
test('rewind stops running and clears fractional timing before continuation',async()=>{
 const h=await setup('?experiment=fractal&at=v1,731');click(h,'pause');h.tick(0);h.tick(50);const url=location.href;
 click(h);check(h,631);assert.equal(location.href,url);click(h,'pause');h.tick(50000);h.tick(50050);assert.equal(count(h),631);h.tick(50100);click(h,'pause');check(h,731);
});
test('upper limit reopens after rewind and partial forward batches keep the cap',async()=>{
 const h=await setup('?experiment=fractal&at=v1,11951');click(h);check(h,11851);click(h,'step');check(h,11951);click(h,'step');check(h,12000);
 assert.equal(h.el('pause').getAttribute('aria-disabled'),'true');click(h);check(h,11900);assert.equal(h.el('pause').getAttribute('aria-disabled'),'false');click(h,'step');check(h,12000);
});
test('canvas arrows remain guarded one-point actions with no new shortcuts',async()=>{
 const h=await setup('?experiment=fractal&at=v1,731');h.el('canvas').focus();h.key('ArrowLeft');check(h,730);h.key('ArrowLeft',{repeat:true});check(h,730);h.key('ArrowRight');check(h,731);
 const before=state(h);for(const extra of [{isComposing:true},{keyCode:229},{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true}])for(const key of ['ArrowLeft','ArrowRight'])h.key(key,{...extra,preventDefault(){assert.fail('excluded key intercepted');}});
 assert.deepEqual(state(h),before);assert.equal(document.activeElement,h.el('canvas'));assert.equal(h.el('canvas').getAttribute('aria-keyshortcuts'),'Escape ArrowLeft ArrowRight');
 click(h,'tab-walk');h.key('ArrowRight',{repeat:true});assert.match(h.el('metrics').textContent,/32 步/);h.key('ArrowLeft',{repeat:true});assert.match(h.el('metrics').textContent,/16 步/);
});
test('fixed shared observation and one-level return recovery survive batch replay',async()=>{
 const h=await setup('?experiment=fractal&at=v1,731');click(h,'step');const original=h.drawing();click(h,'observation-return');
 const summary=h.el('saved-observation-reading').textContent,url=location.href;click(h);check(h,631);assert.equal(location.href,url);assert.equal(h.el('saved-observation-reading').textContent,summary);
 click(h,'observation-undo');check(h,831);assert.deepEqual(h.drawing(),original);await click(h,'share');assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),'v1,831');
});
test('older pending copying cannot replace the new rewind announcement',async()=>{
 let resolve;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(r=>resolve=r)}}});
 try{const h=await setup('?experiment=fractal&at=v1,731'),pending=click(h,'share');click(h);const message=h.el('announcement').textContent;resolve();await pending;assert.equal(h.el('announcement').textContent,message);check(h,631);assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),'v1,731');}finally{delete globalThis.navigator;}
});
test('drafts, errors and other worlds remain independent of replay',async()=>{
 const h=await setup('?experiment=fractal&at=v1,731');h.el('fractal-count').value='bad';click(h,'fractal-seek');const error=h.el('fractal-seek-error').textContent;
 click(h);check(h,631);assert.equal(h.el('fractal-count').value,'bad');assert.equal(h.el('fractal-seek-error').textContent,error);assert.equal(h.el('fractal-count').getAttribute('aria-invalid'),'true');
 for(const world of ['orbit','life','wave','walk']){click(h,'tab-'+world);assert.equal(h.el('fractal-back-batch').hidden,true);assert.equal(h.el('fractal-batch-help').hidden,true);const before=state(h);click(h);assert.deepEqual(state(h),before);click(h,'tab-fractal');check(h,631);assert.equal(h.el('fractal-back-batch').hidden,false);assert.equal(h.el('fractal-batch-help').hidden,false);}
});
test('resets, parameters, comparisons, presets and history update the bound correctly',async()=>{
 const h=await setup('?experiment=fractal&at=v1,731');click(h,'reset');check(h,300);click(h,'fractal-1000');click(h);check(h,900);
 h.el('jump').handlers.input({target:{value:'70'}});check(h,300,14,70);h.el('seed').handlers.input({target:{value:'99'}});check(h,300,99,70);
 seek(h,731);click(h);check(h,631,99,70);h.navigate('?experiment=fractal&seed=3&jump=38&at=v1,831');click(h);check(h,731,3,38);
 h.el('preset-select').handlers.change({target:{value:'half'}});click(h,'load-preset');check(h,300,3,50);
});
test('batch replay earns nothing without Check and preserves completed discoveries',async()=>{
 const h=await setup('?experiment=fractal');click(h,'mission-start');click(h,'fractal-1000');click(h,'step');click(h);check(h,1000);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');
 h.el('seed').handlers.input({target:{value:'15'}});click(h,'fractal-1000');click(h,'step');click(h);check(h,1000,15);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('field-notes-list').innerHTML;click(h);check(h,900,15);assert.equal(h.el('field-notes-list').innerHTML,notes);
});
test('display, density, context and visibility recovery preserve seeded replay',async()=>{
 const h=await setup('?experiment=fractal&seed=99&jump=70&at=v1,731');click(h);check(h,631,99,70);const drawing=h.drawing(),message=h.el('announcement').textContent;
 h.resize(209,240);h.setDpr(2);h.loseContext();h.restoreContext();h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);h.resize(600,414);h.setDpr(1);
 assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('announcement').textContent,message);click(h);check(h,531,99,70);click(h,'step');assert.deepEqual(h.drawing(),drawing);
});
test('text-only startup can still replay and read the batch',async()=>{
 const h=await setup('?experiment=fractal&at=v1,731','',true,1,false);click(h);assert.equal(count(h),631);assert.equal(h.el('fractal-back-batch').getAttribute('aria-disabled'),'false');assert.equal(h.el('status').textContent,'画布未就绪');
});
test('native focusable button and quiet associated help inherit wrapping targets',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<button id="fractal-back-batch" aria-disabled="true" aria-describedby="fractal-batch-help fractal-touch-reading" hidden>退回 100 点 −<\/button>/);
 assert.ok(html.indexOf('id="step"')<html.indexOf('id="fractal-back-batch"'));assert.ok(html.indexOf('id="fractal-back-batch"')<html.indexOf('id="reset"'));
 assert.match(html,/<p id="fractal-batch-help" class="canvas-pause-help" hidden>/);assert.match(html,/余下不足 100 点时停在起点/);assert.match(html,/fractal-batch=reverse-1/);
 assert.match(css,/\.stage-controls\{display:flex;flex-wrap:wrap/);assert.match(css,/\.stage-controls button\[aria-disabled="true"\]/);
});
