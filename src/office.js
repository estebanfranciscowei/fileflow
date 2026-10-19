import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import {PDFDocument} from 'pdf-lib';
import {Document,Packer,Paragraph,TextRun,ImageRun} from 'docx';
import {renderAsync} from 'docx-preview';
import html2canvas from 'html2canvas';
import {zipSync} from 'fflate';

const assetRoot=new URL('./vendor/',import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.min.js',assetRoot).href;
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const baseName=name=>name.replace(/\.[^.]+$/,'')||'document';
const blobBytes=async blob=>new Uint8Array(await blob.arrayBuffer());
const docxType='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const progress=(callback,message)=>{callback?.(message);};

async function openPDF(file){
  try{
    const task=pdfjs.getDocument({data:await blobBytes(file),cMapUrl:new URL('cmaps/',assetRoot).href,cMapPacked:true,standardFontDataUrl:new URL('standard_fonts/',assetRoot).href,wasmUrl:new URL('wasm/',assetRoot).href,isEvalSupported:false,useSystemFonts:true});
    const pdf=await task.promise;
    if(pdf.numPages>150){await pdf.loadingTask.destroy();throw new Error('单份 PDF 最多处理 150 页，请先拆分');}
    return pdf;
  }catch(error){
    if(error.name==='PasswordException')throw new Error('PDF 已加密，请先在原软件中解除密码');
    if(error.name==='InvalidPDFException')throw new Error('PDF 文件损坏或格式无效');
    throw error;
  }
}
async function renderPage(page,scale=1.5){
  const viewport=page.getViewport({scale});
  if(viewport.width*viewport.height>12000000)throw new Error('页面尺寸过大，无法在此设备渲染');
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  try{await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport,background:'rgb(255,255,255)'}).promise;return canvas;}catch(error){canvas.width=canvas.height=0;throw error;}
}
async function canvasBlob(canvas,type='image/png',quality=.92){
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,type,quality));
  if(!blob)throw new Error('当前设备无法导出页面图片');return blob;
}
function extractLines(content,viewport){
  const lines=[];
  for(const item of content.items){
    if(!('str' in item)||!item.str)continue;
    const transform=pdfjs.Util.transform(viewport.transform,item.transform);
    const size=Math.max(5,Math.min(48,Math.hypot(transform[2],transform[3])));
    const fragment={text:item.str,x:transform[4],y:transform[5],width:item.width,fontSize:size,font:content.styles[item.fontName]?.fontFamily||''};
    let line=lines.find(line=>Math.abs(line.y-fragment.y)<Math.max(2,size*.3));
    if(!line){line={y:fragment.y,items:[]};lines.push(line);}line.items.push(fragment);
  }
  return lines.sort((a,b)=>a.y-b.y).map(line=>{
    line.items.sort((a,b)=>a.x-b.x);let text='',end=0;
    line.items.forEach((item,index)=>{if(index&&item.x-end>Math.max(2,item.fontSize*.2)&&!text.endsWith(' ')&&!item.text.startsWith(' '))text+=' ';text+=item.text;end=item.x+item.width;});
    return {text,fontSize:Math.max(...line.items.map(item=>item.fontSize)),bold:line.items.some(item=>/bold/i.test(item.font))};
  }).filter(line=>line.text.trim());
}

async function pdfToWord(file,options,onProgress){
  const pdf=await openPDF(file),sections=[];let characters=0,emptyPages=0;
  const keepLayout=options.mode==='layout';
  if(keepLayout&&pdf.numPages>40){await pdf.loadingTask.destroy();throw new Error('保留版式模式最多处理 40 页，请先拆分 PDF');}
  try{
    for(let number=1;number<=pdf.numPages;number++){
      progress(onProgress,`读取第 ${number} / ${pdf.numPages} 页`);await tick();
      const page=await pdf.getPage(number),viewport=page.getViewport({scale:1}),children=[];
      if(keepLayout){
        const canvas=await renderPage(page,1.5);
        try{
          const data=await blobBytes(await canvasBlob(canvas,'image/jpeg'));
          // Word uses px for image drawing sizes and twips for page sizes.
          const imageScale=Math.max(.9,1-12/(viewport.height*96/72));
          children.push(new Paragraph({alignment:'center',spacing:{after:0,before:0},children:[new ImageRun({data,type:'jpg',transformation:{width:viewport.width*96/72*imageScale,height:viewport.height*96/72*imageScale}})]}));
        }finally{canvas.width=canvas.height=0;}
      }else{
        const lines=extractLines(await page.getTextContent(),viewport);
        if(!lines.length)emptyPages++;
        for(const line of lines){characters+=line.text.trim().length;children.push(new Paragraph({spacing:{before:0,after:40,line:Math.round(line.fontSize*24)},children:[new TextRun({text:line.text,font:'Microsoft YaHei',size:Math.round(line.fontSize*2),bold:line.bold})]}));}
        if(!lines.length)children.push(new Paragraph({children:[new TextRun({text:'此页没有可提取文字，可能为扫描页。',color:'888888',size:20})]}));
      }
      const margin=keepLayout?0:720;
      sections.push({properties:{page:{size:{width:Math.round(viewport.width*20),height:Math.round(viewport.height*20)},margin:{top:margin,right:margin,bottom:margin,left:margin,header:0,footer:0}}},children});
      page.cleanup();
    }
    if(!keepLayout&&!characters)throw new Error('这是扫描件或图片 PDF，没有可提取文字。请切换「保留版式」；文字识别 OCR 暂未提供');
    progress(onProgress,'正在生成 Word 文档');
    const doc=new Document({creator:'FileFlow',title:baseName(file.name),sections});
    const blob=await Packer.toBlob(doc);
    return {blob,name:baseName(file.name)+'.docx',note:keepLayout?'保留版式 · 页面为图片，文字不可编辑':emptyPages?`可编辑文字 · ${emptyPages} 页没有文字，已标记`:'可编辑文字 · 复杂表格和分栏可能需要调整'};
  }finally{await pdf.loadingTask.destroy();}
}

