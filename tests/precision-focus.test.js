import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const unavailable=(h,id)=>h.el(id).getAttribute('aria-disabled')==='true';
const state=h=>({draws:h.drawCount(),metrics:h.el('metrics').textContent,announcement:h.el('announcement').textContent,frames:h.frames.size,url:location.href,writes:h.writes()});
function keepNativeFocus(h,id){
 const button=h.el(id);
 assert.notEqual(button.disabled,true);
 Object.defineProperty(button,'disabled',{get:()=>false,set:()=>assert.fail('native disabling can blur the initiating control')});
 Object.defineProperty(button,'tabIndex',{set:()=>assert.fail('keep native button focusability')});
 button.focus();
 return button;
}

test('the final single walk step preserves focus and further activation is a true no-op',async()=>{
 const h=await setup('?experiment=walk&at=v1,511');
 const button=keepNativeFocus(h,'walk-step-one');click(h,'walk-step-one');
 assert.equal(document.activeElement,button);assert.equal(unavailable(h,'walk-step-one'),true);
 assert.match(h.el('metrics').textContent,/512 步/);
 assert.match(h.el('walk-step-reading').textContent,/已达 512 步上限，可退回一步、重置或比较 16 \/ 64 步/);
 const atLimit=state(h);
 for(let i=0;i<10;i++)click(h,'walk-step-one');
 assert.deepEqual(state(h),atLimit);assert.equal(document.activeElement,button);
 for(const checkpoint of ['walk-16','walk-64']){
  click(h,checkpoint);assert.equal(unavailable(h,'walk-step-one'),false);
  click(h,'walk-step-one');assert.match(h.el('metrics').textContent,checkpoint==='walk-16'?/17 步/:/65 步/);
 }
});

test('walk availability follows animation, tabs, replay, reset and parameter changes',async()=>{
 const h=await setup('?experiment=walk&at=v1,511'),button=keepNativeFocus(h,'walk-step-one');
 click(h,'pause');h.tick(0);h.tick(50);h.tick(100);
 assert.equal(unavailable(h,'walk-step-one'),true);assert.equal(h.frames.size,0);assert.equal(document.activeElement,button);
 h.tabs[2].handlers.click();const wave=state(h);click(h,'walk-step-one');assert.deepEqual(state(h),wave);
 h.tabs[4].handlers.click();assert.equal(unavailable(h,'walk-step-one'),true);
 click(h,'reset');assert.equal(unavailable(h,'walk-step-one'),false);
 h.navigate('?experiment=walk&at=v1,512');assert.equal(unavailable(h,'walk-step-one'),true);
 h.el('seed').handlers.input({target:{value:'15'}});assert.equal(unavailable(h,'walk-step-one'),false);
 h.navigate('?experiment=walk&seed=14&at=v1,511');assert.equal(unavailable(h,'walk-step-one'),false);
});

test('the 24th orbit launch retains focus and unavailable launch does not pause a running world',async()=>{
 const h=await setup('?experiment=orbit'),button=keepNativeFocus(h,'orbit-fire');
 for(let i=0;i<21;i++)click(h,'orbit-fire');
 assert.equal(document.activeElement,button);assert.equal(unavailable(h,'orbit-fire'),true);
 assert.match(h.el('metrics').textContent,/24 颗行星/);assert.match(h.el('orbit-touch-status').textContent,/24 颗上限/);
 const atLimit=state(h);for(let i=0;i<10;i++)click(h,'orbit-fire');assert.deepEqual(state(h),atLimit);
 click(h,'pause');const running=state(h);assert.equal(running.frames,1);
 click(h,'orbit-fire');assert.deepEqual(state(h),running);
 h.tabs[4].handlers.click();const walk=state(h);click(h,'orbit-fire');assert.deepEqual(state(h),walk);
 h.tabs[0].handlers.click();assert.equal(unavailable(h,'orbit-fire'),true);
 click(h,'reset');assert.equal(unavailable(h,'orbit-fire'),false);
 click(h,'orbit-fire');assert.match(h.el('metrics').textContent,/4 颗行星/);
});

test('the central exclusion zone remains explained and inert until the launch point moves out',async()=>{
 const h=await setup('?experiment=orbit');keepNativeFocus(h,'orbit-fire');
 for(let i=0;i<24;i++)click(h,'orbit-left');
 assert.match(h.el('orbit-touch-reading').textContent,/x 20.0/);assert.equal(unavailable(h,'orbit-fire'),true);
 assert.match(h.el('orbit-touch-status').textContent,/至少 22/);
 const invalid=state(h);for(let i=0;i<10;i++)click(h,'orbit-fire');assert.deepEqual(state(h),invalid);
 click(h,'orbit-right');assert.equal(unavailable(h,'orbit-fire'),false);click(h,'orbit-fire');assert.match(h.el('metrics').textContent,/4 颗行星/);
 for(let i=0;i<5;i++)click(h,'orbit-left');assert.equal(unavailable(h,'orbit-fire'),true);
 click(h,'orbit-home');assert.equal(unavailable(h,'orbit-fire'),false);
 h.navigate('?experiment=orbit&gravity=40&speed=65');assert.equal(unavailable(h,'orbit-fire'),false);
});

test('both boundary controls retain descriptions, normal tab order and a full-strength focus ring',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 for(const [id,description] of [['orbit-fire','orbit-touch-reading orbit-touch-status'],['walk-step-one','walk-step-help walk-step-reading']]){
  const markup=html.match(new RegExp(`<button id="${id}"[^>]*>`))?.[0];
  assert.ok(markup);assert.ok(markup.includes(`aria-describedby="${description}"`));
  assert.doesNotMatch(markup,/\sdisabled(?:[\s=>])|tabindex=/i);
  const rule=css.match(new RegExp(`#${id}\\[aria-disabled="true"\\]\\{([^}]+)\\}`))?.[1];
  assert.ok(rule);assert.match(rule,/background:#8b9d85;color:#213b36;cursor:not-allowed/);
  assert.doesNotMatch(rule,/opacity|outline|filter|pointer-events/);
 }
 assert.match(css,/button:focus-visible[^}]*outline:3px solid/);
});
