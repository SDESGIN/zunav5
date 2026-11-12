# Relatório de auditoria — ZUNA V21.1

## Falhas reproduzidas e corrigidas

| Falha | Causa identificada no código original | Correção | Validação |
|---|---|---|---|
| Botão Criar conta não abre cadastro | Variável `u` inexistente em `openAuth('register')` | Formulário sem referência ao objeto de perfil | Clique real no Chromium desktop + celular |
| Cadastro não coleta usuário corretamente | Dois inputs `name="username"` no mesmo form | Input único de usuário e campo opcional de nome | DOM: um `username`; POST simulado conferido |
| Avisos não aparecem como deveriam | `#toast` sem classe `.toast` usada no CSS | Classe corrigida | Teste regressivo da marcação |
| Falha do banco aparenta erro geral de tela | Frontend ignorava falha da inicialização | `GET /api/ready` + tela de diagnóstico com retry | Chromium com resposta 503 simulada |
| Health não ajudava quando DB faltava | Inicialização do Database no módulo da API | Inicialização sob demanda; `/api/health` sem DB | Teste do contrato HTTP |
| Cache antigo | PWA mantinha versão V21 de arquivos | Cache V21.1 atualizado | Teste regressivo de versão |
| README sobrescrito no build | Mapeamento duplicado para `README.md` | Cópia removida | Teste de build |

## Testes: o que eles provam

- **22 testes Node aprovados** no build.
- **Navegador Chromium**: fluxo completo de formulário/código com API simulada, em duas resoluções.
- **API**: rotas `/health`, `/ready`, `/register`, `/login`, `/recover`, `/me` e regras de segurança testadas com banco simulado.
- **Não testado**: Netlify Database real, migrações aplicadas na conta do usuário, Netlify Blobs real, upload massivo, custos, multiusuário em dispositivos diferentes ou conformidade para lançamento público.

## Se continuar sem cadastrar

1. Confirme que o deploy exibiu a versão V21.1 e que a aba Network não está carregando `app.js` antigo.
2. Abra `/api/health`: se HTML/404, a Function não está acessível.
3. Abra `/api/ready`: se 503, o banco ou as tabelas estão ausentes.
4. Na Netlify, abra Deploy logs e Functions logs, copie apenas o código do erro e a mensagem técnica, sem senhas/tokens.
5. Confirme que seu plano Netlify permite Netlify Database (requer plano de créditos).

**Não alteramos a migração SQL original:** isso evita erro de checksum em um banco que porventura já tenha aplicado a V21. Para novas instalações, a migração é recriada durante o build a partir do arquivo SQL que está na raiz do GitHub.
