import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
const scale=h=>h.drawing().find(c=>c[0]==='scale')?.[1];
function paint(commands){
 let style={},path=[];const stack=[],result=[];
 commands.forEach(([name,...args],index)=>{
  if(name==='save')stack.push({...style});else if(name==='restore')style=stack.pop();
  else if(['strokeStyle','fillStyle','lineWidth'].includes(name))style[name]=args[0];
  else if(name==='setLineDash')style.dash=args[0];
  else if(name==='beginPath')path=[];
  else if(['moveTo','lineTo','closePath','arc'].includes(name))path.push([name,...args]);
  else if(name==='stroke'||name==='fill')result.push({name,index,style:{...style},path:structuredClone(path)});
 });return result;
}
function bodies(h){const s=scale(h);return paint(h.drawing()).filter(p=>p.name==='fill'&&p.path.length===1&&p.path[0][0]==='arc'&&Math.abs(p.path[0][3]*s-4.5)<1e-8).map(p=>({point:p.path[0].slice(1,3),color:p.style.fillStyle}));}
function position(h,x,y){h.el('orbit-target-x').value=String(x);h.el('orbit-target-y').value=String(y);click(h,'orbit-position-apply');}
function expectedPaths(x,y,s){
 const ring=[['arc',x,y,8/s,0,Math.PI*2]],r=Math.hypot(x,y);
 if(r<22)return [ring,[['moveTo',x-5/s,y-5/s],['lineTo',x+5/s,y+5/s],['moveTo',x-5/s,y+5/s],['lineTo',x+5/s,y-5/s]]];
 const dx=-y/r,dy=x/r,endX=x+dx*27/s,endY=y+dy*27/s;
 return [ring,[['moveTo',x+dx*11/s,y+dy*11/s],['lineTo',endX,endY],['lineTo',endX-(dx*6-dy*4)/s,endY-(dy*6+dx*4)/s],['moveTo',endX,endY],['lineTo',endX-(dx*6+dy*4)/s,endY-(dy*6-dx*4)/s]]];
}
function check(h,x,y){
 const s=scale(h),all=paint(h.drawing()),paths=expectedPaths(x,y,s);
 const i=all.findIndex(p=>p.name==='stroke'&&p.style.strokeStyle==='#ffac86'&&JSON.stringify(p.path)===JSON.stringify(paths[0]));assert.ok(i>0,'launcher has an orange foreground');
 const pair=all.slice(i-1,i+3);assert.equal(pair.length,4);
 for(let n=0;n<2;n++)for(let layer=0;layer<2;layer++){
  const p=pair[n*2+layer];assert.equal(p.name,'stroke');assert.deepEqual(p.path,paths[n]);assert.equal(p.style.strokeStyle,layer?'#ffac86':'#122e29');near(p.style.lineWidth*s,layer?1.5:4.5);assert.deepEqual(p.style.dash,[]);
 }
 const lastBody=all.findLast(p=>p.name==='fill'&&p.path.length===1&&p.path[0][0]==='arc'&&Math.abs(p.path[0][3]*s-4.5)<1e-8);
 assert.ok(pair[0].index>lastBody.index,'both marker paths stay above planets');
 return pair;
}
function contrast(a,b){const L=h=>h.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);return (Math.max(L(a),L(b))+.05)/(Math.min(L(a),L(b))+.05);}
const state=h=>({bodies:bodies(h),metrics:h.el('metrics').textContent,readings:['orbit-position','orbit-speed','orbit-preview-reading','orbit-measured-reading','orbit-radial-reading','orbit-recall-status','mission-result','notes-text'].map(id=>[h.el(id).textContent,h.el(id).value]),url:location.href});

