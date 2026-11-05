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

- Fase 1: base técnica criada. Fases 2–7 ainda não iniciadas.
- Next.js 16.4.5, React 19.3.1 e TypeScript estrito; página pública inicial em português, sem ações falsas de cadastro/grupos.
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

Auth recomendada: Better Auth com adapter MongoDB, ainda não instalado/integrado. Não há cadastro, login, CRUD, reservas, serviços de domínio nem índices de negócio implementados.

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

## Verificações e pendências conhecidas

Na Fase 1, `pnpm check` passou: lint, TypeScript, 12 testes e build de produção. Instalação com frozen lockfile e smoke HTTP 200 também passaram. Não houve avaliação visual em navegador nem execução remota de CI, pois não houve push.

`pnpm audit --prod` não encontrou vulnerabilidades conhecidas. Auditoria completa apontou um aviso moderado de minimatch na cadeia de lint; revalidar em futuras atualizações, sem supor que continua atual.

**Conexão real pendente:** MongoDB retornou código 8000 com indicação de falha de autenticação. `.env` preservado; nenhuma credencial ou documento exposto/alterado. Corrigir a configuração da conexão antes das funcionalidades persistentes. Topologia/transações não puderam ser confirmadas sem autenticação. Mocks não comprovam persistência real.

Decisões ainda pendentes: mínimo de participantes (proposta: três), encerramento do grupo pelo último membro, políticas finais de senha/sessão, verificação/recuperação de email, edição de perfil e exclusão de conta/retenção. Não confundir propostas com aprovação.

## Próxima etapa autorizável

Fase 2: cadastro, login, logout, sessão, perfil e proteção no servidor, depois de resolver conexão e políticas essenciais. O usuário pediu concluir a primeira etapa e voltar antes de avançar; não iniciar a Fase 2 automaticamente.

Commits de referência da Fase 1: `f832e7e` (plano), `8c76bc9` (regras definitivas), `35edd6a` (base com pnpm), `c4772ae` (relatório e documentação). Use `git log` e `git status` para estado atual, sem transformar esta lista em histórico exaustivo.
