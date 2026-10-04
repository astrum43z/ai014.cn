import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const guidance=/已达到上限，可退回一点或重置后继续$/;
function atLimit(h){
 assert.match(h.el('metrics').textContent,/^12000 个点/);
 assert.match(h.el('announcement').textContent,guidance);
 assert.doesNotMatch(h.el('announcement').textContent,/请重置后继续/);
 assert.equal(h.el('fractal-back').getAttribute('aria-disabled'),'false');
 assert.equal(h.el('pause').getAttribute('aria-disabled'),'true');
 assert.equal(h.frames.size,0);
}
const seek=(h,count)=>{h.el('fractal-count').value=String(count);click(h,'fractal-seek');};
const paths=[
 ['near-canvas single point',h=>click(h,'fractal-forward')],
 ['instrument single point',h=>click(h,'fractal-step')],
 ['canvas right arrow',h=>h.key('ArrowRight')],
 ['100-point batch',h=>click(h,'step')],
 ['exact target',h=>seek(h,12000)]
];
for(const [name,reach] of paths)test(`Fractal ${name} gives the available non-destructive cap recovery`,async()=>{
 const h=await setup('?experiment=fractal&jump=65&seed=23&at=v1,11999','#canvas');
 const fixed=location.href,notes=h.el('field-notes-list').innerHTML;
 reach(h);atLimit(h);const drawing=h.drawing();
 assert.equal(location.href,fixed);assert.equal(h.el('field-notes-list').innerHTML,notes);
 // Follow the spoken advice: keep almost all the work, then reproduce it.
 h.el('fractal-back').focus();click(h,'fractal-back');
 assert.match(h.el('metrics').textContent,/^11999 个点/);
 assert.equal(h.el('pause').getAttribute('aria-disabled'),'false');
 assert.equal(document.activeElement,h.el('fractal-back'));
 click(h,'fractal-forward');atLimit(h);assert.deepEqual(h.drawing(),drawing);
 assert.equal(location.href,fixed);assert.equal(h.el('field-notes-list').innerHTML,notes);
});

test('unavailable batch Step keeps cap recovery advice without changing work or focus',async()=>{
 const h=await setup('?experiment=fractal&at=v1,12000'),drawing=h.drawing(),url=location.href;
 h.el('step').focus();for(let i=0;i<3;i++){click(h,'step');atLimit(h);}
 assert.deepEqual(h.drawing(),drawing);assert.equal(location.href,url);
 assert.equal(document.activeElement,h.el('step'));
});

test('returning to a capped observation and undoing a return use the same accurate advice',async()=>{
 const h=await setup('?experiment=fractal&at=v1,12000');
 click(h,'fractal-back');click(h,'observation-return');atLimit(h);
 click(h,'observation-undo');assert.match(h.el('metrics').textContent,/^11999 个点/);
 h.navigate('?experiment=fractal&at=v1,11999');click(h,'fractal-forward');
 click(h,'observation-return');assert.match(h.el('metrics').textContent,/^11999 个点/);
 click(h,'observation-undo');atLimit(h);
});

test('the cap advice remains accurate after retained worlds and bitmap or layout recovery',async()=>{
 const h=await setup('?experiment=fractal&at=v1,11999');click(h,'fractal-forward');
 click(h,'tab-wave');click(h,'tab-fractal');h.resize(233,240);h.setDpr(2);
 h.loseContext();h.restoreContext();click(h,'step');atLimit(h);
 click(h,'fractal-back');assert.doesNotMatch(h.el('announcement').textContent,/已达到上限/);
});

test('automatic cap completion and unavailable Continue retain their existing rewind guidance',async()=>{
 const h=await setup('?experiment=fractal&at=v1,11999');
 click(h,'pause');h.tick(0);h.tick(50);h.tick(100);
 assert.match(h.el('announcement').textContent,/退回一点/);assert.equal(h.frames.size,0);
 click(h,'pause');assert.match(h.el('announcement').textContent,/可退回一点/);
 click(h,'fractal-back');click(h,'pause');assert.equal(h.frames.size,1);
});

test('Walk cap guidance and the single polite action region are unchanged',async()=>{
 const h=await setup('?experiment=walk&at=v1,511');click(h,'walk-step-one');
 assert.match(h.el('announcement').textContent,/已达到上限，可退回一步或重置后继续$/);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/app\.js\?[^"]*&amp;fractal-limit=rewind-guidance-1/);
 assert.match(html,/<p id="announcement" class="sr-only" aria-live="polite" aria-atomic="true"><\/p>/);
 assert.match(html,/<p id="fractal-touch-reading"[^>]*aria-live="off"/);
});
