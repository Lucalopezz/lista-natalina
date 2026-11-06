# Fase 4 — grupos e participantes

## Entrega

Criação de grupos convencionais e de amigo secreto, dashboard com os grupos do usuário, consulta de membros, edição de nome/descrição, pesquisa de usuários cadastrados pelo início do nome e inclusão direta, sem convite ou aceite. Administrador pode remover participantes e transferir a administração; membros podem sair conforme as regras.

O usuário confirmou nesta etapa: o último administrador pode encerrar o grupo com confirmação, desde que não haja sorteio ativo. Com outros participantes, ele transfere sua função antes de sair. O tipo é definido na criação e permanece imutável nesta versão; editar informações não altera a natureza do grupo.

## Arquivos e fluxo

- `validation.ts` e `types.ts`: schemas, contratos transacionais e DTOs. Nome de 1–120 caracteres, descrição opcional até 2000, tipos conventional/secret_santa, IDs e cursores validados. Pesquisa aceita até 100 caracteres.
- `service.ts`: regras de criação, administração, inclusão, saída, remoção, transferência, encerramento e bloqueio por sorteio ativo. Projeções explícitas de grupos e perfis públicos, sem email, senha, sessão, atribuições ou identificador da edição.
- `repository.ts`: driver MongoDB, índices, consultas com projeções e transações. A unidade transacional foi introduzida para que regras permaneçam no serviço e sejam testáveis, enquanto a persistência coordena operações concorrentes reais.
- `server.ts`: inicialização lazy e idempotente de índice/serviço; nenhum usuário ou resultado privado fica no cache compartilhado.
- `actions.ts`: autentica cada chamada, extrai apenas campos permitidos, exige confirmação nas operações sensíveis e delega ao serviço. Só revalida dashboard/grupos depois do sucesso; redirect fica fora do catch.
- `components`: formulário controlado, cards e operações com confirmação em diálogo nativo. Páginas e dashboard usam Server Components; interatividade fica nos componentes necessários.

## Modelagem e integridade

`groups`: `_id`, name, description, type, adminId, memberCount, membershipVersion, writeVersion, activeDrawId (null enquanto não existir edição ativa), createdAt e updatedAt. IDs BSON ObjectId e datas BSON Date. DTOs usam strings/ISO UTC e expõem somente hasActiveDraw, nunca activeDrawId ou resultados.

`memberships`: `_id`, groupId, userId e joinedAt. Participações separadas evitam arrays ilimitados e permitem consultas bidirecionais. Não há papel de admin duplicado na sessão ou na participação: a fonte é groups.adminId, um único identificador. Criação do grupo e primeira participação acontecem no mesmo commit.

Índices: memberships único (groupId,userId), memberships (userId,groupId desc), groups.adminId e user.name. memberCount é atualizado junto da participação na mesma transação, facilitando cards e a regra do último membro sem contagem adicional por card.

Não há remoção de contas nesta versão. Serviços verificam que usuários adicionados/administradores escolhidos existem, e a transferência exige participação atual. Escritas externas ao aplicativo não são reparadas automaticamente.

## Concorrência e segurança

Cada mutação disputa uma escrita no mesmo documento do grupo antes de reler participação, administração e composição. A escrita incrementa writeVersion. Se outra operação alterar o grupo, withTransaction repete a transação, e a autorização é reavaliada com o novo estado. Isso impede que um antigo administrador continue modificando membros depois da transferência.

membershipVersion muda somente com inclusão/remoção/saída. Transferir administração e editar informações mudam a coordenação de escrita e a data, mas não a composição ou resultados. Não executar emails, notificações ou outros efeitos externos dentro do callback repetível. Usamos readConcern snapshot e writeConcern majority; o driver gerencia commit e repetição transacional. Replica set/Atlas é necessário.

Regras implementadas:

- Só admin adiciona/remove, edita, transfere ou encerra o grupo.
- Membro comum pode sair, se não houver sorteio ativo.
- Admin não pode sair nem remover a si mesmo; transfere primeiro, ou encerra se for o único membro.
- Encerramento exige admin, participação única, ausência de edição ativa e confirmação na Server Action. Remove grupo/participação, preservando usuários e listas pessoais.
- Com activeDrawId, adicionar/remover/sair/encerrar fica bloqueado também no backend. Transferência continua permitida e preserva activeDrawId/membershipVersion.
- Atualização ignora adminId/type enviados pelo formulário. Identidade sempre vem da sessão, inclusive em chamadas diretas às actions.
- Não membros recebem apresentação genérica de grupo não encontrado. Membros comuns também não acessam a página administrativa de edição.

