import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';
import {createWalk,advanceWalk,walkStats,walkPathStats} from '../walk.js';

const click=(h,id)=>h.el(id).handlers.click();
function check(h,steps,seed=14,bias=0){
 const model=advanceWalk(createWalk(seed,bias),steps),stats=walkStats(model),path=walkPathStats(model);
 assert.equal(h.el('metrics').textContent,`256 位漫步者 · ${steps} 步 · 偏向 ${bias}%`);
 assert.equal(h.el('observation-a').textContent,'实测散开程度 · '+stats.spread.toFixed(2));
 assert.equal(h.el('walk-length').textContent,steps+' 步长');
 assert.equal(h.el('walk-displacement').textContent,path.distance.toFixed(2)+' 步长');
 assert.equal(h.el('walk-back').getAttribute('aria-disabled'),String(steps<=16));
 assert.equal(h.el('walk-step-one').getAttribute('aria-disabled'),String(steps>=512));
}
const snapshot=h=>({drawing:h.drawing(),metrics:h.el('metrics').textContent,reading:h.el('walk-step-reading').textContent,announcement:h.el('announcement').textContent,status:h.el('status').textContent,frames:h.frames.size,draws:h.drawCount(),url:location.href,writes:h.writes(),focus:document.activeElement});

test('rewind and advance reproduce every rendered walker and the exact seeded continuation',async()=>{
 for(const [seed,bias,steps] of [[14,0,17],[23,7,73],[99,25,511]]){
  const h=await setup(`?experiment=walk&seed=${seed}&bias=${bias}&at=v1,${steps}`);
  const drawing=h.drawing();check(h,steps,seed,bias);
  click(h,'walk-step-one');const next=h.drawing();
  click(h,'walk-back');check(h,steps,seed,bias);assert.deepEqual(h.drawing(),drawing);
  click(h,'walk-back');check(h,steps-1,seed,bias);assert.equal(h.frames.size,0);
  click(h,'walk-step-one');assert.deepEqual(h.drawing(),drawing);
  click(h,'walk-step-one');assert.deepEqual(h.drawing(),next);
 }
});

test('rewind pauses a running ensemble once and announces its current reading',async()=>{
 const h=await setup('?experiment=walk&at=v1,64');click(h,'pause');h.tick(0);h.tick(50);h.tick(100);check(h,68);
 click(h,'walk-back');check(h,67);assert.equal(h.frames.size,0);assert.equal(h.el('status').textContent,'已暂停');
 assert.match(h.el('announcement').textContent,/已暂停；67 步.*走过 67 步长/);
 click(h,'pause');h.tick(60000);check(h,67);h.tick(60050);check(h,67);h.tick(60100);check(h,71);
});

test('the 16-step boundary retains focus and repeated activation is an exact no-op',async()=>{
 const h=await setup('?experiment=walk&at=v1,17'),button=h.el('walk-back');
 Object.defineProperty(button,'disabled',{get:()=>false,set:()=>assert.fail('native disabling loses focus')});
 Object.defineProperty(button,'tabIndex',{set:()=>assert.fail('the boundary control stays focusable')});
 button.focus();click(h,'walk-back');check(h,16);assert.equal(document.activeElement,button);
 assert.match(h.el('walk-step-reading').textContent,/16 步起点/);
 const after=snapshot(h);for(let i=0;i<8;i++)click(h,'walk-back');assert.deepEqual(snapshot(h),after);
 click(h,'pause');const running=snapshot(h);click(h,'walk-back');assert.deepEqual(snapshot(h),running);
 h.tick(0);h.tick(50);h.tick(100);check(h,20);assert.equal(h.el('walk-back').getAttribute('aria-disabled'),'false');
});

