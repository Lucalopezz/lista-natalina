# Instruções de trabalho — Lista Natalina

## Leitura e escopo

- Leia [CONTEXT.md](CONTEXT.md) antes de alterar a aplicação e consulte a documentação do módulo afetado.
- Use [docs/PLANO.md](docs/PLANO.md) para arquitetura/modelagem e [docs/REGRAS-DE-NEGOCIO.md](docs/REGRAS-DE-NEGOCIO.md) para regras definitivas. O complemento definitivo prevalece sobre propostas anteriores. Instruções atuais do usuário prevalecem sobre estes documentos.
- Continue do checkout existente. Preserve alterações do usuário e não reinicie estruturas já corretas.
- Implemente incrementalmente. Ao concluir a fase autorizada, apresente o resultado e aguarde a próxima etapa. Não implemente comportamentos cujas regras essenciais ainda estejam pendentes.

## Comunicação e preferências do usuário

- Responda em português do Brasil, em linguagem direta e didática. Explique termos técnicos quando forem necessários para entender a decisão.
- Comece a entrega pelo comportamento disponível e pelo resultado concreto.
- Apresente arquivos relevantes em ordem útil de revisão, preferencialmente em lista numerada com links clicáveis; explique o que mudou e por quê. Agrupe arquivos relacionados quando isso ajudar.
- Explique decisões e alternativas relevantes proporcionalmente à mudança. Não transforme uma alteração pequena em relatório extenso.
- Informe verificações realmente executadas, resultados, limitações, commit criado e próxima etapa. Diferencie implementação, planejamento e validação real.
- Quando houver uma rota nova, explique entrada, resposta, erros e como verificá-la quando isso ajudar na revisão.
- Organize README e guias principais por funcionalidades, uso e arquitetura; histórico de entregas fica separado, sem apresentar o produto por fases.
- Não atribua ao perfil global preferências inferidas de um único projeto. Considere histórico como contexto, e não como prova do estado atual.

## Comentários no código — prioridade de legibilidade

O usuário quer aprender com o código e gosta de comentários detalhados que expliquem sua lógica. Comente especialmente trechos com regras de negócio, segurança, concorrência e comportamento pouco óbvio.

- Escreva comentários em português, próximos ao trecho explicado, com informação suficiente para acompanhar a lógica.
- Em funções importantes, use JSDoc para explicar propósito, entradas/contexto, resultado, autorização e efeitos relevantes, conforme necessário. Não repita a assinatura nem documente cada getter trivial.
- Explique **por que** a solução existe: qual regra ela preserva, qual falha evita e quais condições precisam continuar verdadeiras.
- Em operações complexas, descreva a sequência em blocos: validação, autorização, escrita/concorrência, retorno seguro. Faça isso com comentários conectados aos passos reais, sem numerar toda linha mecanicamente.
- Explique filtros de autorização, índices únicos, transações, verificações de versão, tentativas após conflito e omissão de campos nos DTOs. Não deixe essas garantias implícitas.
- Exemplos úteis neste projeto: por que a promessa da conexão é compartilhada, por que uma reserva depende de groupId/drawId, e por que dono e administrador não recebem informações confidenciais.
- Evite comentários que apenas traduzem a instrução, como “incrementa contador”. Código simples pode ficar sem comentário; não deixe lógica complexa sem explicação para economizar linhas.
- Mantenha comentários sincronizados ao alterar o comportamento. Preserve comentários didáticos corretos do usuário; não remova explicações úteis sem necessidade.
- Nunca coloque segredos, dados pessoais reais ou resultados de sorteios em comentários, exemplos, fixtures ou logs.

Exemplo do nível de explicação esperado para uma futura operação de reserva (não é uma implementação):

```ts
// A autorização considera o grupo solicitado. Compartilhar outro grupo convencional
// não permite acessar uma lista pelo contexto deste amigo secreto. Aqui precisamos
// conferir a edição ativa e se o dono do presente é o destinatário do usuário da sessão.
// A reserva será gravada na mesma transação que coordena a versão do grupo, para que
// uma invalidação concorrente não deixe reservas ativas ligadas a uma edição inválida.
```

## Arquitetura e segurança

