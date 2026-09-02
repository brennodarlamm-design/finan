// js/documentos.js — Gerenciamento e Anexo de Documentos, Boletos e Comprovantes
// Armazenamento em LocalStorage com suporte a PDF, Imagens e Recibos

const Documentos = {
  _KEY: 'finobra_documentos',
  _memoryBlobs: new Map(),
  _dbPromise: null,

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
        tx.objectStore('blobs').put({ id, data: base64, ts: Date.now() });
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
        const req = tx.objectStore('blobs').get(id);
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
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
      tx.objectStore('blobs').delete(id);
    } catch {}
  },

  async obterConteudo(id) {
    if (this._memoryBlobs.has(id)) {
      return this._memoryBlobs.get(id);
    }
    const doc = this.getById(id);
    if (doc && doc.data_base64) {
      this._memoryBlobs.set(id, doc.data_base64);
      return doc.data_base64;
    }
    const fromIdb = await this._idbGet(id);
    if (fromIdb) {
      this._memoryBlobs.set(id, fromIdb);
      return fromIdb;
    }
    return null;
  },

  _migrarLocalStorage() {
    try {
      const raw = localStorage.getItem(this._KEY);
      if (!raw) return;
      const docs = JSON.parse(raw);
      if (Array.isArray(docs)) {
        let migrou = false;
        docs.forEach(d => {
          const b64 = d.data_base64 || d.base64_data || d.base64;
          if (b64) {
            this._memoryBlobs.set(d.id, b64);
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
      return JSON.parse(localStorage.getItem(this._KEY) || '[]');
    } catch { return []; }
  },

  salvarLista(docs) {
    const light = (docs || []).map(d => {
      const { data_base64, base64_data, base64, conteudo_base64, ...rest } = d;
      return rest;
    });

    try {
      localStorage.setItem(this._KEY, JSON.stringify(light));
    } catch (e) {
      console.warn('[Documentos] Quota excedida ao gravar no localStorage. Executando limpeza preventiva...');
      try {
        const keysToClean = ['finobra_nfe_recents', 'finobra_temp_cache', 'finan_cache'];
        keysToClean.forEach(k => localStorage.removeItem(k));
        localStorage.setItem(this._KEY, JSON.stringify(light));
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
      this._memoryBlobs.set(id, base64);
      this._idbSet(id, base64);
    }

    const { data_base64, base64_data, base64: _b, conteudo_base64, ...lightDoc } = doc;
    const item = {
      id,
      criado_em: doc.criado_em || new Date().toISOString(),
      ...lightDoc
    };

    docs.push(item);
    this.salvarLista(docs);

    // Sincronizar com banco de dados Neon
    if (typeof DB !== 'undefined' && DB.syncToCloud) {
      DB.syncToCloud('save', 'documentos', item);
    }
    return item;
  },

  remover(id) {
    this._memoryBlobs.delete(id);
    this._idbDelete(id);
    const docs = this.getAll().filter(d => d.id !== id);
    this.salvarLista(docs);

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

  async visualizar(id) {
    const doc = this.getById(id);
    if (!doc) {
      Utils.toast('Arquivo não encontrado.', 'error');
      return;
    }

    const conteudo = await this.obterConteudo(id);
    if (!conteudo) {
      Utils.toast('Conteúdo do arquivo não disponível neste dispositivo.', 'warning');
      return;
    }

    const isPDF = doc.tipo_mime === 'application/pdf' || (doc.nome_arquivo || '').toLowerCase().endsWith('.pdf');
    const isHTML = doc.tipo_mime === 'text/html' || (doc.nome_arquivo || '').toLowerCase().endsWith('.html') || conteudo.startsWith('data:text/html');

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
            <iframe src="${conteudo}" style="width:100%;height:100%;border:none;background:#ffffff;"></iframe>
          ` : `
            <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;">
              <img src="${conteudo}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:4px;box-shadow:0 4px 20px rgba(0,0,0,0.5);" onerror="this.parentElement.innerHTML='<div style=\\'color:#fff;padding:20px;text-align:center;\\'>Não foi possível exibir a pré-visualização. Clique em Baixar para ver o arquivo.</div>'">
            </div>
          `}
        </div>
      </div>
    `);
  },

  async baixar(id) {
    const doc = this.getById(id);
    if (!doc) return;
    const conteudo = await this.obterConteudo(id);
    if (!conteudo) {
      Utils.toast('Conteúdo do arquivo não disponível.', 'warning');
      return;
    }

    const link = document.createElement('a');
    link.href = conteudo;
    link.download = doc.nome_arquivo || 'documento';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
};

// Executar migração automática de armazenamento ao carregar
if (typeof window !== 'undefined') {
  setTimeout(() => Documentos._migrarLocalStorage(), 100);
}
