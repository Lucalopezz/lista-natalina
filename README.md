# Lista Natalina

Plataforma de listas de presentes e amigo secreto com Next.js App Router, TypeScript, MongoDB e Tailwind CSS. Já estão implementados cadastro, entrada, logout, sessão, perfil próprio, lista pessoal de presentes, gerenciamento de grupos, listas compartilhadas por contexto e reservas privadas. Sorteios serão entregues na próxima fase.

## Documentação

Para estudar a aplicação, comece pelo [guia detalhado do projeto](docs/COMO-O-PROJETO-FUNCIONA.md): estrutura, rotas, exemplos de código, autenticação, regras e MongoDB.

- [Instruções de trabalho e preferências](AGENTS.md)
- [Contexto central](CONTEXT.md)
- [Plano completo e modelagem](docs/PLANO.md)
- [Regras definitivas de negócio](docs/REGRAS-DE-NEGOCIO.md)
- [Fase 1: estrutura](docs/FASE-1.md)
- [Fase 2: autenticação, contrato HTTP e testes](docs/FASE-2.md)
- [Fase 3: lista pessoal e autorização](docs/FASE-3.md)
- [Fase 4: grupos, participantes e administração](docs/FASE-4.md)
- [Fase 5: listas compartilhadas e reservas privadas](docs/FASE-5.md)
- [Revisão da interface: simplicidade e leitura](docs/REVISAO-INTERFACE.md)

## Desenvolvimento

Node.js 24 (`nvm use`), pnpm 12.11.2 fixado em packageManager e lockfile versionado.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abra http://localhost:3000. Rotas: `/`, `/cadastro`, `/entrar`, `/dashboard`, `/perfil`, `/presentes` e `/grupos`. Dashboard, perfil, presentes e grupos exigem sessão validada no servidor. Senha de 6–128 caracteres; sessão de 7 dias; sem confirmação de email nem recuperação de senha.

Preserve arquivos locais existentes. Em novo checkout, use `.env.example` como referência e configure arquivos privados sem versioná-los. `.env` e `.env.local` estão ignorados pelo Git. O banco existente é de **produção**, conforme decisão do usuário: não usar para dados automatizados de teste, seed ou limpeza. Cadastros manuais no servidor local conectado a ele criam contas reais.

| Variável privada | Uso |
| --- | --- |
| `DATABASE_URL` | URI MongoDB, com banco explícito preferencialmente e suporte a transações |
| `DATABASE_NAME` | Opcional; substitui o banco da URI. Informe o banco explicitamente antes das escritas |
| `BETTER_AUTH_SECRET` | Segredo aleatório de pelo menos 32 caracteres; nunca exibir ou versionar |
| `BETTER_AUTH_URL` | Origem exata: http://localhost:3000 localmente, HTTPS em produção |

As variáveis são lidas somente no servidor. Build não exige conexão ao banco. Auth prepara índices de forma idempotente na primeira inicialização, antes de aceitar escritas. Precisa de permissões para índices e transações. Dados duplicados existentes não são removidos automaticamente.

## Verificação

```sh
pnpm test                 # Unidade, sem banco real
pnpm test:watch
pnpm test:coverage
pnpm lint
pnpm typecheck
pnpm build
pnpm check                # Lint + tipos + unidade + build
pnpm db:check             # Ping/topologia, somente leitura, usando .env
pnpm test:integration     # MongoDB novo, isolado, em memória (Docker)
pnpm test:e2e             # Build e navegador com outro MongoDB descartável
```

Os runners de integração/E2E não usam o banco do `.env`: criam containers com tmpfs e portas aleatórias, sobrescrevem as variáveis no processo de teste e limpam somente recursos próprios. Reutilizam a imagem `mongo:7.0.45` quando já disponível. E2E usa Chromium local quando instalado; caso contrário, `pnpm exec playwright install chromium`. Capturas e traces ficam em `test-results`, ignorado pelo Git.

A fixture E2E limpa somente contadores de rate limit entre cenários no banco descartável validado, para isolar os cadastros dos testes. A proteção da aplicação permanece habilitada e possui testes próprios de integração. Para filtrar o navegador após o build: `bash scripts/test-auth.sh e2e e2e/groups.spec.ts`.

`db:check` consulta ping/topologia, fecha a conexão e não imprime URI, hosts, credenciais ou documentos; não cria coleções/índices/dados. Verificação de topologia não substitui testes de transações reais.

## Organização e interface

`src/app`: páginas/layouts/Route Handlers. `src/modules/auth`: validação, configuração Better Auth, índices, adaptador HTTP, sessão e formulários. `src/modules/gifts`: validação, serviços, repositório, Server Actions e UI da lista pessoal. `src/modules/groups`: regras de administração, participações, transações, consultas públicas mínimas e UI dos grupos. `src/lib/db`: pool MongoDB reutilizável e server-only. Testes junto dos módulos. Novos módulos serão adicionados conforme cada fase, sem implementações vazias.

