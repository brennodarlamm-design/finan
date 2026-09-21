// marketing/blog-data.js — Artigos Oficiais de Engenharia, Custos e Gestão de Obras FinGo

export const ARTIGOS_BLOG = [
  {
    id: "como-calcular-bdi-tcu-acordao-2622",
    slug: "como-calcular-bdi-tcu-acordao-2622",
    titulo: "Como Calcular o BDI de Obras Públicas e Privadas pelo Acórdão 2622/2013 do TCU",
    categoria: "Orçamentos & Custos",
    data: "21 Setembro 2026",
    tempoLeitura: "6 min",
    resumo: "Entenda a fórmula oficial do Tribunal de Contas da União, faixas de referência de 2026 para edificações e como o BDI diferenciado para materiais funciona na Nova Lei de Licitações (Lei 14.133/2021).",
    conteudo: [
      "O cálculo do BDI (Benefícios e Despesas Indiretas) é o elemento mais determinante entre o lucro e o prejuízo de uma construtora. Um BDI superestimado desclassifica sua proposta em licitações e afasta clientes privados; um BDI subestimado corrói o caixa da empresa.",
      "A fórmula consolidada pelo Acórdão nº 2622/2013 do TCU estabelece:",
      "BDI = [((1 + AC + S + R + G) * (1 + DF) * (1 + L)) / (1 - I) - 1] * 100",
      "Onde:",
      "• AC = Administração Central (Faixa recomendada: 3,00% a 5,50% — Médio: 4,00%)",
      "• S = Seguro da Obra (Faixa: 0,80% a 1,00% — Médio: 0,80%)",
      "• R = Risco do Empreendimento (Faixa: 0,97% a 1,27% — Médio: 0,97%)",
      "• G = Garantia Contratual (Faixa: 0,80% a 1,00% — Médio: 0,80%)",
      "• DF = Despesas Financeiras do Capital de Giro (Faixa: 0,59% a 1,39% — Médio: 1,23%)",
      "• L = Lucro Bruto da Construtora (Faixa: 6,16% a 8,96% — Médio: 7,40%)",
      "• I = Tributos Incidentes: PIS (0,65%) + COFINS (3,00%) + ISS (2,00% a 5,00%) + CPRB (4,50% no regime desonerado).",
      "No FinGo, você conta com a Calculadora de BDI Online Oficial que aplica essa memória de cálculo instantaneamente, permitindo exportar a justificativa técnica para o contratante ou para o caderno de licitação."
    ]
  },
  {
    id: "retencoes-tecnicas-inss-iss-medicoes",
    slug: "retencoes-tecnicas-inss-iss-medicoes",
    titulo: "Retenções Técnicas na Construção Civil: Guia Prático dos 11% de INSS e 5% de ISS em Medições",
    categoria: "Fiscal & Contratos",
    data: "18 Setembro 2026",
    tempoLeitura: "5 min",
    resumo: "Como apurar corretamente a retenção na fonte sobre cessão de mão de obra de empreiteiros e proteger sua construtora contra passivos tributários solidários.",
    conteudo: [
      "A contratação de empreiteiros para serviços de alvenaria, armação, carpintaria e acabamento exige atenção redobrada quanto às retenções tributárias na fonte.",
      "A legislação federal (Lei 8.212/1991 e Instrução Normativa da Receita Federal) determina a retenção de 11% sobre o valor bruto da nota fiscal de cessão de mão de obra para crédito previdenciário do INSS.",
      "Quando há fornecimento concomitante de materiais comprovados em contrato, a base de cálculo pode ser reduzida, desde que expressamente discriminada na nota fiscal e na planilha de medição.",
      "Além disso, o ISSQN municipal (alíquotas de 2% a 5%) deve ser retido pelo tomador quando o serviço é prestado por autônomos ou empresas de fora do município sem cadastro no CPOM.",
      "O módulo de Medições & Faturamento do FinGo automatiza essa apuração: ao lançar o boletim de medição, o sistema calcula os tributos devidos, emite o espelho de desconto e já provisiona a guia de recolhimento no contas a pagar."
    ]
  },
  {
    id: "sinapi-desonerado-vs-nao-desonerado",
    slug: "sinapi-desonerado-vs-nao-desonerado",
    titulo: "SINAPI Desonerado vs Não Desonerado: Como Escolher o Regime Certo para sua Construtora",
    categoria: "Engenharia & SINAPI",
    data: "14 Setembro 2026",
    tempoLeitura: "7 min",
    resumo: "Entenda a Contribuição Previdenciária sobre a Receita Bruta (CPRB 4,5%), o impacto nos encargos sociais de 110% vs 85% e as regras da Lei 14.133/2021.",
    conteudo: [
      "O SINAPI (Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil), mantido pela Caixa Econômica Federal e IBGE, publica mensalmente duas tabelas distintas de composições e insumos para cada uma das 27 Unidades Federativas do Brasil: a tabela com desoneração e a tabela sem desoneração da folha de pagamento.",
      "A diferença crucial está no tratamento dos encargos sociais:",
      "1. Regime Não Desonerado (Tradicional): A construtora recolhe a cota patronal de 20% sobre a folha de salários dos operários. Como consequência, os encargos sociais sobre a mão de obra ficam entre 110% e 120% no custo direto.",
      "2. Regime Desonerado (CPRB): A construtora é dispensada dos 20% da cota patronal da folha e recolhe 4,5% sobre a sua receita bruta total. Com isso, os encargos sociais no custo direto da mão de obra caem para cerca de 85% a 90%, mas o tributo de 4,5% deve ser adicionado ao 'I' da fórmula do BDI.",
      "No FinGo, você pode alternar entre as bases oficiais de qualquer estado brasileiro com um único clique, comparando na hora qual opção gera o orçamento mais competitivo para a sua empresa."
    ]
  },
  {
    id: "conciliacao-bancaria-ofx-obras",
    slug: "conciliacao-bancaria-ofx-obras",
    titulo: "Conciliação Bancária OFX em Construtoras: Como Blindar o Fluxo de Caixa de Obras",
    categoria: "Financeiro & Gestão",
    data: "10 Setembro 2026",
    tempoLeitura: "4 min",
    resumo: "Por que conferir extrato bancário em papel é o caminho mais rápido para perder dinheiro na construção civil e como automatizar com arquivos .OFX.",
    conteudo: [
      "Em uma construtora ativa com 3 ou mais obras simultâneas, ocorrem diariamente dezenas de transações: compras de materiais miúdos no canteiro, abastecimento de máquinas, PIX para fornecedores de areia e depósitos de medições.",
      "Tentar reconciliar isso no final do mês olhando o saldo bancário e ticando notas manuais gera dois problemas graves: lançamentos esquecidos que estouram o orçamento e incapacidade de saber qual obra realmente está dando lucro.",
      "O padrão .OFX (Open Financial Exchange) é o arquivo oficial que todos os bancos brasileiros (Itaú, Bradesco, Banco do Brasil, Santander, Caixa, Inter, Nubank, Sicoob, Sicredi) exportam gratuitamente.",
      "Ao carregar o .OFX no FinGo, nosso robô compara valor e data com tolerância inteligente de dias para compensação e casa as transações automaticamente. Transações não reconhecidas são acusadas no mesmo instante, garantindo 100% de conciliação."
    ]
  },
  {
    id: "ocr-e-importacao-nfe-no-canteiro",
    slug: "ocr-e-importacao-nfe-no-canteiro",
    titulo: "OCR e Importação de NF-e: Eliminando a Digitação Manual de Notas de Materiais",
    categoria: "Fiscal & Suprimentos",
    data: "05 Setembro 2026",
    tempoLeitura: "4 min",
    resumo: "Como a inteligência óptica transforma fotos de cupons fiscais e DANFEs em lançamentos financeiros e controle de estoque de forma instantânea.",
    conteudo: [
      "O encarregado da obra vai ao depósito de material de construção, compra conexões e sacos de argamassa de emergência e volta com uma nota fiscal impressa no bolso. No modelo antigo, esse papel ficava amassado no canteiro por semanas até alguém digitar no sistema.",
      "Com a tecnologia OCR (Optical Character Recognition) integrada ao FinGo, o encarregado fotografa o cupom no smartphone e o sistema extrai automaticamente: CNPJ do depósito, valor total, alíquota de impostos e lista de produtos.",
      "Para notas eletrônicas completas, o FinGo se conecta diretamente à SEFAZ através da busca automática por CNPJ, baixando os arquivos XML oficiais assim que o fornecedor emite a nota.",
      "Isso elimina erros de digitação de valores, impede duplicidade de pagamentos e mantém o custo real da obra atualizado diariamente."
    ]
  },
  {
    id: "bim-3d-no-canteiro-clash-detection",
    slug: "bim-3d-no-canteiro-clash-detection",
    titulo: "BIM 3D no Canteiro: Como Cortes Interativos e Detecção de Interferências Evitam Retrabalhos",
    categoria: "BIM & Tecnologia",
    data: "01 Setembro 2026",
    tempoLeitura: "5 min",
    resumo: "A engenharia do futuro na palma da mão: como visualizar modelos tridimensionais leves no navegador e antecipar choques entre vigas e tubulações.",
    conteudo: [
      "Por décadas, a compatibilização de projetos foi feita sobrepondo plantas impressas em mesas de luz. Na prática, muitos erros passavam despercebidos e só eram descobertos na hora da concretagem ou da passagem de tubulações.",
      "Furar uma viga concretada ou desviar uma tubulação de esgoto de 100mm no canteiro gera custos imprevistos, atrasa o cronograma e pode comprometer a estabilidade estrutural da edificação.",
      "O FinGo traz um visualizador BIM 3D nativo desenvolvido com WebGL determinístico e LOD (Level of Detail) adaptativo. Isso significa que o engenheiro abre o modelo volumétrico completo no próprio celular no canteiro, sem necessidade de softwares pesados ou computadores de alta performance.",
      "Com a ferramenta de Clash Detection do FinGo, as geometrias das diferentes disciplinas são analisadas matematicamente via BVH (Bounding Volume Hierarchy). Se um duto elétrico ou cano colidir com uma viga, o ponto exato pisca em vermelho na tela antes da primeira pá de cimento ser virada na betoneira."
    ]
  }
];
