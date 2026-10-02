import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fieldNotesText,saveFieldNotes} from '../field-notes.js';
import {setup as setupLab} from './life-challenge-harness.js';

const sample=[{title:'波与波相遇',finding:'位移相加。',note:'静区 0.00；中央 1.00。'},{title:'生命的形状',finding:'每个位置都不变。',note:'新生 0、消失 0。'}];
function setupDownload(){
 const blobs=[],downloads=[],messages=[],timers=[],revoked=[];
 const link={remove(){this.removed=true;},click(){downloads.push({filename:this.download,url:this.href});}};
 const document={createElement(tag){assert.equal(tag,'a');return link;},body:{append(value){assert.equal(value,link);}}};
 const urlApi={createObjectURL(blob){blobs.push(blob);return 'blob:notes';},revokeObjectURL(url){revoked.push(url);}};
 const save=notes=>saveFieldNotes(notes,{document,urlApi,report:message=>messages.push(message),delay:callback=>timers.push(callback)});
 return {save,blobs,downloads,messages,timers,revoked,link,document,urlApi};
}
test('notebook text is self-contained, ordered, readable Chinese with exact recorded evidence',()=>{
 const text=fieldNotesText(sample);
 assert.match(text,/^微观宇宙 · 本次发现\nhttps:\/\/ai014\.cn\/\n已记录 2 \/ 5 个世界\n/);
 assert.match(text,/历史读数.*不代表当前画布.*不包含可复现画布的状态/);
 assert.ok(text.includes('1. 波与波相遇\n发现：位移相加。\n观测记录：静区 0.00；中央 1.00。\n\n2. 生命的形状'));
 assert.match(text,/无需账户，也不会上传。\n$/);
 assert.equal(fieldNotesText([]),'');
 assert.deepEqual(sample,[{title:'波与波相遇',finding:'位移相加。',note:'静区 0.00；中央 1.00。'},{title:'生命的形状',finding:'每个位置都不变。',note:'新生 0、消失 0。'}]);
});
test('empty notes do not create a file, temporary URL, feedback or download',()=>{
 const s=setupDownload();assert.equal(s.save([]),false);
 assert.deepEqual([s.blobs,s.downloads,s.messages,s.timers],[[],[],[],[]]);
});
test('download uses a UTF-8 TXT file, reports initiation only, and releases resources',async()=>{
 const s=setupDownload();assert.equal(s.save(sample),true);
 assert.deepEqual(s.downloads,[{filename:'small-worlds-discoveries.txt',url:'blob:notes'}]);
 assert.equal(s.blobs[0].type,'text/plain;charset=utf-8');
 assert.deepEqual([...new Uint8Array(await s.blobs[0].arrayBuffer()).slice(0,3)],[239,187,191]);
 assert.equal(await s.blobs[0].text(),fieldNotesText(sample));
 assert.deepEqual(s.messages,['已发起 2 条发现的 TXT 下载，请查看浏览器下载列表']);
 assert.doesNotMatch(s.messages[0],/已保存|下载成功/);
 assert.equal(s.link.removed,true);assert.deepEqual(s.revoked,[]);
 assert.equal(s.timers.length,1);s.timers[0]();assert.deepEqual(s.revoked,['blob:notes']);
});
for(const stage of ['URL','element','append','click'])test(stage+' failure gives retry guidance, cleans up and permits a fresh attempt',()=>{
 const s=setupDownload(),fail=()=>{throw new Error('unavailable');};
 const original={url:s.urlApi.createObjectURL,element:s.document.createElement,append:s.document.body.append,click:s.link.click};
 if(stage==='URL')s.urlApi.createObjectURL=fail;
 if(stage==='element')s.document.createElement=fail;
 if(stage==='append')s.document.body.append=fail;
 if(stage==='click')s.link.click=fail;
 assert.equal(s.save(sample),false);assert.deepEqual(s.downloads,[]);
 assert.match(s.messages[0],/未能发起.*保存本次发现.*重试/);
 assert.equal(s.timers.length,stage==='URL'?0:1);
 if(stage==='append'||stage==='click')assert.equal(s.link.removed,true);
 for(const timer of s.timers)timer();
 assert.deepEqual(s.revoked,stage==='URL'?[]:['blob:notes']);
 s.urlApi.createObjectURL=original.url;s.document.createElement=original.element;s.document.body.append=original.append;s.link.click=original.click;
 assert.equal(s.save(sample.slice(0,1)),true);assert.equal(s.downloads.length,1);
 assert.match(s.messages.at(-1),/已发起 1 条发现/);
});
const click=(h,id)=>h.el(id).handlers.click();
const input=(h,id,value)=>h.el(id).handlers.input({target:{value:String(value)}});
function complete(h,mode){
 click(h,'tab-'+mode);click(h,'mission-start');
 if(mode==='life')for(const id of ['life-toggle','life-right','life-toggle','life-down','life-toggle','life-left','life-toggle'])click(h,id);
 else if(mode==='fractal'){click(h,'fractal-1000');click(h,'mission-check');input(h,'seed',15);click(h,'fractal-1000');}
 else{
  click(h,'mission-check');
  if(mode==='wave')click(h,'wave-home');
  if(mode==='walk')click(h,'walk-64');
  if(mode==='orbit'){input(h,'gravity',40);for(let i=0;i<70;i++)click(h,'step');}
 }
 click(h,'mission-check');
}
function download(h){
 let blob;const original=URL.createObjectURL;
 try{URL.createObjectURL=value=>{blob=value;return 'blob:test-notes';};click(h,'notes-save');}
 finally{URL.createObjectURL=original;}
 return blob;
}
const snapshot=h=>({drawing:h.drawing(),metrics:h.el('metrics').textContent,status:h.el('status').textContent,url:location.href,writes:h.writes(),drawCount:h.drawCount(),frames:[...h.frames.keys()],notes:h.el('field-notes-list').innerHTML,mission:h.el('mission-state').textContent,focus:document.activeElement});
test('download appears only after a real completed discovery and is harmless when empty',async()=>{
 const h=await setupLab('?experiment=wave');
 assert.equal(h.el('notes-actions').hidden,true);assert.equal(download(h),undefined);
 click(h,'mission-start');click(h,'mission-check');
 assert.equal(h.el('notes-actions').hidden,true);assert.equal(download(h),undefined);
 click(h,'wave-home');click(h,'mission-check');assert.equal(h.el('notes-actions').hidden,false);
 assert.match(await download(h).text(),/已记录 1 \/ 5.*$/m);
 assert.match(h.el('notes-save-status').textContent,/已发起 1 条发现/);assert.equal(h.el('notes-save-status').hidden,false);
 assert.equal(h.el('announcement').textContent,h.el('notes-save-status').textContent);
});
test('all five discoveries export once with measured data and no current simulation changes',async()=>{
 const h=await setupLab('?experiment=wave');
 for(const mode of ['wave','life','fractal','walk','orbit'])complete(h,mode);
 await h.el('share').handlers.click();click(h,'step');click(h,'pause');h.el('notes-save').focus();
 const before=snapshot(h),text=await download(h).text();
 assert.deepEqual(snapshot(h),before);
 assert.match(text,/已记录 5 \/ 5/);
 for(const [index,title] of ['波与波相遇','生命的形状','随机长出秩序','漫步也会扩散','引力游乐场'].entries())assert.ok(text.includes(`${index+1}. ${title}\n发现：`));
 assert.equal((text.match(/观测记录：/g)||[]).length,5);
 for(const phrase of ['0.00；中央 1.00','新生 0、消失 0','种子 14 / 15','理论散开程度 4.00 → 8.00','引力 80 → 40'])assert.ok(text.includes(phrase));
 assert.equal(await download(h).text(),text,'a fresh intentional save captures the same notebook without modifying it');
});
test('replay and changed live readings retain historical evidence; recompletion clears stale feedback without duplication',async()=>{
 const h=await setupLab('?experiment=wave');complete(h,'wave');const original=await download(h).text();
 input(h,'wavelength',64);click(h,'wave-right');click(h,'mission-start');
 assert.equal(await download(h).text(),original,'restarting does not erase or rewrite an earned note');
 complete(h,'life');assert.equal(h.el('notes-save-status').hidden,true);assert.equal(h.el('notes-save-status').textContent,'');
 complete(h,'wave');const updated=await download(h).text();assert.match(updated,/已记录 2 \/ 5/);
 assert.equal((updated.match(/观测记录：/g)||[]).length,2);assert.ok(updated.includes('静区完整周期最大幅度 0.00；中央 1.00'));
 h.navigate('?experiment=walk&bias=10&seed=27');assert.equal(await download(h).text(),updated);
 const fresh=await setupLab('?experiment=wave');assert.equal(fresh.el('notes-actions').hidden,true);assert.equal(download(fresh),undefined);
});
test('a new completion replaces the saved measurement for that world rather than exporting an old snapshot',async()=>{
 const h=await setupLab('?experiment=orbit');complete(h,'orbit');const original=await download(h).text();
 click(h,'mission-start');click(h,'mission-check');input(h,'gravity',40);
 for(let i=0;i<90;i++)click(h,'step');
 const radius=h.el('observation-a').textContent.split(' · ')[1];
 assert.equal(await download(h).text(),original,'live motion before checking leaves the completed record alone');
 click(h,'mission-check');const updated=await download(h).text();
 assert.notEqual(updated,original);assert.ok(updated.includes('75.0 → '+radius+'（模型单位）'));
 assert.match(updated,/已记录 1 \/ 5/);assert.equal((updated.match(/观测记录：/g)||[]).length,1);
});
test('held Enter prevents repeated native downloads; fresh presses, Space and navigation stay native',async()=>{
 const h=await setupLab('?experiment=wave');complete(h,'wave');
 const before=snapshot(h);
 for(const key of ['Enter',' ','Tab','ArrowRight'])for(const repeat of [true,false]){
  let prevented=0;h.el('notes-save').handlers.keydown({key,repeat,preventDefault(){prevented++;}});
  assert.equal(prevented,Number(key==='Enter'&&repeat));
 }
 assert.deepEqual(snapshot(h),before,'keydown itself does not trigger downloads or change the model');
});
test('save is a named native button with quiet feedback, refresh guidance and a wrapping 44px target',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<button id="notes-save" aria-describedby="notes-save-help notes-save-status">保存本次发现 ↓<\/button>/);
 assert.match(html,/<p id="notes-save-status" aria-live="off" hidden><\/p>/);
 assert.match(html,/页面笔记刷新后清空；想留存，可先保存本次发现。/);
 const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.match(css,/\.notes-actions\{[^}]*flex-wrap:wrap/);
 assert.match(css,/\.notes-actions button\{[^}]*min-height:44px;[^}]*max-width:100%;[^}]*white-space:normal/);
});

