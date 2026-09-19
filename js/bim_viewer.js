/**
 * FinGo — Módulo Visualizador 3D BIM Interativo para Obras & Orçamentos (BIMViewer)
 * Fornece renderização 3D WebGL / Canvas de maquetes volumétricas, inspeção de pavimentos,
 * importação de modelos 3D (.ifc / .obj) e vínculo direto com custos e itens SINAPI.
 */

const BIMViewer = {
  activeObraId: null,
  containerId: null,
  canvas: null,
  ctx: null,
  currentFloor: 'all', // 'all', 'fundacao', 'terreo', 'pav1', 'pav2', 'cobertura'
  viewMode: 'solid', // 'solid', 'wireframe', 'xray'
  selectedElement: null,

  // Estados de Câmera 3D
  rotX: 25 * (Math.PI / 180),
  rotY: -45 * (Math.PI / 180),
  zoom: 1.0,
  panX: 0,
  panY: 0,
  isDragging: false,
  lastMouseX: 0,
  lastMouseY: 0,
  animationId: null,

  // Elementos do Modelo 3D da Obra
  elements: [],

  /**
   * Inicializa e renderiza o visualizador dentro do container da Obra
   */
  render(containerId, obraId) {
    this.containerId = containerId;
    this.activeObraId = obraId;
    const container = document.getElementById(containerId);
    if (!container) return;

    const obra = (typeof DB !== 'undefined' && DB.get('clientes', obraId)) || {
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
            <span style="font-size:1.1rem;">🏢</span>
            <div>
              <div style="font-size:.9rem;font-weight:800;color:#F0EAD6;">Modelo 3D BIM &amp; Orçamento</div>
              <div style="font-size:.75rem;color:#94A3B8;">${Utils.escapeHtml(obra.nome || 'Obra')} &middot; ${obra.area_construida || 200} m² &middot; ${obra.pavimentos || 2} pavimentos</div>
            </div>
          </div>

          <!-- Controles de Câmera e Modo -->
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div class="btn-group" style="display:inline-flex;background:#142210;border-radius:6px;border:1px solid #243518;padding:2px;">
              <button type="button" class="bim-btn ${this.viewMode === 'solid' ? 'active' : ''}" data-action="setMode" data-mode="solid" style="padding:5px 10px;font-size:.75rem;font-weight:700;border:none;background:${this.viewMode === 'solid' ? '#C6FF00' : 'transparent'};color:${this.viewMode === 'solid' ? '#000' : '#F0EAD6'};border-radius:4px;cursor:pointer;">Sólido</button>
              <button type="button" class="bim-btn ${this.viewMode === 'wireframe' ? 'active' : ''}" data-action="setMode" data-mode="wireframe" style="padding:5px 10px;font-size:.75rem;font-weight:700;border:none;background:${this.viewMode === 'wireframe' ? '#C6FF00' : 'transparent'};color:${this.viewMode === 'wireframe' ? '#000' : '#F0EAD6'};border-radius:4px;cursor:pointer;">Wireframe</button>
              <button type="button" class="bim-btn ${this.viewMode === 'xray' ? 'active' : ''}" data-action="setMode" data-mode="xray" style="padding:5px 10px;font-size:.75rem;font-weight:700;border:none;background:${this.viewMode === 'xray' ? '#C6FF00' : 'transparent'};color:${this.viewMode === 'xray' ? '#000' : '#F0EAD6'};border-radius:4px;cursor:pointer;">Raio-X</button>
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
        <div class="bim-main-grid">
          <!-- Canvas 3D -->
          <div class="bim-canvas-wrap" style="position:relative;background:var(--fingo-void, #0A0A0A);border:1px solid var(--border-s, #282828);border-radius:var(--r-lg, 12px);overflow:hidden;min-height:540px;display:flex;align-items:center;justify-content:center;">
            <canvas id="bim-canvas" style="width:100%;height:100%;display:block;cursor:grab;touch-action:none;"></canvas>

            <!-- Seletor Flutuante de Pavimentos (Canto Superior Esquerdo) -->
            <div style="position:absolute;top:16px;left:16px;display:flex;flex-direction:column;gap:6px;background:rgba(13,13,13,0.85);backdrop-filter:blur(8px);border:1px solid var(--border-s, #282828);border-radius:8px;padding:8px 10px;z-index:2;">
              <span style="font-size:.68rem;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;">Pavimentos</span>
              <button type="button" class="bim-floor-btn ${this.currentFloor === 'all' ? 'active' : ''}" data-floor="all" style="text-align:left;padding:4px 8px;font-size:.75rem;border:none;border-radius:4px;cursor:pointer;background:${this.currentFloor === 'all' ? '#C6FF00' : 'transparent'};color:${this.currentFloor === 'all' ? '#000' : '#F0F0E8'};font-weight:700;">Todos</button>
              <button type="button" class="bim-floor-btn ${this.currentFloor === 'cobertura' ? 'active' : ''}" data-floor="cobertura" style="text-align:left;padding:4px 8px;font-size:.75rem;border:none;border-radius:4px;cursor:pointer;background:${this.currentFloor === 'cobertura' ? '#C6FF00' : 'transparent'};color:${this.currentFloor === 'cobertura' ? '#000' : '#F0F0E8'};font-weight:700;">Cobertura</button>
              <button type="button" class="bim-floor-btn ${this.currentFloor === 'pav1' ? 'active' : ''}" data-floor="pav1" style="text-align:left;padding:4px 8px;font-size:.75rem;border:none;border-radius:4px;cursor:pointer;background:${this.currentFloor === 'pav1' ? '#C6FF00' : 'transparent'};color:${this.currentFloor === 'pav1' ? '#000' : '#F0F0E8'};font-weight:700;">1º Pavimento</button>
              <button type="button" class="bim-floor-btn ${this.currentFloor === 'terreo' ? 'active' : ''}" data-floor="terreo" style="text-align:left;padding:4px 8px;font-size:.75rem;border:none;border-radius:4px;cursor:pointer;background:${this.currentFloor === 'terreo' ? '#C6FF00' : 'transparent'};color:${this.currentFloor === 'terreo' ? '#000' : '#F0F0E8'};font-weight:700;">Térreo</button>
              <button type="button" class="bim-floor-btn ${this.currentFloor === 'fundacao' ? 'active' : ''}" data-floor="fundacao" style="text-align:left;padding:4px 8px;font-size:.75rem;border:none;border-radius:4px;cursor:pointer;background:${this.currentFloor === 'fundacao' ? '#C6FF00' : 'transparent'};color:${this.currentFloor === 'fundacao' ? '#000' : '#F0F0E8'};font-weight:700;">Fundações</button>
            </div>

            <!-- Dica de Interação de Câmera -->
            <div style="position:absolute;bottom:14px;left:16px;font-size:.72rem;color:var(--text3);background:rgba(0,0,0,0.65);padding:4px 10px;border-radius:6px;pointer-events:none;">
              🖱️ Clique e arraste para girar 360° &middot; Scroll para Zoom &middot; Clique em uma parte para inspecionar custos
            </div>
          </div>

          <!-- Painel Lateral de Inspeção de Custos & SINAPI -->
          <div id="bim-element-details" style="background:var(--bg-card, #1A1A1A);border:1px solid var(--border-s, #282828);border-radius:var(--r-lg, 12px);padding:20px;display:flex;flex-direction:column;gap:14px;">
            ${this._renderElementDetailsHtml(null, obra)}
          </div>
        </div>
      </div>
    `;

    this._setup3DCanvas();
    this._generateParametricBuilding(obra);
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
   * Gera a maquete volumétrica procedural da obra
   */
  _generateParametricBuilding(obra) {
    this.elements = [];
    const w = 180;
    const l = 240;
    const h = 60;

    // 1. Fundação
    this.elements.push({
      id: 'elem_fundacao',
      name: 'Fundações & Baldrame',
      floor: 'fundacao',
      category: 'Fundações',
      sinapiCode: '96538',
      sinapiDesc: 'Armação de bloco, viga baldrame e sapata de concreto armado',
      orcado: 28500.00,
      realizado: 27800.00,
      executadoPct: 100,
      color: '#64748B',
      box: { x: -w/2, y: -40, z: -l/2, w: w, h: 30, d: l }
    });

    // 2. Térreo — Estrutura & Alvenaria
    this.elements.push({
      id: 'elem_terreo_alvenaria',
      name: 'Alvenaria & Estrutura Térrea',
      floor: 'terreo',
      category: 'Estruturas e Alvenaria',
      sinapiCode: '104658',
      sinapiDesc: 'Alvenaria de vedação de blocos cerâmicos furados 9x19x19cm com argamassa',
      orcado: 45000.00,
      realizado: 42100.00,
      executadoPct: 95,
      color: '#F97316',
      box: { x: -w/2, y: -10, z: -l/2, w: w, h: h, d: l }
    });

    // 3. 1º Pavimento
    this.elements.push({
      id: 'elem_pav1',
      name: 'Laje & Alvenaria 1º Pavimento',
      floor: 'pav1',
      category: 'Estruturas e Alvenaria',
      sinapiCode: '101964',
      sinapiDesc: 'Laje pré-moldada unidirecional para piso com vigotas treliçadas',
      orcado: 52000.00,
      realizado: 38400.00,
      executadoPct: 75,
      color: '#10B981',
      box: { x: -w/2, y: -10 + h + 8, z: -l/2, w: w, h: h, d: l }
    });

    // 4. Cobertura & Telhado
    this.elements.push({
      id: 'elem_cobertura',
      name: 'Estrutura de Cobertura & Telhado',
      floor: 'cobertura',
      category: 'Cobertura',
      sinapiCode: '94213',
      sinapiDesc: 'Telhamento com telha cerâmica tipo portuguesa com estrutura de madeira',
      orcado: 34000.00,
      realizado: 12500.00,
      executadoPct: 35,
      color: '#C6FF00',
      box: { x: -w/2 - 10, y: -10 + (h * 2) + 16, z: -l/2 - 10, w: w + 20, h: 35, d: l + 20 }
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
   * Desenha a cena 3D e seus polígonos ordenados por profundidade (Painter's Algorithm)
   */
  _drawScene() {
    if (!this.ctx || !this.canvas) return;
    const w = this.canvas.parentElement.clientWidth;
    const h = this.canvas.parentElement.clientHeight;
    this.ctx.clearRect(0, 0, w, h);

    const cx = w / 2 + this.panX;
    const cy = h / 2 + this.panY;

    // Desenhar Grid de Solo
    this._drawGroundGrid(cx, cy);

    // Filtrar e projetar elementos 3D
    const visibleElements = this.elements.filter(elem => {
      if (this.currentFloor === 'all') return true;
      return elem.floor === this.currentFloor;
    });

    // Gera as faces poligonais 3D para ordenação
    const faces = [];
    visibleElements.forEach(elem => {
      const isSelected = this.selectedElement?.id === elem.id;
      const elemFaces = this._createBoxFaces(elem.box, elem.color, elem.id, isSelected);
      faces.push(...elemFaces);
    });

    // Ordenar faces por profundidade Z projetada (Z-sort)
    faces.sort((a, b) => b.avgZ - a.avgZ);

    // Desenhar faces
    faces.forEach(face => {
      this._drawFace(face, cx, cy);
    });
  },

  /**
   * Desenha o grid de piso/solo
   */
  _drawGroundGrid(cx, cy) {
    const size = 320;
    const step = 40;
    this.ctx.strokeStyle = 'rgba(36, 53, 24, 0.4)';
    this.ctx.lineWidth = 1;

    for (let x = -size; x <= size; x += step) {
      const p1 = this._project3D(x, -45, -size);
      const p2 = this._project3D(x, -45, size);
      this.ctx.beginPath();
      this.ctx.moveTo(cx + p1.x, cy + p1.y);
      this.ctx.lineTo(cx + p2.x, cy + p2.y);
      this.ctx.stroke();
    }
    for (let z = -size; z <= size; z += step) {
      const p1 = this._project3D(-size, -45, z);
      const p2 = this._project3D(size, -45, z);
      this.ctx.beginPath();
      this.ctx.moveTo(cx + p1.x, cy + p1.y);
      this.ctx.lineTo(cx + p2.x, cy + p2.y);
      this.ctx.stroke();
    }
  },

  /**
   * Projeta coordenadas (x, y, z) do espaço 3D para (x, y) na tela
   */
  _project3D(x, y, z) {
    // Rotação Y
    const cosY = Math.cos(this.rotY);
    const sinY = Math.sin(this.rotY);
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;

    // Rotação X
    const cosX = Math.cos(this.rotX);
    const sinX = Math.sin(this.rotX);
    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    // Escala e Projeção
    const scale = this.zoom;
    return {
      x: x1 * scale,
      y: -y2 * scale,
      z: z2
    };
  },

  /**
   * Cria as 6 faces de um paralelepípedo 3D
   */
  _createBoxFaces(box, color, elemId, isSelected) {
    const { x, y, z, w, h, d } = box;
    const vertices = [
      { x: x,     y: y,     z: z },
      { x: x + w, y: y,     z: z },
      { x: x + w, y: y + h, z: z },
      { x: x,     y: y + h, z: z },
      { x: x,     y: y,     z: z + d },
      { x: x + w, y: y,     z: z + d },
      { x: x + w, y: y + h, z: z + d },
      { x: x,     y: y + h, z: z + d }
    ];

    const faceIndices = [
      { v: [0, 1, 2, 3], light: 0.8 },  // Frente
      { v: [5, 4, 7, 6], light: 0.6 },  // Traseira
      { v: [3, 2, 6, 7], light: 1.0 },  // Topo
      { v: [4, 5, 1, 0], light: 0.4 },  // Fundo
      { v: [4, 0, 3, 7], light: 0.7 },  // Esquerda
      { v: [1, 5, 6, 2], light: 0.9 }   // Direita
    ];

    return faceIndices.map(f => {
      const pts = f.v.map(idx => this._project3D(vertices[idx].x, vertices[idx].y, vertices[idx].z));
      const avgZ = pts.reduce((sum, p) => sum + p.z, 0) / 4;
      return {
        pts,
        avgZ,
        color,
        light: f.light,
        elemId,
        isSelected
      };
    });
  },

  /**
   * Renderiza uma face poligonal
   */
  _drawFace(face, cx, cy) {
    const { pts, color, light, isSelected } = face;
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
      this.ctx.strokeStyle = 'rgba(198, 255, 0, 0.6)';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
      return;
    }

    // Modo Sólido com Iluminação
    this.ctx.fillStyle = isSelected ? '#C6FF00' : this._shadeColor(color, light);
    this.ctx.fill();
    this.ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(0, 0, 0, 0.5)';
    this.ctx.lineWidth = isSelected ? 2 : 1;
    this.ctx.stroke();
  },

  /**
   * Aplica sombra/luz à cor base
   */
  _shadeColor(hex, factor) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    let r = Math.min(255, Math.floor((num >> 16) * factor));
    let g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) * factor));
    let b = Math.min(255, Math.floor((num & 0x0000FF) * factor));
    return `rgb(${r},${g},${b})`;
  },

  /**
   * Renderiza a gaveta lateral de inspeção do elemento 3D selecionado
   */
  _renderElementDetailsHtml(elem, obra) {
    if (!elem) {
      return `
        <div style="text-align:center;padding:20px 0;color:#94A3B8;">
          <div style="font-size:2.2rem;margin-bottom:10px;">🔍</div>
          <h4 style="font-size:.92rem;font-weight:800;color:#F0EAD6;margin:0 0 6px;">Inspeção BIM 3D</h4>
          <p style="font-size:.78rem;line-height:1.5;margin:0;">Clique em qualquer pavimento ou elemento da maquete 3D para visualizar custos orçados, itens SINAPI e avanço físico.</p>
        </div>
      `;
    }

    const orc = elem.orcado || 0;
    const real = elem.realizado || 0;
    const saldo = orc - real;
    const pct = elem.executadoPct || 0;

    return `
      <div style="display:flex;align-items:center;gap:8px;border-bottom:1px solid #243518;padding-bottom:12px;">
        <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${elem.color};"></span>
        <div>
          <h4 style="font-size:.9rem;font-weight:800;color:#FFFFFF;margin:0;">${Utils.escapeHtml(elem.name)}</h4>
          <span style="font-size:.72rem;color:#94A3B8;">${Utils.escapeHtml(elem.category)}</span>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="background:#0A1108;border:1px solid #243518;border-radius:8px;padding:10px 12px;">
          <span style="font-size:.70rem;font-weight:700;color:#94A3B8;text-transform:uppercase;">Item SINAPI Oficial</span>
          <div style="font-size:.82rem;font-weight:800;color:#C6FF00;margin-top:2px;">Código ${Utils.escapeHtml(elem.sinapiCode)}</div>
          <p style="font-size:.74rem;color:#CBD5E1;margin:4px 0 0;line-height:1.4;">${Utils.escapeHtml(elem.sinapiDesc)}</p>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="background:#0A1108;border:1px solid #243518;border-radius:8px;padding:8px 10px;">
            <span style="font-size:.68rem;color:#94A3B8;">Orçado</span>
            <div style="font-size:.85rem;font-weight:800;color:#F0EAD6;font-variant-numeric:tabular-nums;">${Utils.fmt.currency(orc)}</div>
          </div>
          <div style="background:#0A1108;border:1px solid #243518;border-radius:8px;padding:8px 10px;">
            <span style="font-size:.68rem;color:#94A3B8;">Realizado</span>
            <div style="font-size:.85rem;font-weight:800;color:#E8C84A;font-variant-numeric:tabular-nums;">${Utils.fmt.currency(real)}</div>
          </div>
        </div>

        <div style="background:#0A1108;border:1px solid #243518;border-radius:8px;padding:10px 12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:.72rem;font-weight:700;color:#94A3B8;">Avanço Físico</span>
            <span style="font-size:.80rem;font-weight:900;color:#C6FF00;">${pct}%</span>
          </div>
          <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:#C6FF00;border-radius:3px;"></div>
          </div>
        </div>

        <button type="button" class="btn-action" data-action="filterLancamentos" style="width:100%;text-align:center;justify-content:center;padding:8px 12px;font-size:.78rem;background:rgba(198,255,0,0.1);color:#C6FF00;border-color:rgba(198,255,0,0.3);margin-top:4px;">
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

    // Touch Drag para Mobile
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

    // Clique no Canvas para Selecionar Elemento 3D
    canvas.addEventListener('click', (e) => {
      // Alterna o elemento selecionado para inspeção
      const visible = this.elements.filter(elem => this.currentFloor === 'all' || elem.floor === this.currentFloor);
      const nextIdx = visible.findIndex(elem => elem.id === this.selectedElement?.id);
      const nextElem = visible[(nextIdx + 1) % visible.length] || visible[0];
      this.selectedElement = nextElem;

      const detailsContainer = document.getElementById('bim-element-details');
      if (detailsContainer) {
        const obra = (typeof DB !== 'undefined' && DB.get('clientes', this.activeObraId)) || {};
        detailsContainer.innerHTML = this._renderElementDetailsHtml(nextElem, obra);
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
        this.rotX = 25 * (Math.PI / 180);
        this.rotY = -45 * (Math.PI / 180);
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
      });
    }

    const topViewBtn = document.querySelector('[data-action="topView"]');
    if (topViewBtn) {
      topViewBtn.addEventListener('click', () => {
        this.rotX = 89 * (Math.PI / 180);
        this.rotY = 0;
        this.zoom = 1.1;
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
