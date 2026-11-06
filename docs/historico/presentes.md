# Fase 3 — lista pessoal de presentes

## Resultado

Usuários autenticados podem cadastrar, editar, excluir e percorrer sua lista pessoal de presentes. Cada item contém nome, descrição, produto, imagem opcional, proprietário e datas do servidor. A imagem deixou de ser obrigatória por decisão explícita do usuário nesta fase: campo vazio mostra uma ilustração local de presente, assim como uma imagem externa que falhe ao carregar.

Interface mobile-first em Tailwind com a paleta natalina existente, cards, links seguros, estado vazio, carregamento, erros por campo, feedback de sucesso e confirmação de exclusão. Dashboard e navegação agora oferecem acesso à lista.

## Fluxo e arquivos

1. `validation.ts` define nome de 1–120 caracteres, descrição de 1–2000, URLs de até 2048 e IDs MongoDB válidos. Texto é normalizado; somente HTTP/HTTPS sem credenciais embutidas são aceitos. Imagem ausente, null ou em branco vira string vazia. Produto continua obrigatório.
2. `actions.ts` verifica a sessão a cada mutação, extrai somente campos permitidos do FormData e valida antes de inicializar persistência. Não aceita ownerId, datas ou estado de reserva do cliente. Exclusão exige confirm=excluir. Falhas não revalidam; sucesso revalida a lista/edição e redireciona fora do catch do erro de negócio.
3. `service.ts` concentra os casos de uso e a identidade confiável recebida da borda autenticada. Datas vêm do servidor; criação/proprietário não mudam na edição. A projeção de saída é explícita e nunca inclui estado/identidade de reservas, mesmo se o documento ganhar novos campos no futuro.
4. `repository.ts` usa o driver oficial e filtra simultaneamente `_id` e `ownerId` nas leituras individuais, atualizações e exclusões. A escrita não depende de uma consulta de autorização anterior. Erros do driver são sanitizados antes de alcançar o framework.
5. `server.ts` inicializa serviço/índice de forma lazy e idempotente por instância, sem sessão ou resultados privados em cache compartilhado.
6. `components` contém formulário controlado (preserva entrada após erro), cards, imagem e diálogo nativo de exclusão, com foco/Escape/fundo inerte. URLs externas de imagem são carregadas diretamente pelo navegador, sem habilitar proxy Next.js para hosts arbitrários. Referrer-Policy no-referrer evita enviar o caminho privado como referência.

## Rotas e comportamento

| Rota | Comportamento |
| --- | --- |
| `/presentes` | Somente a lista do usuário autenticado; até 24 itens por página |
| `/presentes?cursor=ID` | Próxima página por cursor validado; sem permitir escolher outro proprietário |
| `/presentes/novo` | Formulário de cadastro |
| `/presentes/[id]/editar` | Formulário preenchido somente se o usuário for proprietário |

Nenhum endpoint de lista alheia foi criado. Compartilhamento exigirá contexto explícito de grupo na Fase 5. ID inexistente, inválido e pertencente a terceiro levam à mesma apresentação “Presente não encontrado”, sem revelar nome, descrição ou URLs. Como o Next.js usa streaming com loading.tsx, a resposta pode manter HTTP 200 após enviar os headers; a UI de not-found e metadata noindex continuam sendo emitidas. O teste verifica a negação e ausência dos dados no payload, além da apresentação.

## Persistência e paginação

Coleção `gifts`: `_id: ObjectId`, `ownerId: ObjectId`, name, description, productUrl, imageUrl, createdAt e updatedAt (BSON Date). DTOs usam IDs string e datas ISO UTC. A imagem padrão é uma decisão de apresentação: imageUrl vazio permanece vazio no banco, evitando gravar domínio de produção ou caminho de asset como URL de produto fornecida pelo usuário.

Índice `{ ownerId: 1, _id: -1 }`. A paginação usa `_id` em ordem decrescente, estável após edição, e consulta um item extra para determinar a próxima página. Evita skip crescente e uma contagem completa da coleção. Isso substitui a proposta inicial de índice por createdAt: o identificador gerado no servidor já permite navegação estável e simples; dentro do mesmo segundo, a ordem entre instâncias é a ordem dos IDs, não uma garantia estrita de relógio de criação.

O tamanho de página é um limite por consulta, não um limite de presentes cadastrados. Integração percorre 50 itens em páginas sem duplicações nem mistura entre usuários. Índice é preparado na primeira inicialização funcional do serviço; não há seed ou migração destrutiva.

## TDD e verificações

- 77 testes isolados no projeto (39 novos/ajustados de presentes, além da base e autenticação): validação, URLs, identidade, CRUD, projeção sem reservas, cursor, actions, confirmação e erros sanitizados.
- 23 testes de integração com MongoDB real descartável: 14 de autenticação e 9 de presentes. Cobrem persistência, tentativas por terceiro, imutabilidade do proprietário/criação, exclusão, paginação, índice e imagem vazia.
- 8 testes de navegador: 4 cenários em desktop/celular, cobrindo auth, CRUD com URL inválida, edição, cancelamento/confirmação de exclusão, isolamento entre sessões e imagem opcional padrão.
- A correção de imagem opcional teve falha observada antes da implementação: schema e action rejeitavam ausência/null. Depois da alteração, os cenários passam.
- Os cenários E2E de presentes foram escritos antes das páginas; inicialmente falharam nas rotas/formulários ausentes. A expectativa de HTTP 404 foi ajustada ao contrato de streaming documentado do Next.js, sem enfraquecer a verificação de privacidade do conteúdo.
- Lint, TypeScript, build e revisão visual mobile/desktop, incluindo cards e diálogo. Verificações específicas e resultados finais são informados na entrega.

Comandos: `pnpm check`, `pnpm test:integration`, `pnpm test:e2e`. O runner existente `scripts/test-auth.sh` agora seleciona todas as suites `.integration.test.ts`. Suites usam bancos separados, com nomes fixos de teste e URI local validada, para não interferirem no teardown umas das outras. E2E sobrescreve explicitamente as variáveis do servidor temporário.

## Produção e limites

Nenhum presente ou usuário automatizado foi criado no banco de produção. O `.env` não foi alterado nesta fase. Testes de escrita usam somente MongoDB descartável em tmpfs, com limpeza dos próprios recursos. A aplicação local continua conectada à produção: operações manuais nela são reais.

Não foram implementados grupos, leitura de listas alheias nem reservas. Quando reservas forem adicionadas, a exclusão de presente precisará integrar cancelamento transacional das reservas relacionadas e sua coordenação de concorrência (Fase 5), sem revelar esses dados ao dono. Nenhuma regra nova de sorteio foi inferida nesta fase.

## Próxima etapa

Fase 4: criação e gerenciamento de grupos, busca/inclusão direta de membros, transferência de administração e dashboard de grupos. Antes das operações afetadas, definir encerramento pelo último participante e, na Fase 6, mínimo de participantes do sorteio. As regras definitivas de privacidade, bloqueio de composição e administração continuam em REGRAS-DE-NEGOCIO.md.

## Commits

- `87ff062` — casos de uso, repositório, autorização, actions e testes.
- `78357db` — imagem opcional com normalização de campo vazio.
- `6b40b21` — telas da lista, formulário, cards, confirmação e ilustração padrão.
- `972b697` — cenários de navegador em duas sessões, desktop e celular.
- Documentação de encerramento registrada em commit separado.
