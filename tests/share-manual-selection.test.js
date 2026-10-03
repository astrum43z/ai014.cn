import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click?.();
const saved={wave:'?experiment=wave&wavelength=37&separation=126&at=v1,48,-12,1.25',fractal:'?experiment=fractal&jump=65&seed=23&at=v1,731',walk:'?experiment=walk&bias=7&seed=29&at=v1,83'};
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),frames:[...h.frames.keys()],url:location.href,writes:h.writes(),metrics:h.el('metrics').textContent,status:h.el('status').textContent,link:h.el('share-link').value,hidden:h.el('share-link').hidden,feedback:h.el('share-status').textContent,announcement:h.el('announcement').textContent,saved:h.el('saved-observation-reading').textContent,recovery:h.el('observation-undo-status').textContent,undo:h.el('observation-undo').getAttribute('aria-disabled'),notes:h.el('notes-text').value,notebook:h.el('field-notes-list').innerHTML});
async function clipboard(run,write=async()=>{}){
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator'),copies=[];
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:url=>{copies.push(url);return write(url);},readText(){assert.fail('manual selection must never read the clipboard');}}}});
 try{await run(copies);}finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
}
function selection(h){
 const input=h.el('share-link');let selections=0;
 input.select=()=>{selections++;input.selectionStart=0;input.selectionEnd=input.value.length;};
 return event=>{
  input.selectionStart=input.selectionEnd=25;
  assert.equal(typeof input.handlers[event],'function',event+' selects a complete link');
  input.focus();input.handlers[event]();
  assert.equal(input.selectionStart,0);assert.equal(input.selectionEnd,input.value.length);
  assert.equal(document.activeElement,input);return selections;
 };
}

for(const mode of ['orbit','life','wave','fractal','walk'])test(`${mode}: focusing or clicking a shared link selects all without changing a running experiment`,async()=>{
 await clipboard(async copies=>{
  const h=await setup('?experiment='+mode,'#control-title',false);await click(h,'share');
  if(!h.frames.size)click(h,'pause');h.tick(0);h.tick(50);
  const before=state(h),select=selection(h),calls=copies.length;
  assert.equal(select('focus'),1);assert.deepEqual(state(h),before);
  assert.equal(select('click'),2);assert.deepEqual(state(h),before);
  assert.equal(select('click'),3);assert.deepEqual(state(h),before);
  assert.equal(copies.length,calls,'selection does not call the automatic copy API');
  assert.equal(h.el('share-link').handlers.keydown,undefined,'copy/select/navigation keys stay native');
 });
});

for(const mode of Object.keys(saved))test(`${mode}: manual selection preserves the fixed observation and return recovery`,async()=>{
 await clipboard(async copies=>{
  const h=await setup(saved[mode]);click(h,'step');click(h,'step');const later=h.drawing();
  click(h,'observation-return');await click(h,'observation-copy');const before=state(h),select=selection(h);
  select('focus');select('click');assert.deepEqual(state(h),before);assert.equal(copies.length,1);
  assert.equal(before.undo,'false');click(h,'observation-undo');assert.deepEqual(h.drawing(),later);
 });
});

test('manual recovery is available for rejected, missing and successful automatic copies',async()=>{
 for(const outcome of ['missing','reject','success'])await clipboard(async copies=>{
  if(outcome==='missing')delete navigator.clipboard;
  const h=await setup(saved.walk);await click(h,'observation-copy');const before=state(h),select=selection(h);
  assert.equal(before.hidden,false);assert.match(before.feedback,outcome==='success'?/已复制/:/自动复制未完成/);
  select('focus');select('click');assert.deepEqual(state(h),before);assert.equal(copies.length,outcome==='missing'?0:1);
 },()=>outcome==='reject'?Promise.reject(Error('blocked')):Promise.resolve());
});

test('selecting a link while automatic copy is pending keeps request ownership and later focus',async()=>{
 let resolve;const pending=new Promise(yes=>{resolve=yes;});
 await clipboard(async copies=>{
  const h=await setup(saved.fractal),operation=click(h,'observation-copy'),before=state(h),select=selection(h);
  select('focus');select('click');assert.deepEqual(state(h),before);
  h.el('fractal-forward').focus();resolve();await operation;
  assert.match(h.el('share-status').textContent,/已复制链接中的观测/);
  assert.equal(document.activeElement,h.el('fractal-forward'));assert.equal(copies.length,1);
 },()=>pending);
});

test('manual selection does not revive stale results after the link changes',async()=>{
 let resolve;const pending=new Promise(yes=>{resolve=yes;});
 await clipboard(async()=>{
  const h=await setup(saved.wave),operation=click(h,'observation-copy'),select=selection(h);
  select('click');h.el('wavelength').handlers.input({target:{value:'38'}});
  const before=state(h);resolve();await operation;assert.deepEqual(state(h),before);
  assert.equal(h.el('share-link').hidden,true);assert.equal(h.el('share-status').hidden,true);
 },()=>pending);
});

test('readonly link instructions are quiet, associated, wrapping and follow field visibility without a new control',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const input=html.match(/<input id="share-link"[^>]*>/)?.[0],help=html.match(/<p id="share-manual"[^>]*>([^<]*)<\/p>/);
 assert.match(input,/aria-describedby="[^"]*share-manual/);assert.match(input,/readonly hidden/);
 assert.match(help?.[0]||'',/class="share-manual"/);assert.match(help?.[1]||'',/点选链接以全选.*Ctrl\+C.*⌘C.*系统复制菜单/);
 assert.doesNotMatch(help[0],/role=|aria-live=|tabindex=|button/);
 assert.match(html,/<input id="share-link"[^>]*><p id="share-manual"/);
 assert.match(css,/#share-link\[hidden\]\+#share-manual\{display:none\}/);
 assert.match(css,/\.controls>p\.share-manual\{[^}]*margin:8px 0/);
 assert.match(css,/\.controls>p\.share-manual\{[^}]*grid-column:1\/-1[^}]*overflow-wrap:anywhere/);
});
