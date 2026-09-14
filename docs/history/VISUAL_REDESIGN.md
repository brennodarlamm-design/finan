# Renovação visual do FinObra

## Verificação adicional das barras horizontais

Foram exercitados 56 cenários (14 rotas em 360, 390, 768 e 1440 pixels). Nas 32 ocorrências de tabelas mais largas que o contêiner, a rolagem alcançou o limite direito e revelou a última coluna. Também passaram interações de rolagem horizontal por mouse e navegação por Home/End, sem erros JavaScript. A barra recebeu maior espessura e contraste; regiões roláveis podem receber foco e responder às setas, Home e End. Evidências: `scratch/table-scroll-after.json` e `scratch/table-scroll-controls.json`. Teste em Edge/Chromium com viewports simulados, sem aparelho físico.

## Entrega

- Apresentação com fundo claro, verde sóbrio, proposta de valor em destaque e prévia ilustrativa do produto. Planos e módulos empilhados no celular, com acesso visível ao login.
- Sistema com paleta verde e ardósia, ícones vetoriais no menu, hierarquia tipográfica e espaçamento consistentes.
- Cabeçalho simplificado; filtro de obra e sincronização reunidos acima do conteúdo.
- Navegação inferior no celular: Início, Financeiro, Obras e Menu. Os atalhos respeitam as permissões existentes.
- Indicadores em duas colunas no celular e distribuição mais ampla no desktop. Corrigida a largura mínima que cortava a tela de obras.
- Receita e despesa precedem as ações auxiliares. Controles maiores, foco visível e formulários com área de conteúdo rolável e rodapé acessível.
- Tabelas compatíveis passam a apresentar registros como cartões rotulados no celular. Tabelas complexas mantêm rolagem horizontal no próprio contêiner.
- Login, cadastro, recuperação, páginas complementares e entrada do portal Master receberam a identidade compartilhada.
- Diálogos comuns têm identificação acessível, controle de Tab, Escape e retorno de foco.
- O tema é limitado à tela; navegação inferior e filtro não aparecem na impressão.

## Verificação local

Edge/Chromium via Playwright, com dados sintéticos e API isolada. Não foram enviadas mensagens nem feitas alterações em dados de produção.

- Larguras: 360, 390, 768, 1440 e 1920 pixels.
- 19 rotas principais, com estados vazios e registros preenchidos; sem transbordamento lateral da página ou erros JavaScript nos cenários executados.
- Apresentação, login, cadastro, privacidade, termos, validação e entrada Master também conferidos no build gerado.
- Abas financeiras, documentos, medições, recibos e orçamento da central da obra conferidas em quatro larguras.
- Abertura dos formulários de obra, lançamento, fornecedor e produto; navegação inferior, menu, Escape, filtro de obra e busca global.
- Cadastro e recuperação abertos pela interface; botão final de cadastro alcançável por rolagem. Autenticação real e envio de formulários externos não fazem parte desta verificação visual.
- Regressão de carregamento: módulos opcionais sob demanda, SINAPI, relatórios, download Excel e conversão de PDF aprovados.
- `npm test`: todas as verificações passaram.
- `node scripts/check-all-syntax.js`: 144 arquivos, zero erros.
- `npm run build:cloudflare`: aprovado.

Evidências locais e scripts de inspeção estão em `scratch/visual-*.png` e `scratch/verify-visual*.cjs`. A verificação usa viewports em navegador desktop; não substitui testes em aparelhos físicos/iOS. Alterações preparadas no projeto e no build local, sem publicação em produção.
