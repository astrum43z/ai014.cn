import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const scale=h=>h.drawing().find(c=>c[0]==='scale')?.[1];
const available=h=>h.el('orbit-fit').getAttribute('aria-disabled')==='false';
function model(h){
 const drawing=h.drawing(),s=scale(h),trails=[];
 for(let i=0;i<drawing.length;i++)if(drawing[i][0]==='strokeStyle'&&/^#[a-f0-9]{6}75$/.test(drawing[i][1])){
  const end=drawing.findIndex((c,j)=>j>i&&c[0]==='stroke');
  trails.push(drawing.slice(i,end+1).filter(c=>['moveTo','lineTo'].includes(c[0])));
 }
 return {positions:drawing.filter(c=>c[0]==='arc'&&Math.abs(c[3]-4.5/s)<1e-9).map(c=>c.slice(1,3)),trails};
}
function escape(h,n=150){h.el('preset-select').handlers.change({target:{value:'escape'}});click(h,'load-preset');for(let i=0;i<n;i++)click(h,'step');}
const fixed=h=>({metrics:h.el('metrics').textContent,position:h.el('orbit-position').textContent,speed:h.el('orbit-speed').textContent,radial:h.el('orbit-radial-reading').textContent,recall:h.el('orbit-recall-status').textContent,url:location.href,writes:h.writes(),link:h.el('share-link').value,linkHidden:h.el('share-link').hidden,notes:h.el('notes-text').value,mission:h.el('mission-result').textContent});
const state=h=>({drawing:h.drawing(),draws:h.drawCount(),fixed:fixed(h),frames:[...h.frames.keys()],status:h.el('status').textContent,announcement:h.el('announcement').textContent});
function enter(h,repeat=false,key='Enter'){
 let prevented=false;h.el('orbit-fit').handlers.keydown?.({key,repeat,preventDefault(){prevented=true;}});
 if(key==='Enter'&&!prevented)click(h,'orbit-fit');return prevented;
}

for(const running of [false,true])test(`fit an off-canvas first planet while ${running?'running':'paused'} without changing the model or launch`,async()=>{
 const h=await setup('?experiment=orbit');escape(h);click(h,'orbit-left');click(h,'orbit-fire');
 assert.match(h.el('orbit-measured-reading').textContent,/当前在画外/);assert.equal(available(h),true);
 if(running)click(h,'pause');
 const before=model(h),previous=fixed(h),oldScale=scale(h);h.el('orbit-fit').focus();click(h,'orbit-fit');
 assert.deepEqual(model(h),before);assert.deepEqual(fixed(h),previous);assert.ok(scale(h)<oldScale);
 const [x,y]=before.positions[0],s=scale(h);assert.ok(Math.abs(x)*s+34<=300+1e-9);assert.ok(Math.abs(y)*s+34<=207+1e-9);
 assert.doesNotMatch(h.el('orbit-measured-reading').textContent,/当前在画外/);assert.equal(available(h),false);
 assert.equal(h.frames.size,0);assert.equal(h.el('status').textContent,'已暂停');assert.equal(document.activeElement,h.el('orbit-fit'));
 assert.match(h.el('announcement').textContent,/已缩小视图并暂停.*首颗行星.*位置.*时间.*不变/);
 assert.ok(h.drawing().some(c=>c[0]==='fillText'&&c[1]==='首颗 · 线量距，箭头仅方向'));
 const after=state(h);click(h,'orbit-fit');assert.deepEqual(state(h),after,'a now-unavailable button is inert');
});

test('fitting preserves all planets, retained trails and the exact next integration',async()=>{
 const control=await setup('?experiment=orbit');escape(control);click(control,'orbit-fire');click(control,'step');const expected=model(control),metrics=control.el('metrics').textContent;
 const h=await setup('?experiment=orbit');escape(h);click(h,'orbit-fire');click(h,'orbit-fit');click(h,'step');
 assert.deepEqual(model(h),expected);assert.equal(h.el('metrics').textContent,metrics);
 const fitted=scale(h);click(h,'orbit-recall');assert.equal(model(h).positions.length,3);assert.equal(scale(h),fitted);
});

test('unavailable fitting cannot pause or redraw a visible running planet and never loses native focus',async()=>{
 const h=await setup('?experiment=orbit','',false);assert.equal(h.el('orbit-fit').getAttribute('aria-disabled'),'true');
 h.el('orbit-fit').focus();const before=state(h);click(h,'orbit-fit');assert.deepEqual(state(h),before);
 assert.equal(document.activeElement,h.el('orbit-fit'));assert.notEqual(h.el('orbit-fit').disabled,true);
});

