import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindContactCopy} from '../contact.js';
import {setup as setupLab} from './life-challenge-harness.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function setup(clipboard){
 const document={body:{id:'body'},activeElement:null};let disabled=false,disabledWrites=0;
 const button={hidden:true,attributes:{},handlers:{},ownerDocument:document,
  get disabled(){return disabled;},set disabled(value){disabledWrites++;disabled=value;if(value&&document.activeElement===button)document.activeElement=document.body;},
  setAttribute(name,value){this.attributes[name]=String(value);},addEventListener(name,handler){this.handlers[name]=handler;},focus(){document.activeElement=this;}};
 const field={value:'goodmorning2you',selection:[2,5],focuses:0,selections:0,
  focus(){this.focuses++;document.activeElement=this;},select(){this.selections++;},setSelectionRange(start,end){this.selection=[start,end];}};
 const status={textContent:''};button.focus();
 const copy=bindContactCopy({button,field,status,getClipboard:()=>clipboard});
 return {document,button,field,status,copy,disabledWrites:()=>disabledWrites};
}
function key(s,key,repeat=false){
 let prevented=false;s.button.handlers.keydown?.({key,repeat,preventDefault(){prevented=true;}});
 return {prevented,completion:key==='Enter'&&!prevented?s.button.handlers.click():undefined};
}

test('pending contact copy retains focus, exposes busy state and rejects duplicate activation',async()=>{
 const operation=deferred(),writes=[];const s=setup({writeText:text=>{writes.push(text);return operation.promise;}});
 const pending=s.copy();assert.equal(s.document.activeElement,s.button);assert.equal(s.disabledWrites(),0);
 assert.equal(s.button.attributes['aria-disabled'],'true');assert.equal(s.button.attributes['aria-busy'],'true');
 assert.match(s.status.textContent,/正在复制/);
 for(let i=0;i<8;i++)await s.button.handlers.click();assert.deepEqual(writes,['goodmorning2you']);
 operation.resolve();await pending;assert.equal(s.document.activeElement,s.button);assert.equal(s.status.textContent,'微信号已复制');
 assert.equal(s.button.attributes['aria-disabled'],'false');assert.equal(s.button.attributes['aria-busy'],'false');assert.equal(s.disabledWrites(),0);
});

for(const [name,clipboard] of [['missing',undefined],['rejected',{writeText:()=>Promise.reject(Error('denied'))}],['throwing',{writeText:()=>{throw Error('unavailable');}}]])test(name+' clipboard keeps immediate manual recovery available',async()=>{
 const s=setup(clipboard);await s.copy();assert.equal(s.document.activeElement,s.field);
 assert.equal(s.field.focuses,1);assert.equal(s.field.selections,1);assert.deepEqual(s.field.selection,[0,s.field.value.length]);
 assert.match(s.status.textContent,/未能自动复制.*手动复制/);assert.equal(s.button.attributes['aria-disabled'],'false');assert.equal(s.button.attributes['aria-busy'],'false');
 assert.equal(s.disabledWrites(),0);s.button.focus();await s.copy();assert.equal(s.document.activeElement,s.field);assert.equal(s.field.focuses,2);
});

test('a delayed denial never steals focus from the next task or replaces an existing manual selection',async()=>{
 for(const target of ['canvas','parameter','tab','contact-field','body','outside-document']){
  const operation=deferred(),s=setup({writeText:()=>operation.promise});const pending=s.copy();
  const next=target==='contact-field'?s.field:target==='body'?s.document.body:target==='outside-document'?null:{id:target};
  s.document.activeElement=next;operation.reject(Error('late denial'));await pending;
  assert.equal(s.document.activeElement,next,target);assert.equal(s.field.focuses,0,target);assert.equal(s.field.selections,0,target);assert.deepEqual(s.field.selection,[2,5],target);
  assert.match(s.status.textContent,/未能自动复制.*手动复制/);assert.equal(s.button.attributes['aria-disabled'],'false');assert.equal(s.button.attributes['aria-busy'],'false');
 }
});

test('late success preserves the visitor’s focus and a fresh retry works after an interrupted failure',async()=>{
 const attempts=[deferred(),deferred(),deferred()];let calls=0;const s=setup({writeText:()=>attempts[calls++].promise});
 const first=s.copy(),canvas={id:'canvas'};s.document.activeElement=canvas;attempts[0].reject(Error('denied'));await first;
 assert.equal(s.document.activeElement,canvas);s.button.focus();const second=s.copy();assert.match(s.status.textContent,/正在复制/);
 s.document.activeElement=s.field;s.field.selection=[3,7];attempts[1].resolve();await second;
 assert.equal(s.document.activeElement,s.field);assert.deepEqual(s.field.selection,[3,7]);assert.equal(s.field.focuses,0);assert.equal(s.field.selections,0);
 s.button.focus();const third=s.copy();attempts[2].resolve();await third;assert.equal(calls,3);assert.equal(s.document.activeElement,s.button);
});

test('a held Enter copies once even after completion, without suppressing fresh Enter or native Space',async()=>{
 let writes=0;const s=setup({writeText:async()=>{writes++;}});
 await key(s,'Enter').completion;for(let i=0;i<10;i++)assert.equal(key(s,'Enter',true).prevented,true);
 assert.equal(writes,1);assert.equal(s.document.activeElement,s.button);
 await key(s,'Enter').completion;assert.equal(writes,2);
 for(const name of [' ','Tab','ArrowLeft','Escape'])for(const repeat of [false,true])assert.equal(key(s,name,repeat).prevented,false);
 // Native Space activates on keyup through the existing click listener.
 await s.button.handlers.click();assert.equal(writes,3);assert.equal(s.disabledWrites(),0);
});

const state=h=>({drawing:h.drawing(),metrics:h.el('metrics').textContent,pause:h.el('status').textContent,href:location.href,frames:[...h.frames.keys()],notes:h.el('field-notes-list').innerHTML,mission:h.el('mission-result').textContent});
test('pending contact copy never mutates any running world and a late failure leaves canvas focus intact',async()=>{
 for(const mode of ['orbit','life','wave','fractal','walk']){
  const h=await setupLab('?experiment='+mode,'#canvas',false),operation=deferred(),button=h.el('copy-wechat'),field=h.el('wechat-handle');
  field.value='goodmorning2you';field.setSelectionRange=()=>assert.fail('late fallback must not replace selection');
  const copy=bindContactCopy({button,field,status:h.el('contact-status'),document,getClipboard:()=>({writeText:()=>operation.promise})});
  button.focus();const before=state(h),pending=copy();assert.deepEqual(state(h),before,mode);
  h.el('canvas').focus();operation.reject(Error('late'));await pending;assert.deepEqual(state(h),before,mode);assert.equal(document.activeElement,h.el('canvas'),mode);
 }
});

test('the existing copy button has described feedback, pending styling and a fresh module token',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/<button id="copy-wechat" type="button" aria-label="复制微信号" aria-controls="contact-status" aria-describedby="contact-status" hidden>/);
 assert.match(css,/#copy-wechat\[aria-disabled="true"\]\{cursor:wait;opacity:\.65\}/);
 assert.match(html,/contact\.js\?v=focus-safe-copy-1/);assert.match(html,/style\.css\?v=life-turnover-1/);
});
