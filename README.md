# Lista Natalina

Aplicação para organizar listas de presentes, reunir família e amigos e realizar amigo secreto. Desenvolvida com Next.js App Router, TypeScript, MongoDB e Tailwind CSS, com prioridade para celular e uma interface simples para pessoas com diferentes níveis de familiaridade com tecnologia.

Produção: https://lista-natalina.vercel.app

## Funcionalidades

- Cadastro, login, logout e sessão persistida.
- Lista pessoal de presentes com imagem opcional e ilustração padrão.
- Grupos com inclusão direta de usuários, sem convite ou aceite.
- Pesquisa de pessoas enquanto digita, por partes do nome, sem acentos e com tolerância a pequenos erros.
- Listas compartilhadas e reservas independentes por grupo.
- Amigo secreto com no mínimo três participantes e resultado individual privado.
- Novo sorteio e cancelamento do sorteio, com invalidação dos resultados e reservas da edição anterior.
- Transferência de administração, saída e remoção conforme as regras do grupo.

O dono não vê se seus presentes estão reservados nem quem reservou. O administrador também não recebe os resultados individuais dos outros participantes. As permissões são verificadas no servidor.

## Como usar

1. Crie uma conta ou entre com email e senha.
2. Abra **Minha lista** e adicione os presentes que gostaria de ganhar.
3. Crie um grupo e pesquise pelo nome das pessoas cadastradas para adicioná-las.
4. Em **Lista em grupo**, abra a lista de qualquer participante e reserve presentes.
5. Em **Amigo secreto**, o administrador realiza o sorteio. Cada pessoa abre **Meu amigo secreto** para ver quem tirou e consultar seus presentes.

Reservas valem somente para o grupo acessado. Reservar não significa que o presente foi comprado. Só quem reservou pode cancelar sua reserva manualmente.

Enquanto houver sorteio ativo, ninguém pode entrar ou sair do grupo. Para mudar os participantes, o administrador cancela o sorteio, confirma a invalidação dos resultados/reservas e então altera o grupo. Refazer diretamente mantém os participantes e gera uma nova edição.

## Executar localmente

Use Node.js 24 (`nvm use`) e pnpm 12.11.2, fixado no packageManager.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abra http://localhost:3000. Configure as variáveis privadas a partir de `.env.example`, sem versionar credenciais. MongoDB precisa suportar transações, com Atlas ou replica set.

| Variável | Finalidade |
| --- | --- |
| `DATABASE_URL` | URI MongoDB privada |
| `DATABASE_NAME` | Nome explícito do banco; substitui o banco da URI quando informado |
| `BETTER_AUTH_SECRET` | Segredo de autenticação com pelo menos 32 caracteres |
| `BETTER_AUTH_URL` | Origem exata da aplicação; localhost em desenvolvimento, HTTPS em produção |

O banco configurado neste checkout é de **produção**. Cadastros e operações manuais no servidor local criam dados reais. Os runners automatizados usam outro MongoDB descartável; não use o `.env` existente para testes de escrita, seed ou limpeza. Preserve configurações locais existentes.

Senha de 6–128 caracteres; sessão de sete dias. Não há confirmação de email nem recuperação de senha. Variáveis são lidas somente no servidor; build não depende de conexão ao banco. Índices são preparados de forma idempotente na inicialização dos serviços.

## Testes e verificações

```sh
pnpm test                 # Testes isolados, sem banco real
pnpm test:watch
pnpm test:coverage
pnpm check                # Lint + TypeScript + unidade + build
pnpm test:integration     # MongoDB descartável com replica set (Docker)
pnpm test:e2e             # Build, navegador e MongoDB descartável
pnpm db:check             # Diagnóstico somente leitura do banco configurado
```

Integração/E2E criam containers com tmpfs e portas aleatórias, sobrescrevem as variáveis do processo e limpam apenas recursos próprios. A imagem `mongo:7.0.45` é reutilizada quando disponível. E2E usa Chromium local; se necessário, instale com `pnpm exec playwright install chromium`.

Depois do build, é possível filtrar um fluxo:

```sh
bash scripts/test-auth.sh e2e e2e/secret-santa.spec.ts
```

Capturas e traces ficam em `test-results`, ignorado pelo Git. A fixture isola contadores de rate limit entre cenários apenas no banco de testes validado; a proteção da aplicação permanece habilitada. O CI executa check, integração e E2E em bancos descartáveis, sem credenciais de produção.

## Estrutura

| Pasta | Responsabilidade |
| --- | --- |
| `src/app` | Páginas, layouts, Route Handlers e estados de carregamento/erro |
| `src/modules/auth` | Autenticação e sessão |
| `src/modules/gifts` | Lista pessoal, validação e persistência de presentes |
| `src/modules/groups` | Grupos, membros e administração |
| `src/modules/reservations` | Autorização contextual, disponibilidade, reservas e leitura do resultado individual |
| `src/modules/secret-santa` | Algoritmo, geração, invalidação e novo sorteio |
| `src/lib` | Ambiente privado e conexão MongoDB reutilizável |
| `src/components` | Apresentação compartilhada e navegação |
| `e2e` | Fluxos completos de navegador em desktop/celular |

Páginas são Server Components por padrão. Client Components ficam nas interações: formulários, confirmações, menu ativo e imagem com fallback. Server Actions autenticadas recebem alterações de presentes/grupos/reservas/sorteios. Autenticação usa Route Handlers para preservar cookies e o contrato do Better Auth. Regras ficam nos serviços; consultas e transações, nos repositórios.

## Interface

Fonte base de 18 px, controles principais de pelo menos 48 px, textos diretos, menu com seção atual e foco visível para teclado. Tailwind aplica os estilos, com tokens natalinos em `src/app/globals.css`. Não há biblioteca adicional de formulários ou estado global.

O ícone fonte está em `src/app/icon.svg`. Para regenerar PNGs/ICO: `node scripts/generate-icons.mjs`, reutilizando sharp do Next.js. Manifest e ícones não adicionam suporte offline.

## Vercel

Projeto único Next.js/Node.js 24, publicado diretamente em produção pela CLI. Instalação `pnpm install --frozen-lockfile`, build `pnpm build` e saída padrão do framework. Não há preview neste projeto; deploys automáticos por Git estão desabilitados em `vercel.json`. Para atualizar: `vercel deploy --prod`. O [guia de publicação](docs/DEPLOY.md) detalha a configuração.

Não há dependência de processo permanente nem armazenamento local persistente. O pool MongoDB tem máximo de dez conexões por instância; múltiplas Functions têm pools distintos. Escolha uma região próxima ao banco e dimensione permissões/rede/conexões para a concorrência esperada.

## Documentação

- [Guia do projeto: estrutura, fluxos e exemplos de código](docs/COMO-O-PROJETO-FUNCIONA.md)
- [Arquitetura e modelagem](docs/PLANO.md)
- [Regras de negócio e privacidade](docs/REGRAS-DE-NEGOCIO.md)
- [Publicação na Vercel](docs/DEPLOY.md)
