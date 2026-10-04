import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../style.css',import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

// Resolve only the known selector chains used below, including nested media
// conditions and specificity. This is a CSS contract, not a browser engine.
function rules(source,conditions=[]){
 const result=[];
 for(let start=0;start<source.length;){
  const open=source.indexOf('{',start);if(open<0)break;
  let end=open+1,depth=1;
  while(depth&&end<source.length){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}
  const selector=source.slice(start,open).trim(),body=source.slice(open+1,end-1);
  if(selector.startsWith('@media'))result.push(...rules(body,[...conditions,selector]));
  else if(!selector.startsWith('@'))for(const name of selector.split(','))result.push({name:name.trim(),body,conditions});
  start=end;
 }
 return result;
}
const parsed=rules(css);
function styles(width,...selectors){
 const matches=parsed.filter(rule=>selectors.includes(rule.name)&&rule.conditions.every(condition=>{
  if(/prefers-/.test(condition))return false;
  return [...condition.matchAll(/(max|min)-width\s*:\s*(\d+)px/g)].every(([,kind,bound])=>kind==='max'?width<=+bound:width>=+bound);
 }));
 // The supplied selectors use only class/ID/type specificity, without :is().
 const specificity=s=>100*(s.match(/#/g)||[]).length+10*(s.match(/\.|:(?!:)/g)||[]).length+(s.match(/(?:^|[ >+])(?:[a-z]+)(?=$|[ .:#>+])/g)||[]).length;
 matches.sort((a,b)=>specificity(a.name)-specificity(b.name));
 return Object.fromEntries(matches.flatMap(rule=>rule.body.split(';').filter(Boolean).map(value=>{
  const colon=value.indexOf(':');return [value.slice(0,colon).trim(),value.slice(colon+1).trim()];
 })));
}

test('extreme-narrow component labels move above a flexible bar and signed value',()=>{
 for(const width of [233,291,320,400]){
  const row=styles(width,'.wave-component','.instrument-content .wave-component');
  assert.equal(row['grid-template-columns'],'minmax(0,1fr) max-content',`${width}px final component cascade`);
  assert.equal(row.gap,'8px');
  assert.equal(styles(width,'.wave-component>span','.instrument-content .wave-component>span')['grid-column'],'1/-1');
  assert.equal(styles(width,'.wave-component output')['min-width'],'5ch');
 }
});

test('narrow cycle labels sit above the shared scale and full-width aligned plots',()=>{
 for(const width of [233,291,320,400]){
  assert.equal(styles(width,'.wave-cycle-row')['grid-template-columns'],'22px minmax(0,1fr)');
  assert.equal(styles(width,'.wave-cycle-row').gap,'5px');
  assert.equal(styles(width,'.wave-cycle-row>span:first-child')['grid-column'],'1/-1');
  assert.equal(styles(width,'.wave-cycle-axis')['margin-left'],'27px');
  assert.equal(styles(width,'.wave-cycle-row svg').height,'56px');
  assert.equal(styles(width,'.wave-cycle-row svg').overflow,'visible');
 }
});

test('narrow plot sizing leaves room for phase labels without clipping or shrinking',()=>{
 // Observed public 500% layout: 233px viewport; page + border + instrument
 // padding leave 163px. Live browser geometry and overlap are checked separately.
 for(const viewport of [233,291,320,400]){
  const content=viewport-36-2-32;
  const row=styles(viewport,'.wave-cycle-row');
  assert.equal(row['grid-template-columns'],'22px minmax(0,1fr)');
  const plot=content-22-Number.parseFloat(row.gap);
  assert.ok(plot>=136);
  assert.ok(plot>content-100,'source names no longer consume the plot row');
  assert.equal(styles(viewport,'.wave-cycle-axis')['font'],'11px ui-monospace,monospace');
 }
 const narrow=parsed.filter(rule=>rule.conditions.some(condition=>/max-width:400px/.test(condition))&&/wave-(component|cycle)/.test(rule.name));
 assert.equal(narrow.length,5,'keep this fix limited to the five narrow layout rules');
 for(const rule of narrow)assert.doesNotMatch(rule.body,/font|overflow|display|visibility|position|height|order|transform|outline/,'do not hide, shrink, reorder or clip the instruments');
});

test('ordinary instrument grids and native accessible time controls are unchanged',()=>{
 for(const width of [401,720])assert.equal(styles(width,'.wave-component','.instrument-content .wave-component')['grid-template-columns'],'94px minmax(35px,1fr) 44px');
 assert.equal(styles(1000,'.wave-component','.instrument-content .wave-component')['grid-template-columns'],'125px minmax(50px,1fr) 55px');
 assert.equal(styles(1000,'.wave-cycle-row')['grid-template-columns'],'76px 24px minmax(0,1fr)');
 assert.equal(styles(320,'.wave-time-seek input')['min-height'],'44px');
 assert.equal(styles(320,'.wave-time-seek button')['min-height'],'44px');
 assert.match(html,/<input id="wave-time"[^>]+aria-describedby="wave-time-current wave-time-help wave-time-error"[^>]*><button id="wave-time-seek" type="button"/);
 assert.match(html,/<details id="instruments" class="instrument-drawer"/);
 for(const key of ['left','right','combined'])assert.match(html,new RegExp('aria-live="off" id="wave-value-'+key+'" aria-label="[^"]+"'));
 assert.match(html,/<div class="wave-cycle-axis" aria-hidden="true"><span>0<\/span><span>T\/4<\/span><span>T\/2<\/span><span>3T\/4<\/span><span>T<\/span><\/div>/);
});
