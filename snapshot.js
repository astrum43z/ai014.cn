// Capture the filename and title at request time, just like toBlob captures pixels.
export function createSnapshotSaver({canvas,button,status,announce,document,urlApi=URL,delay=setTimeout,canCapture=()=>true}){
  let busy=false;
  return (filename,title=filename)=>{
    if(busy)return;
    const report=(text,spoken=true)=>{
      status.textContent=text;status.hidden=false;
      if(spoken)announce(text);
    };
    // A reported context loss can leave an encodable but empty backing store.
    // Do not start or queue a capture; a fresh activation after recovery retries.
    // An earlier toBlob has already copied its pixels and may finish normally.
    if(!canCapture()){
      report(`「${title}」画布暂时不可用，未生成图片；画面恢复后请再次点击“保存这一刻”`);
      return;
    }
    // Native disabled drops keyboard focus while encoding. Keep the control
    // in place; the busy guard above rejects every duplicate activation.
    busy=true;button.setAttribute('aria-disabled','true');
    button.setAttribute('aria-busy','true');
    report(`正在生成「${title}」PNG 图片…`,false);
    const finish=()=>{busy=false;button.setAttribute('aria-disabled','false');button.setAttribute('aria-busy','false');};
    const fail=()=>report(`「${title}」图片生成或下载失败，请再次点击“保存这一刻”重试`);
    try{
      canvas.toBlob(blob=>{
        let url,link;
        try{
          if(!blob){fail();return;}
          url=urlApi.createObjectURL(blob);
          link=document.createElement('a');
          link.download=filename;link.href=url;
          document.body.append(link);link.click();
          report(`已发起「${title}」PNG 图片下载，请查看浏览器下载列表`);
        }catch{fail();}
        finally{
          link?.remove();
          if(url)delay(()=>urlApi.revokeObjectURL(url),10000);
          finish();
        }
      },'image/png');
    }catch{fail();finish();}
  };
}
