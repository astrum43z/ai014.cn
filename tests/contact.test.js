import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindContactCopy} from '../contact.js';
function setup(clipboard) {
  const button={hidden:true,disabled:false,attributes:{},setAttribute(n,v){this.attributes[n]=v;},addEventListener(n,f){this[n]=f;}};
  const field={value:'goodmorning2you',focus(){this.focused=true;},select(){this.selected=true;},setSelectionRange(start,end){this.selection=[start,end];}};
  const status={textContent:''};
  const copy=bindContactCopy({button,field,status,getClipboard:()=>clipboard});
  return {button,field,status,copy};
}
test('contact is present once, at the bottom, with a read-only manual fallback',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const footer=html.match(/<footer>[\s\S]*?<\/footer>/)[0];
  assert.equal((html.match(/goodmorning2you/g)||[]).length,1);
  assert.match(footer,/联系微信：/); assert.match(footer,/id="wechat-handle"[^>]*readonly/);
  assert.match(footer,/aria-label="复制微信号"/); assert.match(footer,/role="status" aria-live="polite"/);
  assert.equal((html.match(/role="tab"/g)||[]).length,5);
  assert.equal(readFileSync(new URL('../CNAME',import.meta.url),'utf8').trim(),'ai014.cn');
});
test('copy succeeds without moving focus or changing the contact',async()=>{
  const writes=[]; const s=setup({writeText:async text=>writes.push(text)});
  assert.equal(s.button.hidden,false); await s.button.click();
  assert.deepEqual(writes,['goodmorning2you']); assert.equal(s.status.textContent,'微信号已复制');
  assert.equal(s.button.disabled,false); assert.equal(s.button.attributes['aria-busy'],'false');
  assert.equal(s.field.focused,undefined); assert.equal(s.field.value,'goodmorning2you');
});
test('pending repeated clicks create one write and later retries work',async()=>{
  let resolve;let writes=0;const s=setup({writeText:()=>{writes++;return new Promise(r=>resolve=r);}});
  const first=s.copy();await s.copy();assert.equal(writes,1);assert.equal(s.button.disabled,true);
  assert.equal(s.button.attributes['aria-busy'],'true');resolve();await first;assert.equal(s.button.disabled,false);
  const next=s.copy();assert.equal(writes,2);resolve();await next;
});
for(const [name,clipboard] of [['missing API',undefined],['denied API',{writeText:async()=>{throw new Error('denied');}}],['synchronous error',{writeText:()=>{throw new Error('unavailable');}}]]) {
  test(`${name} selects the visible contact, reports failure, and allows retry`,async()=>{
    const s=setup(clipboard);await s.copy();
    assert.match(s.status.textContent,/未能自动复制.*手动复制/);assert.equal(s.field.focused,true);
    assert.equal(s.field.selected,true);assert.deepEqual(s.field.selection,[0,15]);assert.equal(s.button.disabled,false);
    assert.equal(s.button.attributes['aria-busy'],'false');await s.copy();assert.equal(s.button.disabled,false);
  });
}
