import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnimationLoop} from '../animation.js';
function harness() {
  let running=true, id=0;
  const queue=new Map(), steps=[];
  const loop=createAnimationLoop({request:fn=>{queue.set(++id,fn);return id},cancel:id=>queue.delete(id),update:dt=>steps.push(dt),canRun:()=>running});
  return {queue,steps,loop,setRunning:value=>{running=value;loop.sync()},tick:now=>{const [id,fn]=queue.entries().next().value;queue.delete(id);fn(now)}};
}
test('repeated resume keeps exactly one frame chain',()=>{const h=harness();h.loop.sync();h.loop.sync();assert.equal(h.queue.size,1);h.tick(100);h.tick(116);assert.deepEqual(h.steps,[.016]);assert.equal(h.queue.size,1)});
test('pause, hidden and offscreen states cancel queued frames',()=>{const h=harness();h.loop.sync();h.tick(100);h.setRunning(false);assert.equal(h.queue.size,0);h.loop.sync();assert.equal(h.queue.size,0);assert.deepEqual(h.steps,[])});
test('resume does not advance by time spent suspended',()=>{const h=harness();h.loop.sync();h.tick(100);h.tick(116);h.setRunning(false);h.setRunning(true);h.tick(90000);assert.deepEqual(h.steps,[.016]);h.tick(90016);assert.deepEqual(h.steps,[.016,.016])});
test('long active frame is capped and clock reversal cannot reverse time',()=>{const h=harness();h.loop.sync();h.tick(100);h.tick(1100);h.tick(1000);assert.deepEqual(h.steps,[.05])});
