import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';
const click=(h,id)=>h.el(id).handlers.click();
const reading=h=>h.el('wave-probe-reading').textContent;

test('touch probe moves in exact model units, pauses without advancing and matches keyboard',async()=>{
 const h=await setup('?experiment=wave');click(h,'pause');h.tick(0);h.tick(50);
 const time=h.el('metrics').textContent;
 click(h,'wave-right');assert.match(reading(h),/x 2.0，y 0.0/);assert.equal(h.frames.size,0);assert.equal(h.el('metrics').textContent,time);
 click(h,'wave-down');assert.match(reading(h),/x 2.0，y 2.0/);
 click(h,'wave-left');click(h,'wave-up');assert.match(reading(h),/x 0.0，y 0.0 · 整周期最大幅度 1.00/);
 click(h,'wave-right');const button=reading(h),message=h.el('announcement').textContent;
 h.key('Home');h.key('ArrowRight');assert.equal(reading(h),button);assert.equal(h.el('announcement').textContent,message);
});

test('four precise right steps reach half-wave cancellation and center recovers full amplitude',async()=>{
 const h=await setup('?experiment=wave');for(let i=0;i<4;i++)click(h,'wave-right');
 assert.equal(reading(h),'探针 x 8.0，y 0.0 · 整周期最大幅度 0.00');
 assert.match(h.el('wave-difference').textContent,/0.50 个波长/);
 click(h,'wave-home');assert.equal(reading(h),'探针 x 0.0，y 0.0 · 整周期最大幅度 1.00');
 click(h,'guide-start');assert.match(reading(h),/x 8.0，y 0.0 · 整周期最大幅度 0.00/);
 click(h,'reset');assert.match(reading(h),/x 0.0，y 0.0/);
});

test('pointer and slider edits refresh the adjacent quiet reading while animation stays quiet',async()=>{
 const h=await setup('?experiment=wave');h.el('canvas').handlers.click({clientX:300+8*414/280,clientY:207});
 assert.match(reading(h),/x 8.0，y 0.0 · 整周期最大幅度 0.00/);
 h.el('wavelength').handlers.input({target:{value:'64'}});assert.match(reading(h),/整周期最大幅度 0.71/);
 click(h,'pause');const initial=reading(h),message=h.el('announcement').textContent;
 h.tick(0);h.tick(50);h.tick(100);assert.equal(reading(h),initial);assert.equal(h.el('announcement').textContent,message);
});

test('precise movement keeps shared checkpoint fixed until sharing again and tab return restores probe',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,2.5');const url=location.href;
 click(h,'wave-left');assert.equal(location.href,url);assert.match(reading(h),/x 6.0，y 0.0/);
 h.tabs[4].handlers.click();assert.equal(h.el('wave-touch').hidden,true);const walk=h.el('metrics').textContent;
 click(h,'wave-right');assert.equal(h.el('metrics').textContent,walk);
 h.tabs[2].handlers.click();assert.equal(h.el('wave-touch').hidden,false);assert.match(reading(h),/x 6.0，y 0.0/);
 await click(h,'share');assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),'v1,6,0,2.5');
 h.navigate('?experiment=wave&at=v1,8,0,2.5');assert.match(reading(h),/x 8.0，y 0.0/);
});

test('narrow simulated canvas bounds match keyboard and a far shared probe stays measurable',async()=>{
 const h=await setup('?experiment=wave&at=v1,800,-300,2.5');const before=reading(h);h.resize(295,260);assert.equal(reading(h),before);
 click(h,'wave-left');assert.match(reading(h),/x 798.0，y -300.0/);
 click(h,'wave-home');for(let i=0;i<90;i++)click(h,'wave-down');const edge=reading(h);
 click(h,'wave-down');assert.equal(reading(h),edge);h.key('ArrowDown');assert.equal(reading(h),edge);
 assert.match(edge,/y 140.0/);click(h,'wave-up');assert.match(reading(h),/y 138.0/);
});

test('probe controls have unique semantic labels, quiet readout and 44px touch targets',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 for(const id of ['wave-touch','wave-probe-reading','wave-probe-help','wave-left','wave-up','wave-down','wave-right'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 assert.match(html,/<div id="wave-touch"[^>]*role="group"[^>]*aria-label="精细移动波纹探针"[^>]*aria-describedby="wave-probe-help" hidden>/);
 assert.match(html,/<p id="wave-probe-reading" aria-live="off">/);
 for(const direction of ['左','上','下','右'])assert.ok(html.includes('aria-label="探针向'+direction+'移动 2 单位"'));
 assert.match(css,/\.wave-touch button\{[^}]*min-width:44px;min-height:44px/);
 assert.ok(html.indexOf('id="wave-touch"')<html.indexOf('id="instruments"'));
});
