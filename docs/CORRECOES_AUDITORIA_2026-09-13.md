# Correções da auditoria — primeira entrega

Alterações locais sobre o commit `73f3c2575630`, sem publicação e sem modificar o banco de produção.

## Corrigido

- **A01 — Autenticação:** o disparo do robô utiliza o middleware de autenticação interna do backend. O router também nega acesso por padrão quando não recebe esse middleware.
- **A03 — Preços:** a busca usa a base SINAPI importada para a UF, referência e série do orçamento. Preços fixos de demonstração deixaram de participar da pesquisa. Bancos desmarcados não são consultados. A configuração de bancos passou a usar chave local isolada por empresa.
- **A05/A06 — SLAs:** nomes de funções e campos alinhados; preferências incluem `slas_padrao` no payload e no sanitizador. Processos da obra são persistidos em `cronograma_config.processos_sla`, no JSONB já existente, e a previsão é salva em `data_previsao`. Alterar o cronograma financeiro preserva os processos. Não é necessária migração de esquema para esta alteração.
- **A07 — Pré-Compras:** objeto registrado no bridge; criação e filtros passam a resolver suas ações.
- **A08 — Importação e ajuda:** formulário de importação XLSX/ZIP restaurado, usando o parser existente, validação, progresso, tratamento de falha e retorno ao editor. Ajuda e legenda usam um diálogo disponível.
- **A09 — Diálogos:** callbacks e valores iniciais corrigidos. Criar etapa persiste o nome e seleciona a etapa para os próximos itens. Renomeação e edição do BDI funcionam.
- **A10 — BDI zero:** preservado no formulário, gravação, proposta e exportação.
- **A11 — Pesquisa:** resultados anteriores são descartados ao mudar ou limpar a consulta; Enter sem resultado não insere itens antigos.
- **A13 — Demonstração:** abrir a tela não cria mais orçamento automaticamente. Registros já existentes não foram excluídos.

Durante os testes foi identificada outra falha: proposta e Excel aplicavam BDI novamente sobre totais já majorados. O cálculo foi centralizado para editor, proposta e Excel, respeitando o arredondamento do preço com BDI exibido nas linhas. As quantidades zeradas continuam zeradas.

Ao trocar períodos, apenas preços encontrados na base importada são atualizados. Itens sem preço permanecem com o valor anterior, recebem marcação de pendência e geram aviso no editor. Os demais bancos da lista não passam a ter uma integração real por esta alteração.

## Proteções aplicadas; funcionalidades ainda pendentes

- **A02 — Importação automática das 27 UFs:** o processamento simulado foi removido. O endpoint valida a referência e retorna indisponibilidade (`501`) em vez de inventar contagens ou gravar metadados fictícios. O importador automático real ainda precisa ser implementado. A importação manual funciona com arquivo fornecido pelo usuário.
- **A04 — Assinatura por link público:** coleta externa desativada até existir um endpoint autorizado que persista o documento e sua assinatura. A página informa indisponibilidade e não marca contratos como assinados. O módulo interno de assinaturas não foi alterado.
- **A12 — Analítico e ajuste em lote:** continuam desativados e identificados como indisponíveis. O filtro do grid foi implementado na segunda etapa, descrita abaixo.
- **Desconto global do editor:** identificado como indisponível, pois o cálculo existente não aplicava esse campo. Não é mais possível receber uma confirmação enganosa de alteração efetiva do total.

## Validação

`npm test`, a verificação de sintaxe (152 arquivos, zero erros) e a geração de produção para Cloudflare passaram. No celular, o editor ganhou rolagem vertical e quebra dos totalizadores; o teste confirma rolagem horizontal da tabela até o fim e acesso ao botão Recalcular. A medição do documento ainda registra overflow na página por trás do modal em 390 px; isso permanece para revisão e não significa que toda a responsividade do sistema foi validada.

Foi incluído `scripts/test-audit-regressions.js` em `npm test`, com cobertura para:

- Persistência e recuperação de preferências e processos de SLA, usando JSONB em PGlite local.
- Sanitização e limite de duração dos SLAs.
- Resolução de cliques de Pré-Compras.
- Seleção de preço por UF, exclusão de bancos desmarcados e pesquisa sem resultados antigos.
- BDI zero, callbacks, criação de etapa e recálculo dos preços importados.
- BDI aplicado uma vez e arredondamento consistente.
- Ausência de falsa coleta de assinatura pública.
- Bloqueio do robô sem autenticação e ausência de contagens fictícias.

O roteiro `scratch/verify-fixes-final.cjs` verificou 20 rotas e executou cliques reais em Pré-Compras, SLAs e SINAPI. No teste de importação, foi gerado um XLSX sintético, importado pelo formulário e pesquisado no editor. O item foi incluído na etapa criada, recalculado e comparado com proposta e workbook Excel: preço-base de teste de 999 com BDI de 10% resultou em 1.098,90, sem segunda aplicação do percentual. Nenhuma mensagem ou proposta foi enviada a terceiros.

Evidências locais: `scratch/fix-browser-final.log`, `scratch/fix-browser-results.json`, `scratch/correcoes-final-tests.log` e `scratch/correcoes-final-syntax.log`.

Os testes de tela usam Edge/Chromium com viewports de desktop e celular; não aparelhos físicos. Não houve teste com dados privados reais, API publicada ou arquivo oficial recente baixado da Caixa. A base importada continua armazenada no navegador conforme a arquitetura existente; os orçamentos e os SLAs usam a sincronização da aplicação.

## Segunda etapa

- Filtro do grid habilitado: código, descrição, banco e etapa, ignorando maiúsculas e acentos. O filtro é separado por orçamento e não altera os dados persistidos. Uma consulta vazia restaura todos os itens; consultas sem correspondência mostram zero resultados. Subtotais filtrados são identificados como visíveis, e os totais gerais permanecem integrais.
- A pendência de overflow foi investigada: a medição anterior ocorria durante a transição do layout de desktop para celular. Com a transição concluída, o documento não transborda em 390 px. A rolagem horizontal da tabela e o acesso ao botão Recalcular são verificados no roteiro da segunda etapa.
- Evidências: `scratch/verify-stage2.cjs`, `scratch/stage2-browser.log`, `scratch/stage2-tests.log` e `scratch/stage2-syntax.log`.

Assinatura pública, ingestão automática, composição analítica, ajuste em lote e desconto global continuam pendentes. Nenhuma publicação foi realizada.

## Terceira etapa — 14/09/2026

O ajuste em lote de **quantidades** está implementado. O botão informa claramente seu alcance: aplica um percentual aos itens visíveis, respeitando o filtro, e mantém os preços unitários. Aceita redução até -100% e aumento até 1000%, arredonda quantidades a três casas e preserva quantidades zeradas. A prévia informa o número de itens alterados e o total geral antes/depois. A gravação depende da confirmação; se o orçamento mudar enquanto a prévia estiver aberta, a operação é interrompida para revisão.

Testes cobrem filtro, preservação do original durante a prévia, percentual zero, redução de 100%, entrada inválida e cálculo com BDI. No navegador, o item de 999 com BDI de 10% passou de quantidade 1 para 1,5 e total de 1.098,90 para 1.648,35 somente após confirmar. A rolagem horizontal e o acesso ao Recalcular no celular continuam aprovados.

Evidências: `scratch/stage3-tests.log`, `scratch/stage3-browser.log` e `scratch/verify-stage3.cjs`. Assinatura pública, importação automática, composição analítica e desconto global permanecem pendentes. Ajustes em lote de preços não fazem parte desta implementação. Alterações locais, sem publicação.
