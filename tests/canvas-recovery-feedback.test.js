import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const worlds=['orbit','life','wave','fractal','walk'];
const click=(h,id)=>h.el(id).handlers.click();
const hint=h=>h.el('hint').textContent;
const waiting=h=>{
 assert.equal(h.el('status').textContent,'画布待恢复');
 assert.match(hint(h),/实验仍在本页.*等待浏览器恢复画面.*刷新会清空进度/);
 assert.equal(h.frames.size,0);
};

for(const world of worlds)test(`${world}: unavailable bitmap has quiet, honest feedback without changing pause intent or model`,async()=>{
 for(const reduced of [true,false]){
  const h=await setup('?experiment='+world,'',reduced),normalHint=hint(h);
  h.el('canvas').focus();
  const before={picture:h.drawing(),metrics:h.el('metrics').textContent,announcement:h.el('announcement').textContent,url:location.href,writes:h.writes(),button:h.el('pause').textContent};
  assert.ok(normalHint);h.loseContext();waiting(h);
  assert.equal(h.el('pause').textContent,before.button);assert.equal(document.activeElement,h.el('canvas'));
  assert.equal(h.el('metrics').textContent,before.metrics);assert.equal(location.href,before.url);assert.equal(h.writes(),before.writes);
  assert.equal(h.el('announcement').textContent,before.announcement,'do not replace the visitor’s latest action feedback');
  h.restoreContext();assert.equal(h.el('status').textContent,reduced?'已暂停':'运行中');assert.equal(hint(h),normalHint);
  assert.deepEqual(h.drawing(),before.picture);assert.equal(h.el('announcement').textContent,before.announcement);
  assert.equal(h.frames.size,reduced?0:1);assert.equal(document.activeElement,h.el('canvas'));
 }
});

test('pause, continue, stepping and reduced motion preserve interruption feedback until recovery',async()=>{
 const h=await setup('?experiment=wave','',false),normalHint=hint(h);h.loseContext();waiting(h);
 click(h,'pause');waiting(h);assert.equal(h.el('pause').textContent,'继续');
 click(h,'pause');waiting(h);assert.equal(h.el('pause').textContent,'暂停');
 click(h,'step');waiting(h);assert.equal(h.el('pause').textContent,'继续');assert.match(h.el('metrics').textContent,/0\.5 s/);
 click(h,'pause');h.motion.change({matches:true});waiting(h);
 h.motion.change({matches:false});waiting(h);h.restoreContext();
 assert.equal(h.el('status').textContent,'已暂停');assert.equal(hint(h),normalHint);assert.equal(h.frames.size,0);
});

test('switching or restoring an address while unavailable keeps the warning and then shows the current world hint',async()=>{
 const normalHints={};
 for(const world of worlds){const h=await setup('?experiment='+world);normalHints[world]=hint(h);}
 const h=await setup('?experiment=life');h.loseContext();
 for(const tab of h.tabs){tab.handlers.click();waiting(h);}
 h.navigate('?experiment=fractal&jump=50&seed=14&at=v1,1000#canvas');waiting(h);
 assert.match(h.el('metrics').textContent,/1000/);const url=location.href;
 h.restoreContext();assert.equal(hint(h),normalHints.fractal);assert.equal(h.el('status').textContent,'已暂停');assert.equal(location.href,url);
 h.tabs[1].handlers.click();assert.equal(hint(h),normalHints.life);assert.equal(h.el('status').textContent,'已暂停');
});

test('presets, parameters, resets and discovery commands cannot hide the interruption message',async()=>{
 for(const world of worlds){
  const h=await setup('?experiment='+world);h.loseContext();
  click(h,'reset');waiting(h);click(h,'preset');waiting(h);
  click(h,'mission-start');waiting(h);click(h,'mission-check');waiting(h);
  const parameter={orbit:'gravity',life:'rate',wave:'wavelength',fractal:'jump',walk:'bias'}[world];
  h.el(parameter).handlers.input({target:{value:{orbit:'90',life:'10',wave:'40',fractal:'55',walk:'10'}[world]}});waiting(h);
  const metrics=h.el('metrics').textContent,result=h.el('mission-result').textContent;
  h.restoreContext();assert.equal(h.el('status').textContent,'已暂停');assert.doesNotMatch(hint(h),/恢复|刷新/);
  assert.equal(h.el('metrics').textContent,metrics);assert.equal(h.el('mission-result').textContent,result);
 }
});

test('visibility, density and layout events cannot clear the warning or resume unseen animation',async()=>{
 const h=await setup('?experiment=orbit','',false),normalHint=hint(h);h.loseContext();
 h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);h.setDpr(2);h.resize(334,240);waiting(h);
 h.setVisible(false);h.restoreContext();assert.equal(h.el('status').textContent,'运行中');assert.equal(hint(h),normalHint);
 assert.equal(h.frames.size,0);h.setVisible(true);assert.equal(h.frames.size,1);
});

test('repeated lifecycle events do not churn unchanged feedback or overwrite pending PNG results',async()=>{
 const h=await setup('?experiment=life');let encoded;h.el('canvas').toBlob=callback=>{encoded=callback;};
 click(h,'save');const pending=h.el('save-status').textContent,announcement=h.el('announcement').textContent;
 const writes={status:0,hint:0};
 for(const id of Object.keys(writes)){
  let text=h.el(id).textContent;Object.defineProperty(h.el(id),'textContent',{get:()=>text,set:value=>{text=value;writes[id]++;}});
 }
 h.loseContext();waiting(h);assert.deepEqual(writes,{status:1,hint:1});
 for(let i=0;i<5;i++){h.loseContext();h.resize(334,240);waiting(h);}
 assert.deepEqual(writes,{status:1,hint:1});assert.equal(h.el('save-status').textContent,pending);assert.equal(h.el('announcement').textContent,announcement);
 encoded(new Blob(['png']));const saved=h.el('save-status').textContent;assert.match(saved,/已发起.*生命的形状/);
 h.restoreContext();assert.deepEqual(writes,{status:2,hint:2});
 h.restoreContext();assert.deepEqual(writes,{status:2,hint:2});assert.equal(h.el('save-status').textContent,saved);assert.equal(h.el('announcement').textContent,saved);
});

test('feedback reuses readable stage text and leaves the existing controls, description and live regions intact',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<span id="status">运行中<\/span>/);
 assert.match(html,/<div class="stage-bottom"><span id="metrics">[^<]+<\/span><span id="hint">[^<]+<\/span><\/div>/);
 const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(css,/\.stage-top,\.stage-bottom\{flex-wrap:wrap\}/);
 assert.match(css,/\.stage-top,\.stage-bottom,\.walk-legend\{font-size:12px;line-height:1\.7\}/);
});
