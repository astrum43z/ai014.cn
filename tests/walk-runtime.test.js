import test from 'node:test';
import assert from 'node:assert/strict';
let instance=0;
async function setup(search='',hash=''){
let drawCount=0,frameId=0,intersect,strokes=[],path=[],dash=[];const frames=new Map(),documentHandlers={};const tick=now=>{const [id,callback]=frames.entries().next().value;frames.delete(id);callback(now);};const els=new Map();const noop=()=>{};const ctx=new Proxy({clearRect:()=>{drawCount++;strokes=[];},beginPath:()=>path=[],moveTo:(x,y)=>path.push(['M',x,y]),lineTo:(x,y)=>path.push(['L',x,y]),arc:(x,y,r)=>path.push(['A',x,y,r]),setLineDash:value=>dash=[...value],stroke:()=>strokes.push({color:ctx.strokeStyle,dash:[...dash],path:[...path]}),createRadialGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||noop,set:(t,k,v)=>(t[k]=v,true)});function el(id){if(!els.has(id))els.set(id,{id,value:'',textContent:'',hidden:false,handlers:{},dataset:{},classList:{toggle:noop},setAttribute:noop,focus:noop,select:noop,append:noop,remove:noop,click:noop,addEventListener(n,f){this.handlers[n]=f},getBoundingClientRect:()=>({width:600,height:414,left:0,top:0}),getContext:()=>ctx,setPointerCapture:noop,toBlob:f=>f(new Blob(['png']))});return els.get(id)}const tabs=['orbit','life','wave','fractal','walk'].map(m=>{const t=el('tab-'+m);t.dataset.mode=m;return t});globalThis.document={querySelector:s=>el(s.slice(1)),querySelectorAll:()=>tabs,createElement:()=>el('generated'),body:{append:noop},hidden:false,addEventListener:(name,callback)=>documentHandlers[name]=callback};const motion={matches:true,addEventListener:(name,handler)=>motion.change=handler};globalThis.matchMedia=()=>motion;const windowHandlers={};globalThis.addEventListener=(name,handler)=>windowHandlers[name]=handler;globalThis.location=new URL('https://example.org/'+search+hash);let writes=0;globalThis.history={state:{anchor:true},replaceState(state,title,url){writes++;globalThis.location=new URL(url,location.href);this.state=state;}};globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);globalThis.IntersectionObserver=class{constructor(callback){intersect=callback;}observe(){}};globalThis.ResizeObserver=class{observe(){}};globalThis.setTimeout=noop;
await import('../app.js?walk='+instance++);
return {el,tabs,strokes:()=>strokes,frames,motion,windowHandlers,tick,documentHandlers,setVisible(value){intersect([{isIntersecting:value}]);},writes:()=>writes,navigate(url){globalThis.location=new URL(url,location.href);windowHandlers.popstate();},key:(key,extra={})=>el('canvas').handlers.keydown({key,preventDefault(){},...extra})};
}



