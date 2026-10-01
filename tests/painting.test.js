import test from 'node:test';
import assert from 'node:assert/strict';
import {paintLifeLine} from '../painting.js';
const indexes=cells=>Array.from(cells.keys()).filter(i=>cells[i]);
test('horizontal, vertical, and diagonal strokes include both ends without gaps',()=>{
 for(const [from,to] of [[{x:1,y:2},{x:7,y:2}],[{x:2,y:1},{x:2,y:7}],[{x:1,y:1},{x:7,y:7}],[{x:1,y:7},{x:7,y:1}]]){
  for(const [start,end] of [[from,to],[to,from]]){
   const cells=new Uint8Array(81);paintLifeLine(cells,9,start,end);
   assert.equal(indexes(cells).length,7);
   for(let n=0;n<=6;n++)assert.equal(cells[(from.y+(to.y-from.y)*n/6)*9+from.x+(to.x-from.x)*n/6],1);
  }
 }
});
test('steep and shallow strokes are connected in all directions',()=>{
 for(const end of [{x:7,y:5},{x:5,y:7},{x:1,y:5},{x:3,y:7},{x:1,y:3},{x:3,y:1},{x:7,y:3},{x:5,y:1}]){
  const cells=new Uint8Array(81),start={x:4,y:4};paintLifeLine(cells,9,start,end);
  const all=indexes(cells);assert.equal(all.length,4);assert.equal(cells[end.y*9+end.x],1);
  const reachable=new Set([start.y*9+start.x]);
  for(let n=0;n<all.length;n++)for(const i of all)if([...reachable].some(j=>Math.abs(i%9-j%9)<=1&&Math.abs(Math.floor(i/9)-Math.floor(j/9))<=1))reachable.add(i);
  assert.equal(reachable.size,all.length);
 }
});
test('overlapping strokes stay alive, do not wrap edges, and leave unrelated cells untouched',()=>{
 const cells=new Uint8Array(48*32);cells[20*48+20]=1;
 paintLifeLine(cells,48,{x:0,y:0},{x:47,y:0});
 paintLifeLine(cells,48,{x:47,y:0},{x:47,y:31});
 paintLifeLine(cells,48,{x:47,y:31},{x:47,y:0});
 paintLifeLine(cells,48,{x:10,y:0},{x:10,y:0});
 assert.equal(indexes(cells).length,80);
 assert.equal(cells[48],0);assert.equal(cells[31*48],0);assert.equal(cells[20*48+20],1);
});
