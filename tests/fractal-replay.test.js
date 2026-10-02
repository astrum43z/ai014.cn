import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';
import {createFractal,addFractalPoints} from '../fractal.js';
function check(h,count,seed=14,jump=50){
 const model=addFractalPoints(createFractal(seed,jump),count);
 assert.match(h.el('metrics').textContent,new RegExp(`^${count} 个点`));
 assert.match(h.el('fractal-touch-reading').textContent,new RegExp(`第 ${count} 点，抽中顶点 ${'ABC'[model.lastVertex]}；向它前进 ${jump}%`));
 assert.equal(h.el('fractal-back').disabled,count===300);
 assert.equal(h.el('fractal-forward').disabled,count===12000);
}
test('back then forward restores the exact seeded drawing and stays paused',async()=>{
 const h=await setup('?experiment=fractal&seed=23&jump=65&at=v1,731');check(h,731,23,65);
 const drawing=h.drawing();h.el('fractal-back').handlers.click();check(h,730,23,65);
 assert.equal(h.frames.size,0);h.el('fractal-forward').handlers.click();check(h,731,23,65);
 assert.deepEqual(h.drawing(),drawing);
 h.el('pause').handlers.click();h.el('fractal-back').handlers.click();assert.equal(h.frames.size,0);check(h,730,23,65);
});
test('bounds disable controls and replay restores availability at the cap',async()=>{
 const h=await setup('?experiment=fractal');check(h,300);h.el('fractal-back').handlers.click();check(h,300);
 h.navigate('?experiment=fractal&at=v1,12000');check(h,12000);assert.equal(h.el('fractal-step').disabled,true);
 h.el('fractal-forward').handlers.click();check(h,12000);
 h.el('fractal-back').handlers.click();check(h,11999);assert.equal(h.el('fractal-step').disabled,false);
 h.el('fractal-step').handlers.click();check(h,12000);
 h.el('fractal-1000').handlers.click();check(h,1000);h.el('reset').handlers.click();check(h,300);
});
test('replay preserves shared checkpoints, tab memory and parameter reset behavior',async()=>{
 const h=await setup('?experiment=fractal&at=v1,731');await h.el('share').handlers.click();const url=h.el('share-link').value;
 h.el('fractal-back').handlers.click();assert.equal(h.el('share-link').value,url);
 h.tabs[0].handlers.click();const metrics=h.el('metrics').textContent;h.el('fractal-back').handlers.click();h.el('fractal-forward').handlers.click();assert.equal(h.el('metrics').textContent,metrics);
 h.tabs[3].handlers.click();check(h,730);h.navigate('?experiment=wave');h.navigate(url);check(h,731);
 h.el('seed').handlers.input({target:{value:'15'}});check(h,300,15);
 h.el('fractal-forward').handlers.click();check(h,301,15);h.el('preset-select').handlers.change({target:{value:'islands'}});check(h,300,15,65);
});
test('animation updates quiet reading and replay does not record a discovery',async()=>{
 const h=await setup('?experiment=fractal');h.el('pause').handlers.click();const announcement=h.el('announcement').textContent;
 h.tick(0);h.tick(50);h.tick(100);check(h,400);assert.equal(h.el('announcement').textContent,announcement);
 h.el('mission-start').handlers.click();check(h,300);h.el('fractal-1000').handlers.click();h.el('fractal-back').handlers.click();h.el('fractal-forward').handlers.click();check(h,1000);assert.equal(h.el('notes-count').textContent,'0 / 5');
});
test('controls have quiet accessible context, wrap and remain outside collapsed instruments',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.ok(html.indexOf('id="fractal-touch"')<html.indexOf('id="instruments"'));
 assert.match(html,/<p id="fractal-touch-reading" aria-live="off"><\/p>/);
 for(const id of ['fractal-back','fractal-forward'])assert.match(html,new RegExp(`<button id="${id}" aria-describedby="fractal-touch-help">`));
 assert.match(html,/最少保留起点的 300 点/);assert.match(css,/\.fractal-touch>div\{display:flex;flex-wrap:wrap/);assert.match(css,/\.fractal-touch button\{[^}]*min-height:44px/);
});
