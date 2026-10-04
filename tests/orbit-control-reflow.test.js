import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../style.css',import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const declarations=selector=>[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
 .filter(([,selectors])=>selectors.split(',').map(value=>value.trim()).includes(selector))
 .flatMap(([,,body])=>body.split(';').filter(Boolean).map(value=>value.split(':').map(part=>part.trim())));
const styles=selector=>Object.fromEntries(declarations(selector));
const arrows=styles('.orbit-touch .orbit-arrows');
const button=styles('.orbit-touch button');

test('Orbit direction controls can wrap without reducing their 44px targets',()=>{
 assert.equal(arrows['flex-wrap'],'wrap');
 assert.equal(styles('.orbit-touch>div').display,'flex');
 assert.equal(button['min-width'],'44px');
 assert.equal(button['min-height'],'44px');
 assert.equal(button.flex,'1');
 assert.equal(styles('.orbit-touch .orbit-actions')['flex-wrap'],'wrap');
});

test('narrow direction rows fit by wrapping, while ordinary rows still fit all four',()=>{
 // CSS sizing contract only: this arithmetic is not a browser layout engine.
 // Live public-browser geometry is verified separately at 100%, 400% and 500%.
 const minimum=Number.parseFloat(button['min-width']);
 const gap=Number.parseFloat(styles('.orbit-touch>div').gap);
 assert.equal(gap,5,'the narrow-screen rule retains its existing spacing');
 const required=minimum*4+gap*3;
 assert.equal(required,191);
 assert.ok(required>171,'the 233px layout exposed only 171px inside the padded control');
 for(const available of [44,93,142,171,191,200,257,400]){
  const perLine=arrows['flex-wrap']==='wrap'?Math.min(4,Math.floor((available+gap)/(minimum+gap))):4;
  const used=perLine*minimum+(perLine-1)*gap;
  assert.ok(used<=available,`${available}px cannot contain an unwrapped ${used}px row`);
  if(available>=required)assert.equal(perLine,4,'wide layouts keep the original single row');
 }
});

test('wrapping retains native focus order and all four named direction buttons',()=>{
 const group=html.match(/<div class="orbit-arrows">([\s\S]*?)<\/div>/)?.[1];
 assert.ok(group);
 const buttons=[...group.matchAll(/<button([^>]*)>([^<]+)<\/button>/g)];
 assert.equal(buttons.length,4);
 const directions=[['left','左','←'],['up','上','↑'],['down','下','↓'],['right','右','→']];
 for(const [index,[id,name,symbol]] of directions.entries()){
  assert.match(buttons[index][1],new RegExp(`id="orbit-${id}"`));
  assert.match(buttons[index][1],new RegExp(`aria-label="发射点向${name}移动 5 单位"`));
  assert.equal(buttons[index][2],symbol);
  assert.doesNotMatch(buttons[index][1],/tabindex|disabled|hidden/);
 }
 assert.doesNotMatch(Object.keys(arrows).join(' '),/order|direction|overflow|height|width/,
  'the wrap rule must not reorder, clip or shrink native controls');
});
