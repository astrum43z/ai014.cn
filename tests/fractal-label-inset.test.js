import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
const vertices=[[0,-1],[-Math.sqrt(3)/2,.5],[Math.sqrt(3)/2,.5]];
// Independent integer RNG and Float32 storage, without importing the model.
function oracle(seed,jump,count){
 let rng=BigInt(seed),x=0,y=-1,previousX=x,previousY=y,last=0;
 const points=[];
 for(let i=0;i<count;i++){
  rng=(1664525n*rng+1013904223n)%4294967296n;last=Math.floor(Number(rng)/4294967296*3);
  previousX=x;previousY=y;x+=(vertices[last][0]-x)*jump/100;y+=(vertices[last][1]-y)*jump/100;
  points.push([Math.fround(x),Math.fround(y)]);
 }
 return {points,x,y,previousX,previousY,last};
}
function metric(h,width=7.2){h.el('canvas').getContext('2d').measureText=()=>({width});}
function check(h,{width=600,height=414,count=300,seed=14,jump=50,glyph=7.2,paused=true}={}){
 const m=oracle(seed,jump,count),draw=h.drawing(),scale=Math.min(width/2.1,height/1.85),cx=width/2,cy=height/2+scale*.25;
 const labels=draw.filter(c=>c[0]==='fillText'&&/^[ABC]$/.test(c[1]));assert.equal(labels.length,width>8?3:0);
 for(const [i,label] of labels.entries()){
  const [vx,vy]=vertices[i],normal=cx+vx*scale+(i===0?-4:i===1?-14:9),room=width-8;
  const reserve=Number.isFinite(glyph)&&glyph>0?glyph:12;
  assert.equal(label[1],'ABC'[i]);near(label[2],Math.max(4,Math.min(width-4-Math.min(reserve,room),normal)));
  near(label[3],cy+vy*scale+(i===0?-13:15));assert.equal(label[4],room);
  assert.ok(label[2]>=4&&label[2]+Math.min(reserve,room)<=width-4+1e-9,'full allowed glyph width stays inset');
 }
 const samples=draw.filter(c=>c[0]==='rect');assert.equal(samples.length,count);
 samples.forEach((p,i)=>{near(p[1],cx+m.points[i][0]*scale);near(p[2],cy+m.points[i][1]*scale);assert.deepEqual(p.slice(3),[1.3,1.3]);});
 const arcs=draw.filter(c=>c[0]==='arc');
 vertices.forEach(([vx,vy],i)=>{const a=arcs.slice(-3)[i];near(a[1],cx+vx*scale);near(a[2],cy+vy*scale);assert.equal(a[3],4);});
 if(paused){const from=arcs.find(a=>a[3]===5),to=arcs.find(a=>a[3]===4),chosen=arcs.find(a=>a[3]===8);near(from[1],cx+m.previousX*scale);near(from[2],cy+m.previousY*scale);near(to[1],cx+m.x*scale);near(to[2],cy+m.y*scale);near(chosen[1],cx+vertices[m.last][0]*scale);near(chosen[2],cy+vertices[m.last][1]*scale);}
 else assert.equal(arcs.length,3);
 assert.equal(h.el('metrics').textContent,`${count} 个点 · 前进 ${jump}% · 种子 ${seed}`);
 return labels;
}
const seek=(h,n)=>{h.el('fractal-count').value=String(n);click(h,'fractal-seek');};
const readings=h=>['metrics','fractal-touch-reading','fractal-jump-reading','fractal-gap-reading','observation-a','observation-b','observation-c','notes-count'].map(id=>h.el(id).textContent);

test('narrow Fractal labels fit the actual font while every seeded point stays fixed',async()=>{
 const h=await setup('?experiment=fractal');metric(h);h.resize(171,240);const labels=check(h,{width:171,height:240});
 const oldC=171/2+Math.sqrt(3)/2*(171/2.1)+9;assert.ok(oldC+7.2>171,'baseline C was clipped');
 const oldB=171/2-Math.sqrt(3)/2*(171/2.1)-14;assert.ok(oldB<4,'baseline B lacked the new inset');
 assert.equal(labels[1][2],4);near(labels[2][2],159.8);
});

