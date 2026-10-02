import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const choose=(h,value)=>h.el('preset-select').handlers.change({target:{value}});
const load=(h,value)=>{choose(h,value);click(h,'load-preset');};
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const snapshot=h=>({drawing:h.drawing(),metrics:h.el('metrics').textContent,status:h.el('status').textContent,url:location.href,announcement:h.el('announcement').textContent,frames:h.frames.size});
const modes=['orbit','life','wave','fractal','walk'];
const names=['escape','pulsar','wide','islands','drift'];

test('each initial world offers a truthful empty choice instead of claiming its first preset',async()=>{
 for(const mode of modes){
  const h=await setup('?experiment='+mode);
  assert.equal(h.el('preset-select').value,'');
  assert.match(h.el('preset-select').innerHTML,/<option value="" disabled selected>先选择一个预设<\/option>/);
  assert.equal(h.el('load-preset').getAttribute('aria-disabled'),'true');
  const before=snapshot(h);click(h,'load-preset');assert.deepEqual(snapshot(h),before);
 }
});

test('browsing native preset choices never changes the current model, URL, feedback or running state',async()=>{
 for(const [i,mode] of modes.entries()){
  const h=await setup('?experiment='+mode,'',false);
  h.el('preset-select').focus();const before=snapshot(h);
  choose(h,names[i]);
  assert.equal(h.el('preset-select').value,names[i]);
  assert.equal(h.el('load-preset').getAttribute('aria-disabled'),'false');
  assert.deepEqual(snapshot(h),before);
  assert.equal(document.activeElement,h.el('preset-select'));
  choose(h,names[i]);assert.deepEqual(snapshot(h),before,'repeated choice remains reversible');
 }
});

test('the same named Life preset can be explicitly reloaded after evolving or editing',async()=>{
 const h=await setup('?experiment=life&rate=4&density=45');
 for(const [name,count] of [['glider',5],['blinker',3],['pulsar',48]]){
  load(h,name);const drawing=h.drawing();
  click(h,'step');click(h,'life-toggle');
  h.el('load-preset').focus();click(h,'load-preset');
  assert.equal(h.el('metrics').textContent,`第 0 代 · ${count} 个活格子`);
  assert.deepEqual(h.drawing(),drawing);
  assert.equal(h.el('preset-select').value,name);
  assert.equal(document.activeElement,h.el('load-preset'));
  assert.equal(h.el('rate').value,'4');assert.equal(h.el('density').value,'45');
  assert.equal(h.frames.size,0);
 }
});

test('reset clears the choice while keeping current parameters and the existing default Life board',async()=>{
 const h=await setup('?experiment=life&rate=3&density=60');
 for(const name of ['glider','blinker','pulsar','random']){
  load(h,name);click(h,'step');click(h,'reset');
  assert.equal(h.el('metrics').textContent,'第 0 代 · 10 个活格子');
  assert.equal(h.el('preset-select').value,'');
  assert.equal(h.el('load-preset').getAttribute('aria-disabled'),'true');
  assert.equal(h.el('rate').value,'3');assert.equal(h.el('density').value,'60');
  const before=snapshot(h);click(h,'load-preset');assert.deepEqual(snapshot(h),before);
  click(h,'reset');assert.deepEqual(snapshot(h),before,'repeated Reset is stable');
 }
});

test('Orbit reload repeats the chosen initial velocities while Reset still uses current gravity',async()=>{
 const h=await setup('?experiment=orbit&gravity=120&speed=65');
 for(const name of ['elliptic','escape','circular']){
  load(h,name);const drawing=h.drawing(),speed=h.el('observation-b').textContent;
  for(let i=0;i<10;i++)click(h,'step');
  click(h,'load-preset');assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('observation-b').textContent,speed);
  click(h,'reset');assert.equal(h.el('preset-select').value,'');
  assert.equal(h.el('gravity').value,'120');assert.equal(h.el('speed').value,'65');
  assert.equal(h.el('observation-b').textContent,'首颗行星速率 · 40.0');
 }
});

test('a pending selection survives a tab round trip without changing the active or saved experiment',async()=>{
 const h=await setup('?experiment=life');load(h,'blinker');click(h,'step');choose(h,'pulsar');
 const life=snapshot(h);h.tabs[2].handlers.click();load(h,'wide');choose(h,'close');
 const wave=h.drawing();h.tabs[1].handlers.click();
 assert.equal(h.el('preset-select').value,'pulsar');assert.deepEqual(h.drawing(),life.drawing);assert.equal(h.el('metrics').textContent,life.metrics);
 click(h,'load-preset');assert.equal(h.el('metrics').textContent,'第 0 代 · 48 个活格子');
 h.tabs[2].handlers.click();assert.equal(h.el('preset-select').value,'close');assert.deepEqual(h.drawing(),wave);
});

