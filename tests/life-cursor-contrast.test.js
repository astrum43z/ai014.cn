import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';
import {lifeStep} from '../simulations.js';

const click=(h,id)=>h.el(id).handlers.click();
const position=h=>h.el('life-cell-position').textContent.match(/第 (\d+) 列，第 (\d+) 行/).slice(1).map(n=>Number(n)-1);
function board(h){
 const {width,height}=h.el('canvas').getBoundingClientRect(),cw=width/48,ch=height/32;
 const cells=new Uint8Array(48*32);let color;
 for(const [name,...args] of h.drawing()){
  if(name==='fillStyle')color=args[0];
  if(name==='fillRect'&&color==='#d3f35b')cells[Math.round((args[1]-.6)/ch)*48+Math.round((args[0]-.6)/cw)]=1;
 }return cells;
}
function cursor(h){
 const d=h.drawing(),end=d.findLastIndex(row=>row[0]==='strokeRect');
 const start=d.findLastIndex((row,i)=>i<end&&row[0]==='save');
 const ops=d.slice(start,end+2),[x,y]=position(h),{width,height}=h.el('canvas').getBoundingClientRect();
 const cw=width/48,ch=height/32,edge=Math.min(4,Math.max(2,Math.min(cw,ch)-3));
 const rect=['strokeRect',x*cw+1,y*ch+1,Math.max(1,cw-2),Math.max(1,ch-2)];
 assert.deepEqual(ops,[['save'],['setLineDash',[]],['strokeStyle','#122e29'],['lineWidth',edge],rect,['strokeStyle','#ffac86'],['lineWidth',Math.min(2,edge-1)],rect,['restore']],
  'the same solid rectangle receives a dark backing before the orange cursor; canvas styles are restored');
 assert.ok(rect[3]-edge>=1-1e-12&&rect[4]-edge>=1-1e-12,'both backing strokes leave at least one CSS pixel of the live/dead interior at supported layouts');
 assert.ok(edge-Math.min(2,edge-1)>=1,'the contrasting keyline remains at least half a CSS pixel on each side');
 assert.ok(start>d.findLastIndex((row,i)=>i<start&&row[0]==='fillRect'),'cursor stays above the live cells');
 const neighbors=d.filter(row=>row[0]==='setLineDash'&&row[1].join(',')==='2,2');
 assert.equal(neighbors.length,h.el('status').textContent==='已暂停'?1:0);
 return ops;
}
function select(h,x,y){const [oldX,oldY]=position(h);for(let i=0;i<(x-oldX+48)%48;i++)h.key('ArrowRight');for(let i=0;i<(y-oldY+32)%32;i++)h.key('ArrowDown');}
function pointer(h,type,id,x,y){const r=h.el('canvas').getBoundingClientRect();h.el('canvas').handlers[type]({type,pointerId:id,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,isPrimary:true,detail:1,clientX:(x+.5)*r.width/48,clientY:(y+.5)*r.height/32});}

// Nominal sRGB contrast explains why an opaque edge is needed. Antialiasing
// and physical displays are separately inspected; these are not pixel tests.
test('the dark cursor edge contrasts with both the live fill and orange foreground',()=>{
 const lum=hex=>hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
 assert.ok(contrast('ffac86','d3f35b')<2,'a plain orange border blends into a live cell');
 for(const color of ['ffac86','d3f35b'])assert.ok(contrast(color,'122e29')>7.9);
});

test('live and empty selections retain their exact cell, readings and fills under the edged cursor',async()=>{
 const h=await setup('?experiment=life');cursor(h);assert.match(h.el('life-selection').textContent,/活格/);
 const initial=board(h),drawing=h.drawing(),message=h.el('announcement').textContent;
 h.resize(600,414);cursor(h);assert.deepEqual(h.drawing(),drawing);assert.deepEqual(board(h),initial);assert.equal(h.el('announcement').textContent,message);
 click(h,'life-toggle');cursor(h);assert.match(h.el('life-selection').textContent,/空格/);
 click(h,'life-undo-edit');cursor(h);assert.deepEqual(board(h),initial);
});