Server Components são o padrão. Formulários usam o handler HTTP para manter cookies e rate limiting da biblioteca. Presentes usam Server Actions autenticadas e revalidação após sucesso. Regras de domínio não pertencem aos componentes React. Listas alheias e reservas exigem contexto explícito do grupo; autorização e disponibilidade ficam no módulo reservations.

Interface usa textos diretos, fonte base de 18 px, menu com seção atual e controles principais de pelo menos 48 px. Imagem opcional fica recolhida no formulário, e cadastro/entrada permitem conferir a senha digitada. Estilos usam Tailwind CSS. Tokens da paleta natalina estão em `src/app/globals.css`; estilos de componentes e responsividade ficam nos utilitários do JSX. Sem biblioteca extra de formulários ou estado global.

## Lista de presentes

Acesse `/presentes` após entrar. Nome, descrição e link HTTP/HTTPS do produto são obrigatórios. URL da imagem é opcional; imagem ausente ou com falha usa a ilustração local `public/images/gift-default.svg`. A lista tem paginação de 24 itens, sem limite total de presentes. Somente o proprietário edita e exclui seus itens; exclusão exige confirmação e cancela reservas desses presentes em todos os grupos na mesma transação. Outras pessoas só consultam por uma rota de grupo autorizada.

## Grupos

Acesse `/grupos` ou os cards no dashboard. Crie um grupo convencional ou de amigo secreto; o criador já é membro e administrador. O administrador pesquisa pelo início do nome e adiciona usuários diretamente, edita nome/descrição, remove membros e transfere sua função para outro participante. O tipo fica definido na criação.

Participantes podem sair. Com outros membros, o administrador precisa transferir a função antes; sendo o último, pode encerrar com confirmação. Sorteio ativo bloqueia alterações de participantes e encerramento no servidor, preservando a possibilidade de transferência. A realização/invalidação do sorteio pertence à Fase 6. Grupos e membros são paginados, sem limite total arbitrário.

O acesso às informações exige participação no grupo; a busca administrativa retorna somente id/nome. Em grupos convencionais, “Ver lista de presentes” abre a lista de um participante com disponibilidade daquele grupo. Amigo secreto não libera listas antes do sorteio; a autorização por destinatário/edição já está preparada para a próxima fase. Usuários e listas pessoais são preservados ao encerrar o grupo.

## Reservas por grupo

Na lista do participante, use “Reservar presente”. Só quem reservou vê “Cancelar minha reserva”, com confirmação. O dono não recebe estado nem identidade de reservas. Um presente pode ter reservas independentes em grupos diferentes; duas reservas ativas no mesmo grupo são impedidas pelo índice único e por transações. Reservar não significa que o item foi comprado.

Se a tela estiver desatualizada, uma tentativa concorrente recebe feedback e um botão para atualizar a lista. Saída/remoção cancela reservas como dono ou reservante naquele grupo, preservando outros contextos. Histórico cancelado não é público. A rota `/grupos/[id]/listas/[ownerId]` revalida sessão, participação e política do grupo no servidor; conhecer IDs não concede acesso.

## Ícone da aplicação

Fonte vetorial: `src/app/icon.svg`, com presente nas cores natalinas. Next.js registra favicon e ícone Apple automaticamente; `manifest.ts` oferece ícones de tela inicial em 192 e 512 px. Para atualizar os PNGs e o ICO após editar o SVG: `node scripts/generate-icons.mjs` (reutiliza sharp já incluído pelo Next.js). Isso não adiciona suporte offline.

## Vercel e CI

Projeto único Next.js/Node.js 24, sem processos permanentes ou armazenamento local persistente. Build `pnpm build`, instalação `pnpm install --frozen-lockfile`, saída padrão do Next.js. Configurar envs privadas por ambiente, origem HTTPS exata e segredo próprio. Não compartilhar URI de produção com previews automaticamente. Deploy ainda não realizado.

Mantenha Functions próximas ao MongoDB; use TLS e permissões/rede restritas. Pool máximo 10 por instância, timeout de seleção de servidor e de espera pelo pool de 5 segundos. Não existe um único pool compartilhado por todas as Functions; dimensionar conexões do Atlas conforme concorrência.

GitHub Actions roda lint, tipos, unidade, build, integração e E2E em bancos descartáveis, sem credenciais de produção. O pnpm-workspace.yaml autoriza esbuild e registra uma exceção de idade para a versão exata de Vite já resolvida; não desabilita a política global de dependências.
