# Lista Natalina

Plataforma de listas de presentes e amigo secreto com Next.js App Router, TypeScript e MongoDB. A Fase 1 entrega a estrutura técnica; cadastro, listas, grupos, reservas e sorteios serão implementados nas próximas etapas.

## Documentação

- [Instruções de trabalho e preferências](AGENTS.md)
- [Contexto central e estado atual](CONTEXT.md)

- [Plano completo, arquitetura, modelagem e fases](docs/PLANO.md)
- [Regras definitivas e testes adicionais](docs/REGRAS-DE-NEGOCIO.md)
- [Resultado e validação da Fase 1](docs/FASE-1.md)

## Desenvolvimento

Use Node.js 24 (`nvm use`) e pnpm. O lockfile é versionado.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abra http://localhost:3000. A página inicial é uma apresentação; ainda não há autenticação ou operações de domínio.

O `.env` existente é preservado e ignorado pelo Git. Em um checkout novo, crie seu arquivo local a partir de `.env.example` e configure a URI real sem versioná-la. Nunca substitua um `.env` existente automaticamente.

| Variável privada | Uso |
| --- | --- |
| `DATABASE_URL` | URI MongoDB existente, obrigatória ao acessar o banco |
| `DATABASE_NAME` | Opcional; substitui o banco da URI. Sem ela, vale o banco da URI ou o padrão do driver; informe o banco explicitamente antes das funcionalidades de escrita |

A aplicação lê variáveis apenas no servidor. O build e a página inicial não dependem da conexão com o banco. O módulo `server-only` impede importação da persistência em Client Components.

```sh
pnpm test                 # Unidade, sem banco real
pnpm test:watch
pnpm test:coverage
pnpm lint
pnpm typecheck
pnpm build
pnpm check            # Todas as verificações acima, sem cobertura
pnpm db:check         # Diagnóstico explícito usando .env
```

`db:check` executa somente ping e consulta de topologia, fecha a conexão e não imprime URI, hosts, credenciais ou documentos. Retorna erro se a conexão falhar ou a topologia não suportar transações. Não cria coleções, índices nem dados. Não é teste de integração dos futuros serviços. O comando usa `tsx` com a condição `react-server` para respeitar o marcador server-only fora do Next.js.

## Organização

`src/app` contém apresentação e adaptadores do Next.js; `src/lib/env` valida configurações; `src/lib/db` gerencia o pool MongoDB. Testes ficam junto dos módulos. Os módulos `auth`, `users`, `gifts`, `groups`, `reservations` e `secret-santa` serão criados em `src/modules` conforme cada fase — sem implementações vazias.

Server Components são o padrão. Regras de negócio irão para serviços, separados dos repositórios e da interface. Todo acesso a lista de terceiro/reserva usará o contexto explícito do grupo, conforme o complemento definitivo. Reservas e atribuições secretas nunca serão expostas ao proprietário/terceiros indevidos.

## Vercel

Projeto único Next.js, runtime Node.js, sem processos permanentes ou armazenamento local persistente. Selecionar Node.js 24 no projeto; comando de build `pnpm build`, instalação `pnpm install --frozen-lockfile`, saída padrão do Next.js. Não foi realizado deploy nesta fase.

Configurar variáveis privadas no painel por ambiente e usar bancos separados para development, preview e production. Aproximar região das Functions e MongoDB. Restringir acesso de rede e usar TLS conforme o provedor; não abrir rede indiscriminadamente para contornar falhas. Reutilização de conexão acontece por instância, sem garantia de pool global entre Functions; dimensionar limite de conexões do Atlas conforme concorrência. Sorteios e operações relacionadas exigirão replica set/Atlas com transações. Variáveis Better Auth e política de sessão serão incluídas na Fase 2.

CI executa lint, TypeScript, testes e build sem credenciais. Testes de integração e E2E serão adicionados com as funcionalidades, usando exclusivamente banco descartável separado.
