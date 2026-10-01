import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
const names={orbit:['引力','引力游乐场'],life:['生命','生命的形状'],wave:['波纹','波与波相遇'],fractal:['分形','随机长出秩序'],walk:['漫步','漫步也会扩散']};

test('mobile labels reuse exactly the five existing semantic experiment tabs',()=>{
 const group=html.match(/<div class="tabs"[^>]*>(.*?)<\/div>/)[1];
 const tabs=[...group.matchAll(/<button([^>]+)>(.*?)<\/button>/g)];
 assert.equal(tabs.length,5);
 for(const [mode,[short,title]] of Object.entries(names)){
  const [,attributes,content]=tabs.find(([,attributes])=>attributes.includes(`data-mode="${mode}"`));
  const accessibleName=attributes.match(/aria-label="([^"]+)"/)[1];
  assert.ok(accessibleName.includes(short),'visible short label is included for voice control');
  assert.ok(accessibleName.includes(title),'full title remains the accessible label');
  assert.match(attributes,/role="tab"/);assert.match(attributes,/aria-controls="panel"/);
  assert.ok(content.includes(`<span class="tab-short" aria-hidden="true">${short}</span>`));
  assert.ok(content.includes(`<strong>${title} ↗</strong>`),'full title remains in the accessible tab name');
  assert.equal((attributes.match(/tabindex="-1"/)||[]).length,mode==='orbit'?0:1);
 }
 assert.equal((group.match(/aria-selected="true"/g)||[]).length,1);
});

test('compact tabs keep every world on one row with touch targets and a visible focus outline',()=>{
 const mobile=css.slice(css.indexOf('/* Keep all five worlds'));
 assert.match(mobile,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(mobile,/\.tab,\.tab:last-child\{[^}]*grid-column:auto;[^}]*min-height:44px/);
 assert.match(mobile,/\.tab>strong,\.tab:last-child>strong\{[^}]*clip-path:inset\(50%\)/);
 assert.doesNotMatch(mobile,/\.tab>strong[^}]*display:none/);
 assert.match(mobile,/\.tab:focus-visible\{outline-offset:-4px/);
 assert.match(mobile,/\.tab>\.tab-short\{display:none\}/,'desktop has no duplicate labels');
});

test('sticky mobile navigation reserves anchor space and is limited to sufficiently tall viewports',()=>{
 const sticky=css.slice(css.indexOf('/* Do not pin navigation'));
 assert.match(sticky,/@media\(max-width:720px\) and \(min-height:480px\)/);
 assert.match(sticky,/html\{scroll-padding-top:76px\}/);
 assert.match(sticky,/\.tabs\{position:sticky;top:0;z-index:3/);
 assert.doesNotMatch(sticky,/position:fixed|overflow:hidden|touch-action:none/);
});