async function wordToPDF(file,options,onProgress){
  progress(onProgress,'正在读取 Word 的文字、图片和表格');
  const host=document.createElement('div');host.className='word-render-host';
  host.style.cssText='position:fixed;left:-20000px;top:0;width:1200px;background:#fff;pointer-events:none;z-index:-1;';
  document.body.append(host);
  try{
    await renderAsync(await file.arrayBuffer(),host,host,{className:'word-page',inWrapper:true,breakPages:true,ignoreLastRenderedPageBreak:false,renderHeaders:true,renderFooters:true,renderFootnotes:true,useBase64URL:true,experimental:false});
    await document.fonts.ready;
    await Promise.all([...host.querySelectorAll('img')].map(image=>image.decode().catch(()=>{})));
    const pages=[...host.querySelectorAll('section.word-page')];
    if(!pages.length)throw new Error('无法读取此 Word 文件，请确认文件为有效的 .docx');
    if(pages.length>100)throw new Error('Word 页数过多，请拆分后转换');
    const pdf=await PDFDocument.create();
    for(let index=0;index<pages.length;index++){
      progress(onProgress,`正在生成第 ${index+1} / ${pages.length} 页`);await tick();
      const element=pages[index],bounds=element.getBoundingClientRect();
      const pageHeight=parseFloat(getComputedStyle(element).minHeight)||bounds.height,width=bounds.width,fullHeight=Math.max(element.scrollHeight,Math.ceil(bounds.height));
      const scale=Math.min(1.6,Math.sqrt(10000000/(width*fullHeight)));
      if(scale<.5)throw new Error('Word 单页内容过长，请先在 Word 中分页');
      const canvas=await html2canvas(element,{scale,backgroundColor:'#ffffff',logging:false,useCORS:false,allowTaint:false,width,height:fullHeight,windowWidth:1600,windowHeight:Math.max(1600,fullHeight),scrollX:0,scrollY:0,onclone:doc=>{doc.querySelectorAll('.word-render-host').forEach(node=>{node.style.left='0';node.style.zIndex='0';});}});
      try{
        const pagePixels=Math.round(pageHeight*scale);
        for(let offset=0;offset<canvas.height;offset+=pagePixels){
          if(offset>0&&canvas.height-offset<4)break;
          const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=pagePixels;
          try{
            const context=slice.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,slice.width,slice.height);context.drawImage(canvas,0,offset,canvas.width,Math.min(pagePixels,canvas.height-offset),0,0,canvas.width,Math.min(pagePixels,canvas.height-offset));
            const image=await pdf.embedJpg(await blobBytes(await canvasBlob(slice,'image/jpeg',.95)));
            const output=pdf.addPage([width*.75,pageHeight*.75]);output.drawImage(image,{x:0,y:0,width:width*.75,height:pageHeight*.75});
          }finally{slice.width=slice.height=0;}
        }
      }finally{canvas.width=canvas.height=0;}
    }
    const bytes=await pdf.save();
    return {blob:new Blob([bytes],{type:'application/pdf'}),name:baseName(file.name)+'.pdf',note:'页面外观模式 · PDF 文字不可选取'};
  }catch(error){
    if(/zip|central directory|end of data/i.test(error.message))throw new Error('Word 文件损坏，或不是有效的 .docx 文件');
    throw error;
  }finally{host.remove();}
}

