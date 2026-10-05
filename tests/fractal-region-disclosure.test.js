import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fractalVertices} from '../fractal.js?v=vertex-counts-1';
import {setup} from './life-challenge-harness.js';
const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const toggle=(h,open)=>{h.el('instruments').open=open;h.el('instruments').handlers.toggle();};
const shape=h=>[0,1,2].map(i=>h.el('fractal-region-'+i).getAttribute('points'));
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),frames:[...h.frames.keys()],readings:['metrics','status','announcement','fractal-jump-reading','fractal-choice-reading','fractal-gap-reading','fractal-regions-reading','mission-state','mission-result'].map(id=>h.el(id).textContent),focus:document.activeElement?.id,draft:h.el('fractal-count').value,error:[h.el('fractal-count').getAttribute('aria-invalid'),h.el('fractal-seek-error').textContent,h.el('fractal-seek-error').hidden],url:location.href,writes:h.writes(),link:h.el('share-link').value,undo:h.el('observation-undo').getAttribute('aria-disabled'),notes:h.el('notes-text').value});
function expected(jump){const vertices=[[0,-1],[-Math.sqrt(3)/2,.5],[Math.sqrt(3)/2,.5]],r=jump/100;return vertices.map(([vx,vy])=>vertices.map(([x,y])=>`${160+((1-r)*x+r*vx)*140},${166+((1-r)*y+r*vy)*140}`).join(' '));}
function check(h,jump){assert.deepEqual(shape(h),expected(jump));assert.match(h.el('fractal-regions-reading').textContent,new RegExp(`前进 ${jump}% → 每块边长为外框的 ${100-jump}%`));}
function reveal(h,jump){const before=state(h);toggle(h,true);assert.deepEqual(state(h),before);check(h,jump);}
function measure(action){let maps=0,visits=0;const map=fractalVertices.map;fractalVertices.map=function(cb,...args){maps++;return map.call(this,(...a)=>{visits++;return cb(...a);},...args);};try{action();}finally{delete fractalVertices.map;}return {maps,visits};}
function watch(h){const writes=[];for(let i=0;i<3;i++){const e=h.el('fractal-region-'+i),set=e.setAttribute.bind(e);e.setAttribute=(...args)=>{writes.push([i,...args]);set(...args);};}return writes;}
function points(h){return h.drawing().filter(([op,...args])=>op==='rect'&&args[2]===1.3).map(([,x,y])=>[x,y]);}
function seeded(count,seed,jump,width=600,height=414){const out=[],s=Math.min(width/2.1,height/1.85),r=jump/100,vertices=[[0,-1],[-Math.sqrt(3)/2,.5],[Math.sqrt(3)/2,.5]];let rng=BigInt(seed),x=0,y=-1;for(let i=0;i<count;i++){rng=(rng*1664525n+1013904223n)%4294967296n;const [vx,vy]=vertices[Number(rng*3n/4294967296n)];x+=(vx-x)*r;y+=(vy-y)*r;out.push([width/2+Math.fround(x)*s,height/2+s*.25+Math.fround(y)*s]);}return out;}
function seek(h,count){h.el('fractal-count').value=String(count);click(h,'fractal-seek');}

