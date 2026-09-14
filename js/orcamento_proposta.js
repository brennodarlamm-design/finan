// js/orcamento_proposta.js — Gerador de Propostas Comerciais Executivas baseadas em Orçamentos
// Produz proposta comercial de alto nível para o cliente com resumo de etapas, BDI, cronograma, condições e assinatura.

const OrcamentoProposta = {

  abrirModal(orcId) {
    if (!orcId && typeof OrcamentoSINAPI !== 'undefined') {
      orcId = OrcamentoSINAPI._currentEditor;
    }
    const orc = typeof OrcamentoSINAPI !== 'undefined' ? OrcamentoSINAPI._getById(orcId) : null;
    if (!orc) {
      Utils.toast('Orçamento não encontrado.', 'error');
      return;
    }

    const cliente = DB.getById('clientes', orc.obra_id);
    const empresa = DB.getEmpresa ? DB.getEmpresa() : {};
    const subtotal = (orc.itens || []).reduce((s, i) => s + (i.total || 0), 0);
    const bdi = orc.bdi || 24.23;
    const totalGeral = subtotal * (1 + bdi / 100);

    const proximaSeq = orc.proposta?.numero || '001';
    const dataEmissao = orc.proposta?.data || Utils.today();
    const e = Utils.escapeHtml.bind(Utils);

    Utils.showModal(`
      <div class="modal" id="modal-gerar-proposta" style="max-width:640px;width:95vw;padding:0;overflow:hidden;border-radius:var(--r-lg);">
        
        <!-- Header -->
        <div style="background:#23272d;color:#fff;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.4rem;">📄</span>
            <div>
              <div style="font-weight:800;font-size:1.1rem;">Gerar Proposta Comercial</div>
              <div style="font-size:.75rem;color:#94a3b8;">Baseada no ${e(orc.nome)}</div>
            </div>
          </div>
          <button class="modal-close" style="color:#aaa;background:transparent;border:none;font-size:1.3rem;cursor:pointer;" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>

        <div class="modal-body" style="padding:22px;background:#f8fafc;max-height:75vh;overflow-y:auto;">
          
          <form id="f-config-proposta">
            
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label" style="font-weight:700;">Nº da Proposta *</label>
                <input class="form-control" name="numero" value="${e(proximaSeq)}" required style="font-weight:700;">
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight:700;">Data de Emissão *</label>
                <input class="form-control" type="date" name="data_emissao" value="${e(dataEmissao)}" required>
              </div>
            </div>

            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label" style="font-weight:700;">Validade da Proposta</label>
                <select class="form-control" name="validade_dias">
                  <option value="15">15 dias corridos</option>
                  <option value="30" selected>30 dias corridos</option>
                  <option value="45">45 dias corridos</option>
                  <option value="60">60 dias corridos</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight:700;">Prazo Estimado de Execução</label>
                <input class="form-control" name="prazo_obra" value="120 dias" placeholder="Ex: 90 dias, 6 meses">
              </div>
            </div>

            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="font-weight:700;">Condições de Pagamento</label>
              <textarea class="form-control" name="condicoes_pagamento" rows="2" style="font-size:.85rem;">Entrada de 20% no aceite da proposta e início dos serviços preliminares. Saldo restante faturado quinzenalmente conforme medição do avanço físico das etapas executadas.</textarea>
            </div>

            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="font-weight:700;">Observações e Escopo Geral</label>
              <textarea class="form-control" name="observacoes" rows="2" style="font-size:.85rem;">Proposta inclui fornecimento de materiais, mão de obra especializada com encargos sociais, equipamentos e gestão técnica conforme planilha de etapas em anexo.</textarea>
            </div>

            <!-- Totalizadores em Destaque -->
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-top:16px;">
              <div style="display:flex;justify-content:space-between;font-size:.82rem;color:#64748b;margin-bottom:6px;">
                <span>Subtotal dos Itens:</span>
                <span style="font-weight:700;color:#0f172a;">${Utils.fmt.currency(subtotal)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:.82rem;color:#64748b;margin-bottom:6px;">
                <span>Taxa de BDI (${bdi.toFixed(2)}%):</span>
                <span style="font-weight:700;color:#d97706;">${Utils.fmt.currency(subtotal * bdi / 100)}</span>
              </div>
              <div style="border-top:1px solid #e2e8f0;padding-top:8px;margin-top:8px;display:flex;justify-content:space-between;font-size:1.05rem;font-weight:900;">
                <span style="color:#0f172a;">VALOR GLOBAL DA PROPOSTA:</span>
                <span style="color:#059669;">${Utils.fmt.currency(totalGeral)}</span>
              </div>
            </div>

          </form>

        </div>

        <div class="modal-footer" style="background:#fff;padding:14px 22px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
          <button type="button" class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Cancelar</button>
          
          <div style="display:flex;gap:8px;">
            <button
              type="button"
              class="btn btn-secondary"
              style="font-weight:700;color:#2563eb;"
              data-fb-click="OrcamentoProposta._compartilharWhatsApp"
              data-fb-click-n="1"
              data-fb-click-t0="string"
              data-fb-click-v0="${encodeURIComponent(orc.id)}"
            >
              📱 WhatsApp
            </button>
            <button
              type="button"
              class="btn btn-primary"
              style="font-weight:800;background:#0284c7;border-color:#0284c7;"
              data-fb-click="OrcamentoProposta._gerarDocumento"
              data-fb-click-n="1"
              data-fb-click-t0="string"
              data-fb-click-v0="${encodeURIComponent(orc.id)}"
            >
              📄 Visualizar e Emitir Proposta
            </button>
          </div>
        </div>

      </div>
    `);
  },

  _gerarDocumento(orcId) {
    const form = document.getElementById('f-config-proposta');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const fd = new FormData(form);

    const orc = typeof OrcamentoSINAPI !== 'undefined' ? OrcamentoSINAPI._getById(orcId) : null;
    if (!orc) return;

    // Salva a proposta no orçamento
    const subtotal = (orc.itens || []).reduce((s, i) => s + (i.total || 0), 0);
    const bdi = orc.bdi || 24.23;
    const totalGeral = subtotal * (1 + bdi / 100);

    const dadosProposta = {
      numero: fd.get('numero') || '001',
      data: fd.get('data_emissao') || Utils.today(),
      validade_dias: fd.get('validade_dias') || '30',
      prazo_obra: fd.get('prazo_obra') || '120 dias',
      condicoes_pagamento: fd.get('condicoes_pagamento') || '',
      observacoes: fd.get('observacoes') || '',
      valor_total: totalGeral
    };

    orc.proposta = dadosProposta;
    if (typeof OrcamentoSINAPI !== 'undefined') {
      OrcamentoSINAPI._save(orc);
    }

    Utils.closeModal();
    this.visualizarDocumentoCompleto(orcId, dadosProposta);
  },

  // Tela executiva de impressão / PDF da Proposta Comercial
  visualizarDocumentoCompleto(orcId, propConfig = null) {
    const orc = typeof OrcamentoSINAPI !== 'undefined' ? OrcamentoSINAPI._getById(orcId) : null;
    if (!orc) return;

    const prop = propConfig || orc.proposta || {
      numero: '001',
      data: Utils.today(),
      validade_dias: '30',
      prazo_obra: '120 dias',
      condicoes_pagamento: 'Conforme medição física',
      observacoes: '',
      valor_total: 0
    };

    const cliente = DB.getById('clientes', orc.obra_id) || {};
    const empresa = DB.getEmpresa ? DB.getEmpresa() : {};
    const itens = orc.itens || [];
    const subtotal = itens.reduce((s, i) => s + (i.total || 0), 0);
    const bdi = orc.bdi || 24.23;
    const totalGeral = subtotal * (1 + bdi / 100);
    const e = Utils.escapeHtml.bind(Utils);

    // Agrupa por etapas para resumo executivo da proposta
    const etapasMap = {};
    itens.forEach(it => {
      const etNome = it.etapa_nome || 'SERVIÇOS GERAIS';
      if (!etapasMap[etNome]) etapasMap[etNome] = 0;
      etapasMap[etNome] += (it.total || 0) * (1 + bdi / 100);
    });

    const etapasResumo = Object.keys(etapasMap).map((nome, idx) => ({
      numero: idx + 1,
      nome,
      valor: etapasMap[nome],
      pct: totalGeral > 0 ? (etapasMap[nome] / totalGeral) * 100 : 0
    }));

    Utils.showModal(`
      <div class="modal modal-xl" style="max-width:960px;width:95vw;padding:0;overflow:hidden;display:flex;flex-direction:column;max-height:92vh;border-radius:var(--r-lg);">
        
        <!-- Header com Ações -->
        <div style="background:#23272d;color:#fff;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #333840;">
          <div style="font-weight:700;font-size:1.05rem;">
            Proposta Comercial Executiva Nº ${e(prop.numero)}
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              style="font-weight:700;display:flex;align-items:center;gap:6px;"
              data-fb-click="Patch26Actions.print"
              data-fb-click-n="0"
            >
              🖨️ Imprimir / Salvar PDF
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              style="font-weight:700;color:#2563eb;"
              data-fb-click="OrcamentoProposta._compartilharWhatsApp"
              data-fb-click-n="1"
              data-fb-click-t0="string"
              data-fb-click-v0="${encodeURIComponent(orc.id)}"
            >
              📱 WhatsApp
            </button>
            <button class="modal-close" style="color:#aaa;background:transparent;border:none;font-size:1.3rem;cursor:pointer;" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
          </div>
        </div>

        <!-- Documento Renderizado (Estilo Executivo Impresso) -->
        <div class="modal-body" id="proposta-print-area" style="padding:40px 48px;overflow-y:auto;flex:1;background:#fff;color:#1e293b;font-family:'Inter',sans-serif;line-height:1.5;">
          
          <!-- Cabeçalho da Empresa -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:20px;margin-bottom:24px;">
            <div>
              <h1 style="font-size:1.6rem;font-weight:900;color:#0f172a;margin:0 0 4px 0;">
                ${e(empresa.nome_fantasia || empresa.razao_social || 'CONSTRUTORA & ENGENHARIA')}
              </h1>
              <div style="font-size:.85rem;color:#475569;">
                CNPJ: ${e(empresa.cnpj || '—')} &nbsp;|&nbsp; CREA/CAU: ${e(empresa.crea_cau || 'Reg. Ativo')}
              </div>
              <div style="font-size:.82rem;color:#64748b;margin-top:3px;">
                ${e(empresa.endereco || '')} ${empresa.cidade ? '— ' + empresa.cidade + '/' + (empresa.uf || '') : ''}
              </div>
            </div>
            
            <div style="text-align:right;">
              <div style="font-size:.78rem;font-weight:800;text-transform:uppercase;color:#2563eb;letter-spacing:1px;">PROPOSTA COMERCIAL</div>
              <div style="font-size:1.5rem;font-weight:900;color:#0f172a;">Nº ${e(prop.numero)}</div>
              <div style="font-size:.8rem;color:#64748b;margin-top:2px;">Emissão: ${Utils.fmt.date(prop.data)}</div>
              <div style="font-size:.8rem;color:#059669;font-weight:700;">Validade: ${e(prop.validade_dias)} dias</div>
            </div>
          </div>

          <!-- Dados do Cliente e da Obra -->
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:24px;display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div>
              <div style="font-size:.72rem;font-weight:800;text-transform:uppercase;color:#64748b;">DADOS DO CLIENTE / CONTRATANTE</div>
              <div style="font-weight:800;font-size:1.05rem;color:#0f172a;margin-top:3px;">${e(cliente.nome || cliente.cliente || 'Cliente Padrão')}</div>
              <div style="font-size:.82rem;color:#475569;margin-top:2px;">CPF/CNPJ: ${e(cliente.cpf_cnpj || '—')}</div>
              <div style="font-size:.82rem;color:#475569;">Telefone: ${e(cliente.telefone || cliente.celular || '—')}</div>
            </div>
            <div>
              <div style="font-size:.72rem;font-weight:800;text-transform:uppercase;color:#64748b;">LOCAL DA OBRA / ESCOPO</div>
              <div style="font-weight:800;font-size:1.05rem;color:#0f172a;margin-top:3px;">${e(orc.nome)}</div>
              <div style="font-size:.82rem;color:#475569;margin-top:2px;">Endereço: ${e(cliente.endereco || 'Conforme projeto')}</div>
              <div style="font-size:.82rem;color:#475569;">Prazo Previsto: <strong>${e(prop.prazo_obra)}</strong></div>
            </div>
          </div>

          <!-- Resumo Financeiro das Macro-Etapas -->
          <div style="margin-bottom:24px;">
            <h3 style="font-size:.95rem;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#0f172a;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
              <span>📊</span> Planilha Resumida por Macro-Etapas
            </h3>

            <table style="width:100%;border-collapse:collapse;font-size:.85rem;border:1px solid #e2e8f0;">
              <thead>
                <tr style="background:#0f172a;color:#fff;font-size:.78rem;text-transform:uppercase;">
                  <th style="padding:10px 14px;text-align:center;width:50px;">Item</th>
                  <th style="padding:10px 14px;text-align:left;">Descrição da Etapa</th>
                  <th style="padding:10px 14px;text-align:right;width:160px;">Valor Total (R$)</th>
                  <th style="padding:10px 14px;text-align:right;width:90px;">% Part.</th>
                </tr>
              </thead>
              <tbody>
                ${etapasResumo.map((et, i) => `
                  <tr style="border-bottom:1px solid #e2e8f0;background:${i%2===0?'#fff':'#f8fafc'};">
                    <td style="padding:10px 14px;text-align:center;font-weight:700;color:#64748b;">${et.numero}</td>
                    <td style="padding:10px 14px;font-weight:600;color:#1e293b;">${e(et.nome)}</td>
                    <td style="padding:10px 14px;text-align:right;font-weight:700;color:#0f172a;">${Utils.fmt.currency(et.valor)}</td>
                    <td style="padding:10px 14px;text-align:right;font-weight:600;color:#2563eb;">${et.pct.toFixed(2)}%</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr style="background:#f1f5f9;font-weight:900;border-top:2px solid #0f172a;">
                  <td colspan="2" style="padding:12px 14px;font-size:.95rem;text-align:right;">TOTAL GLOBAL DA PROPOSTA:</td>
                  <td style="padding:12px 14px;text-align:right;font-size:1.1rem;color:#059669;">${Utils.fmt.currency(totalGeral)}</td>
                  <td style="padding:12px 14px;text-align:right;color:#059669;">100,00%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Condições Comerciais e Garantias -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:30px;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
              <div style="font-weight:800;font-size:.85rem;color:#0f172a;margin-bottom:8px;">💳 Condições de Pagamento</div>
              <div style="font-size:.82rem;color:#475569;white-space:pre-line;">${e(prop.condicoes_pagamento)}</div>
            </div>
            
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
              <div style="font-weight:800;font-size:.85rem;color:#0f172a;margin-bottom:8px;">🛡️ Garantia e Normas Técnicas</div>
              <div style="font-size:.82rem;color:#475569;">
                Garantia legal de 5 anos para solidez e segurança da edificação conforme Art. 618 do Código Civil Brasileiro e ABNT NBR 15575.
              </div>
            </div>
          </div>

          <!-- Assinaturas -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:50px;padding-top:20px;">
            <div style="text-align:center;">
              <div style="border-bottom:1px solid #94a3b8;margin-bottom:8px;height:40px;"></div>
              <div style="font-weight:800;font-size:.9rem;color:#0f172a;">${e(empresa.razao_social || 'CONTRATADA')}</div>
              <div style="font-size:.78rem;color:#64748b;">Responsável Técnico / Direção</div>
            </div>
            <div style="text-align:center;">
              <div style="border-bottom:1px solid #94a3b8;margin-bottom:8px;height:40px;"></div>
              <div style="font-weight:800;font-size:.9rem;color:#0f172a;">${e(cliente.nome || 'CONTRATANTE')}</div>
              <div style="font-size:.78rem;color:#64748b;">De acordo com os termos e valores</div>
            </div>
          </div>

        </div>

      </div>
    `);
  },

  _compartilharWhatsApp(orcId) {
    const orc = typeof OrcamentoSINAPI !== 'undefined' ? OrcamentoSINAPI._getById(orcId) : null;
    if (!orc) return;
    const cliente = DB.getById('clientes', orc.obra_id) || {};
    const subtotal = (orc.itens || []).reduce((s, i) => s + (i.total || 0), 0);
    const bdi = orc.bdi || 24.23;
    const totalGeral = subtotal * (1 + bdi / 100);
    const prop = orc.proposta || { numero: '001', data: Utils.today(), validade_dias: 30 };

    const texto = `*PROPOSTA COMERCIAL Nº ${prop.numero}*\n` +
      `🏢 *Obra:* ${orc.nome}\n` +
      `👤 *Cliente:* ${cliente.nome || 'Cliente'}\n` +
      `💰 *Valor Global:* ${Utils.fmt.currency(totalGeral)}\n` +
      `📅 *Validade:* ${prop.validade_dias} dias\n\n` +
      `_Acesse o detalhamento completo no sistema FinObra._`;

    const telefone = String(cliente.telefone || cliente.celular || '').replace(/\D/g, '');
    const url = telefone ? `https://wa.me/55${telefone}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  }

};
