# Plano de implementação — Lista Natalina

## Escopo e estado inicial

Aplicação web mobile-first para listas pessoais, grupos convencionais e amigo secreto, com Next.js App Router, TypeScript e MongoDB no mesmo projeto, compatível com Vercel. Prioridades: autorização no servidor, privacidade das reservas e atribuições, TDD e simplicidade.

Inspeção em 05/11/2026: somente README.md e commit inicial `b54cb55`; `.env` local com `DATABASE_URL`, sem aplicação, dependências ou regras AGENTS.md encontradas nos diretórios ancestrais. Preservar o `.env`; nunca registrar valores ou documentos reais nos logs. Não executar seeds ou alterações no banco existente nesta etapa.

A Fase 1 foi autorizada pelo pedido atual. As fases seguintes serão iniciadas em novas etapas com o usuário. O complemento definitivo recebido nesta etapa prevalece sobre propostas anteriores. Consulte [REGRAS-DE-NEGOCIO.md](REGRAS-DE-NEGOCIO.md). Somente os pontos explicitamente pendentes precisam de confirmação.

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
| Framework | Next.js + React + TypeScript estrito | App Router e aplicação única; versões resolvidas no pnpm-lock.yaml |
| Banco | Driver oficial `mongodb` | Pool, índices e transações explícitos; Mongoose adicionaria ODM e duplicação de schemas sem benefício imediato |
| Validação | Zod | Schemas reutilizáveis; erros públicos sanitizados |
| Autenticação (Fase 2) | Better Auth, adapter MongoDB | Email/senha, sessões persistidas e hash seguro mantidos pela biblioteca; confirmar versão e integração no início da fase |
| Testes | Vitest; integração MongoDB isolada | Unidade rápida e verificação de índices/transações reais; adicionar Testing Library e Playwright nas fases com formulários e fluxos completos |
| Interface | Tailwind CSS e HTML semântico | Preferência explícita do usuário; tokens natalinos compartilhados, sem kit pesado |
| Formulários | Formulários nativos + Server Actions + Zod | Evita biblioteca adicional no início; React Hook Form somente se a complexidade justificar |
| Estado | Estado local React e servidor | Sem Redux/Zustand/TanStack Query até existir necessidade concreta |

Better Auth foi integrado na Fase 2 com senha de **6–128 caracteres**, conforme definição explícita do usuário, hash scrypt da biblioteca, sessão persistida de **7 dias**, cookies HttpOnly/SameSite=Lax e Secure em HTTPS. Não haverá confirmação de email nem recuperação de senha neste projeto. Endpoints fora desse escopo são bloqueados. Formulários usam Route Handlers para preservar cookies e rate limiting da biblioteca; não há Server Action de autenticação paralela.

## Modelagem MongoDB proposta

Identificadores de domínio serializados como strings; BSON ObjectId no domínio quando adequado, respeitando o formato de IDs do adapter de autenticação. Datas BSON UTC; DTOs com ISO 8601. A Fase 2 consolida nomes e índices do adapter antes de criar coleções. Referências evitam duplicação e arrays ilimitados.

