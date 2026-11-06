# Publicação na Vercel

Aplicação publicada em https://lista-natalina.vercel.app, no projeto lista-natalina da equipe lucas-projects-36c39d5f. Por decisão do usuário, a publicação é diretamente em produção, sem preview. O banco configurado localmente já é produção; testes automatizados continuam usando MongoDB descartável.

Verificação em 06/11/2026: build/TypeScript aprovados na Vercel, páginas pública/login/cadastro com HTTP 200 e dashboard anônimo redirecionando para login. O usuário ajustou Network Access no Atlas; a inicialização da autenticação então conectou ao banco e get-session retornou 401 para a sessão anônima, conforme esperado. Não foram criadas contas de teste nem executados fluxos de escrita no banco real.

## Configuração do projeto

O checkout já está vinculado à Vercel em .vercel/, ignorado pelo Git. Deploys automáticos por Git estão desabilitados em vercel.json; pushes continuam executando o CI. Para publicar uma atualização, use `vercel deploy --prod`. Não execute `vercel deploy` sem --prod, pois esse comando cria preview.

| Configuração | Valor |
| --- | --- |
| Framework | Next.js |
| Root Directory | Raiz do repositório |
| Node.js | 24.x, também declarado em package.json e .nvmrc |
| Gerenciador | pnpm 12.11.2, declarado em packageManager |
| Install Command | pnpm install --frozen-lockfile |
| Build Command | pnpm build |
| Output Directory | Padrão do Next.js |

vercel.json contém somente a desativação de deploys automáticos por Git. .vercelignore exclui variáveis privadas, dependências e artefatos locais do upload. O runtime Node.js das rotas privadas/Actions permite usar o driver MongoDB e transações. Build valida a aplicação sem abrir conexão com o banco. Não há servidor permanente ou disco persistente.

O workflow [validacao.yml](../.github/workflows/validacao.yml) executa lint, tipos, unidade, build, integração e navegador, sem segredos de produção. As ações estão fixadas por SHA e usam Node.js 24. Confira o CI do commit escolhido antes de promovê-lo; este workflow não publica a aplicação nem configura uma barreira automática para deployments da integração Git.

## Variáveis privadas de produção

As quatro variáveis estão configuradas somente em Production. Use o painel ou `vercel env update` para alterá-las, sem copiar valores para issues, logs ou documentação. Nenhuma delas deve receber prefixo NEXT_PUBLIC_. Preserve o .env local existente.

| Variável | Valor configurado |
| --- | --- |
| DATABASE_URL | URI privada do MongoDB de produção, armazenada como Secret |
| DATABASE_NAME | lista-natalina |
| BETTER_AUTH_SECRET | Segredo aleatório, armazenado como Secret |
| BETTER_AUTH_URL | https://lista-natalina.vercel.app |

DATABASE_NAME substitui o nome presente na URI. Defini-lo explicitamente evita o banco implícito test. Cadastro, exclusão, saída e sorteio na URL publicada são operações reais.

BETTER_AUTH_URL contém somente a origem, sem caminho, query ou barra final, por exemplo https://lista.example.com. O servidor compara Origin com essa configuração. Se a pessoa abrir outra URL/alias, as operações podem ser recusadas. Prefira um endereço canônico e configure redirecionamento dos demais após definir o domínio.

Não troque a verificação de origem por wildcard nem derive confiança do header Host. Se o domínio mudar, atualize BETTER_AUTH_URL e gere novo deployment.

Cookies usam HttpOnly, SameSite=Lax e Secure em HTTPS. Sessões duram sete dias e são consultadas no banco, sem cache de sessão em cookie. Trocar segredos/origem pode afetar sessões existentes e exige validação após a mudança.

## Banco, rede e capacidade

- Use MongoDB Atlas ou outro replica set com suporte a transações. Um servidor standalone não atende reservas, grupos e sorteios.
- Crie uma credencial da aplicação restrita ao banco necessário, com leitura/escrita e criação dos índices usados. Não use conta administrativa global como configuração da aplicação.
- Configure acesso de rede e TLS conforme a infraestrutura escolhida. A rede da máquina local não comprova acesso das Functions ao banco; valide a partir do deployment autorizado.
- Escolha região da Function próxima ao banco. A conexão é lazy e compartilhada por instância, com pool máximo de dez. Instâncias simultâneas multiplicam esse limite; acompanhe conexões, latência e erros do cluster.
- Índices são preparados de forma idempotente no primeiro uso dos serviços. Eles não substituem migrações de dados nem corrigem automaticamente documentos conflitantes existentes.

Verifique limites e preços do plano contratado antes da publicação: execução e memória das Functions, tráfego de imagens externas, armazenamento, conexões e capacidade do MongoDB. Este guia não cria recursos pagos e não assume que planos gratuitos comportam qualquer volume. O app não precisa de Redis, Blob ou worker permanente para as funcionalidades atuais.

Tenha backup do banco e um procedimento de restauração verificado. Voltar a um deployment anterior troca o código servido; não desfaz reservas, sorteios, exclusões ou alterações já persistidas no MongoDB.

## Verificação antes de publicar

No checkout do commit que será publicado:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test:integration
bash scripts/test-auth.sh e2e
pnpm audit
```

Integração e E2E exigem Docker; E2E exige Chromium disponível. O runner usa banco temporário em loopback e não carrega .env. Os mesmos comandos fazem parte da validação automatizada, exceto a auditoria, que também deve ser repetida periodicamente porque os avisos mudam com o tempo.

Na revisão de 06/11/2026, uma dependência de lint, minimatch 10, foi substituída pela versão corrigida 11.0.1 apenas para o consumidor typescript-estree. O override está explicado em pnpm-workspace.yaml e pode ser removido quando o consumidor adotar uma versão corrigida. Ele não altera dependências de produção. Veja o [aviso de segurança](https://github.com/advisories/GHSA-g3hv-75wg-m249).

## Conferência do deployment autorizado

O usuário optou por publicação direta, sem preview. Os fluxos de cadastro, login, logout, lista pessoal, grupos, reservas e sorteios são cobertos pelos testes isolados, de integração e navegador antes da publicação. Não execute esses runners contra a URL ou o banco de produção.

No navegador, valide celular e teclado, foco das confirmações, links externos e imagem padrão. Confira respostas privadas com Cache-Control no-store e os cabeçalhos definidos em next.config.ts. O layout privado orienta indexadores com noindex/nofollow; a proteção real continua sendo a sessão no servidor.

A CSP atual restringe enquadramento, URL base, objetos incorporados e destino de formulários. Ela não contém script-src nem nonces; não deve ser descrita como uma política completa contra execução de scripts. Textos de presentes são renderizados como texto React, e URLs têm validação própria.

Após a promoção autorizada, confira página pública, origem canônica, HTTPS e disponibilidade sem criar contas de teste automaticamente no banco real. Qualquer teste de escrita em produção deve ser uma ação consciente de operação, fora dos runners deste projeto.

Configuração de domínio, permissões do cluster, rede, backups, custos e comportamento de um deployment real permanecem verificações do ambiente de hospedagem; o build local não as comprova.

## Referências oficiais

- [Node.js na Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Ambientes de deployment](https://vercel.com/docs/deployments/environments)
- [Cabeçalhos no Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers)
- [Transações no driver MongoDB](https://www.mongodb.com/docs/drivers/node/current/fundamentals/transactions/)
