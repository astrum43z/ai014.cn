import test from 'node:test';import assert from 'node:assert/strict';import {lifeStep,orbitStep,waveValue} from '../simulations.js';
test('life empty universe stays empty',()=>assert.deepEqual(lifeStep(new Uint8Array(25),5,5),new Uint8Array(25)));
test('life block remains stable',()=>{const c=new Uint8Array(36);[14,15,20,21].forEach(i=>c[i]=1);assert.deepEqual(lifeStep(c,6,6),c);});
test('life blinker returns after two generations',()=>{const c=new Uint8Array(25);[11,12,13].forEach(i=>c[i]=1);const n=lifeStep(c,5,5);assert.deepEqual([...n.entries()].filter(([i,v])=>v).map(([i])=>i),[7,12,17]);assert.deepEqual(lifeStep(n,5,5),c);});
test('life toroidal boundary wraps',()=>{const c=new Uint8Array(25);[10,14,11].forEach(i=>c[i]=1);const n=lifeStep(c,5,5);assert.equal(n[5],1);assert.equal(n[10],1);assert.equal(n[15],1);});
test('orbit remains bounded near circular orbit',()=>{const b={x:100,y:0,vx:0,vy:Math.sqrt(80000/100)};for(let i=0;i<10000;i++)orbitStep(b,80000,.005);assert.ok(Math.abs(Math.hypot(b.x,b.y)-100)<.3);});
test('orbit origin is finite',()=>{const b=orbitStep({x:0,y:0,vx:0,vy:0},80000,.1);assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y));});
test('waves are symmetric and bounded',()=>{for(let x=-100;x<100;x+=4)for(let y=-100;y<100;y+=4){const a=waveValue(x,y,1,80,32);assert.ok(Math.abs(a)<=1);assert.ok(Math.abs(a-waveValue(-x,y,1,80,32))<1e-10);}});
