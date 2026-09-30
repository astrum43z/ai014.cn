// Capture the filename at request time, just like toBlob captures the pixels.
export function createSnapshotSaver({canvas,button,announce,document,urlApi=URL,delay=setTimeout}){
  let busy=false;
  return filename=>{
    if(busy)return;
    busy=true;button.disabled=true;
    button.setAttribute('aria-busy','true');
    const finish=()=>{busy=false;button.disabled=false;button.setAttribute('aria-busy','false');};
    const fail=()=>announce('图片生成或下载失败，请重试');
    try{
      canvas.toBlob(blob=>{
        let url,link;
        try{
          if(!blob){fail();return;}
          url=urlApi.createObjectURL(blob);
          link=document.createElement('a');
          link.download=filename;link.href=url;
          document.body.append(link);link.click();
          announce('已发起图片下载，请查看浏览器下载列表');
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
