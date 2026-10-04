import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
const click=(h,id)=>h.el(id).handlers.click();
const choose=(h,value)=>{h.el('preset-select').handlers.change({target:{value}});click(h,'load-preset');};
function countWork(action){
 const counts={reduceCalls:0,reduceCells:0,someCalls:0,someCells:0};
 const original={reduce:Uint8Array.prototype.reduce,some:Uint8Array.prototype.some};
 for(const name of ['reduce','some'])Uint8Array.prototype[name]=function(callback,...args){
  if(this.length!==1536)return original[name].call(this,callback,...args);
  counts[name+'Calls']++;
  return original[name].call(this,(...values)=>{counts[name+'Cells']++;return callback(...values);},...args);
 };
 try{action();return counts;}finally{for(const name in original)Uint8Array.prototype[name]=original[name];}
}
const none={reduceCalls:0,reduceCells:0,someCalls:0,someCells:0};
const one={reduceCalls:1,reduceCells:1536,someCalls:0,someCells:0};
function board(h){
 const {width,height}=h.el('canvas').getBoundingClientRect(),cw=width/48,ch=height/32,cells=new Uint8Array(1536);let color;
 for(const [name,...args] of h.drawing()){
  if(name==='fillStyle')color=args[0];
  if(name==='fillRect'&&color==='#d3f35b')cells[Math.round((args[1]-.6)/ch)*48+Math.round((args[0]-.6)/cw)]=1;
 }return cells;
}
function verifyPopulation(h){
 let count=0;for(const value of board(h))if(value)count++;
 assert.match(h.el('metrics').textContent,new RegExp(` · ${count} 个活格子$`));
 assert.equal(h.el('observation-a').textContent,'活细胞 · '+count);
 assert.equal(h.el('observation-b').textContent,'占用率 · '+(count/1536*100).toFixed(1)+'%');
 for(const id of ['life-previous-live','life-next-live'])assert.equal(h.el(id).getAttribute('aria-disabled'),String(count===0));
 if(h.el('life-return').hidden)assert.equal(h.el('life-test-result').textContent,`当前 ${count} 个活格 · 目标 4 个。画好后，检验它能否保持原样。`);
 return count;
}
const snapshot=h=>({drawing:h.drawing(),texts:['metrics','observation-a','observation-b','observation-c','life-test-result','history-caption','life-turnover','life-rewind-status','life-transition-legend'].map(id=>h.el(id).textContent),plot:['history-line','history-current'].map(id=>({...h.el(id).attributes})),url:location.href,notes:h.el('field-notes-list').innerHTML});
function tap(h,x,y){const r=h.el('canvas').getBoundingClientRect();h.el('canvas').handlers.click({detail:0,clientX:(x+.5)*r.width/48,clientY:(y+.5)*r.height/32});}
function pointer(h,type,x,y){h.el('canvas').handlers[type]({type,pointerId:7,isPrimary:true,button:0,buttons:type==='pointerup'?0:1,clientX:(x+.5)*600/48,clientY:(y+.5)*414/32});}

