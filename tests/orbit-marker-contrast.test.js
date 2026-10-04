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
 });
 return result;
}
function bodies(h){
 const s=scale(h);
 return paint(h.drawing()).filter(p=>p.name==='fill'&&p.path.length===1&&p.path[0][0]==='arc'&&Math.abs(p.path[0][3]*s-4.5)<1e-8);
}
function marker(h){
 const [first]=bodies(h);if(!first)return null;
 const [,x,y]=first.path[0],s=scale(h),size=9/s;
 const expected=[['moveTo',x,y-size],['lineTo',x+size,y],['lineTo',x,y+size],['lineTo',x-size,y],['closePath']];
 const all=paint(h.drawing()),i=all.findIndex(p=>p.name==='stroke'&&p.style.strokeStyle==='#e7eee1'&&JSON.stringify(p.path)===JSON.stringify(expected));
 return i<0?null:{white:all[i],edge:all[i-1],expected,s};
}
function check(h){
 const m=marker(h);assert.ok(m,'visible first planet retains its exact diamond');
 assert.equal(m.edge.name,'stroke');assert.equal(m.edge.style.strokeStyle,'#122e29');
 assert.deepEqual(m.edge.path,m.expected);assert.deepEqual(m.white.path,m.expected);
 near(m.edge.style.lineWidth*m.s,4.5);near(m.white.style.lineWidth*m.s,1.5);
 assert.deepEqual(m.edge.style.dash,[]);assert.deepEqual(m.white.style.dash,[]);
 assert.ok(m.edge.index>bodies(h).at(-1).index,'casing and foreground paint above every planet');
 const segment=h.drawing().slice(m.edge.index-8,m.white.index+1);
 assert.ok(!segment.some(c=>c[0]==='fill'),'diamond stays hollow');
 return m;
}
function luminance(hex){
 const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return .2126*c[0]+.7152*c[1]+.0722*c[2];
}
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
const model=h=>({bodies:bodies(h),metrics:h.el('metrics').textContent,measured:h.el('orbit-measured-reading').textContent,radial:h.el('orbit-radial-reading').textContent,launch:h.el('orbit-touch-reading').textContent,url:location.href,notes:h.el('notes-text').value,mission:h.el('mission-result').textContent});
const positions=h=>bodies(h).map(p=>p.path[0].slice(1,3));
function launchOverlap(h,n=5){
 const r=h.el('canvas').getBoundingClientRect(),s=scale(h);
 for(let i=0;i<n;i++)h.el('canvas').handlers.click({detail:1,clientX:r.width/2+75*s+4.5,clientY:r.height/2-4.5});
 click(h,'orbit-home');
}

test('an ordinary overlapping planet cannot merge with the first-planet diamond',async()=>{
 const h=await setup('?experiment=orbit');launchOverlap(h,1);
 const m=check(h),p=bodies(h).at(-1),[,x,y]=p.path[0];
 near((x-75)*m.s,4.5);near(y*m.s,-4.5);
 assert.equal(p.style.fillStyle,'#87c2b1');
 assert.ok(contrast(m.white.style.strokeStyle,p.style.fillStyle)<2,'original white-only mark has poor contrast');
 assert.ok(contrast(m.edge.style.strokeStyle,p.style.fillStyle)>7);
 assert.equal(h.el('metrics').textContent,'4 颗行星 · t + 0.0 s');
 assert.equal(h.el('orbit-measured-reading').textContent,'首颗行星 · 距中心 75.0 · 速率 32.7');
});

test('a same-color eighth planet and all five fills retain a contrasting edge',async()=>{
 const h=await setup('?experiment=orbit');launchOverlap(h);const m=check(h),p=bodies(h).at(-1);
 assert.equal(p.style.fillStyle,m.white.style.strokeStyle);assert.equal(contrast(p.style.fillStyle,m.white.style.strokeStyle),1);
 assert.equal(bodies(h).length,8);
 for(const color of ['#d3f35b','#f59c80','#e7eee1','#87c2b1','#c7b1e8']){
  assert.ok(contrast(m.white.style.strokeStyle,color)<2);assert.ok(contrast(m.edge.style.strokeStyle,color)>6);
 }
 assert.ok(contrast(m.white.style.strokeStyle,m.edge.style.strokeStyle)>12);
});

test('pixel widths and diamond coordinates survive narrow, fractional, wide and density redraws',async()=>{
 const h=await setup('?experiment=orbit');launchOverlap(h);const before=positions(h),reading=h.el('orbit-measured-reading').textContent,url=location.href;
 for(const [w,z] of [[259,240],[284.5,260.25],[600,414],[1200,560]])for(const dpr of [1,1.25,2,3]){
  h.resize(w,z);h.setDpr(dpr);check(h);
  assert.deepEqual(positions(h),before);assert.equal(h.el('orbit-measured-reading').textContent,reading);assert.equal(location.href,url);
 }
});

test('running motion, stepping and pausing track the real first body without new announcements',async()=>{
 const h=await setup('?experiment=orbit');launchOverlap(h);check(h);click(h,'pause');check(h);
 const message=h.el('announcement').textContent,before=positions(h);h.tick(0);
 for(let i=1;i<=20;i++){h.tick(i*50);check(h);assert.equal(h.el('announcement').textContent,message);}
 assert.notDeepEqual(positions(h),before);assert.equal(h.frames.size,1);
 click(h,'step');check(h);assert.equal(h.frames.size,0);assert.match(h.el('metrics').textContent,/t \+ 1\.1 s/);
});

