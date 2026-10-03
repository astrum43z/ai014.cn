import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const choose=(h,value)=>{h.el('preset-select').handlers.change({target:{value}});click(h,'load-preset');};
const legend=h=>h.el('life-transition-legend');
function board(h){
 const {width,height}=h.el('canvas').getBoundingClientRect(),cw=width/48,ch=height/32,cells=new Uint8Array(1536);let color;
 for(const [name,...args] of h.drawing()){
  if(name==='fillStyle')color=args[0];
  if(name==='fillRect'&&color==='#d3f35b')cells[Math.round((args[1]-.6)/ch)*48+Math.round((args[0]-.6)/cw)]=1;
 }return cells;
}
// Independent simultaneous B3/S23 oracle; it does not call the app's stepper.
function nextBoard(cells){
 return cells.map((v,i)=>{let n=0;const x=i%48,y=Math.floor(i/48);
  for(const dy of [-1,0,1])for(const dx of [-1,0,1])if(dx||dy)n+=cells[((y+dy+32)%32)*48+(x+dx+48)%48];
  return Number(n===3||(v===1&&n===2));
 });
}
function marks(h){
 let color,stack=[],path=[];const births=[],deaths=[];
 for(const [name,...args] of h.drawing()){
  if(name==='save')stack.push(color);if(name==='restore')color=stack.pop();
  if(name==='strokeStyle')color=args[0];if(name==='beginPath')path=[];
  if(name==='moveTo'||name==='lineTo')path.push([name,...args]);
  if(name==='strokeRect'&&color==='#82d6dd')births.push(args);
  if(name==='stroke'&&color==='#ffac86')deaths.push(path);
 }return {births,deaths};
}
function assertTransition(h,before,after,generation){
 assert.deepEqual(board(h),after);
 const {width,height}=h.el('canvas').getBoundingClientRect(),cw=width/48,ch=height/32,births=[],deaths=[];
 for(let i=0;i<1536;i++)if(before[i]!==after[i]){
  const x=(i%48)*cw,y=Math.floor(i/48)*ch;
  if(after[i])births.push([x+.7,y+.7,Math.max(1,cw-1.4),Math.max(1,ch-1.4)]);
  else deaths.push([['moveTo',x+2,y+2],['lineTo',x+cw-2,y+ch-2],['moveTo',x+cw-2,y+2],['lineTo',x+2,y+ch-2]]);
 }
 assert.deepEqual(marks(h),{births,deaths});assert.equal(legend(h).hidden,false);
 assert.equal(legend(h).textContent,`暂停对比 · 第 ${generation-1} → ${generation} 代：`+(births.length+deaths.length?`蓝框新生 ${births.length} 格，橙 × 消失 ${deaths.length} 格；黄绿填色才是当前活格。`:'没有格子新生或消失，图案保持不变。'));
 return {births,deaths};
}
function tap(h,x,y){const r=h.el('canvas').getBoundingClientRect();h.el('canvas').handlers.click({detail:0,clientX:(x+.5)*r.width/48,clientY:(y+.5)*r.height/32});}
function clearDraw(h,points){click(h,'clear');for(const [x,y] of points)tap(h,x,y);}
const snapshot=h=>({board:board(h),marks:marks(h),text:legend(h).textContent,hidden:legend(h).hidden,metrics:h.el('metrics').textContent,history:h.el('history-line').getAttribute('points')});

test('ordinary blinker steps mark the exact births and deaths even with unchanged population',async()=>{
 const h=await setup('?experiment=life');choose(h,'blinker');assert.equal(legend(h).hidden,true);
 let before=board(h);
 for(let g=1;g<=4;g++){
  const after=nextBoard(before);click(h,'step');const marks=assertTransition(h,before,after,g);
  assert.equal(marks.births.length,2);assert.equal(marks.deaths.length,2);
  assert.match(h.el('announcement').textContent,/蓝框新生 2 格，橙 × 消失 2 格/);
  const drawing=h.drawing();h.resize(600,414);assert.deepEqual(h.drawing(),drawing,'first draw and unchanged redraw use the same previous generation');before=after;
 }
});

