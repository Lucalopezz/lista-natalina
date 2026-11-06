# Publicação na Vercel

Este guia prepara a publicação do checkout atual. Nenhum projeto, domínio ou deployment foi criado nesta entrega. O banco configurado localmente já é produção; testes automatizados continuam usando MongoDB descartável.

## Configuração do projeto

Importe o repositório na Vercel somente quando a publicação estiver autorizada. A integração Git pode publicar automaticamente os próximos pushes; escolha conscientemente a branch de produção e os ambientes de preview.

| Configuração | Valor |
| --- | --- |
| Framework | Next.js |
| Root Directory | Raiz do repositório |
| Node.js | 24.x, também declarado em package.json e .nvmrc |
| Gerenciador | pnpm 12.11.2, declarado em packageManager |
| Install Command | pnpm install --frozen-lockfile |
| Build Command | pnpm build |
| Output Directory | Padrão do Next.js |

Não é necessário adicionar vercel.json, servidor permanente ou disco persistente. O runtime Node.js das rotas privadas/Actions permite usar o driver MongoDB e transações. Build valida a aplicação sem abrir conexão com o banco.

O workflow [validacao.yml](../.github/workflows/validacao.yml) executa lint, tipos, unidade, build, integração e navegador, sem segredos de produção. As ações estão fixadas por SHA e usam Node.js 24. Confira o CI do commit escolhido antes de promovê-lo; este workflow não publica a aplicação nem configura uma barreira automática para deployments da integração Git.

## Variáveis privadas por ambiente

Configure pelo painel da Vercel, sem copiar valores para issues, logs ou documentação. Nenhuma delas deve receber prefixo NEXT_PUBLIC_. Preserve o .env local existente.

| Variável | Produção | Preview |
| --- | --- | --- |
| DATABASE_URL | URI privada do MongoDB de produção | URI de banco separado, com credencial própria |
| DATABASE_NAME | lista-natalina | Nome explícito do banco de preview |
| BETTER_AUTH_SECRET | Segredo aleatório de pelo menos 32 caracteres | Outro segredo, diferente do de produção |
| BETTER_AUTH_URL | Origem HTTPS exata usada pelos usuários | Origem HTTPS exata do preview estável |

DATABASE_NAME substitui o nome presente na URI. Defini-lo explicitamente evita o banco implícito test. Não reutilize o banco de produção em preview: cadastro, exclusão, saída e sorteio são operações reais mesmo quando a URL parece temporária.

BETTER_AUTH_URL contém somente a origem, sem caminho, query ou barra final, por exemplo https://lista.example.com. O servidor compara Origin com essa configuração. Se a pessoa abrir outra URL/alias, as operações podem ser recusadas. Prefira um endereço canônico e configure redirecionamento dos demais após definir o domínio.

Previews com URLs diferentes não recebem confiança automática. Para um preview funcional, escolha um endereço estável e configure sua origem exata no ambiente correspondente; confirme que ele serve o deployment pretendido. Não troque a verificação por wildcard nem derive confiança do header Host. Se o domínio mudar, atualize a variável e gere novo deployment.

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

Primeiro use preview com banco isolado. Verifique cadastro, login, logout, lista pessoal, inclusão no grupo, reserva/cancelamento e sorteio com pelo menos três contas fictícias nesse banco. Confira também saída bloqueada durante sorteio ativo, transferência e invalidação/refazer com cancelamento das reservas da edição.

No navegador, valide celular e teclado, foco das confirmações, links externos e imagem padrão. Confira respostas privadas com Cache-Control no-store e os cabeçalhos definidos em next.config.ts. O layout privado orienta indexadores com noindex/nofollow; a proteção real continua sendo a sessão no servidor.

A CSP atual restringe enquadramento, URL base, objetos incorporados e destino de formulários. Ela não contém script-src nem nonces; não deve ser descrita como uma política completa contra execução de scripts. Textos de presentes são renderizados como texto React, e URLs têm validação própria.

Após a promoção autorizada, confira página pública, origem canônica, HTTPS e disponibilidade sem criar contas de teste automaticamente no banco real. Qualquer teste de escrita em produção deve ser uma ação consciente de operação, fora dos runners deste projeto.

Configuração de domínio, permissões do cluster, rede, backups, custos e comportamento de um deployment real permanecem verificações do ambiente de hospedagem; o build local não as comprova.

## Referências oficiais

- [Node.js na Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Ambientes de deployment](https://vercel.com/docs/deployments/environments)
- [Cabeçalhos no Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers)
- [Transações no driver MongoDB](https://www.mongodb.com/docs/drivers/node/current/fundamentals/transactions/)
