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

test('the Life rule text gets its own full row in narrow instruments',()=>{
 for(const width of [209,233,260,280,300,320]){
  const body=styles(width,'.life-inspector-body');
  assert.equal(body.display,'grid');
  assert.equal(body['grid-template-columns'],'minmax(0,1fr)',`${width}px has one full reading column`);
  assert.equal(body.gap,'12px');
 }
});

test('ordinary mobile and desktop retain the diagram beside the rule',()=>{
 for(const width of [320.01,321,348,375,400,720,721,1000,1320]){
  const body=styles(width,'.life-inspector-body');
  assert.equal(body['grid-template-columns'],'60px minmax(0,1fr)');
  assert.equal(body.gap,width<=720?'12px':'14px');
  assert.equal(body['align-items'],'center');
 }
});

test('the nine-cell diagram retains its size, orientation and selected-cell outline',()=>{
 for(const width of [209,320,321,720,1000]){
  const diagram=styles(width,'.life-neighborhood');
  assert.equal(diagram.display,'grid');
  assert.equal(diagram['grid-template-columns'],'repeat(3,1fr)');
  assert.equal(diagram.width,'60px');assert.equal(diagram.height,'60px');
  assert.equal(diagram.gap,'4px');assert.equal(diagram.padding,'2px');
  const selection=styles(width,'.life-neighborhood .selected');
  assert.equal(selection.outline,'2px solid #ffac86');assert.equal(selection['outline-offset'],'1px');
 }
 const markup=html.match(/<div class="life-neighborhood"[^>]*>(.*?)<\/div>/)[1];
 assert.deepEqual([...markup.matchAll(/id="life-neighbor-(\d)"/g)].map(match=>+match[1]),[0,1,2,3,4,5,6,7,8]);
 assert.match(markup,/<span id="life-neighbor-4" class="selected">/);
});

test('reflow preserves the state, next-state and reason text sizes and colors',()=>{
 for(const width of [209,320,321]){
  const state=styles(width,'.life-inspector p','.instrument-content p');
  assert.equal(state['font-size'],'14px');assert.equal(state['line-height'],'1.75');
  const next=styles(width,'.life-inspector p','.instrument-content p','.life-inspector #life-cell-next');
  assert.equal(next['font-size'],'14px');assert.equal(next['font-weight'],'700');assert.equal(next.color,'var(--lime)');
  const reason=styles(width,'.life-inspector p','.instrument-content p','.life-inspector #life-cell-reason');
  assert.equal(reason['font-size'],'13px');assert.equal(reason['line-height'],'1.7');assert.equal(reason.color,'#b8cdbb');
 }
});

test('the reproduced 67px rule column regains all 139px without smaller type or clipping',()=>{
 // Public cloud-browser baseline at actual 500%: 209px layout minus 36px
 // outer padding, 2px border and 32px instrument padding. Not a layout engine.
 const inner=209-36-2-32,old=inner-60-12;
 assert.equal(inner,139);assert.equal(old,67);
 const narrow=parsed.filter(rule=>rule.name==='.life-inspector-body'&&rule.conditions.some(condition=>/max-width:320px/.test(condition)));
 assert.equal(narrow.length,1);
 assert.equal(narrow[0].body.trim(),'grid-template-columns:minmax(0,1fr)');
});

test('the quiet inspector keeps its DOM reading order, disclosure and exact-position controls',()=>{
 const panel=html.match(/<section id="life-inspector"[\s\S]*?<\/section>/)[0];
 assert.match(panel,/aria-labelledby="life-inspector-title" hidden/);
 assert.match(panel,/<div class="life-neighborhood" aria-hidden="true">/);
 const reading=panel.slice(panel.indexOf('class="life-inspector-body"'),panel.indexOf('<div class="life-position"'));
 let prior=-1;
 for(const id of ['life-neighbor-0','life-neighbor-8','life-cell-state','life-cell-next','life-cell-reason']){
  const index=reading.indexOf(`id="${id}"`);assert.ok(index>prior);prior=index;
 }
 assert.doesNotMatch(reading,/tabindex|role=|aria-live|button|input/);
 assert.match(html,/<details id="instruments" class="instrument-drawer"/);
 assert.equal((panel.match(/<input /g)||[]).length,2);assert.equal((panel.match(/<button /g)||[]).length,1);
 assert.match(html,/style\.css\?[^"\n]*&amp;life-inspector=stack-1/);
});
