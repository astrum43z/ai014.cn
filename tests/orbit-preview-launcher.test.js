import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
const scale=h=>h.drawing().find(c=>c[0]==='scale')?.[1];
function position(h,x,y){for(const [axis,value] of [['x',x],['y',y]]){const el=h.el('orbit-target-'+axis);el.value=String(value);el.handlers.input();}click(h,'orbit-position-apply');}
function geometry(h){
 const s=scale(h),r=h.el('canvas').getBoundingClientRect(),commands=h.drawing();
 const rect=c=>c&&({x:r.width/2+c[1]*s,y:r.height/2+c[2]*s,w:c[3]*s,h:c[4]*s});
 return {s,r,commands,square:rect(commands.find(c=>c[0]==='strokeRect')),panel:rect(commands.find(c=>c[0]==='fillRect'&&Math.abs(c[3]*s-153)<1e-8&&Math.abs(c[4]*s-23)<1e-8))};
}
const overlaps=(a,b)=>a.x+a.w>=b.x&&a.x<=b.x+b.w&&a.y+a.h>=b.y&&a.y<=b.y+b.h;
// Independent scalar softened integration, without production predictor helpers.
function endpoint(x,y,gravity=80,speed=100){const r=Math.hypot(x,y),v=Math.sqrt(gravity*1000/r)*speed/100;let vx=-y/r*v,vy=x/r*v;for(let i=0;i<1000;i++){const d=Math.max(Math.hypot(x,y),18);vx-=gravity*1000*x/(d*d*d)*.01;vy-=gravity*1000*y/(d*d*d)*.01;x+=vx*.01;y+=vy*.01;}return {x,y};}
function check(h,x,y,gravity=80,speed=100){
 const g=geometry(h),end=endpoint(x,y,gravity,speed);assert.ok(g.square);
 near(g.square.x+4,g.r.width/2+end.x*g.s);near(g.square.y+4,g.r.height/2+end.y*g.s);near(g.square.w,8);near(g.square.h,8);
 if(g.panel){
  assert.ok(!overlaps(g.panel,{x:g.square.x-.75,y:g.square.y-.75,w:9.5,h:9.5}),'full endpoint stroke stays clear');
  assert.ok(!overlaps(g.panel,{x:g.r.width/2+x*g.s-35,y:g.r.height/2+y*g.s-35,w:70,h:70}),'caption stays clear of launcher envelope');
  assert.ok(g.panel.x>=8-1e-8&&g.panel.x+153<=g.r.width-8+1e-8);near(g.panel.y,9);
 }
 const ring=g.commands.find(c=>c[0]==='arc'&&Math.abs(c[3]*g.s-8)<1e-8);assert.ok(ring);near(ring[1],x);near(ring[2],y);
 return g;
}
function model(h){const s=scale(h);return {bodies:h.drawing().filter(c=>c[0]==='arc'&&Math.abs(c[3]*s-4.5)<1e-8).map(c=>c.slice(1,3)),metrics:h.el('metrics').textContent,position:h.el('orbit-position-current').textContent,preview:h.el('orbit-preview-reading').textContent,measured:h.el('orbit-measured-reading').textContent,radial:h.el('orbit-radial-reading').textContent,recall:h.el('orbit-recall-status').textContent,url:location.href,notes:h.el('notes-text').value};}