test('launch ring retains a dark edge where it crosses the orange second planet',async()=>{
 const h=await setup('?experiment=orbit'),s=scale(h);position(h,125,-8/s);const p=check(h,125,-8/s),second=bodies(h)[1];
 assert.deepEqual(second.point,[125,0]);near(p[1].path[0][2]*s+8,0);assert.ok(contrast('#ffac86',second.color)<1.2);assert.ok(contrast('#122e29',second.color)>6);assert.equal(h.el('metrics').textContent,'3 颗行星 · t + 0.0 s');
});

test('direction arrow retains the same path when crossing another planet',async()=>{
 const h=await setup('?experiment=orbit'),s=scale(h);position(h,140,18/s);click(h,'orbit-fire');position(h,140,0);const p=check(h,140,0),last=bodies(h).at(-1);
 near(last.point[1]*s,18);assert.equal(p[3].path[0][2]*s,11);assert.equal(p[3].path[1][2]*s,27);assert.equal(bodies(h).length,4);
 for(const color of ['#d3f35b','#f59c80','#e7eee1','#87c2b1','#c7b1e8'])assert.ok(contrast('#122e29',color)>6);
 assert.ok(contrast('#122e29','#ffac86')>7);
});

test('invalid-center cross and ring remain hollow at their exact model coordinates',async()=>{
 const h=await setup('?experiment=orbit');for(const [x,y] of [[0,0],[10,-8],[21.999,0],[22,0]]){position(h,x,y);check(h,x,y);assert.equal(h.el('orbit-fire').getAttribute('aria-disabled'),String(Math.hypot(x,y)<22));assert.equal(bodies(h).length,3);}
});

test('public baseline size, fitted distant views and density changes preserve exact paths and CSS widths',async()=>{
 const h=await setup('?experiment=orbit');
 for(const [x,y] of [[125,-11.322980145468842],[-137.5,42.5],[10000,-10000]]){
  position(h,x,y);const before=state(h),message=h.el('announcement').textContent;
  for(const [w,z] of [[171,240],[259,240],[284.5,260.25],[600,414],[767,317.9375],[1200,560]])for(const dpr of [1,1.25,2,3]){h.resize(w,z);h.setDpr(dpr);check(h,x,y);assert.deepEqual(state(h),before);assert.equal(h.el('announcement').textContent,message);}
 }
});

test('running, paused, stepped and capped worlds keep the same selected marker',async()=>{
 const h=await setup('?experiment=orbit');position(h,125,-8/scale(h));click(h,'pause');const message=h.el('announcement').textContent;h.tick(0);
 for(let i=1;i<=8;i++){h.tick(i*50);check(h,125,-8/(414/450));assert.equal(h.el('announcement').textContent,message);}
 click(h,'step');check(h,125,-8/(414/450));assert.equal(h.frames.size,0);click(h,'reset');for(let i=0;i<21;i++)click(h,'orbit-fire');check(h,140,0);assert.equal(h.el('orbit-fire').getAttribute('aria-disabled'),'true');click(h,'orbit-recall');check(h,140,0);assert.equal(bodies(h).length,23);
});

test('focus, context recovery, retained worlds and unchanged redraws preserve model and marker',async()=>{
 const h=await setup('?experiment=orbit');position(h,125,-8/scale(h));click(h,'orbit-fire');const before=state(h),drawing=h.drawing(),message=h.el('announcement').textContent;
 h.el('orbit-right').focus();h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();h.loseContext();h.restoreContext();h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);
 for(let i=0;i<10;i++)h.resize(600,414);assert.deepEqual(state(h),before);assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('announcement').textContent,message);assert.equal(document.activeElement,h.el('orbit-right'));
 for(const world of ['life','wave','fractal','walk']){click(h,'tab-'+world);click(h,'tab-orbit');assert.deepEqual(state(h),before);assert.deepEqual(h.drawing(),drawing);}
});

