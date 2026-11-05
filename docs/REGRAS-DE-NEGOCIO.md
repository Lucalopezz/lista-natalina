# Complemento definitivo — privacidade, reservas e sorteios

Recebido em 05/11/2026. Este documento prevalece sobre propostas conflitantes do planejamento inicial. Não amplia o escopo da entrega atual além de documentação e estrutura da Fase 1.

## Autorização contextual

Qualquer consulta de lista alheia ou disponibilidade e qualquer operação de reserva recebe groupId. O servidor obtém o usuário da sessão, verifica que autor e dono pertencem ao grupo solicitado e aplica a regra de seu tipo. A lista continua única por usuário; o contexto controla acesso e disponibilidade, não duplica presentes.

| Contexto | Lista própria | Lista de terceiros | Reserva |
| --- | --- | --- | --- |
| Convencional | Gerencia; sem estado de reserva | Qualquer membro do mesmo grupo | Qualquer membro autorizado, exceto dono |
| Amigo secreto sem edição ativa | Gerencia; sem estado de reserva | Negada | Negada |
| Amigo secreto com edição ativa | Gerencia; sem estado de reserva | Somente destinatário da atribuição da sessão | Somente presentes do destinatário, vinculados à edição |

Compartilhar um grupo convencional não concede acesso via outro grupo de amigo secreto. O usuário pode acessar a mesma lista pelo grupo convencional se autorizado naquele contexto. Não oferecer endpoint genérico de lista alheia autorizado somente por interseção de grupos. Não aceitar giverId do cliente para consultar resultado; usar somente a identidade da sessão. Administrador pode consultar seu próprio resultado como participante, nunca os resultados alheios. Não expor inversões das atribuições, relatórios completos ou dados secretos em caches/logs/payloads.

DTO do proprietário omite status, identidade, IDs e contagens de reservas. Terceiros autorizados recebem disponibilidade somente do grupo atual e edição atual (se amigo secreto), sem identidade do reservante. Somente reservante recebe capacidade de cancelar sua reserva. A interface precisa respeitar isso, mas a proteção é aplicada no servidor e testada sobre respostas serializadas.

## Reservas e índices

`reservations`: `_id`, `giftId`, `groupId`, `reservedBy`, `drawId` obrigatório para amigo secreto e ausente para convencional, `status` (`active` ou `cancelled`), `createdAt`, `updatedAt`, `cancelledAt` opcional. Estado cancelado mantém o vínculo histórico; retenção a definir antes de exclusão de contas/histórico.

Índice único parcial: `{ groupId: 1, giftId: 1 }`, com `partialFilterExpression: { status: "active" }`. A edição não integra essa unicidade: nunca pode haver duas reservas ativas do mesmo presente no mesmo grupo, mesmo durante troca de edição. Índice `{ groupId: 1, drawId: 1, status: 1 }` auxilia cancelamento de edição. O mesmo presente em grupos diferentes pode ter diferentes reservantes. Nenhuma promessa de evitar compra duplicada entre grupos: a independência é intencional.

Reserva verifica participação de ambos, contexto, destinatário/edição e dono. Inserção usa índice único como garantia final e traduz conflito para indisponível. Cancelamento manual só pelo reservante; invalidação/saída/exclusão podem cancelar sistemicamente. Saída/remoção de grupo convencional cancela reservas do usuário como reservante ou como dono naquele grupo; outros grupos não são afetados. Mudanças concorrentes de acesso e reserva exigem transação e escrita de versão no grupo compartilhado, não apenas leituras de autorização.

## Sorteios, invalidação e concorrência

`groups` mantém `adminId`, `type`, `membershipVersion` e `activeDrawId` (ausente quando não há edição ativa). Participantes são referências na coleção `memberships`, com unicidade groupId/userId. Uma versão de escrita/coordenação do grupo também serializa reservas e alterações de autorização quando necessário; não reutilizar membershipVersion para representar mudanças que não alteram composição.

`draws._id` identifica unicamente cada edição. Campos: groupId, membershipVersion, status (`active`/`invalidated`), createdBy, createdAt e invalidatedAt. Índice único parcial groupId para status=active; somente uma edição ativa por grupo. Atribuições separadas em `assignments`, únicas por (drawId,giverId) e (drawId,recipientId). Resultados antigos permanecem inacessíveis após invalidação.

Refazer, somente pelo administrador:

1. Interface confirma explicitamente que resultados e reservas da edição atual serão invalidados.
2. Backend valida sessão/administração/tipo/estado/versão; não confiar na confirmação do navegador como autorização.
3. Transação invalida edição anterior, cancela reservas com groupId + drawId anterior + status ativo, grava nova edição e atribuições e troca activeDrawId.
4. Commit único publica resultado; qualquer erro desfaz tudo. Nenhuma reserva de outro grupo é alterada.

