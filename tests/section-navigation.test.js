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