- Stack: Next.js App Router, TypeScript estrito, MongoDB; frontend e backend no mesmo projeto, compatíveis com Vercel.
- Estilize com Tailwind CSS. Mantenha em `globals.css` apenas importação, tokens do tema e estilos base; evite classes globais de layout/componentes. Use verde pinheiro, vermelho natalino e detalhes dourados, preservando contraste e legibilidade.
- A interface também atende pessoas mais velhas: prefira instruções literais, navegação visível com seção atual, letras legíveis, controles confortáveis ao toque e confirmações que nomeiem a ação. Separe opções administrativas ocasionais das tarefas principais; não dependa só de ícones, cores ou hover.
- Use Server Components por padrão; Client Components somente quando houver interatividade necessária.
- Separe apresentação, validação, serviços/regras, persistência e autorização. Crie módulos em `src/modules` conforme a funcionalidade; evite abstrações e dependências sem benefício concreto.
- Valide identidade no servidor em toda operação privada. Use usuário da sessão, nunca identidade enviada pelo cliente como fonte de autoridade.
- Toda lista alheia e reserva exige contexto de grupo; amigo secreto exige edição/atribuição autorizada. Nunca substitua isso por uma consulta genérica de grupos em comum.
- Grupo deve sempre ter um administrador participante. O último administrador só encerra com confirmação e sem sorteio ativo; com outros membros, transfere a função antes de sair.
- URL de imagem de presente é opcional. Use a ilustração local padrão quando ausente ou com falha; continue validando URLs informadas.
- Nunca exponha reservas ao dono do presente nem resultados alheios ao administrador. Retorne DTOs explícitos, sem documentos completos ou cache compartilhado de dados privados.
- Use runtime Node.js para MongoDB, conexão reutilizável e transações para consistência entre documentos relacionados.
- Não introduza regras pendentes como se já estivessem aprovadas. Consulte as pendências do plano antes da respectiva fase.
- O banco de `.env` é de produção, conforme definição do usuário. Preserve `.env`; não imprimir, versionar ou copiar credenciais para documentação. Nunca usar o banco existente para testes destrutivos, limpeza ou seed.

## Dependências e comandos

- Use **pnpm**, fixado em `package.json`. Não usar npm/yarn para instalar e não criar package-lock.json/yarn.lock.
- Node.js alvo: 24, conforme `.nvmrc` e CI. Use `pnpm install --frozen-lockfile` em instalações reproduzíveis.
- Versione `pnpm-lock.yaml`. Revise alterações de dependências e a autorização de scripts em `pnpm-workspace.yaml`; não habilite todos os builds indiscriminadamente.
- Comandos principais: `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm check`.
- `pnpm db:check` é diagnóstico explícito e somente leitura. Testes de persistência futuros precisam de banco isolado e replica set; mocks não comprovam atomicidade real.

## TDD e verificação

- Para comportamentos: escreva teste → confirme falha pelo motivo esperado → implemente mínimo → rode testes → refatore → rode novamente.
- Cubra regras e falhas reais, não testes que só reproduzem constantes ou implementação.
- Teste autorização pelo backend e ausência de campos confidenciais em respostas, além da interface.
- Teste índices, transações e concorrência contra MongoDB isolado quando essas funcionalidades forem implementadas.
- Antes de commits de código, rode verificações pertinentes; no fechamento da etapa, `pnpm check`. Para documentação isolada, confira conteúdo, links locais e `git diff --check`; não é preciso repetir build sem mudança de código.
- Não declare conexão real, integração, revisão visual ou execução remota de CI como aprovadas sem evidência.

## Git, commits e entrega

- Faça commits pequenos por unidade funcional, usando Conventional Commits: `feat`, `fix`, `test`, `refactor`, `docs`, `chore` etc.
- O título deve explicar a mudança concreta. Evite juntar alterações independentes ou criar commits que afirmem entregar funcionalidade ainda ausente.
- Revise diff e arquivos preparados, preservando alterações não relacionadas. Nunca versionar `.env`, node_modules, builds, cobertura ou segredos.
- O usuário autorizou o avanço incremental até a revisão final de segurança, acessibilidade e preparação de publicação, incluindo commits/push e reorganização da documentação. Faça push dos commits dessa entrega após validar; deploy/publicação da aplicação continua fora do escopo. Em novas tarefas, siga o escopo autorizado pelo usuário.
- Ao encerrar uma fase, atualize o contexto quando o estado, as decisões ou as pendências tiverem mudado. Não registre sucesso sem a verificação correspondente.

## Origem das preferências

- Solicitações diretas desta conversa: TDD, commits incrementais Conventional Commits, pnpm para economizar espaço, comentários detalhados e explicações da lógica para estudo, Tailwind CSS e cores natalinas. Autenticação: senha de 6–128 caracteres, sessão de 7 dias, sem confirmação de email nem recuperação de senha. Banco existente é produção; todos os testes de escrita devem usar banco descartável separado.
- Perfil global consultado em 05/11/2026: `default/_global`, página `profile/communication/entrega-de-funcionalidades.md`, lida integralmente por `ai-memory profile show communication/entrega-de-funcionalidades.md`. Aplicamos a preferência de entrega por resultado, arquivos com links, decisões, testes e limitações. Referências específicas a Go/Bruno foram omitidas por não serem aplicáveis a este projeto.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
