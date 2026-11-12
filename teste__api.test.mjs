import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const root=new URL('../',import.meta.url);
const dir=mkdtempSync(join(tmpdir(),'zuna-v21-contract-'));
mkdirSync(join(dir,'functions'),{recursive:true});mkdirSync(join(dir,'lib'),{recursive:true});
copyFileSync(new URL('../netlify/lib/security.mjs',import.meta.url),join(dir,'lib','security.mjs'));
const apiSource=readFileSync(new URL('../netlify/functions/api.mjs',import.meta.url),'utf8')
  .replace("from '@netlify/database'","from './mockdb.mjs'")
  .replace("from '@netlify/blobs'","from './mockblobs.mjs'");
writeFileSync(join(dir,'functions','api.mjs'),apiSource);
writeFileSync(join(dir,'functions','mockdb.mjs'), `
import {createHash} from 'node:crypto';
export const users=new Map(),sessions=new Map(),attempts=new Map();
function query(sql,p){
 if(sql.includes('to_regclass'))return [{users:true,posts:true}];
 if(sql.includes('INSERT INTO z_login_attempts'))return [{count:1}];
 if(sql.includes('SELECT 1 FROM z_username_aliases'))return [];
 if(sql.includes('INSERT INTO z_users')){
  const [id,username,display_name,password_hash,recovery_hash]=p;
  if(users.has(username)){const err=new Error('duplicate');err.code='23505';throw err;}
  users.set(username,{id,username,display_name,password_hash,recovery_hash,bio:'',private:true,verified:false,role:'user',avatar_media_id:null});return [];
 }
 if(sql.includes('SELECT * FROM z_users WHERE username='))return users.has(p[0])?[users.get(p[0])]:[];
 if(sql.includes('INSERT INTO z_sessions')){sessions.set(p[0],{token_hash:p[0],user_id:p[1]});return []}
 if(sql.includes('SELECT u.* FROM z_sessions')){const s=sessions.get(p[0]);return s?[...users.values()].filter(u=>u.id===s.user_id):[]}
 if(sql.includes('UPDATE z_users SET password_hash=')){
  const u=[...users.values()].find(u=>u.id===p[2]&&u.recovery_hash===p[3]);
  if(!u)return [];u.password_hash=p[0];u.recovery_hash=p[1];return [{id:u.id}];
 }
 if(sql.includes('DELETE FROM z_sessions WHERE user_id=')){for(const [k,s] of sessions)if(s.user_id===p[0])sessions.delete(k);return []}
 if(sql.includes('DELETE FROM z_sessions WHERE token_hash=')){sessions.delete(p[0]);return []}
 throw new Error('Query não mockada: '+sql.substring(0,100));
}
export function getDatabase(){return {sql:{unsafe:async(sql,p=[])=>query(sql,p)}}}
`);
writeFileSync(join(dir,'functions','mockblobs.mjs'),`export function getStore(){return {}}`);
const {default:handler}=await import(pathToFileURL(join(dir,'functions','api.mjs')).href);
const origin='https://zuna-test.netlify.app';
async function req(path,{method='GET',data,cookie=null,originHeader=true}={}){
 const headers={};if(originHeader&&method!=='GET')headers.Origin=origin;
 if(cookie)headers.Cookie=cookie;
 let body;if(data!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(data)}
 const res=await handler(new Request(origin+path,{method,headers,body}),{ip:'198.51.100.8'});
 let json;try{json=await res.json()}catch{json={}};
 return {status:res.status,data:json,cookie:res.headers.get('set-cookie')};
}

test('saúde da API e compatibilidade de rotas nativas Netlify',async()=>{
 assert.equal((await req('/api/health')).status,200);
 assert.equal((await req('/.netlify/functions/api/health')).status,200);
 const r=await req('/api/ready');assert.equal(r.status,200);assert.equal(r.data.schema,'ready');
});

test('cadastro real na rota HTTP: cookie, código de recuperação e autenticação',async()=>{
 const record={username:'tstconta',display_name:'Conta de Teste',password:'SenhaBoaDeTeste-123',adult_confirm:true};
 let r=await req('/api/register',{method:'POST',data:record});
 assert.equal(r.status,200,JSON.stringify(r.data));
 assert.equal(r.data.user.username,'tstconta');assert.ok(r.data.recovery_code);
 assert.match(r.cookie,/HttpOnly/);assert.match(r.cookie,/SameSite=Lax/);
 assert.notEqual(r.data.user.password_hash,record.password);
 let cookie=r.cookie.split(';')[0];
 let me=await req('/api/me',{cookie});assert.equal(me.status,200);assert.equal(me.data.user.username,'tstconta');
 r=await req('/api/register',{method:'POST',data:record});assert.equal(r.status,409);
 r=await req('/api/login',{method:'POST',data:{username:'tstconta',password:'wrong'}});assert.equal(r.status,401);
 r=await req('/api/login',{method:'POST',data:{username:'tstconta',password:record.password}});assert.equal(r.status,200);
 r=await req('/api/recover',{method:'POST',data:{username:'tstconta',code:me.data.recovery_code||'invalid',new_password:'NovaSenhaDeTeste-123'}});
 assert.equal(r.status,401); // o código nunca é exposto por /me
});

test('recuperação revoga a sessão antiga, novo código e sem repetição',async()=>{
 const reg=await req('/api/register',{method:'POST',data:{username:'contarecover',password:'SenhaInicial-123',adult_confirm:true}});
 assert.equal(reg.status,200,JSON.stringify(reg.data));
 const cookie=reg.cookie.split(';')[0];
 const reset=await req('/api/recover',{method:'POST',data:{username:'contarecover',code:reg.data.recovery_code,new_password:'SenhaNovaForte-123'}});
 assert.equal(reset.status,200,JSON.stringify(reset.data));assert.ok(reset.data.recovery_code);
 assert.notEqual(reset.data.recovery_code,reg.data.recovery_code);
 assert.equal((await req('/api/me',{cookie})).data.user,null);
 assert.equal((await req('/api/recover',{method:'POST',data:{username:'contarecover',code:reg.data.recovery_code,new_password:'OutraNovaSenha-123'}})).status,401);
 assert.equal((await req('/api/login',{method:'POST',data:{username:'contarecover',password:'SenhaNovaForte-123'}})).status,200);
});

test('proteção de origem em escrita e validação de dados',async()=>{
 const data={username:'contasemorigem',password:'SenhaSegura-1234',adult_confirm:true};
 assert.equal((await req('/api/register',{method:'POST',data,originHeader:false})).status,403);
 assert.equal((await req('/api/register',{method:'POST',data:{...data,username:'x'}})).status,400);
 assert.equal((await req('/api/nada')).status,404);
});

test.after(()=>rmSync(dir,{recursive:true,force:true}));
