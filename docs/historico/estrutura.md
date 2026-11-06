# Entrega da Fase 1

## Resultado

Base Next.js 16 / React 19 / TypeScript estrito, com App Router, página inicial responsiva em português, driver MongoDB e validação Zod. Autenticação recomendada: Better Auth na Fase 2. Nenhuma funcionalidade de negócio, migração ou deploy foi antecipado.

A pedido do usuário, a instalação npm foi removida e substituída por pnpm 12.11.2. O `package.json` permanece como manifesto obrigatório, sem package-lock.json. O lockfile pnpm preserva versões resolvidas da instalação anterior. Scripts, README e CI usam pnpm; pnpm-workspace.yaml autoriza somente o build de esbuild necessário às ferramentas. A instalação usa hard links ao store compartilhado. Tamanho aparente observado de node_modules: 510 MB antes e 502 MB depois; esse valor não mede isoladamente a economia física entre projetos.

O .env original foi preservado, ignorado pelo Git e não foi registrado em commits. A validação de ambiente é lazy e não inclui valores sensíveis nos erros. O cliente MongoDB é server-only, compartilha uma promessa entre chamadas/hot reload, limita o pool e descarta conexão após falha inicial. A página inicial e o build não acessam banco. Diagnóstico explícito fecha o cliente e não escreve documentos.

## TDD e verificações

- Testes escritos antes da implementação: falharam inicialmente por ausência do módulo de conexão e por stub sem a validação de ambiente. Depois da implementação, os 12 cenários passaram.
- Casos cobertos: URI ausente/inválida, não exposição de credenciais em erro, nome de banco opcional/inválido, remoção de variáveis extras, importação sem conexão, concorrência/reutilização, hot reload, pool limitado e recuperação após falha inicial.
- `pnpm install --frozen-lockfile`: aprovado.
- `pnpm check`: lint, typecheck, 12 testes e build de produção aprovados após migração.
- `pnpm audit --prod`: nenhuma vulnerabilidade conhecida.
- Auditoria completa: um aviso moderado de minimatch na cadeia de typescript-eslint/eslint-config-next (a auditoria npm anterior contava oito pacotes afetados pela mesma cadeia). Sem downgrade do framework ou override de major transitive sem validação. Rever quando houver atualização compatível.
- Smoke HTTP da aplicação em modo de produção: 200, conteúdo inicial e idioma pt-BR corretos. Não foi realizada avaliação visual em navegador nesta etapa.
- `git diff --check` e revisão dos arquivos preparados contra valores do .env: aprovados.
- Workflow GitHub Actions configurado para Node.js 24 e pnpm; execução remota ainda não verificada, pois não houve push.

## Pendência de conexão real

O comando de diagnóstico chegou ao MongoDB, mas recebeu MongoServerError, código 8000, com indicação de falha de autenticação. Nenhuma URI, host, senha ou documento foi exibido. As credenciais/configuração da conexão existente precisam ser corrigidas antes das funcionalidades persistentes. Não presumimos a causa exata (senha, usuário, authSource ou configuração do provedor). Suporte a transações não pôde ser confirmado sem conexão autenticada.

Os testes de conexão desta fase usam mocks; não são evidência de persistência real. Testes de índices, transações e domínio serão adicionados nas fases correspondentes, em banco dedicado. Nunca usar o banco existente para limpar/semear dados de testes.

## Commits

- `f832e7e` — plano integral e proteção de segredos.
- `8c76bc9` — complemento definitivo, modelagem e matriz de testes.
- `35edd6a` — infraestrutura Next.js/MongoDB, testes e configuração pnpm.
- A documentação desta entrega é registrada em commit separado.

## Próxima etapa

Fase 2: autenticação email/senha, cadastro, login, logout, perfil e autorização no servidor. Antes das escritas, corrigir a conexão MongoDB e definir política de senha/sessão, verificação de email e recuperação de acesso. As regras definitivas de grupos/reservas/sorteios já estão documentadas para as fases posteriores.
