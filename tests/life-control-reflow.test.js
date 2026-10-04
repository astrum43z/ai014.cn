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
 // :not() contributes its argument specificity, not an extra pseudo-class.
 const specificity=selector=>{const s=selector.replace(/:not\(([^)]+)\)/g,'$1');return 100*(s.match(/#/g)||[]).length+10*(s.match(/\.|:(?!:)/g)||[]).length+(s.match(/(?:^|[ >+])(?:[a-z]+)(?=$|[ .:#>+])/g)||[]).length;};
 matches.sort((a,b)=>specificity(a.name)-specificity(b.name));
 return Object.fromEntries(matches.flatMap(rule=>rule.body.split(';').filter(Boolean).map(value=>{
  const colon=value.indexOf(':');return [value.slice(0,colon).trim(),value.slice(colon+1).trim()];
 })));
}

test('narrow Life cross lets the toggle track shrink to a 44px target',()=>{
 for(const width of [204,233,260,291,320,380]){
  const grid=styles(width,'.life-touch>div');
  const toggle=styles(width,'button:not(.tab)','.life-touch button','.life-touch #life-toggle');
  assert.equal(grid.display,'grid');
  assert.equal(grid['grid-template-columns'],'44px minmax(44px,1fr) 44px');
  assert.equal(grid['grid-template-areas'],'". up ." "left toggle right" ". down ."');
  assert.equal(toggle['min-width'],'44px');
  assert.equal(toggle['min-height'],'44px');
  assert.equal(toggle['white-space'],'normal');
  assert.equal(toggle['overflow-wrap'],'anywhere');
  assert.equal(toggle['font-size'],'12px','keep the existing text size');
  assert.equal(toggle.padding,'10px 5px','keep the existing button padding');
 }
});

test('the public 171px grid can contain all three columns without smaller targets',()=>{
 // Sizing arithmetic only; browser geometry, text fit and focus are checked
 // separately. Public 500% zoom left 171px within the 233px page's padding.
 const grid=styles(233,'.life-touch>div'),gap=Number.parseFloat(grid.gap);
 const minimum=Number.parseFloat(styles(233,'.life-touch button','.life-touch #life-toggle')['min-width']);
 assert.equal(gap,5);
 assert.equal(44+100+44+2*gap,198,'the old grid exceeded its 171px box by 27px');
 assert.equal(grid['grid-template-columns'],'44px minmax(44px,1fr) 44px');
 for(const available of [142,171,198,229,257,318]){
  const center=Math.max(minimum,available-88-2*gap),used=88+center+2*gap;
  assert.ok(center>=44);
  assert.ok(used<=available,`${available}px cannot contain ${used}px of tracks and gaps`);
  if(available>=198)assert.ok(center>=100,'ordinary cross geometry stays unchanged');
 }
});

test('ordinary Life rows retain their existing flex layout and minimums',()=>{
 for(const width of [381,393,400,720,1000,1320]){
  const grid=styles(width,'.life-touch>div');
  const toggle=styles(width,'button:not(.tab)','.life-touch button','.life-touch #life-toggle');
  assert.equal(grid.display,'flex');
  assert.equal(grid['grid-template-columns'],undefined);
  assert.equal(toggle['min-width'],width<=720?'100px':'105px');
  assert.equal(toggle.flex,'2');
  assert.equal(styles(width,'.life-touch button')['min-width'],'44px');
  assert.equal(toggle['min-height'],'44px');
 }
});

test('the five Life controls keep their native order, labels and cross positions',()=>{
 const group=html.match(/<div><button id="life-left"[\s\S]*?<\/div>/)?.[0];
 assert.ok(group);
 const buttons=[...group.matchAll(/<button([^>]*)>([^<]+)<\/button>/g)];
 assert.equal(buttons.length,5);
 const directions=[['left','左','←'],['up','上','↑'],['toggle',null,'点亮所选格'],['down','下','↓'],['right','右','→']];
 for(const [index,[id,name,text]] of directions.entries()){
  assert.match(buttons[index][1],new RegExp(`id="life-${id}"`));
  if(name)assert.match(buttons[index][1],new RegExp(`aria-label="框选向${name}一格"`));
  else assert.match(buttons[index][1],/aria-describedby="life-selection"/);
  assert.equal(buttons[index][2],text);
  assert.doesNotMatch(buttons[index][1],/tabindex|disabled|hidden/);
  assert.equal(styles(233,`.life-touch #life-${id}`)['grid-area'],id);
 }
 const narrow=parsed.filter(rule=>rule.conditions.some(condition=>/max-width:380px/.test(condition))&&rule.name.startsWith('.life-touch'));
 for(const rule of narrow)assert.doesNotMatch(rule.body,/(?:^|;)\s*(?:order|position|transform|outline|visibility|height|font-size|overflow)\s*:/,'do not reorder, clip, shrink text or suppress focus');
});
