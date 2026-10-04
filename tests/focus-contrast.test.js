import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const root=css.match(/:root\{([^}]+)\}/)[1];
const token=name=>root.match(new RegExp('--'+name+':(#[0-9a-f]{6})'))?.[1];
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
function luminance(color){return color.map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);}
function contrast(foreground,background,opacity=1){
 const bg=rgb(background),fg=rgb(foreground).map((c,i)=>c*opacity+bg[i]*(1-opacity));
 const [lo,hi]=[luminance(fg),luminance(bg)].sort((a,b)=>a-b);return (hi+.05)/(lo+.05);
}
function checkSurfaces(foreground,surfaces,opacity=1){
 assert.ok(foreground,'focus color is defined');
 for(const surface of surfaces)assert.ok(contrast(foreground,surface,opacity)>=3,`${foreground} on ${surface} at ${opacity} must contrast at least 3:1`);
}

test('light-surface focus contrasts with page, controls, notes, guidance and inset tab fills',()=>{
 const colors=['#f3f4ec','#fafbf5','#e6ecd8','#dce5cf','#d3f35b','#f9faf3','#e9eddc','#eaf0dc','#e8efdb','#fafcf2','#e8eddf','#f9fbf1','#ffffff','#edf1e7'];
 checkSurfaces(token('focus-on-light'),colors);
 assert.ok(contrast('#ec8867','#f3f4ec')<3,'retain evidence of the original light-background gap');
});

test('dark-surface focus contrasts with canvas, instrument drawer and nested Life challenge',()=>{
 checkSurfaces(token('focus-on-dark'),['#122e29','#1b3931','#244136']);
});

test('pending contact and unavailable Life undo keep a visible ring through their existing opacity',()=>{
 const contact=Number(css.match(/#copy-wechat\[aria-disabled="true"\]\{[^}]*opacity:([.\d]+)/)[1]);
 const undo=Number(css.match(/\.life-touch #life-undo-edit\[aria-disabled="true"\]\{[^}]*opacity:([.\d]+)/)[1]);
 checkSurfaces(token('focus-on-light'),['#f3f4ec'],contact);
 checkSurfaces(token('focus-on-dark'),['#1b3931'],undo);
});

test('focus colors inherit from the adjacent surface and reset on both pale stage islands',()=>{
 assert.match(root,/--focus-ring:var\(--focus-on-light\)/);
 assert.match(css,/\.stage,\.instrument-drawer\{--focus-ring:var\(--focus-on-dark\)\}/);
 assert.match(css,/\.stage-controls,\.experiment-shortcuts\{--focus-ring:var\(--focus-on-light\)\}/);
 // Do not color by button fill: pale controls within dark areas have an outside ring.
 assert.doesNotMatch(css,/button[^{}]*\{[^}]*--focus-ring:/);
});

test('every authored focus outline uses the surface token while retaining its visible geometry',()=>{
 const outlines=[...css.matchAll(/([^{}]+)\{([^{}]*outline:3px solid [^{}]+)\}/g)].filter(([,selectors])=>selectors.includes(':focus-visible'));
 assert.equal(outlines.length,9);
 for(const [,selectors,body] of outlines){
  assert.match(body,/outline:3px solid var\(--focus-ring\)/,selectors);
  assert.match(body,/outline-offset:-?\d+px/,selectors);
 }
 assert.doesNotMatch(css,/outline:3px solid #[0-9a-f]+/);
 assert.match(css,/\.tab:focus-visible\{outline-offset:-4px\}/);
 assert.match(css,/input\[type=range\]:focus-visible\{outline-offset:-3px\}/);
});

test('dark instruments, pale controls and stage shortcuts remain separate existing containers',()=>{
 for(const name of ['stage','stage-controls','experiment-shortcuts','instrument-drawer'])assert.match(html,new RegExp('class="'+name+'"'));
 assert.match(html,/href="style\.css\?v=saved-observation-copy-1&amp;browse=living-cells-1&amp;seek=exact-count-1&amp;wave=quarter-rewind-1"/);
 assert.doesNotMatch(css,/forced-color-adjust:none/,'system forced colors remain free to replace authored colors');
});

test('the full-width canvas ring has a dark backing on mixed adjacent surfaces without resizing its box',()=>{
 const rule=css.match(/canvas:focus-visible\{([^}]*box-shadow:[^}]+)\}/)?.[1];
 assert.ok(rule);
 assert.match(rule,/position:relative;z-index:1/,'paint the backing above the adjacent controls column');
 assert.match(rule,/box-shadow:0 0 0 10px #122e29/,'cover the 5px gap, 3px ring and 2px outer edge');
 assert.doesNotMatch(rule,/(?:^|;)(?:width|height|padding|margin|border|top|left|right|bottom|transform):/);
 checkSurfaces(token('focus-on-dark'),['#122e29']);
 checkSurfaces('#122e29',['#f3f4ec','#fafbf5']);
});
