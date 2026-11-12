# Verificações obrigatórias antes de qualquer lançamento público

- [ ] Validar o deploy no domínio definitivo, HTTPS, cookies e verificação de origem.
- [ ] Confirmar a aplicação da migração do Netlify Database em Deploy Preview e produção.
- [ ] Confirmar que blobs privados não podem ser abertos por outro usuário, inclusive após mudança de privacidade.
- [ ] Criar duas contas independentes, publicar, seguir, comentar, curtir, bloquear e testar negação de acesso.
- [ ] Simular tentativa de criar duas contas com o mesmo @usuário ao mesmo tempo.
- [ ] Recuperar conta, confirmar revogação de sessões e invalidação do código usado.
- [ ] Testar uploads de 2 MiB, 50 MiB e arquivos grandes; interromper, retomar, cancelar e verificar limpeza de dados abandonados.
- [ ] Testar reprodução/seek de vídeos MP4 e WebM no Chrome, Safari e Firefox no desktop e em celulares.
- [ ] Testar o limite pretendido de 3 GiB se houver créditos e orçamento para o tráfego.
- [ ] Fazer testes de carga reais, medir custos de Functions, Database e Blobs.
- [ ] Configurar monitoramento e restauração de backup em Netlify Database e Blobs, e testar restauração.
- [ ] Revisar segurança do código, armazenamento de credenciais, arquivos maliciosos, abuso de cadastro e denúncias.
- [ ] Implementar salvaguardas de idade, privacidade, mensagens e moderação específicas para menores antes de qualquer abertura a esse público.
- [ ] Verificar obrigações legais, autorais, LGPD e ECA Digital.
- [ ] Fazer teste de acessibilidade completo com teclado, leitores de tela e contraste.
- [ ] Documentar custos e comportamento em caso de estouro de créditos.
- [ ] Definir um procedimento de migração se houver dados reais na V20.
