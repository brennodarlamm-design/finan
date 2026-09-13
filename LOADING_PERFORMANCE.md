# Carregamento sob demanda

## Resultado

O app passou de 50 para 43 tags de script iniciais. Quatro módulos locais, que somavam 209.632 bytes na versão anterior, saíram da abertura: motor SINAPI, interface SINAPI, templates de relatórios e painel Master. O carregador adicionado ocupa aproximadamente 2,4 KB. Valores sem compressão; não representam uma medição de latência em produção.

SheetJS, JSZip e jsPDF são baixados somente ao usar Excel, importar ZIP ou exportar PDF. O bootstrap antecipado de PDF.js foi removido; o OCR já importa a biblioteca quando recebe um PDF. Chart.js permanece na abertura por ser usado pelo dashboard.

## Comportamento

- Orçamentos aguarda o motor e a interface SINAPI. Relatórios aguarda também os templates, incluindo os dados SINAPI usados na impressão e exportação.
- A impressão iniciada pelo dashboard também carrega suas dependências. Exportações preservam a obra selecionada antes do download. A abertura em nova aba cria a janela dentro do clique para evitar bloqueio de popup.
- O Master continua carregado em sua página exclusiva.
- Scripts iniciais usam `defer`, preservando sua ordem de execução.
- Requisições simultâneas compartilham o carregamento. Uma falha permite nova tentativa. A navegação exibe um estado de carregamento e ignora respostas de navegações antigas.
- O bridge de eventos resolve a interface SINAPI no momento do clique, inclusive quando ela foi declarada depois da criação dos listeners. As URLs e ações permitidas continuam explícitas; não foi adicionado eval nem flexibilizada a CSP.

Recursos opcionais ainda não baixados precisam de conexão no primeiro uso. Esta entrega não adiciona cache offline via service worker.

## Verificações

`node scripts/test-assets-behavior.js` faz parte de `npm test`. Cobre carregamento sob demanda, deduplicação, falha e retry, ordem de dependências, ação de módulo tardio, navegação concorrente e ausência dos recursos opcionais no HTML inicial.

A verificação no navegador foi executada com dados fictícios e serviços simulados, sob os headers do Worker: dashboard, botão SINAPI, templates de relatórios, download de XLSX, leitura de PDF via OCR e abertura em 390 px. Nenhum erro de JavaScript foi observado. A rede confirmou a ausência dos recursos opcionais na abertura e um único download da biblioteca Excel.

Não houve publicação em produção. O ganho em tempo de abertura deve ser medido após homologação, com rede e dados representativos.