function parsePages(range,total){
  if(!range.trim())return Array.from({length:total},(_,index)=>index+1);
  const pages=[];
  for(const part of range.replaceAll('，',',').split(',')){
    const match=part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if(!match)throw new Error('页码格式有误，请填写例如 1-3,5');
    const start=Number(match[1]),end=Number(match[2]||match[1]);
    if(start<1||end>total||end<start)throw new Error(`页码超出范围，此 PDF 共 ${total} 页`);
    for(let i=start;i<=end;i++)if(!pages.includes(i))pages.push(i);
  }
  if(!pages.length)throw new Error('请选择有效页码');return pages;
}
async function pdfTools(file,format,options,onProgress){
  if(format==='jpgzip'){
    const pdf=await openPDF(file),entries={};
    try{
      const selected=parsePages(options.pages||'',pdf.numPages);
      if(selected.length>40)throw new Error('一次最多导出 40 页图片，请填写页码范围');
      for(const number of selected){
        progress(onProgress,`正在导出第 ${number} / ${pdf.numPages} 页`);await tick();
        const page=await pdf.getPage(number),canvas=await renderPage(page,1.5);
        try{entries[`page-${String(number).padStart(3,'0')}.jpg`]=await blobBytes(await canvasBlob(canvas,'image/jpeg'));}finally{canvas.width=canvas.height=0;page.cleanup();}
      }
      return {blob:new Blob([zipSync(entries,{level:0})],{type:'application/zip'}),name:baseName(file.name)+'_图片.zip',note:`已导出 ${selected.length} 页图片`};
    }finally{await pdf.loadingTask.destroy();}
  }
  let source;try{source=await PDFDocument.load(await file.arrayBuffer());}catch(error){if(/encrypted/i.test(error.message))throw new Error('PDF 已加密，请先解除密码');throw new Error('无法读取此 PDF 文件');}
  const selected=parsePages(options.pages||'',source.getPageCount());
  if(selected.length>150)throw new Error('一次最多处理 150 页');
  if(format==='extract'){
    const output=await PDFDocument.create();for(const number of selected){const [page]=await output.copyPages(source,[number-1]);output.addPage(page);}
    return {blob:new Blob([await output.save()],{type:'application/pdf'}),name:baseName(file.name)+'_提取.pdf',note:`已提取 ${selected.length} 页`};
  }
  const entries={};
  for(const number of selected){progress(onProgress,`正在拆分第 ${number} / ${source.getPageCount()} 页`);await tick();const output=await PDFDocument.create();const [page]=await output.copyPages(source,[number-1]);output.addPage(page);entries[`page-${String(number).padStart(3,'0')}.pdf`]=await output.save();}
  return {blob:new Blob([zipSync(entries,{level:0})],{type:'application/zip'}),name:baseName(file.name)+'_拆分.zip',note:`已拆分为 ${selected.length} 份 PDF`};
}
export async function mergePDFs(files,onProgress){
  if(files.length<2)throw new Error('请至少添加两份 PDF，按文件列表顺序合并');
  const output=await PDFDocument.create();
  for(let index=0;index<files.length;index++){
    progress(onProgress,`正在合并第 ${index+1} / ${files.length} 份 PDF`);await tick();
    let source;try{source=await PDFDocument.load(await files[index].arrayBuffer());}catch(error){throw new Error(`${files[index].name}：${/encrypted/i.test(error.message)?'PDF 已加密，请先解除密码':'无法读取此 PDF'}`);}
    if(output.getPageCount()+source.getPageCount()>300)throw new Error('合并后不能超过 300 页');
    for(const page of await output.copyPages(source,source.getPageIndices()))output.addPage(page);
  }
  return {blob:new Blob([await output.save()],{type:'application/pdf'}),name:'转转_合并文档.pdf',note:`已合并 ${files.length} 份文档，共 ${output.getPageCount()} 页`};
}
export async function convertOffice(file,category,format,options,onProgress){
  if(category==='pdfword')return pdfToWord(file,options,onProgress);
  if(category==='wordpdf')return wordToPDF(file,options,onProgress);
  if(category==='pdftools')return pdfTools(file,format,options,onProgress);
  throw new Error('不支持此转换');
}
export async function createSample(category){
  if(category==='wordpdf'){
    const doc=new Document({sections:[{children:[new Paragraph({children:[new TextRun({text:'转转 FileFlow 示例文档',bold:true,size:36,font:'Microsoft YaHei'})]}),new Paragraph('Word 转 PDF 示例'),new Paragraph('你好，世界。中文、英文和换行都会在浏览器本地处理。'),new Paragraph('This document stays on your device.'),new Paragraph({pageBreakBefore:true,children:[new TextRun('这是第二页。请检查输出 PDF 是否保留了分页。')]})]}]});
    return new File([await Packer.toBlob(doc)],'FileFlow_示例文档.docx',{type:docxType});
  }
  const doc=await PDFDocument.create();
  for(let i=1;i<=2;i++){const page=doc.addPage([595.28,841.89]);page.drawText('Hello, FileFlow.',{x:60,y:740,size:28});page.drawText(`Page ${i} - PDF to Word sample`,{x:60,y:690,size:16});page.drawText('Convert locally. Keep your files private.',{x:60,y:650,size:12});}
  return new File([await doc.save()],'FileFlow_示例PDF.pdf',{type:'application/pdf'});
}
