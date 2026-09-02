// js/precompras_workflow.js — Fluxos de Autorização, Rejeição, Conversão em Lançamento e Impressão de Pré-Compras

const PreComprasWorkflow = {
  abrirModalAprovacao(id) {
    const p = DB.getById('precompras', id);
    if (!p) return;
    const c = DB.getById('clientes', p.obra_id);
    const contas = DB.getAll('contas');

    Utils.showModal(`
      <div class="modal" style="max-width:600px;width:95vw;">
        <div class="modal-header" style="border-bottom:1px solid var(--border);padding:16px 20px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.3rem;">✅</span>
            <span class="modal-title">Autorizar Ordem de Pré-Compra</span>
          </div>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body" style="padding:20px;">
          <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="font-family:monospace;font-weight:800;color:var(--accent2);">${p.numero_ordem}</span>
              <span style="font-weight:900;color:var(--success);font-size:1.1rem;">${Utils.fmt.currency(p.valor_total)}</span>
            </div>
            <div style="font-weight:700;color:var(--text);">${p.descricao}</div>
            <div style="font-size:.78rem;color:var(--text3);margin-top:4px;">Obra: <strong>${c?.nome || '—'}</strong> | Solicitante: <strong>${p.solicitante_nome}</strong></div>
            <div style="font-size:.78rem;color:var(--text3);margin-top:2px;">Fornecedor: <strong>${p.fornecedor_nome || '—'}</strong> (${p.itens?.length || 0} itens)</div>
          </div>

          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label">Parecer / Instruções do Administrador</label>
            <textarea id="aprov-parecer" class="form-control" rows="2" placeholder="Ex: Aprovado conforme cotação. Faturar com boleto 28 DDL."></textarea>
          </div>

          <div style="background:rgba(2,132,199,.08);border:1px solid rgba(2,132,199,.25);border-radius:8px;padding:14px;margin-bottom:16px;">
            <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">
              <input type="checkbox" id="aprov-gerar-despesa" checked style="margin-top:3px;transform:scale(1.15);" onchange="PreCompras._toggleContaBancariaSelect(this.checked)">
              <div>
                <strong style="color:var(--text);font-size:.85rem;">Gerar Despesa Financeira em "Lançamentos" Imediatamente</strong>
                <p style="font-size:.74rem;color:var(--text3);margin-top:2px;">
                  Cria automaticamente a conta a pagar na obra com os dados desta ordem de compra aprovada.
                </p>
              </div>
            </label>

            <div id="aprov-conta-group" style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
              <div style="flex:1;min-width:180px;">
                <label class="form-label" style="font-size:.72rem;">Conta Bancária Prevista</label>
                <select id="aprov-conta" class="form-control" style="font-size:.8rem;">
                  <option value="">Selecione a conta...</option>
                  ${contas.map(ct => `<option value="${ct.apelido || ct.banco_nome}">${ct.apelido || ct.banco_nome} (${ct.agencia}/${ct.numero})</option>`).join('')}
                </select>
              </div>
              <div style="width:140px;">
                <label class="form-label" style="font-size:.72rem;">Vencimento</label>
                <input type="date" id="aprov-vencimento" class="form-control" style="font-size:.8rem;" value="${p.data_necessidade || Utils.today()}">
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer" style="padding:12px 20px;border-top:1px solid var(--border);justify-content:flex-end;gap:10px;">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-success" onclick="PreCompras.confirmarAprovacao('${p.id}')" style="font-weight:800;padding:10px 20px;">
            ✓ Confirmar Aprovação
          </button>
        </div>
      </div>
    `);
  },

  confirmarAprovacao(id) {
    const p = DB.getById('precompras', id);
    if (!p) return;

    const parecer = document.getElementById('aprov-parecer')?.value?.trim() || 'Aprovado pelo Administrador';
    const gerarDespesa = document.getElementById('aprov-gerar-despesa')?.checked;
    const contaBancaria = document.getElementById('aprov-conta')?.value || '';
    const vencimento = document.getElementById('aprov-vencimento')?.value || p.data_necessidade || Utils.today();
    const user = Auth.getUser();

    const updates = {
      status: 'aprovada',
      aprovado_por: user?.nome || 'Administrador',
      aprovado_em: new Date().toISOString(),
      parecer_admin: parecer
    };

    if (gerarDespesa) {
      const lancamento = {
        obra_id: p.obra_id,
        tipo: 'despesa',
        data: p.data_solicitacao || Utils.today(),
        data_vencimento: vencimento,
        descricao: `[Ordem ${p.numero_ordem}] ${p.descricao}`,
        categoria: p.categoria || 'material',
        valor: p.valor_total,
        status: 'a_pagar',
        fornecedor_beneficiario: p.fornecedor_nome || 'Fornecedor',
        conta_bancaria: contaBancaria,
        observacoes: `Gerado automaticamente a partir da Ordem de Pré-Compra ${p.numero_ordem}. Parecer: ${parecer}`,
        origem: 'precompra',
        precompra_id: p.id,
        conciliado: false
      };

      const novoLanc = DB.add('lancamentos', lancamento);
      updates.status = 'convertida';
      updates.lancamento_id = novoLanc.id;
      Utils.toast(`Ordem aprovada e Despesa de ${Utils.fmt.currency(p.valor_total)} gerada em Lançamentos!`, 'success');
    } else {
      Utils.toast(`Ordem de pré-compra ${p.numero_ordem} aprovada com sucesso!`, 'success');
    }

    DB.update('precompras', id, updates);
    Utils.closeModal();
    App.navigate('precompras');
  },

  abrirModalRejeicao(id) {
    const p = DB.getById('precompras', id);
    if (!p) return;

    Utils.showModal(`
      <div class="modal" style="max-width:480px;width:95vw;">
        <div class="modal-header" style="border-bottom:1px solid var(--border);padding:16px 20px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.3rem;">❌</span>
            <span class="modal-title">Recusar Ordem de Pré-Compra</span>
          </div>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body" style="padding:20px;">
          <p style="font-size:.85rem;color:var(--text2);margin-bottom:14px;">
            Informe a justificativa ou motivo da recusa da ordem <strong>${p.numero_ordem}</strong> (${Utils.fmt.currency(p.valor_total)}). O solicitante poderá visualizar a justificativa.
          </p>
          <div class="form-group">
            <label class="form-label">Motivo da Recusa / Justificativa *</label>
            <textarea id="recusa-motivo" class="form-control" rows="3" placeholder="Ex: Valor acima do orçamento da etapa. Solicitar cotação com mais 2 fornecedores locais." required></textarea>
          </div>
        </div>
        <div class="modal-footer" style="padding:12px 20px;border-top:1px solid var(--border);justify-content:flex-end;gap:10px;">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-danger" onclick="PreCompras.confirmarRejeicao('${p.id}')" style="font-weight:800;">
            ✕ Confirmar Recusa
          </button>
        </div>
      </div>
    `);
  },

  confirmarRejeicao(id) {
    const motivo = document.getElementById('recusa-motivo')?.value?.trim();
    if (!motivo) {
      Utils.toast('Por favor, informe o motivo da recusa.', 'warning');
      return;
    }

    const user = Auth.getUser();
    DB.update('precompras', id, {
      status: 'rejeitada',
      rejeitado_por: user?.nome || 'Administrador',
      rejeitado_em: new Date().toISOString(),
      motivo_recusa: motivo
    });

    Utils.toast('Ordem de pré-compra recusada.', 'info');
    Utils.closeModal();
    App.navigate('precompras');
  },

  converterEmLancamentoModal(id) {
    const p = DB.getById('precompras', id);
    if (!p) return;
    const c = DB.getById('clientes', p.obra_id);
    const contas = DB.getAll('contas');

    Utils.showModal(`
      <div class="modal" style="max-width:520px;width:95vw;">
        <div class="modal-header" style="border-bottom:1px solid var(--border);padding:16px 20px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.3rem;">💰</span>
            <span class="modal-title">Gerar Despesa Financeira</span>
          </div>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body" style="padding:20px;">
          <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px;">
            <div style="font-weight:800;color:var(--accent2);">${p.numero_ordem} — ${p.descricao}</div>
            <div style="font-size:.8rem;color:var(--text3);margin-top:4px;">Obra: <strong>${c?.nome||'—'}</strong> | Fornecedor: <strong>${p.fornecedor_nome||'—'}</strong></div>
            <div style="font-size:1.2rem;font-weight:900;color:var(--success);margin-top:6px;">${Utils.fmt.currency(p.valor_total)}</div>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Conta Bancária de Pagamento</label>
            <select id="conv-conta" class="form-control">
              <option value="">Selecione a conta...</option>
              ${contas.map(ct => `<option value="${ct.apelido || ct.banco_nome}">${ct.apelido || ct.banco_nome} (${ct.agencia}/${ct.numero})</option>`).join('')}
            </select>
          </div>

          <div class="g2">
            <div class="form-group">
              <label class="form-label">Data de Vencimento</label>
              <input type="date" id="conv-vencimento" class="form-control" value="${p.data_necessidade || Utils.today()}">
            </div>
            <div class="form-group">
              <label class="form-label">Status Inicial</label>
              <select id="conv-status" class="form-control">
                <option value="a_pagar">⏳ A Pagar</option>
                <option value="pago">✓ Pago</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer" style="padding:12px 20px;border-top:1px solid var(--border);justify-content:flex-end;gap:10px;">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="PreCompras.executarConversaoLancamento('${p.id}')" style="font-weight:800;">
            ✓ Confirmar e Lançar
          </button>
        </div>
      </div>
    `);
  },

  executarConversaoLancamento(id) {
    const p = DB.getById('precompras', id);
    if (!p) return;

    const conta = document.getElementById('conv-conta')?.value || '';
    const vencimento = document.getElementById('conv-vencimento')?.value || Utils.today();
    const statusLanc = document.getElementById('conv-status')?.value || 'a_pagar';

    const lancamento = {
      obra_id: p.obra_id,
      tipo: 'despesa',
      data: p.data_solicitacao || Utils.today(),
      data_vencimento: vencimento,
      descricao: `[Ordem ${p.numero_ordem}] ${p.descricao}`,
      categoria: p.categoria || 'material',
      valor: p.valor_total,
      status: statusLanc,
      fornecedor_beneficiario: p.fornecedor_nome || 'Fornecedor',
      conta_bancaria: conta,
      observacoes: `Gerado a partir da Ordem de Pré-Compra ${p.numero_ordem}. ${p.justificativa ? 'Aplicação: ' + p.justificativa : ''}`,
      origem: 'precompra',
      precompra_id: p.id,
      conciliado: false
    };

    const novoLanc = DB.add('lancamentos', lancamento);
    DB.update('precompras', id, {
      status: 'convertida',
      lancamento_id: novoLanc.id
    });

    Utils.closeModal();
    Utils.toast(`Despesa gerada em Lançamentos Financeiros com sucesso!`, 'success');
    App.navigate('precompras');
  },

  visualizarOrdem(id) {
    const p = DB.getById('precompras', id);
    if (!p) return;
    const c = DB.getById('clientes', p.obra_id);
    const docs = typeof Documentos !== 'undefined' ? Documentos.listar('precompra', p.id) : [];

    let seloStatus = '';
    if (p.status === 'aprovada' || p.status === 'convertida') {
      seloStatus = `
        <div style="border:3px solid #16a34a;color:#16a34a;padding:8px 16px;border-radius:8px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-align:center;font-size:1rem;transform:rotate(-4deg);box-shadow:0 2px 8px rgba(22,163,74,0.15);">
          ✓ AUTORIZADO
          <div style="font-size:.65rem;font-weight:700;color:#15803d;margin-top:2px;">${p.aprovado_por || 'ADMINISTRAÇÃO'} &middot; ${Utils.fmt.date(p.aprovado_em?.split('T')[0])}</div>
        </div>`;
    } else if (p.status === 'rejeitada') {
      seloStatus = `
        <div style="border:3px solid #dc2626;color:#dc2626;padding:8px 16px;border-radius:8px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-align:center;font-size:1rem;transform:rotate(-4deg);">
          ✕ NÃO AUTORIZADO
          <div style="font-size:.65rem;font-weight:700;color:#b91c1c;margin-top:2px;">${p.rejeitado_por || 'ADMINISTRAÇÃO'}</div>
        </div>`;
    } else {
      seloStatus = `
        <div style="border:3px dashed #d97706;color:#d97706;padding:8px 16px;border-radius:8px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-align:center;font-size:.9rem;">
          ⏳ EM ANÁLISE / PENDENTE
        </div>`;
    }

    Utils.showModal(`
      <div class="modal" style="max-width:850px;width:95vw;max-height:92vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="border-bottom:1px solid var(--border);padding:14px 20px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.2rem;">📄</span>
            <span class="modal-title">Ordem de Compra Oficial — ${p.numero_ordem}</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn btn-primary btn-sm" onclick="PreCompras.imprimirOrdem('${p.id}')">
              🖨️ Imprimir / Salvar PDF
            </button>
            <button class="modal-close" onclick="Utils.closeModal()">✕</button>
          </div>
        </div>

        <div class="modal-body" style="padding:20px;overflow-y:auto;flex:1;background:#fff;color:#0f172a;border-radius:0 0 10px 10px;" id="folha-ordem-compra">
          ${(() => {
            const emp = DB.getEmpresa();
            const brandName = (emp.nome_fantasia || emp.razao_social || 'Minha Construtora').toUpperCase();
            const logoHtml = emp.logo_url
              ? `<img src="${emp.logo_url}" alt="${brandName}" style="width:70px;height:70px;border-radius:8px;object-fit:contain;border:1px solid #cbd5e1;">`
              : `<div style="width:56px;height:56px;border-radius:8px;background:#182713;border:1px solid #c9a227;display:flex;align-items:center;justify-content:center;font-size:1.8rem;">🏢</div>`;
            return `
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1C2D12;padding-bottom:16px;margin-bottom:16px;">
              <div style="display:flex;align-items:center;gap:14px;">
                ${logoHtml}
                <div>
                  <h1 style="margin:0;font-size:1.4rem;font-weight:900;color:#1C2D12;letter-spacing:0.5px;">${brandName}</h1>
                  <p style="margin:2px 0 0;font-size:.78rem;color:#475569;font-weight:600;">SISTEMA DE GESTÃO FINANCEIRA E CONTROLE DE OBRAS</p>
                  <p style="margin:2px 0 0;font-size:.72rem;color:#64748b;">CNPJ: ${emp.cnpj || 'Não informado'} &middot; ${emp.cidade || ''}/${emp.uf || ''} &middot; Gestão Integrada</p>
                </div>
              </div>
              <div>
                ${seloStatus}
              </div>
            </div>`;
          })()}

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div>
              <div style="font-size:.75rem;font-weight:800;color:#64748b;text-transform:uppercase;">Documento</div>
              <div style="font-size:1.15rem;font-weight:900;color:#0f172a;">ORDEM DE COMPRA / SOLICITAÇÃO DE SUPRIMENTOS</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:.75rem;font-weight:800;color:#64748b;">NÚMERO DO PEDIDO</div>
              <div style="font-size:1.2rem;font-weight:900;color:#C9A227;font-family:monospace;">${p.numero_ordem}</div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;font-size:.8rem;">
            <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:12px;">
              <div style="font-weight:800;color:#1C2D12;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:6px;text-transform:uppercase;font-size:.74rem;">
                📍 Obra / Destino dos Materiais
              </div>
              <div style="line-height:1.5;color:#1e293b;">
                <strong>Obra / Cliente:</strong> ${c?.nome || '—'}<br>
                <strong>Cidade / UF:</strong> ${c?.cidade || '—'} / ${c?.estado || '—'}<br>
                <strong>Endereço:</strong> ${c?.endereco || '—'}<br>
                ${c?.num_contrato_caixa ? `<strong>Contrato Caixa:</strong> ${c.num_contrato_caixa}<br>` : ''}
                <strong>Solicitante:</strong> ${p.solicitante_nome}
              </div>
            </div>

            <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:12px;">
              <div style="font-weight:800;color:#1C2D12;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:6px;text-transform:uppercase;font-size:.74rem;">
                🏢 Fornecedor / Empresa Sugerida
              </div>
              <div style="line-height:1.5;color:#1e293b;">
                <strong>Fornecedor:</strong> ${p.fornecedor_nome || '—'}<br>
                <strong>CNPJ / CPF:</strong> ${p.fornecedor_cnpj || 'Não informado'}<br>
                <strong>Contato / Vendedor:</strong> ${p.fornecedor_contato || 'Não informado'}<br>
                <strong>Forma de Pagamento:</strong> ${p.forma_pagamento || 'A combinar'}<br>
                <strong>Previsão de Entrega:</strong> ${p.data_necessidade ? Utils.fmt.date(p.data_necessidade) : 'Imediata'}
              </div>
            </div>
          </div>

          <div style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:.8rem;color:#1e293b;">
            <div style="margin-bottom:4px;"><strong>Finalidade / Objeto:</strong> ${p.descricao}</div>
            ${p.justificativa ? `<div style="color:#475569;"><strong>Justificativa da Aplicação:</strong> ${p.justificativa}</div>` : ''}
            ${p.parecer_admin ? `<div style="margin-top:4px;color:#15803d;font-weight:600;"><strong>Parecer da Diretoria:</strong> ${p.parecer_admin}</div>` : ''}
          </div>

          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:.82rem;">
            <thead>
              <tr style="background:#1C2D12;color:#F0EAD6;">
                <th style="padding:8px 10px;text-align:center;width:40px;border:1px solid #1C2D12;">Item</th>
                <th style="padding:8px 10px;text-align:left;border:1px solid #1C2D12;">Descrição do Insumo / Serviço</th>
                <th style="padding:8px 10px;text-align:center;width:70px;border:1px solid #1C2D12;">Unid.</th>
                <th style="padding:8px 10px;text-align:right;width:80px;border:1px solid #1C2D12;">Qtd.</th>
                <th style="padding:8px 10px;text-align:right;width:110px;border:1px solid #1C2D12;">Valor Unit.</th>
                <th style="padding:8px 10px;text-align:right;width:120px;border:1px solid #1C2D12;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${(p.itens || []).map((it, idx) => `
                <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                  <td style="padding:7px 10px;text-align:center;border:1px solid #cbd5e1;font-weight:700;color:#64748b;">${idx + 1}</td>
                  <td style="padding:7px 10px;border:1px solid #cbd5e1;font-weight:600;color:#0f172a;">${it.descricao}</td>
                  <td style="padding:7px 10px;text-align:center;border:1px solid #cbd5e1;color:#475569;">${it.unidade}</td>
                  <td style="padding:7px 10px;text-align:right;border:1px solid #cbd5e1;font-weight:700;">${it.quantidade}</td>
                  <td style="padding:7px 10px;text-align:right;border:1px solid #cbd5e1;">${Utils.fmt.currency(it.valor_unitario)}</td>
                  <td style="padding:7px 10px;text-align:right;border:1px solid #cbd5e1;font-weight:800;color:#0f172a;">${Utils.fmt.currency(it.subtotal || (it.quantidade * it.valor_unitario))}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#f1f5f9;font-weight:900;">
                <td colspan="4" style="padding:10px;border:1px solid #cbd5e1;font-size:.85rem;color:#1e293b;">
                  TOTAL GERAL DA ORDEM DE COMPRA:
                </td>
                <td colspan="2" style="padding:10px;border:1px solid #cbd5e1;text-align:right;font-size:1.15rem;color:#15803d;">
                  ${Utils.fmt.currency(p.valor_total)}
                </td>
              </tr>
              <tr>
                <td colspan="6" style="padding:8px 10px;border:1px solid #cbd5e1;background:#fff;font-size:.75rem;color:#64748b;">
                  <strong>Valor por extenso:</strong> ${Utils.extenso(p.valor_total).toUpperCase()}
                </td>
              </tr>
            </tfoot>
          </table>

          ${docs.length > 0 ? `
          <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px;margin-bottom:16px;font-size:.75rem;color:#475569;">
            <strong>📎 Documentos / Notas Fiscais Anexadas (${docs.length}):</strong>
            <ul style="margin:4px 0 0 16px;padding:0;">
              ${docs.map(d => `<li>${d.titulo} (${d.nome_arquivo})</li>`).join('')}
            </ul>
          </div>` : ''}

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:36px;padding-top:20px;font-size:.75rem;text-align:center;color:#334155;">
            <div>
              <div style="border-top:1px solid #64748b;padding-top:4px;margin-bottom:2px;">
                <strong>${p.solicitante_nome}</strong>
              </div>
              <div>Solicitante / Gestor da Obra</div>
            </div>
            <div>
              <div style="border-top:1px solid #64748b;padding-top:4px;margin-bottom:2px;">
                <strong>${p.aprovado_por || 'Administração Geral'}</strong>
              </div>
              <div>Diretoria / Administrador</div>
            </div>
            <div>
              <div style="border-top:1px solid #64748b;padding-top:4px;margin-bottom:2px;">
                <strong>${p.fornecedor_nome || 'Fornecedor'}</strong>
              </div>
              <div>Aceite / Entrega do Fornecedor</div>
            </div>
          </div>

          <div style="margin-top:24px;text-align:center;font-size:.65rem;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:8px;">
            Emitido via ${DB.getEmpresa().nome_fantasia || 'Sistema Financeiro'} &middot; Data de Emissão: ${new Date().toLocaleString('pt-BR')} &middot; Documento Interno de Controle
          </div>
        </div>

        <div class="modal-footer" style="padding:10px 20px;border-top:1px solid var(--border);justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Fechar</button>
        </div>
      </div>
    `);
  },

  imprimirOrdem(id) {
    const conteudo = document.getElementById('folha-ordem-compra')?.innerHTML;
    if (!conteudo) return;

    const printWin = window.open('', '_blank', 'width=900,height=750');
    if (!printWin) {
      Utils.toast('Permita popups para abrir a impressão.', 'warning');
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Ordem de Compra — ${DB.getEmpresa().nome_fantasia || 'Construtora'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #fff; color: #0f172a; padding: 20px; }
          @media print {
            body { padding: 0; }
            @page { margin: 1.5cm; }
          }
        </style>
      </head>
      <body>
        <div>${conteudo}</div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }
};
