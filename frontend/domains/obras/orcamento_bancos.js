// js/orcamento_bancos.js — Módulo de Bancos de Preço & Gestão de "Períodos Utilizados"
// Suporta todos os 24 bancos oficiais da construção civil, UFs e competências, com recálculo automático.

const OrcamentoBancos = {

  UFS: [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ],

  NOME_UFS: {
    'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia',
    'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás',
    'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais',
    'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná', 'PE': 'Pernambuco', 'PI': 'Piauí',
    'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte', 'RS': 'Rio Grande do Sul',
    'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina', 'SP': 'São Paulo',
    'SE': 'Sergipe', 'TO': 'Tocantins'
  },

  // Todos os 24 bancos solicitados pelo usuário com suas configurações padrão
  CATALOGO: [
    { id: 'sinapi', nome: 'SINAPI', estado: 'Acre', uf: 'AC', ref: '7/2026', checked: true, multiUf: true, opcoesRef: ['7/2026', '6/2026', '5/2026', '4/2026', '3/2026', '2/2026', '1/2026', '12/2024'] },
    { id: 'sicro', nome: 'SICRO', estado: 'Acre', uf: 'AC', ref: '4/2026', checked: true, multiUf: true, opcoesRef: ['4/2026', '1/2026', '10/2025', '7/2025', '4/2025'] },
    { id: 'orse', nome: 'ORSE', estado: 'Sergipe', uf: 'SE', ref: '6/2026 - (Sinapi Integrado)', checked: true, opcoesRef: ['6/2026 - (Sinapi Integrado)', '5/2026', '4/2026', '3/2026'] },
    { id: 'goinfra_civil', nome: 'GOINFRA CIVIL (AGETOP)', estado: 'Goiás', uf: 'GO', ref: '5/2026', checked: false, opcoesRef: ['5/2026', '4/2026', '3/2026', '12/2025'] },
    { id: 'goinfra_rod', nome: 'GOINFRA RODOVIARIO (AGETOP)', estado: 'Goiás', uf: 'GO', ref: '5/2026', checked: false, opcoesRef: ['5/2026', '4/2026', '3/2026', '12/2025'] },
    { id: 'seinfra_ce', nome: 'SEINFRA-CE', estado: 'Ceará', uf: 'CE', ref: '4/2023', checked: true, opcoesRef: ['4/2023', '3/2023', '2/2023', '1/2023', '2022'] },
    { id: 'siurb', nome: 'SIURB', estado: 'Cidade de São Paulo', uf: 'SP', ref: '1/2026', checked: true, opcoesRef: ['1/2026', '7/2025', '1/2025', '7/2024'] },
    { id: 'cptm', nome: 'CPTM', estado: 'São Paulo', uf: 'SP', ref: '2/2026', checked: false, opcoesRef: ['2/2026', '1/2026', '12/2025', '10/2025'] },
    { id: 'seinfra_mg', nome: 'SEINFRA-MG (SETOP)', estado: 'Minas Gerais', uf: 'MG', ref: '3/2026', checked: false, opcoesRef: ['3/2026', '2/2026', '1/2026', '12/2025'] },
    { id: 'sicor_mg', nome: 'SICOR-MG', estado: 'Minas Gerais', uf: 'MG', ref: '3/2026', checked: false, opcoesRef: ['3/2026', '2/2026', '1/2026', '12/2025'] },
    { id: 'embasa', nome: 'EMBASA', estado: 'Bahia', uf: 'BA', ref: '4/2026', checked: false, opcoesRef: ['4/2026', '3/2026', '2/2026', '1/2026'] },
    { id: 'der_es', nome: 'DER-ES (Edificações)', estado: 'Espírito Santo', uf: 'ES', ref: '5/2026', checked: false, opcoesRef: ['5/2026', '4/2026', '3/2026', '12/2025'] },
    { id: 'der_pr', nome: 'DER-PR', estado: 'Parana', uf: 'PR', ref: '8/2025', checked: true, opcoesRef: ['8/2025', '7/2025', '6/2025', '5/2025'] },
    { id: 'emop', nome: 'EMOP', estado: 'Rio de Janeiro', uf: 'RJ', ref: '4/2026', checked: false, opcoesRef: ['4/2026', '3/2026', '2/2026', '1/2026'] },
    { id: 'sco', nome: 'SCO', estado: 'Rio de Janeiro', uf: 'RJ', ref: '4/2026', checked: false, opcoesRef: ['4/2026', '3/2026', '2/2026', '1/2026'] },
    { id: 'smop', nome: 'SMOP', estado: 'Curitiba / Paraná', uf: 'PR', ref: '1/2026', checked: false, opcoesRef: ['1/2026', '12/2025', '10/2025', '8/2025'] },
    { id: 'seop_sedop', nome: 'SEOP/SEDOP (PA)', estado: 'Pará', uf: 'PA', ref: '3/2026', checked: true, opcoesRef: ['3/2026', '2/2026', '1/2026', '12/2025'] },
    { id: 'caesb_df', nome: 'CAESB-DF', estado: 'Distrito Federal', uf: 'DF', ref: '2/2026', checked: false, opcoesRef: ['2/2026', '1/2026', '12/2025', '11/2025'] },
    { id: 'fde_sp', nome: 'FDE - EDUCAÇÃO-SP', estado: 'São Paulo', uf: 'SP', ref: '4/2026', checked: false, opcoesRef: ['4/2026', '3/2026', '2/2026', '1/2026'] },
    { id: 'cdhu_sp', nome: 'CDHU - OBRAS-SP', estado: 'São Paulo', uf: 'SP', ref: '5/2026', checked: false, opcoesRef: ['5/2026', '4/2026', '3/2026', '2/2026'] },
    { id: 'secid_pr', nome: 'SECID-PR', estado: 'Parana', uf: 'PR', ref: '2/2025', checked: false, opcoesRef: ['2/2025', '1/2025', '12/2024', '10/2024'] },
    { id: 'saneago', nome: 'SANEAGO', estado: 'Goiás', uf: 'GO', ref: '10/2023', checked: false, opcoesRef: ['10/2023', '8/2023', '6/2023', '4/2023'] },
    { id: 'sudecap', nome: 'SUDECAP', estado: 'Belo Horizonte', uf: 'MG', ref: '4/2026', checked: true, opcoesRef: ['4/2026', '3/2026', '2/2026', '1/2026'] },
    { id: 'proprio', nome: 'PRÓPRIO', estado: 'São Paulo', uf: 'SP', ref: '(Insumos Próprios)', checked: true, multiUf: true, desc: '(Usado para determinar o estado de insumos próprios)', opcoesRef: ['(Insumos Próprios)', 'Tabela Base Matriz', 'Tabela Base Filial'] }
  ],

  _tempConfig: null,
  _filtroTexto: '',
  _somenteMarcados: false,
  _currentOrcId: null,

  // Abre o modal idêntico à imagem de referência
  abrirModal(orcId = null) {
    this._currentOrcId = orcId;
    this._filtroTexto = '';
    this._somenteMarcados = false;

    // Recupera configuração salva do orçamento ou usa padrão
    const orc = orcId && typeof OrcamentoSINAPI !== 'undefined' ? OrcamentoSINAPI._getById(orcId) : null;
    const configSalva = orc?.bancos_config || this._getConfigSalva();

    // Clona estado temporário para edição no modal
    this._tempConfig = {
      desonerado: configSalva?.desonerado ?? (orc ? !!orc.desonerado : false),
      bancos: this.CATALOGO.map(b => {
        const existente = configSalva?.bancos?.find(x => x.id === b.id);
        return {
          id: b.id,
          nome: b.nome,
          estado: existente?.estado || b.estado,
          uf: existente?.uf || (b.id === 'sinapi' ? orc?.uf : '') || b.uf,
          ref: existente?.ref || (b.id === 'sinapi' && orc?.referencia_sinapi ? `${Number(orc.referencia_sinapi.slice(5))}/${orc.referencia_sinapi.slice(0,4)}` : '') || b.ref,
          checked: existente ? !!existente.checked : b.checked,
          multiUf: b.multiUf,
          opcoesRef: b.opcoesRef,
          desc: b.desc
        };
      })
    };

    this._renderModal();
  },

  _renderModal() {
    const totalEmUso = this._tempConfig.bancos.filter(b => b.checked).length;
    const e = Utils.escapeHtml.bind(Utils);

    // Filtra lista de bancos
    let listaFiltrada = this._tempConfig.bancos;
    if (this._filtroTexto) {
      const q = this._filtroTexto.toLowerCase();
      listaFiltrada = listaFiltrada.filter(b => b.nome.toLowerCase().includes(q) || b.estado.toLowerCase().includes(q));
    }
    if (this._somenteMarcados) {
      listaFiltrada = listaFiltrada.filter(b => b.checked);
    }

    Utils.showModal(`
      <div class="modal" id="modal-periodos-utilizados" style="max-width:840px;width:95vw;padding:0;overflow:hidden;display:flex;flex-direction:column;max-height:92vh;border-radius:var(--r-lg);">
        
        <!-- Header -->
        <div style="background:#23272d;color:#fff;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #32373e;">
          <span style="font-weight:700;font-size:1.15rem;letter-spacing:.2px;">Períodos utilizados</span>
          <button class="modal-close" style="color:#aaa;background:transparent;border:none;font-size:1.3rem;cursor:pointer;" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>

        <div class="modal-body" style="padding:20px 24px;overflow-y:auto;flex:1;">
          
          <!-- Banner Informativo (amarelo/alaranjado suave) -->
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:12px 16px;color:#92400e;font-size:.875rem;margin-bottom:16px;font-weight:500;">
            Ao salvar, apenas itens encontrados na base SINAPI importada para a UF, competência e série selecionadas terão o preço atualizado. Os demais bancos ainda não possuem uma base de preços integrada; valores não encontrados serão preservados e sinalizados para revisão.
          </div>

          <!-- Barra de Busca, Contador e Filtro -->
          <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
            <div style="position:relative;flex:1;min-width:240px;">
              <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#888;font-size:.9rem;">🔍</span>
              <input
                type="text"
                id="input-filtro-bancos"
                class="form-control"
                style="padding-left:36px;height:40px;border-radius:6px;border:1px solid #cbd5e1;font-size:.875rem;"
                placeholder="Filtrar banco (ex.: SINAPI, ORSE, SUDECAP)"
                value="${e(this._filtroTexto)}"
                data-fb-input="OrcamentoBancos._onFiltroInput"
                data-fb-input-n="1"
                data-fb-input-t0="value"
              >
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <span style="background:#eff6ff;color:#2563eb;font-weight:700;font-size:.82rem;padding:6px 14px;border-radius:18px;border:1px solid #bfdbfe;">
                ${totalEmUso} em uso
              </span>
              <button
                type="button"
                id="btn-so-marcados"
                class="btn btn-sm ${this._somenteMarcados ? 'btn-primary' : 'btn-secondary'}"
                style="font-size:.82rem;padding:6px 14px;border-radius:6px;"
                data-fb-click="OrcamentoBancos._toggleSomenteMarcados"
                data-fb-click-n="0"
              >
                ${this._somenteMarcados ? '✓ Mostrando marcados' : 'Só os marcados'}
              </button>
            </div>
          </div>

          <!-- Checkbox Mestre: Preço desonerado -->
          <div style="margin-bottom:16px;padding:8px 0;display:flex;align-items:center;gap:10px;">
            <input
              type="checkbox"
              id="chk-desonerado-mestre"
              style="width:18px;height:18px;accent-color:#2563eb;cursor:pointer;"
              ${this._tempConfig.desonerado ? 'checked' : ''}
              data-fb-change="OrcamentoBancos._onDesoneradoChange"
              data-fb-change-n="1"
              data-fb-change-t0="checked"
            >
            <label for="chk-desonerado-mestre" style="font-weight:600;font-size:.92rem;color:var(--text);cursor:pointer;">
              Preço desonerado
            </label>
          </div>

          <!-- Tabela/Lista dos Bancos -->
          <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#fff;">
            ${listaFiltrada.map((b, idx) => `
              <div style="display:grid;grid-template-columns:36px 200px 1fr 1fr;align-items:center;padding:12px 16px;border-bottom:${idx < listaFiltrada.length - 1 ? '1px solid #f1f5f9' : 'none'};background:${b.checked ? '#f8fafc' : '#fff'};gap:12px;">
                <!-- Checkbox -->
                <div>
                  <input
                    type="checkbox"
                    id="chk-banco-${b.id}"
                    style="width:18px;height:18px;accent-color:#2563eb;cursor:pointer;"
                    ${b.checked ? 'checked' : ''}
                    data-fb-change="OrcamentoBancos._toggleBanco"
                    data-fb-change-n="2"
                    data-fb-change-t0="string"
                    data-fb-change-v0="${encodeURIComponent(b.id)}"
                    data-fb-change-t1="checked"
                  >
                </div>

                <!-- Nome do Banco -->
                <div>
                  <label for="chk-banco-${b.id}" style="font-weight:700;font-size:.875rem;color:${b.checked ? '#0f172a' : '#64748b'};cursor:pointer;display:block;">
                    ${e(b.nome)}
                  </label>
                  ${b.desc ? `<div style="font-size:.72rem;color:#94a3b8;margin-top:2px;">${e(b.desc)}</div>` : ''}
                </div>

                <!-- Seleção de Estado / UF -->
                <div>
                  ${b.checked ? `
                    <select
                      class="form-control"
                      style="font-size:.82rem;padding:6px 10px;height:36px;border-color:${b.id==='sinapi'||b.id==='sicro'?'#ef4444':'#cbd5e1'};border-bottom-width:2px;"
                      data-fb-change="OrcamentoBancos._changeEstado"
                      data-fb-change-n="2"
                      data-fb-change-t0="string"
                      data-fb-change-v0="${encodeURIComponent(b.id)}"
                      data-fb-change-t1="value"
                    >
                      ${b.multiUf ? OrcamentoBancos.UFS.map(uf => `
                        <option value="${uf}" ${(b.uf || (b.id==='proprio'?'SP':'AC'))===uf ? 'selected' : ''}>
                          ${OrcamentoBancos.NOME_UFS[uf] || uf}
                        </option>
                      `).join('') : `
                        <option value="${b.uf}" selected>${e(b.estado)}</option>
                      `}
                    </select>
                  ` : `
                    <div style="font-size:.82rem;color:#94a3b8;">${e(b.estado)}</div>
                  `}
                </div>

                <!-- Seleção de Referência / Mês-Ano -->
                <div>
                  ${b.checked ? `
                    <select
                      class="form-control"
                      style="font-size:.82rem;padding:6px 10px;height:36px;border-color:${b.id==='sinapi'||b.id==='sicro'?'#ef4444':'#cbd5e1'};border-bottom-width:2px;"
                      data-fb-change="OrcamentoBancos._changeRef"
                      data-fb-change-n="2"
                      data-fb-change-t0="string"
                      data-fb-change-v0="${encodeURIComponent(b.id)}"
                      data-fb-change-t1="value"
                    >
                      ${(b.opcoesRef || [b.ref]).map(r => `
                        <option value="${r}" ${b.ref===r ? 'selected' : ''}>${e(r)}</option>
                      `).join('')}
                    </select>
                  ` : `
                    <div style="font-size:.82rem;color:#94a3b8;">${e(b.ref)}</div>
                  `}
                </div>
              </div>
            `).join('')}
          </div>

        </div>

        <!-- Footer -->
        <div style="background:#f8fafc;padding:14px 24px;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="display:flex;gap:16px;">
            <button type="button" class="btn btn-link btn-sm" style="font-size:.85rem;color:#2563eb;text-decoration:underline;padding:0;" data-fb-click="OrcamentoBancos.marcarTodos" data-fb-click-n="1" data-fb-click-t0="bool" data-fb-click-v0="true">
              Marcar todos
            </button>
            <button type="button" class="btn btn-link btn-sm" style="font-size:.85rem;color:#64748b;text-decoration:underline;padding:0;" data-fb-click="OrcamentoBancos.marcarTodos" data-fb-click-n="1" data-fb-click-t0="bool" data-fb-click-v0="false">
              Desmarcar todos
            </button>
          </div>

          <div style="display:flex;gap:10px;">
            <button type="button" class="btn btn-secondary" style="font-weight:600;min-width:100px;" data-fb-click="Utils.closeModal" data-fb-click-n="0">
              CANCELAR
            </button>
            <button type="button" class="btn btn-primary" style="font-weight:700;min-width:110px;background:#0284c7;border-color:#0284c7;" data-fb-click="OrcamentoBancos.salvar" data-fb-click-n="0">
              SALVAR
            </button>
          </div>
        </div>

      </div>
    `);
  },

  _onFiltroInput(val) {
    this._filtroTexto = val;
    this._renderModal();
    const input = document.getElementById('input-filtro-bancos');
    if (input) {
      input.focus();
      input.setSelectionRange(val.length, val.length);
    }
  },

  _toggleSomenteMarcados() {
    this._somenteMarcados = !this._somenteMarcados;
    this._renderModal();
  },

  _onDesoneradoChange(chk) {
    this._tempConfig.desonerado = chk;
  },

  _toggleBanco(id, chk) {
    const b = this._tempConfig.bancos.find(x => x.id === id);
    if (b) b.checked = chk;
    this._renderModal();
  },

  _changeEstado(id, uf) {
    const b = this._tempConfig.bancos.find(x => x.id === id);
    if (b) {
      b.uf = uf;
      b.estado = this.NOME_UFS[uf] || uf;
    }
  },

  _changeRef(id, ref) {
    const b = this._tempConfig.bancos.find(x => x.id === id);
    if (b) b.ref = ref;
  },

  marcarTodos(flag) {
    this._tempConfig.bancos.forEach(b => b.checked = flag);
    this._renderModal();
  },

  salvar() {
    const configFinal = {
      desonerado: this._tempConfig.desonerado,
      bancos: this._tempConfig.bancos.map(b => ({
        id: b.id,
        nome: b.nome,
        estado: b.estado,
        uf: b.uf,
        ref: b.ref,
        checked: b.checked
      }))
    };

    // Salva globalmente
    this._salvarConfigLocal(configFinal);

    let recalc = { updated:0, missing:0 };
    // Se estiver associado a um orçamento específico, atualiza o orçamento
    if (this._currentOrcId && typeof OrcamentoSINAPI !== 'undefined') {
      const orc = OrcamentoSINAPI._getById(this._currentOrcId);
      if (orc) {
        orc.desonerado = configFinal.desonerado;
        orc.bancos_config = configFinal;
        
        // Atualiza a UF e referência principal a partir do SINAPI
        const sinapiConfig = configFinal.bancos.find(b => b.id === 'sinapi');
        if (sinapiConfig) {
          orc.uf = sinapiConfig.uf;
          const [m, y] = sinapiConfig.ref.split('/');
          if (m && y) orc.referencia_sinapi = `${y}-${m.padStart(2, '0')}`;
        }

        OrcamentoSINAPI._save(orc);

        // Recalcula os itens do orçamento
        recalc = this._recalcularItensDoOrcamento(orc);
      }
    }

    Utils.closeModal();
    Utils.toast(recalc.missing ? `Períodos salvos. ${recalc.missing} item(ns) sem preço na base selecionada; valores anteriores preservados. Importe a base correspondente antes de emitir a proposta.` : `Períodos salvos. ${recalc.updated} preço(s) atualizado(s) da base importada.`, recalc.missing ? 'warning' : 'success');

    // Se o editor estiver aberto, atualiza a tela
    if (this._currentOrcId && typeof OrcamentoSINAPI !== 'undefined' && OrcamentoSINAPI._currentEditor === this._currentOrcId) {
      OrcamentoSINAPI.openEditor(this._currentOrcId);
    } else if (typeof Orcamentos !== 'undefined' && Orcamentos._refresh) {
      Orcamentos._refresh();
    }
  },

  _recalcularItensDoOrcamento(orc) {
    const base = typeof SINAPI !== 'undefined' ? SINAPI.getBase(orc.desonerado, orc.uf, orc.referencia_sinapi) : null;
    const bank = orc.bancos_config?.bancos?.find(b => b.id === 'sinapi');
    const prices = new Map((base?.composicoes || []).map(item => [String(item.codigo), item]));
    let updated = 0, missing = 0;
    for (const item of orc.itens || []) {
      const price = (!bank || bank.checked) && (item.banco || 'SINAPI') === 'SINAPI' ? prices.get(String(item.codigo_sinapi || item.codigo)) : null;
      if (!price) { item.preco_pendente = true; missing++; continue; }
      item.preco_unitario = Number(price.preco_unitario) || 0;
      item.preco_pendente = false;
      item.preco_com_bdi = Math.round(item.preco_unitario * (1 + Number(orc.bdi || 0) / 100) * 100) / 100;
      item.total = Math.round(Number(item.quantidade ?? 0) * item.preco_com_bdi * 100) / 100;
      updated++;
    }
    OrcamentoSINAPI._save(orc);
    return { updated, missing };
  },

  _KEY: 'finobra_periodos_bancos_config',

  _salvarConfigLocal(cfg) {
    try {
      localStorage.setItem(DB._ck(this._KEY), JSON.stringify(cfg));
    } catch {}
  },

  _getConfigSalva() {
    try {
      const raw = localStorage.getItem(DB._ck(this._KEY));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  // Retorna texto resumido da configuração ativa para exibição na barra de parâmetros
  getResumoAtivo(orc) {
    const cfg = orc?.bancos_config || this._getConfigSalva();
    const desonerado = cfg ? cfg.desonerado : (orc?.desonerado ?? false);
    const statusDeson = desonerado ? 'DESONERADO' : 'NÃO DESONERADO';
    
    const sinapi = cfg?.bancos?.find(b => b.id === 'sinapi' && b.checked) || { uf: orc?.uf || 'SP', ref: '7/2026' };
    const outrosAtivos = (cfg?.bancos || []).filter(b => b.checked && b.id !== 'sinapi');
    const extraLabel = outrosAtivos.length > 0 ? ` + ${outrosAtivos[0].nome}: ${outrosAtivos[0].uf} ${outrosAtivos[0].ref}...` : '';

    return `${statusDeson} | SINAPI: ${sinapi.uf} ${sinapi.ref}${extraLabel}`;
  },

  // Retorna o estado e UF configurados para insumos próprios da empresa (suporta todas as 27 UFs)
  getEstadoInsumoProprio(orc) {
    const cfg = orc?.bancos_config || this._getConfigSalva();
    const proprio = cfg?.bancos?.find(b => b.id === 'proprio');
    const uf = proprio?.uf || 'SP';
    return {
      uf,
      estado: proprio?.estado || this.NOME_UFS[uf] || 'São Paulo'
    };
  }
};