test('fit uses both body axes, retains a distant launcher and never zooms in on older wider bounds',async()=>{
 const h=await setup('?experiment=orbit');escape(h,450);
 h.el('canvas').handlers.click({clientX:900,clientY:-300});h.resize(600,414);
 const position=h.el('orbit-position').textContent,oldScale=scale(h),before=model(h);
 // A distant launcher may already reveal the body; fresh progress makes it leave again.
 for(let i=0;i<500&&!available(h);i++)click(h,'step');assert.equal(available(h),true);
 const current=model(h),previous=scale(h);click(h,'orbit-fit');assert.ok(scale(h)<=previous);assert.ok(scale(h)<=oldScale);
 assert.deepEqual(model(h),current);assert.equal(h.el('orbit-position').textContent,position);
 const [x,y]=current.positions[0],s=scale(h);assert.ok(Math.abs(x)*s<=266+1e-9);assert.ok(Math.abs(y)*s<=173+1e-9);assert.equal(before.positions.length,current.positions.length);
});

for(const [width,height] of [[195,240],[253,240],[334.5,260.2],[768,330]])test(`fit keeps the first marker inside ${width} × ${height} without moving it`,async()=>{
 const h=await setup('?experiment=orbit');escape(h,600);h.resize(width,height);
 assert.equal(available(h),true);const before=model(h);click(h,'orbit-fit');assert.deepEqual(model(h),before);
 const [x,y]=before.positions[0],s=scale(h),expected=Math.min(width/450,height/450,(width/2-34)/Math.max(140,Math.abs(x)),(height/2-34)/Math.max(1,Math.abs(y)));
 assert.equal(s,expected);assert.ok(Math.abs(x)*s+34<=width/2+1e-9);assert.ok(Math.abs(y)*s+34<=height/2+1e-9);
 assert.equal(available(h),false);assert.doesNotMatch(h.el('orbit-measured-reading').textContent,/当前在画外/);
});

test('unusable geometry refuses fitting atomically and recovery permits a fresh request',async()=>{
 const h=await setup('?experiment=orbit');escape(h);click(h,'pause');
 for(const size of [[0,414],[600,0],[68,414],[600,68],[NaN,414],[Infinity,414]]){
  h.resize(...size);assert.equal(available(h),false);const before=state(h);click(h,'orbit-fit');assert.deepEqual(state(h),before);
 }
 h.resize(600,414);assert.equal(available(h),true);click(h,'orbit-fit');assert.equal(h.frames.size,0);assert.equal(available(h),false);
});

test('continued motion keeps the fitted view fixed and enables another fit only after leaving it',async()=>{
 const h=await setup('?experiment=orbit');escape(h);click(h,'orbit-fit');const view=scale(h);
 click(h,'pause');h.tick(0);for(let i=1;i<=20;i++)h.tick(i*50);assert.equal(scale(h),view);click(h,'pause');
 for(let i=0;i<500&&!available(h);i++)click(h,'step');assert.equal(available(h),true);assert.equal(scale(h),view);
 const before=model(h);click(h,'orbit-fit');assert.deepEqual(model(h),before);assert.ok(scale(h)<view);
});

test('fit survives retained worlds, narrow resize, density, context and visibility interruptions',async()=>{
 const h=await setup('?experiment=orbit');escape(h);click(h,'orbit-fit');const before=state(h),originalModel=model(h),s=scale(h);
 for(const mode of ['life','wave','fractal','walk']){click(h,'tab-'+mode);const other=state(h);click(h,'orbit-fit');assert.deepEqual(state(h),other);click(h,'tab-orbit');assert.equal(scale(h),s);assert.deepEqual(model(h),originalModel);}
 h.resize(253,240);h.setDpr(2);h.loseContext();h.restoreContext();h.setHidden(true);h.setVisible(false);h.setHidden(false);h.setVisible(true);h.resize(600,414);h.setDpr(1);
 assert.deepEqual(h.drawing(),before.drawing);assert.deepEqual(fixed(h),{...before.fixed,writes:h.writes()});assert.equal(h.writes(),before.fixed.writes+8);assert.equal(h.frames.size,0);assert.equal(available(h),false);
});

