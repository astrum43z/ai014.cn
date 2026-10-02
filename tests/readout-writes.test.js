import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

function track(h,ids){
 const writes=new Map(ids.map(id=>[id,0]));
 for(const id of ids){
  const element=h.el(id);let text=element.textContent;
  Object.defineProperty(element,'textContent',{get:()=>text,set:value=>{writes.set(id,writes.get(id)+1);text=value;},configurable:true});
 }
 return {writes,total:()=>[...writes.values()].reduce((a,b)=>a+b,0),reset:()=>ids.forEach(id=>writes.set(id,0))};
}
const observations=['observation-a','observation-b','observation-c','observation-detail'];
const orbit=['orbit-position','orbit-speed','orbit-preview-reading','orbit-launch-note','orbit-touch-reading','orbit-touch-status'];
const wave=['wave-distances','wave-difference','wave-path-note','wave-probe-reading','wave-envelope'];

test('120 Orbit frames do not replace unchanged launch text; live distances still update',async()=>{
 const h=await setup('?experiment=orbit','',false);
 const staticText=track(h,[...orbit,'observation-c','observation-detail']);
 const changing=track(h,['observation-a','observation-b']);
 h.tick(0);for(let i=1;i<=120;i++)h.tick(i*1000/60);
 assert.equal(staticText.total(),0,'avoid 960 unchanged text replacements');
 assert.ok(changing.total()>0,'physical readings must keep updating');
 assert.equal(h.frames.size,1);
 h.el('pause').handlers.click();assert.equal(h.frames.size,0);
 assert.match(h.el('orbit-launch-note').textContent,/虚线预演下一颗/);
 assert.match(h.el('orbit-preview-reading').textContent,/预演 10 秒后/);
 staticText.reset();h.resize(600,414);assert.equal(staticText.total(),0,'same paused redraw keeps text nodes');
 h.key('ArrowRight');assert.match(h.el('orbit-position').textContent,/x 145.0/);
 assert.ok(staticText.total()>0,'moving the launcher refreshes readings');
 const speed=h.el('orbit-speed').textContent;h.el('speed').handlers.input({target:{value:'65'}});
 assert.notEqual(h.el('orbit-speed').textContent,speed);
});

test('120 Wave frames preserve static text while signed displacements keep changing',async()=>{
 const h=await setup('?experiment=wave','',false),fixed=track(h,[...wave,...observations]);
 const values=track(h,['wave-value-left','wave-value-right','wave-value-combined']);
 h.tick(0);for(let i=1;i<=120;i++)h.tick(i*1000/60);
 assert.equal(fixed.total(),0,'avoid 1080 unchanged text replacements');
 assert.ok(values.total()>100,'wave values still track time');
 h.el('pause').handlers.click();assert.match(h.el('wave-path-note').textContent,/实线 A/);
 fixed.reset();values.reset();h.resize(600,414);assert.equal(fixed.total()+values.total(),0);
 h.key('ArrowRight');assert.match(h.el('wave-probe-reading').textContent,/x 2.0/);
 assert.ok(fixed.total()>0);
 const before=h.el('wave-difference').textContent;
 h.el('wavelength').handlers.input({target:{value:'70'}});assert.notEqual(h.el('wave-difference').textContent,before);
});

test('readings refresh across presets, reset, all five tabs and history without a stale cache',async()=>{
 const h=await setup('?experiment=wave');
 const tracked=track(h,[...observations,...wave,...orbit]);
 h.el('preset-select').handlers.change({target:{value:'wide'}});assert.match(h.el('wave-difference').textContent,/波长 65/);
 h.key('ArrowRight');h.el('reset').handlers.click();assert.match(h.el('wave-probe-reading').textContent,/x 0.0，y 0.0/);
 for(const [index,pattern] of [[0,/首颗行星距离/],[1,/活细胞/],[3,/已留下/],[4,/实测散开程度/],[2,/波程差/]]){
  h.tabs[index].handlers.click();assert.match(h.el('observation-a').textContent,pattern);
 }
 h.navigate('?experiment=wave&wavelength=15&separation=20');assert.match(h.el('wave-difference').textContent,/波长 15/);
 h.el('observation-detail').textContent='stale';h.resize(600,414);
 assert.match(h.el('observation-detail').textContent,/模型单位/,'compare actual DOM instead of a shadow cache');
 assert.ok(tracked.total()>0);
});
