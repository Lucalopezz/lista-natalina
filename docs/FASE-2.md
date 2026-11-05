# Fase 2 — autenticação e perfil

## Entrega

Cadastro, login, logout, dashboard inicial e perfil próprio. Senha de 6–128 caracteres e sessão de 7 dias, conforme decisão do usuário. Confirmação de email e recuperação de senha estão fora do escopo por escolha explícita, sem links ou endpoints oferecendo esses fluxos.

Interface mobile-first com Tailwind CSS, paleta natalina verde/vermelha/dourada, fundo creme, inputs com labels, foco visível, erros acessíveis e estado de carregamento. A aplicação de desenvolvimento fica em http://localhost:3000 enquanto o servidor iniciado nesta sessão estiver em execução.

## Organização e segurança

- `src/modules/auth/config.ts`: Better Auth 1.7.17 e adapter MongoDB, hash scrypt da biblioteca, sessões persistidas, cookies HttpOnly, SameSite=Lax e Secure em HTTPS. Cache de sessão em cookie desabilitado para revogação ser observada na leitura seguinte.
- `validation.ts` e `env.ts`: normalização de nome/email, limites no servidor e configuração privada. Senha preservada literalmente, inclusive espaços. Origem configurada explicitamente e normalizada; não confiar em Host enviado pelo cliente.
- `http.ts`: contrato HTTP limitado às operações desta fase, corpo de até 8 KiB, validação antes de persistir, origem obrigatória nos POSTs, no-store e projeção de resposta sem token/sessão. Dados de privilégios/callbacks do cliente são descartados. Erros de infraestrutura são sanitizados.
- `indexes.ts`: email e token únicos, credencial única por provider/accountId, índices de userId, TTL de sessões e chave única dos contadores. Inicialização idempotente compartilhada pela promessa de auth, sem recriar por consulta. Duplicatas existentes impedem inicialização; não são apagadas automaticamente.
- `server.ts`: configuração lazy que aguarda conexão/índices. `session.ts`: sessão real validada no servidor e DTO próprio mínimo; presença de cookie sozinha não autoriza. Indisponibilidade é erro sanitizado, não sessão anônima falsa.
- `src/app/(auth)` e `(private)`: cadastro/entrada e páginas privadas. Proteção na página além do layout. Não há endpoint de perfil de outro usuário nesta fase.
- Rate limiting no MongoDB, com 5 tentativas de login/minuto e 10 cadastros/minuto; contadores compartilhados entre instâncias. Na Vercel, apenas header de IP da plataforma é confiável. Fora dela, limite é compartilhado, evitando confiar em IP arbitrário do cliente.
- Route Handler nativo delega ao handler Better Auth. Não usamos Server Actions para login, pois chamadas internas `auth.api` não passam pelo rate limiter HTTP. Nenhum processo ou arquivo local persistente é necessário em produção.

Os índices de autenticação são criados no banco configurado quando a primeira operação de auth inicializa o serviço. Esse é preparo funcional, não seed. Requer usuário MongoDB com permissões de índices e escrita, e replica set para as transações do adapter.

## Contrato HTTP

| Método e rota | Entrada / resultado |
| --- | --- |
| POST `/api/auth/sign-up/email` | JSON name/email/password; cria conta e sessão; 200 com user.id/name/email |
| POST `/api/auth/sign-in/email` | JSON email/password; 200 com perfil e cookie; 401 genérico para credenciais inválidas |
| POST `/api/auth/sign-out` | JSON `{}` e cookie; revoga sessão e limpa cookie; 200 |
| GET `/api/auth/get-session` | Cookie; 200 com perfil próprio ou 401 sem sessão válida |
| GET `/api/auth/ok` | Verifica handler configurado; 200 sem dados privados |

POSTs exigem Origin igual a BETTER_AUTH_URL. Entrada inválida retorna 400; origem indevida 403; email duplicado detectado antes da escrita 409. Em colisão de cadastro simultâneo, o adapter pode responder 422: o índice continua garantindo uma única conta e a transação evita credencial órfã. Excesso de tentativas retorna 429; falha de inicialização/conexão retorna 503 sanitizado. Outros endpoints da biblioteca retornam 404 nesta aplicação.

## Ambiente e produção

