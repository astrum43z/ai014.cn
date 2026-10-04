import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './life-challenge-harness.js';

const click=(h,id)=>h.el(id).handlers.click();
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ≈ ${b}`);
const scale=h=>h.drawing().find(c=>c[0]==='scale')?.[1];
const reading=h=>h.el('orbit-position').textContent;
function launcher(h){const s=scale(h),p=h.drawing().find(c=>c[0]==='arc'&&Math.abs(c[3]-8/s)<1e-9);return p&&{x:p[1],y:p[2]};}
function planets(h){const s=scale(h);return h.drawing().filter(c=>c[0]==='arc'&&Math.abs(c[3]-4.5/s)<1e-9).map(c=>({x:c[1],y:c[2]}));}
function home(h,input){if(input==='button')click(h,'orbit-home');else h.key('Home');}
function fitted(h,width,height){
 assert.deepEqual(launcher(h),{x:140,y:0});
 const expected=Math.min(Math.min(width,height)/450,(width/2-34)/140,(height/2-34));
 near(scale(h),expected);
 assert.ok(140*scale(h)+34<=width/2+1e-9,'home marker and direction arrow fit');
 assert.match(reading(h),/x 140\.0，y 0\.0 · 距中心 140\.0/);
}
function selectAway(h){for(let i=0;i<10;i++)click(h,'orbit-left');for(let i=0;i<6;i++)click(h,'orbit-up');}

for(const input of ['button','keyboard'])for(const running of [false,true])test(`${input} Home fits exact model position in narrow usable layouts while ${running?'running':'paused'}`,async()=>{
 const h=await setup('?experiment=orbit&gravity=113&speed=68');
 for(const [width,height] of [[150,240],[100,260],[69,260],[150.5,240.25],[179.5,300],[180,260],[259,240],[600,414]]){
  h.resize(600,414);selectAway(h);h.resize(width,height);
  if(running)click(h,'pause');h.el(input==='button'?'orbit-home':'canvas').focus();
  const before={bodies:planets(h),metrics:h.el('metrics').textContent,url:location.href,writes:h.writes()};
  home(h,input);fitted(h,width,height);assert.deepEqual(planets(h),before.bodies);
  assert.equal(h.el('metrics').textContent,before.metrics);assert.equal(location.href,before.url);assert.equal(h.writes(),before.writes);
  assert.equal(h.frames.size,0);assert.equal(document.activeElement,h.el(input==='button'?'orbit-home':'canvas'));
  assert.match(h.el('orbit-speed').textContent,new RegExp((Math.sqrt(113000/140)*.68).toFixed(1)));
  assert.match(h.el('announcement').textContent,/已暂停；发射位置 x 140\.0，y 0\.0/);
 }
});

const replacements={
 reset:h=>click(h,'reset'),
 preset:h=>{h.el('preset-select').handlers.change({target:{value:'elliptic'}});click(h,'load-preset');},
 guide:h=>click(h,'guide-start'),
 exploration:h=>click(h,'mission-start'),
 history:h=>h.navigate('?experiment=orbit&gravity=40&speed=65'),
 'first visit':h=>{click(h,'tab-life');h.navigate('?experiment=orbit&gravity=90&speed=70');}
};
for(const [name,replace] of Object.entries(replacements))test(`${name} establishes a fitted home before the first directional movement`,async()=>{
 const h=await setup('?experiment=orbit');h.resize(150,260);replace(h);fitted(h,150,260);
 const before=planets(h),url=location.href,metrics=h.el('metrics').textContent;
 h.key('ArrowUp');assert.deepEqual(launcher(h),{x:140,y:-5});
 click(h,'orbit-left');assert.deepEqual(launcher(h),{x:135,y:-5});
 assert.deepEqual(planets(h),before);assert.equal(h.el('metrics').textContent,metrics);assert.equal(location.href,url);
});

test('Home releases old wide bounds and keeps normal-size scale unchanged',async()=>{
 const h=await setup('?experiment=orbit');
 for(const [width,height] of [[150,260],[259,240],[600,414]]){
  h.resize(600,414);home(h,'button');for(let i=0;i<25;i++)click(h,'orbit-right');
  h.resize(width,height);if(width<600)assert.ok(scale(h)<Math.min(width,height)/450);
  home(h,'keyboard');fitted(h,width,height);const fittedScale=scale(h);
  for(let i=0;i<10;i++)h.key('ArrowLeft',{repeat:true});assert.deepEqual(launcher(h),{x:90,y:0});assert.equal(scale(h),fittedScale);
  h.key('ArrowUp',{repeat:true});assert.deepEqual(launcher(h),{x:90,y:-5});assert.equal(scale(h),fittedScale);
 }
});

test('Home preserves existing bodies, time, recall and the next model integration',async()=>{
 const h=await setup('?experiment=orbit&gravity=113&speed=68');selectAway(h);click(h,'orbit-fire');
 for(let i=0;i<7;i++)click(h,'step');h.resize(150,260);
 const old={bodies:planets(h),metrics:h.el('metrics').textContent,recall:h.el('orbit-recall-status').textContent};
 home(h,'button');fitted(h,150,260);assert.deepEqual(planets(h),old.bodies);assert.equal(h.el('metrics').textContent,old.metrics);assert.equal(h.el('orbit-recall-status').textContent,old.recall);
 click(h,'step');const result=planets(h),metrics=h.el('metrics').textContent;
 const control=await setup('?experiment=orbit&gravity=113&speed=68');selectAway(control);click(control,'orbit-fire');for(let i=0;i<8;i++)click(control,'step');
 assert.deepEqual(result,planets(control));assert.equal(metrics,control.el('metrics').textContent);
});

test('a launch after narrow Home starts at the promised radius and speed',async()=>{
 const h=await setup('?experiment=orbit&gravity=113&speed=68');selectAway(h);h.resize(150,260);home(h,'button');click(h,'orbit-fire');
 assert.deepEqual(planets(h).at(-1),{x:140,y:0});
 const b={x:140,y:0,vx:0,vy:Math.sqrt(113000/140)*.68};
 for(let i=0;i<10;i++){const r=Math.max(Math.hypot(b.x,b.y),18),a=-113000/(r*r*r);b.vx+=a*b.x*.01;b.vy+=a*b.y*.01;b.x+=b.vx*.01;b.y+=b.vy*.01;}
 click(h,'step');const actual=planets(h).at(-1);near(actual.x,b.x);near(actual.y,b.y);
 click(h,'orbit-recall');assert.match(h.el('metrics').textContent,/3 颗行星/);assert.match(reading(h),/x 140\.0，y 0\.0/);
});

test('fitted Home survives density, context, visibility, collapsed geometry and retained-world restoration',async()=>{
 const h=await setup('?experiment=orbit');selectAway(h);h.resize(150,260);home(h,'keyboard');const original=h.drawing();
 h.setDpr(2);h.loseContext();h.restoreContext();h.setVisible(false);h.setHidden(true);h.setVisible(true);h.setHidden(false);
 click(h,'tab-wave');click(h,'tab-orbit');h.setDpr(1);assert.deepEqual(h.drawing(),original);
 for(const size of [[20,20],[68,260],[0,260],[NaN,260],[Infinity,260]]){
  h.resize(...size);home(h,'button');assert.match(reading(h),/x 140\.0，y 0\.0/);h.resize(150,260);fitted(h,150,260);
 }
 h.resize(600,414);fitted(h,600,414);assert.equal(h.frames.size,0);
});

test('Home leaves shared parameters, pending copy and discovery records unchanged',async()=>{
 const pending=[];Object.defineProperty(globalThis,'navigator',{value:{clipboard:{writeText:text=>new Promise(resolve=>pending.push({text,resolve}))}},configurable:true});
 try{
  const h=await setup('?experiment=orbit');click(h,'mission-start');click(h,'mission-check');h.el('gravity').handlers.input({target:{value:'40'}});
  for(let i=0;i<140;i++)click(h,'step');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
  selectAway(h);click(h,'orbit-fire');const sharing=click(h,'share'),url=location.href,link=h.el('share-link').value,writes=h.writes(),notes=h.el('notes-text').value,result=h.el('mission-result').textContent;
  h.resize(150,260);home(h,'button');fitted(h,150,260);
  assert.equal(location.href,url);assert.equal(h.writes(),writes);assert.equal(h.el('share-link').value,link);assert.equal(h.el('share-link').hidden,false);
  assert.equal(h.el('notes-text').value,notes);assert.equal(h.el('mission-result').textContent,result);assert.equal(h.el('orbit-recall').getAttribute('aria-disabled'),'false');
  pending[0].resolve();await sharing;assert.match(h.el('share-status').textContent,/已复制/);
 }finally{delete globalThis.navigator;}
});

test('native key exclusions and other worlds remain untouched',async()=>{
 const h=await setup('?experiment=orbit');selectAway(h);h.resize(150,260);const before=h.drawing();
 for(const extra of [{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{isComposing:true},{keyCode:229}]){
  h.key('Home',{...extra,preventDefault(){assert.fail('native Home intercepted')}});assert.deepEqual(h.drawing(),before);
 }
 for(const mode of ['life','wave','fractal','walk']){click(h,'tab-'+mode);const drawing=h.drawing(),metrics=h.el('metrics').textContent;click(h,'orbit-home');assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('metrics').textContent,metrics);}
 click(h,'tab-fractal');for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('batch repeat suppressed')}});click(h,'step');}assert.match(h.el('metrics').textContent,/500 个点/);
 click(h,'tab-walk');h.key('ArrowRight');h.key('ArrowRight',{repeat:true});assert.match(h.el('metrics').textContent,/48 步/);
});
