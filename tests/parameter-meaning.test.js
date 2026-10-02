import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const attribute=(markup,id,name)=>markup.match(new RegExp('<(?:input|button)\\b[^>]*id="'+id+'"[^>]*>'))?.[0].match(new RegExp(name+'="([^"]*)"'))?.[1];
const effects={orbit:['speed'],life:['density'],wave:[],fractal:['jump','seed'],walk:['bias','seed']};
const sliders={orbit:['gravity','speed'],life:['rate','density'],wave:['wavelength','separation'],fractal:['jump','seed'],walk:['bias','seed']};

for(const mode of Object.keys(effects))test(mode+': one quiet effect note describes only the affected parameter controls',async()=>{
 const h=await setup('?experiment='+mode),markup=h.el('sliders').innerHTML;
 assert.equal([...markup.matchAll(/id="parameter-effect"/g)].length,effects[mode].length?1:0);
 for(const id of sliders[mode]){
  const help=effects[mode].includes(id)?'parameter-effect':undefined;
  assert.equal(attribute(markup,id,'aria-describedby'),help);
  for(const direction of ['decrease','increase'])assert.equal(attribute(markup,direction+'-'+id,'aria-describedby'),'out-'+id+(help?' '+help:''));
 }
 if(effects[mode].length){
  const note=markup.match(/<p id="parameter-effect"[^>]*>[^<]+<\/p>/)?.[0];
  assert.ok(note);assert.doesNotMatch(note,/aria-live|role=|tabindex=|hidden/);
  assert.ok(markup.indexOf('id="parameter-effect"')>markup.indexOf('id="increase-'+sliders[mode][1]+'"'));
  if(mode==='orbit')assert.match(note,/只影响下一次发射，不改变已有行星/);
  if(mode==='life')assert.match(note,/每格变活的概率.*下一次“随机播种”.*不改动当前图案/);
  if(mode==='fractal'||mode==='walk')assert.match(note,new RegExp('从 '+(mode==='fractal'?'300 点':'16 步')+'重新开始；当前暂停或运行状态保持不变'));
 }
});

test('native ranges expose actual percentage and generations-per-second values after input and exact buttons',async()=>{
 for(const [mode,id,initial,text] of [['orbit','speed',100,'100%'],['life','rate',8,'每秒 8 代'],['life','density',30,'30%'],['fractal','jump',50,'50%'],['walk','bias',0,'0%']]){
  const h=await setup('?experiment='+mode);
  assert.equal(h.el(id).getAttribute('aria-valuetext'),text);
  input(h,id,initial+1);assert.equal(h.el(id).getAttribute('aria-valuetext'),id==='rate'?`每秒 ${initial+1} 代`:(initial+1)+'%');
  click(h,'decrease-'+id);assert.equal(h.el(id).getAttribute('aria-valuetext'),text);
 }
 for(const [mode,id] of [['orbit','gravity'],['wave','wavelength'],['wave','separation'],['fractal','seed'],['walk','seed']]){
  const h=await setup('?experiment='+mode);assert.equal(h.el(id).getAttribute('aria-valuetext'),null,'unitless numbers keep native value semantics');
 }
});

test('accessible units refresh through presets, guided starts, tab memory and history',async()=>{
 const h=await setup('?experiment=fractal&jump=70&seed=19&at=v1,1000');
 assert.equal(h.el('jump').getAttribute('aria-valuetext'),'70%');
 h.el('preset-select').handlers.change({target:{value:'overlap'}});assert.equal(h.el('jump').getAttribute('aria-valuetext'),'38%');
 click(h,'mission-start');assert.equal(h.el('jump').getAttribute('aria-valuetext'),'50%');
 input(h,'jump',65);h.tabs[1].handlers.click();input(h,'rate',3);input(h,'density',45);
 h.tabs[3].handlers.click();assert.equal(h.el('jump').getAttribute('aria-valuetext'),'65%');
 h.tabs[1].handlers.click();assert.equal(h.el('rate').getAttribute('aria-valuetext'),'每秒 3 代');assert.equal(h.el('density').getAttribute('aria-valuetext'),'45%');
 h.navigate('?experiment=walk&bias=25&seed=99&at=v1,64');assert.equal(h.el('bias').getAttribute('aria-valuetext'),'25%');
 h.el('preset-select').handlers.change({target:{value:'unbiased'}});assert.equal(h.el('bias').getAttribute('aria-valuetext'),'0%');
 h.navigate('?experiment=orbit&speed=150&gravity=80');assert.equal(h.el('speed').getAttribute('aria-valuetext'),'150%');
});

test('deferred-effect button feedback names the next action without changing existing work or pause state',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');click(h,'life-toggle');
 const drawing=h.drawing(),metrics=h.el('metrics').textContent,button=h.el('increase-density');button.focus();click(h,button.id);
 assert.equal(h.el('announcement').textContent,'随机初始密度：31%；仅用于下一次随机播种');
 assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('metrics').textContent,metrics);assert.equal(h.el('status').textContent,'已暂停');assert.equal(document.activeElement,button);
 h.tabs[0].handlers.click();const bodies=h.el('metrics').textContent;click(h,'increase-speed');
 assert.equal(h.el('announcement').textContent,'新行星速度：101%；仅用于下一次发射');
 assert.equal(h.el('metrics').textContent,bodies);assert.equal(h.el('status').textContent,'已暂停');
 click(h,'increase-gravity');assert.equal(h.el('announcement').textContent,'引力强度：81','immediate parameters do not claim a deferred effect');
});

test('rebuild notes never promise an automatic pause and running seeded experiments still advance',async()=>{
 for(const [mode,id,initialMetric,nextMetric] of [['fractal','seed','300 个点','400 个点'],['walk','bias','16 步','20 步']]){
  const h=await setup('?experiment='+mode,'',false);click(h,'increase-'+id);
  assert.match(h.el('metrics').textContent,new RegExp(initialMetric));assert.equal(h.el('status').textContent,'运行中');assert.equal(h.frames.size,1);
  h.tick(0);h.tick(50);h.tick(100);assert.match(h.el('metrics').textContent,new RegExp(nextMetric));
  click(h,'pause');input(h,id,23);assert.equal(h.el('status').textContent,'已暂停');assert.equal(h.frames.size,0);
 }
});

test('effect help wraps within the existing controls without a new focus stop or live region',async()=>{
 const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 const rule=css.match(/\.parameter-effect\{([^}]+)\}/)?.[1];assert.ok(rule);
 assert.match(rule,/grid-column:1\/-1/,'shared help spans both mobile parameter columns');
 assert.match(rule,/font-size:12px/);assert.match(rule,/line-height:1\.7/);assert.match(rule,/overflow-wrap:anywhere/);
 assert.doesNotMatch(rule,/position:|width:|white-space:nowrap/);
});
