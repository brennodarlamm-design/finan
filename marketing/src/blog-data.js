// marketing/blog-data.js — Artigos do blog FinGo (engenharia de custos, fiscal e gestão de obras)
//
// Formato de cada artigo:
//   respostaCurta: resposta direta exibida no topo (AEO: trecho que buscadores e IAs citam)
//   conteudo: lista de blocos. String = parágrafo. Objetos:
//     { tipo: 'h2', texto } · { tipo: 'lista', itens: [] } · { tipo: 'passos', itens: [] }
//     { tipo: 'tabela', cabecalho: [], linhas: [[]], legenda } · { tipo: 'formula', texto }
//     { tipo: 'destaque', texto }
//   faq: [{ q, a }] (vira JSON-LD FAQPage na página do artigo)
//   fontes: [{ nome, url? }]
// Datas: dataPublicacao/atualizado em ISO (AAAA-MM-DD); `data` é o texto exibido.
// Conteúdo fiscal/técnico: revisar com engenheiro e contador antes de publicar mudanças.

export const ARTIGOS_BLOG = [
  {
    id: "como-calcular-bdi-tcu-acordao-2622",
    slug: "como-calcular-bdi-tcu-acordao-2622",
    titulo: "Como Calcular o BDI de Obras Públicas e Privadas pelo Acórdão 2622/2013 do TCU",
    categoria: "Orçamentos & Custos",
    data: "21 Setembro 2026",
    dataPublicacao: "2026-09-21",
    atualizado: "2026-10-03",
    tempoLeitura: "9 min",
    resumo: "A fórmula oficial do TCU, as faixas de referência para edificações, um exemplo completo com números e como o BDI diferenciado para materiais funciona na Lei 14.133/2021.",
    respostaCurta: "O BDI (Benefícios e Despesas Indiretas) é o percentual somado ao custo direto da obra para cobrir administração central, seguro, garantia, risco, despesas financeiras, tributos e lucro. Pelo Acórdão 2.622/2013 do TCU, calcula-se com BDI = {[(1 + AC + S + R + G) × (1 + DF) × (1 + L)] / (1 − I)} − 1. Em construção de edifícios, o TCU considera aceitável um BDI entre 20,34% e 25,00%, com valor médio de 22,12%.",
    conteudo: [
      { tipo: "h2", texto: "O que é BDI e por que ele decide se a obra dá lucro" },
      "Toda obra tem dois tipos de custo. O custo direto é o que fica no canteiro: materiais, mão de obra com encargos e equipamentos. O custo indireto é o que a construtora gasta para existir e tocar o contrato: escritório, contador, seguros, juros do capital de giro, impostos sobre o faturamento e o lucro que remunera o risco do negócio.",
      "O BDI transforma esse segundo grupo em um percentual aplicado sobre o custo direto. Se o custo direto de uma obra é R$ 1.000.000,00 e o BDI é 23,54%, o preço de venda fica em R$ 1.235.400,00. Um BDI alto demais tira a construtora da licitação ou do orçamento do cliente; um BDI baixo demais faz a empresa trabalhar de graça e financiar a obra com o próprio caixa.",
      { tipo: "h2", texto: "A fórmula do TCU (Acórdão 2.622/2013)" },
      "O Tribunal de Contas da União consolidou no Acórdão 2.622/2013 – Plenário a fórmula usada como referência em obras públicas, e que também serve de boa prática em obras privadas:",
      { tipo: "formula", texto: "BDI = { [ (1 + AC + S + R + G) × (1 + DF) × (1 + L) ] / (1 − I) } − 1" },
      { tipo: "lista", itens: [
        "AC — Administração Central: rateio dos custos do escritório da empresa.",
        "S + G — Seguro e Garantia: seguros da obra e garantias contratuais (o TCU avalia os dois juntos).",
        "R — Risco: imprevistos do empreendimento.",
        "DF — Despesas Financeiras: custo do dinheiro entre o gasto na obra e o recebimento da medição.",
        "L — Lucro: remuneração da construtora.",
        "I — Tributos sobre o faturamento: PIS, COFINS, ISS e, quando a empresa está na desoneração da folha, a CPRB."
      ] },
      "Observe que os tributos ficam no denominador (1 − I). Isso acontece porque eles incidem sobre o preço de venda, e não sobre o custo: somar o percentual do imposto direto ao custo deixaria a empresa pagando parte do tributo com o próprio lucro.",
      { tipo: "h2", texto: "Faixas de referência do TCU para construção de edifícios" },
      { tipo: "tabela", cabecalho: ["Parcela", "1º quartil", "Médio", "3º quartil"], linhas: [
        ["Administração Central (AC)", "3,00%", "4,00%", "5,50%"],
        ["Seguro + Garantia (S+G)", "0,80%", "0,80%", "1,00%"],
        ["Risco (R)", "0,97%", "1,27%", "1,27%"],
        ["Despesas Financeiras (DF)", "0,59%", "1,23%", "1,39%"],
        ["Lucro (L)", "6,16%", "7,40%", "8,96%"],
        ["BDI final (resultado)", "20,34%", "22,12%", "25,00%"]
      ], legenda: "Acórdão 2.622/2013 – TCU, obras de construção de edifícios. Outras tipologias (rodovias, saneamento, redes) têm faixas próprias." },
      "As faixas não são teto legal. Um BDI acima do 3º quartil pode ser aceito quando a construtora justifica tecnicamente cada parcela, por exemplo uma obra em local remoto com risco maior. Sem justificativa, o órgão de controle tende a considerar o preço com sobrepreço.",
      { tipo: "h2", texto: "Exemplo completo com números" },
      "Vamos calcular o BDI de uma edificação usando os valores médios do TCU, ISS de 3% no município da obra e empresa fora da desoneração da folha:",
      { tipo: "tabela", cabecalho: ["Parcela", "Valor usado"], linhas: [
        ["AC", "4,00%"], ["S + G", "0,80%"], ["R", "1,27%"], ["DF", "1,23%"], ["L", "7,40%"],
        ["I = PIS 0,65% + COFINS 3,00% + ISS 3,00%", "6,65%"]
      ] },
      { tipo: "passos", itens: [
        "1 + AC + S + G + R = 1 + 0,0400 + 0,0080 + 0,0127 = 1,0607",
        "Multiplique por (1 + DF) = 1,0123 e por (1 + L) = 1,0740: 1,0607 × 1,0123 × 1,0740 = 1,1532",
        "Divida por (1 − I) = 0,9335: 1,1532 ÷ 0,9335 = 1,2354",
        "Subtraia 1: BDI = 0,2354, ou seja, 23,54%"
      ] },
      { tipo: "destaque", texto: "Mesmo com todas as parcelas no valor médio, o BDI final (23,54%) ficou acima do BDI médio da tabela (22,12%), porque o ISS de 3% deste exemplo é maior que o considerado no levantamento. É por isso que o TCU compara o BDI final com os quartis, e não só cada parcela." },
      "O imposto muda bastante o resultado. Com ISS de 5% em vez de 3%, o mesmo cálculo vai para 26,24%. Para uma empresa na desoneração da folha, entra também a CPRB no denominador; veja o artigo sobre SINAPI desonerado para os números de 2026.",
      { tipo: "h2", texto: "BDI diferenciado para materiais e equipamentos" },
      "Quando a obra inclui fornecimento relevante de materiais ou equipamentos que a construtora apenas compra e instala (elevadores, transformadores, grandes lotes de esquadrias), o TCU recomenda aplicar um BDI reduzido sobre esses itens, porque a construtora não tem sobre eles o mesmo custo de administração e risco. A referência do Acórdão 2.622/2013 para fornecimento de materiais e equipamentos é de 11,10% a 16,80%, com valor médio de 14,02%.",
      "A Lei 14.133/2021 (Nova Lei de Licitações) mantém a exigência de orçamento detalhado e de composição do BDI na proposta. Na prática, a planilha deve mostrar cada parcela do BDI e indicar quais itens recebem o BDI diferenciado.",
      { tipo: "h2", texto: "Erros comuns" },
      { tipo: "lista", itens: [
        "Somar os tributos ao custo em vez de usar o denominador (1 − I).",
        "Incluir no BDI custos que deveriam estar na planilha de custo direto, como mestre de obras, vigia e canteiro: no padrão do TCU, a administração local da obra é custo direto.",
        "Esquecer de trocar o ISS ao orçar obras em municípios diferentes.",
        "Usar tabela SINAPI desonerada sem incluir a CPRB no BDI, ou o contrário."
      ] },
      { tipo: "h2", texto: "Como fazer no FinGo" },
      "A Calculadora de BDI do FinGo (gratuita, em fingo.api.br/calculadora-bdi) aplica a fórmula do TCU, mostra as faixas de referência e gera a memória de cálculo. Dentro do sistema, o orçamento com SINAPI aplica o BDI escolhido sobre o custo direto e permite usar BDI diferenciado para materiais."
    ],
    faq: [
      { q: "Qual é a fórmula do BDI pelo TCU?", a: "BDI = {[(1 + AC + S + R + G) × (1 + DF) × (1 + L)] / (1 − I)} − 1, conforme o Acórdão 2.622/2013 do TCU. AC é administração central, S e G seguro e garantia, R risco, DF despesas financeiras, L lucro e I os tributos sobre o faturamento." },
      { q: "Qual é o BDI aceitável para construção de edifícios?", a: "O TCU usa como referência para construção de edifícios a faixa de 20,34% (1º quartil) a 25,00% (3º quartil), com valor médio de 22,12%. Valores fora da faixa precisam de justificativa técnica." },
      { q: "O ISS entra no BDI?", a: "Sim. O ISS, junto com PIS e COFINS (e a CPRB, para empresas na desoneração da folha), compõe o I da fórmula e fica no denominador, porque incide sobre o preço de venda." },
      { q: "Mestre de obras entra no BDI?", a: "Não, pelo padrão do TCU. A administração local (mestre, encarregados, engenheiro residente, canteiro) é custo direto e deve aparecer na planilha orçamentária." }
    ],
    fontes: [
      { nome: "TCU — Acórdão 2.622/2013 – Plenário (BDI de referência)" },
      { nome: "Decreto 7.983/2013 — orçamento de referência de obras com recursos da União" },
      { nome: "Lei 14.133/2021 — Nova Lei de Licitações e Contratos" }
    ]
  },
  {
    id: "retencoes-tecnicas-inss-iss-medicoes",
    slug: "retencoes-tecnicas-inss-iss-medicoes",
    titulo: "Retenções Técnicas na Construção Civil: Guia Prático dos 11% de INSS e 5% de ISS em Medições",
    categoria: "Fiscal & Contratos",
    data: "18 Setembro 2026",
    dataPublicacao: "2026-09-18",
    atualizado: "2026-10-03",
    tempoLeitura: "8 min",
    resumo: "Quando reter 11% de INSS, como funciona a dedução de materiais, quem retém o ISS, IRRF e PIS/COFINS/CSLL, e um exemplo de medição de R$ 100 mil do bruto ao líquido.",
    respostaCurta: "Ao pagar a medição de uma empreiteira que cede mão de obra (empreitada parcial ou subempreitada), a construtora tomadora retém 11% de INSS sobre o valor dos serviços da nota (3,5% se a contratada recolhe a CPRB), podendo excluir materiais e equipamentos discriminados no contrato e na nota. O ISS de 2% a 5% é devido no município da obra e a retenção segue a lei desse município. Além disso, contratos costumam reter garantia técnica, em geral 5% de cada medição.",
    conteudo: [
      { tipo: "h2", texto: "Por que a construtora precisa reter tributos da empreiteira" },
      "Na construção civil, quem contrata serviços de outra empresa pode ser responsável por tributos que, em tese, seriam da contratada. Para garantir o recolhimento, a lei obriga o tomador a reter parte do valor da nota e pagar a guia em nome do prestador. Se a construtora paga a medição cheia e a empreiteira não recolhe, a dívida e as multas podem cair sobre quem contratou.",
      { tipo: "h2", texto: "INSS: a retenção de 11%" },
      "A Lei 8.212/1991 (art. 31) e a Instrução Normativa RFB 2.110/2022 determinam que o contratante de serviços executados mediante cessão de mão de obra ou empreitada retenha 11% do valor bruto dos serviços da nota fiscal. Na construção civil, isso alcança a empreitada parcial e a subempreitada: alvenaria, estrutura, instalações, acabamentos, pintura e serviços semelhantes contratados por etapa.",
      { tipo: "lista", itens: [
        "Alíquota padrão: 11% sobre o valor dos serviços.",
        "Empresa contratada que recolhe a Contribuição Previdenciária sobre a Receita Bruta (CPRB): 3,5% (Lei 12.546/2011, art. 7º, §6º). Confira a alíquota vigente durante a transição da reoneração (Lei 14.973/2024).",
        "Empreitada total (a empresa assume a obra inteira): em regra não há retenção; vale a responsabilidade solidária do contratante, afastada com a documentação de regularidade da contratada.",
        "Optantes do Simples Nacional: a retenção se aplica às atividades de construção civil tributadas no Anexo IV."
      ] },
      { tipo: "h2", texto: "Dedução de materiais e equipamentos" },
      "Materiais e equipamentos fornecidos pela empreiteira não são mão de obra e podem sair da base dos 11%, desde que estejam previstos no contrato e discriminados na nota fiscal. Quando o contrato prevê o fornecimento, mas a nota não separa os valores, a IN RFB 2.110/2022 fixa percentuais mínimos de base de cálculo, que variam conforme o tipo de serviço. Por isso, a recomendação prática é exigir nota com mão de obra e material em linhas separadas.",
      { tipo: "h2", texto: "ISS: quem retém e em qual município" },
      "Pela Lei Complementar 116/2003, o ISS dos serviços de construção civil é devido no município onde a obra é executada, com alíquota entre 2% e 5%. A obrigação de reter depende da legislação de cada município: muitos atribuem a retenção ao tomador pessoa jurídica, outros só quando o prestador é de fora da cidade. Em São Paulo, por exemplo, há regra específica para prestadores de outros municípios sem cadastro no CPOM. Consulte sempre a lei do município da obra.",
      "A mesma lei permite, em alguns casos, abater da base do ISS os materiais fornecidos pelo prestador e incorporados à obra, conforme regulamentação municipal.",
      { tipo: "h2", texto: "IRRF e PIS/COFINS/CSLL" },
      { tipo: "tabela", cabecalho: ["Retenção", "Alíquota usual", "Observação"], linhas: [
        ["INSS", "11% (3,5% na CPRB)", "Sobre mão de obra; materiais discriminados podem ser excluídos"],
        ["ISS", "2% a 5%", "Conforme a lei do município da obra"],
        ["IRRF", "1,5%", "Quando o serviço está entre os sujeitos à retenção (Decreto 9.580/2018)"],
        ["PIS/COFINS/CSLL", "4,65%", "Lei 10.833/2003; dispensada quando o valor a reter é até R$ 10,00"],
        ["Garantia técnica", "5% (comum)", "Cláusula contratual, devolvida ao fim da obra"]
      ], legenda: "Valores usuais para referência; cada contrato e município pode ter regra própria." },
      { tipo: "h2", texto: "Exemplo: medição de R$ 100.000,00" },
      "Uma empreiteira de estrutura apresenta medição de R$ 100.000,00, com R$ 40.000,00 de materiais discriminados no contrato e na nota. ISS de 3% no município, garantia contratual de 5%, sem IRRF e sem PIS/COFINS/CSLL neste caso (simplificado):",
      { tipo: "tabela", cabecalho: ["Item", "Cálculo", "Valor"], linhas: [
        ["Valor bruto da medição", "—", "R$ 100.000,00"],
        ["INSS", "11% × R$ 60.000,00 (mão de obra)", "− R$ 6.600,00"],
        ["ISS", "3% × R$ 100.000,00", "− R$ 3.000,00"],
        ["Retenção técnica de garantia", "5% × R$ 100.000,00", "− R$ 5.000,00"],
        ["Valor líquido a pagar", "—", "R$ 85.400,00"]
      ] },
      { tipo: "destaque", texto: "A construtora paga R$ 85.400,00 à empreiteira, recolhe R$ 6.600,00 em GPS/DCTFWeb e R$ 3.000,00 de ISS em nome dela, e guarda R$ 5.000,00 de garantia até o recebimento definitivo da obra." },
      { tipo: "h2", texto: "Checklist antes de liberar o pagamento" },
      { tipo: "lista", itens: [
        "Nota fiscal com mão de obra e materiais separados.",
        "Destaque da retenção de INSS na nota.",
        "Município e alíquota de ISS corretos.",
        "Guia das retenções gerada no mesmo mês do pagamento.",
        "Controle da garantia retida por contrato, para devolver no fim."
      ] },
      { tipo: "h2", texto: "Como fazer no FinGo" },
      "No módulo de Medições, o boletim calcula as retenções (INSS, ISS, IRRF, PIS/COFINS/CSLL e garantia) a partir do valor bruto, mostra o líquido a pagar e lança as guias no contas a pagar. Este artigo é informativo: valide as alíquotas e a obrigação de reter com o contador da empresa e a legislação do município."
    ],
    faq: [
      { q: "Quando a construtora deve reter 11% de INSS?", a: "Ao contratar serviços de construção civil com cessão de mão de obra, como empreitada parcial e subempreitada. A base é o valor dos serviços da nota; materiais e equipamentos discriminados no contrato e na nota podem ser excluídos (Lei 8.212/1991, art. 31; IN RFB 2.110/2022)." },
      { q: "Empreitada total tem retenção de INSS?", a: "Em regra, não. Na empreitada total o contratante responde solidariamente pelas contribuições da obra e pode afastar essa responsabilidade com a documentação de regularidade da contratada." },
      { q: "Qual a alíquota de retenção de INSS para empresa na desoneração da folha?", a: "3,5%, quando a contratada recolhe a CPRB (Lei 12.546/2011, art. 7º, §6º). Durante a reoneração gradual da Lei 14.973/2024, confirme a alíquota vigente com o contador." },
      { q: "Onde é pago o ISS de obra?", a: "No município onde a obra é executada, com alíquota de 2% a 5% (Lei Complementar 116/2003). A obrigação de o tomador reter depende da lei desse município." }
    ],
    fontes: [
      { nome: "Lei 8.212/1991, art. 31 — retenção previdenciária" },
      { nome: "Instrução Normativa RFB 2.110/2022" },
      { nome: "Lei 12.546/2011, art. 7º, §6º — retenção de 3,5% (CPRB)" },
      { nome: "Lei Complementar 116/2003 — ISS" },
      { nome: "Lei 10.833/2003 — retenção de PIS/COFINS/CSLL" }
    ]
  },
  {
    id: "sinapi-desonerado-vs-nao-desonerado",
    slug: "sinapi-desonerado-vs-nao-desonerado",
    titulo: "SINAPI Desonerado vs Não Desonerado: Como Escolher o Regime Certo para sua Construtora",
    categoria: "Engenharia & SINAPI",
    data: "14 Setembro 2026",
    dataPublicacao: "2026-09-14",
    atualizado: "2026-10-03",
    tempoLeitura: "8 min",
    resumo: "A diferença entre as duas tabelas do SINAPI, o efeito nos encargos sociais e no BDI, a reoneração gradual da Lei 14.973/2024 e um teste rápido para escolher a tabela certa.",
    respostaCurta: "O SINAPI publica, para cada estado, uma tabela não desonerada (encargos sociais com os 20% de contribuição patronal sobre a folha) e uma desonerada (sem essa contribuição, porque a empresa recolhe a CPRB sobre a receita). Use a tabela do mesmo regime em que a sua construtora recolhe a previdência e coloque a CPRB no BDI quando usar a desonerada. Desde 2025, a Lei 14.973/2024 faz a reoneração gradual da folha até 2028, o que muda os números da escolha.",
    conteudo: [
      { tipo: "h2", texto: "O que é o SINAPI" },
      "O SINAPI (Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil) é mantido pela Caixa Econômica Federal e pelo IBGE. Todo mês ele publica, para cada um dos 27 estados, preços de insumos e composições de serviços. Pelo Decreto 7.983/2013, é a referência obrigatória de custos para obras e serviços de engenharia contratados com recursos da União e muito usado também em obras financiadas pela Caixa e em orçamentos privados.",
      { tipo: "h2", texto: "Por que existem duas tabelas" },
      "A diferença está só na mão de obra. Sobre o salário do operário, a empresa paga encargos sociais (INSS patronal, FGTS, férias, 13º, descanso remunerado e outros). Um desses encargos é a contribuição patronal de 20% ao INSS. Empresas da construção civil puderam trocar essa contribuição sobre a folha pela CPRB (Contribuição Previdenciária sobre a Receita Bruta), calculada sobre o faturamento.",
      { tipo: "tabela", cabecalho: ["", "Não desonerado", "Desonerado"], linhas: [
        ["Contribuição patronal sobre a folha", "20% nos encargos", "fora dos encargos"],
        ["Encargos sociais típicos (horista)", "cerca de 110% a 118%", "cerca de 84% a 90%"],
        ["Contribuição sobre a receita (CPRB)", "não há", "entra no BDI, no I"],
        ["Efeito no custo direto", "maior", "menor"],
        ["Efeito no BDI", "menor", "maior"]
      ], legenda: "Os percentuais de encargos variam por estado e por mês; use os publicados pela Caixa para a UF e a competência do orçamento." },
      { tipo: "h2", texto: "A reoneração gradual (Lei 14.973/2024)" },
      "A Lei 14.973/2024 encerrou a desoneração da folha de forma gradual. Entre 2025 e 2027, as empresas que estavam na CPRB pagam uma parte da contribuição sobre a folha e uma parte reduzida da CPRB; em 2028 volta a valer apenas a contribuição de 20% sobre a folha.",
      { tipo: "tabela", cabecalho: ["Ano", "Contribuição sobre a folha", "CPRB (construção civil, alíquota cheia de 4,5%)"], linhas: [
        ["2024", "0%", "4,5%"],
        ["2025", "5%", "80% da alíquota = 3,6%"],
        ["2026", "10%", "60% da alíquota = 2,7%"],
        ["2027", "15%", "40% da alíquota = 1,8%"],
        ["2028", "20%", "extinta"]
      ], legenda: "Resumo da transição prevista na Lei 14.973/2024. Confirme com o contador a situação da sua empresa e as regras vigentes." },
      "Na prática, a tabela desonerada do SINAPI passou a refletir a parcela da folha que voltou a ser cobrada, e a diferença entre as duas tabelas diminui ano a ano até desaparecer em 2028.",
      { tipo: "h2", texto: "Como escolher a tabela" },
      { tipo: "passos", itens: [
        "1. Pergunte ao contador como a empresa recolhe a previdência patronal no ano da obra: 20% sobre a folha ou CPRB com reoneração parcial.",
        "2. Use a tabela do SINAPI do mesmo regime, para a UF e o mês do orçamento.",
        "3. Se usar a tabela desonerada, coloque a CPRB do ano no I do BDI. Se usar a não desonerada, não coloque CPRB.",
        "4. Em licitação, siga o regime indicado no edital e demonstre a escolha na composição do BDI."
      ] },
      { tipo: "destaque", texto: "O erro mais caro é misturar regimes: custo da tabela desonerada com BDI sem CPRB deixa o preço baixo demais; custo da não desonerada com CPRB no BDI cobra o tributo duas vezes." },
      { tipo: "h2", texto: "Exemplo do efeito no BDI" },
      "Com as médias do TCU para edificações e ISS de 3%, o BDI sem CPRB é de 23,54%. Com a CPRB cheia de 4,5% (regime até 2024), o mesmo cálculo vai para 29,79%. Com a CPRB de transição de 2026 (2,7%), fica em 27,21%. Por isso, a comparação entre tabelas precisa olhar o preço final (custo direto mais BDI), e não só o custo unitário.",
      { tipo: "h2", texto: "Como fazer no FinGo" },
      "No plano Construtora Ilimitado, o orçamento do FinGo usa a base oficial do SINAPI dos 27 estados nos dois regimes. Você escolhe a UF, a competência e o regime, e o sistema aplica o BDI correspondente."
    ],
    faq: [
      { q: "Qual a diferença entre SINAPI desonerado e não desonerado?", a: "A tabela não desonerada inclui nos encargos sociais da mão de obra a contribuição patronal de 20% sobre a folha. A desonerada não inclui, porque a empresa recolhe a CPRB sobre a receita, que deve entrar no BDI." },
      { q: "Quando usar a tabela desonerada do SINAPI?", a: "Quando a construtora recolhe a CPRB (desoneração da folha) no período da obra, ou quando o edital determinar. Nesse caso, a CPRB do ano deve compor os tributos do BDI." },
      { q: "A desoneração da folha acabou?", a: "Está acabando de forma gradual. Pela Lei 14.973/2024, a contribuição sobre a folha volta em 5% (2025), 10% (2026) e 15% (2027), com a CPRB reduzida na mesma proporção, até a volta integral dos 20% sobre a folha em 2028." },
      { q: "O SINAPI é obrigatório?", a: "É a referência obrigatória de custos para obras e serviços de engenharia contratados com recursos da União (Decreto 7.983/2013) e amplamente usado em obras financiadas pela Caixa." }
    ],
    fontes: [
      { nome: "Caixa Econômica Federal / IBGE — SINAPI" },
      { nome: "Decreto 7.983/2013" },
      { nome: "Lei 12.546/2011 — Contribuição Previdenciária sobre a Receita Bruta" },
      { nome: "Lei 14.973/2024 — reoneração gradual da folha" }
    ]
  },
  {
    id: "conciliacao-bancaria-ofx-obras",
    slug: "conciliacao-bancaria-ofx-obras",
    titulo: "Conciliação Bancária OFX em Construtoras: Como Blindar o Fluxo de Caixa de Obras",
    categoria: "Financeiro & Caixa",
    data: "10 Setembro 2026",
    dataPublicacao: "2026-09-10",
    atualizado: "2026-10-03",
    tempoLeitura: "7 min",
    resumo: "O que é o arquivo OFX, por que conferir extrato à mão falha em construtoras, o passo a passo da conciliação e os erros que ela pega antes de virarem prejuízo.",
    respostaCurta: "Conciliação bancária é conferir, item por item, se cada movimento do extrato do banco tem um lançamento correspondente no financeiro da empresa. Em construtoras, ela é feita importando o arquivo OFX do banco: o sistema sugere o par de cada movimento por valor, data e descrição, e o que não bate fica pendente para análise. Feita toda semana, evita pagamentos em dobro, despesas sem obra e saldo de caixa irreal.",
    conteudo: [
      { tipo: "h2", texto: "Por que o caixa de obra sai do controle" },
      "Uma construtora com cinco obras pode ter centenas de movimentos por mês: compras de material, diárias, adiantamentos a empreiteiros, tarifas, medições recebidas, aportes. Quando o financeiro confere tudo olhando o extrato em PDF, três problemas aparecem com frequência: pagamentos lançados duas vezes, despesas pagas que nunca foram lançadas e despesas lançadas na obra errada, o que distorce o custo real de cada empreendimento.",
      { tipo: "h2", texto: "O que é o arquivo OFX" },
      "OFX (Open Financial Exchange) é o formato padrão de extrato que praticamente todos os bancos brasileiros oferecem no internet banking, geralmente com o nome de \"exportar extrato\" ou \"Money/OFX\". Cada movimento vem com data, valor, descrição e um identificador único (FITID), o que permite importar o extrato sem digitar nada e sem duplicar movimentos já importados.",
      { tipo: "h2", texto: "Passo a passo da conciliação" },
      { tipo: "passos", itens: [
        "1. Exporte o OFX do banco do período (de preferência semanal).",
        "2. Importe no sistema financeiro, na conta bancária correspondente.",
        "3. Confira as sugestões automáticas: o sistema propõe o lançamento com o mesmo valor e data próxima.",
        "4. Para movimentos sem par, decida: criar o lançamento (tarifa, juros, Pix recebido) ou investigar (pagamento desconhecido).",
        "5. Para lançamentos sem movimento no banco, verifique se o pagamento realmente saiu ou se foi lançado por engano.",
        "6. Feche o período com o saldo do sistema igual ao saldo do banco."
      ] },
      { tipo: "tabela", cabecalho: ["O que a conciliação encontra", "Exemplo", "Ação"], linhas: [
        ["Pagamento em dobro", "Mesma NF de cimento paga duas vezes", "Pedir estorno ao fornecedor"],
        ["Despesa não lançada", "Tarifa de Pix, IOF, juros de cheque especial", "Lançar e classificar"],
        ["Lançamento sem saída no banco", "Compra lançada, mas paga em outra conta", "Corrigir a conta"],
        ["Obra errada", "Material da Obra A lançado na Obra B", "Reclassificar para custo correto"],
        ["Recebimento não identificado", "Medição creditada sem aviso", "Baixar a conta a receber"]
      ] },
      { tipo: "destaque", texto: "Regra prática: se o saldo do sistema não bate com o banco no fim da semana, nenhuma decisão de caixa (comprar à vista, antecipar medição, pagar empreiteiro) deve ser tomada com base nele." },
      { tipo: "h2", texto: "Frequência e responsáveis" },
      "Em construtoras pequenas e médias, a conciliação semanal costuma levar menos de uma hora quando é feita por OFX, contra várias horas na conferência manual mensal. Separe quem lança de quem concilia sempre que possível: a pessoa que aprova a conciliação não deve ser a mesma que fez os pagamentos.",
      { tipo: "h2", texto: "Como fazer no FinGo" },
      "No FinGo, você importa o OFX na conta bancária, o sistema sugere o par de cada movimento (com tolerância de valor e data configurável), permite criar o lançamento direto da linha do extrato e reclassificar por obra. O fluxo de caixa e a DRE gerencial passam a usar valores que batem com o banco."
    ],
    faq: [
      { q: "O que é conciliação bancária?", a: "É conferir se cada movimento do extrato bancário tem um lançamento correspondente no financeiro da empresa, e o contrário, até o saldo do sistema ficar igual ao do banco." },
      { q: "O que é arquivo OFX?", a: "É o formato padrão de extrato bancário eletrônico (Open Financial Exchange), exportado no internet banking. Traz data, valor, descrição e um identificador único de cada movimento." },
      { q: "Com que frequência a construtora deve conciliar?", a: "O ideal é semanal. Com importação de OFX, a tarefa é rápida e evita que erros se acumulem até o fechamento do mês." }
    ],
    fontes: [
      { nome: "Especificação OFX (Open Financial Exchange)" }
    ]
  },
  {
    id: "ocr-e-importacao-nfe-no-canteiro",
    slug: "ocr-e-importacao-nfe-no-canteiro",
    titulo: "OCR e Importação de NF-e: Eliminando a Digitação Manual de Notas de Materiais",
    categoria: "Suprimentos & OCR",
    data: "05 Setembro 2026",
    dataPublicacao: "2026-09-05",
    atualizado: "2026-10-03",
    tempoLeitura: "7 min",
    resumo: "As três formas de registrar notas de material sem digitar (XML, consulta à SEFAZ com certificado A1 e OCR de fotos), quando usar cada uma e o que conferir antes de pagar.",
    respostaCurta: "A forma mais confiável de registrar uma nota de material é importar o XML da NF-e, que traz fornecedor, itens, quantidades e impostos exatamente como foram autorizados pela SEFAZ. Com o certificado digital A1 da empresa, é possível buscar automaticamente na SEFAZ as notas emitidas contra o CNPJ. O OCR (leitura de foto) serve para cupons e documentos sem XML e deve sempre ser conferido antes do pagamento.",
    conteudo: [
      { tipo: "h2", texto: "O custo de digitar notas na mão" },
      "Uma nota de material de obra pode ter dezenas de itens. Digitada à mão, ela atrasa o financeiro, gera erros de valor e quantidade e quase nunca é classificada por obra e etapa com o detalhe necessário para comparar orçado e realizado. O resultado é um custo de obra que só aparece no fim, quando já não dá para corrigir.",
      { tipo: "h2", texto: "Três formas de registrar sem digitar" },
      { tipo: "tabela", cabecalho: ["Método", "Como funciona", "Confiabilidade", "Quando usar"], linhas: [
        ["XML da NF-e", "Importa o arquivo enviado pelo fornecedor", "Total (dados autorizados pela SEFAZ)", "Sempre que houver NF-e"],
        ["Consulta à SEFAZ (DF-e)", "Busca as notas emitidas contra o CNPJ usando o certificado A1", "Total", "Para não depender do fornecedor enviar o XML"],
        ["OCR de foto ou PDF", "Lê o texto da imagem com inteligência artificial", "Boa, mas precisa conferir", "Cupons fiscais, recibos e documentos sem XML"]
      ] },
      { tipo: "h2", texto: "A chave de acesso e a consulta à SEFAZ" },
      "Toda NF-e tem uma chave de acesso de 44 dígitos, impressa no DANFE. Com a chave, a nota pode ser consultada e o XML obtido. Com o certificado digital A1 da construtora, o serviço de distribuição de documentos fiscais (DF-e) da SEFAZ lista as notas emitidas contra o CNPJ, o que permite descobrir compras feitas na obra que nunca chegaram ao escritório.",
      "A SEFAZ limita a frequência dessas consultas. Consultas repetidas em pouco tempo podem bloquear temporariamente o CNPJ por consumo indevido, por isso a sincronização deve respeitar o intervalo mínimo entre buscas.",
      { tipo: "h2", texto: "Quando o OCR ajuda" },
      "Na obra, muitas compras pequenas vêm em cupom fiscal ou recibo. O OCR lê a foto e preenche fornecedor, data, valor e vencimento. É um ganho grande de tempo, mas a leitura de imagem pode errar em fotos tremidas, amassadas ou com baixa luz, então o lançamento deve ser revisado antes de ir para pagamento.",
      { tipo: "h2", texto: "O que conferir antes de pagar" },
      { tipo: "lista", itens: [
        "CNPJ do fornecedor e do destinatário (a nota precisa estar no CNPJ da construtora).",
        "Quantidades contra o pedido de compra e o recebimento na obra.",
        "Preço unitário contra a cotação aprovada.",
        "Obra e etapa de destino do material.",
        "Vencimento e forma de pagamento."
      ] },
      { tipo: "destaque", texto: "Guarde os XMLs: os documentos fiscais devem ser mantidos pelo prazo em que a Receita e o fisco estadual podem fiscalizar, em geral cinco anos." },
      { tipo: "h2", texto: "Como fazer no FinGo" },
      "O FinGo importa XML de NF-e, sincroniza com a SEFAZ pelo certificado A1 da empresa (respeitando o intervalo da SEFAZ) e lê cupons e notas por OCR. Cada nota vira lançamento no contas a pagar, ligado à obra e ao fornecedor, e os itens alimentam o histórico de preços por produto."
    ],
    faq: [
      { q: "Qual a forma mais segura de lançar uma nota fiscal de material?", a: "Importar o XML da NF-e, porque ele contém os dados exatamente como foram autorizados pela SEFAZ: fornecedor, itens, quantidades, valores e impostos." },
      { q: "Dá para receber as notas da obra sem o fornecedor mandar o XML?", a: "Sim. Com o certificado digital A1 da empresa, o serviço de distribuição de documentos fiscais (DF-e) da SEFAZ lista as notas emitidas contra o CNPJ da construtora." },
      { q: "OCR substitui o XML?", a: "Não. O OCR é útil para cupons e documentos sem XML, mas a leitura de imagem pode errar e precisa de conferência antes do pagamento." }
    ],
    fontes: [
      { nome: "Portal Nacional da NF-e — Distribuição de DF-e de interesse" }
    ]
  },
  {
    id: "bim-3d-no-canteiro-clash-detection",
    slug: "bim-3d-no-canteiro-clash-detection",
    titulo: "BIM 3D no Canteiro: Como Cortes Interativos e Detecção de Interferências Evitam Retrabalhos",
    categoria: "BIM & Inovação",
    data: "01 Setembro 2026",
    dataPublicacao: "2026-09-01",
    atualizado: "2026-10-03",
    tempoLeitura: "7 min",
    resumo: "O que é BIM na prática da obra, como cortes e detecção de interferências evitam retrabalho, o que é preciso para um resultado confiável e os limites de modelos gerados por IA.",
    respostaCurta: "BIM é trabalhar com um modelo 3D da edificação em que cada elemento (viga, tubo, parede) tem dados. No canteiro, ver o modelo em cortes ajuda a entender o projeto antes de executar, e a detecção de interferências (clash detection) aponta onde disciplinas se cruzam, como uma tubulação atravessando uma viga. Para o resultado valer, o clash precisa rodar sobre os modelos reais dos projetistas (IFC), com coordenadas compatíveis, e não sobre maquetes ilustrativas.",
    conteudo: [
      { tipo: "h2", texto: "O que é BIM na prática da obra" },
      "BIM (Building Information Modeling) é a forma de projetar e acompanhar a obra a partir de um modelo digital em que os elementos têm geometria e informação: material, dimensões, pavimento, disciplina. O formato aberto para trocar esses modelos entre programas é o IFC (Industry Foundation Classes).",
      "Para a equipe de obra, o valor está em enxergar o que a planta 2D esconde: como a tubulação passa entre as vigas, onde a esquadria encontra a estrutura, qual a sequência de montagem de um trecho.",
      { tipo: "h2", texto: "Cortes interativos" },
      "Um corte (plano de seção) remove parte do modelo para mostrar o interior: um pavimento, uma prumada, o encontro entre forro e instalações. Na obra, isso responde perguntas que antes iam para o projetista por e-mail e voltavam dias depois.",
      { tipo: "h2", texto: "Detecção de interferências (clash detection)" },
      "A detecção de interferências compara os modelos de disciplinas diferentes (estrutura, hidráulica, elétrica, climatização) e aponta onde os elementos ocupam o mesmo espaço ou ficam perto demais.",
      { tipo: "tabela", cabecalho: ["Tipo", "O que indica", "Exemplo"], linhas: [
        ["Interferência física (hard clash)", "Dois elementos ocupam o mesmo espaço", "Tubo de esgoto atravessando uma viga"],
        ["Folga insuficiente (clearance)", "Distância menor que a mínima exigida", "Duto encostado na laje sem espaço de manutenção"],
        ["Sequência (4D)", "Conflito no cronograma de montagem", "Instalação prevista antes da estrutura que a suporta"]
      ] },
      { tipo: "h2", texto: "O que é preciso para o resultado valer" },
      { tipo: "lista", itens: [
        "Modelos reais dos projetistas em IFC (ou exportados de forma fiel), de cada disciplina.",
        "Mesmas coordenadas e unidades entre os modelos (origem do projeto compartilhada).",
        "Geometria completa dos elementos, inclusive aberturas e furos previstos.",
        "Revisão humana: cada interferência encontrada precisa de decisão do projetista responsável."
      ] },
      { tipo: "destaque", texto: "Modelos gerados por inteligência artificial a partir de imagens servem para visualização e apresentação. Eles não têm a precisão de projeto e não podem ser usados para quantitativos, orçamento ou detecção de interferências." },
      { tipo: "h2", texto: "Retrabalho evitado" },
      "Uma interferência descoberta na fase de projeto custa uma revisão de desenho. A mesma interferência descoberta na obra custa demolição, material perdido, mão de obra parada e atraso. É por isso que a coordenação de projetos com modelos reais costuma se pagar com poucos problemas evitados.",
      { tipo: "h2", texto: "Como fazer no FinGo" },
      "O visualizador BIM do FinGo abre modelos IFC, OBJ e GLB no navegador, inclusive no celular, com cortes, propriedades dos elementos e coordenação entre disciplinas. A detecção de interferências roda somente sobre geometria real importada, com coordenadas compatíveis, e respeita o limite de 15 MB por arquivo."
    ],
    faq: [
      { q: "O que é clash detection em BIM?", a: "É a verificação automática de interferências entre modelos de disciplinas diferentes, como uma tubulação atravessando uma viga, feita antes da execução para evitar retrabalho." },
      { q: "O que é necessário para fazer detecção de interferências confiável?", a: "Modelos reais de cada disciplina, normalmente em IFC, com as mesmas coordenadas e unidades e geometria completa. O resultado sempre precisa de análise do projetista." },
      { q: "Modelo 3D gerado por IA serve para clash detection?", a: "Não. Modelos gerados a partir de imagens são visuais e não têm precisão de projeto; não servem para quantitativos, orçamento ou detecção de interferências." }
    ],
    fontes: [
      { nome: "buildingSMART — padrão IFC (ISO 16739)" }
    ]
  }
];
