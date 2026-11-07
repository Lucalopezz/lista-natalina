# Arquitetura e modelagem

## Visão geral

Aplicação full-stack em Next.js App Router, React e TypeScript estrito, com MongoDB e runtime Node.js. A lista de presentes pertence à pessoa; o grupo define quem pode consultá-la e a disponibilidade das reservas naquele contexto. Interface mobile-first com Tailwind CSS, linguagem direta e paleta natalina.

## Organização por funcionalidades

| Local | Responsabilidade |
| --- | --- |
| `src/app` | Rotas, layouts, páginas e adaptadores HTTP |
| `src/modules/auth` | Identidade, credenciais, sessões e contrato HTTP |
| `src/modules/gifts` | Lista pessoal e projeção permitida dos presentes |
| `src/modules/groups` | Participações, administração e consultas do dashboard |
| `src/modules/reservations` | Política contextual, reservas, disponibilidade e resultado individual com sua lista |
| `src/modules/secret-santa` | Algoritmo, ciclo de vida das edições e operações administrativas |
| `src/lib/env` | Validação lazy de configuração privada |
| `src/lib/db` | Cliente MongoDB reutilizável por instância |
| `src/components` | Apresentação comum e navegação |

Em cada módulo, `validation.ts` valida entrada; `service.ts` aplica autorização e regras; `repository.ts` implementa consultas e transações; `server.ts` monta dependências; `actions.ts` adapta formulários; `types.ts` define os contratos. Abstrações existem para permitir testes de regras sem banco e transações reais com o mesmo serviço, sem repositório genérico ou classes vazias.

Fluxo de alteração: formulário → Server Action → sessão e validação → serviço → repositório → DTO explícito. Leituras podem chamar serviços diretamente de Server Components, sem API HTTP intermediária. Auth usa Route Handlers para preservar cookies e rate limiting do Better Auth.

Busca interativa de candidatos usa GET /api/grupos/[id]/pessoas, privado e sem cache. Somente o campo de busca é cliente; o adaptador chama o mesmo serviço autorizado em snapshot. Aceita trechos, acentos portugueses e um erro em palavras de 4–32 letras, ordenando correspondências literais antes das aproximações. Cursor inclui relevância e ID; páginas de 20 e maxTimeMS de dois segundos limitam resposta e execução, sem garantir uso eficiente de índice para busca aproximada em diretórios grandes.

## Servidor e navegador

- Páginas/layouts são Server Components por padrão. Leem identidade e dados no servidor.
- Formulários, diálogos, menu ativo e imagem com fallback são Client Components, com estado/eventos locais. A página inteira não precisa se tornar cliente para conter um botão interativo.
- Client Components podem receber HTML inicial renderizado no servidor; hidratação conecta os eventos no navegador.
- Server Actions autenticam cada chamada e não confiam em IDs bound como permissão. Zod valida também operações feitas diretamente, fora da UI.
- Repositórios/conexão/algoritmo têm dependências exclusivas do servidor. Não há credenciais, pares coletivos ou acesso MongoDB no bundle cliente.
- Configuração e conexões são reutilizadas por instância; dados privados não usam cache compartilhado entre pessoas.

## Bibliotecas

| Área | Escolha e motivo |
| --- | --- |
| Dados | Driver oficial MongoDB: índices, pool e transações explícitos |
| Validação | Zod: validação em execução e schemas próximos do domínio |
| Autenticação | Better Auth e adapter MongoDB: scrypt, cookies e sessões persistidas |
| Formulários | HTML nativo, estado local e useActionState; sem dependência adicional |
| Interface | Tailwind e componentes semânticos próprios; sem kit pesado |
| Testes | Vitest para regras/actions/integração; Playwright para navegador |

pnpm e lockfile fixam instalação reproduzível; Node.js 24 é o alvo de desenvolvimento/CI/hospedagem. Versões exatas resolvidas estão no lockfile.

## Modelagem MongoDB

IDs BSON ObjectId são convertidos para strings em contratos de aplicação; datas BSON UTC viram ISO nos DTOs. Referências evitam duplicar listas e crescer arrays ilimitados dentro de um grupo.

| Coleção | Campos principais | Índices/garantias |
| --- | --- | --- |
| `user` | Perfil, email normalizado e datas | Email único, nome para pesquisa |
| `account` | Credencial/identificadores do adapter e hash de senha | providerId/accountId únicos; userId |
| `session` | Token, userId e validade | Token único; userId; TTL expiresAt |
| `rateLimit` | Contadores de tentativas | Chave única, persistência entre instâncias |
| `gifts` | Dono, nome, descrição, URLs, datas e reservationVersion interno | ownerId + _id desc para paginação |
| `groups` | Nome, tipo, adminId, memberCount, membershipVersion, writeVersion, activeDrawId e drawRevision | adminId; documento compartilhado de coordenação |
| `memberships` | groupId, userId, joinedAt | Único groupId/userId; userId/groupId desc |
| `reservations` | groupId, giftId, ownerId, reservedBy, drawId opcional, estado e datas | Único parcial groupId/giftId quando active; índices de cancelamento por grupo/edição/dono/reservante e por presente |
| `draws` | Edição, grupo, versão da composição, estado, criador e datas | Uma edição ativa por grupo; grupo/data |
| `assignments` | drawId, giverId, recipientId | Únicos drawId/giverId e drawId/recipientId |

O contrato de verificação do adapter não corresponde a um fluxo de confirmação/recuperação oferecido pelo produto. Atribuições e reservas não são incorporadas a perfis/presentes: documentos completos desses vínculos não podem vazar junto da lista pessoal.

