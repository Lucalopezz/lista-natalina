# Lista Natalina

Plataforma de listas de presentes e amigo secreto com Next.js App Router, TypeScript, MongoDB e Tailwind CSS. Já estão implementados cadastro, entrada, logout, sessão e perfil próprio. Presentes, grupos, reservas e sorteios serão entregues nas próximas fases.

## Documentação

- [Instruções de trabalho e preferências](AGENTS.md)
- [Contexto central](CONTEXT.md)
- [Plano completo e modelagem](docs/PLANO.md)
- [Regras definitivas de negócio](docs/REGRAS-DE-NEGOCIO.md)
- [Fase 1: estrutura](docs/FASE-1.md)
- [Fase 2: autenticação, contrato HTTP e testes](docs/FASE-2.md)

## Desenvolvimento

Node.js 24 (`nvm use`), pnpm 12.11.2 fixado em packageManager e lockfile versionado.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abra http://localhost:3000. Rotas: `/`, `/cadastro`, `/entrar`, `/dashboard` e `/perfil`. Dashboard/perfil exigem sessão validada no servidor. Senha de 6–128 caracteres; sessão de 7 dias; sem confirmação de email nem recuperação de senha.

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

`db:check` consulta ping/topologia, fecha a conexão e não imprime URI, hosts, credenciais ou documentos; não cria coleções/índices/dados. Verificação de topologia não substitui testes de transações reais.

## Organização e interface

`src/app`: páginas/layouts/Route Handlers. `src/modules/auth`: validação, configuração Better Auth, índices, adaptador HTTP, sessão e formulários. `src/lib/db`: pool MongoDB reutilizável e server-only. Testes junto dos módulos. Novos módulos serão adicionados conforme cada fase, sem implementações vazias.

Server Components são o padrão. Formulários usam o handler HTTP para manter cookies e rate limiting da biblioteca. Regras de domínio não pertencem aos componentes React. Listas alheias/reservas futuras sempre exigirão contexto explícito do grupo.

Estilos usam Tailwind CSS. Tokens da paleta natalina estão em `src/app/globals.css`; estilos de componentes e responsividade ficam nos utilitários do JSX. Sem biblioteca extra de formulários ou estado global.

## Vercel e CI

Projeto único Next.js/Node.js 24, sem processos permanentes ou armazenamento local persistente. Build `pnpm build`, instalação `pnpm install --frozen-lockfile`, saída padrão do Next.js. Configurar envs privadas por ambiente, origem HTTPS exata e segredo próprio. Não compartilhar URI de produção com previews automaticamente. Deploy ainda não realizado.

Mantenha Functions próximas ao MongoDB; use TLS e permissões/rede restritas. Pool máximo 10 por instância, timeout de seleção de servidor e de espera pelo pool de 5 segundos. Não existe um único pool compartilhado por todas as Functions; dimensionar conexões do Atlas conforme concorrência.

GitHub Actions roda lint, tipos, unidade, build, integração e E2E em bancos descartáveis, sem credenciais de produção. O pnpm-workspace.yaml autoriza esbuild e registra uma exceção de idade para a versão exata de Vite já resolvida; não desabilita a política global de dependências.
