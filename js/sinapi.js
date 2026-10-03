// js/sinapi.js — Motor SINAPI: bases oficiais da Caixa, busca e importação
// Suporta duas séries: Com Oneração (padrão) e Sem Oneração (desonerado)

const SINAPI = {

  // Bases oficiais empacotadas (tabela da Caixa, competência mais recente).
  // Só estas UFs têm base nesta versão; o orçamento usa sempre REFERENCIA_ATUAL.
  REFERENCIA_ATUAL: '2026-08',
  UFS_DISPONIVEIS: ['SP', 'SC', 'RR'],
  OFFICIAL_SNAPSHOTS: [
    { uf:'SP', referencia:'2026-08', desonerado:false, file:'/data/sinapi_sp_2026_08_onerado.json' },
    { uf:'SP', referencia:'2026-08', desonerado:true,  file:'/data/sinapi_sp_2026_08_desonerado.json' },
    { uf:'SC', referencia:'2026-08', desonerado:false, file:'/data/sinapi_sc_2026_08_onerado.json' },
    { uf:'SC', referencia:'2026-08', desonerado:true,  file:'/data/sinapi_sc_2026_08_desonerado.json' },
    { uf:'RR', referencia:'2026-08', desonerado:false, file:'/data/sinapi_rr_2026_08_onerado.json' },
    { uf:'RR', referencia:'2026-08', desonerado:true,  file:'/data/sinapi_rr_2026_08_desonerado.json' }
  ],

  // Bases ficam só em memória. Cada uma tem ~3 MB e o localStorage (~5 MB por site)
  // não comporta duas; antes a segunda era truncada em 5.000 itens sem aviso.
  // Recarregar a página volta a ler o arquivo, servido pelo cache HTTP do navegador.
  _cachedBase: {},
  _loadingPromises: {},

  _cleanUf(uf='') { return String(uf || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0,2); },
  _cleanRef(ref='') { return /^\d{4}-\d{2}$/.test(String(ref || '').trim()) ? String(ref).trim() : ''; },
  _ref(referencia) { return this._cleanRef(referencia) || this.REFERENCIA_ATUAL; },

  _baseKey(desonerado, uf, referencia) {
    return `${this._cleanUf(uf) || 'XX'}_${this._ref(referencia)}_${desonerado ? 'des' : 'on'}`;
  },

  ufDisponivel(uf) { return this.UFS_DISPONIVEIS.includes(this._cleanUf(uf)); },

  /** true quando existe base oficial para a UF e a competência (vazia = atual). */
  disponivel(uf, referencia = '') {
    return this.OFFICIAL_SNAPSHOTS.some(x => x.uf === this._cleanUf(uf) && x.referencia === this._ref(referencia));
  },

  /** "08/2026" */
  refLabel(referencia = '') {
    const [y, m] = this._ref(referencia).split('-');
    return `${m}/${y}`;
  },

  snapshotFor(uf, referencia, desonerado=false) {
    const u=this._cleanUf(uf), r=this._ref(referencia);
    return this.OFFICIAL_SNAPSHOTS.find(x => x.uf===u && x.referencia===r && !!x.desonerado===!!desonerado) || null;
  },

  availableSnapshots() { return this.OFFICIAL_SNAPSHOTS.map(x => ({...x})); },

  /** Remove cópias antigas das bases gravadas no localStorage (podiam estar truncadas). */
  _limparCacheLegado() {
    try {
      if (typeof localStorage === 'undefined') return;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (/_sinapi_base_/.test(k) || /_sinapi_active_/.test(k) || /^sinapi_base_(des)?onerado$/.test(k) || /^finobra_sinapi_base_/.test(k))) {
          localStorage.removeItem(k);
        }
      }
    } catch {}
  },

  hasBase(desonerado = false, uf = '', referencia = '') {
    const base = this.getBase(desonerado, uf, referencia);
    return !!(base?.composicoes?.length && !base.parcial);
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

  /** Base já carregada em memória para a UF/competência/série, ou null. Não baixa nada. */
  getBase(desonerado = false, uf = '', referencia = '') {
    const u = this._cleanUf(uf);
    if (!u) return null;
    return this._cachedBase[this._baseKey(desonerado, u, referencia)] || null;
  },

  _saveBase(base, desonerado, uf, referencia) {
    const u=this._cleanUf(uf), r=this._cleanRef(referencia);
    if (!u || !r) throw new Error('UF e referência SINAPI são obrigatórias.');
    const normalized={ ...base, uf:u, referencia:r, desonerado:!!desonerado };
    this._cachedBase[this._baseKey(desonerado,u,r)]=normalized;
    return normalized;
  },

  /**
   * Garante a base oficial da UF/competência/série em memória.
   * Sem base oficial para a combinação, devolve null: nunca usa outra UF ou competência.
   */
  async ensureBaseLoaded(desonerado = false, uf = '', referencia = '') {
    const u = this._cleanUf(uf), r = this._ref(referencia);
    const existing = this.getBase(desonerado, u, r);
    if (existing?.composicoes?.length) return existing;

    const snap = this.snapshotFor(u, r, desonerado);
    if (!snap || typeof fetch === 'undefined') return null;
    if (this._loadingPromises[snap.file]) return this._loadingPromises[snap.file];

    this._loadingPromises[snap.file] = (async () => {
      try {
        const res = await fetch(snap.file, { cache: 'default' });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || !Array.isArray(data.composicoes) || !data.composicoes.length) return null;
        if (this._cleanUf(data.uf) !== snap.uf || this._cleanRef(data.referencia) !== snap.referencia || !!data.desonerado !== !!snap.desonerado) {
          console.warn('SINAPI: metadados do arquivo não correspondem à base pedida', snap.file);
          return null;
        }
        return this._saveBase({ ...data, source: 'snapshot_caixa_empacotado' }, snap.desonerado, snap.uf, snap.referencia);
      } catch (err) {
        console.warn('SINAPI.ensureBaseLoaded error:', err);
        return null;
      } finally {
        delete this._loadingPromises[snap.file];
      }
    })();
    return this._loadingPromises[snap.file];
  },

  autoPreloadDefault() {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
    try {
      if (typeof Cobranca !== 'undefined' && Cobranca.isFeatureAllowed && !Cobranca.isFeatureAllowed('sinapi')) return;
      const empUf = (typeof DB !== 'undefined' && DB.getEmpresa) ? DB.getEmpresa()?.uf : '';
      if (!this.ufDisponivel(empUf)) return;
      this.ensureBaseLoaded(false, empUf, this.REFERENCIA_ATUAL);
    } catch {}
  },

  clearBase(desonerado = false, uf = '', referencia = '') {
    delete this._cachedBase[this._baseKey(desonerado, uf, referencia)];
  },

  clearAll() {
    this._cachedBase = {};
    this._limparCacheLegado();
  },

  /** Carrega a base oficial empacotada da UF/competência/série. */
  async puxarOficial(desonerado = false, uf = '', referencia = '', onProgress) {
    const u=this._cleanUf(uf), r=this._ref(referencia);
    if (!this.snapshotFor(u, r, desonerado)) {
      return { ok:false, code:'SNAPSHOT_NOT_AVAILABLE', msg:`Não há tabela SINAPI para ${u || 'a UF informada'} ${this.refLabel(r)}. Disponível: ${this.UFS_DISPONIVEIS.join(', ')} — competência ${this.refLabel()}.` };
    }
    onProgress?.(`Carregando tabela SINAPI Caixa ${u} ${this.refLabel(r)}...`);
    const stored = await this.ensureBaseLoaded(desonerado, u, r);
    if (!stored) return { ok:false, code:'SNAPSHOT_LOAD_ERROR', msg:'Não foi possível carregar a tabela SINAPI. Verifique a conexão e tente novamente.' };
    return { ok:true, total:stored.composicoes.length, uf:u, referencia:r, msg:`Tabela SINAPI Caixa ${u} ${this.refLabel(r)} carregada (${stored.composicoes.length.toLocaleString('pt-BR')} itens).` };
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
      await FinObraAssets.load('excel');
      let dataBuffer;
      const isZip = (arquivo.name || '').toLowerCase().endsWith('.zip') || (arquivo.type || '').includes('zip');

      if (isZip) {
        onProgress?.('Arquivo ZIP da Caixa detectado! Descompactando...');

        // Garantir disponibilidade do JSZip
        await FinObraAssets.load('zip');

        const zip = await JSZip.loadAsync(arquivo);
        const entries = Object.values(zip.files).filter(f => !f.dir);

        // Prioridade: Referência -> Composicoes Sintetico -> Composicoes -> qualquer .xlsx (exceto familias/manutencoes)
        let target = entries.find(f => {
          const n = f.name.toLowerCase();
          return n.endsWith('.xlsx') && (n.includes('referência') || n.includes('referencia'));
        });
        if (!target) {
          target = entries.find(f => {
            const n = f.name.toLowerCase();
            return n.endsWith('.xlsx') && (n.includes('sintetico') || n.includes('sint'));
          });
        }
        if (!target) {
          target = entries.find(f => {
            const n = f.name.toLowerCase();
            return n.endsWith('.xlsx') && n.includes('comp');
          });
        }
        if (!target) {
          target = entries.find(f => {
            const n = f.name.toLowerCase();
            return n.endsWith('.xlsx') && !n.includes('familia') && !n.includes('manuten');
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

      const targetUf = this._cleanUf(uf);
      let composicoes = [];

      // Verifica se a planilha possui a estrutura oficial multi-UF da Caixa (CSD/CCD e ISD/ICD)
      const isOfficialMultiUf = !!(wb.Sheets['CSD'] || wb.Sheets['CCD']);

      if (isOfficialMultiUf && targetUf) {
        onProgress?.(`Detectado pacote oficial Caixa com 27 UFs. Extraindo dados para ${targetUf}...`);
        const compSheetName = desonerado ? 'CCD' : 'CSD';
        const insumoSheetName = desonerado ? 'ICD' : 'ISD';

        const compSheet = wb.Sheets[compSheetName] || wb.Sheets[desonerado ? 'CSD' : 'CCD'];
        if (compSheet) {
          onProgress?.(`Extraindo composições (${compSheetName}) para ${targetUf}...`);
          const compRows = XLSX.utils.sheet_to_json(compSheet, { header: 1, defval: '' });
          // Linha 4 (índice 3) contém as siglas das 27 UFs
          const ufRow = compRows[3] || [];
          let compPriceCol = -1;
          for (let c = 0; c < ufRow.length; c++) {
            if (String(ufRow[c]).trim().toUpperCase() === targetUf) {
              compPriceCol = c;
              break;
            }
          }

          if (compPriceCol !== -1) {
            const range = XLSX.utils.decode_range(compSheet['!ref'] || 'A1:ZZ10000');
            for (let r = 10; r <= range.e.r; r++) {
              const cellB = compSheet[XLSX.utils.encode_cell({ r, c: 1 })]; // Código
              const cellC = compSheet[XLSX.utils.encode_cell({ r, c: 2 })]; // Descrição
              const cellD = compSheet[XLSX.utils.encode_cell({ r, c: 3 })]; // Unidade
              const cellP = compSheet[XLSX.utils.encode_cell({ r, c: compPriceCol })]; // Preço

              if (!cellC || !cellC.v) continue;

              let cod = '';
              if (cellB) {
                if (cellB.f) {
                  const m = String(cellB.f).match(/MATCH\(([0-9]+)/) || String(cellB.f).match(/,\s*([0-9]+)\s*\)$/);
                  if (m) cod = m[1];
                }
                if (!cod && cellB.v && cellB.v !== 0) cod = String(cellB.v).trim();
              }
              if (!cod) continue;

              const preco = this._parsePreco(cellP ? cellP.v : 0);
              composicoes.push({
                codigo: cod,
                tipo: 'COMP',
                descricao: String(cellC.v).trim(),
                unidade: String(cellD?.v || 'UN').trim().toUpperCase(),
                preco_unitario: preco
              });
            }
          }
        }

        // Insumos oficiais (ISD/ICD)
        const insumoSheet = wb.Sheets[insumoSheetName] || wb.Sheets[desonerado ? 'ISD' : 'ICD'];
        if (insumoSheet) {
          onProgress?.(`Extraindo insumos (${insumoSheetName}) para ${targetUf}...`);
          const insumoRows = XLSX.utils.sheet_to_json(insumoSheet, { header: 1, defval: '' });
          const ufRow = insumoRows[3] || [];
          let insumoPriceCol = -1;
          for (let c = 0; c < ufRow.length; c++) {
            if (String(ufRow[c]).trim().toUpperCase() === targetUf) {
              insumoPriceCol = c;
              break;
            }
          }

          if (insumoPriceCol !== -1) {
            const range = XLSX.utils.decode_range(insumoSheet['!ref'] || 'A1:ZZ10000');
            for (let r = 10; r <= range.e.r; r++) {
              const cellB = insumoSheet[XLSX.utils.encode_cell({ r, c: 1 })]; // Código
              const cellC = insumoSheet[XLSX.utils.encode_cell({ r, c: 2 })]; // Descrição
              const cellD = insumoSheet[XLSX.utils.encode_cell({ r, c: 3 })]; // Unidade
              const cellP = insumoSheet[XLSX.utils.encode_cell({ r, c: insumoPriceCol })]; // Preço

              if (!cellC || !cellC.v) continue;

              const cod = cellB?.v ? String(cellB.v).trim() : '';
              if (!cod || !/^\d+$/.test(cod)) continue;

              const preco = this._parsePreco(cellP ? cellP.v : 0);
              composicoes.push({
                codigo: cod,
                tipo: 'INSUMO',
                descricao: String(cellC.v).trim(),
                unidade: String(cellD?.v || 'UN').trim().toUpperCase(),
                preco_unitario: preco
              });
            }
          }
        }
      }

      // Fallback para planilhas avulsas / convencionais
      if (composicoes.length === 0) {
        const abaAlvo = this._detectarAba(wb.SheetNames, desonerado);
        if (!abaAlvo) {
          return { ok: false, msg: 'Aba de composições não encontrada. Verifique se o arquivo é a planilha SINAPI correta (Composições Sintéticas ou Analíticas).' };
        }

        onProgress?.(`Aba encontrada: "${abaAlvo}". Extraindo dados...`);
        const sheet = wb.Sheets[abaAlvo];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        composicoes = this._parseRows(rows, onProgress);
      }

      if (composicoes.length === 0) {
        return { ok: false, msg: 'Nenhuma composição encontrada. Verifique se selecionou a planilha de Composições Sintéticas/Analíticas.' };
      }

      onProgress?.(`Salvando ${composicoes.length.toLocaleString('pt-BR')} itens...`);

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
          ? `Importados ${stored.composicoes.length.toLocaleString('pt-BR')} itens de ${base.uf} ${base.referencia} (cache parcial por limite do navegador).`
          : `${stored.composicoes.length.toLocaleString('pt-BR')} itens de ${base.uf} ${base.referencia} importados com sucesso!`
      };

    } catch (err) {
      console.error('SINAPI.importar error:', err);
      return { ok: false, msg: `Erro ao processar o arquivo: ${err.message}` };
    }
  },

  // Detecta qual aba do XLSX contém as composições sintéticas
  _detectarAba(sheetNames, desonerado) {
    const nomes = sheetNames.map(n => n.toUpperCase());
    const ignorar = ['ANALÍTICO', 'ANALITICO', 'BUSCA', 'MENU', 'COEFICIENTES', 'FAMILIAS', 'MANUTENÇÕES', 'MANUTENCOES', 'MAO DE OBRA'];

    // Prioridade 1: Siglas oficiais de composições Caixa
    const prioritarias = desonerado
      ? ['CCD', 'CST_DESONERA', 'COMP_DES', 'COMP_DESONERA', 'CST DESONERADO']
      : ['CSD', 'CST', 'COMP_SEM', 'COMP', 'CST SEM DESONERAÇÃO', 'SINTÉTICO', 'SINTETICO'];

    for (const p of prioritarias) {
      const idx = nomes.findIndex(n => n === p || (n.includes(p) && !ignorar.some(ig => n.includes(ig))));
      if (idx !== -1) return sheetNames[idx];
    }

    // Prioridade 2: termos genéricos de composições sintéticas
    const candidatos = [
      desonerado ? 'DESONER' : 'SEM DESONER',
      'COMPOSIÇÕES', 'COMPOSICOES',
      'CUSTO'
    ];

    for (const c of candidatos) {
      const idx = nomes.findIndex(n => n.includes(c) && !ignorar.some(ig => n.includes(ig)));
      if (idx !== -1) return sheetNames[idx];
    }

    // Fallback: retornar a primeira aba com mais de 100 linhas que não seja de controle
    for (let i = 0; i < sheetNames.length; i++) {
      const n = nomes[i];
      if (!ignorar.some(ig => n.includes(ig)) && n.length < 40) return sheetNames[i];
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

      let codigo = String(row[colCodigo] ?? '').trim();
      const m = codigo.match(/MATCH\(([0-9]+)/) || codigo.match(/,\s*([0-9]+)\s*\)$/);
      if (m) codigo = m[1];

      const descricao = String(row[colDescricao] ?? '').trim();
      const unidade   = String(row[colUnidade] ?? '').trim().toUpperCase();
      const precoRaw  = row[colPreco];
      const preco     = this._parsePreco(precoRaw);

      if (!codigo || !descricao || codigo.length < 2 || codigo === '0') continue;
      if (isNaN(preco) || preco < 0) continue;

      composicoes.push({ codigo, tipo: 'COMP', descricao, unidade: unidade || 'UN', preco_unitario: preco });
      processadas++;

      if (processadas % 1000 === 0) {
        onProgress?.(`Processando... ${processadas.toLocaleString('pt-BR')} itens lidos`);
      }
    }

    return composicoes;
  },

  _parsePreco(raw) {
    if (raw === null || raw === undefined || raw === '') return 0;
    if (typeof raw === 'number') return isNaN(raw) ? 0 : Math.round(raw * 100) / 100;
    let s = String(raw).trim();
    if (!s) return 0;
    s = s.replace(/[R$\s]/gi, '');
    if (s.includes(',')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      const parts = s.split('.');
      if (parts.length > 2) {
        const last = parts.pop();
        s = parts.join('') + '.' + last;
      }
    }
    s = s.replace(/[^\d.-]/g, '');
    const num = parseFloat(s);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  },

  // ─────────────────────────────────────────────────
  // Busca de Composições
  // ─────────────────────────────────────────────────

  /**
   * Busca composições por código ou descrição (case-insensitive e accent-insensitive).
   * @param {string} termo — texto a buscar
   * @param {boolean} desonerado — qual série usar
   * @param {number} limite — max resultados retornados
   */
  buscar(termo, desonerado = false, limite = 50, uf = '', referencia = '') {
    let base = this.getBase(desonerado, uf, referencia);
    if (!base && !this._cleanUf(uf)) {
      // Busca global sem UF: usa qualquer base da série já carregada nesta sessão.
      const anyKey = Object.keys(this._cachedBase).find(k => k.endsWith(desonerado ? '_des' : '_on'));
      if (anyKey) base = this._cachedBase[anyKey];
    }
    if (!base || !base.composicoes) return [];

    const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const t = norm(termo);
    if (!t) return base.composicoes.slice(0, limite);

    const palavras = t.split(/\s+/).filter(Boolean);
    const resultados = [];
    for (const c of base.composicoes) {
      const cod = String(c.codigo || '').toLowerCase();
      const descNorm = c._norm || (c._norm = norm(c.descricao));
      const match = cod.includes(t) || (palavras.length && palavras.every(p => descNorm.includes(p)));
      if (match) {
        resultados.push(c);
        if (resultados.length >= limite) break;
      }
    }
    return resultados;
  },

  async buscarAsync(termo, desonerado = false, limite = 50, uf = '', referencia = '') {
    await this.ensureBaseLoaded(desonerado, uf, referencia);
    return this.buscar(termo, desonerado, limite, uf, referencia);
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

if (typeof window !== 'undefined' && typeof setTimeout === 'function') {
  setTimeout(() => {
    try { SINAPI._limparCacheLegado(); SINAPI.autoPreloadDefault(); } catch {}
  }, 250);
}

