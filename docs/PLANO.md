# Plano de implementação — Lista Natalina

## Escopo e estado inicial

Aplicação web mobile-first para listas pessoais, grupos convencionais e amigo secreto, com Next.js App Router, TypeScript e MongoDB no mesmo projeto, compatível com Vercel. Prioridades: autorização no servidor, privacidade das reservas e atribuições, TDD e simplicidade.

Inspeção em 05/11/2026: somente README.md e commit inicial `b54cb55`; `.env` local com `DATABASE_URL`, sem aplicação, dependências ou regras AGENTS.md encontradas nos diretórios ancestrais. Preservar o `.env`; nunca registrar valores ou documentos reais nos logs. Não executar seeds ou alterações no banco existente nesta etapa.

A Fase 1 foi autorizada pelo pedido atual. As fases seguintes serão iniciadas em novas etapas com o usuário. Decisões abaixo identificadas como propostas precisam ser confirmadas antes da implementação da funcionalidade correspondente.

## Arquitetura

- `src/app`: rotas, layouts, estados de carregamento/erro e adaptadores HTTP/Server Actions. Server Components por padrão; Client Components apenas para interatividade.
- `src/modules/{auth,users,gifts,groups,reservations,secret-santa}`: validação, serviços/casos de uso, repositórios MongoDB e DTOs por funcionalidade. Criar arquivos conforme os casos reais, sem classes vazias ou repositório genérico.
- `src/lib/env`: leitura e validação lazy das variáveis privadas; build não depende de banco disponível.
- `src/lib/db`: conexão reutilizável e protegida com `server-only`; pool pequeno por instância Node.js, reconexão após falha inicial.
- `src/components`: componentes de apresentação compartilhados, adicionados conforme necessário.
- `scripts`: diagnóstico explícito; nenhum acesso automático ao banco durante build.
- Testes próximos ao código. Serviços recebem dependências quando isso permite isolar regras; integração verifica operações reais do MongoDB em banco exclusivo de testes.

Fluxo: componente/endpoint → identidade autenticada → validação → serviço/autorização → repositório → DTO explícito. Nunca confiar em `userId` enviado pelo cliente para identificar o autor. Não serializar documentos completos, senhas, sessões ou resultados de terceiros.

Operações privadas não terão cache compartilhado. Server Actions validam identidade e entrada em toda chamada, com revalidação somente após sucesso. Route Handlers atendem autenticação e endpoints necessários, evitando uma API REST paralela sem consumidor. Middleware/proxy poderá ajudar no redirecionamento, mas nunca será a única autorização. Usar runtime Node.js, sem Edge para MongoDB.

## Bibliotecas e decisões técnicas

| Área | Escolha | Motivo / alternativa |
| --- | --- | --- |
| Framework | Next.js + React + TypeScript estrito | App Router e aplicação única; versões resolvidas no package-lock.json |
| Banco | Driver oficial `mongodb` | Pool, índices e transações explícitos; Mongoose adicionaria ODM e duplicação de schemas sem benefício imediato |
| Validação | Zod | Schemas reutilizáveis; erros públicos sanitizados |
| Autenticação (Fase 2) | Better Auth, adapter MongoDB | Email/senha, sessões persistidas e hash seguro mantidos pela biblioteca; confirmar versão e integração no início da fase |
| Testes | Vitest; integração MongoDB isolada | Unidade rápida e verificação de índices/transações reais; adicionar Testing Library e Playwright nas fases com formulários e fluxos completos |
| Interface | CSS e HTML semânticos inicialmente | Sem kit pesado para tela inicial; Radix/shadcn apenas para diálogos e componentes que precisem de comportamento acessível |
| Formulários | Formulários nativos + Server Actions + Zod | Evita biblioteca adicional no início; React Hook Form somente se a complexidade justificar |
| Estado | Estado local React e servidor | Sem Redux/Zustand/TanStack Query até existir necessidade concreta |

