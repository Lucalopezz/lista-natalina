# Fase 5 — listas compartilhadas e reservas

## Entrega e uso

Em um grupo convencional, abra “Ver lista de presentes” abaixo do nome de alguém. A página mostra a lista pessoal dessa pessoa, sem duplicar presentes por grupo. Cada card oferece “Reservar presente” quando disponível e “Cancelar minha reserva” somente a quem reservou. Cancelamento pede confirmação; reservar não significa compra.

Disponibilidade pertence ao grupo atual. Um item pode estar reservado por uma pessoa na Família e disponível — ou reservado por outra pessoa — nos Amigos. O dono não vê status, reservante, capacidade de cancelar, contagem ou ID de reserva, tanto na lista pessoal quanto na rota contextual.

Amigo secreto não libera listas alheias antes do sorteio; com edição válida, autor só acessa seu destinatário. Compartilhar outro grupo convencional não muda essa regra. Esta fase prepara e testa essa política, mas não executa sorteio, invalidação ou novo sorteio. Isso permanece na Fase 6.

## Arquivos e responsabilidades

| Local | Responsabilidade |
| --- | --- |
| `reservations/validation.ts` | Valida groupId, ownerId, giftId e cursor |
| `reservations/service.ts` | Autoriza contexto, lista, reserva e cancelamento; projeta DTOs |
| `reservations/types.ts` | Contrato de unidade transacional e dados públicos |
| `reservations/repository.ts` | Snapshot, coordenação de grupo/presente, consultas e índices |
| `reservations/persistence.ts` | Cancelamento sistêmico na sessão da operação que revogou acesso |
| `reservations/server.ts` | Inicialização lazy, índices idempotentes e serviço por instância |
| `reservations/actions.ts` | Sessão, validação, confirmação, revalidação e redirecionamento |
| `reservations/components` | Card contextual e botão de reserva/cancelamento |
| `gifts/dto.ts` | Projeção comum do presente, sem metadados privados |
| `gifts/repository.ts` | Exclusão transacional com cancelamento em todos os grupos |
| `groups/repository.ts` | Cancelamento na saída, remoção e encerramento |
| `grupos/[id]/listas/[ownerId]` | Página, carregamento e negação genérica de acesso |
| `grupos/[id]/page.tsx` | Links por participante conforme o contexto da sessão |

Não foram adicionadas dependências. `GiftCardFrame` reaproveita imagem, detalhes e link da loja; cada contexto fornece apenas suas ações permitidas. A parte interativa fica no botão, usando useActionState e diálogo nativo; regras não foram movidas para React.

## Contrato da rota

`/grupos/[id]/listas/[ownerId]` exige sessão e IDs válidos. Recebe cursor opcional para páginas de 24 itens, sem limite total. Resposta visual inclui nome do grupo, perfil mínimo id/nome, presentes e paginação. Sem sessão, redireciona para entrada. ID inexistente, não membro, dono fora do grupo ou lista não permitida têm a mesma página “Lista não encontrada”, sem revelar dados privados.

Server Actions recebem IDs bound, mas os validam de novo. Reservante vem exclusivamente da sessão; edição vem do grupo atual. Campos forjados reservedBy/drawId não são lidos. Sucesso revalida a rota e redireciona com feedback. Erros conhecidos são traduzidos; falhas de infraestrutura não expõem URI ou detalhes do driver.

Se outra pessoa reservar enquanto a tela está aberta, o backend nega a segunda reserva. A tela mostra o conflito e “Atualizar lista”, que busca novo snapshot sem repetir a mutação. Não foram introduzidos polling, WebSockets ou atualização instantânea entre sessões.

## Modelagem e índices

`reservations`: _id, groupId, giftId, ownerId, reservedBy, drawId apenas em amigo secreto, status active/cancelled, createdAt, updatedAt e cancelledAt quando cancelada. IDs são ObjectId; datas BSON UTC. ownerId vem do documento do presente, imutável pelo aplicativo, e serve ao cancelamento eficiente quando seu dono sai do grupo. Não é aceito do formulário como autoridade.

Índices:

- Único parcial (groupId,giftId), com status=active. A edição não entra na chave, impedindo duas reservas ativas mesmo durante troca de edição.
- (groupId,drawId,status), (groupId,reservedBy,status), (groupId,ownerId,status) e (giftId,status) para cancelamento e consultas.
- Leitura de amigo secreto prepara unicidade (drawId,giverId), (drawId,recipientId) e uma edição ativa por groupId. Criar esses índices não gera resultados.

Reservas canceladas preservam referências históricas, inclusive quando presente/grupo foi excluído. Não existe endpoint público de histórico; política de retenção/exclusão de conta continua pendente. Não houve migração de registros nem seed de produção, pois a funcionalidade ainda não existia.

