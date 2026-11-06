# Registro de implementação — amigo secreto

## Comportamento entregue

Administrador pode realizar sorteio com no mínimo três participantes, refazer ou cancelar com confirmação. Cada participante abre Meu amigo secreto e recebe apenas seu destinatário, perfil mínimo e presentes com disponibilidade daquele grupo. Reservar/cancelar permanece na tela do próprio resultado.

Novo sorteio invalida a edição anterior e cancela suas reservas no mesmo commit, preservando outros grupos. Cancelar invalida sem criar outra edição e libera mudanças na composição. Transferência de administração preserva resultados e muda imediatamente quem pode administrar o sorteio.

O usuário confirmou mínimo de três e solicitou documentação organizada por funcionalidades, sem apresentação por fases no README e nos guias principais. Registros antigos foram preservados separadamente em docs/historico.

## Arquitetura e dados

`secret-santa/algorithm.ts` usa Fisher–Yates com crypto.randomInt e rejeita qualquer autoatribuição. A entrada é copiada, há no máximo 128 tentativas e nenhuma atribuição é persistida se falhar. Cada geração é independente e pode repetir pares anteriores.

`service.ts` exige sessão validada na borda, admin atual, tipo correto, composição íntegra e revisão/composição esperadas. Confere novamente as invariantes do resultado antes da escrita.

`repository.ts` disputa o documento do grupo, relê permissões e publica metadados, atribuições, cancelamento e ponteiro na mesma transação snapshot/majority. drawRevision muda apenas com iniciar/refazer/invalidar; ausência significa zero para grupos anteriores. writeVersion não é entregue ao cliente, pois também muda com reservas.

`reservations.secretSanta` lê edição ativa, atribuição do giverId da sessão, perfil, presentes e disponibilidade no mesmo snapshot. Não recebe giverId arbitrário e não retorna drawId ou coleções de pares. A tela do resultado não possui controles administrativos.

Índices garantem uma edição ativa por grupo, um destinatário por autor/edição e uma única vez como destinatário/edição. O índice de histórico é groupId/createdAt desc. Resultados invalidados permanecem inacessíveis aos fluxos atuais, sem endpoint de histórico coletivo.

## Páginas e componentes

- `/grupos/[id]`: controles administrativos com confirmação e link ao próprio resultado.
- `/grupos/[id]/amigo-secreto`: resultado da sessão, presentes e disponibilidade; estado sem sorteio e negação genérica.
- `/amigos-secretos`: grupos próprios com sorteio ativo, paginados.
- Dashboard: atalhos para resultados sem publicar destinatários no conjunto de cards.
- Server Components mantêm consultas e montagem de dados privados; DrawControls e botões são Client Components para interatividade.

O filtro dos grupos ativos ocorre antes do limite de página; grupos convencionais recentes não escondem um amigo secreto antigo. O menu mantém Meus grupos ativo também na página agregadora de amigos secretos.

## Testes e verificação

TDD registrou falhas antes de implementar algoritmo, serviço, consulta individual, actions e controles. A regressão de navegação falhou por ausência de aria-current antes do ajuste.

- 198 testes isolados no projeto: invariantes com 3, 4, 5, 10, 31 e 100 participantes; ausência de duplicatas/autoatribuição; tentativas limitadas; permissões; revisões antigas; resultado inválido; sessão/confirmação; retorno à seção correta.
- 77 testes de integração: criação real, privacidade, invalidação e novo sorteio, cancelamento de reservas preservando outros grupos, rollback após escrita de atribuições, operação dupla, disputa com composição/reserva e transferência de administração.
- 16 E2E desktop/celular: fluxo com três sessões, mínimo, cancelamento de confirmação, resultados diferentes por autor, giverId forjado ignorado, listas alheias negadas, reserva, novo sorteio, invalidação e saída liberada depois dela.

Capturas das telas de resultado foram revisadas. Lint, TypeScript e build passaram. Todos os dados automatizados são exclusivos do MongoDB descartável; .env e banco de produção foram preservados. O resultado remoto do CI é informado na entrega.

Commits funcionais: `3e07a36` (algoritmo/regras), `d688a82` (persistência/consulta), `bc644a2` (interface/actions) e `01edc92` (E2E). A reorganização documental tem commit separado, consultável no histórico.

## Documentação e continuidade

O README e os guias principais descrevem uso, arquitetura, regras e testes por funcionalidade. O guia técnico contém exemplos e um mapa explícito de Server/Client Components. Próximo trabalho: revisão final de segurança/acessibilidade e preparação para deploy, sem publicar automaticamente.