Better Auth será configurado na Fase 2 com senha forte (proposta: 12–128 caracteres), hashing da biblioteca (scrypt conforme configuração/documentação da versão), cookies HttpOnly/Secure em produção/SameSite, expiração e revogação de sessões. Não implementar criptografia ou sessões caseiras. Validar origem/CSRF, limitar tentativas com mecanismo persistido adequado a múltiplas instâncias e responder a login inválido sem revelar existência de conta. Definir necessidade de verificação de email/recuperação antes de publicar cadastro público. Não instalar provedor de email nesta fase.

## Modelagem MongoDB proposta

Identificadores de domínio serializados como strings; BSON ObjectId no domínio quando adequado, respeitando o formato de IDs do adapter de autenticação. Datas BSON UTC; DTOs com ISO 8601. A Fase 2 consolida nomes e índices do adapter antes de criar coleções. Referências evitam duplicação e arrays ilimitados.

| Coleção | Campos essenciais | Índices e finalidade |
| --- | --- | --- |
| `user` | id, name, email normalizado, emailVerified, image opcional, createdAt, updatedAt | email único; nome normalizado para busca por prefixo |
| `account` | id, userId, providerId, accountId, password hash | índices exigidos pelo adapter; credenciais nunca em DTO público |
| `session` | id, userId, token, expiresAt, createdAt, updatedAt | token único, userId; TTL expiresAt; validar expiração também na aplicação |
| `verification` | campos do adapter para verificação/recuperação | índices e TTL conforme versão; nenhuma exposição pública |
| `gifts` | _id, ownerId, name, description, productUrl, imageUrl, createdAt, updatedAt | ownerId + createdAt + _id para paginação sem limite total de presentes |
| `groups` | _id, name, description?, type, adminId, membershipVersion, activeDrawId?, createdAt, updatedAt | adminId; versão para serializar alterações de membros/sorteios |
| `memberships` | _id, groupId, userId, joinedAt | único (groupId,userId); (userId,groupId) para dashboard e compartilhamento |
| `reservations` | _id, giftId, reservedBy, createdAt | giftId único (somente reservas ativas); reservedBy para consultas e limpeza |
| `draws` | _id, groupId, membershipVersion, status, createdBy, createdAt | groupId + createdAt; registro da versão dos membros e do sorteio invalidado |
| `assignments` | _id, drawId, giverId, recipientId | únicos (drawId,giverId) e (drawId,recipientId); leitura somente pelo par drawId + usuário da sessão |

Participações ficam em coleção própria para busca bidirecional e unicidade sem crescer o documento do grupo. Reservas são separadas para não vazar estado junto do presente ao proprietário. Atribuições são referências separadas: nenhuma rota retorna o conjunto; administrador recebe somente metadados. Não há endpoint para ler atribuição passando um giverId arbitrário. Dados pequenos de valor podem ser incorporados; não copiar listas pessoais para os grupos. IDs de grupos convencionais não aceitam sorteio.

### Integridade, concorrência e privacidade

MongoDB não tem FKs: serviços verificam referências e usam transações para mudanças relacionadas. Requer replica set/Atlas com suporte a transações. Não iniciar sorteios em standalone sem oferecer erro de configuração claro.

- Criar grupo e primeira participação na mesma transação.
- Reserva: verificar acesso e dono, inserir com índice único giftId e tratar conflito como indisponível; não usar apenas sequência consultar→inserir. Concorrer reserva com saída/exclusão exige transação e escrita de versão no recurso de autorização compartilhado, evitando write skew. Testar explicitamente esses interleavings na Fase 5.
- Cancelar reserva filtrando giftId e reservedBy autenticado; somente o reservante cancela. Excluir presente e reserva juntos.
- DTO do proprietário omite inclusive campo de disponibilidade. DTO de terceiro autorizado mostra apenas disponível/reservado e `canCancel` calculado, sem identidade do reservante.
- Sorteio: ler snapshot de membros, exigir pelo menos três (proposta), embaralhar com aleatoriedade criptográfica no servidor e gerar permutação sem pontos fixos; testar invariantes. Não usar Math.random. Não prometer distribuição uniforme se o algoritmo escolhido não a oferecer.
- Gravar draw + assignments e atualizar activeDrawId com comparação de membershipVersion numa transação. Mutação de membros também escreve a versão do grupo. Conflitos abortam/repetem com limite; erro de concorrência é tratado na interface.
- Novo sorteio invalida anterior atomicamente; consultar apenas activeDrawId válido e atribuição do usuário autenticado. Nenhuma atribuição em logs, HTML de outros usuários, payloads coletivos ou cache compartilhado.
- Busca de usuários por prefixo, paginada, com limites por requisição e projeção mínima (id e nome). Email não é campo público nem parte da busca. Perfis e listas completos apenas de si ou de quem compartilha grupo.

