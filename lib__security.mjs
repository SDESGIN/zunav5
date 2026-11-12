import {randomBytes,randomUUID,createHash,scryptSync,timingSafeEqual} from 'node:crypto';
export const VIDEO_MAX=3*1024*1024*1024;
export const IMAGE_MAX=12*1024*1024;
export const CHUNK=2*1024*1024;
export const randomId=()=>randomUUID();
export const secret=()=>randomBytes(32).toString('base64url');
export const digest=s=>createHash('sha256').update(String(s)).digest('hex');
export const username=s=>String(s||'').trim().toLowerCase();
export const validUsername=s=>/^[a-z][a-z0-9_.]{2,23}$/.test(s)&&!['admin','root','zuna','support','suporte','oficial','moderacao'].includes(s);
export function hashPassword(pass,salt=randomBytes(16).toString('hex')){
  return `scrypt$${salt}$${scryptSync(String(pass),salt,64).toString('hex')}`;
}
export function verifyPassword(pass,record){
  try {let [alg,salt,hex]=String(record).split('$'); if(alg!=='scrypt'||hex.length!==128) return false;
    return timingSafeEqual(Buffer.from(hex,'hex'),scryptSync(String(pass),salt,64));}catch{return false;}
}
export function safeText(x,max=200){return String(x??'').trim().slice(0,max);}
export function publicUser(u){ if(!u)return null; return {id:u.id,username:u.username,display_name:u.display_name,bio:u.bio,private:u.private,verified:u.verified,avatar_media_id:u.avatar_media_id,created_at:u.created_at}; }
export function mediaType(mime,size){
  if(!Number.isSafeInteger(size)||size<=0) return null;
  const images=['image/png','image/jpeg','image/webp'];
  const videos=['video/mp4','video/webm'];
  if(images.includes(mime)&&size<=IMAGE_MAX)return 'image';
  if(videos.includes(mime)&&size<=VIDEO_MAX)return 'video';
  return null;
}
export function validMagic(bytes,mime){
 const a=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 if(a.length<12)return false;
 if(mime==='image/png')return a.slice(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i]);
 if(mime==='image/jpeg')return a[0]===255&&a[1]===216&&a[2]===255;
 if(mime==='image/webp')return String.fromCharCode(...a.slice(0,4))==='RIFF'&&String.fromCharCode(...a.slice(8,12))==='WEBP';
 if(mime==='video/mp4')return String.fromCharCode(...a.slice(4,8))==='ftyp';
 if(mime==='video/webm')return a[0]===0x1a&&a[1]===0x45&&a[2]===0xdf&&a[3]===0xa3;
 return false;
}
export function parseRange(raw,total,max=CHUNK){
 if(!raw)return {start:0,end:Math.min(total-1,max-1),partial:total>max};
 const m=/^bytes=(\d+)-(\d*)$/.exec(raw);
 if(!m)return null;
 const start=Number(m[1]),requested=m[2]?Number(m[2]):total-1;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(requested)||start<0||start>=total||requested<start)return null;
 return {start,end:Math.min(requested,total-1,start+max-1),partial:true};
}
export function cookie(token,clear=false,secure=true){return `zuna_s=${clear?'':token}; Path=/; HttpOnly; SameSite=Lax; ${secure?'Secure; ':''}Max-Age=${clear?0:60*60*24*21}`;}
export const utcDay=(date=new Date())=>date.toISOString().slice(0,10);
export function streakAge(last, now=new Date()){
 if(!last)return Infinity;
 const day=last instanceof Date?utcDay(last):String(last).slice(0,10);return Math.round((Date.parse(utcDay(now)+'T00:00:00Z')-Date.parse(day+'T00:00:00Z'))/86400000);
}
