import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const click=(h,id)=>h.el(id).handlers.click();
const steps=h=>Number(h.el('metrics').textContent.match(/· (\d+) 步/)[1]);
const snapshot=h=>({drawing:h.drawing(),draws:h.drawCount(),frames:[...h.frames.keys()],writes:h.writes(),search:location.search,
 readings:['metrics','status','walk-step-reading','walk-length','walk-displacement','walk-cancellation','walk-distance-note','walk-choice-reading','walk-occupancy-reading','walk-comparison-reading','mission-state','mission-result','announcement'].map(id=>h.el(id).textContent),
 notes:h.el('notes-text').value,draft:h.el('walk-count').value,error:h.el('walk-seek-error').textContent,invalid:h.el('walk-count').getAttribute('aria-invalid'),
 link:h.el('share-link').value.split('#')[0],undo:h.el('observation-undo').getAttribute('aria-disabled'),drawer:h.el('instruments').open});
const roundtrip=h=>{const before=snapshot(h);for(const hash of ['#canvas','#instruments','#canvas','#walk-distance','#canvas']){h.navigate(location.search+hash);assert.deepEqual(snapshot(h),before);}};
// Independent integer RNG and direction counts for the representative walker.
// Still consume all 256 draws each generation, so the exact sequence is checked.
function oracle(seed,bias,n){let rng=BigInt(seed),x=0,y=0;const counts=[0,0,0,0];for(let step=0;step<n;step++)for(let i=0;i<256;i++){rng=(1664525n*rng+1013904223n)%4294967296n;if(i)continue;const u=Number(rng)/4294967296,index=u<.25+bias/200?0:u<.5?1:u<.75?2:3;counts[index]++;if(index===0)x++;if(index===1)x--;if(index===2)y++;if(index===3)y--;}return {x,y,counts};}
function check(h,n,seed=14,bias=0){const {x,y,counts:[right,left,up,down]}=oracle(seed,bias,n);assert.equal(steps(h),n);assert.equal(h.el('walk-length').textContent,n+' 步长');assert.equal(h.el('walk-displacement').textContent,Math.hypot(x,y).toFixed(2)+' 步长');assert.equal(h.el('walk-cancellation').textContent,`右 ${right} 步、左 ${left} 步 → ${x===0?'左右抵消':`净向${x>0?'右':'左'} ${Math.abs(x)} 步`}；上 ${up} 步、下 ${down} 步 → ${y===0?'上下抵消':`净向${y>0?'上':'下'} ${Math.abs(y)} 步`}。`);}

