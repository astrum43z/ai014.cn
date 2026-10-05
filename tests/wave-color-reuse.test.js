import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWaveFieldCache} from '../wave-field.js';
import {createWaveColorCache} from '../wave-colors.js';
import {waveValue} from '../simulations.js';
import {setup} from './life-challenge-harness.js';

const color=v=>{const a=Math.abs(v);return v>0?`rgb(${18+a*175},${46+a*177},${41+a*55})`:`rgb(${18+a*56},${46+a*107},${41+a*112})`;};
const click=(h,id)=>h.el(id).handlers.click();
const type=(h,id,value)=>{h.el(id).value=String(value);h.el(id).handlers.input?.();};
const seek=(h,value)=>{type(h,'wave-time',value);click(h,'wave-time-seek');};
const position=(h,x,y)=>{type(h,'wave-target-x',x);type(h,'wave-target-y',y);click(h,'wave-position');};
function sines(action){const sin=Math.sin;let count=0;try{Math.sin=(...args)=>{count++;return sin(...args);};action();return count;}finally{Math.sin=sin;}}
function field(h){const colors=[];let value;for(const command of h.drawing()){if(command[0]==='fillStyle')value=command[1];if(command[0]==='fillRect'&&command[3]===5&&command[4]===5)colors.push([command[1],command[2],value]);}return colors;}
function expectedField(width,height,scale,separation,wavelength,time){if(!Number.isFinite(scale)||scale<=0||wavelength*scale<=10)return [];const result=[];for(let y=0;y<height;y+=5)for(let x=0;x<width;x+=5)result.push([x,y,color(waveValue((x-width/2)/scale,(y-height/2)/scale,time*3,separation,wavelength))]);return result;}
function fixed(h){return [location.href,h.el('share-link').value,h.el('saved-observation-reading').textContent,h.el('observation-undo-status').textContent];}