| Coleção | Campos essenciais | Índices e finalidade |
| --- | --- | --- |
| `user` | id, name, email normalizado, emailVerified, image opcional, createdAt, updatedAt | email único; nome normalizado para busca por prefixo |
| `account` | id, userId, providerId, accountId, password hash | índices exigidos pelo adapter; credenciais nunca em DTO público |
| `session` | id, userId, token, expiresAt, createdAt, updatedAt | token único, userId; TTL expiresAt; validar expiração também na aplicação |
| `verification` | campos do adapter para verificação/recuperação | índices e TTL conforme versão; nenhuma exposição pública |
| `gifts` | _id, ownerId, name, description, productUrl, imageUrl, createdAt, updatedAt | ownerId + _id decrescente para paginação sem limite total de presentes (decisão da Fase 3) |
| `groups` | _id, name, description?, type, adminId, membershipVersion, writeVersion, activeDrawId?, createdAt, updatedAt | adminId; versão para serializar alterações de membros/sorteios |
| `memberships` | _id, groupId, userId, joinedAt | único (groupId,userId); (userId,groupId) para dashboard e compartilhamento |
| `reservations` | _id, giftId, groupId, reservedBy, drawId? (edição), status, createdAt, updatedAt, cancelledAt? | único parcial (groupId,giftId) onde status=active; (groupId,drawId,status) para invalidação; reservedBy |
| `draws` | _id (edição), groupId, membershipVersion, status: active/invalidated, createdBy, createdAt, invalidatedAt? | groupId + createdAt; único parcial groupId onde status=active |
| `assignments` | _id, drawId, giverId, recipientId | únicos (drawId,giverId) e (drawId,recipientId); leitura somente pelo par drawId + usuário da sessão |

Participações ficam em coleção própria para busca bidirecional e unicidade sem crescer o documento do grupo. Reservas são separadas para não vazar estado junto do presente ao proprietário. Atribuições são referências separadas: nenhuma rota retorna o conjunto; administrador recebe somente metadados. Não há endpoint para ler atribuição passando um giverId arbitrário. Dados pequenos de valor podem ser incorporados; não copiar listas pessoais para os grupos. IDs de grupos convencionais não aceitam sorteio.

### Integridade, concorrência e privacidade

MongoDB não tem FKs: serviços verificam referências e usam transações para mudanças relacionadas. Requer replica set/Atlas com suporte a transações. Não iniciar sorteios em standalone sem oferecer erro de configuração claro.

- Criar grupo e primeira participação na mesma transação.
- Reserva: verificar acesso e dono, inserir com índice único parcial (groupId,giftId), status=active e tratar conflito como indisponível; não usar apenas sequência consultar→inserir. Concorrer reserva com saída, exclusão, invalidação ou novo sorteio exige transação e escrita de versão no recurso de autorização compartilhado (grupo), evitando write skew. A criação da reserva em amigo secreto verifica também activeDrawId e atribuição do reservante dentro da transação. Testar explicitamente esses interleavings na Fase 5.
- Cancelar reserva filtrando groupId, giftId, status e reservedBy autenticado; somente o reservante cancela manualmente. Cancelamentos sistêmicos por invalidação/saída são transacionais. Excluir presente cancela suas reservas em todos os grupos sem revelar estado ao dono.
- Toda consulta de lista alheia exige groupId e autorização nesse contexto: grupo convencional permite acesso entre membros; amigo secreto exige sorteio ativo e destinatário igual ao dono da lista. Outro grupo compartilhado não concede acesso ao contexto solicitado. DTO do proprietário omite inclusive campo de disponibilidade. DTO de terceiro autorizado consulta somente as reservas ativas do grupo atual e da edição ativa quando aplicável, e mostra apenas disponível/reservado e `canCancel` calculado, sem identidade do reservante.
- Sorteio: ler snapshot de membros, exigir pelo menos três (proposta), embaralhar com aleatoriedade criptográfica no servidor e gerar permutação sem pontos fixos; testar invariantes. Não usar Math.random. Não prometer distribuição uniforme se o algoritmo escolhido não a oferecer.
- Gravar draw + assignments e atualizar activeDrawId com comparação de membershipVersion numa transação. Mutação de membros também escreve a versão do grupo. Conflitos abortam/repetem com limite; erro de concorrência é tratado na interface.
- Novo sorteio invalida anterior e cancela suas reservas na mesma transação, preservando outros grupos; consultar apenas activeDrawId válido e atribuição do usuário autenticado. Nenhuma atribuição em logs, HTML de outros usuários, payloads coletivos ou cache compartilhado.
- Busca de usuários por prefixo, paginada, com limites por requisição e projeção mínima (id e nome). Email não é campo público nem parte da busca. Perfil básico de membros exige contexto; listas seguem a autorização específica do tipo de grupo e edição, nunca apenas existência de grupo compartilhado.