O usuário confirmou que o banco do `.env` é produção e corrigiu sua conexão. `pnpm db:check` passou em ping/topologia compatível com transações, sem alterar dados. Nenhum cadastro automatizado, índice ou limpeza de teste foi executado nesse banco.

Foi criada configuração privada local de auth com segredo gerado sem exibição e origem http://localhost:3000. Com autorização do usuário, as novas variáveis foram centralizadas no `.env`, ignorado pelo Git; a URI existente foi preservada e as duplicatas removidas do `.env.local`. O servidor local usa o banco de produção, portanto contas criadas manualmente nessa execução serão reais.

Para Vercel: definir DATABASE_URL, nome do banco se necessário, BETTER_AUTH_SECRET com pelo menos 32 caracteres aleatórios e BETTER_AUTH_URL igual à origem HTTPS exata. Usar segredo próprio por ambiente. Nenhum deploy foi realizado. Configuração de preview ainda exige banco separado; não propagar automaticamente URI de produção.

## TDD e evidências

- 38 testes isolados: ambiente, conexão, validação, identidade/projeção, redirecionamento e erros sanitizados. Testes foram escritos antes dos respectivos módulos; sanitização também teve falha de comportamento observada antes da correção.
- 14 testes HTTP com MongoDB real descartável: cadastro, hash, sessão, duplicidade, concorrência, credenciais inválidas, anônimo, logout/revogação, expiração, cookie adulterado, origem, limite entre instâncias, cookie Secure e endpoints fora de escopo.
- O teste concorrente falhou inicialmente com dois cadastros aceitos, comprovando a necessidade do índice único. Após a correção, só um usuário e uma credencial persistem.
- 2 testes Playwright (desktop e celular): cadastro→dashboard→perfil→logout→negação de página privada→erro de login→login válido→logout. Sem overflow no perfil e sem credenciais em localStorage. Houve falha inicial de logout por ausência de JSON; corrigida e cenário aprovado.
- Capturas de cadastro e perfil revisadas visualmente. Tailwind migrou os estilos de componentes para utilitários; globals.css contém somente tema/base.
- Lint, TypeScript e build de produção aprovados. Auditoria de dependências de produção sem vulnerabilidades conhecidas.
- Runner usa Docker/MongoDB 8.0.34 já disponível localmente, tmpfs e portas aleatórias. Sobrescreve explicitamente DATABASE_URL e DATABASE_NAME no Next de teste, mesmo havendo `.env` de produção. Não gera volume persistente; encerra container/servidor temporários ao final. Usa Chromium local quando disponível.

## Comandos

```sh
pnpm check
pnpm test:integration
pnpm test:e2e
```

Integração/E2E exigem Docker. Se não houver Chromium local, instalar o navegador de testes com `pnpm exec playwright install chromium`. O CI instala Chromium e roda os mesmos fluxos isolados. O runner usa tmpfs com capacidade de 1 GiB para respeitar a margem de espaço de índices e não depender de parâmetros específicos de versões do MongoDB. Falhas de inicialização mostram somente logs do container de fixtures. O primeiro push da Fase 1 encontrou o bloqueio de idade de publicação do Vite no pnpm; a exceção exata da versão resolvida foi registrada em pnpm-workspace.yaml, sem desabilitar a política global.

## Limites e próximo passo

Não há edição de perfil, busca de usuários, presentes ou grupos nesta fase. Dashboard mostra o estado inicial sem botões para operações inexistentes. Próxima etapa: Fase 3, CRUD da lista pessoal com autorização e validação de URLs.

## Commits desta fase

- `a9b2025`: autenticação persistida, validação, índices e testes HTTP.
- `1765c34`: telas de conta, Tailwind e identidade natalina.
- `0c58b64`: testes de navegador e pipeline com MongoDB descartável.
- Documentação de encerramento registrada em commit separado.

Nome de produção confirmado pelo usuário: `lista-natalina`, configurado localmente em DATABASE_NAME sem alterar a URI. Auth recusa habilitar escritas se nem DATABASE_NAME nem a URI definirem o banco explicitamente; não usa `test` por omissão. O runner CI está fixado em Ubuntu 24.04 para evitar a incompatibilidade detectada entre o kernel do ubuntu-latest e a imagem MongoDB; a imagem de testes também está fixada em 8.0.34.
