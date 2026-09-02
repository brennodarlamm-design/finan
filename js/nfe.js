// js/nfe.js — Motor de Busca NF-e via API MeuDanfe
// Documentação: https://meudanfe.com.br/documentacao.php
// API Base: https://api.meudanfe.com.br/v2

const NFe = {
  _KEY_CACHE: 'finobra_nfe_cache',
  _API_BASE: 'https://api.meudanfe.com.br/v2',
  _API_KEY: '1879826c-ee82-416d-b887-b5aaf4e059d4',

  // ─── Cache local ────────────────────────────────────────────────────────────
  _getCache() {
    try { return JSON.parse(localStorage.getItem(this._KEY_CACHE) || '[]'); }
    catch { return []; }
  },
  _saveCache(arr) {
    localStorage.setItem(this._KEY_CACHE, JSON.stringify(arr));
  },
  _addToCache(item) {
    const cache = this._getCache().filter(c => c.chave !== item.chave);
    cache.unshift({ ...item, cached_at: new Date().toISOString() });
    this._saveCache(cache.slice(0, 200));
  },
  _getFromCache(chave) {
    return this._getCache().find(c => c.chave === chave) || null;
  },
  _removeFromCache(chave) {
    this._saveCache(this._getCache().filter(c => c.chave !== chave));
    this._setTab('cache');
  },

  // ─── Helpers ────────────────────────────────────────────────────────────────
  _headers() {
    return { 'Api-Key': this._API_KEY, 'Accept': 'application/json' };
  },
  _limparChave(raw) {
    return (raw || '').replace(/\D/g, '').trim();
  },
  _validarChave(chave) {
    return /^\d{44}$/.test(chave);
  },
  _statusLabel(status) {
    const map = {
      WAITING:   { label: 'Na fila',        color: '#f59e0b', icon: '⏳' },
      SEARCHING: { label: 'Consultando',    color: '#3b82f6', icon: '🔍' },
      OK:        { label: 'Encontrada',     color: '#10b981', icon: '✅' },
      NOT_FOUND: { label: 'Não encontrada', color: '#ef4444', icon: '❌' },
      ERROR:     { label: 'Erro',           color: '#ef4444', icon: '⚠️' },
    };
    return map[status] || { label: status || '—', color: '#6b7280', icon: '❓' };
  },
  _fmtChave(chave) {
    return (chave || '').replace(/(\d{4})/g, '$1 ').trim();
  },

  // ─── API calls ──────────────────────────────────────────────────────────────
  async buscarPorChave(chaveRaw) {
    const chave = this._limparChave(chaveRaw);
    if (!this._validarChave(chave)) throw new Error('Chave de acesso inválida (deve ter 44 dígitos).');
    const res = await fetch(`${this._API_BASE}/fd/add/${chave}`, {
      method: 'PUT',
      headers: this._headers()
    });
    if (!res.ok) {
      if (res.status === 402) throw new Error('Saldo insuficiente na conta MeuDanfe.');
      if (res.status === 401) throw new Error('API Key inválida ou não informada.');
      if (res.status === 400) throw new Error('Chave de acesso inválida.');
      throw new Error(`Erro ${res.status}`);
    }
    return await res.json();
  },

  async consultarStatus(chave) {
    chave = this._limparChave(chave);
    try {
      const res = await fetch(`${this._API_BASE}/fd/add/${chave}`, {
        method: 'PUT', headers: this._headers()
      });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  },

  async baixarDanfePDF(chave) {
    chave = this._limparChave(chave);
    const res = await fetch(`${this._API_BASE}/fd/get/da/${chave}`, {
      method: 'GET', headers: this._headers()
    });
    if (!res.ok) {
      if (res.status === 404) throw new Error('NF-e não encontrada na Área do Cliente. Busque-a primeiro.');
      throw new Error(`Erro ao baixar DANFE: ${res.status}`);
    }
    return await res.json();
  },

  async baixarXML(chave) {
    chave = this._limparChave(chave);
    const res = await fetch(`${this._API_BASE}/fd/get/xml/${chave}`, {
      method: 'GET', headers: this._headers()
    });
    if (!res.ok) {
      if (res.status === 404) throw new Error('NF-e não encontrada na Área do Cliente. Busque-a primeiro.');
      throw new Error(`Erro ao baixar XML: ${res.status}`);
    }
    return await res.json();
  },

  async listarMinhasNFes(after = '') {
    const params = new URLSearchParams();
    if (after) params.set('after', after);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${this._API_BASE}/fd/my/NFE${qs}`, {
      method: 'GET', headers: this._headers()
    });
    if (!res.ok) return null;
    return await res.json();
  },

  _extrairChaveDoXml(xmlString) {
    if (!xmlString) return null;
    const match = xmlString.match(/<chNFe[^>]*>(\d{44})<\/chNFe>/i) ||
                  xmlString.match(/<chCTe[^>]*>(\d{44})<\/chCTe>/i) ||
                  xmlString.match(/Id=["'](?:NFe|CTe)?(\d{44})["']/i) ||
                  xmlString.match(/infNFe[^>]+Id=["'](?:NFe)?(\d{44})["']/i);
    return match ? match[1] : null;
  },

  // Envia arquivo retDistDFeInt ou enviNFe gerado pelo certificado digital
  async enviarSefazXml(xmlString) {
    const res = await fetch(`${this._API_BASE}/fd/add/sefaz-xml`, {
      method: 'PUT',
      headers: { ...this._headers(), 'Content-Type': 'text/plain' },
      body: xmlString
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 400) throw new Error(data?.statusMessage || 'XML inválido para lote SEFAZ. Envie um arquivo retDistDFeInt ou enviNFe válido.');
      if (res.status === 401) throw new Error('API Key inválida.');
      if (res.status === 402) throw new Error('Saldo insuficiente na conta MeuDanfe.');
      throw new Error(data?.statusMessage || `Erro ${res.status}`);
    }
    return data; // array de { chave, status, statusMessage }
  },

  // Envia XML individual de NF-e/CT-e para a Área do Cliente (GRÁTIS)
  async enviarXmlIndividual(xmlString) {
    const res = await fetch(`${this._API_BASE}/fd/add/xml`, {
      method: 'PUT',
      headers: { ...this._headers(), 'Content-Type': 'text/plain' },
      body: xmlString
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401) throw new Error('API Key inválida.');
      if (res.status === 402) throw new Error('Saldo insuficiente na conta MeuDanfe.');
      throw new Error(data?.statusMessage || `Erro ${res.status}: XML rejeitado pela API.`);
    }
    return data;
  },

  // ─── Polling ────────────────────────────────────────────────────────────────
  async buscarComPolling(chave, onUpdate, maxTentativas = 15, intervaloMs = 2000) {
    chave = this._limparChave(chave);
    let tentativa = 0;

    const poll = async () => {
      tentativa++;
      const data = await this.consultarStatus(chave);
      if (onUpdate) onUpdate(data, tentativa);
      if (!data) return null;
      if (['OK', 'NOT_FOUND', 'ERROR'].includes(data.status)) {
        if (data.status === 'OK') this._addToCache({ chave, status: 'OK', response: data });
        return data;
      }
      if (tentativa >= maxTentativas) return data;
      await new Promise(r => setTimeout(r, intervaloMs));
      return poll();
    };

    const inicial = await this.buscarPorChave(chave);
    if (onUpdate) onUpdate(inicial, 0);
    if (['OK', 'NOT_FOUND', 'ERROR'].includes(inicial.status)) {
      if (inicial.status === 'OK') this._addToCache({ chave, status: 'OK', response: inicial });
      return inicial;
    }
    await new Promise(r => setTimeout(r, 1000));
    return poll();
  },

  // ─── Render principal ────────────────────────────────────────────────────────
  render() {
    const cache = this._getCache();
    return `
      <div class="page-header" style="margin-bottom:20px;">
        <div>
          <h1 class="page-title">🔎 Busca NF-e</h1>
          <p class="page-sub">Consulte, visualize e baixe Notas Fiscais Eletrônicas via API MeuDanfe</p>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-header" style="border-bottom:none;padding-bottom:0;">
          <div class="card-title">🔑 Buscar por Chave de Acesso</div>
        </div>
        <div class="card-body" style="padding-top:12px;">
          <div style="background:rgba(201,162,39,.06);border:1px solid rgba(201,162,39,.18);border-radius:var(--r-md);padding:12px 16px;margin-bottom:16px;font-size:.8rem;color:var(--text2);">
            <strong style="color:var(--accent);">ℹ️ Como funciona:</strong>
            Informe a chave de acesso (44 dígitos) da NF-e. A API MeuDanfe consultará a Receita Federal.
            Cada consulta nova custa <strong style="color:var(--accent);">R$ 0,03</strong>. NFs já consultadas são <strong style="color:var(--success);">GRATUITAS</strong>.
          </div>
          <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;">
            <div style="flex:1;min-width:240px;">
              <input type="text" id="nfe-chave-input" class="form-control"
                placeholder="Digite ou cole a chave de acesso de 44 dígitos..."
                oninput="NFe._onChaveInput(this)"
                onkeydown="if(event.key==='Enter') NFe.iniciarBusca()"
                style="font-family:monospace;font-size:.85rem;letter-spacing:.03em;"
                maxlength="60" autocomplete="off">
              <div id="nfe-chave-hint" style="font-size:.72rem;margin-top:4px;color:var(--text3);">Cole a chave de 44 dígitos (espaços e pontos são ignorados)</div>
            </div>
            <button class="btn btn-primary" onclick="NFe.iniciarBusca()" id="nfe-buscar-btn"
              style="white-space:nowrap;height:42px;padding:0 22px;">
              🔍 Consultar NF-e
            </button>
          </div>
          <div id="nfe-resultado" style="margin-top:18px;"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="padding-bottom:0;border-bottom:none;">
          <div style="display:flex;gap:0;border-bottom:1px solid var(--border);flex-wrap:wrap;">
            <button id="tab-nfe-cache" onclick="NFe._setTab('cache')"
              style="padding:8px 18px;border:none;background:none;color:var(--accent);font-weight:700;font-size:.85rem;cursor:pointer;border-bottom:2px solid var(--accent);font-family:inherit;">
              📋 Consultadas Recentemente (${cache.length})
            </button>
            <button id="tab-nfe-cert" onclick="NFe._setTab('cert')"
              style="padding:8px 18px;border:none;background:none;color:var(--text3);font-size:.85rem;cursor:pointer;border-bottom:2px solid transparent;font-family:inherit;">
              📂 Importar XML / Certificado
            </button>
            <button id="tab-nfe-api" onclick="NFe._setTab('api')"
              style="padding:8px 18px;border:none;background:none;color:var(--text3);font-size:.85rem;cursor:pointer;border-bottom:2px solid transparent;font-family:inherit;">
              ☁️ Minhas NFs na Nuvem
            </button>
          </div>
        </div>
        <div class="card-body" id="nfe-tab-body" style="padding-top:12px;">
          ${this._renderTabCache(cache)}
        </div>
      </div>`;
  },

  _currentTab: 'cache',

  _setTab(tab) {
    this._currentTab = tab;
    const tabs = [
      { id: 'tab-nfe-cache', key: 'cache' },
      { id: 'tab-nfe-cert',  key: 'cert'  },
      { id: 'tab-nfe-api',   key: 'api'   },
    ];
    tabs.forEach(t => {
      const el = document.getElementById(t.id);
      if (!el) return;
      const ativo = t.key === tab;
      el.style.color = ativo ? 'var(--accent)' : 'var(--text3)';
      el.style.fontWeight = ativo ? '700' : '400';
      el.style.borderBottom = ativo ? '2px solid var(--accent)' : '2px solid transparent';
    });
    // atualiza contador do cache
    const btnCache = document.getElementById('tab-nfe-cache');
    if (btnCache) btnCache.textContent = `📋 Consultadas Recentemente (${this._getCache().length})`;
    const body = document.getElementById('nfe-tab-body');
    if (!body) return;
    if (tab === 'cache') {
      body.innerHTML = this._renderTabCache(this._getCache());
    } else if (tab === 'cert') {
      body.innerHTML = this._renderTabCert();
    } else {
      body.innerHTML = '<div style="text-align:center;padding:28px;color:var(--text3);">Carregando...</div>';
      this._carregarMinhasNFes();
    }
  },

  _renderTabCert() {
    return `
      <div style="max-width:720px;">
        <div style="background:rgba(99,102,241,.07);border:1px solid rgba(99,102,241,.25);border-radius:var(--r-md);padding:14px 18px;margin-bottom:18px;font-size:.82rem;color:var(--text2);line-height:1.6;">
          <div style="font-weight:800;color:#a5b4fc;margin-bottom:6px;">📂 Importação Inteligente de XMLs (Lote SEFAZ ou NF-e Individual)</div>
          <p style="margin:0 0 8px 0;">Você pode importar <strong>arquivos XML individuais de NF-e/CT-e</strong> ou <strong>lotes de Distribuição SEFAZ</strong>:</p>
          <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px;">
            <li><strong>XML Individual (.xml):</strong> Arquivo de NF-e baixado do fornecedor, ERP ou e-mail — importação direta e <strong style="color:var(--success);">GRÁTIS</strong>.</li>
            <li><strong>Lote SEFAZ (retDistDFeInt / enviNFe):</strong> Arquivo com dezenas de notas baixadas da SEFAZ pelo seu sistema contador usando certificado digital A1/A3.</li>
            <li>Você pode selecionar ou arrastar <strong>múltiplos arquivos XML</strong> de uma vez.</li>
          </ul>
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(99,102,241,.2);font-size:.76rem;">
            ✅ NFs com XML completo: <strong style="color:var(--success);">GRÁTIS</strong> &nbsp;·&nbsp;
            ⏳ Resumos/chaves sem XML: <strong style="color:#f59e0b;">R$ 0,03 cada</strong> (entra na fila de busca)
          </div>
        </div>

        <div id="nfe-cert-dropzone"
          style="border:2px dashed var(--border);border-radius:var(--r-md);padding:32px;text-align:center;background:var(--bg-secondary);cursor:pointer;transition:.2s all;"
          onclick="document.getElementById('nfe-cert-file').click()"
          ondragover="event.preventDefault();this.style.borderColor='var(--accent)';this.style.background='rgba(201,162,39,.06)';"
          ondragleave="this.style.borderColor='var(--border)';this.style.background='var(--bg-secondary)';"
          ondrop="event.preventDefault();this.style.borderColor='var(--border)';this.style.background='var(--bg-secondary)';NFe._onCertFileDrop(event);">
          <div style="font-size:2.8rem;margin-bottom:8px;">🗂️</div>
          <div style="font-weight:700;color:var(--text);margin-bottom:4px;">Arraste os arquivos XML aqui ou clique para selecionar</div>
          <div style="font-size:.78rem;color:var(--text3);">Aceita arquivos <strong>.xml</strong> individuais de NF-e ou arquivos de lote <strong>retDistDFeInt.xml</strong> / <strong>enviNFe.xml</strong> (suporta múltiplos arquivos)</div>
          <input type="file" id="nfe-cert-file" accept=".xml,text/xml,application/xml" multiple
            style="display:none;" onchange="NFe._onCertFileSelect(this)">
        </div>

        <div id="nfe-cert-resultado" style="margin-top:18px;"></div>
      </div>`;
  },

  _renderTabCache(cache) {
    if (!cache.length) return `
      <div style="text-align:center;padding:32px;color:var(--text3);">
        <div style="font-size:2.5rem;margin-bottom:8px;">🔎</div>
        <div style="font-weight:600;margin-bottom:4px;">Nenhuma consulta realizada ainda</div>
        <div style="font-size:.8rem;">Use o campo acima para buscar uma NF-e pela chave de acesso</div>
      </div>`;
    return `
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Chave de Acesso</th>
              <th>Status</th>
              <th>Consultada em</th>
              <th style="text-align:right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${cache.map(c => {
              const st = this._statusLabel(c.status);
              return `
              <tr>
                <td><code style="font-size:.72rem;color:var(--text2);word-break:break-all;">${this._fmtChave(c.chave)}</code></td>
                <td>
                  <span style="background:${st.color}22;color:${st.color};border:1px solid ${st.color}44;padding:3px 8px;border-radius:20px;font-size:.75rem;font-weight:700;">
                    ${st.icon} ${st.label}
                  </span>
                </td>
                <td style="color:var(--text3);font-size:.8rem;">${Utils.fmt.datetime(c.cached_at)}</td>
                <td style="text-align:right;">
                  <div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;">
                    ${c.status === 'OK' ? `
                      <button class="btn btn-sm btn-success" onclick="NFe.gerarLancamentoDaNFe('${c.chave}')" style="font-weight:700;" title="Gerar despesa no financeiro">⚡ Lançar</button>
                      <button class="btn btn-sm btn-primary" onclick="NFe.abrirDanfe('${c.chave}')">📄 DANFE</button>
                      <button class="btn btn-sm btn-secondary" onclick="NFe.baixarXMLEAbrir('${c.chave}')">⬇️ XML</button>
                      <button class="btn btn-sm btn-secondary" onclick="NFe.adicionarComoAnexo('${c.chave}')">📎 Anexar</button>
                    ` : `
                      <button class="btn btn-sm btn-secondary" onclick="NFe.rebuscarChave('${c.chave}')">🔄 Rebuscar</button>
                    `}
                    <button class="icon-btn btn-sm" onclick="NFe._removeFromCache('${c.chave}')" style="color:var(--danger);" title="Remover">🗑️</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  },

  async _carregarMinhasNFes() {
    const body = document.getElementById('nfe-tab-body');
    if (!body) return;

    // Header com botão Atualizar e Sincronizar
    const headerHTML = `
      <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:16px;">
        <div>
          <div style="font-weight:700;color:var(--text);font-size:.9rem;">☁️ Notas Fiscais na Nuvem (Área do Cliente MeuDanfe)</div>
          <div style="font-size:.76rem;color:var(--text3);margin-top:2px;">NF-es armazenadas na sua conta MeuDanfe prontas para visualização e download gratuito.</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="NFe._carregarMinhasNFes()" style="height:36px;">
            🔄 Atualizar
          </button>
          <button class="btn btn-primary btn-sm" onclick="NFe._sincronizarTudo()" id="nfe-sync-btn" style="height:36px;white-space:nowrap;">
            ⬇️ Sincronizar Tudo para Cache
          </button>
        </div>
      </div>
      <div id="nfe-cloud-content"></div>`;

    body.innerHTML = headerHTML;

    await this._renderPaginaCloud('', document.getElementById('nfe-cloud-content'));
  },

  async _renderPaginaCloud(after = '', container) {
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);"><div style="display:inline-block;width:20px;height:20px;border:2px solid rgba(255,255,255,.15);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite;"></div> Carregando da nuvem...</div>';
    try {
      const data = await this.listarMinhasNFes(after);
      if (!data || data.status !== 'OK') {
        const msg = (data && data.statusMessage) ? data.statusMessage : 'Nenhuma NF-e encontrada na Área do Cliente MeuDanfe.';
        container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text3);">${msg}</div>`;
        return;
      }
      const chaves = data.chaves || data.page?.keys || [];

      container.innerHTML = `
        <div style="font-size:.8rem;color:var(--text3);margin-bottom:10px;">
          Total listado: <strong style="color:var(--text);">${chaves.length}</strong> NFs na nuvem
        </div>
        ${!chaves.length ? `<div style="text-align:center;padding:24px;color:var(--text3);">Nenhuma NF-e encontrada na sua Área do Cliente MeuDanfe.</div>` : `
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead><tr><th>Chave de Acesso</th><th style="text-align:right;">Ações</th></tr></thead>
            <tbody>
              ${chaves.map(chave => `
              <tr>
                <td><code style="font-size:.72rem;color:var(--text2);">${this._fmtChave(chave)}</code></td>
                <td style="text-align:right;">
                  <div style="display:flex;gap:6px;justify-content:flex-end;">
                    <button class="btn btn-sm btn-success" onclick="NFe.gerarLancamentoDaNFe('${chave}')" style="font-weight:700;" title="Gerar despesa no financeiro">⚡ Lançar</button>
                    <button class="btn btn-sm btn-primary" onclick="NFe.abrirDanfe('${chave}')">📄 DANFE</button>
                    <button class="btn btn-sm btn-secondary" onclick="NFe.baixarXMLEAbrir('${chave}')">⬇️ XML</button>
                    <button class="btn btn-sm btn-secondary" onclick="NFe.adicionarComoAnexo('${chave}')">📎 Anexar</button>
                  </div>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        ${chaves.length >= 50 ? `
        <div style="display:flex;justify-content:center;gap:8px;margin-top:16px;">
          <button class="btn btn-secondary btn-sm" onclick="NFe._renderPaginaCloud('${chaves[chaves.length-1]}', document.getElementById('nfe-cloud-content'))">Carregar Mais NFs →</button>
        </div>` : ''}
        `}
      `;
    } catch (err) {
      container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--danger);">Erro: ${err.message}</div>`;
    }
  },

  // Sincroniza todas as páginas e adiciona ao cache local
  async _sincronizarTudo() {
    const btn  = document.getElementById('nfe-sync-btn');
    if (!btn) return;

    btn.disabled = true;
    btn.innerHTML = '⏳ Sincronizando...';

    let totalImportadas = 0;
    let after = '';
    let hasMore = true;

    const progressDiv = document.getElementById('nfe-cloud-content');

    try {
      while (hasMore) {
        if (progressDiv) {
          progressDiv.innerHTML = `
            <div style="text-align:center;padding:24px;">
              <div style="display:inline-block;width:24px;height:24px;border:2px solid rgba(255,255,255,.15);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite;margin-bottom:10px;"></div>
              <div style="font-weight:700;color:var(--text);">${totalImportadas} NFs adicionadas ao cache...</div>
              <div style="font-size:.78rem;color:var(--text3);margin-top:4px;">Consultando Área do Cliente MeuDanfe</div>
            </div>`;
        }

        const data = await this.listarMinhasNFes(after);
        if (!data || data.status !== 'OK') {
          if (data?.status === 'TOO_MANY_REQUESTS') {
            Utils.toast(data.statusMessage || 'Aguarde 1 hora para recomeçar a listagem do início.', 'warning');
          }
          break;
        }

        const chaves = data.chaves || data.page?.keys || [];
        if (!chaves.length) break;

        chaves.forEach(chave => {
          const c = this._limparChave(chave);
          if (this._validarChave(c) && !this._getFromCache(c)) {
            this._addToCache({ chave: c, status: 'OK', response: { status: 'OK' } });
            totalImportadas++;
          }
        });

        if (chaves.length < 50) {
          hasMore = false;
        } else {
          after = chaves[chaves.length - 1];
          await new Promise(r => setTimeout(r, 300));
        }
      }

      // Atualiza contador da aba cache
      const btnCache = document.getElementById('tab-nfe-cache');
      if (btnCache) btnCache.textContent = `📋 Consultadas Recentemente (${this._getCache().length})`;

      Utils.toast(`✅ Sincronização concluída! ${totalImportadas} novas NFs adicionadas ao cache.`, 'success');

      // Recarrega a visualização
      if (progressDiv) await this._renderPaginaCloud('', progressDiv);

    } catch (err) {
      Utils.toast(`Erro na sincronização: ${err.message}`, 'error');
      if (progressDiv) progressDiv.innerHTML = `<div style="text-align:center;padding:24px;color:var(--danger);">Erro: ${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '⬇️ Sincronizar Tudo para Cache';
    }
  },

  // ─── Input handler ────────────────────────────────────────────────────────
  _onChaveInput(input) {
    const cleaned = this._limparChave(input.value);
    const hint = document.getElementById('nfe-chave-hint');
    if (!hint) return;
    const len = cleaned.length;
    if (len === 0) {
      hint.style.color = 'var(--text3)';
      hint.textContent = 'Cole a chave de 44 dígitos (espaços e pontos são ignorados)';
    } else if (len < 44) {
      hint.style.color = '#f59e0b';
      hint.textContent = `${len}/44 dígitos — faltam ${44 - len}`;
    } else if (len === 44) {
      hint.style.color = 'var(--success)';
      hint.textContent = '✅ Chave válida! Pressione Enter ou clique em Consultar.';
    } else {
      hint.style.color = 'var(--danger)';
      hint.textContent = `Chave muito longa: ${len} dígitos (máximo 44)`;
    }
  },

  // ─── Iniciar busca com polling ────────────────────────────────────────────
  async iniciarBusca() {
    const input = document.getElementById('nfe-chave-input');
    const resultDiv = document.getElementById('nfe-resultado');
    const btn = document.getElementById('nfe-buscar-btn');
    if (!input || !resultDiv) return;

    const chave = this._limparChave(input.value);
    if (!this._validarChave(chave)) {
      resultDiv.innerHTML = `
        <div style="padding:12px 16px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:var(--r-md);color:var(--danger);font-size:.85rem;">
          ⚠️ Chave inválida. A chave deve ter exatamente 44 dígitos numéricos.
        </div>`;
      return;
    }

    // Cache hit
    const cached = this._getFromCache(chave);
    if (cached && cached.status === 'OK') {
      resultDiv.innerHTML = this._renderResultOK(chave, cached.response, true);
      return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Consultando...';
    resultDiv.innerHTML = `
      <div id="nfe-status-box" style="padding:16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:20px;height:20px;border:2px solid rgba(255,255,255,.15);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0;"></div>
          <div>
            <div style="font-weight:700;color:var(--text);">Consultando a Receita Federal...</div>
            <div id="nfe-status-msg" style="font-size:.8rem;color:var(--text3);margin-top:2px;">Iniciando busca...</div>
          </div>
        </div>
      </div>`;

    try {
      const resultado = await this.buscarComPolling(
        chave,
        (data, tentativa) => {
          const msg = document.getElementById('nfe-status-msg');
          if (msg && data) {
            const st = this._statusLabel(data.status);
            msg.textContent = `${st.icon} ${st.label} — tentativa ${tentativa}`;
          }
        },
        20, 2000
      );

      if (!resultado) throw new Error('Sem resposta da API.');

      if (resultado.status === 'OK') {
        resultDiv.innerHTML = this._renderResultOK(chave, resultado, false);
      } else if (resultado.status === 'NOT_FOUND') {
        resultDiv.innerHTML = `
          <div style="padding:16px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.25);border-radius:var(--r-md);">
            <div style="font-weight:700;color:var(--danger);margin-bottom:4px;">❌ NF-e não encontrada</div>
            <div style="font-size:.82rem;color:var(--text2);">A chave informada não foi localizada na Receita Federal. Verifique se está correta.</div>
          </div>`;
      } else {
        resultDiv.innerHTML = `
          <div style="padding:16px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.25);border-radius:var(--r-md);">
            <div style="font-weight:700;color:var(--danger);margin-bottom:4px;">⚠️ Status: ${resultado.status}</div>
            <div style="font-size:.82rem;color:var(--text2);">${resultado.statusMessage || 'Tente novamente em instantes.'}</div>
          </div>`;
      }
    } catch (err) {
      resultDiv.innerHTML = `
        <div style="padding:16px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.25);border-radius:var(--r-md);">
          <div style="font-weight:700;color:var(--danger);margin-bottom:4px;">❌ Erro na consulta</div>
          <div style="font-size:.82rem;color:var(--text2);">${err.message}</div>
        </div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '🔍 Consultar NF-e';
      if (this._currentTab === 'cache') {
        const body = document.getElementById('nfe-tab-body');
        if (body) body.innerHTML = this._renderTabCache(this._getCache());
      }
      const btnCache = document.getElementById('tab-nfe-cache');
      if (btnCache) btnCache.textContent = `📋 Consultadas Recentemente (${this._getCache().length})`;
    }
  },

  _renderResultOK(chave, data, fromCache) {
    return `
      <div style="padding:16px;background:rgba(16,185,129,.05);border:1px solid rgba(16,185,129,.25);border-radius:var(--r-md);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
          <div>
            <div style="font-weight:700;color:var(--success);margin-bottom:4px;">✅ NF-e localizada com sucesso!</div>
            <code style="font-size:.72rem;color:var(--text3);word-break:break-all;">${this._fmtChave(chave)}</code>
          </div>
          <span style="background:rgba(16,185,129,.15);color:var(--success);border:1px solid rgba(16,185,129,.3);padding:2px 10px;border-radius:20px;font-size:.72rem;font-weight:700;white-space:nowrap;">
            ${fromCache ? '💾 Do Cache' : '✅ Nova Consulta'}
          </span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-success btn-sm" onclick="NFe.gerarLancamentoDaNFe('${chave}')" style="font-weight:700;">⚡ Gerar Lançamento</button>
          <button class="btn btn-primary btn-sm" onclick="NFe.abrirDanfe('${chave}')">📄 Visualizar DANFE PDF</button>
          <button class="btn btn-secondary btn-sm" onclick="NFe.baixarXMLEAbrir('${chave}')">⬇️ Baixar XML</button>
          <button class="btn btn-secondary btn-sm" onclick="NFe.adicionarComoAnexo('${chave}')">📎 Anexar a Lançamento</button>
        </div>
        ${data?.statusMessage ? `<div style="margin-top:10px;font-size:.76rem;color:var(--text3);">${data.statusMessage}</div>` : ''}
      </div>`;
  },

  // ─── Ações ────────────────────────────────────────────────────────────────
  async abrirDanfe(chave) {
    chave = this._limparChave(chave);
    Utils.toast('Carregando DANFE PDF...', 'info');
    try {
      const data = await this.baixarDanfePDF(chave);
      if (!data || !data.data) throw new Error('PDF não retornado pela API.');
      const pdfSrc = `data:application/pdf;base64,${data.data}`;
      Utils.showModal(`
        <div class="modal" style="max-width:920px;width:96vw;height:90vh;display:flex;flex-direction:column;">
          <div class="modal-header">
            <span class="modal-title">📄 DANFE — NF-e</span>
            <div style="display:flex;gap:8px;align-items:center;">
              <button class="btn btn-sm btn-success" onclick="NFe.gerarLancamentoDaNFe('${chave}');Utils.closeModal();" style="font-weight:700;">⚡ Gerar Despesa</button>
              <button class="btn btn-sm btn-secondary" onclick="NFe.adicionarComoAnexo('${chave}');Utils.closeModal();">📎 Anexar</button>
              <button class="btn btn-sm btn-primary" onclick="(function(){var a=document.createElement('a');a.href='${pdfSrc}';a.download='DANFE_${chave}.pdf';document.body.appendChild(a);a.click();a.remove();})()">⬇️ Baixar PDF</button>
              <button class="modal-close" onclick="Utils.closeModal()">✕</button>
            </div>
          </div>
          <div class="modal-body" style="flex:1;padding:0;overflow:hidden;">
            <iframe src="${pdfSrc}" style="width:100%;height:100%;border:none;"></iframe>
          </div>
        </div>`);
    } catch (err) {
      Utils.toast(`Erro ao carregar DANFE: ${err.message}`, 'error');
    }
  },

  async baixarXMLEAbrir(chave) {
    chave = this._limparChave(chave);
    Utils.toast('Baixando XML...', 'info');
    try {
      const data = await this.baixarXML(chave);
      if (!data || !data.data) throw new Error('XML não retornado pela API.');
      const blob = new Blob([data.data], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `NFe_${chave}.xml`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      Utils.toast('XML baixado!', 'success');
    } catch (err) {
      Utils.toast(`Erro ao baixar XML: ${err.message}`, 'error');
    }
  },

  _parseXmlCompleto(xmlText) {
    if (typeof NFeParser !== 'undefined') return NFeParser.parseXml(xmlText);
    return null;
  },
  _extrairChaveDoXml(xmlText) {
    if (typeof NFeParser !== 'undefined') return NFeParser.extrairChave(xmlText);
    return '';
  },

  async gerarLancamentoDaNFe(chave) {
    chave = this._limparChave(chave);
    Utils.toast('Carregando dados da NF-e...', 'info');

    let parsed = null;
    let xmlData = null;

    try {
      const resp = await this.baixarXML(chave);
      if (resp && resp.data) {
        xmlData = resp.data;
        parsed = this._parseXmlCompleto(resp.data);
      }
    } catch (err) {
      console.warn('Não foi possível ler o XML diretamente da API:', err);
    }

    if (!parsed) {
      parsed = {
        chave: chave,
        numero_nf: chave.substring(25, 34).replace(/^0+/, '') || '—',
        serie: chave.substring(22, 25) || '1',
        data_emissao: Utils.today(),
        emitente: 'Fornecedor da NF-e',
        cnpj_emitente: chave.substring(6, 20).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'),
        valor_bruto: 0,
        impostos: 0,
        valor_liquido: 0,
        duplicatas: [],
        itens: []
      };
    }

    const fornecedores = DB.getAll('fornecedores') || [];
    const cnpjLimpo = (parsed.cnpj_emitente || '').replace(/\D/g, '');
    const fornExistente = fornecedores.find(f => {
      const fCnpj = (f.cnpj || f.cpf || '').replace(/\D/g, '');
      return (fCnpj && fCnpj === cnpjLimpo) || (f.nome && f.nome.toLowerCase() === (parsed.emitente || '').toLowerCase());
    });

    const obras = DB.getAll('clientes') || [];
    const contas = DB.getAll('contas') || [];
    const vencimentoPadrao = parsed.duplicatas.length ? parsed.duplicatas[0].vencimento : (parsed.data_emissao || Utils.today());

    // Escapa dados para callback
    window._tempNFeParsed = parsed;

    Utils.showModal(`
      <div class="modal" style="max-width:680px;max-height:92vh;display:flex;flex-direction:column;">
        <div class="modal-header">
          <span class="modal-title">⚡ Gerar Lançamento Financeiro via NF-e</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body" style="overflow-y:auto;padding:18px 24px;">
          <div style="background:rgba(201,162,39,.08);border:1px solid rgba(201,162,39,.25);border-radius:var(--r-md);padding:12px 16px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
              <div>
                <div style="font-weight:800;color:var(--text);font-size:.95rem;">NF nº ${parsed.numero_nf} · ${parsed.emitente}</div>
                <div style="font-size:.76rem;color:var(--text3);margin-top:2px;">CNPJ: <strong>${parsed.cnpj_emitente}</strong> · Emissão: <strong>${Utils.fmt.date(parsed.data_emissao)}</strong></div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:.72rem;color:var(--text3);text-transform:uppercase;font-weight:700;">Valor Total</div>
                <div style="font-size:1.25rem;font-weight:800;color:var(--success);">${Utils.fmt.currency(parsed.valor_bruto)}</div>
              </div>
            </div>
            ${parsed.itens.length ? `
            <details style="margin-top:10px;font-size:.78rem;color:var(--text2);cursor:pointer;">
              <summary style="font-weight:600;color:var(--accent);">📦 Ver ${parsed.itens.length} produto(s)/serviço(s) da nota</summary>
              <div style="max-height:120px;overflow-y:auto;margin-top:6px;padding:6px 10px;background:var(--bg-secondary);border-radius:var(--r-sm);display:flex;flex-direction:column;gap:4px;">
                ${parsed.itens.map(i => `<div>• <strong>${i.nome}</strong> (${i.qtd} ${i.unidade}) — ${Utils.fmt.currency(i.total)}</div>`).join('')}
              </div>
            </details>` : ''}
          </div>

          <form id="form-nfe-lancamento" onsubmit="event.preventDefault(); NFe._confirmarGeracaoLancamento('${chave}');">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
              <div>
                <label class="form-label" style="font-size:.78rem;font-weight:700;">Obra / Centro de Custo *</label>
                <select id="nfe-dest-obra" class="form-control" required>
                  <option value="">Selecione a Obra...</option>
                  <option value="escritorio">🏢 Sede / Escritório Central</option>
                  ${obras.map(o => `<option value="${o.id}">${o.nome}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="form-label" style="font-size:.78rem;font-weight:700;">Categoria de Custo *</label>
                <select id="nfe-dest-cat" class="form-control" required>
                  <option value="material" selected>🧱 Material de Construção</option>
                  <option value="mao_de_obra">👷 Mão de Obra / Empreiteiro</option>
                  <option value="servico">🔧 Serviço Especializado</option>
                  <option value="equipamento">🏗️ Equipamento / Locação</option>
                  <option value="administrativo">📋 Despesa Administrativa</option>
                </select>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
              <div>
                <label class="form-label" style="font-size:.78rem;font-weight:700;">Conta de Pagamento *</label>
                <select id="nfe-dest-conta" class="form-control" required>
                  ${contas.map(c => { const label = c.apelido || c.banco_nome || 'Conta'; const saldo = Utils.fmt.currency(c.saldo_atual||0); return `<option value="${c.id}">${label} — ${c.numero||''} (${saldo})</option>`; }).join('')}
                </select>
              </div>
              <div>
                <label class="form-label" style="font-size:.78rem;font-weight:700;">Forma de Pagamento</label>
                <select id="nfe-dest-forma" class="form-control">
                  <option value="Boleto" selected>Boleto Bancário</option>
                  <option value="Pix">Pix</option>
                  <option value="Transferência">Transferência / TED</option>
                  <option value="Cartão">Cartão</option>
                  <option value="Dinheiro">Dinheiro</option>
                </select>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px;margin-bottom:12px;">
              <div>
                <label class="form-label" style="font-size:.78rem;font-weight:700;">Descrição do Lançamento *</label>
                <input type="text" id="nfe-dest-desc" class="form-control" required
                  value="NF ${parsed.numero_nf} — ${parsed.emitente}">
              </div>
              <div>
                <label class="form-label" style="font-size:.78rem;font-weight:700;">Valor (R$) *</label>
                <input type="number" step="0.01" id="nfe-dest-valor" class="form-control" required
                  value="${parsed.valor_bruto || 0}">
              </div>
              <div>
                <label class="form-label" style="font-size:.78rem;font-weight:700;">Data Vencimento *</label>
                <input type="date" id="nfe-dest-venc" class="form-control" required
                  value="${vencimentoPadrao}">
              </div>
            </div>

            <div style="margin-bottom:14px;">
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:.84rem;font-weight:700;color:var(--text);background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 14px;user-select:none;" id="nfe-ja-pago-label">
                <input type="checkbox" id="nfe-ja-pago" style="width:18px;height:18px;accent-color:var(--success);cursor:pointer;" onchange="NFe._toggleJaPago(this)">
                <span>✅ Esta despesa <strong>já foi paga</strong> — informar data e conta do pagamento</span>
              </label>
              <div id="nfe-pagamento-section" style="display:none;margin-top:8px;padding:12px 14px;background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.25);border-radius:var(--r-md);">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                  <div>
                    <label class="form-label" style="font-size:.78rem;font-weight:700;">Data do Pagamento *</label>
                    <input type="date" id="nfe-data-pagto" class="form-control" value="${Utils.today()}">
                  </div>
                  <div>
                    <label class="form-label" style="font-size:.78rem;font-weight:700;">Conta Bancária Debitada *</label>
                    <select id="nfe-conta-pagto" class="form-control">
                      ${contas.map(c => { const label = c.apelido || c.banco_nome || 'Conta'; return `<option value="${label}">${label} — ${c.numero||''}</option>`; }).join('')}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 14px;margin-bottom:14px;font-size:.78rem;color:var(--text2);">
              <div style="display:flex;align-items:center;gap:6px;font-weight:700;color:var(--accent);">
                <span>ℹ️ Ações Automáticas:</span>
              </div>
              <ul style="margin:4px 0 0 0;padding-left:18px;display:flex;flex-direction:column;gap:3px;">
                <li>${fornExistente ? `Fornecedor vinculado: <strong>${fornExistente.nome}</strong>` : `Fornecedor <strong>${parsed.emitente}</strong> será <strong>cadastrado automaticamente</strong>.`}</li>
                <li>DANFE PDF será baixado e anexado ao lançamento no GED.</li>
                <li>Nota Fiscal será registrada na aba de Notas Fiscais.</li>
              </ul>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:10px;">
              <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-success" style="font-weight:700;padding:0 22px;">
                ✅ Confirmar e Gerar Lançamento
              </button>
            </div>
          </form>
        </div>
      </div>`);
  },

  _toggleJaPago(checkbox) {
    const section = document.getElementById('nfe-pagamento-section');
    if (section) section.style.display = checkbox.checked ? 'block' : 'none';
  },

  async _confirmarGeracaoLancamento(chave) {
    const parsed = window._tempNFeParsed || {};
    try {
      const obraId = document.getElementById('nfe-dest-obra')?.value;
      const cat = document.getElementById('nfe-dest-cat')?.value || 'material';
      const contaId = document.getElementById('nfe-dest-conta')?.value;
      const forma = document.getElementById('nfe-dest-forma')?.value || 'Boleto';
      const desc = document.getElementById('nfe-dest-desc')?.value || `NF ${parsed.numero_nf} — ${parsed.emitente}`;
      const valor = parseFloat(document.getElementById('nfe-dest-valor')?.value) || parsed.valor_bruto;
      const venc = document.getElementById('nfe-dest-venc')?.value || parsed.data_emissao || Utils.today();
      const jaPago = document.getElementById('nfe-ja-pago')?.checked || false;
      const dataPagto = jaPago ? (document.getElementById('nfe-data-pagto')?.value || Utils.today()) : null;
      const contaPagtoNome = jaPago ? (document.getElementById('nfe-conta-pagto')?.value || '') : null;

      if (!obraId) { Utils.toast('Por favor, selecione a Obra / Centro de Custo.', 'error'); return; }

      Utils.toast('Gerando lançamento e anexando DANFE...', 'info');

      // 1. Cadastra Fornecedor se não existir
      let fornecedorId = null;
      const fornecedores = DB.getAll('fornecedores') || [];
      const cnpjLimpo = (parsed.cnpj_emitente || '').replace(/\D/g, '');
      let forn = fornecedores.find(f => {
        const fCnpj = (f.cnpj || f.cpf || '').replace(/\D/g, '');
        return (fCnpj && fCnpj === cnpjLimpo) || (f.nome && f.nome.toLowerCase() === (parsed.emitente || '').toLowerCase());
      });

      if (!forn && parsed.emitente) {
        forn = DB.add('fornecedores', {
          nome: parsed.emitente,
          razao_social: parsed.emitente,
          cnpj_cpf: parsed.cnpj_emitente || '',
          telefone: parsed.telefone_emitente || '',
          categoria: cat
        });
      }
      fornecedorId = forn?.id || null;

      // 2. Cria o Lançamento Financeiro (Despesa)
      const contaBancaria = contaPagtoNome ||
        (DB.getAll('contas').find(c => c.id === contaId)?.nome) || '';

      const lanc = DB.add('lancamentos', {
        tipo: 'despesa',
        obra_id: obraId,
        conta_bancaria: contaBancaria,
        categoria: cat,
        descricao: desc,
        valor: valor,
        data: parsed.data_emissao || Utils.today(),
        data_vencimento: venc,
        data_pagamento: dataPagto || null,
        status: jaPago ? 'pago' : 'a_pagar',
        fornecedor_beneficiario: parsed.emitente || '',
        fornecedor_id: fornecedorId,
        chave_nfe: chave,
        conciliado: false
      });

      // 3. Cria o registro na tabela de Notas Fiscais
      DB.add('notas', {
        numero_nf: parsed.numero_nf,
        serie: parsed.serie || '1',
        emitente: parsed.emitente,
        cnpj_emitente: parsed.cnpj_emitente,
        data_emissao: parsed.data_emissao || Utils.today(),
        data_vencimento: venc,
        data_pagamento: dataPagto || null,
        valor_total: parsed.valor_bruto || valor,
        tipo: 'entrada',
        categoria: cat,
        status: jaPago ? 'pago' : 'pendente',
        obra_id: obraId,
        lancamento_id: lanc.id,
        chave_acesso: chave,
        chave_nfe: chave,
        observacoes: `Gerado automaticamente via busca NF-e em ${Utils.fmt.datetime(new Date().toISOString())}`
      });

      // 4. Baixa o DANFE PDF e anexa ao lançamento
      try {
        const pdfData = await this.baixarDanfePDF(chave);
        if (pdfData && pdfData.data) {
          const pdfBase64 = `data:application/pdf;base64,${pdfData.data}`;
          Documentos.adicionar({
            entidade_tipo: 'lancamento',
            entidade_id: lanc.id,
            titulo: `DANFE NF-e ${parsed.numero_nf}`,
            nome_arquivo: `DANFE_NFe_${chave}.pdf`,
            tipo_mime: 'application/pdf',
            tamanho: Math.round(pdfData.data.length * 0.75),
            data_base64: pdfBase64
          });
        }
      } catch (errPdf) {
        console.warn('DANFE PDF não anexado automaticamente:', errPdf);
      }

      Utils.closeModal();
      Utils.toast('✅ Despesa e Nota Fiscal cadastradas com sucesso!', 'success');

      if (typeof Lancamentos !== 'undefined' && Lancamentos._refresh) Lancamentos._refresh();
      if (typeof Notas !== 'undefined' && Notas.render) {
        const appContent = document.getElementById('app-content');
        if (appContent && App && App.currentRoute === 'notas') appContent.innerHTML = Notas.render(App.currentObraId);
      }
    } catch (err) {
      Utils.toast(`Erro ao gerar lançamento: ${err.message}`, 'error');
    }
  },

  async adicionarComoAnexo(chave) {
    if (typeof NFeParser !== 'undefined') NFeParser.adicionarComoAnexo(chave, this);
  },

  _renderListaLancamentos(filtro, chave) {
    if (typeof NFeParser !== 'undefined') return NFeParser.renderListaLancamentos(filtro, chave);
    return '';
  },

  _filtrarLancamentos(filtro, chave) {
    if (typeof NFeParser !== 'undefined') NFeParser.filtrarLancamentos(filtro, chave, this);
  },

  async _confirmarAnexo(lancId, chave) {
    if (typeof NFeParser !== 'undefined') NFeParser.confirmarAnexo(lancId, chave, this);
  },

  async rebuscarChave(chave) {
    this._saveCache(this._getCache().filter(c => c.chave !== chave));
    const input = document.getElementById('nfe-chave-input');
    if (input) input.value = chave;
    await this.iniciarBusca();
  },

  // ─── Certificado Digital: handlers de arquivo ────────────────────────────────

  _onCertFileDrop(event) {
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length) this._processarArquivosXML(files);
  },

  _onCertFileSelect(input) {
    const files = Array.from(input?.files || []);
    if (files.length) this._processarArquivosXML(files);
  },

  async _processarArquivosXML(files) {
    if (typeof NFeParser !== 'undefined') {
      return NFeParser.processarArquivosXML(files, this);
    }
  },

  // ─── Mount (chamado pelo App router) ────────────────────────────────────────
  mount(container) {
    container.innerHTML = this.render();
    this._currentTab = 'cache';
  }
};