// Isolate the presentation to test exact envelope edges and opposing obstacles.
function isolated({width=600,height=318,launcher={x:300,y:160},end={x:300,y:220},prediction=true}={}){
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8'),fn=source.slice(source.indexOf('function drawOrbitPreview('),source.indexOf('// Keep the task\'s measured first planet'));
 const commands=[],ctx=new Proxy({}, {get:(_,name)=>(...args)=>commands.push([name,...args]),set:(_,name,v)=>(commands.push([name,v]),true)});
 const point=p=>({x:p.x-width/2,y:p.y-height/2});
 new Function('width','height','orbitPoint','ctx','orbitPrediction',fn+';drawOrbitPreview(1);')(width,height,point(launcher),ctx,()=>prediction?{points:[[0,0],[1,2]],end:point(end)}:null);
 const p=commands.find(c=>c[0]==='fillRect');return {commands,panel:p&&{x:p[1]+width/2,y:p[2]+height/2,w:p[3],h:p[4]}};
}

test('public 647 × 317.9375 collision moves the caption away from the launch arrow',async()=>{
 const h=await setup('?experiment=orbit');h.resize(647,317.9375);position(h,-500,-215);const g=check(h,-500,-215);assert.ok(g.panel.x>480);near(g.r.height/2-215*g.s,34.48375);assert.equal(h.el('metrics').textContent,'3 颗行星 · t + 0.0 s');assert.match(h.el('orbit-preview-reading').textContent,/x -440.1，y -320.1/);
});

test('reachable acute miter near the lower caption edge is also excluded',async()=>{
 const h=await setup('?experiment=orbit');h.resize(647,317.9375);position(h,-500,-165);const g=check(h,-500,-165);assert.ok(g.panel.x>480);near(g.s,.579);
 const radius=Math.hypot(-500,-165),dx=165/radius,dy=-500/radius,tipX=27+2.25*(Math.sqrt(52)+6)/4;
 const x=34+dx*tipX-dy*2.25,y=63.43375+dy*tipX+dx*2.25;
 assert.ok(x>8&&x<161&&y>9&&y<32,'actual dark miter would cross the old caption even beyond its 30px check');
});

test('ordinary launch keeps original caption, font, shape and coordinates',async()=>{
 const h=await setup('?experiment=orbit'),g=check(h,140,0);for(const [key,value] of Object.entries({x:8,y:9,w:153,h:23}))near(g.panel[key],value);
 const text=g.commands.find(c=>c[0]==='fillText'&&c[1]==='下一颗 · 10 s 预演'),font=g.commands.slice(0,g.commands.indexOf(text)).findLast(c=>c[0]==='font');near(parseFloat(font[1])*g.s,12);near(text[2]*g.s+g.r.width/2,43);near(text[3]*g.s+g.r.height/2,24);
});

test('conservative launcher bounds include ring, arrowhead and casing at every edge',()=>{
 for(const [x,y,moved] of [[-27,20,true],[196,20,true],[80,-26,true],[80,67,true],[-27.01,20,false],[196.01,20,false],[80,-26.01,false],[80,67.01,false]]){
  const g=isolated({launcher:{x,y}});assert.ok(g.panel);near(g.panel.x,moved?439:8);
 }
 // The ring/casing reaches 10.25px. The acute shaft-to-head miter goes
 // beyond the arrow vertex plus half-stroke; account for both stroke edges.
 const halfStroke=2.25,tipX=27+halfStroke*(Math.sqrt(52)+6)/4;
 const reach=Math.hypot(tipX,halfStroke);assert.ok(reach>34&&reach<35);
 near(isolated({launcher:{x:80,y:64}}).panel.x,439);
 for(let angle=0;angle<Math.PI*2;angle+=.01){const dx=Math.cos(angle),dy=Math.sin(angle);for(const sign of [-1,1])assert.ok(Math.hypot(tipX*dx-sign*halfStroke*dy,tipX*dy+sign*halfStroke*dx)<35);}
 // Other vertices and the short independent head segment stay closer.
 for(let angle=0;angle<Math.PI*2;angle+=.01){const dx=Math.cos(angle),dy=Math.sin(angle);for(const [x,y] of [[dx*27,dy*27],[dx*21+dy*4,dy*21-dx*4],[dx*21-dy*4,dy*21+dx*4]])assert.ok(Math.hypot(x,y)+2.25<30);}
});

test('both corners must clear both launcher and endpoint; insufficient room omits only text',()=>{
 for(const options of [{launcher:{x:80,y:20},end:{x:500,y:20}},{width:171,launcher:{x:80,y:34}},{width:168}]){
  const g=isolated(options);assert.equal(g.panel,undefined);assert.ok(g.commands.some(c=>c[0]==='strokeRect'));assert.ok(g.commands.some(c=>c[0]==='lineTo'));assert.ok(!g.commands.some(c=>c[0]==='fillText'));
 }
 near(isolated({launcher:{x:500,y:20}}).panel.x,8);assert.equal(isolated({prediction:false}).commands.length,0);
});

test('narrow and fractional layouts and density-only redraws retain exact model',async()=>{
 const h=await setup('?experiment=orbit');position(h,-500,-215);const before=model(h),message=h.el('announcement').textContent;
 for(const [w,v] of [[168,240],[169,240],[171,240],[211.5,260.75],[334.5,281.75],[647,317.9375],[767,317.9375],[1200,560]])for(const dpr of [1,1.25,2,3]){h.resize(w,v);h.setDpr(dpr);check(h,-500,-215);assert.deepEqual(model(h),before);assert.equal(h.el('announcement').textContent,message);}
});

test('different target positions and parameters keep full predicted endpoints independently',async()=>{
 const h=await setup('?experiment=orbit');h.resize(647,317.9375);
 for(const gravity of [30,80,160])for(const speed of [30,100,150])for(const [x,y] of [[-500,-215],[500,-215],[-500,-35],[137.5,-42.5]]){h.el('gravity').handlers.input({target:{value:String(gravity)}});h.el('speed').handlers.input({target:{value:String(speed)}});position(h,x,y);check(h,x,y,gravity,speed);assert.match(h.el('metrics').textContent,/3 颗行星 · t \+ 0.0 s/);}
});

test('launch, advance, recall, home and limit preserve existing controls and physics',async()=>{
 const h=await setup('?experiment=orbit');h.resize(647,317.9375);position(h,-500,-215);click(h,'orbit-fire');click(h,'step');check(h,-500,-215);assert.equal(model(h).bodies.length,4);
 let x=75,y=0,vx=0,vy=Math.sqrt(80000/75);for(let i=0;i<10;i++){const d=Math.max(Math.hypot(x,y),18);vx-=80000*x/d**3*.01;vy-=80000*y/d**3*.01;x+=vx*.01;y+=vy*.01;}near(model(h).bodies[0][0],x);near(model(h).bodies[0][1],y);
 click(h,'orbit-recall');check(h,-500,-215);assert.equal(model(h).bodies.length,3);click(h,'pause');assert.equal(geometry(h).panel,undefined);h.tick(0);h.tick(50);click(h,'pause');check(h,-500,-215);click(h,'orbit-home');check(h,140,0);
 for(let i=0;i<21;i++)click(h,'orbit-fire');assert.equal(geometry(h).panel,undefined);assert.equal(h.el('orbit-preview-reading').hidden,true);click(h,'orbit-recall');check(h,140,0);click(h,'reset');position(h,0,0);assert.equal(geometry(h).panel,undefined);
});

test('redraws, simulated context interruptions and world returns preserve presentation and drafts',async()=>{
 const h=await setup('?experiment=orbit');h.resize(647,317.9375);position(h,-500,-215);const before=model(h),drawing=h.drawing(),message=h.el('announcement').textContent;h.el('orbit-target-x').value='-2e';h.el('orbit-target-x').focus();
 for(let i=0;i<4;i++)h.resize(647,317.9375);h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();h.loseContext();h.restoreContext();h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);
 assert.deepEqual(model(h),before);assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('announcement').textContent,message);assert.equal(document.activeElement,h.el('orbit-target-x'));
 for(const world of ['life','wave','fractal','walk']){click(h,'tab-'+world);click(h,'tab-orbit');check(h,-500,-215);assert.deepEqual(model(h),before);assert.equal(h.el('orbit-target-x').value,'-2e');}
 h.resize(0,0);h.resize(647,317.9375);assert.deepEqual(model(h),before);check(h,-500,-215);
});

