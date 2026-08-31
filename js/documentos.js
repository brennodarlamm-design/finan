// js/documentos.js — Gerenciamento e Anexo de Documentos, Boletos e Comprovantes
// Armazenamento em LocalStorage com suporte a PDF, Imagens e Recibos

const Documentos = {
  _KEY: 'finobra_documentos',

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this._KEY) || '[]');
    } catch { return []; }
  },

  salvarLista(docs) {
    localStorage.setItem(this._KEY, JSON.stringify(docs));
  },

  listar(entidadeTipo, entidadeId) {
    const docs = this.getAll();
    return docs.filter(d => d.entidade_tipo === entidadeTipo && d.entidade_id === entidadeId);
  },

  getById(id) {
    return this.getAll().find(d => d.id === id) || null;
  },

  adicionar(doc) {
    const docs = this.getAll();
    const item = {
      id: 'doc_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      criado_em: new Date().toISOString(),
      ...doc
    };
    docs.push(item);
    this.salvarLista(docs);
    return item;
  },

  remover(id) {
    const docs = this.getAll().filter(d => d.id !== id);
    this.salvarLista(docs);
  },

  // Cria boletos e documentos de demonstração
  seedDemoDocs(force = false) {
    if (!force) {
      if (typeof DB !== 'undefined' && (!DB.isDemoLoaded() || localStorage.getItem('finobra_clean_mode') === 'true')) {
        return;
      }
    }
    let docs = this.getAll();
    if (docs.some(d => d._demo)) return;

    const gerarHTMLBoleto = (banco, cedente, sacado, valor, vencimento, linha) => `
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;background:#fff;padding:24px;max-width:700px;margin:0 auto;border:1px solid #cbd5e1;border-radius:6px;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:14px;">
        <div style="font-size:1.2rem;font-weight:900;color:#0f172a;">${banco}</div>
        <div style="font-family:monospace;font-size:.85rem;font-weight:800;letter-spacing:0.5px;color:#0369a1;">${linha}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:.78rem;margin-bottom:16px;">
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px 10px;width:70%;"><strong>Beneficiário / Cedente:</strong><br>${cedente}</td>
          <td style="border:1px solid #cbd5e1;padding:6px 10px;"><strong>Vencimento:</strong><br><span style="color:#b91c1c;font-weight:800;font-size:.9rem;">${vencimento}</span></td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px 10px;"><strong>Pagador / Sacado:</strong><br>${sacado}</td>
          <td style="border:1px solid #cbd5e1;padding:6px 10px;"><strong>Valor do Documento:</strong><br><span style="color:#15803d;font-weight:900;font-size:1rem;">${valor}</span></td>
        </tr>
        <tr>
          <td colspan="2" style="border:1px solid #cbd5e1;padding:12px 10px;background:#f8fafc;">
            <strong>Instruções de Pagamento:</strong><br>
            &bull; Pagável em qualquer agência bancária ou internet banking até o vencimento.<br>
            &bull; Após o vencimento cobrar juros de 1% ao mês e multa de 2%.<br>
            &bull; Referente a fornecimento de materiais para construção civil — Angelim Construtora.
          </td>
        </tr>
      </table>
      <div style="text-align:center;padding:16px;background:#f1f5f9;border-radius:4px;">
        <div style="font-family:monospace;letter-spacing:4px;font-size:1.6rem;color:#0f172a;margin-bottom:4px;">||||| | |||| ||| ||||| || |||||| |||||</div>
        <div style="font-size:.7rem;color:#64748b;">Código de Barras Febraban / CIP</div>
      </div>
    </div>`;

    const demoDocs = [
      {
        entidade_tipo: 'lancamento',
        entidade_id: 'l021',
        titulo: 'Boleto Madeireira Central — R$ 14.500,00',
        nome_arquivo: 'Boleto_Madeireira_Central_14500.html',
        tipo_mime: 'text/html',
        tamanho: 4200,
        data_base64: 'data:text/html;charset=utf-8,' + encodeURIComponent(gerarHTMLBoleto('BANCO DO BRASIL 001-9', 'Madeireira Central Ltda &bull; CNPJ 67.890.123/0001-45', 'Angelim Construtora LTDA &bull; CNPJ 12.345.678/0001-90', 'R$ 14.500,00', 'Em 6 dias', '00190.00009 01234.567890 12345.678901 9 99200001450000')),
        _demo: true
      },
      {
        entidade_tipo: 'lancamento',
        entidade_id: 'l022',
        titulo: 'Boleto Cerâmica Vale Verde — R$ 8.200,00',
        nome_arquivo: 'Boleto_Ceramica_Vale_Verde_8200.html',
        tipo_mime: 'text/html',
        tamanho: 4100,
        data_base64: 'data:text/html;charset=utf-8,' + encodeURIComponent(gerarHTMLBoleto('BANCO SANTANDER 033-7', 'Cerâmica Vale Verde &bull; CNPJ 56.789.012/0001-34', 'Angelim Construtora LTDA &bull; CNPJ 12.345.678/0001-90', 'R$ 8.200,00', 'Em 15 dias', '03399.81234 12345.678901 23456.789012 1 98800000820000')),
        _demo: true
      },
      {
        entidade_tipo: 'lancamento',
        entidade_id: 'l026',
        titulo: 'Boleto Votorantim Cimentos — R$ 3.850,00',
        nome_arquivo: 'Boleto_Votorantim_Cimentos_3850.html',
        tipo_mime: 'text/html',
        tamanho: 4150,
        data_base64: 'data:text/html;charset=utf-8,' + encodeURIComponent(gerarHTMLBoleto('BANCO BRADESCO 237-2', 'Votorantim Cimentos S.A. &bull; CNPJ 01.234.567/0001-89', 'Angelim Construtora LTDA &bull; CNPJ 12.345.678/0001-90', 'R$ 3.850,00', 'Em 9 dias', '23793.38128 60000.778899 12000.456789 4 98850000385000')),
        _demo: true
      },
      {
        entidade_tipo: 'lancamento',
        entidade_id: 'l027',
        titulo: 'Boleto Tubos Tigre — R$ 2.940,00',
        nome_arquivo: 'Boleto_Tubos_Tigre_2940.html',
        tipo_mime: 'text/html',
        tamanho: 4050,
        data_base64: 'data:text/html;charset=utf-8,' + encodeURIComponent(gerarHTMLBoleto('BANCO DO BRASIL 001-9', 'Tigre Materiais Hidráulicos &bull; CNPJ 98.765.432/0001-10', 'Angelim Construtora LTDA &bull; CNPJ 12.345.678/0001-90', 'R$ 2.940,00', 'Em 21 dias', '34191.79001 01043.998877 66020.150008 2 98890000294000')),
        _demo: true
      },
      {
        entidade_tipo: 'precompra',
        entidade_id: 'pc_001',
        titulo: 'Cotação Comercial 1042 — Siderúrgica Paulo (Aço CA-50)',
        nome_arquivo: 'Cotacao_Aco_Siderurgica_Paulo.html',
        tipo_mime: 'text/html',
        tamanho: 3800,
        data_base64: 'data:text/html;charset=utf-8,' + encodeURIComponent(`
          <div style="font-family:'Segoe UI',sans-serif;background:#fff;padding:24px;border:1px solid #cbd5e1;border-radius:8px;max-width:650px;margin:0 auto;color:#0f172a;">
            <div style="display:flex;justify-content:space-between;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:12px;">
              <h2 style="margin:0;font-size:1.1rem;color:#0f172a;">SIDERÚRGICA PAULO & CIA LTDA</h2>
              <span style="font-weight:700;color:#0284c7;">PROPOSTA Nº 1042/2026</span>
            </div>
            <p style="font-size:.8rem;color:#475569;margin-bottom:12px;"><strong>Cliente:</strong> Angelim Construtora | <strong>Obra:</strong> Res. João Carlos Ferreira (Sorocaba/SP)</p>
            <table style="width:100%;border-collapse:collapse;font-size:.8rem;margin-bottom:14px;">
              <tr style="background:#f1f5f9;font-weight:700;"><td style="padding:6px;border:1px solid #cbd5e1;">Item</td><td style="padding:6px;border:1px solid #cbd5e1;">Qtd</td><td style="padding:6px;border:1px solid #cbd5e1;">Unitário</td><td style="padding:6px;border:1px solid #cbd5e1;">Total</td></tr>
              <tr><td style="padding:6px;border:1px solid #cbd5e1;">Barra Aço CA-50 10.0mm 12m</td><td style="padding:6px;border:1px solid #cbd5e1;">120 barras</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 65,00</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 7.800,00</td></tr>
              <tr><td style="padding:6px;border:1px solid #cbd5e1;">Barra Aço CA-50 8.0mm 12m</td><td style="padding:6px;border:1px solid #cbd5e1;">80 barras</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 45,00</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 3.600,00</td></tr>
              <tr><td style="padding:6px;border:1px solid #cbd5e1;">Malha Soldada Q-138 2.45x6m</td><td style="padding:6px;border:1px solid #cbd5e1;">12 un</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 200,00</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 2.400,00</td></tr>
              <tr style="background:#f8fafc;font-weight:800;"><td colspan="3" style="padding:6px;border:1px solid #cbd5e1;text-align:right;">TOTAL:</td><td style="padding:6px;border:1px solid #cbd5e1;color:#15803d;">R$ 13.800,00</td></tr>
            </table>
            <div style="font-size:.75rem;color:#64748b;">Condições: Boleto 28 DDL. Frete incluso para entrega no canteiro. Validade da proposta: 7 dias.</div>
          </div>
        `),
        _demo: true
      },
      {
        entidade_tipo: 'precompra',
        entidade_id: 'pc_002',
        titulo: 'Orçamento de Madeiramento — Madeireira Central',
        nome_arquivo: 'Orcamento_Madeireira_Central_PC002.html',
        tipo_mime: 'text/html',
        tamanho: 3600,
        data_base64: 'data:text/html;charset=utf-8,' + encodeURIComponent(`
          <div style="font-family:'Segoe UI',sans-serif;background:#fff;padding:24px;border:1px solid #cbd5e1;border-radius:8px;max-width:650px;margin:0 auto;color:#0f172a;">
            <div style="display:flex;justify-content:space-between;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:12px;">
              <h2 style="margin:0;font-size:1.1rem;color:#0f172a;">MADEIREIRA CENTRAL LTDA</h2>
              <span style="font-weight:700;color:#0284c7;">ORÇAMENTO Nº 8821</span>
            </div>
            <p style="font-size:.8rem;color:#475569;margin-bottom:12px;"><strong>Solicitante:</strong> Angelim Construtora — Sorocaba/SP</p>
            <table style="width:100%;border-collapse:collapse;font-size:.8rem;margin-bottom:14px;">
              <tr style="background:#f1f5f9;font-weight:700;"><td style="padding:6px;border:1px solid #cbd5e1;">Insumo</td><td style="padding:6px;border:1px solid #cbd5e1;">Qtd</td><td style="padding:6px;border:1px solid #cbd5e1;">Unitário</td><td style="padding:6px;border:1px solid #cbd5e1;">Total</td></tr>
              <tr><td style="padding:6px;border:1px solid #cbd5e1;">Viga Cambará 6x12cm 5m</td><td style="padding:6px;border:1px solid #cbd5e1;">25 un</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 180,00</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 4.500,00</td></tr>
              <tr><td style="padding:6px;border:1px solid #cbd5e1;">Caibro Cambará 5x5cm 4m</td><td style="padding:6px;border:1px solid #cbd5e1;">60 un</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 45,00</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 2.700,00</td></tr>
              <tr><td style="padding:6px;border:1px solid #cbd5e1;">Ripas 2x5cm 3m</td><td style="padding:6px;border:1px solid #cbd5e1;">15 dz</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 150,00</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 2.250,00</td></tr>
              <tr style="background:#f8fafc;font-weight:800;"><td colspan="3" style="padding:6px;border:1px solid #cbd5e1;text-align:right;">TOTAL:</td><td style="padding:6px;border:1px solid #cbd5e1;color:#15803d;">R$ 9.450,00</td></tr>
            </table>
            <div style="font-size:.75rem;color:#64748b;">Prazo de entrega: 3 dias úteis. Pagamento Boleto 30 DDL.</div>
          </div>
        `),
        _demo: true
      },
      {
        entidade_tipo: 'precompra',
        entidade_id: 'pc_004',
        titulo: 'Nota Fiscal NF-e 004512 — Votorantim Cimentos (R$ 3.850,00)',
        nome_arquivo: 'Danfe_NFe_004512_Votorantim.html',
        tipo_mime: 'text/html',
        tamanho: 4200,
        data_base64: 'data:text/html;charset=utf-8,' + encodeURIComponent(`
          <div style="font-family:'Segoe UI',sans-serif;background:#fff;padding:24px;border:1px solid #cbd5e1;border-radius:8px;max-width:650px;margin:0 auto;color:#0f172a;">
            <div style="display:flex;justify-content:space-between;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:12px;">
              <h2 style="margin:0;font-size:1.1rem;color:#0f172a;">DANFE — NOTA FISCAL ELETRÔNICA</h2>
              <span style="font-weight:700;color:#0284c7;">NF-e Nº 004512 SÉRIE 1</span>
            </div>
            <p style="font-size:.8rem;color:#475569;margin-bottom:12px;"><strong>Emitente:</strong> Votorantim Cimentos S.A. | CNPJ: 01.234.567/0001-88<br><strong>Destinatário:</strong> Angelim Construtora LTDA | CNPJ: 12.345.678/0001-90</p>
            <table style="width:100%;border-collapse:collapse;font-size:.8rem;margin-bottom:14px;">
              <tr style="background:#f1f5f9;font-weight:700;"><td style="padding:6px;border:1px solid #cbd5e1;">Código / Descrição</td><td style="padding:6px;border:1px solid #cbd5e1;">Qtd</td><td style="padding:6px;border:1px solid #cbd5e1;">Unitário</td><td style="padding:6px;border:1px solid #cbd5e1;">Total</td></tr>
              <tr><td style="padding:6px;border:1px solid #cbd5e1;">Cimento Portland CP-II-E-32 Saco 50kg</td><td style="padding:6px;border:1px solid #cbd5e1;">70 sc</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 38,00</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 2.660,00</td></tr>
              <tr><td style="padding:6px;border:1px solid #cbd5e1;">Argamassa Colante AC-III Saco 20kg</td><td style="padding:6px;border:1px solid #cbd5e1;">34 sc</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 35,00</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 1.190,00</td></tr>
              <tr style="background:#f8fafc;font-weight:800;"><td colspan="3" style="padding:6px;border:1px solid #cbd5e1;text-align:right;">VALOR TOTAL DA NOTA:</td><td style="padding:6px;border:1px solid #cbd5e1;color:#15803d;">R$ 3.850,00</td></tr>
            </table>
            <div style="font-size:.75rem;color:#64748b;">Chave de Acesso: 3526 0801 2345 6700 0188 5500 1000 0045 1218 9234 5678</div>
          </div>
        `),
        _demo: true
      },
      {
        entidade_tipo: 'lancamento',
        entidade_id: 'l_adm_001',
        titulo: 'Fatura de Energia Elétrica — Roraima Energia (R$ 1.280,00)',
        nome_arquivo: 'Fatura_Energia_Sede_1280.html',
        tipo_mime: 'text/html',
        tamanho: 4100,
        data_base64: 'data:text/html;charset=utf-8,' + encodeURIComponent(`
          <div style="font-family:'Segoe UI',sans-serif;background:#fff;padding:24px;border:1px solid #cbd5e1;border-radius:8px;max-width:650px;margin:0 auto;color:#0f172a;">
            <div style="display:flex;justify-content:space-between;border-bottom:2px solid #0284c7;padding-bottom:8px;margin-bottom:12px;">
              <h2 style="margin:0;font-size:1.1rem;color:#0284c7;">EQUATORIAL / RORAIMA ENERGIA S.A.</h2>
              <span style="font-weight:700;color:#0f172a;">FATURA DE ENERGIA ELÉTRICA</span>
            </div>
            <p style="font-size:.8rem;color:#475569;margin-bottom:12px;"><strong>Unidade Consumidora:</strong> 00458921-3 | <strong>Mês/Ano:</strong> 08/2026<br><strong>Cliente:</strong> Angelim Construtora LTDA &bull; CNPJ 12.345.678/0001-90</p>
            <table style="width:100%;border-collapse:collapse;font-size:.8rem;margin-bottom:14px;">
              <tr style="background:#f1f5f9;font-weight:700;"><td style="padding:6px;border:1px solid #cbd5e1;">Descrição do Consumo</td><td style="padding:6px;border:1px solid #cbd5e1;">Consumo (kWh)</td><td style="padding:6px;border:1px solid #cbd5e1;">Tarifa c/ Tributos</td><td style="padding:6px;border:1px solid #cbd5e1;">Valor</td></tr>
              <tr><td style="padding:6px;border:1px solid #cbd5e1;">Consumo Ativo Comercial (TUSD + TE)</td><td style="padding:6px;border:1px solid #cbd5e1;">1.420 kWh</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 0,845</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 1.199,90</td></tr>
              <tr><td style="padding:6px;border:1px solid #cbd5e1;">Contribuição Iluminação Pública (CIP)</td><td style="padding:6px;border:1px solid #cbd5e1;">—</td><td style="padding:6px;border:1px solid #cbd5e1;">—</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 80,10</td></tr>
              <tr style="background:#f8fafc;font-weight:800;"><td colspan="3" style="padding:6px;border:1px solid #cbd5e1;text-align:right;">TOTAL A PAGAR:</td><td style="padding:6px;border:1px solid #cbd5e1;color:#b91c1c;font-size:.95rem;">R$ 1.280,00</td></tr>
            </table>
            <div style="background:#f1f5f9;padding:10px;border-radius:4px;font-family:monospace;font-size:.85rem;text-align:center;color:#0f172a;font-weight:700;">
              83640.00001 28000.123456 78901.234567 1 99200000128000
            </div>
          </div>
        `),
        _demo: true
      },
      {
        entidade_tipo: 'lancamento',
        entidade_id: 'l_adm_003',
        titulo: 'Guia DAS — Simples Nacional Receita Federal (R$ 4.850,00)',
        nome_arquivo: 'Guia_DAS_Simples_Nacional_4850.html',
        tipo_mime: 'text/html',
        tamanho: 4200,
        data_base64: 'data:text/html;charset=utf-8,' + encodeURIComponent(`
          <div style="font-family:'Segoe UI',sans-serif;background:#fff;padding:24px;border:1px solid #cbd5e1;border-radius:8px;max-width:650px;margin:0 auto;color:#0f172a;">
            <div style="display:flex;justify-content:space-between;border-bottom:2px solid #15803d;padding-bottom:8px;margin-bottom:12px;">
              <div>
                <h2 style="margin:0;font-size:1.1rem;color:#15803d;">MINISTÉRIO DA FAZENDA — RECEITA FEDERAL</h2>
                <div style="font-size:.75rem;color:#475569;font-weight:700;">DOCUMENTO DE ARRECADAÇÃO DO SIMPLES NACIONAL (DAS)</div>
              </div>
              <span style="font-weight:900;color:#0f172a;font-size:1.2rem;">DAS</span>
            </div>
            <p style="font-size:.8rem;color:#475569;margin-bottom:12px;"><strong>Contribuinte:</strong> Angelim Construtora LTDA &bull; CNPJ 12.345.678/0001-90<br><strong>Período de Apuração:</strong> 07/2026 &middot; <strong>Data Limite Pagamento:</strong> 20/08/2026</p>
            <table style="width:100%;border-collapse:collapse;font-size:.8rem;margin-bottom:14px;">
              <tr style="background:#f1f5f9;font-weight:700;"><td style="padding:6px;border:1px solid #cbd5e1;">Tributo Integrado no Simples</td><td style="padding:6px;border:1px solid #cbd5e1;">Alíquota Efetiva</td><td style="padding:6px;border:1px solid #cbd5e1;">Valor Tributado</td></tr>
              <tr><td style="padding:6px;border:1px solid #cbd5e1;">IRPJ + CSLL + PIS/COFINS + CPP (Construção Civil)</td><td style="padding:6px;border:1px solid #cbd5e1;">Anexo IV Simples</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 3.650,00</td></tr>
              <tr><td style="padding:6px;border:1px solid #cbd5e1;">ISSQN Municipal (Serviços de Engenharia e Obras)</td><td style="padding:6px;border:1px solid #cbd5e1;">2,50%</td><td style="padding:6px;border:1px solid #cbd5e1;">R$ 1.200,00</td></tr>
              <tr style="background:#f8fafc;font-weight:800;"><td colspan="2" style="padding:6px;border:1px solid #cbd5e1;text-align:right;">TOTAL DO DOCUMENTO:</td><td style="padding:6px;border:1px solid #cbd5e1;color:#b91c1c;font-size:1rem;">R$ 4.850,00</td></tr>
            </table>
            <div style="background:#f1f5f9;padding:10px;border-radius:4px;font-family:monospace;font-size:.85rem;text-align:center;color:#0f172a;font-weight:700;">
              85820.00004 85000.104050 12345.678901 3 99200000485000
            </div>
          </div>
        `),
        _demo: true
      }
    ];

    demoDocs.forEach(d => {
      if (!docs.some(x => x.entidade_id === d.entidade_id)) {
        this.adicionar(d);
      }
    });
  },

  // Helper para ler arquivo como Base64
  lerArquivoBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  },

  // Retorna o botão com ícone de clipe para exibir nas tabelas
  badgeClip(entidadeTipo, entidadeId, options = {}) {
    const docs = this.listar(entidadeTipo, entidadeId);
    const qtd = docs.length;
    const hasDocs = qtd > 0;
    const label = options.showLabel ? ` 📎 ${qtd} ${qtd===1?'anexo':'anexos'}` : `📎${qtd > 0 ? ` <span style="font-size:.7rem;font-weight:800;background:var(--accent);color:#000;border-radius:10px;padding:1px 5px;">${qtd}</span>` : ''}`;

    return `
    <button class="btn btn-sm ${hasDocs ? 'btn-secondary' : 'btn-secondary'}" 
            style="padding:3px 8px;font-size:.75rem;white-space:nowrap;${hasDocs ? 'border-color:var(--accent);color:var(--accent);font-weight:700;' : 'opacity:.7;'}"
            onclick="Documentos.abrirModal('${entidadeTipo}', '${entidadeId}', '${options.titulo || 'Documentos Anexados'}')" 
            title="${hasDocs ? `${qtd} documento(s) anexado(s)` : 'Anexar boleto ou documento'}">
      ${label}
    </button>`;
  },

  // Abre Modal de Gerenciamento de Anexos
  abrirModal(entidadeTipo, entidadeId, titulo = 'Anexos & Comprovantes') {
    const docs = this.listar(entidadeTipo, entidadeId);
    
    // Obter dados da entidade para contextualizar o modal
    let infoEntidade = '';
    if (entidadeTipo === 'lancamento') {
      const l = DB.getById('lancamentos', entidadeId);
      if (l) {
        const c = DB.getById('clientes', l.obra_id);
        infoEntidade = `
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 14px;margin-bottom:16px;font-size:.82rem;">
          <div><strong style="color:var(--text);">${l.descricao}</strong> &middot; <span style="color:${l.tipo==='receita'?'var(--success)':'var(--danger)'};font-weight:800;">${Utils.fmt.currency(l.valor)}</span></div>
          <div style="color:var(--text3);margin-top:2px;">Obra: ${c?.nome || '&mdash;'} &middot; Vencimento: ${Utils.fmt.date(l.data_vencimento || l.data)}</div>
        </div>`;
      }
    } else if (entidadeTipo === 'medicao') {
      const m = DB.getById('medicoes', entidadeId);
      if (m) {
        const c = DB.getById('clientes', m.obra_id);
        infoEntidade = `
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 14px;margin-bottom:16px;font-size:.82rem;">
          <div><strong style="color:var(--text);">${m.numero_medicao}&ordf; Medi&ccedil;&atilde;o Caixa (${m.percentual_fisico}%)</strong> &middot; <span style="color:var(--success);font-weight:800;">${Utils.fmt.currency(m.valor_liberado || m.valor_solicitado)}</span></div>
          <div style="color:var(--text3);margin-top:2px;">Obra: ${c?.nome || '&mdash;'} &middot; Etapa: ${m.etapa_descricao}</div>
        </div>`;
      }
    }

    Utils.showModal(`
      <div class="modal" style="max-width:650px;">
        <div class="modal-header">
          <span class="modal-title">📎 ${titulo}</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body">
          ${infoEntidade}

          <!-- Área de Upload / Dropzone -->
          <div style="border:2px dashed var(--border);border-radius:var(--r-md);padding:20px;text-align:center;background:var(--bg-card);margin-bottom:20px;">
            <div style="font-size:2rem;margin-bottom:6px;">📄</div>
            <div style="font-weight:700;margin-bottom:4px;color:var(--text);">Adicionar Boleto, Comprovante ou Foto</div>
            <div style="font-size:.76rem;color:var(--text3);margin-bottom:12px;">Formatos aceitos: PDF, PNG, JPG, JPEG (Máx. 5MB)</div>
            
            <div style="display:flex;gap:8px;max-width:420px;margin:0 auto;flex-wrap:wrap;justify-content:center;">
              <input type="text" id="doc-titulo-input" class="form-control form-control-sm" placeholder="Nome/Descrição do documento (opcional)" style="flex:1;min-width:180px;">
              <label class="btn btn-primary btn-sm" style="cursor:pointer;margin:0;">
                📁 Escolher Arquivo
                <input type="file" id="doc-file-input" accept="image/*,application/pdf" style="display:none;" onchange="Documentos._onUpload('${entidadeTipo}', '${entidadeId}', this)">
              </label>
            </div>
          </div>

          <!-- Lista de Arquivos Anexados -->
          <div style="font-size:.85rem;font-weight:800;color:var(--text);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
            <span>Arquivos Anexados (${docs.length})</span>
          </div>

          <div id="doc-list-container" style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow-y:auto;">
            ${docs.length ? docs.map(d => this._renderDocRow(d)).join('') : `
            <div style="text-align:center;padding:24px;color:var(--text3);font-size:.82rem;">
              Nenhum documento anexado ainda. Escolha um arquivo acima para anexar.
            </div>`}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Fechar</button>
        </div>
      </div>
    `);
  },

  _renderDocRow(d) {
    const isPDF = d.tipo_mime === 'application/pdf' || (d.nome_arquivo || '').toLowerCase().endsWith('.pdf');
    const icon = isPDF ? '📕' : '🖼️';
    const tamKB = d.tamanho ? `${(d.tamanho / 1024).toFixed(1)} KB` : '';

    return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);gap:12px;">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <span style="font-size:1.4rem;">${icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:.84rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${d.titulo || d.nome_arquivo}
          </div>
          <div style="font-size:.72rem;color:var(--text3);">
            ${d.nome_arquivo} ${tamKB ? `&middot; ${tamKB}` : ''} &middot; Anexado em ${Utils.fmt.datetime(d.criado_em)}
          </div>
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <button class="btn btn-sm btn-secondary" onclick="Documentos.visualizar('${d.id}')" title="Visualizar documento">
          👁️ Ver
        </button>
        <button class="btn btn-sm btn-secondary" onclick="Documentos.baixar('${d.id}')" title="Baixar arquivo">
          ⬇️
        </button>
        <button class="icon-btn btn-sm" onclick="Documentos._confirmDel('${d.id}')" style="color:var(--danger)" title="Excluir anexo">
          🗑️
        </button>
      </div>
    </div>`;
  },

  async _onUpload(entidadeTipo, entidadeId, input) {
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      Utils.toast('Arquivo muito grande! O limite máximo é de 5MB.', 'error');
      input.value = '';
      return;
    }

    const tituloInput = document.getElementById('doc-titulo-input');
    const titulo = tituloInput?.value.trim() || file.name;

    try {
      Utils.toast('Processando arquivo...', 'info');
      const base64 = await this.lerArquivoBase64(file);
      
      this.adicionar({
        entidade_tipo: entidadeTipo,
        entidade_id: entidadeId,
        titulo: titulo,
        nome_arquivo: file.name,
        tipo_mime: file.type || 'application/octet-stream',
        tamanho: file.size,
        data_base64: base64
      });

      Utils.toast('Documento anexado com sucesso!', 'success');
      this.abrirModal(entidadeTipo, entidadeId);
      
      // Atualizar a visualização na tabela se aplicável
      if (typeof Lancamentos !== 'undefined' && Lancamentos._refresh) Lancamentos._refresh();
      if (typeof Medicoes !== 'undefined' && Medicoes._refresh) Medicoes._refresh();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao processar o arquivo.', 'error');
    }
  },

  _confirmDel(id) {
    const doc = this.getById(id);
    if (!doc) return;
    Utils.confirm(`Excluir o anexo "${doc.titulo || doc.nome_arquivo}"?`, () => {
      this.remover(id);
      Utils.toast('Anexo removido!', 'info');
      this.abrirModal(doc.entidade_tipo, doc.entidade_id);
      if (typeof Lancamentos !== 'undefined' && Lancamentos._refresh) Lancamentos._refresh();
      if (typeof Medicoes !== 'undefined' && Medicoes._refresh) Medicoes._refresh();
    });
  },

  visualizar(id) {
    const doc = this.getById(id);
    if (!doc || !doc.data_base64) {
      Utils.toast('Arquivo não encontrado.', 'error');
      return;
    }

    const isPDF = doc.tipo_mime === 'application/pdf' || (doc.nome_arquivo || '').toLowerCase().endsWith('.pdf');
    const isHTML = doc.tipo_mime === 'text/html' || (doc.nome_arquivo || '').toLowerCase().endsWith('.html') || doc.data_base64.startsWith('data:text/html');

    Utils.showModal(`
      <div class="modal" style="max-width:850px;width:95vw;height:85vh;display:flex;flex-direction:column;">
        <div class="modal-header">
          <span class="modal-title">👁️ ${doc.titulo || doc.nome_arquivo}</span>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn btn-sm btn-primary" onclick="Documentos.baixar('${doc.id}')">⬇️ Baixar</button>
            <button class="modal-close" onclick="Utils.closeModal()">✕</button>
          </div>
        </div>
        <div class="modal-body" style="flex:1;padding:0;overflow:hidden;background:#0f172a;display:flex;align-items:center;justify-content:center;">
          ${isPDF || isHTML ? `
            <iframe src="${doc.data_base64}" style="width:100%;height:100%;border:none;background:#ffffff;"></iframe>
          ` : `
            <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;">
              <img src="${doc.data_base64}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:4px;box-shadow:0 4px 20px rgba(0,0,0,0.5);" onerror="this.parentElement.innerHTML='<div style=\\'color:#fff;padding:20px;text-align:center;\\'>Não foi possível exibir a pré-visualização. Clique em Baixar para ver o arquivo.</div>'">
            </div>
          `}
        </div>
      </div>
    `);
  },

  baixar(id) {
    const doc = this.getById(id);
    if (!doc || !doc.data_base64) return;

    const link = document.createElement('a');
    link.href = doc.data_base64;
    link.download = doc.nome_arquivo || 'documento';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
};
