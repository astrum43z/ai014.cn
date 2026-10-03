import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const modes=['orbit','life','wave','fractal','walk'];
const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
function finish(h,mode,control='mission-check'){
 if(mode==='life'){
  for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 }else{
  if(mode==='fractal')click(h,'fractal-1000');
  click(h,'mission-check');
  assert.equal(h.el('mission-notes').hidden,true,'a recorded baseline is not a completed finding');
  if(mode==='orbit'){input(h,'gravity',40);for(let i=0;i<70;i++)click(h,'step');}
  if(mode==='wave')click(h,'wave-home');
  if(mode==='fractal'){input(h,'seed',15);click(h,'fractal-1000');}
  if(mode==='walk')click(h,'walk-64');
 }
 click(h,control);
 assert.equal(h.el('mission-state').textContent,'已留下发现');
}
function snapshot(h){
 return {drawing:h.drawing(),metrics:h.el('metrics').textContent,readings:['a','b','c'].map(k=>h.el('observation-'+k).textContent),
  status:h.el('status').textContent,frames:h.frames.size,search:location.search,share:h.el('share-link').value?new URL(h.el('share-link').value).search:'',
  note:h.el('field-notes-list').innerHTML,text:h.el('notes-text').value,result:h.el('mission-result').textContent};
}

for(const mode of modes)test(`${mode}: only completion reveals the notebook route, with the current result still focused`,async()=>{
 for(const control of ['mission-check','mission-check-inline']){
  const h=await setup('?experiment='+mode,'#canvas');
  assert.equal(h.el('mission-notes').hidden,true);
  click(h,'mission-start');assert.equal(h.el('mission-notes').hidden,true);
  click(h,control);assert.equal(h.el('mission-notes').hidden,true,'incomplete and corrective results have no notebook route');
  // Restart gives the comparison a clean baseline after the exploratory check.
  click(h,'mission-start');finish(h,mode,control);
  assert.equal(h.el('mission-notes').hidden,false);
  assert.equal(document.activeElement,h.el('mission-result'),'retain the existing completion focus');
  assert.equal(h.el('notes-actions').hidden,false);assert.equal(h.el('notes-preview').hidden,false);
  assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');
  const complete=snapshot(h);click(h,control);assert.deepEqual(snapshot(h),complete,'repeat checks do not save again');
  click(h,'tab-'+modes[(modes.indexOf(mode)+1)%modes.length]);
  assert.equal(h.el('mission-notes').hidden,true,'another idle world does not claim this completion');
  click(h,'tab-'+mode);assert.equal(h.el('mission-notes').hidden,false);assert.deepEqual(snapshot(h),complete);
  h.resize(280,210);assert.equal(h.el('mission-notes').hidden,false);
  click(h,'mission-start');assert.equal(h.el('mission-notes').hidden,true);
  assert.equal(h.el('field-notes-list').innerHTML,complete.note,'restart retains the historical notebook');
 }
});

test('native notebook and Back-style fragments preserve the live world, historical notes and fixed checkpoint',async()=>{
 for(const mode of modes){
  const h=await setup('?experiment='+mode,'#canvas');click(h,'mission-start');finish(h,mode);
  await click(h,'share');click(h,'step');
  // Reading the notebook must not toggle a running experiment or replace its URL checkpoint.
  click(h,'pause');const before=snapshot(h);
  for(const hash of ['#field-notes','#canvas','#field-notes','#mission']){
   h.navigate(location.search+hash);assert.deepEqual(snapshot(h),before);
   assert.equal(h.el('mission-notes').hidden,false);
  }
 }
});

test('different URL invalidates the current completion route while keeping previously recorded notes',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');finish(h,'wave');
 const note=h.el('field-notes-list').innerHTML,text=h.el('notes-text').value;
 h.navigate('?experiment=wave&wavelength=65&separation=100#field-notes');
 assert.equal(h.el('mission-state').textContent,'可选探索');assert.equal(h.el('mission-notes').hidden,true);
 assert.equal(h.el('field-notes-list').innerHTML,note);assert.equal(h.el('notes-text').value,text);
 assert.equal(h.el('notes-actions').hidden,false);assert.equal(h.el('notes-preview').hidden,false);
 click(h,'mission-start');assert.equal(h.el('mission-notes').hidden,true);
 finish(h,'wave');assert.equal(h.el('mission-notes').hidden,false);
 assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');
});

test('the completion link follows the result and uses the existing named native notebook destination',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<p id="mission-result"[^>]*><\/p><div id="mission-notes" class="mission-notes" hidden><a href="#field-notes" aria-describedby="mission-notes-help">查看与保存本次发现 ↓<\/a><small id="mission-notes-help">发现仅保留在本页；刷新前，可保存 TXT 或复制文字。<\/small><\/div><\/section>/);
 assert.match(html,/<section class="field-notes" id="field-notes" tabindex="-1" aria-labelledby="field-notes-title">/);
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\$\('#mission-notes'\)\.addEventListener/,'link remains native, with no new action handler');
});

test('the notebook route wraps, has a 44px target and visible keyboard focus without an extra live region',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const markup=html.match(/<div id="mission-notes"[\s\S]*?<\/div>/)?.[0];
 assert.ok(markup);assert.doesNotMatch(markup,/aria-live|role="status"|tabindex|target=/);
 const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(css,/\.mission-notes a\{[^}]*min-height:44px;[^}]*max-width:100%;[^}]*white-space:normal;[^}]*overflow-wrap:anywhere/);
 assert.match(css,/\.mission-notes a:focus-visible\{outline:3px solid var\(--focus-ring\);outline-offset:3px\}/);
 assert.match(css,/\.mission-notes small\{display:block;[^}]*font-size:12px;[^}]*line-height:1\.8/);
});
