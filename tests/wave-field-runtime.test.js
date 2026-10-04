import test from 'node:test';
import assert from 'node:assert/strict';
let instance=0;
async function setup(search='',hash=''){
let rect={width:600,height:414,left:0,top:0},resize;let drawCount=0,frameId=0,intersect,strokes=[],path=[],dash=[],fills=[];const frames=new Map(),documentHandlers={};const tick=now=>{const [id,callback]=frames.entries().next().value;frames.delete(id);callback(now);};const els=new Map();const noop=()=>{};const ctx=new Proxy({clearRect:()=>{drawCount++;strokes=[];fills=[];},fillRect:(x,y,w,h)=>{if(w===5&&h===5)fills.push([x,y,ctx.fillStyle]);},beginPath:()=>path=[],moveTo:(x,y)=>path.push(['M',x,y]),lineTo:(x,y)=>path.push(['L',x,y]),arc:(x,y,r)=>path.push(['A',x,y,r]),setLineDash:value=>dash=[...value],stroke:()=>strokes.push({color:ctx.strokeStyle,dash:[...dash],path:[...path]}),createRadialGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||noop,set:(t,k,v)=>(t[k]=v,true)});function el(id){if(!els.has(id))els.set(id,{id,value:'',textContent:'',hidden:false,handlers:{},dataset:{},classList:{toggle:noop},setAttribute:noop,focus:noop,select:noop,append:noop,remove:noop,click:noop,addEventListener(n,f){this.handlers[n]=f},getBoundingClientRect:()=>rect,getContext:()=>ctx,setPointerCapture:noop,toBlob:f=>f(new Blob(['png']))});return els.get(id)}const tabs=['orbit','life','wave','fractal','walk'].map(m=>{const t=el('tab-'+m);t.dataset.mode=m;return t});globalThis.document={querySelector:s=>el(s.slice(1)),querySelectorAll:()=>tabs,createElement:()=>el('generated'),body:{append:noop},hidden:false,addEventListener:(name,callback)=>documentHandlers[name]=callback};const motion={matches:true,addEventListener:(name,handler)=>motion.change=handler};globalThis.matchMedia=()=>motion;const windowHandlers={};globalThis.addEventListener=(name,handler)=>windowHandlers[name]=handler;globalThis.location=new URL('https://example.org/'+search+hash);let writes=0;globalThis.history={state:{anchor:true},replaceState(state,title,url){writes++;globalThis.location=new URL(url,location.href);this.state=state;}};globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);globalThis.IntersectionObserver=class{constructor(callback){intersect=callback;}observe(){}};globalThis.ResizeObserver=class{constructor(callback){resize=callback;}observe(){}};globalThis.setTimeout=noop;
await import('../app.js?wave-cache='+instance++);
return {resize(width,height){rect={width,height,left:0,top:0};resize();},el,tabs,fills:()=>fills,strokes:()=>strokes,frames,motion,windowHandlers,tick,documentHandlers,setVisible(value){intersect([{isIntersecting:value}]);},writes:()=>writes,navigate(url){globalThis.location=new URL(url,location.href);windowHandlers.popstate();},key:(key,extra={})=>el('canvas').handlers.keydown({key,preventDefault(){},...extra})};
}



import {waveValue} from '../simulations.js';
function assertField(h,width,height,scale,separation,wavelength,time){
 if(!Number.isFinite(scale)||scale<=0||wavelength*scale<=10){assert.deepEqual(h.fills(),[],'unresolved fields are omitted');return;}
 const expected=[];
 for(let y=0;y<height;y+=5)for(let x=0;x<width;x+=5){
  const v=waveValue((x-width/2)/scale,(y-height/2)/scale,time*3,separation,wavelength),a=Math.abs(v);
  expected.push([x,y,v>0?`rgb(${18+a*175},${46+a*177},${41+a*55})`:`rgb(${18+a*56},${46+a*107},${41+a*112})`]);
 }
 assert.deepEqual(h.fills(),expected,'every field square keeps its exact original color and position');
}

test('real app draws the original field through stepping, slider edits, presets, reset and geometry changes',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,0');let width=600,height=414;
 const verify=(separation,wavelength,time,scale=Math.min(width,height)/280)=>assertField(h,width,height,scale,separation,wavelength,time);
 verify(100,32,0);h.el('step').handlers.click();verify(100,32,Math.PI/6);
 h.el('wavelength').handlers.input({target:{value:'70'}});verify(100,70,Math.PI/6);
 h.el('separation').handlers.input({target:{value:'180'}});verify(180,70,Math.PI/6);
 (h.el('preset-select').handlers.change({target:{value:'wide'}}),h.el('load-preset').handlers.click());verify(150,65,0);
 h.el('guide-start').handlers.click();verify(100,32,0);
 width=767;height=317.9375;h.resize(width,height);verify(100,32,0);
 h.el('step').handlers.click();verify(100,32,Math.PI/6);
 h.tabs[1].handlers.click();width=259;height=240;h.resize(width,height);h.tabs[2].handlers.click();verify(100,32,Math.PI/6);
 h.navigate('?experiment=wave&wavelength=15&separation=20&at=v1,10000,-10000,1000000000');
 verify(20,15,1e9,Math.min(width/2-18,height/2-18)/10000);
 h.key('Home');verify(20,15,1e9);
 h.el('reset').handlers.click();verify(20,15,0);
});

test('real animation and pause/probe draws reuse the field; resize and sliders rebuild it',async()=>{
 const h=await setup('?experiment=wave&at=v1,8,0,0'),hypot=Math.hypot;let calls=0;
 try{
  Math.hypot=(...args)=>{calls++;return hypot(...args);};
  const checkReuse=action=>{calls=0;action();assert.ok(calls<=12,`only probe/readout distances remain (${calls})`);};
  checkReuse(()=>h.el('step').handlers.click());
  checkReuse(()=>h.key('ArrowRight'));
  checkReuse(()=>h.el('pause').handlers.click());h.tick(0);checkReuse(()=>h.tick(50));
  assert.equal(h.frames.size,1);
  checkReuse(()=>h.el('pause').handlers.click());assert.equal(h.frames.size,0);
  calls=0;h.resize(334,240);assert.ok(calls>=2*Math.ceil(334/5)*48);
  checkReuse(()=>h.el('step').handlers.click());
  calls=0;h.el('wavelength').handlers.input({target:{value:'15'}});assert.ok(calls>=2*Math.ceil(334/5)*48);
  checkReuse(()=>h.el('step').handlers.click());
  h.setVisible(false);assert.equal(h.frames.size,0);h.setVisible(true);assert.equal(h.frames.size,0);
 }finally{Math.hypot=hypot;}
});
