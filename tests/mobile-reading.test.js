import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
const mobile=css.slice(css.indexOf('/* Phone-sized lessons'),css.indexOf('/* A folded, optional'));
const rules=[...mobile.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([,selectors,body])=>({selectors:selectors.trim().split(/,\s*/),body}));
function rule(selector){const found=rules.filter(r=>r.selectors.includes(selector));assert.ok(found.length,`mobile rule for ${selector}`);return found.map(r=>r.body).join('');}

test('readable lesson typography is scoped to the existing mobile breakpoint',()=>{
 assert.match(mobile,/\*\/\s*@media\(max-width:720px\)\{/);
 assert.equal((mobile.match(/@media/g)||[]).length,1);
 const braces=[...mobile].reduce((n,c)=>n+(c==='{'?1:c==='}'?-1:0),0);
 assert.equal(braces,0);
 assert.doesNotMatch(mobile,/display\s*:|position\s*:|(?<![-\w])height\s*:|overflow\s*:|\.tab[\s>{.,]/,'reading change does not hide content, constrain height, or change tabs');
 for(const selector of ['.question-strip p','.controls>#description','.controls .note p','#observation-detail','.explain','.discovery dd','.next-discovery p:not(.eyebrow)']){
  assert.match(rule(selector),/font-size:14px/);assert.match(rule(selector),/line-height:1\.8/);
 }
});

test('model and sharing limits remain readable despite older important declarations',()=>{
 for(const selector of ['.controls .model-note','.controls .share-note']){
  assert.match(rule(selector),/font-size:13px!important/);assert.match(rule(selector),/line-height:1\.8!important/);
 }
 for(const selector of ['.journey-entry>small','.next-discovery small','.reading-nav a','.return-to-canvas'])assert.match(rule(selector),/font-size:13px/);
});

test('all five stage explanations and readings share a legible mobile scale',()=>{
 for(const selector of ['.orbit-launch p','.life-inspector p','.fractal-jump p','.walk-distance #walk-cancellation','.wave-components p','.readings output'])assert.match(rule(selector),/font-size:14px/);
 for(const selector of ['.orbit-launch small','.life-inspector small','.fractal-jump small','.walk-distance small','.wave-components small','.walk-distance #walk-distance-note','.life-inspector #life-cell-reason'])assert.match(rule(selector),/font-size:13px/);
});

test('larger stage labels can wrap while signed readings retain space',()=>{
 assert.match(rule('.wave-components-heading'),/flex-wrap:wrap/);
 assert.match(rule('.wave-component>span'),/overflow-wrap:anywhere/);
 assert.match(rule('.wave-component output'),/min-width:5ch/,'character width is measured in the numeric font');
 assert.match(rule('.wave-component'),/grid-template-columns:minmax\(0,1fr\) minmax\(35px,1fr\) max-content/);
 assert.match(rule('.stage p'),/overflow-wrap:anywhere/);
 assert.ok(rules.some(r=>r.selectors.includes('.stage-top')&&/flex-wrap:wrap/.test(r.body)));
});
