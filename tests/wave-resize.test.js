import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const reading=h=>h.el('wave-probe-reading').textContent;
function visible(h,width,height){
 const p=h.probe(),epsilon=1e-8;
 assert.ok(p.x>=18-epsilon&&p.x<=width-18+epsilon,`horizontal crosshair remains inside: ${p.x} / ${width}`);
 assert.ok(p.y>=18-epsilon&&p.y<=height-18+epsilon,`vertical crosshair remains inside: ${p.y} / ${height}`);
}

test('an unsaved pointer measurement remains visible through narrow and tall resizing',async()=>{
 const h=await setup('?experiment=wave');
 h.el('canvas').handlers.click({clientX:575,clientY:25});
 const before=reading(h),metrics=h.el('metrics').textContent,url=location.href,message=h.el('announcement').textContent,writes=h.writes();
 for(const [width,height] of [[295,260],[259,414],[600,240],[295,260],[600,414]]){
  h.resize(width,height);visible(h,width,height);
  assert.equal(reading(h),before);assert.equal(h.el('metrics').textContent,metrics);
  assert.equal(location.href,url);assert.equal(h.writes(),writes);
  assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,0);
 }
});

test('a precision-selected probe remains visible without changing a saved checkpoint or running state',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,2.5');
 for(let i=0;i<90;i++)click(h,'wave-right');
 const before=reading(h),url=location.href;
 click(h,'pause');assert.equal(h.frames.size,1);
 h.resize(259,240);visible(h,259,240);
 assert.equal(reading(h),before);assert.equal(location.href,url);assert.equal(h.frames.size,1);
 h.tick(0);h.tick(50);visible(h,259,240);assert.equal(reading(h),before);
});

test('returning after a hidden-world resize fits the current probe beyond the original shared point',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,2.5');
 h.el('canvas').handlers.click({clientX:575,clientY:25});
 const before=reading(h),url=location.href;
 h.tabs[1].handlers.click();h.resize(259,240);h.tabs[2].handlers.click();
 visible(h,259,240);assert.equal(reading(h),before);assert.equal(location.href,url);
 assert.equal(h.frames.size,0);
});

test('viewport fitting retains a wider shared view and center/reset recover the ordinary scale',async()=>{
 const h=await setup('?experiment=wave&at=v1,800,-300,2.5');
 const initial=h.probe();
 h.key('ArrowLeft');const selected=reading(h);
 h.resize(600,414);assert.equal(reading(h),selected);
 assert.ok(h.probe().x<initial.x,'fitting does not zoom back in after moving toward center');
 h.resize(295,260);visible(h,295,260);
 click(h,'wave-home');click(h,'wave-right');
 assert.ok(Math.abs(h.probe().x-(295/2+2*260/280))<1e-8,'Home releases the expanded view');
 h.el('canvas').handlers.click({clientX:290,clientY:5});h.resize(259,414);
 click(h,'reset');click(h,'wave-right');
 assert.ok(Math.abs(h.probe().x-(259/2+2*259/280))<1e-8,'Reset releases the expanded view');
});

test('ordinary probe movement keeps a stable field scale and current-viewport bounds',async()=>{
 const h=await setup('?experiment=wave');h.resize(295,260);
 for(let i=0;i<90;i++)click(h,'wave-down');
 assert.match(reading(h),/y 140.0/);
 assert.equal(h.probe().y,260);
 const atEdge=reading(h);click(h,'wave-down');assert.equal(reading(h),atEdge);
 h.resize(295,260);visible(h,295,260);assert.equal(reading(h),atEdge);
});
