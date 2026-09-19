import fs from 'fs';

const W = 200;  // Largura da mansão
const L = 260;  // Comprimento da mansão
const H = 56;   // Altura do pé-direito

// 12 Posições de Pilares / Sapatas (3 colunas x 4 linhas)
const cols = [-W/2 + 16, 0, W/2 - 16];
const rows = [-L/2 + 16, -L/6, L/6, L/2 - 16];
const sapataCoords = [];
cols.forEach(x => {
  rows.forEach(z => {
    sapataCoords.push({ x, z });
  });
});

console.log(`Grid de Pilares: ${sapataCoords.length} pontos.`);

// Teste de montagem das malhas
let totalMeshes = 0;
let totalElements = 0;

// Código da função _generateParametricBuilding
const code = `
  /**
   * Gera a maquete volumétrica procedural detalhada com elementos arquitetônicos e todas as infraestruturas
   * Mansão Alto Padrão 480 m² (Orçamento R$ 1.000.000,00) com Estrutura, Alvenaria, Hidráulica, Elétrica, HVAC e Cobertura.
   */
  _generateParametricBuilding(obra) {
    this.elements = [];
    const W = 200;  // Largura total da mansão
    const L = 260;  // Comprimento total
    const H = 56;   // Altura do pé-direito por pavimento
    const yTerreo = 0;
    const yPav1 = H + 6;
    const yRoofBase = yPav1 + H + 4;

    // Grid de 12 Pilares / Sapatas (3 colunas x 4 linhas)
    const cols = [-W/2 + 16, 0, W/2 - 16];
    const rows = [-L/2 + 16, -L/6, L/6, L/2 - 16];
    const sapataCoords = [];
    cols.forEach(x => {
      rows.forEach(z => {
        sapataCoords.push({ x, z });
      });
    });

    // =========================================================================
    // 1. DISCIPLINA: FUNDAÇÕES & CONTENÇÃO (fundacao / estrutural) — R$ 145.000
    // =========================================================================
    const fundacaoMeshes = [];
    sapataCoords.forEach(pos => {
      // Sapata isolada de concreto armado
      fundacaoMeshes.push({
        type: 'box', x: pos.x - 18, y: -44, z: pos.z - 18, w: 36, h: 16, d: 36,
        color: '#475569', name: 'Sapata de Concreto Armado (CA-50)'
      });
      // Arranque de pilar
      fundacaoMeshes.push({
        type: 'box', x: pos.x - 9, y: -28, z: pos.z - 9, w: 18, h: 14, d: 18,
        color: '#64748B', name: 'Arranque de Pilar Estrutural'
      });
    });

    // Vigas Baldrame longitudinais (3 linhas)
    cols.forEach(x => {
      fundacaoMeshes.push({
        type: 'box', x: x - 8, y: -14, z: -L/2 + 12, w: 16, h: 14, d: L - 24,
        color: '#64748B', name: 'Viga Baldrame Longitudinal'
      });
    });

    // Vigas Baldrame transversais (4 linhas)
    rows.forEach(z => {
      fundacaoMeshes.push({
        type: 'box', x: -W/2 + 12, y: -14, z: z - 8, w: W - 24, h: 14, d: 16,
        color: '#64748B', name: 'Viga Baldrame Transversal'
      });
    });

    // Contrapiso impermeabilizado (Radier de piso)
    fundacaoMeshes.push({
      type: 'box', x: -W/2 + 6, y: -2, z: -L/2 + 6, w: W - 12, h: 4, d: L - 12,
      color: '#94A3B8', name: 'Laje de Contrapiso Impermeabilizada'
    });

    // Piscina com Deck e Prainha nos fundos
    fundacaoMeshes.push(
      // Estrutura de Concreto da Piscina
      { type: 'box', x: -W/2 + 20, y: -36, z: -L/2 - 70, w: 80, h: 36, d: 60, color: '#334155', name: 'Estrutura de Concreto da Piscina' },
      // Água Translúcida da Piscina
      { type: 'box', x: -W/2 + 24, y: -4, z: -L/2 - 66, w: 72, h: 4, d: 52, color: 'rgba(6, 182, 212, 0.75)', isWater: true, name: 'Espelho d\\'Água Piscina' },
      // Deck de Madeira Tratada
      { type: 'box', x: -W/2 + 12, y: -1, z: -L/2 - 80, w: 100, h: 3, d: 80, color: '#9A3412', name: 'Deck de Madeira Cumaru' },
      // Casa de Máquinas e Bombas
      { type: 'box', x: W/2 - 60, y: -28, z: -L/2 - 50, w: 36, h: 26, d: 36, color: '#475569', name: 'Casa de Máquinas e Filtragem' }
    );

    this.elements.push({
      id: 'elem_fundacao',
      name: 'Fundações, Sapatas, Baldrames & Piscina',
      floor: 'fundacao',
      discipline: 'estrutural',
      category: 'Fundações e Geotecnia',
      sinapiCode: '96538',
      sinapiDesc: 'Armação e concretagem de bloco, viga baldrame e sapata com aço CA-50 e concreto Fck 30 MPa',
      orcado: 145000.00,
      realizado: 142300.00,
      executadoPct: 100,
      color: '#64748B',
      meshes: fundacaoMeshes
    });

    // =========================================================================
    // 2. DISCIPLINA: SUPERESTRUTURA DE CONCRETO (estrutural) — R$ 230.000
    // =========================================================================
    const estruturaMeshes = [];

    // 12 Pilares no Térreo
    sapataCoords.forEach(pos => {
      estruturaMeshes.push({
        type: 'box', x: pos.x - 8, y: 2, z: pos.z - 8, w: 16, h: H, d: 16,
        color: '#94A3B8', name: 'Pilar Concreto Térreo (30x30 cm)'
      });
    });

    // Vigas de Cinta do Térreo (Perímetro + Intermediárias)
    cols.forEach(x => {
      estruturaMeshes.push({
        type: 'box', x: x - 7, y: H - 10, z: -L/2 + 10, w: 14, h: 12, d: L - 20,
        color: '#94A3B8', name: 'Viga de Travamento Superior Térreo'
      });
    });
    rows.forEach(z => {
      estruturaMeshes.push({
        type: 'box', x: -W/2 + 10, y: H - 10, z: z - 7, w: W - 20, h: 12, d: 14,
        color: '#94A3B8', name: 'Viga de Travamento Transversal Térreo'
      });
    });

    // Laje Maciça Intermediária com Balanço Frontal (Sacada Gourmet)
    estruturaMeshes.push({
      type: 'box', x: -W/2 + 2, y: yPav1 - 6, z: -L/2 + 2, w: W - 4, h: 8, d: L + 30,
      color: '#CBD5E1', name: 'Laje Maciça de Concreto Protendido (e=15cm)'
    });

    // 12 Pilares no 1º Pavimento
    sapataCoords.forEach(pos => {
      estruturaMeshes.push({
        type: 'box', x: pos.x - 8, y: yPav1 + 2, z: pos.z - 8, w: 16, h: H, d: 16,
        color: '#94A3B8', name: 'Pilar Concreto 1º Pavimento'
      });
    });

    // Laje de Forro Superior / Cobertura
    estruturaMeshes.push({
      type: 'box', x: -W/2 + 2, y: yRoofBase - 6, z: -L/2 + 2, w: W - 4, h: 8, d: L - 4,
      color: '#CBD5E1', name: 'Laje de Forro Superior e Platibanda'
    });

    this.elements.push({
      id: 'elem_estrutura_concreto',
      name: 'Superestrutura: 24 Pilares, Vigas & Lajes Maciças',
      floor: 'all',
      discipline: 'estrutural',
      category: 'Superestrutura Concreto Armado',
      sinapiCode: '103670',
      sinapiDesc: 'Estrutura de concreto armado para edifícios (pilares, vigas e lajes maciças Fck 35 MPa com escoramento metálico)',
      orcado: 230000.00,
      realizado: 218500.00,
      executadoPct: 92,
      color: '#94A3B8',
      meshes: estruturaMeshes
    });

    // =========================================================================
    // 3. DISCIPLINA: ARQUITETURA & ALVENARIA (arquitetura) — R$ 180.000
    // =========================================================================
    const arqMeshes = [];

    // Paredes e Fachada Térreo
    arqMeshes.push(
      // Parede frontal esquerda
      { type: 'box', x: -W/2 + 10, y: 2, z: L/2 - 14, w: 70, h: H, d: 8, color: '#C2410C', isBrick: true, name: 'Alvenaria Fachada Sala de Estar' },
      // Pele de Vidro Fachada Sala (Structural Glazing)
      { type: 'box', x: -W/2 + 16, y: 12, z: L/2 - 13, w: 58, h: 38, d: 3, color: 'rgba(56, 189, 248, 0.70)', isGlass: true, name: 'Pele de Vidro Sala Duplo Laminado' },
      { type: 'box', x: -W/2 + 14, y: 10, z: L/2 - 14, w: 62, h: 42, d: 1, color: '#0F172A', isFrame: true, name: 'Caixilharia Alumínio Preto Linha Gold' },

      // Porta Pivotante Monumental em Madeira Nobre (3,20m)
      { type: 'box', x: -6, y: 2, z: L/2 - 13, w: 34, h: 50, d: 5, color: '#78350F', name: 'Porta Pivotante em Madeira Cumaru' },
      { type: 'box', x: 22, y: 16, z: L/2 - 8, w: 3, h: 22, d: 3, color: '#F8FAFC', name: 'Puxador Inox Escovado 1,50m' },

      // Parede Garagem / Acesso Térreo Direito
      { type: 'box', x: 34, y: 2, z: L/2 - 14, w: 60, h: H, d: 8, color: '#C2410C', isBrick: true, name: 'Alvenaria Garagem Coberta' },

      // Paredes Laterais e Fundos Térreo
      { type: 'box', x: -W/2 + 10, y: 2, z: -L/2 + 10, w: 8, h: H, d: L - 24, color: '#EA580C', isBrick: true, name: 'Alvenaria Lateral Esquerda' },
      { type: 'box', x: W/2 - 18, y: 2, z: -L/2 + 10, w: 8, h: H, d: L - 24, color: '#EA580C', isBrick: true, name: 'Alvenaria Lateral Direita' },
      { type: 'box', x: -W/2 + 10, y: 2, z: -L/2 + 10, w: W - 20, h: H, d: 8, color: '#C2410C', isBrick: true, name: 'Alvenaria Fundos Espaço Gourmet' },

      // Bancada Gourmet e Churrasqueira
      { type: 'box', x: 20, y: 2, z: -L/2 + 20, w: 60, h: 20, d: 18, color: '#1E293B', name: 'Bancada Granito Preto São Gabriel' },
      { type: 'box', x: 62, y: 2, z: -L/2 + 18, w: 18, h: 52, d: 18, color: '#7C2D12', isBrick: true, name: 'Churrasqueira Alvenaria Refratária' },

      // Piso Varanda Frontal
      { type: 'box', x: -W/2 + 4, y: 0, z: L/2 - 6, w: W - 8, h: 3, d: 32, color: '#CBD5E1', name: 'Piso Porcelanato Acetinado 120x120cm' }
    );

    // Paredes e Sacada do 1º Pavimento
    arqMeshes.push(
      // Guarda-corpo panorâmico da sacada frontal
      { type: 'box', x: -W/2 + 8, y: yPav1 + 6, z: L/2 + 30, w: W - 16, h: 22, d: 2, color: 'rgba(56, 189, 248, 0.45)', isGlass: true, name: 'Guarda-corpo Vidro Temperado Sacada' },
      { type: 'box', x: -W/2 + 6, y: yPav1 + 28, z: L/2 + 29, w: W - 12, h: 3, d: 4, color: '#0F172A', isFrame: true, name: 'Perfil Corrimão Alumínio Preto' },
      { type: 'box', x: -W/2 + 6, y: yPav1 + 6, z: L/2 + 4, w: 2, h: 22, d: 26, color: 'rgba(56, 189, 248, 0.45)', isGlass: true, name: 'Guarda-corpo Lateral Esq.' },
      { type: 'box', x: W/2 - 8, y: yPav1 + 6, z: L/2 + 4, w: 2, h: 22, d: 26, color: 'rgba(56, 189, 248, 0.45)', isGlass: true, name: 'Guarda-corpo Lateral Dir.' },

      // Paredes Frontais 1º Pavimento (Suíte Master + Dormitórios)
      { type: 'box', x: -W/2 + 10, y: yPav1 + 2, z: L/2 - 14, w: W - 20, h: H, d: 8, color: '#F1F5F9', name: 'Alvenaria Suíte Master & Closet' },
      // Porta-balcão de correr para a sacada
      { type: 'box', x: -36, y: yPav1 + 2, z: L/2 - 12, w: 56, h: 46, d: 3, color: 'rgba(56, 189, 248, 0.75)', isGlass: true, name: 'Porta-Balcão 4 Folhas Sacada' },
      // Janela do Quarto 2
      { type: 'box', x: 32, y: yPav1 + 14, z: L/2 - 12, w: 42, h: 32, d: 3, color: 'rgba(56, 189, 248, 0.75)', isGlass: true, name: 'Janela Quarto Superior' },

      // Paredes Laterais e Fundos 1º Pavimento
      { type: 'box', x: -W/2 + 10, y: yPav1 + 2, z: -L/2 + 10, w: 8, h: H, d: L - 24, color: '#E2E8F0', name: 'Parede Superior Lateral Esq.' },
      { type: 'box', x: W/2 - 18, y: yPav1 + 2, z: -L/2 + 10, w: 8, h: H, d: L - 24, color: '#E2E8F0', name: 'Parede Superior Lateral Dir.' },
      { type: 'box', x: -W/2 + 10, y: yPav1 + 2, z: -L/2 + 10, w: W - 20, h: H, d: 8, color: '#E2E8F0', name: 'Parede Superior Fundos' }
    );

    this.elements.push({
      id: 'elem_arquitetura_alvenaria',
      name: 'Arquitetura, Alvenaria, Fachadas & Gourmet',
      floor: 'all',
      discipline: 'arquitetura',
      category: 'Arquitetura e Esquadrias',
      sinapiCode: '104658',
      sinapiDesc: 'Alvenaria de vedação de blocos cerâmicos, esquadrias de alumínio preto linha Gold e vidros laminados de controle solar',
      orcado: 180000.00,
      realizado: 165000.00,
      executadoPct: 80,
      color: '#EA580C',
      meshes: arqMeshes
    });

    // =========================================================================
    // 4. DISCIPLINA: INSTALAÇÕES HIDROSSANITÁRIAS (hidraulica) — R$ 115.000
    // =========================================================================
    const hidMeshes = [];

    // 2 Caixas d'água de 1.500L no Ático / Cobertura
    hidMeshes.push(
      { type: 'box', x: -44, y: yRoofBase + 8, z: -20, w: 32, h: 28, d: 32, color: '#0284C7', name: 'Caixa d\\'Água Polietileno 1.500 L (Reserva 1)' },
      { type: 'box', x: 12,  y: yRoofBase + 8, z: -20, w: 32, h: 28, d: 32, color: '#0284C7', name: 'Caixa d\\'Água Polietileno 1.500 L (Reserva 2)' },
      // Barrilete de Distribuição em PVC PBA
      { type: 'box', x: -46, y: yRoofBase + 2, z: -24, w: 92, h: 5, d: 6, color: '#0EA5E9', isPipe: true, name: 'Barrilete Geral de Distribuição (50mm)' }
    );

    // Colunas de Água Fria e Água Quente Descendo os Pavimentos (Tubos Azuis)
    const colunasPipes = [
      { x: -W/2 + 28, z: 20 },
      { x: W/2 - 36,  z: 20 },
      { x: 0,         z: -L/2 + 30 }
    ];
    colunasPipes.forEach(col => {
      // Coluna vertical de água fria (Ático até Térreo)
      hidMeshes.push({
        type: 'box', x: col.x, y: 2, z: col.z, w: 4, h: yRoofBase + 4, d: 4,
        color: '#0284C7', isPipe: true, name: 'Coluna de Água Fria Soldável (32mm)'
      });
      // Coluna vertical de água quente PPR
      hidMeshes.push({
        type: 'box', x: col.x + 6, y: 2, z: col.z, w: 4, h: yRoofBase + 4, d: 4,
        color: '#10B981', isPipe: true, name: 'Coluna de Água Quente PPR Termofusão'
      });
      // Ramal horizontal na laje do 1º Pavimento
      hidMeshes.push({
        type: 'box', x: col.x - 20, y: yPav1 - 2, z: col.z, w: 40, h: 4, d: 4,
        color: '#0EA5E9', isPipe: true, name: 'Ramal de Distribuição Sanitária 1º Pav.'
      });
    });

    // Tubulação de Esgoto Primário 100mm e Ventilação (Tubos Brancos)
    colunasPipes.forEach(col => {
      hidMeshes.push({
        type: 'box', x: col.x + 14, y: -16, z: col.z, w: 7, h: yRoofBase + 2, d: 7,
        color: '#F8FAFC', isPipe: true, name: 'Tubo de Queda de Esgoto Primário 100mm'
      });
      // Caixa Sifonada / Ralo Linear
      hidMeshes.push({
        type: 'box', x: col.x + 10, y: yPav1 - 4, z: col.z - 8, w: 14, h: 6, d: 14,
        color: '#E2E8F0', name: 'Caixa Sifonada com Grelha Inox'
      });
    });

    // Tubulação Subterrânea de Esgoto Geral e Ligação de Piscina
    hidMeshes.push(
      { type: 'box', x: -W/2 + 20, y: -18, z: -L/2 + 10, w: W - 40, h: 8, d: 8, color: '#F1F5F9', isPipe: true, name: 'Coletor Predial de Esgoto 150mm' },
      { type: 'box', x: -W/2 + 30, y: -24, z: -L/2 - 40, w: 6, h: 6, d: 40, color: '#0284C7', isPipe: true, name: 'Tubulação de Sucção e Recirculação Piscina' }
    );

    this.elements.push({
      id: 'elem_hidraulica_sanitario',
      name: 'Instalações Hidrossanitárias, Caixas d\\'Água & Esgoto',
      floor: 'all',
      discipline: 'hidraulica',
      category: 'Instalações Hidráulicas e Sanitárias',
      sinapiCode: '89985',
      sinapiDesc: 'Tubulação de PVC soldável, PPR para água quente, reservatórios de 1.500L, barrilete e rede coletora de esgoto predial',
      orcado: 115000.00,
      realizado: 98000.00,
      executadoPct: 85,
      color: '#0EA5E9',
      meshes: hidMeshes
    });

    // =========================================================================
    // 5. DISCIPLINA: INSTALAÇÕES ELÉTRICAS & AUTOMAÇÃO (eletrica) — R$ 125.000
    // =========================================================================
    const eletricaMeshes = [];

    // Quadros de Distribuição Geral (QDG no Térreo) e Parcial (QDC no 1º Pav.)
    eletricaMeshes.push(
      { type: 'box', x: -W/2 + 14, y: 18, z: 40, w: 6, h: 28, d: 24, color: '#EAB308', name: 'Quadro de Distribuição Geral (QDG 48 Disjuntores)' },
      { type: 'box', x: -W/2 + 14, y: yPav1 + 18, z: 40, w: 6, h: 24, d: 20, color: '#EAB308', name: 'Quadro de Distribuição Parcial (QDC 1º Pavimento)' }
    );

    // Eletrocalhas Metálicas Principais no Entreforro (Térreo e 1º Pav.)
    eletricaMeshes.push(
      { type: 'box', x: -W/2 + 18, y: H - 4, z: -L/2 + 30, w: 8, h: 5, d: L - 60, color: '#CA8A04', isElectric: true, name: 'Eletrocalha Perfurada Térreo (100x50mm)' },
      { type: 'box', x: -W/2 + 18, y: yPav1 + H - 4, z: -L/2 + 30, w: 8, h: 5, d: L - 60, color: '#CA8A04', isElectric: true, name: 'Eletrocalha Perfurada 1º Pav. (100x50mm)' }
    );

    // Eletrodutos Corrugados Reforçados e Pontos de Iluminação / Tomadas
    const circuitos = [
      { x: -40, z: 60 },
      { x: 40,  z: 60 },
      { x: -40, z: -40 },
      { x: 40,  z: -40 }
    ];
    circuitos.forEach(pt => {
      // Eletroduto vertical descendo para interruptores
      eletricaMeshes.push({
        type: 'box', x: pt.x, y: 4, z: pt.z, w: 3, h: H - 8, d: 3,
        color: '#FACC15', isElectric: true, name: 'Eletroduto Corrugado PEAD Antichamas'
      });
      // Spots LED de Embutir no Teto
      eletricaMeshes.push({
        type: 'box', x: pt.x - 6, y: H - 1, z: pt.z - 6, w: 12, h: 2, d: 12,
        color: '#FEF08A', name: 'Painel LED Embutir 24W IRC>90'
      });
      // Spots LED no 1º Pavimento
      eletricaMeshes.push({
        type: 'box', x: pt.x - 6, y: yPav1 + H - 1, z: pt.z - 6, w: 12, h: 2, d: 12,
        color: '#FEF08A', name: 'Painel LED Embutir 1º Pavimento'
      });
    });

    this.elements.push({
      id: 'elem_eletrica_automacao',
      name: 'Instalações Elétricas, Quadros QDG & Automação',
      floor: 'all',
      discipline: 'eletrica',
      category: 'Instalações Elétricas e Automação',
      sinapiCode: '91834',
      sinapiDesc: 'Quadro de distribuição com barramentos trifásicos, eletrocalhas perfuradas, fiação de cobre antichamas e luminárias LED',
      orcado: 125000.00,
      realizado: 112000.00,
      executadoPct: 90,
      color: '#EAB308',
      meshes: eletricaMeshes
    });

    // =========================================================================
    // 6. DISCIPLINA: CLIMATIZAÇÃO CENTRAL & HVAC (mecanica) — R$ 85.000
    // =========================================================================
    const hvacMeshes = [];

    // Unidades Condensadoras Externas VRF / Multi-Split no Piso Técnico
    hvacMeshes.push(
      { type: 'box', x: W/2 - 40, y: yRoofBase + 2, z: -L/2 + 20, w: 26, h: 32, d: 20, color: '#475569', name: 'Condensadora VRF Inverter 8 HP (Unidade 1)' },
      { type: 'box', x: W/2 - 40, y: yRoofBase + 2, z: -L/2 + 50, w: 26, h: 32, d: 20, color: '#475569', name: 'Condensadora VRF Inverter 8 HP (Unidade 2)' }
    );

    // Rede Principal de Dutos de Insuflamento e Retorno de Ar no Forro
    hvacMeshes.push(
      // Duto mestre horizontal no forro do térreo
      { type: 'box', x: -20, y: H - 8, z: -L/2 + 30, w: 40, h: 8, d: L - 60, color: '#94A3B8', isDuct: true, name: 'Duto Principal de Climatização Chapa Galvanizada' },
      // Duto mestre horizontal no forro do 1º pav
      { type: 'box', x: -20, y: yPav1 + H - 8, z: -L/2 + 30, w: 40, h: 8, d: L - 60, color: '#94A3B8', isDuct: true, name: 'Duto Climatização 1º Pavimento' },
      // Evaporadoras Cassete 4 Vias de Teto
      { type: 'box', x: -16, y: H - 6, z: 20, w: 32, h: 6, d: 32, color: '#F1F5F9', name: 'Evaporadora Cassete 4 Vias Sala Principal' },
      { type: 'box', x: -16, y: H - 6, z: -60, w: 32, h: 6, d: 32, color: '#F1F5F9', name: 'Evaporadora Cassete Espaço Gourmet' },
      { type: 'box', x: -16, y: yPav1 + H - 6, z: 20, w: 32, h: 6, d: 32, color: '#F1F5F9', name: 'Evaporadora Suíte Master' }
    );

    // Linha Frigorígena de Cobre Isolada (Ático até Térreo)
    hvacMeshes.push({
      type: 'box', x: W/2 - 34, y: 4, z: -L/2 + 34, w: 4, h: yRoofBase, d: 4,
      color: '#B45309', isPipe: true, name: 'Linha Frigorígena Cobre com Isolamento Térmico'
    });

    this.elements.push({
      id: 'elem_climatizacao_hvac',
      name: 'Climatização Central VRF, Dutos & Evaporadoras',
      floor: 'all',
      discipline: 'mecanica',
      category: 'Climatização e HVAC',
      sinapiCode: '98512',
      sinapiDesc: 'Sistema VRF de fluxo de refrigerante variável, rede de dutos galvanizados com isolamento térmico e evaporadoras cassete',
      orcado: 85000.00,
      realizado: 68000.00,
      executadoPct: 80,
      color: '#38BDF8',
      meshes: hvacMeshes
    });

    // =========================================================================
    // 7. DISCIPLINA: COBERTURA & TELHADO COLONIAL (cobertura) — R$ 120.000
    // =========================================================================
    const coberturaMeshes = [];
    const roofRidgeHeight = 44;

    // Telhado de 2 Águas com Cumeeira e Oitões Triangulares
    coberturaMeshes.push({
      type: 'roof_gable',
      x: -W/2 - 12,
      y: yRoofBase + 2,
      z: -L/2 - 12,
      w: W + 24,
      h: roofRidgeHeight,
      d: L + 24,
      colorLeft: '#9A3412',  // Telhas cerâmicas terracota
      colorRight: '#7C2D12', // Sombreado
      colorGable: '#E2E8F0', // Oitão rebocado
      colorRidge: '#C2410C', // Cumeeira cerâmica
      name: 'Telhado Colonial Cerâmico de 2 Águas com Estrutura de Madeira Nobre'
    });

    // Calhas Pluviais e Condutores Verticais
    coberturaMeshes.push(
      { type: 'box', x: -W/2 - 14, y: yRoofBase - 2, z: -L/2 - 14, w: 6, h: 6, d: L + 28, color: '#64748B', isPipe: true, name: 'Calha Pluvial em Chapa Galvanizada Esq.' },
      { type: 'box', x: W/2 + 8,   y: yRoofBase - 2, z: -L/2 - 14, w: 6, h: 6, d: L + 28, color: '#64748B', isPipe: true, name: 'Calha Pluvial em Chapa Galvanizada Dir.' }
    );

    this.elements.push({
      id: 'elem_cobertura_telhado',
      name: 'Cobertura, Tesouras de Madeira, Telhas & Calhas',
      floor: 'cobertura',
      discipline: 'arquitetura',
      category: 'Cobertura e Telhado',
      sinapiCode: '94213',
      sinapiDesc: 'Estrutura de madeira de lei para telhados de 2 águas, telhas cerâmicas esmaltadas, calhas e rufos galvanizados',
      orcado: 120000.00,
      realizado: 42000.00,
      executadoPct: 35,
      color: '#EA580C',
      meshes: coberturaMeshes
    });
  },
`;

fs.writeFileSync('scripts/generated_building.js', code, 'utf8');
console.log('Código gerado com sucesso!');
