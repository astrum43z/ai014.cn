import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

for(const key of ['Enter',' '])test(`Life ${JSON.stringify(key)} toggles once per press, ignoring held-key repeats`,async()=>{
 const h=await setup('?experiment=life');
 h.el('life-challenge-start').handlers.click();
 h.el('pause').handlers.click();
 assert.equal(h.frames.size,1);
 h.key(key);
 assert.equal(h.frames.size,0,'the first press pauses before editing');
 assert.match(h.el('metrics').textContent,/1 个活格子/);
 const reading=h.el('announcement').textContent;
 let repeatsPrevented=0;
 for(let repeat=0;repeat<12;repeat++){
  h.key(key,{repeat:true,preventDefault(){repeatsPrevented++;}});
  assert.match(h.el('metrics').textContent,/1 个活格子/,'holding cannot erase the cell');
  assert.equal(h.el('announcement').textContent,reading);
  assert.equal(h.frames.size,0);
 }
 assert.equal(repeatsPrevented,12,'Space repeats must not scroll the page');
 h.key(key);
 assert.match(h.el('metrics').textContent,/0 个活格子/,'a separate press still toggles off');
 h.key(key);
 assert.match(h.el('metrics').textContent,/1 个活格子/,'another separate press toggles on');
});

test('Life held arrows still navigate and wrap without editing the board',async()=>{
 const h=await setup('?experiment=life');
 h.el('life-challenge-start').handlers.click();
 h.key('Enter');
 for(let i=0;i<24;i++)h.key('ArrowRight',{repeat:i>0});
 assert.match(h.el('life-cell-position').textContent,/第 48 列，第 16 行/);
 h.key('ArrowRight',{repeat:true});
 assert.match(h.el('life-cell-position').textContent,/第 1 列，第 16 行/);
 for(let i=0;i<16;i++)h.key('ArrowUp',{repeat:true});
 assert.match(h.el('life-cell-position').textContent,/第 1 列，第 32 行/);
 assert.match(h.el('metrics').textContent,/1 个活格子/);
 assert.equal(h.frames.size,0);
});

test('stray Life toggle repeats do not discard a tested drawing or produce redraws',async()=>{
 const h=await setup('?experiment=life');
 h.el('life-challenge-start').handlers.click();
 h.key('Enter');
 h.el('life-test').handlers.click();
 const result=h.el('life-test-result').textContent;
 const reading=h.el('announcement').textContent;
 let draws=0;
 h.el('canvas').getContext().clearRect=()=>draws++;
 for(const key of ['Enter',' '])h.key(key,{repeat:true});
 assert.equal(draws,0,'held toggles do not redraw or announce');
 assert.equal(h.el('life-test-result').textContent,result);
 assert.equal(h.el('announcement').textContent,reading);
 assert.equal(h.el('life-return').hidden,false);
 h.el('life-return').handlers.click();
 assert.match(h.el('metrics').textContent,/1 个活格子/);
});
