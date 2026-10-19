import {build} from 'esbuild';
import {cp,mkdir,copyFile,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
await mkdir(path.join(root,'dist/vendor'),{recursive:true});
await build({entryPoints:[path.join(root,'src/office.js')],bundle:true,minify:true,format:'esm',target:['es2022'],outfile:path.join(root,'dist/office.js'),legalComments:'eof'});
const pdfRoot=path.join(root,'node_modules/pdfjs-dist');
await copyFile(path.join(pdfRoot,'build/pdf.worker.min.mjs'),path.join(root,'dist/vendor/pdf.worker.min.js'));
await rm(path.join(root,'dist/vendor/pdf.worker.min.mjs'),{force:true});
for(const directory of ['cmaps','standard_fonts','wasm']){
  await cp(path.join(pdfRoot,directory),path.join(root,'dist/vendor',directory),{recursive:true});
}
const packages=['docx','docx-preview','fflate','html2canvas','pdf-lib','pdfjs-dist'];
const licenses=[];
for(const name of packages){
  const packageRoot=path.join(root,'node_modules',name);
  for(const filename of ['LICENSE','LICENSE.md','LICENSE.txt']){
    try{licenses.push(`\n${name}\n${'='.repeat(name.length)}\n${await readFile(path.join(packageRoot,filename),'utf8')}`);break;}catch{}
  }
}
await writeFile(path.join(root,'dist/vendor/THIRD-PARTY-LICENSES.txt'),licenses.join('\n'));
console.log('Browser document converters built with local PDF workers and fonts.');
