import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,secret,digest,validUsername,username,mediaType,validMagic,parseRange,cookie,CHUNK,streakAge,utcDay} from '../netlify/lib/security.mjs';
test('senhas protegidas com scrypt e salt exclusivo',()=>{
 const a=hashPassword('minha-senha-segura-123'),b=hashPassword('minha-senha-segura-123');
 assert.notEqual(a,b);assert.equal(verifyPassword('minha-senha-segura-123',a),true);assert.equal(verifyPassword('invalida',a),false);
});
test('tokens não ficam em texto claro',()=>{const a=secret(),b=secret();assert.notEqual(a,b);assert.notEqual(a,digest(a));assert.equal(digest(a).length,64);});
test('usuários normalizados e nomes reservados bloqueados',()=>{assert.equal(username('  ALICE_5  '),'alice_5');assert.equal(validUsername('alice_5'),true);assert.equal(validUsername('admin'),false);assert.equal(validUsername('João'),false);assert.equal(validUsername('a'),false);});
test('limites de mídia e formatos',()=>{assert.equal(mediaType('video/mp4',3*1024**3),'video');assert.equal(mediaType('video/mp4',3*1024**3+1),null);assert.equal(mediaType('image/png',12*1024**2),'image');assert.equal(mediaType('application/pdf',200),null);});
test('assinaturas de formatos falsos bloqueadas',()=>{assert.equal(validMagic(new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]),'image/png'),true);assert.equal(validMagic(new Uint8Array(32),'image/png'),false);assert.equal(validMagic(new Uint8Array([0,0,0,24,102,116,121,112,0,0,0,0]),'video/mp4'),true);});
test('Range HTTP respeita máximo por resposta',()=>{const r=parseRange('bytes=0-',20*1024**2);assert.equal(r.start,0);assert.equal(r.end,CHUNK-1);assert.equal(parseRange('bytes=5000-5500',12000).end,5500);assert.equal(parseRange('bytes=12000-',12000),null);});
test('cookies têm atributos de proteção e logout',()=>{assert.match(cookie('token'),/HttpOnly/);assert.match(cookie('token'),/SameSite=Lax/);assert.match(cookie('token'),/Secure/);assert.match(cookie('',true),/Max-Age=0/);});
test('UTC e envelhecimento da sequência',()=>{const date=new Date('2026-11-11T17:00:00Z');assert.equal(utcDay(date),'2026-11-11');assert.equal(streakAge('2026-11-09',date),2);assert.equal(streakAge(new Date('2026-11-10T00:00:00Z'),date),1);});
