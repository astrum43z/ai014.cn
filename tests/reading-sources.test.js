import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const sources={
 orbit:{title:'NASA · 轨道与开普勒定律 ↗',url:'https://science.nasa.gov/solar-system/orbits-and-keplers-laws/',format:'英文网页'},
 life:{title:'Wikipedia · 生命游戏 ↗',url:'https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life',format:'英文网页'},
 wave:{title:'OpenStax · 波的干涉 ↗',url:'https://openstax.org/books/university-physics-volume-1/pages/16-5-interference-of-waves',format:'英文教材'},
 fractal:{title:'Wolfram MathWorld · 混沌游戏 ↗',url:'https://mathworld.wolfram.com/ChaosGame.html',format:'英文网页'},
 walk:{title:'MIT OCW · 随机漫步与扩散 ↗',url:'https://ocw.mit.edu/courses/18-354j-nonlinear-dynamics-ii-continuum-systems-spring-2015/6fa55d6a1a061e30d32538d51803fbf1_MIT18_354JS15_Ch5.pdf',format:'英文 PDF · 6 页'}
};
function checkSource(h,mode){
 const source=sources[mode];
 assert.equal(h.el('learn').textContent,source.title);
 assert.equal(h.el('learn').href,source.url);
 assert.equal(h.el('learn-note').textContent,source.format+' · 新标签页打开');
}
for(const mode of Object.keys(sources))test(`${mode}: direct entry names its existing reading destination and announces its format before opening`,async()=>{
 const h=await setup('?experiment='+mode);
 checkSource(h,mode);
});

test('source descriptions follow repeated tab navigation without retaining PDF metadata in another world',async()=>{
 const h=await setup('?experiment=walk');
 for(const mode of ['orbit','life','wave','fractal','walk','wave','walk','life']){
  h.el('tab-'+mode).handlers.click();
  checkSource(h,mode);
 }
});

test('restored history changes the reference with the restored experiment',async()=>{
 const h=await setup('?experiment=walk');
 for(const mode of ['life','fractal','wave','orbit','walk']){
  h.navigate('?experiment='+mode+'#discovery-title');
  checkSource(h,mode);
 }
});

test('reading navigation and tab return preserve a live canvas separately from its fixed checkpoint',async()=>{
 const h=await setup('?experiment=walk&bias=0&seed=14&at=v1,64','#discovery-title');
 assert.match(h.el('metrics').textContent,/64 步/);
 h.el('walk-step-one').handlers.click();
 assert.match(h.el('metrics').textContent,/65 步/);
 assert.equal(new URL(location.href).searchParams.get('at'),'v1,64');
 const metrics=h.el('metrics').textContent,href=location.href;
 h.navigate(href.replace('#discovery-title','#observation-title'));
 assert.equal(h.el('metrics').textContent,metrics);
 checkSource(h,'walk');
 h.el('tab-wave').handlers.click();checkSource(h,'wave');
 h.el('tab-walk').handlers.click();checkSource(h,'walk');
 assert.equal(h.el('metrics').textContent,metrics);
 assert.equal(location.search,new URL(href).search);
 assert.equal(h.el('status').textContent,'已暂停');
});

test('presets, guides and parameter changes leave the matching source in place',async()=>{
 const h=await setup('?experiment=fractal');
 h.el('preset-select').handlers.change({target:{value:'islands'}});
 h.el('load-preset').handlers.click();checkSource(h,'fractal');
 h.el('seed').handlers.input({target:{value:'22'}});checkSource(h,'fractal');
 h.el('guide-start').handlers.click();checkSource(h,'fractal');
 h.el('discovery-next').handlers.click();checkSource(h,'walk');
});

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
test('the existing native source link has a visible associated description and a useful static fallback',()=>{
 const link=html.match(/<a id="learn"[^>]*>[^<]+<\/a>/)?.[0];
 assert.ok(link);
 assert.match(link,/aria-describedby="learn-note"/);
 assert.match(link,/target="_blank"/);
 assert.match(link,/rel="noopener noreferrer"/);
 assert.match(link,/NASA · 轨道与开普勒定律 ↗/);
 assert.match(html,/<p id="learn-note">英文网页 · 新标签页打开<\/p>/);
 assert.equal((html.match(/id="learn"/g)||[]).length,1);
 assert.equal((html.match(/id="learn-note"/g)||[]).length,1);
 assert.doesNotMatch(link,/aria-label=|tabindex=|download=/,'keep visible title as the accessible name and native navigation semantics');
 const section=html.match(/<div class="reading-source">([\s\S]*?)<\/div>/)?.[1];
 assert.ok(section);assert.doesNotMatch(section,/aria-live|role="status"/,'source descriptions do not announce during model updates');
});

test('reference text can wrap at mobile and zoomed widths with a comfortable link target',()=>{
 assert.match(css,/\.reading-source\{[^}]*min-width:0/);
 assert.match(css,/\.explain \.reading-source a\{[^}]*min-height:44px/);
 assert.match(css,/\.explain \.reading-source a\{[^}]*font-size:13px/);
 assert.match(css,/\.explain \.reading-source a\{[^}]*overflow-wrap:anywhere/);
 assert.match(css,/\.explain \.reading-source p\{[^}]*font-size:12px/);
 assert.match(css,/@media\(max-width:720px\)\{\.explain \.reading-source p\{font-size:13px/);
});
