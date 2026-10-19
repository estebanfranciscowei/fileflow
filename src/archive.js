import {zip} from 'fflate';
export async function packResults(results){
 const entries={},used=new Set();
 for(const result of results){
  const cleaned=result.name.replace(/[\\/\x00-\x1f]/g,'_')||'file';
  const dot=cleaned.lastIndexOf('.'),base=dot>0?cleaned.slice(0,dot):cleaned,extension=dot>0?cleaned.slice(dot):'';
  let name=cleaned,index=2;
  while(used.has(name.toLowerCase()))name=`${base} (${index++})${extension}`;
  used.add(name.toLowerCase());entries[name]=new Uint8Array(await result.blob.arrayBuffer());
 }
 const bytes=await new Promise((resolve,reject)=>zip(entries,{level:0},(error,data)=>error?reject(error):resolve(data)));
 return new Blob([bytes],{type:'application/zip'});
}