Invalidação explícita é operação distinta de refazer: somente administrador; invalida edição, cancela reservas dela e remove activeDrawId na mesma transação, sem criar outro sorteio. Depois disso membros podem ser alterados. Refazer diretamente não abre janela intermediária de edição de membros.

Durante edição ativa, adição, remoção e saída são bloqueadas no servidor, inclusive para administrador. Transferência de administração é permitida e não altera resultados nem reservas, mas antigo administrador continua impedido de sair até invalidação. Antes do sorteio/ após invalidação, mudanças são permitidas conforme permissões.

Transações escrevem o mesmo documento de coordenação do grupo e verificam versão/activeDrawId para serializar novo sorteio, invalidação, reserva e membros. Reexecutar transações somente com política limitada do driver, sem efeitos externos dentro do callback; erro esgotado produz feedback de conflito. Testes reais verificam ausência de write skew e cancelamento atômico. Replica set/Atlas é requisito.

## Administração

Criador é membro e administrador inicial. Exatamente um administrador ativo em grupo existente. Somente ele adiciona/remove membros, edita grupo, transfere administração e inicia/refaz/invalida sorteio. Transferir valida que destinatário é membro atual e altera adminId atomicamente. Antigo administrador perde poderes imediatamente; requisições subsequentes validam o admin atual, sem usar papel persistido na sessão. Grupo com outros participantes nunca pode ficar sem administrador. Saída do administrador exige transferência prévia, além da restrição de sorteio ativo. Último membro ainda depende da regra de encerramento a confirmar.

## Matriz de testes adicionais obrigatórios

Estes testes serão escritos antes da implementação dos comportamentos nas Fases 4–6. Nesta Fase 1 não existe serviço de domínio; registrar aqui não significa que testes de domínio já foram implementados.

| Área / fase | Casos |
| --- | --- |
| Privacidade / 5–6 | Lista alheia negada antes do sorteio; após sorteio somente destinatário; resultado alheio negado inclusive ao admin; admin acessa apenas seu próprio resultado; convencional permite listas entre membros; contexto de grupos distintos avaliado independentemente |
| Reservas / 5–6 | Mesmo presente reservado em dois grupos; duas reservas ativas concorrentes no mesmo grupo deixam exatamente uma; sem autorização negada; dono negado; amigo secreto exige destinatário e edição ativa; dono não recebe qualquer informação de reserva; só reservante cancela |
| Sorteios / 6 | Refazer invalida edição anterior e cancela reservas dela; reservas de outros grupos preservadas; falha intermediária faz rollback completo; reservas concorrentes com novo sorteio/invalidação não sobrevivem vinculadas a edição inválida; duplo sorteio deixa uma única edição ativa |
| Participantes / 4–6 | Saída/remoção/adição negadas com edição ativa por chamadas diretas; permitidas após invalidação e por quem tem permissão; somente admin invalida; concorrência entre adição/saída e sorteio não produz composição inconsistente |
| Administração / 4 | Admin não sai sem transferir; destinatário precisa ser membro; novo admin ganha poderes e anterior perde; transferência preserva sorteio; antigo admin continua sujeito ao bloqueio de saída com sorteio ativo; grupo nunca fica com membros e sem admin |

Testes HTTP/DTO verificam ausência de campos confidenciais; integração MongoDB isolada verifica índices parciais, transações e requisições concorrentes. Os cenários originais de cadastro/presentes/sorteios continuam obrigatórios.

## Definições complementares da Fase 2

- Senha: 6 a 128 caracteres. Sessão: 7 dias. Sem confirmação de email nem recuperação de senha, por decisão explícita do usuário.
- Banco do `.env` é produção. Testes de escrita, cadastros automatizados e exclusão/limpeza só podem ocorrer no MongoDB descartável criado pelo runner.
- Interface: Tailwind CSS e paleta natalina (verde pinheiro, vermelho, dourado e creme).

## Definição complementar da Fase 3

A URL da imagem do presente é opcional, conforme instrução explícita do usuário. Quando ausente/em branco, usar uma ilustração local padrão; quando informada, validar HTTP/HTTPS e rejeitar esquemas inseguros e credenciais embutidas. Falha de carregamento também mostra a ilustração. Nome, descrição e link do produto continuam obrigatórios. O banco guarda imageUrl vazio quando não fornecido, sem vincular o registro ao domínio da aplicação.
