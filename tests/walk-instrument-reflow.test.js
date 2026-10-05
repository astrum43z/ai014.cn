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

test('distance and displacement cards each get the full narrow instrument width',()=>{
 for(const width of [209,233,260,280,300,320]){
  const row=styles(width,'.walk-distance-readings');
  assert.equal(row.display,'grid');
  assert.equal(row['grid-template-columns'],'minmax(0,1fr)',`${width}px has one complete reading per row`);
  assert.equal(row.gap,'10px');
 }
});

test('ordinary mobile and desktop distance comparisons remain side by side',()=>{
 for(const width of [321,348,375,400,720,721,1000,1320]){
  const row=styles(width,'.walk-distance-readings');
  assert.equal(row['grid-template-columns'],'repeat(2,minmax(0,1fr))');
  assert.equal(row.gap,'10px');
 }
});

test('narrow cards keep the existing number, label and surface styles',()=>{
 for(const width of [209,233,320]){
  const number=styles(width,'.walk-distance-readings strong');
  assert.equal(number['font-size'],'17px');assert.equal(number['font-weight'],'500');
  assert.equal(number['line-height'],'1.7');assert.equal(number['font-variant-numeric'],'tabular-nums');
  assert.equal(number.color,'#e7eee1');
  assert.equal(styles(width,'.walk-distance-readings p:last-child strong').color,'#82d6dd');
  const label=styles(width,'.walk-distance-readings span');
  assert.equal(label['font-size'],'13px');assert.equal(label['line-height'],'1.7');
  const card=styles(width,'.walk-distance-readings p');
  assert.equal(card.padding,'7px 8px');assert.equal(card.border,'1px solid #426055');
 }
 assert.equal(styles(1000,'.walk-distance-readings strong')['font-size'],'19px');
});

test('the reproduced cramped values regain a full text column without clipping or smaller type',()=>{
 // Public cloud browser at actual 500%: 209 CSS px layout width, 36px page
 // padding, 2px border and 32px instrument padding. Arithmetic is not layout QA.
 const grid=209-36-2-32,old=(grid-10)/2-18;
 assert.equal(grid,139);assert.equal(old,46.5);
 assert.equal(grid-18,121,'single-column cards provide 121px for the unchanged text');
 const narrow=parsed.filter(rule=>rule.name==='.walk-distance-readings'&&rule.conditions.some(condition=>/max-width:320px/.test(condition)));
 assert.equal(narrow.length,1);
 assert.equal(narrow[0].body.trim(),'grid-template-columns:minmax(0,1fr)');
});

test('both model-derived readings retain their labels, order, disclosure and quiet semantics',()=>{
 assert.match(html,/<section id="walk-distance" class="walk-distance" aria-labelledby="walk-distance-title" hidden>/);
 assert.match(html,/<div class="walk-distance-readings"><p><span>累计走过<\/span><strong id="walk-length"><\/strong><\/p><p><span>离起点的直线距离<\/span><strong id="walk-displacement"><\/strong><\/p><\/div>/);
 assert.match(html,/<details id="instruments" class="instrument-drawer"/);
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.ok(app.includes("setReadingText($('#walk-length'),path.length+' 步长')"));
 assert.ok(app.includes("setReadingText($('#walk-displacement'),path.distance.toFixed(2)+' 步长')"));
 const cards=html.match(/<div class="walk-distance-readings">(.*?)<\/div>/)[1];
 assert.doesNotMatch(cards,/aria-live|role=|tabindex|button|input/,'no new focus stop or live announcement');
});