test('walk guide and checkpoints reproduce 16/64 steps without autoplay',async()=>{
 const h=await setup('?experiment=walk&bias=25&seed=99');
 assert.match(h.el('stage-title').textContent,/05/);assert.match(h.el('metrics').textContent,/256 位漫步者 · 16 步 · 偏向 25%/);
 h.el('guide-start').handlers.click();assert.equal(h.frames.size,0);assert.equal(location.search,'?experiment=walk&bias=0&seed=14');assert.match(h.el('observation-b').textContent,/4.00/);
 const first=h.el('observation-a').textContent;h.el('walk-64').handlers.click();assert.match(h.el('observation-b').textContent,/8.00/);assert.match(h.el('metrics').textContent,/64 步/);
 h.el('walk-16').handlers.click();assert.equal(h.el('observation-a').textContent,first);
 h.el('walk-64').handlers.click();h.el('walk-64').handlers.click();assert.match(h.el('metrics').textContent,/64 步/);assert.equal(h.frames.size,0);
 h.el('bias').handlers.input({target:{value:'25'}});assert.match(h.el('metrics').textContent,/16 步 · 偏向 25%/);
 h.el('walk-64').handlers.click();assert.match(h.el('observation-detail').textContent,/理论中心 x = 16.00/);assert.equal(h.frames.size,0);
});
test('walk presets and reset synchronize controls, parameter links and seeded state',async()=>{
 const h=await setup('?experiment=walk');await h.el('share').handlers.click();
 (h.el('preset-select').handlers.change({target:{value:'drift'}}),h.el('load-preset').handlers.click());assert.equal(h.el('out-bias').textContent,'25%');assert.match(h.el('share-link').value,/bias=25/);
 h.el('step').handlers.click();assert.match(h.el('metrics').textContent,/32 步/);
 h.el('reset').handlers.click();assert.match(h.el('metrics').textContent,/16 步/);
 (h.el('preset-select').handlers.change({target:{value:'another'}}),h.el('load-preset').handlers.click());assert.equal(h.el('out-bias').textContent,'0%');assert.equal(h.el('out-seed').textContent,'15');
 h.el('seed').handlers.input({target:{value:'99'}});(h.el('preset-select').handlers.change({target:{value:'another'}}),h.el('load-preset').handlers.click());assert.equal(h.el('out-seed').textContent,'1');
 h.navigate('?experiment=walk&bias=Infinity&seed=1000');assert.match(location.search,/bias=0&seed=99/);
 h.navigate('?experiment=orbit');assert.equal(h.el('walk-comparison').hidden,true);assert.equal(h.el('walk-legend').hidden,true);
 h.navigate('?experiment=walk&bias=25&seed=15');assert.equal(h.el('walk-comparison').hidden,false);assert.equal(h.el('walk-legend').hidden,false);assert.equal(h.frames.size,0);
});
test('walk keyboard advances and resets while leaving modified browser keys alone',async()=>{
 const h=await setup('?experiment=walk');h.el('pause').handlers.click();assert.equal(h.frames.size,1);
 for(const [key,extra] of [['ArrowRight',{ctrlKey:true}],['Home',{altKey:true}],['Home',{metaKey:true}],['ArrowRight',{shiftKey:true}],['Tab',{}]])h.key(key,extra);
 assert.equal(h.frames.size,1);assert.match(h.el('metrics').textContent,/16 步/);
 h.key('ArrowRight');assert.match(h.el('metrics').textContent,/32 步/);assert.equal(h.frames.size,0);assert.match(h.el('announcement').textContent,/已暂停；32 步；实测散开程度/);
 h.key('Home');assert.match(h.el('metrics').textContent,/16 步/);assert.match(h.el('announcement').textContent,/已暂停；16 步/);
});
test('walk reaches cap, suspends offscreen, and respects reduced motion',async()=>{
 const h=await setup('?experiment=walk');h.el('pause').handlers.click();h.tick(0);h.tick(50);assert.match(h.el('metrics').textContent,/16 步/);h.tick(100);assert.match(h.el('metrics').textContent,/20 步/);
 document.hidden=true;h.documentHandlers.visibilitychange();assert.equal(h.frames.size,0);document.hidden=false;h.documentHandlers.visibilitychange();h.tick(90000);assert.match(h.el('metrics').textContent,/20 步/);
 h.setVisible(false);assert.equal(h.frames.size,0);h.setVisible(true);assert.equal(h.frames.size,1);
 h.motion.change({matches:true});assert.equal(h.frames.size,0);h.motion.change({matches:false});assert.equal(h.frames.size,0);
 h.el('pause').handlers.click();let time=100000;h.tick(time);while(h.frames.size){time+=50;h.tick(time);assert.ok(time<120000);}
 assert.match(h.el('metrics').textContent,/512 步/);assert.equal(h.el('status').textContent,'已暂停');h.el('pause').handlers.click();assert.equal(h.frames.size,0);assert.match(h.el('announcement').textContent,/已达到 512/);
 h.el('step').handlers.click();assert.match(h.el('metrics').textContent,/512 步/);h.el('reset').handlers.click();h.el('pause').handlers.click();assert.equal(h.frames.size,1);
});
test('walk snapshot keeps captured name across a switch and anchors preserve progress',async()=>{
 const h=await setup('?experiment=walk');h.el('walk-64').handlers.click();const before=h.el('observation-a').textContent;
 h.navigate(location.search+'#discovery-title');h.navigate(location.search+'#canvas');assert.match(h.el('metrics').textContent,/64 步/);assert.equal(h.el('observation-a').textContent,before);
 let encoded;h.el('canvas').toBlob=callback=>encoded=callback;h.el('save').handlers.click();h.tabs[0].handlers.click();encoded(new Blob(['png']));assert.equal(h.el('generated').download,'small-worlds-walk.png');assert.equal(h.el('save').disabled,false);
});


test('walk dependency URLs invalidate cached guide and journey modules',async()=>{
 const {readFile}=await import('node:fs/promises');const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 assert.ok(app.includes("./guides.js?v=wave-paths-1"));assert.ok(app.includes("./journeys.js?v=random-walk-1"));
});