test('120 unchanged empty Life redraws share the recorded population without rescanning the board',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');const before=snapshot(h),message=h.el('announcement').textContent;h.el('life-next-live').focus();
 assert.deepEqual(countWork(()=>{for(let i=0;i<120;i++)h.resize(600,414);}),none);
 assert.deepEqual(snapshot(h),before);assert.equal(verifyPopulation(h),0);assert.equal(h.el('announcement').textContent,message);assert.equal(document.activeElement,h.el('life-next-live'));
});
test('each new observed board is counted once and all population consumers agree',async()=>{
 const h=await setup('?experiment=life');verifyPopulation(h);
 for(const preset of ['glider','blinker','pulsar']){
  assert.deepEqual(countWork(()=>choose(h,preset)),{...none,reduceCalls:2,reduceCells:3072});verifyPopulation(h);
  for(let i=0;i<12;i++){assert.deepEqual(countWork(()=>click(h,'step')),one);verifyPopulation(h);}
  assert.deepEqual(countWork(()=>h.resize(600,414)),none);
 }
 assert.deepEqual(countWork(()=>click(h,'life-challenge-start')),one);assert.equal(verifyPopulation(h),0);
 for(const [x,y] of [[0,0],[47,31],[1,0],[0,1]]){assert.deepEqual(countWork(()=>tap(h,x,y)),one);verifyPopulation(h);}
 assert.deepEqual(countWork(()=>click(h,'reset')),one);assert.equal(verifyPopulation(h),10);
});
test('cursor, focus, parameter and display redraws reuse the population without suppressing painting',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');click(h,'step');const before=snapshot(h),draws=h.drawCount(),message=h.el('announcement').textContent;
 assert.deepEqual(countWork(()=>{
  for(const id of ['life-right','life-left','life-down','life-up','life-next-live','life-previous-live','life-center'])click(h,id);
  h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();
  h.el('rate').handlers.input({target:{value:'20'}});h.el('density').handlers.input({target:{value:'60'}});
  for(const size of [[233,240],[334.5,260.25],[0,0],[600,414]])h.resize(...size);
  h.setDpr(2);h.setDpr(3);h.setDpr(1);h.loseContext();h.restoreContext();
 }),none);
 assert.ok(h.drawCount()>draws+10);verifyPopulation(h);assert.equal(h.el('metrics').textContent,before.texts[0]);
 // Only explicit controls, not an idle redraw, may replace action feedback.
 const latest=h.el('announcement').textContent;h.resize(600,414);assert.equal(h.el('announcement').textContent,latest);assert.notEqual(latest,message);
});
test('rewind and every recovery boundary refresh a changed board without stale counts',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');click(h,'step');click(h,'step');const before=snapshot(h);
 click(h,'step');assert.deepEqual(countWork(()=>click(h,'life-back')),none);assert.deepEqual(snapshot(h),before);verifyPopulation(h);
 h.key('Enter');verifyPopulation(h);assert.deepEqual(countWork(()=>h.key('z',{ctrlKey:true})),none);assert.deepEqual(snapshot(h),before);
 click(h,'clear');assert.equal(verifyPopulation(h),0);assert.deepEqual(countWork(()=>click(h,'life-undo-clear')),none);assert.deepEqual(snapshot(h),before);
 click(h,'life-test');verifyPopulation(h);assert.equal(h.el('life-return').hidden,false);assert.deepEqual(countWork(()=>click(h,'life-return')),none);assert.deepEqual(snapshot(h),before);
 for(const mode of ['orbit','wave','fractal','walk']){click(h,'tab-'+mode);click(h,'tab-life');verifyPopulation(h);assert.deepEqual(snapshot(h),before);assert.deepEqual(countWork(()=>h.resize(600,414)),none);}
});
test('in-place drawing and erasing refresh the shared count, including no-op stroke segments',async()=>{
 const h=await setup('?experiment=life');click(h,'clear');pointer(h,'pointerdown',2,4);
 assert.deepEqual(countWork(()=>pointer(h,'pointermove',5,4)),one);assert.equal(verifyPopulation(h),4);
 assert.deepEqual(countWork(()=>pointer(h,'pointermove',8,4)),one);assert.equal(verifyPopulation(h),7);
 assert.deepEqual(countWork(()=>pointer(h,'pointermove',5,4)),none);assert.equal(verifyPopulation(h),7);pointer(h,'pointerup',5,4);
 click(h,'life-undo-edit');assert.equal(verifyPopulation(h),0);tap(h,0,0);assert.equal(verifyPopulation(h),1);
 click(h,'life-erase');pointer(h,'pointerdown',0,0);assert.deepEqual(countWork(()=>pointer(h,'pointermove',1,0)),one);assert.equal(verifyPopulation(h),0);
 assert.deepEqual(countWork(()=>pointer(h,'pointermove',4,0)),none);pointer(h,'pointerup',4,0);click(h,'life-undo-edit');assert.equal(verifyPopulation(h),1);
});
test('history growth and trim keep first-draw transitions, repeat readings and population consistent',async()=>{
 const h=await setup('?experiment=life');choose(h,'pulsar');
 for(let i=1;i<=245;i++){
  assert.deepEqual(countWork(()=>click(h,'step')),one);verifyPopulation(h);const before=snapshot(h);
  assert.deepEqual(countWork(()=>h.resize(600,414)),none);assert.deepEqual(snapshot(h),before);
 }
 for(let i=0;i<119;i++){assert.deepEqual(countWork(()=>click(h,'life-back')),none);verifyPopulation(h);}
 assert.equal(h.el('life-back').getAttribute('aria-disabled'),'true');assert.deepEqual(countWork(()=>click(h,'life-back')),none);
});
test('animation counts only observed generations and preserves pause, visibility and reduced-motion gates',async()=>{
 const h=await setup('?experiment=life','',false);choose(h,'blinker');h.tick(0);
 const result=countWork(()=>{for(let i=1;i<=20;i++)h.tick(i*50);});assert.deepEqual(result,{...none,reduceCalls:8,reduceCells:8*1536});verifyPopulation(h);assert.match(h.el('metrics').textContent,/第 8 代/);
 const before=snapshot(h);h.setHidden(true);assert.equal(h.frames.size,0);h.setHidden(false);h.tick(90000);assert.deepEqual(snapshot(h),before);h.setVisible(false);assert.equal(h.frames.size,0);h.setVisible(true);h.tick(180000);assert.deepEqual(snapshot(h),before);
 h.motion.change({matches:true});assert.equal(h.frames.size,0);assert.deepEqual(countWork(()=>h.resize(600,414)),none);assert.deepEqual(countWork(()=>click(h,'step')),one);verifyPopulation(h);
});
test('read reuse preserves explicit discoveries, pending sharing, retained drafts and intentional batch repeats',async()=>{
 const h=await setup('?experiment=life','#canvas');click(h,'mission-start');for(const point of [[2,2],[3,2],[2,3],[3,3]])tap(h,...point);verifyPopulation(h);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('field-notes-list').innerHTML;
 let resolve;Object.defineProperty(globalThis,'navigator',{value:{clipboard:{writeText:()=>new Promise(r=>resolve=r)}},configurable:true});const sharing=click(h,'share'),url=location.href;click(h,'life-right');h.resize(233,240);resolve();await sharing;assert.equal(location.href,url);assert.equal(h.el('field-notes-list').innerHTML,notes);
 click(h,'tab-fractal');h.el('fractal-count').value='777';h.el('step').handlers.keydown({key:'Enter',repeat:true,preventDefault(){assert.fail('intentional batch repeat changed');}});click(h,'step');assert.match(h.el('metrics').textContent,/400 个点/);
 click(h,'tab-walk');h.key('ArrowRight',{repeat:true});assert.match(h.el('metrics').textContent,/32 步/);click(h,'tab-fractal');assert.equal(h.el('fractal-count').value,'777');click(h,'tab-life');verifyPopulation(h);assert.equal(h.el('field-notes-list').innerHTML,notes);
});
test('the fresh entry keeps the existing history recorder, with no new population cache or model mutation',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(html,/app\.js\?[^"\n]+&amp;population=shared-1/);assert.match(app,/function renderLifeInspector\(count\)/);assert.match(app,/function renderLifeChallenge\(count\)/);
 assert.equal([...app.matchAll(/recordLifeHistory\(cells,generation,lifeHistory\)/g)].length,1);assert.doesNotMatch(app,/cells\.some\(Boolean\)/);
});
