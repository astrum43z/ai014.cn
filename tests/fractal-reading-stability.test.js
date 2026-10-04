import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const ids=['fractal-jump-reading','fractal-touch-reading','fractal-jump-note'];
const click=(h,id)=>h.el(id).handlers.click();
const texts=h=>ids.map(id=>h.el(id).textContent);
function track(h){
 const writes=new Map(ids.map(id=>[id,0]));
 for(const id of ids){let text=h.el(id).textContent;Object.defineProperty(h.el(id),'textContent',{get:()=>text,set:value=>{writes.set(id,writes.get(id)+1);text=value;}});}
 return {writes,total:()=>[...writes.values()].reduce((a,b)=>a+b,0),reset:()=>ids.forEach(id=>writes.set(id,0))};
}
// Independent integer recurrence identifies the actual last random choice.
// Neither production model nor its reading formatter supplies the expectation.
function lastVertex(count,seed){let state=BigInt(seed);for(let i=0;i<count;i++)state=(1664525n*state+1013904223n)%4294967296n;return 'ABC'[Number(state*3n/4294967296n)];}
function check(h,count=300,seed=14,jump=50,paused=true){
 const reading=`第 ${count} 点，抽中顶点 ${lastVertex(count,seed)}；向它前进 ${jump}%，余下 ${100-jump}%`;
 assert.deepEqual(texts(h),[reading,reading+(count>=12000?'；已达 12,000 点上限，可退回一点或重置。':count<=300?'；已回到 300 点起点。':'。'),paused?'空心圈是出发点，橙色实心点是新落点；橙线是本次前进，虚线指向选中的顶点。':'运行中暂隐连线；暂停或只走一步，即可拆开看最后一次跳跃。']);
 assert.equal(h.el('metrics').textContent,`${count} 个点 · 前进 ${jump}% · 种子 ${seed}`);
}
function seek(h,count){h.el('fractal-count').value=String(count);click(h,'fractal-seek');}

test('120 paused redraws retain three Fractal text nodes rather than replacing them 360 times',async()=>{
 const h=await setup('?experiment=fractal&seed=23&jump=38&at=v1,731'),writes=track(h),before=texts(h),drawing=h.drawing(),message=h.el('announcement').textContent;
 for(let i=0;i<120;i++)h.resize(600,414);
 assert.equal(writes.total(),0);assert.deepEqual(texts(h),before);assert.deepEqual(h.drawing(),drawing);assert.equal(h.el('announcement').textContent,message);check(h,731,23,38);
});

test('focus, layout, density, visibility and context redraws leave unchanged nodes and repair stale DOM',async()=>{
 const h=await setup('?experiment=fractal&at=v1,1000'),writes=track(h),before=texts(h);
 h.el('canvas').handlers.focus();h.el('canvas').handlers.blur();
 for(const dimensions of [[259,240],[171,240],[455.5,281.75],[600,414]])h.resize(...dimensions);
 for(const density of [1.25,2,3,1])h.setDpr(density);
 h.loseContext();h.restoreContext();h.setHidden(true);h.setHidden(false);h.setVisible(false);h.setVisible(true);
 assert.equal(writes.total(),0);assert.deepEqual(texts(h),before);
 for(const id of ids)h.el(id).textContent='stale';writes.reset();h.resize(600,414);
 assert.deepEqual(texts(h),before);assert.deepEqual([...writes.writes.values()],[1,1,1]);writes.reset();h.resize(600,414);assert.equal(writes.total(),0);
});

test('running batches write only changed readings; pause guidance updates once and live feedback stays quiet',async()=>{
 const h=await setup('?experiment=fractal'),writes=track(h);click(h,'pause');check(h,300,14,50,false);writes.reset();
 let previous=texts(h);const changes=new Map(ids.map(id=>[id,0])),message=h.el('announcement').textContent;
 h.tick(0);for(let i=1;i<=120;i++){
  h.tick(i*1000/60);const current=texts(h);ids.forEach((id,index)=>{if(current[index]!==previous[index])changes.set(id,changes.get(id)+1);});previous=current;
 }
 assert.deepEqual(writes.writes,changes);assert.ok(writes.total()>0);assert.equal(writes.writes.get('fractal-jump-note'),0);assert.equal(h.el('announcement').textContent,message);
 const count=Number(h.el('metrics').textContent.split(' ')[0]);check(h,count,14,50,false);writes.reset();click(h,'pause');check(h,count);assert.deepEqual([...writes.writes.values()],[0,0,1]);assert.equal(h.frames.size,0);
 click(h,'pause');writes.reset();h.motion.change({matches:true});check(h,count);assert.deepEqual([...writes.writes.values()],[0,0,1]);h.motion.change({matches:false});assert.equal(h.frames.size,0);
});

