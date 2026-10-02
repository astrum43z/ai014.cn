import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';

const controls=['fractal-back','fractal-forward','fractal-step'];
const click=(h,id)=>h.el(id).handlers.click();
const unavailable=(h,id)=>h.el(id).getAttribute('aria-disabled')==='true';
function guardNativeFocus(h){
 for(const id of controls){
  const button=h.el(id);
  assert.notEqual(button.disabled,true);
  // A DOM-style regression tripwire: native disabling can blur the initiator.
  Object.defineProperty(button,'disabled',{get:()=>false,set:()=>assert.fail('do not natively disable a focused precision control')});
  Object.defineProperty(button,'tabIndex',{set:()=>assert.fail('keep native button focusability')});
 }
}
function snapshot(h){
 return {draws:h.drawCount(),announcement:h.el('announcement').textContent,metrics:h.el('metrics').textContent,url:location.href,writes:h.writes(),frames:h.frames.size};
}

test('the 300-point floor retains the initiating button and repeated activation is a no-op',async()=>{
 const h=await setup('?experiment=fractal&at=v1,301');guardNativeFocus(h);
 h.el('fractal-back').focus();click(h,'fractal-back');
 assert.equal(document.activeElement,h.el('fractal-back'));
 assert.equal(unavailable(h,'fractal-back'),true);
 assert.equal(unavailable(h,'fractal-forward'),false);
 assert.match(h.el('fractal-touch-reading').textContent,/已回到 300 点起点/);
 const before=snapshot(h);
 for(let i=0;i<10;i++)click(h,'fractal-back');
 assert.deepEqual(snapshot(h),before);
 assert.equal(document.activeElement,h.el('fractal-back'));
 click(h,'fractal-forward');assert.equal(unavailable(h,'fractal-back'),false);
 assert.match(h.el('metrics').textContent,/^301 个点/);
});

for(const id of ['fractal-forward','fractal-step'])test(`${id} retains focus at 12,000 and disabled clicks and keys do not redraw`,async()=>{
 const h=await setup('?experiment=fractal&at=v1,11999');guardNativeFocus(h);
 h.el(id).focus();click(h,id);
 assert.equal(document.activeElement,h.el(id));
 for(const next of ['fractal-forward','fractal-step'])assert.equal(unavailable(h,next),true);
 assert.equal(unavailable(h,'fractal-back'),false);
 assert.match(h.el('fractal-touch-reading').textContent,/已达 12,000 点上限，可退回一点或重置/);
 const before=snapshot(h);
 for(let i=0;i<10;i++){click(h,'fractal-forward');click(h,'fractal-step');h.key('ArrowRight',{repeat:i>0});}
 assert.deepEqual(snapshot(h),before);
 assert.equal(document.activeElement,h.el(id));
 click(h,'fractal-back');assert.equal(unavailable(h,id),false);
 assert.match(h.el('metrics').textContent,/^11999 个点/);
 click(h,id);assert.match(h.el('metrics').textContent,/^12000 个点/);
});

test('availability follows automatic limits, reset, tab memory and restored checkpoints',async()=>{
 const h=await setup('?experiment=fractal&at=v1,11999');guardNativeFocus(h);
 h.el('fractal-forward').focus();click(h,'pause');h.tick(0);h.tick(50);h.tick(100);
 assert.equal(unavailable(h,'fractal-forward'),true);assert.equal(h.frames.size,0);
 assert.equal(document.activeElement,h.el('fractal-forward'));
 h.tabs[2].handlers.click();const wave=snapshot(h);
 for(const id of controls)click(h,id);
 assert.deepEqual(snapshot(h),wave,'hidden controls cannot change another world');
 h.tabs[3].handlers.click();assert.equal(unavailable(h,'fractal-step'),true);
 click(h,'reset');assert.equal(unavailable(h,'fractal-step'),false);assert.equal(unavailable(h,'fractal-back'),true);
 h.navigate('?experiment=fractal&at=v1,731');
 for(const id of controls)assert.equal(unavailable(h,id),false);
 h.el('jump').handlers.input({target:{value:'65'}});assert.equal(unavailable(h,'fractal-back'),true);
});

test('all three semantic buttons describe the current boundary and retain focus styling',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 for(const id of controls){
  const markup=html.match(new RegExp(`<button id="${id}"[^>]*>`))?.[0];
  assert.ok(markup);assert.doesNotMatch(markup,/\sdisabled(?:[\s=>])|tabindex=/i);
  assert.match(markup,/aria-describedby="fractal-touch-reading fractal-(?:touch|step)-help"/);
 }
 const disabledStyle=css.match(/\.fractal-touch button\[aria-disabled="true"\],#fractal-step\[aria-disabled="true"\]\{([^}]+)\}/)?.[1];
 assert.ok(disabledStyle);assert.match(disabledStyle,/background:#8b9d85;color:#213b36;cursor:not-allowed/);
 assert.doesNotMatch(disabledStyle,/opacity|outline|filter/,'muted colors must not dim or remove the focus ring');
 assert.match(css,/button:focus-visible[^}]*outline:3px solid/);
 assert.doesNotMatch(css,/\[aria-disabled="true"\][^{]*\{[^}]*pointer-events:none/);
});
