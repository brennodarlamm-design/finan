// js/nfe_parser.js — Parser de XML de NF-e e Processamento de Lotes SEFAZ

const NFeParser = {
  extrairChave(xmlText) {
    if (!xmlText) return '';
    const m = xmlText.match(/Id=["'](?:NFe)?(\d{44})["']/i) || xmlText.match(/<chNFe>(\d{44})<\/chNFe>/i) || xmlText.match(/(\d{44})/);
    return m ? m[1] : '';
  },

  parseXml(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('XML com erro de formatação.');

    const get = (parent, tag) => {
      let el = parent.querySelector(tag);
      if (!el) {
        const all = parent.getElementsByTagName(tag);
        el = all.length ? all[0] : null;
      }
      if (!el) {
        const all = parent.querySelectorAll('*');
        for (const node of all) {
          if (node.localName === tag) { el = node; break; }
        }
      }
      return el?.textContent?.trim() || '';
    };

    const infNFe = doc.querySelector('infNFe') ||
                   Array.from(doc.querySelectorAll('*')).find(el => el.localName === 'infNFe');
    if (!infNFe) throw new Error('Estrutura <infNFe> não encontrada no XML.');

    const chaveRaw = infNFe.getAttribute('Id') || '';
    const chave = chaveRaw.replace(/^NFe/, '').trim();

    const ide = infNFe.querySelector('ide') || Array.from(infNFe.querySelectorAll('*')).find(el => el.localName === 'ide');
    const nNF = get(ide || infNFe, 'nNF');
    const serie = get(ide || infNFe, 'serie') || '1';
    const dhEmi = get(ide || infNFe, 'dhEmi') || get(ide || infNFe, 'dEmi');
    const dataEmissao = dhEmi ? dhEmi.substring(0, 10) : Utils.today();

    // Emitente
    const emit = infNFe.querySelector('emit') || Array.from(infNFe.querySelectorAll('*')).find(el => el.localName === 'emit');
    const emitenteNome = get(emit || infNFe, 'xNome') || get(emit || infNFe, 'xFant');
    const emitenteCNPJ = get(emit || infNFe, 'CNPJ') || get(emit || infNFe, 'CPF');
    const cnpjFmt = emitenteCNPJ.length === 14
      ? emitenteCNPJ.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
      : emitenteCNPJ;
    const enderEmit = emit?.querySelector('enderEmit') || emit;
    const emitenteTelefone = get(enderEmit || emit || infNFe, 'fone');
    const emitenteCidade = get(enderEmit || emit || infNFe, 'xMun');
    const emitenteUF = get(enderEmit || emit || infNFe, 'UF');

    // Totais
    const icmsTot = infNFe.querySelector('ICMSTot') || Array.from(infNFe.querySelectorAll('*')).find(el => el.localName === 'ICMSTot');
    const vNF = parseFloat(get(icmsTot || infNFe, 'vNF')) || 0;
    const vICMS = parseFloat(get(icmsTot || infNFe, 'vICMS')) || 0;
    const vIPI = parseFloat(get(icmsTot || infNFe, 'vIPI')) || 0;
    const vPIS = parseFloat(get(icmsTot || infNFe, 'vPIS')) || 0;
    const vCOFINS = parseFloat(get(icmsTot || infNFe, 'vCOFINS')) || 0;
    const vISS = parseFloat(get(icmsTot || infNFe, 'vISS')) || 0;
    const impostos = parseFloat((vICMS + vIPI + vPIS + vCOFINS + vISS).toFixed(2));
    const valorLiquido = parseFloat((vNF - impostos).toFixed(2));

    // Duplicatas / Cobrança
    const duplicatas = [];
    const dups = infNFe.querySelectorAll('dup');
    if (dups && dups.length) {
      dups.forEach(d => {
        const nDup = get(d, 'nDup');
        const dVenc = get(d, 'dVenc');
        const vDup = parseFloat(get(d, 'vDup')) || 0;
        if (vDup > 0) duplicatas.push({ numero: nDup, vencimento: dVenc, valor: vDup });
      });
    }

    // Itens / Produtos
    const itens = [];
    const dets = infNFe.querySelectorAll('det');
    if (dets && dets.length) {
      dets.forEach((d, idx) => {
        const prod = d.querySelector('prod') || d;
        const xProd = get(prod, 'xProd');
        const qCom = parseFloat(get(prod, 'qCom')) || 0;
        const uCom = get(prod, 'uCom') || 'UN';
        const vProd = parseFloat(get(prod, 'vProd')) || 0;
        if (xProd) itens.push({ item: idx + 1, nome: xProd, qtd: qCom, unidade: uCom, total: vProd });
      });
    }

    return {
      chave,
      numero_nf: nNF,
      serie,
      data_emissao: dataEmissao,
      emitente: emitenteNome,
      cnpj_emitente: cnpjFmt,
      telefone_emitente: emitenteTelefone,
      cidade_emitente: emitenteCidade,
      uf_emitente: emitenteUF,
      valor_bruto: vNF,
      impostos,
      valor_liquido: valorLiquido,
      duplicatas,
      itens
    };
  },

  async processarArquivosXML(files, nfe) {
    const resultDiv = document.getElementById('nfe-cert-resultado');
    const dropzone  = document.getElementById('nfe-cert-dropzone');
    if (!resultDiv) return;

    const xmlFiles = files.filter(f => f.name.toLowerCase().endsWith('.xml') || f.type.includes('xml'));
    if (!xmlFiles.length) {
      resultDiv.innerHTML = `
        <div style="padding:12px 16px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:var(--r-md);color:var(--danger);font-size:.85rem;">
          ⚠️ Nenhum arquivo XML válido selecionado. Escolha arquivos <strong>.xml</strong> (lote SEFAZ ou NF-e individual).
        </div>`;
      return;
    }

    if (dropzone) {
      dropzone.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;">
          <div style="width:22px;height:22px;border:2px solid rgba(255,255,255,.15);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite;"></div>
          <div>
            <div style="font-weight:700;color:var(--text);">Processando ${xmlFiles.length} arquivo(s) XML...</div>
            <div style="font-size:.78rem;color:var(--text3);margin-top:2px;">Enviando para a API MeuDanfe e indexando</div>
          </div>
        </div>`;
    }
    resultDiv.innerHTML = '';

    const listaGeral = [];

    for (const file of xmlFiles) {
      try {
        const xmlText = await file.text();
        const isLoteSefaz = xmlText.includes('retDistDFeInt') || xmlText.includes('enviNFe') || xmlText.includes('loteDistDFeInt');
        const isIndividualNFe = xmlText.includes('nfeProc') || xmlText.includes('NFe') || xmlText.includes('procNFe') || xmlText.includes('cteProc') || xmlText.includes('CTe');

        if (isLoteSefaz) {
          const itens = await nfe.enviarSefazXml(xmlText);
          if (Array.isArray(itens)) {
            itens.forEach(item => {
              listaGeral.push({
                arquivo: file.name,
                chave: item.chave ? nfe._limparChave(item.chave) : (this.extrairChave(xmlText) || ''),
                status: item.status || 'OK',
                statusMessage: item.statusMessage || 'Processado do lote SEFAZ'
              });
            });
          }
        } else if (isIndividualNFe) {
          const chaveExtraida = this.extrairChave(xmlText);
          try {
            const resp = await nfe.enviarXmlIndividual(xmlText);
            const chave = (resp && resp.chave) ? nfe._limparChave(resp.chave) : (chaveExtraida || '');
            listaGeral.push({
              arquivo: file.name,
              chave: chave,
              status: resp?.status || 'OK',
              statusMessage: resp?.statusMessage || 'NF-e enviada e adicionada (Grátis)'
            });
          } catch (errApi) {
            if (chaveExtraida) {
              listaGeral.push({
                arquivo: file.name,
                chave: chaveExtraida,
                status: 'OK',
                statusMessage: `Chave identificada (${errApi.message})`
              });
            } else {
              listaGeral.push({
                arquivo: file.name,
                chave: '',
                status: 'ERROR',
                statusMessage: errApi.message
              });
            }
          }
        } else {
          const chaveExtraida = this.extrairChave(xmlText);
          if (chaveExtraida) {
            listaGeral.push({
              arquivo: file.name,
              chave: chaveExtraida,
              status: 'OK',
              statusMessage: 'Chave identificada no arquivo XML'
            });
          } else {
            listaGeral.push({
              arquivo: file.name,
              chave: '',
              status: 'ERROR',
              statusMessage: 'Estrutura XML não reconhecida (nem lote SEFAZ, nem NF-e).'
            });
          }
        }
      } catch (err) {
        listaGeral.push({
          arquivo: file.name,
          chave: '',
          status: 'ERROR',
          statusMessage: err.message
        });
      }
    }

    // Adiciona as OK ao cache local
    listaGeral.forEach(item => {
      if (item.status === 'OK' && item.chave && nfe._validarChave(item.chave)) {
        nfe._addToCache({ chave: item.chave, status: 'OK', response: item });
      }
    });

    // Atualiza tab cache
    const btnCache = document.getElementById('tab-nfe-cache');
    if (btnCache) btnCache.textContent = `📋 Consultadas Recentemente (${nfe._getCache().length})`;

    // Resumo
    const ok      = listaGeral.filter(i => i.status === 'OK').length;
    const waiting = listaGeral.filter(i => i.status === 'WAITING').length;
    const err     = listaGeral.filter(i => !['OK','WAITING','AUTO_SEARCH_OFF'].includes(i.status)).length;
    const off     = listaGeral.filter(i => i.status === 'AUTO_SEARCH_OFF').length;

    // Renderiza resultados
    resultDiv.innerHTML = `
      <div style="margin-bottom:14px;">
        <div style="font-weight:800;color:var(--text);margin-bottom:10px;">
          📦 Resultado: <strong>${listaGeral.length}</strong> documento(s) processado(s)
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
          ${ok      ? `<span style="background:rgba(16,185,129,.15);color:var(--success);border:1px solid rgba(16,185,129,.3);padding:4px 12px;border-radius:20px;font-size:.8rem;font-weight:700;">✅ ${ok} OK (Grátis)</span>` : ''}
          ${waiting ? `<span style="background:rgba(245,158,11,.12);color:#f59e0b;border:1px solid rgba(245,158,11,.3);padding:4px 12px;border-radius:20px;font-size:.8rem;font-weight:700;">⏳ ${waiting} na fila (R$ ${(waiting*0.03).toFixed(2)})</span>` : ''}
          ${off     ? `<span style="background:rgba(107,114,128,.1);color:#9ca3af;border:1px solid rgba(107,114,128,.25);padding:4px 12px;border-radius:20px;font-size:.8rem;font-weight:700;">⏸️ ${off} busca automática off</span>` : ''}
          ${err     ? `<span style="background:rgba(239,68,68,.1);color:var(--danger);border:1px solid rgba(239,68,68,.3);padding:4px 12px;border-radius:20px;font-size:.8rem;font-weight:700;">❌ ${err} erro(s)</span>` : ''}
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Arquivo / Chave de Acesso</th>
              <th>Status</th>
              <th>Mensagem</th>
              <th style="text-align:right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${listaGeral.map(item => {
              const chave = nfe._limparChave(item.chave || '');
              const st = nfe._statusLabel(item.status);
              return `
              <tr>
                <td>
                  ${chave ? `<code style="font-size:.7rem;color:var(--text2);word-break:break-all;">${nfe._fmtChave(chave)}</code>` : `<span style="font-size:.78rem;color:var(--text3);">${item.arquivo || '—'}</span>`}
                  ${item.arquivo && chave ? `<div style="font-size:.68rem;color:var(--text3);">${item.arquivo}</div>` : ''}
                </td>
                <td>
                  <span style="background:${st.color}22;color:${st.color};border:1px solid ${st.color}44;padding:3px 8px;border-radius:20px;font-size:.73rem;font-weight:700;white-space:nowrap;">
                    ${st.icon} ${st.label}
                  </span>
                </td>
                <td style="font-size:.75rem;color:var(--text3);max-width:220px;">${item.statusMessage || '—'}</td>
                <td style="text-align:right;">
                  <div style="display:flex;gap:5px;justify-content:flex-end;">
                    ${item.status === 'OK' && chave ? `
                      <button class="btn btn-sm btn-success" onclick="NFe.gerarLancamentoDaNFe('${chave}')" style="font-weight:700;" title="Gerar despesa no financeiro">⚡ Lançar</button>
                      <button class="btn btn-sm btn-primary" onclick="NFe.abrirDanfe('${chave}')">📄 DANFE</button>
                      <button class="btn btn-sm btn-secondary" onclick="NFe.baixarXMLEAbrir('${chave}')">⬇️ XML</button>
                      <button class="btn btn-sm btn-secondary" onclick="NFe.adicionarComoAnexo('${chave}')">📎 Anexar</button>
                    ` : item.status === 'WAITING' && chave ? `
                      <button class="btn btn-sm btn-secondary" onclick="NFe.rebuscarChave('${chave}')">🔍 Verificar</button>
                    ` : '—'}
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:12px;text-align:right;">
        <button class="btn btn-secondary btn-sm" onclick="NFe._setTab('cert')">🔄 Importar mais arquivos</button>
      </div>`;

    if (dropzone) {
      dropzone.innerHTML = `
        <div style="font-size:2.8rem;margin-bottom:8px;">✅</div>
        <div style="font-weight:700;color:var(--success);margin-bottom:4px;">${listaGeral.length} documento(s) processado(s)!</div>
        <div style="font-size:.78rem;color:var(--text3);">Arraste mais arquivos ou clique para selecionar outros XMLs</div>
        <input type="file" id="nfe-cert-file" accept=".xml,text/xml,application/xml" multiple style="display:none;" onchange="NFe._onCertFileSelect(this)">`;
    }
  },

  adicionarComoAnexo(chave, nfe) {
    chave = nfe._limparChave(chave);
    Utils.showModal(`
      <div class="modal" style="max-width:500px;">
        <div class="modal-header">
          <span class="modal-title">📎 Anexar DANFE a um Lançamento</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <p style="font-size:.84rem;color:var(--text2);margin-bottom:12px;">Selecione o lançamento para receber o DANFE desta NF-e como anexo PDF:</p>
          <input type="text" id="nfe-lanc-search" class="form-control form-control-sm"
            placeholder="🔍 Filtrar por descrição..." style="margin-bottom:10px;"
            oninput="NFeParser.filtrarLancamentos(this.value,'${chave}',NFe)">
          <div id="nfe-lanc-list" style="max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">
            ${this.renderListaLancamentos('', chave)}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
        </div>
      </div>`);
  },

  renderListaLancamentos(filtro, chave) {
    const todos = (DB.getAll('lancamentos') || []).slice().reverse();
    const filtrados = filtro
      ? todos.filter(l => (l.descricao||'').toLowerCase().includes(filtro.toLowerCase()))
      : todos.slice(0, 60);
    if (!filtrados.length) return `<div style="text-align:center;padding:16px;color:var(--text3);font-size:.82rem;">Nenhum lançamento encontrado.</div>`;
    return filtrados.map(l => {
      const obra = DB.getById('clientes', l.obra_id);
      return `
        <div onclick="NFeParser.confirmarAnexo('${l.id}','${chave}',NFe)"
          style="padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);cursor:pointer;"
          onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="font-weight:700;font-size:.84rem;color:var(--text);">${l.descricao}</div>
          <div style="font-size:.74rem;color:var(--text3);">${obra?.nome||'—'} · ${Utils.fmt.currency(l.valor)} · ${Utils.fmt.date(l.data||l.data_vencimento)}</div>
        </div>`;
    }).join('');
  },

  filtrarLancamentos(filtro, chave, nfe) {
    const el = document.getElementById('nfe-lanc-list');
    if (el) el.innerHTML = this.renderListaLancamentos(filtro, chave);
  },

  async confirmarAnexo(lancId, chave, nfe) {
    chave = nfe._limparChave(chave);
    Utils.toast('Baixando DANFE para anexar...', 'info');
    try {
      const data = await nfe.baixarDanfePDF(chave);
      if (!data || !data.data) throw new Error('PDF não disponível.');
      const pdfBase64 = `data:application/pdf;base64,${data.data}`;
      Documentos.adicionar({
        entidade_tipo: 'lancamento',
        entidade_id: lancId,
        titulo: `DANFE NF-e …${chave.slice(-8)}`,
        nome_arquivo: `DANFE_NFe_${chave}.pdf`,
        tipo_mime: 'application/pdf',
        tamanho: Math.round(data.data.length * 0.75),
        data_base64: pdfBase64
      });
      Utils.toast('DANFE anexado com sucesso!', 'success');
      Utils.closeModal();
      if (typeof Lancamentos !== 'undefined' && Lancamentos._refresh) Lancamentos._refresh();
    } catch (err) {
      Utils.toast(`Erro ao anexar: ${err.message}`, 'error');
    }
  }
};