test('single replay, exact targets and limits preserve every last-choice reading and point',async()=>{
 const h=await setup('?experiment=fractal'),writes=track(h);check(h);const start=h.drawing();
 click(h,'fractal-forward');check(h,301);const next=h.drawing();click(h,'fractal-back');check(h);assert.deepEqual(h.drawing(),start);
 h.key('ArrowRight');assert.deepEqual(h.drawing(),next);h.key('ArrowLeft');assert.deepEqual(h.drawing(),start);
 for(const count of [731,11999,12000,300]){seek(h,count);check(h,count);}
 seek(h,12000);writes.reset();click(h,'fractal-forward');click(h,'step');h.resize(600,414);assert.equal(writes.total(),0);check(h,12000);
 click(h,'fractal-back');check(h,11999);click(h,'fractal-step');check(h,12000);click(h,'fractal-1000');check(h,1000);assert.equal(h.el('fractal-count').value,'12000');
});

test('seed, ratio, reset, preset and URL changes update actual readings at equal counts',async()=>{
 const h=await setup('?experiment=fractal&seed=23&jump=38&at=v1,731');check(h,731,23,38);
 h.el('seed').handlers.input({target:{value:'99'}});check(h,300,99,38);
 h.el('jump').handlers.input({target:{value:'70'}});check(h,300,99,70);seek(h,1000);check(h,1000,99,70);click(h,'reset');check(h,300,99,70);
 h.el('preset-select').handlers.change({target:{value:'overlap'}});click(h,'load-preset');check(h,300,99,38);
 h.navigate('?experiment=fractal&seed=1&jump=35&at=v1,731');check(h,731,1,35);click(h,'guide-start');check(h);
});

test('fixed sharing, saved return, undo and retained worlds preserve both reading and drawing',async()=>{
 const h=await setup('?experiment=fractal&seed=23&jump=65&at=v1,731','#canvas');await click(h,'share');const url=location.href,link=h.el('share-link').value;
 click(h,'fractal-back');check(h,730,23,65);const before=texts(h),drawing=h.drawing();
 for(const world of ['orbit','life','wave','walk']){click(h,'tab-'+world);click(h,'tab-fractal');assert.deepEqual(texts(h),before);assert.deepEqual(h.drawing(),drawing);}
 assert.equal(h.el('share-link').value,link);assert.equal(location.href,url);
 click(h,'observation-return');check(h,731,23,65);click(h,'observation-undo');check(h,730,23,65);assert.deepEqual(h.drawing(),drawing);
 const writes=track(h);h.navigate(url.replace('#canvas','#observation-title'));assert.deepEqual(texts(h),before);assert.equal(writes.total(),0);
});

test('text-only startup and temporary collapsed layout preserve readings through recovery',async()=>{
 const h=await setup('?experiment=fractal&at=v1,731','',true,1,false),writes=track(h);check(h,731);click(h,'fractal-forward');check(h,732);
 h.resize(0,0);click(h,'fractal-back');check(h,731);writes.reset();h.setContextReady(true);click(h,'canvas-retry');h.resize(600,414);check(h,731);assert.equal(writes.total(),0);
});

test('discovery evidence and intentional Fractal/Walk batch repeats keep their original effects',async()=>{
 const h=await setup('?experiment=fractal');click(h,'mission-start');click(h,'fractal-1000');click(h,'mission-check');h.el('seed').handlers.input({target:{value:'15'}});click(h,'fractal-1000');assert.equal(h.el('notes-count').textContent,'0 / 5');click(h,'mission-check');assert.equal(h.el('notes-count').textContent,'1 / 5');
 const notes=h.el('notes-text').value;
 for(const repeat of [false,true]){h.el('step').handlers.keydown({key:'Enter',repeat,preventDefault(){assert.fail('intentional batch blocked');}});click(h,'step');}check(h,1200,15);h.resize(259,240);assert.equal(h.el('notes-text').value,notes);
 click(h,'tab-walk');h.key('ArrowRight');h.key('ArrowRight',{repeat:true});assert.match(h.el('metrics').textContent,/48 步/);assert.equal(h.el('notes-text').value,notes);
});

test('fresh pages load the stable-reading asset while paragraphs stay quiet',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/app\.js\?[^"\n]*&amp;fractal-text=stable-1/);
 for(const id of ids){const element=html.match(new RegExp('<[^>]+id="'+id+'"[^>]*>'))?.[0];assert.ok(element);assert.ok(!/aria-live="(?:polite|assertive)"|role="(?:status|alert)"/.test(element));}
});
