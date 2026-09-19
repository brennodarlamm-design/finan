/**
 * FinGo — Módulo Visualizador 3D BIM Interativo para Obras & Orçamentos (BIMViewer)
 * Renderizador 3D CAD/BIM procedural arquitetônico de alta fidelidade com vínculo direto ao SINAPI e custos.
 * Interface Brutalist Tech inspirada em estações de trabalho de engenharia de ponta.
 */

const BIMViewer = {
  activeObraId: null,
  containerId: null,
  canvas: null,
  ctx: null,
  currentFloor: 'all', // 'all', 'fundacao', 'terreo', 'pav1', 'cobertura'
  viewMode: 'solid', // 'solid', 'wireframe', 'xray'
  selectedElement: null,
  hiddenElementIds: new Set(),
  activeLeftTab: 'tree', // 'tree' | 'properties'
  activeRightTab: 'mep', // 'mep' | 'costs'

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
    this.hiddenElementIds = new Set();
    this.currentFloor = 'all';
    this.disciplineFilter = 'all';
    this.activeLeftTab = 'tree';
    this.activeRightTab = 'mep';
    const container = document.getElementById(containerId);
    if (!container) return;

    const obra = (typeof DB !== 'undefined' && DB.getById('clientes', obraId)) || {
      nome: 'Mansão Villa Aurora',
      area_construida: 480,
      pavimentos: 2,
      padrao: 'Alto Padrão'
    };
    const snapshot = this._getOperationalSnapshot(obraId);
    this.financialSnapshot = snapshot;
    this.modelVersions = this._loadModelVersions();
    this.coordinationIssues = this._loadCoordinationIssues();

    container.innerHTML = `
      <div class="bim-viewer-layout" style="display:flex;flex-direction:column;gap:12px;font-family:inherit;">
        <!-- Barra de Ferramentas Superior do BIM (Header Brutalist Tech) -->
        <div class="bim-toolbar" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;background:#0A1108;border:1px solid #243518;border-radius:10px;padding:10px 16px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:34px;height:34px;background:#142210;border:1px solid #C6FF00;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;box-shadow:0 0 12px rgba(198,255,0,0.2);">
              🏛️
            </div>
            <div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:.92rem;font-weight:900;color:#F0EAD6;letter-spacing:-.02em;">ESTAÇÃO 3D BIM &amp; ENGENHARIA</span>
                <span style="background:rgba(198,255,0,0.15);color:#C6FF00;border:1px solid rgba(198,255,0,0.4);font-size:.60rem;font-weight:900;padding:2px 6px;border-radius:4px;text-transform:uppercase;letter-spacing:.05em;">Pro Workstation</span>
              </div>
              <div style="font-size:.74rem;color:#94A3B8;margin-top:2px;">${Utils.escapeHtml(obra.nome || 'Obra')} &middot; ${obra.area_construida || 480} m² &middot; ${obra.pavimentos || 2} pavimentos</div>
            </div>
          </div>

          <!-- Controles Rápidos de Modelo & Importação -->
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;background:#142210;border:1px solid #243518;border-radius:6px;padding:2px 6px;">
              <span style="font-size:.65rem;color:#94A3B8;margin-right:6px;font-weight:700;">PROJETO:</span>
              <select id="bim-model-preset-select" title="Seletor de Modelos BIM e Projetos de Exemplo" style="background:transparent;color:#C6FF00;border:none;font-size:.70rem;font-weight:800;outline:none;cursor:pointer;">
                <option value="sobrado_procedural">🏡 Mansão Alto Padrão 480 m² (R$ 1.000.000 — Completa com Todas as Infraestruturas)</option>
                <option value="ifc4_structural">🏗️ Estrutura de Concreto Armado (IFC4)</option>
                <option value="ifc4_hvac">🧊 Instalações MEP &amp; HVAC Climatização (IFC4)</option>
                <option value="ifc4_architecture">🏛️ Arquitetura buildingSMART (IFC4)</option>
                <option value="bim_multi_clash">⚡ Coordenação Multi-disciplinar (Clash Real)</option>
                <option value="ifc4_opening_window">🪟 Parede com Abertura &amp; Esquadria (IFC4)</option>
              </select>
            </div>

            <div style="display:flex;align-items:center;background:#142210;border:1px solid #243518;border-radius:6px;padding:2px 6px;">
              <span style="font-size:.65rem;color:#94A3B8;margin-right:6px;font-weight:700;">DISCIPLINA:</span>
              <select id="bim-discipline-filter" title="Filtrar disciplina BIM" style="background:transparent;color:#F0EAD6;border:none;font-size:.70rem;font-weight:700;outline:none;cursor:pointer;">
                <option value="all">Todas disciplinas</option>
                <option value="estrutural">Estrutural</option>
                <option value="arquitetura">Arquitetura</option>
                <option value="hidraulica">Hidráulica</option>
                <option value="eletrica">Elétrica</option>
                <option value="mecanica">Mecânica / HVAC</option>
              </select>
            </div>

            <button type="button" class="btn-action" data-action="runClashDetection" style="font-size:.72rem;padding:6px 10px;background:rgba(127,73,184,.15);border-color:rgba(167,139,250,.4);color:#C4B5FD;font-weight:800;border-radius:6px;cursor:pointer;">
              ⚡ Interferências
            </button>

            <label class="btn-action" style="cursor:pointer;margin:0;font-size:.72rem;padding:6px 10px;background:rgba(198,255,0,.1);border:1px solid rgba(198,255,0,.3);color:#C6FF00;border-radius:6px;font-weight:700;">
              <span>📁 Importar (.ifc / .obj)</span>
              <input type="file" id="bim-file-input" accept=".obj,.ifc,.gltf,.glb" style="display:none;" />
            </label>
          </div>
        </div>

        ${this._renderOperationalSummaryHtml(snapshot)}

        <!-- WORKSTATION CAD/BIM PRINCIPAL — 3 COLUNAS -->
        <div class="bim-workstation-grid" style="display:grid;grid-template-columns:270px 1fr 310px;gap:12px;align-items:stretch;">
          
          <!-- COLUNA ESQUERDA: Árvore de Projeto (Project Tree) & Propriedades -->
          <div style="background:#0F1A0E;border:1px solid #243518;border-radius:12px;display:flex;flex-direction:column;overflow:hidden;">
            <!-- Tabs Esquerda -->
            <div style="display:flex;border-bottom:1px solid #243518;background:#0A1108;">
              <button type="button" id="bim-left-tab-tree" data-tab="tree" class="bim-subtab-btn" style="flex:1;padding:8px 6px;font-size:.70rem;font-weight:800;border:none;background:#142210;color:#C6FF00;border-bottom:2px solid #C6FF00;cursor:pointer;">
                🌳 Disciplinas &amp; Layers
              </button>
              <button type="button" id="bim-left-tab-props" data-tab="props" class="bim-subtab-btn" style="flex:1;padding:8px 6px;font-size:.70rem;font-weight:800;border:none;background:transparent;color:#94A3B8;cursor:pointer;">
                ⚙️ Propriedades CAD
              </button>
            </div>

            <!-- Conteúdo da Árvore de Disciplinas -->
            <div id="bim-tree-container" style="flex:1;padding:12px;overflow-y:auto;max-height:580px;display:flex;flex-direction:column;gap:8px;">
              <!-- Preenchido dinamicamente por _renderProjectTreeHtml() -->
            </div>

            <!-- Conteúdo de Propriedades (Oculto inicialmente) -->
            <div id="bim-props-container" style="display:none;flex:1;padding:14px;overflow-y:auto;max-height:580px;flex-direction:column;gap:10px;">
              <!-- Preenchido dinamicamente -->
            </div>
          </div>

          <!-- COLUNA CENTRAL: Canvas Viewport 3D com Gizmo & Controles Flutuantes -->
          <div class="bim-canvas-wrap" style="position:relative;background:#060A05;border:1px solid #243518;border-radius:12px;overflow:hidden;min-height:580px;display:flex;flex-direction:column;">
            
            <!-- Breadcrumb Header no Topo do Viewport -->
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:rgba(10,17,8,0.85);backdrop-filter:blur(8px);border-bottom:1px solid rgba(36,53,24,0.6);z-index:2;">
              <div style="font-family:monospace;font-size:.66rem;font-weight:700;color:#94A3B8;letter-spacing:.04em;display:flex;align-items:center;gap:6px;">
                <span style="color:#C6FF00;">PROJECT:</span> ${Utils.escapeHtml((obra.nome || 'MANSÃO').toUpperCase())} &middot; <span style="color:#38BDF8;">480 SQM</span> &middot; <span id="bim-viewport-cam-label" style="color:#F0EAD6;">VIEWPORT: ISOMETRIC - NW</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <button type="button" class="bim-view-btn" data-action="toggleExpanded" title="Expandir Tela Cheia" style="padding:3px 8px;font-size:.68rem;border:1px solid #243518;background:#142210;color:#C6FF00;border-radius:4px;cursor:pointer;font-weight:800;">⛶ Expandir</button>
              </div>
            </div>

            <!-- Canvas 3D Principal -->
            <div style="flex:1;position:relative;width:100%;height:100%;">
              <canvas id="bim-canvas" style="width:100%;height:100%;display:block;cursor:grab;touch-action:none;"></canvas>

              <!-- Pavimentos Flutuantes (Esquerda Superior) -->
              ${this._renderFloorButtonsHtml(obra)}

              <!-- Dica de Interação de Câmera -->
              <div style="position:absolute;bottom:54px;left:14px;font-size:.68rem;color:#94A3B8;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);padding:5px 10px;border-radius:6px;border:1px solid #243518;pointer-events:none;">
                🖱️ Arraste para orbitar 360° &middot; Scroll para zoom &middot; Clique para inspecionar
              </div>
            </div>

            <!-- Barra Inferior de Ferramentas CAD do Viewport -->
            <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:#0A1108;border-top:1px solid #243518;flex-wrap:wrap;gap:8px;z-index:2;">
              <!-- Modos de Shading -->
              <div class="btn-group" style="display:inline-flex;background:#142210;border-radius:6px;border:1px solid #243518;padding:2px;">
                <button type="button" class="bim-btn ${this.viewMode === 'solid' ? 'active' : ''}" data-action="setMode" data-mode="solid" style="padding:4px 10px;font-size:.70rem;font-weight:800;border:none;background:${this.viewMode === 'solid' ? '#C6FF00' : 'transparent'};color:${this.viewMode === 'solid' ? '#000' : '#F0EAD6'};border-radius:4px;cursor:pointer;">Sólido</button>
                <button type="button" class="bim-btn ${this.viewMode === 'wireframe' ? 'active' : ''}" data-action="setMode" data-mode="wireframe" style="padding:4px 10px;font-size:.70rem;font-weight:800;border:none;background:${this.viewMode === 'wireframe' ? '#C6FF00' : 'transparent'};color:${this.viewMode === 'wireframe' ? '#000' : '#F0EAD6'};border-radius:4px;cursor:pointer;">Wireframe</button>
                <button type="button" class="bim-btn ${this.viewMode === 'xray' ? 'active' : ''}" data-action="setMode" data-mode="xray" style="padding:4px 10px;font-size:.70rem;font-weight:800;border:none;background:${this.viewMode === 'xray' ? '#C6FF00' : 'transparent'};color:${this.viewMode === 'xray' ? '#000' : '#F0EAD6'};border-radius:4px;cursor:pointer;">Raio-X</button>
              </div>

              <!-- Vistas Rápidas -->
              <div class="btn-group" style="display:inline-flex;background:#142210;border-radius:6px;border:1px solid #243518;padding:2px;">
                <button type="button" class="bim-view-btn" data-action="resetView" style="padding:4px 9px;font-size:.70rem;border:none;background:transparent;color:#F0EAD6;cursor:pointer;font-weight:700;">📐 Isométrica</button>
                <button type="button" class="bim-view-btn" data-action="topView" style="padding:4px 9px;font-size:.70rem;border:none;background:transparent;color:#F0EAD6;cursor:pointer;font-weight:700;">🗺️ Planta</button>
              </div>

              <!-- Planos de Corte X / Z -->
              <div class="btn-group" style="display:inline-flex;background:#142210;border-radius:6px;border:1px solid #243518;padding:2px;align-items:center;">
                <button type="button" class="bim-section-btn" data-section="none" style="padding:4px 8px;font-size:.68rem;border:none;background:#C6FF00;color:#000;border-radius:4px;cursor:pointer;font-weight:800;">Inteiro</button>
                <button type="button" class="bim-section-btn" data-section="x" style="padding:4px 8px;font-size:.68rem;border:none;background:transparent;color:#F0EAD6;border-radius:4px;cursor:pointer;font-weight:700;">Corte X</button>
                <button type="button" class="bim-section-btn" data-section="z" style="padding:4px 8px;font-size:.68rem;border:none;background:transparent;color:#F0EAD6;border-radius:4px;cursor:pointer;font-weight:700;">Corte Z</button>
                <input id="bim-section-range" type="range" min="-120" max="120" step="5" value="0" title="Posição do plano de corte" disabled style="width:75px;margin:0 4px;accent-color:#C6FF00;opacity:.45;">
              </div>

              <!-- Modo de Cores -->
              <div class="btn-group" style="display:inline-flex;background:#142210;border-radius:6px;border:1px solid #243518;padding:2px;align-items:center;">
                <button type="button" class="bim-color-btn" data-color-mode="material" style="padding:4px 7px;font-size:.68rem;border:none;background:#C6FF00;color:#000;border-radius:4px;cursor:pointer;font-weight:800;">Materiais</button>
                <button type="button" class="bim-color-btn" data-color-mode="status" style="padding:4px 7px;font-size:.68rem;border:none;background:transparent;color:#F0EAD6;border-radius:4px;cursor:pointer;font-weight:700;">Status</button>
              </div>
            </div>
          </div>

          <!-- COLUNA DIREITA: Overview Técnico MEP & SINAPI / Custos -->
          <div style="background:#0F1A0E;border:1px solid #243518;border-radius:12px;display:flex;flex-direction:column;overflow:hidden;">
            <!-- Tabs Direita -->
            <div style="display:flex;border-bottom:1px solid #243518;background:#0A1108;">
              <button type="button" id="bim-right-tab-mep" data-tab="mep" class="bim-subtab-btn" style="flex:1;padding:8px 6px;font-size:.70rem;font-weight:800;border:none;background:#142210;color:#C6FF00;border-bottom:2px solid #C6FF00;cursor:pointer;">
                📊 Infraestrutura MEP
              </button>
              <button type="button" id="bim-right-tab-costs" data-tab="costs" class="bim-subtab-btn" style="flex:1;padding:8px 6px;font-size:.70rem;font-weight:800;border:none;background:transparent;color:#94A3B8;cursor:pointer;">
                💰 SINAPI &amp; Custos
              </button>
            </div>

            <!-- Conteúdo MEP Overview -->
            <div id="bim-mep-overview-panel" style="flex:1;padding:12px;overflow-y:auto;max-height:580px;display:flex;flex-direction:column;gap:10px;">
              <!-- Preenchido dinamicamente por _renderMepOverviewHtml() -->
            </div>

            <!-- Conteúdo de Inspeção SINAPI / Custos (Oculto inicialmente) -->
            <div id="bim-element-details" style="display:none;flex:1;padding:14px;overflow-y:auto;max-height:580px;flex-direction:column;gap:12px;">
              <!-- Preenchido dinamicamente por _renderElementDetailsHtml() -->
            </div>
          </div>
        </div>

        <!-- Painéis Inferiores de Coordenação & Versões -->
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
    this._refreshWorkstationUi(obra);
    this._bindEvents();
    this._hydrateLatestModelVersion();
  },

  /**
   * Atualiza as abas e componentes da Workstation CAD/BIM
   */
  _refreshWorkstationUi(obra) {
    const treeContainer = document.getElementById('bim-tree-container');
    if (treeContainer) {
      treeContainer.innerHTML = this._renderProjectTreeHtml();
      this._bindTreeEvents();
    }

    const mepContainer = document.getElementById('bim-mep-overview-panel');
    if (mepContainer) {
      mepContainer.innerHTML = this._renderMepOverviewHtml();
    }

    const detailsContainer = document.getElementById('bim-element-details');
    if (detailsContainer) {
      detailsContainer.innerHTML = this._renderElementDetailsHtml(this.selectedElement, obra);
    }

    const propsContainer = document.getElementById('bim-props-container');
    if (propsContainer && this.selectedElement) {
      const p = this._getElementProperties(this.selectedElement);
      propsContainer.innerHTML = `
        <div style="font-size:.72rem;font-weight:900;color:#C6FF00;text-transform:uppercase;letter-spacing:.05em;">Propriedades Paramétricas</div>
        <div style="background:#0A1108;border:1px solid #243518;border-radius:8px;padding:10px;font-size:.75rem;display:flex;flex-direction:column;gap:6px;">
          <div style="display:flex;justify-content:space-between;"><span style="color:#94A3B8;">Elemento:</span><b style="color:#FFFFFF;">${Utils.escapeHtml(this.selectedElement.name)}</b></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:#94A3B8;">Classe IFC:</span><span style="color:#38BDF8;font-family:monospace;font-size:.70rem;">${Utils.escapeHtml(p.ifcClass)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:#94A3B8;">Material:</span><span style="color:#F0EAD6;">${Utils.escapeHtml(p.material)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:#94A3B8;">Largura (X):</span><span style="color:#C6FF00;">${p.width}</span></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:#94A3B8;">Altura (Y):</span><span style="color:#C6FF00;">${p.height}</span></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:#94A3B8;">Profundidade (Z):</span><span style="color:#C6FF00;">${p.depth}</span></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:#94A3B8;">Volume Sólido:</span><span style="color:#F59E0B;">${p.volume}</span></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:#94A3B8;">Total de Malhas:</span><span style="color:#FFFFFF;">${p.meshCount} peças</span></div>
        </div>
      `;
    }
  },

  /**
   * Renderiza a Árvore de Projeto (Project Tree) com toggles de visibilidade (👁️)
   */
  _renderProjectTreeHtml() {
    if (!this.elements || !this.elements.length) {
      return '<div style="color:#94A3B8;font-size:.75rem;text-align:center;padding:12px;">Sem elementos carregados.</div>';
    }

    const disciplineIcons = {
      estrutural: '🏗️',
      arquitetura: '🏛️',
      hidraulica: '💧',
      eletrica: '⚡',
      mecanica: '🧊',
      fundacao: '🧱',
      site: '🌿'
    };

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="font-size:.65rem;color:#94A3B8;font-weight:800;text-transform:uppercase;">Disciplinas Modeladas (${this.elements.length})</span>
        <button type="button" id="bim-toggle-all-vis" style="background:transparent;border:none;color:#C6FF00;font-size:.62rem;font-weight:800;cursor:pointer;text-decoration:underline;">
          ${this.hiddenElementIds.size === 0 ? 'Ocultar Todas' : 'Mostrar Todas'}
        </button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${this.elements.map(elem => {
          const isHidden = this.hiddenElementIds.has(elem.id);
          const isSelected = this.selectedElement?.id === elem.id;
          const icon = disciplineIcons[elem.discipline] || '📦';
          const meshesCount = (elem.meshes || []).length;
          return `
            <div class="bim-tree-item ${isSelected ? 'selected' : ''}" data-elem-id="${Utils.escapeHtml(elem.id)}" style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:${isSelected ? 'rgba(198,255,0,0.12)' : '#0A1108'};border:1px solid ${isSelected ? '#C6FF00' : '#243518'};border-radius:6px;cursor:pointer;transition:background .15s;">
              <div style="display:flex;align-items:center;gap:7px;min-width:0;flex:1;">
                <span style="font-size:.85rem;">${icon}</span>
                <div style="min-width:0;flex:1;">
                  <div style="font-size:.72rem;font-weight:800;color:${isSelected ? '#C6FF00' : '#F0EAD6'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${Utils.escapeHtml(elem.name)}
                  </div>
                  <div style="font-size:.60rem;color:#94A3B8;">${meshesCount} peças 3D &middot; ${elem.discipline.toUpperCase()}</div>
                </div>
              </div>
              <button type="button" class="bim-vis-btn" data-elem-id="${Utils.escapeHtml(elem.id)}" title="${isHidden ? 'Exibir disciplina' : 'Ocultar disciplina'}" style="background:transparent;border:none;font-size:.80rem;cursor:pointer;padding:2px 4px;color:${isHidden ? '#64748B' : '#C6FF00'};opacity:${isHidden ? 0.45 : 1};">
                ${isHidden ? '👁️‍🗨️' : '👁️'}
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  /**
   * Renderiza o painel MEP Overview com métricas consolidadas de engenharia
   */
  _renderMepOverviewHtml() {
    const items = [
      { icon: '💧', label: 'Água Fria & Quente', desc: 'Reserva 3.000 L, Barrilete 50mm, Colunas 32mm e Ramais PPR', value: '255 m tubos', color: '#0EA5E9' },
      { icon: '🚽', label: 'Esgoto & Ventilação', desc: 'Tubos de queda 100mm, caixas sifonadas e coletor 150mm', value: '140 m rede', color: '#F8FAFC' },
      { icon: '⚡', label: 'Elétrica & Automação', desc: 'QDG 48 disj., eletrocalhas perfuradas, circuitos e spots LED', value: '18.5 kVA / 8 pts', color: '#EAB308' },
      { icon: '🧊', label: 'Climatização Central', desc: '2 Condensadoras VRF 8 HP, rede de dutos e 3 cassetes 4 vias', value: '16 HP / 48k BTU', color: '#38BDF8' },
      { icon: '🏊', label: 'Lazer, Piscina & Deck', desc: 'Piscina de concreto armado, espelho d\'água e deck de cumaru', value: '72 m² lazer', color: '#06B6D4' },
      { icon: '🏗️', label: 'Superestrutura', desc: '24 Pilares 30x30 cm, vigas de cinta e laje protendida', value: '145 m³ concreto', color: '#94A3B8' }
    ];

    return `
      <div style="font-size:.68rem;font-weight:900;color:#C6FF00;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">
        Quantitativos &amp; Engenharia MEP
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${items.map(it => `
          <div style="background:#0A1108;border:1px solid #243518;border-radius:8px;padding:8px 10px;display:flex;align-items:flex-start;gap:8px;">
            <span style="font-size:1.1rem;margin-top:1px;">${it.icon}</span>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:.72rem;font-weight:800;color:#F0EAD6;">${it.label}</span>
                <span style="font-size:.70rem;font-weight:900;color:${it.color};font-variant-numeric:tabular-nums;">${it.value}</span>
              </div>
              <p style="font-size:.62rem;color:#94A3B8;margin:2px 0 0;line-height:1.3;">${it.desc}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  /**
   * Vincula eventos da árvore e abas laterais
   */
  _bindTreeEvents() {
    // Toggles de visibilidade individual
    document.querySelectorAll('.bim-vis-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const elemId = e.currentTarget.getAttribute('data-elem-id');
        if (!elemId) return;
        if (this.hiddenElementIds.has(elemId)) {
          this.hiddenElementIds.delete(elemId);
        } else {
          this.hiddenElementIds.add(elemId);
        }
        this._lastRenderKey = '';
        this._refreshWorkstationUi();
      });
    });

    // Clique no item da árvore para selecionar
    document.querySelectorAll('.bim-tree-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const elemId = e.currentTarget.getAttribute('data-elem-id');
        const elem = this.elements.find(el => el.id === elemId);
        if (elem) {
          this.selectedElement = elem;
          this._lastRenderKey = '';
          const obra = (typeof DB !== 'undefined' && DB.getById('clientes', this.activeObraId)) || {};
          this._refreshWorkstationUi(obra);
        }
      });
    });

    // Toggle Mostrar/Ocultar Todas
    const toggleAllBtn = document.getElementById('bim-toggle-all-vis');
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener('click', () => {
        if (this.hiddenElementIds.size === 0) {
          this.elements.forEach(e => this.hiddenElementIds.add(e.id));
        } else {
          this.hiddenElementIds.clear();
        }
        this._lastRenderKey = '';
        this._refreshWorkstationUi();
      });
    }

    // Abas Esquerda (Tree vs Props)
    const tabTree = document.getElementById('bim-left-tab-tree');
    const tabProps = document.getElementById('bim-left-tab-props');
    const treeCont = document.getElementById('bim-tree-container');
    const propsCont = document.getElementById('bim-props-container');

    if (tabTree && tabProps && treeCont && propsCont) {
      tabTree.addEventListener('click', () => {
        tabTree.style.background = '#142210';
        tabTree.style.color = '#C6FF00';
        tabTree.style.borderBottom = '2px solid #C6FF00';
        tabProps.style.background = 'transparent';
        tabProps.style.color = '#94A3B8';
        tabProps.style.borderBottom = 'none';
        treeCont.style.display = 'flex';
        propsCont.style.display = 'none';
      });

      tabProps.addEventListener('click', () => {
        tabProps.style.background = '#142210';
        tabProps.style.color = '#C6FF00';
        tabProps.style.borderBottom = '2px solid #C6FF00';
        tabTree.style.background = 'transparent';
        tabTree.style.color = '#94A3B8';
        tabTree.style.borderBottom = 'none';
        propsCont.style.display = 'flex';
        treeCont.style.display = 'none';
        const obra = (typeof DB !== 'undefined' && DB.getById('clientes', this.activeObraId)) || {};
        this._refreshWorkstationUi(obra);
      });
    }

    // Abas Direita (MEP vs Costs)
    const tabMep = document.getElementById('bim-right-tab-mep');
    const tabCosts = document.getElementById('bim-right-tab-costs');
    const mepCont = document.getElementById('bim-mep-overview-panel');
    const costsCont = document.getElementById('bim-element-details');

    if (tabMep && tabCosts && mepCont && costsCont) {
      tabMep.addEventListener('click', () => {
        tabMep.style.background = '#142210';
        tabMep.style.color = '#C6FF00';
        tabMep.style.borderBottom = '2px solid #C6FF00';
        tabCosts.style.background = 'transparent';
        tabCosts.style.color = '#94A3B8';
        tabCosts.style.borderBottom = 'none';
        mepCont.style.display = 'flex';
        costsCont.style.display = 'none';
      });

      tabCosts.addEventListener('click', () => {
        tabCosts.style.background = '#142210';
        tabCosts.style.color = '#C6FF00';
        tabCosts.style.borderBottom = '2px solid #C6FF00';
        tabMep.style.background = 'transparent';
        tabMep.style.color = '#94A3B8';
        tabMep.style.borderBottom = 'none';
        costsCont.style.display = 'flex';
        mepCont.style.display = 'none';
      });
    }
  },

  /**
   * Desenha o Gizmo de Orientação 3D / Bússola no canto superior direito do viewport
   */
  _drawOrientationGizmo(w, h) {
    const gizmoX = w - 60;
    const gizmoY = 60;
    const size = 30;

    this.ctx.save();
    // Fundo circular de vidro escuro
    this.ctx.beginPath();
    this.ctx.arc(gizmoX, gizmoY, 36, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(10, 17, 8, 0.88)';
    this.ctx.fill();
    this.ctx.strokeStyle = '#243518';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Bússola e eixos 3D
    const axes = [
      { name: 'X', color: '#EF4444', vec: [size, 0, 0] },
      { name: 'Y', color: '#22C55E', vec: [0, size, 0] },
      { name: 'Z', color: '#38BDF8', vec: [0, 0, size] }
    ];

    const cosY = Math.cos(this.rotY), sinY = Math.sin(this.rotY);
    const cosX = Math.cos(this.rotX), sinX = Math.sin(this.rotX);

    const projectedAxes = axes.map(ax => {
      const [vx, vy, vz] = ax.vec;
      const x1 = vx * cosY + vz * sinY;
      const z1 = -vx * sinY + vz * cosY;
      const y2 = vy * cosX - z1 * sinX;
      const z2 = vy * sinX + z1 * cosX;
      return {
        ...ax,
        px: x1,
        py: -y2,
        pz: z2
      };
    });

    // Ordenar eixos por profundidade Z
    projectedAxes.sort((a, b) => a.pz - b.pz);

    projectedAxes.forEach(ax => {
      this.ctx.beginPath();
      this.ctx.moveTo(gizmoX, gizmoY);
      this.ctx.lineTo(gizmoX + ax.px, gizmoY + ax.py);
      this.ctx.strokeStyle = ax.color;
      this.ctx.lineWidth = 2.5;
      this.ctx.stroke();

      // Ponta do eixo / Letra
      this.ctx.fillStyle = ax.color;
      this.ctx.font = 'bold 9px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(ax.name, gizmoX + ax.px * 1.28, gizmoY + ax.py * 1.28);
    });

    // Rótulo da câmera
    const rotDegY = Math.round((this.rotY * 180) / Math.PI) % 360;
    const viewLabel = this.rotX > 1.2 ? 'TOP'
      : Math.abs(rotDegY) < 20 ? 'FACHADA'
      : Math.abs(rotDegY - 90) < 25 ? 'LESTE'
      : Math.abs(rotDegY + 90) < 25 ? 'OESTE'
      : 'ISO · NW';

    this.ctx.fillStyle = '#C6FF00';
    this.ctx.font = 'bold 8px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(viewLabel, gizmoX, gizmoY + 46);

    this.ctx.restore();
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
   * Gera a maquete volumétrica procedural detalhada com elementos arquitetônicos e todas as infraestruturas
   * Mansão Alto Padrão 480 m² (Orçamento R$ 1.000.000,00) com Estrutura, Alvenaria, Hidráulica, Elétrica, HVAC, Cobertura e Terreno.
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
    // 0. DISCIPLINA: TERRENO, PLATÔ & IMPLANTAÇÃO (site) — R$ 35.000
    // =========================================================================
    const siteMeshes = [
      // Platô principal do terreno gramado
      { type: 'box', x: -W/2 - 50, y: -48, z: -L/2 - 110, w: W + 100, h: 4, d: L + 160, color: '#143015', name: 'Platô Gramado de Implantação' },
      // Calçada de acesso em concreto estampado
      { type: 'box', x: -30, y: -46, z: L/2 + 10, w: 60, h: 3, d: 40, color: '#475569', name: 'Acesso Social em Concreto Usinado' },
      // Muro de divisa / contenção fundos
      { type: 'box', x: -W/2 - 45, y: -44, z: -L/2 - 105, w: W + 90, h: 28, d: 6, color: '#334155', name: 'Muro de Contenção e Divisa Fundos' },
      { type: 'box', x: -W/2 - 45, y: -44, z: -L/2 - 105, w: 6, h: 28, d: L + 150, color: '#334155', name: 'Muro Lateral Esquerdo' },
      { type: 'box', x: W/2 + 39,  y: -44, z: -L/2 - 105, w: 6, h: 28, d: L + 150, color: '#334155', name: 'Muro Lateral Direito' }
    ];

    this.elements.push({
      id: 'elem_terreno_site',
      name: 'Terreno, Platô, Calçadas & Muros',
      floor: 'fundacao',
      discipline: 'arquitetura',
      category: 'Implantação e Movimento de Terra',
      sinapiCode: '98462',
      sinapiDesc: 'Movimento de terra, escavação mecânica, regularização de terreno e calçadas perimetrais em concreto',
      orcado: 35000.00,
      realizado: 34200.00,
      executadoPct: 100,
      color: '#15803D',
      meshes: siteMeshes
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
      { type: 'box', x: -W/2 + 24, y: -4, z: -L/2 - 66, w: 72, h: 4, d: 52, color: 'rgba(6, 182, 212, 0.75)', isWater: true, name: 'Espelho d\'Água Piscina' },
      // Deck de Madeira Cumaru
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

      // Parede Garagem / Acesso Térreo Direito (Cutaway suave)
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
      { type: 'box', x: -W/2 + 10, y: yPav1 + 2, z: L/2 - 14, w: 90, h: H, d: 8, color: '#F1F5F9', name: 'Alvenaria Suíte Master & Closet' },
      // Porta-balcão de correr para a sacada
      { type: 'box', x: -36, y: yPav1 + 2, z: L/2 - 12, w: 56, h: 46, d: 3, color: 'rgba(56, 189, 248, 0.75)', isGlass: true, name: 'Porta-Balcão 4 Folhas Sacada' },
      // Janela do Quarto 2
      { type: 'box', x: 42, y: yPav1 + 14, z: L/2 - 12, w: 42, h: 32, d: 3, color: 'rgba(56, 189, 248, 0.75)', isGlass: true, name: 'Janela Quarto Superior' },

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
      { type: 'box', x: -44, y: yRoofBase + 8, z: -20, w: 32, h: 28, d: 32, color: '#0284C7', name: 'Caixa d\'Água Polietileno 1.500 L (Reserva 1)' },
      { type: 'box', x: 12,  y: yRoofBase + 8, z: -20, w: 32, h: 28, d: 32, color: '#0284C7', name: 'Caixa d\'Água Polietileno 1.500 L (Reserva 2)' },
      // Barrilete de Distribuição em PVC PBA
      { type: 'box', x: -46, y: yRoofBase + 2, z: -24, w: 92, h: 5, d: 6, color: '#0EA5E9', isPipe: true, name: 'Barrilete Geral de Distribuição (50mm)' }
    );

    // Colunas de Água Fria e Água Quente Descendo os Pavimentos
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
      name: 'Instalações Hidrossanitárias, Caixas d\'Água & Esgoto',
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

    // Filtrar elementos do pavimento ativo e visibilidade da árvore
    const visibleElements = this.elements.filter(elem => {
      if (this.hiddenElementIds && this.hiddenElementIds.has(elem.id)) return false;
      const floorOk = this.currentFloor === 'all' || elem.floor === 'all' || elem.floor === this.currentFloor;
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

    // Desenhar o Gizmo de Orientação 3D no canto superior direito
    this._drawOrientationGizmo(w, h);
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
        isBrick: meta.isBrick,
        isWater: meta.isWater,
        isPipe: meta.isPipe,
        isDuct: meta.isDuct,
        isElectric: meta.isElectric
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
    } else if (face.isWater) {
      this.ctx.fillStyle = isSelected ? 'rgba(198, 255, 0, 0.50)' : (color || 'rgba(6, 182, 212, 0.75)');
      this.ctx.fill();
      this.ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(165, 243, 252, 0.6)';
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
      this.ctx.strokeStyle = isSelected ? '#FFFFFF' : (face.isPipe || face.isElectric ? 'rgba(255, 255, 255, 0.35)' : 'rgba(15, 23, 42, 0.45)');
      this.ctx.lineWidth = isSelected ? 2 : (face.isPipe || face.isElectric ? 1.5 : 1);
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
      else if (mesh.isWater) materials.add('Água Tratada');
      else if (mesh.isPipe) materials.add('Tubulação Hidráulica / Esgoto');
      else if (mesh.isDuct) materials.add('Dutos Galvanizados Climatização');
      else if (mesh.isElectric) materials.add('Eletrodutos / Condutores');
      else if (mesh.isBrick) materials.add('Alvenaria Cerâmica');
      else if (mesh.isFrame) materials.add('Alumínio Linha Gold');
      else if (/madeira|cumaru/i.test(mesh.name || '')) materials.add('Madeira Cumaru');
      else if (/telha/i.test(mesh.name || '')) materials.add('Telha Cerâmica');
      else if (/concreto|sapata|viga|pilar|laje|baldrame/i.test(mesh.name || '')) materials.add('Concreto Armado CA-50');
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

  async _loadPresetModel(presetKey) {
    if (presetKey === 'sobrado_procedural') {
      this._restoreProceduralModel();
      return;
    }
    if (typeof BIMPresets === 'undefined' || typeof BIMGeometryImporter === 'undefined') {
      Utils.toast('Catálogo de modelos BIM indisponível.', 'warning');
      return;
    }
    if (presetKey === 'bim_multi_clash') {
      Utils.toast('Carregando coordenação multi-disciplinar (Estrutura + MEP + Arquitetura)...', 'info');
      try {
        const structScene = await BIMGeometryImporter.importContent(BIMPresets.ifc4_structural.content, 'estrutura.ifc', 'application/x-step');
        const hvacScene = await BIMGeometryImporter.importContent(BIMPresets.ifc4_hvac.content, 'hvac.ifc', 'application/x-step');
        const archScene = await BIMGeometryImporter.importContent(BIMPresets.ifc4_architecture.content, 'arquitetura.ifc', 'application/x-step');
        const combinedElements = [...structScene.elements, ...hvacScene.elements, ...archScene.elements];
        const combinedScene = {
          format: 'ifc',
          elements: combinedElements,
          triangleCount: structScene.triangleCount + hvacScene.triangleCount + archScene.triangleCount,
          clashEligible: true,
          geometryQuality: 'full',
          viewerScale: structScene.viewerScale
        };
        this._applyImportedScene(combinedScene, 'preset_multi_clash');
        this._runClashDetection();
        Utils.toast(`Coordenação carregada: ${combinedElements.length} elementos com análise de interferências.`, 'success');
      } catch (err) {
        Utils.toast('Erro ao carregar coordenação: ' + (err?.message || err), 'error');
      }
      return;
    }
    const preset = BIMPresets[presetKey];
    if (!preset) return;
    try {
      Utils.toast(`Carregando ${preset.name}...`, 'info');
      const scene = await BIMGeometryImporter.importContent(preset.content, preset.name + '.ifc', 'application/x-step');
      this._applyImportedScene(scene, 'preset_' + presetKey);
      Utils.toast(`${preset.name} carregado com sucesso (${scene.triangleCount.toLocaleString('pt-BR')} triângulos).`, 'success');
    } catch (err) {
      Utils.toast('Erro ao carregar modelo: ' + (err?.message || err), 'error');
    }
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
    const presetSelect = document.getElementById('bim-model-preset-select');
    if (presetSelect) presetSelect.value = 'sobrado_procedural';
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
        ${versions.length ? versions.slice(0, 10).map((doc, idx) => {
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
    const isProcedural = this.modelSource === 'procedural';
    const proceduralOrcado = this.elements?.reduce((s, e) => s + Number(e.orcado || 0), 0) || 1000000;
    const proceduralRealizado = this.elements?.reduce((s, e) => s + Number(e.realizado || 0), 0) || 845800;
    const displayOrcado = (Number(comp.totalOrcado || 0) > 0) ? Number(comp.totalOrcado) : (isProcedural ? proceduralOrcado : 0);
    const displayRealizado = (Number(comp.totalRealizado || 0) > 0) ? Number(comp.totalRealizado) : (isProcedural ? proceduralRealizado : 0);
    const fisico = Number(comp.percentualFisico || 0) > 0 ? Math.max(0, Math.min(100, Number(comp.percentualFisico))) : (isProcedural && displayOrcado > 0 ? Math.round((displayRealizado / displayOrcado) * 100) : 0);
    const schedule = this._getScheduleStatus(snapshot);
    const cards = [
      ['Orçado', Utils.fmt.currency(displayOrcado), '#F0F0E8'],
      ['Custo realizado', Utils.fmt.currency(displayRealizado), '#F59E0B'],
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
    if (!comp.etapas || !comp.etapas.length) return;
    const stageMap = new Map((comp.etapas || []).map(e => [String(e.id || '').toLowerCase(), e]));
    const allocations = {
      fundacao: ['elem_fundacao'],
      estrutura: ['elem_estrutura_concreto'],
      alvenaria: ['elem_arquitetura_alvenaria'],
      hidraulica: ['elem_hidraulica_sanitario'],
      eletrica: ['elem_eletrica_automacao'],
      mecanica: ['elem_climatizacao_hvac'],
      cobertura: ['elem_cobertura_telhado']
    };

    Object.entries(allocations).forEach(([stageId, ids]) => {
      const stage = stageMap.get(stageId);
      if (!stage) return;
      const targets = ids.map(id => this.elements.find(e => e.id === id)).filter(Boolean);
      if (!targets.length) return;
      const divisor = targets.length;
      targets.forEach(elem => {
        elem.orcado = Number(stage.previsto || 0) / divisor;
        elem.realizado = Number(stage.realizado || 0) / divisor;
        if (Number(comp.percentualFisico || 0) > 0) {
          elem.executadoPct = Math.max(0, Math.min(100, Number(comp.percentualFisico || 0)));
          elem.progressLabel = 'Avanço físico medido';
        } else {
          elem.executadoPct = Math.max(0, Math.min(100, Number(stage.percentual || 0)));
          elem.progressLabel = 'Avanço financeiro da etapa';
        }
        elem.dataSource = 'Orçamento, despesas e medições reais vinculados à obra';
      });
    });
  },

  _stageKeyForElement(elem) {
    if (!elem) return 'outros';
    if (elem.id === 'elem_fundacao' || elem.floor === 'fundacao') return 'fundacao';
    if (elem.id === 'elem_estrutura_concreto') return 'estrutura';
    if (elem.id === 'elem_arquitetura_alvenaria') return 'alvenaria';
    if (elem.id === 'elem_hidraulica_sanitario' || elem.discipline === 'hidraulica') return 'hidraulica';
    if (elem.id === 'elem_eletrica_automacao' || elem.discipline === 'eletrica') return 'eletrica';
    if (elem.id === 'elem_climatizacao_hvac' || elem.discipline === 'mecanica') return 'mecanica';
    if (elem.id === 'elem_cobertura_telhado' || elem.floor === 'cobertura') return 'cobertura';
    return 'outros';
  },

  _recentLancamentosForElement(elem) {
    const all = this.financialSnapshot?.lancamentos || [];
    const stage = this._stageKeyForElement(elem);
    const keywords = {
      fundacao: ['fundacao','fundação','concreto','ferro','aço','aco','sapata','baldrame','radier','geotecnia'],
      estrutura: ['pilar','viga','laje','concreto','armacao','escoramento','forma','protendido'],
      alvenaria: ['alvenaria','tijolo','bloco','argamassa','reboco','chapisco','parede','vidro','esquadria','porta','gourmet'],
      hidraulica: ['hidraulica','hidráulica','tubo','pvc','ppr','esgoto','barrilete','caixa','cano','valvula','sifao','ralo'],
      eletrica: ['eletrica','elétrica','cabo','fio','disjuntor','quadro','eletrocalha','eletroduto','luminaria','led','interruptor','tomada'],
      mecanica: ['ar condicionado','ar-condicionado','climatizacao','climatização','vrf','split','cassete','duto','refrigeracao'],
      cobertura: ['cobertura','telha','telhado','madeiramento','calha','rufo','cumeeira','oitão','tesoura','impermeabil']
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

    const presetSelect = document.getElementById('bim-model-preset-select');
    if (presetSelect) {
      presetSelect.addEventListener('change', async (e) => {
        await this._loadPresetModel(e.target.value);
      });
    }

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
