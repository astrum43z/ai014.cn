import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const click=(h,id)=>h.el(id).handlers.click();
const snapshot=h=>({drawing:h.drawing(),frames:[...h.frames.keys()],writes:h.writes(),search:location.search,
 readings:['metrics','status','fractal-jump-reading','fractal-jump-note','fractal-touch-reading','fractal-choice-reading','fractal-gap-reading','mission-state','mission-result','announcement'].map(id=>h.el(id).textContent),
 notes:h.el('notes-text').value,draft:h.el('fractal-count').value,error:h.el('fractal-seek-error').textContent,invalid:h.el('fractal-count').getAttribute('aria-invalid'),
 link:h.el('share-link').value.split('#')[0],undo:h.el('observation-undo').getAttribute('aria-disabled'),drawer:h.el('instruments').open});
const roundtrip=h=>{const before=snapshot(h);for(const hash of ['#canvas','#fractal-jump','#canvas','#fractal-regions','#canvas']){h.navigate(location.search+hash);assert.deepEqual(snapshot(h),before);}};
function lastChoice(count,seed){let state=BigInt(seed);for(let i=0;i<count;i++)state=(state*1664525n+1013904223n)%4294967296n;return 'ABC'[Number(state*3n/4294967296n)];}
function check(h,count,seed=14,jump=50){assert.equal(h.el('fractal-jump-reading').textContent,`第 ${count} 点，抽中顶点 ${lastChoice(count,seed)}；向它前进 ${jump}%，余下 ${100-jump}%`);}

test('the last-jump reading has one native return before the choice statistics and next diagram',()=>{
 const section=html.match(/<section id="fractal-jump"[\s\S]*?<\/section>/)?.[0];assert.ok(section);
 assert.match(section,/<p id="fractal-jump-note"><\/p><a id="fractal-jump-view" class="return-to-canvas" href="#canvas">回到画布，查看这一步 ↑<\/a><p id="fractal-choice-reading">/);
 assert.equal((html.match(/id="fractal-jump-view"/g)||[]).length,1);
 assert.ok(section.indexOf('id="fractal-step"')<section.indexOf('id="fractal-jump-view"'));
 assert.match(section,/aria-labelledby="fractal-jump-title" hidden/);
 assert.match(html,/<canvas id="canvas" tabindex="0"/);
 assert.doesNotMatch(app,/fractal-jump-view/,'native return needs no new script, listener or state');
});

test('the native link retains a wrapping 44px target and dark-surface keyboard focus',()=>{
 const rule=css.match(/\.fractal-jump #fractal-jump-view\{([^}]+)\}/)?.[1];assert.ok(rule);
 for(const declaration of ['max-width:100%','white-space:normal','overflow-wrap:anywhere','font-size:13px','color:#d3f35b'])assert.ok(rule.includes(declaration));
 assert.match(css,/\.reading-nav a,\.return-to-canvas\{[^}]*min-height:44px/);
 assert.match(css,/a:focus-visible[^}]*outline:3px solid/);
 assert.match(css,/\.stage,\.instrument-drawer\{--focus-ring:var\(--focus-on-dark\)\}/);
 assert.match(html,/style\.css\?[^"\n]*&amp;jump-view=return-1/);
});

test('returning after an instrument step keeps the exact jump and its seeded continuation',async()=>{
 const h=await setup('?experiment=fractal&seed=23&jump=38&at=v1,731','#fractal-jump');h.el('instruments').open=true;
 click(h,'fractal-step');check(h,732,23,38);const next=h.drawing();roundtrip(h);
 click(h,'fractal-back');check(h,731,23,38);roundtrip(h);h.key('ArrowRight');check(h,732,23,38);assert.deepEqual(h.drawing(),next);
 assert.equal(h.el('instruments').open,true);
});

test('anchor history at both count boundaries never replays a checkpoint or resets the draft',async()=>{
 for(const count of [300,12000]){const h=await setup('?experiment=fractal&at=v1,'+count,'#fractal-jump');h.el('instruments').open=true;
 h.el('fractal-count').value='unfinished';click(h,'fractal-seek');const error=h.el('fractal-seek-error').textContent;roundtrip(h);check(h,count);
 assert.equal(h.el('fractal-seek-error').textContent,error);assert.equal(h.el('fractal-count').getAttribute('aria-invalid'),'true');
 if(count===12000){click(h,'fractal-step');check(h,count);}else{click(h,'fractal-step');check(h,301);}
 }
});

test('fixed observations and one-level return undo remain distinct from a reading return',async()=>{
 const h=await setup('?experiment=fractal&seed=99&jump=65&at=v1,1000','#fractal-jump');h.el('instruments').open=true;
 await click(h,'share');click(h,'fractal-step');check(h,1001,99,65);roundtrip(h);
 assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),'v1,1000');
 const prior=h.drawing();click(h,'observation-return');check(h,1000,99,65);roundtrip(h);click(h,'observation-undo');check(h,1001,99,65);assert.deepEqual(h.drawing(),prior);
 roundtrip(h);assert.equal(new URL(location.href).searchParams.get('at'),'v1,1000');
});

