// js/parcelamento.js — Módulo do Assistente de Lançamentos Parcelados
// Divide despesas e receitas em N vezes com cálculo e ajuste de centavos

const Parcelamento = {
  _callbackSalvar: null,

  abrir(tipoPadrao = 'despesa', callback = null) {
    this._callbackSalvar = callback;
    const clientes = DB.getAll('clientes') || [];
    const fornecedores = DB.getAll('fornecedores') || [];
    const contas = DB.getAll('contas') || [];
    const hoje = Utils.today();

    Utils.showModal(`
      <div class="modal" id="modal-parcelamento" style="max-width:720px;width:95vw;">
        <div class="modal-header" style="background:linear-gradient(135deg,#1e1b4b,#312e81);border-radius:var(--r-lg) var(--r-lg) 0 0;">
          <div class="modal-title" style="color:#fff;display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.4rem;">📅</span>
            <div>
              <div style="font-size:1rem;font-weight:800;">Lançamento Parcelado Automático</div>
              <div style="font-size:.72rem;font-weight:400;color:#a5b4fc;">Divide compras, boletos ou recebimentos em N vezes com vencimentos automáticos</div>
            </div>
          </div>
          <button class="modal-close" onclick="Utils.closeModal()" style="color:#a5b4fc;">✕</button>
        </div>

        <div class="modal-body" style="padding:20px;max-height:75vh;overflow-y:auto;">
          <form id="f-parcelas" onsubmit="event.preventDefault();Parcelamento.salvar();">
            <div class="form-row cols-3" style="margin-bottom:12px;">
              <div class="form-group">
                <label class="form-label">Tipo *</label>
                <select class="form-control" id="parc-tipo" onchange="Parcelamento._gerarPreview()">
                  <option value="despesa" ${tipoPadrao==='despesa'?'selected':''}>↓ Despesa / A Pagar</option>
                  <option value="receita" ${tipoPadrao==='receita'?'selected':''}>↑ Receita / A Receber</option>
                </select>
              </div>
              <div class="form-group" style="grid-column:span 2;">
                <label class="form-label">Descrição Base *</label>
                <input class="form-control" id="parc-desc" placeholder="Ex: Compra de Aço e Vigas" required oninput="Parcelamento._gerarPreview()">
              </div>
            </div>

            <div class="form-row cols-2" style="margin-bottom:12px;">
              <div class="form-group">
                <label class="form-label">Fornecedor / Beneficiário</label>
                <input class="form-control" id="parc-forn" list="parc-forn-list" placeholder="Digite ou selecione...">
                <datalist id="parc-forn-list">
                  ${fornecedores.map(f => `<option value="${(f.nome||f.razao_social||'').replace(/"/g,'&quot;')}">`).join('')}
                </datalist>
              </div>
              <div class="form-group">
                <label class="form-label">Centro de Custo / Obra *</label>
                <select class="form-control" id="parc-obra" required>
                  <option value="">Selecione a obra...</option>
                  <option value="escritorio">🏢 Sede / Escritório Central</option>
                  ${clientes.map(c => `<option value="${c.id}" ${App.obraId===c.id?'selected':''}>${c.nome}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-row cols-3" style="margin-bottom:12px;">
              <div class="form-group">
                <label class="form-label">Categoria</label>
                <select class="form-control" id="parc-cat">
                  <option value="material">🧱 Material de Construção</option>
                  <option value="mao_de_obra">👷 Mão de Obra</option>
                  <option value="servico">🔧 Serviços Terceirizados</option>
                  <option value="equipamento">🚜 Equipamento / Locação</option>
                  <option value="administrativo">💼 Administrativo / Escritório</option>
                  <option value="impostos">🏛️ Impostos / Taxas</option>
                  <option value="outro">📦 Outros</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Conta Bancária</label>
                <select class="form-control" id="parc-conta">
                  <option value="">Nenhuma / A definir</option>
                  ${contas.map(c => `<option value="${c.nome}">${c.banco} — ${c.nome}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Status Inicial</label>
                <select class="form-control" id="parc-status">
                  <option value="a_pagar">⏳ A Pagar / Pendente</option>
                  <option value="pago">✅ Já Pago (todas)</option>
                </select>
              </div>
            </div>

            <!-- Bloco de Cálculo de Parcelas -->
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px;">
              <div style="font-size:.76rem;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;">
                ⚙️ Configuração das Parcelas
              </div>
              <div class="form-row cols-4" style="gap:10px;">
                <div class="form-group">
                  <label class="form-label">Valor Total (R$) *</label>
                  <input class="form-control" id="parc-total" type="number" step="0.01" min="0.01" placeholder="0,00" required
                    style="font-weight:800;font-size:1rem;color:var(--accent2);" oninput="Parcelamento._gerarPreview()">
                </div>
                <div class="form-group">
                  <label class="form-label">Nº Parcelas *</label>
                  <select class="form-control" id="parc-qtd" onchange="Parcelamento._gerarPreview()">
                    ${[2,3,4,5,6,7,8,9,10,11,12,18,24,36].map(n => `<option value="${n}" ${n===3?'selected':''}>${n}x vezes</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Intervalo</label>
                  <select class="form-control" id="parc-intervalo" onchange="Parcelamento._gerarPreview()">
                    <option value="mensal" selected>Mensal (30 dias)</option>
                    <option value="quinzenal">Quinzenal (15 dias)</option>
                    <option value="semanal">Semanal (7 dias)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">1º Vencimento *</label>
                  <input class="form-control" id="parc-prim-venc" type="date" value="${hoje}" required onchange="Parcelamento._gerarPreview()">
                </div>
              </div>
            </div>

            <!-- Tabela de Pré-visualização -->
            <div style="margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <div style="font-size:.78rem;font-weight:800;color:var(--text);display:flex;align-items:center;gap:6px;">
                  <span>📋 Parcelas que serão geradas</span>
                  <span id="parc-preview-badge" style="background:rgba(201,162,39,.15);color:var(--accent2);border-radius:10px;padding:2px 8px;font-size:.7rem;">3 parcelas</span>
                </div>
                <span style="font-size:.7rem;color:var(--text3);">Você pode ajustar as datas e valores individuais abaixo:</span>
              </div>
              <div style="border:1px solid var(--border);border-radius:8px;max-height:220px;overflow-y:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:.82rem;">
                  <thead>
                    <tr style="background:var(--bg-secondary);border-bottom:1px solid var(--border);color:var(--text3);font-size:.72rem;">
                      <th style="padding:6px 10px;text-align:center;width:40px;">#</th>
                      <th style="padding:6px 10px;text-align:left;">Descrição da Parcela</th>
                      <th style="padding:6px 10px;text-align:left;width:140px;">Vencimento</th>
                      <th style="padding:6px 10px;text-align:right;width:120px;">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody id="parc-preview-tbody">
                  </tbody>
                </table>
              </div>
            </div>

            <div class="modal-footer" style="padding:0;padding-top:14px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;">
              <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-primary" id="btn-salvar-parcelas" style="font-weight:800;background:linear-gradient(135deg,#f59e0b,#d97706);color:#1e1b4b;border:none;">
                ⚡ Gerar e Salvar Parcelas
              </button>
            </div>
          </form>
        </div>
      </div>
    `);

    setTimeout(() => {
      this._gerarPreview();
      document.getElementById('parc-desc')?.focus();
    }, 100);
  },

  _gerarPreview() {
    const totalVal = parseFloat(document.getElementById('parc-total')?.value) || 0;
    const qtd = parseInt(document.getElementById('parc-qtd')?.value, 10) || 3;
    const primVenc = document.getElementById('parc-prim-venc')?.value || Utils.today();
    const intervalo = document.getElementById('parc-intervalo')?.value || 'mensal';
    const descBase = (document.getElementById('parc-desc')?.value || '').trim() || 'Parcela';

    const tbody = document.getElementById('parc-preview-tbody');
    const badge = document.getElementById('parc-preview-badge');
    if (!tbody) return;

    if (badge) {
      badge.textContent = `${qtd}x parcelas de ${Utils.fmt.currency(totalVal > 0 ? totalVal / qtd : 0)}`;
    }

    const valorBaseParcela = totalVal > 0 ? Math.floor((totalVal / qtd) * 100) / 100 : 0;
    const centavosRestantes = totalVal > 0 ? Math.round((totalVal - (valorBaseParcela * qtd)) * 100) / 100 : 0;

    const baseDate = new Date(primVenc + 'T12:00:00');
    let rowsHtml = '';

    for (let i = 1; i <= qtd; i++) {
      const valorParcela = (i === 1 ? (valorBaseParcela + centavosRestantes) : valorBaseParcela);
      const vencDate = new Date(baseDate);
      if (intervalo === 'mensal') {
        vencDate.setMonth(baseDate.getMonth() + (i - 1));
      } else if (intervalo === 'quinzenal') {
        vencDate.setDate(baseDate.getDate() + ((i - 1) * 15));
      } else if (intervalo === 'semanal') {
        vencDate.setDate(baseDate.getDate() + ((i - 1) * 7));
      }
      const vencStr = vencDate.toISOString().split('T')[0];
      const descItem = `${descBase} (${i}/${qtd})`;

      rowsHtml += `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:6px 10px;text-align:center;font-weight:700;color:var(--accent2);">${i}</td>
          <td style="padding:6px 10px;">
            <input class="form-control parc-row-desc" value="${descItem.replace(/"/g,'&quot;')}" style="font-size:.8rem;padding:4px 8px;">
          </td>
          <td style="padding:6px 10px;">
            <input class="form-control parc-row-date" type="date" value="${vencStr}" style="font-size:.8rem;padding:4px 8px;">
          </td>
          <td style="padding:6px 10px;text-align:right;">
            <input class="form-control parc-row-val" type="number" step="0.01" value="${valorParcela.toFixed(2)}" style="font-size:.8rem;padding:4px 8px;text-align:right;font-weight:700;">
          </td>
        </tr>`;
    }

    tbody.innerHTML = rowsHtml;
  },

  salvar() {
    const totalVal = parseFloat(document.getElementById('parc-total')?.value) || 0;
    const obraId = document.getElementById('parc-obra')?.value;
    const descBase = (document.getElementById('parc-desc')?.value || '').trim();

    if (!descBase) {
      Utils.toast('Informe a descrição base do lançamento.', 'warning');
      document.getElementById('parc-desc')?.focus();
      return;
    }
    if (!obraId) {
      Utils.toast('Selecione a obra ou centro de custo.', 'warning');
      document.getElementById('parc-obra')?.focus();
      return;
    }
    if (totalVal <= 0) {
      Utils.toast('Informe o valor total do parcelamento.', 'warning');
      document.getElementById('parc-total')?.focus();
      return;
    }

    const tipo = document.getElementById('parc-tipo')?.value || 'despesa';
    const forn = (document.getElementById('parc-forn')?.value || '').trim();
    const cat = document.getElementById('parc-cat')?.value || 'material';
    const conta = document.getElementById('parc-conta')?.value || '';
    const status = document.getElementById('parc-status')?.value || 'a_pagar';

    const descInputs = document.querySelectorAll('.parc-row-desc');
    const dateInputs = document.querySelectorAll('.parc-row-date');
    const valInputs  = document.querySelectorAll('.parc-row-val');

    if (!descInputs.length) return;

    const grupoParcelasId = 'parc_' + Date.now().toString(36);
    let totalSalvo = 0;
    const salvos = [];

    descInputs.forEach((dInp, idx) => {
      const desc = dInp.value.trim() || `${descBase} (${idx+1}/${descInputs.length})`;
      const dataVenc = dateInputs[idx]?.value || Utils.today();
      const val = parseFloat(valInputs[idx]?.value) || 0;
      totalSalvo += val;

      const item = {
        tipo,
        descricao: desc,
        fornecedor_beneficiario: forn,
        obra_id: obraId,
        categoria: cat,
        conta_bancaria: conta,
        status: status,
        valor: val,
        data: Utils.today(),
        data_vencimento: dataVenc,
        data_pagamento: (status === 'pago' || status === 'recebido') ? dataVenc : null,
        origem: 'manual',
        grupo_parcelamento_id: grupoParcelasId,
        numero_parcela: idx + 1,
        total_parcelas: descInputs.length,
        observacoes: `Parcela ${idx+1} de ${descInputs.length} do total de ${Utils.fmt.currency(totalVal)}`
      };

      const saved = DB.add('lancamentos', item);
      salvos.push(saved);
    });

    Utils.closeModal();
    Utils.toast(`✅ ${salvos.length} parcelas geradas com sucesso! Total: ${Utils.fmt.currency(totalSalvo)}`, 'success');
    if (this._callbackSalvar) this._callbackSalvar();
    else if (typeof Lancamentos !== 'undefined' && Lancamentos._refresh) Lancamentos._refresh(true);
  }
};