## Decisões de negócio pendentes (propostas)

Aprovar antes das respectivas fases; estas regras ainda não estão implementadas.

1. **Saída do administrador:** transferir administração para membro existente antes de sair; se for o único membro, permitir excluir o grupo com confirmação. Nenhuma transferência automática silenciosa.
2. **Participantes após sorteio:** adição, remoção ou saída invalidam imediatamente o sorteio inteiro e avisam o grupo; administrador precisa sortear novamente. Transação impede resultado parcialmente válido.
3. **Reservas e novo sorteio:** reservas são globais por presente, não por grupo ou sorteio, e permanecem após novo sorteio. Sorteio não implica compra nem reserva automática.
4. **Perda de acesso:** saída/remoção cancela reservas do usuário em listas às quais ele perde o último grupo compartilhado. Reservas persistem quando outro grupo ainda autoriza acesso. Limpeza acontece no servidor junto da alteração, sem revelar nada ao dono.
5. **Sorteio mínimo:** três pessoas. Duas tecnicamente funcionam, mas deixam os resultados dedutíveis; confirmar preferência.
6. **Administração:** administrador pode remover outro participante, editar grupo e transferir administração; excluir grupo exige confirmação e remove participações/sorteios, preservando usuários e presentes pessoais. Operações de exclusão precisam ter estratégia transacional compatível com o volume; sem limite arbitrário de presentes.
7. **Perfil e busca:** diretório restrito a autenticados, exibindo somente id/nome; perfil detalhado restrito a grupos compartilhados. Sem listagem pública de emails.
8. **Conta:** sem exclusão de conta na primeira versão, até definir retenção/remoção em grupos e atribuições. Nome editável e recuperação/verificação de email precisam de confirmação de escopo.
9. **URLs:** aceitar apenas HTTP/HTTPS para produtos/imagens; imagens não serão baixadas pelo servidor na primeira versão, evitando proxy aberto/SSRF. Descrição é texto simples, sem HTML arbitrário.

## Plano incremental e critérios de aceite

### Fase 1 — Estrutura e configurações (pedido atual)

- [x] Inspecionar Git, arquivos, ambiente e regras existentes.
- [x] Documentar arquitetura, coleções, escolhas, regras pendentes e plano integral.
- [ ] Criar Next.js App Router/TypeScript estrito e página inicial responsiva de apresentação da base, sem botões de funcionalidades inexistentes.
- [ ] Configurar ESLint, Vitest e scripts de validação; adicionar testes primeiro para ambiente e conexão reutilizável.
- [ ] Validar DATABASE_URL sem mostrar valores; conexão lazy server-only com pool e tratamento de falha.
- [ ] Oferecer diagnóstico read-only explícito do banco, sem criar índices/coleções nem alterar registros existentes.
- [ ] Proteger segredos com .gitignore e template sem valores reais; documentar desenvolvimento e Vercel.
- [ ] Executar testes, lint, typecheck, build e auditoria de dependências; registrar resultados e commits.

Autenticação fica definida, mas ainda não implementada. Não criar schemas vazios de funcionalidades, migrar banco ou efetuar deploy nesta etapa.

### Fase 2 — Autenticação e usuários

