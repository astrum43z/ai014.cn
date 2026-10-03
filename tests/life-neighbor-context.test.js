import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
import {inspectLifeCell,lifeStep} from '../simulations.js';

const click=(h,id)=>h.el(id).handlers.click();
const next=h=>h.el('life-next-reading').textContent;
const help=h=>h.el('life-neighbor-help').textContent;
const position=h=>h.el('life-cell-position').textContent.match(/第 (\d+) 列，第 (\d+) 行/).slice(1).map(n=>Number(n)-1);
const offsets=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
function rectangles(h){
 let style={color:null,dash:[],width:1},stack=[];const result=[];
 h.drawing().forEach(([name,...args],index)=>{
  if(name==='save')stack.push({...style});if(name==='restore')style=stack.pop();
  if(name==='strokeStyle')style.color=args[0];if(name==='setLineDash')style.dash=args[0];if(name==='lineWidth')style.width=args[0];
  if(name==='strokeRect')result.push({...style,args,index});
 });return result;
}
const neighbors=h=>rectangles(h).filter(r=>(r.color==='#c7d9eb'||r.color==='#122e29')&&r.dash.join(',')==='2,2');
function board(h){
 const {width,height}=h.el('canvas').getBoundingClientRect(),cw=width/48,ch=height/32;
 const cells=new Uint8Array(48*32);let color;
 for(const [name,...args] of h.drawing()){
  if(name==='fillStyle')color=args[0];
  if(name==='fillRect'&&color==='#d3f35b')cells[Math.round((args[1]-.6)/ch)*48+Math.round((args[0]-.6)/cw)]=1;
 }return cells;
}
function toggle(h,x,y){const r=h.el('canvas').getBoundingClientRect();h.el('canvas').handlers.click({detail:0,clientX:(x+.5)*r.width/48,clientY:(y+.5)*r.height/32});}
function select(h,x,y){
 const [oldX,oldY]=position(h);
 for(let i=0;i<(x-oldX+48)%48;i++)h.key('ArrowRight');
 for(let i=0;i<(y-oldY+32)%32;i++)h.key('ArrowDown');
}
function checkGeometry(h){
 const [x,y]=position(h),{width,height}=h.el('canvas').getBoundingClientRect(),cw=width/48,ch=height/32;
 const boxes=neighbors(h);assert.equal(boxes.length,8);
 const expected=offsets.map(([dx,dy])=>[((x+dx+48)%48)*cw+1.5,((y+dy+32)%32)*ch+1.5,Math.max(1,cw-3),Math.max(1,ch-3)]);
 assert.deepEqual(boxes.map(r=>r.args),expected);
 const cells=board(h);
 boxes.forEach((r,i)=>{const [dx,dy]=offsets[i],alive=cells[((y+dy+32)%32)*48+(x+dx+48)%48];assert.equal(r.color,alive?'#122e29':'#c7d9eb');});
 for(const r of boxes){assert.deepEqual(r.dash,[2,2]);assert.equal(r.width,1);assert.ok(r.args[0]>=0&&r.args[0]+r.args[2]<=width);assert.ok(r.args[1]>=0&&r.args[1]+r.args[3]<=height);}
 const selected=rectangles(h).at(-1);assert.equal(selected.color,'#ffac86');assert.deepEqual(selected.dash,[]);
 assert.deepEqual(selected.args,[x*cw+1,y*ch+1,Math.max(1,cw-2),Math.max(1,ch-2)]);
}
function consistent(h){
 const [x,y]=position(h),cell=inspectLifeCell(board(h),48,32,x,y);
 assert.equal(next(h),h.el('life-cell-next').textContent+'。'+h.el('life-cell-reason').textContent);
 assert.match(h.el('life-selection').textContent,new RegExp(`· ${cell.neighbors} 个活邻居$`));
 return cell;
}

test('paused Life marks exactly the eight counted cells without painting or counting the selected cell',async()=>{
 const h=await setup('?experiment=life');checkGeometry(h);consistent(h);
 assert.match(help(h),/虚线框标出 8 个邻居（含斜角），不含橙色实框本格/);
 const cells=board(h),metrics=h.el('metrics').textContent;
 for(const id of ['life-left','life-up','life-right','life-down']){click(h,id);checkGeometry(h);consistent(h);assert.deepEqual(board(h),cells);assert.equal(h.el('metrics').textContent,metrics);}
 assert.equal(h.frames.size,0);
});

