# Contexto central — Lista Natalina

Última atualização: 05/11/2026. Este arquivo facilita continuidade; confira código, Git e documentos de origem antes de concluir que uma verificação antiga continua válida. Regras de trabalho: [AGENTS.md](AGENTS.md).

## Objetivo

Aplicação full-stack mobile-first para listas pessoais de presentes, grupos convencionais e amigo secreto, com reservas privadas e resultados individuais confidenciais. Next.js App Router, TypeScript e MongoDB, em projeto único compatível com Vercel. Desenvolvimento incremental com TDD e commits locais.

## Fontes de decisão

1. Instruções atuais do usuário.
2. [Regras definitivas de negócio](docs/REGRAS-DE-NEGOCIO.md), que substituem propostas conflitantes do plano inicial.
3. [Plano completo](docs/PLANO.md): arquitetura, coleções, bibliotecas, testes e sete fases.
4. [Relatório da Fase 1](docs/FASE-1.md): resultados efetivamente verificados e limitações.

O perfil ai-memory contribui com preferências de comunicação, conforme a origem registrada em AGENTS.md. Não importar automaticamente regras de domínio de Agrofin ou outros projetos.

## Estado implementado

- Fases 1 e 2 implementadas. Fases 3–7 ainda não iniciadas. Consulte [FASE-2.md](docs/FASE-2.md) para autenticação, ambiente e testes.
- Next.js 16.4.5, React 19.3.1 e TypeScript estrito; página pública, cadastro, entrada, dashboard inicial e perfil próprio; Tailwind CSS com paleta natalina.
- pnpm 12.11.2 em packageManager, pnpm-lock.yaml versionado e Node.js 24 como alvo. Instalação npm anterior removida; manter package.json.
- Zod para validar ambiente privado, usando o nome existente `DATABASE_URL`; `DATABASE_NAME` opcional. Sem nome explícito, o driver usa o da URI ou seu padrão: confirmar banco antes de escrever.
- Driver oficial MongoDB em módulo server-only; conexão lazy, promessa global por instância, pool máximo 10, conexão inicial descartada após falha para permitir nova tentativa.
- Vitest, ESLint e scripts de typecheck/build; workflow GitHub Actions configurado com pnpm e Node.js 24.
- O README e docs explicam configuração local e preparação para Vercel. Nenhuma publicação foi feita.

## Mapa do código

| Local | Responsabilidade |
| --- | --- |
| `src/app` | Layout, estilos e página pública inicial |
| `src/lib/env/server.ts` | Validação lazy e mensagem de configuração sem valores sensíveis |
| `src/lib/db/mongodb.ts` | Cliente/pool reutilizável e acesso ao banco no servidor |
| `src/lib/**/*.test.ts` | Testes isolados de ambiente e conexão |
| `scripts/check-database.ts` | Ping e consulta de topologia explícitos, sem modificar dados |
| `.github/workflows/validacao.yml` | Instalação reproduzível e verificação no CI |
| `src/modules` (futuro) | auth, users, gifts, groups, reservations, secret-santa, criados conforme cada fase |

Better Auth 1.7.17 com adapter MongoDB implementado. Senha de 6–128 caracteres, sessão de 7 dias, sem confirmação de email nem recuperação de senha (decisões explícitas do usuário). Há cadastro/login/logout/perfil e índices de auth. Presentes, grupos, reservas e sorteios ainda não implementados.

## Invariantes de negócio

- Lista pessoal é única por usuário; grupos não copiam presentes.
- Grupo convencional permite listas/reservas entre membros.
- Em amigo secreto, antes do sorteio não há acesso a listas alheias; depois, somente à lista do destinatário do usuário autenticado.
- Permissão sempre depende do grupo acessado. Um grupo convencional em comum não libera acesso pelo contexto de amigo secreto.
- Reserva pertence a grupo + presente; amigo secreto inclui edição. Mesmo presente pode ter reservas distintas em grupos diferentes.
- Índice proposto: único parcial (groupId,giftId) para status=active. Proprietário nunca recebe estado/identidade das reservas.
- Somente o reservante cancela manualmente. Invalidação de sorteio cancela reservas da edição de forma sistêmica.
- Uma edição ativa por grupo. Refazer invalida anterior e cancela reservas dela na mesma transação, preservando outros grupos.
- Edição ativa bloqueia adição, remoção e saída de membros. Administrador precisa invalidar explicitamente antes de alterar composição.
- Exatamente um administrador por grupo. Transferência só para membro atual; não altera sorteio. Antigo administrador perde poderes e continua sujeito ao bloqueio de saída com sorteio ativo.
- Nem administrador recebe atribuições de terceiros. DTOs explícitos; autorização servidor, nunca apenas interface.

A implementação deve seguir os detalhes e a matriz de testes do complemento definitivo, incluindo coordenação transacional para evitar reservas sobrevivendo à invalidação concorrente.

## Verificações e ambiente

Fase 2: 38 testes isolados, 14 de integração HTTP com MongoDB descartável e dois E2E Playwright (desktop/celular) aprovados; lint, TypeScript e build também. Capturas de cadastro/perfil revisadas. `pnpm audit --prod` não encontrou vulnerabilidades conhecidas. Auditorias são retratos do momento, revalidar quando necessário.

O usuário corrigiu a conexão e definiu o banco como **produção**, com nome explícito `lista-natalina` (DATABASE_NAME no .env). Auth bloqueia escritas se o nome estiver implícito. Ping e topologia transacional confirmados sem alteração de documentos. Nunca fazer cadastro automatizado, seed, drop ou limpeza nele. Testes são executados por `scripts/test-auth.sh`, com MongoDB temporário em tmpfs e envs explicitamente sobrescritas. O helper de integração recusa URI diferente do formato local descartável.

As novas variáveis privadas foram centralizadas no `.env`, com autorização do usuário: segredo de autenticação, origem local e DATABASE_NAME. A URI existente foi preservada; `.env.local` não mantém duplicatas. A aplicação local conectada a esse banco cria contas reais quando o usuário se cadastra manualmente. Primeira inicialização funcional de auth prepara índices idempotentes. A verificação de conexão feita nesta etapa não criou índices.

Servidor de desenvolvimento iniciado em http://localhost:3000 nesta sessão; verificar se continua rodando antes de prometer disponibilidade futura. Testes E2E usam outro servidor e banco. Deploy Vercel ainda não realizado. Na Vercel, configurar origem HTTPS exata e segredo próprio; previews exigem banco separado.

## Próxima etapa

Fase 3: CRUD da lista pessoal, cards e URLs validadas/autorizadas. Ainda não iniciar sem a próxima etapa solicitada pelo usuário. Ele autorizou o push dos commits desta entrega e a Fase 2, já executada.

Pendências das fases seguintes: mínimo de participantes, encerramento do grupo pelo último membro, edição de perfil e exclusão de conta/retenção. Senha/sessão e ausência de email/recuperação já estão definidos, não perguntar novamente.

Commits de referência da Fase 1: `f832e7e`, `8c76bc9`, `35edd6a`, `c4772ae` e `1d68a8b`; backend de auth: `a9b2025`. Consulte `git log`/`git status` para histórico e estado atuais.
