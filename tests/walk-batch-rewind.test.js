import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
const click=(h,id='walk-back-batch')=>h.el(id).handlers.click();
const steps=h=>Number(h.el('metrics').textContent.match(/· (\d+) 步/)[1]);
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),status:h.el('status').textContent,frames:[...h.frames.keys()],url:location.href,writes:h.writes(),message:h.el('announcement').textContent,notes:h.el('field-notes-list').innerHTML});
function key(h,extra={}){let prevented=false;h.key('ArrowLeft',{preventDefault(){prevented=true;},...extra});return prevented;}
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
 assert.equal(h.el('walk-back-batch').getAttribute('aria-disabled'),String(n===16));
 assert.equal(h.el('walk-step-one').getAttribute('aria-disabled'),String(n===512));
}


for(const [seed,bias,n] of [[14,0,32],[1,0,17],[99,25,512],[23,7,257],[37,13,31]])test(`batch rewind reaches the independent ensemble at ${Math.max(16,n-16)} (${seed}, ${bias})`,async()=>{
 const h=await setup(`?experiment=walk&seed=${seed}&bias=${bias}&at=v1,${n}`);h.el('walk-back-batch').focus();click(h);check(h,Math.max(16,n-16),seed,bias);
 assert.equal(document.activeElement,h.el('walk-back-batch'));assert.notEqual(h.el('walk-back-batch').disabled,true);assert.match(h.el('announcement').textContent,/已暂停/);
});
test('both inputs rewind all 26 supported biases and forward reproduces the exact sequence',async()=>{
 for(let bias=0;bias<=25;bias++){
  const h=await setup(`?experiment=walk&seed=51&bias=${bias}&at=v1,137`),initial=h.drawing();
  assert.equal(key(h),true);check(h,121,51,bias);click(h,'step');assert.deepEqual(h.drawing(),initial);
  click(h);check(h,121,51,bias);h.key('ArrowRight');assert.deepEqual(h.drawing(),initial);
  click(h,'walk-step-one');const next=h.drawing();click(h);click(h,'step');assert.deepEqual(h.drawing(),next);
 }
});
test('held backward batches are intentional, clamp at 16, and held forward batches still work',async()=>{
 const h=await setup('?experiment=walk&at=v1,73');
 for(const n of [57,41,25,16]){assert.equal(key(h,{repeat:true}),true);check(h,n);}
 const before=state(h);key(h,{repeat:true});click(h);assert.deepEqual(state(h),before);
 for(const n of [32,48,64]){h.key('ArrowRight',{repeat:true});check(h,n);}
 assert.equal(h.el('walk-back-batch').handlers.keydown,undefined);
 click(h,'step');check(h,80);h.key('Home');check(h,16);
});
test('unavailable lower-bound action leaves even a running initial experiment untouched',async()=>{
 const h=await setup('?experiment=walk');
 for(const running of [false,true]){if(running)click(h,'pause');const before=state(h);click(h);key(h);assert.deepEqual(state(h),before);}
});
test('rewind cancels running and clears fractional batch timing before continuation',async()=>{
 const h=await setup('?experiment=walk&at=v1,73');click(h,'pause');h.tick(0);h.tick(50);const original=location.href;
 click(h);check(h,57);assert.equal(location.href,original);click(h,'pause');h.tick(50000);h.tick(50050);assert.equal(steps(h),57);
 h.tick(50100);click(h,'pause');check(h,61);
});
test('upper cap becomes runnable after rewind and partial forward still stops exactly at 512',async()=>{
 const h=await setup('?experiment=walk&at=v1,505');click(h);check(h,489);click(h,'step');check(h,505);click(h,'step');check(h,512);
 assert.equal(h.el('pause').getAttribute('aria-disabled'),'true');key(h);check(h,496);assert.equal(h.el('pause').getAttribute('aria-disabled'),'false');
});
test('composition, modified and unrelated keys stay native and inert',async()=>{
 const h=await setup('?experiment=walk&at=v1,137'),before=state(h);
 for(const extra of [{isComposing:true},{keyCode:229},{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true}])assert.equal(key(h,extra),false);
 for(const name of ['ArrowUp','ArrowDown','Enter',' ','Tab','End'])h.key(name,{preventDefault(){assert.fail('unrelated key intercepted');}});
 assert.deepEqual(state(h),before);
});
test('fixed shared observation and its one-level return recovery survive batches',async()=>{
 const h=await setup('?experiment=walk&at=v1,73');click(h,'step');const previous=h.drawing();click(h,'observation-return');
 const summary=h.el('saved-observation-reading').textContent,url=location.href;click(h);check(h,57);
 assert.equal(location.href,url);assert.equal(h.el('saved-observation-reading').textContent,summary);click(h,'observation-undo');check(h,89);assert.deepEqual(h.drawing(),previous);
 await click(h,'share');assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),'v1,89');
});
test('older asynchronous copying cannot overwrite rewind feedback',async()=>{
 let resolve;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(r=>resolve=r)}}});
 try{const h=await setup('?experiment=walk&at=v1,73'),pending=click(h,'share');click(h);const message=h.el('announcement').textContent;resolve();await pending;assert.equal(h.el('announcement').textContent,message);check(h,57);assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),'v1,73');}finally{delete globalThis.navigator;}
});
test('retained targets, errors, focus and other worlds stay independent of batch replay',async()=>{
 const h=await setup('?experiment=walk&at=v1,73');h.el('walk-count').value='bad';click(h,'walk-seek');const error=h.el('walk-seek-error').textContent;
 h.el('canvas').focus();key(h);check(h,57);assert.equal(document.activeElement,h.el('canvas'));assert.equal(h.el('walk-count').value,'bad');assert.equal(h.el('walk-seek-error').textContent,error);
 for(const world of ['orbit','life','wave','fractal']){click(h,'tab-'+world);assert.equal(h.el('walk-back-batch').hidden,true);assert.equal(h.el('walk-batch-help').hidden,true);const before=state(h);click(h);assert.deepEqual(state(h),before);click(h,'tab-walk');check(h,57);assert.equal(h.el('walk-back-batch').hidden,false);assert.equal(h.el('walk-batch-help').hidden,false);}
});
test('reset, parameter changes, comparison buttons, history and presets refresh availability',async()=>{
 const h=await setup('?experiment=walk&at=v1,73');click(h,'reset');check(h,16);click(h,'walk-64');click(h);check(h,48);
 h.el('bias').handlers.input({target:{value:'25'}});check(h,16,14,25);h.el('seed').handlers.input({target:{value:'99'}});check(h,16,99,25);
 click(h,'walk-64');click(h);check(h,48,99,25);h.navigate('?experiment=walk&seed=3&bias=12&at=v1,257');click(h);check(h,241,3,12);
 h.el('preset-select').handlers.change({target:{value:'unbiased'}});click(h,'load-preset');check(h,16,3,0);click(h,'guide-start');check(h,16);
});
test('rewind alone earns no discovery and completed notes remain historical',async()=>{
 const h=await setup('?experiment=walk');click(h,'mission-start');click(h,'mission-check');click(h,'walk-64');click(h);check(h,48);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'step');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('field-notes-list').innerHTML;
 click(h);check(h,48);assert.equal(h.el('field-notes-list').innerHTML,notes);
});
test('resize, density, context, visibility and tab recovery preserve the exact replay',async()=>{
 const h=await setup('?experiment=walk&seed=99&bias=25&at=v1,257');click(h);check(h,241,99,25);const drawing=h.drawing(),message=h.el('announcement').textContent;
 h.resize(209,240);h.setDpr(2);h.loseContext();h.restoreContext();h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);h.resize(600,414);h.setDpr(1);
 assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('announcement').textContent,message);click(h);check(h,225,99,25);click(h,'step');assert.deepEqual(h.drawing(),drawing);
});
test('text-only startup supports the same batch without a canvas bitmap',async()=>{
 const h=await setup('?experiment=walk&at=v1,73','',true,1,false);click(h);assert.equal(steps(h),57);assert.equal(h.el('walk-back-batch').getAttribute('aria-disabled'),'false');key(h);assert.equal(steps(h),41);assert.equal(h.el('status').textContent,'画布未就绪');
});
test('native control, quiet help, canvas shortcut names and inherited wrapping stay discoverable',async()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<button id="walk-back-batch" aria-disabled="true" aria-describedby="walk-batch-help walk-step-reading" hidden>退回 16 步 −<\/button>/);
 assert.ok(html.indexOf('id="walk-back-batch"')<html.indexOf('id="reset"'));assert.match(html,/<p id="walk-batch-help" class="canvas-pause-help" hidden>/);assert.match(html,/余下不足 16 步时停在边界/);assert.match(html,/walk-batch=reverse-1/);
 assert.match(css,/\.stage-controls\{display:flex;flex-wrap:wrap/);assert.match(css,/\.stage-controls button\[aria-disabled="true"\]/);
 const h=await setup('?experiment=walk');assert.equal(h.el('canvas').getAttribute('aria-keyshortcuts'),'Escape ArrowLeft ArrowRight Home');assert.equal(h.el('canvas').getAttribute('aria-describedby'),'canvas-pause-help walk-batch-help');assert.match(h.el('hint').textContent,/← 退回 16 步/);
});
