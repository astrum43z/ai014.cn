import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';
const click=(h,id)=>h.el(id).handlers.click();
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
const readings=h=>['metrics','wave-position-current','wave-time-current','wave-instant-reading','wave-probe-reading','wave-distances','wave-difference','wave-envelope','notes-count'].map(id=>h.el(id).textContent);
function position(h,x,y){for(const [axis,value] of [['x',x],['y',y]]){h.el('wave-target-'+axis).value=String(value);h.el('wave-target-'+axis).handlers.input();}click(h,'wave-position');}
const overlap=(x,y,p)=>x+16.5>=p[1]&&x-16.5<=p[1]+p[3]&&y+16.5>=p[2]&&y-16.5<=p[2]+p[4];
function check(h,x,y,t=0,wavelength=32,separation=100,view={x,y}){
 const r=h.el('canvas').getBoundingClientRect(),scale=Math.min(Math.min(r.width,r.height)/280,(r.width/2-18)/Math.max(1,Math.abs(view.x)),(r.height/2-18)/Math.max(1,Math.abs(view.y)));
 const ops=h.drawing(),arcs=ops.filter(c=>c[0]==='arc'),probe=arcs.find(c=>c[3]===9),plate=ops.find(c=>c[0]==='fillRect'&&c[3]===132&&c[4]===46);
 near(probe[1],r.width/2+x*scale);near(probe[2],r.height/2+y*scale);assert.equal(arcs.length,3);
 for(const [i,sign] of [-1,1].entries()){near(arcs[i][1],r.width/2+sign*separation/2*scale);near(arcs[i][2],r.height/2);assert.equal(arcs[i][3],4);}
 const left=Math.hypot(x+separation/2,y),right=Math.hypot(x-separation/2,y),value=(Math.sin(left/wavelength*2*Math.PI-t*3)+Math.sin(right/wavelength*2*Math.PI-t*3))/2,rounded=Math.abs(value)<.005?0:value;
 assert.equal(h.el('wave-instant-reading').textContent,'探针此刻 (A+B)/2 · '+(rounded>0?'+':'')+rounded.toFixed(2));
 assert.equal(h.el('wave-distances').textContent,`A 路程 ${left.toFixed(2)} · B 路程 ${right.toFixed(2)}`);
 if(plate){
  assert.ok(!overlap(probe[1],probe[2],plate),'ruler must clear the whole probe casing');assert.ok(plate[1]>=16&&plate[1]+plate[3]<=r.width-16);near(plate[2],r.height-56);
  const label=ops.find(c=>c[0]==='fillText'&&/ 模型单位$/.test(c[1])),units=Number(label[1].split(' ')[0]),after=ops.slice(ops.indexOf(label)+1),line=after.find(c=>c[0]==='lineTo');
  near(label[2],plate[1]+8);near(label[3],r.height-33);near(line[1]-label[2],units*scale);near(line[2],r.height-21);assert.ok(units*scale>31.99&&units*scale<=80.0000001);
  assert.match(h.el('wave-scale-reading').textContent,new RegExp('^'+(plate[1]===16?'左下':'右下')+'标尺：'));
  assert.ok(ops.indexOf(probe)>ops.indexOf(plate),'probe paint priority stays unchanged');
 }else assert.match(h.el('wave-scale-reading').textContent,/^标尺暂隐以留出画面；/);
 assert.equal(h.el('wave-scale-reading').textContent.includes('色场暂隐'),wavelength*scale<=10);
 return {ops,plate,probe,scale};
}
function isolated(px,py,width=647,height=317.9375,scale=1){
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8'),fn=source.slice(source.indexOf('function drawWaveScale('),source.indexOf('// Dual-tone markers'));
 const ops=[],reading={textContent:''},ctx=new Proxy({}, {get:(_,k)=>(...args)=>ops.push([k,...args]),set:(_,k,v)=>(ops.push([k,v]),true)});
 new Function('ctx','width','height','probe','waveFieldTooDense','$','setReadingText',fn+';drawWaveScale('+scale+');')(ctx,width,height,{x:(px-width/2)/scale,y:(py-height/2)/scale},s=>32*s<=10,()=>reading,(el,text)=>el.textContent=text);
 return {ops,plate:ops.find(c=>c[0]==='fillRect'),reading:reading.textContent};
}

test('public probe collision relocates only the ruler and preserves exact source/probe readings',async()=>{
 const h=await setup('?experiment=wave&at=v1,-240,110,0');h.resize(647,317.9375);const g=check(h,-240,110);
 near(g.plate[1],499);near(g.probe[1],50.98214285714283);near(g.probe[2],283.8727678571429);
 assert.match(h.el('wave-scale-reading').textContent,/^右下标尺：50 模型单位/);assert.equal(h.el('status').textContent,'已暂停');
});

test('inclusive casing edges relocate and just-clear positions preserve the ordinary corner',()=>{
 for(const [x,y,moved] of [[-.5,280,true],[164.5,280,true],[80,245.4375,true],[80,324.4375,true],[-.501,280,false],[164.501,280,false],[80,245.4365,false],[80,324.4385,false]])near(isolated(x,y).plate[1],moved?499:16);
 near(isolated(550,280).plate[1],16);assert.equal(isolated(80,210,171,240).plate,undefined);
 assert.equal(isolated(300,100,163,240).plate,undefined);near(isolated(300,100,164,240).plate[1],16);
 assert.equal(isolated(300,100,647,65).plate,undefined);near(isolated(300,100,647,66).plate[1],16);
});

test('ruler translation preserves exact backing, font, ticks, units and isolated styles',()=>{
 const a=isolated(80,280),b=isolated(400,100),normalize=g=>g.ops.map(c=>['fillText','fillRect','moveTo','lineTo'].includes(c[0])?[c[0],...c.slice(1).map((v,i)=>typeof v==='number'&&i===(c[0]==='fillText'?1:0)?v-(g.plate[1]-16):v)]:c);
 assert.deepEqual(normalize(a),normalize(b));assert.equal(a.ops[0][0],'save');assert.equal(a.ops.at(-1)[0],'restore');assert.ok(a.ops.some(c=>c[0]==='font'&&c[1]==='11px sans-serif'));
 assert.ok(a.ops.some(c=>c[0]==='fillStyle'&&c[1]==='#122e29e6'));assert.equal(a.ops.filter(c=>c[0]==='stroke').length,1);
 const no=isolated(80,210,171,240);assert.deepEqual(no.ops,[]);assert.match(no.reading,/标尺暂隐/);
 assert.equal(isolated(300,100,647,318,0).reading,'');
});

test('narrow, fractional and dense views keep every exact measurement and sampling warning',async()=>{
 for(const [x,y] of [[-240,110],[-10000,10000],[10000,10000],[0,10000]]){
  const h=await setup(`?experiment=wave&at=v1,${x},${y},2.5`),before=readings(h),message=h.el('announcement').textContent;
  for(const [w,z] of [[163,240],[171,240],[259.5,240.25],[647,317.9375],[1200,560]])for(const dpr of [1,1.25,2,3]){h.resize(w,z);h.setDpr(dpr);check(h,x,y,2.5);assert.deepEqual(readings(h),before);assert.equal(h.el('announcement').textContent,message);}
 }
});

test('repeated idle redraws keep reading nodes, focus and current experiment intact',async()=>{
 const h=await setup('?experiment=wave&at=v1,-240,110,0');h.resize(647,317.9375);const el=h.el('wave-scale-reading');let value=el.textContent,writes=0;Object.defineProperty(el,'textContent',{get:()=>value,set:text=>{writes++;value=text;}});
 const before=readings(h),drawing=h.drawing(),message=h.el('announcement').textContent;h.el('wave-position').focus();
 for(let n=0;n<100;n++)h.resize(647,317.9375);h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();
 assert.equal(writes,0);assert.deepEqual(h.drawing(),drawing);assert.deepEqual(readings(h),before);assert.equal(h.el('announcement').textContent,message);assert.equal(document.activeElement,h.el('wave-position'));
});

test('exact targets, arrows, Home, validation and keyboard exclusions preserve input semantics',async()=>{
 const h=await setup('?experiment=wave');h.resize(647,317.9375);position(h,-240,110);check(h,-240,110);
 h.key('ArrowRight');check(h,-238,110,0,32,100,{x:-240,y:110});h.key('Home');check(h,0,0);position(h,-240,110);
 for(const extra of [{repeat:true},{isComposing:true},{keyCode:229},{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true}]){h.el('wave-target-x').value='0';h.el('wave-target-x').handlers.keydown({key:'Enter',preventDefault(){},...extra});check(h,-240,110);}
 h.el('wave-target-x').value='bad';click(h,'wave-position');check(h,-240,110);assert.equal(h.el('wave-target-x').getAttribute('aria-invalid'),'true');
 click(h,'wave-home');check(h,0,0);position(h,240,110);assert.equal(check(h,240,110).plate[1],16);
});

test('phase stepping and animation retain ruler placement and independently evaluated waves',async()=>{
 const h=await setup('?experiment=wave&at=v1,-240,110,0');h.resize(647,317.9375);
 for(let n=1;n<=4;n++){click(h,'step');check(h,-240,110,n*Math.PI/6);}for(let n=3;n>=0;n--){click(h,'wave-back');check(h,-240,110,n*Math.PI/6);}
 const reading=h.el('wave-scale-reading').textContent;click(h,'pause');h.tick(0);h.tick(50);check(h,-240,110,.05);assert.equal(h.el('wave-scale-reading').textContent,reading);click(h,'pause');assert.equal(h.frames.size,0);
});

test('parameter changes update physical field without corrupting exact retained probe or ruler',async()=>{
 const h=await setup('?experiment=wave&at=v1,-240,110,.125');h.resize(647,317.9375);
 for(const wavelength of [15,32,70])for(const separation of [20,100,180]){h.el('wavelength').handlers.input({target:{value:String(wavelength)}});h.el('separation').handlers.input({target:{value:String(separation)}});check(h,-240,110,.125,wavelength,separation);}
 click(h,'reset');check(h,0,0,0,70,180);h.el('preset-select').handlers.change({target:{value:'wide'}});click(h,'load-preset');assert.equal(h.el('wave-position-current').textContent,'当前探针 · x 0，y 0');
});

test('fixed observation return, undo, same-query navigation and retained worlds preserve full observations',async()=>{
 const h=await setup('?experiment=wave&at=v1,-240,110,2.5','#canvas');h.resize(647,317.9375);const url=location.href,saved=readings(h);click(h,'wave-home');const home=readings(h);
 click(h,'observation-return');check(h,-240,110,2.5);assert.deepEqual(readings(h),saved);click(h,'observation-undo');assert.deepEqual(readings(h),home);assert.equal(location.href,url);
 for(const world of ['orbit','life','fractal','walk']){click(h,'tab-'+world);click(h,'tab-wave');assert.deepEqual(readings(h),home);}
 h.navigate(url.replace('#canvas','#observation-title'));assert.deepEqual(readings(h),home);h.navigate('?experiment=wave&at=v1,-240,110,.125');check(h,-240,110,.125);
});

test('simulated display and context interruptions preserve exact probe and quiet feedback',async()=>{
 const h=await setup('?experiment=wave&at=v1,-240,110,0');h.resize(647,317.9375);const before=readings(h),drawing=h.drawing(),message=h.el('announcement').textContent;
 h.loseContext();h.restoreContext();h.setVisible(false);h.setVisible(true);h.setHidden(true);h.setHidden(false);assert.deepEqual(readings(h),before);assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('announcement').textContent,message);
 h.resize(0,0);assert.equal(h.el('wave-scale-reading').textContent,'');h.resize(647,317.9375);check(h,-240,110);assert.deepEqual(h.drawing(),drawing);
});

test('text-only startup retains exact observation until drawing becomes available',async()=>{
 const h=await setup('?experiment=wave&at=v1,-240,110,0','',true,1,false);assert.equal(h.drawCount(),0);assert.equal(h.el('wave-scale-reading').textContent,'');click(h,'step');assert.match(h.el('metrics').textContent,/t \+ 0.5 s/);
 h.setContextReady(true);click(h,'canvas-retry');h.resize(647,317.9375);check(h,-240,110,Math.PI/6);
});

test('discoveries, capture requests and intentional Fractal/Walk batch repeats stay unchanged',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');click(h,'mission-check');click(h,'wave-home');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('notes-text').value;
 position(h,-240,110);h.resize(647,317.9375);check(h,-240,110,0,32,100);let captured=false;h.el('canvas').toBlob=cb=>{captured=true;check(h,-240,110,0,32,100);cb(null);};click(h,'save');assert.ok(captured);assert.equal(h.el('notes-text').value,notes);
 for(const [world,end] of [['fractal','500 个点'],['walk','48 步']]){click(h,'tab-'+world);for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional repeat suppressed');}});click(h,'step');}assert.ok(h.el('metrics').textContent.includes(end));}
});
