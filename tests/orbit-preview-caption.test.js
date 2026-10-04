import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
const scale=h=>h.drawing().find(c=>c[0]==='scale')?.[1];
function geometry(h){
 const commands=h.drawing(),s=scale(h),r=h.el('canvas').getBoundingClientRect();
 const square=commands.find(c=>c[0]==='strokeRect');
 const label=commands.find(c=>c[0]==='fillText'&&c[1]==='下一颗 · 10 s 预演');
 const panel=commands.find(c=>c[0]==='fillRect'&&Math.abs(c[3]*s-153)<1e-8&&Math.abs(c[4]*s-23)<1e-8);
 const rect=c=>c&&({x:r.width/2+c[1]*s,y:r.height/2+c[2]*s,w:c[3]*s,h:c[4]*s});
 return {commands,s,r,square:rect(square),panel:rect(panel),label};
}
const overlaps=(a,b,padding=0)=>a.x+a.w+padding>=b.x&&a.x-padding<=b.x+b.w&&a.y+a.h+padding>=b.y&&a.y-padding<=b.y+b.h;
function launch(h,x,y){const s=scale(h),r=h.el('canvas').getBoundingClientRect();h.el('canvas').handlers.click({detail:1,clientX:r.width/2+x*s,clientY:r.height/2+y*s});}
function state(h){return {metrics:h.el('metrics').textContent,position:h.el('orbit-position').textContent,preview:h.el('orbit-preview-reading').textContent,measured:h.el('orbit-measured-reading').textContent,radial:h.el('orbit-radial-reading').textContent,recall:h.el('orbit-recall-status').textContent,url:location.href,notes:h.el('notes-text').value};}
// Separate scalar integration of the existing softened acceleration, without
// calling the production predictor, launch helper or simulation stepper.
function endpoint(x,y,gravity=80,speed=100){
 const radius=Math.hypot(x,y),v=Math.sqrt(gravity*1000/radius)*speed/100;
 let vx=-y/radius*v,vy=x/radius*v;
 for(let i=0;i<1000;i++){const d=Math.max(Math.hypot(x,y),18);vx-=gravity*1000*x/(d*d*d)*.01;vy-=gravity*1000*y/(d*d*d)*.01;x+=vx*.01;y+=vy*.01;}
 return {x,y};
}
function check(h,x,y,gravity=80,speed=100){
 const g=geometry(h),end=endpoint(x,y,gravity,speed);assert.ok(g.square);
 close(g.square.x+4,g.r.width/2+end.x*g.s);close(g.square.y+4,g.r.height/2+end.y*g.s);close(g.square.w,8);close(g.square.h,8);
 if(g.panel){assert.ok(!overlaps(g.square,g.panel,.75),'caption leaves the full endpoint stroke clear');assert.ok(g.panel.x>=8-1e-8);assert.ok(g.panel.x+g.panel.w<=g.r.width-8+1e-8);assert.ok(g.panel.y>=0);}
 return g;
}

test('the actual 10-second endpoint is no longer erased by its opaque preview caption',async()=>{
 const h=await setup('?experiment=orbit');launch(h,-280,-55);const g=check(h,-280,-55);
 assert.ok(g.square.x>109&&g.square.x<110);assert.ok(g.square.y>18&&g.square.y<19);
 assert.ok(g.panel.x>400,'caption moves to the opposite top corner');assert.equal(h.el('metrics').textContent,'4 颗行星 · t + 0.0 s');
});

test('ordinary predictions keep the original caption position and unchanged preview path',async()=>{
 const h=await setup('?experiment=orbit'),g=check(h,140,0);for(const [k,v] of Object.entries({x:8,y:9,w:153,h:23}))close(g.panel[k],v);
 const before=h.drawing(),message=h.el('announcement').textContent;for(let i=0;i<10;i++)h.resize(600,414);assert.deepEqual(h.drawing(),before);assert.equal(h.el('announcement').textContent,message);
});

test('the public-browser-size reproduction retains the exact endpoint and launch readings',async()=>{
 const h=await setup('?experiment=orbit');h.resize(767,317.9375);launch(h,-490,-70);const g=check(h,-490,-70);assert.ok(g.panel.x>600);assert.match(h.el('orbit-preview-reading').textContent,/预演 10 秒后/);
});

test('a narrow overlapping caption is omitted without losing the endpoint or its HTML reading',async()=>{
 const h=await setup('?experiment=orbit');h.resize(171,240);launch(h,-220,-170);const g=check(h,-220,-170);
 assert.equal(g.panel,undefined);assert.equal(g.label,undefined);assert.match(h.el('orbit-preview-reading').textContent,/预演 10 秒后：x -82.9，y -265.3/);assert.equal(h.el('orbit-preview-reading').hidden,false);
 assert.ok(g.commands.some(c=>c[0]==='lineTo'),'the full predicted path remains');
 h.resize(600,414);check(h,-220,-170);assert.ok(geometry(h).label,'ordinary canvas caption returns when space is clear');
});