test('Home and replacement states release fitted bounds; parameter-only changes keep the current model and view',async()=>{
 for(const action of ['orbit-home','reset','load-preset','guide-start','mission-start','history']){
  const h=await setup('?experiment=orbit');escape(h);click(h,'orbit-fit');const old=scale(h),before=model(h);
  h.el('gravity').handlers.input({target:{value:'81'}});assert.equal(scale(h),old);assert.deepEqual(model(h),before);
  if(action==='history')h.navigate('?experiment=orbit&gravity=82&speed=100');
  else if(action==='load-preset'){h.el('preset-select').handlers.change({target:{value:'circular'}});click(h,action);}
  else click(h,action);
  assert.equal(scale(h),414/450);assert.equal(available(h),action==='orbit-home');
  if(action==='orbit-home')assert.deepEqual(model(h),before);
 }
});

test('fitting preserves pending sharing, parameter URL, recall and discovery evidence',async()=>{
 const pending=[];Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise(resolve=>pending.push(resolve))}}});
 try{
  const h=await setup('?experiment=orbit');click(h,'mission-start');click(h,'mission-check');h.el('gravity').handlers.input({target:{value:'40'}});for(let i=0;i<350;i++)click(h,'step');
  click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');click(h,'orbit-fire');const sharing=click(h,'share'),before=fixed(h),bodies=model(h);
  assert.equal(available(h),true);click(h,'orbit-fit');assert.deepEqual(fixed(h),before);assert.deepEqual(model(h),bodies);assert.equal(h.el('notes-count').textContent,'1 / 5');
  pending[0]();await sharing;assert.match(h.el('share-status').textContent,/已复制参数链接/);assert.equal(new URL(location.href).searchParams.has('at'),false);
  click(h,'orbit-recall');assert.equal(model(h).positions.length,3);
 }finally{delete globalThis.navigator;}
});

test('fresh Enter fits once, held Enter cannot consume a new offscreen state and other button keys stay native',async()=>{
 const h=await setup('?experiment=orbit');escape(h);h.el('orbit-fit').focus();const before=state(h);
 assert.equal(enter(h,true),true);assert.deepEqual(state(h),before);assert.equal(enter(h),false);const fitted=state(h);
 assert.equal(enter(h,true),true);assert.deepEqual(state(h),fitted);
 for(const key of [' ','Tab','Escape','Home','ArrowRight'])for(const repeat of [false,true])assert.equal(enter(h,repeat,key),false);
 assert.deepEqual(state(h),fitted);
 for(let i=0;i<500&&!available(h);i++)click(h,'step');const later=state(h);assert.equal(enter(h,true),true);assert.deepEqual(state(h),later);click(h,'orbit-fit');assert.equal(available(h),false);
});

test('an already widened ultra-narrow view remains unchanged when the planet is visible',async()=>{
 const h=await setup('?experiment=orbit');escape(h,600);h.resize(69,260);assert.equal(available(h),false);
 const before=state(h);click(h,'orbit-fit');assert.deepEqual(state(h),before);
});

test('availability follows real visibility changes, skips unchanged writes and repairs stale DOM',async()=>{
 const h=await setup('?experiment=orbit'),button=h.el('orbit-fit'),set=button.setAttribute;let writes=0;
 button.setAttribute=function(name,value){if(name==='aria-disabled')writes++;return set.call(this,name,value);};
 for(let i=0;i<10;i++)h.resize(600,414);assert.equal(writes,0);
 escape(h);assert.equal(available(h),true);assert.equal(writes,1);
 const announcement=h.el('announcement').textContent;for(let i=0;i<10;i++)h.resize(600,414);assert.equal(writes,1);assert.equal(h.el('announcement').textContent,announcement);
 click(h,'orbit-fit');assert.equal(writes,2);button.attributes['aria-disabled']='stale';h.resize(600,414);assert.equal(writes,3);assert.equal(available(h),false);
 h.resize(600,414);assert.equal(writes,3);
});