test('ordinary label anchors, every vertex and the current jump retain exact geometry',async()=>{
 for(const [seed,jump,count] of [[14,50,300],[23,38,731],[99,70,12000],[1,35,301]]){
  const h=await setup(`?experiment=fractal&seed=${seed}&jump=${jump}&at=v1,${count}`);metric(h);h.resize(600,414);const labels=check(h,{seed,jump,count});
  const scale=Math.min(600/2.1,414/1.85);labels.forEach((p,i)=>near(p[2],300+vertices[i][0]*scale+(i===0?-4:i===1?-14:9)));
 }
});

test('fractional reflow and density keep CSS glyph insets without changing observations',async()=>{
 const h=await setup('?experiment=fractal&seed=23&jump=38&at=v1,731');metric(h);const before=readings(h),message=h.el('announcement').textContent;
 for(const [width,height] of [[150,240],[171,240],[195,240],[259,240],[350.3333435058594,240],[767,317.9375],[1200,560]])for(const dpr of [1,1.25,2,3]){
  h.resize(width,height);h.setDpr(dpr);check(h,{width,height,seed:23,jump:38,count:731});assert.deepEqual(readings(h),before);assert.equal(h.el('announcement').textContent,message);
 }
});

test('font advance and very narrow supported plots stay bounded with a maximum width',async()=>{
 const h=await setup('?experiment=fractal');
 for(const glyph of [4.75,7.2,12,20,NaN,0])for(const width of [7,8,9,16,28,171,195]){
  metric(h,glyph);h.resize(width,240);check(h,{width,height:240,glyph});
 }
});

test('one-point replay, exact targets and both limits retain the seeded next draw',async()=>{
 const h=await setup('?experiment=fractal&seed=23&jump=38&at=v1,731');metric(h);h.resize(171,240);
 const opts={seed:23,jump:38,width:171,height:240};check(h,{...opts,count:731});const before=h.drawing();
 click(h,'fractal-forward');check(h,{...opts,count:732});click(h,'fractal-back');assert.deepEqual(h.drawing(),before);
 h.key('ArrowRight');check(h,{...opts,count:732});h.key('ArrowLeft');assert.deepEqual(h.drawing(),before);
 seek(h,12000);check(h,{...opts,count:12000});click(h,'fractal-forward');check(h,{...opts,count:12000});seek(h,300);check(h,{...opts,count:300});click(h,'fractal-back');check(h,{...opts,count:300});
});

test('running and pause transitions move only model samples and retain full label names',async()=>{
 const h=await setup('?experiment=fractal','',false);metric(h);h.resize(195,240);check(h,{width:195,height:240,paused:false});
 h.tick(0);h.tick(50);h.tick(100);check(h,{width:195,height:240,count:400,paused:false});click(h,'pause');check(h,{width:195,height:240,count:400});
 const drawing=h.drawing();click(h,'pause');h.motion.change({matches:true});assert.deepEqual(h.drawing(),drawing);h.motion.change({matches:false});assert.equal(h.frames.size,0);
});

test('saved observation return and undo preserve full geometry and later continuation',async()=>{
 const h=await setup('?experiment=fractal&seed=23&jump=38&at=v1,731');metric(h);h.resize(171,240);const opts={seed:23,jump:38,width:171,height:240};
 click(h,'step');check(h,{...opts,count:831});const before=h.drawing();click(h,'observation-return');check(h,{...opts,count:731});click(h,'observation-undo');assert.deepEqual(h.drawing(),before);
 click(h,'fractal-forward');check(h,{...opts,count:832});await click(h,'share');const saved=h.el('share-link').value;assert.equal(new URL(saved).searchParams.get('at'),'v1,832');
 click(h,'fractal-forward');check(h,{...opts,count:833});assert.equal(h.el('share-link').value,saved);
 // Same-query history preserves live progress; a changed query restores its checkpoint.
 h.navigate(saved);check(h,{...opts,count:833});h.navigate('?experiment=fractal&seed=14&jump=50&at=v1,300');h.navigate(saved);check(h,{...opts,count:832});
});

