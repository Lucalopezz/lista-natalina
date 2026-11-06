# Revisão de segurança, acessibilidade e publicação

Revisão em 06/11/2026 sobre o amigo secreto já entregue. Nenhuma funcionalidade correta foi reimplementada; não houve deploy nem escrita automatizada no banco de produção.

## Correções verificadas

### Leitura de grupos durante mudanças concorrentes

O serviço verificava participação/administração e depois consultava membros/candidatos fora de uma sessão compartilhada. Uma remoção/transferência entre essas consultas podia combinar autorização antiga com dados posteriores.

GroupReads passou a integrar a unidade transacional. get/search usam a mesma sessão com readConcern snapshot. Não escrevem writeVersion: uma leitura iniciada antes da revogação pode concluir com dados daquele estado, sem incorporar dados posteriores. Novas requisições observam a revogação.

Dois testes reais controlam a intercalação: remover o leitor e adicionar membro antes da listagem; transferir a administração e cadastrar usuário antes da busca. Ambos falharam antes da implementação e passaram depois. As verificações seguintes também recusam o antigo acesso.

### Limite e normalização do logout

O limite de 8192 bytes era aplicado ao cadastro/login. Agora vale para todos os POSTs permitidos, incluindo logout, contando o stream real mesmo com Content-Length falso. Logout vazio continua válido; o adaptador encaminha somente `{}` à biblioteca e remove o tamanho antigo do corpo. Cookie e origem são preservados.

Quatro testes falharam antes da correção e passaram depois: corpo excessivo, campos arbitrários, POST vazio e JSON/origem inválidos. A integração real de autenticação e o fluxo cadastro → logout → login continuaram aprovados.

### Respostas, cache e texto de usuário

next.config.ts passou a definir bloqueio de enquadramento, CSP parcial, nosniff, no-referrer e bloqueio de câmera/microfone/geolocalização. O layout privado adiciona orientação noindex/nofollow, sem usar indexação como autorização.

O teste de cabeçalhos falhou no build anterior. Após a mudança, passou em desktop/celular. Outro cenário confirmou que perfil autenticado não é servido à sessão anônima, respostas privadas usam no-store e texto de presente contendo tags/script permanece literal, sem executar HTML. Essa renderização segura já funcionava; foi coberta como regressão.

A CSP restringe frame-ancestors, base-uri, object-src e form-action. Não possui script-src/nonces e não equivale a uma política completa contra scripts. Não foram adicionados cache global de dados privados ou dependências de interface.

### Recursos do runner e dependências

Um teste com Docker simulado comprovou que falha na criação por colisão de nome acionava stop/rm sobre o nome preexistente. O runner agora guarda o ID retornado pela criação bem-sucedida e limpa somente esse recurso. O teste falhou antes e passou depois; integração/E2E reais comprovaram o fluxo normal com containers descartáveis.

A auditoria inicialmente encontrou zero avisos de produção e um aviso moderado de desenvolvimento: minimatch 10.2.6, utilizado por typescript-estree no lint. Um override restrito a esse consumidor fixa minimatch 11.0.1. A API utilizada foi conferida e lint, tipos, testes e build passaram. Remover o override quando o consumidor adotar diretamente versão corrigida. A auditoria completa posterior informou zero vulnerabilidades conhecidas; isso não comprova ausência de outras falhas.

## Interface e fronteiras React

Os fluxos mantiveram Server Components nas páginas e interatividade nos componentes locais. Não foi necessário transformar páginas em Client Components ou adicionar gerenciador de estado.

O teste de usabilidade foi ampliado para Escape fechar confirmação de exclusão, preservar o presente e devolver foco ao botão. Os cenários também verificam skip link, seção atual, alvo de toque mínimo de 48 px, senha visível/oculta e ausência de rolagem lateral a 320 px com fonte duplicada.

Não houve estudo com usuários idosos nem auditoria formal de conformidade WCAG. Os resultados descrevem as verificações automatizadas realizadas.

## Configuração e verificações

- pnpm install --frozen-lockfile: aprovado após o ajuste do lockfile.
- pnpm check: lint, TypeScript, **203 testes isolados** e build de produção aprovados.
- pnpm test:integration: **79 testes**, em MongoDB real descartável com replica set.
- bash scripts/test-auth.sh e2e: **20 cenários aprovados**, dez desktop e dez celular, sobre o build de produção.
- pnpm audit: **zero vulnerabilidades conhecidas**, incluindo dependências de desenvolvimento.
- git diff --check e verificação dos links locais da documentação: aprovados antes do commit documental.

Esses comandos locais usaram Node.js 22.23.3 disponível na máquina. O alvo declarado e o workflow são Node.js 24; o resultado remoto correspondente é conferido e informado na entrega, sem atribuir o ambiente local a essa versão.

O CI usa ações com runtime Node.js 24 fixadas por SHA, credencial de checkout não persistida e limite de vinte minutos por job. O pnpm continua fixado em packageManager. Não houve alteração do .env, habilitação indiscriminada de scripts ou instalação de serviços adicionais.

Commits de código: addc4c3 (snapshot), f36aed4 (logout), 45a912e (runner), 08615ba (respostas), f644132 (dependência de lint), f24aacf (Node/CI).

## Publicação ainda pendente

O [guia de deploy](../DEPLOY.md) descreve configurações, origem canônica, variáveis separadas para preview/produção, pool por instância, região, permissões/rede, custos e rollback sem reversão automática do banco.

Não foram criados projeto/domínio/deployment. Rede, credenciais e permissões do banco a partir da Vercel, quotas do plano, backups/restauração e comportamento HTTPS no ambiente hospedado precisam de validação durante a publicação autorizada. Não se usaram contas/fixtures de testes no banco real para simular essa validação.
