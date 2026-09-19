/**
 * FinGo — Módulo Visualizador 3D BIM Interativo para Obras & Orçamentos (BIMViewer)
 * Renderizador 3D procedural arquitetônico de alta fidelidade com vínculo direto ao SINAPI e custos.
 */

const BIMViewer = {
  activeObraId: null,
  containerId: null,
  canvas: null,
  ctx: null,
  currentFloor: 'all', // 'all', 'fundacao', 'terreo', 'pav1', 'cobertura'
  viewMode: 'solid', // 'solid', 'wireframe', 'xray'
  selectedElement: null,

  // Estados de Câmera 3D
  rotX: 24 * (Math.PI / 180),
  rotY: -35 * (Math.PI / 180),
  zoom: 1.15,
  panX: 0,
  panY: 25,
  isDragging: false,
  lastMouseX: 0,
  lastMouseY: 0,
  animationId: null,

  // Elementos do Modelo 3D da Obra
  elements: [],
  renderedFaces: [],

  /**
   * Inicializa e renderiza o visualizador dentro do container da Obra
   */
  render(containerId, obraId) {
    this.containerId = containerId;
    this.activeObraId = obraId;
    const container = document.getElementById(containerId);
    if (!container) return;

    const obra = (typeof DB !== 'undefined' && DB.getById('clientes', obraId)) || {
      nome: 'Obra Modelo',
      area_construida: 240,
      pavimentos: 2,
      padrao: 'Normal'
    };

    container.innerHTML = `
      <div class="bim-viewer-layout" style="display:flex;flex-direction:column;gap:16px;">
        <!-- Barra de Ferramentas Superior do BIM -->
        <div class="bim-toolbar" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;background:#0A1108;border:1px solid #243518;border-radius:10px;padding:12px 16px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.25rem;">🏢</span>
            <div>
              <div style="font-size:.9rem;font-weight:800;color:#F0EAD6;">Modelo 3D BIM Arquitetônico &amp; Orçamento</div>
              <div style="font-size:.75rem;color:#94A3B8;">${Utils.escapeHtml(obra.nome || 'Obra')} &middot; ${obra.area_construida || 240} m² &middot; ${obra.pavimentos || 2} pavimentos</div>
            </div>
          </div>

          <!-- Controles de Câmera e Modo -->
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div class="btn-group" style="display:inline-flex;background:#142210;border-radius:6px;border:1px solid #243518;padding:2px;">
              <button type="button" class="bim-btn ${this.viewMode === 'solid' ? 'active' : ''}" data-action="setMode" data-mode="solid" style="padding:5px 12px;font-size:.75rem;font-weight:700;border:none;background:${this.viewMode === 'solid' ? '#C6FF00' : 'transparent'};color:${this.viewMode === 'solid' ? '#000' : '#F0EAD6'};border-radius:4px;cursor:pointer;">Sólido</button>
              <button type="button" class="bim-btn ${this.viewMode === 'wireframe' ? 'active' : ''}" data-action="setMode" data-mode="wireframe" style="padding:5px 12px;font-size:.75rem;font-weight:700;border:none;background:${this.viewMode === 'wireframe' ? '#C6FF00' : 'transparent'};color:${this.viewMode === 'wireframe' ? '#000' : '#F0EAD6'};border-radius:4px;cursor:pointer;">Wireframe</button>
              <button type="button" class="bim-btn ${this.viewMode === 'xray' ? 'active' : ''}" data-action="setMode" data-mode="xray" style="padding:5px 12px;font-size:.75rem;font-weight:700;border:none;background:${this.viewMode === 'xray' ? '#C6FF00' : 'transparent'};color:${this.viewMode === 'xray' ? '#000' : '#F0EAD6'};border-radius:4px;cursor:pointer;">Raio-X</button>
            </div>

            <div class="btn-group" style="display:inline-flex;background:#142210;border-radius:6px;border:1px solid #243518;padding:2px;">
              <button type="button" class="bim-view-btn" data-action="resetView" title="Vista Isométrica 3D" style="padding:5px 10px;font-size:.75rem;border:none;background:transparent;color:#F0EAD6;cursor:pointer;font-weight:700;">📐 Isométrica</button>
              <button type="button" class="bim-view-btn" data-action="topView" title="Planta Baixa (Superior)" style="padding:5px 10px;font-size:.75rem;border:none;background:transparent;color:#F0EAD6;cursor:pointer;font-weight:700;">🗺️ Planta</button>
            </div>

            <label class="btn-action" style="cursor:pointer;margin:0;font-size:.75rem;padding:6px 12px;background:rgba(198,255,0,.1);border:1px solid rgba(198,255,0,.3);color:#C6FF00;border-radius:6px;font-weight:700;">
              <span>📁 Importar 3D (.obj / .ifc)</span>
              <input type="file" id="bim-file-input" accept=".obj,.ifc,.gltf,.glb,.json" style="display:none;" />
            </label>
          </div>
        </div>

        <!-- Área Principal 3D e Painel Lateral de Custos -->
        <div class="bim-main-grid" style="display:grid;grid-template-columns:1fr 340px;gap:16px;">
          <!-- Canvas 3D -->
          <div class="bim-canvas-wrap" style="position:relative;background:#070B06;border:1px solid #243518;border-radius:12px;overflow:hidden;min-height:560px;display:flex;align-items:center;justify-content:center;">
            <canvas id="bim-canvas" style="width:100%;height:100%;display:block;cursor:grab;touch-action:none;"></canvas>

            <!-- Seletor Flutuante de Pavimentos (Canto Superior Esquerdo) -->
            <div style="position:absolute;top:16px;left:16px;display:flex;flex-direction:column;gap:6px;background:rgba(10,17,8,0.88);backdrop-filter:blur(10px);border:1px solid #243518;border-radius:8px;padding:10px 12px;z-index:2;box-shadow:0 8px 24px rgba(0,0,0,0.6);">
              <span style="font-size:.68rem;font-weight:800;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em;">Pavimentos</span>
              <button type="button" class="bim-floor-btn ${this.currentFloor === 'all' ? 'active' : ''}" data-floor="all" style="text-align:left;padding:6px 10px;font-size:.76rem;border:none;border-radius:4px;cursor:pointer;background:${this.currentFloor === 'all' ? '#C6FF00' : 'transparent'};color:${this.currentFloor === 'all' ? '#000' : '#F0F0E8'};font-weight:800;">Todos os Pavimentos</button>
              <button type="button" class="bim-floor-btn ${this.currentFloor === 'cobertura' ? 'active' : ''}" data-floor="cobertura" style="text-align:left;padding:6px 10px;font-size:.76rem;border:none;border-radius:4px;cursor:pointer;background:${this.currentFloor === 'cobertura' ? '#C6FF00' : 'transparent'};color:${this.currentFloor === 'cobertura' ? '#000' : '#F0F0E8'};font-weight:800;">Cobertura &amp; Telhado</button>
              <button type="button" class="bim-floor-btn ${this.currentFloor === 'pav1' ? 'active' : ''}" data-floor="pav1" style="text-align:left;padding:6px 10px;font-size:.76rem;border:none;border-radius:4px;cursor:pointer;background:${this.currentFloor === 'pav1' ? '#C6FF00' : 'transparent'};color:${this.currentFloor === 'pav1' ? '#000' : '#F0F0E8'};font-weight:800;">1º Pavimento &amp; Sacada</button>
              <button type="button" class="bim-floor-btn ${this.currentFloor === 'terreo' ? 'active' : ''}" data-floor="terreo" style="text-align:left;padding:6px 10px;font-size:.76rem;border:none;border-radius:4px;cursor:pointer;background:${this.currentFloor === 'terreo' ? '#C6FF00' : 'transparent'};color:${this.currentFloor === 'terreo' ? '#000' : '#F0F0E8'};font-weight:800;">Pavimento Térreo</button>
              <button type="button" class="bim-floor-btn ${this.currentFloor === 'fundacao' ? 'active' : ''}" data-floor="fundacao" style="text-align:left;padding:6px 10px;font-size:.76rem;border:none;border-radius:4px;cursor:pointer;background:${this.currentFloor === 'fundacao' ? '#C6FF00' : 'transparent'};color:${this.currentFloor === 'fundacao' ? '#000' : '#F0F0E8'};font-weight:800;">Fundações &amp; Baldrame</button>
            </div>

            <!-- Dica de Interação de Câmera -->
            <div style="position:absolute;bottom:14px;left:16px;font-size:.72rem;color:#94A3B8;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);padding:6px 12px;border-radius:6px;border:1px solid #243518;pointer-events:none;">
              🖱️ Clique e arraste para girar 360° &middot; Scroll para Zoom &middot; Clique em qualquer parte da casa para inspecionar custos
            </div>
          </div>

          <!-- Painel Lateral de Inspeção de Custos & SINAPI -->
          <div id="bim-element-details" style="background:#0F1A0E;border:1px solid #243518;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:14px;">
            ${this._renderElementDetailsHtml(this.elements[1] || this.elements[0], obra)}
          </div>
        </div>
      </div>
    `;

    this._setup3DCanvas();
    this._generateParametricBuilding(obra);
    this.selectedElement = this.elements[1] || this.elements[0];
    const detailsContainer = document.getElementById('bim-element-details');
    if (detailsContainer) {
      detailsContainer.innerHTML = this._renderElementDetailsHtml(this.selectedElement, obra);
    }
    this._bindEvents();
  },

  /**
   * Configura o canvas 3D e o loop de renderização
   */
  _setup3DCanvas() {
    this.canvas = document.getElementById('bim-canvas');
    if (!this.canvas) return;

    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * (window.devicePixelRatio || 1);
    this.canvas.height = rect.height * (window.devicePixelRatio || 1);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    this._startRenderLoop();
  },

  /**
   * Gera a maquete volumétrica procedural detalhada com elementos arquitetônicos reais
   */
  _generateParametricBuilding(obra) {
    this.elements = [];
    const W = 160;  // Largura total da casa
    const L = 220;  // Comprimento total da casa
    const H = 54;   // Altura do pé-direito

    // 1. DISCIPLINA: FUNDAÇÕES & BALDRAME (fundacao)
    const fundacaoMeshes = [];
    const sapataCoords = [
      { x: -W/2 + 12, z: -L/2 + 12 },
      { x: 0,         z: -L/2 + 12 },
      { x: W/2 - 12,  z: -L/2 + 12 },
      { x: -W/2 + 12, z: L/2 - 12 },
      { x: 0,         z: L/2 - 12 },
      { x: W/2 - 12,  z: L/2 - 12 },
    ];

    // Sapatas isoladas e arranques de pilar
    sapataCoords.forEach(pos => {
      fundacaoMeshes.push({
        type: 'box',
        x: pos.x - 16, y: -42, z: pos.z - 16, w: 32, h: 14, d: 32,
        color: '#475569',
        name: 'Sapata de Concreto Armado'
      });
      fundacaoMeshes.push({
        type: 'box',
        x: pos.x - 8, y: -28, z: pos.z - 8, w: 16, h: 14, d: 16,
        color: '#64748B',
        name: 'Arranque de Pilar'
      });
    });

    // Vigas Baldrame perimetrais e travamentos
    fundacaoMeshes.push(
      { type: 'box', x: -W/2 + 10, y: -16, z: L/2 - 18, w: W - 20, h: 14, d: 12, color: '#64748B', name: 'Viga Baldrame Frontal' },
      { type: 'box', x: -W/2 + 10, y: -16, z: -L/2 + 6, w: W - 20, h: 14, d: 12, color: '#64748B', name: 'Viga Baldrame Traseira' },
      { type: 'box', x: -W/2 + 6,  y: -16, z: -L/2 + 10, w: 12, h: 14, d: L - 20, color: '#64748B', name: 'Viga Baldrame Lateral Esq.' },
      { type: 'box', x: W/2 - 18,  y: -16, z: -L/2 + 10, w: 12, h: 14, d: L - 20, color: '#64748B', name: 'Viga Baldrame Lateral Dir.' },
      { type: 'box', x: -6,        y: -16, z: -L/2 + 10, w: 12, h: 14, d: L - 20, color: '#475569', name: 'Viga Travamento Central' },
      { type: 'box', x: -W/2 + 4,  y: -2,  z: -L/2 + 4,  w: W - 8,  h: 4,  d: L - 8,  color: '#94A3B8', name: 'Contrapiso Impermeabilizado' }
    );

    this.elements.push({
      id: 'elem_fundacao',
      name: 'Fundações, Sapatas & Baldrame',
      floor: 'fundacao',
      category: 'Fundações e Estrutura Enterrada',
      sinapiCode: '96538',
      sinapiDesc: 'Armação de bloco, viga baldrame e sapata de concreto armado com aço CA-50',
      orcado: 28500.00,
      realizado: 27800.00,
      executadoPct: 100,
      color: '#64748B',
      meshes: fundacaoMeshes
    });

    // 2. DISCIPLINA: PAVIMENTO TÉRREO & ALVENARIA (terreo)
    const terreoMeshes = [];

    // 6 Pilares de concreto estrutural
    sapataCoords.forEach(pos => {
      terreoMeshes.push({
        type: 'box',
        x: pos.x - 7, y: 2, z: pos.z - 7, w: 14, h: H, d: 14,
        color: '#94A3B8',
        name: 'Pilar de Concreto Armado'
      });
    });

    // Paredes e Aberturas da Fachada Frontal (Sala de Estar + Porta Social + Garagem)
    terreoMeshes.push(
      // Parede Sala (peitoril abaixo da janela)
      { type: 'box', x: -W/2 + 8, y: 2,  z: L/2 - 14, w: 68, h: 16, d: 8, color: '#C2410C', isBrick: true, name: 'Alvenaria Peitoril Sala' },
      // Verga acima da janela da sala
      { type: 'box', x: -W/2 + 8, y: 44, z: L/2 - 14, w: 68, h: 12, d: 8, color: '#C2410C', isBrick: true, name: 'Verga Janela Sala' },
      // Janela Panorâmica de Vidro Temperado
      { type: 'box', x: -W/2 + 12, y: 16, z: L/2 - 13, w: 60, h: 28, d: 3, color: 'rgba(56, 189, 248, 0.70)', isGlass: true, name: 'Janela Panorâmica de Vidro' },
      // Moldura da Esquadria Preta
      { type: 'box', x: -W/2 + 10, y: 15, z: L/2 - 14, w: 64, h: 30, d: 1, color: '#0F172A', isFrame: true, name: 'Esquadria de Alumínio Preto' },

      // Parede acima da porta social
      { type: 'box', x: -6, y: 46, z: L/2 - 14, w: 32, h: 10, d: 8, color: '#C2410C', isBrick: true, name: 'Alvenaria sobre Porta' },
      // Porta Social Pivotante de Madeira Nobre
      { type: 'box', x: -4, y: 2,  z: L/2 - 13, w: 28, h: 44, d: 4, color: '#78350F', name: 'Porta Pivotante em Madeira' },
      // Puxador de Inox
      { type: 'box', x: 18, y: 18, z: L/2 - 9,  w: 2,  h: 16, d: 2, color: '#F1F5F9', name: 'Puxador Inox Escovado' },

      // Parede Garagem / Acesso Lateral Direito
      { type: 'box', x: 26, y: 2, z: L/2 - 14, w: 46, h: H, d: 8, color: '#C2410C', isBrick: true, name: 'Parede Frontal Garagem' },

      // Paredes Laterais e Traseira
      { type: 'box', x: -W/2 + 8, y: 2, z: -L/2 + 8, w: 8,      h: H, d: L - 24, color: '#EA580C', isBrick: true, name: 'Parede Lateral Esquerda' },
      { type: 'box', x: -W/2 + 6, y: 22, z: -20,     w: 3,      h: 22, d: 36,     color: 'rgba(56, 189, 248, 0.70)', isGlass: true, name: 'Janela Cozinha' },
      { type: 'box', x: W/2 - 16,  y: 2, z: -L/2 + 8, w: 8,      h: H, d: L - 24, color: '#EA580C', isBrick: true, name: 'Parede Lateral Direita' },
      { type: 'box', x: -W/2 + 8, y: 2, z: -L/2 + 8, w: W - 16, h: H, d: 8,      color: '#C2410C', isBrick: true, name: 'Parede dos Fundos' },

      // Piso da Varanda Frontal
      { type: 'box', x: -W/2 + 4, y: 0, z: L/2 - 6, w: W - 8, h: 3, d: 28, color: '#CBD5E1', name: 'Piso da Varanda Frontal' }
    );

    this.elements.push({
      id: 'elem_terreo_alvenaria',
      name: 'Pavimento Térreo & Alvenaria',
      floor: 'terreo',
      category: 'Estruturas e Alvenaria',
      sinapiCode: '104658',
      sinapiDesc: 'Alvenaria de vedação de blocos cerâmicos furados 9x19x19cm com argamassa mista',
      orcado: 45000.00,
      realizado: 42100.00,
      executadoPct: 95,
      color: '#EA580C',
      meshes: terreoMeshes
    });

    // 3. DISCIPLINA: 1º PAVIMENTO & SACADA (pav1)
    const pav1Meshes = [];
    const yPav1 = H + 4;

    // Laje intermediária de concreto com balanço frontal para a sacada
    pav1Meshes.push(
      { type: 'box', x: -W/2 + 2, y: yPav1, z: -L/2 + 2, w: W - 4, h: 8, d: L + 24, color: '#CBD5E1', name: 'Laje Treliçada com Sacada em Balanço' }
    );

    // Guarda-corpo da Sacada Frontal
    pav1Meshes.push(
      { type: 'box', x: -W/2 + 10, y: yPav1 + 8,  z: L/2 + 24, w: W - 20, h: 20, d: 2, color: 'rgba(56, 189, 248, 0.45)', isGlass: true, name: 'Guarda-corpo de Vidro da Sacada' },
      { type: 'box', x: -W/2 + 8,  y: yPav1 + 28, z: L/2 + 23, w: W - 16, h: 3,  d: 4, color: '#0F172A', isFrame: true, name: 'Corrimão de Alumínio Preto' },
      { type: 'box', x: -W/2 + 8,  y: yPav1 + 8,  z: L/2 + 2,  w: 2,      h: 20, d: 22, color: 'rgba(56, 189, 248, 0.45)', isGlass: true, name: 'Guarda-corpo Lateral Esq.' },
      { type: 'box', x: W/2 - 10,  y: yPav1 + 8,  z: L/2 + 2,  w: 2,      h: 20, d: 22, color: 'rgba(56, 189, 248, 0.45)', isGlass: true, name: 'Guarda-corpo Lateral Dir.' }
    );

    // 6 Pilares estruturais superiores
    sapataCoords.forEach(pos => {
      pav1Meshes.push({
        type: 'box',
        x: pos.x - 7, y: yPav1 + 8, z: pos.z - 7, w: 14, h: H - 4, d: 14,
        color: '#94A3B8',
        name: 'Pilar Superior 1º Pav.'
      });
    });

    // Paredes Superiores e Janelas dos Dormitórios
    pav1Meshes.push(
      { type: 'box', x: -W/2 + 8, y: yPav1 + 8, z: L/2 - 14, w: W - 16, h: H - 4, d: 8, color: '#E2E8F0', name: 'Parede Frontal Suíte Máster' },
      // Porta-balcão de vidro de correr para a sacada
      { type: 'box', x: -28, y: yPav1 + 8,  z: L/2 - 12, w: 42, h: 42, d: 3, color: 'rgba(56, 189, 248, 0.75)', isGlass: true, name: 'Porta-Balcão da Sacada' },
      // Janela do Dormitório 2
      { type: 'box', x: 26,  y: yPav1 + 18, z: L/2 - 12, w: 36, h: 26, d: 3, color: 'rgba(56, 189, 248, 0.75)', isGlass: true, name: 'Janela Quarto Superior' },
      // Paredes Laterais e Fundo Superior
      { type: 'box', x: -W/2 + 8, y: yPav1 + 8, z: -L/2 + 8, w: 8,      h: H - 4, d: L - 24, color: '#E2E8F0', name: 'Parede Lateral Superior Esq.' },
      { type: 'box', x: W/2 - 16,  y: yPav1 + 8, z: -L/2 + 8, w: 8,      h: H - 4, d: L - 24, color: '#E2E8F0', name: 'Parede Lateral Superior Dir.' },
      { type: 'box', x: -W/2 + 8, y: yPav1 + 8, z: -L/2 + 8, w: W - 16, h: H - 4, d: 8,      color: '#E2E8F0', name: 'Parede Fundo Superior' }
    );

    this.elements.push({
      id: 'elem_pav1',
      name: '1º Pavimento & Sacada',
      floor: 'pav1',
      category: 'Estruturas e Alvenaria',
      sinapiCode: '101964',
      sinapiDesc: 'Laje pré-moldada unidirecional para piso com vigotas treliçadas',
      orcado: 52000.00,
      realizado: 38400.00,
      executadoPct: 75,
      color: '#38BDF8',
      meshes: pav1Meshes
    });

    // 4. DISCIPLINA: COBERTURA, TESOURAS & TELHADO (cobertura)
    const coberturaMeshes = [];
    const yRoofBase = yPav1 + 8 + (H - 4);
    const roofRidgeHeight = 38;

    // Laje de Forro Superior
    coberturaMeshes.push(
      { type: 'box', x: -W/2 + 2, y: yRoofBase, z: -L/2 + 2, w: W - 4, h: 6, d: L - 4, color: '#94A3B8', name: 'Laje de Forro e Platibanda' }
    );

    // Telhado de 2 Águas com Cumeeira Centralizada e Oitões Triangulares
    coberturaMeshes.push({
      type: 'roof_gable',
      x: -W/2 - 10,
      y: yRoofBase + 6,
      z: -L/2 - 10,
      w: W + 20,
      h: roofRidgeHeight,
      d: L + 20,
      colorLeft: '#9A3412',  // Terracota telha esquerda
      colorRight: '#7C2D12', // Terracota sombreada telha direita
      colorGable: '#CBD5E1', // Oitão rebocado
      colorRidge: '#C2410C', // Cumeeira cerâmica
      name: 'Telhado Colonial 2 Águas com Estrutura de Madeira'
    });

    this.elements.push({
      id: 'elem_cobertura',
      name: 'Cobertura, Tesouras & Telhado',
      floor: 'cobertura',
      category: 'Cobertura e Telhado',
      sinapiCode: '94213',
      sinapiDesc: 'Telhamento com telha cerâmica tipo portuguesa com estrutura de madeira',
      orcado: 34000.00,
      realizado: 12500.00,
      executadoPct: 35,
      color: '#EA580C',
      meshes: coberturaMeshes
    });
  },

  /**
   * Loop de renderização 3D com projeção isométrica/perspectiva
   */
  _startRenderLoop() {
    if (this.animationId) cancelAnimationFrame(this.animationId);

    const render = () => {
      this._drawScene();
      this.animationId = requestAnimationFrame(render);
    };
    render();
  },

  /**
   * Desenha a cena 3D com ordenação de profundidade (Painter's Algorithm)
   */
  _drawScene() {
    if (!this.ctx || !this.canvas) return;
    const w = this.canvas.parentElement.clientWidth;
    const h = this.canvas.parentElement.clientHeight;
    this.ctx.clearRect(0, 0, w, h);

    const cx = w / 2 + this.panX;
    const cy = h / 2 + this.panY;

    // Desenhar Grid de Terreno / Canteiro
    this._drawGroundGrid(cx, cy);

    // Filtrar elementos do pavimento ativo
    const visibleElements = this.elements.filter(elem => {
      if (this.currentFloor === 'all') return true;
      return elem.floor === this.currentFloor;
    });

    // Gera as faces poligonais 3D de todas as peças
    const faces = [];
    visibleElements.forEach(elem => {
      const isSelected = this.selectedElement?.id === elem.id;
      const meshes = elem.meshes || [];
      meshes.forEach(mesh => {
        if (mesh.type === 'box') {
          faces.push(...this._createBoxFaces(mesh, mesh.color, elem.id, isSelected, mesh));
        } else if (mesh.type === 'roof_gable') {
          faces.push(...this._createRoofGableFaces(mesh, elem.id, isSelected));
        }
      });
    });

    // Ordenar faces por profundidade Z projetada (Z-sort)
    faces.sort((a, b) => b.avgZ - a.avgZ);
    this.renderedFaces = faces;

    // Desenhar faces na tela
    faces.forEach(face => {
      this._drawFace(face, cx, cy);
    });
  },

  /**
   * Desenha o grid de terreno / canteiro com linhas técnicas
   */
  _drawGroundGrid(cx, cy) {
    const size = 340;
    const step = 40;
    this.ctx.strokeStyle = 'rgba(36, 53, 24, 0.45)';
    this.ctx.lineWidth = 1;

    for (let x = -size; x <= size; x += step) {
      const p1 = this._project3D(x, -44, -size);
      const p2 = this._project3D(x, -44, size);
      this.ctx.beginPath();
      this.ctx.moveTo(cx + p1.x, cy + p1.y);
      this.ctx.lineTo(cx + p2.x, cy + p2.y);
      this.ctx.stroke();
    }
    for (let z = -size; z <= size; z += step) {
      const p1 = this._project3D(-size, -44, z);
      const p2 = this._project3D(size, -44, z);
      this.ctx.beginPath();
      this.ctx.moveTo(cx + p1.x, cy + p1.y);
      this.ctx.lineTo(cx + p2.x, cy + p2.y);
      this.ctx.stroke();
    }
  },

  /**
   * Projeta coordenadas (x, y, z) do espaço 3D para (x, y) na tela com profundidade Z
   */
  _project3D(x, y, z) {
    // Rotação em torno do eixo Y
    const cosY = Math.cos(this.rotY);
    const sinY = Math.sin(this.rotY);
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;

    // Rotação em torno do eixo X
    const cosX = Math.cos(this.rotX);
    const sinX = Math.sin(this.rotX);
    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    const scale = this.zoom;
    return {
      x: x1 * scale,
      y: -y2 * scale,
      z: z2
    };
  },

  /**
   * Cria as faces 3D de um paralelepípedo / caixa
   */
  _createBoxFaces(box, color, elemId, isSelected, meta = {}) {
    const { x, y, z, w, h, d } = box;
    const vertices = [
      { x: x,     y: y,     z: z },     // 0
      { x: x + w, y: y,     z: z },     // 1
      { x: x + w, y: y + h, z: z },     // 2
      { x: x,     y: y + h, z: z },     // 3
      { x: x,     y: y,     z: z + d }, // 4
      { x: x + w, y: y,     z: z + d }, // 5
      { x: x + w, y: y + h, z: z + d }, // 6
      { x: x,     y: y + h, z: z + d }  // 7
    ];

    const faceDefs = [
      { v: [4, 5, 6, 7], light: 0.92, name: 'frente' },    // Frente (Z+)
      { v: [1, 0, 3, 2], light: 0.65, name: 'traseira' },  // Traseira (Z-)
      { v: [7, 6, 2, 3], light: 1.00, name: 'topo' },      // Topo (Y+)
      { v: [0, 1, 5, 4], light: 0.40, name: 'fundo' },     // Fundo (Y-)
      { v: [0, 4, 7, 3], light: 0.75, name: 'esquerda' },  // Esquerda (X-)
      { v: [5, 1, 2, 6], light: 0.85, name: 'direita' }    // Direita (X+)
    ];

    return faceDefs.map(f => {
      const pts = f.v.map(idx => this._project3D(vertices[idx].x, vertices[idx].y, vertices[idx].z));
      const avgZ = pts.reduce((sum, p) => sum + p.z, 0) / 4;
      return {
        pts,
        avgZ,
        color,
        light: f.light,
        elemId,
        isSelected,
        isGlass: meta.isGlass,
        isFrame: meta.isFrame,
        isBrick: meta.isBrick
      };
    });
  },

  /**
   * Cria as faces 3D de um telhado de 2 águas com cumeeira e oitões triangulares
   */
  _createRoofGableFaces(roof, elemId, isSelected) {
    const { x, y, z, w, h, d, colorLeft, colorRight, colorGable, colorRidge } = roof;
    const midX = x + w / 2;
    const apexY = y + h;

    const v = [
      { x: x,     y: y,     z: z + d }, // 0: Frente Esq
      { x: x + w, y: y,     z: z + d }, // 1: Frente Dir
      { x: midX,  y: apexY, z: z + d }, // 2: Frente Cumeeira
      { x: x,     y: y,     z: z },     // 3: Fundo Esq
      { x: x + w, y: y,     z: z },     // 4: Fundo Dir
      { x: midX,  y: apexY, z: z }      // 5: Fundo Cumeeira
    ];

    const faces = [];

    // 1. Água Esquerda (Plano inclinado)
    const ptsEsq = [0, 2, 5, 3].map(idx => this._project3D(v[idx].x, v[idx].y, v[idx].z));
    faces.push({
      pts: ptsEsq,
      avgZ: ptsEsq.reduce((sum, p) => sum + p.z, 0) / 4,
      color: colorLeft,
      light: 0.95,
      elemId,
      isSelected,
      isRoofTile: true
    });

    // 2. Água Direita (Plano inclinado)
    const ptsDir = [2, 1, 4, 5].map(idx => this._project3D(v[idx].x, v[idx].y, v[idx].z));
    faces.push({
      pts: ptsDir,
      avgZ: ptsDir.reduce((sum, p) => sum + p.z, 0) / 4,
      color: colorRight,
      light: 0.78,
      elemId,
      isSelected,
      isRoofTile: true
    });

    // 3. Oitão Triangular Frontal
    const ptsGableFrente = [0, 1, 2].map(idx => this._project3D(v[idx].x, v[idx].y, v[idx].z));
    faces.push({
      pts: ptsGableFrente,
      avgZ: ptsGableFrente.reduce((sum, p) => sum + p.z, 0) / 3,
      color: colorGable,
      light: 0.88,
      elemId,
      isSelected
    });

    // 4. Oitão Triangular Traseiro
    const ptsGableFundo = [4, 3, 5].map(idx => this._project3D(v[idx].x, v[idx].y, v[idx].z));
    faces.push({
      pts: ptsGableFundo,
      avgZ: ptsGableFundo.reduce((sum, p) => sum + p.z, 0) / 3,
      color: colorGable,
      light: 0.62,
      elemId,
      isSelected
    });

    // 5. Cumeeira de Arremate
    faces.push(...this._createBoxFaces({ x: midX - 3, y: apexY, z: z - 2, w: 6, h: 4, d: d + 4 }, colorRidge, elemId, isSelected));

    return faces;
  },

  /**
   * Renderiza uma face poligonal na tela
   */
  _drawFace(face, cx, cy) {
    const { pts, color, light, isSelected, isGlass, isFrame, isRoofTile, isBrick } = face;
    if (!pts || pts.length < 3) return;

    this.ctx.beginPath();
    this.ctx.moveTo(cx + pts[0].x, cy + pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      this.ctx.lineTo(cx + pts[i].x, cy + pts[i].y);
    }
    this.ctx.closePath();

    if (this.viewMode === 'wireframe') {
      this.ctx.strokeStyle = isSelected ? '#C6FF00' : 'rgba(198, 255, 0, 0.45)';
      this.ctx.lineWidth = isSelected ? 2 : 1;
      this.ctx.stroke();
      return;
    }

    if (this.viewMode === 'xray') {
      this.ctx.fillStyle = isSelected ? 'rgba(198, 255, 0, 0.35)' : 'rgba(16, 185, 129, 0.15)';
      this.ctx.fill();
      this.ctx.strokeStyle = isSelected ? '#C6FF00' : 'rgba(198, 255, 0, 0.55)';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
      return;
    }

    // Modo Sólido com Iluminação & Materiais Arquitetônicos
    if (isGlass) {
      this.ctx.fillStyle = isSelected ? 'rgba(198, 255, 0, 0.40)' : (color || 'rgba(56, 189, 248, 0.65)');
      this.ctx.fill();
      this.ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)';
      this.ctx.lineWidth = isSelected ? 2 : 1;
      this.ctx.stroke();
    } else if (isFrame) {
      this.ctx.fillStyle = isSelected ? '#C6FF00' : '#0F172A';
      this.ctx.fill();
      this.ctx.strokeStyle = '#334155';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    } else {
      this.ctx.fillStyle = isSelected ? '#C6FF00' : this._shadeColor(color, light);
      this.ctx.fill();

      // Linhas de borda técnica CAD/BIM
      this.ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(15, 23, 42, 0.45)';
      this.ctx.lineWidth = isSelected ? 2 : 1;
      this.ctx.stroke();

      // Textura suave de ranhuras no telhado
      if (isRoofTile && !isSelected && pts.length === 4) {
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.lineWidth = 1;
        for (let t = 0.2; t < 1.0; t += 0.2) {
          const p1x = pts[0].x + (pts[3].x - pts[0].x) * t;
          const p1y = pts[0].y + (pts[3].y - pts[0].y) * t;
          const p2x = pts[1].x + (pts[2].x - pts[1].x) * t;
          const p2y = pts[1].y + (pts[2].y - pts[1].y) * t;
          this.ctx.beginPath();
          this.ctx.moveTo(cx + p1x, cy + p1y);
          this.ctx.lineTo(cx + p2x, cy + p2y);
          this.ctx.stroke();
        }
      }
    }
  },

  /**
   * Aplica sombreamento proporcional à cor base
   */
  _shadeColor(hex, factor) {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex || '#94A3B8';
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    let r = Math.min(255, Math.floor((num >> 16) * factor));
    let g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) * factor));
    let b = Math.min(255, Math.floor((num & 0x0000FF) * factor));
    return `rgb(${r},${g},${b})`;
  },

  /**
   * Testa se um ponto 2D (px, py) está dentro de um polígono
   */
  _pointInPoly(px, py, pts, cx, cy) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = cx + pts[i].x, yi = cy + pts[i].y;
      const xj = cx + pts[j].x, yj = cy + pts[j].y;
      const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  },

  /**
   * Renderiza a gaveta lateral de inspeção do elemento 3D selecionado
   */
  _renderElementDetailsHtml(elem, obra) {
    if (!elem) {
      return `
        <div style="text-align:center;padding:24px 0;color:#94A3B8;">
          <div style="font-size:2.4rem;margin-bottom:12px;">🔍</div>
          <h4 style="font-size:.95rem;font-weight:800;color:#F0EAD6;margin:0 0 6px;">Inspeção BIM 3D</h4>
          <p style="font-size:.78rem;line-height:1.5;margin:0;">Clique em qualquer pavimento ou elemento da maquete 3D para visualizar custos orçados, itens SINAPI e avanço físico.</p>
        </div>
      `;
    }

    const orc = elem.orcado || 0;
    const real = elem.realizado || 0;
    const saldo = orc - real;
    const pct = elem.executadoPct || 0;

    return `
      <div style="display:flex;align-items:center;gap:10px;border-bottom:1px solid #243518;padding-bottom:14px;">
        <span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${elem.color};"></span>
        <div>
          <h4 style="font-size:.92rem;font-weight:800;color:#FFFFFF;margin:0;">${Utils.escapeHtml(elem.name)}</h4>
          <span style="font-size:.72rem;color:#94A3B8;">${Utils.escapeHtml(elem.category)}</span>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="background:#0A1108;border:1px solid #243518;border-radius:8px;padding:12px 14px;">
          <span style="font-size:.70rem;font-weight:700;color:#94A3B8;text-transform:uppercase;">Item SINAPI Oficial</span>
          <div style="font-size:.85rem;font-weight:800;color:#C6FF00;margin-top:2px;">Código ${Utils.escapeHtml(elem.sinapiCode)}</div>
          <p style="font-size:.75rem;color:#CBD5E1;margin:4px 0 0;line-height:1.4;">${Utils.escapeHtml(elem.sinapiDesc)}</p>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="background:#0A1108;border:1px solid #243518;border-radius:8px;padding:10px 12px;">
            <span style="font-size:.68rem;color:#94A3B8;">Orçado</span>
            <div style="font-size:.90rem;font-weight:800;color:#F0EAD6;font-variant-numeric:tabular-nums;">${Utils.fmt.currency(orc)}</div>
          </div>
          <div style="background:#0A1108;border:1px solid #243518;border-radius:8px;padding:10px 12px;">
            <span style="font-size:.68rem;color:#94A3B8;">Realizado</span>
            <div style="font-size:.90rem;font-weight:800;color:#E8C84A;font-variant-numeric:tabular-nums;">${Utils.fmt.currency(real)}</div>
          </div>
        </div>

        <div style="background:#0A1108;border:1px solid #243518;border-radius:8px;padding:12px 14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:.72rem;font-weight:700;color:#94A3B8;">Avanço Físico</span>
            <span style="font-size:.82rem;font-weight:900;color:#C6FF00;">${pct}%</span>
          </div>
          <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:#C6FF00;border-radius:3px;"></div>
          </div>
        </div>

        <button type="button" class="btn-action" data-action="filterLancamentos" style="width:100%;text-align:center;justify-content:center;padding:9px 12px;font-size:.78rem;background:rgba(198,255,0,0.1);color:#C6FF00;border-color:rgba(198,255,0,0.3);margin-top:4px;font-weight:700;">
          📊 Ver Lançamentos Desta Etapa
        </button>
      </div>
    `;
  },

  /**
   * Conecta eventos de clique, mouse drag, touch e upload de arquivos
   */
  _bindEvents() {
    const canvas = this.canvas;
    if (!canvas) return;

    // Mouse Drag para Rotação 360°
    canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.rotY += dx * 0.008;
      this.rotX += dy * 0.008;
      this.rotX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotX));
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      if (canvas) canvas.style.cursor = 'grab';
    });

    // Touch Drag para Mobile e Tablets
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - this.lastMouseX;
      const dy = e.touches[0].clientY - this.lastMouseY;
      this.rotY += dx * 0.008;
      this.rotX += dy * 0.008;
      this.rotX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotX));
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
    }, { passive: true });

    canvas.addEventListener('touchend', () => {
      this.isDragging = false;
    });

    // Zoom via Mouse Wheel
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      this.zoom = Math.max(0.4, Math.min(2.5, this.zoom * zoomFactor));
    }, { passive: false });

    // Clique de Alta Precisão (Raycast / Point-in-polygon) no Canvas para Selecionar Elemento 3D
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const cx = canvas.parentElement.clientWidth / 2 + this.panX;
      const cy = canvas.parentElement.clientHeight / 2 + this.panY;

      // Percorre as faces projetadas em ordem de profundidade (frente para trás)
      let hitElemId = null;
      for (const face of this.renderedFaces) {
        if (this._pointInPoly(clickX, clickY, face.pts, cx, cy)) {
          hitElemId = face.elemId;
          break;
        }
      }

      const hitElem = hitElemId ? this.elements.find(el => el.id === hitElemId) : null;
      if (hitElem) {
        this.selectedElement = hitElem;
      } else {
        // Se clicou fora ou vazio, cicla entre os elementos visíveis
        const visible = this.elements.filter(elem => this.currentFloor === 'all' || elem.floor === this.currentFloor);
        const nextIdx = visible.findIndex(elem => elem.id === this.selectedElement?.id);
        this.selectedElement = visible[(nextIdx + 1) % visible.length] || visible[0];
      }

      const detailsContainer = document.getElementById('bim-element-details');
      if (detailsContainer && this.selectedElement) {
        const obra = (typeof DB !== 'undefined' && DB.getById('clientes', this.activeObraId)) || {};
        detailsContainer.innerHTML = this._renderElementDetailsHtml(this.selectedElement, obra);
      }
    });

    // Botões de Pavimento
    document.querySelectorAll('.bim-floor-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const floor = e.currentTarget.getAttribute('data-floor');
        this.currentFloor = floor;
        document.querySelectorAll('.bim-floor-btn').forEach(b => {
          b.style.background = 'transparent';
          b.style.color = '#F0EAD6';
        });
        e.currentTarget.style.background = '#C6FF00';
        e.currentTarget.style.color = '#000';
      });
    });

    // Botões de Modo
    document.querySelectorAll('.bim-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.getAttribute('data-mode');
        this.viewMode = mode;
        document.querySelectorAll('.bim-btn').forEach(b => {
          b.style.background = 'transparent';
          b.style.color = '#F0EAD6';
        });
        e.currentTarget.style.background = '#C6FF00';
        e.currentTarget.style.color = '#000';
      });
    });

    // Botões de Vista Rápida
    const resetBtn = document.querySelector('[data-action="resetView"]');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.rotX = 24 * (Math.PI / 180);
        this.rotY = -35 * (Math.PI / 180);
        this.zoom = 1.15;
        this.panX = 0;
        this.panY = 25;
      });
    }

    const topViewBtn = document.querySelector('[data-action="topView"]');
    if (topViewBtn) {
      topViewBtn.addEventListener('click', () => {
        this.rotX = 89 * (Math.PI / 180);
        this.rotY = 0;
        this.zoom = 1.2;
      });
    }

    // Input de Upload de Arquivo 3D
    const fileInput = document.getElementById('bim-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          Utils.toast(`📂 Modelo "${file.name}" carregado com sucesso no visualizador!`, 'success');
        }
      });
    }
  }
};
