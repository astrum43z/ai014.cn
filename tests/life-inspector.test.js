import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {lifeStep,lifeNextState,inspectLifeCell} from '../simulations.js';

test('all 512 local neighborhoods predict the same transition as a simultaneous Life step',()=>{
 for(let pattern=0;pattern<512;pattern++){
  const board=new Uint8Array(25);
  for(let i=0;i<9;i++)board[(1+Math.floor(i/3))*5+1+i%3]=(pattern>>i)&1;
  const cell=inspectLifeCell(board,5,5,2,2);
  const bits=Array.from({length:9},(_,i)=>(pattern>>i)&1);
  const count=bits.reduce((a,b)=>a+b,0)-bits[4];
  const next=count===3||(bits[4]===1&&count===2)?1:0;
  assert.equal(cell.neighbors,count);
  assert.equal(cell.alive,bits[4]);
  assert.deepEqual(cell.neighborhood,bits);
  assert.equal(cell.next,next);
  assert.equal(lifeStep(board,5,5)[12],next);
  assert.equal(cell.rule,bits[4]?(next?'survive':count<2?'lonely':'crowded'):(next?'born':'empty'));
 }
});

test('birth, survival, underpopulation, overpopulation and unchanged emptiness cover every count',()=>{
 for(let n=0;n<=8;n++)for(const alive of [0,1]){
  assert.equal(lifeNextState(alive,n),Number(n===3||(alive===1&&n===2)));
 }
});

test('edge and corner neighborhoods wrap, retain orientation and exclude the center',()=>{
 const cols=48,rows=32;
 for(const [x,y] of [[0,0],[47,0],[0,31],[47,31],[0,10],[47,10],[15,0],[15,31]]){
  const board=new Uint8Array(cols*rows);
  for(const [dx,dy] of [[-1,-1],[0,-1],[1,0]])board[((y+dy+rows)%rows)*cols+(x+dx+cols)%cols]=1;
  const before=board.slice(),cell=inspectLifeCell(board,cols,rows,x,y);
  assert.deepEqual(cell.neighborhood,[1,1,0,0,0,1,0,0,0]);
  assert.equal(cell.neighbors,3);assert.equal(cell.next,1);assert.equal(cell.rule,'born');
  assert.equal(lifeStep(board,cols,rows)[y*cols+x],1);
  assert.deepEqual(board,before,'inspection and stepping do not mutate the input board');
 }
});

test('blinker endpoint prediction alternates death and birth while the center survives',()=>{
 let board=new Uint8Array(48*32);
 [22,23,24].forEach(x=>board[14*48+x]=1);
 for(let generation=0;generation<8;generation++){
  const endpoint=inspectLifeCell(board,48,32,22,14),middle=inspectLifeCell(board,48,32,23,14);
  assert.equal(endpoint.alive,generation%2===0?1:0);
  assert.equal(endpoint.neighbors,generation%2===0?1:3);
  assert.equal(endpoint.rule,generation%2===0?'lonely':'born');
  assert.equal(middle.rule,'survive');
  board=lifeStep(board,48,32);
  assert.equal(board[14*48+22],endpoint.next);
 }
});

test('inspector adds no control or live region and includes text equivalents and boundary guidance',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const panel=html.match(/<section id="life-inspector".*?<\/section>/s)?.[0];
 assert.ok(panel);assert.ok(panel.includes('aria-labelledby="life-inspector-title" hidden'));
 assert.ok(panel.includes('class="life-neighborhood" aria-hidden="true"'));
 assert.equal((panel.match(/id="life-neighbor-\d"/g)||[]).length,9);
 assert.doesNotMatch(panel,/<button|tabindex|aria-live|role="status"/);
 for(const id of ['position','state','next','reason'])assert.ok(panel.includes('id="life-cell-'+id+'"'));
 assert.match(panel,/含斜角/);assert.match(panel,/所有格子同时更新/);assert.match(panel,/方向键只移动/);
 assert.ok(html.indexOf('class="stage-controls"')<html.indexOf('id="life-inspector"'));
});
