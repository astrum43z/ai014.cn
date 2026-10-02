import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
for(const id of ['home','lab','field-notes','about'])test(`${id}: native section navigation has a named focus destination without a new Tab stop`,()=>{
 const section=html.match(new RegExp(`<section[^>]*id="${id}"[^>]*>`))?.[0];
 assert.ok(section);
 assert.match(section,/tabindex="-1"/);
 const label=section.match(/aria-labelledby="([^"]+)"/)?.[1];
 assert.ok(label,'section names its heading');
 assert.match(html,new RegExp(`<h[12][^>]*id="${label}"[^>]*>[^<]+`));
 assert.match(html,new RegExp(`href="#${id}"`),'an existing native link reaches it');
 assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1);
});

import {setup} from './life-challenge-harness.js';
for(const id of ['home','lab','field-notes','about'])test(`${id}: changed world or parameters recover the section focus after history restoration`,async()=>{
 const h=await setup('?experiment=wave');let focus=[];
 h.el(id).focus=options=>focus.push({options,mode:h.el('stage-title').textContent});
 h.navigate('?experiment=life&rate=3&density=45#'+id);
 assert.equal(focus.length,1);assert.match(focus[0].mode,/生命/);
 assert.deepEqual(focus[0].options,{preventScroll:true});
 h.navigate('?experiment=life&rate=4&density=45#'+id);
 assert.equal(focus.length,2,'same-world parameter restoration also rebuilds controls');
 h.navigate('?experiment=life&rate=4&density=45#canvas');
 h.navigate('?experiment=life&rate=4&density=45#'+id);
 assert.equal(focus.length,2,'anchor-only traversal remains native');
 h.navigate('?experiment=wave#'+id);assert.equal(focus.length,3,'Forward can recover too');
});
test('unknown and existing reading fragments are not intercepted by section-focus recovery',async()=>{
 const h=await setup('?experiment=life');let calls=0;
 for(const id of ['home','lab','field-notes','about','canvas','observation-title','discovery-title','unknown'])h.el(id).focus=()=>calls++;
 for(const hash of ['#canvas','#observation-title','#discovery-title','#unknown','']){
  h.navigate('?experiment=wave'+hash);h.navigate('?experiment=life'+hash);
 }
 assert.equal(calls,0);
});
