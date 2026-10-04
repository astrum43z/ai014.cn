import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
const click=(h,id)=>h.el(id).handlers.click();
const field=h=>h.el('fractal-count');
function type(h,value){field(h).value=String(value);field(h).handlers.input({target:field(h)});}
function seek(h,count){type(h,count);click(h,'fractal-seek');}
function key(h,key='Enter',extra={}){let prevented=false;field(h).handlers.keydown({key,preventDefault(){prevented=true},...extra});return prevented;}
const count=h=>Number(h.el('metrics').textContent.match(/^\d+/)[0]);
const saved=h=>({url:location.href,writes:h.writes(),link:h.el('share-link').value,hidden:h.el('share-link').hidden,summary:h.el('saved-observation-reading').textContent,recovery:h.el('observation-undo-status').textContent});
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),count:count(h),status:h.el('status').textContent,frames:[...h.frames.keys()],saved:saved(h),notes:h.el('field-notes-list').innerHTML});
// Independent BigInt recurrence, Float32 storage and viewport transform.
function points(seed,jump,n){let rng=BigInt(seed),x=0,y=-1;const vertices=[[0,-1],[-Math.sqrt(3)/2,.5],[Math.sqrt(3)/2,.5]],scale=Math.min(600/2.1,414/1.85),result=[];for(let i=0;i<n;i++){rng=(1664525n*rng+1013904223n)%4294967296n;const vertex=Number(rng*3n/4294967296n),[vx,vy]=vertices[vertex];x+=(vx-x)*jump/100;y+=(vy-y)*jump/100;result.push(['rect',300+Math.fround(x)*scale,207+scale*.25+Math.fround(y)*scale,1.3,1.3]);}return result;}

