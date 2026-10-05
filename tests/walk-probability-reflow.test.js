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

test('narrow Walk probability bars get the full instrument width below their labels',()=>{
 for(const width of [209,233,260,280,300,320]){
  const row=styles(width,'.walk-choice-bars li');
  assert.equal(row.display,'grid');assert.equal(row['grid-template-columns'],'minmax(0,1fr) max-content');
  assert.equal(row.gap,'8px');assert.equal(row['align-items'],'center');
  const track=styles(width,'.walk-choice-track');
  assert.equal(track['grid-column'],'1/-1');assert.equal(track['grid-row'],'2');
  const value=styles(width,'.walk-choice-bars li>span:last-child');
  assert.equal(value['grid-column'],'2');assert.equal(value['grid-row'],'1');
 }
});

test('ordinary mobile and desktop keep direction, bar and percentage on one row',()=>{
 for(const width of [320.01,321,348,375,400,720,721,1000,1320]){
  const row=styles(width,'.walk-choice-bars li');
  assert.equal(row['grid-template-columns'],'4.5em minmax(0,1fr) 5ch');
  assert.equal(row.gap,width<=720?'8px':'10px');
  for(const selector of ['.walk-choice-track','.walk-choice-bars li>span:last-child']){
   const child=styles(width,selector);
   assert.equal(child['grid-column'],undefined);assert.equal(child['grid-row'],undefined);
  }
 }
});

test('reflow retains chart type size, bar height, colors and the same absolute percentage scale',()=>{
 for(const width of [209,320,321,720,1000]){
  const row=styles(width,'.walk-choice-bars li');assert.equal(row['font-size'],'13px');assert.equal(row['line-height'],'1.7');
  const track=styles(width,'.walk-choice-track');
  assert.equal(track.height,'8px');assert.equal(track.background,'#122e29');assert.equal(track.border,'1px solid #638373');
  assert.equal(track['border-radius'],'3px');assert.equal(track.overflow,'hidden');
  const bar=styles(width,'.walk-choice-track>span');assert.equal(bar.display,'block');assert.equal(bar.height,'100%');assert.equal(bar.background,'#b5d99b');
  const value=styles(width,'.walk-choice-bars li>span:last-child');assert.equal(value['text-align'],'right');assert.equal(value['font-variant-numeric'],'tabular-nums');assert.equal(value.color,'#e7eee1');
 }
 const section=html.slice(html.indexOf('<div class="walk-choices"'),html.indexOf('<section id="fractal-jump"'));
 assert.match(section,/每条满宽代表 100%/);assert.match(section,/不是上方这条路径或当前点云的实测比例/);
});

test('the reproduced narrow track can use all 139px without shrinking labels or values',()=>{
 // Public cloud-browser baseline at actual 500%: a 209px root minus 36px
 // outer padding, 2px border and 32px instrument padding. Not a layout engine.
 const inner=209-36-2-32;assert.equal(inner,139);
 const narrow=parsed.filter(rule=>rule.conditions.some(condition=>/max-width:320px/.test(condition))&&['.walk-choice-bars li','.walk-choice-track','.walk-choice-bars li>span:last-child'].includes(rule.name));
 assert.deepEqual(narrow.map(rule=>[rule.name,rule.body.trim()]),[
  ['.walk-choice-bars li','grid-template-columns:minmax(0,1fr) max-content'],
  ['.walk-choice-track','grid-column:1/-1;grid-row:2'],
  ['.walk-choice-bars li>span:last-child','grid-column:2;grid-row:1']
 ]);
});

test('quiet probability text retains direction order and stays out of keyboard navigation',()=>{
 const section=html.slice(html.indexOf('<div class="walk-choices"'),html.indexOf('<section id="fractal-jump"'));
 assert.match(section,/<ul class="walk-choice-bars" aria-label="每位漫步者每步的理论方向概率">/);
 const rows=[...section.matchAll(/<li>(.*?)<\/li>/g)].map(match=>match[1]);assert.equal(rows.length,4);
 for(const [i,direction] of ['right','left','up','down'].entries()){
  assert.match(rows[i],new RegExp(`^<span>.+</span><span class="walk-choice-track" aria-hidden="true"><span id="walk-chance-${direction}"></span></span><span id="walk-chance-${direction}-value"></span>$`));
 }
 assert.doesNotMatch(section,/tabindex|role="status"|aria-live="polite"|aria-live="assertive"|<button|<input/);
 assert.match(html,/<details id="instruments" class="instrument-drawer"/);
 assert.match(html,/style\.css\?[^"\n]*&amp;walk-probability=stack-1/);
});