test('every cached color equals the original field arithmetic, including fractional grids and extreme phases',()=>{
 const getField=createWaveFieldCache(),getColors=createWaveColorCache();
 for(const [width,height,scale] of [[600,414,414/280],[767,317.9375,317.9375/280],[233,240,233/280],[259,240,.01],[0,240,0],[20,20,-8]])for(const [separation,wavelength] of [[20,15],[100,32],[180,70]]){
  const grid=getField(width,height,scale,separation,wavelength),original=grid.phases.slice();
  for(const phase of [0,-0,Number.MIN_VALUE,.375,Math.PI,27.14,3e9,3e9+.15]){
   const colors=getColors(grid,phase);let i=0;
   for(let y=0;y<height;y+=5)for(let x=0;x<width;x+=5)assert.equal(colors[i++],color(waveValue((x-width/2)/scale,(y-height/2)/scale,phase,separation,wavelength)));
   assert.equal(colors.length,i);assert.deepEqual(grid.phases,original);
  }
 }
});
test('one color array is reused across phases and replaced rather than accumulated across geometry',()=>{
 const getField=createWaveFieldCache(),getColors=createWaveColorCache(),grid=getField(600,414,414/280,100,32);let colors;
 assert.equal(sines(()=>colors=getColors(grid,0)),19920);const initial=colors.slice();
 assert.equal(sines(()=>{for(let i=0;i<120;i++)assert.equal(getColors(grid,0),colors);}),0);
 assert.equal(sines(()=>assert.equal(getColors(grid,.375),colors)),19920);assert.notDeepEqual(colors,initial);
 assert.equal(sines(()=>assert.equal(getColors(grid,0),colors)),19920);assert.deepEqual(colors,initial);
 for(const change of [[601,414,414/280,100,32],[600,415,414/280,100,32],[600,414,1,100,32],[600,414,414/280,101,32],[600,414,414/280,100,33]]){
  const next=getField(...change),replacement=getColors(next,0);assert.notEqual(replacement,colors);assert.equal(replacement.length,next.phases.length/2);colors=replacement;
 }
 const empty=getColors(getField(0,240,0,100,32),0);assert.equal(empty.length,0);assert.notEqual(empty,colors);
 const replacement=getColors(grid,0);assert.notEqual(replacement,colors);assert.deepEqual(replacement,initial);
});
test('paused redraws and in-view probe edits reuse field colors while refreshing the complete canvas',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&separation=100&at=v1,7.5,0,0.125'),original=field(h),drawing=h.drawing(),checkpoint=fixed(h);h.el('wave-right').focus();
 assert.deepEqual(original,expectedField(600,414,414/280,100,30,.125));
 assert.equal(sines(()=>{for(let i=0;i<120;i++)h.resize(600,414);}),240,'only two probe displacement sines per redraw remain');assert.deepEqual(h.drawing(),drawing);
 assert.ok(sines(()=>{click(h,'wave-right');click(h,'wave-left');})<300);assert.deepEqual(field(h),original);assert.deepEqual(h.drawing(),drawing);
 assert.equal(sines(()=>{h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();}),4);assert.deepEqual(field(h),original);
 assert.ok(sines(()=>position(h,13.75,-7.125))<150);assert.deepEqual(field(h),original);assert.match(h.el('wave-position-current').textContent,/x 13.75，y -7.125/);assert.notDeepEqual(h.drawing(),drawing);assert.deepEqual(fixed(h),checkpoint);assert.equal(h.frames.size,0);
});
test('time stepping, exact targets and parameter edits refresh colors without stale phases',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&separation=100&at=v1,7.5,0,0.125');
 let time=.125,wavelength=30,separation=100;
 const verify=()=>assert.deepEqual(field(h),expectedField(600,414,414/280,separation,wavelength,time));
 assert.ok(sines(()=>click(h,'step'))>=19920);time+=Math.PI/6;verify();
 click(h,'wave-back');time-=Math.PI/6;verify();
 for(const target of [0,Number.MIN_VALUE,.125,7.125,1e9]){seek(h,target);time=target;verify();assert.equal(h.el('wave-time-error').hidden,true);assert.ok(sines(()=>seek(h,target))<10);verify();}
 h.el('wavelength').handlers.input({target:{value:'70'}});wavelength=70;verify();h.el('separation').handlers.input({target:{value:'180'}});separation=180;verify();
 click(h,'reset');time=0;verify();
});
test('same-time checkpoint return, undo and retained worlds keep probe-specific overlays separate',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&separation=100&at=v1,7.5,0,0.125');position(h,13.75,-7.125);const altered=h.drawing(),original=field(h);click(h,'observation-return');const returned=h.drawing();assert.notDeepEqual(returned,altered);assert.deepEqual(field(h),original);assert.ok(sines(()=>click(h,'observation-undo'))<150);assert.deepEqual(h.drawing(),altered);
 for(const mode of ['orbit','life','fractal','walk']){click(h,'tab-'+mode);assert.equal(sines(()=>click(h,'tab-wave')),2);assert.deepEqual(h.drawing(),altered);}
 await click(h,'share');const url=location.href;seek(h,.75);click(h,'observation-return');assert.deepEqual(h.drawing(),altered);click(h,'observation-undo');assert.deepEqual(field(h),expectedField(600,414,414/280,100,30,.75));assert.equal(location.href,url);
});
test('geometry, expanded views and collapse replace cached colors; density and context redraws reuse them',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&separation=100&at=v1,0,0,0.125');
 assert.equal(sines(()=>{h.setDpr(2);h.setDpr(3);h.setDpr(1);}),4);
 assert.equal(sines(()=>{h.loseContext();h.restoreContext();}),2);
 for(const [width,height] of [[233,240],[334.5,281.75],[0,0],[20,20],[600,414]]){h.resize(width,height);const scale=Math.min(Math.min(width,height)/280,(width/2-18),(height/2-18));assert.deepEqual(field(h),expectedField(width,height,scale,100,30,.125));}
 position(h,10000,-10000);assert.deepEqual(field(h),expectedField(600,414,(414/2-18)/10000,100,30,.125));click(h,'wave-home');assert.deepEqual(field(h),expectedField(600,414,414/280,100,30,.125));
});
test('animation keeps exact evolving colors and visibility resume never advances a hidden clock',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&separation=100&at=v1,7.5,0,0.125');click(h,'pause');h.tick(0);let time=.125;
 for(let i=1;i<=30;i++){assert.equal(sines(()=>h.tick(i*16)),19922);time+=.016;assert.deepEqual(field(h),expectedField(600,414,414/280,100,30,time));}
 const colors=field(h),quiet=h.el('announcement').textContent;h.setHidden(true);assert.equal(h.frames.size,0);h.setHidden(false);assert.equal(sines(()=>h.tick(90000)),0);assert.deepEqual(field(h),colors);
 h.setVisible(false);assert.equal(h.frames.size,0);h.setVisible(true);h.tick(100000);assert.deepEqual(field(h),colors);assert.equal(h.el('announcement').textContent,quiet);
 assert.equal(sines(()=>click(h,'pause')),2);assert.deepEqual(field(h),colors);assert.equal(h.frames.size,0);click(h,'pause');h.motion.change({matches:true});assert.equal(h.frames.size,0);assert.deepEqual(field(h),colors);
});
test('target drafts, validation errors, fixed links and discoveries survive cached redraws',async()=>{
 const h=await setup('?experiment=wave&wavelength=30&separation=100&at=v1,7.5,0,0.125');click(h,'pause');h.tick(0);const before=field(h),checkpoint=fixed(h),pending=[...h.frames.keys()];type(h,'wave-target-x','-');type(h,'wave-target-y','12.5');click(h,'wave-position');type(h,'wave-time','1e+');click(h,'wave-time-seek');
 assert.deepEqual(field(h),before);assert.deepEqual(fixed(h),checkpoint);assert.deepEqual([...h.frames.keys()],pending);assert.equal(h.el('wave-position-error').hidden,false);assert.equal(h.el('wave-time-error').hidden,false);h.resize(600,414);assert.equal(h.el('wave-target-x').value,'-');assert.equal(h.el('wave-time').value,'1e+');
 click(h,'mission-start');assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');click(h,'wave-home');assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');const notes=h.el('field-notes-list').innerHTML;position(h,13.75,-7.125);h.resize(600,414);assert.equal(h.el('field-notes-list').innerHTML,notes);
});
test('saved large phases and changed history restore exact field colors; intentional batch repeats remain',async()=>{
 const h=await setup('?experiment=wave');h.navigate('?experiment=wave&wavelength=15&separation=180&at=v1,10000,-10000,1000000000');assert.deepEqual(field(h),expectedField(600,414,(414/2-18)/10000,180,15,1e9));
 h.navigate('?experiment=wave&wavelength=70&separation=20&at=v1,0,0,0');assert.deepEqual(field(h),expectedField(600,414,414/280,20,70,0));
 click(h,'tab-fractal');for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('batch repeat suppressed');}});click(h,'step');}assert.match(h.el('metrics').textContent,/500 个点/);click(h,'tab-walk');h.key('ArrowRight');h.key('ArrowRight',{repeat:true});assert.match(h.el('metrics').textContent,/48 步/);
});
test('fresh app entry loads exact-color reuse without changing the original field sampler',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),app=readFileSync(new URL('../app.js',import.meta.url),'utf8');assert.match(html,/app\.js\?[^"\n]+&amp;colors=wave-once-1&amp;orbit-fit=first-body-1&amp;canvas-start=retry-1&amp;sampling=wave-field-fallback-1&amp;nudge=single-enter-1&amp;walk-batch=reverse-1&amp;fractal-batch=reverse-1&amp;cycle=disclosure-1&amp;coordinate-draft=current-1&amp;life-draft=current-1&amp;bar-drawer=idle-1&amp;time-draft=current-1&amp;count-draft=current-1&amp;life-batch=recorded-1"/);assert.match(app,/import \{createWaveColorCache\} from '\.\/wave-colors\.js'/);assert.match(app,/colors=getWaveColors\(field,t\*WAVE_ANGULAR_SPEED\)/);assert.match(app,/ctx\.fillStyle=colors\[sample\+\+\]/);
});
