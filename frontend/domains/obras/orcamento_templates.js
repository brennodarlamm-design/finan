// js/orcamento_templates.js — Módulo de Modelos Prontos de Orçamento (Templates SINAPI)
// Suporta catálogo oficial (Casa 100m², MCMV 56m² e 68m², Entrada de Energia, Creche FNDE, etc.),
// pré-visualização analítica (ACESSAR), clonagem para obra ativa e criação de modelos a partir de orçamentos.

const OrcamentoTemplates = {

  _KEY: 'finobra_orcamento_templates_custom',
  _filtroCategoria: 'todos',
  _filtroBusca: '',
  _templateSelecionadoId: null,

  // Catálogo Oficial Pré-Configurado (referência fiel ao screenshot)
  TEMPLATES_PADRAO: [
    {
      id: 'tpl-casa-medio-100',
      nome: 'CASA PADRÃO MÉDIO 100 M² - 2025',
      subtitulo: 'CASA PADRÃO MÉDIO 100 M² - 2025',
      categoria: 'residencial',
      icone: '🏡',
      valorEstimado: 659723.59,
      bdi: 24.23,
      etapas: [
        {
          id: 'et-1',
          ordem: '1',
          nome: '1 - SERVIÇOS PRELIMINARES E CANTEIRO',
          itens: [
            { id: 'i-101', tipo: 'COMP', banco: 'SINAPI', codigo: '98458', descricao: 'Tapume de chapa de madeira compensada resinada, e = 10mm', unidade: 'm²', quantidade: 60, preco_unitario: 85.40, preco_com_bdi: 106.09, total: 6365.40 },
            { id: 'i-102', tipo: 'COMP', banco: 'SINAPI', codigo: '99059', descricao: 'Locação convencional de obra através de gabarito de tábuas corridas', unidade: 'm', quantidade: 45, preco_unitario: 34.20, preco_com_bdi: 42.49, total: 1912.05 }
          ]
        },
        {
          id: 'et-2',
          ordem: '2',
          nome: '2 - MOVIMENTO DE TERRA E FUNDAÇÕES',
          itens: [
            { id: 'i-201', tipo: 'COMP', banco: 'SINAPI', codigo: '96523', descricao: 'Escavação manual de vala para viga baldrame com profundidade até 1,5m', unidade: 'm³', quantidade: 28, preco_unitario: 68.90, preco_com_bdi: 85.59, total: 2396.52 },
            { id: 'i-202', tipo: 'COMP', banco: 'SINAPI', codigo: '96546', descricao: 'Armação de bloco, viga baldrame ou sapata utilizando aço CA-50 de 10,0mm', unidade: 'kg', quantidade: 420, preco_unitario: 14.80, preco_com_bdi: 18.39, total: 7723.80 },
            { id: 'i-203', tipo: 'COMP', banco: 'SINAPI', codigo: '94970', descricao: 'Concreto fck=25MPa usinado, bombeado para fundações', unidade: 'm³', quantidade: 18, preco_unitario: 520.00, preco_com_bdi: 646.00, total: 11628.00 }
          ]
        },
        {
          id: 'et-3',
          ordem: '3',
          nome: '3 - ESTRUTURA E ALVENARIA',
          itens: [
            { id: 'i-301', tipo: 'COMP', banco: 'SINAPI', codigo: '89985', descricao: 'Alvenaria de vedação de blocos cerâmicos furados 9x19x19cm com argamassa mista', unidade: 'm²', quantidade: 280, preco_unitario: 78.50, preco_com_bdi: 97.52, total: 27305.60 },
            { id: 'i-302', tipo: 'COMP', banco: 'SINAPI', codigo: '92778', descricao: 'Laje pré-moldada unidirecional para forro com vigota em concreto armado', unidade: 'm²', quantidade: 100, preco_unitario: 115.00, preco_com_bdi: 142.86, total: 14286.00 }
          ]
        },
        {
          id: 'et-4',
          ordem: '4',
          nome: '4 - COBERTURA E TELHADO',
          itens: [
            { id: 'i-401', tipo: 'COMP', banco: 'SINAPI', codigo: '94210', descricao: 'Telhamento com telha cerâmica tipo colonial ou portuguesa', unidade: 'm²', quantidade: 135, preco_unitario: 88.00, preco_com_bdi: 109.32, total: 14758.20 }
          ]
        },
        {
          id: 'et-5',
          ordem: '5',
          nome: '5 - INSTALAÇÕES HIDRÁULICAS, ELÉTRICAS E ACABAMENTOS',
          itens: [
            { id: 'i-501', tipo: 'COMP', banco: 'SINAPI', codigo: '91953', descricao: 'Ponto de tomada média/alta 10A/250V incluindo fiação, eletroduto e placa', unidade: 'pt', quantidade: 42, preco_unitario: 92.40, preco_com_bdi: 114.79, total: 4821.18 },
            { id: 'i-502', tipo: 'COMP', banco: 'SINAPI', codigo: '89707', descricao: 'Ponto de esgoto primário e secundário completo em tubos de PVC', unidade: 'pt', quantidade: 18, preco_unitario: 145.00, preco_com_bdi: 180.13, total: 3242.34 },
            { id: 'i-503', tipo: 'COMP', banco: 'SINAPI', codigo: '87265', descricao: 'Revestimento cerâmico para piso retificado assentado com argamassa AC-II', unidade: 'm²', quantidade: 100, preco_unitario: 89.90, preco_com_bdi: 111.68, total: 11168.00 },
            { id: 'i-504', tipo: 'COMP', banco: 'SINAPI', codigo: '88489', descricao: 'Pintura látex acrílica premium em paredes internas, duas demãos', unidade: 'm²', quantidade: 380, preco_unitario: 32.50, preco_com_bdi: 40.37, total: 15340.60 }
          ]
        }
      ]
    },
    {
      id: 'tpl-mcmv-56',
      nome: 'RESIDÊNCIA UNIFAMILIAR MINHA CASA MINHA VIDA 56 M² (R1)',
      subtitulo: 'MCMV COM 56 M² (R1) - (USAR COMO REFERÊNCIA E AJUSTAR PARA SUA REALIDADE)',
      categoria: 'residencial',
      icone: '🏡',
      valorEstimado: 138303.76,
      bdi: 22.50,
      etapas: [
        {
          id: 'm1',
          ordem: '1',
          nome: '1 - SERVIÇOS INICIAIS E ESTRUTURA R1',
          itens: [
            { id: 'mi-1', tipo: 'COMP', banco: 'SINAPI', codigo: '98458', descricao: 'Canteiro e locação de obra unifamiliar 56m²', unidade: 'un', quantidade: 1, preco_unitario: 3800.00, preco_com_bdi: 4655.00, total: 4655.00 },
            { id: 'mi-2', tipo: 'COMP', banco: 'SINAPI', codigo: '96546', descricao: 'Fundação radier em concreto armado e = 12cm', unidade: 'm²', quantidade: 56, preco_unitario: 240.00, preco_com_bdi: 294.00, total: 16464.00 }
          ]
        },
        {
          id: 'm2',
          ordem: '2',
          nome: '2 - ALVENARIA, COBERTURA E INSTALAÇÕES',
          itens: [
            { id: 'mi-3', tipo: 'COMP', banco: 'SINAPI', codigo: '89985', descricao: 'Alvenaria bloco estrutural cerâmico 14x19x29cm', unidade: 'm²', quantidade: 165, preco_unitario: 62.00, preco_com_bdi: 75.95, total: 12531.75 },
            { id: 'mi-4', tipo: 'COMP', banco: 'SINAPI', codigo: '94210', descricao: 'Cobertura em telha de fibrocimento sem amianto 6mm com engradamento metálico', unidade: 'm²', quantidade: 72, preco_unitario: 78.00, preco_com_bdi: 95.55, total: 6879.60 },
            { id: 'mi-5', tipo: 'COMP', banco: 'SINAPI', codigo: '87265', descricao: 'Piso cerâmico padrão popular PEI-4', unidade: 'm²', quantidade: 56, preco_unitario: 64.00, preco_com_bdi: 78.40, total: 4390.40 }
          ]
        }
      ]
    },
    {
      id: 'tpl-mcmv-68',
      nome: 'RESIDÊNCIA UNIFAMILIAR MINHA CASA MINHA VIDA 68 M²',
      subtitulo: 'MCMV COM 68 M² (USAR COMO REFERÊNCIA E AJUSTAR PARA SUA REALIDADE)',
      categoria: 'residencial',
      icone: '🏡',
      valorEstimado: 146010.93,
      bdi: 22.50,
      etapas: [
        {
          id: 'm68-1',
          ordem: '1',
          nome: '1 - INFRAESTRUTURA E SUPRAESTRUTURA 68M²',
          itens: [
            { id: 'm68i-1', tipo: 'COMP', banco: 'SINAPI', codigo: '96546', descricao: 'Radier em concreto fck=25MPa armado com tela soldada', unidade: 'm²', quantidade: 68, preco_unitario: 245.00, preco_com_bdi: 300.12, total: 20408.16 },
            { id: 'm68i-2', tipo: 'COMP', banco: 'SINAPI', codigo: '89985', descricao: 'Alvenaria estrutural cerâmica modulada', unidade: 'm²', quantidade: 195, preco_unitario: 63.50, preco_com_bdi: 77.78, total: 15167.10 }
          ]
        }
      ]
    },
    {
      id: 'tpl-energia-padrao',
      nome: 'MODELO PADRÃO DE ENTRADA DE ENERGIA ELÉTRICA',
      subtitulo: 'MODELO PADRÃO DE ENTRADA DE ENERGIA ELÉTRICA - MONOFÁSICO, BIFÁSICO E TRIFÁSICO',
      categoria: 'infraestrutura',
      icone: '🧱',
      valorEstimado: 11528.59,
      bdi: 20.00,
      etapas: [
        {
          id: 'en-1',
          ordem: '1',
          nome: '1 - PADRÃO DE ENTRADA E MEDIÇÃO',
          itens: [
            { id: 'eni-1', tipo: 'COMP', banco: 'SINAPI', codigo: '101878', descricao: 'Poste de concreto armado circular 7m 200daN para entrada de energia', unidade: 'un', quantidade: 1, preco_unitario: 1420.00, preco_com_bdi: 1704.00, total: 1704.00 },
            { id: 'eni-2', tipo: 'COMP', banco: 'SINAPI', codigo: '101880', descricao: 'Caixa de medição padrão concessionária monofásica/trifásica em policarbonato', unidade: 'un', quantidade: 1, preco_unitario: 650.00, preco_com_bdi: 780.00, total: 780.00 },
            { id: 'eni-3', tipo: 'COMP', banco: 'SINAPI', codigo: '101885', descricao: 'Disjuntor termomagnético tripolar 63A curva C com barramento e cabeamento', unidade: 'un', quantidade: 1, preco_unitario: 310.00, preco_com_bdi: 372.00, total: 372.00 },
            { id: 'eni-4', tipo: 'COMP', banco: 'SINAPI', codigo: '101890', descricao: 'Haste de aterramento tipo cooperweld 5/8x2,40m com conector e caixa de inspeção', unidade: 'cj', quantidade: 3, preco_unitario: 185.00, preco_com_bdi: 222.00, total: 666.00 }
          ]
        }
      ]
    },
    {
      id: 'tpl-creche-fnde',
      nome: 'CRECHE TIPO 2 - OPÇÃO 220V - FNDE - TIPO2-PLN-AT8-S220_R02',
      subtitulo: 'CRECHE TIPO 2 - OPÇÃO 220V - FNDE',
      categoria: 'publico',
      icone: '🏫',
      valorEstimado: 2892875.43,
      bdi: 24.23,
      etapas: [
        {
          id: 'cr-1',
          ordem: '1',
          nome: '1 - SERVIÇOS PRELIMINARES E TERRENO (FNDE)',
          itens: [
            { id: 'cri-1', tipo: 'COMP', banco: 'SINAPI', codigo: '98458', descricao: 'Canteiro de obras institucional com barracão e instalações provisórias', unidade: 'm²', quantidade: 120, preco_unitario: 340.00, preco_com_bdi: 422.38, total: 50685.60 }
          ]
        },
        {
          id: 'cr-2',
          ordem: '2',
          nome: '2 - BLOCO PEDAGÓGICO, REFEITÓRIO E ADMINISTRAÇÃO',
          itens: [
            { id: 'cri-2', tipo: 'COMP', banco: 'SINAPI', codigo: '94970', descricao: 'Estrutura pré-fabricada em concreto armado e telhas termoacústicas', unidade: 'm²', quantidade: 890, preco_unitario: 1250.00, preco_com_bdi: 1552.88, total: 1382063.20 }
          ]
        }
      ]
    },
    {
      id: 'tpl-galpao-ind',
      nome: 'GALPÃO INDUSTRIAL PRÉ-MOLDADO 500 M²',
      subtitulo: 'ESTRUTURA METÁLICA, PISO INDUSTRIAL E FECHAMENTO LATERAL',
      categoria: 'comercial',
      icone: '🏭',
      valorEstimado: 412500.00,
      bdi: 21.00,
      etapas: [
        {
          id: 'gp-1',
          ordem: '1',
          nome: '1 - FUNDAÇÕES E PISO INDUSTRIAL DE ALTA RESISTÊNCIA',
          itens: [
            { id: 'gpi-1', tipo: 'COMP', banco: 'SINAPI', codigo: '96546', descricao: 'Piso industrial de concreto polido fck=30MPa com fibra e junta de dilatação', unidade: 'm²', quantidade: 500, preco_unitario: 195.00, preco_com_bdi: 235.95, total: 117975.00 }
          ]
        }
      ]
    },
    {
      id: 'tpl-reforma-res',
      nome: 'REFORMA RESIDENCIAL COMPLETA',
      subtitulo: 'DEMOLIÇÃO, PISOS, HIDRÁULICA, ELÉTRICA E PINTURA',
      categoria: 'reforma',
      icone: '🔨',
      valorEstimado: 84950.00,
      bdi: 20.00,
      etapas: [
        {
          id: 'rf-1',
          ordem: '1',
          nome: '1 - DEMOLIÇÕES E RETIRADAS',
          itens: [
            { id: 'rfi-1', tipo: 'COMP', banco: 'SINAPI', codigo: '97622', descricao: 'Demolição de revestimento cerâmico e piso com caçamba de entulho', unidade: 'm²', quantidade: 90, preco_unitario: 42.00, preco_com_bdi: 50.40, total: 4536.00 }
          ]
        }
      ]
    },
    {
      id: 'tpl-pavimentacao',
      nome: 'PAVIMENTAÇÃO POLIÉDRICA E DRENAGEM',
      subtitulo: 'PAVIMENTAÇÃO EM PARALELEPÍPEDO, GUIAS E SARJETAS',
      categoria: 'infraestrutura',
      icone: '🛣️',
      valorEstimado: 195400.00,
      bdi: 22.00,
      etapas: [
        {
          id: 'pv-1',
          ordem: '1',
          nome: '1 - REGULARIZAÇÃO E CALÇAMENTO',
          itens: [
            { id: 'pvi-1', tipo: 'COMP', banco: 'DER-PR', codigo: '510300', descricao: 'Decapagem pedreira e limpeza periódica p/ pav. poliédrico', unidade: 'm²', quantidade: 1800, preco_unitario: 2.85, preco_com_bdi: 3.47, total: 6246.00 }
          ]
        }
      ]
    }
  ],

  // Retorna todos os templates (padrão + customizados da empresa)
  getAllTemplates() {
    const custom = this._getCustomTemplates();
    return [...this.TEMPLATES_PADRAO, ...custom];
  },

  _getCustomTemplates() {
    try {
      return JSON.parse(localStorage.getItem(this._KEY) || '[]');
    } catch { return []; }
  },

  _saveCustomTemplates(list) {
    try {
      localStorage.setItem(this._KEY, JSON.stringify(list));
    } catch {}
  },

  // Modal principal de visualização do catálogo (Screenshot 1)
  abrirModalCatalogo() {
    this._filtroBusca = '';
    this._filtroCategoria = 'todos';
    this._templateSelecionadoId = null;
    this._renderModal();
  },

  _renderModal() {
    let templates = this.getAllTemplates();
    const e = Utils.escapeHtml.bind(Utils);

    if (this._filtroCategoria !== 'todos') {
      templates = templates.filter(t => t.categoria === this._filtroCategoria);
    }
    if (this._filtroBusca) {
      const q = this._filtroBusca.toLowerCase();
      templates = templates.filter(t => t.nome.toLowerCase().includes(q) || (t.subtitulo || '').toLowerCase().includes(q));
    }

    Utils.showModal(`
      <div class="modal" id="modal-orcs-prontos" style="max-width:980px;width:95vw;padding:0;overflow:hidden;display:flex;flex-direction:column;max-height:90vh;border-radius:var(--r-lg);">
        
        <!-- Header Escuro idêntico ao Screenshot 1 -->
        <div style="background:#23272d;color:#fff;padding:14px 22px;display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:1px solid #333840;flex-wrap:wrap;">
          
          <div style="display:flex;align-items:center;gap:14px;">
            <span style="font-weight:700;font-size:1.2rem;letter-spacing:.2px;">Orçamentos prontos</span>
            
            <!-- Dropdown 'Todos' -->
            <select
              class="form-control"
              style="background:#333842;color:#fff;border:1px solid #454d59;height:36px;padding:4px 10px;font-size:.85rem;border-radius:6px;"
              data-fb-change="OrcamentoTemplates._onCategoriaChange"
              data-fb-change-n="1"
              data-fb-change-t0="value"
            >
              <option value="todos" ${this._filtroCategoria==='todos'?'selected':''}>Todos</option>
              <option value="residencial" ${this._filtroCategoria==='residencial'?'selected':''}>Residencial</option>
              <option value="comercial" ${this._filtroCategoria==='comercial'?'selected':''}>Comercial</option>
              <option value="publico" ${this._filtroCategoria==='publico'?'selected':''}>Público / FNDE</option>
              <option value="infraestrutura" ${this._filtroCategoria==='infraestrutura'?'selected':''}>Infraestrutura</option>
              <option value="reforma" ${this._filtroCategoria==='reforma'?'selected':''}>Reformas</option>
            </select>
          </div>

          <!-- Busca 'BUSCAR [Pesquisar...]' -->
          <div style="display:flex;align-items:center;background:#1b1e23;border:1px solid #454d59;border-radius:6px;overflow:hidden;min-width:240px;height:36px;">
            <span style="color:#aaa;font-size:.78rem;font-weight:700;padding:0 10px;border-right:1px solid #454d59;display:flex;align-items:center;gap:4px;">
              🔍 BUSCAR
            </span>
            <input
              type="text"
              id="busca-templates-input"
              style="background:transparent;border:none;color:#fff;padding:6px 12px;font-size:.85rem;outline:none;width:100%;"
              placeholder="Pesquisar..."
              value="${e(this._filtroBusca)}"
              data-fb-input="OrcamentoTemplates._onBuscaInput"
              data-fb-input-n="1"
              data-fb-input-t0="value"
            >
          </div>

        </div>

        <!-- Barra de Ações: + CRIAR ORÇAMENTO DO MODELO e REMOVER -->
        <div style="background:#f8fafc;padding:12px 22px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;gap:10px;">
            <button
              type="button"
              class="btn btn-primary"
              style="font-weight:700;font-size:.85rem;display:flex;align-items:center;gap:6px;border-radius:6px;"
              data-fb-click="OrcamentoTemplates._promptCriarDoSelecionado"
              data-fb-click-n="0"
            >
              <span style="font-size:1.1rem;line-height:1;">+</span> CRIAR ORÇAMENTO DO MODELO
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              style="font-weight:700;font-size:.85rem;color:#ef4444;border-color:#fca5a5;background:#fff;display:flex;align-items:center;gap:6px;border-radius:6px;"
              data-fb-click="OrcamentoTemplates._removerSelecionado"
              data-fb-click-n="0"
            >
              🗑️ REMOVER
            </button>
          </div>

          <button class="modal-close" style="color:#64748b;background:transparent;border:none;font-size:1.3rem;cursor:pointer;" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>

        <!-- Tabela com Cabeçalho Escuro: ACESSAR | MODELO DE ORÇAMENTO -->
        <div style="overflow-y:auto;flex:1;background:#fff;">
          
          <div style="background:#3a3f47;color:#fff;display:grid;grid-template-columns:120px 1fr 180px;padding:10px 20px;font-size:.78rem;font-weight:800;letter-spacing:.5px;">
            <div>ACESSAR</div>
            <div>MODELO DE ORÇAMENTO</div>
            <div style="text-align:right;">VALOR ESTIMADO</div>
          </div>

          <!-- Linhas do Grid -->
          <div id="lista-templates-rows">
            ${templates.map((tpl, i) => `
              <div
                class="tpl-row"
                style="display:grid;grid-template-columns:120px 1fr 180px;align-items:center;padding:14px 20px;border-bottom:1px solid #f1f5f9;cursor:pointer;background:${this._templateSelecionadoId===tpl.id?'#f0fdf4':'#fff'};transition:background .15s;"
                data-fb-click="OrcamentoTemplates._selecionarLinha"
                data-fb-click-n="1"
                data-fb-click-t0="string"
                data-fb-click-v0="${encodeURIComponent(tpl.id)}"
              >
                <!-- Coluna ACESSAR -->
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="font-size:1.6rem;">${tpl.icone || '🏠'}</span>
                  <button
                    type="button"
                    class="btn btn-link btn-sm"
                    style="color:#2563eb;font-weight:800;font-size:.82rem;text-decoration:underline;letter-spacing:.3px;padding:0;cursor:pointer;"
                    data-fb-click="OrcamentoTemplates.visualizarTemplate"
                    data-fb-click-n="1"
                    data-fb-click-t0="string"
                    data-fb-click-v0="${encodeURIComponent(tpl.id)}"
                  >
                    ACESSAR
                  </button>
                </div>

                <!-- Coluna MODELO DE ORÇAMENTO -->
                <div>
                  <div style="font-weight:800;font-size:.9rem;color:#1e293b;">
                    ${e(tpl.nome)}
                  </div>
                  <div style="font-size:.8rem;color:#64748b;margin-top:3px;display:flex;align-items:center;gap:6px;">
                    <span>➔</span>
                    <span>${e(tpl.subtitulo || tpl.nome)}</span>
                  </div>
                </div>

                <!-- Coluna VALOR ESTIMADO -->
                <div style="text-align:right;font-weight:800;font-size:.95rem;color:#334155;">
                  ${Utils.fmt.currency(tpl.valorEstimado)}
                </div>
              </div>
            `).join('')}

            ${!templates.length ? `
              <div style="padding:40px;text-align:center;color:#94a3b8;">
                <div style="font-size:2.5rem;margin-bottom:10px;">🔍</div>
                <h3>Nenhum modelo de orçamento encontrado</h3>
                <p>Altere o termo da busca ou o filtro de categoria.</p>
              </div>
            ` : ''}
          </div>

        </div>

      </div>
    `);
  },

  _onCategoriaChange(cat) {
    this._filtroCategoria = cat;
    this._renderModal();
  },

  _onBuscaInput(q) {
    this._filtroBusca = q;
    this._renderModal();
    const input = document.getElementById('busca-templates-input');
    if (input) {
      input.focus();
      input.setSelectionRange(q.length, q.length);
    }
  },

  _selecionarLinha(id) {
    this._templateSelecionadoId = id;
    this._renderModal();
  },

  // Visualiza o modelo detalhado com todas as suas etapas e composições (ACESSAR)
  visualizarTemplate(id) {
    const tpl = this.getAllTemplates().find(t => t.id === id);
    if (!tpl) return;
    const e = Utils.escapeHtml.bind(Utils);

    Utils.showModal(`
      <div class="modal" style="max-width:900px;width:95vw;padding:0;overflow:hidden;display:flex;flex-direction:column;max-height:88vh;border-radius:var(--r-lg);">
        
        <!-- Header -->
        <div style="background:#23272d;color:#fff;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #333840;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:1.8rem;">${tpl.icone || '🏠'}</span>
            <div>
              <div style="font-weight:800;font-size:1.15rem;">${e(tpl.nome)}</div>
              <div style="font-size:.78rem;color:#94a3b8;margin-top:2px;">${e(tpl.subtitulo || '')} &nbsp;|&nbsp; BDI Estimado: ${tpl.bdi}%</div>
            </div>
          </div>
          <button class="modal-close" style="color:#aaa;background:transparent;border:none;font-size:1.3rem;cursor:pointer;" data-fb-click="OrcamentoTemplates.abrirModalCatalogo" data-fb-click-n="0">✕</button>
        </div>

        <!-- Corpo com as Etapas do Template -->
        <div class="modal-body" style="padding:20px 24px;overflow-y:auto;flex:1;background:#f8fafc;">
          
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:.75rem;text-transform:uppercase;color:#64748b;font-weight:700;">Valor Total de Referência</div>
              <div style="font-size:1.4rem;font-weight:900;color:#0f172a;margin-top:2px;">${Utils.fmt.currency(tpl.valorEstimado)}</div>
            </div>
            <button
              type="button"
              class="btn btn-primary"
              style="font-weight:700;font-size:.9rem;padding:10px 20px;"
              data-fb-click="OrcamentoTemplates.instanciarParaObra"
              data-fb-click-n="1"
              data-fb-click-t0="string"
              data-fb-click-v0="${encodeURIComponent(tpl.id)}"
            >
              ⚡ Usar Este Modelo na Minha Obra
            </button>
          </div>

          <!-- Acordeão das Etapas e Itens -->
          ${tpl.etapas.map(et => `
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:14px;overflow:hidden;">
              <div style="background:#f1f5f9;padding:12px 18px;font-weight:800;font-size:.88rem;color:#1e293b;border-bottom:1px solid #e2e8f0;">
                ${e(et.nome)}
              </div>
              <div style="padding:0;">
                <table style="width:100%;border-collapse:collapse;font-size:.82rem;">
                  <thead>
                    <tr style="background:#fafafa;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:.74rem;">
                      <th style="padding:8px 12px;text-align:left;">Tipo</th>
                      <th style="padding:8px 12px;text-align:left;">Banco</th>
                      <th style="padding:8px 12px;text-align:left;">Código</th>
                      <th style="padding:8px 12px;text-align:left;">Descrição</th>
                      <th style="padding:8px 12px;text-align:center;">Unid.</th>
                      <th style="padding:8px 12px;text-align:right;">Qtd</th>
                      <th style="padding:8px 12px;text-align:right;">Preço Unit.</th>
                      <th style="padding:8px 12px;text-align:right;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${et.itens.map(item => `
                      <tr style="border-bottom:1px solid #f8fafc;">
                        <td style="padding:8px 12px;">
                          <span style="background:${item.tipo==='COMP'?'#ede9fe':'#fef3c7'};color:${item.tipo==='COMP'?'#6d28d9':'#b45309'};font-weight:800;font-size:.68rem;padding:2px 6px;border-radius:4px;">
                            ${e(item.tipo)}
                          </span>
                        </td>
                        <td style="padding:8px 12px;font-weight:600;color:#64748b;font-size:.75rem;">${e(item.banco)}</td>
                        <td style="padding:8px 12px;font-family:monospace;font-weight:700;color:#2563eb;">${e(item.codigo)}</td>
                        <td style="padding:8px 12px;color:#334155;">${e(item.descricao)}</td>
                        <td style="padding:8px 12px;text-align:center;color:#64748b;">${e(item.unidade)}</td>
                        <td style="padding:8px 12px;text-align:right;font-weight:700;">${item.quantidade}</td>
                        <td style="padding:8px 12px;text-align:right;color:#059669;">${Utils.fmt.currency(item.preco_unitario)}</td>
                        <td style="padding:8px 12px;text-align:right;font-weight:800;color:#0f172a;">${Utils.fmt.currency(item.total)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `).join('')}

        </div>

        <!-- Footer -->
        <div style="background:#f8fafc;padding:12px 24px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
          <button type="button" class="btn btn-secondary" data-fb-click="OrcamentoTemplates.abrirModalCatalogo" data-fb-click-n="0">
            ← Voltar aos Modelos
          </button>
          <button type="button" class="btn btn-primary" style="font-weight:700;" data-fb-click="OrcamentoTemplates.instanciarParaObra" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(tpl.id)}">
            + Criar Orçamento a partir deste Modelo
          </button>
        </div>

      </div>
    `);
  },

  _promptCriarDoSelecionado() {
    if (!this._templateSelecionadoId) {
      Utils.toast('Selecione um modelo de orçamento na lista primeiro!', 'warning');
      return;
    }
    this.instanciarParaObra(this._templateSelecionadoId);
  },

  _removerSelecionado() {
    if (!this._templateSelecionadoId) {
      Utils.toast('Selecione um modelo para remover.', 'warning');
      return;
    }
    const isDefault = this.TEMPLATES_PADRAO.some(t => t.id === this._templateSelecionadoId);
    if (isDefault) {
      Utils.toast('Modelos padrão oficiais do sistema não podem ser removidos.', 'info');
      return;
    }

    Utils.confirm('Deseja realmente remover este modelo personalizado?', () => {
      let custom = this._getCustomTemplates().filter(t => t.id !== this._templateSelecionadoId);
      this._saveCustomTemplates(custom);
      this._templateSelecionadoId = null;
      this._renderModal();
      Utils.toast('Modelo removido com sucesso!', 'success');
    });
  },

  // Cria um novo orçamento real na obra selecionada pelo usuário a partir do template
  instanciarParaObra(templateId) {
    const tpl = this.getAllTemplates().find(t => t.id === templateId);
    if (!tpl) return;
    const e = Utils.escapeHtml.bind(Utils);

    Utils.showModal(`
      <div class="modal" style="max-width:520px;padding:0;overflow:hidden;border-radius:var(--r-lg);">
        <div style="background:#23272d;color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-weight:800;font-size:1.1rem;">⚡ Criar Orçamento do Modelo</span>
          <button class="modal-close" style="color:#aaa;background:transparent;border:none;font-size:1.3rem;cursor:pointer;" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>

        <div class="modal-body" style="padding:20px;">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:12px 14px;border-radius:6px;margin-bottom:16px;color:#166534;font-size:.85rem;">
            Você está criando um novo orçamento baseado no template <strong>${e(tpl.nome)}</strong>.
          </div>

          <form id="f-instanciar-template">
            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="font-weight:700;">Obra / Cliente de Destino *</label>
              <select class="form-control" name="obra_id" required>
                ${Utils.clienteOptions(App.obraId !== 'todas' ? App.obraId : '')}
              </select>
            </div>

            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="font-weight:700;">Nome do Novo Orçamento *</label>
              <input class="form-control" name="nome" value="${e(tpl.nome)}" required>
            </div>

            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label" style="font-weight:700;">UF de Referência</label>
                <select class="form-control" name="uf">
                  ${Utils.stateOptions(OrcamentoSINAPI._defaultUF ? OrcamentoSINAPI._defaultUF() : 'SP')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight:700;">BDI Inicial (%)</label>
                <input class="form-control" type="number" step="0.01" name="bdi" value="${tpl.bdi || 24.23}">
              </div>
            </div>
          </form>
        </div>

        <div class="modal-footer" style="background:#f8fafc;padding:14px 20px;display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Cancelar</button>
          <button type="button" class="btn btn-primary" style="font-weight:700;" data-fb-click="OrcamentoTemplates._executarInstanciacao" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(tpl.id)}">
            ✓ Criar e Abrir Orçamento
          </button>
        </div>
      </div>
    `);
  },

  _executarInstanciacao(templateId) {
    const tpl = this.getAllTemplates().find(t => t.id === templateId);
    if (!tpl) return;

    const form = document.getElementById('f-instanciar-template');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const fd = new FormData(form);

    const novoId = DB.uuid();
    const obraId = fd.get('obra_id');
    const nome = fd.get('nome') || tpl.nome;
    const uf = fd.get('uf') || 'SP';
    const bdi = parseFloat(fd.get('bdi')) || tpl.bdi || 24.23;

    // Converte os itens do template para o formato do orçamento do FinObra
    const itensClonados = [];
    tpl.etapas.forEach(et => {
      et.itens.forEach(it => {
        itensClonados.push({
          id: DB.uuid(),
          etapa_id: et.id,
          etapa_nome: et.nome,
          tipo: it.tipo,
          banco: it.banco,
          codigo_sinapi: it.codigo,
          codigo: it.codigo,
          descricao: it.descricao,
          unidade: it.unidade,
          quantidade: it.quantidade,
          preco_unitario: it.preco_unitario,
          preco_com_bdi: Math.round((it.preco_unitario * (1 + bdi / 100)) * 100) / 100,
          total: Math.round((it.quantidade * (it.preco_unitario * (1 + bdi / 100))) * 100) / 100
        });
      });
    });

    // Registra número sequencial
    const todosOrcs = typeof OrcamentoSINAPI !== 'undefined' ? OrcamentoSINAPI._getAll() : [];
    const proximoNum = String(todosOrcs.length + 1).padStart(4, '0');

    const novoOrcamento = {
      id: novoId,
      numero: proximoNum,
      obra_id: obraId,
      nome: nome,
      uf: uf,
      referencia_sinapi: '2026-07',
      bdi: bdi,
      desonerado: false,
      status: 'ativo',
      origem_template: tpl.nome,
      data_criacao: Utils.today(),
      itens: itensClonados
    };

    if (typeof OrcamentoSINAPI !== 'undefined') {
      OrcamentoSINAPI._add(novoOrcamento);
    }

    Utils.closeModal();
    Utils.toast(`Orçamento "${nome}" criado com sucesso a partir do modelo!`, 'success');

    // Abre o editor imediatamente
    setTimeout(() => {
      if (typeof OrcamentoSINAPI !== 'undefined') {
        OrcamentoSINAPI.openEditor(novoId);
      }
    }, 250);
  },

  // Salva qualquer orçamento existente do usuário como um novo modelo no catálogo ("COPIAR PARA MODELO")
  copiarOrcamentoParaModelo(orcId) {
    if (!orcId && typeof OrcamentoSINAPI !== 'undefined') {
      orcId = OrcamentoSINAPI._currentEditor;
    }
    const orc = typeof OrcamentoSINAPI !== 'undefined' ? OrcamentoSINAPI._getById(orcId) : null;
    if (!orc) {
      Utils.toast('Selecione um orçamento para transformar em modelo.', 'warning');
      return;
    }

    const e = Utils.escapeHtml.bind(Utils);

    Utils.showModal(`
      <div class="modal" style="max-width:480px;padding:0;overflow:hidden;border-radius:var(--r-lg);">
        <div style="background:#23272d;color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-weight:800;font-size:1.1rem;">📋 Salvar como Modelo Pronto</span>
          <button class="modal-close" style="color:#aaa;background:transparent;border:none;font-size:1.3rem;cursor:pointer;" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>

        <div class="modal-body" style="padding:20px;">
          <form id="f-copiar-para-modelo">
            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="font-weight:700;">Nome do Modelo *</label>
              <input class="form-control" name="nome" value="MODELO - ${e(orc.nome)}" required>
            </div>

            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="font-weight:700;">Subtítulo / Descrição Rápida</label>
              <input class="form-control" name="subtitulo" value="${e(orc.descricao || orc.nome)}" placeholder="Ex: Modelo de referência para obras residenciais">
            </div>

            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label" style="font-weight:700;">Categoria</label>
                <select class="form-control" name="categoria">
                  <option value="residencial">Residencial</option>
                  <option value="comercial">Comercial</option>
                  <option value="publico">Público / Institucional</option>
                  <option value="infraestrutura">Infraestrutura</option>
                  <option value="reforma">Reforma</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight:700;">Ícone</label>
                <select class="form-control" name="icone">
                  <option value="🏡">🏡 Casa</option>
                  <option value="🏢">🏢 Prédio</option>
                  <option value="🏭">🏭 Galpão</option>
                  <option value="🧱">🧱 Estrutura</option>
                  <option value="🔨">🔨 Reforma</option>
                  <option value="🛣️">🛣️ Rodovia</option>
                </select>
              </div>
            </div>
          </form>
        </div>

        <div class="modal-footer" style="background:#f8fafc;padding:14px 20px;display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Cancelar</button>
          <button type="button" class="btn btn-primary" style="font-weight:700;" data-fb-click="OrcamentoTemplates._executarCopiaParaModelo" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(orc.id)}">
            ✓ Salvar Modelo
          </button>
        </div>
      </div>
    `);
  },

  _executarCopiaParaModelo(orcId) {
    const orc = typeof OrcamentoSINAPI !== 'undefined' ? OrcamentoSINAPI._getById(orcId) : null;
    if (!orc) return;

    const form = document.getElementById('f-copiar-para-modelo');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const fd = new FormData(form);

    const itens = orc.itens || [];
    const subtotal = itens.reduce((s, i) => s + (i.total || 0), 0);
    const bdi = orc.bdi || 24.23;
    const totalGeral = subtotal * (1 + bdi / 100);

    // Agrupa itens em etapas
    const etapasMap = {};
    itens.forEach(it => {
      const etNome = it.etapa_nome || '1 - SERVIÇOS GERAIS';
      if (!etapasMap[etNome]) etapasMap[etNome] = [];
      etapasMap[etNome].push({
        id: it.id,
        tipo: it.tipo || 'COMP',
        banco: it.banco || 'SINAPI',
        codigo: it.codigo_sinapi || it.codigo || '00000',
        descricao: it.descricao,
        unidade: it.unidade,
        quantidade: it.quantidade,
        preco_unitario: it.preco_unitario,
        preco_com_bdi: it.preco_com_bdi || (it.preco_unitario * (1 + bdi / 100)),
        total: it.total
      });
    });

    const etapas = Object.keys(etapasMap).map((k, idx) => ({
      id: 'et-custom-' + (idx + 1),
      ordem: String(idx + 1),
      nome: k,
      itens: etapasMap[k]
    }));

    const novoTemplate = {
      id: 'custom-tpl-' + DB.uuid(),
      nome: fd.get('nome'),
      subtitulo: fd.get('subtitulo'),
      categoria: fd.get('categoria'),
      icone: fd.get('icone') || '🏠',
      valorEstimado: totalGeral,
      bdi: bdi,
      etapas: etapas,
      isCustom: true,
      criadoEm: new Date().toISOString()
    };

    const custom = this._getCustomTemplates();
    custom.unshift(novoTemplate);
    this._saveCustomTemplates(custom);

    Utils.closeModal();
    Utils.toast(`Modelo "${novoTemplate.nome}" salvo com sucesso nos Orçamentos Prontos!`, 'success');
  }

};