Confirmar política de email, sessão e senha. TDD de cadastro válido/inválido, email duplicado normalizado, credenciais inválidas, sessão expirada/revogada, acesso anônimo e projeções sem segredos. Integrar Better Auth e índices. Telas cadastro/login/logout/perfil, proteção no servidor e feedback acessível. Testar fluxo HTTP real e cookies; não confiar só no mock da biblioteca.

### Fase 3 — Lista pessoal

TDD de criação, edição, exclusão, URLs inseguras, entrada inválida e alteração por terceiro. CRUD filtrado pelo usuário da sessão; paginação sem limite total. Cards com imagem, texto alternativo, descrição e produto em nova aba segura. Estados vazios/loading/error, confirmação de exclusão e feedback. Não exibir disponibilidade ao proprietário.

### Fase 4 — Grupos e dashboard

Aprovar regras de administração/saída e diretório. TDD de criação atômica, inclusão automática, duplicidade, permissões, transferência, remoção e saída. Implementar grupos convencionais e tipo amigo secreto, participantes, busca por nome, edição e dashboard. Acessos sempre filtrados por membership. Criar índices necessários com procedimento explícito e idempotente, sem rodar toda migração a cada request.

### Fase 5 — Compartilhamento e reservas

Aprovar persistência/cancelamento de reservas ao perder acesso. TDD de consulta autorizada e negada por ID, omissão de estado para dono, reserva própria negada, duas reservas concorrentes, cancelamento por terceiro negado, exclusão/saída concorrente. Testar contra MongoDB real isolado, incluindo índices únicos e transações. UI disponível/reservado e cancelar somente própria reserva, sem revelar reservante.

### Fase 6 — Amigo secreto

Aprovar mínimo de pessoas, invalidar por membros e política de novo sorteio. TDD de invariantes para várias quantidades, insuficiência, não administrador, persistência, leitura alheia negada, novo sorteio e concorrência com membros/sorteios. Seção Meu amigo secreto com nome/perfil/lista e disponibilidade; confirmação antes de refazer. Admin sem relatório coletivo de atribuições.

### Fase 7 — Finalização e preparação de deploy

Revisar IDOR, DTOs, sessões, XSS, CSRF, URLs, logs e rate limiting distribuído. E2E com múltiplas sessões no navegador para cadastro→grupo→reserva→sorteio. Revisar teclado, foco, contraste, touch e tamanhos mobile/desktop. Rodar testes, lint, typecheck e build. Documentar variáveis Vercel, região próxima ao Atlas, rede/TLS, pools e orçamento. Separar bancos development/preview/production; preview nunca aponta para produção por padrão. Deploy/publicação será uma etapa explícita posterior.

## TDD, Git e validação

Cada comportamento: escrever teste → executar e registrar falha esperada → implementar mínimo → executar verde → refatorar → executar novamente. Testes de integração usam banco dedicado com replica set, URI separada e proteção contra banco de produção. Não limpar banco da DATABASE_URL existente. E2E com dados descartáveis. Não criar testes que apenas repitam o JSX ou constantes.

Commits Conventional Commits em unidades verificadas, sem push automático: planejamento/configuração, testes de infraestrutura e implementação da base. Antes de cada commit executar verificações pertinentes; no fim da fase rodar conjunto completo. Nunca usar `git add .` sem inspeção de segredos. O lockfile será versionado; CI usará npm ci.

Cada entrega informa resultado, arquivos principais com links, testes e limitações, hashes dos commits e próxima fase. Adotamos esse formato de revisão também nas próximas entregas.

## Referências oficiais consultadas

- Next.js / App Router: https://nextjs.org/docs/app/getting-started/installation
- Driver MongoDB / conexões: https://www.mongodb.com/docs/drivers/node/current/connect/
- Pool MongoDB: https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/connection-pools/
- Better Auth / instalação: https://better-auth.com/docs/installation
- Better Auth / email e senha: https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/email-password.mdx
- Better Auth / adapter: https://github.com/better-auth/better-auth/blob/main/docs/content/docs/adapters/mongo.mdx

Revalidar integração e requisitos das bibliotecas na fase que efetivamente as utiliza.