test('one native canvas return follows the Walk path explanation before the probability bars',()=>{
 const section=html.match(/<section id="walk-distance"[\s\S]*?<\/section>/)?.[0];assert.ok(section);
 assert.match(section,/<\/small><a id="walk-distance-view" class="return-to-canvas" href="#canvas">回到画布，对照路径与直线 ↑<\/a><div class="walk-choices"/);
 assert.equal((html.match(/id="walk-distance-view"/g)||[]).length,1);
 assert.ok(section.indexOf('id="walk-distance-note"')<section.indexOf('id="walk-distance-view"'));
 assert.match(section,/aria-labelledby="walk-distance-title" hidden/);
 assert.equal((section.match(/<(?:a|button|input|select|textarea)\b/g)||[]).length,1,'first native keyboard destination inside these instruments');
 assert.match(html,/<canvas id="canvas" tabindex="0"/);assert.doesNotMatch(app,/walk-distance-view/,'no new scripted navigation or model action');
});
test('the link wraps with a 44px target and the established dark-surface keyboard focus',()=>{
 const rule=css.match(/\.walk-distance #walk-distance-view\{([^}]+)\}/)?.[1];assert.ok(rule);
 for(const declaration of ['max-width:100%','white-space:normal','overflow-wrap:anywhere','font-size:13px','color:#d3f35b'])assert.ok(rule.includes(declaration));
 assert.match(css,/\.reading-nav a,\.return-to-canvas\{[^}]*min-height:44px/);assert.match(css,/a:focus-visible[^}]*outline:3px solid/);
 assert.match(css,/\.stage,\.instrument-drawer\{--focus-ring:var\(--focus-on-dark\)\}/);assert.match(html,/style\.css\?[^"\n]*&amp;walk-view=return-1/);
});
for(const [seed,bias,n] of [[14,0,137],[1,0,16],[99,25,512],[23,7,257]])test(`native reading history preserves seeded path and exact continuation (${seed}, ${bias}, ${n})`,async()=>{
 const h=await setup(`?experiment=walk&seed=${seed}&bias=${bias}&at=v1,${n}`,'#instruments');h.el('instruments').open=true;check(h,n,seed,bias);roundtrip(h);
 if(n<512){click(h,'walk-step-one');check(h,n+1,seed,bias);const next=h.drawing();roundtrip(h);click(h,'walk-back');check(h,n,seed,bias);roundtrip(h);click(h,'walk-step-one');assert.deepEqual(h.drawing(),next);}else{click(h,'walk-step-one');check(h,512,seed,bias);click(h,'walk-back');check(h,511,seed,bias);roundtrip(h);click(h,'walk-step-one');check(h,512,seed,bias);}
});
test('invalid and unfinished count drafts survive return, focus changes and same-query history',async()=>{
 const h=await setup('?experiment=walk&at=v1,137','#instruments');h.el('instruments').open=true;h.el('walk-count').value='unfinished';click(h,'walk-seek');const error=h.el('walk-seek-error').textContent;roundtrip(h);assert.equal(h.el('walk-seek-error').textContent,error);assert.equal(h.el('walk-count').getAttribute('aria-invalid'),'true');h.el('canvas').focus();roundtrip(h);check(h,137);h.el('walk-count').value='205';roundtrip(h);assert.equal(h.el('walk-count').value,'205');
});
test('reading navigation preserves fixed checkpoint, pending sharing and return undo',async()=>{
 const h=await setup('?experiment=walk&seed=23&bias=7&at=v1,73','#instruments');let resolve;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(r=>resolve=r)}}});
 try{const pending=click(h,'share');click(h,'step');check(h,89,23,7);roundtrip(h);const announcement=h.el('announcement').textContent;resolve();await pending;assert.equal(h.el('announcement').textContent,announcement);assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),'v1,73');const latest=h.drawing();click(h,'observation-return');check(h,73,23,7);roundtrip(h);click(h,'observation-undo');check(h,89,23,7);assert.deepEqual(h.drawing(),latest);roundtrip(h);}finally{delete globalThis.navigator;}
});
test('running return keeps partial timing and resumes the same sequence after offscreen suspension',async()=>{
 const h=await setup('?experiment=walk&seed=23&bias=7','#instruments',false);h.tick(0);h.tick(50);check(h,16,23,7);roundtrip(h);h.tick(100);check(h,20,23,7);assert.equal(h.frames.size,1);
 h.setVisible(false);roundtrip(h);assert.equal(h.frames.size,0);h.setVisible(true);assert.equal(h.frames.size,1);h.tick(9000);h.tick(9050);check(h,20,23,7);roundtrip(h);h.tick(9100);check(h,24,23,7);click(h,'pause');roundtrip(h);assert.equal(h.frames.size,0);
});
test('retained worlds, resets, presets and real query changes remain distinct from reading history',async()=>{
 const h=await setup('?experiment=walk&seed=23&bias=7&at=v1,137','#instruments');h.el('instruments').open=true;h.el('walk-count').value='205';
 for(const mode of ['orbit','life','wave','fractal']){click(h,'tab-'+mode);click(h,'tab-walk');roundtrip(h);check(h,137,23,7);}assert.equal(h.el('walk-count').value,'205');click(h,'reset');check(h,16,23,7);roundtrip(h);
 h.el('preset-select').handlers.change({target:{value:'drift'}});click(h,'load-preset');roundtrip(h);h.navigate('?experiment=walk&seed=99&bias=25&at=v1,512#canvas');check(h,512,99,25);roundtrip(h);
});
test('reflow, display loss and text-only startup keep current path readings and recoverable drawing',async()=>{
 const h=await setup('?experiment=walk&seed=23&bias=7&at=v1,137','#instruments');const original=h.drawing();
 for(const size of [[259,240],[171,240],[455.5,281.75],[0,0],[600,414]]){h.resize(...size);roundtrip(h);check(h,137,23,7);}h.setDpr(2);h.loseContext();roundtrip(h);h.restoreContext();h.setDpr(1);roundtrip(h);assert.deepEqual(h.drawing(),original);
 const fallback=await setup('?experiment=walk&at=v1,137','#instruments',true,1,false);roundtrip(fallback);check(fallback,137);fallback.setContextReady(true);click(fallback,'canvas-retry');roundtrip(fallback);check(fallback,137);
});
test('discoveries stay explicit and intentional held Walk and Fractal batches remain available',async()=>{
 const h=await setup('?experiment=walk','#instruments');click(h,'mission-start');roundtrip(h);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');click(h,'walk-64');roundtrip(h);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;
 for(const repeat of [false,true]){h.key('ArrowRight',{repeat});roundtrip(h);}check(h,96);for(const mode of ['walk','fractal']){if(mode==='fractal')click(h,'tab-fractal');for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional batch repetition changed');}});click(h,'step');roundtrip(h);}}assert.equal(h.el('notes-text').value,notes);
});
