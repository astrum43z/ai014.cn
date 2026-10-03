// Kept separate from the experiments: copying a contact never resets a world.
export function bindContactCopy({button,field,status,getClipboard=()=>globalThis.navigator?.clipboard,document=button.ownerDocument}) {
  let pending=false;
  async function copy() {
    if(pending) return;
    pending=true;
    // Keep the initiating control focusable while permission is pending.
    button.setAttribute('aria-disabled','true');
    button.setAttribute('aria-busy','true');
    status.textContent='正在复制微信号…';
    try {
      const clipboard=getClipboard();
      if(!clipboard?.writeText) throw new Error('Clipboard unavailable');
      await clipboard.writeText(field.value);
      status.textContent='微信号已复制';
    } catch {
      status.textContent='未能自动复制，请长按或选中微信号手动复制';
      // A late denial must not pull the visitor away from their next task or
      // replace a manual selection already made in the contact field.
      if(document?.activeElement===button){
        field.focus();
        field.select();
        field.setSelectionRange(0,field.value.length);
      }
    } finally {
      pending=false;
      button.setAttribute('aria-disabled','false');
      button.setAttribute('aria-busy','false');
    }
  }
  button.addEventListener('click',copy);
  // Clipboard completion may arrive before a held Enter repeats.
  button.addEventListener('keydown',event=>{
    if(event.repeat&&event.key==='Enter')event.preventDefault();
  });
  button.hidden=false;
  return copy;
}

if(typeof document!=='undefined') {
  const button=document.querySelector('#copy-wechat');
  const field=document.querySelector('#wechat-handle');
  const status=document.querySelector('#contact-status');
  if(button&&field&&status) bindContactCopy({button,field,status});
}
