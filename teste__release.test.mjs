import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {join} from 'node:path';
const root=new URL('../',import.meta.url).pathname;const read=p=>readFileSync(join(root,p),'utf8');
test('o pacote contém banco, mídia e API nativos da Netlify',()=>{
 for(const p of ['netlify/functions/api.mjs','netlify/functions/cleanup.mjs','netlify/database/migrations/20261111210000_zuna_v21.sql','web/app.js','netlify.toml'])assert.ok(existsSync(join(root,p)),p);
 assert.match(read('netlify/functions/api.mjs'),/@netlify\/database/);assert.match(read('netlify/functions/api.mjs'),/@netlify\/blobs/);
});
test('não existem chamadas do site a Supabase ou Cloudflare',()=>{
 for(const p of ['web/index.html','web/app.js','netlify/functions/api.mjs','netlify.toml'])assert.doesNotMatch(read(p),/supabase\.co|cloudflarestream|stream\.videodelivery|SUPABASE_|CLOUDFLARE_/i);
});
test('permissões e integridade são verificadas no servidor',()=>{
 let api=read('netlify/functions/api.mjs');assert.match(api,/canViewPost/);assert.match(api,/checkOrigin/);assert.match(api,/me\.role!=='admin'/);assert.match(api,/status='ready'/);
});
test('migração possui índices e chaves únicas',()=>{
 const sql=read('netlify/database/migrations/20261111210000_zuna_v21.sql');
 for(const table of ['z_users','z_posts','z_media','z_messages','z_follows','z_likes','z_stories','z_audit'])assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
 assert.match(sql,/UNIQUE/);assert.match(sql,/PRIMARY KEY/);
});
test('PWA tem manifesto e sem cache privado em Service Worker',()=>{
 assert.ok(existsSync(join(root,'web/manifest.webmanifest')));
 assert.ok(existsSync(join(root,'web/sw.js')));
 assert.match(read('web/sw.js'),/pathname.startsWith\('\/api\/\'\)/);
 const html=read('web/index.html');assert.match(html,/lang="pt-BR"/);
});
