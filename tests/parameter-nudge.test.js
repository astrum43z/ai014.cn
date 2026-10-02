import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';

const parameters={
 orbit:[['gravity',30,160,80,''],['speed',30,150,100,'%']],
 life:[['rate',1,20,8,' 代/秒'],['density',10,60,30,'%']],
 wave:[['wavelength',15,70,32,''],['separation',20,180,100,'']],
 fractal:[['jump',35,70,50,'%'],['seed',1,99,14,'']],
 walk:[['bias',0,25,0,'%'],['seed',1,99,14,'']]
};
const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const unavailable=(h,id)=>h.el(id).getAttribute('aria-disabled')==='true';
const model=h=>({drawing:h.drawing(),metrics:h.el('metrics').textContent,status:h.el('status').textContent,url:location.href,frames:h.frames.size});
const state=h=>({...model(h),draws:h.drawCount(),writes:h.writes(),announcement:h.el('announcement').textContent});

for(const [mode,specs] of Object.entries(parameters))test(mode+': exact buttons and native ranges share both parameter update paths',async()=>{
 for(const [id,,,initial,unit] of specs){
  let h=await setup('?experiment='+mode);input(h,id,initial+1);const expected=model(h);
  h=await setup('?experiment='+mode);const button=h.el('increase-'+id);button.focus();click(h,button.id);
  assert.deepEqual(model(h),expected,id+' matches the model, address and pause behavior of its native range');
  assert.equal(document.activeElement,button);assert.equal(h.el(id).value,String(initial+1));
  assert.equal(h.el('out-'+id).textContent,(initial+1)+unit);
  assert.match(h.el('announcement').textContent,new RegExp('：'+(initial+1)));
  click(h,'decrease-'+id);assert.equal(h.el(id).value,String(initial));
  assert.equal(h.el('out-'+id).textContent,initial+unit);
 }
});

for(const [mode,specs] of Object.entries(parameters))test(mode+': reaching either parameter boundary keeps focus and further activation is inert',async()=>{
 for(const [id,min,max] of specs)for(const [direction,value,limit,opposite] of [['decrease',min+1,min,'increase'],['increase',max-1,max,'decrease']]){
  const h=await setup('?experiment='+mode+'&'+id+'='+value,'',false),button=h.el(direction+'-'+id);
  Object.defineProperty(button,'disabled',{set:()=>assert.fail('do not discard focus at a boundary')});
  Object.defineProperty(button,'tabIndex',{set:()=>assert.fail('keep boundary buttons in native tab order')});
  button.focus();click(h,button.id);assert.equal(h.el(id).value,String(limit));
  assert.equal(unavailable(h,button.id),true);assert.equal(document.activeElement,button);
  const atLimit=state(h);for(let i=0;i<3;i++)click(h,button.id);
  assert.deepEqual(state(h),atLimit,'no redraw, URL write, announcement, reset or pause beyond bound');
  assert.equal(document.activeElement,button);click(h,opposite+'-'+id);assert.equal(unavailable(h,button.id),false);
 }
});

test('fractal discovery can make its seed 14-to-15 comparison with one exact activation',async()=>{
 const h=await setup('?experiment=fractal');click(h,'mission-start');click(h,'fractal-1000');click(h,'mission-check');
 click(h,'increase-seed');assert.match(h.el('metrics').textContent,/300 个点.*种子 15/);
 assert.match(h.el('announcement').textContent,/随机种子：15；已按新参数重建到 300 点/);
 assert.equal(h.el('passport-count').textContent,'本次发现 0 / 5');
 click(h,'fractal-1000');click(h,'mission-check');assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');
 const note=h.el('field-notes-list').innerHTML;click(h,'increase-seed');
 assert.equal(h.el('field-notes-list').innerHTML,note,'later changes never rewrite earned historical evidence');
});

test('Life exact rate changes preserve fractional generation progress and density preserves the drawing',async()=>{
 const h=await setup('?experiment=life&rate=1','',false);h.tick(0);for(let i=50;i<=900;i+=50)h.tick(i);
 click(h,'pause');const before=h.drawing();click(h,'increase-rate');click(h,'increase-density');
 assert.deepEqual(h.drawing(),before);assert.match(h.el('metrics').textContent,/第 0 代/);
 assert.equal(h.frames.size,0);assert.equal(h.el('rate').value,'2');assert.equal(h.el('density').value,'31');
 click(h,'pause');h.tick(60000);h.tick(60040);assert.match(h.el('metrics').textContent,/第 0 代/);
 h.tick(60060);assert.match(h.el('metrics').textContent,/第 1 代/);
});

