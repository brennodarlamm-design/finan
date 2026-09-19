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
  _lastRenderKey: '',
  renderStats: { faces: 0, culledMeshes: 0, triangleStride: 1 },

  // Elementos do Modelo 3D da Obra
  elements: [],
  renderedFaces: [],
  financialSnapshot: null,
  isExpanded: false,
  sectionMode: 'none', // none | x | z
  sectionPosition: 0,
  disciplineFilter: 'all',
  colorMode: 'material', // material | status
  modelVersions: [],
  coordinationIssues: [],
  modelSource: 'procedural',
  importedModel: null,
  activeModelDocId: null,
  clashAnalysis: null,
  clashResults: [],
  clashHighlightIds: [],
  _modelLoadToken: 0,
  _escapeHandler: null,

  /**
   * Inicializa e renderiza o visualizador dentro do container da Obra
   */
  render(containerId, obraId) {
    this.containerId = containerId;
    this.activeObraId = obraId;
    this.modelSource = 'procedural';
    this.importedModel = null;
    this.activeModelDocId = null;
    this.clashAnalysis = null;
    this.clashResults = [];
    this.clashHighlightIds = [];
    this.currentFloor = 'all';
    this.disciplineFilter = 'all';
    const container = document.getElementById(containerId);
    if (!container) return;

    const obra = (typeof DB !== 'undefined' && DB.getById('clientes', obraId)) || {
      nome: 'Obra Modelo',
      area_construida: 240,
      pavimentos: 2,
      padrao: 'Normal'
    };
    const snapshot = this._getOperationalSnapshot(obraId);
    this.financialSnapshot = snapshot;
    this.modelVersions = this._loadModelVersions();
    this.coordinationIssues = this._loadCoordinationIssues();

    container.innerHTML = `
      <div class="bim-viewer-layout" style="display:flex;flex-direction:column;gap:16px;">
        <!-- Barra de Ferramentas Superior do BIM -->
        <div class="bim-toolbar" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;background:#0A1108;border:1px solid #243518;border-radius:10px;padding:12px 16px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.25rem;">🏢</span>
            <div>
              <div style="font-size:.9rem;font-weight:800;color:#F0EAD6;">Modelo 3D BIM Arquitetônico &amp; Orçamento</div>
              <div style="font-size:.75rem;color:#94A3B8;">${Utils.escapeHtml(obra.nome || 'Obra')} &middot; ${obra.area_construida || 240} m² &middot; ${obra.pavimentos || 2} pavimentos</div>
              <div style="display:flex;align-items:center;gap:7px;margin-top:4px;">
                <span id="bim-model-source-label" style="font-size:.62rem;color:#C6FF00;font-weight:800;">MAQUETE PARAMÉTRICA</span>
                <button type="button" data-action="restoreProcedural" id="bim-restore-procedural" style="display:none;background:transparent;border:none;color:#94A3B8;font-size:.62rem;cursor:pointer;text-decoration:underline;">voltar à maquete</button>
              </div>
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
              <button type="button" class="bim-view-btn" data-action="toggleExpanded" title="Expandir visualizador" style="padding:5px 10px;font-size:.75rem;border:none;background:transparent;color:#F0EAD6;cursor:pointer;font-weight:700;">⛶ Expandir</button>
            </div>

            <div class="btn-group" style="display:inline-flex;background:#142210;border-radius:6px;border:1px solid #243518;padding:2px;align-items:center;">
              <button type="button" class="bim-section-btn" data-section="none" style="padding:5px 9px;font-size:.72rem;border:none;background:#C6FF00;color:#000;border-radius:4px;cursor:pointer;font-weight:800;">Inteiro</button>
              <button type="button" class="bim-section-btn" data-section="x" style="padding:5px 9px;font-size:.72rem;border:none;background:transparent;color:#F0EAD6;border-radius:4px;cursor:pointer;font-weight:700;">Corte X</button>
              <button type="button" class="bim-section-btn" data-section="z" style="padding:5px 9px;font-size:.72rem;border:none;background:transparent;color:#F0EAD6;border-radius:4px;cursor:pointer;font-weight:700;">Corte Z</button>
              <input id="bim-section-range" type="range" min="-120" max="120" step="5" value="0" title="Posição do plano de corte" disabled style="width:90px;margin:0 5px;accent-color:#C6FF00;opacity:.45;">
            </div>

            <div class="btn-group" style="display:inline-flex;background:#142210;border-radius:6px;border:1px solid #243518;padding:2px;align-items:center;">
              <select id="bim-discipline-filter" title="Filtrar disciplina BIM" style="background:#142210;color:#F0EAD6;border:none;padding:5px 7px;font-size:.72rem;font-weight:700;outline:none;">
                <option value="all">Todas disciplinas</option>
                <option value="estrutural">Estrutural</option>
                <option value="arquitetura">Arquitetura</option>
                <option value="hidraulica">Hidráulica</option>
                <option value="eletrica">Elétrica</option>
                <option value="mecanica">Mecânica / HVAC</option>
              </select>
              <button type="button" class="bim-color-btn" data-color-mode="material" style="padding:5px 8px;font-size:.70rem;border:none;background:#C6FF00;color:#000;border-radius:4px;cursor:pointer;font-weight:800;">Materiais</button>
              <button type="button" class="bim-color-btn" data-color-mode="status" style="padding:5px 8px;font-size:.70rem;border:none;background:transparent;color:#F0EAD6;border-radius:4px;cursor:pointer;font-weight:700;">Status</button>
            </div>

            <button type="button" class="btn-action" data-action="runClashDetection" style="font-size:.72rem;padding:6px 10px;background:rgba(127,73,184,.12);border-color:rgba(167,139,250,.35);color:#C4B5FD;font-weight:800;">
              ⚡ Interferências
            </button>

            <label class="btn-action" style="cursor:pointer;margin:0;font-size:.75rem;padding:6px 12px;background:rgba(198,255,0,.1);border:1px solid rgba(198,255,0,.3);color:#C6FF00;border-radius:6px;font-weight:700;">
              <span>📁 Importar 3D (.obj / .ifc)</span>
              <input type="file" id="bim-file-input" accept=".obj,.ifc,.gltf,.glb" style="display:none;" />
            </label>
          </div>
        </div>

        ${this._renderOperationalSummaryHtml(snapshot)}

        <!-- Área Principal 3D e Painel Lateral de Custos -->
        <div class="bim-main-grid" style="display:grid;grid-template-columns:1fr 340px;gap:16px;">
          <!-- Canvas 3D -->
          <div class="bim-canvas-wrap" style="position:relative;background:#070B06;border:1px solid #243518;border-radius:12px;overflow:hidden;min-height:560px;display:flex;align-items:center;justify-content:center;">
            <canvas id="bim-canvas" style="width:100%;height:100%;display:block;cursor:grab;touch-action:none;"></canvas>

            <!-- Seletor Flutuante de Pavimentos (Canto Superior Esquerdo) -->
            ${this._renderFloorButtonsHtml(obra)}

            <!-- Dica de Interação de Câmera -->
            <div style="position:absolute;bottom:14px;left:16px;font-size:.72rem;color:#94A3B8;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);padding:6px 12px;border-radius:6px;border:1px solid #243518;pointer-events:none;">
              🖱️ Clique e arraste para girar 360° &middot; Scroll para Zoom &middot; Clique em qualquer parte da casa para inspecionar custos
            </div>
            <div id="bim-status-legend" style="position:absolute;right:14px;bottom:14px;display:none;gap:8px;flex-wrap:wrap;background:rgba(0,0,0,.78);border:1px solid #243518;border-radius:7px;padding:6px 9px;font-size:.62rem;color:#CBD5E1;pointer-events:none;">
              <span>● <b style="color:#64748B;">Não iniciado</b></span>
              <span>● <b style="color:#F59E0B;">Em execução</b></span>
              <span>● <b style="color:#22C55E;">Concluído</b></span>
              <span>● <b style="color:#EF4444;">Pendência</b></span>
            </div>
          </div>

          <!-- Painel Lateral de Inspeção de Custos & SINAPI -->
          <div id="bim-element-details" style="background:#0F1A0E;border:1px solid #243518;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:14px;">
            ${this._renderElementDetailsHtml(this.elements[1] || this.elements[0], obra)}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.8fr);gap:12px;" class="bim-bottom-grid">
          <div id="bim-model-versions">${this._renderModelVersionsHtml()}</div>
          <div id="bim-coordination-panel">${this._renderCoordinationHtml()}</div>
        </div>
        <div id="bim-clash-panel">${this._renderClashPanelHtml()}</div>
      </div>
    `;

    this._setup3DCanvas();
    this._generateParametricBuilding(obra);
    this._applyOperationalData(snapshot);
    this.selectedElement = this.elements[1] || this.elements[0];
    const detailsContainer = document.getElementById('bim-element-details');
    if (detailsContainer) {
      detailsContainer.innerHTML = this._renderElementDetailsHtml(this.selectedElement, obra);
    }
    this._bindEvents();
    this._hydrateLatestModelVersion();
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
      discipline: 'estrutural',
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
      discipline: 'arquitetura estrutural',
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
      discipline: 'arquitetura estrutural',
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
      discipline: 'arquitetura',
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
    this._lastRenderKey = '';
    render();
  },

  _sceneRenderKey(w, h) {
    const first = this.elements?.[0]?.id || '';
    const last = this.elements?.[this.elements.length - 1]?.id || '';
    const progress = (this.elements || []).reduce((sum, elem) => sum + Number(elem.executadoPct || 0), 0);
    return [
      w, h,
      this.rotX.toFixed(5), this.rotY.toFixed(5), this.zoom.toFixed(4),
      Math.round(this.panX * 10) / 10, Math.round(this.panY * 10) / 10,
      this.currentFloor, this.disciplineFilter, this.sectionMode, Math.round(Number(this.sectionPosition || 0) * 10) / 10,
      this.colorMode, this.viewMode, this.selectedElement?.id || '',
      (this.clashHighlightIds || []).join(','),
      this.isDragging ? 1 : 0,
      this.modelSource, this.activeModelDocId || '',
      this.elements?.length || 0, first, last,
      Number(this.importedModel?.triangleCount || 0),
      Math.round(progress * 100) / 100
    ].join('|');
  },

  _triangleRenderStride() {
    if (!this.isDragging) return 1;
    const total = Number(this.importedModel?.triangleCount || 0);
    if (total > 120000) return 4;
    if (total > 60000) return 2;
    return 1;
  },

  _meshVisibleInViewport(mesh, cx, cy, w, h) {
    const x=Number(mesh?.x),y=Number(mesh?.y),z=Number(mesh?.z);
    const mw=Number(mesh?.w),mh=Number(mesh?.h),md=Number(mesh?.d);
    if (![x,y,z,mw,mh,md].every(Number.isFinite)) return true;
    const corners=[
      [x,y,z],[x+mw,y,z],[x,y+mh,z],[x+mw,y+mh,z],
      [x,y,z+md],[x+mw,y,z+md],[x,y+mh,z+md],[x+mw,y+mh,z+md]
    ].map(([px,py,pz])=>this._project3D(px,py,pz));
    const minX=Math.min(...corners.map(p=>p.x))+cx,maxX=Math.max(...corners.map(p=>p.x))+cx;
    const minY=Math.min(...corners.map(p=>p.y))+cy,maxY=Math.max(...corners.map(p=>p.y))+cy;
    const margin=80;
    return !(maxX < -margin || minX > w + margin || maxY < -margin || minY > h + margin);
  },

  /**
   * Desenha a cena 3D com ordenação de profundidade (Painter's Algorithm)
   */
  _drawScene() {
    if (!this.ctx || !this.canvas) return;
    const w = this.canvas.parentElement.clientWidth;
    const h = this.canvas.parentElement.clientHeight;
    const renderKey = this._sceneRenderKey(w, h);
    if (renderKey === this._lastRenderKey) return;
    this._lastRenderKey = renderKey;
    this.ctx.clearRect(0, 0, w, h);

    const cx = w / 2 + this.panX;
    const cy = h / 2 + this.panY;
    const triangleStride = this._triangleRenderStride();
    let culledMeshes = 0;

    // Desenhar Grid de Terreno / Canteiro
    this._drawGroundGrid(cx, cy);

    // Filtrar elementos do pavimento ativo
    const visibleElements = this.elements.filter(elem => {
      const floorOk = this.currentFloor === 'all' || elem.floor === this.currentFloor;
      const disciplineOk = this.disciplineFilter === 'all' || String(elem.discipline || '').includes(this.disciplineFilter);
      return floorOk && disciplineOk;
    });

    // Gera as faces poligonais 3D de todas as peças
    const faces = [];
    visibleElements.forEach(elem => {
      const isSelected = this.selectedElement?.id === elem.id || this.clashHighlightIds.includes(elem.id);
      const meshes = (elem.meshes || []).filter(mesh => this._meshPassesSection(mesh));
      meshes.forEach(mesh => {
        if (!this._meshVisibleInViewport(mesh, cx, cy, w, h)) {
          culledMeshes++;
          return;
        }
        const displayColor = this.colorMode === 'status' ? this._statusColorForElement(elem) : mesh.color;
        if (mesh.type === 'box') {
          faces.push(...this._createBoxFaces(mesh, displayColor, elem.id, isSelected, mesh));
        } else if (mesh.type === 'triangles') {
          faces.push(...this._createTriangleFaces(mesh, displayColor, elem.id, isSelected, { cx, cy, w, h, stride: triangleStride }));
        } else if (mesh.type === 'roof_gable') {
          const roofMesh = this.colorMode === 'status'
            ? { ...mesh, colorLeft: displayColor, colorRight: displayColor, colorGable: displayColor, colorRidge: displayColor }
            : mesh;
          faces.push(...this._createRoofGableFaces(roofMesh, elem.id, isSelected));
        }
      });
    });

    // Ordenar faces por profundidade Z projetada (Z-sort)
    faces.sort((a, b) => b.avgZ - a.avgZ);
    this.renderedFaces = faces;
    this.renderStats = { faces: faces.length, culledMeshes, triangleStride };

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
   * Converte triângulos importados (OBJ/IFC/GLTF/GLB) em faces do renderer 2D.
   * O corte X/Z é aplicado por triângulo para não ocultar o elemento inteiro.
   */
  _createTriangleFaces(mesh, color, elemId, isSelected, viewport = null) {
    const triangles = Array.isArray(mesh?.triangles) ? mesh.triangles : [];
    const faces = [];
    const stride = Math.max(1, Number(viewport?.stride || 1));
    for (let triIndex = 0; triIndex < triangles.length; triIndex += stride) {
      const tri = triangles[triIndex];
      if (!Array.isArray(tri) || tri.length !== 3) continue;
      const centerX = tri.reduce((s,p)=>s+Number(p.x||0),0)/3;
      const centerZ = tri.reduce((s,p)=>s+Number(p.z||0),0)/3;
      if (this.sectionMode === 'x' && centerX > this.sectionPosition) continue;
      if (this.sectionMode === 'z' && centerZ > this.sectionPosition) continue;

      const a=tri[0], b=tri[1], c=tri[2];
      const ux=b.x-a.x, uy=b.y-a.y, uz=b.z-a.z;
      const vx=c.x-a.x, vy=c.y-a.y, vz=c.z-a.z;
      const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
      const nlen=Math.hypot(nx,ny,nz)||1;
      const light=Math.max(.42,Math.min(1,.72 + (ny/nlen)*.22 + (nz/nlen)*.08));
      const pts=tri.map(p=>this._project3D(p.x,p.y,p.z));
      if (viewport) {
        const minX=Math.min(...pts.map(p=>p.x))+viewport.cx,maxX=Math.max(...pts.map(p=>p.x))+viewport.cx;
        const minY=Math.min(...pts.map(p=>p.y))+viewport.cy,maxY=Math.max(...pts.map(p=>p.y))+viewport.cy;
        const margin=24;
        if (maxX < -margin || minX > viewport.w + margin || maxY < -margin || minY > viewport.h + margin) continue;
      }
      faces.push({
        pts,
        avgZ:pts.reduce((s,p)=>s+p.z,0)/3,
        color:color || mesh.color || '#94A3B8',
        light,
        elemId,
        isSelected,
        isImported:true
      });
    }
    return faces;
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

    const isImported = Boolean(elem.importedProperties);
    const orc = Number(elem.orcado || 0);
    const real = Number(elem.realizado || 0);
    const saldo = orc - real;
    const pct = Number(elem.executadoPct || 0);
    const progressLabel = elem.progressLabel || 'Avanço medido da obra';
    const sourceLabel = elem.dataSource || 'Dados vinculados à obra';
    const recent = this._recentLancamentosForElement(elem).slice(0, 3);
    const props = this._getElementProperties(elem);

    return `
      <div style="display:flex;align-items:center;gap:10px;border-bottom:1px solid #243518;padding-bottom:14px;">
        <span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${elem.color};"></span>
        <div>
          <h4 style="font-size:.92rem;font-weight:800;color:#FFFFFF;margin:0;">${Utils.escapeHtml(elem.name)}</h4>
          <span style="font-size:.72rem;color:#94A3B8;">${Utils.escapeHtml(elem.category)}</span>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;">
        ${isImported ? `
        <div style="background:#0A1108;border:1px solid #243518;border-radius:8px;padding:12px 14px;">
          <span style="font-size:.70rem;font-weight:700;color:#94A3B8;text-transform:uppercase;">Elemento do modelo importado</span>
          <div style="font-size:.82rem;font-weight:800;color:#C6FF00;margin-top:3px;">${Utils.escapeHtml(elem.importedProperties?.ifcClass || elem.category || 'Geometria 3D')}</div>
          <p style="font-size:.70rem;color:#94A3B8;margin:5px 0 0;line-height:1.4;">Custos não são rateados artificialmente por elemento importado. O resumo financeiro da obra continua usando os dados oficiais do FinGo.</p>
        </div>` : `
        <div style="background:#0A1108;border:1px solid #243518;border-radius:8px;padding:12px 14px;">
          <span style="font-size:.70rem;font-weight:700;color:#94A3B8;text-transform:uppercase;">Item SINAPI Oficial</span>
          <div style="font-size:.85rem;font-weight:800;color:#C6FF00;margin-top:2px;">Código ${Utils.escapeHtml(elem.sinapiCode || '—')}</div>
          <p style="font-size:.75rem;color:#CBD5E1;margin:4px 0 0;line-height:1.4;">${Utils.escapeHtml(elem.sinapiDesc || 'Sem item SINAPI associado.')}</p>
        </div>`}

        ${isImported ? '' : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="background:#0A1108;border:1px solid #243518;border-radius:8px;padding:10px 12px;">
            <span style="font-size:.68rem;color:#94A3B8;">Orçado</span>
            <div style="font-size:.90rem;font-weight:800;color:#F0EAD6;font-variant-numeric:tabular-nums;">${Utils.fmt.currency(orc)}</div>
          </div>
          <div style="background:#0A1108;border:1px solid #243518;border-radius:8px;padding:10px 12px;">
            <span style="font-size:.68rem;color:#94A3B8;">Realizado</span>
            <div style="font-size:.90rem;font-weight:800;color:#E8C84A;font-variant-numeric:tabular-nums;">${Utils.fmt.currency(real)}</div>
          </div>
        </div>`}

        ${isImported ? '' : `<div style="background:#0A1108;border:1px solid #243518;border-radius:8px;padding:12px 14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:.72rem;font-weight:700;color:#94A3B8;">${Utils.escapeHtml(progressLabel)}</span>
            <span style="font-size:.82rem;font-weight:900;color:#C6FF00;">${pct}%</span>
          </div>
          <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:#C6FF00;border-radius:3px;"></div>
          </div>
        </div>`}

        <div style="font-size:.68rem;color:#64748B;">Fonte: ${Utils.escapeHtml(sourceLabel)}</div>

        <details open style="background:#0A1108;border:1px solid #243518;border-radius:8px;padding:10px 12px;">
          <summary style="cursor:pointer;font-size:.70rem;font-weight:800;color:#C6FF00;text-transform:uppercase;">Propriedades BIM & Quantitativos</summary>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 10px;margin-top:10px;font-size:.70rem;">
            <div><span style="color:#64748B;">Classe IFC</span><br><strong style="color:#E2E8F0;">${Utils.escapeHtml(props.ifcClass)}</strong></div>
            <div><span style="color:#64748B;">Disciplina</span><br><strong style="color:#E2E8F0;">${Utils.escapeHtml(props.discipline)}</strong></div>
            ${elem.importedProperties?.storeyName ? `<div><span style="color:#64748B;">Pavimento IFC</span><br><strong style="color:#E2E8F0;">${Utils.escapeHtml(elem.importedProperties.storeyName)}</strong></div>` : ''}
            <div><span style="color:#64748B;">Material</span><br><strong style="color:#E2E8F0;">${Utils.escapeHtml(props.material)}</strong></div>
            <div><span style="color:#64748B;">Status</span><br><strong style="color:${this._statusColorForElement(elem)};">${Utils.escapeHtml(props.status)}</strong></div>
            <div><span style="color:#64748B;">Dimensão X</span><br><strong style="color:#E2E8F0;">${props.width}</strong></div>
            <div><span style="color:#64748B;">Dimensão Y</span><br><strong style="color:#E2E8F0;">${props.height}</strong></div>
            <div><span style="color:#64748B;">Dimensão Z</span><br><strong style="color:#E2E8F0;">${props.depth}</strong></div>
            <div><span style="color:#64748B;">Subelementos</span><br><strong style="color:#E2E8F0;">${props.meshCount}</strong></div>
            <div><span style="color:#64748B;">${isImported ? 'Triângulos' : 'Volume paramétrico'}</span><br><strong style="color:#E2E8F0;">${isImported ? props.triangleCount : props.volume}</strong></div>
            <div><span style="color:#64748B;">ID BIM</span><br><strong style="color:#E2E8F0;">${Utils.escapeHtml(elem.id)}</strong></div>
            ${elem.importedProperties?.globalId ? `<div style="grid-column:1/-1;"><span style="color:#64748B;">IFC GlobalId</span><br><strong style="color:#E2E8F0;word-break:break-all;">${Utils.escapeHtml(elem.importedProperties.globalId)}</strong></div>` : ''}
            ${elem.importedProperties?.stepId ? `<div><span style="color:#64748B;">STEP ID</span><br><strong style="color:#E2E8F0;">#${Utils.escapeHtml(String(elem.importedProperties.stepId))}</strong></div>` : ''}
            ${elem.importedProperties?.geometryQuality ? `<div><span style="color:#64748B;">Geometria</span><br><strong style="color:${elem.importedProperties.geometryQuality === 'partial' ? '#F59E0B' : '#C6FF00'};">${Utils.escapeHtml(elem.importedProperties.geometryQuality)}</strong></div>` : ''}
            ${Array.isArray(elem.importedProperties?.geometryKinds) && elem.importedProperties.geometryKinds.length ? `<div style="grid-column:1/-1;"><span style="color:#64748B;">Representações IFC</span><br><strong style="color:#C4B5FD;">${Utils.escapeHtml(elem.importedProperties.geometryKinds.join(' + '))}</strong></div>` : ''}
            ${elem.importedProperties?.partialReason ? `<div style="grid-column:1/-1;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);padding:6px 8px;border-radius:6px;"><span style="color:#F59E0B;">Limitação geométrica</span><br><strong style="color:#FCD34D;">${Utils.escapeHtml(elem.importedProperties.partialReason)}</strong></div>` : ''}
          </div>
          ${this._renderIfcPropertySets(elem)}
          <div style="font-size:.62rem;color:#64748B;margin-top:8px;">${isImported ? 'Dimensões exibidas na escala normalizada do viewer. IDs e Property Sets IFC são preservados do arquivo original quando disponíveis.' : 'Dimensões e volume seguem a escala paramétrica do modelo atual.'}</div>
        </details>

        ${isImported ? '' : `<div style="background:#0A1108;border:1px solid #243518;border-radius:8px;padding:10px 12px;">
          <div style="font-size:.70rem;font-weight:800;color:#94A3B8;text-transform:uppercase;margin-bottom:7px;">Lançamentos recentes</div>
          ${recent.length ? recent.map(l => `
            <div style="display:grid;grid-template-columns:1fr auto;gap:8px;padding:6px 0;border-top:1px solid rgba(148,163,184,.12);">
              <div style="min-width:0;">
                <div style="font-size:.72rem;color:#E2E8F0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escapeHtml(l.descricao || l.fornecedor_beneficiario || 'Lançamento')}</div>
                <div style="font-size:.64rem;color:#64748B;">${Utils.escapeHtml(l.data_vencimento || l.data || '')}</div>
              </div>
              <strong style="font-size:.72rem;color:${l.tipo === 'receita' ? '#C6FF00' : '#F59E0B'};">${Utils.fmt.currency(Number(l.valor || 0))}</strong>
            </div>`).join('') : '<div style="font-size:.72rem;color:#64748B;">Nenhum lançamento classificado para esta etapa.</div>'}
        </div>

        <button type="button" class="btn-action" data-action="filterLancamentos" style="width:100%;text-align:center;justify-content:center;padding:9px 12px;font-size:.78rem;background:rgba(198,255,0,0.1);color:#C6FF00;border-color:rgba(198,255,0,0.3);margin-top:4px;font-weight:700;">
          📊 Abrir Lançamentos da Obra
        </button>`}
      </div>
    `;
  },


  _renderIfcPropertySets(elem) {
    const psets = elem?.importedProperties?.psets;
    if (!psets || typeof psets !== 'object' || !Object.keys(psets).length) return '';
    const groups = Object.entries(psets).slice(0, 6);
    return `
      <details style="margin-top:9px;border-top:1px solid rgba(148,163,184,.12);padding-top:8px;">
        <summary style="cursor:pointer;font-size:.68rem;color:#A78BFA;font-weight:800;">Property Sets IFC (${groups.length})</summary>
        <div style="margin-top:7px;display:flex;flex-direction:column;gap:7px;">
          ${groups.map(([name, values]) => `
            <div>
              <div style="font-size:.64rem;color:#C4B5FD;font-weight:800;">${Utils.escapeHtml(name)}</div>
              ${Object.entries(values || {}).slice(0, 8).map(([k,v]) => `<div style="display:flex;justify-content:space-between;gap:10px;font-size:.62rem;color:#94A3B8;padding:2px 0;"><span>${Utils.escapeHtml(k)}</span><strong style="color:#CBD5E1;text-align:right;">${Utils.escapeHtml(String(v ?? '—'))}</strong></div>`).join('')}
            </div>`).join('')}
        </div>
      </details>
    `;
  },

  _statusColorForElement(elem) {
    const hasOpenIssue = (this.coordinationIssues || []).some(issue =>
      issue.status !== 'resolvida' && issue.bim_element_id && issue.bim_element_id === elem?.id
    );
    if (hasOpenIssue) return '#EF4444';
    const pct = Number(elem?.executadoPct || 0);
    if (pct >= 100) return '#22C55E';
    if (pct > 0) return '#F59E0B';
    return '#64748B';
  },

  _meshPassesSection(mesh) {
    if (!mesh || this.sectionMode === 'none') return true;
    const centerX = Number(mesh.x || 0) + Number(mesh.w || 0) / 2;
    const centerZ = Number(mesh.z || 0) + Number(mesh.d || 0) / 2;
    if (this.sectionMode === 'x') return centerX <= this.sectionPosition;
    if (this.sectionMode === 'z') return centerZ <= this.sectionPosition;
    return true;
  },

  _getElementProperties(elem) {
    const meshes = Array.isArray(elem?.meshes) ? elem.meshes : [];
    if (!meshes.length) return { ifcClass:'IFCBUILDINGELEMENT', material:'—', width:'0 u', height:'0 u', depth:'0 u', meshCount:0, volume:'0 u³' };

    const bounds = { minX:Infinity, minY:Infinity, minZ:Infinity, maxX:-Infinity, maxY:-Infinity, maxZ:-Infinity };
    let volume = 0;
    const materials = new Set();

    meshes.forEach(mesh => {
      const x = Number(mesh.x || 0), y = Number(mesh.y || 0), z = Number(mesh.z || 0);
      const w = Number(mesh.w || 0), h = Number(mesh.h || 0), d = Number(mesh.d || 0);
      bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x + w);
      bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y + h);
      bounds.minZ = Math.min(bounds.minZ, z); bounds.maxZ = Math.max(bounds.maxZ, z + d);
      if (mesh.type === 'roof_gable') volume += Math.abs(w * d * h * 0.5);
      else if (mesh.type !== 'triangles') volume += Math.abs(w * h * d);
      if (mesh.isGlass) materials.add('Vidro');
      else if (mesh.isBrick) materials.add('Alvenaria');
      else if (mesh.isFrame) materials.add('Alumínio / Esquadria');
      else if (/madeira/i.test(mesh.name || '')) materials.add('Madeira');
      else if (/telha/i.test(mesh.name || '')) materials.add('Cobertura');
      else if (/concreto|sapata|viga|pilar|laje|baldrame/i.test(mesh.name || '')) materials.add('Concreto armado');
    });

    const imported = elem.importedProperties || null;
    const ifcClass = imported?.ifcClass || (elem.floor === 'fundacao' ? 'IFCFOOTING / IFCBEAM'
      : elem.floor === 'cobertura' ? 'IFCROOF'
      : elem.floor === 'pav1' ? 'IFCSLAB / IFCWALL'
      : 'IFCWALL / IFCCOLUMN');

    const fmt = n => Number.isFinite(n) ? `${Math.round(n * 10) / 10} u` : '0 u';
    return {
      ifcClass,
      discipline: String(elem.discipline || 'geral').replace(/\b\w/g, c => c.toUpperCase()),
      material: materials.size ? Array.from(materials).slice(0, 3).join(', ') : (elem.category || 'Material não classificado'),
      status: this._statusColorForElement(elem) === '#EF4444' ? 'Com pendência'
        : Number(elem.executadoPct || 0) >= 100 ? 'Concluído'
        : Number(elem.executadoPct || 0) > 0 ? 'Em execução' : 'Não iniciado',
      width: fmt(bounds.maxX - bounds.minX),
      height: fmt(bounds.maxY - bounds.minY),
      depth: fmt(bounds.maxZ - bounds.minZ),
      meshCount: meshes.length,
      triangleCount: meshes.reduce((sum,mesh)=>sum + (Array.isArray(mesh.triangles) ? mesh.triangles.length : 0), 0),
      volume: imported ? '—' : `${Math.round(volume)} u³`
    };
  },

  _loadModelVersions() {
    try {
      if (typeof Documentos === 'undefined' || typeof Documentos.listar !== 'function' || !this.activeObraId) return [];
      return Documentos.listar('obra', this.activeObraId)
        .filter(doc => doc.subtipo === 'bim_model' || doc.categoria === 'bim_model')
        .sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
    } catch {
      return [];
    }
  },

  _setModelSourceUi() {
    const label = document.getElementById('bim-model-source-label');
    const restore = document.getElementById('bim-restore-procedural');
    if (label) {
      const imported = this.modelSource === 'imported';
      label.textContent = imported
        ? `MODELO IMPORTADO · ${String(this.importedModel?.format || '').toUpperCase()} · ${Number(this.importedModel?.triangleCount || 0).toLocaleString('pt-BR')} TRIÂNGULOS`
        : 'MAQUETE PARAMÉTRICA';
      label.style.color = imported ? '#A78BFA' : '#C6FF00';
    }
    if (restore) restore.style.display = this.modelSource === 'imported' ? 'inline' : 'none';
  },

  _applyImportedScene(scene, docId = null) {
    if (!scene?.elements?.length) throw new Error('Cena importada sem elementos renderizáveis.');
    this.modelSource = 'imported';
    this.importedModel = scene;
    this.activeModelDocId = docId || null;
    this.clashAnalysis = null;
    this.clashResults = [];
    this.clashHighlightIds = [];
    this.elements = scene.elements;
    this.currentFloor = 'all';
    this.disciplineFilter = 'all';
    this.selectedElement = this.elements[0] || null;
    this.rotX = 24 * (Math.PI / 180);
    this.rotY = -35 * (Math.PI / 180);
    this.zoom = 1.15;
    this.panX = 0;
    this.panY = 25;
    this._setModelSourceUi();
    this._refreshFloorButtons();
    this._refreshSelectedElementUi();
  },

  _restoreProceduralModel() {
    const obra = (typeof DB !== 'undefined' && DB.getById('clientes', this.activeObraId)) || {};
    this.modelSource = 'procedural';
    this.importedModel = null;
    this.activeModelDocId = null;
    this.clashAnalysis = null;
    this.clashResults = [];
    this.clashHighlightIds = [];
    this._generateParametricBuilding(obra);
    this._applyOperationalData(this.financialSnapshot || this._getOperationalSnapshot(this.activeObraId));
    this.selectedElement = this.elements[1] || this.elements[0] || null;
    this.currentFloor = 'all';
    this.disciplineFilter = 'all';
    this._setModelSourceUi();
    this._refreshFloorButtons();
    this._refreshSelectedElementUi();
  },

  _refreshSelectedElementUi() {
    const detailsContainer = document.getElementById('bim-element-details');
    if (detailsContainer && this.selectedElement) {
      const obra = (typeof DB !== 'undefined' && DB.getById('clientes', this.activeObraId)) || {};
      detailsContainer.innerHTML = this._renderElementDetailsHtml(this.selectedElement, obra);
    }
    const coord = document.getElementById('bim-coordination-panel');
    if (coord) {
      coord.innerHTML = this._renderCoordinationHtml();
      this._bindCoordinationEvents();
    }
    const clash = document.getElementById('bim-clash-panel');
    if (clash) {
      clash.innerHTML = this._renderClashPanelHtml();
      this._bindClashEvents();
    }
  },

  _renderClashPanelHtml() {
    const imported = this.modelSource === 'imported';
    const eligible = imported && this.importedModel?.clashEligible !== false;
    const results = Array.isArray(this.clashResults) ? this.clashResults : [];
    const analysis = this.clashAnalysis;

    return `
      <div style="background:#0F1A0E;border:1px solid #243518;border-radius:10px;padding:12px 14px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
          <div>
            <div style="font-size:.76rem;font-weight:900;color:#F0F0E8;">Análise de Interferências</div>
            <div style="font-size:.66rem;color:#64748B;">BVH + interseção triângulo-triângulo em geometria importada.</div>
          </div>
          <button type="button" class="btn-action" data-action="runClashDetection" ${eligible ? '' : 'disabled'} style="font-size:.70rem;padding:6px 9px;color:${eligible ? '#C4B5FD' : '#64748B'};border-color:rgba(167,139,250,.30);">
            ⚡ ${analysis ? 'Reanalisar' : 'Analisar geometria'}
          </button>
        </div>

        ${!imported ? '<div style="font-size:.70rem;color:#64748B;padding:10px 0;">Importe ou abra uma versão IFC/OBJ/GLTF/GLB para executar a análise geométrica.</div>' : ''}
        ${imported && !eligible ? '<div style="font-size:.70rem;color:#F59E0B;padding:10px 0;">Este modelo contém geometria IFC parcial/booleana não tessellada integralmente. Clash autoritativo permanece bloqueado para evitar falso positivo.</div>' : ''}

        ${analysis ? `
          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:9px;font-size:.65rem;color:#94A3B8;">
            <span><b style="color:#F0F0E8;">${results.length}</b> interferência(s) confirmada(s)</span>
            <span><b style="color:#F0F0E8;">${analysis.eligibleElements || 0}</b> elementos analisados</span>
            <span><b style="color:#F0F0E8;">${Number(analysis.comparisons || 0).toLocaleString('pt-BR')}</b> comparações de triângulos</span>
            ${analysis.truncated ? '<span style="color:#F59E0B;">limite de processamento atingido</span>' : ''}
          </div>
        ` : ''}

        <div style="margin-top:8px;max-height:280px;overflow:auto;">
          ${results.length ? results.slice(0, 50).map((clash, idx) => `
            <div style="display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:8px 0;border-top:1px solid rgba(148,163,184,.12);">
              <div style="width:25px;height:25px;border-radius:6px;display:grid;place-items:center;background:rgba(239,68,68,.12);color:#EF4444;font-size:.66rem;font-weight:900;">${idx+1}</div>
              <div style="min-width:0;">
                <div style="font-size:.70rem;color:#E2E8F0;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escapeHtml(clash.elementAName)} × ${Utils.escapeHtml(clash.elementBName)}</div>
                <div style="font-size:.61rem;color:#64748B;">${Utils.escapeHtml(clash.disciplineA)} × ${Utils.escapeHtml(clash.disciplineB)} · ponto ${Math.round(clash.point.x*10)/10}, ${Math.round(clash.point.y*10)/10}, ${Math.round(clash.point.z*10)/10}</div>
              </div>
              <div style="display:flex;gap:5px;">
                <button type="button" class="btn-action" data-action="focusClash" data-clash-index="${idx}" style="font-size:.62rem;padding:4px 7px;">Ver</button>
                <button type="button" class="btn-action" data-action="issueFromClash" data-clash-index="${idx}" style="font-size:.62rem;padding:4px 7px;color:#F59E0B;">Pendência</button>
              </div>
            </div>`).join('') : (analysis && eligible ? '<div style="font-size:.70rem;color:#C6FF00;padding:10px 0;">Nenhuma interferência inter-disciplinar confirmada pelos triângulos suportados.</div>' : '')}
        </div>

        <div style="font-size:.61rem;color:#64748B;margin-top:8px;">Contatos coplanares e simples encostos por borda são ignorados. O resultado depende da completude geométrica da versão importada.</div>
      </div>
    `;
  },

  _bindClashEvents() {
    document.querySelectorAll('[data-action="runClashDetection"]').forEach(btn => {
      btn.addEventListener('click', () => this._runClashDetection());
    });
    document.querySelectorAll('[data-action="focusClash"]').forEach(btn => {
      btn.addEventListener('click', e => this._focusClash(Number(e.currentTarget.getAttribute('data-clash-index'))));
    });
    document.querySelectorAll('[data-action="issueFromClash"]').forEach(btn => {
      btn.addEventListener('click', e => this._createIssueFromClash(Number(e.currentTarget.getAttribute('data-clash-index'))));
    });
  },

  async _runClashDetection() {
    if (this.modelSource !== 'imported') return Utils.toast('Abra um modelo importado antes de analisar interferências.', 'warning');
    if (this.importedModel?.clashEligible === false) return Utils.toast('Clash bloqueado: a geometria IFC desta versão é parcial.', 'warning');
    if (typeof BIMClashEngine === 'undefined') return Utils.toast('Motor de interferências indisponível.', 'error');

    Utils.toast('Analisando interferências geométricas...', 'info');
    await new Promise(resolve => requestAnimationFrame(resolve));
    const analysis = BIMClashEngine.detect(this.elements, {
      maxClashes: 50,
      maxComparisons: 300000,
      interDisciplineOnly: true
    });
    this.clashAnalysis = analysis;
    this.clashResults = analysis.clashes || [];
    this.clashHighlightIds = [];
    const host = document.getElementById('bim-clash-panel');
    if (host) {
      host.innerHTML = this._renderClashPanelHtml();
      this._bindClashEvents();
    }
    Utils.toast(this.clashResults.length
      ? `${this.clashResults.length} interferência(s) confirmada(s).`
      : 'Nenhuma interferência inter-disciplinar confirmada.', this.clashResults.length ? 'warning' : 'success');
  },

  _focusClash(index) {
    const clash = this.clashResults?.[index];
    if (!clash) return;
    this.clashHighlightIds = [clash.elementAId, clash.elementBId];
    this.selectedElement = this.elements.find(e => e.id === clash.elementAId) || this.selectedElement;
    this._refreshSelectedElementUi();
  },

  _createIssueFromClash(index) {
    const clash = this.clashResults?.[index];
    if (!clash || typeof Documentos === 'undefined' || typeof Documentos.adicionar !== 'function') return;
    const existing = (this.coordinationIssues || []).find(issue =>
      issue.subtipo === 'bim_issue' &&
      issue.origem === 'clash_detection' &&
      ((issue.bim_element_id === clash.elementAId && issue.bim_element_b_id === clash.elementBId) ||
       (issue.bim_element_id === clash.elementBId && issue.bim_element_b_id === clash.elementAId)) &&
      issue.status !== 'resolvida'
    );
    if (existing) return Utils.toast('Já existe uma pendência aberta para esta interferência.', 'warning');

    Documentos.adicionar({
      entidade_tipo:'obra',
      entidade_id:this.activeObraId,
      titulo:`Interferência BIM — ${clash.elementAName} × ${clash.elementBName}`,
      subtipo:'bim_issue',
      categoria:'bim_coordination',
      origem:'clash_detection',
      status:'aberta',
      prioridade:'alta',
      bim_element_id:clash.elementAId,
      bim_element_nome:clash.elementAName,
      bim_element_b_id:clash.elementBId,
      bim_element_b_nome:clash.elementBName,
      clash_point:JSON.stringify(clash.point),
      clash_method:clash.method || 'triangle-bvh'
    });
    this._refreshCoordination();
    Utils.toast('Pendência criada a partir da interferência.', 'success');
  },

  async _loadModelDocument(docId, {silent=false} = {}) {
    const doc = this.modelVersions.find(v => String(v.id) === String(docId));
    if (!doc) throw new Error('Versão do modelo não encontrada.');
    if (typeof BIMGeometryImporter === 'undefined') throw new Error('Importador de geometria BIM indisponível.');
    if (typeof Documentos === 'undefined' || typeof Documentos.obterConteudo !== 'function') throw new Error('Módulo de documentos indisponível.');

    const token = ++this._modelLoadToken;
    if (!silent) Utils.toast('Carregando geometria versionada...', 'info');
    const content = await Documentos.obterConteudo(doc.id);
    if (!content) throw new Error('Conteúdo do modelo não está disponível.');
    const scene = await BIMGeometryImporter.importContent(content, doc.nome_arquivo || doc.titulo || 'modelo.glb', doc.tipo_mime);
    if (token !== this._modelLoadToken) return null;
    this._applyImportedScene(scene, doc.id);
    if (!silent) Utils.toast(`Modelo renderizado: ${scene.elements.length} elemento(s), ${scene.triangleCount.toLocaleString('pt-BR')} triângulos.`, 'success');
    return scene;
  },

  async _hydrateLatestModelVersion() {
    const latest = this.modelVersions?.[0];
    if (!latest || typeof BIMGeometryImporter === 'undefined') return;
    try {
      await this._loadModelDocument(latest.id, {silent:true});
    } catch (err) {
      console.warn('[FinGo BIM] Modelo versionado preservado, mas não pôde ser renderizado automaticamente:', err?.message || err);
    }
  },

  _compareLatestModelVersions() {
    const versions = Array.isArray(this.modelVersions) ? this.modelVersions : [];
    if (versions.length < 2) return null;
    const parse = doc => {
      try { return typeof doc.bim_metadata === 'string' ? JSON.parse(doc.bim_metadata) : (doc.bim_metadata || {}); } catch { return {}; }
    };
    const current = parse(versions[0]);
    const previous = parse(versions[1]);
    const delta = (a, b) => Number(a || 0) - Number(b || 0);
    return {
      format: String(current.format || '').toUpperCase(),
      sizeDelta: Number(versions[0].tamanho || 0) - Number(versions[1].tamanho || 0),
      elementDelta: delta(current.elements || current.faces || current.meshes, previous.elements || previous.faces || previous.meshes),
      storeyDelta: delta(current.storeys, previous.storeys),
      schemaChanged: Boolean(current.schema && previous.schema && current.schema !== previous.schema),
      currentSchema: current.schema || '',
      previousSchema: previous.schema || ''
    };
  },

  _renderModelVersionsHtml() {
    const versions = Array.isArray(this.modelVersions) ? this.modelVersions : [];
    const comparison = this._compareLatestModelVersions();
    return `
      <div style="background:#0F1A0E;border:1px solid #243518;border-radius:10px;padding:12px 14px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px;">
          <div>
            <div style="font-size:.76rem;font-weight:900;color:#F0F0E8;">Versões do modelo BIM</div>
            <div style="font-size:.66rem;color:#64748B;">Arquivos validados e vinculados à obra.</div>
          </div>
          <span style="font-size:.68rem;color:#C6FF00;font-weight:800;">${versions.length} versão(ões)</span>
        </div>
        ${comparison ? `<div style="display:flex;gap:10px;flex-wrap:wrap;padding:8px 0;border-top:1px solid rgba(148,163,184,.12);font-size:.64rem;color:#94A3B8;">
          <span>Comparação v${versions.length} × v${versions.length - 1}</span>
          <span style="color:${comparison.elementDelta ? '#F59E0B' : '#C6FF00'};">Elementos/malhas: ${comparison.elementDelta >= 0 ? '+' : ''}${comparison.elementDelta}</span>
          <span>Tamanho: ${comparison.sizeDelta >= 0 ? '+' : ''}${Math.round(comparison.sizeDelta / 1024)} KB</span>
          ${comparison.storeyDelta ? `<span>Pavimentos: ${comparison.storeyDelta >= 0 ? '+' : ''}${comparison.storeyDelta}</span>` : ''}
          ${comparison.schemaChanged ? `<span style="color:#F59E0B;">Schema: ${Utils.escapeHtml(comparison.previousSchema)} → ${Utils.escapeHtml(comparison.currentSchema)}</span>` : ''}
        </div>` : ''}
        ${versions.length ? versions.slice(0, 5).map((doc, idx) => {
          let meta = {};
          try { meta = typeof doc.bim_metadata === 'string' ? JSON.parse(doc.bim_metadata) : (doc.bim_metadata || {}); } catch {}
          return `<div style="display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:8px 0;border-top:1px solid rgba(148,163,184,.12);">
            <div style="width:26px;height:26px;border-radius:7px;background:rgba(198,255,0,.10);display:grid;place-items:center;color:#C6FF00;font-size:.68rem;font-weight:900;">v${versions.length - idx}</div>
            <div style="min-width:0;">
              <div style="font-size:.72rem;color:#E2E8F0;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escapeHtml(doc.nome_arquivo || doc.titulo || 'Modelo BIM')}</div>
              <div style="font-size:.62rem;color:#64748B;">${Utils.escapeHtml(String(meta.format || doc.bim_format || '').toUpperCase())} · ${Utils.escapeHtml(meta.schema || meta.summary || 'validado')} · ${Utils.escapeHtml(String(doc.criado_em || '').slice(0, 16).replace('T',' '))}</div>
            </div>
            <button type="button" class="btn-action" data-action="loadBimVersion" data-model-doc-id="${Utils.escapeHtml(doc.id)}" style="font-size:.62rem;padding:4px 7px;color:${String(doc.id) === String(this.activeModelDocId) ? '#000' : '#C6FF00'};background:${String(doc.id) === String(this.activeModelDocId) ? '#C6FF00' : 'transparent'};">${String(doc.id) === String(this.activeModelDocId) ? 'Em uso' : 'Abrir'}</button>
          </div>`;
        }).join('') : '<div style="font-size:.70rem;color:#64748B;padding:7px 0;">Nenhum IFC/OBJ/GLTF foi versionado nesta obra.</div>'}
      </div>
    `;
  },

  _refreshModelVersions() {
    this.modelVersions = this._loadModelVersions();
    const host = document.getElementById('bim-model-versions');
    if (host) {
      host.innerHTML = this._renderModelVersionsHtml();
      host.querySelectorAll('[data-action="loadBimVersion"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.getAttribute('data-model-doc-id');
          try {
            await this._loadModelDocument(id);
            this._refreshModelVersions();
          } catch (err) {
            Utils.toast(err?.message || 'Não foi possível abrir esta versão BIM.', 'error');
          }
        });
      });
    }
  },

  _bimMime(ext) {
    return {
      ifc: 'application/x-step',
      obj: 'model/obj',
      gltf: 'model/gltf+json',
      glb: 'model/gltf-binary'
    }[ext] || 'application/octet-stream';
  },

  async _inspectModelFile(file) {
    const ext = String(file?.name || '').split('.').pop().toLowerCase();
    const allowed = ['ifc','obj','gltf','glb'];
    if (!allowed.includes(ext)) throw new Error('Formato BIM/3D não suportado. Use IFC, OBJ, GLTF ou GLB.');
    if (Number(file.size || 0) > 15 * 1024 * 1024) throw new Error('O modelo excede o limite atual de 15 MB.');

    const meta = { format: ext, size: Number(file.size || 0), summary: 'arquivo validado' };

    if (ext === 'glb') {
      const buf = await file.slice(0, 12).arrayBuffer();
      const view = new Uint8Array(buf);
      const magic = String.fromCharCode(...view.slice(0, 4));
      if (magic !== 'glTF') throw new Error('Arquivo GLB inválido: assinatura glTF não encontrada.');
      meta.summary = 'container binário glTF';
      return meta;
    }

    const text = await file.text();
    if (ext === 'ifc') {
      if (!/ISO-10303-21/i.test(text) || !/IFCPROJECT/i.test(text)) throw new Error('Arquivo IFC inválido ou incompleto.');
      const schema = text.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i)?.[1] || 'IFC';
      const storeys = (text.match(/IFCBUILDINGSTOREY/gi) || []).length;
      const elements = (text.match(/=IFC(?:WALL|SLAB|BEAM|COLUMN|FOOTING|ROOF|DOOR|WINDOW|STAIR|MEMBER|PLATE)[A-Z0-9_]*/gi) || []).length;
      meta.schema = schema;
      meta.storeys = storeys;
      meta.elements = elements;
      meta.summary = `${schema} · ${storeys} pavimento(s) · ${elements} elemento(s)`;
    } else if (ext === 'obj') {
      const vertices = (text.match(/^v\s+/gm) || []).length;
      const faces = (text.match(/^f\s+/gm) || []).length;
      if (!vertices || !faces) throw new Error('Arquivo OBJ inválido: vértices/faces não encontrados.');
      meta.vertices = vertices;
      meta.faces = faces;
      meta.summary = `${vertices} vértices · ${faces} faces`;
    } else if (ext === 'gltf') {
      let parsed;
      try { parsed = JSON.parse(text); } catch { throw new Error('Arquivo GLTF inválido: JSON malformado.'); }
      if (!parsed?.asset?.version) throw new Error('Arquivo GLTF inválido: asset.version ausente.');
      meta.schema = `glTF ${parsed.asset.version}`;
      meta.meshes = Array.isArray(parsed.meshes) ? parsed.meshes.length : 0;
      meta.nodes = Array.isArray(parsed.nodes) ? parsed.nodes.length : 0;
      meta.summary = `glTF ${parsed.asset.version} · ${meta.meshes} malha(s) · ${meta.nodes} nó(s)`;
    }
    return meta;
  },

  async _handleModelImport(file) {
    if (!file) return;
    try {
      Utils.toast('Validando e tessellando modelo BIM/3D...', 'info');
      const meta = await this._inspectModelFile(file);
      if (typeof BIMGeometryImporter === 'undefined') throw new Error('Importador de geometria BIM indisponível.');
      const scene = await BIMGeometryImporter.importFile(file);
      meta.triangles = scene.triangleCount;
      meta.renderedElements = scene.elements.length;
      meta.geometryQuality = scene.geometryQuality || 'full';
      meta.clashEligible = Boolean(scene.clashEligible);
      meta.viewerScale = scene.viewerScale;
      if (typeof Documentos === 'undefined' || typeof Documentos.lerArquivoBase64 !== 'function') {
        throw new Error('Módulo de documentos indisponível para versionar o modelo.');
      }
      const base64 = await Documentos.lerArquivoBase64(file);
      const savedDoc = Documentos.adicionar({
        entidade_tipo: 'obra',
        entidade_id: this.activeObraId,
        titulo: `Modelo BIM — ${file.name}`,
        nome_arquivo: file.name,
        tipo_mime: this._bimMime(meta.format),
        tamanho: file.size,
        categoria: 'bim_model',
        subtipo: 'bim_model',
        bim_format: meta.format,
        bim_metadata: JSON.stringify(meta),
        data_base64: base64
      });
      this._refreshModelVersions();
      this._applyImportedScene(scene, savedDoc?.id || null);
      this._refreshModelVersions();
      Utils.toast(`Modelo ${file.name} validado, versionado e renderizado: ${scene.triangleCount.toLocaleString('pt-BR')} triângulos.`, 'success');
    } catch (err) {
      Utils.toast(err?.message || 'Não foi possível validar o modelo BIM.', 'error');
    }
  },

  _loadCoordinationIssues() {
    try {
      if (typeof Documentos === 'undefined' || typeof Documentos.listar !== 'function' || !this.activeObraId) return [];
      return Documentos.listar('obra', this.activeObraId)
        .filter(doc => doc.subtipo === 'bim_issue')
        .sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
    } catch {
      return [];
    }
  },

  _issuePhotoCount(issueId) {
    try {
      if (typeof Documentos === 'undefined' || typeof Documentos.listar !== 'function') return 0;
      return Documentos.listar('obra', this.activeObraId)
        .filter(doc => doc.subtipo === 'bim_issue_photo' && doc.parent_issue_id === issueId).length;
    } catch {
      return 0;
    }
  },

  _renderCoordinationHtml() {
    const issues = Array.isArray(this.coordinationIssues) ? this.coordinationIssues : [];
    const abertas = issues.filter(i => i.status !== 'resolvida').length;
    const selected = this.selectedElement?.name || 'Elemento selecionado no modelo';
    return `
      <div style="background:#0F1A0E;border:1px solid #243518;border-radius:10px;padding:12px 14px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
          <div>
            <div style="font-size:.76rem;font-weight:900;color:#F0F0E8;">Coordenação BIM</div>
            <div style="font-size:.66rem;color:#64748B;">Pendências, fotos e acompanhamento por elemento.</div>
          </div>
          <span style="font-size:.68rem;color:${abertas ? '#F59E0B' : '#C6FF00'};font-weight:800;">${abertas} aberta(s)</span>
        </div>

        <div style="display:grid;grid-template-columns:minmax(0,1fr) 110px auto;gap:7px;margin-top:10px;">
          <input id="bim-issue-title" class="form-control" maxlength="180" placeholder="Ex: conferir esquadria da fachada" style="min-width:0;font-size:.72rem;">
          <select id="bim-issue-priority" class="form-control" style="font-size:.72rem;">
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
            <option value="critica">Crítica</option>
          </select>
          <button type="button" class="btn-action" data-action="createBimIssue" style="font-size:.72rem;padding:7px 10px;color:#C6FF00;border-color:rgba(198,255,0,.35);">+ Pendência</button>
        </div>
        <div style="font-size:.62rem;color:#64748B;margin-top:5px;">Vínculo atual: ${Utils.escapeHtml(selected)}</div>

        <div style="margin-top:8px;max-height:250px;overflow:auto;">
          ${issues.length ? issues.slice(0, 10).map(issue => {
            const resolved = issue.status === 'resolvida';
            const priorityColor = issue.prioridade === 'critica' ? '#EF4444' : issue.prioridade === 'alta' ? '#F59E0B' : '#94A3B8';
            const photoCount = this._issuePhotoCount(issue.id);
            return `<div style="border-top:1px solid rgba(148,163,184,.12);padding:8px 0;">
              <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
                <div style="min-width:0;">
                  <div style="font-size:.72rem;font-weight:800;color:${resolved ? '#64748B' : '#E2E8F0'};${resolved ? 'text-decoration:line-through;' : ''}">${Utils.escapeHtml(issue.titulo || 'Pendência BIM')}</div>
                  <div style="font-size:.61rem;color:#64748B;margin-top:2px;">${Utils.escapeHtml(issue.bim_element_nome || issue.bim_element_id || 'Modelo geral')} · <span style="color:${priorityColor};">${Utils.escapeHtml(issue.prioridade || 'normal')}</span> · 📷 ${photoCount}</div>
                </div>
                <div style="display:flex;gap:5px;flex-shrink:0;">
                  <label class="btn-action" title="Anexar foto à pendência" style="padding:4px 7px;font-size:.66rem;cursor:pointer;">📷
                    <input type="file" accept="image/png,image/jpeg,image/webp" data-bim-issue-photo="${Utils.escapeHtml(issue.id)}" style="display:none;">
                  </label>
                  <button type="button" class="btn-action" data-action="toggleBimIssue" data-issue-id="${Utils.escapeHtml(issue.id)}" style="padding:4px 7px;font-size:.66rem;">${resolved ? 'Reabrir' : 'Resolver'}</button>
                </div>
              </div>
            </div>`;
          }).join('') : '<div style="font-size:.70rem;color:#64748B;padding:10px 0;">Nenhuma pendência BIM registrada para esta obra.</div>'}
        </div>
      </div>
    `;
  },

  _refreshCoordination() {
    this.coordinationIssues = this._loadCoordinationIssues();
    const host = document.getElementById('bim-coordination-panel');
    if (host) {
      host.innerHTML = this._renderCoordinationHtml();
      this._bindCoordinationEvents();
    }
  },

  _createCoordinationIssue() {
    const input = document.getElementById('bim-issue-title');
    const priority = document.getElementById('bim-issue-priority');
    const titulo = String(input?.value || '').trim();
    if (!titulo) return Utils.toast('Informe a pendência BIM.', 'warning');
    if (typeof Documentos === 'undefined' || typeof Documentos.adicionar !== 'function') {
      return Utils.toast('Módulo de documentos indisponível.', 'error');
    }
    Documentos.adicionar({
      entidade_tipo: 'obra',
      entidade_id: this.activeObraId,
      titulo,
      subtipo: 'bim_issue',
      categoria: 'bim_coordination',
      status: 'aberta',
      prioridade: priority?.value || 'normal',
      bim_element_id: this.selectedElement?.id || null,
      bim_element_nome: this.selectedElement?.name || 'Modelo geral'
    });
    if (input) input.value = '';
    this._refreshCoordination();
    Utils.toast('Pendência BIM registrada.', 'success');
  },

  _toggleCoordinationIssue(issueId) {
    if (!issueId || typeof Documentos === 'undefined') return;
    const docs = Documentos.getAll();
    const idx = docs.findIndex(d => d.id === issueId && d.subtipo === 'bim_issue');
    if (idx < 0) return;
    docs[idx] = {
      ...docs[idx],
      status: docs[idx].status === 'resolvida' ? 'aberta' : 'resolvida',
      atualizado_em: new Date().toISOString()
    };
    Documentos.salvarLista(docs);
    if (typeof DB !== 'undefined' && DB.syncToCloud) DB.syncToCloud('save', 'documentos', docs[idx]);
    this._refreshCoordination();
  },

  async _addCoordinationPhoto(issueId, file) {
    if (!issueId || !file || typeof Documentos === 'undefined') return;
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type || '')) return Utils.toast('Use PNG, JPG ou WEBP.', 'warning');
    if (file.size > 8 * 1024 * 1024) return Utils.toast('A foto deve ter no máximo 8 MB.', 'warning');
    try {
      const base64 = await Documentos.lerArquivoBase64(file);
      Documentos.adicionar({
        entidade_tipo: 'obra',
        entidade_id: this.activeObraId,
        titulo: `Foto BIM — ${file.name}`,
        nome_arquivo: file.name,
        tipo_mime: file.type,
        tamanho: file.size,
        subtipo: 'bim_issue_photo',
        categoria: 'bim_coordination',
        parent_issue_id: issueId,
        data_base64: base64
      });
      this._refreshCoordination();
      Utils.toast('Foto anexada à pendência.', 'success');
    } catch (err) {
      Utils.toast(err?.message || 'Não foi possível anexar a foto.', 'error');
    }
  },

  _bindCoordinationEvents() {
    const createBtn = document.querySelector('[data-action="createBimIssue"]');
    if (createBtn) createBtn.addEventListener('click', () => this._createCoordinationIssue());

    document.querySelectorAll('[data-action="toggleBimIssue"]').forEach(btn => {
      btn.addEventListener('click', e => this._toggleCoordinationIssue(e.currentTarget.getAttribute('data-issue-id')));
    });

    document.querySelectorAll('[data-bim-issue-photo]').forEach(input => {
      input.addEventListener('change', async e => {
        const file = e.currentTarget.files?.[0];
        if (file) await this._addCoordinationPhoto(e.currentTarget.getAttribute('data-bim-issue-photo'), file);
        e.currentTarget.value = '';
      });
    });
  },

  _getOperationalSnapshot(obraId) {
    const emptyResumo = { totalReceitas:0, totalDespesas:0, saldo:0, aPagar:0, aPagarValor:0, aReceber:0, aReceberValor:0 };
    const emptyComp = { totalOrcado:0, totalRealizado:0, saldoRestante:0, percentualFinanceiro:0, percentualFisico:0, etapas:[], statusSaude:'sem_dados', alertaDesc:'Cadastre orçamento, medições e lançamentos para acompanhar a obra em tempo real.' };
    if (typeof DB === 'undefined') return { resumo: emptyResumo, comp: emptyComp, lancamentos: [], cronograma: null };
    try {
      const resumo = typeof DB.getResumo === 'function' ? DB.getResumo(obraId) : emptyResumo;
      const comp = typeof DB.getOrcamentoVsRealizado === 'function' ? DB.getOrcamentoVsRealizado(obraId) : emptyComp;
      const lancamentos = typeof DB.getLancamentos === 'function'
        ? DB.getLancamentos(obraId)
        : (DB.getAll?.('lancamentos') || []).filter(l => l.obra_id === obraId);
      const cronograma = typeof DB.getCronogramaFisicoFinanceiro === 'function' ? DB.getCronogramaFisicoFinanceiro(obraId) : null;
      return { resumo: { ...emptyResumo, ...(resumo || {}) }, comp: { ...emptyComp, ...(comp || {}) }, lancamentos: Array.isArray(lancamentos) ? lancamentos : [], cronograma };
    } catch (err) {
      console.warn('[FinGo BIM] Não foi possível montar o snapshot operacional:', err?.message || err);
      return { resumo: emptyResumo, comp: emptyComp, lancamentos: [], cronograma: null };
    }
  },

  _getScheduleStatus(snapshot) {
    const cron = snapshot?.cronograma;
    if (!cron || !Array.isArray(cron.mesesKeys) || !cron.mesesKeys.length) {
      return { planned: 0, label: 'Cronograma não configurado', deviation: 0 };
    }
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let idx = cron.mesesKeys.findIndex(k => k === key);
    if (idx < 0) {
      idx = cron.mesesKeys.findIndex(k => k > key);
      idx = idx <= 0 ? 0 : idx - 1;
      if (idx < 0) idx = cron.mesesKeys.length - 1;
    }
    const planned = Number(cron.totaisAcumulados?.[idx]?.percentualAcumulado || 0);
    const actual = Number(snapshot?.comp?.percentualFisico || 0);
    return {
      planned: Math.max(0, Math.min(100, Math.round(planned * 10) / 10)),
      actual,
      deviation: Math.round((actual - planned) * 10) / 10,
      label: cron.mesesLabels?.[idx] || key
    };
  },

  _renderOperationalSummaryHtml(snapshot) {
    const resumo = snapshot?.resumo || {};
    const comp = snapshot?.comp || {};
    const fisico = Math.max(0, Math.min(100, Number(comp.percentualFisico || 0)));
    const schedule = this._getScheduleStatus(snapshot);
    const cards = [
      ['Orçado', Utils.fmt.currency(Number(comp.totalOrcado || 0)), '#F0F0E8'],
      ['Custo realizado', Utils.fmt.currency(Number(comp.totalRealizado || 0)), '#F59E0B'],
      ['Receita recebida', Utils.fmt.currency(Number(resumo.totalReceitas || 0)), '#C6FF00'],
      ['A receber', Utils.fmt.currency(Number(resumo.aReceberValor || 0)), '#38BDF8'],
      ['Avanço físico', `${fisico}%`, '#C6FF00'],
      [`Planejado · ${schedule.label}`, `${schedule.planned}%`, schedule.deviation < -5 ? '#EF4444' : '#A78BFA']
    ];
    return `
      <div class="bim-operational-summary" style="display:grid;grid-template-columns:repeat(6,minmax(110px,1fr));gap:10px;">
        ${cards.map(([label,value,color]) => `
          <div style="background:#0F1A0E;border:1px solid #243518;border-radius:10px;padding:11px 13px;min-width:0;">
            <div style="font-size:.66rem;color:#94A3B8;text-transform:uppercase;font-weight:800;letter-spacing:.04em;">${label}</div>
            <div style="font-size:.92rem;color:${color};font-weight:900;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${value}</div>
          </div>`).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:.72rem;color:#94A3B8;padding:0 2px;">
        <span>${Utils.escapeHtml(comp.alertaDesc || '')}</span>
        <span style="color:${schedule.deviation < -5 ? '#EF4444' : schedule.deviation > 5 ? '#C6FF00' : '#94A3B8'};">Cronograma: ${schedule.deviation >= 0 ? '+' : ''}${schedule.deviation}% vs planejado</span>
      </div>
    `;
  },

  _renderFloorButtonsHtml(obra) {
    let floors;
    let pavimentos;

    if (this.modelSource === 'imported') {
      const storeys = new Map();
      (this.elements || []).forEach(elem => {
        if (!elem.floor || elem.floor === 'all') return;
        const meta = elem.importedProperties || {};
        if (!storeys.has(elem.floor)) {
          storeys.set(elem.floor, {
            key: elem.floor,
            label: meta.storeyName || elem.floor,
            elevation: Number(meta.storeyElevation || 0)
          });
        }
      });
      const ordered = Array.from(storeys.values()).sort((a,b) => b.elevation - a.elevation);
      floors = [['all', 'Todos os Pavimentos'], ...ordered.map(s => [s.key, s.label])];
      pavimentos = ordered.length || 1;
    } else {
      pavimentos = Math.max(1, Number(obra?.pavimentos || 1));
      floors = [
        ['all', 'Todos os Pavimentos'],
        ['cobertura', 'Cobertura & Telhado'],
        ...(pavimentos > 1 ? [['pav1', '1º Pavimento & Sacada']] : []),
        ['terreo', 'Pavimento Térreo'],
        ['fundacao', 'Fundações & Baldrame']
      ];
    }

    return `
      <div id="bim-floor-panel" style="position:absolute;top:16px;left:16px;display:flex;flex-direction:column;gap:6px;background:rgba(10,17,8,0.88);backdrop-filter:blur(10px);border:1px solid #243518;border-radius:8px;padding:10px 12px;z-index:2;box-shadow:0 8px 24px rgba(0,0,0,0.6);max-height:calc(100% - 32px);overflow:auto;">
        <span style="font-size:.68rem;font-weight:800;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em;">Pavimentos · ${pavimentos}</span>
        ${floors.map(([floor,label]) => `<button type="button" class="bim-floor-btn ${this.currentFloor === floor ? 'active' : ''}" data-floor="${Utils.escapeHtml(floor)}" style="text-align:left;padding:6px 10px;font-size:.76rem;border:none;border-radius:4px;cursor:pointer;background:${this.currentFloor === floor ? '#C6FF00' : 'transparent'};color:${this.currentFloor === floor ? '#000' : '#F0F0E8'};font-weight:800;white-space:nowrap;">${Utils.escapeHtml(label)}</button>`).join('')}
      </div>
    `;
  },

  _bindFloorButtonEvents() {
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
  },

  _refreshFloorButtons() {
    const host = document.getElementById('bim-floor-panel');
    if (!host) return;
    const obra = (typeof DB !== 'undefined' && DB.getById('clientes', this.activeObraId)) || {};
    host.outerHTML = this._renderFloorButtonsHtml(obra);
    this._bindFloorButtonEvents();
  },

  _applyOperationalData(snapshot) {
    const comp = snapshot?.comp || {};
    const stageMap = new Map((comp.etapas || []).map(e => [String(e.id || '').toLowerCase(), e]));
    const allocations = {
      fundacao: ['elem_fundacao'],
      alvenaria: ['elem_terreo_alvenaria', 'elem_pav1'],
      cobertura: ['elem_cobertura']
    };

    Object.entries(allocations).forEach(([stageId, ids]) => {
      const stage = stageMap.get(stageId);
      const targets = ids.map(id => this.elements.find(e => e.id === id)).filter(Boolean);
      if (!targets.length) return;
      const divisor = targets.length;
      targets.forEach(elem => {
        elem.orcado = stage ? Number(stage.previsto || 0) / divisor : 0;
        elem.realizado = stage ? Number(stage.realizado || 0) / divisor : 0;
        if (Number(comp.percentualFisico || 0) > 0) {
          elem.executadoPct = Math.max(0, Math.min(100, Number(comp.percentualFisico || 0)));
          elem.progressLabel = 'Avanço físico medido';
        } else {
          elem.executadoPct = stage ? Math.max(0, Math.min(100, Number(stage.percentual || 0))) : 0;
          elem.progressLabel = 'Avanço financeiro da etapa';
        }
        elem.dataSource = stage
          ? 'Orçamento, despesas e medições reais vinculados à obra'
          : 'Sem dados classificados nesta macroetapa';
      });
    });
  },

  _stageKeyForElement(elem) {
    if (!elem) return 'outros';
    if (elem.floor === 'fundacao') return 'fundacao';
    if (elem.floor === 'cobertura') return 'cobertura';
    if (elem.floor === 'terreo' || elem.floor === 'pav1') return 'alvenaria';
    return 'outros';
  },

  _recentLancamentosForElement(elem) {
    const all = this.financialSnapshot?.lancamentos || [];
    const stage = this._stageKeyForElement(elem);
    const keywords = {
      fundacao: ['fundacao','fundação','concreto','ferro','aço','aco','sapata','viga','pilar','laje'],
      alvenaria: ['alvenaria','tijolo','bloco','argamassa','reboco','chapisco','laje','parede'],
      cobertura: ['cobertura','telha','telhado','madeiramento','calha','rufo','impermeabil']
    }[stage] || [];
    const matched = all.filter(l => {
      const hay = `${l.categoria || ''} ${l.descricao || ''} ${l.fornecedor_beneficiario || ''}`.toLowerCase();
      return keywords.some(k => hay.includes(k));
    });
    return matched.length ? matched : all.slice(0, 3);
  },

  _navigateToLancamentos() {
    if (typeof App === 'undefined') return;
    if (this.activeObraId) App.obraId = this.activeObraId;
    if (typeof App.navigate === 'function') App.navigate('lancamentos');
  },

  _resizeCanvas() {
    if (!this.canvas?.parentElement) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, rect.width * ratio);
    this.canvas.height = Math.max(1, rect.height * ratio);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(ratio, ratio);
  },

  _toggleExpanded() {
    const root = document.getElementById(this.containerId)?.querySelector('.bim-viewer-layout');
    if (!root) return;
    this.isExpanded = !this.isExpanded;
    if (this.isExpanded) {
      root.dataset.bimExpanded = '1';
      Object.assign(root.style, {
        position: 'fixed', inset: '12px', zIndex: '10050', background: '#070B06',
        padding: '14px', overflow: 'auto', borderRadius: '12px', boxShadow: '0 24px 80px rgba(0,0,0,.8)'
      });
      document.body.style.overflow = 'hidden';
    } else {
      delete root.dataset.bimExpanded;
      ['position','inset','zIndex','background','padding','overflow','borderRadius','boxShadow'].forEach(p => root.style[p] = '');
      document.body.style.overflow = '';
    }
    const btn = root.querySelector('[data-action="toggleExpanded"]');
    if (btn) btn.textContent = this.isExpanded ? '✕ Fechar expansão' : '⛶ Expandir';
    window.setTimeout(() => this._resizeCanvas(), 50);
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
      this.clashHighlightIds = [];
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
        const coord = document.getElementById('bim-coordination-panel');
        if (coord) {
          coord.innerHTML = this._renderCoordinationHtml();
          this._bindCoordinationEvents();
        }
      }
    });

    // Botões de Pavimento
    this._bindFloorButtonEvents();

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

    document.querySelectorAll('.bim-section-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.sectionMode = e.currentTarget.getAttribute('data-section') || 'none';
        document.querySelectorAll('.bim-section-btn').forEach(b => {
          const active = b.getAttribute('data-section') === this.sectionMode;
          b.style.background = active ? '#C6FF00' : 'transparent';
          b.style.color = active ? '#000' : '#F0EAD6';
        });
        const range = document.getElementById('bim-section-range');
        if (range) {
          range.disabled = this.sectionMode === 'none';
          range.style.opacity = this.sectionMode === 'none' ? '.45' : '1';
        }
      });
    });

    const sectionRange = document.getElementById('bim-section-range');
    if (sectionRange) {
      sectionRange.addEventListener('input', (e) => {
        this.sectionPosition = Number(e.currentTarget.value || 0);
      });
    }

    const disciplineFilter = document.getElementById('bim-discipline-filter');
    if (disciplineFilter) {
      disciplineFilter.value = this.disciplineFilter;
      disciplineFilter.addEventListener('change', e => {
        this.disciplineFilter = e.currentTarget.value || 'all';
      });
    }

    document.querySelectorAll('.bim-color-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        this.colorMode = e.currentTarget.getAttribute('data-color-mode') || 'material';
        document.querySelectorAll('.bim-color-btn').forEach(b => {
          const active = b.getAttribute('data-color-mode') === this.colorMode;
          b.style.background = active ? '#C6FF00' : 'transparent';
          b.style.color = active ? '#000' : '#F0EAD6';
        });
        const legend = document.getElementById('bim-status-legend');
        if (legend) legend.style.display = this.colorMode === 'status' ? 'flex' : 'none';
      });
    });

    const expandBtn = document.querySelector('[data-action="toggleExpanded"]');
    if (expandBtn) expandBtn.addEventListener('click', () => this._toggleExpanded());

    const restoreBtn = document.querySelector('[data-action="restoreProcedural"]');
    if (restoreBtn) restoreBtn.addEventListener('click', () => this._restoreProceduralModel());

    this._bindClashEvents();

    document.querySelectorAll('[data-action="loadBimVersion"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-model-doc-id');
        try {
          await this._loadModelDocument(id);
          this._refreshModelVersions();
        } catch (err) {
          Utils.toast(err?.message || 'Não foi possível abrir esta versão BIM.', 'error');
        }
      });
    });

    const lancBtn = document.querySelector('[data-action="filterLancamentos"]');
    if (lancBtn) lancBtn.addEventListener('click', () => this._navigateToLancamentos());

    this._bindCoordinationEvents();

    if (this._escapeHandler) document.removeEventListener('keydown', this._escapeHandler);
    this._escapeHandler = (event) => {
      if (event.key === 'Escape' && this.isExpanded) this._toggleExpanded();
    };
    document.addEventListener('keydown', this._escapeHandler);

    // Input de Upload de Arquivo 3D
    const fileInput = document.getElementById('bim-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) await this._handleModelImport(file);
        e.target.value = '';
      });
    }
  }
};