test('rewinding the cap restores +1 and replay can return exactly to 512',async()=>{
 const h=await setup('?experiment=walk&bias=25&seed=42&at=v1,512'),drawing=h.drawing();check(h,512,42,25);
 assert.match(h.el('walk-step-reading').textContent,/可退回一步/);
 click(h,'walk-back');check(h,511,42,25);assert.equal(h.frames.size,0);
 click(h,'walk-step-one');check(h,512,42,25);assert.deepEqual(h.drawing(),drawing);
 assert.match(h.el('announcement').textContent,/可退回一步/);click(h,'pause');assert.match(h.el('announcement').textContent,/可退回一步/);
 click(h,'step');assert.match(h.el('announcement').textContent,/可退回一步/);
 click(h,'walk-back');click(h,'pause');h.tick(0);h.tick(50);h.tick(100);check(h,512,42,25);assert.equal(h.frames.size,0);assert.match(h.el('announcement').textContent,/可退回一步/);
});

test('rewind preserves shared checkpoints and tab state until explicitly shared again',async()=>{
 const h=await setup('?experiment=walk&at=v1,73','#canvas');await h.el('share').handlers.click();
 const shared=h.el('share-link').value,writes=h.writes();click(h,'walk-back');check(h,72);
 assert.equal(location.href,shared);assert.equal(h.el('share-link').value,shared);assert.equal(h.writes(),writes);
 const drawing=h.drawing();h.tabs[2].handlers.click();const wave=snapshot(h);click(h,'walk-back');assert.deepEqual(snapshot(h),wave);
 h.resize(240,300);h.tabs[4].handlers.click();check(h,72);assert.equal(h.el('share-link').value,shared);
 h.resize(600,414);assert.deepEqual(h.drawing(),drawing);
 await h.el('share').handlers.click();const latest=h.el('share-link').value;assert.equal(new URL(latest).searchParams.get('at'),'v1,72');
 h.navigate('?experiment=fractal');h.navigate(shared);check(h,73);h.navigate(latest);check(h,72);
});

test('parameter changes, presets, reset and existing comparison controls restore the lower bound',async()=>{
 const h=await setup('?experiment=walk&seed=99&bias=25&at=v1,73');click(h,'walk-back');check(h,72,99,25);
 h.el('seed').handlers.input({target:{value:'50'}});check(h,16,50,25);
 click(h,'walk-64');click(h,'walk-back');check(h,63,50,25);
 h.el('preset-select').handlers.change({target:{value:'unbiased'}});check(h,16,50,0);
 click(h,'walk-step-one');click(h,'reset');check(h,16,50,0);
 click(h,'walk-64');click(h,'walk-16');check(h,16,50,0);
 h.key('ArrowRight');check(h,32,50,0);h.key('Home');check(h,16,50,0);
});

test('replay never records a discovery without a successful explicit check',async()=>{
 const h=await setup('?experiment=walk');click(h,'mission-start');click(h,'mission-check');click(h,'walk-64');
 click(h,'walk-back');check(h,63);click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'walk-step-one');check(h,64);assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('field-notes-list').innerHTML;
 click(h,'walk-back');click(h,'walk-step-one');assert.equal(h.el('field-notes-list').innerHTML,notes);
});

test('back and forward share quiet context, remain near the canvas and wrap with touch targets',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 const button=html.match(/<button id="walk-back"[^>]*>退回一步 −1<\/button>/)?.[0];assert.ok(button);
 assert.match(button,/aria-describedby="walk-step-help walk-step-reading"/);assert.doesNotMatch(button,/\sdisabled(?:[\s=>])|tabindex=/i);
 assert.ok(html.indexOf('id="walk-back"')<html.indexOf('id="walk-step-one"'));assert.ok(html.indexOf('id="walk-back"')<html.indexOf('id="instruments"'));
 assert.match(html,/退回再前进会重现相同位置/);assert.match(html,/<p id="walk-step-reading" aria-live="off"><\/p>/);
 assert.match(css,/#walk-back\[aria-disabled="true"\]\{background:#8b9d85;color:#213b36;cursor:not-allowed\}/);
 assert.match(css,/\.walk-comparison \.button-row\{flex-wrap:wrap\}/);assert.match(css,/\.stage \.walk-comparison button\{[^}]*min-height:44px/);
});