test('still life, extinction and an empty board do not invent transition markers',async()=>{
 const h=await setup('?experiment=life');
 for(const points of [[[2,2],[3,2],[2,3],[3,3]],[[4,4]],[]]){
  clearDraw(h,points);let before=board(h);
  for(let g=1;g<=2;g++){const after=nextBoard(before);click(h,'step');assertTransition(h,before,after,g);before=after;}
 }
});

test('edge and corner transitions follow wrapped model positions at narrow and fractional sizes',async()=>{
 const h=await setup('?experiment=life');
 for(const points of [[[47,0],[0,0],[1,0]],[[0,31],[0,0],[0,1]],[[47,31],[0,31],[47,0],[0,0]],[[0,0],[1,0],[2,0],[1,1],[10,9]]]){
  clearDraw(h,points);const before=board(h),after=nextBoard(before);click(h,'step');
  for(const [w,hh] of [[259,240],[284.5,260.25],[600,414],[1200,900]]){h.resize(w,hh);assertTransition(h,before,after,1);}
 }
});

test('pulsar and glider changes agree with an independent stepper through repeated generations',async()=>{
 for(const preset of ['pulsar','glider']){
  const h=await setup('?experiment=life');choose(h,preset);let before=board(h);
  for(let g=1;g<=16;g++){const after=nextBoard(before);click(h,'step');assertTransition(h,before,after,g);before=after;}
 }
});

test('birth frames have dark casing while the selected cell remains the topmost solid outline',async()=>{
 const h=await setup('?experiment=life');choose(h,'blinker');click(h,'step');const commands=h.drawing();
 const births=commands.map((row,i)=>row[0]==='strokeStyle'&&row[1]==='#82d6dd'?i:-1).filter(i=>i>=0);
 assert.equal(births.length,2);
 for(const i of births){
  assert.deepEqual(commands.slice(i-3,i),[['strokeStyle','#122e29'],['lineWidth',3],commands[i+2]]);
  assert.deepEqual(commands[i+1],['lineWidth',1.5]);assert.equal(commands[i+2][0],'strokeRect');
 }
 const lastRect=commands.findLastIndex(row=>row[0]==='strokeRect');assert.equal(commands[lastRect-2][1],'#ffac86');assert.ok(lastRect>births.at(-1));
 const luminance=hex=>hex.match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
 assert.ok(contrast('82d6dd','122e29')>7);assert.ok(contrast('d3f35b','122e29')>7);
});

test('rewind restores the corresponding visual transition and respects the retained-history boundary',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');click(h,'step');const first=snapshot(h);click(h,'step');const second=snapshot(h);
 click(h,'life-back');assert.deepEqual(snapshot(h),first);click(h,'step');assert.deepEqual(snapshot(h),second);
 for(let i=2;i<124;i++)click(h,'step');
 for(let g=124;g>5;g--)click(h,'life-back');assert.equal(legend(h).hidden,true);assert.deepEqual(marks(h),{births:[],deaths:[]});
 const before=board(h),after=nextBoard(before);click(h,'step');assertTransition(h,before,after,6);
});

test('edits and replacement boards hide old marks; undo restores their exact comparison',async()=>{
 const replacements=[h=>h.key('Enter'),h=>click(h,'life-toggle'),h=>tap(h,4,4),h=>click(h,'clear'),h=>click(h,'reset'),h=>choose(h,'glider'),h=>click(h,'preset'),h=>click(h,'guide-start'),h=>click(h,'mission-start'),h=>click(h,'life-challenge-start'),h=>h.navigate('?experiment=life&rate=3&density=20')];
 for(const replace of replacements){const h=await setup('?experiment=life');choose(h,'blinker');click(h,'step');replace(h);assert.equal(legend(h).hidden,true);assert.deepEqual(marks(h),{births:[],deaths:[]});}
 const h=await setup('?experiment=life');choose(h,'pulsar');click(h,'step');const before=snapshot(h);
 click(h,'clear');click(h,'life-undo-clear');assert.deepEqual(snapshot(h),before);
 h.key('Enter');h.key('z',{ctrlKey:true});assert.deepEqual(snapshot(h),before);
});

