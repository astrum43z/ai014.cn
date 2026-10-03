import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
const rangeRules=[...css.matchAll(/input\[type=range\]\{([^}]+)\}/g)].map(([,body])=>body);
const declarations=Object.fromEntries(rangeRules.join(';').split(';').filter(Boolean).map(declaration=>declaration.trim().split(':').map(part=>part.trim())));

test('native parameter sliders have a 44px hit area at every breakpoint',()=>{
 assert.equal(declarations.height,'44px');
 assert.equal(declarations['min-height'],'44px');
 assert.equal(declarations.width,'100%');
 assert.doesNotMatch(css,/@media[^}]*input\[type=range\][^{]*\{[^}]*height:16px/);
});

test('the larger slider target preserves the old track center and native appearance',()=>{
 assert.equal(declarations.margin,'1px 0 0');
 assert.equal(parseFloat(declarations.margin)+parseFloat(declarations.height)/2,15+16/2);
 assert.equal(declarations['accent-color'],'var(--ink)');
 assert.equal(declarations.appearance,undefined);
 assert.equal(declarations['touch-action'],undefined,'native dragging and page scrolling stay browser-managed');
 assert.equal(declarations.transform,undefined,'increase the input box rather than visually scaling the track');
});

test('every exhibit keeps the existing labeled native range inputs',()=>{
 assert.match(app,/c\.sliders\.map\(\(\[id,label,min,max,initial,unit\]\)=>/);
 assert.ok(app.includes('<input id="${id}" type="range" min="${min}" max="${max}" value="${value}" aria-label="${label}"'));
 assert.ok(app.includes('aria-describedby="${help}"'),'effect help supplements the native range');
 assert.doesNotMatch(app,/role="slider"|tabindex="-1"[^>]*type="range"/);
 assert.ok(app.includes("c.sliders.forEach"),'existing input handlers remain in place');
});

test('the expanded focus outline stays inside the slider rather than covering its label',()=>{
 assert.match(css,/input\[type=range\]:focus-visible\{outline-offset:-3px\}/);
 assert.match(css,/input:focus-visible[^}]*outline:3px solid var\(--focus-ring\)/);
});
