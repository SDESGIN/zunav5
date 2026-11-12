/* ZUNA V21.1 — correções de cadastro, conexão e navegação. */
const $=(s,root=document)=>root.querySelector(s);
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const apiURL=p=>'/api'+p;
const mediaSrc=id=>'/api/media/'+encodeURIComponent(id||'');
const fmtDate=s=>new Date(s).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
const compact=n=>new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(Number(n)||0);
const S={user:null,admin:false,page:'feed',feedTab:'foryou',navId:0,photoIndex:{},posts:[],uploads:[],mode:'login',currentProfile:null,chat:null,feedObserver:null};
async function api(path,{method='GET',data,body}={}){
 const options={method,credentials:'same-origin',cache:'no-store'};
 if(body!==undefined){options.body=body;options.headers={'Content-Type':'application/octet-stream'};}
 else if(data!==undefined){options.body=JSON.stringify(data);options.headers={'Content-Type':'application/json'};}
 let response;try{response=await fetch(apiURL(path),options);}catch{throw new Error('Sem conexão. Verifique sua internet.');}
 let result={};try{result=await response.json();}catch{throw new Error('Servidor indisponível ou configuração da Netlify incompleta.');}
 if(!response.ok)throw new Error(result.error||`Erro ${response.status}`);
 return result;
}
function toast(msg){let el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),5000);}
function loading(label='Carregando...'){return `<div class="loading"><div class="loader"></div><p>${E(label)}</p></div>`;}
function shell(title,sub='',content='',extra=''){return `<div class="page"><div class="page-head"><div><h1>${E(title)}</h1>${sub?`<div class="subtle">${E(sub)}</div>`:''}</div>${extra}</div>${content}</div>`;}
function empty(icon,title,desc,cta=''){return `<div class="empty"><span class="empty-icon">${icon}</span><h2>${E(title)}</h2><p>${E(desc)}</p>${cta}</div>`;}
function avatar(u,cls=''){return `<span class="pfp ${cls}">${u?.avatar_media_id?`<img src="${mediaSrc(u.avatar_media_id)}" alt="">`:E((u?.display_name||u?.username||'Z').slice(0,1).toUpperCase())}</span>`;}
function verified(u){return u?.verified?'<span class="verified" title="Conta verificada pela ZUNA">✹</span>':'';}
function buttons(){let options=[['feed','⌂','Início'],['search','⌕','Explorar'],['create','＋','Publicar'],['inbox','▤','Mensagens'],['notifications','♧','Atividade'],['favorites','♡','Salvos'],['stories','◉','Stories'],['playlists','▥','Playlists'],['creator','▥','Criador'],['profile','◍','Perfil']];
 if(S.admin)options.push(['admin','⚙','Administração']);
 $('#side-nav').innerHTML=options.map(([id,ic,txt])=>`<button class="side-link ${S.page===id?'active':''}" data-nav="${id}"><span class="i">${ic}</span>${txt}</button>`).join('');
 $('#mobile-nav').innerHTML=[['feed','⌂','Início'],['search','⌕','Explorar'],['create','＋','Criar'],['inbox','▤','Inbox'],['profile','◍','Perfil']].map(([id,ic,txt])=>`<button class="mobile-item ${S.page===id?'active':''} ${id==='create'?'create':''}" data-nav="${id}"><span class="i">${ic}</span>${txt}</button>`).join('');
 $('#top-avatar').innerHTML=S.user?.avatar_media_id?`<img src="${mediaSrc(S.user.avatar_media_id)}" alt="">`:E((S.user?.display_name||'Z').slice(0,1).toUpperCase());
}
function requireLogin(fn){if(!S.user){openAuth();return false;}return fn?.()??true;}
function showModal(body,{wide=false,title=''}={}){const root=$('#modal');root.hidden=false;root.innerHTML=`<div class="dialog ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${E(title||'Janela ZUNA')}"><div class="dialog-head"><h2>${E(title)}</h2><button class="close" data-action="close-modal" aria-label="Fechar">×</button></div>${body}</div>`;document.body.style.overflow='hidden';root.querySelector('input,button,textarea')?.focus();}
function closeModal(){const root=$('#modal');root.hidden=true;root.innerHTML='';document.body.style.overflow='';}
async function go(page,param){S.page=page;S.param=param??null;buttons();const nav=++S.navId;const main=$('#content');main.innerHTML=loading();scrollTo({top:0,behavior:'instant'});
 try{let html='';switch(page){
 case 'feed':html=await renderFeed();break;
 case 'search':html=await renderSearch();break;
 case 'create':html=renderCreate();break;
 case 'profile':html=await renderProfile(param||S.user?.username);break;
 case 'inbox':html=await renderInbox();break;
 case 'chat':html=await renderChat(param);break;
 case 'notifications':html=await renderNotifications();break;
 case 'favorites':html=await renderFavorites();break;
 case 'stories':html=await renderStories();break;
 case 'playlists':html=await renderPlaylists();break;
 case 'playlist':html=await renderPlaylist(param);break;
 case 'creator':html=await renderCreator();break;
 case 'admin':html=await renderAdmin();break;
 case 'post':html=await renderSingle(param);break;
 default:html=empty('⌕','Área não encontrada','Abra o menu para voltar.');}
 if(nav!==S.navId)return;if(page==='post'&&param){history.replaceState({},'',`/?post=${encodeURIComponent(param)}`);}else if(location.search){history.replaceState({},'','/');}main.innerHTML=html;if(page==='feed'||page==='post'||page==='favorites'||page==='playlist')setUpVideos();if(page==='admin')loadReports();}
 catch(e){if(nav!==S.navId)return;main.innerHTML=empty('⚠','Não foi possível abrir',e.message,`<button class="secondary" data-nav="${E(page)}">Tentar novamente</button>`);}
}
function postHTML(p){const index=S.photoIndex[p.id]||0;const med=p.media[index]||p.media[0];const filename=med?.media_id?mediaSrc(med.media_id):'';
 const video=p.kind==='video';const counts=p.media.length;
 return `<article class="post-card" data-post-id="${p.id}">
  <div class="post-header">${avatar(p)}<div class="post-handle"><b><button class="text-link" data-action="view-profile" data-username="${E(p.username)}">@${E(p.username)}</button> ${verified(p)}</b><span>${fmtDate(p.created_at)} · ${E(p.visibility==='public'?'Público':p.visibility==='followers'?'Seguidores':'Privado')}</span></div><button class="icon-btn" data-action="post-menu" data-id="${p.id}" aria-label="Opções da publicação">⋯</button><button class="icon-btn" data-action="share" data-id="${p.id}" aria-label="Compartilhar publicação">↗</button></div>
  <div class="post-media">${video?`<video src="${filename}" playsinline muted loop preload="metadata" controls aria-label="Vídeo de @${E(p.username)}"></video><span class="video-hint">▶ Toque para assistir com áudio</span>`:`<img src="${filename}" alt="${E(med?.alt_text||p.caption||'Foto publicada')}" loading="lazy">`}
  ${!video&&counts>1?`<span class="photo-count">${index+1}/${counts}</span><button class="photo-nav left" data-action="photo-prev" data-id="${p.id}" aria-label="Foto anterior">‹</button><button class="photo-nav right" data-action="photo-next" data-id="${p.id}" aria-label="Próxima foto">›</button>`:''}</div>
  <div class="post-footer"><div class="post-actions"><button class="post-action ${p.liked?'active':''}" data-action="like" data-id="${p.id}" aria-label="Curtir publicação"><b>${p.liked?'♥':'♡'}</b><span>${compact(p.likes)}</span></button><button class="post-action" data-action="comments" data-id="${p.id}" aria-label="Comentários"><b>♧</b>${compact(p.comments)}</button><button class="post-action ${p.favorited?'active':''}" data-action="favorite" data-id="${p.id}" aria-label="Salvar publicação"><b>▣</b> Salvar</button><button class="post-action" data-action="save-playlist" data-id="${p.id}" title="Adicionar à playlist" aria-label="Adicionar à playlist"><b>▥</b></button><button class="post-action" data-action="repost" data-id="${p.id}" aria-label="Republicar"><b>⟳</b></button></div>
  <div class="caption"><b>@${E(p.username)}</b>${E(p.caption||'')}</div></div></article>`;
}
function setUpVideos(){S.feedObserver?.disconnect();const vids=[...document.querySelectorAll('.post-media video')];if(!vids.length)return;
 S.feedObserver=new IntersectionObserver(entries=>entries.forEach(e=>{let v=e.target;if(e.isIntersecting&&e.intersectionRatio>.68){vids.forEach(o=>{if(o!==v)o.pause()});v.play().catch(()=>{});}else v.pause()}),{threshold:[0,.25,.7,1]});vids.forEach(v=>S.feedObserver.observe(v));}