test('no usable bitmap or scale paints no misleading marker; text and recovery stay available',async()=>{
 const h=await setup('?experiment=orbit','',true,1,false);position(h,137.5,-42.5);assert.equal(h.drawCount(),0);assert.match(h.el('orbit-position-current').textContent,/137.5/);h.setContextReady(true);click(h,'canvas-retry');check(h,137.5,-42.5);
 for(const [w,z] of [[0,414],[600,0],[20,20]]){h.resize(w,z);assert.ok(!paint(h.drawing()).some(p=>p.path[0]?.[0]==='arc'&&p.style.strokeStyle==='#ffac86'));}
 h.resize(600,414);check(h,137.5,-42.5);
});

test('launch velocity and continued bodies match an independent scalar integration',async()=>{
 const h=await setup('?experiment=orbit&gravity=30&speed=65');position(h,137.5,-42.5);click(h,'orbit-fire');check(h,137.5,-42.5);
 let x=137.5,y=-42.5,r=Math.hypot(x,y),v=Math.sqrt(30000/r)*.65,vx=-y/r*v,vy=x/r*v;
 for(let i=0;i<10;i++){const d=Math.max(Math.hypot(x,y),18);vx-=30000*x/(d*d*d)*.01;vy-=30000*y/(d*d*d)*.01;x+=vx*.01;y+=vy*.01;}
 click(h,'step');const actual=bodies(h).at(-1).point;near(actual[0],x);near(actual[1],y);check(h,137.5,-42.5);click(h,'orbit-recall');assert.equal(bodies(h).length,3);
});

test('sharing, discoveries and capture requests keep their original semantics',async()=>{
 const h=await setup('?experiment=orbit');click(h,'mission-start');click(h,'mission-check');position(h,125,-8/scale(h));assert.equal(h.el('notes-count').textContent,'0 / 5');h.el('gravity').handlers.input({target:{value:'40'}});for(let i=0;i<80;i++)click(h,'step');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const before=state(h);
 await click(h,'share');assert.equal(new URL(h.el('share-link').value).searchParams.has('at'),false);assert.deepEqual(state(h),before);
 let captured=false;h.el('canvas').toBlob=cb=>{captured=true;check(h,125,-8/(414/450));cb(new Blob(['png']));};click(h,'save');assert.ok(captured);assert.deepEqual(state(h),before);
});

test('isolated launcher adds only two casing strokes and restores caller styling',()=>{
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8'),fn=source.slice(source.indexOf('function drawOrbitLauncher('),source.indexOf("canvas.addEventListener('focus'"));
 for(const s of [.01,.1,1,2])for(const point of [{x:125,y:-8/s},{x:-42.5,y:137.5},{x:0,y:0}]){
  const commands=[],ctx=new Proxy({}, {get:(_,name)=>(...args)=>commands.push([name,...args]),set:(_,name,value)=>(commands.push([name,value]),true)}),before={...point};
  const draw=new Function('ctx','orbitPoint','values','orbitLaunchState',fn+';return drawOrbitLauncher;')(ctx,point,{gravity:80,speed:100},p=>({valid:Math.hypot(p.x,p.y)>=22,radius:Math.hypot(p.x,p.y)}));draw(s);
  assert.deepEqual(point,before);assert.equal(commands[0][0],'save');assert.equal(commands.at(-1)[0],'restore');assert.equal(commands.filter(c=>c[0]==='stroke').length,4);assert.ok(!commands.some(c=>['fill','fillRect','fillText'].includes(c[0])));
  const strokes=paint(commands),paths=expectedPaths(point.x,point.y,s);for(let n=0;n<4;n++){assert.deepEqual(strokes[n].path,paths[Math.floor(n/2)]);assert.equal(strokes[n].style.strokeStyle,n%2?'#ffac86':'#122e29');near(strokes[n].style.lineWidth*s,n%2?1.5:4.5);}
 }
});

test('the public module has an explicit launcher contrast cache key',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),src=html.match(/<script type="module" src="(app\.js\?[^"]+)"/)?.[1];assert.ok(src);assert.equal(new URL(src.replaceAll('&amp;','&'),'https://example.org').searchParams.get('launcher'),'contrast-1');
});
