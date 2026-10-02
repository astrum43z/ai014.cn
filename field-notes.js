// Export the recorded evidence, never a later reading from the current canvas.
export function fieldNotesText(notes){
  if(!notes.length)return '';
  const entries=notes.map(({title,finding,note},index)=>`${index+1}. ${title}\n发现：${finding}\n观测记录：${note}`);
  return ['微观宇宙 · 本次发现','https://ai014.cn/',`已记录 ${notes.length} / 5 个世界`,'这些是完成探索时的历史读数，不代表当前画布；此文件不包含可复现画布的状态。','',entries.join('\n\n'),'','由当前页面生成，无需账户，也不会上传。',''].join('\n');
}

export function saveFieldNotes(notes,{document,report,urlApi=URL,delay=setTimeout}){
  if(!notes.length)return false;
  let url,link;
  try{
    // A UTF-8 BOM keeps Chinese readable in text editors that guess encodings.
    const blob=new Blob(['\uFEFF',fieldNotesText(notes)],{type:'text/plain;charset=utf-8'});
    url=urlApi.createObjectURL(blob);
    link=document.createElement('a');
    link.download='small-worlds-discoveries.txt';link.href=url;
    document.body.append(link);link.click();
    report(`已发起 ${notes.length} 条发现的 TXT 下载，请查看浏览器下载列表`);
    return true;
  }catch{
    report('发现笔记下载未能发起，请再次点击“保存本次发现”重试');
    return false;
  }finally{
    link?.remove();
    if(url)delay(()=>urlApi.revokeObjectURL(url),10000);
  }
}