async function renderFeed(){const {items}=await api(`/feed?limit=20&following=${S.feedTab==='following'?'1':'0'}`);S.posts=items;let storyBar='';try{const r=await api('/stories');S.stories=r.items;storyBar=`<div class="story-strip"><button class="story-btn" data-nav="stories"><span class="pfp">＋</span>Seu Story</button>${r.items.slice(0,12).map(s=>`<button class="story-btn" data-action="open-story" data-id="${s.id}">${avatar(s)}${E(s.username)}</button>`).join('')}</div>`;}catch{}
 return `<div class="page narrow">${!S.user?`<section class="welcome-register"><div><strong>Comece na ZUNA ✨</strong><p>Crie sua conta e publique suas ideias.</p></div><div class="row wrap"><button class="primary compact" data-action="open-register">Criar conta</button><button class="ghost compact" data-action="open-login">Entrar</button></div></section>`:''}${storyBar}<div class="pill-tabs"><button class="pill ${S.feedTab==='foryou'?'active':''}" data-action="feed-tab" data-value="foryou">Para você</button><button class="pill ${S.feedTab==='following'?'active':''}" data-action="feed-tab" data-value="following">Seguindo</button></div><div class="feed-wrap">${items.length?items.map(postHTML).join(''):empty('◉','Seu feed começa aqui','Ainda não há publicações disponíveis. Crie a primeira ou descubra pessoas para acompanhar.',`<button class="primary" data-nav="create">＋ Criar publicação</button>`)}</div></div>`;
}
async function renderSingle(id){const {post}=await api('/posts/'+encodeURIComponent(id));S.posts=[post];return shell('Publicação',`@${post.username}`,`<div class="feed-wrap">${postHTML(post)}</div>`,`<button class="ghost compact" data-nav="feed">Voltar</button>`);}
async function renderFavorites(){if(!S.user){openAuth();return empty('♡','Seus favoritos','Entre para ver as publicações salvas.');}const {items}=await api('/feed?favorites=1');S.posts=items;return shell('Salvos','Suas publicações favoritas ficam privadas.',items.length?`<div class="feed-wrap">${items.map(postHTML).join('')}</div>`:empty('♡','Nada salvo ainda','Toque em Salvar em um vídeo ou foto para encontrar aqui.'));}
function renderCreate(){if(!S.user){setTimeout(openAuth,60);return shell('Criar publicação','Entre para começar.',empty('＋','Dê vida à sua ideia','Sua conta é necessária para publicar.'));}
 return shell('Criar publicação','Fotos, carrossel ou vídeo com seus arquivos originais.',`<section class="panel"><form id="post-form" class="form">
 <label class="upload-drop" for="post-files" id="upload-drop"><span style="font-size:37px;color:var(--lime)">⬆</span><strong>Escolher fotos ou vídeo</strong><small>Arraste arquivos para cá ou clique para selecionar</small><small>Fotos até 12 MB · MP4/WebM até 3 GiB · 2 MB por parte</small></label><input type="file" id="post-files" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" multiple hidden>
 <div class="file-list" id="file-list"></div><div id="upload-progress" hidden><div class="progress"><span id="progress-bar"></span></div><small id="progress-label">Preparando arquivos...</small></div>
 <div class="field"><label for="post-caption">Legenda</label><textarea id="post-caption" maxlength="1200" placeholder="Conte sua história... #ZUNA"></textarea></div>
 <div class="field"><label for="post-visibility">Quem pode ver</label><select id="post-visibility"><option value="private">Somente eu</option><option value="followers">Seguidores</option>${!S.user.private?'<option value="public">Todo mundo</option>':''}</select></div>
 <label class="checkbox-row"><input id="allow-comments" type="checkbox" checked> Permitir comentários</label><button type="submit" class="primary full" id="publish-btn">Publicar na ZUNA</button>
 <p class="subtle">Vídeos são entregues no formato original. A Netlify não faz conversão automática para 1080p ou 60 fps. Um vídeo grande pode gerar custos e levar bastante tempo para enviar.</p></form></section>`);
}
async function uploadFile(file,onProgress=()=>{}){
 const fingerprint=`zuna21:${S.user?.id||'anon'}:${file.name}:${file.size}:${file.lastModified}:${file.type}`;
 let upload_id,chunk_bytes,total_chunks,received=[];
 try {upload_id=localStorage.getItem(fingerprint);if(upload_id){const status=await api(`/upload/${upload_id}/status`);if(status.status==='ready'){onProgress(1);return upload_id;}
  if(status.status!=='uploading')throw Error('Expirado');({chunk_bytes,total_chunks}=status);received=status.received;}}
 catch{upload_id=null;}
 if(!upload_id){const created=await api('/upload/start',{method:'POST',data:{filename:file.name,mime:file.type,size:file.size}});
  ({upload_id,chunk_bytes,total_chunks}=created);try{localStorage.setItem(fingerprint,upload_id)}catch{}}
 const present=new Set(received);
 for(let i=0;i<total_chunks;i++){
  if(!present.has(i)){const slice=file.slice(i*chunk_bytes,Math.min(file.size,(i+1)*chunk_bytes));
   await api(`/upload/${upload_id}/chunk/${i}`,{method:'POST',body:await slice.arrayBuffer()});}
  onProgress((i+1)/total_chunks);
 }
 const completed=await api(`/upload/${upload_id}/finish`,{method:'POST',data:{}});return completed.media_id;
}
function fileList(files){$('#file-list').innerHTML=[...files].map(f=>`<div class="file-entry"><span>▣ ${E(f.name)}</span><small>${(f.size/1024/1024).toFixed(1)} MB</small></div>`).join('');}
async function submitPost(event){event.preventDefault();return requireLogin(async()=>{
 const input=$('#post-files');const files=[...input.files];if(!files.length)throw new Error('Selecione pelo menos um arquivo.');
 if(files.some(f=>f.type.startsWith('video/'))&&files.length!==1)throw new Error('Selecione somente um vídeo por publicação.');
 if(files.length>10)throw new Error('O máximo é de 10 fotos.');
 const btn=$('#publish-btn');btn.disabled=true;$('#upload-progress').hidden=false;
 try{let done=0;const ids=[];for(const f of files){const id=await uploadFile(f,part=>{
  const percent=Math.round((done+part)/files.length*100);$('#progress-bar').style.width=percent+'%';$('#progress-label').textContent=`Enviando ${f.name} · ${percent}%`;});ids.push(id);done++;}
  await api('/posts',{method:'POST',data:{media_ids:ids,caption:$('#post-caption').value,visibility:$('#post-visibility').value,allow_comments:$('#allow-comments').checked}});
  toast('Publicação criada com sucesso!');go('feed');}finally{btn.disabled=false;}
 });}
