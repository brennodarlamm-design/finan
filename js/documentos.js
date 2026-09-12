// js/documentos.js — Gerenciamento e Anexo de Documentos, Boletos e Comprovantes
// Armazenamento em LocalStorage com suporte a PDF, Imagens e Recibos

const Documentos = {
  _KEY: 'finobra_documentos',
  _memoryBlobs: new Map(),
  _dbPromise: null,

  _storageKey() {
    return (typeof DB !== 'undefined' && DB._ck) ? DB._ck(this._KEY) : this._KEY;
  },

  _blobKey(id) {
    const tenant = (typeof Auth !== 'undefined' && Auth.getCurrentTenantId) ? Auth.getCurrentTenantId() : 'public';
    // Namespace histórico esperado: `${tenant}:${id}`. Agora sem exceção especial por empresa.
    return `${tenant || 'public'}:${String(id || '')}`;
  },

  _ownsDocumentId(id) {
    try {
      const docs = (typeof DB !== 'undefined' && DB.getAll) ? DB.getAll('documentos') : [];
      return Array.isArray(docs) && docs.some(d => String(d?.id || '') === String(id || ''));
    } catch { return false; }
  },

  _getIdb() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') return resolve(null);
      try {
        const req = indexedDB.open('finobra_blobs_db', 1);
        req.onupgradeneeded = e => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('blobs')) {
            db.createObjectStore('blobs', { keyPath: 'id' });
          }
        };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = e => {
          console.warn('[Documentos] IndexedDB não disponível:', e);
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
    return this._dbPromise;
  },

  async _idbSet(id, base64) {
    if (!id || !base64) return false;
    try {
      const db = await this._getIdb();
      if (!db) return false;
      return new Promise(resolve => {
        const tx = db.transaction('blobs', 'readwrite');
        tx.objectStore('blobs').put({ id: this._blobKey(id), data: base64, ts: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch { return false; }
  },

  async _idbGet(id) {
    if (!id) return null;
    try {
      const db = await this._getIdb();
      if (!db) return null;
      return new Promise(resolve => {
        const tx = db.transaction('blobs', 'readonly');
        const store = tx.objectStore('blobs');
        const scopedKey = this._blobKey(id);
        const req = store.get(scopedKey);
        req.onsuccess = () => {
          if (req.result?.data) return resolve(req.result.data);
          // Migração única do formato antigo (id sem tenant). Só reivindica o blob
          // se o documento existe no cache do tenant atual.
          if (!this._ownsDocumentId(id)) return resolve(null);
          const legacy = store.get(String(id || ''));
          legacy.onsuccess = () => {
            if (!legacy.result?.data) return resolve(null);
            try {
              const wtx = db.transaction('blobs', 'readwrite');
              const wstore = wtx.objectStore('blobs');
              wstore.put({ id: scopedKey, data: legacy.result.data, ts: Date.now() });
              wstore.delete(String(id || ''));
            } catch {}
            resolve(legacy.result.data);
          };
          legacy.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      });
    } catch { return null; }
  },

  async _idbDelete(id) {
    if (!id) return;
    try {
      const db = await this._getIdb();
      if (!db) return;
      const tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').delete(this._blobKey(id));
    } catch {}
  },

  _isPrivateBlobUrl(url) {
    return typeof url === 'string' && url.includes('.private.blob.vercel-storage.com');
  },

  async _resolverUrlProtegida(id) {
    try {
      const headers = (typeof DB !== 'undefined' && DB._apiHeaders) ? DB._apiHeaders() : {};
      const res = await fetch(`/api/upload?document_id=${encodeURIComponent(id)}`, { headers });
      if (res.status === 401 || res.status === 403) {
        if (typeof Auth !== 'undefined' && Auth.handleSessionExpired) Auth.handleSessionExpired();
        return null;
      }
      if (!res.ok) return null;
      const json = await res.json();
      return json.success && json.url ? json.url : null;
    } catch (e) {
      console.warn('[Documentos] Não foi possível gerar URL temporária:', e);
      return null;
    }
  },

  async obterConteudo(id) {
    const doc = this.getById(id);
    if (doc && doc.url) {
      return this._isPrivateBlobUrl(doc.url) ? await this._resolverUrlProtegida(id) : doc.url;
    }
    if (this._memoryBlobs.has(this._blobKey(id))) {
      return this._memoryBlobs.get(this._blobKey(id));
    }
    if (doc && (doc.data_base64 || doc.base64_data)) {
      const b = doc.data_base64 || doc.base64_data;
      this._memoryBlobs.set(this._blobKey(id), b);
      return b;
    }
    const fromIdb = await this._idbGet(id);
    if (fromIdb) {
      this._memoryBlobs.set(this._blobKey(id), fromIdb);
      return fromIdb;
    }
    // Tenta buscar da nuvem (Neon) se o arquivo foi anexado por outro dispositivo (ex: celular)
    try {
      const headers = (typeof DB !== 'undefined' && DB._apiHeaders) ? DB._apiHeaders() : {};
      const res = await fetch(`/api/db?table=documento_conteudo&id=${encodeURIComponent(id)}`, { headers });
      if (res.status === 401) {
        if (typeof Auth !== 'undefined' && Auth.handleSessionExpired) {
          Auth.handleSessionExpired();
        }
        return null;
      }
      if (res.ok) {
        const json = await res.json();
        if (json.url) {
          if (doc) {
            doc.url = json.url;
            this.salvarLista(this.getAll().map(d => d.id === id ? { ...d, url: json.url } : d));
          }
          return this._isPrivateBlobUrl(json.url) ? await this._resolverUrlProtegida(id) : json.url;
        }
        if (json.base64) {
          this._memoryBlobs.set(this._blobKey(id), json.base64);
          this._idbSet(id, json.base64);
          return json.base64;
        }
      }
    } catch (e) {
      console.warn('[Documentos] Falha ao obter conteúdo da nuvem:', e);
    }
    return null;
  },

  _migrarLocalStorage() {
    try {
      const raw = localStorage.getItem(this._storageKey());
      if (!raw) return;
      const docs = JSON.parse(raw);
      if (Array.isArray(docs)) {
        let migrou = false;
        docs.forEach(d => {
          const b64 = d.data_base64 || d.base64_data || d.base64;
          if (b64) {
            this._memoryBlobs.set(this._blobKey(d.id), b64);
            this._idbSet(d.id, b64);
            migrou = true;
          }
        });
        if (migrou) {
          this.salvarLista(docs);
        }
      }
    } catch (e) {
      console.warn('[Documentos] Falha ao verificar migração de armazenamento:', e);
    }
  },

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this._storageKey()) || '[]');
    } catch { return []; }
  },

  salvarLista(docs) {
    const light = (docs || []).map(d => {
      const { data_base64, base64_data, base64, conteudo_base64, ...rest } = d;
      return rest;
    });

    try {
      localStorage.setItem(this._storageKey(), JSON.stringify(light));
    } catch (e) {
      console.warn('[Documentos] Quota excedida ao gravar no localStorage. Executando limpeza preventiva...');
      try {
        const keysToClean = ['finobra_nfe_recents', 'finobra_temp_cache', 'finan_cache'];
        keysToClean.forEach(k => localStorage.removeItem(k));
        localStorage.setItem(this._storageKey(), JSON.stringify(light));
      } catch (e2) {
        console.error('[Documentos] Falha ao persistir metadados dos documentos:', e2);
      }
    }
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
    const id = doc.id || ('doc_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5));
    const base64 = doc.data_base64 || doc.base64 || doc.base64_data || '';

    if (base64) {
      this._memoryBlobs.set(this._blobKey(id), base64);
      this._idbSet(id, base64);
    }

    const { data_base64, base64_data, base64: _b, conteudo_base64, ...lightDoc } = doc;
    const item = {
      id,
      criado_em: doc.criado_em || new Date().toISOString(),
      url: doc.url || null,
      ...lightDoc
    };

    docs.push(item);
    this.salvarLista(docs);

    // Sincronizar com banco de dados Neon
    if (typeof DB !== 'undefined' && DB.syncToCloud) {
      DB.syncToCloud('save', 'documentos', {
        ...item,
        url: doc.url || null,
        base64_data: base64 || null
      });
    }

    // Se o documento ainda não tiver URL no Vercel Blob e houver base64, faz upload em segundo plano
    if (!item.url && base64 && typeof fetch !== 'undefined') {
      this._uploadBlobBackground(id, item.nome_arquivo || item.titulo || 'documento', base64, item.tipo_mime);
    }

    return item;
  },

  async _uploadBlobBackground(id, filename, base64, contentType) {
    try {
      const headers = (typeof DB !== 'undefined' && DB._apiHeaders) ? DB._apiHeaders() : { 'Content-Type': 'application/json' };
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filename: filename || 'documento',
          contentType: contentType || 'application/octet-stream',
          base64
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.url) {
          const all = this.getAll();
          const target = all.find(d => d.id === id);
          if (target) {
            target.url = data.url;
            this.salvarLista(all);
            if (typeof DB !== 'undefined' && DB.syncToCloud) {
              DB.syncToCloud('save', 'documentos', {
                ...target,
                url: data.url,
                base64_data: null
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Blob] Upload em background falhou:', e.message);
    }
  },

  adicionarLink({ entidade_tipo, entidade_id, titulo, url }) {
    if (!url || !url.trim()) return null;
    url = url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    const isGDrive = url.includes('drive.google.com') || url.includes('docs.google.com');
    const isOneDrive = url.includes('onedrive.live.com') || url.includes('sharepoint.com') || url.includes('1drv.ms');
    const isDropbox = url.includes('dropbox.com');
    const tipo_servico = isGDrive ? 'gdrive' : isOneDrive ? 'onedrive' : isDropbox ? 'dropbox' : 'link';

    return this.adicionar({
      entidade_tipo,
      entidade_id,
      titulo: titulo || (isGDrive ? 'Pasta/Arquivo no Google Drive' : isOneDrive ? 'Pasta/Arquivo no OneDrive' : isDropbox ? 'Pasta/Arquivo no Dropbox' : 'Link Externo'),
      nome_arquivo: url,
      url_externa: url,
      tipo_servico,
      tipo_mime: 'application/x-url'
    });
  },

  remover(id) {
    const doc = this.getById(id);
    this._memoryBlobs.delete(this._blobKey(id));
    this._idbDelete(id);
    const docs = this.getAll().filter(d => d.id !== id);
    this.salvarLista(docs);

    // Se o documento estiver no Vercel Blob, chamar endpoint para exclusão
    if (doc && doc.url && doc.url.includes('blob.vercel-storage.com')) {
      try {
        const headers = (typeof DB !== 'undefined' && DB._apiHeaders) ? DB._apiHeaders() : {};
        fetch(`/api/upload?url=${encodeURIComponent(doc.url)}`, { method: 'DELETE', headers }).catch(() => {});
      } catch (e) {}
    }

    // Remover do banco de dados Neon
    if (typeof DB !== 'undefined' && DB.syncToCloud) {
      DB.syncToCloud('delete', 'documentos', null, id);
    }
  },

  // Cria boletos e documentos de demonstração (Desativado permanentemente)
  seedDemoDocs() {},

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
    const safeTipo = (typeof Utils !== 'undefined' && Utils.escapeJsAttr) ? Utils.escapeJsAttr(entidadeTipo) : '';
    const safeId = (typeof Utils !== 'undefined' && Utils.escapeJsAttr) ? Utils.escapeJsAttr(entidadeId) : '';
    const safeTitulo = (typeof Utils !== 'undefined' && Utils.escapeJsAttr) ? Utils.escapeJsAttr(options.titulo || 'Documentos Anexados') : 'Documentos Anexados';
    const qtd = docs.length;
    const hasDocs = qtd > 0;
    const label = options.showLabel ? ` 📎 ${qtd} ${qtd===1?'anexo':'anexos'}` : `📎${qtd > 0 ? ` <span style="font-size:.7rem;font-weight:800;background:var(--accent);color:#000;border-radius:10px;padding:1px 5px;">${qtd}</span>` : ''}`;

    return `
    <button class="btn btn-sm ${hasDocs ? 'btn-secondary' : 'btn-secondary'}" 
            style="padding:3px 8px;font-size:.75rem;white-space:nowrap;${hasDocs ? 'border-color:var(--accent);color:var(--accent);font-weight:700;' : 'opacity:.7;'}"
            onclick="Documentos.abrirModal('${safeTipo}', '${safeId}', '${safeTitulo}')" 
            title="${hasDocs ? `${qtd} documento(s) anexado(s)` : 'Anexar boleto ou documento'}">
      ${label}
    </button>`;
  },

  // Abre Modal de Gerenciamento de Anexos
  showModalAnexos(entidadeTipo, entidadeId, options = {}) {
    const titulo = typeof options === 'string' ? options : (options && options.titulo ? options.titulo : 'Anexos & Comprovantes');
    return this.abrirModal(entidadeTipo, entidadeId, titulo);
  },

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

          <!-- Abas de Tipo: Arquivo vs Link -->
          <div style="display:flex;gap:6px;margin-bottom:14px;">
            <button type="button" id="doc-tab-file-btn" class="btn btn-sm btn-primary" onclick="Documentos._switchTab('file')">📁 Upload de Arquivo</button>
            <button type="button" id="doc-tab-link-btn" class="btn btn-sm btn-secondary" onclick="Documentos._switchTab('link')">🔗 Link Google Drive / Nuvem</button>
          </div>

          <!-- Área 1: Upload / Dropzone -->
          <div id="doc-panel-file" style="border:2px dashed var(--border);border-radius:var(--r-md);padding:20px;text-align:center;background:var(--bg-card);margin-bottom:20px;">
            <div style="font-size:2rem;margin-bottom:6px;">📄</div>
            <div style="font-weight:700;margin-bottom:4px;color:var(--text);">Adicionar Boleto, Comprovante, Foto ou Pacote</div>
            <div style="font-size:.76rem;color:var(--text3);margin-bottom:12px;">Formatos aceitos: PDF, Imagens, ZIP, RAR, 7Z, DWG, DOCX (Máx. 20MB)</div>
            
            <div style="display:flex;gap:8px;max-width:420px;margin:0 auto;flex-wrap:wrap;justify-content:center;">
              <input type="text" id="doc-titulo-input" class="form-control form-control-sm" placeholder="Nome/Descrição do documento (opcional)" style="flex:1;min-width:180px;">
              <label class="btn btn-primary btn-sm" style="cursor:pointer;margin:0;">
                📁 Escolher Arquivo
                <input type="file" id="doc-file-input" accept="image/*,application/pdf,.zip,.rar,.7z,.tar,.gz,.dwg,.dxf,.doc,.docx,.xls,.xlsx,.odt,.txt" style="display:none;" onchange="Documentos._onUpload('${entidadeTipo}', '${entidadeId}', this)">
              </label>
            </div>
          </div>

          <!-- Área 2: Link do Google Drive / Nuvem -->
          <div id="doc-panel-link" style="display:none;border:1px dashed var(--border);border-radius:var(--r-md);padding:18px;background:var(--bg-card);margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:1.4rem;">📁</span>
                <div>
                  <div style="font-weight:700;font-size:.85rem;color:var(--text);">Google Drive &amp; Nuvem</div>
                  <div style="font-size:.74rem;color:var(--text3);">Sem limite de tamanho para pastas ou arquivos compartilhados.</div>
                </div>
              </div>
              <button type="button" class="btn btn-sm" onclick="Documentos._abrirGooglePicker('${entidadeTipo}', '${entidadeId}')"
                      style="background:#4285F4;color:#fff;border:none;font-weight:700;font-size:.75rem;padding:5px 12px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;">
                🔍 Selecionar do Meu Drive
              </button>
            </div>
            <div style="font-size:.72rem;color:var(--text3);margin-bottom:10px;">
              Escolha pelo botão acima ou cole o link compartilhado do Drive, OneDrive ou Dropbox abaixo:
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <input type="url" id="doc-link-url" class="form-control form-control-sm" placeholder="https://drive.google.com/drive/folders/... ou link de arquivo">
              <div style="display:flex;gap:8px;">
                <input type="text" id="doc-link-titulo" class="form-control form-control-sm" placeholder="Descrição do link (ex: Pasta de Projetos Complementares)">
                <button type="button" class="btn btn-primary btn-sm" onclick="Documentos._onAddLink('${entidadeTipo}', '${entidadeId}')" style="white-space:nowrap;">
                  ➕ Vincular Link
                </button>
              </div>
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

  _switchTab(tab) {
    const fPanel = document.getElementById('doc-panel-file');
    const lPanel = document.getElementById('doc-panel-link');
    const fBtn = document.getElementById('doc-tab-file-btn');
    const lBtn = document.getElementById('doc-tab-link-btn');
    if (tab === 'link') {
      if (fPanel) fPanel.style.display = 'none';
      if (lPanel) lPanel.style.display = 'block';
      if (fBtn) fBtn.className = 'btn btn-sm btn-secondary';
      if (lBtn) lBtn.className = 'btn btn-sm btn-primary';
    } else {
      if (fPanel) fPanel.style.display = 'block';
      if (lPanel) lPanel.style.display = 'none';
      if (fBtn) fBtn.className = 'btn btn-sm btn-primary';
      if (lBtn) lBtn.className = 'btn btn-sm btn-secondary';
    }
  },

  _onAddLink(entidadeTipo, entidadeId) {
    const urlInput = document.getElementById('doc-link-url');
    const titInput = document.getElementById('doc-link-titulo');
    const url = urlInput?.value.trim();
    if (!url) return Utils.toast('Informe a URL do Google Drive ou link externo.', 'warning');

    const titulo = titInput?.value.trim() || '';
    this.adicionarLink({ entidade_tipo: entidadeTipo, entidade_id: entidadeId, titulo, url });
    Utils.toast('Link vinculado com sucesso!', 'success');
    this.abrirModal(entidadeTipo, entidadeId);
    if (typeof Lancamentos !== 'undefined' && Lancamentos._refresh) Lancamentos._refresh();
    if (typeof Medicoes !== 'undefined' && Medicoes._refresh) Medicoes._refresh();
  },

  _abrirGooglePicker(entidadeTipo, entidadeId) {
    if (typeof GDrive === 'undefined') return Utils.toast('Módulo Google Drive não carregado', 'error');
    GDrive.abrirSeletor((pickedDocs) => {
      let count = 0;
      for (const p of pickedDocs) {
        const url = p.url || `https://drive.google.com/file/d/${p.id}/view`;
        const nome = p.name || 'Arquivo no Google Drive';
        this.adicionarLink({
          entidade_tipo: entidadeTipo,
          entidade_id: entidadeId,
          titulo: nome,
          url
        });
        count++;
      }
      if (count > 0) {
        Utils.toast(`${count} item(ns) do Google Drive vinculado(s)!`, 'success');
        this.abrirModal(entidadeTipo, entidadeId);
        if (typeof Lancamentos !== 'undefined' && Lancamentos._refresh) Lancamentos._refresh();
        if (typeof Medicoes !== 'undefined' && Medicoes._refresh) Medicoes._refresh();
      }
    });
  },

  _renderDocRow(d) {
    const esc = (v) => (typeof Utils !== 'undefined' && Utils.escapeHtml) ? Utils.escapeHtml(v ?? '') : String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
    const escJs = (v) => (typeof Utils !== 'undefined' && Utils.escapeJsAttr) ? Utils.escapeJsAttr(v ?? '') : esc(v ?? '');
    const safeUrl = (v) => (typeof Utils !== 'undefined' && Utils.safeUrl) ? Utils.safeUrl(v) : '';
    if (d.url_externa) {
      const isGDrive = d.tipo_servico === 'gdrive' || d.url_externa.includes('drive.google.com') || d.url_externa.includes('docs.google.com');
      const isOneDrive = d.tipo_servico === 'onedrive' || d.url_externa.includes('onedrive.live.com') || d.url_externa.includes('sharepoint.com') || d.url_externa.includes('1drv.ms');
      const isDropbox = d.tipo_servico === 'dropbox' || d.url_externa.includes('dropbox.com');
      const icon = isGDrive ? '📁' : isOneDrive ? '☁️' : isDropbox ? '📦' : '🔗';
      const labelBadge = isGDrive ? 'Google Drive' : isOneDrive ? 'OneDrive' : isDropbox ? 'Dropbox' : 'Link Externo';
      const badgeColor = isGDrive ? '#4285F4' : isOneDrive ? '#0078D4' : isDropbox ? '#0061FF' : 'var(--accent)';

      return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);gap:12px;">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
          <span style="font-size:1.4rem;">${icon}</span>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="font-size:.65rem;font-weight:800;color:#fff;background:${badgeColor};padding:1px 6px;border-radius:4px;">${labelBadge}</span>
              <span style="font-weight:700;font-size:.84rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${esc(d.titulo || d.url_externa)}
              </span>
            </div>
            <div style="font-size:.72rem;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">
              ${esc(d.url_externa)} &middot; Vinculado em ${Utils.fmt.datetime(d.criado_em)}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <a href="${safeUrl(d.url_externa)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;" title="Abrir no Google Drive em nova aba">
            🔗 Abrir
          </a>
          <button class="icon-btn btn-sm" onclick="Documentos._confirmDel('${escJs(d.id)}')" style="color:var(--danger)" title="Excluir link">
            🗑️
          </button>
        </div>
      </div>`;
    }

    const nome = (d.nome_arquivo || d.titulo || '').toLowerCase();
    const isPDF = d.tipo_mime === 'application/pdf' || nome.endsWith('.pdf');
    const isZip = nome.match(/\.(zip|rar|7z|tar|gz)$/i);
    const isCAD = nome.match(/\.(dwg|dxf)$/i);
    const isImg = (d.tipo_mime && d.tipo_mime.startsWith('image/')) || nome.match(/\.(png|jpg|jpeg|webp|svg)$/i);
    const icon = isPDF ? '📕' : isZip ? '📦' : isCAD ? '📐' : isImg ? '🖼️' : '📎';
    const tamKB = d.tamanho ? `${(d.tamanho / (1024 * (d.tamanho > 1024 * 1024 ? 1024 : 1))).toFixed(1)} ${d.tamanho > 1024 * 1024 ? 'MB' : 'KB'}` : '';
    const isBlob = !!(d.url && d.url.includes('blob.vercel-storage.com'));

    return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);gap:12px;">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <span style="font-size:1.4rem;">${icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span style="font-weight:700;font-size:.84rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${esc(d.titulo || d.nome_arquivo)}
            </span>
            ${isBlob ? `<span style="font-size:.62rem;font-weight:700;color:#38bdf8;background:rgba(56,189,248,0.12);padding:1px 6px;border-radius:4px;border:1px solid rgba(56,189,248,0.25);white-space:nowrap;">☁️ Vercel Blob</span>` : ''}
          </div>
          <div style="font-size:.72rem;color:var(--text3);">
            ${esc(d.nome_arquivo)} ${tamKB ? `&middot; ${tamKB}` : ''} &middot; Anexado em ${Utils.fmt.datetime(d.criado_em)}
          </div>
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <button class="btn btn-sm btn-secondary" onclick="Documentos.visualizar('${escJs(d.id)}')" title="Visualizar documento">
          👁️ Ver
        </button>
        <button class="btn btn-sm btn-secondary" onclick="Documentos.baixar('${escJs(d.id)}')" title="Baixar arquivo">
          ⬇️
        </button>
        <button class="icon-btn btn-sm" onclick="Documentos._confirmDel('${escJs(d.id)}')" style="color:var(--danger)" title="Excluir anexo">
          🗑️
        </button>
      </div>
    </div>`;
  },

  async _onUpload(entidadeTipo, entidadeId, input) {
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 30 * 1024 * 1024) {
      Utils.toast('Arquivo muito grande! O limite máximo é de 30MB.', 'error');
      input.value = '';
      return;
    }

    const tituloInput = document.getElementById('doc-titulo-input');
    const titulo = tituloInput?.value.trim() || file.name;

    try {
      Utils.toast('Enviando para nuvem (Vercel Blob)...', 'info');
      const base64 = await this.lerArquivoBase64(file);
      
      let blobUrl = null;
      try {
        const headers = (typeof DB !== 'undefined' && DB._apiHeaders) ? DB._apiHeaders() : { 'Content-Type': 'application/json' };
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || 'application/octet-stream',
            base64
          })
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData.success && resData.url) {
            blobUrl = resData.url;
          }
        } else {
          console.warn('[Blob] Upload na API falhou com status', res.status);
        }
      } catch (errUpload) {
        console.warn('[Blob] Falha de conexão ao enviar para Vercel Blob:', errUpload);
      }

      this.adicionar({
        entidade_tipo: entidadeTipo,
        entidade_id: entidadeId,
        titulo: titulo,
        nome_arquivo: file.name,
        tipo_mime: file.type || 'application/octet-stream',
        tamanho: file.size,
        url: blobUrl,
        data_base64: blobUrl ? null : base64
      });

      Utils.toast(blobUrl ? 'Documento salvo no Vercel Blob!' : 'Documento salvo localmente!', 'success');
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
    Utils.confirm(`Excluir o anexo "${Utils.escapeHtml(doc.titulo || doc.nome_arquivo || '')}"?`, () => {
      this.remover(id);
      Utils.toast('Anexo removido!', 'info');
      this.abrirModal(doc.entidade_tipo, doc.entidade_id);
      if (typeof Lancamentos !== 'undefined' && Lancamentos._refresh) Lancamentos._refresh();
      if (typeof Medicoes !== 'undefined' && Medicoes._refresh) Medicoes._refresh();
    });
  },

  async visualizar(id) {
    const doc = this.getById(id);
    if (!doc) {
      Utils.toast('Arquivo não encontrado.', 'error');
      return;
    }

    Utils.toast('Carregando anexo...', 'info');
    const conteudo = await this.obterConteudo(id);
    if (!conteudo) {
      Utils.showModal(`
        <div class="modal" style="max-width:480px;text-align:center;padding:24px;">
          <div style="font-size:3rem;margin-bottom:12px;">📱 ➔ 💻</div>
          <h3 style="font-size:1.1rem;font-weight:800;margin-bottom:8px;color:var(--text);">Arquivo Gravado no Celular</h3>
          <p style="font-size:.85rem;color:var(--text2);line-height:1.5;margin-bottom:16px;text-align:left;background:var(--bg-secondary);padding:14px;border-radius:8px;border:1px solid var(--border);">
            O arquivo deste comprovante (<strong>${Utils.escapeHtml(doc.nome_arquivo || doc.titulo || '')}</strong>) foi gerado no smartphone e ainda está pendente de sincronização com o banco de dados em nuvem.
            <br><br>
            👉 <strong>Como sincronizar:</strong> Abra a página no celular e dê um <em>recarregar (F5/puxar para baixo)</em>. O aplicativo enviará o arquivo automaticamente para a nuvem e ele abrirá aqui no computador imediatamente!
          </p>
          <div style="display:flex;gap:8px;justify-content:center;">
            <button class="btn btn-primary" onclick="Utils.closeModal()">OK, vou abrir no celular</button>
          </div>
        </div>
      `);
      return;
    }

    const nomeNorm = (doc.nome_arquivo || doc.titulo || '').toLowerCase();
    const isPDF = doc.tipo_mime === 'application/pdf' || nomeNorm.endsWith('.pdf');
    const isHTML = doc.tipo_mime === 'text/html' || nomeNorm.endsWith('.html') || conteudo.startsWith('data:text/html');
    const isImage = (doc.tipo_mime && doc.tipo_mime.startsWith('image/')) || nomeNorm.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i) || conteudo.startsWith('data:image/');
    const isZip = nomeNorm.match(/\.(zip|rar|7z|tar|gz)$/i);
    const isCAD = nomeNorm.match(/\.(dwg|dxf)$/i);

    Utils.showModal(`
      <div class="modal" style="max-width:850px;width:95vw;height:85vh;display:flex;flex-direction:column;">
        <div class="modal-header">
          <span class="modal-title">👁️ ${Utils.escapeHtml(doc.titulo || doc.nome_arquivo || '')}</span>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn btn-sm btn-primary" onclick="Documentos.baixar('${doc.id}')">⬇️ Baixar</button>
            <button class="modal-close" onclick="Utils.closeModal()">✕</button>
          </div>
        </div>
        <div class="modal-body" style="flex:1;padding:0;overflow:hidden;background:#0f172a;display:flex;align-items:center;justify-content:center;">
          ${isPDF || isHTML ? `
            <iframe src="${conteudo}" style="width:100%;height:100%;border:none;background:#ffffff;"></iframe>
          ` : isImage ? `
            <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;">
              <img src="${conteudo}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:4px;box-shadow:0 4px 20px rgba(0,0,0,0.5);" onerror="this.parentElement.innerHTML='<div style=\\'color:#fff;padding:20px;text-align:center;\\'>Não foi possível exibir a pré-visualização. Clique em Baixar para ver o arquivo.</div>'">
            </div>
          ` : `
            <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;text-align:center;">
              <div style="font-size:4rem;margin-bottom:12px;">${isZip ? '📦' : isCAD ? '📐' : '📎'}</div>
              <h3 style="font-size:1.15rem;font-weight:700;color:#fff;margin-bottom:8px;">${Utils.escapeHtml(doc.titulo || doc.nome_arquivo || '')}</h3>
              <p style="font-size:.84rem;color:#94a3b8;max-width:440px;line-height:1.5;margin-bottom:20px;">
                ${isZip ? 'Arquivo Compactado (ZIP/RAR/7Z).' : isCAD ? 'Projeto Técnico / Desenho CAD (DWG/DXF).' : 'Arquivo Binário.'}
                <br>Este formato não pode ser visualizado diretamente no navegador. Baixe para abri-lo no seu computador.
              </p>
              <button class="btn btn-primary" onclick="Documentos.baixar('${doc.id}')" style="padding:10px 24px;font-size:.9rem;font-weight:700;">
                ⬇️ Baixar Arquivo
              </button>
            </div>
          `}
        </div>
      </div>
    `);
  },

  async baixar(id) {
    const doc = this.getById(id);
    if (!doc) return;
    Utils.toast('Baixando anexo...', 'info');
    const conteudo = await this.obterConteudo(id);
    if (!conteudo) {
      Utils.toast('Arquivo pendente no celular. Abra o app no celular para sincronizar.', 'warning');
      return;
    }

    if (typeof conteudo === 'string' && (conteudo.startsWith('http://') || conteudo.startsWith('https://'))) {
      const link = document.createElement('a');
      link.href = conteudo;
      link.download = doc.nome_arquivo || 'documento';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }

    const link = document.createElement('a');
    link.href = conteudo;
    link.download = doc.nome_arquivo || 'documento';
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  // Sincroniza arquivos que já estão salvos localmente no celular diretamente para a nuvem
  async sincronizarPendentesParaNuvem() {
    if (typeof DB === 'undefined' || !DB.syncToCloud) return;
    const docs = this.getAll();
    if (!docs.length) return;

    for (const d of docs) {
      try {
        let b64 = this._memoryBlobs.get(this._blobKey(d.id));
        if (!b64) b64 = await this._idbGet(d.id);

        if (b64) {
          const syncKey = (typeof DB !== 'undefined' && DB._ck) ? DB._ck('finobra_cloud_uploaded_' + d.id) : ('finobra_cloud_uploaded_' + d.id);
          if (!localStorage.getItem(syncKey)) {
            DB.syncToCloud('save', 'documentos', {
              ...d,
              base64_data: b64
            });
            localStorage.setItem(syncKey, '1');
          }
        }
      } catch (e) {
        console.warn('[Documentos] Falha ao enviar anexo pendente para nuvem:', d.id, e);
      }
    }
  }
};

// Executar migração e sincronização automática de armazenamento ao carregar
if (typeof window !== 'undefined') {
  setTimeout(() => {
    Documentos._migrarLocalStorage();
    Documentos.sincronizarPendentesParaNuvem();
  }, 1000);
}