test('selection geometry remains exact on all board edges and narrow or fractional views',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');
 for(const [x,y] of [[0,0],[47,0],[0,31],[47,31],[24,0],[0,16],[47,16],[24,31]]){
  select(h,x,y);click(h,'life-toggle');
  for(const [width,height] of [[259,240],[284.5,260.25],[600,414],[1200,900]]){h.resize(width,height);cursor(h);assert.equal(board(h)[y*48+x],1);}
 }
});

test('pointer taps and uninterrupted draw or erase gestures retain exact selection and undo',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');
 for(const type of ['pointerdown','pointerup','click'])pointer(h,type,1,4,4);cursor(h);assert.deepEqual(position(h),[4,4]);assert.equal(board(h)[4*48+4],1);
 for(const erase of [false,true]){
  if(erase)click(h,'life-erase');const before=board(h);
  pointer(h,'pointerdown',2,5,4);pointer(h,'pointermove',2,8,4);pointer(h,'pointerup',2,10,4);pointer(h,'click',2,10,4);
  cursor(h);assert.deepEqual(position(h),[10,4]);for(let x=5;x<=10;x++)assert.equal(board(h)[4*48+x],erase?0:1);
  const after=board(h);click(h,'life-undo-edit');cursor(h);assert.deepEqual(board(h),before);
  if(!erase){for(const type of ['pointerdown','pointermove','pointerup','click'])pointer(h,type,3,type==='pointerdown'?5:10,4);assert.deepEqual(board(h),after);}
 }
});

test('comparison overlays, generation rewind and clear recovery keep the selection layer on top',async()=>{
 const h=await setup('?experiment=life');click(h,'guide-start');const initial=board(h);cursor(h);
 click(h,'life-test');cursor(h);assert.deepEqual(board(h),lifeStep(initial,48,32));
 const rows=h.drawing(),selectionStart=rows.findLastIndex(row=>row[0]==='save');
 const birth=rows.findIndex(row=>row[0]==='strokeStyle'&&row[1]==='#82d6dd');
 assert.ok(birth>=0&&birth<selectionStart,'birth overlay exists and precedes the cursor');
 click(h,'life-return');cursor(h);assert.deepEqual(board(h),initial);
 click(h,'step');cursor(h);click(h,'life-back');cursor(h);assert.deepEqual(board(h),initial);
 click(h,'clear');cursor(h);click(h,'life-undo-clear');cursor(h);assert.deepEqual(board(h),initial);
});

test('running generations update the outlined cursor quietly and reduced motion restores neighbor context',async()=>{
 const h=await setup('?experiment=life','',false);cursor(h);const initial=board(h),message=h.el('announcement').textContent;
 h.tick(0);h.tick(50);h.tick(100);h.tick(150);cursor(h);assert.deepEqual(board(h),lifeStep(initial,48,32));assert.equal(h.el('announcement').textContent,message);
 h.motion.change({matches:true});cursor(h);assert.equal(h.frames.size,0);h.motion.change({matches:false});assert.equal(h.frames.size,0);
});

test('presets, retained tabs, parameter-only sharing and history restoration preserve Life cursor semantics',async()=>{
 const h=await setup('?experiment=life');
 for(const value of ['glider','blinker','pulsar']){h.el('preset-select').handlers.change({target:{value}});click(h,'load-preset');cursor(h);}
 h.key('ArrowRight');h.key('Enter');cursor(h);const before=board(h),selection=position(h);await click(h,'share');const url=location.href;
 assert.equal(new URL(url).searchParams.has('at'),false);
 for(const mode of ['orbit','wave','fractal','walk']){click(h,'tab-'+mode);click(h,'tab-life');cursor(h);assert.deepEqual(board(h),before);assert.deepEqual(position(h),selection);assert.equal(location.href,url);}
 h.navigate('?experiment=life&rate=3&density=20#canvas');cursor(h);assert.equal(h.el('rate').value,'3');
});

test('cursor movement and model comparison do not write or replace discovery evidence',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');
 for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle']){click(h,id);cursor(h);}
 assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');cursor(h);assert.equal(h.el('notes-count').textContent,'1 / 5');
 const notes=h.el('field-notes-list').innerHTML;
 for(const id of ['life-up','step','life-back','life-test','life-return','clear','life-undo-clear']){click(h,id);cursor(h);assert.equal(h.el('field-notes-list').innerHTML,notes);}
});