async function renderProfile(name){if(!name){setTimeout(openAuth,50);return shell('Meu perfil','Entre para acessar suas publicações.',empty('◍','Vamos criar seu perfil','Entre ou cadastre-se na ZUNA.'));}
 const r=await api('/users/'+encodeURIComponent(name)),u=r.user;S.currentProfile=u;const mine=S.user?.id===u.id;
 const stats=r.counts||{};return shell('Perfil',`@${u.username}`,`<section class="profile-banner"><div class="profile-top">${avatar(u)}<div><h1>${E(u.display_name)} ${verified(u)}</h1><p class="subtle" style="margin:3px 0">@${E(u.username)} ${u.private?'· 🔒 privado':''}</p></div></div>
 <div class="stats"><div><b>${compact(stats.followers)}</b><span>Seguidores</span></div><div><b>${compact(stats.following)}</b><span>Seguindo</span></div><div><b>${compact(stats.posts)}</b><span>Publicações</span></div></div>
 <p style="white-space:pre-line;font-size:13px">${E(u.bio||'Nenhuma biografia ainda.')}</p>
 <div class="row wrap">${mine?`<button class="primary compact" data-action="edit-profile">Editar perfil</button><button class="secondary compact" data-action="sessions">Segurança</button><button class="ghost compact" data-action="export-data">Exportar dados</button><button class="ghost compact" data-action="blocked-list">Bloqueados</button><button class="ghost compact" data-action="logout">Sair</button>`:`<button class="primary compact" data-action="follow" data-username="${E(u.username)}">${r.following?'Deixar de seguir':u.private?'🔒 Conta privada':'+ Seguir'}</button><button class="secondary compact" data-action="start-chat" data-username="${E(u.username)}">Mensagem</button><button class="ghost compact" data-action="block-user" data-username="${E(u.username)}">Bloquear</button>`}</div>
 </section>${r.private_content?empty('🔒','Conta privada','As publicações estão disponíveis apenas para quem tem acesso.'):r.posts.length?`<h2 style="font-size:18px">Publicações</h2><div class="grid-posts">${r.posts.map(p=>`<button class="grid-tile" data-action="open-post" data-id="${p.id}" aria-label="Abrir publicação de @${E(p.username)}">${p.kind==='photo'?`<img src="${mediaSrc(p.media[0]?.media_id)}" loading="lazy" alt="${E(p.caption)}">`:`<video src="${mediaSrc(p.media[0]?.media_id)}#t=0.3" muted playsinline preload="metadata"></video>`}<span>${p.kind==='video'?'▶ Vídeo':'▣ Fotos'}</span></button>`).join('')}</div>`:empty('▣','Sem publicações','Nenhuma publicação visível por enquanto.')}
 ${mine&&r.promotional?`<p class="subtle">Campanha identificada: ${compact(r.promotional.promo_views)} impressões promocionais (não são visualizações orgânicas).</p>`:''}`);
}
function profileModal(){const u=S.user;showModal(`<form id="profile-form" class="form">
 <div class="field"><label>@Usuário (pode alterar a cada 30 dias)</label><input name="username" maxlength="24" value="${E(u.username)}" required></div><div class="field"><label>Nome de exibição</label><input name="display_name" maxlength="60" value="${E(u.display_name)}" required></div>
 <div class="field"><label>Biografia</label><textarea name="bio" maxlength="300">${E(u.bio)}</textarea></div>
 <label class="checkbox-row"><input type="checkbox" name="private" ${u.private?'checked':''}> Manter conta privada</label>
 <div class="field"><label>Foto de perfil (opcional)</label><input type="file" name="avatar" accept="image/jpeg,image/png,image/webp"></div>
 <button type="submit" class="primary full">Salvar alterações</button></form>`,{title:'Editar perfil'});}
