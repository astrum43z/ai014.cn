import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const field=h=>h.el('walk-count');
function type(h,value){field(h).value=String(value);field(h).handlers.input({target:field(h)});}
function seek(h,steps){type(h,steps);click(h,'walk-seek');}
function key(h,key='Enter',extra={}){let prevented=false;field(h).handlers.keydown({key,preventDefault(){prevented=true},...extra});return prevented;}
const steps=h=>Number(h.el('metrics').textContent.match(/· (\d+) 步/)[1]);
const saved=h=>({url:location.href,writes:h.writes(),link:h.el('share-link').value,hidden:h.el('share-link').hidden,summary:h.el('saved-observation-reading').textContent,recovery:h.el('observation-undo-status').textContent});
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),steps:steps(h),status:h.el('status').textContent,frames:[...h.frames.keys()],saved:saved(h),notes:h.el('field-notes-list').innerHTML});
// Independent BigInt recurrence and lattice choices, without importing walk.js.
function oracle(seed,bias,n){
 let rng=BigInt(seed);const positions=Array.from({length:256},()=>[0,0]),path=[[0,0]];
 for(let step=0;step<n;step++){
  for(const p of positions){rng=(1664525n*rng+1013904223n)%4294967296n;const u=Number(rng)/4294967296;if(u<.25+bias/200)p[0]++;else if(u<.5)p[0]--;else if(u<.75)p[1]++;else p[1]--;}
  path.push([...positions[0]]);
 }
 const center=n*bias/200,extentX=Math.max(30,Math.abs(center)+30,...[...positions,...path].map(p=>Math.abs(p[0]-center)+6)),extentY=Math.max(30,...[...positions,...path].map(p=>Math.abs(p[1])+6));
 const scale=Math.min((600-48)/(extentX*2),(414-76)/(extentY*2)),project=p=>[300+(p[0]-center)*scale,207-p[1]*scale];
 const meanX=positions.reduce((s,p)=>s+p[0],0)/256,meanY=positions.reduce((s,p)=>s+p[1],0)/256;
 const spread=Math.sqrt(positions.reduce((s,p)=>s+p[0]**2+p[1]**2,0)/256-meanX**2-meanY**2);
 return {positions:positions.map(project),path:path.map(project),spread,distance:Math.hypot(...positions[0])};
}
function check(h,n,seed=14,bias=0){
 const expected=oracle(seed,bias,n),drawing=h.drawing();
 const sameGeometry=(actual,wanted,message)=>{
  assert.equal(actual.length,wanted.length,message);
  for(let i=0;i<wanted.length;i++)for(let axis=0;axis<2;axis++)assert.ok(Math.abs(actual[i][axis]-wanted[i][axis])<1e-10,message+` at ${i}/${axis}`);
 };
 assert.equal(steps(h),n);assert.equal(h.frames.size,0);
 // Equivalent projection arithmetic can differ by an ulp; lattice differences
 // are whole units. Exact draw-to-draw equality is checked separately below.
 sameGeometry(drawing.filter(c=>c[0]==='arc'&&c[3]===2.1).map(c=>c.slice(1,3)),expected.positions,'every projected walker matches the independent sequence');
 const start=drawing.findIndex(c=>c[0]==='strokeStyle'&&c[1]==='#e7eee177');
 const commands=drawing.slice(start+1),end=commands.findIndex(c=>c[0]==='stroke');
 sameGeometry(commands.slice(0,end).filter(c=>c[0]==='moveTo'||c[0]==='lineTo').map(c=>c.slice(1)),expected.path,'the complete representative path is reproduced');
 assert.equal(h.el('observation-a').textContent,'实测散开程度 · '+expected.spread.toFixed(2));
 assert.equal(h.el('walk-displacement').textContent,expected.distance.toFixed(2)+' 步长');
 assert.equal(h.el('walk-back').getAttribute('aria-disabled'),String(n===16));
 assert.equal(h.el('walk-step-one').getAttribute('aria-disabled'),String(n===512));
}

