import {spawnSync} from 'node:child_process';
import {mkdtempSync,readdirSync,lstatSync,unlinkSync,rmdirSync,existsSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const dist=path.join(root,'dist');
const dryRun=process.argv.includes('--dry-run');
const env={...process.env,GIT_TERMINAL_PROMPT:'0'};
function command(program,args,options={}){
 const result=spawnSync(program,args,{cwd:root,encoding:'utf8',env,maxBuffer:8*1024*1024,...options});
 if(result.error||result.status!==0)throw new Error(result.error?.message||result.stderr?.trim()||`${program} failed`);
 return result.stdout.trim();
}
function git(args,options){return command('git',args,options);}
function listFiles(directory){
 return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  if(['.git','.openai','node_modules'].includes(entry.name))return [];
  const filename=path.join(directory,entry.name),stat=lstatSync(filename);
  if(stat.isSymbolicLink())throw new Error('Publishing symlinks is not supported.');
  return stat.isDirectory()?listFiles(filename):stat.isFile()?[filename]:[];
 });
}
try{
 if(!dryRun)command(process.execPath,['scripts/build.mjs']);
 if(!existsSync(path.join(dist,'index.html')))throw new Error('dist/index.html is missing. Run npm run build first.');
 const files=listFiles(dist).sort();
 const repo=git(['remote','get-url','origin']);
 if(!/^(https:\/\/github\.com\/|git@github\.com:)/.test(repo)||/^https:\/\/[^/]*@/.test(repo))throw new Error('origin must be a GitHub remote without embedded credentials.');
 if(dryRun){console.log(`Checked ${files.length} website files. Would publish dist/ at the root of gh-pages. No remote changes made.`);process.exit(0);}
 git(['fetch','origin','gh-pages']);
 const parent=git(['rev-parse','FETCH_HEAD']);
 const tempDirectory=mkdtempSync(path.join(os.tmpdir(),'fileflow-pages-index-'));
 const indexPath=path.join(tempDirectory,'index');
 const indexEnv={...env,GIT_INDEX_FILE:indexPath};
 try{
  git(['read-tree','--empty'],{env:indexEnv});
  const records=files.map(filename=>{
   const relative=path.relative(dist,filename).split(path.sep).join('/');
   if(relative.startsWith('../')||path.isAbsolute(relative))throw new Error('Website file is outside dist/.');
   const hash=git(['hash-object','-w','--',filename]);
   return `100644 ${hash}\t${relative}\0`;
  });
  git(['update-index','-z','--index-info'],{env:indexEnv,input:records.join('')});
  const tree=git(['write-tree'],{env:indexEnv});
  if(tree===git(['rev-parse',`${parent}^{tree}`])){
   console.log('Published files already match dist/. No new deployment required.');
  }else{
   const commit=git(['-c','user.name=FileFlow Publisher','-c','user.email=fileflow-publisher@users.noreply.github.com','commit-tree',tree,'-p',parent],{input:'Update FileFlow static website\n'});
   git(['push','origin',`${commit}:refs/heads/gh-pages`]);
   console.log(`Published ${files.length} files to gh-pages (${commit.slice(0,7)}). GitHub Pages deployment is pending; check the Actions page for completion.`);
  }
 }finally{
  // Only remove exact temporary index files created by this invocation.
  for(const filename of [indexPath,indexPath+'.lock'])if(existsSync(filename))unlinkSync(filename);
  rmdirSync(tempDirectory);
 }
}catch(error){console.error(error.message);process.exitCode=1;}