test('boundaries refresh after preset replacement, shared history, guide starts and tab return',async()=>{
 const h=await setup('?experiment=walk&seed=99&bias=25');
 assert.equal(unavailable(h,'increase-seed'),true);assert.equal(unavailable(h,'increase-bias'),true);
 (h.el('preset-select').handlers.change({target:{value:'another'}}),h.el('load-preset').handlers.click());
 assert.equal(h.el('seed').value,'1');assert.equal(unavailable(h,'decrease-seed'),true);
 assert.equal(unavailable(h,'increase-seed'),false);assert.equal(unavailable(h,'decrease-bias'),true);
 (h.el('preset-select').handlers.change({target:{value:'drift'}}),h.el('load-preset').handlers.click());assert.equal(unavailable(h,'increase-bias'),true);
 h.tabs[3].handlers.click();h.tabs[4].handlers.click();assert.equal(unavailable(h,'increase-bias'),true);
 h.navigate('?experiment=fractal&seed=99&jump=70&at=v1,1000');
 assert.equal(unavailable(h,'increase-seed'),true);assert.equal(unavailable(h,'increase-jump'),true);
 click(h,'mission-start');assert.equal(unavailable(h,'increase-seed'),false);assert.equal(unavailable(h,'increase-jump'),false);
 input(h,'seed',1);assert.equal(unavailable(h,'decrease-seed'),true);
 input(h,'seed',2);assert.equal(unavailable(h,'decrease-seed'),false);
});

test('obsolete controls cannot change a different world, including its same-named seed',async()=>{
 const h=await setup('?experiment=fractal'),oldClick=h.el('increase-seed').handlers.click,oldInput=h.el('jump').handlers.input;
 h.tabs[4].handlers.click();const before=state(h);oldClick();oldInput({target:{value:'65'}});assert.deepEqual(state(h),before);
});

test('parameter-only and saved-observation links retain their existing invalidation behavior',async()=>{
 const h=await setup('?experiment=orbit','#mission');await click(h,'share');click(h,'decrease-gravity');
 assert.equal(h.el('share-link').hidden,false);assert.equal(h.el('share-link').value,location.href);
 assert.match(location.search,/gravity=79/);assert.equal(location.hash,'#mission');
 h.navigate('?experiment=walk&seed=14&bias=0&at=v1,64#canvas');await click(h,'share');click(h,'increase-seed');
 assert.match(h.el('metrics').textContent,/16 步/);assert.equal(h.el('share-link').hidden,true);
 assert.doesNotMatch(location.search,/at=/);assert.equal(location.hash,'#canvas');
 assert.match(h.el('announcement').textContent,/随机种子：15；已按新参数重建到 16 步/);
});

test('same-value input cannot reset a continued seeded observation or rewrite its checkpoint',async()=>{
 const h=await setup('?experiment=fractal&seed=14&jump=50&at=v1,1000');click(h,'fractal-forward');
 const before=state(h);input(h,'seed',14);assert.deepEqual(state(h),before);
});

test('native one-unit buttons have specific names, current-value descriptions, and non-nested labels',async()=>{
 for(const mode of Object.keys(parameters)){
  const h=await setup('?experiment='+mode),markup=h.el('sliders').innerHTML;
  for(const [id] of parameters[mode]){
   assert.ok(markup.includes('<label for="'+id+'">'));
   assert.ok(markup.includes('</label><output aria-live="off" id="out-'+id+'" for="'+id+'">'));
   assert.match(markup,new RegExp('aria-controls="'+id+'" aria-describedby="out-'+id+'(?: parameter-effect)?"'));
   for(const direction of ['increase','decrease'])assert.ok(markup.includes('type="button" id="'+direction+'-'+id+'" aria-label="'));
  }
  for(const label of markup.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g))assert.doesNotMatch(label[1],/<button|<output/);
 }
 const h=await setup('?experiment=fractal');assert.match(h.el('sliders').innerHTML,/向顶点前进增加 1 个百分点/);
 const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.match(css,/\.parameter-nudge button\{[^}]*min-width:44px;min-height:44px/);
 assert.match(css,/\.parameter-nudge\{display:flex;gap:8px/);
 assert.doesNotMatch(css.match(/\.parameter-nudge button\[aria-disabled="true"\]\{([^}]+)\}/)?.[1]||'',/opacity|outline|filter|pointer-events/);
});
