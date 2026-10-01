import test from 'node:test';import assert from 'node:assert/strict';
test('app initializes and every experiment control executes',async()=>{let drawCount=0,frameId=0,intersect;const frames=new Map(),documentHandlers={};const tick=now=>{const [id,callback]=frames.entries().next().value;frames.delete(id);callback(now);};const els=new Map();const noop=()=>{};const ctx=new Proxy({clearRect:()=>drawCount++,createRadialGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||noop,set:(t,k,v)=>(t[k]=v,true)});function el(id){if(!els.has(id))els.set(id,{id,value:'',textContent:'',hidden:false,handlers:{},dataset:{},classList:{toggle:noop},setAttribute:noop,focus:noop,select:noop,append:noop,remove:noop,click:noop,addEventListener(n,f){this.handlers[n]=f},getBoundingClientRect:()=>({width:600,height:414,left:0,top:0}),getContext:()=>ctx,setPointerCapture:noop,toBlob:f=>f(new Blob(['png']))});return els.get(id)}const tabs=['orbit','life','wave','fractal'].map(m=>{const t=el('tab-'+m);t.dataset.mode=m;return t});globalThis.document={querySelector:s=>el(s.slice(1)),querySelectorAll:()=>tabs,createElement:()=>el('generated'),body:{append:noop},hidden:false,addEventListener:(name,callback)=>documentHandlers[name]=callback};globalThis.matchMedia=()=>({matches:false});globalThis.location={search:'',hash:'',href:'https://example.org/'};globalThis.history={replaceState:noop};globalThis.addEventListener=noop;globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);globalThis.IntersectionObserver=class{constructor(callback){intersect=callback;}observe(){}};globalThis.ResizeObserver=class{observe(){}};globalThis.setTimeout=noop;await import('../app.js');assert.match(el('stage-title').textContent,/引力/);el('step').handlers.click();el('pause').handlers.click();el('reset').handlers.click();for(const tab of tabs){tab.handlers.click();el('preset').handlers.click();el('step').handlers.click();el('reset').handlers.click();}tabs[1].handlers.click();el('clear').handlers.click();assert.match(el('metrics').textContent,/0 个活格子/);el('canvas').handlers.keydown({key:'Enter',preventDefault:noop});assert.match(el('metrics').textContent,/1 个活格子/);el('canvas').handlers.pointerdown({pointerId:1,button:0,isPrimary:true});el('canvas').handlers.pointermove({pointerId:1,clientX:20,clientY:20});el('canvas').handlers.pointerup({pointerId:1});el('canvas').handlers.click({clientX:20,clientY:20});el('preset-select').handlers.change({target:{value:'pulsar'}});assert.match(el('metrics').textContent,/48 个活格子/);assert.match(el('observation-a').textContent,/48/);tabs[2].handlers.click();assert.match(el('observation-c').textContent,/接近加强/);el('canvas').handlers.click({clientX:320,clientY:207});assert.match(el('observation-a').textContent,/波程差/);tabs[1].handlers.click();el('preset-select').handlers.change({target:{value:'blinker'}});el('step').handlers.click();el('step').handlers.click();assert.match(el('observation-c').textContent,/2 代/);
// Actual app integration: idle work, generation cadence, hidden/offscreen resume.
assert.equal(frames.size,0,'single-step leaves animation idle');
el('rate').handlers.input({target:{value:'1'}});
el('pause').handlers.click();assert.equal(frames.size,1);
const before=drawCount;tick(1000);for(let i=1;i<=20;i++)tick(1000+i*50);
assert.equal(drawCount-before,1,'Life renders once per generation, not once per animation frame');
document.hidden=true;documentHandlers.visibilitychange();assert.equal(frames.size,0);
document.hidden=false;documentHandlers.visibilitychange();assert.equal(frames.size,1);
const resumed=drawCount;tick(90000);assert.equal(drawCount,resumed,'resume does not fast-forward');
intersect([{isIntersecting:false}]);assert.equal(frames.size,0);
intersect([{isIntersecting:true}]);assert.equal(frames.size,1);
el('pause').handlers.click();assert.equal(frames.size,0);
intersect([{isIntersecting:false}]);intersect([{isIntersecting:true}]);assert.equal(frames.size,0,'scrolling must not override manual pause');
el('step').handlers.click();assert.equal(drawCount,resumed+1,'manual step still draws while paused');
// Snapshot callbacks may finish after an experiment switch.
let encoded;
el('canvas').toBlob=callback=>{encoded=callback;};
el('save').handlers.click();assert.equal(el('save').disabled,true);
tabs[2].handlers.click();encoded(new Blob(['png']));
assert.equal(el('generated').download,'small-worlds-life.png');
assert.equal(el('save').disabled,false);
assert.match(el('announcement').textContent,/已发起图片下载/);

});
