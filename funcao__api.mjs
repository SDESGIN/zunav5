import {getDatabase} from '@netlify/database';
import {getStore} from '@netlify/blobs';
import { randomId, secret, digest, hashPassword, verifyPassword, validUsername, username, safeText, publicUser, mediaType, validMagic, parseRange, cookie, CHUNK, utcDay, streakAge } from '../lib/security.mjs';

let instance;
const database=()=>instance??=(getDatabase());
const q=(sql,params=[])=>database().sql.unsafe(sql,params);
const first=async(sql,params=[])=> (await q(sql,params))[0]||null;
const mediaStore=()=>getStore({name:'zuna-v21-media',consistency:'strong'});
const DAY=86400000;
const LIMIT=30;
const err=(status,message)=>Object.assign(new Error(message),{status});
const reply=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const fail=(status,message)=>reply({error:message},status);
const isUUID=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s||'');
const requireValidId=id=>{if(!isUUID(id))throw err(400,'Identificador inválido.');return id;};
const asBoolean=v=>v===true;
const asJSON=async req=>{const len=Number(req.headers.get('content-length')||0);if(len>25000)throw err(413,'Dados muito grandes.');const text=await req.text();if(text.length>25000)throw err(413,'Dados muito grandes.');try{return JSON.parse(text||'{}')}catch{throw err(400,'JSON inválido.')}};
function checkOrigin(req){if(['GET','HEAD','OPTIONS'].includes(req.method))return;const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)throw err(403,'Origem da requisição não autorizada.');}
const reqCookie=req=>{const raw=req.headers.get('cookie')||'';return raw.match(/(?:^|;\s*)zuna_s=([^;]+)/)?.[1]||'';};
async function currentUser(req){const token=reqCookie(req);if(!token||token.length>128)return null;return first(`SELECT u.* FROM z_sessions s JOIN z_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,[digest(token)]);}
const must=u=>{if(!u)throw err(401,'Entre na sua conta para continuar.');return u;};
const adult=u=>{must(u);if(u.private===null)return;}; // Proteções por idade serão ampliadas após auditoria: piloto 18+ apenas.
async function isBlocked(a,b){if(!a||!b)return false;return !!await first('SELECT 1 FROM z_blocks WHERE (blocker=$1 AND blocked=$2) OR (blocker=$2 AND blocked=$1)',[a,b]);}
async function isFollowing(me,id){if(!me)return false;return !!await first('SELECT 1 FROM z_follows WHERE follower=$1 AND followed=$2',[me.id,id]);}
async function canViewPost(p,me){if(!p||p.deleted_at)return false;if(me?.id===p.user_id)return true;if(await isBlocked(me?.id,p.user_id))return false;if(p.visibility==='private'||p.owner_private)return false;if(p.visibility==='public')return true;return isFollowing(me,p.user_id);}
async function postWithOwner(id){return first('SELECT p.*,u.username,u.display_name,u.verified,u.private AS owner_private,u.avatar_media_id FROM z_posts p JOIN z_users u ON u.id=p.user_id WHERE p.id=$1 AND p.deleted_at IS NULL',[id]);}
async function detailedPost(p,me){const id=p.id;const images=await q('SELECT pm.media_id,pm.alt_text,m.mime,m.kind FROM z_post_media pm JOIN z_media m ON m.id=pm.media_id WHERE pm.post_id=$1 ORDER BY pm.position',[id]);
 const counts=await first(`SELECT (SELECT count(*)::int FROM z_likes WHERE post_id=$1) likes, (SELECT count(*)::int FROM z_comments WHERE post_id=$1 AND deleted_at IS NULL) comments,(SELECT count(*)::int FROM z_reposts WHERE post_id=$1) reposts`,[id]);
 const liked=me?!!await first('SELECT 1 FROM z_likes WHERE post_id=$1 AND user_id=$2',[id,me.id]):false;
 const favorited=me?!!await first('SELECT 1 FROM z_favorites WHERE post_id=$1 AND user_id=$2',[id,me.id]):false;
 return {...p,media:images,likes:counts?.likes||0,comments:counts?.comments||0,reposts:counts?.reposts||0,liked,favorited};}
async function notify(target,actor,type,body,postId=null){if(!target||target===actor)return;await q('INSERT INTO z_notifications(id,user_id,actor_id,type,body,post_id) VALUES($1,$2,$3,$4,$5,$6)',[randomId(),target,actor,type,safeText(body,160),postId]);}
async function rateLimit(key,max=12){const hashed=digest(key);const r=await first(`INSERT INTO z_login_attempts(key_hash,count,window_at) VALUES($1,1,now()) ON CONFLICT(key_hash) DO UPDATE SET count=CASE WHEN z_login_attempts.window_at<now()-interval '15 minutes' THEN 1 ELSE z_login_attempts.count+1 END,window_at=CASE WHEN z_login_attempts.window_at<now()-interval '15 minutes' THEN now() ELSE z_login_attempts.window_at END RETURNING count`,[hashed]);if(r.count>max)throw err(429,'Muitas tentativas. Tente novamente mais tarde.');}
async function sessionResponse(user,recovery=null){const token=secret();await q(`INSERT INTO z_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '21 days')`,[digest(token),user.id]);return reply({user:publicUser(user),...(recovery?{recovery_code:recovery}:{})},200,{'Set-Cookie':cookie(token)});}
async function authRoutes(req,path,me,ctx){
 if(path==='/register'&&req.method==='POST'){
  const b=await asJSON(req);const name=username(b.username);const pass=String(b.password||'');
  if(!validUsername(name))throw err(400,'Usuário: 3 a 24 caracteres, começando por letra; use letras minúsculas, números, _ ou ponto.');
  if(pass.length<10||pass.length>128)throw err(400,'A senha precisa ter entre 10 e 128 caracteres.');
  if(b.adult_confirm!==true)throw err(403,'O piloto privado da V21 é restrito a maiores de 18 anos.');
  await rateLimit('register:'+(ctx?.ip||'unknown'),5);
  if(await first('SELECT 1 FROM z_username_aliases WHERE former_username=$1',[name]))throw err(409,'Esse @usuário está reservado.');
  const recovery=secret();const u={id:randomId(),username:name,display_name:safeText(b.display_name||name,60)||name};
  try{await q('INSERT INTO z_users(id,username,display_name,password_hash,recovery_hash) VALUES($1,$2,$3,$4,$5)',[u.id,name,u.display_name,hashPassword(pass),digest(recovery)]);}catch(e){if(e.code==='23505'||String(e.message).includes('unique'))throw err(409,'Esse @usuário já está em uso.');throw e;}
  return sessionResponse({...u,bio:'',private:true,verified:false,avatar_media_id:null},recovery);
 }
 if(path==='/login'&&req.method==='POST'){
  const b=await asJSON(req);await rateLimit('login:'+(ctx?.ip||'unknown')+':'+username(b.username),12);
  const u=await first('SELECT * FROM z_users WHERE username=$1',[username(b.username)]);
  if(!u||!verifyPassword(b.password,u.password_hash))throw err(401,'Usuário ou senha incorretos.');
  return sessionResponse(u);
 }
 if(path==='/recover'&&req.method==='POST'){
  const b=await asJSON(req);await rateLimit('recover:'+(ctx?.ip||'unknown')+':'+username(b.username),8);
  const u=await first('SELECT * FROM z_users WHERE username=$1',[username(b.username)]);
  if(!u||!b.code||u.recovery_hash!==digest(b.code))throw err(401,'Dados de recuperação inválidos.');
  if(String(b.new_password||'').length<10||String(b.new_password).length>128)throw err(400,'Use uma senha de 10 a 128 caracteres.');
  const newCode=secret();
  const changed=await q('UPDATE z_users SET password_hash=$1,recovery_hash=$2 WHERE id=$3 AND recovery_hash=$4 RETURNING id',[hashPassword(b.new_password),digest(newCode),u.id,u.recovery_hash]);
  if(!changed.length)throw err(409,'Código já utilizado.');
  await q('DELETE FROM z_sessions WHERE user_id=$1',[u.id]);
  return reply({ok:true,recovery_code:newCode});
 }
 if(path==='/logout'&&req.method==='POST'){
  const token=reqCookie(req);if(token)await q('DELETE FROM z_sessions WHERE token_hash=$1',[digest(token)]);
  return reply({ok:true},200,{'Set-Cookie':cookie('',true)});
 }
 if(path==='/me'&&req.method==='GET')return reply({user:publicUser(me),admin:me?.role==='admin'});
 if(path==='/me/blocked'&&req.method==='GET'){must(me);return reply({items:await q('SELECT u.username,u.display_name FROM z_blocks b JOIN z_users u ON u.id=b.blocked WHERE b.blocker=$1',[me.id])});}
 if(path==='/me/export'&&req.method==='GET'){
  must(me);const posts=await q('SELECT id,caption,kind,visibility,created_at FROM z_posts WHERE user_id=$1 ORDER BY created_at DESC',[me.id]);
  const follows=await q('SELECT u.username FROM z_follows f JOIN z_users u ON u.id=f.followed WHERE f.follower=$1',[me.id]);
  const messages=await q('SELECT sender_id,recipient_id,body,created_at FROM z_messages WHERE sender_id=$1 OR recipient_id=$1 ORDER BY created_at DESC LIMIT 5000',[me.id]);
  return reply({exported_at:new Date().toISOString(),account:publicUser(me),posts,follows,messages});
 }
 if(path==='/me'&&req.method==='PATCH'){
  must(me);const b=await asJSON(req);const name=safeText(b.display_name??me.display_name,60);const bio=safeText(b.bio??me.bio,300);
  const priv=typeof b.private==='boolean'?b.private:me.private;
  let avatar=me.avatar_media_id;
  if(b.avatar_media_id===null)avatar=null;
  if(b.avatar_media_id&&isUUID(b.avatar_media_id)){
   const m=await first(`SELECT * FROM z_media WHERE id=$1 AND user_id=$2 AND status='ready' AND kind='image'`,[b.avatar_media_id,me.id]);if(!m)throw err(400,'Imagem de perfil inválida.'); avatar=b.avatar_media_id;
  }
  let desired=username(b.username??me.username);if(desired!==me.username){
   if(!validUsername(desired))throw err(400,'Novo @usuário inválido.');
   if(me.username_changed_at&&Date.now()-new Date(me.username_changed_at).getTime()<30*DAY)throw err(429,'Você só pode alterar seu usuário uma vez a cada 30 dias.');
   const aliasUsed=await first('SELECT 1 FROM z_username_aliases WHERE former_username=$1',[desired]);if(aliasUsed)throw err(409,'Este @usuário já foi utilizado.');
   const conn=await database().pool.connect();try{await conn.query('BEGIN');await conn.query('INSERT INTO z_username_aliases(former_username,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[me.username,me.id]);
     await conn.query('UPDATE z_users SET username=$1,username_changed_at=now() WHERE id=$2',[desired,me.id]);await conn.query('COMMIT');}catch(e){await conn.query('ROLLBACK');if(e.code==='23505')throw err(409,'Usuário já ocupado.');throw e;}finally{conn.release();}
 }
  const [u]=await q('UPDATE z_users SET display_name=$1,bio=$2,private=$3,avatar_media_id=$4 WHERE id=$5 RETURNING *',[name||desired,bio,priv,avatar,me.id]);return reply({user:publicUser(u)});
 }
 if(path==='/me/sessions'&&req.method==='GET'){must(me);const items=await q('SELECT created_at,expires_at FROM z_sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20',[me.id]);return reply({sessions:items});}
 if(path==='/me/sessions/revoke'&&req.method==='POST'){must(me);const b=await asJSON(req);if(!verifyPassword(b.password,me.password_hash))throw err(403,'Senha incorreta.');await q('DELETE FROM z_sessions WHERE user_id=$1 AND token_hash<>$2',[me.id,digest(reqCookie(req))]);return reply({ok:true});}
 return null;
}
async function usersRoutes(req,path,me,url){
 const match=path.match(/^\/users\/([a-z0-9_.]{3,24})$/);
 if(match&&req.method==='GET'){
  let u=await first('SELECT * FROM z_users WHERE username=$1',[match[1]]);if(!u)u=await first('SELECT u.* FROM z_username_aliases a JOIN z_users u ON u.id=a.user_id WHERE a.former_username=$1',[match[1]]);if(!u)throw err(404,'Perfil não encontrado.');
  const blocked=await isBlocked(me?.id,u.id);if(blocked)throw err(404,'Perfil indisponível.');const can=me?.id===u.id||(!u.private||await isFollowing(me,u.id));
  const counts=await first(`SELECT (SELECT count(*)::int FROM z_follows WHERE followed=$1) followers,(SELECT count(*)::int FROM z_follows WHERE follower=$1) following,(SELECT count(*)::int FROM z_posts WHERE user_id=$1 AND deleted_at IS NULL) posts`,[u.id]);
  const promo=me?.id===u.id||me?.role==='admin'?await first('SELECT * FROM z_promotions WHERE user_id=$1',[u.id]):null;
  return reply({user:publicUser(u),counts,following:await isFollowing(me,u.id),posts:can?await listPosts(me,{ownerId:u.id,limit:24}):[],private_content:!can,promotional:promo});
 }
 const follow=path.match(/^\/users\/([a-z0-9_.]{3,24})\/follow$/);
 if(follow&&req.method==='POST'){
  must(me);const other=await first('SELECT * FROM z_users WHERE username=$1',[follow[1]]);
  if(!other||other.id===me.id)throw err(400,'Conta inválida para seguir.');if(await isBlocked(me.id,other.id))throw err(403,'Você não pode seguir esta conta.');
  if(other.private)throw err(403,'Contas privadas não aceitam novos seguidores automaticamente nesta edição.');
  const prev=await first('DELETE FROM z_follows WHERE follower=$1 AND followed=$2 RETURNING follower',[me.id,other.id]);
  if(!prev){await q('INSERT INTO z_follows(follower,followed) VALUES($1,$2) ON CONFLICT DO NOTHING',[me.id,other.id]);await notify(other.id,me.id,'follow',`@${me.username} começou a seguir você.`);}
  return reply({following:!prev});
 }
 const block=path.match(/^\/users\/([a-z0-9_.]{3,24})\/block$/);
 if(block&&req.method==='POST'){
  must(me);const other=await first('SELECT * FROM z_users WHERE username=$1',[block[1]]);if(!other||other.id===me.id)throw err(400,'Conta inválida.');
  const removed=await q('DELETE FROM z_blocks WHERE blocker=$1 AND blocked=$2 RETURNING blocker',[me.id,other.id]);
  if(!removed.length){await q('INSERT INTO z_blocks(blocker,blocked) VALUES($1,$2) ON CONFLICT DO NOTHING',[me.id,other.id]);await q('DELETE FROM z_follows WHERE (follower=$1 AND followed=$2) OR (follower=$2 AND followed=$1)',[me.id,other.id]);}
  return reply({blocked:!removed.length});
 }
 if(path==='/search'&&req.method==='GET'){
  const text=safeText(url.searchParams.get('q'),70);if(!text)return reply({users:[],posts:[]});
  const like='%'+text.replace(/[\\%_]/g,'\\$&')+'%';
  const people=await q('SELECT id,username,display_name,avatar_media_id,verified,private FROM z_users WHERE (username ILIKE $1 OR display_name ILIKE $1) AND NOT EXISTS(SELECT 1 FROM z_blocks b WHERE (b.blocker=$2 AND b.blocked=z_users.id) OR (b.blocker=z_users.id AND b.blocked=$2)) ORDER BY username LIMIT 20',[like,me?.id||null]);
  const postRows=await q(`SELECT p.*,u.username,u.display_name,u.verified,u.private owner_private,u.avatar_media_id FROM z_posts p JOIN z_users u ON u.id=p.user_id WHERE p.deleted_at IS NULL AND p.caption ILIKE $1 AND p.visibility='public' AND u.private=false AND NOT EXISTS(SELECT 1 FROM z_blocks b WHERE (b.blocker=$2 AND b.blocked=u.id) OR (b.blocker=u.id AND b.blocked=$2)) ORDER BY p.created_at DESC LIMIT 20`,[like,me?.id||null]);
  return reply({users:people,posts:await Promise.all(postRows.map(p=>detailedPost(p,me)))});
 }
 return null;
}
async function listPosts(me,{ownerId=null,kind=null,limit=20,offset=0,following=false,favorites=false}={}){
 const n=Math.min(30,Math.max(1,Number(limit)||20)),off=Math.min(300,Math.max(0,Number(offset)||0));
 const uid=me?.id||null;
 const list=await q(`SELECT p.*,u.username,u.display_name,u.verified,u.private owner_private,u.avatar_media_id
 FROM z_posts p JOIN z_users u ON u.id=p.user_id
 WHERE p.deleted_at IS NULL
 AND ($1::uuid IS NULL OR p.user_id=$1::uuid)
 AND ($2::text IS NULL OR p.kind=$2)
 AND (p.user_id=$3::uuid OR (p.visibility='public' AND u.private=false) OR (p.visibility='followers' AND EXISTS(SELECT 1 FROM z_follows f WHERE f.follower=$3 AND f.followed=p.user_id)))
 AND NOT EXISTS(SELECT 1 FROM z_blocks b WHERE (b.blocker=$3 AND b.blocked=p.user_id) OR (b.blocker=p.user_id AND b.blocked=$3))
 AND ($4::boolean=false OR EXISTS(SELECT 1 FROM z_follows f WHERE f.follower=$3 AND f.followed=p.user_id))
 AND ($5::boolean=false OR EXISTS(SELECT 1 FROM z_favorites x WHERE x.user_id=$3 AND x.post_id=p.id))
 ORDER BY p.created_at DESC,p.id DESC LIMIT $6 OFFSET $7`,[ownerId,kind,uid,following,favorites,n,off]);
 return Promise.all(list.map(p=>detailedPost(p,me)));
}
async function postsRoutes(req,path,me,url){
 if(path==='/feed'&&req.method==='GET')return reply({items:await listPosts(me,{limit:url.searchParams.get('limit'),offset:url.searchParams.get('offset'),following:url.searchParams.get('following')==='1',favorites:url.searchParams.get('favorites')==='1',kind:url.searchParams.get('kind')||null})});
 if(path==='/posts'&&req.method==='POST'){
  must(me);const b=await asJSON(req);const ids=Array.isArray(b.media_ids)?b.media_ids:[];
  if(!ids.length||ids.length>10||!ids.every(isUUID))throw err(400,'Escolha de 1 a 10 arquivos válidos.');
  if(new Set(ids).size!==ids.length)throw err(400,'Não repita arquivos.');
  const items=await q('SELECT id,kind FROM z_media WHERE id=ANY($1::uuid[]) AND user_id=$2 AND status=$3',[ids,me.id,'ready']);
  if(items.length!==ids.length)throw err(400,'Algum arquivo não está pronto ou não pertence a você.');
  const kind=items.some(x=>x.kind==='video')?'video':'photo';
  if(kind==='video'&&ids.length!==1)throw err(400,'Publicação de vídeo deve conter um arquivo.');
  const visibility=['public','followers','private'].includes(b.visibility)?b.visibility:'private';
  if(visibility==='public'&&me.private)throw err(400,'Para publicar para todos, primeiro torne seu perfil público.');
  const postId=randomId();const conn=await database().pool.connect();
  try{await conn.query('BEGIN');await conn.query('INSERT INTO z_posts(id,user_id,caption,kind,visibility,allow_comments) VALUES($1,$2,$3,$4,$5,$6)',[postId,me.id,safeText(b.caption,1200),kind,visibility,b.allow_comments!==false]);
   for(let i=0;i<ids.length;i++)await conn.query('INSERT INTO z_post_media(post_id,media_id,position,alt_text) VALUES($1,$2,$3,$4)',[postId,ids[i],i,safeText(b.alt_texts?.[i],240)]);
   await conn.query('COMMIT');}catch(e){await conn.query('ROLLBACK');throw e;}finally{conn.release();}
  return reply({post_id:postId},201);
 }
 const postMatch=path.match(/^\/posts\/([0-9a-f-]{36})$/i);
 if(postMatch){let id=requireValidId(postMatch[1]);const post=await postWithOwner(id);if(!post||!(await canViewPost(post,me)))throw err(404,'Publicação indisponível.');
  if(req.method==='GET')return reply({post:await detailedPost(post,me)});
  if(req.method==='DELETE'){must(me);if(me.id!==post.user_id&&me.role!=='admin')throw err(403,'Sem permissão.');await q('UPDATE z_posts SET deleted_at=now() WHERE id=$1',[id]);return reply({ok:true});}
 }
 const action=path.match(/^\/posts\/([0-9a-f-]{36})\/(like|favorite|repost)$/i);
 if(action&&req.method==='POST'){
  must(me);let id=requireValidId(action[1]),what=action[2];const post=await postWithOwner(id);if(!(await canViewPost(post,me)))throw err(404,'Publicação indisponível.');
  const tbl={like:'z_likes',favorite:'z_favorites',repost:'z_reposts'}[what];
  const removed=await q(`DELETE FROM ${tbl} WHERE user_id=$1 AND post_id=$2 RETURNING user_id`,[me.id,id]);
  if(!removed.length){await q(`INSERT INTO ${tbl}(user_id,post_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[me.id,id]);if(what==='like')await notify(post.user_id,me.id,'like',`@${me.username} curtiu sua publicação.`,id);}
  return reply({active:!removed.length});
 }
 const comments=path.match(/^\/posts\/([0-9a-f-]{36})\/comments$/i);
 if(comments){const id=requireValidId(comments[1]);const post=await postWithOwner(id);if(!(await canViewPost(post,me)))throw err(404,'Publicação indisponível.');
  if(req.method==='GET'){const items=await q(`SELECT c.id,c.body,c.created_at,c.parent_id,u.username,u.display_name,u.verified FROM z_comments c JOIN z_users u ON u.id=c.user_id WHERE c.post_id=$1 AND c.deleted_at IS NULL ORDER BY c.created_at ASC LIMIT 100`,[id]);return reply({items});}
  if(req.method==='POST'){must(me);if(!post.allow_comments)throw err(403,'Comentários desativados.');const b=await asJSON(req);const body=safeText(b.body,500);if(!body)throw err(400,'Escreva um comentário.');let parent=null;
   if(b.parent_id){parent=requireValidId(b.parent_id);const p=await first('SELECT id FROM z_comments WHERE id=$1 AND post_id=$2 AND deleted_at IS NULL',[parent,id]);if(!p)throw err(400,'Resposta inválida.');}
   const cid=randomId();await q('INSERT INTO z_comments(id,post_id,user_id,parent_id,body) VALUES($1,$2,$3,$4,$5)',[cid,id,me.id,parent,body]);await notify(post.user_id,me.id,'comment',`@${me.username} comentou sua publicação.`,id);return reply({id:cid},201);}
 }
 const delComment=path.match(/^\/comments\/([0-9a-f-]{36})$/i);
 if(delComment&&req.method==='DELETE'){must(me);const c=await first('SELECT * FROM z_comments WHERE id=$1',[requireValidId(delComment[1])]);if(!c)throw err(404,'Comentário não encontrado.');if(c.user_id!==me.id&&me.role!=='admin')throw err(403,'Sem permissão.');await q('UPDATE z_comments SET deleted_at=now() WHERE id=$1',[c.id]);return reply({ok:true});}
 return null;
}
async function playlistsRoutes(req,path,me){
 if(path==='/playlists'&&req.method==='GET'){
  must(me);return reply({items:await q('SELECT id,name,private,created_at,(SELECT count(*)::int FROM z_playlist_posts pp WHERE pp.playlist_id=p.id) item_count FROM z_playlists p WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',[me.id])});
 }
 if(path==='/playlists'&&req.method==='POST'){
  must(me);const b=await asJSON(req);const name=safeText(b.name,70);if(name.length<2)throw err(400,'Escolha um nome de pelo menos 2 caracteres.');
  const id=randomId();await q('INSERT INTO z_playlists(id,user_id,name,private) VALUES($1,$2,$3,$4)',[id,me.id,name,b.private!==false]);return reply({playlist_id:id},201);
 }
 const route=path.match(/^\/playlists\/([0-9a-f-]{36})(?:\/(add|remove))?$/i);
 if(route){const id=requireValidId(route[1]);const p=await first('SELECT * FROM z_playlists WHERE id=$1',[id]);if(!p)throw err(404,'Playlist não encontrada.');
  if(req.method==='GET'&&!route[2]){
   if(p.private&&p.user_id!==me?.id)throw err(404,'Playlist privada.');
   const rows=await q(`SELECT po.*,u.username,u.display_name,u.verified,u.private owner_private,u.avatar_media_id FROM z_playlist_posts x JOIN z_posts po ON po.id=x.post_id JOIN z_users u ON u.id=po.user_id WHERE x.playlist_id=$1 AND po.deleted_at IS NULL ORDER BY x.created_at DESC LIMIT 40`,[id]);
   const allowed=[];for(const po of rows)if(await canViewPost(po,me))allowed.push(await detailedPost(po,me));return reply({playlist:p,posts:allowed});
  }
  if(p.user_id!==me?.id)throw err(403,'Playlist de outra pessoa.');
  if(req.method==='DELETE'&&!route[2]){await q('DELETE FROM z_playlists WHERE id=$1',[id]);return reply({ok:true});}
  if(req.method==='POST'&&route[2]){const b=await asJSON(req);const post=await postWithOwner(requireValidId(b.post_id));if(!post||!(await canViewPost(post,me)))throw err(404,'Publicação indisponível.');
   if(route[2]==='add')await q('INSERT INTO z_playlist_posts(playlist_id,post_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,post.id]);
   else await q('DELETE FROM z_playlist_posts WHERE playlist_id=$1 AND post_id=$2',[id,post.id]);return reply({ok:true});
  }
 }
 if(path==='/creator/analytics'&&req.method==='GET'){
  must(me);const totals=await first(`SELECT (SELECT count(*)::int FROM z_posts WHERE user_id=$1 AND deleted_at IS NULL) posts,(SELECT count(*)::int FROM z_follows WHERE followed=$1) followers,
   (SELECT count(*)::int FROM z_likes l JOIN z_posts p ON p.id=l.post_id WHERE p.user_id=$1 AND p.deleted_at IS NULL) likes,
   (SELECT count(*)::int FROM z_comments c JOIN z_posts p ON p.id=c.post_id WHERE p.user_id=$1 AND c.deleted_at IS NULL) comments`,[me.id]);
  return reply({totals,source:'organic'});
 }
 return null;
}
async function mediaRoutes(req,path,me){
 if(path==='/upload/start'&&req.method==='POST'){
  must(me);const b=await asJSON(req);const size=Number(b.size);const mime=String(b.mime||'').toLowerCase();const kind=mediaType(mime,size);
  if(!kind)throw err(400,'Formato ou tamanho não permitido. Imagens: até 12 MB; MP4/WebM: até 3 GiB.');
  const quota=await first(`SELECT count(*) FILTER(WHERE status='uploading')::int active,coalesce(sum(size_bytes) FILTER(WHERE status<>'deleted'),0)::bigint used FROM z_media WHERE user_id=$1`,[me.id]);
  if(quota.active>=3)throw err(429,'Conclua seus envios pendentes antes de iniciar outros.');
  if(Number(quota.used)+size>10*1024*1024*1024)throw err(413,'Limite de armazenamento de 10 GiB por conta no piloto.');
  const id=randomId(),chunks=Math.ceil(size/CHUNK);
  await q('INSERT INTO z_media(id,user_id,kind,mime,filename,size_bytes,total_chunks) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,me.id,kind,mime,safeText(b.filename,120)||'arquivo',size,chunks]);
  return reply({upload_id:id,chunk_bytes:CHUNK,total_chunks:chunks},201);
 }
 const status=path.match(/^\/upload\/([0-9a-f-]{36})\/status$/i);
 if(status&&req.method==='GET'){
  must(me);const m=await first('SELECT * FROM z_media WHERE id=$1 AND user_id=$2',[requireValidId(status[1]),me.id]);if(!m)throw err(404,'Envio não encontrado.');
  const done=await q('SELECT chunk_index FROM z_media_chunks WHERE media_id=$1 ORDER BY chunk_index',[m.id]);return reply({status:m.status,total_chunks:m.total_chunks,chunk_bytes:m.chunk_bytes,received:done.map(x=>x.chunk_index)});
 }
 const piece=path.match(/^\/upload\/([0-9a-f-]{36})\/chunk\/(\d+)$/i);
 if(piece&&req.method==='POST'){
  must(me);const id=requireValidId(piece[1]),idx=Number(piece[2]);
  const m=await first('SELECT * FROM z_media WHERE id=$1 AND user_id=$2',[id,me.id]);
  if(!m||m.status!=='uploading')throw err(404,'Envio não encontrado ou finalizado.');
  if(Date.now()-new Date(m.created_at).getTime()>DAY)throw err(410,'Envio expirado. Inicie novamente.');
  if(!Number.isInteger(idx)||idx<0||idx>=m.total_chunks)throw err(400,'Bloco inválido.');
  if(Number(req.headers.get('content-length')||0)>CHUNK)throw err(413,'Bloco acima do limite.');
  const bytes=new Uint8Array(await req.arrayBuffer());const expected=idx===m.total_chunks-1?Number(m.size_bytes)-idx*CHUNK:CHUNK;
  if(bytes.byteLength!==expected)throw err(400,'Tamanho incorreto do bloco.');
  if(idx===0&&!validMagic(bytes,m.mime))throw err(400,'A assinatura do arquivo não corresponde ao formato declarado.');
  const key=`media/${id}/${idx}`;
  await mediaStore().set(key,bytes.buffer,{onlyIfNew:true});
  await q('INSERT INTO z_media_chunks(media_id,chunk_index,byte_size) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[id,idx,bytes.byteLength]);
  return reply({ok:true,index:idx});
 }
 const finish=path.match(/^\/upload\/([0-9a-f-]{36})\/finish$/i);
 if(finish&&req.method==='POST'){
  must(me);const id=requireValidId(finish[1]);const m=await first('SELECT * FROM z_media WHERE id=$1 AND user_id=$2',[id,me.id]);
  if(!m)throw err(404,'Arquivo não encontrado.');
  if(m.status==='ready')return reply({ok:true,media_id:id});
  const totals=await first('SELECT count(*)::int count,coalesce(sum(byte_size),0)::bigint size FROM z_media_chunks WHERE media_id=$1',[id]);
  if(totals.count!==m.total_chunks||Number(totals.size)!==Number(m.size_bytes))throw err(409,`Envio incompleto: ${totals.count}/${m.total_chunks} partes.`);
  await q(`UPDATE z_media SET status='ready' WHERE id=$1 AND user_id=$2 AND status='uploading'`,[id,me.id]);
  return reply({ok:true,media_id:id});
 }
 const view=path.match(/^\/media\/([0-9a-f-]{36})$/i);
 if(view&&['GET','HEAD'].includes(req.method)){
  const id=requireValidId(view[1]),m=await first(`SELECT * FROM z_media WHERE id=$1 AND status='ready'`,[id]);if(!m)throw err(404,'Mídia não encontrada.');
  let allowed=me?.id===m.user_id;
  if(!allowed){
   const attached=await q(`SELECT p.*,u.private owner_private FROM z_post_media pm JOIN z_posts p ON p.id=pm.post_id JOIN z_users u ON u.id=p.user_id WHERE pm.media_id=$1 AND p.deleted_at IS NULL LIMIT 5`,[id]);
   for(const p of attached){if(await canViewPost(p,me)){allowed=true;break;}}
   if(!allowed){const stories=await q(`SELECT s.user_id,u.private FROM z_stories s JOIN z_users u ON u.id=s.user_id WHERE s.media_id=$1 AND s.expires_at>now()`,[id]);
    for(const s of stories){if(!s.private||await isFollowing(me,s.user_id)){allowed=true;break;}}}
   if(!allowed){const a=await first('SELECT 1 FROM z_users WHERE avatar_media_id=$1',[id]);allowed=!!a;}
  }
  if(!allowed)throw err(404,'Mídia não disponível.');
  const total=Number(m.size_bytes);const requested=req.headers.get('range');
  // Imagens sem Range são servidas inteiras (até 12 MB); vídeos são entregues em fragmentos de no máximo 2 MB.
  if(m.kind==='image'&&!requested){
   const stream=new ReadableStream({async start(controller){try{for(let i=0;i<m.total_chunks;i++){
     const buf=await mediaStore().get(`media/${id}/${i}`,{type:'arrayBuffer'});if(!buf)throw Error('Bloco de imagem ausente');controller.enqueue(new Uint8Array(buf));}
     controller.close();}catch(e){controller.error(e);}}});
   return new Response(req.method==='HEAD'?null:stream,{status:200,headers:{'Content-Type':m.mime,'Content-Length':String(total),'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  const parsed=parseRange(requested,total,CHUNK);
  if(!parsed)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${total}`}});
  const index=Math.floor(parsed.start/CHUNK),within=parsed.start%CHUNK;
  const last=Math.min(parsed.end,(index+1)*CHUNK-1),length=last-parsed.start+1;
  const buf=await mediaStore().get(`media/${id}/${index}`,{type:'arrayBuffer'});
  if(!buf)throw err(503,'Arquivo temporariamente indisponível.');
  const body=new Uint8Array(buf).subarray(within,within+length);
  return new Response(req.method==='HEAD'?null:body,{status:206,headers:{'Content-Type':m.mime,'Accept-Ranges':'bytes','Content-Range':`bytes ${parsed.start}-${last}/${total}`,'Content-Length':String(length),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 return null;
}
async function storyRoutes(req,path,me){
 if(path!=='/stories')return null;
 if(req.method==='GET'){
  const items=await q(`SELECT s.id,s.caption,s.media_id,s.created_at,s.expires_at,m.kind,u.username,u.display_name,u.avatar_media_id FROM z_stories s JOIN z_media m ON m.id=s.media_id JOIN z_users u ON u.id=s.user_id WHERE s.expires_at>now() AND NOT EXISTS(SELECT 1 FROM z_blocks b WHERE (b.blocker=$1 AND b.blocked=s.user_id) OR (b.blocker=s.user_id AND b.blocked=$1)) AND (u.private=false OR u.id=$1::uuid OR EXISTS(SELECT 1 FROM z_follows f WHERE f.follower=$1 AND f.followed=u.id)) ORDER BY s.created_at DESC LIMIT 40`,[me?.id||null]);return reply({items});
 }
 if(req.method==='POST'){
  must(me);const b=await asJSON(req);const m=await first(`SELECT * FROM z_media WHERE id=$1 AND user_id=$2 AND status='ready'`,[requireValidId(b.media_id),me.id]);if(!m)throw err(400,'Envie uma foto ou vídeo antes de publicar o Story.');
  const id=randomId();await q('INSERT INTO z_stories(id,user_id,media_id,caption) VALUES($1,$2,$3,$4)',[id,me.id,m.id,safeText(b.caption,160)]);return reply({story_id:id},201);
 }
 return null;
}
async function updateStreak(a,b){
 const low=[a,b].sort()[0],high=[a,b].sort()[1];
 const stat=await first(`SELECT count(DISTINCT sender_id)::int unique_senders FROM z_messages WHERE ((sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1)) AND created_at>=date_trunc('day',now()) AND deleted_at IS NULL`,[a,b]);
 if((stat?.unique_senders||0)<2)return;
 await q(`INSERT INTO z_streaks(low_id,high_id,days,last_exchange) VALUES($1,$2,1,CURRENT_DATE)
 ON CONFLICT(low_id,high_id) DO UPDATE SET days=CASE WHEN z_streaks.last_exchange=CURRENT_DATE THEN z_streaks.days WHEN z_streaks.last_exchange=CURRENT_DATE-1 THEN z_streaks.days+1 ELSE 1 END,last_exchange=CURRENT_DATE`,[low,high]);
}
async function messagesRoutes(req,path,me){
 const match=path.match(/^\/messages\/([a-z0-9_.]{3,24})$/);
 if(match&&['GET','POST'].includes(req.method)){
  must(me);const partner=await first('SELECT * FROM z_users WHERE username=$1',[match[1]]);if(!partner||partner.id===me.id)throw err(404,'Conversa não encontrada.');if(await isBlocked(me.id,partner.id))throw err(403,'Conversa indisponível.');
  const mutual=(await isFollowing(me,partner.id))&&(await isFollowing(partner,me.id));
  if(!mutual)throw err(403,'Mensagens liberadas apenas entre pessoas que se seguem mutuamente.');
  if(req.method==='GET'){
   const list=await q(`SELECT m.id,m.body,m.created_at,m.sender_id,u.username sender FROM z_messages m JOIN z_users u ON u.id=m.sender_id WHERE ((m.sender_id=$1 AND m.recipient_id=$2) OR (m.sender_id=$2 AND m.recipient_id=$1)) AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 100`,[me.id,partner.id]);
   return reply({items:list.reverse(),partner:publicUser(partner)});
  }
  const b=await asJSON(req);const body=safeText(b.body,1000);if(!body)throw err(400,'Escreva uma mensagem.');
  const id=randomId();await q('INSERT INTO z_messages(id,sender_id,recipient_id,body) VALUES($1,$2,$3,$4)',[id,me.id,partner.id,body]);await updateStreak(me.id,partner.id);
  await notify(partner.id,me.id,'message',`Nova mensagem de @${me.username}.`);
  return reply({id},201);
 }
 const flame=path.match(/^\/streak\/([a-z0-9_.]{3,24})(\/restore)?$/);
 if(flame){must(me);const other=await first('SELECT * FROM z_users WHERE username=$1',[flame[1]]);if(!other)throw err(404,'Usuário não encontrado.');
  const [low,high]=[me.id,other.id].sort();const row=await first('SELECT * FROM z_streaks WHERE low_id=$1 AND high_id=$2',[low,high]);
  const age=streakAge(row?.last_exchange);const period=utcDay().slice(0,7);const used=await first('SELECT 1 FROM z_streak_restores WHERE user_id=$1 AND month=$2',[me.id,period]);
  if(req.method==='GET')return reply({days:age<=1?(row?.days||0):0,active:(row?.days||0)>=3&&age<=1,can_restore:(row?.days||0)>=3&&age===2&&!used,monthly_restores_left:used?0:1});
  if(flame[2]==='/restore'&&req.method==='POST'){
   if(!row||row.days<3||age!==2||used)throw err(409,'Esta sequência não pode ser restaurada.');
   const success=await q('INSERT INTO z_streak_restores(user_id,partner_id,month) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING user_id',[me.id,other.id,period]);
   if(!success.length)throw err(409,'Restauração mensal já utilizada.');
   await q(`UPDATE z_streaks SET last_exchange=CURRENT_DATE-1 WHERE low_id=$1 AND high_id=$2`,[low,high]);return reply({restored:true,days:row.days});
  }
 }
 if(path==='/inbox'&&req.method==='GET'){
  must(me);const items=await q(`SELECT DISTINCT ON (partner_id) partner_id,username,display_name,avatar_media_id,body,created_at FROM (
   SELECT CASE WHEN m.sender_id=$1 THEN m.recipient_id ELSE m.sender_id END partner_id,u.username,u.display_name,u.avatar_media_id,m.body,m.created_at
   FROM z_messages m JOIN z_users u ON u.id=CASE WHEN m.sender_id=$1 THEN m.recipient_id ELSE m.sender_id END
   WHERE (m.sender_id=$1 OR m.recipient_id=$1) AND m.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM z_blocks b WHERE (b.blocker=$1 AND b.blocked=u.id) OR (b.blocker=u.id AND b.blocked=$1))) q ORDER BY partner_id,created_at DESC LIMIT 50`,[me.id]);return reply({items});
 }
 if(path==='/notifications'&&req.method==='GET'){
  must(me);const items=await q(`SELECT n.id,n.type,n.body,n.post_id,n.created_at,n.read_at,u.username actor FROM z_notifications n LEFT JOIN z_users u ON u.id=n.actor_id WHERE n.user_id=$1 ORDER BY n.created_at DESC LIMIT 60`,[me.id]);return reply({items});
 }
 if(path==='/notifications/read'&&req.method==='POST'){must(me);await q('UPDATE z_notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL',[me.id]);return reply({ok:true});}
 return null;
}
async function adminRoutes(req,path,me,url){
 if(path==='/report'&&req.method==='POST'){
  must(me);const b=await asJSON(req);if(!['post','user','comment','story'].includes(b.target_type)||!isUUID(b.target_id))throw err(400,'Item inválido.');const reason=safeText(b.reason,200);if(reason.length<8)throw err(400,'Explique o motivo da denúncia.');
  await q('INSERT INTO z_reports(id,reporter_id,target_type,target_id,reason) VALUES($1,$2,$3,$4,$5)',[randomId(),me.id,b.target_type,b.target_id,reason]);return reply({ok:true},201);
 }
 if(!path.startsWith('/admin/'))return null;
 must(me);if(me.role!=='admin')throw err(403,'Somente administração.');
 if(path==='/admin/users'&&req.method==='GET'){
  const search='%'+safeText(url.searchParams.get('q'),40)+'%';const items=await q('SELECT id,username,display_name,verified,role,created_at FROM z_users WHERE username ILIKE $1 ORDER BY created_at DESC LIMIT 50',[search]);return reply({items});
 }
 if(path==='/admin/reports'&&req.method==='GET')return reply({items:await q('SELECT * FROM z_reports ORDER BY created_at DESC LIMIT 80')});
 if(path==='/admin/verify'&&req.method==='POST'){
  const b=await asJSON(req);const u=await first('SELECT * FROM z_users WHERE username=$1',[username(b.username)]);if(!u)throw err(404,'Usuário não encontrado.');
  const next=b.verified===true;await q('UPDATE z_users SET verified=$1 WHERE id=$2',[next,u.id]);await q('INSERT INTO z_audit(id,admin_id,action,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',[randomId(),me.id,'verify',u.id,JSON.stringify({verified:next})]);return reply({ok:true,verified:next});
 }
 if(path==='/admin/promotion'&&req.method==='POST'){
  const b=await asJSON(req);const u=await first('SELECT * FROM z_users WHERE username=$1',[username(b.username)]);if(!u)throw err(404,'Usuário não encontrado.');
  const vals=[b.promo_views,b.promo_likes,b.promo_followers].map(Number);if(vals.some(v=>!Number.isSafeInteger(v)||v<0||v>1e9))throw err(400,'Use apenas números válidos de 0 a 1 bilhão.');
  await q(`INSERT INTO z_promotions(user_id,promo_views,promo_likes,promo_followers) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET promo_views=$2,promo_likes=$3,promo_followers=$4,updated_at=now()`,[u.id,...vals]);
  await q('INSERT INTO z_audit(id,admin_id,action,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',[randomId(),me.id,'promotion',u.id,JSON.stringify({promo_views:vals[0],promo_likes:vals[1],promo_followers:vals[2]})]);
  return reply({ok:true,not_organic:true});
 }
 if(path==='/admin/report/review'&&req.method==='POST'){
  const b=await asJSON(req);requireValidId(b.id);const status=b.status==='reviewed'?'reviewed':'open';
  await q('UPDATE z_reports SET status=$1,reviewed_by=$2 WHERE id=$3',[status,me.id,b.id]);return reply({ok:true});
 }
 if(path==='/admin/health'&&req.method==='GET'){
  const users=await first('SELECT count(*)::int n FROM z_users');const posts=await first('SELECT count(*)::int n FROM z_posts WHERE deleted_at IS NULL');const media=await first('SELECT count(*)::int n FROM z_media');return reply({database:'ok',counts:{users:users.n,posts:posts.n,media:media.n},version:'21.0'});
 }
 return null;
}
export default async function handler(req,ctx){
 try{
  checkOrigin(req);
  const url=new URL(req.url),path=url.pathname.replace(/^\/(?:\.netlify\/functions\/api|api)/,'')||'/';
  if(path==='/health'&&req.method==='GET')return reply({ok:true,version:'21.1',service:'api',database:'not_checked'});
  if(path==='/ready'&&req.method==='GET'){
   try{
    const status=await first("SELECT to_regclass('public.z_users') IS NOT NULL AS users, to_regclass('public.z_posts') IS NOT NULL AS posts");
    if(!status?.users||!status?.posts)return fail(503,'Banco acessível, mas as tabelas da ZUNA não existem. Confira as migrações no deploy da Netlify.');
    return reply({ok:true,version:'21.1',database:'ready',schema:'ready'});
   }catch(e){console.error('ZUNA Database readiness:',e?.code||e?.name||'Error');return fail(503,'Netlify Database indisponível. Confira se o banco está ativo no seu plano e conectado ao projeto.');}
  }
  const me=await currentUser(req);
  for(const route of [()=>authRoutes(req,path,me,ctx),()=>usersRoutes(req,path,me,url),()=>postsRoutes(req,path,me,url),()=>playlistsRoutes(req,path,me),()=>mediaRoutes(req,path,me),()=>storyRoutes(req,path,me),()=>messagesRoutes(req,path,me),()=>adminRoutes(req,path,me,url)]){
   const found=await route();if(found)return found;
  }
  return fail(404,'Rota não encontrada.');
 }catch(e){
  if(e.status)return fail(e.status,e.message);
  console.error('ZUNA V21.1 API failure',e?.code||e?.name||'Error');return fail(500,'Não foi possível concluir a operação.');
 }
}