test('all alive/dead neighbor counts show the rule that the actual next generation follows',async()=>{
 for(const alive of [0,1])for(let count=0;count<=8;count++){
  const h=await setup('?experiment=life');click(h,'mission-start');const [x,y]=position(h);
  for(const [dx,dy] of offsets.slice(0,count))toggle(h,x+dx,y+dy);
  if(alive)toggle(h,x,y);select(h,x,y);checkGeometry(h);
  const cell=consistent(h);assert.equal(cell.alive,alive);assert.equal(cell.neighbors,count);
  assert.match(next(h),new RegExp('^下一代：'+({born:'诞生',survive:'存活',lonely:'消失',crowded:'消失',empty:'仍空'}[cell.rule])));
  const expected=lifeStep(board(h),48,32);click(h,'step');assert.deepEqual(board(h),expected);assert.equal(board(h)[y*48+x],cell.next);consistent(h);checkGeometry(h);
 }
});

test('corners and every edge mark actual opposite-side neighbors at all supported view sizes',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');
 for(const [x,y] of [[0,0],[47,0],[0,31],[47,31],[0,16],[47,16],[24,0],[24,31]]){
  select(h,x,y);
  for(const [width,height] of [[600,414],[259,240],[284.5,260.25],[900,414]]){h.resize(width,height);checkGeometry(h);consistent(h);assert.equal(board(h).some(Boolean),false);}
 }
 assert.match(help(h),/边缘相连，邻居可能在画面对侧/);
 h.resize(600,414);toggle(h,47,31);toggle(h,0,31);toggle(h,47,0);select(h,0,0);
 assert.equal(consistent(h).neighbors,3);assert.match(next(h),/下一代：诞生/);click(h,'step');assert.equal(board(h)[0],1);checkGeometry(h);
});

test('animation hides only neighbor outlines and updates the next-state reading quietly',async()=>{
 const h=await setup('?experiment=life');click(h,'guide-start');checkGeometry(h);
 const reading=h.el('life-next-reading'),description=h.el('life-neighbor-help');let writes=0,helpWrites=0,value=reading.textContent,descriptionValue=description.textContent;
 Object.defineProperty(reading,'textContent',{get:()=>value,set:v=>{writes++;value=v;}});
 Object.defineProperty(description,'textContent',{get:()=>descriptionValue,set:v=>{helpWrites++;descriptionValue=v;}});
 h.resize(259,240);h.resize(600,414);assert.equal(writes,0);assert.equal(helpWrites,0);
 click(h,'pause');assert.equal(neighbors(h).length,0);assert.match(help(h),/^暂停可显示/);const message=h.el('announcement').textContent;
 h.tick(0);for(let t=50;t<=500;t+=50)h.tick(t);
 assert.equal(neighbors(h).length,0);consistent(h);assert.equal(h.el('announcement').textContent,message);assert.equal(helpWrites,1);
 click(h,'pause');checkGeometry(h);assert.equal(h.frames.size,0);assert.match(help(h),/^虚线框/);
});

test('a running pointer contact exposes context without editing or consuming recovery before a tap',async()=>{
 const h=await setup('?experiment=life','',false);const before=board(h),metrics=h.el('metrics').textContent,url=location.href;
 assert.equal(neighbors(h).length,0);const c=h.el('canvas'),event={type:'pointerdown',pointerId:7,isPrimary:true,button:0,buttons:1,clientX:50,clientY:50};
 c.handlers.pointerdown(event);checkGeometry(h);consistent(h);assert.deepEqual(board(h),before);assert.equal(h.el('metrics').textContent,metrics);assert.equal(h.frames.size,0);assert.equal(location.href,url);
 assert.equal(h.el('life-undo-edit').getAttribute('aria-disabled'),'true');
 c.handlers.pointercancel({...event,type:'pointercancel'});c.handlers.click({...event,detail:1});assert.deepEqual(board(h),before);checkGeometry(h);
});

