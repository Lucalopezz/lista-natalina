# Contexto central — Lista Natalina

Atualizado em 06/11/2026. Confira código, Git e verificações atuais antes de concluir que um registro anterior permanece válido. Regras de trabalho: [AGENTS.md](AGENTS.md).

## Objetivo e fontes

Aplicação full-stack mobile-first para listas pessoais, grupos, reservas privadas e amigo secreto. Next.js App Router, TypeScript estrito e MongoDB, compatível com Vercel. A interface também atende pessoas mais velhas, com textos literais, fonte base 18 px, controles confortáveis e navegação simples.

Fontes: instruções atuais do usuário; [regras de negócio](docs/REGRAS-DE-NEGOCIO.md); [arquitetura/modelagem](docs/PLANO.md); [guia do projeto](docs/COMO-O-PROJETO-FUNCIONA.md). O usuário pediu que README e guias principais sejam organizados por funcionalidades, sem divisões por fases. Registros históricos ficam em docs/historico, separados da documentação atual.

## Implementado

- Cadastro, login, logout, sessão e perfil próprio.
- Lista pessoal completa, edição/exclusão apenas pelo dono, paginação de 24 sem limite total.
- Imagem opcional com ilustração local padrão, inclusive em falha de carregamento.
- Grupos convencionais e amigo secreto; inclusão direta sem convite; administração, remoção, saída e transferência.
- Listas autorizadas por contexto e reservas independentes por grupo, com cancelamento sistêmico ao perder acesso.
- Sorteio mínimo de três, resultado individual, novo sorteio e invalidação com cancelamento transacional das reservas da edição.
- Dashboard com resultados ativos, páginas responsivas e testes desktop/celular.

## Mapa do código

| Local | Responsabilidade |
| --- | --- |
| src/app | Páginas, layouts, estados e Route Handler de auth |
| src/modules/auth | Better Auth, sessões, validação e contrato HTTP |
| src/modules/gifts | Lista pessoal, DTO explícito e exclusão transacional |
| src/modules/groups | Participações, administração e grupos ativos paginados |
| src/modules/reservations | Política contextual, disponibilidade, reservas e resultado da sessão no mesmo snapshot |
| src/modules/secret-santa | Algoritmo, geração/invalidação/refazer, revisão e controles administrativos |
| src/lib/env e src/lib/db | Configuração privada e pool reutilizável |
| src/components | Marca e menu com seção atual |
| e2e e scripts/test-auth.sh | Navegador e MongoDB descartável |

Páginas são Server Components; formulários, diálogos, menu ativo e fallback de imagem são Client Components. Auth usa Route Handlers; alterações de domínio usam Server Actions autenticadas. Serviços recebem repositórios para testes. Não enviar algoritmo, conexão ou resultados coletivos ao navegador.

## Regras confirmadas

Senha de 6–128 caracteres, sessão de sete dias, sem confirmação de email nem recuperação. Better Auth/scrypt com cookies HttpOnly; origem explícita e Secure em HTTPS. Não perguntar novamente.

Lista pessoal é única; grupo não copia presentes. Convencional permite listas entre membros; amigo secreto só permite o destinatário da própria sessão após edição válida. Compartilhar outro grupo não libera o contexto solicitado.

Reserva pertence a groupId/giftId, com drawId no amigo secreto. O dono não recebe status, identidade, IDs, contagem ou alteração de datas públicas por reserva. Somente reservante cancela manualmente. Índice único parcial impede duas ativas por par.

Grupo sempre tem exatamente um administrador participante. Último admin encerra com confirmação e sem sorteio ativo; com outras pessoas transfere antes de sair. Edição ativa bloqueia adicionar/remover/sair/encerrar, incluindo antigo admin após transferência. Transferência preserva resultados.

Mínimo de três participantes foi confirmado pelo usuário. Fisher–Yates/crypto com rejeição de autoatribuição tem tentativas limitadas; nova geração pode repetir pares. drawRevision só muda com operações de sorteio e protege confirmações antigas; membershipVersion muda com composição; writeVersion coordena mutações e não é público.

## Consistência e privacidade

Reserva/cancelamento escrevem grupo e presente. Exclusão de presente cancela em todos os grupos na mesma transação. Saída/remoção cancelam como dono ou reservante somente no grupo afetado. Encerramento cancela remanescentes daquele grupo; histórico cancelado não é público.

Invalidação/novo sorteio disputam o mesmo documento do grupo que reservas e membros. Transação invalida edição e cancela suas reservas antes de publicar nova edição/ponteiro, quando aplicável. Resultado da sessão, presentes e disponibilidade são lidos juntos em snapshot. Nem admin recebe atribuições alheias. Callback transacional não tem efeitos externos.

## Ambiente e verificações

Node.js 24 alvo; pnpm 12.11.2, lockfile versionado. Next.js 16.4.5, React 19.3.1, Better Auth 1.7.17. Tailwind com verde/vermelho/dourado/creme; sem biblioteca extra de formulários/estado global. Ícones em SVG/ICO/PNG e script de geração, sem suporte offline.

Banco configurado é **produção**, nome lista-natalina, conforme definição do usuário. Nunca executar seed, cadastros automatizados, drop ou limpeza nele. .env/arquivos locais devem ser preservados e nunca impressos/versionados. Auth exige banco explícito antes de escrita. Testes sobrescrevem variáveis e recusam URI fora do formato descartável em loopback.

Driver oficial server-only, conexão lazy e promessa compartilhada por instância, pool máximo dez, recuperação após falha inicial. Build não abre banco. Índices idempotentes na inicialização dos serviços; várias Functions têm pools distintos.

Verificação de amigo secreto: 198 testes isolados, 77 integração e 16 E2E; lint, tipos e build aprovados. Capturas desktop/celular revisadas. A regressão de navegação recebeu teste próprio. O CI remoto é informado na entrega. Não houve testes automatizados no banco real nem deploy.

Servidor local em http://localhost:3000 foi iniciado nesta sessão; verificar disponibilidade antes de prometer acesso. Ele usa a configuração real; os runners usam outro servidor/banco.

## Continuidade

Amigo secreto e reorganização documental foram autorizados com commits/push na continuidade desta sessão. Próximo trabalho é revisão final de segurança, acessibilidade, integração e preparação de deploy; aguardar novo avanço do usuário antes dessa etapa. Deploy exige autorização própria.

Edição de perfil, exclusão de conta e retenção de histórico continuam pendentes de definição. Mínimo, senha/sessão, ausência de email/recuperação e encerramento pelo último admin já estão definidos.

Commits anteriores de referência: af3c5d3 (reservas), 29437b7 (revisão de interface). Backend de sorteios: 3e07a36 e d688a82. Consulte git log/status para estado atual. Não importar regras de outros projetos a partir do perfil global.
