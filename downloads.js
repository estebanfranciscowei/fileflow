'use strict';
// Pass File bytes to the operating system directly; a blob URL cannot be moved
// from an embedded browser into another browser's storage/session.
window.FileFlowSave = (() => {
 let pendingResult=null,active=false,dialog;
 const isMobile=()=>/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&matchMedia('(pointer:coarse)').matches);
 const isEmbedded=()=>/\bwv\b|MicroMessenger|QQ\/|FBAN|FBAV|Instagram|DingTalk|ChatGPT/i.test(navigator.userAgent);
 const message=text=>window.dispatchEvent(new CustomEvent('fileflow-save-message',{detail:text}));
 function nativeFile(result){return new File([result.blob],result.name,{type:result.blob.type||'application/octet-stream'});}
 function canShare(result){
  try{return !!(isSecureContext&&navigator.share&&navigator.canShare&&navigator.canShare({files:[nativeFile(result)]}));}catch{return false;}
 }
 function createDialog(){
  if(dialog)return dialog;
  dialog=document.createElement('dialog');dialog.className='save-dialog';dialog.setAttribute('aria-labelledby','save-dialog-title');
  dialog.innerHTML=`<div class="dialog-heading"><h2 id="save-dialog-title">保存转换结果</h2><button class="icon-button" data-save-close aria-label="关闭保存提示">×</button></div><p class="save-file-name"></p><p class="save-explanation">文件已经转换完成。部分应用内浏览器无法将转换结果交给另一个浏览器下载。</p><button class="primary dialog-confirm" data-native-share>系统分享 / 保存到文件</button><button class="secondary-save" data-direct-download>在当前浏览器下载</button><p class="save-mobile-help">iPhone：在系统分享中选择“存储到‘文件’”。安卓：选择文件管理器、保存或其他接收文件的应用，具体选项由系统提供。</p><div class="info-box">如果下载时要求跳到其他浏览器，请先复制下方网站地址，在 Chrome 或 Safari 中打开网站后重新转换。当前转换结果不会随浏览器切换而转移。</div><label class="field-label save-link-label" for="save-site-link">网站地址</label><div class="save-link-row"><input id="save-site-link" type="text" readonly aria-label="工具网站地址"><button data-copy-site>复制</button></div><p class="save-dialog-status" role="status" aria-live="polite"></p>`;
  document.body.append(dialog);
  dialog.querySelector('[data-save-close]').addEventListener('click',()=>dialog.close());
  dialog.querySelector('[data-direct-download]').addEventListener('click',()=>{if(pendingResult){directDownload(pendingResult);dialog.querySelector('.save-dialog-status').textContent='已请求当前浏览器下载。若仍要求切换浏览器，请按下方网站地址重新打开工具并转换。';}});
  dialog.querySelector('[data-native-share]').addEventListener('click',()=>{if(pendingResult)save(pendingResult,{share:true});});
  dialog.querySelector('[data-copy-site]').addEventListener('click',async()=>{
   const input=dialog.querySelector('#save-site-link');
   try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(input.value);dialog.querySelector('.save-dialog-status').textContent='已复制网站地址。请在系统浏览器中打开后重新转换。';}
   catch{input.focus();input.select();dialog.querySelector('.save-dialog-status').textContent='请长按上方地址并复制。';}
  });
  return dialog;
 }
 function help(result,reason=''){
  if(!result?.blob){message('请先完成转换，再保存文件。');return;}
  pendingResult=result;const d=createDialog();
  d.querySelector('.save-file-name').textContent=result.name;
  d.querySelector('#save-site-link').value=location.origin+location.pathname;
  d.querySelector('[data-native-share]').hidden=!canShare(result);
  d.querySelector('.save-dialog-status').textContent=reason;
  if(!d.open)d.showModal();
 }
 function directDownload(result){
  // Give this download its own URL. Clearing/reconverting the source queue must
  // not revoke a URL that a browser is still consuming for an ongoing download.
  const url=URL.createObjectURL(result.blob),link=document.createElement('a');
  link.href=url;link.download=result.name;link.target='_blank';link.rel='noopener';link.style.display='none';
  document.body.append(link);link.click();
  setTimeout(()=>link.remove(),30000);
  setTimeout(()=>URL.revokeObjectURL(url),5*60*1000);
  message('已发起下载，请在当前浏览器的下载列表中查看。');
 }
 function save(result,options={}){
  if(!result?.blob){message('文件结果已失效，请重新转换。');return Promise.resolve();}
  if(active){message('系统保存窗口已打开，请先完成或取消。');return Promise.resolve();}
  const useShare=(isMobile()||options.share)&&canShare(result);
  if(useShare){
   // Keep this call synchronous with the button click. Awaiting fetch/import or
   // ZIP creation here would lose transient activation on mobile Safari.
   active=true;let operation;
   try{operation=navigator.share({files:[nativeFile(result)]});}
   catch(error){active=false;help(result,'系统保存未能打开，请选择下方其他保存方式。');return Promise.resolve();}
   return Promise.resolve(operation).then(()=>{if(dialog?.open)dialog.close();message('系统分享已结束；请以所选应用中的保存结果为准。');},error=>{
    if(error.name==='AbortError'){message('已取消系统分享，转换结果仍保留在当前页面。');return;}
    help(result,'系统保存未能完成。文件仍在当前页面，请选择其他保存方式。');
   }).finally(()=>{active=false;});
  }
  if(isMobile()){help(result,'当前浏览器未提供此格式的系统文件保存。');return Promise.resolve();}
  directDownload(result);return Promise.resolve();
 }
 return {save,help,isMobile,isEmbedded,canShare};
})();
