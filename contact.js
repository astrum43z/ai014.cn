// Kept separate from the experiments: copying a contact never resets a world.
export function bindContactCopy({button,field,status,getClipboard=()=>globalThis.navigator?.clipboard}) {
  let pending=false;
  async function copy() {
    if(pending) return;
    pending=true;
    button.disabled=true;
    button.setAttribute('aria-busy','true');
    status.textContent='正在复制微信号…';
    try {
      const clipboard=getClipboard();
      if(!clipboard?.writeText) throw new Error('Clipboard unavailable');
      await clipboard.writeText(field.value);
      status.textContent='微信号已复制';
    } catch {
      status.textContent='未能自动复制，请长按或选中微信号手动复制';
      field.focus();
      field.select();
      field.setSelectionRange(0,field.value.length);
    } finally {
      pending=false;
      button.disabled=false;
      button.setAttribute('aria-busy','false');
    }
  }
  button.addEventListener('click',copy);
  button.hidden=false;
  return copy;
}

if(typeof document!=='undefined') {
  const button=document.querySelector('#copy-wechat');
  const field=document.querySelector('#wechat-handle');
  const status=document.querySelector('#contact-status');
  if(button&&field&&status) bindContactCopy({button,field,status});
}
