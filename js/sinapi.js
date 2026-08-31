// js/sinapi.js — Motor SINAPI: Importação, Indexação e Busca
// Suporta duas séries: Com Oneração (padrão) e Sem Oneração (desonerado)

const SINAPI = {

  // Chaves no localStorage
  KEYS: {
    onerado:    'sinapi_base_onerado',
    desonerado: 'sinapi_base_desonerado',
  },

  // ─────────────────────────────────────────────────
  // Verificações de estado
  // ─────────────────────────────────────────────────

  hasBase(desonerado = false) {
    const key = desonerado ? this.KEYS.desonerado : this.KEYS.onerado;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const base = JSON.parse(raw);
      return Array.isArray(base.composicoes) && base.composicoes.length > 0;
    } catch { return false; }
  },

  getMeta(desonerado = false) {
    const key = desonerado ? this.KEYS.desonerado : this.KEYS.onerado;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const base = JSON.parse(raw);
      return { referencia: base.referencia, uf: base.uf, total: base.composicoes?.length || 0, importada_em: base.importada_em };
    } catch { return null; }
  },

  getBase(desonerado = false) {
    const key = desonerado ? this.KEYS.desonerado : this.KEYS.onerado;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  },

  clearBase(desonerado = false) {
    const key = desonerado ? this.KEYS.desonerado : this.KEYS.onerado;
    localStorage.removeItem(key);
  },

  clearAll() {
    localStorage.removeItem(this.KEYS.onerado);
    localStorage.removeItem(this.KEYS.desonerado);
  },

  // ─────────────────────────────────────────────────
  // Importação do XLSX da Caixa
  // ─────────────────────────────────────────────────

  /**
   * Importa um arquivo XLSX do SINAPI.
   * @param {File} arquivo — arquivo .xlsx selecionado pelo usuário
   * @param {boolean} desonerado — true = série desonerada
   * @param {string} uf — UF selecionada (ex: 'RR')
   * @param {string} referencia — mês de referência (ex: '2025-07')
   * @param {function} onProgress — callback(msg) para feedback de progresso
   * @returns {Promise<{ok:boolean, total:number, msg:string}>}
   */
  async importar(arquivo, desonerado, uf, referencia, onProgress) {
    onProgress?.('Lendo arquivo...');

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          onProgress?.('Processando planilha...');
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array' });

          // Detectar a aba correta de composições
          const abaAlvo = this._detectarAba(wb.SheetNames, desonerado);
          if (!abaAlvo) {
            resolve({ ok: false, msg: 'Aba de composições não encontrada. Verifique se o arquivo é a planilha SINAPI correta (Composições Analíticas ou Sintéticas).' });
            return;
          }

          onProgress?.(`Aba encontrada: "${abaAlvo}". Extraindo dados...`);

          const sheet = wb.Sheets[abaAlvo];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

          const composicoes = this._parseRows(rows, onProgress);

          if (composicoes.length === 0) {
            resolve({ ok: false, msg: 'Nenhuma composição encontrada. Verifique se selecionou a planilha de Composições Sintéticas/Analíticas.' });
            return;
          }

          onProgress?.(`Salvando ${composicoes.length.toLocaleString('pt-BR')} composições...`);

          const base = {
            referencia,
            uf,
            desonerado,
            importada_em: new Date().toISOString().split('T')[0],
            total_itens: composicoes.length,
            composicoes,
          };

          const key = desonerado ? this.KEYS.desonerado : this.KEYS.onerado;
          try {
            localStorage.setItem(key, JSON.stringify(base));
          } catch (storageErr) {
            // localStorage cheio — tentar com base reduzida
            const baseReduzida = { ...base, composicoes: composicoes.slice(0, 5000) };
            localStorage.setItem(key, JSON.stringify(baseReduzida));
            resolve({ ok: true, total: baseReduzida.composicoes.length, msg: `Importadas ${baseReduzida.composicoes.length.toLocaleString('pt-BR')} composições (limite de armazenamento atingido — base parcial).` });
            return;
          }

          resolve({ ok: true, total: composicoes.length, msg: `${composicoes.length.toLocaleString('pt-BR')} composições importadas com sucesso!` });

        } catch (err) {
          console.error('SINAPI.importar error:', err);
          resolve({ ok: false, msg: `Erro ao processar o arquivo: ${err.message}` });
        }
      };
      reader.onerror = () => resolve({ ok: false, msg: 'Erro ao ler o arquivo.' });
      reader.readAsArrayBuffer(arquivo);
    });
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
  buscar(termo, desonerado = false, limite = 50) {
    const base = this.getBase(desonerado);
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

  labelMeta(desonerado) {
    const meta = this.getMeta(desonerado);
    if (!meta) return `${this.labelSerie(desonerado)} — não importada`;
    const [y, m] = (meta.referencia || '').split('-');
    const meses = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const mesLabel = meses[parseInt(m)] || m;
    return `${this.labelSerie(desonerado)} — ${meta.uf} ${mesLabel}/${y} (${meta.total.toLocaleString('pt-BR')} itens)`;
  },

};