## Regras definitivas e pontos pendentes

As regras definitivas e a matriz de testes estão em [REGRAS-DE-NEGOCIO.md](REGRAS-DE-NEGOCIO.md). Elas substituem as propostas iniciais sobre acesso por qualquer grupo, reservas globais, persistência de reservas ao refazer e invalidação automática por mudança de membros.

- A autorização é contextual por grupo, usuário e edição ativa. Convencionais compartilham listas; amigo secreto restringe ao destinatário após sorteio e bloqueia listas alheias antes dele.
- Reservas pertencem ao grupo; em amigo secreto pertencem também à edição. Invalidação e novo sorteio cancelam reservas somente da edição afetada, atomicamente.
- Composição de amigo secreto fica bloqueada durante sorteio ativo, inclusive adições. Somente administrador invalida explicitamente antes de alterar membros.
- Grupo tem exatamente um administrador, que só transfere para membro atual. Transferência não altera sorteio e não contorna bloqueio de saída.

Pendências restantes (não implementar sem definir): mínimo de participantes (proposta: três), tratamento do último membro/administrador (proposta: exclusão confirmada do grupo), exclusão de conta/retencão de histórico, edição do perfil, política de edição do perfil. Busca autenticada mínima por id/nome; email privado. Proposta de URLs apenas HTTP/HTTPS sem proxy de imagens; descrição em texto simples.

## Plano incremental e critérios de aceite

### Fase 1 — Estrutura e configurações (pedido atual)

- [x] Inspecionar Git, arquivos, ambiente e regras existentes.
- [x] Documentar arquitetura, coleções, escolhas, regras pendentes e plano integral.
- [x] Criar Next.js App Router/TypeScript estrito e página inicial responsiva de apresentação da base, sem botões de funcionalidades inexistentes.
- [x] Configurar ESLint, Vitest e scripts de validação; adicionar testes primeiro para ambiente e conexão reutilizável.
- [x] Validar DATABASE_URL sem mostrar valores; conexão lazy server-only com pool e tratamento de falha.
- [x] Oferecer diagnóstico read-only explícito do banco, sem criar índices/coleções nem alterar registros existentes.
- [x] Proteger segredos com .gitignore e template sem valores reais; documentar desenvolvimento e Vercel.
- [x] Executar testes, lint, typecheck, build e auditoria de dependências; registrar resultados e commits.

Autenticação fica recomendada, mas ainda não implementada. Não criar schemas vazios de funcionalidades, migrar banco ou efetuar deploy nesta etapa.

### Fase 2 — Autenticação e usuários

Política confirmada pelo usuário: senha de 6–128 caracteres, sessão de 7 dias, sem confirmação nem recuperação de email. TDD de cadastro válido/inválido, email duplicado normalizado, credenciais inválidas, sessão expirada/revogada, acesso anônimo e projeções sem segredos. Integrar Better Auth e índices. Telas cadastro/login/logout/perfil, proteção no servidor e feedback acessível. Testar fluxo HTTP real e cookies; não confiar só no mock da biblioteca.

### Fase 3 — Lista pessoal

Fase implementada: ver [FASE-3.md](FASE-3.md). Imagem é opcional, com ilustração local padrão (decisão do usuário). TDD de criação, edição, exclusão, URLs inseguras, entrada inválida e alteração por terceiro. CRUD filtrado pelo usuário da sessão; paginação sem limite total. Cards com imagem, texto alternativo, descrição e produto em nova aba segura. Estados vazios/loading/error, confirmação de exclusão e feedback. Não exibir disponibilidade ao proprietário.

### Fase 4 — Grupos e dashboard

Aplicar regras definitivas de administração e bloqueio por sorteio ativo; definir último membro e diretório. TDD de criação atômica, inclusão automática, duplicidade, permissões, transferência, remoção e saída. Implementar grupos convencionais e tipo amigo secreto, participantes, busca por nome, edição e dashboard. Acessos sempre filtrados por membership. Criar índices necessários com procedimento explícito e idempotente, sem rodar toda migração a cada request.