test('solid comparison markers retain priority and neighbor context follows the displayed generation',async()=>{
 const h=await setup('?experiment=life');click(h,'guide-start');const before=board(h);click(h,'life-test');
 assert.equal(h.el('life-return').hidden,false);checkGeometry(h);consistent(h);
 const boxes=rectangles(h),lastNeighbor=neighbors(h).at(-1).index,births=boxes.filter(r=>r.color==='#82d6dd');assert.ok(births.length>0);
 for(const birth of births){assert.ok(birth.index>lastNeighbor);assert.deepEqual(birth.dash,[]);}
 const result=h.el('life-test-result').textContent;click(h,'life-left');checkGeometry(h);consistent(h);assert.equal(h.el('life-test-result').textContent,result);
 click(h,'life-return');assert.deepEqual(board(h),before);checkGeometry(h);consistent(h);
});

test('drawing recovery, clear recovery and rewind restore exact neighbor context',async()=>{
 const h=await setup('?experiment=life');click(h,'step');const before={drawing:h.drawing(),next:next(h),selection:h.el('life-selection').textContent};
 toggle(h,0,0);checkGeometry(h);click(h,'life-undo-edit');assert.deepEqual(h.drawing(),before.drawing);assert.equal(next(h),before.next);
 click(h,'clear');consistent(h);click(h,'life-undo-clear');assert.deepEqual(h.drawing(),before.drawing);assert.equal(next(h),before.next);
 click(h,'step');consistent(h);click(h,'life-back');assert.deepEqual(h.drawing(),before.drawing);assert.equal(next(h),before.next);assert.equal(h.el('life-selection').textContent,before.selection);
});

test('tabs, fixed parameter links, presets and history keep this guidance Life-only and current',async()=>{
 const h=await setup('?experiment=life');click(h,'guide-start');h.key('ArrowLeft');const before={drawing:h.drawing(),next:next(h)};
 await click(h,'share');const shared=h.el('share-link').value;
 for(const index of [0,2,3,4]){h.tabs[index].handlers.click();assert.equal(h.el('life-touch').hidden,true);assert.equal(neighbors(h).length,0);h.tabs[1].handlers.click();assert.equal(h.el('life-touch').hidden,false);assert.deepEqual(h.drawing(),before.drawing);assert.equal(next(h),before.next);}
 h.navigate('#observation-title');checkGeometry(h);consistent(h);assert.equal(new URL(shared).searchParams.has('at'),false);
 for(const value of ['glider','blinker','pulsar']){h.el('preset-select').handlers.change({target:{value}});click(h,'load-preset');checkGeometry(h);consistent(h);}
 h.navigate('?experiment=life&rate=3&density=20#canvas');checkGeometry(h);consistent(h);
 click(h,'pause');h.motion.change({matches:true});checkGeometry(h);assert.equal(h.frames.size,0);h.motion.change({matches:false});assert.equal(h.frames.size,0);
});

test('rule inspection never completes an exploration or rewrites earned notebook evidence',async()=>{
 const h=await setup('?experiment=life');click(h,'mission-start');
 for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle']){click(h,id);consistent(h);checkGeometry(h);}
 assert.match(next(h),/下一代：存活/);assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const note=h.el('field-notes-list').innerHTML,result=h.el('mission-result').textContent;
 click(h,'life-right');click(h,'step');h.resize(259,240);consistent(h);assert.equal(h.el('field-notes-list').innerHTML,note);assert.equal(h.el('mission-result').textContent,result);
});

test('guidance is quiet, wrapped and available before the instrument drawer with no new action',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const start=html.indexOf('<p id="life-next-reading"'),end=html.indexOf('<div><button id="life-left"',start),section=html.slice(start,end);
 assert.ok(start>0&&start<html.indexOf('id="instrument-summary"'));assert.ok(end>start);
 assert.match(section,/<p id="life-next-reading" aria-live="off"><\/p>/);assert.match(section,/<small id="life-neighbor-help" aria-live="off"><\/small>/);
 assert.doesNotMatch(section,/button|tabindex|role="status"|aria-live="polite"|aria-live="assertive"/);
 assert.match(html,/aria-label="逐格绘制生命图案" aria-describedby="life-neighbor-help"/);
 for(const id of ['life-next-reading','life-neighbor-help'])assert.match(css,new RegExp('\\.life-touch #'+id+'\\{[^}]*overflow-wrap:anywhere'));
 assert.match(css,/@media\(max-width:720px\)\{\.life-touch #life-neighbor-help\{font-size:13px\}\}/);
});
