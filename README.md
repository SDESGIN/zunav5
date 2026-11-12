# ZUNA V21.1 — versão corrigida, arquivos soltos para GitHub

**Esta edição corrige defeitos concretos identificados na V21.** Continua com **somente GitHub + Netlify**; não usa Supabase, Cloudflare, Firebase ou outro serviço externo para dados e vídeos. A Netlify executa o site, as Functions, o Database e os Blobs.

## Corrigido nesta edição

1. **Criar conta não abria:** a função JavaScript `openAuth('register')` referenciava a variável `u` que não existia. Removido.
2. **Cadastro duplicava `username`:** o formulário renderizava dois campos de mesmo nome. Agora existe um único campo.
3. **Botão de cadastro difícil de achar:** acrescentado botão **Criar conta** no início para visitantes, e Entrar.
4. **Mensagens de erro invisíveis:** o elemento de avisos não tinha a classe `.toast` exigida pelo CSS.
5. **API e banco falhavam silenciosamente:** acrescentado `GET /api/ready` para verificar a conexão com o banco e a existência das tabelas.
6. **A rota de saúde dependia do banco na inicialização:** o acesso ao banco passou a ser inicializado sob demanda, permitindo diagnóstico mesmo se o serviço não estiver provisionado.
7. **Service Worker antigo:** versão do cache atualizada para substituir arquivos desatualizados.
8. **Build alterava o README:** corrigida a cópia que sobrescrevia a documentação durante o build.
9. **Testes de integração de cadastro:** acrescentados testes do contrato HTTP com banco simulado e testes do código da interface.

## Enviar SEM pastas ao GitHub

1. Extraia `ZUNA_V21_CORRIGIDA_SEM_PASTAS.zip` no seu computador.
2. Entre no **mesmo repositório GitHub** que está conectado à Netlify.
3. `Add file` → `Upload files` → selecione todos os arquivos **do ZIP extraído** (sem selecionar uma pasta).
4. Grave com `Commit changes` na branch `main`.
5. O `build-flat.mjs` recria as pastas técnicas **durante o build**, não no GitHub.
6. Na Netlify, mantenha `Base directory` vazio, `Build command` **`npm run build`**, `Publish directory` **`web`**.
7. Se a alteração não aparecer, em Deploys escolha **Clear cache and deploy site** e atualize o navegador com **Ctrl+Shift+R**.

⚠️ Não envie o ZIP fechado ao GitHub. Ele precisa ser extraído antes.

## Diagnóstico imediato do deploy

Abra as URLs abaixo substituindo `SEU-SITE` pelo subdomínio real da Netlify:

- `https://SEU-SITE.netlify.app/api/health` → retorna JSON com `ok: true` e `version: "21.1"` se a Function estiver publicada.
- `https://SEU-SITE.netlify.app/api/ready` → retorna JSON com `ok: true`, `database: "ready"`, `schema: "ready"` se banco + tabelas estiverem realmente acessíveis.

Se a primeira URL retornar HTML em vez de JSON, confira redirects e Functions publicados. Se a segunda retornar `503`, entre na Netlify → **Data & Storage → Database** e confirme se o banco está ativo. A migração é gerada em `netlify/database/migrations` durante o build.

**O Netlify Database só está disponível em planos baseados em créditos e pode gerar cobrança.** Um site com HTML publicado não significa que o banco foi habilitado. Consulte a documentação atual da Netlify e a configuração do seu projeto.

## Testes executados

- `npm run build` → **22 testes automatizados aprovados** (segurança, estrutura, API com banco simulado e regressões da interface).
- Chromium isolado (desktop e celular) com API simulada → **abrir Criar conta → preencher → POST /register → receber código → concluir → navegar para Criar publicação**; ambos passaram sem erros de JS.
- Chromium simulando banco indisponível → mostra o diagnóstico e a opção Tentar novamente.
- Verificação do ZIP flat → nenhum subdiretório.

**Limitação importante:** banco real da Netlify, upload de 3 GiB, Blobs reais, streaming, comportamento multiusuário e deploy publicado **não foram testados neste ambiente**. Não é possível garantir que todo recurso esteja livre de bugs em produção. Nesta edição, a API guarda as funções da V21, mas não retoma os recursos avançados que já haviam sido removidos ao abandonar Supabase/Cloudflare na V21.

## Privacidade e idade

O cadastro da V21.1 continua restrito a contas adultas em um **piloto privado**, exigindo a confirmação de idade na interface e no backend. Isso ainda não é uma verificação documental de idade. Não disponibilize a plataforma a menores até concluir as medidas de proteção, moderação e consentimento aplicáveis. Não altere a idade informada para contornar as restrições.

## Arquivos e execução

O GitHub mantém arquivos `site__*`, `funcao__*`, `lib__*`, `banco__*` e `teste__*` **na raiz**. O script `build-flat.mjs` organiza esses arquivos na compilação. A aplicação usa Node.js 22.13+ no ambiente de build, com dependências `@netlify/database` e `@netlify/blobs`.

Para repetir os testes do pacote: `npm run build` no terminal com Node.js 22.13+.

**Não há senhas, contas administrativas padrão nem variáveis privadas reais no código.** O selo verificado deve ser atribuído a um administrador pelo painel protegido do banco, depois de criar a conta correspondente.
