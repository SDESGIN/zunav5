# ZUNA V21 — matriz de funcionalidades e estado real

| Recurso | Estado do código | Validação restante |
|---|---|---|
| Página web, responsividade, formulário de criação | Implementado | Conferir em celulares reais e em um deploy de produção |
| Netlify Database nativo + migração | Implementado, requer deploy | Configurar banco/credenciamento automático na Netlify, rodar migração em Deploy Preview |
| Netlify Blobs | Implementado, requer deploy | Testar upload/reprodução, acesso e custo real |
| Cadastro usuário/senha, recuperação, logout | Implementado, integração não verificada | Testes entre duas sessões na Netlify |
| Conta privada, perfis, mudança de @, bloqueios | Implementado, integração não verificada | Testes de autorização e concorrência no banco real |
| Feed, comentários, respostas, curtidas, favoritos, republicações | Implementado, integração não verificada | Paginação/latência com contas reais |
| Foto, carrossel e Stories | Implementado, integração não verificada | Validar expiração e privacidade reais |
| Mensagens, foguinhos, restauração mensal e Story do foguinho | Implementado, integração não verificada | Testar troca entre dois usuários ao longo de dias diferentes |
| Admin: verificado, campanhas marcadas e denúncia | Implementado, integração não verificada | Criar admin manualmente e verificar trilha de auditoria |
| Vídeo de até 3 GiB com upload retomável em blocos | Implementado no código, não validado em tamanho máximo | Teste de 3 GiB, quotas, custos, falhas, navegadores |
| Reprodução MP4/WebM com Range | Implementado no código | Testar seeking, metadados, diferentes codecs e navegadores |
| 1080p/60 fps | Reprodução original quando compatível | **Não há transcodificação nem garantia de qualidade** |
| Algoritmo TikTok avançado | Não implementado | Feed usa recência e seguindo; não há ML |
| Lives reais | Não implementadas nesta arquitetura | Precisa infraestrutura própria de mídia ao vivo e moderação |
| Editor multiclipes avançado, efeitos faciais, biblioteca licenciada | Não implementados na V21 | Implementação e licenças específicas |
| Dueto/Costura com MP4 final | Não implementados na V21 | Renderização/edição local ou processamento compatível com Netlify |
| Push com app fechado | Não implementado | Implementar Web Push e credenciais VAPID/filas |
| Playlists públicas/privadas e painel do criador | Implementados, integração não verificada | Testar autorização e números reais no banco |
| Comunidades | Não implementadas nesta reconstrução | Reimplementação sobre Netlify Database |
| Dados da V20 | **Não migrados** | Projeto V21 inicializa banco novo. Exige migração planejada. |
| Proteção de menores e lançamento público | Não concluídos | Auditoria de segurança, idade, moderação, LGPD/ECA Digital e infraestrutura |

**Não existe equivalência total ao TikTok e não houve teste de produção nesta entrega.**