test('plain-text view appears only with a completed discovery and empty selection is harmless',async()=>{
 const h=await setupLab('?experiment=wave');
 assert.equal(h.el('notes-preview').hidden,true);assert.equal(h.el('notes-text').value,'');
 const before=snapshot(h),announcement=h.el('announcement').textContent;
 click(h,'notes-select');assert.deepEqual(snapshot(h),before);assert.equal(h.el('announcement').textContent,announcement);
 click(h,'mission-start');click(h,'mission-check');
 assert.equal(h.el('notes-preview').hidden,true);assert.equal(h.el('notes-text').value,'');
 click(h,'wave-home');click(h,'mission-check');
 assert.equal(h.el('notes-preview').hidden,false);
 assert.equal(h.el('notes-text').value,await download(h).text());
 const fresh=await setupLab('?experiment=wave');
 assert.equal(fresh.el('notes-preview').hidden,true);assert.equal(fresh.el('notes-text').value,'');
});
test('all five preview entries have exactly the same ordered historical content as the TXT',async()=>{
 const h=await setupLab('?experiment=life');
 for(const mode of ['life','wave','walk','fractal','orbit']){
  complete(h,mode);
  assert.equal(h.el('notes-text').value,await download(h).text());
 }
 const text=h.el('notes-text').value;
 assert.match(text,/已记录 5 \/ 5/);assert.equal((text.match(/观测记录：/g)||[]).length,5);
 assert.ok(text.indexOf('1. 生命的形状')<text.indexOf('5. 引力游乐场'));
});
test('select-all focuses the read-only view, selects all text and never claims to copy',async()=>{
 const h=await setupLab('?experiment=wave');complete(h,'wave');
 const field=h.el('notes-text');let selections=0;
 field.select=()=>{selections++;field.selectionStart=0;field.selectionEnd=field.value.length;};
 h.el('notes-select').focus();click(h,'notes-select');
 assert.equal(document.activeElement,field);assert.equal(selections,1);
 assert.equal(field.selectionStart,0);assert.equal(field.selectionEnd,field.value.length);
 assert.match(h.el('announcement').textContent,/已选中全部发现文字.*复制快捷键.*长按/);
 assert.doesNotMatch(h.el('announcement').textContent,/已复制|复制成功|剪贴板/);
 click(h,'notes-select');assert.equal(selections,2,'a fresh intentional selection remains available');
});
test('selecting notebook text leaves model, URL, mission, running animation and save feedback unchanged',async()=>{
 const h=await setupLab('?experiment=walk');complete(h,'walk');
 await h.el('share').handlers.click();download(h);click(h,'pause');
 const field=h.el('notes-text');field.focus();
 const before=snapshot(h),text=field.value,feedback=h.el('notes-save-status').textContent;
 click(h,'notes-select');
 assert.deepEqual(snapshot(h),before);assert.equal(field.value,text);
 assert.equal(h.el('notes-save-status').textContent,feedback);assert.equal(h.el('notes-save-status').hidden,false);
 assert.equal(h.el('notes-preview').hidden,false);
});
test('unchanged notebook renders preserve native selection, scroll and disclosure state without value writes',async()=>{
 const h=await setupLab('?experiment=wave');complete(h,'wave');
 const field=h.el('notes-text'),text=field.value;let writes=0;
 assert.match(text,/^微观宇宙 · 本次发现/);
 Object.defineProperty(field,'value',{get:()=>text,set(){writes++;},configurable:true});
 Object.assign(field,{selectionStart:7,selectionEnd:29,scrollTop:86});
 h.el('notes-preview').open=true;
 input(h,'wavelength',64);click(h,'wave-right');click(h,'mission-start');
 click(h,'tab-life');click(h,'tab-wave');
 h.navigate('?experiment=walk&bias=10&seed=27');
 assert.equal(writes,0);assert.equal(field.value,text);
 assert.deepEqual([field.selectionStart,field.selectionEnd,field.scrollTop],[7,29,86]);
 assert.equal(h.el('notes-preview').open,true);
});
test('new findings update the open preview without forcing focus or erasing saved historical findings',async()=>{
 const h=await setupLab('?experiment=wave');complete(h,'wave');
 const original=h.el('notes-text').value;h.el('notes-preview').open=true;
 complete(h,'life');
 assert.match(h.el('notes-text').value,/已记录 2 \/ 5/);
 assert.ok(h.el('notes-text').value.includes(original.split('1. 波与波相遇\n')[1].split('\n\n由当前页面')[0]));
 assert.equal(h.el('notes-preview').open,true);assert.equal(document.activeElement,h.el('mission-result'));
 assert.equal(h.el('notes-text').value,await download(h).text());
});
test('recompletion replaces only that historical preview entry, not before the new check',async()=>{
 const h=await setupLab('?experiment=orbit');complete(h,'orbit');
 const original=h.el('notes-text').value;
 click(h,'mission-start');click(h,'mission-check');input(h,'gravity',40);
 for(let i=0;i<90;i++)click(h,'step');
 const radius=h.el('observation-a').textContent.split(' · ')[1];
 assert.equal(h.el('notes-text').value,original);
 click(h,'mission-check');
 const updated=h.el('notes-text').value;
 assert.notEqual(updated,original);assert.ok(updated.includes('75.0 → '+radius+'（模型单位）'));
 assert.equal((updated.match(/观测记录：/g)||[]).length,1);
 assert.equal(updated,await download(h).text());
});
test('preview and manual selection remain available if initiating the download fails',async()=>{
 const h=await setupLab('?experiment=wave');complete(h,'wave');
 const field=h.el('notes-text'),text=field.value,original=URL.createObjectURL;let selections=0;
 field.select=()=>{selections++;};
 try{URL.createObjectURL=()=>{throw Error('download unavailable');};click(h,'notes-save');}
 finally{URL.createObjectURL=original;}
 assert.match(h.el('notes-save-status').textContent,/未能发起/);
 click(h,'notes-select');
 assert.equal(selections,1);assert.equal(field.value,text);assert.equal(h.el('notes-preview').hidden,false);
 assert.equal(document.activeElement,field);
});
test('preview uses a native disclosure, labelled read-only textarea, copy guidance and visible 44px controls',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<details id="notes-preview" class="notes-preview" hidden><summary>查看与复制文字<\/summary>/);
 assert.match(html,/<label for="notes-text">本次发现 · 纯文字<\/label>/);
 assert.match(html,/<textarea id="notes-text" rows="10" readonly spellcheck="false" aria-describedby="notes-text-help"><\/textarea>/);
 assert.match(html,/<button id="notes-select" type="button" aria-controls="notes-text" aria-describedby="notes-text-help">全选文字<\/button>/);
 assert.match(html,/内容与 TXT 相同。.*复制快捷键.*长按文字选择复制/);
 const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.match(css,/\.notes-preview summary\{[^}]*min-height:44px/);
 assert.match(css,/\.notes-preview button\{[^}]*min-height:44px;[^}]*max-width:100%;[^}]*white-space:normal/);
 assert.match(css,/\.notes-preview textarea\{[^}]*width:100%;max-width:100%;[^}]*resize:vertical;[^}]*font:16px\/1.7/);
 assert.match(css,/\.notes-preview summary:focus-visible,\.notes-preview textarea:focus-visible\{outline:3px solid/);
});