test('offscreen, collapsed and unavailable canvases do not invent edge-clamped markers',async()=>{
 const h=await setup('?experiment=orbit');h.el('preset-select').handlers.change({target:{value:'escape'}});click(h,'load-preset');
 for(let i=0;i<300;i++)click(h,'step');assert.equal(marker(h),null);assert.match(h.el('orbit-measured-reading').textContent,/画外/);
 const before=positions(h);click(h,'orbit-fit');check(h);assert.deepEqual(positions(h),before);
 for(const [w,z] of [[0,414],[600,0],[20,20]]){h.resize(w,z);assert.equal(marker(h),null);}
 h.resize(600,414);check(h);
 const textOnly=await setup('?experiment=orbit','',true,1,false);assert.equal(textOnly.drawCount(),0);assert.match(textOnly.el('orbit-measured-reading').textContent,/距中心 75\.0/);
 textOnly.setContextReady(true);click(textOnly,'canvas-retry');check(textOnly);
});

test('context recovery, focus and retained worlds keep the exact casing without changing the experiment',async()=>{
 const h=await setup('?experiment=orbit');launchOverlap(h);const drawing=h.drawing(),before=model(h),message=h.el('announcement').textContent;
 h.el('orbit-right').focus();h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();h.loseContext();h.restoreContext();
 h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);
 assert.deepEqual(h.drawing(),drawing);assert.deepEqual(model(h),before);assert.equal(h.el('announcement').textContent,message);assert.equal(document.activeElement,h.el('orbit-right'));check(h);
 for(const world of ['life','wave','fractal','walk']){click(h,'tab-'+world);click(h,'tab-orbit');check(h);assert.deepEqual(h.drawing(),drawing);assert.deepEqual(model(h),before);}
});

test('recall, parameter-only sharing, reset and presets retain their existing model semantics',async()=>{
 const h=await setup('?experiment=orbit');launchOverlap(h);const before=positions(h);await click(h,'share');
 assert.deepEqual(positions(h),before);assert.equal(new URL(h.el('share-link').value).searchParams.has('at'),false);check(h);
 click(h,'orbit-recall');assert.equal(bodies(h).length,7);check(h);click(h,'orbit-recall');assert.equal(bodies(h).length,7);
 click(h,'reset');assert.equal(bodies(h).length,3);check(h);
 h.el('preset-select').handlers.change({target:{value:'elliptic'}});click(h,'load-preset');check(h);assert.match(h.el('orbit-measured-reading').textContent,/速率 21\.2/);
});

test('discovery evidence remains tied to model measurements and capture uses the same cased canvas',async()=>{
 const h=await setup('?experiment=orbit');click(h,'mission-start');click(h,'mission-check');h.el('gravity').handlers.input({target:{value:'40'}});
 for(let i=0;i<150;i++)click(h,'step');click(h,'orbit-fit');check(h);assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const notes=h.el('notes-text').value,feedback=h.el('mission-result').textContent;h.resize(259,240);click(h,'orbit-fit');check(h);
 let captured=false;h.el('canvas').toBlob=callback=>{captured=true;check(h);callback(new Blob(['png']));};await click(h,'save');assert.ok(captured);
 assert.equal(h.el('notes-text').value,notes);assert.equal(h.el('mission-result').textContent,feedback);
});

test('isolated marker draws only two strokes on the original path and restores caller styles',()=>{
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8'),start=source.indexOf('function drawOrbitMeasuredMarker('),end=source.indexOf('function drawOrbitMeasurementLegend(',start),fn=source.slice(start,end);
 for(const [s,visible] of [[.1,true],[1,true],[2,true],[1,false],[0,true]]){
  const commands=[],ctx=new Proxy({}, {get:(_,name)=>(...args)=>commands.push([name,...args]),set:(_,name,value)=>(commands.push([name,value]),true)}),body={x:21,y:-73},before={...body};
  const draw=new Function('bodies','ctx','orbitMeasuredBodyVisible',fn+'; return drawOrbitMeasuredMarker;')([body],ctx,()=>visible);draw(s);
  assert.deepEqual(body,before);
  if(!visible||s<=0){assert.equal(commands.length,0);continue;}
  assert.equal(commands[0][0],'save');assert.equal(commands.at(-1)[0],'restore');assert.equal(commands.filter(c=>c[0]==='stroke').length,2);assert.ok(!commands.some(c=>c[0]==='fill'));
  const strokes=paint(commands);assert.deepEqual(strokes[0].path,strokes[1].path);near(strokes[0].style.lineWidth*s,4.5);near(strokes[1].style.lineWidth*s,1.5);
 }
});


test('the updated marker has an explicit cache key without new controls or messages',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const src=html.match(/<script type="module" src="(app\.js\?[^"]+)"/)?.[1];assert.ok(src);
 assert.equal(new URL(src.replaceAll('&amp;','&'),'https://example.org').searchParams.get('orbit-marker'),'contrast-1');
});
