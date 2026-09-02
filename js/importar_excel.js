// js/importar_excel.js — Módulo Inteligente de Importação em Lote de Lançamentos via Planilha Excel (.xlsx, .xls, .csv)

const ImportarExcel = {
  _rowsParsed: [],
  _defaultObraId: '',

  abrirModal(defaultObraId = '') {
    this._rowsParsed = [];
    this._defaultObraId = defaultObraId;
    const cs = DB.getAll('clientes');

    Utils.showModal(`
      <div class="modal" style="max-width:980px;width:96vw;max-height:92vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="border-bottom:1px solid var(--border);padding:16px 20px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.4rem;">📊</span>
            <div>
              <div class="modal-title">Importar Lançamentos via Planilha Excel</div>
              <div style="font-size:.75rem;color:var(--text3);">Cadastre dezenas de receitas e despesas de uma só vez a partir de arquivos .xlsx, .xls ou .csv</div>
            </div>
          </div>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>

        <div class="modal-body custom-scroll" style="padding:20px;overflow-y:auto;flex:1;">
          
          <!-- SEÇÃO 1: ÁREA DE UPLOAD E MODELO -->
          <div id="import-step-upload" style="display:block;">
            <div style="display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;margin-bottom:16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:16px;">
              <div>
                <strong style="color:var(--text);font-size:.9rem;display:block;margin-bottom:4px;">📥 Não tem a planilha no formato padrão?</strong>
                <span style="color:var(--text3);font-size:.78rem;">Baixe nosso modelo oficial do Excel já pré-formatado com cabeçalhos e exemplos de receitas, despesas de obras e custos da sede.</span>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-secondary btn-sm" onclick="ImportarExcel.usarExemploDemo()" style="border:1px solid var(--accent);color:var(--accent2);">
                  📋 Carregar Exemplo Demo
                </button>
                <button class="btn btn-success btn-sm" onclick="ImportarExcel.baixarModeloExcel()" style="font-weight:700;">
                  📥 Baixar Modelo (.xlsx)
                </button>
              </div>
            </div>

            <div class="drop-zone" id="excel-drop-zone" onclick="document.getElementById('excel-file-input').click()" style="padding:36px 20px;border:2px dashed rgba(201,162,39,.4);border-radius:14px;background:rgba(201,162,39,.02);text-align:center;cursor:pointer;transition:all .2s;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;margin:0 auto 12px;display:block;color:var(--accent2);">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              <p style="font-size:.95rem;font-weight:700;color:var(--text);margin-bottom:4px;">Arraste e solte sua planilha Excel aqui</p>
              <p style="font-size:.78rem;color:var(--text3);">ou clique para selecionar do seu computador (.xlsx, .xls, .csv)</p>
              <input type="file" id="excel-file-input" accept=".xlsx,.xls,.csv" style="display:none" onchange="ImportarExcel.onFileSelect(event)">
            </div>
          </div>

          <!-- SEÇÃO 2: GRID DE PREVIEW E VALIDAÇÃO DOS DADOS -->
          <div id="import-step-preview" style="display:none;margin-top:16px;">
            
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;padding:12px 16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;">
              <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
                <div>
                  <span style="font-size:.72rem;color:var(--text3);text-transform:uppercase;font-weight:800;display:block;">Total Identificado</span>
                  <strong id="import-kpi-total" style="font-size:1.1rem;color:var(--text);">0 linhas</strong>
                </div>
                <div>
                  <span style="font-size:.72rem;color:var(--text3);text-transform:uppercase;font-weight:800;display:block;">Receitas (+)</span>
                  <strong id="import-kpi-rec" style="font-size:1.1rem;color:var(--success);">R$ 0,00</strong>
                </div>
                <div>
                  <span style="font-size:.72rem;color:var(--text3);text-transform:uppercase;font-weight:800;display:block;">Despesas (-)</span>
                  <strong id="import-kpi-desp" style="font-size:1.1rem;color:var(--danger);">R$ 0,00</strong>
                </div>
              </div>

              <div style="display:flex;align-items:center;gap:10px;">
                <label style="font-size:.78rem;color:var(--text2);font-weight:700;margin:0;">Vincular Obra Padrão:</label>
                <select class="form-control" id="import-global-obra" style="width:200px;font-size:.8rem;padding:4px 8px;" onchange="ImportarExcel.aplicarObraGlobal(this.value)">
                  ${Utils.clienteOptions(this._defaultObraId, 'Aplicar para linhas vazias...', true)}
                </select>
              </div>
            </div>

            <div class="tbl-wrap" style="max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;">
              <table style="font-size:.8rem;">
                <thead>
                  <tr style="background:var(--bg-card);position:sticky;top:0;z-index:2;">
                    <th style="width:36px;text-align:center;"><input type="checkbox" checked id="import-chk-all" onchange="ImportarExcel.toggleSelectAll(this.checked)"></th>
                    <th style="width:95px;">Data</th>
                    <th style="width:95px;">Vencimento</th>
                    <th style="width:85px;">Tipo</th>
                    <th>Obra / Centro de Custo</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Fornecedor / Beneficiário</th>
                    <th style="text-align:right;width:110px;">Valor (R$)</th>
                    <th style="width:90px;">Status</th>
                    <th style="text-align:center;width:40px;"></th>
                  </tr>
                </thead>
                <tbody id="import-table-body"></tbody>
              </table>
            </div>

          </div>

        </div>

        <div class="modal-footer" style="padding:14px 20px;border-top:1px solid var(--border);justify-content:space-between;">
          <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          
          <div style="display:flex;gap:10px;">
            <button type="button" id="import-btn-voltar" class="btn btn-secondary" style="display:none;" onclick="ImportarExcel.voltarUpload()">
              ← Escolher Outro Arquivo
            </button>
            <button type="button" id="import-btn-confirmar" class="btn btn-primary" style="display:none;font-weight:800;padding:10px 24px;" onclick="ImportarExcel.processarGravacao()">
              ⚡ Confirmar Importação (<span id="import-count-label">0</span>)
            </button>
          </div>
        </div>
      </div>
    `);

    this._setupDragDrop();
  },

  _setupDragDrop() {
    const zone = document.getElementById('excel-drop-zone');
    if (!zone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      zone.addEventListener(eventName, e => {
        e.preventDefault();
        e.stopPropagation();
        zone.style.borderColor = 'var(--accent)';
        zone.style.background = 'rgba(201,162,39,.08)';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      zone.addEventListener(eventName, e => {
        e.preventDefault();
        e.stopPropagation();
        zone.style.borderColor = 'rgba(201,162,39,.4)';
        zone.style.background = 'rgba(201,162,39,.02)';
      }, false);
    });

    zone.addEventListener('drop', e => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length) {
        this.processFile(files[0]);
      }
    }, false);
  },

  onFileSelect(event) {
    const files = event.target.files;
    if (files && files.length) {
      this.processFile(files[0]);
    }
  },

  processFile(file) {
    if (typeof XLSX === 'undefined') {
      Utils.toast('Biblioteca XLSX não carregada no navegador.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rawJson || rawJson.length < 2) {
          Utils.toast('A planilha está vazia ou sem linhas de dados.', 'warning');
          return;
        }

        this._parseRows(rawJson);
      } catch (err) {
        console.error('Erro ao ler Excel:', err);
        Utils.toast('Erro ao processar planilha Excel: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  },

  _parseRows(matrix) {
    const headers = matrix[0].map(h => String(h).trim().toLowerCase());
    const dataRows = matrix.slice(1).filter(row => row.some(cell => cell !== ''));

    // Mapeamento Inteligente de Colunas
    const mapCol = {
      data: headers.findIndex(h => /data.*emiss|dt.*emiss|^data$|^emiss/i.test(h)),
      vencimento: headers.findIndex(h => /venc|dt.*venc|prazo/i.test(h)),
      pagamento: headers.findIndex(h => /pagto|pagam|liquid|baixa|rec.*data/i.test(h)),
      tipo: headers.findIndex(h => /tipo|natureza|d\/c|debito|credito/i.test(h)),
      obra: headers.findIndex(h => /obra|cliente|centro.*custo|projeto/i.test(h)),
      descricao: headers.findIndex(h => /desc|hist|item|detalhe/i.test(h)),
      categoria: headers.findIndex(h => /cat|classif|grupo/i.test(h)),
      fornecedor: headers.findIndex(h => /forn|benef|favorec|cliente/i.test(h)),
      valor: headers.findIndex(h => /val|total|quant|preco|preço/i.test(h)),
      status: headers.findIndex(h => /status|situac|situaç/i.test(h)),
      conta: headers.findIndex(h => /conta|banco/i.test(h)),
      codigo_barras: headers.findIndex(h => /codigo.*barra|linha.*digit|boleto|pix/i.test(h)),
      observacoes: headers.findIndex(h => /obs|observ/i.test(h))
    };

    // Fallbacks padrão caso não ache pelo nome do cabeçalho
    if (mapCol.data === -1) mapCol.data = 0;
    if (mapCol.vencimento === -1) mapCol.vencimento = mapCol.data;
    if (mapCol.tipo === -1) mapCol.tipo = 2;
    if (mapCol.obra === -1) mapCol.obra = 3;
    if (mapCol.descricao === -1) mapCol.descricao = 4;
    if (mapCol.categoria === -1) mapCol.categoria = 5;
    if (mapCol.fornecedor === -1) mapCol.fornecedor = 6;
    if (mapCol.valor === -1) mapCol.valor = 7;
    if (mapCol.status === -1) mapCol.status = 8;
    if (mapCol.conta === -1) mapCol.conta = 9;
    if (mapCol.codigo_barras === -1) mapCol.codigo_barras = 10;
    if (mapCol.observacoes === -1) mapCol.observacoes = 11;

    const clientes = DB.getAll('clientes');

    this._rowsParsed = dataRows.map((row, idx) => {
      const rawData = row[mapCol.data];
      const rawVenc = row[mapCol.vencimento];
      const rawPag = mapCol.pagamento !== -1 ? row[mapCol.pagamento] : '';
      const rawTipo = String(row[mapCol.tipo] || '').trim();
      const rawObra = String(row[mapCol.obra] || '').trim();
      const rawDesc = String(row[mapCol.descricao] || '').trim();
      const rawCat = String(row[mapCol.categoria] || '').trim();
      const rawForn = String(row[mapCol.fornecedor] || '').trim();
      const rawValor = row[mapCol.valor];
      const rawStatus = String(row[mapCol.status] || '').trim();
      const rawConta = String(row[mapCol.conta] || '').trim();
      const rawCodigo = String(row[mapCol.codigo_barras] || '').trim();
      const rawObs = String(row[mapCol.observacoes] || '').trim();

      // Normaliza datas
      const dataEmissao = this._normalizeDate(rawData);
      const dataVencimento = this._normalizeDate(rawVenc) || dataEmissao;

      // Normaliza Tipo
      const tipo = /rec|entrad|cred|\+|^c$/i.test(rawTipo) ? 'receita' : 'despesa';

      // Normaliza Valor
      const valor = this._normalizeNumber(rawValor);

      // Normaliza Categoria
      const categoria = this._normalizeCategory(rawCat, tipo);

      // Normaliza Status
      let status = 'a_pagar';
      if (tipo === 'receita') {
        status = /rec|pago|liq|confirma/i.test(rawStatus) ? 'recebido' : 'a_receber';
      } else {
        status = /pago|liq|quit|baix/i.test(rawStatus) ? 'pago' : 'a_pagar';
      }

      const isBaixado = status === 'pago' || status === 'recebido';
      const dataPagamento = rawPag ? this._normalizeDate(rawPag) : (isBaixado ? dataEmissao : null);

      // Normaliza Obra
      let obraId = this._matchObra(rawObra, clientes);
      if (!obraId && this._defaultObraId) obraId = this._defaultObraId;

      return {
        id_temp: `imp_${idx}`,
        selected: true,
        data: dataEmissao,
        data_vencimento: dataVencimento,
        data_pagamento: dataPagamento,
        tipo: tipo,
        obra_id: obraId,
        descricao: rawDesc || `Lançamento ${idx + 1}`,
        categoria: categoria,
        fornecedor_beneficiario: rawForn || (tipo === 'receita' ? 'Cliente' : 'Fornecedor'),
        valor: Math.abs(valor),
        status: status,
        conta_bancaria: rawConta || 'BB — Movimento Principal',
        codigo_barras: rawCodigo,
        observacoes: rawObs
      };
    });

    this._renderPreview();
  },

  _normalizeDate(val) {
    if (!val) return Utils.today();
    if (typeof val === 'number') {
      // Número de série do Excel
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    const parts = str.split(/[\/\-\.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return Utils.today();
  },

  _normalizeNumber(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let s = String(val).replace(/[R$\s]/g, '').trim();
    if (s.includes(',') && s.includes('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    return parseFloat(s) || 0;
  },

  _normalizeCategory(catStr, tipo) {
    const s = (catStr || '').toLowerCase();
    if (tipo === 'receita') {
      if (/caixa|parc/i.test(s)) return 'parcela_caixa';
      if (/prop|entrad/i.test(s)) return 'entrada_propria';
      if (/aport/i.test(s)) return 'aporte_financeiro';
      if (/empr[eé]st/i.test(s)) return 'emprestimo';
      if (/financ/i.test(s)) return 'financiamento';
      return 'outro';
    }
    if (/energ|luz|cpfl|equat/i.test(s)) return 'energia';
    if (/agua|água|esgot|caer|sabesp/i.test(s)) return 'agua';
    if (/inter|tel|fibra|vivo|claro|tim/i.test(s)) return 'internet_tel';
    if (/simples|das|tributo/i.test(s)) return 'imposto_simples';
    if (/inss|fgts|gps|trabalh/i.test(s)) return 'tributos_trabalhistas';
    if (/salari|salário|folha|funcion/i.test(s)) return 'salario';
    if (/pro.*lab|pró.*lab|socio|sócio/i.test(s)) return 'pro_labore';
    if (/alug|condom|sede|imob/i.test(s)) return 'aluguel_sede';
    if (/contab|fiscal|jurid|advoc/i.test(s)) return 'contabilidade';
    if (/soft|cad|autocad|ti|sistem|google/i.test(s)) return 'software_ti';
    if (/papel|copa|cafe|café|suprim|escrit/i.test(s)) return 'material_escritorio';
    if (/mater/i.test(s)) return 'material';
    if (/mao|mão|pedreir|empreit/i.test(s)) return 'mao_de_obra';
    if (/serv/i.test(s)) return 'servico';
    if (/equip|maquin/i.test(s)) return 'equipamento';
    if (/taxa/i.test(s)) return 'taxa';
    return 'outro';
  },

  _matchObra(obraStr, clientes) {
    if (!obraStr) return '';
    const s = obraStr.toLowerCase();
    if (/sede|escrit|adm|central/i.test(s)) return 'escritorio';
    for (const c of clientes) {
      if (c.nome.toLowerCase().includes(s) || s.includes(c.nome.toLowerCase().split(' ')[0])) {
        return c.id;
      }
    }
    return '';
  },

  _renderPreview() {
    document.getElementById('import-step-upload').style.display = 'none';
    document.getElementById('import-step-preview').style.display = 'block';
    document.getElementById('import-btn-voltar').style.display = 'inline-block';
    document.getElementById('import-btn-confirmar').style.display = 'inline-block';

    const tbody = document.getElementById('import-table-body');
    const clientes = DB.getAll('clientes');

    tbody.innerHTML = this._rowsParsed.map((item, idx) => {
      const isRec = item.tipo === 'receita';
      return `
      <tr id="row-${item.id_temp}" style="background:${item.selected ? 'transparent' : 'rgba(0,0,0,.2)'};">
        <td style="text-align:center;">
          <input type="checkbox" ${item.selected ? 'checked' : ''} onchange="ImportarExcel.toggleRow('${item.id_temp}', this.checked)">
        </td>
        <td>
          <input type="date" class="form-control" style="padding:2px 4px;font-size:.76rem;" value="${item.data}" onchange="ImportarExcel.updateCell('${item.id_temp}', 'data', this.value)">
        </td>
        <td>
          <input type="date" class="form-control" style="padding:2px 4px;font-size:.76rem;" value="${item.data_vencimento}" onchange="ImportarExcel.updateCell('${item.id_temp}', 'data_vencimento', this.value)">
        </td>
        <td>
          <input type="date" class="form-control" style="padding:2px 4px;font-size:.76rem;border-color:var(--success);" value="${item.data_pagamento||''}" onchange="ImportarExcel.updateCell('${item.id_temp}', 'data_pagamento', this.value)">
        </td>
        <td>
          <select class="form-control" style="padding:2px 4px;font-size:.76rem;color:${isRec?'var(--success)':'var(--danger)'};font-weight:700;" onchange="ImportarExcel.updateCell('${item.id_temp}', 'tipo', this.value)">
            <option value="receita" ${isRec?'selected':''}>↑ Receita</option>
            <option value="despesa" ${!isRec?'selected':''}>↓ Despesa</option>
          </select>
        </td>
        <td>
          <select class="form-control" style="padding:2px 4px;font-size:.76rem;max-width:160px;" onchange="ImportarExcel.updateCell('${item.id_temp}', 'obra_id', this.value)">
            ${Utils.clienteOptions(item.obra_id, 'Selecione centro...', true)}
          </select>
        </td>
        <td>
          <input type="text" class="form-control" style="padding:2px 6px;font-size:.78rem;" value="${item.descricao}" onchange="ImportarExcel.updateCell('${item.id_temp}', 'descricao', this.value)">
        </td>
        <td>
          <select class="form-control" style="padding:2px 4px;font-size:.76rem;max-width:130px;" onchange="ImportarExcel.updateCell('${item.id_temp}', 'categoria', this.value)">
            <option value="${item.categoria}" selected>${Utils.catLabel(item.categoria)}</option>
            <optgroup label="💰 Receitas">
              <option value="parcela_caixa">🏦 Parcela Caixa</option>
              <option value="entrada_propria">💵 Entrada Própria</option>
              <option value="aporte_financeiro">💼 Aporte Financeiro</option>
              <option value="emprestimo">🤝 Empréstimo</option>
              <option value="financiamento">🏗️ Financiamento</option>
            </optgroup>
            <optgroup label="🏗️ Obras">
              <option value="material">🧱 Material</option>
              <option value="mao_de_obra">👷 Mão de Obra</option>
              <option value="servico">🔧 Serviço</option>
              <option value="equipamento">🏗️ Equipamento</option>
              <option value="taxa">📋 Taxa/Imposto</option>
            </optgroup>
            <optgroup label="🏢 Escritório">
              <option value="energia">💡 Energia Elétrica</option>
              <option value="agua">💧 Água e Esgoto</option>
              <option value="internet_tel">🌐 Internet & Net</option>
              <option value="imposto_simples">🏛️ DAS Simples</option>
              <option value="tributos_trabalhistas">📄 INSS / FGTS</option>
              <option value="salario">👥 Salários</option>
              <option value="pro_labore">💼 Pró-Labore</option>
              <option value="aluguel_sede">🏢 Aluguel Sede</option>
              <option value="contabilidade">⚖️ Contábil</option>
              <option value="software_ti">💻 Softwares</option>
              <option value="material_escritorio">📦 Material/Copa</option>
            </optgroup>
            <option value="outro">📦 Outros</option>
          </select>
        </td>
        <td>
          <input type="text" class="form-control" style="padding:2px 6px;font-size:.78rem;" value="${item.fornecedor_beneficiario}" onchange="ImportarExcel.updateCell('${item.id_temp}', 'fornecedor_beneficiario', this.value)">
        </td>
        <td>
          <input type="number" step="0.01" class="form-control" style="padding:2px 6px;font-size:.78rem;text-align:right;font-weight:800;color:${isRec?'var(--success)':'var(--danger)'};" value="${item.valor}" oninput="ImportarExcel.updateCell('${item.id_temp}', 'valor', parseFloat(this.value)||0)">
        </td>
        <td>
          <select class="form-control" style="padding:2px 4px;font-size:.74rem;" onchange="ImportarExcel.updateCell('${item.id_temp}', 'status', this.value)">
            ${isRec ? `
              <option value="recebido" ${item.status==='recebido'?'selected':''}>✓ Recebido</option>
              <option value="a_receber" ${item.status==='a_receber'?'selected':''}>⏳ A Receber</option>
            ` : `
              <option value="pago" ${item.status==='pago'?'selected':''}>✓ Pago</option>
              <option value="a_pagar" ${item.status==='a_pagar'?'selected':''}>⏳ A Pagar</option>
            `}
          </select>
        </td>
        <td style="text-align:center;">
          <button class="icon-btn" onclick="ImportarExcel.removerLinha('${item.id_temp}')" title="Remover Linha" style="font-size:12px;color:var(--danger);padding:2px 4px;">
            ✕
          </button>
        </td>
      </tr>`;
    }).join('');

    this._recalcKPIs();
  },

  updateCell(id_temp, field, value) {
    const item = this._rowsParsed.find(r => r.id_temp === id_temp);
    if (item) {
      item[field] = value;
      if (field === 'status') {
        if ((value === 'pago' || value === 'recebido') && !item.data_pagamento) {
          item.data_pagamento = item.data || Utils.today();
        }
      }
      this._recalcKPIs();
    }
  },

  toggleRow(id_temp, checked) {
    const item = this._rowsParsed.find(r => r.id_temp === id_temp);
    if (item) {
      item.selected = checked;
      const row = document.getElementById(`row-${id_temp}`);
      if (row) row.style.opacity = checked ? '1' : '.4';
      this._recalcKPIs();
    }
  },

  toggleSelectAll(checked) {
    this._rowsParsed.forEach(item => {
      item.selected = checked;
      const row = document.getElementById(`row-${item.id_temp}`);
      if (row) row.style.opacity = checked ? '1' : '.4';
    });
    document.querySelectorAll('#import-table-body input[type="checkbox"]').forEach(c => c.checked = checked);
    this._recalcKPIs();
  },

  removerLinha(id_temp) {
    this._rowsParsed = this._rowsParsed.filter(r => r.id_temp !== id_temp);
    const row = document.getElementById(`row-${id_temp}`);
    if (row) row.remove();
    this._recalcKPIs();
  },

  aplicarObraGlobal(obraId) {
    if (!obraId) return;
    this._rowsParsed.forEach(item => {
      if (!item.obra_id) {
        item.obra_id = obraId;
      }
    });
    this._renderPreview();
    Utils.toast('Obra padrão aplicada nas linhas sem centro de custo!', 'info');
  },

  _recalcKPIs() {
    const selected = this._rowsParsed.filter(r => r.selected);
    const totalRec = selected.filter(r => r.tipo === 'receita').reduce((s, r) => s + (r.valor || 0), 0);
    const totalDesp = selected.filter(r => r.tipo === 'despesa').reduce((s, r) => s + (r.valor || 0), 0);

    const totalEl = document.getElementById('import-kpi-total');
    const recEl = document.getElementById('import-kpi-rec');
    const despEl = document.getElementById('import-kpi-desp');
    const countLbl = document.getElementById('import-count-label');

    if (totalEl) totalEl.textContent = `${selected.length} de ${this._rowsParsed.length} linhas`;
    if (recEl) recEl.textContent = Utils.fmt.currency(totalRec);
    if (despEl) despEl.textContent = Utils.fmt.currency(totalDesp);
    if (countLbl) countLbl.textContent = `${selected.length}`;
  },

  voltarUpload() {
    document.getElementById('import-step-preview').style.display = 'none';
    document.getElementById('import-step-upload').style.display = 'block';
    document.getElementById('import-btn-voltar').style.display = 'none';
    document.getElementById('import-btn-confirmar').style.display = 'none';
  },

  processarGravacao() {
    const selecionados = this._rowsParsed.filter(r => r.selected);
    if (!selecionados.length) {
      Utils.toast('Selecione pelo menos um lançamento para importar.', 'warning');
      return;
    }

    const defaultObra = this._defaultObraId || (DB.getAll('clientes')[0]?.id || 'escritorio');
    let importados = 0;

    selecionados.forEach(item => {
      const obra = item.obra_id || defaultObra;
      const isBaixado = item.status === 'pago' || item.status === 'recebido';
      DB.add('lancamentos', {
        obra_id: obra,
        centro_custo: obra === 'escritorio' ? 'escritorio' : 'obra',
        tipo: item.tipo,
        categoria: item.categoria,
        descricao: item.descricao,
        fornecedor_beneficiario: item.fornecedor_beneficiario,
        data: item.data,
        data_vencimento: item.data_vencimento,
        data_pagamento: isBaixado ? (item.data_pagamento || item.data) : null,
        valor: item.valor,
        status: item.status,
        conta_bancaria: item.conta_bancaria,
        codigo_barras: item.codigo_barras,
        observacoes: item.observacoes,
        origem: 'importacao_excel',
        conciliado: isBaixado
      });
      importados++;
    });

    Utils.closeModal();
    Utils.toast(`🎉 Sucesso! ${importados} lançamentos foram importados para o sistema!`, 'success');
    
    // Atualiza a tela atual
    if (App.route) {
      App.navigate(App.route);
    }
  },

  // ─────────────────────────────────────────────────────────────
  // GERADOR E DOWNLOAD DO MODELO OFICIAL EXCEL
  // ─────────────────────────────────────────────────────────────
  baixarModeloExcel() {
    if (typeof XLSX === 'undefined') {
      Utils.toast('Biblioteca XLSX não disponível.', 'error');
      return;
    }

    const wb = XLSX.utils.book_new();
    const wsData = [
      ["Data Emissão", "Data Vencimento", "Data Pagamento / Recebimento", "Tipo", "Obra / Cliente", "Descrição do Lançamento", "Categoria", "Fornecedor / Beneficiário", "Valor (R$)", "Status", "Conta Bancária", "Código de Barras / Pix", "Observações"],
      ["2026-08-20", "2026-08-20", "2026-08-20", "Receita", "João Carlos Ferreira", "Entrada Própria Recursos Cliente", "Entrada Própria", "João Carlos Ferreira", 35000.00, "Recebido", "BB — Movimento Principal", "", "Recursos próprios"],
      ["2026-08-22", "2026-08-28", "", "Despesa", "João Carlos Ferreira", "Cimento Portland CP-II (100 sacos)", "Material", "Materiais Para Construção XYZ", 3200.00, "A Pagar", "BB — Movimento Principal", "34191.79001 01043.510047 91020.150008 5 98760000320000", "Entrega canteiro"],
      ["2026-08-25", "2026-08-30", "", "Despesa", "Maria Aparecida Santos", "Mão de Obra — Alvenaria e Fundação", "Mão de Obra", "Empreiteira Lima & Filhos ME", 14000.00, "A Pagar", "BB — Movimento Principal", "", "Etapa 1"],
      ["2026-08-15", "2026-08-20", "", "Despesa", "Sede / Escritório", "Conta de Energia Elétrica Sede Central", "Energia Elétrica", "Equatorial / Roraima Energia", 1280.00, "A Pagar", "BB — Movimento Principal", "83640.00001 28000.123456 78901.234567 1 99200000128000", "Competência 08/2026"],
      ["2026-08-15", "2026-08-20", "", "Despesa", "Sede / Escritório", "Guia DAS — Simples Nacional", "DAS Simples Nacional", "Receita Federal do Brasil", 4850.00, "A Pagar", "BB — Movimento Principal", "85820.00004 85000.104050 12345.678901 3 99200000485000", "Apuração 07/2026"],
      ["2026-08-10", "2026-08-10", "2026-08-10", "Despesa", "Sede / Escritório", "Aluguel Comercial Sede", "Aluguel Sede", "Imobiliária Nova Era Ltda", 3500.00, "Pago", "BB — Movimento Principal", "", "Mês vigente"]
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 10 }, { wch: 24 }, { wch: 34 }, { wch: 22 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 24 }, { wch: 34 }, { wch: 22 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Lancamentos");
    XLSX.writeFile(wb, "Modelo_Importacao_Lancamentos_Angelim.xlsx");
    Utils.toast('Planilha modelo baixada com sucesso!', 'success');
  },

  // ─────────────────────────────────────────────────────────────
  // CARREGAR EXEMPLO DE DEMONSTRAÇÃO PRONTO PARA TESTE
  // ─────────────────────────────────────────────────────────────
  usarExemploDemo() {
    const demoMatrix = [
      ["Data Emissão", "Data Vencimento", "Data Pagamento", "Tipo", "Obra / Cliente", "Descrição do Lançamento", "Categoria", "Fornecedor / Beneficiário", "Valor (R$)", "Status", "Conta Bancária", "Código de Barras", "Observações"],
      ["2026-08-20", "2026-08-25", "", "Despesa", "João Carlos Ferreira", "Cimento Portland CP-II (60 sacos)", "Material", "Materiais Para Construção XYZ", 1920.00, "A Pagar", "BB — Movimento Principal", "34191.79001 01043.510047 91020.150008 5 98760000192000", "Lote 4"],
      ["2026-08-21", "2026-08-21", "2026-08-21", "Receita", "João Carlos Ferreira", "Liberação 3ª Parcela Caixa Econômica", "Parcela Caixa", "Caixa Econômica Federal", 57000.00, "Recebido", "BB — Movimento Principal", "", "Medição 03 aprovada"],
      ["2026-08-22", "2026-08-27", "", "Despesa", "Maria Aparecida Santos", "Instalação Elétrica e Quadros", "Serviço", "Elétrica Silva ME", 6400.00, "A Pagar", "BB — Movimento Principal", "10491.82345 98765.432109 87654.321098 7 99000000640000", "Fase de acabamento"],
      ["2026-08-23", "2026-08-28", "", "Despesa", "Sede / Escritório", "Conta de Energia Elétrica Sede", "Energia Elétrica", "Equatorial / Roraima Energia", 1280.00, "A Pagar", "BB — Movimento Principal", "83640.00001 28000.123456 78901.234567 1 99200000128000", "Fatura mensal"],
      ["2026-08-24", "2026-08-30", "", "Despesa", "Sede / Escritório", "Guia DAS — Simples Nacional", "DAS Simples Nacional", "Receita Federal do Brasil", 4850.00, "A Pagar", "BB — Movimento Principal", "85820.00004 85000.104050 12345.678901 3 99200000485000", "Apuração 07/2026"],
      ["2026-08-24", "2026-08-29", "", "Despesa", "Sede / Escritório", "Honorários Contábeis e Assessoria", "Contabilidade", "Meta Contabilidade", 1800.00, "A Pagar", "BB — Movimento Principal", "23793.38128 60000.123456 78000.654321 3 98900000180000", "Mensalidade"],
      ["2026-08-25", "2026-08-25", "2026-08-25", "Despesa", "Sede / Escritório", "Internet Fibra Óptica 500MB", "Internet & Telefonia", "Vivo / Telefônica Brasil", 249.90, "Pago", "BB — Movimento Principal", "", "Pago via débito"]
    ];

    this._parseRows(demoMatrix);
    Utils.toast('Planilha de exemplo carregada para visualização!', 'info');
  }
};