test('browsing does not change shortcut cycling; only an actual load changes the last-used preset',async()=>{
 const h=await setup('?experiment=orbit');load(h,'circular');choose(h,'escape');click(h,'preset');
 assert.equal(h.el('preset-select').value,'elliptic');assert.equal(h.el('announcement').textContent,'已载入预设：椭圆旅行');
 choose(h,'escape');click(h,'load-preset');click(h,'preset');
 assert.equal(h.el('preset-select').value,'circular');assert.equal(h.el('announcement').textContent,'已载入预设：环形舞步');
});

test('choosing keeps a shared checkpoint and focus; loading deliberately replaces only its world',async()=>{
 for(const [mode,name] of [['wave','wide'],['fractal','islands'],['walk','drift']]){
  const at=mode==='wave'?'8,0,2':mode==='fractal'?'1000':'64';
  const h=await setup('?experiment='+mode+'&at=v1,'+at),url=location.href,drawing=h.drawing();
  choose(h,name);assert.equal(location.href,url);assert.deepEqual(h.drawing(),drawing);
  h.el('load-preset').focus();click(h,'load-preset');
  assert.ok(!new URL(location.href).searchParams.has('at'));
  assert.equal(h.el('preset-select').value,name);assert.equal(h.frames.size,0);
  assert.equal(document.activeElement,h.el('load-preset'));
 }
});

test('Life recovery and comparison survive choosing a preset until explicit load',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');
 choose(h,'pulsar');assert.equal(h.el('life-undo-clear').getAttribute('aria-disabled'),'false');
 click(h,'life-undo-clear');assert.equal(h.el('metrics').textContent,'第 0 代 · 10 个活格子');
 click(h,'life-test');assert.equal(h.el('life-return').hidden,false);
 choose(h,'blinker');assert.equal(h.el('life-return').hidden,false);
 click(h,'load-preset');assert.equal(h.el('life-return').hidden,true);assert.equal(h.el('metrics').textContent,'第 0 代 · 3 个活格子');
});

test('parameter rebuilding, guides and URL restoration keep an appropriate load choice',async()=>{
 const h=await setup('?experiment=fractal');load(h,'islands');input(h,'seed',15);
 assert.equal(h.el('preset-select').value,'');assert.equal(h.el('load-preset').getAttribute('aria-disabled'),'true');
 click(h,'guide-start');assert.equal(h.el('preset-select').value,'half');assert.equal(h.el('load-preset').getAttribute('aria-disabled'),'false');
 h.navigate('?experiment=walk&bias=25&seed=19&at=v1,64');
 assert.equal(h.el('preset-select').value,'');assert.match(h.el('metrics').textContent,/64 步/);
});

test('empty and unknown choices do not load; held Enter cannot repeatedly replace the canvas',async()=>{
 const h=await setup('?experiment=life');const before=snapshot(h);
 for(const value of ['', 'missing']){choose(h,value);click(h,'load-preset');assert.deepEqual(snapshot(h),before);}
 const button=h.el('load-preset');let prevented=0;
 for(const [key,repeat] of [['Enter',false],[' ',true],['Tab',false]])button.handlers.keydown({key,repeat,preventDefault(){prevented++;}});
 assert.equal(prevented,0);button.handlers.keydown({key:'Enter',repeat:true,preventDefault(){prevented++;}});assert.equal(prevented,1);
});

test('load and reset expose concise replacement guidance with no extra live region or narrow fixed width',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 for(const id of ['preset-select','load-preset','reset'])assert.match(html.match(new RegExp('<(?:select|button)[^>]*id="'+id+'"[^>]*>'))[0],/aria-describedby="preset-help"/);
 const help=html.match(/<p id="preset-help"[^>]*>[^<]+<\/p>/)[0];
 assert.match(help,/先选择，再点载入/);assert.match(help,/重置保留当前参数/);assert.doesNotMatch(help,/aria-live|tabindex|hidden/);
 assert.match(css,/\.controls>#load-preset,\.controls>\.preset-help\{grid-column:1\/-1\}/);
 assert.match(css,/\.controls>\.preset-help\{[^}]*overflow-wrap:anywhere/);
 assert.match(css,/#load-preset\[aria-disabled="true"\]\{[^}]*cursor:not-allowed/);
});
