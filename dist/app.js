'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const svg = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const categories = {
 pdfword: {name:'PDF 转 Word',icon:'doc',accept:'.pdf',extensions:['pdf'],chips:['PDF → DOCX'],formats:[['docx','Word · DOCX 可编辑文档']],shortcuts:[]},
 wordpdf: {name:'Word 转 PDF',icon:'doc',accept:'.docx',extensions:['docx'],chips:['DOCX → PDF'],formats:[['pdf','PDF · 页面外观文档']],shortcuts:[]},
 pdftools: {name:'PDF 工具',icon:'doc',accept:'.pdf',extensions:['pdf'],chips:['PDF 合并','PDF 拆分','PDF 转图片'],formats:[['merge','合并 PDF · 多份合为一份'],['split','拆分 PDF · 每页单独保存'],['extract','提取页面 · 保存为一份 PDF'],['jpgzip','PDF 转 JPG · 打包下载']],shortcuts:[]},
 image: {name:'图片转换',icon:'image',accept:'.jpg,.jpeg,.png,.webp,.gif,.bmp,.svg',extensions:['jpg','jpeg','png','webp','gif','bmp','svg'],chips:['JPG','PNG','WebP','GIF','BMP','SVG'],formats:[['jpeg','JPG · 通用图片'],['png','PNG · 无损图片'],['webp','WebP · 轻量图片'],['pdf','PDF · 合并图片文档']],shortcuts:['jpeg','png','webp']},
 document: {name:'文本转换',icon:'doc',accept:'.txt,.md,.markdown,.html,.htm',extensions:['txt','md','markdown','html','htm'],chips:['TXT','Markdown','HTML'],formats:[['txt','TXT · 纯文本'],['md','Markdown · 标记文档'],['html','HTML · 网页文档']],shortcuts:['txt','md','html']},
 data: {name:'数据转换',icon:'data',accept:'.csv,.json',extensions:['csv','json'],chips:['CSV','JSON'],formats:[['json','JSON · 结构化数据'],['csv','CSV · 表格数据']],shortcuts:['json','csv']}
};
const descriptions = {jpeg:'兼容性好、体积更小，透明区域将填充白色。',png:'无损保存，支持透明背景；质量选项不影响 PNG。',webp:'更小的体积，保留透明背景，适合网页使用。',pdf:'将列表中的全部图片按顺序合并为一份 PDF。',txt:'去除格式，保留可阅读的文字内容。',md:'以 Markdown 文本保存，HTML 内容将转为纯文本。',html:'生成独立 HTML 文档，保留换行与中文内容。',json:'将 CSV 首行作为字段名，转换为 JSON 对象数组。',csv:'将 JSON 对象数组转换为含表头的 CSV 文件。'};
let category = 'pdfword', files = [], busy = false, toastTimer, officeModule;
let batchResult=null,batchError='',batchEpoch=0,batchPreparing=false;
function clearBatch(){batchResult=null;batchError='';batchPreparing=false;batchEpoch++;}
async function prepareBatch(){
 const epoch=batchEpoch;
 const results=files.filter(f=>f.result).map(f=>f.result);
 if(results.length<2)return;
 if(results.reduce((sum,result)=>sum+result.size,0)>150*1024*1024){batchError='合计超过 150 MB，请逐个保存文件。';return;}
 batchPreparing=true;
 $('#conversion-hint').textContent='正在准备 ZIP，完成后可一键保存全部文件…';
 try{const {packResults}=await import('./archive.js');const blob=await packResults(results);if(epoch===batchEpoch)batchResult={blob,name:'转转_转换结果.zip',size:blob.size};}
 catch{if(epoch===batchEpoch)batchError='批量打包未完成，请逐个保存文件。';}
 finally{if(epoch===batchEpoch)batchPreparing=false;}
}
function refreshBatch(){const epoch=batchEpoch;prepareBatch().then(()=>{if(epoch===batchEpoch&&!busy)renderFiles();});}
function loadOffice(){return officeModule ||= import('./office.js').catch(error=>{officeModule=null;throw new Error('转换组件未能加载，请刷新后重试：'+error.message);});}
const isOffice=()=>['pdfword','wordpdf','pdftools'].includes(category);
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const escapeHTML = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fileExtension = name => name.split('.').pop().toLowerCase();
const baseName = name => name.replace(/\.[^.]+$/, '') || 'converted';
const formatBytes = n => n < 1024 ? n + ' B' : n < 1024 * 1024 ? (n / 1024).toFixed(1) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB';
function notify(message) { $('#toast').textContent=message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4200); }
function showView(view) {
 $('#tools-view').hidden=view!=='tools'; $('#history-view').hidden=view!=='history';
 $$('.top-link').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
 $$('.side-item').forEach(el=>el.classList.toggle('active',view==='tools'?el.dataset.category===category:el.dataset.view==='history'));
 if(view==='history')renderHistory();
}
function setCategory(next) {
 if(busy)return notify('正在转换，请稍候。');
 if(next!==category){clearFiles();category=next;}
 const c=categories[category];
 $('#category-heading').innerHTML=svg(c.icon)+c.name;
 $('#file-input').accept=c.accept;
 $('#supported-formats').innerHTML=c.chips.map(f=>`<span>${f}</span>`).join('');
 $('#format-select').innerHTML=c.formats.map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
 $('#format-options').innerHTML=c.shortcuts.map(key=>`<button data-format="${key}">${key==='jpeg'?'JPG':key.toUpperCase()}</button>`).join('');
 $('#image-settings').hidden=category!=='image'; $('#text-settings').hidden=category==='image';
 updateFormat();showView('tools');
}
function updateFormat() {
 if(!busy)clearBatch();
 const format=$('#format-select').value;
 $$('#format-options button').forEach(b=>b.classList.toggle('selected',b.dataset.format===format));
 $('#format-description').textContent=category==='pdfword'?'将 PDF 保存为 Word .docx，支持批量转换。':category==='wordpdf'?'支持 .docx 中的文字、图片、表格与分页。':category==='pdftools'?{merge:'按下方文件列表顺序合并，保留原 PDF 页面。',split:'每页拆为独立 PDF，打包为 ZIP 下载。',extract:'选取指定页面，保存为一份新 PDF。',jpgzip:'将选定页面保存为 JPG 图片，打包下载。'}[format]:descriptions[format];
 $('#format-options').hidden=!categories[category].shortcuts.length;
 $('#text-settings').hidden=!['document','data'].includes(category);
 $('#office-settings').hidden=!isOffice();
 $('#pdfword-settings').hidden=category!=='pdfword';
 $('#wordpdf-note').hidden=category!=='wordpdf';
 $('#pdf-tools-settings').hidden=category!=='pdftools';
 $('#page-range-field').hidden=category!=='pdftools'||format==='merge';
 $('#upload-guidance').textContent=category==='pdfword'?'请选择需要转换为 Word 的 PDF 文件':category==='wordpdf'?'请选择 Word .docx 文件，旧版 .doc 请先另存为 .docx':category==='pdftools'?'添加 PDF 后，选择合并、拆分、提取或转图片':'或点击下方按钮，从设备中选择';
 updateOfficeNote();
 $('#quality').disabled=format==='png';
 if(!busy)files.forEach(f=>{ if(f.result){URL.revokeObjectURL(f.result.url);f.result=null;} f.state='ready';f.error='';f.note=''; });
 renderFiles();
}
function updateOfficeNote(){
 $('#pdfword-note').textContent=$('#word-mode').value==='layout'?'保留页面外观，Word 中每页为图片，文字不可编辑。扫描件也可使用，最多 40 页。':'提取可编辑文字与基本段落。复杂表格、分栏可能需调整；扫描件暂不支持 OCR。';
}
function clearFiles() {
 if(busy)return;
 clearBatch();
 files.forEach(f=>{if(f.preview)URL.revokeObjectURL(f.preview);if(f.result)URL.revokeObjectURL(f.result.url);});
 files=[];$('#file-input').value='';renderFiles();
}
function addFiles(incoming) {
 if(busy)return notify('正在转换，请稍候再添加文件。');
 let count=0,errors=[];
 for(const file of incoming){
  if(files.length>=20){errors.push('一次最多添加 20 个文件');break;}
  if(!categories[category].extensions.includes(fileExtension(file.name))){errors.push(`${file.name}：${fileExtension(file.name)==='doc'?'旧版 .doc 请先在 Word 中另存为 .docx':'不支持此格式，请选择对应工具'}`);continue;}
  if(!file.size){errors.push(`${file.name}：文件为空`);continue;}
  if(file.size>MAX_FILE_SIZE){errors.push(`${file.name}：超过 50 MB`);continue;}
  if(files.some(f=>f.file.name===file.name&&f.file.size===file.size&&f.file.lastModified===file.lastModified))continue;
  files.push({id:crypto.randomUUID(),file,preview:category==='image'?URL.createObjectURL(file):null,state:'ready',result:null,error:''});count++;
 }
 if(count){clearBatch();refreshBatch();}renderFiles();if(errors.length)notify(errors.slice(0,2).join('；'));else if(count)notify(`已添加 ${count} 个文件`);
}
function renderFiles() {
 $('#file-queue').hidden=!files.length;$('#file-count').textContent=`${files.length} / 20`;
 const completed=files.filter(f=>f.result);
 $('#download-all').hidden=completed.length<2||busy;
 $('#download-all').disabled=!batchResult;
 $('#download-all').innerHTML=svg('download')+(batchPreparing?'正在打包…':'保存全部 ZIP');
 $('#save-guidance').hidden=!completed.length;
 $('#save-guidance-text').textContent=batchError||'安卓直接下载，iPhone 可通过系统分享存储到文件。下载没有反应时，请点“保存遇到问题？”尝试兼容下载。';
 $('#convert-button').disabled=!files.length||busy;
 $('#convert-button span').textContent=busy?'正在转换…':files.length&&files.every(f=>f.state==='done')?'重新转换':'开始转换';
 $('#conversion-hint').textContent=busy?'正在本地处理，请保持页面打开':files.length?`已添加 ${files.length} 个文件 · 转换后即可下载`:'添加文件后，即可开始转换';
 $('#clear-files').disabled=busy;$('#format-select').disabled=busy;$('#image-size').disabled=busy;
 $('#quality').disabled=busy||$('#format-select').value==='png';
 $('#word-mode').disabled=busy;$('#page-range').disabled=busy;
 $$('#format-options button').forEach(b=>b.disabled=busy);
 $('#file-list').innerHTML=files.map(f=>`<li class="file-row"><span class="file-thumb">${svg(categories[category].icon)}</span><div class="file-info"><span class="file-name" title="${escapeHTML(f.file.name)}">${escapeHTML(f.file.name)}</span><div class="file-meta">${formatBytes(f.file.size)}${f.result?' → '+formatBytes(f.result.size):''}</div>${f.note?`<div class="result-note">${escapeHTML(f.note)}</div>`:''}</div><span class="file-state ${f.state==='done'?'done':f.state==='error'?'error':''}">${f.state==='done'?'转换完成':f.state==='processing'?escapeHTML(f.progress||'转换中…'):f.state==='error'?escapeHTML(f.error):'等待转换'}</span>${f.result?`<button class="download-button" data-download="${f.id}" aria-label="下载 ${escapeHTML(f.result.name)}">${svg('download')}${FileFlowSave.isMobile()?'保存':'下载'}</button>`:''}<button class="icon-button" data-remove="${f.id}" aria-label="移除 ${escapeHTML(f.file.name)}" ${busy?'disabled':''}>${svg('close')}</button></li>`).join('');
}
function removeFile(id){if(busy)return;clearBatch();const file=files.find(f=>f.id===id);if(file?.preview)URL.revokeObjectURL(file.preview);if(file?.result)URL.revokeObjectURL(file.result.url);files=files.filter(f=>f.id!==id);refreshBatch();renderFiles();}
function downloadResult(result){return FileFlowSave.save(result);}
async function decodeImage(file) {
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();image.decoding='async';
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('无法读取此图片'));image.src=url;});
  const width=image.naturalWidth,height=image.naturalHeight;
  if(!width||!height)throw new Error('图片尺寸无效');
  if(width*height>40000000)throw new Error('图片超过 4000 万像素');
  const limit=Number($('#image-size').value),scale=limit?Math.min(1,limit/Math.max(width,height)):1;
  return {image,width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),cleanup:()=>URL.revokeObjectURL(url)};
 }catch(error){URL.revokeObjectURL(url);throw error;}
}
async function convertImage(file,format) {
 const {image,width,height,cleanup}=await decodeImage(file);
 try{
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');if(!context)throw new Error('浏览器无法创建画布');
  if(format==='jpeg'){context.fillStyle='#fff';context.fillRect(0,0,width,height);}
  context.drawImage(image,0,0,width,height);
  const type='image/'+format;
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,type,Number($('#quality').value)/100));
  canvas.width=0;canvas.height=0;
  if(!blob||blob.type!==type)throw new Error('当前浏览器不支持此输出格式');
  return {blob,width,height};
 }finally{cleanup();}
}
// A small PDF writer. Each page embeds one JPEG, preserving image order and aspect ratio.
async function createImagePDF(entries) {
 const encoder=new TextEncoder(),parts=[],offsets=[0];let length=0;
 const add=data=>{const bytes=typeof data==='string'?encoder.encode(data):data;parts.push(bytes);length+=bytes.length;};
 const object=(id,body)=>{offsets[id]=length;add(`${id} 0 obj\n${body}\nendobj\n`);};
 add('%PDF-1.4\n');
 const pageIds=entries.map((_,i)=>3+i*3),count=2+entries.length*3;
 object(1,'<< /Type /Catalog /Pages 2 0 R >>');
 object(2,`<< /Type /Pages /Count ${entries.length} /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] >>`);
 for(let i=0;i<entries.length;i++){
  const entry=entries[i],pageId=pageIds[i],imageId=pageId+1,contentId=pageId+2;
  const pageWidth=595.28,pageHeight=841.89,ratio=Math.min((pageWidth-48)/entry.width,(pageHeight-48)/entry.height);
  const w=entry.width*ratio,h=entry.height*ratio,x=(pageWidth-w)/2,y=(pageHeight-h)/2;
  object(pageId,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
  const jpeg=new Uint8Array(await entry.blob.arrayBuffer());
  offsets[imageId]=length;add(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${entry.width} /Height ${entry.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);add(jpeg);add('\nendstream\nendobj\n');
  const content=`q\n${w.toFixed(3)} 0 0 ${h.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm\n/Im0 Do\nQ\n`;
  object(contentId,`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
 }
 const xref=length;add(`xref\n0 ${count+1}\n0000000000 65535 f \n`);
 for(let id=1;id<=count;id++)add(String(offsets[id]).padStart(10,'0')+' 00000 n \n');
 add(`trailer\n<< /Size ${count+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
 return new Blob(parts,{type:'application/pdf'});
}
function parseCSV(text) {
 text=text.replace(/^\uFEFF/,'');
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=ch;}
  else if(ch==='"'){if(field)throw new Error('CSV 引号格式有误');quoted=true;}
  else if(ch===','){row.push(field);field='';}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(c=>c!==''))rows.push(row);row=[];field='';}
  else field+=ch;
 }
 if(quoted)throw new Error('CSV 引号未闭合');
 if(field||row.length){row.push(field);rows.push(row);}
 if(!rows.length)throw new Error('CSV 没有可转换的数据');
 const headers=rows.shift();
 if(headers.some(h=>!h.trim()))throw new Error('CSV 表头不能为空');
 if(new Set(headers).size!==headers.length)throw new Error('CSV 表头不能重复');
 return rows.map((values,index)=>{if(values.length!==headers.length)throw new Error(`CSV 第 ${index+2} 行列数不匹配`);return Object.fromEntries(headers.map((key,i)=>[key,values[i]]));});
}
function toCSV(data) {
 if(!Array.isArray(data)||!data.length||data.some(item=>!item||typeof item!=='object'||Array.isArray(item)))throw new Error('JSON 须为非空对象数组');
 const headers=[...new Set(data.flatMap(Object.keys))];if(!headers.length)throw new Error('JSON 对象没有字段');
 const cell=value=>{let text=value==null?'':typeof value==='object'?JSON.stringify(value):String(value);return /[",\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;};
 return '\uFEFF'+[headers.map(cell).join(','),...data.map(item=>headers.map(key=>cell(item[key])).join(','))].join('\r\n');
}
function htmlToText(html) {
 const doc=new DOMParser().parseFromString(html,'text/html');
 doc.querySelectorAll('script,style,iframe,object,noscript,template').forEach(el=>el.remove());
 doc.querySelectorAll('br').forEach(el=>el.replaceWith('\n'));
 doc.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,section,article,blockquote,tr').forEach(el=>el.append('\n'));
 return (doc.body.textContent||'').replace(/\n{3,}/g,'\n\n').trim();
}
async function convertText(file,format) {
 let text=(await file.text()).replace(/^\uFEFF/,''),ext=fileExtension(file.name);
 if(category==='data'){
  let data;try{data=ext==='csv'?parseCSV(text):JSON.parse(text);}catch(error){throw new Error(error instanceof SyntaxError?'JSON 格式有误，请检查语法':error.message);}
  if(format==='json')return new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
  return new Blob([toCSV(data)],{type:'text/csv;charset=utf-8'});
 }
 if(ext==='html'||ext==='htm')text=htmlToText(text);
 if(format==='html')text=`<!doctype html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(baseName(file.name))}</title><style>body{max-width:800px;margin:40px auto;padding:0 24px;font:16px/1.8 system-ui,sans-serif;color:#24334c}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}</style></head><body><pre>${escapeHTML(text)}</pre></body></html>`;
 return new Blob([text],{type:format==='html'?'text/html;charset=utf-8':format==='md'?'text/markdown;charset=utf-8':'text/plain;charset=utf-8'});
}
function setResult(file,blob,name) {
 if(file.result)URL.revokeObjectURL(file.result.url);
 file.result={blob,url:URL.createObjectURL(blob),name,size:blob.size};file.state='done';file.error='';
 addHistory({name:file.file.name,source:fileExtension(file.file.name),target:fileExtension(name),size:blob.size,time:Date.now()});
}
async function convert() {
 if(busy||!files.length)return;
 busy=true;clearBatch();const format=$('#format-select').value;files.forEach(f=>{if(f.result)URL.revokeObjectURL(f.result.url);f.result=null;f.state='ready';f.error='';f.note='';f.progress='';});renderFiles();
 try{
  if(isOffice()){
   files[0].state='processing';files[0].progress='正在加载转换组件…';renderFiles();
   const engine=await loadOffice();
   const options={mode:$('#word-mode').value,pages:$('#page-range').value};
   if(category==='pdftools'&&format==='merge'){
    files.forEach(f=>f.state='processing');
    const result=await engine.mergePDFs(files.map(f=>f.file),message=>{files[0].progress=message;renderFiles();});
    setResult(files[0],result.blob,result.name);files[0].note=result.note;files.forEach(f=>f.state='done');
   }else{
    for(const f of files){
     f.state='processing';f.progress='正在读取文件…';renderFiles();await new Promise(resolve=>setTimeout(resolve,0));
     try{const result=await engine.convertOffice(f.file,category,format,options,message=>{f.progress=message;renderFiles();});setResult(f,result.blob,result.name);f.note=result.note;}catch(error){f.state='error';f.error=error.message||'转换失败，请检查文件';}
    }
   }
  }else if(category==='image'&&format==='pdf'){
   const pages=[];
   for(const f of files){f.state='processing';renderFiles();try{pages.push(await convertImage(f.file,'jpeg'));}catch(error){f.state='error';f.error=error.message;throw error;}}
   const blob=await createImagePDF(pages);const resultName=files.length===1?baseName(files[0].file.name)+'.pdf':'转转_合并图片.pdf';
   setResult(files[0],blob,resultName);files.forEach(f=>f.state='done');
  }else{
   for(const f of files){
    f.state='processing';renderFiles();await new Promise(resolve=>setTimeout(resolve,0));
    try{const blob=category==='image'?(await convertImage(f.file,format)).blob:await convertText(f.file,format);setResult(f,blob,baseName(f.file.name)+'.'+(format==='jpeg'?'jpg':format));}catch(error){f.state='error';f.error=error.message||'转换失败，请尝试其他格式';}
   }
  }
  const good=files.filter(f=>f.state==='done').length;notify(good===files.length?'转换完成，文件已准备好下载':`已完成 ${good} 个文件，请检查失败项目`);
 }catch(error){files.forEach(f=>{if(f.state!=='error'){f.state='error';f.error=error.message||'转换失败，请检查文件';}});notify(error.message||'转换失败');}
 finally{await prepareBatch();busy=false;renderFiles();}
}
function readHistory(){try{return JSON.parse(localStorage.getItem('fileflow-history')||'[]').filter(item=>item&&typeof item.name==='string'&&typeof item.time==='number').slice(0,30);}catch{return [];}}
function addHistory(entry){try{localStorage.setItem('fileflow-history',JSON.stringify([entry,...readHistory()].slice(0,30)));}catch{/* Conversion works when browser storage is disabled. */}}
function renderHistory(){const history=readHistory();$('#history-list').innerHTML=history.length?history.map(h=>`<div class="history-row"><div class="file-info"><span class="file-name">${escapeHTML(h.name)}</span><div class="file-meta">${new Date(h.time).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})} · ${formatBytes(h.size)}</div></div><span class="history-format">${escapeHTML(h.source.toUpperCase())} → ${escapeHTML(h.target.toUpperCase())}</span><small>已完成 · 文件未留存</small></div>`).join(''):`<div class="empty-history">${svg('clock')}还没有转换记录<br><small>完成第一次转换后，记录会出现在这里。</small></div>`;}
async function addSample(){
 if(busy)return;
 if(isOffice()){
  const requestedCategory=category;
  try{notify('正在准备示例文档…');const engine=await loadOffice();const file=await engine.createSample(requestedCategory);if(category===requestedCategory&&!busy)addFiles([file]);}catch(error){notify(error.message);}
 }else if(category==='image'){
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=800;
  const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,1200,800);gradient.addColorStop(0,'#dfeaff');gradient.addColorStop(1,'#edf8ee');ctx.fillStyle=gradient;ctx.fillRect(0,0,1200,800);
  ctx.fillStyle='#bdcefa';ctx.beginPath();ctx.arc(940,180,260,0,Math.PI*2);ctx.fill();ctx.fillStyle='#9bbdb0';ctx.beginPath();ctx.moveTo(0,650);ctx.bezierCurveTo(420,240,650,800,1200,380);ctx.lineTo(1200,800);ctx.lineTo(0,800);ctx.fill();
  ctx.fillStyle='#294375';ctx.font='600 62px system-ui';ctx.fillText('Hello, FileFlow.',100,280);ctx.font='25px system-ui';ctx.fillText('A little change. A new possibility.',104,335);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));addFiles([new File([blob],'FileFlow_示例图片.png',{type:'image/png'})]);
 }else if(category==='data'){addFiles([new File(['名称,分类,数量\n笔记本,文具,3\n"咖啡,拿铁",饮品,2\n明信片,文具,5'],'示例数据.csv',{type:'text/csv'})]);}
 else{addFiles([new File(['# 让文件，自由转换。\n\n欢迎使用转转 FileFlow。\n\n无需安装，从浏览器开始。\n你的文件留在你的设备。\n\n换个格式，让灵感继续。'],'欢迎使用.md',{type:'text/markdown'})]);}
}
$$('[data-category]').forEach(button=>button.addEventListener('click',()=>setCategory(button.dataset.category)));
$$('[data-view]').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.view)));
$('#format-select').addEventListener('change',updateFormat);
$('#format-options').addEventListener('click',e=>{const button=e.target.closest('[data-format]');if(button&&!busy){$('#format-select').value=button.dataset.format;updateFormat();}});
$('#quality').addEventListener('input',()=>{$('#quality-value').innerHTML=$('#quality').value+'<span>%</span>';});
$('#choose-files').addEventListener('click',e=>{e.stopPropagation();if(!busy)$('#file-input').click();});
$('#dropzone').addEventListener('click',()=>{if(!busy)$('#file-input').click();});
$('#dropzone').addEventListener('keydown',e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(!busy)$('#file-input').click();}});
$('#file-input').addEventListener('change',e=>{addFiles([...e.target.files]);e.target.value='';});
['dragenter','dragover'].forEach(event=>$('#dropzone').addEventListener(event,e=>{e.preventDefault();$('#dropzone').classList.add('dragover');}));
['dragleave','drop'].forEach(event=>$('#dropzone').addEventListener(event,e=>{e.preventDefault();$('#dropzone').classList.remove('dragover');if(event==='drop')addFiles([...e.dataTransfer.files]);}));
window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
$('#file-list').addEventListener('click',e=>{const remove=e.target.closest('[data-remove]'),download=e.target.closest('[data-download]');if(remove)removeFile(remove.dataset.remove);if(download){const result=files.find(f=>f.id===download.dataset.download)?.result;if(result)downloadResult(result);}});
$('#convert-button').addEventListener('click',convert);$('#clear-files').addEventListener('click',clearFiles);$('#try-sample').addEventListener('click',addSample);
$('#download-all').addEventListener('click',()=>{if(batchResult)downloadResult(batchResult);});
$('#save-help').addEventListener('click',()=>{const result=batchResult||files.find(f=>f.result)?.result;if(result)FileFlowSave.help(result);});
window.addEventListener('fileflow-save-message',event=>notify(event.detail));
$('#mobile-save-tip').hidden=!FileFlowSave.isEmbedded();
$$('[data-quick]').forEach(button=>button.addEventListener('click',()=>{if(busy)return notify('正在转换，请稍候。');setCategory(button.dataset.target);if(button.dataset.format)$('#format-select').value=button.dataset.format;updateFormat();$('#dropzone').scrollIntoView({behavior:'smooth',block:'center'});notify('已选择'+categories[category].name+'，请添加文件');}));
$('#word-mode').addEventListener('change',()=>{updateOfficeNote();updateFormat();});
$('#page-range').addEventListener('input',()=>{clearBatch();files.forEach(f=>{if(f.result)URL.revokeObjectURL(f.result.url);f.result=null;f.state='ready';f.error='';f.note='';});renderFiles();});
$('#clear-history').addEventListener('click',()=>{try{localStorage.removeItem('fileflow-history');renderHistory();notify('转换记录已清除');}catch{notify('当前浏览器不允许访问本地记录');}});
$('#help-open').addEventListener('click',()=>$('#help-dialog').showModal());$('#privacy-open').addEventListener('click',()=>$('#privacy-dialog').showModal());
$$('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
$$('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
$('#year').textContent=new Date().getFullYear();setCategory('pdfword');