for(const [seed,bias,n] of [[14,0,137],[1,0,16],[99,25,512],[23,7,257]])test(`exact Walk destination ${n} matches all walkers and path (${seed}, ${bias})`,async()=>{
 const h=await setup(`?experiment=walk&seed=${seed}&bias=${bias}&at=v1,73`);h.el('walk-seek').focus();seek(h,n);check(h,n,seed,bias);
 assert.equal(document.activeElement,h.el('walk-seek'));assert.match(h.el('announcement').textContent,new RegExp(`已暂停；${n} 步`));
});
test('reverse and forward destinations reproduce the exact next random draw and the existing +16 batch',async()=>{
 const h=await setup('?experiment=walk&seed=37&bias=13&at=v1,257'),original=h.drawing();click(h,'walk-step-one');const next=h.drawing();
 seek(h,16);seek(h,257);assert.deepEqual(h.drawing(),original);click(h,'walk-step-one');assert.deepEqual(h.drawing(),next);check(h,258,37,13);
 seek(h,512);seek(h,257);assert.deepEqual(h.drawing(),original);click(h,'step');check(h,273,37,13);
});
test('Enter retains field focus and normalizes surrounding whitespace and leading zeros',async()=>{
 const h=await setup('?experiment=walk');field(h).focus();type(h,' 00137 ');assert.equal(key(h),true);check(h,137);assert.equal(field(h).value,'137');assert.equal(document.activeElement,field(h));
});
test('typing is independent of the running model and incomplete targets survive redraws and world visits',async()=>{
 const h=await setup('?experiment=walk');click(h,'pause');h.tick(0);h.tick(50);const before=state(h);type(h,'13');assert.deepEqual(state(h),before);
 h.tick(100);assert.equal(steps(h),20);assert.equal(field(h).value,'13');h.resize(320,240);h.setDpr(2);h.loseContext();h.restoreContext();assert.equal(field(h).value,'13');assert.equal(h.el('status').textContent,'运行中');
 click(h,'tab-fractal');click(h,'tab-walk');assert.equal(field(h).value,'13');assert.equal(steps(h),20);
});
test('seek interrupts running and clears only its partial animation batch before Continue',async()=>{
 const h=await setup('?experiment=walk');click(h,'pause');h.tick(0);h.tick(50);h.tick(100);h.tick(150);assert.equal(steps(h),20);
 seek(h,137);check(h,137);click(h,'pause');h.tick(90000);h.tick(90050);assert.equal(steps(h),137);h.tick(90100);assert.equal(steps(h),141);click(h,'pause');check(h,141);
});
test('submitting the current step pauses without changing the seeded observation',async()=>{
 const h=await setup('?experiment=walk&at=v1,137'),original=h.drawing();click(h,'pause');seek(h,137);assert.deepEqual(h.drawing(),original);check(h,137);seek(h,137);assert.deepEqual(h.drawing(),original);
});
test('invalid destinations leave running progress, pending frame, fixed link and recovery untouched',async()=>{
 const h=await setup('?experiment=walk&at=v1,73');click(h,'step');click(h,'observation-return');click(h,'pause');h.tick(0);h.tick(50);
 for(const value of ['', ' ', '15','513','137.5','137.0','1e2','0x100','-137','+137','Infinity','NaN','１３７','137 steps','9007199254740993']){
  type(h,value);const before=state(h);click(h,'walk-seek');assert.deepEqual(state(h),before,value);assert.equal(field(h).getAttribute('aria-invalid'),'true');assert.equal(h.el('walk-seek-error').hidden,false);assert.equal(document.activeElement,field(h));assert.match(h.el('announcement').textContent,/16 到 512/);
 }
 type(h,137);assert.equal(field(h).getAttribute('aria-invalid'),'false');assert.equal(h.el('walk-seek-error').hidden,true);assert.equal(h.el('walk-seek-error').textContent,'');click(h,'walk-seek');check(h,137);
});
test('held, composing and modified Enter do not replay; text editing remains native',async()=>{
 const h=await setup('?experiment=walk');type(h,137);const before=state(h),announcement=h.el('announcement').textContent;assert.equal(key(h,'Enter',{repeat:true}),true);
 for(const extra of [{isComposing:true},{keyCode:229},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true}])assert.equal(key(h,'Enter',extra),false);
 for(const k of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','Escape',' ','a'])assert.equal(key(h,k),false);
 assert.deepEqual(state(h),before);assert.equal(h.el('announcement').textContent,announcement);assert.equal(key(h),true);check(h,137);
 let prevented=false;h.el('walk-seek').handlers.keydown({key:'Enter',repeat:true,preventDefault(){prevented=true}});assert.equal(prevented,true);
 for(const e of [{key:'Enter',repeat:false},{key:' ',repeat:true}])h.el('walk-seek').handlers.keydown({...e,preventDefault(){assert.fail('native activation suppressed')}});
});
test('the fixed observation and one-level return undo survive arbitrary destinations',async()=>{
 const h=await setup('?experiment=walk&seed=23&bias=7&at=v1,73');await click(h,'share');seek(h,137);const previous=h.drawing();click(h,'observation-return');const fixed=saved(h);
 seek(h,257);assert.deepEqual(saved(h),fixed);click(h,'observation-undo');assert.deepEqual(h.drawing(),previous);check(h,137,23,7);
 seek(h,257);click(h,'observation-return');check(h,73,23,7);click(h,'observation-undo');check(h,257,23,7);
});
test('explicit Share captures a destination while a pending older copy stays scoped to its original checkpoint',async()=>{
 const pending=[];Object.defineProperty(globalThis,'navigator',{value:{clipboard:{writeText:text=>new Promise(resolve=>pending.push({text,resolve}))}},configurable:true});
 try{const h=await setup('?experiment=walk&at=v1,73'),old=click(h,'share');seek(h,137);assert.match(pending[0].text,/at=v1%2C73/);const newer=click(h,'share');assert.match(pending[1].text,/at=v1%2C137/);pending[0].resolve();await old;assert.match(h.el('share-link').value,/at=v1%2C137/);pending[1].resolve();await newer;check(h,137);assert.match(location.href,/at=v1%2C137/);}finally{delete globalThis.navigator;}
});
test('retained worlds and hidden controls cannot alter another experiment',async()=>{
 const h=await setup('?experiment=walk');seek(h,257);const drawing=h.drawing();
 for(const mode of ['orbit','life','wave','fractal']){click(h,'tab-'+mode);const before=h.drawing(),metrics=h.el('metrics').textContent;click(h,'walk-seek');assert.deepEqual(h.drawing(),before);assert.equal(h.el('metrics').textContent,metrics);click(h,'tab-walk');check(h,257);assert.deepEqual(h.drawing(),drawing);assert.equal(field(h).value,'257');}
});
test('parameters, presets, reset, comparison checkpoints and history retain existing semantics',async()=>{
 const h=await setup('?experiment=walk&at=v1,73');seek(h,137);h.el('seed').handlers.input({target:{value:'99'}});check(h,16,99);seek(h,257);check(h,257,99);
 h.el('bias').handlers.input({target:{value:'25'}});check(h,16,99,25);seek(h,137);check(h,137,99,25);click(h,'reset');check(h,16,99,25);
 h.el('preset-select').handlers.change({target:{value:'unbiased'}});click(h,'load-preset');check(h,16,99);seek(h,137);click(h,'walk-64');check(h,64,99);click(h,'walk-16');check(h,16,99);
 h.navigate('?experiment=walk&seed=14&bias=0&at=v1,89');check(h,89);seek(h,137);check(h,137);
});
test('the 512-step limit, rewind, forward, resume and seek back from the cap stay usable',async()=>{
 const h=await setup('?experiment=walk');seek(h,512);check(h,512);assert.equal(h.el('pause').getAttribute('aria-disabled'),'true');click(h,'walk-back');check(h,511);click(h,'walk-step-one');check(h,512);
 seek(h,137);check(h,137);assert.equal(h.el('pause').getAttribute('aria-disabled'),'false');click(h,'pause');assert.equal(h.frames.size,1);
});
test('reflow, density, canvas recovery and visibility never change the deterministic destination',async()=>{
 const h=await setup('?experiment=walk&seed=23&bias=7');seek(h,137);const original=h.drawing();h.resize(259,240);seek(h,512);h.resize(334.5,260.2);seek(h,257);h.setDpr(3);h.loseContext();h.restoreContext();h.setHidden(true);h.setVisible(false);seek(h,137);assert.equal(steps(h),137);
 h.setHidden(false);h.setVisible(true);h.setDpr(1);h.resize(600,414);assert.deepEqual(h.drawing(),original);check(h,137,23,7);
});
test('seek can supply discovery evidence but only an explicit successful Check records it',async()=>{
 const h=await setup('?experiment=walk');click(h,'mission-start');seek(h,16);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');seek(h,63);click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'0 / 5');seek(h,64);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const notes=h.el('field-notes-list').innerHTML,result=h.el('mission-result').textContent;seek(h,512);seek(h,16);assert.equal(h.el('field-notes-list').innerHTML,notes);assert.equal(h.el('mission-result').textContent,result);
});
test('intentional Walk and Fractal batch held repeats remain available',async()=>{
 const h=await setup('?experiment=walk');seek(h,137);for(const repeat of [false,true]){h.key('ArrowRight',{repeat});}check(h,169);
 for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('batch repeat suppressed')}});click(h,'step');}check(h,201);
 click(h,'tab-fractal');for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('batch repeat suppressed')}});click(h,'step');}assert.match(h.el('metrics').textContent,/500 个点/);
});
test('near-canvas destination has a label, numeric hint, quiet error and wrapping touch-sized controls',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.ok(html.indexOf('id="walk-count"')<html.indexOf('id="instruments"'));assert.match(html,/<label for="walk-count">目标步数<\/label>/);assert.match(html,/<input id="walk-count" type="text" inputmode="numeric"[^>]*aria-describedby="walk-seek-help walk-seek-error"/);assert.match(html,/<button id="walk-seek" type="button" aria-describedby="walk-seek-help">定位并暂停<\/button>/);assert.match(html,/<p id="walk-seek-error" aria-live="off" hidden>/);assert.match(html,/输入 16–512 的整数/);
 assert.match(css,/\.walk-seek>div\{display:flex;flex-wrap:wrap/);assert.match(css,/\.walk-seek input\{[^}]*min-width:0;min-height:44px/);assert.match(css,/\.walk-seek input\[aria-invalid="true"\]/);
});