test('a pending share retains its captured count while native reading navigation keeps the newer jump',async()=>{
 const h=await setup('?experiment=fractal&at=v1,731','#fractal-jump');let resolve;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(r=>resolve=r)}}});
 try{const pending=click(h,'share');click(h,'fractal-step');roundtrip(h);const message=h.el('announcement').textContent;resolve();await pending;check(h,732);assert.equal(h.el('announcement').textContent,message);assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),'v1,731');}finally{delete globalThis.navigator;}
});

test('running navigation preserves its frame chain; returning to an onscreen canvas resumes the same sequence',async()=>{
 const h=await setup('?experiment=fractal&seed=23&jump=38','#fractal-jump',false);h.tick(0);h.tick(50);h.tick(100);const count=Number(h.el('metrics').textContent.split(' ')[0]);assert.ok(count>300);roundtrip(h);assert.equal(h.frames.size,1);
 h.setVisible(false);const before=snapshot(h);h.navigate(location.search+'#canvas');assert.deepEqual(snapshot(h),before);h.setVisible(true);assert.equal(h.frames.size,1);h.tick(1000);h.tick(1050);h.tick(1100);assert.ok(Number(h.el('metrics').textContent.split(' ')[0])>count);
 click(h,'pause');roundtrip(h);assert.equal(h.frames.size,0);
});

test('reflow, context recovery, retained worlds and real query changes keep native navigation separate',async()=>{
 const h=await setup('?experiment=fractal&seed=23&jump=38&at=v1,731','#fractal-jump');click(h,'fractal-step');h.el('fractal-count').value='805';
 for(const size of [[259,240],[171,240],[455.5,281.75],[600,414]]){h.resize(...size);roundtrip(h);check(h,732,23,38);}
 h.setDpr(2);h.loseContext();h.restoreContext();roundtrip(h);check(h,732,23,38);
 for(const world of ['orbit','life','wave','walk']){click(h,'tab-'+world);click(h,'tab-fractal');roundtrip(h);check(h,732,23,38);}
 assert.equal(h.el('fractal-count').value,'805');h.navigate('?experiment=fractal&seed=1&jump=70&at=v1,1000#canvas');check(h,1000,1,70);roundtrip(h);
});

test('text-only rendering and collapsed dimensions leave the reading return non-destructive',async()=>{
 const h=await setup('?experiment=fractal&at=v1,731','#fractal-jump',true,1,false);click(h,'fractal-step');roundtrip(h);check(h,732);
 h.resize(0,0);roundtrip(h);check(h,732);h.setContextReady(true);click(h,'canvas-retry');h.resize(600,414);roundtrip(h);check(h,732);
});

test('discoveries, fresh single stepping and intentional held batches remain explicit',async()=>{
 const h=await setup('?experiment=fractal','#fractal-jump');click(h,'mission-start');click(h,'fractal-1000');roundtrip(h);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');h.el('seed').handlers.input({target:{value:'15'}});click(h,'fractal-1000');roundtrip(h);click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const notes=h.el('notes-text').value;click(h,'fractal-step');check(h,1001,15);roundtrip(h);assert.equal(h.el('notes-text').value,notes);
 for(const world of ['fractal','walk']){if(world==='walk')click(h,'tab-walk');for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional held batch changed');}});click(h,'step');}roundtrip(h);}
 assert.equal(h.el('notes-text').value,notes);
});
