import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../style.css',import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');

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
 // :not() contributes its argument specificity, not an extra pseudo-class.
 const specificity=selector=>{const s=selector.replace(/:not\(([^)]+)\)/g,'$1');return 100*(s.match(/#/g)||[]).length+10*(s.match(/\.|:(?!:)/g)||[]).length+(s.match(/(?:^|[ >+])(?:[a-z]+)(?=$|[ .:#>+])/g)||[]).length;};
 matches.sort((a,b)=>specificity(a.name)-specificity(b.name));
 return Object.fromEntries(matches.flatMap(rule=>rule.body.split(';').filter(Boolean).map(value=>{
  const colon=value.indexOf(':');return [value.slice(0,colon).trim(),value.slice(colon+1).trim()];
 })));
}

test('parameter groups stack at narrow widths while preserving native target sizing',()=>{
 for(const width of [209,233,260,280,300,320]){
  const grid=styles(width,'.controls #sliders');
  assert.equal(grid.display,'grid');
  assert.equal(grid['grid-template-columns'],'minmax(0,1fr)',`${width}px has one flexible parameter column`);
  assert.equal(grid.gap,'15px');
  const pair=styles(width,'.parameter-nudge'),button=styles(width,'button:not(.tab)','.parameter-nudge button');
  assert.equal(pair.display,'flex');assert.equal(pair.gap,'8px');
  assert.equal(button['min-width'],'44px');assert.equal(button['min-height'],'44px');
  assert.equal(button['font-size'],'13px');assert.equal(button.padding,'0 10px');
  assert.equal(styles(width,'input[type=range]').height,'44px');
  assert.equal(styles(width,'input[type=range]').width,'100%');
 }
});

test('the reproduced 135px parameter box contains each 96px pair without overlap',()=>{
 // Contract sizing arithmetic, not a substitute for browser layout. Public
 // 500% zoom: a 209px page minus 36px outer padding, 2px border and 36px inner.
 const page=209,content=page-36-2-36,gap=15,pair=44+8+44;
 assert.equal(content,135);assert.equal(pair,96);
 const oldTrack=(content-gap)/2;
 assert.equal(oldTrack,60);
 assert.equal(pair-oldTrack-gap,21,'adjacent old button groups overlapped by 21px');
 for(const viewport of [209,233,260,280,300,320]){
  assert.equal(styles(viewport,'.controls #sliders')['grid-template-columns'],'minmax(0,1fr)');
  assert.ok(viewport-74>=pair,'one full-width group contains both original targets');
 }
});

test('ordinary mobile grids and desktop parameter stacking stay unchanged',()=>{
 for(const width of [321,348,375,400,720]){
  const grid=styles(width,'.controls #sliders');
  assert.equal(grid.display,'grid');assert.equal(grid['grid-template-columns'],'1fr 1fr');assert.equal(grid.gap,'15px');
  assert.ok((width-74-15)/2>=96,'both parameter groups can contain their original button pairs');
 }
 for(const width of [721,1000,1320])assert.equal(styles(width,'.controls #sliders')['grid-template-columns'],undefined);
});

test('the narrow override only changes tracks and preserves DOM order, names and focus',()=>{
 const narrow=parsed.filter(rule=>rule.conditions.some(condition=>/max-width:320px/.test(condition))&&rule.name==='.controls #sliders');
 assert.equal(narrow.length,1);
 assert.equal(narrow[0].body.trim(),'grid-template-columns:minmax(0,1fr)');
 const source=app.slice(app.indexOf('class="slider"'),app.indexOf('class="slider"')+1000);
 assert.match(source,/<label for="\$\{id\}">\$\{label\}<\/label>/);
 assert.match(source,/<input id="\$\{id\}" type="range"/);
 assert.match(source,/<button type="button" id="decrease-\$\{id\}" aria-label="\$\{label\}减少 \$\{step\}"/);
 assert.match(source,/<button type="button" id="increase-\$\{id\}" aria-label="\$\{label\}增加 \$\{step\}"/);
 assert.ok(source.indexOf('type="range"')<source.indexOf('id="decrease-'));
 assert.ok(source.indexOf('id="decrease-')<source.indexOf('id="increase-'));
 assert.doesNotMatch(source,/tabindex|style=|hidden/);
 assert.equal(styles(209,'button:focus-visible').outline,'3px solid var(--focus-ring)');
 assert.equal(styles(209,'button:focus-visible')['outline-offset'],'5px');
});