// This reachable trajectory used to recover under the opaque canvas legend.
function upperLeftEscape(h){for(let i=0;i<42;i++)click(h,'step');h.el('gravity').handlers.input({target:{value:'30'}});for(let i=0;i<168;i++)click(h,'step');}
function legendRect(h,width,height){
 const s=scale(h),rect=h.drawing().find(c=>c[0]==='fillRect'&&Math.abs(c[3]*s-196)<1e-8&&Math.abs(c[4]*s-23)<1e-8);
 return rect&&{left:width/2+rect[1]*s,top:height/2+rect[2]*s,right:width/2+(rect[1]+rect[3])*s,bottom:height/2+(rect[2]+rect[4])*s};
}
for(const [width,height] of [[600,414],[320,240],[195,260],[768,330]])test(`recovered upper-left planet and direction cue are not covered by the legend at ${width} × ${height}`,async()=>{
 const h=await setup('?experiment=orbit');upperLeftEscape(h);h.resize(width,height);const before=model(h),original=fixed(h);
 if(available(h))click(h,'orbit-fit');else{const unchanged=state(h);click(h,'orbit-fit');assert.deepEqual(state(h),unchanged);}
 assert.deepEqual(model(h),before);assert.deepEqual(fixed(h),original);
 const s=scale(h),[x,y]=before.positions[0],px=width/2+x*s,py=height/2+y*s,rect=legendRect(h,width,height);
 assert.ok(rect,'ordinary view retains the informative legend');assert.ok(rect.top>=32,'the label stays below the preview legend');
 if(rect.top>height/2)assert.ok(rect.bottom<height-56,'the lower row clears the ruler');
 assert.ok(px+38<rect.left||px-38>rect.right||py+38<rect.top||py-38>rect.bottom,'neither the marker nor its 34px direction cue is masked');
 if(width===600)assert.ok(rect.top>height/2,'the exact reported upper-left collision moves below the planet');
 assert.equal(available(h),false);const after=h.drawing();h.resize(width,height);assert.deepEqual(h.drawing(),after);
});

test('extremely short view omits only an obstructing duplicate legend, preserving body, marker and HTML measurements',async()=>{
 const h=await setup('?experiment=orbit');upperLeftEscape(h);h.resize(195,69);const before=model(h),reading=h.el('orbit-measured-reading').textContent;
 assert.equal(legendRect(h,195,69),undefined);const [x,y]=before.positions[0],s=scale(h);assert.ok(h.drawing().some(c=>c[0]==='moveTo'&&c[1]===x&&c[2]===y-9/s),'the actual first-body diamond is still drawn');assert.match(reading,/首颗行星/);
 h.resize(600,414);assert.deepEqual(model(h),before);click(h,'orbit-fit');assert.ok(legendRect(h,600,414));
});

test('when the upper row covers the recovered body and the lower row covers the launcher, omit only the duplicate legend',async()=>{
 const h=await setup('?experiment=orbit');upperLeftEscape(h);h.el('canvas').handlers.click({clientX:50,clientY:360});const before=model(h),previous=fixed(h);
 click(h,'orbit-fit');assert.deepEqual(model(h),before);assert.deepEqual(fixed(h),previous);assert.equal(available(h),false);
 assert.equal(legendRect(h,600,414),undefined,'neither opaque row may mask its measured body or launch marker');
 const s=scale(h),launch=h.drawing().find(c=>c[0]==='arc'&&Math.abs(c[3]-8/s)<1e-8);assert.ok(launch,'the unchanged launch circle remains drawn');
 assert.match(h.el('orbit-measured-reading').textContent,/首颗行星/);assert.match(h.el('orbit-touch-reading').textContent,/发射位置/);
});

test('view-fit is a named quiet measurement action with a wrapping 44-pixel target and refreshed assets',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const button=html.match(/<button[^>]*id="orbit-fit"[^>]*>[^<]*<\/button>/)?.[0];assert.ok(button);
 assert.match(button,/type="button"/);assert.match(button,/aria-disabled="true"/);assert.match(button,/aria-describedby="orbit-measured-reading orbit-fit-help"/);assert.doesNotMatch(button,/\sdisabled(?:=|[ >])/);
 assert.match(html,/<small id="orbit-fit-help">[^<]*缩小视图[^<]*不移动[^<]*不回退[^<]*不会自动追踪/);
 assert.match(css,/\.orbit-measurement #orbit-fit\{[^}]*min-height:44px[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
 assert.match(css,/\.stage,\.instrument-drawer\{--focus-ring:var\(--focus-on-dark\)/);
 assert.match(html,/style\.css\?[^"\n]+&amp;orbit-fit=first-body-1&amp;canvas-start=retry-1"/);assert.match(html,/app\.js\?[^"\n]+&amp;orbit-fit=first-body-1&amp;canvas-start=retry-1"/);
});
