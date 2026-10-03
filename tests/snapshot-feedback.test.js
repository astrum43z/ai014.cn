import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';

test('PNG feedback is visible, quiet, associated with Save, and full-width on mobile',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
  const save=html.match(/<button[^>]*id="save"[^>]*>/)?.[0];
  const status=html.match(/<p[^>]*id="save-status"[^>]*>/)?.[0];
  assert.match(save,/aria-describedby="save-status"/);
  assert.match(status,/class="save-status"/);
  assert.match(status,/aria-live="off"/);
  assert.match(status,/hidden/,'no empty status row before the first save');
  assert.doesNotMatch(status,/sr-only|role="(?:status|alert)"/,'only the existing action region announces');
  assert.match(html,/<button id="share"[^>]*>[^<]*<\/button><p id="save-status"/,'status follows the save/share control group');
  assert.match(css,/\.controls>p\.save-status\{[^}]*grid-column:1\/-1/);
  assert.match(css,/\.controls>p\.save-status\{[^}]*font-size:13px/);
});

test('Save reports each captured experiment without changing simulation or observation state',async()=>{
  for(const [mode,title] of Object.entries({orbit:'引力游乐场',life:'生命的形状',wave:'波与波相遇',fractal:'随机长出秩序',walk:'漫步也会扩散'})){
    const h=await setup('?experiment='+mode,'',false),callbacks=[];
    h.el('canvas').toBlob=callback=>callbacks.push(callback);
    const before={metrics:h.el('metrics').textContent,status:h.el('status').textContent,url:location.href,frames:h.frames.size,drawing:h.drawing()};
    h.el('save').handlers.click();
    assert.equal(h.el('save').getAttribute('aria-disabled'),'true');
    assert.equal(h.el('save-status').textContent,`正在生成「${title}」PNG 图片…`);
    assert.equal(h.el('save-status').hidden,false);
    assert.deepEqual({metrics:h.el('metrics').textContent,status:h.el('status').textContent,url:location.href,frames:h.frames.size,drawing:h.drawing()},before);
    callbacks.shift()(new Blob(['png']));
    assert.equal(h.el('generated').download,`small-worlds-${mode}.png`);
    assert.equal(h.el('save').getAttribute('aria-disabled'),'false');
    assert.equal(h.el('save-status').textContent,`已发起「${title}」PNG 图片下载，请查看浏览器下载列表`);
    assert.equal(h.el('announcement').textContent,h.el('save-status').textContent);
    assert.equal(location.href,before.url);
    assert.equal(h.frames.size,before.frames);
  }
});

test('late download feedback retains its experiment across tab changes and retry replaces it',async()=>{
  const h=await setup('?experiment=life'),callbacks=[];
  h.el('canvas').toBlob=callback=>callbacks.push(callback);
  h.el('save').handlers.click();
  h.el('tab-wave').handlers.click();
  h.el('save').handlers.click();
  assert.equal(callbacks.length,1,'cannot start another snapshot during encoding');
  callbacks.shift()(null);
  assert.match(h.el('save-status').textContent,/生命的形状.*失败.*重试/);
  assert.doesNotMatch(h.el('save-status').textContent,/波与波相遇/);
  assert.equal(h.el('save').getAttribute('aria-disabled'),'false');
  h.el('save').handlers.click();
  assert.equal(h.el('save-status').textContent,'正在生成「波与波相遇」PNG 图片…');
  h.el('tab-fractal').handlers.click();h.el('reset').handlers.click();
  callbacks.shift()(new Blob(['png']));
  assert.equal(h.el('generated').download,'small-worlds-wave.png');
  assert.match(h.el('save-status').textContent,/已发起.*波与波相遇.*下载列表/);
  assert.equal(h.el('save-status').hidden,false);
  assert.equal(h.el('save').getAttribute('aria-disabled'),'false');
  assert.equal(h.el('status').textContent,'已暂停');
});
