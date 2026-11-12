// Limpeza diária das sessões e envios incompletos; não remove mídias publicadas.
import {getDatabase} from '@netlify/database';
import {getStore} from '@netlify/blobs';
export default async function cleanup(){
 const db=getDatabase();const store=getStore({name:'zuna-v21-media',consistency:'strong'});
 await db.sql`DELETE FROM z_sessions WHERE expires_at<now()`;
 await db.sql`DELETE FROM z_login_attempts WHERE window_at<now()-interval '2 days'`;
 const stale=await db.sql`SELECT id,total_chunks FROM z_media WHERE status='uploading' AND created_at<now()-interval '24 hours' LIMIT 25`;
 for(const m of stale){
  for(let i=0;i<m.total_chunks;i++){try{await store.delete(`media/${m.id}/${i}`)}catch{}}
  await db.sql`DELETE FROM z_media WHERE id=${m.id} AND status='uploading'`;
 }
 await db.sql`DELETE FROM z_stories WHERE expires_at<now()-interval '7 days'`;
}
export const config={schedule:'@daily'};