test('retained worlds, focus and simulated display recovery keep labels and state',async()=>{
 const h=await setup('?experiment=fractal&at=v1,731');metric(h);h.resize(171,240);const before=h.drawing(),text=readings(h),message=h.el('announcement').textContent;
 h.el('fractal-forward').focus();h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();h.loseContext();h.restoreContext();h.setVisible(false);h.setVisible(true);h.setHidden(true);h.setHidden(false);
 assert.deepEqual(h.drawing(),before);assert.deepEqual(readings(h),text);assert.equal(h.el('announcement').textContent,message);assert.equal(document.activeElement,h.el('fractal-forward'));
 for(const world of ['orbit','life','wave','walk']){click(h,'tab-'+world);click(h,'tab-fractal');assert.deepEqual(h.drawing(),before);assert.deepEqual(readings(h),text);}
});

test('text-only startup and collapsed layout retain model state until drawing returns',async()=>{
 const h=await setup('?experiment=fractal&at=v1,731','',true,1,false);assert.equal(h.drawCount(),0);click(h,'fractal-forward');assert.match(h.el('metrics').textContent,/732 个点/);
 h.setContextReady(true);metric(h);click(h,'canvas-retry');h.resize(171,240);check(h,{count:732,width:171,height:240});const picture=h.drawing();
 h.resize(0,240);assert.ok(!h.drawing().some(c=>c[0]==='fillText'));h.resize(171,240);assert.deepEqual(h.drawing(),picture);
});

test('parameters, presets, reset and history never reuse stale vertex or jump geometry',async()=>{
 const h=await setup('?experiment=fractal&at=v1,12000');metric(h);h.resize(195,240);const opts={width:195,height:240};
 input(h,'jump',38);check(h,{...opts,jump:38});input(h,'seed',23);check(h,{...opts,jump:38,seed:23});
 h.el('preset-select').handlers.change({target:{value:'islands'}});click(h,'load-preset');check(h,{...opts,jump:65,seed:23});click(h,'fractal-1000');check(h,{...opts,jump:65,seed:23,count:1000});click(h,'reset');check(h,{...opts,jump:65,seed:23});
 h.navigate('?experiment=fractal&seed=14&jump=50&at=v1,731');check(h,{...opts,count:731});click(h,'guide-start');check(h,opts);
});

test('discovery evidence, capture requests and intentional batch repeats remain intact',async()=>{
 const h=await setup('?experiment=fractal');metric(h);h.resize(171,240);const opts={width:171,height:240};click(h,'mission-start');click(h,'fractal-1000');click(h,'mission-check');input(h,'seed',15);click(h,'fractal-1000');click(h,'mission-check');
 assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;check(h,{...opts,seed:15,count:1000});let captured=false;
 h.el('canvas').toBlob=cb=>{captured=true;check(h,{...opts,seed:15,count:1000});cb(null);};click(h,'save');assert.ok(captured);
 for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional batch repeat blocked');}});click(h,'step');}
 check(h,{...opts,seed:15,count:1200});assert.equal(h.el('notes-text').value,notes);click(h,'tab-walk');
 for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional walk batch repeat blocked');}});click(h,'step');}assert.match(h.el('metrics').textContent,/48 步/);
});

test('the labels-only update versions the application without changing external assets',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.ok(html.includes('&amp;vertex-label=inset-1'));assert.ok(html.includes('style.css?v=saved-observation-copy-1'));
});