test('snapshot request and parameter sharing keep the exact position and no added checkpoint',async()=>{
 const h=await setup('?experiment=orbit');h.resize(647,317.9375);position(h,-500,-215);const before=model(h);let captured;h.el('canvas').toBlob=callback=>{captured=h.drawing();callback(null);};click(h,'save');assert.deepEqual(captured,h.drawing());await click(h,'share');check(h,-500,-215);assert.deepEqual(model(h),before);assert.equal(new URL(h.el('share-link').value).searchParams.has('at'),false);
});

test('Orbit discovery and intentional Fractal and Walk held batch steps remain unchanged',async()=>{
 const h=await setup('?experiment=orbit');click(h,'mission-start');click(h,'mission-check');h.el('gravity').handlers.input({target:{value:'40'}});for(let i=0;i<80;i++)click(h,'step');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;position(h,-500,-215);check(h,-500,-215,40);assert.equal(h.el('notes-text').value,notes);
 for(const [world,expected] of [['fractal',/500 个点/],['walk',/48 步/]]){click(h,'tab-'+world);for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional repeat suppressed');}});click(h,'step');}assert.match(h.el('metrics').textContent,expected);}assert.equal(h.el('notes-text').value,notes);
});

test('fresh page requests the launcher-clear preview caption',()=>{assert.match(readFileSync(new URL('../index.html',import.meta.url),'utf8'),/app\.js\?[^"\n]*&amp;preview-launcher=clear-1/);});
