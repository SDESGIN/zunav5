# Testes da ZUNA V21.1 — verificados nesta revisão

## Executados e aprovados

- **22/22 testes automatizados Node**: segurança, regras de autenticação, rotas de API com banco simulado, arquivos essenciais, migração e regressões do formulário.
- **Chromium desktop**: abrir Criar conta, preencher usuário/senha, marcar consentimento, enviar `POST /api/register` para API simulada, receber o código de recuperação, concluir cadastro e abrir a publicação. Nenhum erro de JavaScript.
- **Chromium celular**: o mesmo fluxo, com navegação mobile. Nenhum erro de JavaScript.
- **Chromium com banco indisponível (HTTP 503 simulado)**: a página apresenta erro de configuração e botão Tentar novamente.
- **Build de ZIP extraído em uma pasta limpa**: passou com 22 testes.

## Não foram executados

- Banco **real** provisionado na conta Netlify do usuário, migração aplicada durante um deploy real e acesso multiusuário.
- Netlify Blobs real, uploads de 3 GiB, streaming de vídeo e testes em navegadores/dispositivos físicos.
- Implantação pública de `zunaa.netlify.app` (o ambiente de ferramentas não conseguiu acessá-la).
- Auditoria de privacidade, moderação e proteção legal para lançamento público voltado a menores.

**Importante:** testes com banco simulado não provam que o Netlify Database foi provisionado na sua conta. Para isso, consulte `/api/ready` após o deploy.
