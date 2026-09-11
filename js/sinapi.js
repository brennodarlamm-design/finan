// js/sinapi.js — Motor SINAPI: Importação, Indexação e Busca
// Suporta duas séries: Com Oneração (padrão) e Sem Oneração (desonerado)

const SINAPI = {

  // Patch 09 — Bases SINAPI isoladas por tenant + UF + referência + série.
  // O pacote atual inclui somente snapshots RR/12-2024. Outras UFs/referências
  // devem ser importadas a partir do XLSX/ZIP oficial da Caixa.
  OFFICIAL_SNAPSHOTS: [
    { uf:'RR', referencia:'2024-12', desonerado:false, file:'/data/sinapi_rr_onerado.json' },
    { uf:'RR', referencia:'2024-12', desonerado:true,  file:'/data/sinapi_rr_desonerado.json' }
  ],

  _cachedBase: {},

  _tenant() {
    try {
      const t = (typeof DB !== 'undefined' && DB._t) ? DB._t() : ((typeof Auth !== 'undefined' && Auth.getCurrentTenantId) ? Auth.getCurrentTenantId() : 'public');
      return String(t || 'public').replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80) || 'public';
    } catch { return 'public'; }
  },

  _cleanUf(uf='') { return String(uf || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0,2); },
  _cleanRef(ref='') { return /^\d{4}-\d{2}$/.test(String(ref || '').trim()) ? String(ref).trim() : ''; },

  _baseKey(desonerado, uf, referencia) {
    const u = this._cleanUf(uf) || 'XX';
    const r = this._cleanRef(referencia) || 'sem_ref';
    return `finobra_${this._tenant()}_sinapi_base_${u}_${r}_${desonerado ? 'des' : 'on'}`;
  },

  _activeKey(desonerado) {
    return `finobra_${this._tenant()}_sinapi_active_${desonerado ? 'des' : 'on'}`;
  },

  _setActive(desonerado, uf, referencia) {
    const ctx = { uf:this._cleanUf(uf), referencia:this._cleanRef(referencia) };
    if (!ctx.uf || !ctx.referencia) return;
    try { localStorage.setItem(this._activeKey(desonerado), JSON.stringify(ctx)); } catch {}
  },

  _getActive(desonerado) {
    try {
      const ctx = JSON.parse(localStorage.getItem(this._activeKey(desonerado)) || 'null');
      return ctx && this._cleanUf(ctx.uf) && this._cleanRef(ctx.referencia) ? { uf:this._cleanUf(ctx.uf), referencia:this._cleanRef(ctx.referencia) } : null;
    } catch { return null; }
  },

  snapshotFor(uf, referencia, desonerado=false) {
    const u=this._cleanUf(uf), r=this._cleanRef(referencia);
    return this.OFFICIAL_SNAPSHOTS.find(x => x.uf===u && x.referencia===r && !!x.desonerado===!!desonerado) || null;
  },

  availableSnapshots() { return this.OFFICIAL_SNAPSHOTS.map(x => ({...x})); },

  _legacyKey(desonerado=false) { return desonerado ? 'sinapi_base_desonerado' : 'sinapi_base_onerado'; },

  _migrateLegacyBase(desonerado=false, wantedUf='', wantedRef='') {
    try {
      const oldKey=this._legacyKey(desonerado);
      const raw=localStorage.getItem(oldKey);
      if (!raw) return null;
      const base=JSON.parse(raw);
      const uf=this._cleanUf(base?.uf), ref=this._cleanRef(base?.referencia);
      if (!uf || !ref || !Array.isArray(base?.composicoes) || !base.composicoes.length) return null;
      if (wantedUf && this._cleanUf(wantedUf)!==uf) return null;
      if (wantedRef && this._cleanRef(wantedRef)!==ref) return null;
      const migrated=this._saveBase({ ...base, source:base.source || 'cache_legado' }, desonerado, uf, ref);
      // Depois de confirmar a nova chave, remove apenas a cópia legada. A base
      // referencial é pública e a nova chave é compartilhada por UF/competência.
      localStorage.removeItem(oldKey);
      return migrated;
    } catch { return null; }
  },

  hasBase(desonerado = false, uf = '', referencia = '') {
    return !!this.getBase(desonerado, uf, referencia)?.composicoes?.length;
  },

  getMeta(desonerado = false, uf = '', referencia = '') {
    const base = this.getBase(desonerado, uf, referencia);
    if (!base) return null;
    return {
      referencia: this._cleanRef(base.referencia),
      uf: this._cleanUf(base.uf),
      total: base.composicoes?.length || 0,
      importada_em: base.importada_em,
      source: base.source || 'importado'
    };
  },

  getBase(desonerado = false, uf = '', referencia = '') {
    let u=this._cleanUf(uf), r=this._cleanRef(referencia);
    if (!u || !r) {
      const active=this._getActive(desonerado);
      if (active) { u=active.uf; r=active.referencia; }
      else {
        const legacy=this._migrateLegacyBase(desonerado);
        if (legacy) return legacy;
        return null;
      }
    }
    const key=this._baseKey(desonerado,u,r);
    if (this._cachedBase[key]) return this._cachedBase[key];
    try {
      const raw=localStorage.getItem(key);
      if (!raw) return this._migrateLegacyBase(desonerado,u,r);
      const parsed=JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.composicoes)) return null;
      this._cachedBase[key]=parsed;
      return parsed;
    } catch { return null; }
  },

  _saveBase(base, desonerado, uf, referencia) {
    const u=this._cleanUf(uf), r=this._cleanRef(referencia);
    if (!u || !r) throw new Error('UF e referência SINAPI são obrigatórias.');
    const normalized={ ...base, uf:u, referencia:r, desonerado:!!desonerado };
    const key=this._baseKey(desonerado,u,r);
    this._cachedBase[key]=normalized;
    this._setActive(desonerado,u,r);
    try {
      localStorage.setItem(key, JSON.stringify(normalized));
      return normalized;
    } catch {
      const reduced={ ...normalized, composicoes:(normalized.composicoes || []).slice(0,5000), parcial:true };
      this._cachedBase[key]=reduced;
      localStorage.setItem(key, JSON.stringify(reduced));
      return reduced;
    }
  },

  clearBase(desonerado = false, uf = '', referencia = '') {
    const u=this._cleanUf(uf), r=this._cleanRef(referencia);
    const active=(!u || !r) ? this._getActive(desonerado) : null;
    const finalUf=u || active?.uf, finalRef=r || active?.referencia;
    if (!finalUf || !finalRef) return;
    const key=this._baseKey(desonerado,finalUf,finalRef);
    delete this._cachedBase[key];
    localStorage.removeItem(key);
  },

  clearAll() {
    const activePrefix=`finobra_${this._tenant()}_sinapi_active_`;
    const basePrefix='finobra_sinapi_base_';
    for (let i=localStorage.length-1;i>=0;i--) {
      const k=localStorage.key(i);
      if (k && (k.startsWith(activePrefix) || k.startsWith(basePrefix))) localStorage.removeItem(k);
    }
    for (const k of Object.keys(this._cachedBase)) if (k.startsWith(basePrefix)) delete this._cachedBase[k];
  },

  /**
   * Carrega um snapshot empacotado no FinObra. Ele é oficial quanto à origem dos
   * dados, mas NÃO é apresentado como tabela atual: UF e competência precisam
   * coincidir exatamente com o snapshot disponível.
   */
  async puxarOficial(desonerado = true, uf = '', referencia = '', onProgress) {
    const u=this._cleanUf(uf), r=this._cleanRef(referencia);
    const snapshot=this.snapshotFor(u,r,desonerado);
    if (!snapshot) {
      const list=this.OFFICIAL_SNAPSHOTS.filter(x => !!x.desonerado===!!desonerado).map(x => `${x.uf} ${x.referencia}`).join(', ') || 'nenhum';
      return { ok:false, code:'SNAPSHOT_NOT_AVAILABLE', msg:`Não há snapshot 1-clique para ${u || 'UF não informada'} ${r || 'referência não informada'} nesta versão. Disponível: ${list}. Importe o XLSX/ZIP oficial da Caixa para usar outra UF ou competência.` };
    }
    onProgress?.(`Carregando snapshot Caixa ${snapshot.uf} ${snapshot.referencia}...`);
    try {
      const res=await fetch(snapshot.file, { cache:'no-cache' });
      if (!res.ok) throw new Error(`arquivo local indisponível (HTTP ${res.status})`);
      onProgress?.('Validando composições e metadados...');
      const base=await res.json();
      if (!base || !Array.isArray(base.composicoes) || !base.composicoes.length) throw new Error('snapshot vazio ou inválido');
      if (this._cleanUf(base.uf)!==snapshot.uf || this._cleanRef(base.referencia)!==snapshot.referencia || !!base.desonerado!==!!snapshot.desonerado) {
        throw new Error('metadados do snapshot não correspondem à seleção');
      }
      const stored=this._saveBase({ ...base, source:'snapshot_caixa_empacotado', importada_em:new Date().toISOString() }, desonerado, u, r);
      return { ok:true, total:stored.composicoes.length, uf:u, referencia:r, msg:`Snapshot SINAPI Caixa ${u} ${r} (${stored.composicoes.length.toLocaleString('pt-BR')} itens) carregado. Confira sempre UF e competência antes de usar.` };
    } catch (err) {
      console.error('SINAPI.puxarOficial error:', err);
      return { ok:false, code:'SNAPSHOT_LOAD_ERROR', msg:`Erro ao carregar snapshot SINAPI: ${err.message}` };
    }
  },

  // ─────────────────────────────────────────────────
  // Importação do XLSX / ZIP da Caixa
  // ─────────────────────────────────────────────────

  /**
   * Importa um arquivo XLSX ou ZIP do SINAPI.
   * Suporta arquivos .zip oficiais da Caixa extraindo a planilha automaticamente.
   * @param {File} arquivo — arquivo .xlsx ou .zip selecionado pelo usuário
   * @param {boolean} desonerado — true = série desonerada
   * @param {string} uf — UF selecionada (ex: 'RR')
   * @param {string} referencia — mês de referência (ex: '2025-07')
   * @param {function} onProgress — callback(msg) para feedback de progresso
   * @returns {Promise<{ok:boolean, total:number, msg:string}>}
   */
  async importar(arquivo, desonerado, uf, referencia, onProgress) {
    onProgress?.('Lendo arquivo...');

    try {
      let dataBuffer;
      const isZip = (arquivo.name || '').toLowerCase().endsWith('.zip') || (arquivo.type || '').includes('zip');

      if (isZip) {
        onProgress?.('Arquivo ZIP da Caixa detectado! Descompactando...');

        // Garantir disponibilidade do JSZip
        if (typeof JSZip === 'undefined') {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            s.onload = resolve;
            s.onerror = () => reject(new Error('Falha ao carregar descompactador ZIP'));
            document.head.appendChild(s);
          });
        }

        const zip = await JSZip.loadAsync(arquivo);
        const entries = Object.values(zip.files).filter(f => !f.dir);

        // Prioridade: Composicoes Sintetico -> Composicoes -> qualquer .xlsx
        let target = entries.find(f => {
          const n = f.name.toLowerCase();
          return n.endsWith('.xlsx') && (n.includes('sintetico') || n.includes('sint'));
        });
        if (!target) {
          target = entries.find(f => {
            const n = f.name.toLowerCase();
            return n.endsWith('.xlsx') && n.includes('comp');
          });
        }
        if (!target) {
          target = entries.find(f => f.name.toLowerCase().endsWith('.xlsx'));
        }

        if (!target) {
          return { ok: false, msg: 'Nenhuma planilha XLSX encontrada dentro do arquivo ZIP da Caixa.' };
        }

        const cleanName = target.name.split('/').pop();
        onProgress?.(`Planilha encontrada: "${cleanName}". Processando...`);
        dataBuffer = await target.async('arraybuffer');
      } else {
        dataBuffer = await arquivo.arrayBuffer();
      }

      onProgress?.('Processando planilha Excel...');
      const data = new Uint8Array(dataBuffer);
      const wb = XLSX.read(data, { type: 'array' });

      // Detectar a aba correta de composições
      const abaAlvo = this._detectarAba(wb.SheetNames, desonerado);
      if (!abaAlvo) {
        return { ok: false, msg: 'Aba de composições não encontrada. Verifique se o arquivo é a planilha SINAPI correta (Composições Sintéticas ou Analíticas).' };
      }

      onProgress?.(`Aba encontrada: "${abaAlvo}". Extraindo dados...`);
      const sheet = wb.Sheets[abaAlvo];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      const composicoes = this._parseRows(rows, onProgress);

      if (composicoes.length === 0) {
        return { ok: false, msg: 'Nenhuma composição encontrada. Verifique se selecionou a planilha de Composições Sintéticas/Analíticas.' };
      }

      onProgress?.(`Salvando ${composicoes.length.toLocaleString('pt-BR')} composições...`);

      const base = {
        referencia: this._cleanRef(referencia),
        uf: this._cleanUf(uf),
        desonerado: !!desonerado,
        importada_em: new Date().toISOString(),
        total_itens: composicoes.length,
        composicoes,
        source: 'arquivo_caixa_importado'
      };
      if (!base.uf || !base.referencia) return { ok:false, msg:'Informe a UF e o mês de referência antes de importar.' };
      const stored = this._saveBase(base, desonerado, base.uf, base.referencia);
      const partial = stored.composicoes.length < composicoes.length;
      return {
        ok:true,
        total:stored.composicoes.length,
        uf:base.uf,
        referencia:base.referencia,
        msg: partial
          ? `Importadas ${stored.composicoes.length.toLocaleString('pt-BR')} composições de ${base.uf} ${base.referencia} (cache parcial por limite do navegador).`
          : `${stored.composicoes.length.toLocaleString('pt-BR')} composições de ${base.uf} ${base.referencia} importadas com sucesso!`
      };

    } catch (err) {
      console.error('SINAPI.importar error:', err);
      return { ok: false, msg: `Erro ao processar o arquivo: ${err.message}` };
    }
  },

  // Detecta qual aba do XLSX contém as composições sintéticas
  _detectarAba(sheetNames, desonerado) {
    const nomes = sheetNames.map(n => n.toUpperCase());

    // Prioridade: composições sintéticas (preço final por item)
    const candidatos = [
      desonerado ? 'CST_DESONERA' : 'CST',           // Custo Sintético
      desonerado ? 'COMP_DESONERA' : 'COMP',          // Composições
      desonerado ? 'CST DESONERADO' : 'CST SEM DESONERAÇÃO',
      'SINTÉTICO',  'SINTETICO',
      'COMPOSIÇÕES', 'COMPOSICOES',
      'COMP_DES', 'COMP_SEM',
      'CUSTO',
    ];

    for (const c of candidatos) {
      const idx = nomes.findIndex(n => n.includes(c));
      if (idx !== -1) return sheetNames[idx];
    }

    // Fallback: retornar a primeira aba com mais de 100 linhas
    for (const name of sheetNames) {
      // heurística: abas com dados tendem a ter nomes mais curtos
      if (name.length < 40) return name;
    }

    return sheetNames[0] || null;
  },

  // Parseia as linhas da planilha e extrai composições
  _parseRows(rows, onProgress) {
    const composicoes = [];

    // Encontrar o índice de cabeçalho — procurar linha com "CÓDIGO" ou "DESCRIÇÃO"
    let headerIdx = -1;
    let colCodigo = -1, colDescricao = -1, colUnidade = -1, colPreco = -1;

    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const row = rows[i].map(c => String(c).toUpperCase().trim());
      const hasCod = row.some(c => c.includes('CÓDIGO') || c.includes('CODIGO') || c === 'CÓD' || c === 'COD');
      const hasDesc = row.some(c => c.includes('DESCRIÇÃO') || c.includes('DESCRICAO'));
      if (hasCod && hasDesc) {
        headerIdx = i;
        colCodigo    = row.findIndex(c => c.includes('CÓDIGO') || c.includes('CODIGO') || c === 'CÓD' || c === 'COD');
        colDescricao = row.findIndex(c => c.includes('DESCRIÇÃO') || c.includes('DESCRICAO'));
        colUnidade   = row.findIndex(c => c.includes('UNID') || c === 'UN' || c === 'UND');
        colPreco     = row.findIndex(c => c.includes('CUSTO') || c.includes('PREÇO') || c.includes('PRECO') || c.includes('UNIT') || c.includes('VALOR'));
        break;
      }
    }

    if (headerIdx === -1) {
      // Tentar heurística: assumir que col 0=código, 1=descrição, 2=unidade, 3=preço
      headerIdx = 0;
      colCodigo = 0; colDescricao = 1; colUnidade = 2; colPreco = 3;
    }

    let processadas = 0;
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;

      const codigo    = String(row[colCodigo] ?? '').trim();
      const descricao = String(row[colDescricao] ?? '').trim();
      const unidade   = String(row[colUnidade] ?? '').trim().toUpperCase();
      const precoRaw  = row[colPreco];
      const preco     = this._parsePreco(precoRaw);

      if (!codigo || !descricao || codigo.length < 2) continue;
      if (isNaN(preco) || preco < 0) continue;

      composicoes.push({ codigo, descricao, unidade: unidade || 'UN', preco_unitario: preco });
      processadas++;

      if (processadas % 1000 === 0) {
        onProgress?.(`Processando... ${processadas.toLocaleString('pt-BR')} itens lidos`);
      }
    }

    return composicoes;
  },

  _parsePreco(raw) {
    if (raw === null || raw === undefined || raw === '') return 0;
    if (typeof raw === 'number') return Math.round(raw * 100) / 100;
    // String com formato brasileiro: "1.234,56"
    const s = String(raw).replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.');
    return Math.round(parseFloat(s) * 100) / 100 || 0;
  },

  // ─────────────────────────────────────────────────
  // Busca de Composições
  // ─────────────────────────────────────────────────

  /**
   * Busca composições por código ou descrição (case-insensitive).
   * @param {string} termo — texto a buscar
   * @param {boolean} desonerado — qual série usar
   * @param {number} limite — max resultados retornados
   */
  buscar(termo, desonerado = false, limite = 50, uf = '', referencia = '') {
    const base = this.getBase(desonerado, uf, referencia);
    if (!base || !base.composicoes) return [];

    const t = (termo || '').trim().toLowerCase();
    if (!t) return base.composicoes.slice(0, limite);

    const resultados = [];
    for (const c of base.composicoes) {
      const match =
        c.codigo.toLowerCase().includes(t) ||
        c.descricao.toLowerCase().includes(t);
      if (match) {
        resultados.push(c);
        if (resultados.length >= limite) break;
      }
    }
    return resultados;
  },

  // ─────────────────────────────────────────────────
  // Label de exibição
  // ─────────────────────────────────────────────────

  labelSerie(desonerado) {
    return desonerado ? 'Sem Oneração (Desonerado)' : 'Com Oneração';
  },

  labelMeta(desonerado, uf = '', referencia = '') {
    const meta = this.getMeta(desonerado, uf, referencia);
    if (!meta) return `${this.labelSerie(desonerado)} — não importada`;
    const [y, m] = (meta.referencia || '').split('-');
    const meses = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const mesLabel = meses[parseInt(m)] || m;
    return `${this.labelSerie(desonerado)} — ${meta.uf} ${mesLabel}/${y} (${meta.total.toLocaleString('pt-BR')} itens)`;
  },

};
