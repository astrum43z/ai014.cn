import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
const scale=h=>h.drawing().find(c=>c[0]==='scale')?.[1];
function position(h,x,y){for(const [axis,value] of [['x',x],['y',y]]){const el=h.el('orbit-target-'+axis);el.value=String(value);el.handlers.input();}click(h,'orbit-position-apply');}
function legend(h){
 const s=scale(h),{width,height}=h.el('canvas').getBoundingClientRect(),all=h.drawing();
 const text=all.filter(c=>c[0]==='fillText'&&(/首颗|箭头仅表示方向/).test(c[1]));
 const panel=all.find(c=>c[0]==='fillRect'&&[[196,23],[148,23],[148,39]].some(([w,v])=>Math.abs(c[3]*s-w)<1e-8&&Math.abs(c[4]*s-v)<1e-8));
 return {s,text,panel:panel&&{x:width/2+panel[1]*s,y:height/2+panel[2]*s,w:panel[3]*s,h:panel[4]*s},all,width,height};
}
function check(h){
 const g=legend(h);if(!g.panel){assert.equal(g.text.length,0);return g;}
 const p=g.panel;near(p.x,8);assert.ok(p.x+p.w<=g.width-8+1e-8);assert.ok(p.y>=8-1e-8&&p.y+p.h<=g.height-8+1e-8);
 assert.equal(g.text.length,p.h>24?2:1);
 for(const [i,c] of g.text.entries()){const font=g.all.slice(0,g.all.indexOf(c)).findLast(command=>command[0]==='font');assert.ok(font);near(parseFloat(font[1])*g.s,12);assert.match(font[1],/px sans-serif$/);near(g.width/2+c[2]*g.s,34);near(g.height/2+c[3]*g.s,p.y+15+i*16);assert.equal(c.length,4,'no font squeezing through fillText maxWidth');}
 const square=g.all.find(c=>c[0]==='strokeRect');
 if(square){const x=g.width/2+square[1]*g.s,y=g.height/2+square[2]*g.s;assert.ok(x+8.75<p.x||x-.75>p.x+p.w||y+8.75<p.y||y-.75>p.y+p.h,'full endpoint stroke stays clear');}
 return g;
}
function model(h){const s=scale(h);return {bodies:h.drawing().filter(c=>c[0]==='arc'&&Math.abs(c[3]*s-4.5)<1e-8).map(c=>c.slice(1,3)),metrics:h.el('metrics').textContent,point:h.el('orbit-position-current').textContent,preview:h.el('orbit-preview-reading').textContent,measured:h.el('orbit-measured-reading').textContent,radial:h.el('orbit-radial-reading').textContent,recall:h.el('orbit-recall-status').textContent,url:location.href,notes:h.el('notes-text').value};}
// A separate scalar integrator, without the production stepper or prediction.
function integrate(x,y,vx,vy,dt,n,mu=80000){for(let i=0;i<n;i++){const r=Math.max(Math.hypot(x,y),18);vx-=mu*x/r**3*dt;vy-=mu*y/r**3*dt;x+=vx*dt;y+=vy*dt;}return {x,y,vx,vy};}

test('public 171 × 240 reproduction keeps both original meanings in two readable rows',async()=>{
 const h=await setup('?experiment=orbit');h.resize(171,240);const g=check(h);
 assert.deepEqual(g.text.map(c=>c[1]),['首颗 · 实线量距离','箭头仅表示方向']);near(g.panel.w,148);near(g.panel.h,39);near(g.panel.y,38);
 assert.equal(h.el('metrics').textContent,'3 颗行星 · t + 0.0 s');assert.match(h.el('orbit-measured-help').textContent,/长度不表示速率/);
 const p=integrate(140,0,0,Math.sqrt(80000/140),.01,1000),square=g.all.find(c=>c[0]==='strokeRect');near(square[1]+4/g.s,p.x);near(square[2]+4/g.s,p.y);
});

