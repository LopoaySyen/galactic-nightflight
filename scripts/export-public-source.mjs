import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

// Export the current source snapshot, without private history or the live hosting identity.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const destination=resolve(process.argv[2]??'');
if(!process.argv[2]||destination===root||!relative(root,destination).startsWith('..'))throw new Error('Choose a new export directory outside this checkout.');
try{await stat(destination);throw new Error('Export destination already exists. Choose an empty new path.');}catch(error){if(error.code!=='ENOENT')throw error;}
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/gh[pousr]_[A-Za-z0-9]{30,}/,/github_pat_[A-Za-z0-9_]{30,}/,/sk-[A-Za-z0-9_-]{35,}/];
const snapshot=[];
for(const path of new Set(files)){
  if(path==='.openai/hosting.json'||/(^|\/)\.env(?:\.|$)/.test(path)||/(^|\/)(?:\.git|node_modules|dist|\.sites-runtime|\.wrangler)\//.test(path))continue;
  const bytes=await readFile(resolve(root,path));
  if(/\.(?:[cm]?[jt]sx?|json|md|txt|yml|yaml|sh|cff)$/.test(path)||['NOTICE','LICENSE'].includes(path)){
    const text=bytes.toString('utf8');
    if(patterns.some(pattern=>pattern.test(text)))throw new Error(`Potential credential in ${path}; review before export.`);
  }
  snapshot.push({path,bytes});
}
snapshot.push({path:'.openai/hosting.json',bytes:Buffer.from('{\n  "d1": null,\n  "r2": null\n}\n')});
await mkdir(destination,{recursive:true});
for(const file of snapshot){const target=resolve(destination,file.path);await mkdir(dirname(target),{recursive:true});await writeFile(target,file.bytes);}
await writeFile(resolve(destination,'PUBLICATION.md'),'# 公开版本说明\n\n本目录是银河夜航的当前源码快照，保留源码、数据、图像和许可。它不包含私有提交历史、访问凭证或线上站点的托管标识。\n\n商业使用无需另行授权，署名和许可要求见 COMMERCIAL-LICENSING.md；第三方内容见 THIRD_PARTY_NOTICES.md。\n');
console.log(JSON.stringify({destination,files:snapshot.length+1,privateHistoryIncluded:false,hostingIdentityIncluded:false}));