test('single-walker distance and cancellation follow checkpoints and keyboard steps',async()=>{
 const h=await setup('?experiment=walk');
 assert.equal(h.el('walk-length').textContent,'16 步长');assert.equal(h.el('walk-displacement').textContent,'4.47 步长');
 assert.match(h.el('walk-cancellation').textContent,/右 7 步、左 3 步 → 净向右 4 步；上 2 步、下 4 步 → 净向下 2 步/);
 h.el('walk-64').handlers.click();assert.equal(h.el('walk-length').textContent,'64 步长');assert.equal(h.el('walk-displacement').textContent,'10.77 步长');
 assert.match(h.el('announcement').textContent,/白色漫步者：走过 64 步长，离起点 10.77 步长/);
 h.el('walk-16').handlers.click();assert.equal(h.el('walk-displacement').textContent,'4.47 步长');
 h.key('ArrowRight');assert.equal(h.el('walk-length').textContent,'32 步长');assert.match(h.el('announcement').textContent,/白色漫步者：走过 32 步长/);
 h.key('Home');assert.equal(h.el('walk-length').textContent,'16 步长');
 h.el('walk-64').handlers.click();h.el('reset').handlers.click();assert.equal(h.el('walk-length').textContent,'16 步长');
});
test('paused shortcut joins the origin to the representative endpoint and restores immediately',async()=>{
 const h=await setup('?experiment=walk');
 const shortcut=()=>h.strokes().filter(s=>s.color==='#82d6dd');
 const scale=Math.min((600-48)/60,(414-76)/60);
 assert.equal(shortcut().length,1);assert.deepEqual(shortcut()[0].dash,[7,4]);
 assert.deepEqual(shortcut()[0].path,[['M',300,207],['L',300+4*scale,207+2*scale]]);
 h.el('pause').handlers.click();assert.equal(shortcut().length,0);assert.match(h.el('walk-distance-note').textContent,/运行中暂隐/);
 h.el('pause').handlers.click();assert.equal(shortcut().length,1);assert.match(h.el('walk-distance-note').textContent,/空心圈是起点/);
 h.el('pause').handlers.click();h.motion.change({matches:true});assert.equal(shortcut().length,1);assert.equal(h.frames.size,0);
});
test('distance readings animate quietly and cap at the same saved step count',async()=>{
 const h=await setup('?experiment=walk&at=v1,508');h.el('pause').handlers.click();
 const before=h.el('announcement').textContent;h.tick(0);h.tick(50);assert.equal(h.el('announcement').textContent,before);
 h.tick(100);assert.equal(h.el('walk-length').textContent,'512 步长');assert.equal(h.frames.size,0);
 assert.equal(h.strokes().filter(s=>s.color==='#82d6dd').length,1);
 const reading=h.el('walk-displacement').textContent;h.el('step').handlers.click();assert.equal(h.el('walk-displacement').textContent,reading);
 assert.match(h.el('announcement').textContent,/白色漫步者：走过 512 步长.*已达到上限/);
 h.el('reset').handlers.click();h.el('pause').handlers.click();const message=h.el('announcement').textContent;
 h.tick(0);h.tick(50);h.tick(100);assert.equal(h.el('walk-length').textContent,'20 步长');assert.equal(h.el('announcement').textContent,message);
});
test('saved observations, presets and parameter resets reproduce the chosen walker',async()=>{
 const h=await setup('?experiment=walk&bias=25&seed=99');h.el('walk-64').handlers.click();h.el('step').handlers.click();
 const reading=['walk-length','walk-displacement','walk-cancellation'].map(id=>h.el(id).textContent);
 await h.el('share').handlers.click();const url=h.el('share-link').value;assert.equal(new URL(url).searchParams.get('at'),'v1,80');
 h.el('step').handlers.click();h.navigate(location.search+'#canvas');assert.equal(h.el('walk-length').textContent,'96 步长');
 h.navigate('?experiment=fractal');assert.equal(h.el('walk-distance').hidden,true);
 h.navigate(url);assert.equal(h.el('walk-distance').hidden,false);assert.deepEqual(['walk-length','walk-displacement','walk-cancellation'].map(id=>h.el(id).textContent),reading);
 h.el('seed').handlers.input({target:{value:'50'}});assert.equal(h.el('walk-length').textContent,'16 步长');assert.equal(h.el('share-link').hidden,true);
 (h.el('preset-select').handlers.change({target:{value:'unbiased'}}),h.el('load-preset').handlers.click());assert.equal(h.el('walk-displacement').textContent,'0.00 步长');assert.match(h.el('walk-distance-note').textContent,/回到了起点/);assert.match(h.el('walk-cancellation').textContent,/左右抵消.*上下抵消/);
 h.el('guide-start').handlers.click();assert.equal(h.el('walk-length').textContent,'16 步长');assert.equal(h.el('walk-displacement').textContent,'4.47 步长');assert.equal(h.frames.size,0);
});
test('the full representative path remains inside the view at the long biased checkpoint',async()=>{
 const h=await setup('?experiment=walk&bias=25&seed=99&at=v1,512');
 const trace=h.strokes().find(s=>s.color==='#e7eee177');assert.equal(trace.path.length,513);
 for(const [,x,y] of trace.path){assert.ok(x>=24&&x<=576);assert.ok(y>=38&&y<=376);}
});
test('walk distance uses quiet readable text, existing controls, and a refreshed model import',async()=>{
 const {readFile}=await import('node:fs/promises');const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 const panel=html.match(/<section id="walk-distance".*?<\/section>/s)?.[0];assert.ok(panel);
 assert.match(panel,/aria-labelledby="walk-distance-title"/);assert.doesNotMatch(panel,/aria-live|role="status"|<button|<output/);
 assert.match(panel,/不是下方整群的散开程度/);assert.match(panel,/直线距离却可能缩短/);
 assert.ok(app.includes("./walk.js?v=walk-distance-1"));
});