test('closed startup skips region construction while exact text and seeded canvas remain current',async()=>{
 const h=await setup('?experiment=fractal&seed=23&jump=38&at=v1,731');assert.deepEqual(shape(h),[null,null,null]);assert.deepEqual(points(h),seeded(731,23,38));assert.match(h.el('fractal-regions-reading').textContent,/前进 38%/);click(h,'fractal-step');assert.deepEqual(points(h),seeded(732,23,38));assert.deepEqual(shape(h),[null,null,null]);reveal(h,38);
});
test('100 closed running draws avoid 400 vertex-array maps and 1200 vertex visits without losing frames or samples',async()=>{
 const h=await setup('?experiment=fractal&seed=23&jump=38');reveal(h,38);toggle(h,false);const old=shape(h),writes=watch(h);click(h,'pause');h.tick(0);const before=h.drawCount();const counts=measure(()=>{for(let i=1;i<=200;i++)h.tick(i*50);});
 assert.deepEqual(counts,{maps:0,visits:0});assert.equal(h.drawCount()-before,100);assert.equal(writes.length,0);assert.deepEqual(shape(h),old);const count=Number(h.el('metrics').textContent.split(' ')[0]);assert.ok(count>300);assert.deepEqual(points(h),seeded(count,23,38));assert.equal(h.frames.size,1);reveal(h,38);assert.equal(writes.length,0);
});
test('every supported ratio stays deferred while closed and refreshes independently on opening',async()=>{
 const h=await setup('?experiment=fractal');for(let jump=35;jump<=70;jump++){toggle(h,false);const old=shape(h),work=measure(()=>input(h,'jump',jump));assert.deepEqual(work,{maps:0,visits:0});assert.deepEqual(shape(h),old);assert.deepEqual(points(h),seeded(300,14,jump));reveal(h,jump);}
});
test('opened diagrams retain unchanged attributes and repair altered or missing geometry',async()=>{
 const h=await setup('?experiment=fractal&jump=65');reveal(h,65);const writes=watch(h);for(let i=0;i<5;i++){toggle(h,false);reveal(h,65);}assert.equal(writes.length,0);h.el('fractal-region-1').attributes.points='stale';delete h.el('fractal-region-2').attributes.points;toggle(h,false);reveal(h,65);assert.deepEqual(writes.map(x=>x[0]),[1,2]);writes.length=0;input(h,'jump',38);check(h,38);assert.equal(writes.length,3);
});
test('opening preserves invalid drafts, exact feedback, keyboard focus and pending frame identity',async()=>{
 const h=await setup('?experiment=fractal');h.el('fractal-count').value='unfinished';click(h,'fractal-seek');h.el('instrument-summary').focus();reveal(h,50);assert.equal(h.el('fractal-count').getAttribute('aria-invalid'),'true');toggle(h,false);h.el('fractal-count').value='805';h.el('fractal-count').handlers.input();click(h,'pause');reveal(h,50);assert.equal(h.frames.size,1);assert.equal(h.el('fractal-count').value,'805');
});
test('coalesced toggles and world switches cannot reveal geometry for a stale world or ratio',async()=>{
 const h=await setup('?experiment=fractal&jump=38');reveal(h,38);toggle(h,false);input(h,'jump',65);const old=shape(h);h.el('instruments').open=true;h.el('instruments').open=false;h.el('instruments').handlers.toggle({newState:'open'});assert.deepEqual(shape(h),old);
 for(const mode of ['orbit','life','wave','walk']){click(h,'tab-'+mode);const before=state(h);toggle(h,true);assert.deepEqual(state(h),before);assert.deepEqual(shape(h),old);toggle(h,false);click(h,'tab-fractal');assert.deepEqual(shape(h),old);}reveal(h,65);click(h,'tab-wave');click(h,'tab-fractal');check(h,65);
});
test('presets, parameter history, seeds, checkpoints and both replay limits keep exact geometry and continuation',async()=>{
 const h=await setup('?experiment=fractal&jump=38&seed=23&at=v1,731');for(const [preset,jump] of [['half',50],['overlap',38],['islands',65]]){toggle(h,false);const old=shape(h);h.el('preset-select').handlers.change({target:{value:preset}});click(h,'load-preset');assert.deepEqual(shape(h),old);reveal(h,jump);}toggle(h,false);h.navigate('?experiment=fractal&jump=70&seed=99&at=v1,12000');reveal(h,70);assert.deepEqual(points(h),seeded(12000,99,70));toggle(h,false);click(h,'fractal-back');reveal(h,70);click(h,'fractal-step');assert.deepEqual(points(h),seeded(12000,99,70));toggle(h,false);seek(h,300);reveal(h,70);click(h,'fractal-back');assert.deepEqual(points(h),seeded(300,99,70));
});
test('fixed observations and return undo survive quiet opening and same-query anchor history',async()=>{
 const h=await setup('?experiment=fractal&jump=38&seed=23&at=v1,731');click(h,'fractal-step');click(h,'observation-return');reveal(h,38);assert.deepEqual(points(h),seeded(731,23,38));toggle(h,false);const before=state(h);h.navigate(location.search+'#instruments');assert.deepEqual({...state(h),url:before.url},before);reveal(h,38);click(h,'observation-undo');assert.deepEqual(points(h),seeded(732,23,38));
});
test('offscreen, hidden and lost-context running openings never advance or restart the clock',async()=>{
 const h=await setup('?experiment=fractal&jump=38','',false);h.tick(0);h.tick(50);h.tick(100);reveal(h,38);for(const [suspend,resume] of [[()=>h.setVisible(false),()=>h.setVisible(true)],[()=>h.setHidden(true),()=>h.setHidden(false)],[()=>h.loseContext(),()=>h.restoreContext()]]){suspend();toggle(h,false);reveal(h,38);resume();h.tick(100000);check(h,38);}click(h,'pause');const count=Number(h.el('metrics').textContent.split(' ')[0]);assert.deepEqual(points(h),seeded(count,14,38));
});
test('new readings never complete discoveries and saved notes survive ratios, visibility and sharing',async()=>{
 const h=await setup('?experiment=fractal');click(h,'mission-start');click(h,'fractal-1000');reveal(h,50);click(h,'mission-check');input(h,'seed',15);click(h,'fractal-1000');toggle(h,false);reveal(h,50);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;toggle(h,false);input(h,'jump',38);reveal(h,38);assert.equal(h.el('notes-text').value,notes);
 let finish;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(r=>finish=r)}}});try{toggle(h,false);const pending=click(h,'share');click(h,'fractal-step');reveal(h,38);const message=h.el('announcement').textContent;finish();await pending;assert.equal(h.el('announcement').textContent,message);assert.equal(new URL(h.el('share-link').value).searchParams.get('at'),'v1,300');}finally{delete globalThis.navigator;}
});
for(const context of [false,'throw'])test(`text-only startup ${context}, reflow and recovered canvas use current geometry`,async()=>{
 const h=await setup('?experiment=fractal&jump=38','',true,1,context);assert.deepEqual(shape(h),[null,null,null]);reveal(h,38);toggle(h,false);input(h,'jump',65);for(const size of [[0,0],[163,240],[259.5,240.25],[600,414]])h.resize(...size);h.setDpr(2);h.setContextReady(true);click(h,'canvas-retry');assert.deepEqual(shape(h),expected(38));reveal(h,65);assert.deepEqual(points(h),seeded(300,14,65));
});
test('closed and open drawings, capture requests and intentional held primary batches remain unchanged',async()=>{
 const h=await setup('?experiment=fractal&jump=38');reveal(h,38);toggle(h,false);let captures=0;h.el('canvas').toBlob=cb=>{captures++;cb(null);};click(h,'save');reveal(h,38);assert.equal(captures,1);
 for(const mode of ['fractal','walk']){click(h,'tab-'+mode);for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional hold changed');}});click(h,'step');}assert.match(h.el('metrics').textContent,mode==='fractal'?/500 个点/:/48 步/);}input(h,'bias',4);assert.equal(new URL(location.href).searchParams.get('bias'),'4');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/<details id="instruments" class="instrument-drawer">/);assert.match(html,/region-drawer=idle-1/);
});