## Concorrência, atomicidade e privacidade

Reserva/cancelamento escrevem o grupo, incrementando writeVersion, antes de reler participação e contexto. Isso coordena com adição/saída/remoção/transferência. Depois disputam uma escrita no presente por reservationVersion. O contador é interno e não altera updatedAt do presente nem do grupo, evitando sinalizar ao dono que houve reserva.

Exclusão de presente disputa esse mesmo documento, cancela suas reservas em todos os grupos e remove o item no mesmo commit. Se a reserva vence primeiro, a exclusão a cancela; se a exclusão vence, a repetição da reserva não encontra o item. Saída/remoção cancelam reservas do usuário como reservante ou dono apenas no grupo afetado, dentro da transação que remove a participação. Encerramento cancela remanescentes daquele grupo, preservando contas, listas e outros grupos.

Transações usam readConcern=snapshot e writeConcern=majority, com sessão encerrada em finally. Leituras também usam snapshot, para não combinar autorização, presentes e disponibilidade de instantes diferentes. O driver gerencia conflitos/repetições; não há efeitos externos dentro de callbacks repetíveis. Atlas/replica set é necessário.

A atribuição é lida somente por edição ativa + giverId da sessão. A edição deve corresponder ao grupo e à versão da composição, com status active. Resultado antigo, edição de outro grupo ou composição divergente falham fechados. Admin não tem exceção. A integração com invalidação/nova edição real será implementada e testada novamente na Fase 6.

A disponibilidade consulta somente os presentes da página e o grupo/edição atuais, projetando internamente giftId/reservedBy. O DTO público de terceiro recebe apenas availability e canCancel; o do dono nem consulta reservations. Seus campos públicos e datas permanecem iguais antes e depois da reserva. Não há cache compartilhado de perfis, resultados ou listas.

## TDD e verificação

- Serviço: 21 testes novos, cobrindo autorização contextual, dono, destinatário, perfil mínimo, DTOs, validação e operações.
- Actions: oito testes novos, incluindo sessão, IDs adulterados, identidade/edição forjadas, confirmação, conflito e ausência de erros privados.
- Integração: 21 testes novos no projeto, com 19 na suíte de reservas e dois de regressão nos módulos existentes. Índice parcial real, reservas simultâneas, independência entre grupos, cancelamento por terceiro negado, paginação, rollback e corrida com saída/remoção/exclusão.
- A corrida com invalidação usa fixture explícita do protocolo transacional futuro. Não comprova uma funcionalidade de invalidação já entregue; o caso de uso da Fase 6 ainda não existe.
- Falha observada antes da implementação da consulta contextual e das actions. As regressões de saída/exclusão foram executadas no código anterior e falharam por reservas ativas remanescentes, antes de acrescentar a limpeza transacional.
- E2E escrito antes das telas falhou pela ausência do link para a lista. O fluxo usa três sessões para consultar, reservar, negar duplicata com tela antiga, atualizar, cancelar/desistir, ocultar tudo do dono, preservar outro grupo e retirar acesso na saída. Convencional compartilhado não libera acesso pelo amigo secreto sem sorteio.

Verificação local final: `pnpm check` passou com 152 testes isolados, lint, tipos e build; integração passou com 58 testes e E2E com 14 cenários desktop/celular. Capturas da nova página foram revisadas e os links locais da documentação conferidos. Resultado remoto do CI e commits são informados na entrega. Os runners usam MongoDB descartável em tmpfs; .env e banco de produção foram preservados. Não houve deploy nesta etapa.

Fluxo conferido com a skill vercel:verification:

| Fronteira | Evidência |
| --- | --- |
| Grupo → lista | Link do participante abre a nova rota; E2E multissessão |
| Formulário → servidor | Action autentica IDs/sessão e devolve feedback; oito testes isolados |
| Servidor → dados | Índice parcial, rollback e concorrência real; 58 testes de integração no projeto |
| Dados → resposta | DTO do dono idêntico antes/depois; edição/reservante ausentes dos dados públicos |
| Resposta → interface | Reserva, cancelamento, conflito e atualização observados no navegador |

Commits funcionais: `dc07574` (regras/DTO), `c626e92` (persistência e limpeza), `39dffc3` (actions e interface) e `48cf47f` (E2E e regressão de privacidade). O commit documental pode ser consultado no histórico.

## Próxima etapa

Fase 6: confirmar o mínimo de participantes e implementar geração, consulta individual, invalidação explícita e novo sorteio com cancelamento atômico das reservas da edição. Reutilizar a coordenação por grupo e repetir os testes de concorrência contra o caso de uso real, sem substituir por fixtures.