for(const [seed,jump,target] of [[14,50,731],[1,35,300],[99,70,12000],[23,65,4567]])test(`exact destination ${target} preserves every seeded point (${seed}, ${jump})`,async()=>{
 const h=await setup(`?experiment=fractal&seed=${seed}&jump=${jump}&at=v1,913`);h.el('fractal-seek').focus();seek(h,target);
 assert.equal(count(h),target);assert.equal(h.frames.size,0);assert.equal(document.activeElement,h.el('fractal-seek'));
 assert.deepEqual(h.drawing().filter(x=>x[0]==='rect'),points(seed,jump,target));
 assert.match(h.el('announcement').textContent,new RegExp(`已暂停并定位到 ${target} 点`));
 assert.equal(h.el('fractal-back').getAttribute('aria-disabled'),String(target===300));
 assert.equal(h.el('fractal-forward').getAttribute('aria-disabled'),String(target===12000));
});
test('backward and forward seeks reproduce exact drawing and next random choice',async()=>{
 const h=await setup('?experiment=fractal&seed=37&jump=53&at=v1,2222');const original=h.drawing();click(h,'fractal-forward');const next=h.drawing();
 seek(h,300);seek(h,2222);assert.deepEqual(h.drawing(),original);click(h,'fractal-forward');assert.deepEqual(h.drawing(),next);
 seek(h,12000);seek(h,2222);assert.deepEqual(h.drawing(),original);click(h,'step');assert.deepEqual(h.drawing().filter(x=>x[0]==='rect'),points(37,53,2322));
});
test('Enter works from the field, retains focus and normalizes surrounding whitespace and leading zeros',async()=>{
 const h=await setup('?experiment=fractal');field(h).focus();type(h,' 00731 ');assert.equal(key(h),true);assert.equal(count(h),731);assert.equal(field(h).value,'731');assert.equal(document.activeElement,field(h));
});
test('typing and leaving a partial destination never changes or pauses a running experiment',async()=>{
 const h=await setup('?experiment=fractal');click(h,'pause');h.tick(0);h.tick(50);const before=state(h);
 field(h).focus();type(h,'73');assert.deepEqual(state(h),before);h.tick(100);assert.equal(count(h),400);assert.equal(field(h).value,'73');
 h.resize(320,240);h.setDpr(2);h.loseContext();h.restoreContext();assert.equal(field(h).value,'73');assert.equal(h.el('status').textContent,'运行中');
});
test('seek interrupts running animation and Continue does not reuse a partial animation batch',async()=>{
 const h=await setup('?experiment=fractal');click(h,'pause');h.tick(0);h.tick(50);h.tick(100);h.tick(150);assert.equal(count(h),400);
 seek(h,731);assert.equal(h.frames.size,0);click(h,'pause');h.tick(90000);h.tick(90050);assert.equal(count(h),731);h.tick(90100);assert.equal(count(h),831);
});
test('seeking the current count is an explicit pause, with an unchanged seeded drawing',async()=>{
 const h=await setup('?experiment=fractal&at=v1,731');const original=h.drawing();click(h,'pause');seek(h,731);assert.equal(h.frames.size,0);assert.deepEqual(h.drawing(),original);seek(h,731);assert.deepEqual(h.drawing(),original);
});
test('invalid destinations are rejected without changing physics, rendering, timing, fixed links or recovery',async()=>{
 const h=await setup('?experiment=fractal&at=v1,731');click(h,'step');click(h,'observation-return');click(h,'pause');h.tick(0);h.tick(50);
 for(const value of ['', ' ', '299','12001','731.5','731.0','7e2','0x300','-731','+731','Infinity','NaN','７３１','731 points','9007199254740993']){
  type(h,value);const before=state(h);click(h,'fractal-seek');assert.deepEqual(state(h),before,value);assert.equal(field(h).getAttribute('aria-invalid'),'true');assert.equal(h.el('fractal-seek-error').hidden,false);assert.equal(document.activeElement,field(h));assert.match(h.el('announcement').textContent,/300 到 12000/);
 }
 type(h,'731');assert.equal(field(h).getAttribute('aria-invalid'),'false');assert.equal(h.el('fractal-seek-error').hidden,true);assert.equal(h.el('fractal-seek-error').textContent,'');click(h,'fractal-seek');assert.equal(count(h),731);
});
test('held, modified and composing Enter cannot seek; ordinary input keys stay native',async()=>{
 const h=await setup('?experiment=fractal');type(h,731);const before=state(h),announcement=h.el('announcement').textContent;
 assert.equal(key(h,'Enter',{repeat:true}),true);
 for(const extra of [{isComposing:true},{keyCode:229},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true}])assert.equal(key(h,'Enter',extra),false);
 for(const k of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','Escape',' ','a'])assert.equal(key(h,k),false);
 assert.deepEqual(state(h),before);assert.equal(h.el('announcement').textContent,announcement);assert.equal(key(h),true);assert.equal(count(h),731);
 let prevented=false;h.el('fractal-seek').handlers.keydown({key:'Enter',repeat:true,preventDefault(){prevented=true}});assert.equal(prevented,true);
 for(const e of [{key:'Enter',repeat:false},{key:' ',repeat:true}])h.el('fractal-seek').handlers.keydown({...e,preventDefault(){assert.fail('native button activation was suppressed')}});
});
test('seeking leaves the fixed observation and its one-level return undo intact',async()=>{
 const h=await setup('?experiment=fractal&seed=23&jump=65&at=v1,731');await click(h,'share');seek(h,913);const old=h.drawing();click(h,'observation-return');const fixed=saved(h);seek(h,4567);assert.deepEqual(saved(h),fixed);click(h,'observation-undo');assert.deepEqual(h.drawing(),old);assert.equal(h.el('observation-undo').getAttribute('aria-disabled'),'true');
 seek(h,4567);click(h,'observation-return');assert.equal(count(h),731);click(h,'observation-undo');assert.equal(count(h),4567);
});
test('sharing after seek records that destination; pending older copying stays scoped to its original link',async()=>{
 const pending=[];Object.defineProperty(globalThis,'navigator',{value:{clipboard:{writeText:text=>new Promise(resolve=>pending.push({text,resolve}))}},configurable:true});
 try{const h=await setup('?experiment=fractal&at=v1,731');const old=click(h,'share');seek(h,913);assert.match(pending[0].text,/at=v1%2C731/);const newer=click(h,'share');assert.match(pending[1].text,/at=v1%2C913/);pending[0].resolve();await old;assert.match(h.el('share-link').value,/at=v1%2C913/);pending[1].resolve();await newer;assert.equal(count(h),913);assert.match(location.href,/at=v1%2C913/);}finally{delete globalThis.navigator;}
});
test('tab returns retain exact destination, while hidden-world activations cannot replace other work',async()=>{
 const h=await setup('?experiment=fractal');seek(h,4567);const drawing=h.drawing();
 for(const mode of ['orbit','life','wave','walk']){click(h,'tab-'+mode);const before=h.drawing(),metrics=h.el('metrics').textContent;click(h,'fractal-seek');assert.deepEqual(h.drawing(),before);assert.equal(h.el('metrics').textContent,metrics);click(h,'tab-fractal');assert.equal(count(h),4567);assert.deepEqual(h.drawing(),drawing);assert.equal(field(h).value,'4567');}
});
test('parameters, presets, resets and URL restoration retain existing sequence semantics',async()=>{
 const h=await setup('?experiment=fractal&at=v1,731');seek(h,913);h.el('seed').handlers.input({target:{value:'99'}});assert.equal(count(h),300);seek(h,913);assert.deepEqual(h.drawing().filter(x=>x[0]==='rect'),points(99,50,913));
 h.el('jump').handlers.input({target:{value:'70'}});seek(h,913);assert.deepEqual(h.drawing().filter(x=>x[0]==='rect'),points(99,70,913));click(h,'reset');assert.equal(count(h),300);
 h.el('preset-select').handlers.change({target:{value:'half'}});click(h,'load-preset');assert.equal(count(h),300);h.navigate('?experiment=fractal&seed=14&jump=50&at=v1,888');assert.equal(count(h),888);seek(h,913);assert.deepEqual(h.drawing().filter(x=>x[0]==='rect'),points(14,50,913));
});
test('seek remains deterministic after reflow, density, context, visibility and tab interruptions',async()=>{
 const h=await setup('?experiment=fractal&seed=23&jump=65');seek(h,731);const drawing=h.drawing();
 h.resize(259,240);seek(h,4567);h.resize(334.5,260.2);seek(h,731);h.setDpr(3);h.loseContext();h.restoreContext();h.setHidden(true);h.setVisible(false);seek(h,4567);assert.equal(count(h),4567);h.setHidden(false);h.setVisible(true);seek(h,731);h.setDpr(1);h.resize(600,414);assert.deepEqual(h.drawing(),drawing);assert.equal(h.frames.size,0);
});
test('seek can supply discovery evidence but only an explicit successful check records it',async()=>{
 const h=await setup('?experiment=fractal');click(h,'mission-start');seek(h,1000);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');h.el('seed').handlers.input({target:{value:'15'}});seek(h,1000);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('field-notes-list').innerHTML,result=h.el('mission-result').textContent;seek(h,4567);seek(h,300);assert.equal(h.el('field-notes-list').innerHTML,notes);assert.equal(h.el('mission-result').textContent,result);
});
test('existing intentional Fractal and Walk batch key repeats are unchanged',async()=>{
 const h=await setup('?experiment=fractal');for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('batch repeat suppressed')}});click(h,'step');}assert.equal(count(h),500);click(h,'tab-walk');h.key('ArrowRight');assert.match(h.el('metrics').textContent,/32 步/);h.key('ArrowRight',{repeat:true});assert.match(h.el('metrics').textContent,/48 步/);
});
test('destination control has a visible label, numeric keyboard hint, quiet error context and wrapping touch-sized layout',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.ok(html.indexOf('id="fractal-count"')<html.indexOf('id="instruments"'));assert.match(html,/<label for="fractal-count">目标点数<\/label>/);assert.match(html,/<input id="fractal-count" type="text" inputmode="numeric"[^>]*aria-describedby="fractal-seek-help fractal-seek-error"/);assert.match(html,/<button id="fractal-seek" type="button" aria-describedby="fractal-seek-help">定位并暂停<\/button>/);assert.match(html,/<p id="fractal-seek-error" aria-live="off" hidden>/);assert.match(html,/输入 300–12000 的整数/);assert.match(css,/\.fractal-seek>div\{display:flex;flex-wrap:wrap/);assert.match(css,/\.fractal-seek input\{[^}]*min-width:0;min-height:44px/);assert.match(css,/\.fractal-seek input\[aria-invalid="true"\]/);
});
