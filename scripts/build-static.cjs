'use strict';
// Produce the public storefront without publishing server-only API source.
// The Vercel Node builder bundles the APIs separately through api/gateway.js.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
const excluded = new Set(['api', 'dist', 'node_modules', '.git', '.github', '.vercel', 'scripts', 'release', 'tests', 'test', 'production']);
// Vercel may invoke the static builder twice concurrently. Never delete dist while another builder is reading it.
fs.mkdirSync(out,{recursive:true});
let files=0;
for(const entry of fs.readdirSync(root,{withFileTypes:true})){
  if(excluded.has(entry.name) || entry.name.startsWith('.') || entry.name==='vercel.json' || entry.name==='package.json' || entry.name==='package-lock.json' || entry.name==='AGENTS.md') continue;
  const src=path.join(root,entry.name);
  const dest=path.join(out,entry.name);
  fs.cpSync(src,dest,{recursive:true,filter(p){
    const relative=path.relative(root,p);
    const parts=relative.split(path.sep);
    if(parts.some(part=>excluded.has(part) || part.startsWith('.'))) return false;
    if(/\.(env|pem|key|log)$/i.test(p)) return false;
    return true;
  }});
  files++;
}
if(!fs.existsSync(path.join(out,'index.html'))) throw new Error('Missing storefront index.html');
console.log('Static storefront ready: '+files+' root entries copied to dist/');
