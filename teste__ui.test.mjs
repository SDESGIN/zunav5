import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../web/sw.js',import.meta.url),'utf8');
const netlify=readFileSync(new URL('../netlify.toml',import.meta.url),'utf8');

test('cadastro não acessa variável de perfil inexistente',()=>{
 const modal=app.slice(app.indexOf('function openAuth('),app.indexOf('function recoveryModal('));
 assert.ok(modal.length>300);
 assert.doesNotMatch(modal,/\bu\.username\b/);
 const names=modal.match(/name="username"/g)||[];
 assert.equal(names.length,1,'O formulário de autenticação precisa conter só um campo username.');
 assert.match(modal,/name="display_name"/);
});
test('botões de criar conta, alternar modo e retry estão ligados a ações',()=>{
 for(const action of ['open-register','open-login','auth-mode','retry-start']) assert.match(app,new RegExp("case '"+action+"'"));
 assert.match(app,/data-action="open-register"/);
});
test('sinais de erro são exibidos, e toasts têm a classe CSS correta',()=>{
 assert.match(app,/\/ready/);
 assert.match(app,/Conexão com o banco indisponível/);
 assert.match(html,/id="toast" class="toast"/);
});
test('cache PWA atualizado e API excluída do cache',()=>{
 assert.match(sw,/zuna-v21-1-shell-2/);
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
 assert.match(html,/app\.js\?v=21\.1/);
});
test('rewrite API vem antes do fallback SPA',()=>{
 assert.ok(netlify.indexOf('from = "/api/*"') < netlify.indexOf('from = "/*"'));
});
