# Revisão da interface — simplicidade e leitura

Solicitada pelo usuário após a Fase 4: a aplicação também será usada por pessoas mais velhas e precisa ser mais fácil de entender. O escopo é revisar as telas existentes e explicar o projeto, sem iniciar compartilhamento, reservas ou sorteios.

## Mudanças de uso

- Página pública explica como começar e distingue entrar de criar conta.
- Início destaca a lista pessoal e a criação de grupos, com instruções diretas.
- Menu sempre visível: Início, Minha lista, Meus grupos e Meu perfil. A seção atual tem fundo destacado e aria-current; subpáginas preservam essa indicação.
- Textos deixam de usar frases como “Um novo desejo” e passam a dizer “Adicionar presente” ou “Editar presente”.
- Fonte sem serifa, base de 18 px, contraste das bordas reforçado e controles principais com pelo menos 48 px. Tema natalino preservado com verde, vermelho e fundo creme.
- Formulários em uma coluna, com largura limitada e exemplos próximos aos campos. Link da loja é explicado como endereço a copiar e colar.
- Imagem opcional fica recolhida. Na edição, uma imagem existente já deixa a seção aberta; erro do campo também abre a seção.
- Cadastro/entrada oferecem Mostrar senha/Ocultar senha para conferir a digitação. Isso só altera a apresentação local, sem armazenar ou enviar a senha a outro lugar.
- Tipos de grupo aparecem como duas escolhas visíveis e explicadas. “Convencional” passa a aparecer como “Lista em grupo”; o valor interno conventional permanece o mesmo.
- Gestão de cada pessoa fica em “Opções para [nome]”, separada da lista de participantes. Não depende de ícones sem texto nem de passar o mouse.
- Confirmação de grupo repete a operação: Sim, remover/transferir/sair/encerrar. Cancelar continua disponível, preservando os dados.
- Teclado tem foco visível e atalho Pular para o conteúdo. Diálogos nativos preservam gerenciamento de foco.

## Arquivos principais

`src/app/globals.css`: tipografia e tokens. `src/components/account-nav.tsx` e layout privado: navegação e atalho. Páginas públicas, auth, dashboard, perfil, presentes e grupos: organização e linguagem. `src/modules/*/components`: formulários, cards e diálogos. Nenhuma regra de propriedade, administração, sessão ou transação foi relaxada.

A explicação para estudo está em [COMO-O-PROJETO-FUNCIONA.md](../COMO-O-PROJETO-FUNCIONA.md), com árvore de pastas, mapa de rotas, responsabilidades, exemplos de código, fluxos completos e orientação de leitura.

## Verificação

O novo E2E foi escrito antes da implementação e falhou pela ausência de Mostrar senha. Depois passou o fluxo completo: conferir/ocultar senha, criar conta, identificar seção atual, usar atalho de teclado, revelar imagem opcional, cadastrar presente e cancelar exclusão com restauração de foco.

A suíte de navegador tem 12 testes, nos projetos desktop e celular, incluindo os fluxos anteriores de autenticação, presentes e grupos. Capturas foram revisadas. O cenário novo inclui viewport de 320 px com fonte raiz em 200% e verificação de ausência de rolagem horizontal; isso é ampliação da fonte, não uma auditoria de todos os níveis de zoom do navegador.

`pnpm check` passou com lint, tipos, 123 testes isolados e build. `bash scripts/test-auth.sh e2e` passou com os 12 testes de navegador após a revisão final. O resultado remoto do CI é informado na entrega. Revisão estática seguiu a checklist da skill vercel:react-best-practices: fronteiras servidor/cliente, hooks, semântica, rótulos, estado pendente, dados privados e ausência de dependências extras.

Não houve sessão de usabilidade com pessoas mais velhas nem auditoria completa de acessibilidade. A entrega melhora os pontos observados e os verifica tecnicamente; a avaliação desse público ainda precisa de uso real.

O banco configurado e o .env foram preservados. Dados automatizados de navegador pertencem exclusivamente ao MongoDB descartável do runner.

Commits funcionais: `3aa778e` (navegação, leitura e conta), `31f7e79` (presentes/grupos) e `258b726` (teste de usabilidade técnico). O guia e este relatório possuem commit de documentação separado, consultável no histórico.
