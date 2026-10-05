import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const text=(h,id)=>h.el(id).textContent;
const field=(h,m)=>h.el(m+'-count');
const fill=(h,m)=>click(h,m+'-count-current-fill');
const type=(h,m,value)=>{field(h,m).value=String(value);field(h,m).handlers.input();};
const seek=(h,m,value)=>{type(h,m,value);click(h,m+'-seek');};
const key=(el,extra={})=>{let prevented=false;el.handlers.keydown?.({key:'Enter',repeat:false,preventDefault(){prevented=true;},...extra});return prevented;};
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),frames:[...h.frames.keys()],status:text(h,'status'),pause:text(h,'pause'),metrics:text(h,'metrics'),url:location.href,writes:h.writes(),saved:text(h,'saved-observation-reading'),undo:text(h,'observation-undo-status'),link:h.el('share-link').value,notes:h.el('notes-text').value});
const cases=[{mode:'fractal',min:300,max:12000,n:513,batch:100,frame:100,one:'fractal-forward',unit:'点',parameter:'jump',value:53},{mode:'walk',min:16,max:512,n:89,batch:16,frame:4,one:'walk-step-one',unit:'步',parameter:'bias',value:7}];
const current=(c,n)=>`当前观测 · ${n} ${c.unit}`;
// Independent integer random recurrence, with projection matching only the view.
function modelGeometry(mode,seed,value,n){
 let rng=BigInt(seed);const next=()=>{rng=(1664525n*rng+1013904223n)%4294967296n;return Number(rng)/4294967296;};
 if(mode==='fractal'){
  let x=0,y=-1;const vertices=[[0,-1],[-Math.sqrt(3)/2,.5],[Math.sqrt(3)/2,.5]],scale=Math.min(600/2.1,414/1.85),result=[];
  for(let i=0;i<n;i++){const [vx,vy]=vertices[Math.floor(next()*3)];x+=(vx-x)*value/100;y+=(vy-y)*value/100;result.push([300+Math.fround(x)*scale,207+scale*.25+Math.fround(y)*scale]);}
  return result;
 }
 const walkers=Array.from({length:256},()=>[0,0]),path=[[0,0]];
 for(let i=0;i<n;i++){for(const p of walkers){const r=next();if(r<.25+value/200)p[0]++;else if(r<.5)p[0]--;else if(r<.75)p[1]++;else p[1]--;}path.push([...walkers[0]]);}
 const center=n*value/200,extentX=Math.max(30,Math.abs(center)+30,...[...walkers,...path].map(p=>Math.abs(p[0]-center)+6)),extentY=Math.max(30,...[...walkers,...path].map(p=>Math.abs(p[1])+6));
 const scale=Math.min((600-48)/(extentX*2),(414-76)/(extentY*2));return walkers.map(([x,y])=>[300+(x-center)*scale,207-y*scale]);
}
function checkGeometry(h,c,n,seed=23,value=c.value){
 const actual=h.drawing().filter(x=>c.mode==='fractal'?x[0]==='rect':x[0]==='arc'&&x[3]===2.1).map(x=>x.slice(1,3)),expected=modelGeometry(c.mode,seed,value,n);
 assert.equal(actual.length,expected.length);
 for(let i=0;i<expected.length;i++)for(let axis=0;axis<2;axis++)assert.ok(Math.abs(actual[i][axis]-expected[i][axis])<1e-10,`${c.mode} sample ${i}/${axis}`);
 assert.equal(text(h,c.mode+'-seek-current'),current(c,n));
}
for(const c of cases){const m=c.mode,query=`?experiment=${m}&seed=23&${c.parameter}=${c.value}&at=v1,${c.n}`;
 test(`${m}: fill selects the exact current count and clears only its obsolete validation error`,async()=>{
  const h=await setup(query);let selects=0;field(h,m).select=()=>selects++;
  for(const n of [c.min,c.n,c.max]){seek(h,m,n);seek(h,m,'unfinished');const before=state(h);fill(h,m);assert.deepEqual(state(h),before);assert.equal(field(h,m).value,String(n));assert.equal(field(h,m).getAttribute('aria-invalid'),'false');assert.equal(h.el(m+'-seek-error').hidden,true);assert.equal(text(h,m+'-seek-error'),'');assert.equal(document.activeElement,field(h,m));checkGeometry(h,c,n);}
  assert.equal(selects,3);assert.match(text(h,'announcement'),/仅替换目标输入，实验状态未改变/);
 });
 test(`${m}: a captured count replays every sample and the same next random draw`,async()=>{
  const h=await setup(query),original=h.drawing();fill(h,m);click(h,c.one);const next=h.drawing();click(h,'step');assert.equal(field(h,m).value,String(c.n));assert.equal(key(field(h,m)),true);assert.deepEqual(h.drawing(),original);checkGeometry(h,c,c.n);click(h,c.one);assert.deepEqual(h.drawing(),next);checkGeometry(h,c,c.n+1);
 });
 test(`${m}: fill leaves running state, partial animation timing and the next frame untouched`,async()=>{
  const h=await setup(query);click(h,'pause');h.tick(0);h.tick(50);const before=state(h);fill(h,m);assert.deepEqual(state(h),before);h.tick(100);assert.equal(field(h,m).value,String(c.n));const actual={drawing:h.drawing(),metrics:text(h,'metrics'),frames:h.frames.size};checkGeometry(h,c,c.n+c.frame);
  const reference=await setup(query);click(reference,'pause');reference.tick(0);reference.tick(50);reference.tick(100);assert.deepEqual({drawing:reference.drawing(),metrics:text(reference,'metrics'),frames:reference.frames.size},actual);
 });
 test(`${m}: held Enter cannot refill or submit after focus moves, while native keys and modifiers remain`,async()=>{
  const h=await setup(query),button=h.el(m+'-count-current-fill');assert.equal(key(button,{repeat:true}),true);
  for(const e of [{},{key:' '},{key:' ',repeat:true},{key:'Tab'},{key:'ArrowRight'}])assert.equal(key(button,e),false);
  fill(h,m);type(h,m,c.n+1);const before=state(h);assert.equal(key(field(h,m),{repeat:true}),true);
  for(const e of [{isComposing:true},{keyCode:229},{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true},{key:'ArrowLeft'},{key:'Home'},{key:'End'},{key:'Escape'}])assert.equal(key(field(h,m),e),false);
  assert.deepEqual(state(h),before);assert.equal(key(field(h,m)),true);checkGeometry(h,c,c.n+1);
 });
 test(`${m}: target retains its value through animation, parameters, reset and other worlds`,async()=>{
  const h=await setup(query);fill(h,m);type(h,m,'draft');click(h,'pause');h.tick(0);h.tick(100);click(h,'step');
  for(const other of ['orbit','life','wave','fractal','walk'].filter(x=>x!==m)){click(h,'tab-'+other);click(h,'tab-'+m);}
  h.el(c.parameter).handlers.input({target:{value:String(c.value+1)}});click(h,'reset');assert.equal(field(h,m).value,'draft');fill(h,m);assert.equal(field(h,m).value,String(c.min));
 });
 test(`${m}: inactive fill cannot change another world, either draft, error, focus or announcement`,async()=>{
  const h=await setup(query);seek(h,m,'bad');
  for(const other of ['orbit','life','wave','fractal','walk'].filter(x=>x!==m)){click(h,'tab-'+other);h.el('tab-'+other).focus();const before=state(h),announcement=text(h,'announcement');fill(h,m);assert.deepEqual(state(h),before);assert.equal(text(h,'announcement'),announcement);assert.equal(document.activeElement,h.el('tab-'+other));assert.equal(field(h,m).value,'bad');assert.equal(field(h,m).getAttribute('aria-invalid'),'true');}
 });
 test(`${m}: fixed checkpoints, return undo and history stay independent of captured drafts`,async()=>{
  const h=await setup(query),original=h.drawing();click(h,'step');const later=h.drawing();click(h,'observation-return');const before=state(h);fill(h,m);assert.deepEqual(state(h),before);assert.deepEqual(h.drawing(),original);click(h,'observation-undo');assert.deepEqual(h.drawing(),later);assert.equal(field(h,m).value,String(c.n));fill(h,m);assert.equal(field(h,m).value,String(c.n+c.batch));assert.match(location.href,new RegExp(`v1%2C${c.n}`));h.navigate(`?experiment=${m}&at=v1,${c.min}`);assert.equal(field(h,m).value,String(c.n+c.batch));fill(h,m);assert.equal(field(h,m).value,String(c.min));
 });
 test(`${m}: pending copy and share retain captured checkpoints and cannot replace fill feedback`,async()=>{
  const pending=[];Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:value=>new Promise(resolve=>pending.push({value,resolve}))}}});
  try{const h=await setup(query),copy=click(h,'observation-copy');click(h,'step');fill(h,m);const message=text(h,'announcement');assert.match(pending[0].value,new RegExp(`v1%2C${c.n}`));pending[0].resolve();await copy;assert.equal(text(h,'announcement'),message);const share=click(h,'share');click(h,'step');fill(h,m);const newer=text(h,'announcement');assert.match(pending[1].value,new RegExp(`v1%2C${c.n+c.batch}`));pending[1].resolve();await share;assert.equal(text(h,'announcement'),newer);assert.equal(field(h,m).value,String(c.n+2*c.batch));assert.match(text(h,'saved-observation-reading'),new RegExp(String(c.n+c.batch)));}finally{delete globalThis.navigator;}
 });
 test(`${m}: fill works through simulated display interruptions without changing recovery or progress`,async()=>{
  const h=await setup(query);click(h,'pause');h.tick(0);h.tick(50);h.setVisible(false);h.setHidden(true);h.loseContext();h.resize(0,0);h.setDpr(2);const before=state(h);fill(h,m);assert.deepEqual(state(h),before);assert.equal(field(h,m).value,String(c.n));h.resize(600,414);h.restoreContext();h.setHidden(false);h.setVisible(true);h.tick(90000);h.tick(90050);checkGeometry(h,c,c.n+c.frame);assert.equal(field(h,m).value,String(c.n));
 });
 test(`${m}: text-only startup can capture a model count and retain it after canvas recovery`,async()=>{
  const h=await setup(query,'',true,1,false),before=state(h);fill(h,m);assert.deepEqual(state(h),before);assert.equal(field(h,m).value,String(c.n));h.setContextReady(true);click(h,'canvas-retry');checkGeometry(h,c,c.n);assert.equal(field(h,m).value,String(c.n));
 });
 test(`${m}: fill supplies no discovery, and intentional primary/batch repeats remain available`,async()=>{
  const h=await setup(`?experiment=${m}`);click(h,'mission-start');fill(h,m);assert.equal(text(h,'notes-count'),'0 / 5');
  if(m==='walk'){click(h,'mission-check');click(h,'walk-64');fill(h,m);assert.equal(text(h,'notes-count'),'0 / 5');click(h,'mission-check');}
  else{click(h,'fractal-1000');fill(h,m);assert.equal(text(h,'notes-count'),'0 / 5');click(h,'mission-check');h.el('seed').handlers.input({target:{value:'15'}});click(h,'fractal-1000');fill(h,m);assert.equal(text(h,'notes-count'),'0 / 5');click(h,'mission-check');}
  assert.equal(text(h,'notes-count'),'1 / 5');const notes=h.el('notes-text').value;fill(h,m);assert.equal(h.el('notes-text').value,notes);
  for(const id of ['step',m+'-back-batch'])for(const repeat of [false,true]){assert.equal(key(h.el(id),{repeat}),false);click(h,id);}assert.equal(h.el('notes-text').value,notes);
 });
}

test('both native current-count buttons sit beside the existing wrapping editors with clear draft-only help',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 for(const c of cases){const m=c.mode;assert.match(html,new RegExp(`<button id="${m}-count-current-fill" type="button" aria-controls="${m}-count" aria-describedby="${m}-seek-help">填入当前${m==='fractal'?'点数':'步数'}</button><button id="${m}-seek"`));assert.ok(html.indexOf(`id="${m}-count-current-fill"`)<html.indexOf('id="instruments"'));const help=html.match(new RegExp(`<small id="${m}-seek-help">(.*?)</small>`))[1];assert.match(help,/替换并选中目标/);assert.match(help,/不暂停或改变实验/);assert.match(help,/当前种子/);assert.match(css,new RegExp(`\\.${m}-seek>div\\{display:flex;flex-wrap:wrap`));}
 assert.match(html,/count-draft=current-1/);
});
