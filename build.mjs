import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stylesheet} from './styles.mjs';

// Browser assets: every file under public/, served at its path (e.g. /composer/controls.js).
// The stylesheet is assembled from public/styles/ into one /style.css.
const types={'html':'text/html; charset=utf-8','css':'text/css; charset=utf-8','js':'application/javascript; charset=utf-8','svg':'image/svg+xml'};
const assets={};
const publicDir=fileURLToPath(new URL('./public/',import.meta.url));
for(const entry of await readdir(publicDir,{recursive:true,withFileTypes:true})){
  const extension=entry.name.split('.').at(-1);
  const file=relative(publicDir,join(entry.parentPath,entry.name)).split('\\').join('/');
  if(!entry.isFile()||!types[extension]||file.startsWith('styles/'))continue;
  assets['/'+file]={body:await readFile(join(publicDir,file),'utf8'),type:types[extension]};
}
assets['/style.css']={body:await stylesheet(),type:types.css};

// Module preloads: list every module app.js imports (statically, at any depth) in index.html, so
// the browser fetches them in parallel instead of discovering them one import level at a time.
const graph=new Set(),visit=path=>{if(graph.has(path)||!assets[path])return;graph.add(path);
  for(const [,spec] of assets[path].body.matchAll(/^import\s[^;]*?from\s*'(\.{1,2}\/[^']+)'/gm))visit(new URL(spec,'https://app'+path).pathname);};
visit('/app.js');graph.delete('/app.js');
const preloads=[...graph].sort().map(path=>`<link rel="modulepreload" href="${path}">`).join('');
assets['/index.html'].body=assets['/index.html'].body.replace('<script type="module" src="/app.js"></script>',preloads+'<script type="module" src="/app.js"></script>');

// Server bundle: the API and the shared modules it needs, concatenated in dependency order with
// their relative imports removed (everything ends up in one module scope).
const stripImports=source=>source.replace(/^import\s*\{[^}]*\}\s*from\s*'\.{1,2}\/[^']+';\s*$/gm,'');
const read=async path=>stripImports(await readFile(new URL(path,import.meta.url),'utf8'));
const [catalog,streamModel,intent,model,prompts,api]=await Promise.all(['./public/components/catalog.js','./public/shared/stream.js','./public/composer/intent.js','./public/shared/model.js','./prompts.mjs','./api.mjs'].map(read));
const source=`${catalog}\n${streamModel}\n${intent}\n${model}\n${prompts}\n${api}\nconst ASSETS=${JSON.stringify(assets)};\nexport default {async fetch(request,env={}){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return handleAPI(request,fetch,env,{visitor:request.headers.get('CF-Connecting-IP')||env.LOCAL_VISITOR||'anonymous'});if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});const asset=ASSETS[url.pathname==='/'?'/index.html':url.pathname];if(!asset)return new Response('Not found',{status:404});return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"}})}};\n`;
await mkdir(new URL('./dist/server/',import.meta.url),{recursive:true});await writeFile(new URL('./dist/server/index.js',import.meta.url),source);
console.log('Built dependency-free Worker and browser assets.');
