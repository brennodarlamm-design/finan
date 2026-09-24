// marketing/manuais-data.js — Catálogo dos 12 Manuais Oficiais do FinGo
// Contém passo a passo detalhado, diagramas esquemáticos de telas e dicas de engenharia

export const TRILHAS = [
  { id: "todas", label: "Todos os Manuais", icone: "📚" },
  { id: "obras", label: "Obras & Canteiro", icone: "🏗️" },
  { id: "financeiro", label: "Financeiro & Caixa", icone: "💰" },
  { id: "fiscal", label: "Fiscal & Suprimentos", icone: "📄" },
  { id: "engenharia", label: "Engenharia & SINAPI", icone: "📐" },
  { id: "bim", label: "BIM 3D & Inovação", icone: "🧊" },
];

export const MANUAIS = [
  {
    id: "manual-1-inicio-obra",
    numero: "01",
    trilha: "obras",
    trilhaLabel: "Obras & Canteiro",
    titulo: "Como Iniciar uma Obra, Cadastrar Clientes e Etapas Construtivas",
    modulo: "Obras & Clientes",
    tempoLeitura: "4 min",
    nivel: "Iniciante",
    resumo: "Estruturação completa de um novo canteiro: vinculação do cliente, contrato de financiamento (Caixa), cronograma e equipe responsável.",
    passos: [
      {
        num: 1,
        titulo: "Acessar o Módulo de Obras",
        desc: "No menu lateral esquerdo do FinGo, clique no ícone de capacete ou na opção 'Obras & Clientes'.",
        ondeExecutar: "Menu Lateral > Obras & Clientes"
      },
      {
        num: 2,
        titulo: "Iniciar o Cadastro",
        desc: "No canto superior direito da tela, clique no botão destacado em verde ácido '+ Nova Obra'.",
        ondeExecutar: "Botão '+ Nova Obra' no topo da listagem"
      },
      {
        num: 3,
        titulo: "Informar Dados Contratuais",
        desc: "Preencha o Nome da Obra, Razão Social/Nome do Cliente, CPF/CNPJ, Endereço do Canteiro e Engenheiro Responsável (CREA/CAU).",
        ondeExecutar: "Formulário: Aba Dados Gerais"
      },
      {
        num: 4,
        titulo: "Definir Prazos e Metas Financeiras",
        desc: "Informe a data prevista de início e entrega, e o valor total orçado ou contratado com o cliente/banco financiador.",
        ondeExecutar: "Formulário: Aba Prazos & Orçamento"
      },
      {
        num: 5,
        titulo: "Concluir e Ativar o Painel",
        desc: "Clique em 'Salvar Obra'. O FinGo criará automaticamente o centro de custo dedicado e o painel de evolução física da obra.",
        ondeExecutar: "Botão 'Salvar Obra' no rodapé do modal"
      }
    ],
    telaMockup: {
      tituloTela: "FinGo — Painel de Obras & Clientes",
      localAcao: "Topo direito: botão verde neon '+ Nova Obra' | Tabela de Canteiros Ativos",
      elementosChave: [
        "[Sidebar] Obras & Clientes (Ativo)",
        "[Header] Filtros por Status (Em Andamento, Concluída, Licitação)",
        "[Ação Primária] Botão '+ Nova Obra' (#C6FF00)",
        "[Grid de Cards] Obra Residencial Solar, Centro Comercial Alpha"
      ]
    },
    dicaEngenharia: "Inserir o número de contrato de repasse da Caixa Econômica Federal logo no início automatiza o preenchimento dos relatórios de medição e RAE/PLS posteriores."
  },
  {
    id: "manual-2-diario-documentacao",
    numero: "02",
    trilha: "obras",
    trilhaLabel: "Obras & Canteiro",
    titulo: "Documentação de Obras, Fotos de Canteiro e Fases da Construção",
    modulo: "Documentação de Obras",
    tempoLeitura: "3 min",
    nivel: "Iniciante",
    resumo: "Gestão centralizada de alvarás, memoriais, projetos executivos e diário fotográfico segmentado por fases construtivas.",
    passos: [
      {
        num: 1,
        titulo: "Abrir a Central de Documentos",
        desc: "Selecione a opção 'Documentos' no menu lateral e escolha a obra desejada no seletor superior.",
        ondeExecutar: "Menu Lateral > Documentação de Obras"
      },
      {
        num: 2,
        titulo: "Navegar pelas Fases",
        desc: "Clique na pasta correspondente à fase atual: Fundação, Estrutura, Alvenaria, Instalações ou Acabamento.",
        ondeExecutar: "Abas de Fases Construtivas"
      },
      {
        num: 3,
        titulo: "Upload de Arquivos e Fotos",
        desc: "Arraste fotos tiradas no canteiro pelo celular ou anexe arquivos PDF de projetos arquitetônicos e estruturais.",
        ondeExecutar: "Área de Dropzone 'Arraste arquivos aqui'"
      },
      {
        num: 4,
        titulo: "Categorização e Observações",
        desc: "Adicione uma legenda ou data de inspeção técnica (ex: 'Concretagem da laje do 2º pavimento — FCK 30 MPa').",
        ondeExecutar: "Campo 'Observação Técnica'"
      },
      {
        num: 5,
        titulo: "Gerar Relatório Fotográfico",
        desc: "Clique em 'Exportar Relatório' para gerar um PDF elegante com as fotos e dados da obra para enviar ao cliente ou banco.",
        ondeExecutar: "Botão 'Exportar Relatório PDF'"
      }
    ],
    telaMockup: {
      tituloTela: "FinGo — Acervo Documental & Fotos de Canteiro",
      localAcao: "Pasta da Obra > Drag & Drop de PDFs e Fotos > Botão 'Exportar Relatório'",
      elementosChave: [
        "[Seletor de Obra] Edifício Horizon — Torre A",
        "[Pastas de Fases] Fundação (14 fotos), Alvenaria (22 fotos)",
        "[Galeria] Grid com miniaturas e metadados de data/hora",
        "[Ação] 'Compartilhar Link Seguro com Cliente'"
      ]
    },
    dicaEngenharia: "Fotos enviadas pelo celular da equipe em campo são compactadas e salvas em cache local mesmo se o canteiro estiver temporariamente sem sinal 4G."
  },
  {
    id: "manual-3-medicoes-faturamento",
    numero: "03",
    trilha: "obras",
    trilhaLabel: "Obras & Canteiro",
    titulo: "Boletim de Medição de Engenharia e Apuração de Retenções (INSS / ISS)",
    modulo: "Medições & Faturamento",
    tempoLeitura: "5 min",
    nivel: "Intermediário",
    resumo: "Cálculo do avanço físico acumulado de empreiteiros com apuração automática de retenções técnicas (11% INSS e 5% ISS) e valor líquido liberado.",
    passos: [
      {
        num: 1,
        titulo: "Acessar Medições",
        desc: "Abra o módulo 'Medições & Faturamento' e selecione a obra e o contrato do prestador/empreiteiro.",
        ondeExecutar: "Menu Lateral > Medições & Faturamento"
      },
      {
        num: 2,
        titulo: "Criar Nova Medição Periódica",
        desc: "Clique em '+ Nova Medição'. Defina o número da medição (ex: Medição 03) e o período de apuração de campo.",
        ondeExecutar: "Botão '+ Nova Medição'"
      },
      {
        num: 3,
        titulo: "Lançar Quantidades ou Percentuais",
        desc: "Para cada item contratado (ex: alvenaria, reboco, pintura), insira o percentual ou quantidade executada na quinzena/mês.",
        ondeExecutar: "Planilha de Itens Contratuais"
      },
      {
        num: 4,
        titulo: "Conferir Retenções Tributárias Automáticas",
        desc: "O FinGo calcula automaticamente a retenção de 11% do INSS (conforme Instrução Normativa RFB) e o ISS municipal, exibindo o valor líquido.",
        ondeExecutar: "Quadro Resumo de Retenções & Descontos"
      },
      {
        num: 5,
        titulo: "Aprovar e Liberar para o Financeiro",
        desc: "Altere o status para 'Aprovada'. O sistema gera o título correspondente no Contas a Pagar com a data de vencimento acordada.",
        ondeExecutar: "Ação 'Aprovar Medição e Gerar Fatura'"
      }
    ],
    telaMockup: {
      tituloTela: "FinGo — Boletim de Medição de Serviços e Empreiteiros",
      localAcao: "Planilha de Serviços > Coluna '% Executado no Período' > Resumo de Retenções",
      elementosChave: [
        "[Cabeçalho] Contrato Empreiteira Silva Santos | Medição 04",
        "[Planilha] Item 2.1 Alvenaria: 100% Acumulado (R$ 15.000,00)",
        "[Quadro Fiscal] Valor Bruto: R$ 15.000 | Retenção INSS (11%): -R$ 1.650 | Líquido: R$ 13.350",
        "[Botão de Ação] 'Aprovar e Enviar Espelho PDF'"
      ]
    },
    dicaEngenharia: "A retenção técnica de 11% sobre cessão de mão de obra protege a construtora contra responsabilidade solidária em ações trabalhistas e fiscais."
  },
  {
    id: "manual-4-lancamentos-centros-custo",
    numero: "04",
    trilha: "financeiro",
    trilhaLabel: "Financeiro & Caixa",
    titulo: "Lançamentos Financeiros, Despesas de Obra vs Escritório e Centros de Custo",
    modulo: "Lançamentos",
    tempoLeitura: "4 min",
    nivel: "Iniciante",
    resumo: "Segregação contábil rigorosa entre custos diretos de canteiro e despesas administrativas da sede para DRE e BDI reais.",
    passos: [
      {
        num: 1,
        titulo: "Entrar em Lançamentos",
        desc: "No menu lateral, selecione 'Financeiro' e clique em 'Lançamentos'.",
        ondeExecutar: "Menu Lateral > Financeiro > Lançamentos"
      },
      {
        num: 2,
        titulo: "Novo Registro",
        desc: "Clique em '+ Novo Lançamento' no canto superior direito.",
        ondeExecutar: "Botão '+ Novo Lançamento'"
      },
      {
        num: 3,
        titulo: "Classificar a Operação",
        desc: "Defina se é Despesa (a pagar) ou Receita (a receber), informe o valor e a data de vencimento.",
        ondeExecutar: "Campos: Tipo, Valor e Vencimento"
      },
      {
        num: 4,
        titulo: "Vincular o Centro de Custo",
        desc: "Selecione a Obra específica caso seja custo direto (cimento, areia, diárias), ou selecione 'Sede / Corporativo' caso seja despesa administrativa.",
        ondeExecutar: "Campo 'Centro de Custo'"
      },
      {
        num: 5,
        titulo: "Anexar Comprovante",
        desc: "Anexe o comprovante bancário ou nota fiscal e clique em 'Salvar'. O DRE da obra será recalculado em tempo real.",
        ondeExecutar: "Upload de Comprovante > Botão 'Salvar'"
      }
    ],
    telaMockup: {
      tituloTela: "FinGo — Lançamentos Financeiros e Centros de Custo",
      localAcao: "Modal Novo Lançamento > Seleção Centro de Custo (Obra vs Sede)",
      elementosChave: [
        "[Tipo] Despesa / Contas a Pagar",
        "[Valor] R$ 4.850,00 | Vencimento: 25/10/2026",
        "[Centro de Custo] Obra Residencial Jardins (#OB-04)",
        "[Categoria] Materiais Básicos > Concreto Usinado"
      ]
    },
    dicaEngenharia: "Nunca lance o combustível do carro da diretoria no centro de custo da obra; isso distorce a margem real de lucro e corrompe o cálculo do BDI."
  },
  {
    id: "manual-5-conciliacao-ofx",
    numero: "05",
    trilha: "financeiro",
    trilhaLabel: "Financeiro & Caixa",
    titulo: "Conciliação Bancária Automática com Extrato OFX",
    modulo: "Conciliação OFX",
    tempoLeitura: "5 min",
    nivel: "Avançado",
    resumo: "Como importar o extrato bancário oficial do seu banco e conciliar centenas de transações de obras em segundos.",
    passos: [
      {
        num: 1,
        titulo: "Exportar Extrato do Banco",
        desc: "No Internet Banking da sua construtora, exporte o extrato no formato .OFX (padrão de todos os bancos brasileiros).",
        ondeExecutar: "Internet Banking da Construtora"
      },
      {
        num: 2,
        titulo: "Abrir Conciliação no FinGo",
        desc: "No menu lateral, acesse 'Financeiro' > 'Conciliação OFX'.",
        ondeExecutar: "Menu Lateral > Conciliação OFX"
      },
      {
        num: 3,
        titulo: "Fazer Upload do Arquivo",
        desc: "Arraste o arquivo .ofx para a área de upload do FinGo e selecione a conta corrente correspondente.",
        ondeExecutar: "Área de Upload de Extrato OFX"
      },
      {
        num: 4,
        titulo: "Casamento Inteligente de Transações",
        desc: "O robô do FinGo cruza os débitos e créditos com os lançamentos cadastrados, comparando valor e data.",
        ondeExecutar: "Tabela de Conciliação Automática"
      },
      {
        num: 5,
        titulo: "Confirmar Conciliação em Lote",
        desc: "Revise os matches destacados em verde e clique no botão 'Conciliar Selecionados'. Itens não cadastrados podem ser criados com 1 clique.",
        ondeExecutar: "Botão 'Conciliar Todos os Matches'"
      }
    ],
    telaMockup: {
      tituloTela: "FinGo — Conciliação Bancária Inteligente OFX",
      localAcao: "Extrato Bancário vs Lançamentos do Sistema > Botão 'Conciliar'",
      elementosChave: [
        "[Conta] Banco do Brasil — Ag 1234 CC 56789-0",
        "[Extrato OFX] PIX Enviado Fornecedor Cimento: R$ 3.200,00",
        "[FinGo] Match Encontrado: NF 4521 Votorantim R$ 3.200,00 (100% Match)",
        "[Ação] Botão 'Conciliar em Lote' (#C6FF00)"
      ]
    },
    dicaEngenharia: "Ajustar a tolerância de data para 3 dias úteis no FinGo absorve compensações bancárias de pagamentos feitos no fim de semana."
  },
  {
    id: "manual-6-recibos-oficiais",
    numero: "06",
    trilha: "financeiro",
    trilhaLabel: "Financeiro & Caixa",
    titulo: "Emissão de Recibos Oficiais e Assinatura Digital ICP-Brasil",
    modulo: "Recibos Oficiais",
    tempoLeitura: "3 min",
    nivel: "Iniciante",
    resumo: "Emissão de recibos para autônomos, diárias e fornecedores com QR Code de validação pública e assinatura eletrônica.",
    passos: [
      {
        num: 1,
        titulo: "Acessar Recibos",
        desc: "No menu lateral, clique em 'Recibos Oficiais'.",
        ondeExecutar: "Menu Lateral > Recibos Oficiais"
      },
      {
        num: 2,
        titulo: "Criar Novo Recibo",
        desc: "Clique no botão '+ Novo Recibo' no topo da página.",
        ondeExecutar: "Botão '+ Novo Recibo'"
      },
      {
        num: 3,
        titulo: "Preencher Dados do Pagamento",
        desc: "Selecione a obra, o favorecido (nome e CPF/CNPJ), o valor em reais e o serviço prestado.",
        ondeExecutar: "Formulário de Recibo"
      },
      {
        num: 4,
        titulo: "Assinatura e Validação",
        desc: "Colete a assinatura na tela sensível ao toque ou envie o link seguro de assinatura para o WhatsApp do profissional.",
        ondeExecutar: "Painel de Assinatura Digital"
      },
      {
        num: 5,
        titulo: "Emitir e Compartilhar",
        desc: "O recibo é gerado com hash criptográfico e QR Code oficial que pode ser verificado publicamente no portal /validar.",
        ondeExecutar: "Botão 'Emitir PDF com QR Code'"
      }
    ],
    telaMockup: {
      tituloTela: "FinGo — Emissor de Recibos com Autenticidade Digital",
      localAcao: "Visualização do Recibo > QR Code de Validação > Botão 'Assinar'",
      elementosChave: [
        "[Recibo Nº 0042/2026] Valor: R$ 1.800,00 (Hum mil e oitocentos reais)",
        "[Favorecido] José Carlos da Silva (Eletricista)",
        "[Segurança] QR Code para fingo.api.br/validar",
        "[Ação] 'Compartilhar via WhatsApp'"
      ]
    },
    dicaEngenharia: "Recibos emitidos com o QR Code oficial do FinGo têm validade jurídica perante fiscalizações e auditorias da Caixa e Receita Federal."
  },
  {
    id: "manual-7-nfe-ocr-scanner",
    numero: "07",
    trilha: "fiscal",
    trilhaLabel: "Fiscal & Suprimentos",
    titulo: "Leitura Inteligente de NF-e, Importação em Lote de XMLs e OCR",
    modulo: "Notas Fiscais",
    tempoLeitura: "4 min",
    nivel: "Intermediário",
    resumo: "Elimine a digitação de notas: captura automática de dados de fornecedores, impostos e materiais via XML ou foto de papel.",
    passos: [
      {
        num: 1,
        titulo: "Acessar Módulo Fiscal",
        desc: "No menu lateral, selecione 'Notas Fiscais'.",
        ondeExecutar: "Menu Lateral > Notas Fiscais"
      },
      {
        num: 2,
        titulo: "Escolher Método de Entrada",
        desc: "Clique em 'Importar XML / OCR'. Escolha entre arrastar arquivos XML ou subir fotos/PDFs de notas fiscais.",
        ondeExecutar: "Botão 'Importar XML / OCR'"
      },
      {
        num: 3,
        titulo: "Processamento Automático",
        desc: "O motor OCR do FinGo lê o CNPJ do emissor, número da nota, itens de materiais, valor total e parcelas de vencimento.",
        ondeExecutar: "Painel de Reconhecimento OCR"
      },
      {
        num: 4,
        titulo: "Vincular à Obra",
        desc: "Confirme a qual obra e centro de custo os materiais pertencem.",
        ondeExecutar: "Campo 'Centro de Custo / Obra'"
      },
      {
        num: 5,
        titulo: "Gravar e Gerar Contas a Pagar",
        desc: "Ao salvar, a nota é arquivada e as parcelas são lançadas automaticamente no Contas a Pagar da construtora.",
        ondeExecutar: "Botão 'Confirmar e Integrar Financeiro'"
      }
    ],
    telaMockup: {
      tituloTela: "FinGo — Central de Leitura de Notas Fiscais e OCR",
      localAcao: "Upload de XML/DANFE > Prévia de Itens Extraídos > Botão 'Integrar'",
      elementosChave: [
        "[Entrada] NF-e 000.184.291 — Gerdau Aços Longos",
        "[Itens Detectados] Barra de Aço CA-50 10mm (1.200 kg) — R$ 8.400,00",
        "[Impostos] ICMS ST e IPI calculados automaticamente",
        "[Ação] 'Criar Contas a Pagar em 3x'"
      ]
    },
    dicaEngenharia: "Com a importação de XML no FinGo, você pode usar a busca automática SEFAZ para puxar todas as notas emitidas contra o seu CNPJ sem precisar pedir ao fornecedor."
  },
  {
    id: "manual-8-precompras-suprimentos",
    numero: "08",
    trilha: "fiscal",
    trilhaLabel: "Fiscal & Suprimentos",
    titulo: "Requisições de Pré-Compras, Cotações e Contratos de Suprimentos",
    modulo: "Pré-Compras",
    tempoLeitura: "4 min",
    nivel: "Intermediário",
    resumo: "Fluxo completo de suprimentos: do pedido do encarregado de obra até o mapa de cotação e aprovação do gestor de compras.",
    passos: [
      {
        num: 1,
        titulo: "Criar Solicitação de Compra",
        desc: "O engenheiro de obra acessa 'Pré-Compras' e solicita materiais (ex: '300 m² de piso cerâmico PEI-4').",
        ondeExecutar: "Menu Lateral > Pré-Compras > '+ Nova Solicitação'"
      },
      {
        num: 2,
        titulo: "Cadastrar Cotações",
        desc: "O setor de compras insere os preços dos fornecedores concorrentes no mapa comparativo do FinGo.",
        ondeExecutar: "Aba 'Mapa de Cotações'"
      },
      {
        num: 3,
        titulo: "Comparação de Melhores Condições",
        desc: "O sistema indica automaticamente a proposta mais vantajosa considerando preço unitário, frete e prazo de entrega.",
        ondeExecutar: "Quadro Comparativo de Fornecedores"
      },
      {
        num: 4,
        titulo: "Aprovação Financeira",
        desc: "O diretor ou gestor financeiro aprova o pedido com 1 clique no painel ou autoriza diretamente pelo WhatsApp.",
        ondeExecutar: "Botão 'Aprovar Ordem de Compra'"
      },
      {
        num: 5,
        titulo: "Emissão da Ordem de Compra",
        desc: "O FinGo gera o pedido oficial em PDF para ser enviado ao fornecedor vencedor.",
        ondeExecutar: "Botão 'Exportar Ordem de Compra (OC)'"
      }
    ],
    telaMockup: {
      tituloTela: "FinGo — Mapa de Cotações e Ordens de Compra",
      localAcao: "Quadro de Cotações Fornecedor A vs B vs C > Botão 'Aprovar'",
      elementosChave: [
        "[Requisição] 150 m³ Areia Média Lavada — Obra Residencial",
        "[Fornecedor 1] Mineração Norte: R$ 85/m³ (Entrega em 2 dias)",
        "[Fornecedor 2] Depósito Central: R$ 92/m³ (Entrega imediata)",
        "[Decisão] Menor Preço Destacado em Verde (#C6FF00)"
      ]
    },
    dicaEngenharia: "Exigir 3 cotações no FinGo antes de qualquer compra acima de R$ 2.000 reduz o custo total de materiais em média 8% a 12% por obra."
  },
  {
    id: "manual-9-orcamento-sinapi",
    numero: "09",
    trilha: "engenharia",
    trilhaLabel: "Engenharia & SINAPI",
    titulo: "Orçamento Paramétrico, Composições Oficiais SINAPI e BDI Caixa",
    modulo: "Orçamentos",
    tempoLeitura: "6 min",
    nivel: "Avançado",
    resumo: "Montagem de planilhas orçamentárias completas conectadas à base mensal oficial da Caixa Econômica Federal e IBGE.",
    passos: [
      {
        num: 1,
        titulo: "Criar Nova Planilha",
        desc: "Acesse 'Orçamentos' e clique no botão '+ Novo Orçamento'.",
        ondeExecutar: "Menu Lateral > Orçamentos > '+ Novo Orçamento'"
      },
      {
        num: 2,
        titulo: "Selecionar UF e Regime Tributário",
        desc: "Escolha o estado da obra (ex: SP, RJ, MG) e defina se a planilha será Desonerada (CPRB 4,5%) ou Não Desonerada.",
        ondeExecutar: "Seletor de Estado e Regime SINAPI"
      },
      {
        num: 3,
        titulo: "Buscar e Inserir Composições",
        desc: "Pesquise por código ou nome do serviço (ex: 'alvenaria de bloco', 'pintura acrílica', 'estaca escavada').",
        ondeExecutar: "Barra de Busca SINAPI (Caixa/IBGE)"
      },
      {
        num: 4,
        titulo: "Lançar Quantitativos de Projeto",
        desc: "Insira as metragens levantadas em projeto. O sistema calcula custo direto de materiais e mão de obra automaticamente.",
        ondeExecutar: "Coluna 'Quantidade' da Planilha"
      },
      {
        num: 5,
        titulo: "Aplicar Taxa de BDI",
        desc: "Defina o percentual de BDI (ou use o preset oficial do TCU) para calcular o preço de venda final do contrato.",
        ondeExecutar: "Campo 'Taxa de BDI (%)'"
      }
    ],
    telaMockup: {
      tituloTela: "FinGo — Orçamento de Engenharia com Base SINAPI",
      localAcao: "Busca de Composições SINAPI > Tabela de Custos > BDI Aplicado",
      elementosChave: [
        "[Base Ativa] SINAPI Caixa Oficial — UF: SP (Desonerado)",
        "[Composição 88309] Pedreiro com encargos complementares (R$ 28,45/h)",
        "[Custo Direto] R$ 184.200,00 | BDI (24,50%): R$ 45.129,00",
        "[Preço Final] R$ 229.329,00 (Pronto para licitação/Caixa)"
      ]
    },
    dicaEngenharia: "O FinGo mantém o histórico das versões do SINAPI mês a mês, permitindo reajustar planilhas com os índices de inflação oficiais da construção (INCC)."
  },
  {
    id: "manual-10-proposta-comercial",
    numero: "10",
    trilha: "engenharia",
    trilhaLabel: "Engenharia & SINAPI",
    titulo: "Geração de Proposta Comercial Profissional para Clientes",
    modulo: "Exportar Relatórios",
    tempoLeitura: "3 min",
    nivel: "Iniciante",
    resumo: "Como transformar a planilha técnica de engenharia em uma proposta comercial executiva e visualmente impecável para fechar contratos.",
    passos: [
      {
        num: 1,
        titulo: "Acessar o Orçamento Aprovado",
        desc: "No módulo de Orçamentos, localize a planilha que deseja apresentar ao cliente.",
        ondeExecutar: "Orçamentos > Listagem de Planilhas"
      },
      {
        num: 2,
        titulo: "Abrir Gerador de Proposta",
        desc: "Clique no menu de ações e selecione 'Gerar Proposta Comercial'.",
        ondeExecutar: "Ações da Planilha > 'Gerar Proposta Comercial'"
      },
      {
        num: 3,
        titulo: "Definir Nível de Detalhe",
        desc: "Escolha entre modelo Sintético (resumo por etapas para o cliente final) ou Analítico (com memória técnica para investidores).",
        ondeExecutar: "Seletor de Modelo de Apresentação"
      },
      {
        num: 4,
        titulo: "Personalizar Prazos e Condições",
        desc: "Insira as condições comerciais: entrada, parcelamento conforme medição e validade da proposta.",
        ondeExecutar: "Aba 'Condições Comerciais'"
      },
      {
        num: 5,
        titulo: "Exportar com a Logo da Construtora",
        desc: "Clique em 'Exportar PDF'. O FinGo gera o documento formatado em alta resolução com a marca da sua empresa pronta para assinatura.",
        ondeExecutar: "Botão 'Exportar Proposta Comercial em PDF'"
      }
    ],
    telaMockup: {
      tituloTela: "FinGo — Editor e Emissor de Proposta Comercial",
      localAcao: "Configuração de Capa e Valores > Botão 'Exportar PDF Executivo'",
      elementosChave: [
        "[Capa] Logo da Construtora + Foto Conceito da Obra",
        "[Cronograma Físico-Financeiro] Gráfico de Barras por Etapas",
        "[Condições] Entrada de 30% + 5x conforme avanço de medição",
        "[Assinatura] Campo pronto para assinatura digital"
      ]
    },
    dicaEngenharia: "Apresentar propostas comerciais com cronograma físico-financeiro transparente transmite autoridade e eleva o ticket médio fechado."
  },
  {
    id: "manual-11-bim-3d-navegacao",
    numero: "11",
    trilha: "bim",
    trilhaLabel: "BIM 3D & Inovação",
    titulo: "Navegação 3D no Canteiro, Planos de Seção e Isolamento de Pavimentos",
    modulo: "BIM Viewer 3D",
    tempoLeitura: "5 min",
    nivel: "Intermediário",
    resumo: "Como abrir e manipular modelos 3D volumétricos de engenharia direto no navegador no celular ou tablet sem travar o dispositivo.",
    passos: [
      {
        num: 1,
        titulo: "Abrir o Visualizador 3D",
        desc: "Na página de detalhes da obra, clique na aba 'Modelo 3D (BIM)' ou acesse o BIM Viewer no menu.",
        ondeExecutar: "Detalhes da Obra > Aba 'Modelo 3D (BIM)'"
      },
      {
        num: 2,
        titulo: "Controles de Câmera e Órbita",
        desc: "Gire o modelo arrastando o mouse ou o dedo na tela; dê zoom com o scroll ou movimento de pinça no smartphone.",
        ondeExecutar: "Área da Viewport 3D"
      },
      {
        num: 3,
        titulo: "Ativar Planos de Seção (Cortes)",
        desc: "Na barra de ferramentas inferior do 3D, clique no ícone de serra/corte para inspecionar vigas e instalações internas.",
        ondeExecutar: "Barra 3D > Ferramenta 'Plano de Corte'"
      },
      {
        num: 4,
        titulo: "Isolar Pavimentos",
        desc: "Abra o painel lateral de pavimentos e clique no pavimento desejado (ex: 'Térreo' ou 'Primeiro Andar') para ocultar os demais.",
        ondeExecutar: "Painel Direito > Lista de Pavimentos"
      },
      {
        num: 5,
        titulo: "Consultar Propriedades Físicas",
        desc: "Toque em qualquer elemento construtivo (pilar, parede, laje) para inspecionar volume (m³), área (m²) e tipo de material.",
        ondeExecutar: "Clique no Elemento > Inspetor de Propriedades"
      }
    ],
    telaMockup: {
      tituloTela: "FinGo — BIM Viewer 3D & Inovação no Canteiro",
      localAcao: "Viewport 3D > Barra de Ferramentas (Órbita, Corte, Pavimento, Propriedades)",
      elementosChave: [
        "[Viewport] Modelo Arquitetônico Renderizado com Iluminação Suave",
        "[Plano de Corte] Corte Horizontal a 1,20m mostrando distribuição interna",
        "[Inspetor] Parede Alvenaria Bloco Cerâmico: 18,40 m²",
        "[FPS] Indicador estável a 60 FPS com LOD automático"
      ]
    },
    dicaEngenharia: "Usar o visualizador 3D nas reuniões matinais de canteiro (DDS) reduz erros de interpretação de projetos em papel pelos mestres e encarregados."
  },
  {
    id: "manual-12-bim-clash-detection",
    numero: "12",
    trilha: "bim",
    trilhaLabel: "BIM 3D & Inovação",
    titulo: "Coordenação Espacial e Detecção de Interferências Físicas (Clash Detection)",
    modulo: "BIM Clash Detection",
    tempoLeitura: "6 min",
    nivel: "Avançado",
    resumo: "Detecção automatizada de choques geométricos entre disciplinas (ex: tubulação de esgoto cruzando vigas estruturais) antes do canteiro.",
    passos: [
      {
        num: 1,
        titulo: "Abrir Painel de Coordenação",
        desc: "No visualizador 3D da obra, clique no ícone de colisão 'Clash Detection' na barra superior.",
        ondeExecutar: "BIM Viewer > Botão 'Clash Detection'"
      },
      {
        num: 2,
        titulo: "Selecionar Disciplinas Cruzadas",
        desc: "Marque a disciplina A (ex: 'Estrutural — Concreto') e a disciplina B (ex: 'Hidráulica / Esgoto').",
        ondeExecutar: "Seletor de Disciplinas para Comparação"
      },
      {
        num: 3,
        titulo: "Executar Análise Geométrica",
        desc: "Clique no botão 'Executar Análise BVH'. O motor testará interseções triângulo por triângulo entre os sólidos carregados.",
        ondeExecutar: "Botão 'Executar Análise de Interferências'"
      },
      {
        num: 4,
        titulo: "Inspecionar os Conflitos Localizados",
        desc: "A lista de colisões exibe os elementos conflitantes. Clique em um item para a câmera dar zoom instantâneo no ponto em vermelho.",
        ondeExecutar: "Lista de Interferências Detectadas"
      },
      {
        num: 5,
        titulo: "Criar Apontamento para o Projetista",
        desc: "Gere uma ficha de pendência de coordenação (BCF) com a foto do ponto exato para envio ao projetista responsável pela revisão.",
        ondeExecutar: "Ação 'Gerar Pendência de Coordenação'"
      }
    ],
    telaMockup: {
      tituloTela: "FinGo — Detecção de Interferências Espaciais (Clash Engine)",
      localAcao: "Painel de Colisões > Destaque Vermelho no Modelo 3D > Botão 'Exportar Ficha'",
      elementosChave: [
        "[Teste] Estrutura vs Instalações Hidráulicas (120 pares analisados)",
        "[Alerta Crítico] Viga V-102 intersecta Tubo PVC Esgoto 100mm",
        "[Visual] Ponto exato piscando em vermelho na viewport 3D",
        "[Ação] 'Notificar Projetista Estrutural'"
      ]
    },
    dicaEngenharia: "Resolver 1 interferência no modelo digital custa zero reais; furar ou quebrar uma viga estrutural concretada no canteiro pode comprometer a segurança da obra."
  }
];