async function renderSearch(){return shell('Explorar','Encontre pessoas e publicações de verdade.',`<section class="panel"><form id="search-form" class="row"><input class="search-input" id="search-q" type="search" maxlength="70" placeholder="Busque @usuários, vídeos e hashtags" aria-label="Busca"><button class="primary" type="submit">Buscar</button></form></section><div id="search-results">${empty('⌕','A próxima descoberta começa aqui','Digite um nome ou assunto para pesquisar.')}</div>`);}
async function searchNow(q){const r=await api('/search?q='+encodeURIComponent(q));$('#search-results').innerHTML=`<h2>Pessoas</h2>${r.users.length?r.users.map(u=>`<div class="list-card">${avatar(u)}<div class="detail"><strong>@${E(u.username)} ${verified(u)}</strong><small>${E(u.display_name)}</small></div><button class="secondary compact" data-action="view-profile" data-username="${E(u.username)}">Ver perfil</button></div>`).join(''):'<p class="subtle">Nenhuma pessoa encontrada.</p>'}<h2>Publicações</h2><div class="feed-wrap">${r.posts.length?r.posts.map(postHTML).join(''):'<p class="subtle">Nenhuma publicação encontrada.</p>'}</div>`;setUpVideos();}
async function renderInbox(){if(!S.user){setTimeout(openAuth,50);return shell('Mensagens','Entre para conversar.');}const {items}=await api('/inbox');return shell('Mensagens','As conversas são permitidas entre pessoas que se seguem mutuamente.',items.length?items.map(x=>`<button class="list-card" style="width:100%;text-align:left;color:inherit" data-action="start-chat" data-username="${E(x.username)}">${avatar(x)}<span class="detail"><strong>@${E(x.username)}</strong><small>${E(x.body)}</small></span><span>›</span></button>`).join(''):empty('▤','Sua caixa está tranquila','Siga alguém, receba o follow de volta e abra uma conversa pelo perfil.'));}
async function renderChat(name){if(!S.user){setTimeout(openAuth,50);return shell('Mensagens','Entre para conversar.');}const r=await api('/messages/'+encodeURIComponent(name));S.chat=name;let flame='';try{const f=await api('/streak/'+encodeURIComponent(name));flame=`<div class="row wrap" style="margin-bottom:12px"><span>🔥 ${f.active?`${f.days} dias de sequência`:'Conversem em dias consecutivos para acender o foguinho'}</span>${f.can_restore?`<button class="secondary compact" data-action="restore-flame" data-username="${E(name)}">Restaurar 🔥 (${f.monthly_restores_left}/mês)</button>`:''}${f.active?`<button class="secondary compact" data-action="flame-story" data-username="${E(name)}" data-days="${f.days}">Compartilhar no Story</button>`:''}</div>`;}catch{}
 return shell('Conversa',`@${name}`,`${flame}<div class="chat" id="chat-list">${r.items.length?r.items.map(x=>`<div class="bubble ${x.sender_id===S.user.id?'mine':''}">${E(x.body)}<time>${new Date(x.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time></div>`).join(''):'<p class="subtle">Comece uma conversa.</p>'}</div><form class="chat-send" id="chat-form"><input name="body" maxlength="1000" autocomplete="off" aria-label="Sua mensagem" placeholder="Escreva uma mensagem..." required><button class="primary">Enviar</button></form>`,`<button class="ghost compact" data-nav="inbox">Voltar</button>`);
}
async function renderStories(){let r=await api('/stories');S.stories=r.items;return shell('Stories','Fotos, vídeos e foguinhos que desaparecem após 24 horas.',`${S.user?`<section class="panel"><h2>Publicar Story</h2><form id="story-form" class="form"><div class="field"><label>Escolher foto ou vídeo</label><input type="file" name="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" required></div><div class="field"><label>Legenda</label><input name="caption" maxlength="160" placeholder="O que está acontecendo?"></div><button class="primary" type="submit">＋ Publicar Story</button></form></section>`:''}${r.items.length?`<div class="story-strip">${r.items.map(s=>`<button class="story-btn" data-action="open-story" data-id="${s.id}">${avatar(s)}${E(s.username)}</button>`).join('')}</div>`:empty('◉','Nenhum Story agora','Publique um Story para começar.')}`);}
function showStory(id){let s=S.stories?.find(x=>x.id===id);if(!s){toast('Story indisponível.');return;}
 showModal(`<div class="row" style="margin-bottom:12px">${avatar(s)}<strong>@${E(s.username)}</strong><small>${fmtDate(s.created_at)}</small></div><div class="post-media" style="max-height:65dvh">${s.kind==='video'?`<video src="${mediaSrc(s.media_id)}" controls playsinline autoplay style="width:100%;height:100%;object-fit:contain"></video>`:`<img src="${mediaSrc(s.media_id)}" alt="Story de @${E(s.username)}" style="width:100%;height:100%;object-fit:contain">`}</div><p>${E(s.caption)}</p>`,{title:'Story'});
}
async function renderPlaylists(){if(!S.user){setTimeout(openAuth,40);return shell('Playlists','Entre para criar sua biblioteca.');}
 const r=await api('/playlists');return shell('Playlists','Organize suas publicações favoritas em coleções.',`<section class="panel"><form id="playlist-form" class="row wrap"><input class="search-input" style="flex:1;min-width:170px" name="name" maxlength="70" placeholder="Nome da nova playlist" required><label class="checkbox-row"><input name="public" type="checkbox"> Pública</label><button class="primary">Criar</button></form></section>${r.items.length?r.items.map(p=>`<div class="list-card"><div class="detail"><strong>${E(p.name)}</strong><small>${p.item_count} publicações · ${p.private?'Privada':'Pública'}</small><small>Identificador: ${E(p.id)}</small></div><button class="secondary compact" data-action="open-playlist" data-id="${p.id}">Abrir</button><button class="danger compact" data-action="delete-playlist" data-id="${p.id}">×</button></div>`).join(''):empty('▥','Sem playlists ainda','Crie uma playlist para organizar os vídeos e fotos que gostar.')}`);
}
async function renderPlaylist(id){const r=await api('/playlists/'+encodeURIComponent(id));S.posts=r.posts;return shell(r.playlist.name,r.playlist.private?'Playlist privada':'Playlist pública',r.posts.length?`<div class="feed-wrap">${r.posts.map(postHTML).join('')}</div>`:empty('▥','Playlist vazia','Adicione uma publicação com o botão de playlist no feed.'),`<button class="ghost compact" data-nav="playlists">Voltar</button>`);}
async function renderCreator(){if(!S.user){setTimeout(openAuth,40);return shell('Criador','Entre para ver suas estatísticas.');}const r=await api('/creator/analytics');return shell('Painel do criador','Estatísticas orgânicas calculadas no banco, sem números simulados.',`<div class="panel"><div class="stats" style="flex-wrap:wrap;gap:28px"><div><b>${compact(r.totals.posts)}</b><span>Publicações</span></div><div><b>${compact(r.totals.followers)}</b><span>Seguidores</span></div><div><b>${compact(r.totals.likes)}</b><span>Curtidas reais</span></div><div><b>${compact(r.totals.comments)}</b><span>Comentários</span></div></div><p class="subtle">Não há contador de visualizações nesta edição. A ZUNA não inventa reproduções.</p></div>`);}
async function renderNotifications(){if(!S.user){setTimeout(openAuth,50);return shell('Atividade','Entre para acompanhar.');}const {items}=await api('/notifications');return shell('Atividade','Curtidas, seguidores, comentários e mensagens.',items.length?items.map(n=>`<div class="list-card"><span style="font-size:27px">${{like:'♥',follow:'＋',comment:'♧',message:'▤'}[n.type]||'◉'}</span><div class="detail"><strong>${E(n.body)}</strong><small>${fmtDate(n.created_at)}</small></div>${n.post_id?`<button class="secondary compact" data-action="open-post" data-id="${n.post_id}">Abrir</button>`:''}</div>`).join(''):empty('♧','Tudo tranquilo','Suas notificações aparecerão aqui.'),`<button class="ghost compact" data-action="mark-read">Marcar lidas</button>`);}
async function renderAdmin(){if(!S.admin)return shell('Administração','Acesso restrito.',empty('🔒','Sem acesso','Esta área é exclusiva da equipe.'));
 const health=await api('/admin/health');return shell('Administração','Ferramentas protegidas por permissão verificada no banco.',`<section class="panel"><h2>Saúde do projeto</h2><div class="stats"><div><b>${health.counts.users}</b><span>Contas</span></div><div><b>${health.counts.posts}</b><span>Publicações</span></div><div><b>${health.counts.media}</b><span>Arquivos</span></div></div><p class="subtle">Netlify Database: ${E(health.database)} · V${E(health.version)}</p></section>
 <section class="panel"><h2>Selo verificado</h2><form class="form" id="verify-form"><div class="field"><label>Usuário</label><input name="username" required placeholder="usuario"></div><div class="field"><label>Ação</label><select name="verified"><option value="true">Conceder selo</option><option value="false">Remover selo</option></select></div><button class="primary">Aplicar com auditoria</button></form></section>
 <section class="panel"><h2>Indicadores promocionais</h2><p class="subtle">Estes valores ficam sempre separados dos números orgânicos.</p><form class="form" id="promo-form"><div class="field"><label>Usuário</label><input name="username" required></div><div class="field"><label>Impressões de campanha</label><input name="promo_views" type="number" min="0" max="1000000000" value="0"></div><div class="field"><label>Curtidas de campanha</label><input name="promo_likes" type="number" min="0" max="1000000000" value="0"></div><div class="field"><label>Seguidores de campanha</label><input name="promo_followers" type="number" min="0" max="1000000000" value="0"></div><button class="secondary">Registrar campanha</button></form></section><section class="panel"><h2>Denúncias</h2><div id="admin-reports">Carregando...</div></section>`);
}
function openAuth(mode='login'){S.mode=mode==='register'?'register':'login';const common=S.mode==='register'?`<div class="field"><label for="signup-display">Nome de exibição (opcional)</label><input id="signup-display" name="display_name" maxlength="60" placeholder="Como quer ser chamado?" autocomplete="nickname"></div>`:'';
 let body=`<div class="pill-tabs"><button type="button" class="pill ${mode==='login'?'active':''}" data-action="auth-mode" data-mode="login">Entrar</button><button type="button" class="pill ${mode==='register'?'active':''}" data-action="auth-mode" data-mode="register">Criar conta</button></div><form id="auth-form" class="form">${common}<div class="field"><label for="auth-username">@Usuário</label><input id="auth-username" name="username" minlength="3" maxlength="24" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username" required placeholder="ex.: minha_conta"></div><div class="field"><label for="auth-password">Senha ${mode==='register'?'(mínimo 10 caracteres)':''}</label><input id="auth-password" name="password" type="password" autocomplete="${mode==='register'?'new-password':'current-password'}" required ${mode==='register'?'minlength="10"':''}></div>${mode==='register'?`<label class="checkbox-row"><input type="checkbox" name="adult" required> Confirmo que tenho 18 anos ou mais. A V21 é um piloto privado para adultos enquanto a segurança para menores é avaliada.</label>`:''}<button type="submit" class="primary full">${mode==='register'?'Criar minha conta':'Entrar na ZUNA'}</button></form><p class="subtle" style="margin-top:17px">Sem e-mail nem telefone para acessar. Guarde o código de recuperação fornecido no cadastro.</p>${mode==='login'?`<button class="text-link" data-action="open-recover">Esqueceu a senha?</button>`:''}`;
 showModal(body,{title:mode==='register'?'Criar sua ZUNA':'Bem-vindo à ZUNA'});}
function recoveryModal(){showModal(`<p class="subtle">Você precisa do seu @usuário e do código de recuperação guardado quando criou sua conta.</p><form class="form" id="recover-form"><div class="field"><label>Usuário</label><input name="username" required></div><div class="field"><label>Código de recuperação</label><input name="code" required></div><div class="field"><label>Nova senha</label><input type="password" minlength="10" name="new_password" required></div><button class="primary full">Redefinir senha</button></form>`,{title:'Recuperar acesso'});}
function showRecovery(code){showModal(`<p class="notice"><b>ATENÇÃO:</b> copie e guarde este código fora da ZUNA. Sem a senha e sem o código, você pode perder sua conta. Ao recuperar o acesso, este código será invalidado.</p><p class="code-display" id="recovery-code">${E(code)}</p><button class="secondary full" data-action="copy-recovery">Copiar código</button><label class="checkbox-row" style="margin:20px 0"><input type="checkbox" id="saved-code"> Salvei meu código em um lugar seguro.</label><button class="primary full" data-action="finish-recovery">Concluir cadastro</button>`,{title:'Seu código de recuperação'});}
async function init(){
 buttons();$('#content').innerHTML=loading('Verificando conexão com a ZUNA...');
 try{await api('/ready');}catch(e){
  $('#content').innerHTML=shell('A ZUNA precisa concluir a configuração','A interface está no ar, mas a API ou o banco da Netlify ainda não responderam.',`<section class="panel service-alert"><h2>Conexão com o banco indisponível</h2><p>${E(e.message)}</p><p class="subtle">Verifique na Netlify em Data &amp; Storage → Database se o banco está ativo e se a migração do projeto foi aplicada. Em seguida, abra <code>/api/ready</code> no seu domínio para conferir.</p><button class="primary" data-action="retry-start">Tentar novamente</button></section>`);
  return;
 }
 try{const r=await api('/me');S.user=r.user;S.admin=!!r.admin;}
 catch(e){console.warn('ZUNA sessão:',e.message);S.user=null;S.admin=false;}
 buttons();const route=new URLSearchParams(location.search);if(route.has('post'))go('post',route.get('post'));else go('feed');
}
async function loadReports(){if(!S.admin||S.page!=='admin')return;try{const r=await api('/admin/reports');const el=$('#admin-reports');if(el)el.innerHTML=r.items.length?r.items.map(x=>`<div class="list-card"><div class="detail"><strong>${E(x.target_type)} · ${E(x.status)}</strong><small>${E(x.reason)}</small></div><button class="secondary compact" data-action="review-report" data-id="${x.id}">Revisar</button></div>`).join(''):'<p class="subtle">Sem denúncias pendentes.</p>';}catch(e){toast(e.message);}}
async function showComments(id){const r=await api('/posts/'+id+'/comments');showModal(`<div class="file-list" style="max-height:42dvh;overflow:auto;margin-bottom:15px">${r.items.length?r.items.map(c=>`<div class="list-card" style="align-items:flex-start"><div class="detail"><strong>@${E(c.username)} ${verified(c)}</strong><p style="color:#e7e7e7;white-space:pre-line">${E(c.body)}</p><small>${fmtDate(c.created_at)}</small></div></div>`).join(''):'<p class="subtle">Seja a primeira pessoa a comentar!</p>'}</div>${S.user?`<form id="comment-form" data-post-id="${id}" class="chat-send"><input name="body" maxlength="500" required placeholder="Escreva seu comentário" aria-label="Novo comentário"><button class="primary">Enviar</button></form>`:`<button class="primary full" data-action="open-login">Entre para comentar</button>`}`,{title:'Comentários'});}
async function flameStory(name,days){const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1280;const ctx=canvas.getContext('2d');const g=ctx.createLinearGradient(0,0,720,1280);g.addColorStop(0,'#302219');g.addColorStop(1,'#111317');ctx.fillStyle=g;ctx.fillRect(0,0,720,1280);ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 70px sans-serif';ctx.fillText('ZUNA 🔥',360,240);ctx.font='220px sans-serif';ctx.fillText('🔥',360,600);ctx.fillStyle='#c8fa6b';ctx.font='bold 75px sans-serif';ctx.fillText(`${days} DIAS`,360,790);ctx.fillStyle='#eee';ctx.font='39px sans-serif';ctx.fillText(`Minha sequência com @${name}`,360,905);ctx.fillStyle='#b4b6b2';ctx.font='25px sans-serif';ctx.fillText('Um dia de cada vez · ZUNA',360,1120);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Não foi possível gerar a arte.');
 const file=new File([blob],'sequencia-zuna.png',{type:'image/png'});toast('Preparando Story da sequência...');const mediaId=await uploadFile(file);await api('/stories',{method:'POST',data:{media_id:mediaId,caption:`🔥 ${days} dias de sequência com @${name}`}});toast('Foguinho publicado no Story!');}
async function handleClick(event){
 const nav=event.target.closest('[data-nav]');if(nav){event.preventDefault();return go(nav.dataset.nav);}
 const el=event.target.closest('[data-action]');if(!el)return;
 const {action,id,username:name,mode,value,days}=el.dataset;
 switch(action){
 case 'close-modal':closeModal();break;
 case 'view-profile':return go('profile',name);
 case 'open-post':return go('post',id);
 case 'open-login':return openAuth('login');
 case 'open-register':return openAuth('register');
 case 'retry-start':return init();
 case 'auth-mode':return openAuth(mode);
 case 'open-recover':return recoveryModal();
 case 'copy-recovery':await navigator.clipboard.writeText($('#recovery-code').textContent);toast('Código copiado!');break;
 case 'finish-recovery':if(!$('#saved-code').checked)throw new Error('Confirme que guardou o código.');closeModal();return go('feed');
 case 'feed-tab':S.feedTab=value;return go('feed');
 case 'edit-profile':return requireLogin(profileModal);
 case 'blocked-list':{const r=await api('/me/blocked');showModal(r.items.length?r.items.map(u=>`<div class="list-card"><div class="detail"><strong>@${E(u.username)}</strong><small>${E(u.display_name)}</small></div><button class="secondary compact" data-action="block-user" data-username="${E(u.username)}">Desbloquear</button></div>`).join(''):'<p class="subtle">Você não bloqueou ninguém.</p>',{title:'Contas bloqueadas'});break;}
 case 'export-data':{const r=await api('/me/export');const blob=new Blob([JSON.stringify(r,null,2)],{type:'application/json'});const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download='zuna-meus-dados.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Exportação dos dados gerada.');break;}
 case 'block-user':if(!confirm('Deseja bloquear ou desbloquear @'+name+'?'))return;await api('/users/'+encodeURIComponent(name)+'/block',{method:'POST',data:{}});toast('Bloqueio atualizado.');return go('feed');
 case 'follow':return requireLogin(async()=>{const r=await api('/users/'+encodeURIComponent(name)+'/follow',{method:'POST',data:{}});toast(r.following?'Seguindo!':'Deixou de seguir.');go('profile',name);});
 case 'start-chat':return go('chat',name);
 case 'mark-read':await api('/notifications/read',{method:'POST',data:{}});toast('Notificações marcadas como lidas.');return go('notifications');
 case 'sessions':{
  const r=await api('/me/sessions');showModal(`<p class="subtle">${r.sessions.length} sessão(ões) ativas registradas.</p><form id="revoke-form" class="form"><div class="field"><label>Sua senha</label><input name="password" type="password" required></div><button class="danger">Encerrar outras sessões</button></form>`,{title:'Segurança da conta'});break;
 }
 case 'logout':await api('/logout',{method:'POST',data:{}});S.user=null;S.admin=false;toast('Você saiu da conta.');return go('feed');
 case 'like':case 'favorite':case 'repost':return requireLogin(async()=>{const r=await api(`/posts/${id}/${action}`,{method:'POST',data:{}});let post=S.posts.find(p=>p.id===id);if(post){if(action==='like'){post.likes+=r.active?1:-1;post.liked=r.active;}if(action==='favorite')post.favorited=r.active;}const card=document.querySelector(`[data-post-id="${id}"]`);if(card&&post){card.outerHTML=postHTML(post);setUpVideos();}toast(action==='repost'?'Republicação atualizada.':action==='favorite'?'Favoritos atualizados.':'Curtida atualizada.');});
 case 'comments':return showComments(id);
 case 'photo-next':case 'photo-prev':{
  const p=S.posts.find(x=>x.id===id);if(!p)return;const n=p.media?.length||0;if(!n)return;S.photoIndex[id]=((S.photoIndex[id]||0)+(action==='photo-next'?1:-1)+n)%n;const card=document.querySelector(`[data-post-id="${id}"]`);if(card)card.outerHTML=postHTML(p);break;}
 case 'post-menu':{const p=S.posts.find(x=>x.id===id);if(p?.user_id===S.user?.id){
  showModal(`<p>Deseja excluir esta publicação?</p><button class="danger full" data-action="delete-post" data-id="${id}">Excluir minha publicação</button>`,{title:'Opções da publicação'});
 }else if(requireLogin()){showModal(`<form id="report-form" class="form" data-post-id="${id}"><div class="field"><label>Motivo da denúncia</label><textarea name="reason" minlength="8" maxlength="200" required placeholder="Explique a situação para a equipe de moderação"></textarea></div><button class="danger full">Enviar denúncia</button></form>`,{title:'Denunciar publicação'});}break;}
 case 'delete-post':await api('/posts/'+id,{method:'DELETE'});closeModal();toast('Publicação excluída.');return go('feed');
 case 'save-playlist':{return requireLogin(async()=>{
 const r=await api('/playlists');if(!r.items.length){toast('Crie uma playlist primeiro.');return go('playlists');}
 showModal(`<p class="subtle">Escolha onde deseja guardar esta publicação.</p>${r.items.map(pl=>`<button class="list-card" style="width:100%;text-align:left;color:inherit" data-action="assign-playlist" data-id="${pl.id}" data-post-id="${id}"><span>▥</span><span class="detail"><strong>${E(pl.name)}</strong><small>${pl.private?'Privada':'Pública'}</small></span><span>＋</span></button>`).join('')}`,{title:'Adicionar à playlist'});
 });}
 case 'assign-playlist':await api('/playlists/'+encodeURIComponent(id)+'/add',{method:'POST',data:{post_id:el.dataset.postId}});closeModal();toast('Adicionado à playlist.');break;
 case 'open-playlist':return go('playlist',id);
 case 'delete-playlist':if(confirm('Excluir esta playlist?')){await api('/playlists/'+id,{method:'DELETE'});return go('playlists');}break;
 case 'share':{
  const url=new URL(location.origin+'/');url.searchParams.set('post',id);
  if(navigator.share){try{await navigator.share({title:'Vídeo na ZUNA',url:String(url)});return;}catch(e){if(e.name==='AbortError')return;}}
  if(navigator.clipboard){await navigator.clipboard.writeText(String(url));toast('Link copiado.');}else prompt('Copie o link:',String(url));break;}
 case 'open-story':return showStory(id);
 case 'restore-flame':await api('/streak/'+encodeURIComponent(name)+'/restore',{method:'POST',data:{}});toast('Sequência restaurada!');return go('chat',name);
 case 'flame-story':return requireLogin(()=>flameStory(name,Number(days)));
 case 'review-report':await api('/admin/report/review',{method:'POST',data:{id,status:'reviewed'}});toast('Denúncia analisada.');return loadReports();
 default:break;
 }
}
async function handleSubmit(event){const f=event.target;if(!f.id)return;event.preventDefault();
 const form=new FormData(f);const obj=Object.fromEntries(form.entries());
 switch(f.id){
 case 'auth-form':{
  const reg=S.mode==='register';const data={username:String(obj.username||'').trim().toLowerCase(),password:obj.password,...(reg?{display_name:obj.display_name,adult_confirm:obj.adult==='on'}:{})};
  const r=await api(reg?'/register':'/login',{method:'POST',data});S.user=r.user;S.admin=false;buttons();if(r.recovery_code)showRecovery(r.recovery_code);else{closeModal();go('feed');toast('Bem-vindo à ZUNA!');}break;}
 case 'recover-form':{
  const r=await api('/recover',{method:'POST',data:obj});showRecovery(r.recovery_code);toast('Senha redefinida. Entre com a nova senha.');S.user=null;S.admin=false;break;}
 case 'post-form':return submitPost(event);
 case 'profile-form':{
  const file=f.querySelector('[name="avatar"]').files[0];const avatar=file?await uploadFile(file):undefined;
  const r=await api('/me',{method:'PATCH',data:{username:obj.username,display_name:obj.display_name,bio:obj.bio,private:obj.private==='on',...(avatar?{avatar_media_id:avatar}:{})}});S.user=r.user;closeModal();toast('Perfil atualizado.');return go('profile',S.user.username);}
 case 'comment-form':await api('/posts/'+f.dataset.postId+'/comments',{method:'POST',data:{body:obj.body}});closeModal();toast('Comentário publicado.');return go(S.page,S.param);
 case 'search-form':return searchNow($('#search-q').value.trim());
 case 'chat-form':await api('/messages/'+encodeURIComponent(S.chat),{method:'POST',data:{body:obj.body}});return go('chat',S.chat);
 case 'story-form':{
  const file=f.querySelector('[name="file"]').files[0];if(!file)throw new Error('Escolha uma foto ou vídeo.');toast('Enviando Story...');const id=await uploadFile(file);await api('/stories',{method:'POST',data:{media_id:id,caption:obj.caption}});toast('Story publicado.');return go('stories');}
 case 'revoke-form':await api('/me/sessions/revoke',{method:'POST',data:{password:obj.password}});closeModal();toast('Outras sessões encerradas.');break;
 case 'report-form':await api('/report',{method:'POST',data:{target_type:'post',target_id:f.dataset.postId,reason:obj.reason}});closeModal();toast('Denúncia registrada para revisão.');break;
 case 'playlist-form':await api('/playlists',{method:'POST',data:{name:obj.name,private:obj.public!=='on'}});toast('Playlist criada.');return go('playlists');
 case 'verify-form':await api('/admin/verify',{method:'POST',data:{username:obj.username,verified:obj.verified==='true'}});toast('Selo atualizado com auditoria.');break;
 case 'promo-form':await api('/admin/promotion',{method:'POST',data:{username:obj.username,promo_views:Number(obj.promo_views),promo_likes:Number(obj.promo_likes),promo_followers:Number(obj.promo_followers)}});toast('Indicadores promocionais registrados separadamente.');break;
 default:break;
 }
}
document.addEventListener('click',ev=>Promise.resolve(handleClick(ev)).catch(e=>toast(e.message)));
document.addEventListener('submit',ev=>{if(ev.target.id)ev.preventDefault();Promise.resolve(handleSubmit(ev)).catch(e=>{toast(e.message);const b=$('#publish-btn');if(b)b.disabled=false;});});
document.addEventListener('change',ev=>{if(ev.target.id==='post-files')fileList(ev.target.files);});
document.addEventListener('dragover',ev=>{const area=ev.target.closest('#upload-drop');if(area){ev.preventDefault();area.classList.add('dragging');}});
document.addEventListener('dragleave',ev=>ev.target.closest('#upload-drop')?.classList.remove('dragging'));
document.addEventListener('drop',ev=>{const area=ev.target.closest('#upload-drop');if(!area)return;ev.preventDefault();area.classList.remove('dragging');const input=$('#post-files');try{input.files=ev.dataTransfer.files;fileList(input.files);}catch{toast('Use o seletor de arquivos do dispositivo.');}});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!$('#modal').hidden)closeModal();if((ev.key==='ArrowRight'||ev.key==='ArrowLeft')&&document.activeElement?.tagName!=='INPUT'){const card=document.querySelector('.post-card:focus-within');if(card){const id=card.dataset.postId;const b=card.querySelector(`[data-action="${ev.key==='ArrowRight'?'photo-next':'photo-prev'}"]`);if(b){ev.preventDefault();b.click();}}}});
$('#modal').addEventListener('click',ev=>{if(ev.target.id==='modal')closeModal();});
window.addEventListener('popstate',()=>{const u=new URL(location.href);if(u.searchParams.has('post'))go('post',u.searchParams.get('post'));else go('feed');});
const oldGo=go;
// Atualiza o endereço apenas quando há um link de publicação; demais abas mantêm a navegação SPA.
window.addEventListener('beforeunload',()=>S.feedObserver?.disconnect());
init();
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/sw.js').catch(()=>{});