test('running hides comparison marks and pausing measures the latest adjacent generation quietly',async()=>{
 const h=await setup('?experiment=life&rate=20','',false);choose(h,'blinker');let before=board(h),after;
 const message=h.el('announcement').textContent;h.tick(0);
 for(let g=1;g<=5;g++){after=nextBoard(before);h.tick(g*50);assert.deepEqual(board(h),after);assert.equal(legend(h).hidden,true);assert.deepEqual(marks(h),{births:[],deaths:[]});if(g<5)before=after;}
 assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,1);
 click(h,'pause');assertTransition(h,before,after,5);assert.equal(h.frames.size,0);
 click(h,'pause');assert.equal(legend(h).hidden,true);assert.deepEqual(marks(h),{births:[],deaths:[]});
});

test('quiet redraws, density, interruption and parameters do not change the model or repeat the legend text',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');click(h,'step');const before=snapshot(h),message=h.el('announcement').textContent;
 let text=legend(h).textContent,writes=0;Object.defineProperty(legend(h),'textContent',{get:()=>text,set:v=>{text=v;writes++;}});
 h.el('canvas').focus();h.resize(259,240);h.setDpr(2);h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();
 h.el('rate').handlers.input({target:{value:'20'}});h.el('density').handlers.input({target:{value:'60'}});h.loseContext();h.restoreContext();h.resize(600,414);
 assert.deepEqual(snapshot(h),before);assert.equal(writes,0);assert.equal(h.el('announcement').textContent,message);assert.equal(h.frames.size,0);assert.equal(document.activeElement,h.el('canvas'));
});

test('special challenge retains its own legend and returns to the ordinary comparison without duplicate text',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');click(h,'step');const before=snapshot(h),cells=board(h),after=nextBoard(cells);
 click(h,'life-test');assert.equal(legend(h).hidden,true);assert.equal(h.el('life-trial-legend').hidden,false);assert.deepEqual(board(h),after);assert.ok(marks(h).births.length>0);
 click(h,'life-return');assert.deepEqual(snapshot(h),before);
 click(h,'life-test');click(h,'life-back');assert.deepEqual(snapshot(h),before);
});

test('retained worlds, parameter-only sharing and discovery checks preserve the visual evidence',async()=>{
 const h=await setup('?experiment=life');choose(h,'blinker');click(h,'step');const before=snapshot(h);
 await click(h,'share');const shared=h.el('share-link').value;assert.equal(new URL(shared).searchParams.has('at'),false);
 for(const world of ['orbit','wave','fractal','walk']){click(h,'tab-'+world);assert.equal(legend(h).hidden,true);click(h,'tab-life');assert.deepEqual(snapshot(h),before);}
 h.navigate(location.search+'#observation-title');assert.deepEqual(snapshot(h),before);assert.equal(h.el('notes-count').textContent,'0 / 5');
 click(h,'mission-start');for(const [x,y] of [[2,2],[3,2],[2,3],[3,3]])tap(h,x,y);click(h,'step');assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
});

test('a quiet wrapping caption follows the canvas without another control or color-only meaning',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<\/canvas><p id="life-transition-legend" aria-live="off" hidden><\/p>/);
 assert.match(css,/#life-transition-legend\{[^}]*font-size:14px;line-height:1\.7;overflow-wrap:anywhere/);
 assert.equal((html.match(/id="life-transition-legend"/g)||[]).length,1);
});