test('small, fractional and density-only layouts keep the marker geometry and in-bounds caption',async()=>{
 const h=await setup('?experiment=orbit');launch(h,-280,-55);const before=state(h),message=h.el('announcement').textContent;
 for(const [w,z] of [[168,240],[169,240],[171,240],[233.5,260.75],[259,240],[600,414],[767,317.9375]])for(const dpr of [1,1.25,2,3]){
  h.resize(w,z);h.setDpr(dpr);check(h,-280,-55);assert.deepEqual(state(h),before);assert.equal(h.el('announcement').textContent,message);
  if(w<169)assert.equal(geometry(h).panel,undefined);
 }
});

test('positions around the caption boundaries move only an overlapping label',async()=>{
 const h=await setup('?experiment=orbit');let relocated=0,ordinary=0;
 for(const x of [-290,-280,-270])for(const y of [-130,-100,-80,-65,-55,-45,-30,0,30]){
  click(h,'reset');launch(h,x,y);const g=check(h,x,y),defaultPanel={x:8,y:9,w:153,h:23};
  if(overlaps(g.square,defaultPanel,.75)){assert.ok(g.panel.x>400);relocated++;}
  else{close(g.panel.x,8);ordinary++;}
 }
 assert.ok(relocated>3);assert.ok(ordinary>3);
});

test('speed and gravity alter the prediction normally while the caption follows its own endpoint',async()=>{
 const h=await setup('?experiment=orbit');launch(h,-280,-55);
 for(const gravity of [30,80,160])for(const speed of [30,65,100,150]){
  h.el('gravity').handlers.input({target:{value:String(gravity)}});h.el('speed').handlers.input({target:{value:String(speed)}});check(h,-280,-55,gravity,speed);
  assert.match(h.el('metrics').textContent,/4 颗行星 · t \+ 0.0 s/);assert.equal(h.frames.size,0);
 }
});

test('running, stepping, pausing, recall, reset and launch limits retain existing behavior',async()=>{
 const h=await setup('?experiment=orbit');launch(h,-280,-55);check(h,-280,-55);click(h,'pause');assert.equal(geometry(h).square,undefined);
 const message=h.el('announcement').textContent;h.tick(0);h.tick(50);assert.equal(h.el('announcement').textContent,message);assert.equal(geometry(h).label,undefined);
 click(h,'step');check(h,-280,-55);assert.equal(h.frames.size,0);assert.match(h.el('metrics').textContent,/t \+ 0.2 s/);
 click(h,'orbit-recall');check(h,-280,-55);assert.match(h.el('metrics').textContent,/3 颗行星/);
 click(h,'reset');check(h,140,0);for(let i=0;i<21;i++)click(h,'orbit-fire');assert.match(h.el('metrics').textContent,/24 颗行星/);assert.equal(geometry(h).square,undefined);assert.equal(geometry(h).label,undefined);
 click(h,'orbit-recall');check(h,140,0);click(h,'orbit-home');check(h,140,0);
});

test('retained worlds, focus and canvas restoration preserve state without extra announcements',async()=>{
 const h=await setup('?experiment=orbit');launch(h,-280,-55);const before=state(h),drawing=h.drawing(),message=h.el('announcement').textContent;
 h.el('orbit-right').focus();h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();h.loseContext();h.restoreContext();h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);
 assert.deepEqual(state(h),before);assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('announcement').textContent,message);assert.equal(document.activeElement,h.el('orbit-right'));
 for(const world of ['life','wave','fractal','walk']){click(h,'tab-'+world);click(h,'tab-orbit');check(h,-280,-55);assert.deepEqual(state(h),before);}
});

test('snapshot requests capture the relocated caption while sharing remains parameter-only',async()=>{
 const h=await setup('?experiment=orbit');launch(h,-280,-55);const before=state(h);let captured;
 h.el('canvas').toBlob=callback=>{captured=h.drawing();callback(null);};click(h,'save');assert.deepEqual(captured,h.drawing());assert.deepEqual(state(h),before);
 await click(h,'share');assert.equal(new URL(h.el('share-link').value).searchParams.has('at'),false);check(h,-280,-55);assert.deepEqual(state(h),before);
});

test('no initial canvas and temporary collapse retain predictions for ordinary recovery',async()=>{
 const h=await setup('?experiment=orbit','',true,1,false);assert.equal(h.drawCount(),0);assert.equal(h.el('orbit-preview-reading').hidden,false);
 h.key('ArrowLeft');const before=state(h);h.setContextReady(true);click(h,'canvas-retry');check(h,135,0);assert.deepEqual(state(h),before);
 h.resize(0,0);assert.equal(geometry(h).square,undefined);h.resize(600,414);check(h,135,0);assert.deepEqual(state(h),before);
});

test('Orbit discovery and intentional Fractal and Walk batch repeats remain unchanged',async()=>{
 const h=await setup('?experiment=orbit');click(h,'mission-start');click(h,'mission-check');h.el('gravity').handlers.input({target:{value:'40'}});
 for(let i=0;i<80;i++)click(h,'step');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;
 click(h,'tab-fractal');for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('batch repeat suppressed');}});click(h,'step');}assert.match(h.el('metrics').textContent,/500 个点/);
 click(h,'tab-walk');h.key('ArrowRight');h.key('ArrowRight',{repeat:true});assert.match(h.el('metrics').textContent,/48 步/);assert.equal(h.el('notes-text').value,notes);
});

test('fresh pages request the caption-safe application without new controls',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/app\.js\?[^"\n]*&amp;preview-caption=clear-1/);
});