Esta fase não inicia nem invalida sorteios. Nos testes, a edição ativa é uma fixture do banco descartável; a regra de bloqueio já está preparada, e o procedimento real de invalidação pertence à Fase 6.

## Pesquisa e paginação

A pesquisa administrativa retorna apenas id/nome de usuários ainda fora do grupo. Prefixo é tratado literalmente, com caracteres de regex escapados, sem distinguir maiúsculas/minúsculas; acentos são preservados. Query vazia não lista o diretório. Não há migração de nomes nem alteração do cadastro/auth para essa pesquisa.

Grupos e participantes têm páginas de 24 itens; candidatos, de 20. Cursores ObjectId permitem continuar sem limitar o total. Busca tem maxTimeMS de 2 segundos; o índice de nome não equivale a garantir busca case-insensitive sem varredura em qualquer volume. Não há listagem global de emails nem documentos de auth nos payloads.

O grupo aparece no dashboard do usuário adicionado na próxima consulta. Não há convite, aceite, envio de email ou necessidade de alterar a sessão desse usuário. Não foram introduzidos WebSockets ou processos permanentes.

## Interface

Rotas: `/grupos`, `/grupos/novo`, `/grupos/[id]` e `/grupos/[id]/editar`. Dashboard e menu privado incluem acesso aos grupos. Formulários mostram erros, estado pendente e sucesso; remoção, transferência, saída e encerramento têm confirmação. O bloqueio de composição ativa é explicado na página.

Nome/descrição e nomes de membros são texto React, sem HTML arbitrário. UI usa Tailwind e mantém a paleta natalina. Capturas mobile/desktop foram verificadas e o fluxo não apresenta overflow horizontal no cenário testado.

## TDD e verificações

- 123 testes isolados no projeto: 46 novos de grupos (28 de serviço e 18 de actions), além dos anteriores.
- 37 testes de integração no MongoDB real descartável, incluindo 14 novos de grupos: criação atômica/rollback, unicidade, inclusão imediata, projeções privadas, pesquisa literal, troca de poderes, saída/remoção, sorteio ativo, encerramento e paginação.
- Concorrência real cobre inclusão duplicada, encerramento versus inclusão e transferência versus remoção. Os testes verificam que não sobram participações órfãs, contadores divergentes ou administrador fora do grupo.
- A defesa do DTO foi testada com repositório falso retornando email/senha extras: falha observada antes de acrescentar projeção na camada de serviço. A projeção MongoDB também ocorre dentro do lookup para não buscar credenciais desnecessárias.
- 10 testes E2E no total. O novo fluxo de grupos, em desktop/celular, usa três sessões: criação, leitura negada antes da inclusão, pesquisa/inclusão, atualização do dashboard, edição negada a membro, saída, readição, remoção, transferência, saída do antigo admin, encerramento pelo último e criação do tipo amigo secreto.
- Os testes de navegador foram escritos antes das telas e falharam inicialmente pela ausência da ação de criar grupo.
- Lint, TypeScript, build, testes completos e revisão visual executados; resultado final do CI é informado na entrega.

Fixture E2E isola contadores de rate limit entre cenários, limpando somente rateLimit no banco local descartável explicitamente validado. Não altera os limites nem desabilita proteção na aplicação. Os testes de rate limiting entre instâncias continuam na integração de auth. O runner aceita filtro opcional: `bash scripts/test-auth.sh e2e e2e/groups.spec.ts`.

Commits funcionais: `03d881e` (serviços, persistência e testes), `5abaf63` (projeção pública no serviço), `0578ba5` (interface) e `7e2afbb` (fluxos E2E e isolamento das fixtures). O commit de documentação pode ser consultado no histórico.

## Produção e próxima etapa

Nenhuma conta/grupo/participação de teste foi criada no banco de produção, e o .env não foi alterado. O preparo funcional de índices acontece na primeira inicialização do serviço autenticado; não é seed nem limpeza. Operações manuais no servidor local usam o banco real, como nas fases anteriores.

Fase 5: listas compartilhadas por contexto de grupo e reservas privadas, únicas por grupo/presente e vinculadas à edição de amigo secreto. A limpeza/cancelamento de reservas deve ser integrada às saídas/remoções e ao encerramento; histórico de sorteios também precisa ser integrado quando a Fase 6 for implementada. Não foi criado acesso genérico às listas alheias nesta entrega.

Pendências restantes: mínimo de participantes para sorteio (Fase 6), exclusão de conta/retencão e edição de perfil fora do escopo atual. A regra do último participante já está definida e não precisa ser perguntada novamente.