### Fase 5 — Compartilhamento e reservas

Aplicar reservas contextuais e cancelamento ao perder participação no grupo específico. TDD de consulta autorizada e negada por ID, omissão de estado para dono, reserva própria negada, duas reservas concorrentes, cancelamento por terceiro negado, exclusão/saída concorrente. Testar contra MongoDB real isolado, incluindo índices únicos e transações. UI disponível/reservado e cancelar somente própria reserva, sem revelar reservante.

### Fase 6 — Amigo secreto

Aprovar mínimo de pessoas; aplicar invalidação explícita e novo sorteio com cancelamento atômico das reservas da edição. TDD de invariantes para várias quantidades, insuficiência, não administrador, persistência, leitura alheia negada, novo sorteio e concorrência com membros/sorteios/reservas. Executar todos os cenários adicionais da matriz em REGRAS-DE-NEGOCIO.md. Seção Meu amigo secreto com nome/perfil/lista e disponibilidade; confirmação antes de refazer. Admin sem relatório coletivo de atribuições.

### Fase 7 — Finalização e preparação de deploy

Revisar IDOR, DTOs, sessões, XSS, CSRF, URLs, logs e rate limiting distribuído. E2E com múltiplas sessões no navegador para cadastro→grupo→reserva→sorteio. Revisar teclado, foco, contraste, touch e tamanhos mobile/desktop. Rodar testes, lint, typecheck e build. Documentar variáveis Vercel, região próxima ao Atlas, rede/TLS, pools e orçamento. O usuário definiu o banco existente como produção. Testes sempre usam MongoDB descartável; previews de deploy ainda precisam de banco separado e não devem receber a URI de produção automaticamente. Deploy/publicação será uma etapa explícita posterior.

## TDD, Git e validação

Cada comportamento: escrever teste → executar e registrar falha esperada → implementar mínimo → executar verde → refatorar → executar novamente. Testes de integração usam banco dedicado com replica set, URI separada e proteção contra banco de produção. Não limpar banco da DATABASE_URL existente. E2E com dados descartáveis. Não criar testes que apenas repitam o JSX ou constantes.

Commits Conventional Commits em unidades verificadas, com push quando autorizado na sessão: planejamento/configuração, testes de infraestrutura e implementação da base. Antes de cada commit executar verificações pertinentes; no fim da fase rodar conjunto completo. Nunca usar `git add .` sem inspeção de segredos. O lockfile será versionado; CI usará pnpm install --frozen-lockfile.

Cada entrega informa resultado, arquivos principais com links, testes e limitações, hashes dos commits e próxima fase. Adotamos esse formato de revisão também nas próximas entregas.

## Estado da Fase 1

Base implementada e validada com pnpm; ver [FASE-1.md](FASE-1.md). A pendência inicial de autenticação do MongoDB foi resolvida pelo usuário na Fase 2; ping e topologia transacional confirmados. Nenhum dado ou credencial foi alterado. Fase 2 implementada; consulte [FASE-2.md](FASE-2.md). Fase 3 implementada: ver [FASE-3.md](FASE-3.md). Fases 4–7 ainda não iniciadas.

## Referências oficiais consultadas

- Next.js / App Router: https://nextjs.org/docs/app/getting-started/installation
- Driver MongoDB / conexões: https://www.mongodb.com/docs/drivers/node/current/connect/
- Pool MongoDB: https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/connection-pools/
- Better Auth / instalação: https://better-auth.com/docs/installation
- Better Auth / email e senha: https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/email-password.mdx
- Better Auth / adapter: https://github.com/better-auth/better-auth/blob/main/docs/content/docs/adapters/mongo.mdx

Revalidar integração e requisitos das bibliotecas na fase que efetivamente as utiliza.
