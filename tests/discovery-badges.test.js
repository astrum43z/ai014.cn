import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './life-challenge-harness.js';

const modes=['orbit','life','wave','fractal','walk'];
const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
function expectBadges(h,earned){
 for(const mode of modes){
  const discovered=earned.includes(mode),tab=h.el('tab-'+mode);
  assert.equal(tab.getAttribute('aria-describedby')||'',discovered?'seal-'+mode:'',mode+' description');
  assert.equal(tab.getAttribute('data-discovered'),String(discovered),mode+' visual state');
  assert.equal(h.el('seal-'+mode).hidden,!discovered,mode+' full badge');
 }
}
function first(h,mode){
 if(mode==='fractal')click(h,'fractal-1000');
 if(mode!=='life')click(h,'mission-check');
}
function prepareFinal(h,mode){
 if(mode==='orbit'){input(h,'gravity',40);for(let i=0;i<70;i++)click(h,'step');}
 if(mode==='life')for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 if(mode==='wave')click(h,'wave-home');
 if(mode==='fractal'){input(h,'seed',15);click(h,'fractal-1000');}
 if(mode==='walk')click(h,'walk-64');
}

for(const mode of modes)test(`${mode}: badge description appears only after the verified final check`,async()=>{
 const h=await setup('?experiment='+mode);
 expectBadges(h,[]);click(h,'mission-start');expectBadges(h,[]);
 first(h,mode);expectBadges(h,[]);
 click(h,'mission-check');expectBadges(h,[],'repeated or corrective checks do not earn badges');
 prepareFinal(h,mode);expectBadges(h,[],'reaching the model state alone does not earn a badge');
 const before={drawing:h.drawing(),url:location.href,metrics:h.el('metrics').textContent};
 click(h,'mission-check-inline');expectBadges(h,[mode]);
 assert.deepEqual({drawing:h.drawing(),url:location.href,metrics:h.el('metrics').textContent},before);
 assert.equal(h.el('passport-count').textContent,'本次发现 1 / 5');
 assert.equal(document.activeElement,h.el('mission-result'),'existing completion focus remains');
 click(h,'mission-check');expectBadges(h,[mode]);
 assert.equal(h.el('tab-'+mode).getAttribute('aria-selected'),'true');
});

for(const mode of modes)test(`${mode}: earned description follows historical notes through replacement and return`,async()=>{
 const h=await setup('?experiment='+mode);click(h,'mission-start');first(h,mode);prepareFinal(h,mode);click(h,'mission-check');
 const note=h.el('notes-text').value;
 for(const other of modes){
  click(h,'tab-'+other);expectBadges(h,[mode]);
  assert.equal(h.el('tab-'+other).getAttribute('aria-selected'),'true');
 }
 click(h,'tab-'+mode);click(h,'mission-start');expectBadges(h,[mode]);
 assert.equal(h.el('mission-state').textContent,'探索中');
 const changes={orbit:'gravity=90',life:'rate=3',wave:'wavelength=40',fractal:'seed=16',walk:'seed=16'};
 h.navigate('?experiment='+mode+'&'+changes[mode]+'#lab');expectBadges(h,[mode]);
 assert.equal(h.el('mission-state').textContent,'可选探索');
 assert.equal(h.el('notes-text').value,note);
 h.resize(320,230);expectBadges(h,[mode]);
 h.navigate(location.search+'#field-notes');expectBadges(h,[mode]);
 const fresh=await setup('?experiment='+mode);expectBadges(fresh,[]);
 assert.equal(fresh.el('passport-count').textContent,'本次发现 0 / 5');
});

test('all five earned descriptions accumulate without changing names, selection or tab navigation',async()=>{
 const h=await setup();const earned=[];
 for(const mode of modes){
  click(h,'tab-'+mode);click(h,'mission-start');first(h,mode);prepareFinal(h,mode);click(h,'mission-check');
  earned.push(mode);expectBadges(h,earned);
 }
 assert.equal(h.el('passport-count').textContent,'本次发现 5 / 5');
 h.el('tab-walk').handlers.keydown({key:'ArrowRight',preventDefault(){}});
 assert.equal(document.activeElement,h.el('tab-orbit'));expectBadges(h,modes);
 assert.equal(h.el('tab-orbit').getAttribute('aria-selected'),'true');
 for(const mode of modes)assert.equal(h.el('tab-'+mode).getAttribute('aria-label'),null,'runtime does not overwrite the static accessible name');
});

test('standalone solved Life comparison does not imply a recorded discovery',async()=>{
 const h=await setup('?experiment=life');click(h,'life-challenge-start');prepareFinal(h,'life');click(h,'life-test');
 assert.equal(h.el('life-test-result').getAttribute('data-solved'),'true');expectBadges(h,[]);
 click(h,'tab-wave');click(h,'tab-life');expectBadges(h,[]);
});

test('animation, resizing and fixed observation navigation do not announce or rewrite badge descriptions',async()=>{
 const h=await setup('?experiment=wave');click(h,'mission-start');first(h,'wave');prepareFinal(h,'wave');click(h,'mission-check');
 await click(h,'share');const saved=location.href;
 let writes=0;
 for(const mode of modes){
  const tab=h.el('tab-'+mode),set=tab.setAttribute.bind(tab);
  tab.setAttribute=(name,value)=>{if(name==='aria-describedby')writes++;set(name,value);};
 }
 click(h,'pause');const announced=h.el('announcement').textContent;
 h.tick(0);for(let i=1;i<=10;i++)h.tick(i*30);
 h.resize(320,230);h.navigate(location.search+'#lab');
 assert.equal(writes,0);assert.equal(h.el('announcement').textContent,announced);
 assert.equal(location.search,new URL(saved).search);assert.equal(h.frames.size,1);expectBadges(h,['wave']);
});

test('descriptions reuse unique existing badges, fixed names and decorative compact labels',()=>{
 const labels={orbit:'引力游乐场',life:'生命的形状',wave:'波纹：波与波相遇',fractal:'分形：随机长出秩序',walk:'漫步也会扩散'};
 for(const mode of modes){
  const tab=html.match(new RegExp('<button[^>]*id="tab-'+mode+'"[^>]*>[\\s\\S]*?<\\/button>'))?.[0];
  assert.ok(tab);assert.ok(tab.includes('aria-label="'+labels[mode]+'"'));
  assert.match(tab,/role="tab"/);assert.match(tab,/aria-controls="panel"/);
  assert.ok(tab.includes('<span class="tab-seal" id="seal-'+mode+'" hidden>已发现 ✓</span>'));
  assert.equal(html.split('id="seal-'+mode+'"').length-1,1);
  assert.match(tab,/<span class="tab-short" aria-hidden="true">[^<]+<\/span>/);
  assert.doesNotMatch(tab,/aria-live|aria-describedby|role="status"/,'fresh markup claims no earned status');
 }
});

test('compact earned checkmark is a shape in the existing label, with no added control or wider fixed target',()=>{
 const rule=css.slice(css.indexOf('/* Keep earned findings recognizable'));
 assert.match(rule,/@media\(max-width:720px\)/);
 assert.match(rule,/\.tab\[data-discovered="true"\]>\.tab-short::after\{content:' ✓';font-size:11px;white-space:nowrap\}/);
 assert.doesNotMatch(rule,/min-width|position|height|display|aria/);
});
