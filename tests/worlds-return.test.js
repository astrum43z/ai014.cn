import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const modes=['orbit','life','wave','fractal','walk'];
const click=(h,id)=>h.el(id).handlers.click();
const snapshot=h=>({
 drawing:h.drawing(),readings:['metrics','status','observation-a','observation-b','observation-c','mission-state','mission-result','announcement'].map(id=>h.el(id).textContent),
 notes:h.el('field-notes-list').innerHTML,frames:[...h.frames.keys()],writes:h.writes(),search:location.search,
 drafts:['wave-target-x','wave-target-y','wave-time','fractal-count','walk-count'].map(id=>h.el(id).value),
});

test('the canvas shortcuts offer one native return to the existing named world chooser',()=>{
 const shortcuts=html.slice(html.indexOf('<div class="experiment-shortcuts">'),html.indexOf('<aside class="controls">'));
 assert.match(shortcuts,/<a id="worlds-return" href="#lab">回到世界选择 ↑<\/a><a href="#control-title">调整参数 ↓<\/a>/);
 assert.equal((html.match(/id="worlds-return"/g)||[]).length,1);
 assert.match(html,/<section[^>]*id="lab"[^>]*tabindex="-1"[^>]*aria-labelledby="lab-title"/);
 assert.match(html,/<div class="tabs"[^>]*role="tablist"[^>]*aria-label="选择实验"/);
 assert.doesNotMatch(app,/worlds-return/,'native navigation adds no reset, history rewrite or click interception');
});

test('the world chooser link wraps at narrow widths and retains a visible, 44px-high target',()=>{
 const rule=css.match(/\.experiment-shortcuts #worlds-return\{([^}]+)\}/)?.[1];
 assert.ok(rule);assert.match(rule,/margin-left:0/);assert.match(rule,/max-width:100%/);
 assert.match(rule,/white-space:normal/);assert.match(rule,/overflow-wrap:anywhere/);
 assert.match(rule,/font-size:13px/);
 assert.match(css,/\.experiment-shortcuts a\{[^}]*min-height:44px/);
 assert.match(css,/a:focus-visible[^}]*outline:3px solid/);
});

for(const mode of modes)test(`${mode}: chooser navigation and anchor history leave the current experiment intact`,async()=>{
 const h=await setup('?experiment='+mode,'#canvas');
 click(h,'mission-start');click(h,'step');
 if(mode==='orbit'){click(h,'orbit-down');click(h,'orbit-fire');}
 if(mode==='life')click(h,'life-toggle');
 if(mode==='wave')click(h,'wave-right');
 for(const id of ['wave-target-x','wave-target-y','wave-time','fractal-count','walk-count'])h.el(id).value='draft';
 const before=snapshot(h);
 for(const hash of ['#lab','#canvas','#lab','#control-title','#lab']){
  h.navigate(location.search+hash);
  assert.deepEqual(snapshot(h),before,'return and Back/Forward keep model, mission, drafts and pause choice');
 }
 assert.equal(h.el('tab-'+mode).getAttribute('aria-selected'),'true');
});

test('chooser navigation retains fixed sharing and return recovery across world switches',async()=>{
 const h=await setup('?experiment=walk&bias=0&seed=14&at=v1,64','#canvas');
 await h.el('share').handlers.click();click(h,'walk-step-one');click(h,'observation-return');
 const before=snapshot(h),checkpoint=new URL(h.el('share-link').value).search;
 h.navigate(location.search+'#lab');assert.deepEqual(snapshot(h),before);
 assert.equal(new URL(h.el('share-link').value).search,checkpoint);
 assert.equal(h.el('observation-undo').getAttribute('aria-disabled'),'false');
 click(h,'tab-wave');click(h,'wave-right');click(h,'tab-walk');
 assert.match(h.el('metrics').textContent,/64 步/);
 assert.equal(h.el('observation-undo').getAttribute('aria-disabled'),'false');
 click(h,'observation-undo');assert.match(h.el('metrics').textContent,/65 步/);
 assert.equal(new URL(h.el('share-link').value).search,checkpoint);
});

test('returning to the chooser does not change a running frame chain or create a new one',async()=>{
 const h=await setup('?experiment=orbit','#canvas',false);h.tick(0);h.tick(50);
 const before=snapshot(h);
 h.navigate(location.search+'#lab');assert.deepEqual(snapshot(h),before);
 h.navigate(location.search+'#canvas');assert.deepEqual(snapshot(h),before);
 assert.equal(h.frames.size,1);assert.equal(h.el('status').textContent,'运行中');
 // In the real browser the existing visibility gate pauses work offscreen,
 // without changing the user's running choice or catching up on return.
 h.setVisible(false);assert.equal(h.frames.size,0);
 h.setVisible(true);h.tick(90000);
 assert.equal(h.el('metrics').textContent,before.readings[0]);assert.equal(h.frames.size,1);
});

test('returning and switching worlds keep Life drawing recovery available',async()=>{
 const h=await setup('?experiment=life','#canvas');
 click(h,'clear');const empty=h.drawing();click(h,'life-toggle');
 h.navigate(location.search+'#lab');click(h,'tab-fractal');click(h,'tab-life');
 assert.equal(h.el('life-undo-edit').getAttribute('aria-disabled'),'false');
 click(h,'life-undo-edit');assert.deepEqual(h.drawing(),empty);
});
