import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';
import {createWalk,advanceWalk,walkPathStats,walkStats} from '../walk.js';
function expected(seed,bias,steps){
 const model=advanceWalk(createWalk(seed,bias),steps),p=walkPathStats(model);
 const dx=p.x-model.path[(steps-1)*2],dy=p.y-model.path[(steps-1)*2+1];
 return {direction:dx>0?'向右':dx<0?'向左':dy>0?'向上':'向下',path:p,stats:walkStats(model)};
}
function check(h,seed,bias,steps){
 const e=expected(seed,bias,steps),text=h.el('walk-step-reading').textContent;
 assert.match(text,new RegExp(`第 ${steps} 步 ${e.direction}；累计走过 ${steps}，离起点 ${e.path.distance.toFixed(2)} 步长`));
 assert.equal(h.el('walk-length').textContent,steps+' 步长');
 assert.equal(h.el('walk-displacement').textContent,e.path.distance.toFixed(2)+' 步长');
 assert.equal(h.el('observation-a').textContent,'实测散开程度 · '+e.stats.spread.toFixed(2));
}
test('one-step pauses and advances the entire existing seeded ensemble, retaining batch controls',async()=>{
 const h=await setup('?experiment=walk');h.el('pause').handlers.click();assert.equal(h.frames.size,1);
 const url=location.href;
 h.el('walk-step-one').handlers.click();assert.equal(h.frames.size,0);check(h,14,0,17);
 assert.equal(location.href,url);assert.match(h.el('announcement').textContent,/已暂停；17 步/);
 h.el('walk-step-one').handlers.click();check(h,14,0,18);
 h.key('ArrowRight');check(h,14,0,34);h.el('step').handlers.click();check(h,14,0,50);
});
test('fine steps reveal a reversal where length grows while distance shrinks',async()=>{
 const h=await setup('?experiment=walk');let found=false;
 for(let n=17;n<=64;n++){
  const before=expected(14,0,n-1).path.distance;h.el('walk-step-one').handlers.click();check(h,14,0,n);
  if(expected(14,0,n).path.distance<before){found=true;break;}
 }
 assert.equal(found,true);
});
test('readout follows comparison buttons, presets, parameter reset and guide',async()=>{
 const h=await setup('?experiment=walk&bias=25&seed=99');check(h,99,25,16);
 h.el('walk-64').handlers.click();check(h,99,25,64);
 h.el('walk-step-one').handlers.click();check(h,99,25,65);
 h.el('walk-16').handlers.click();check(h,99,25,16);
 h.el('seed').handlers.input({target:{value:'50'}});check(h,50,25,16);
 h.el('preset-select').handlers.change({target:{value:'unbiased'}});check(h,50,0,16);
 h.el('guide-start').handlers.click();check(h,14,0,16);
});
test('shared checkpoints remain fixed until shared again and exact odd steps restore',async()=>{
 const h=await setup('?experiment=walk');h.el('walk-step-one').handlers.click();await h.el('share').handlers.click();
 const url=h.el('share-link').value;assert.equal(new URL(url).searchParams.get('at'),'v1,17');
 h.el('walk-step-one').handlers.click();assert.equal(h.el('share-link').value,url);
 h.tabs[0].handlers.click();h.el('walk-step-one').handlers.click();h.tabs[4].handlers.click();check(h,14,0,18);
 h.navigate('?experiment=fractal');h.navigate(url);check(h,14,0,17);assert.equal(h.frames.size,0);
});
test('animation updates the quiet readout and limit disables until rewind or reset',async()=>{
 const h=await setup('?experiment=walk&at=v1,511');check(h,14,0,511);
 h.el('walk-step-one').handlers.click();check(h,14,0,512);assert.equal(h.el('walk-step-one').disabled,true);
 assert.match(h.el('walk-step-reading').textContent,/已达 512 步上限/);
 h.el('walk-step-one').handlers.click();check(h,14,0,512);
 h.el('walk-64').handlers.click();assert.equal(h.el('walk-step-one').disabled,false);
 h.el('pause').handlers.click();const announcement=h.el('announcement').textContent;
 h.tick(0);h.tick(50);h.tick(100);check(h,14,0,68);assert.equal(h.el('announcement').textContent,announcement);
 h.el('reset').handlers.click();check(h,14,0,16);assert.equal(h.el('walk-step-one').disabled,false);
});
test('one-step completes neither measured mission phase without the required checks',async()=>{
 const h=await setup('?experiment=walk');h.el('mission-start').handlers.click();h.el('mission-check').handlers.click();
 for(let i=0;i<48;i++)h.el('walk-step-one').handlers.click();check(h,14,0,64);
 assert.equal(h.el('notes-count').textContent,'0 / 5');h.el('mission-check').handlers.click();assert.equal(h.el('notes-count').textContent,'1 / 5');
});
test('fine-step controls stay near the canvas, wrap and expose quiet linked context',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<button id="walk-step-one" aria-describedby="walk-step-help walk-step-reading">只走一步 \+1<\/button>/);
 assert.match(html,/<p id="walk-step-reading" aria-live="off"><\/p>/);
 assert.ok(html.indexOf('id="walk-step-one"')<html.indexOf('id="instruments"'));
 assert.match(html,/让全体各走 1 步/);assert.match(css,/\.walk-comparison \.button-row\{flex-wrap:wrap\}/);
});
