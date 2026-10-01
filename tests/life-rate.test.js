import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

function clock(h){
 let now=0;
 return {start(){h.tick(now);},advance(ms){while(ms>0){const step=Math.min(ms,50);now+=step;h.tick(now);ms-=step;}},resume(){now+=60000;h.tick(now);}};
}
const generations=h=>Number(h.el('metrics').textContent.match(/^第 (\d+) 代/)[1]);
function rate(h,value){h.el('rate').value=String(value);h.el('rate').handlers.input({target:h.el('rate')});}
function pause(h){h.el('pause').handlers.click();assert.equal(h.frames.size,0);}
function resume(h,c){h.el('pause').handlers.click();assert.equal(h.frames.size,1);c.resume();}

test('paused acceleration preserves one partial generation instead of replaying old time at the new rate',async()=>{
 const h=await setup('?experiment=life&rate=1','',false),c=clock(h);c.start();c.advance(900);pause(h);
 const before=h.drawing(),reading=h.el('metrics').textContent;
 rate(h,20);
 assert.equal(h.el('metrics').textContent,reading);assert.deepEqual(h.drawing(),before);
 assert.equal(h.el('status').textContent,'已暂停');assert.equal(h.frames.size,0);
 assert.equal(h.el('out-rate').textContent,'20 代/秒');assert.equal(new URL(location.href).searchParams.get('rate'),'20');
 resume(h,c);assert.equal(generations(h),0);c.advance(10);assert.equal(generations(h),1);
 c.advance(100);assert.equal(generations(h),3);
});

test('paused slowdown retains progress toward the next generation',async()=>{
 const h=await setup('?experiment=life&rate=20','',false),c=clock(h);c.start();c.advance(40);pause(h);rate(h,1);
 resume(h,c);c.advance(190);assert.equal(generations(h),0);c.advance(20);assert.equal(generations(h),1);
});

test('running acceleration does not burst through old accumulated time or start another frame chain',async()=>{
 const h=await setup('?experiment=life&rate=1','',false),c=clock(h);c.start();c.advance(900);rate(h,20);
 assert.equal(h.frames.size,1);assert.equal(generations(h),0);c.advance(10);assert.equal(generations(h),1);
});

test('running slowdown preserves fractional progress',async()=>{
 const h=await setup('?experiment=life&rate=20','',false),c=clock(h);c.start();c.advance(40);rate(h,1);
 c.advance(190);assert.equal(generations(h),0);c.advance(20);assert.equal(generations(h),1);
});

test('repeated slider changes while paused neither advance nor discard progress',async()=>{
 const h=await setup('?experiment=life&rate=1','',false),c=clock(h);c.start();c.advance(450);pause(h);
 for(let repeat=0;repeat<10;repeat++)for(const value of [2,20,7,3,1])rate(h,value);
 assert.equal(generations(h),0);assert.equal(h.frames.size,0);
 resume(h,c);c.advance(500);assert.equal(generations(h),0);c.advance(60);assert.equal(generations(h),1);
});

test('inactive Life retains its adjusted cadence across tab returns without catch-up',async()=>{
 const h=await setup('?experiment=life&rate=1','',false),c=clock(h);c.start();c.advance(900);pause(h);rate(h,20);
 h.tabs[2].handlers.click();h.tabs[1].handlers.click();
 assert.equal(h.el('rate').value,'20');assert.equal(h.frames.size,0);assert.equal(generations(h),0);
 resume(h,c);c.advance(10);assert.equal(generations(h),1);
});

test('changing density leaves the current cadence and drawing intact',async()=>{
 const h=await setup('?experiment=life&rate=1','',false),c=clock(h);c.start();c.advance(900);pause(h);
 const before=h.drawing();h.el('density').handlers.input({target:{value:'60'}});assert.deepEqual(h.drawing(),before);
 resume(h,c);c.advance(50);assert.equal(generations(h),0);c.advance(60);assert.equal(generations(h),1);
});

test('reset discards previous partial progress and manual step stays exactly one generation',async()=>{
 const h=await setup('?experiment=life&rate=1','',false),c=clock(h);c.start();c.advance(900);pause(h);rate(h,20);
 h.el('reset').handlers.click();h.el('step').handlers.click();assert.equal(generations(h),1);assert.equal(h.frames.size,0);
 resume(h,c);c.advance(40);assert.equal(generations(h),1);c.advance(20);assert.equal(generations(h),2);
});