`memberCount` é atualizado na mesma transação que memberships. `ownerId` da reserva vem do presente e permite limpeza eficiente quando seu dono sai. MongoDB não oferece chaves estrangeiras automáticas; os serviços verificam referências e coordenam mudanças relacionadas.

## Consistência e concorrência

### Grupos e presentes

Criar grupo e incluir criador são atômicos. Toda mutação do grupo disputa sua escrita e relê participação/administração, impedindo uso de poderes antigos após transferência. membershipVersion muda somente com composição; writeVersion coordena também reservas e sorteios, sem aparecer na resposta pública.

Leitura do grupo e pesquisa de candidatos verificam permissão e consultam dados no mesmo snapshot transacional. Uma leitura já iniciada pode concluir com o estado anterior à revogação, sem incorporar membros/contas surgidos depois. Leituras não escrevem writeVersion; novas requisições observam a permissão atual.

Reserva/cancelamento disputam grupo e presente. Exclusão de presente disputa a mesma escrita por reservationVersion, cancela reservas em todos os grupos e remove o item em uma transação. Saída/remoção cancela reservas como dono ou reservante somente no grupo afetado. Encerramento cancela remanescentes do grupo.

### Amigo secreto

O mínimo é três. Fisher–Yates com crypto.randomInt embaralha os destinatários; permutações com autoatribuição são rejeitadas. Cada pessoa dá e recebe exatamente uma vez. Tentativas são limitadas; falha não publica resultado parcial. Refazer pode repetir pares da edição anterior, pois cada geração é independente.

Iniciar/refazer/cancelar exige administrador e confirmação. A operação escreve o grupo, compara a revisão e composição esperadas e então executa todo o ciclo no mesmo commit: invalidar anterior, cancelar suas reservas, persistir nova edição/atribuições quando aplicável e publicar o ponteiro.

`drawRevision` só muda com operações de sorteio. Grupos anteriores sem esse campo equivalem à revisão zero. O cliente não recebe writeVersion como marcador de estado, pois ele revelaria atividade de reservas. Um formulário antigo não pode cancelar/refazer uma edição posterior.

Leitura do resultado usa apenas giverId da sessão; edição, perfil e disponibilidade são lidos no mesmo snapshot. Administração não concede leitura de outros resultados. Reserva no amigo secreto exige a edição atual e o destinatário correto.

### Transações

Replica set/Atlas é necessário. Operações usam readConcern snapshot e writeConcern majority; o driver gerencia repetição/commit. Callback repetível não tem emails, notificações ou efeitos externos. Falha desfaz ponteiros, atribuições, participações e cancelamentos da operação. Não existe implementação paralela baseada apenas em consultar e depois gravar sem coordenação.

## Contratos públicos e segurança

- Autor vem da sessão, nunca do formulário. Perfis alheios contêm apenas id/nome.
- DTO do dono omite estado, identidade, contagem e IDs de reservas; reservar não muda suas datas públicas.
- Terceiros autorizados recebem somente disponibilidade e canCancel no grupo atual.
- Convencional compartilhado não concede acesso pelo contexto de outro amigo secreto.
- Links aceitam HTTP/HTTPS, sem credenciais embutidas ou esquemas executáveis; descrições são texto React.
- Cookies são HttpOnly, SameSite=Lax e Secure com HTTPS; senha scrypt de 6–128 caracteres, sessão de sete dias.
- Falhas privadas são sanitizadas; não há URI, senha, token ou resultado coletivo em mensagens/logs.
- POSTs de autenticação limitam corpo real a 8192 bytes; logout aceita corpo vazio e descarta campos extras.
- Cabeçalhos restringem incorporação, sniffing, referrer e permissões de hardware. A CSP é parcial; textos React e validação de URLs continuam necessários. Páginas privadas orientam indexadores com noindex/nofollow, sem substituir autenticação.

## Testabilidade e operação

Testes ficam junto dos módulos. Serviços recebem repositórios substituíveis para testes isolados; integração usa MongoDB real descartável com replica set; E2E usa sessões independentes em desktop/celular. O runner valida URI local de testes, sobrescreve variáveis e nunca usa o banco configurado de produção para escrita automatizada.

Conexão é lazy, com promessa compartilhada por instância, pool máximo de dez conexões e recuperação após falha inicial. Build não exige banco. Produção usa um projeto Next.js/Node.js 24 na Vercel, sem processo permanente nem armazenamento local persistente. Por decisão do usuário, não há preview: publicações são feitas pela CLI com --prod, com variáveis somente em Production e deploys automáticos por Git desativados.

## Decisões ainda abertas

Edição de perfil e exclusão de conta/retenção de histórico precisam de definição própria. Configuração de publicação e verificações do ambiente estão no [guia de deploy](DEPLOY.md). Publicar exige autorização específica e validação da infraestrutura real. Não há alteração silenciosa dessas regras por conveniência de implementação.

## Referências oficiais

- Next.js / App Router: <https://nextjs.org/docs/app/getting-started/installation>
- Driver MongoDB: <https://www.mongodb.com/docs/drivers/node/current/connect/>
- Pool MongoDB: <https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/connection-pools/>
- Better Auth: <https://better-auth.com/docs/installation>

Consulte também as instruções da versão instalada em node_modules/next/dist/docs ao modificar o framework. O histórico de implementação fica separado em `docs/historico`; não substitui o código, os testes ou as regras atuais.
