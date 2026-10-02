import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';
const click=(h,id)=>h.el(id).handlers.click();
const reading=h=>h.el('orbit-touch-reading').textContent;

test('touch positioning pauses without advancing or launching and matches keyboard exactly',async()=>{
 const h=await setup('?experiment=orbit');click(h,'pause');h.tick(0);h.tick(50);
 const initial=h.el('metrics').textContent;
 click(h,'orbit-left');click(h,'orbit-up');assert.match(reading(h),/x 135.0，y -5.0/);
 assert.equal(h.frames.size,0);assert.equal(h.el('metrics').textContent,initial);
 assert.equal(h.el('orbit-preview-reading').hidden,false);
 const touch=reading(h),preview=h.el('orbit-preview-reading').textContent,message=h.el('announcement').textContent;
 h.key('Home');h.key('ArrowLeft');h.key('ArrowUp');
 assert.equal(reading(h),touch);assert.equal(h.el('orbit-preview-reading').textContent,preview);assert.equal(h.el('announcement').textContent,message);
 click(h,'orbit-right');click(h,'orbit-down');assert.match(reading(h),/x 140.0，y 0.0/);
});

test('explicit launch adds exactly one paused planet and invalid center is explained',async()=>{
 const h=await setup('?experiment=orbit');click(h,'orbit-fire');
 assert.match(h.el('metrics').textContent,/4 颗行星 · t \+ 0.0 s/);assert.equal(h.frames.size,0);
 for(let i=0;i<28;i++)click(h,'orbit-left');
 assert.equal(h.el('orbit-fire').disabled,true);assert.match(reading(h),/离中心太近/);
 assert.match(h.el('orbit-touch-status').textContent,/至少 22/);
 click(h,'orbit-fire');assert.match(h.el('metrics').textContent,/4 颗行星/);
 click(h,'orbit-home');assert.equal(h.el('orbit-fire').disabled,false);assert.match(reading(h),/x 140.0，y 0.0/);
 click(h,'orbit-fire');assert.match(h.el('metrics').textContent,/5 颗行星/);
});

test('24-planet cap disables launch and reset restores it without autoplay',async()=>{
 const h=await setup('?experiment=orbit');for(let i=0;i<24;i++)click(h,'orbit-fire');
 assert.match(h.el('metrics').textContent,/24 颗行星/);assert.equal(h.el('orbit-fire').disabled,true);
 assert.match(h.el('orbit-touch-status').textContent,/24 颗上限/);
 click(h,'orbit-home');assert.equal(h.el('orbit-fire').disabled,true);
 click(h,'reset');assert.equal(h.el('orbit-fire').disabled,false);assert.match(h.el('metrics').textContent,/3 颗行星/);assert.equal(h.frames.size,0);
});

test('tab return restores position and hidden controls cannot affect another world',async()=>{
 const h=await setup('?experiment=orbit');click(h,'orbit-left');click(h,'orbit-up');const position=reading(h),url=location.href;
 h.tabs[3].handlers.click();assert.equal(h.el('orbit-touch').hidden,true);const metrics=h.el('metrics').textContent;
 click(h,'orbit-fire');click(h,'orbit-home');assert.equal(h.el('metrics').textContent,metrics);
 h.tabs[0].handlers.click();assert.equal(h.el('orbit-touch').hidden,false);assert.equal(reading(h),position);assert.equal(location.href,url);
 h.navigate('?experiment=orbit&gravity=40&speed=65');assert.match(reading(h),/x 140.0，y 0.0/);assert.equal(h.el('orbit-fire').disabled,false);
});

test('readings track slider and direct canvas launches and animation stays quiet',async()=>{
 const h=await setup('?experiment=orbit');h.el('speed').handlers.input({target:{value:'65'}});
 assert.match(reading(h),/15.5.*23.9 × 65%/);
 h.el('canvas').handlers.click({clientX:300+100*414/450,clientY:207});
 assert.match(reading(h),/x 100.0，y 0.0/);assert.match(h.el('metrics').textContent,/4 颗行星/);
 assert.equal(h.el('orbit-fire').disabled,false);
 click(h,'pause');const position=reading(h),message=h.el('announcement').textContent;
 h.tick(0);h.tick(50);assert.equal(reading(h),position);assert.equal(h.el('announcement').textContent,message);
 click(h,'orbit-home');assert.equal(h.frames.size,0);assert.equal(h.el('orbit-preview-reading').hidden,false);
});

test('small simulated canvas clamps buttons identically to keyboard',async()=>{
 const h=await setup('?experiment=orbit');h.resize(240,260);
 for(let i=0;i<80;i++){click(h,'orbit-right');click(h,'orbit-down');}
 const boundary=reading(h);click(h,'orbit-right');click(h,'orbit-down');h.key('ArrowDown');h.key('ArrowRight');assert.equal(reading(h),boundary);
 assert.match(boundary,/x 161.3，y 180.0/);click(h,'orbit-home');assert.match(reading(h),/x 140.0，y 0.0/);
});

test('touch controls are unique, quiet, described, and at least 44px',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 for(const id of ['orbit-touch','orbit-touch-reading','orbit-touch-status','orbit-touch-help','orbit-left','orbit-up','orbit-down','orbit-right','orbit-home','orbit-fire'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 assert.match(html,/<div id="orbit-touch"[^>]*role="group"[^>]*aria-label="先定位预演，再发射行星"[^>]*aria-describedby="orbit-touch-help">/);
 for(const id of ['orbit-touch-reading','orbit-touch-status'])assert.ok(html.includes('id="'+id+'" aria-live="off"'));
 for(const direction of ['左','上','下','右'])assert.ok(html.includes('aria-label="发射点向'+direction+'移动 5 单位"'));
 assert.match(css,/\.orbit-touch button\{[^}]*min-width:44px;min-height:44px/);
 assert.ok(html.indexOf('id="orbit-touch"')<html.indexOf('id="instruments"'));
});

test('holding a launch-button key suppresses repeat activation without blocking a fresh press',async()=>{
 const h=await setup('?experiment=orbit');let prevented=0;
 for(const key of ['Enter',' '])h.el('orbit-fire').handlers.keydown({key,repeat:true,preventDefault(){prevented++;}});
 assert.equal(prevented,2);
 h.el('orbit-fire').handlers.keydown({key:'Enter',repeat:false,preventDefault(){prevented++;}});
 h.el('orbit-fire').handlers.keydown({key:'Tab',repeat:true,preventDefault(){prevented++;}});
 assert.equal(prevented,2);click(h,'orbit-fire');assert.match(h.el('metrics').textContent,/4 颗行星/);
});