test('wide views retain original single row while compact width thresholds are explicit',async()=>{
 const h=await setup('?experiment=orbit');
 for(const w of [164,164.01,171,211.999,212,259,334.5,600,767,1200]){h.resize(w,240);const g=check(h);assert.ok(g.panel);near(g.panel.w,w<212?148:196);assert.deepEqual(g.text.map(c=>c[1]),w<212?['首颗 · 实线量距离','箭头仅表示方向']:['首颗 · 线量距，箭头仅方向']);}
 for(const w of [120,163.99]){h.resize(w,240);assert.equal(check(h).panel,undefined);assert.match(h.el('orbit-measured-help').textContent,/蓝色箭头/);}
});

test('fractional views and density changes do not move planets, launcher, preview or readings',async()=>{
 const h=await setup('?experiment=orbit');position(h,-500,-35);const before=model(h),announcement=h.el('announcement').textContent;
 for(const [w,v] of [[163.99,240],[164,240],[171,240],[211.99,281.75],[212,240],[334.5,281.75],[767,317.9375],[1200,560]])for(const dpr of [1,1.25,2,3]){h.resize(w,v);h.setDpr(dpr);check(h);assert.deepEqual(model(h),before);assert.equal(h.el('announcement').textContent,announcement);}
});

function isolated({width=171,height=240,paused=true,visible=true,body={x:300,y:200,vx:0,vy:1},launcher={x:300,y:200},end=null,hasPrediction=true}={}){
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8'),fn=source.slice(source.indexOf('function drawOrbitMeasurementLegend('),source.indexOf('// Label the actual model-to-screen scale'));
 const commands=[],ctx=new Proxy({}, {get:(_,name)=>(...args)=>commands.push([name,...args]),set:(_,name,v)=>(commands.push([name,v]),true)});
 const point=p=>({x:p.x-width/2,y:p.y-height/2});
 new Function('width','height','paused','bodies','orbitPoint','ctx','orbitMeasuredBodyVisible','orbitPrediction',fn+';drawOrbitMeasurementLegend(1);')(width,height,paused,[{...point(body),vx:body.vx,vy:body.vy}],point(launcher),ctx,()=>visible,()=>hasPrediction?{end:point(end||{x:width-8,y:height-8})}:null);
 const p=commands.find(c=>c[0]==='fillRect');return {commands,text:commands.filter(c=>c[0]==='fillText').map(c=>c[1]),panel:p&&{x:p[1]+width/2,y:p[2]+height/2,w:p[3],h:p[4]}};
}

test('compact panel uses its full extra row for endpoint collisions, including stroke edges',()=>{
 for(const [x,y,moved] of [[3.25,70,true],[160.75,70,true],[80,33.25,true],[80,81.75,true],[3.24,70,false],[160.76,70,false],[80,33.24,false],[80,81.76,false]]){const g=isolated({end:{x,y}});assert.ok(g.panel);near(g.panel.y,moved?139:38);near(g.panel.h,39);}
 // Both rows must be clear at either position, including lower edge of row two.
 assert.equal(isolated({launcher:{x:80,y:50},end:{x:80,y:177}}).panel,undefined);
});

test('body, direction clearance and launcher are protected across both compact rows',()=>{
 for(const kind of ['body','launcher'])for(const y of [40,75]){
  const override=kind==='body'?{body:{x:80,y,vx:0,vy:1}}:{launcher:{x:80,y}};
  const g=isolated(override);assert.ok(g.panel);near(g.panel.y,139);
 }
 // The second row may not overlap a measured body's direction clearance.
 assert.equal(isolated({body:{x:80,y:115,vx:0,vy:1}}).panel,undefined);
 const g=isolated({width:212,end:{x:170,y:70}});near(g.panel.y,38);near(g.panel.w,196);near(g.panel.h,23);
});

test('running, zero-speed and offscreen states keep accurate single-line compact captions',()=>{
 for(const options of [{paused:false},{body:{x:300,y:200,vx:0,vy:0}},{visible:false}]){
  const g=isolated(options);near(g.panel.w,148);near(g.panel.h,23);assert.deepEqual(g.text,options.visible===false?['首颗行星 · 画外']:options.paused===false?['首颗行星']:['首颗 · 实线量距离']);
 }
 assert.deepEqual(isolated({visible:false,width:212}).text,['首颗行星 · 当前在画外']);
});

test('too-short or too-narrow plots omit only the duplicate canvas legend',()=>{
 for(const options of [{width:163.99},{height:84.99},{height:30,hasPrediction:false}])assert.equal(isolated(options).panel,undefined);
 near(isolated({height:85,end:{x:163,y:200}}).panel.y,38);
 const g=isolated({hasPrediction:false});near(g.panel.y,9);near(g.panel.h,39);
});

test('launch, stepping, pause, recall and limit keep the independent orbit and preview',async()=>{
 const h=await setup('?experiment=orbit');h.resize(171,240);click(h,'orbit-fire');click(h,'step');let g=check(h);
 const first=model(h).bodies[0],p=integrate(75,0,0,Math.sqrt(80000/75),.01,10);near(first[0],p.x);near(first[1],p.y);assert.match(h.el('metrics').textContent,/4 颗行星/);
 click(h,'orbit-recall');assert.equal(model(h).bodies.length,3);check(h);
 click(h,'pause');assert.equal(h.frames.size,1);h.tick(0);h.tick(50);click(h,'pause');check(h);assert.equal(h.frames.size,0);
 click(h,'reset');position(h,0,0);assert.equal(h.drawing().find(c=>c[0]==='strokeRect'),undefined);check(h);
 click(h,'orbit-home');for(let i=0;i<21;i++)click(h,'orbit-fire');g=check(h);assert.equal(h.el('orbit-preview-reading').hidden,true);assert.equal(model(h).bodies.length,24);assert.ok(g.text.every(c=>!c[1].includes('画外')));click(h,'orbit-recall');check(h);
});

test('redraws, simulated canvas recovery and retained worlds preserve model and compact geometry',async()=>{
 const h=await setup('?experiment=orbit');h.resize(171,240);const before=model(h),drawing=h.drawing(),announcement=h.el('announcement').textContent;h.el('orbit-position-apply').focus();
 for(let i=0;i<5;i++)h.resize(171,240);h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();h.loseContext();h.restoreContext();h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);
 assert.deepEqual(model(h),before);assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('announcement').textContent,announcement);assert.equal(document.activeElement,h.el('orbit-position-apply'));
 for(const world of ['life','wave','fractal','walk']){click(h,'tab-'+world);click(h,'tab-orbit');check(h);assert.deepEqual(model(h),before);}
 h.resize(0,0);assert.equal(h.frames.size,0);h.resize(171,240);assert.deepEqual(model(h),before);check(h);
});

test('capture and parameter-only sharing retain compact legend without changing state',async()=>{
 const h=await setup('?experiment=orbit');h.resize(171,240);position(h,137.5,-42.5);const before=model(h);let captured;
 h.el('canvas').toBlob=callback=>{captured=h.drawing();callback(null);};click(h,'save');assert.deepEqual(captured,h.drawing());await click(h,'share');check(h);assert.deepEqual(model(h),before);assert.equal(new URL(h.el('share-link').value).searchParams.has('at'),false);
});

test('discoveries and intentional Fractal/Walk batch repeats retain their existing contracts',async()=>{
 const h=await setup('?experiment=orbit');h.resize(171,240);click(h,'mission-start');click(h,'mission-check');h.el('gravity').handlers.input({target:{value:'40'}});for(let i=0;i<80;i++)click(h,'step');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;check(h);
 for(const [world,expected] of [['fractal',/500 个点/],['walk',/48 步/]]){click(h,'tab-'+world);for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional batch repeat suppressed');}});click(h,'step');}assert.match(h.el('metrics').textContent,expected);}
 assert.equal(h.el('notes-text').value,notes);
});

test('fresh pages request the compact legend application without new controls',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/app\.js\?[^"\n]*&amp;orbit-legend=compact-1/);
});
