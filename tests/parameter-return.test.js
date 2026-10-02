import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
test('the native canvas return follows parameter help before replacement and export controls',()=>{
 const controls=html.match(/<aside class="controls">([\s\S]*?)<\/aside>/)?.[1];
 assert.ok(controls);
 assert.match(controls,/<div id="sliders"><\/div><a id="controls-return" class="return-to-canvas" href="#canvas">回到画布，继续实验 ↑<\/a><button id="preset"/);
 assert.equal((html.match(/id="controls-return"/g)||[]).length,1);
 assert.match(html,/<canvas id="canvas" tabindex="0"/,'native anchor destination can receive keyboard focus');
 assert.doesNotMatch(app,/controls-return/,'navigation needs no scripted action or interception');
});

test('the return link spans the compact controls grid and uses the existing readable touch target',()=>{
 const rule=css.match(/\.controls>\.return-to-canvas\{([^}]+)\}/)?.[1];
 assert.ok(rule);assert.match(rule,/grid-column:1\/-1/);assert.match(rule,/max-width:100%/);
 assert.match(rule,/white-space:normal/);assert.match(rule,/overflow-wrap:anywhere/);
 assert.match(css,/\.reading-nav a,\.return-to-canvas\{[^}]*min-height:44px/);
 assert.match(css,/a:focus-visible[^}]*outline:3px solid/);
 assert.match(css,/\.return-to-canvas[^{}]*\{[^}]*font-size:13px/);
});

function snapshot(h){return {
 readings:['metrics','status','observation-a','observation-b','observation-c','life-selection','wave-probe-reading','fractal-touch-reading','walk-step-reading','mission-state','mission-feedback','field-notes-list','announcement'].map(id=>h.el(id).textContent),
 drawing:h.drawing(),frames:h.frames.size,writes:h.writes(),search:location.search,
 };}
const parameters={orbit:['speed','101'],life:['density','31'],wave:['wavelength','33'],fractal:['jump','51'],walk:['bias','1']};
for(const [mode,[id,value]] of Object.entries(parameters))test(`${mode}: returning and traversing history after an edit preserves the current model and paused state`,async()=>{
 const h=await setup('?experiment='+mode,'#control-title');
 h.el(id).handlers.input({target:{value}});
 h.el('step').handlers.click();
 if(mode==='life')h.key('Enter');
 if(mode==='wave')h.key('ArrowRight');
 const before=snapshot(h);
 for(const hash of ['#canvas','#control-title','#canvas','#control-title','#canvas']){
  h.navigate(location.search+hash);
  assert.deepEqual(snapshot(h),before,'anchor-only history keeps parameters, model, focus handling and announcements native');
 }
});

test('returning from controls keeps a running experiment on its existing frame chain',async()=>{
 const h=await setup('?experiment=orbit','#control-title',false);
 h.el('increase-speed').handlers.click();h.tick(0);h.tick(50);
 const before=snapshot(h);
 h.navigate(location.search+'#canvas');assert.deepEqual(snapshot(h),before);
 h.navigate(location.search+'#control-title');assert.deepEqual(snapshot(h),before);
 assert.equal(h.frames.size,1);assert.equal(h.el('status').textContent,'运行中');
});

test('a parameter-to-canvas round trip keeps live progress separate from the saved checkpoint',async()=>{
 const h=await setup('?experiment=fractal&jump=50&seed=14&at=v1,1000','#control-title');
 await h.el('share').handlers.click();
 h.el('fractal-forward').handlers.click();
 const before=snapshot(h),shareSearch=new URL(h.el('share-link').value).search;
 for(const hash of ['#canvas','#control-title','#canvas']){
  h.navigate(location.search+hash);assert.deepEqual(snapshot(h),before);
  assert.equal(new URL(h.el('share-link').value).search,shareSearch);
  assert.match(h.el('metrics').textContent,/1,001|1001/);
  assert.equal(new URL(location.href).searchParams.get('at'),'v1,1000');
 }
});

test('returning after a density change retains Life clear recovery',async()=>{
 const h=await setup('?experiment=life','#control-title');
 const original=h.drawing();
 h.el('clear').handlers.click();h.el('increase-density').handlers.click();
 h.navigate(location.search+'#canvas');
 assert.equal(h.el('life-undo-clear').getAttribute('aria-disabled'),'false');
 h.el('life-undo-clear').handlers.click();
 assert.deepEqual(h.drawing(),original);
 assert.equal(h.el('density').value,'31','returning and undoing never undo the new parameter');
});
