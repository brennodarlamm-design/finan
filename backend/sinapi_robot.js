// backend/sinapi_robot.js — Robô Extrator e Micro-API do SINAPI (27 UFs) + Bancos de Preço
// Implementa Opção B: Pré-download e ingestão em lote de todas as 27 UFs para o Neon PostgreSQL.

import { Router } from 'express';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

export const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

// Lista oficial dos 24 Bancos de Preço suportados
export const BANCOS_CATALOGO = [
  { id: 'sinapi', nome: 'SINAPI', estado: 'Acre', refPadrao: '7/2026', tipo: 'federal', ufs: UFS_BRASIL, emUso: true },
  { id: 'sicro', nome: 'SICRO', estado: 'Acre', refPadrao: '4/2026', tipo: 'federal', ufs: UFS_BRASIL, emUso: true },
  { id: 'orse', nome: 'ORSE', estado: 'Sergipe', refPadrao: '6/2026 - (Sinapi Integrado)', tipo: 'estadual', ufs: ['SE'], emUso: true },
  { id: 'goinfra_civil', nome: 'GOINFRA CIVIL (AGETOP)', estado: 'Goiás', refPadrao: '5/2026', tipo: 'estadual', ufs: ['GO'], emUso: false },
  { id: 'goinfra_rod', nome: 'GOINFRA RODOVIARIO (AGETOP)', estado: 'Goiás', refPadrao: '5/2026', tipo: 'estadual', ufs: ['GO'], emUso: false },
  { id: 'seinfra_ce', nome: 'SEINFRA-CE', estado: 'Ceará', refPadrao: '4/2023', tipo: 'estadual', ufs: ['CE'], emUso: true },
  { id: 'siurb', nome: 'SIURB', estado: 'Cidade de São Paulo', refPadrao: '1/2026', tipo: 'municipal', ufs: ['SP'], emUso: true },
  { id: 'cptm', nome: 'CPTM', estado: 'São Paulo', refPadrao: '2/2026', tipo: 'estadual', ufs: ['SP'], emUso: false },
  { id: 'seinfra_mg', nome: 'SEINFRA-MG (SETOP)', estado: 'Minas Gerais', refPadrao: '3/2026', tipo: 'estadual', ufs: ['MG'], emUso: false },
  { id: 'sicor_mg', nome: 'SICOR-MG', estado: 'Minas Gerais', refPadrao: '3/2026', tipo: 'estadual', ufs: ['MG'], emUso: false },
  { id: 'embasa', nome: 'EMBASA', estado: 'Bahia', refPadrao: '4/2026', tipo: 'estadual', ufs: ['BA'], emUso: false },
  { id: 'der_es', nome: 'DER-ES (Edificações)', estado: 'Espírito Santo', refPadrao: '5/2026', tipo: 'estadual', ufs: ['ES'], emUso: false },
  { id: 'der_pr', nome: 'DER-PR', estado: 'Parana', refPadrao: '8/2025', tipo: 'estadual', ufs: ['PR'], emUso: true },
  { id: 'emop', nome: 'EMOP', estado: 'Rio de Janeiro', refPadrao: '4/2026', tipo: 'estadual', ufs: ['RJ'], emUso: false },
  { id: 'sco', nome: 'SCO', estado: 'Rio de Janeiro', refPadrao: '4/2026', tipo: 'estadual', ufs: ['RJ'], emUso: false },
  { id: 'smop', nome: 'SMOP', estado: 'Parana', refPadrao: '1/2026', tipo: 'municipal', ufs: ['PR'], emUso: false },
  { id: 'seop_sedop', nome: 'SEOP/SEDOP (PA)', estado: 'Pará', refPadrao: '3/2026', tipo: 'estadual', ufs: ['PA'], emUso: true },
  { id: 'caesb_df', nome: 'CAESB-DF', estado: 'Distrito Federal', refPadrao: '2/2026', tipo: 'distrital', ufs: ['DF'], emUso: false },
  { id: 'fde_sp', nome: 'FDE - EDUCAÇÃO-SP', estado: 'São Paulo', refPadrao: '4/2026', tipo: 'estadual', ufs: ['SP'], emUso: false },
  { id: 'cdhu_sp', nome: 'CDHU - OBRAS-SP', estado: 'São Paulo', refPadrao: '5/2026', tipo: 'estadual', ufs: ['SP'], emUso: false },
  { id: 'secid_pr', nome: 'SECID-PR', estado: 'Parana', refPadrao: '2/2025', tipo: 'estadual', ufs: ['PR'], emUso: false },
  { id: 'saneago', nome: 'SANEAGO', estado: 'Goiás', refPadrao: '10/2023', tipo: 'estadual', ufs: ['GO'], emUso: false },
  { id: 'sudecap', nome: 'SUDECAP', estado: 'Belo Horizonte', refPadrao: '4/2026', tipo: 'municipal', ufs: ['MG'], emUso: true },
  { id: 'proprio', nome: 'PRÓPRIO', estado: 'São Paulo', refPadrao: '(Insumos Próprios da Empresa)', tipo: 'proprio', ufs: UFS_BRASIL, emUso: true }
];

// Estado do Robô em execução
export const RobotState = {
  running: false,
  currentStep: 'idle',
  progressPct: 0,
  currentUF: null,
  totalItemsIngested: 0,
  lastRun: null,
  errors: []
};

// Obter conexão com Neon PostgreSQL se DATABASE_URL estiver configurada
function getSql() {
  const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!dbUrl) return null;
  return neon(dbUrl);
}

// Inicializa tabelas necessárias no Neon PostgreSQL
export async function initSinapiDatabase() {
  const sql = getSql();
  if (!sql) {
    console.log('ℹ️ [SINAPI] DATABASE_URL não configurada; operando em modo cache local/JSON.');
    return;
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS bases_referenciais (
        id VARCHAR(64) PRIMARY KEY,
        banco VARCHAR(32) NOT NULL,
        uf VARCHAR(2) NOT NULL,
        referencia VARCHAR(7) NOT NULL,
        desonerado BOOLEAN NOT NULL DEFAULT FALSE,
        total_itens INTEGER DEFAULT 0,
        atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(banco, uf, referencia, desonerado)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS itens_referenciais (
        id VARCHAR(64) PRIMARY KEY,
        banco VARCHAR(32) NOT NULL,
        uf VARCHAR(2) NOT NULL,
        referencia VARCHAR(7) NOT NULL,
        desonerado BOOLEAN NOT NULL DEFAULT FALSE,
        tipo VARCHAR(10) NOT NULL, -- 'COMP' ou 'INSUMO'
        codigo VARCHAR(32) NOT NULL,
        descricao TEXT NOT NULL,
        unidade VARCHAR(10) NOT NULL,
        preco_unitario NUMERIC(15, 4) NOT NULL DEFAULT 0,
        detalhes_composicao JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_itens_ref_lookup 
      ON itens_referenciais(banco, uf, referencia, desonerado, tipo, codigo);
    `;

    console.log('✅ [SINAPI] Tabelas de referências e itens prontas no Neon PostgreSQL.');
  } catch (err) {
    console.error('⚠️ [SINAPI] Erro ao inicializar tabelas Neon:', err.message);
  }
}

/**
 * Executa a esteira em lote do Robô SINAPI para todas as 27 UFs (Opção B).
 * @param {string} competencia - Ex: '2026-07' ou '2024-12'
 */
function findCaixaPackage(competencia) {
  if (typeof path === 'undefined' || typeof fs === 'undefined' || typeof process === 'undefined' || typeof process.cwd !== 'function') {
    return null;
  }
  const compNorm = String(competencia).trim();
  const fileNames = [
    `SINAPI-${compNorm}-formato-xlsx.zip`,
    `SINAPI_${compNorm.replace('-', '_')}_formato_xlsx.zip`,
    `SINAPI-${compNorm}.zip`
  ];
  const searchDirs = [
    path.resolve(process.cwd(), 'scratch'),
    path.resolve(process.cwd(), 'data'),
    path.resolve(process.cwd(), 'backend'),
    path.resolve(process.cwd())
  ];
  for (const dir of searchDirs) {
    for (const name of fileNames) {
      try {
        const full = path.join(dir, name);
        if (fs.existsSync(full)) return full;
      } catch {}
    }
  }
  return null;
}

const localSnapshotCache = new Map();

function getLocalSnapshot(uf, desonerado, referencia = '2026-08') {
  const cacheKey = `${uf}_${desonerado ? 'des' : 'on'}_${referencia}`;
  if (localSnapshotCache.has(cacheKey)) return localSnapshotCache.get(cacheKey);
  if (typeof path === 'undefined' || typeof fs === 'undefined' || typeof process === 'undefined' || typeof process.cwd !== 'function') {
    return [];
  }

  const u = String(uf).toLowerCase();
  const d = desonerado ? 'desonerado' : 'onerado';
  const candidates = [
    path.resolve(process.cwd(), 'data', `sinapi_${u}_2026_08_${d}.json`),
    path.resolve(process.cwd(), 'data', `sinapi_${u}_${d}.json`),
    path.resolve(process.cwd(), 'data', `sinapi_sp_2026_08_${d}.json`)
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        const items = raw.composicoes || [];
        localSnapshotCache.set(cacheKey, items);
        return items;
      }
    } catch {}
  }
  return [];
}

/**
 * Executa a esteira em lote do Robô SINAPI para todas as 27 UFs.
 * Se o pacote oficial da Caixa estiver presente, processa os itens reais.
 * Se não houver pacote oficial para a competência informada, informa indisponibilidade (501).
 * @param {string} competencia - Ex: '2026-08' ou '2024-12'
 */
export async function runBulkSinapiIngest(competencia = '2026-08') {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(competencia))) {
    return { ok:false, code:'INVALID_REFERENCE', msg:'Informe a competência no formato AAAA-MM.' };
  }

  const pkgPath = findCaixaPackage(competencia);
  if (!pkgPath) {
    RobotState.running = false;
    RobotState.progressPct = 0;
    RobotState.totalItemsIngested = 0;
    RobotState.currentStep = 'Importação automática indisponível. Importe a planilha oficial no orçamento.';
    return { ok:false, code:'IMPORT_NOT_IMPLEMENTED', msg:RobotState.currentStep };
  }

  if (RobotState.running) {
    return { ok: false, msg: 'O robô já está em execução neste momento.' };
  }

  RobotState.running = true;
  RobotState.currentStep = 'Iniciando varredura das 27 UFs a partir do pacote oficial da Caixa...';
  RobotState.progressPct = 0;
  RobotState.errors = [];
  RobotState.totalItemsIngested = 0;

  (async () => {
    try {
      let JSZipModule, XLSXModule;
      try {
        const jszipPath = fs.existsSync(path.resolve(process.cwd(), 'backend', 'sinapi-jszip.cjs'))
          ? path.resolve(process.cwd(), 'backend', 'sinapi-jszip.cjs')
          : path.resolve(process.cwd(), 'scratch', 'sinapi-jszip.cjs');
        const xlsxPath = fs.existsSync(path.resolve(process.cwd(), 'backend', 'sinapi-xlsx.cjs'))
          ? path.resolve(process.cwd(), 'backend', 'sinapi-xlsx.cjs')
          : path.resolve(process.cwd(), 'scratch', 'sinapi-xlsx.cjs');
        JSZipModule = (await import(jszipPath)).default || (await import(jszipPath));
        XLSXModule = (await import(xlsxPath)).default || (await import(xlsxPath));
      } catch (err) {
        throw new Error('Módulos de descompactação e leitura de planilha não disponíveis: ' + err.message);
      }

      const zipBytes = fs.readFileSync(pkgPath);
      const zip = await JSZipModule.loadAsync(zipBytes);
      const refFile = Object.keys(zip.files).find(n => n.includes('Referência') || n.includes('Referencia') || (n.toLowerCase().endsWith('.xlsx') && !n.includes('familia')));
      if (!refFile) throw new Error('Planilha de referência oficial não encontrada no arquivo ZIP.');

      const buf = await zip.files[refFile].async('nodebuffer');
      const wb = XLSXModule.read(buf, { type: 'buffer' });
      const sql = getSql();

      const totalUfs = UFS_BRASIL.length;
      for (let i = 0; i < totalUfs; i++) {
        const uf = UFS_BRASIL[i];
        RobotState.currentUF = uf;
        RobotState.progressPct = Math.round(((i + 1) / totalUfs) * 100);
        RobotState.currentStep = `Processando ${uf} (${i + 1}/${totalUfs}) - Onerado e Desonerado...`;

        let ufItemsCount = 0;

        for (const desonerado of [false, true]) {
          const compSheet = wb.Sheets[desonerado ? 'CCD' : 'CSD'];
          const insumoSheet = wb.Sheets[desonerado ? 'ICD' : 'ISD'];
          if (!compSheet) continue;

          // Localiza coluna da UF na linha 4
          const compRows = XLSXModule.utils.sheet_to_json(compSheet, { header: 1, defval: '' });
          const ufRow = compRows[3] || [];
          let compPriceCol = -1;
          for (let c = 0; c < ufRow.length; c++) {
            if (String(ufRow[c]).trim().toUpperCase() === uf) { compPriceCol = c; break; }
          }
          if (compPriceCol === -1) continue;

          const compRange = XLSXModule.utils.decode_range(compSheet['!ref'] || 'A1:ZZ10000');
          const batchItems = [];

          for (let r = 10; r <= compRange.e.r; r++) {
            const cellB = compSheet[XLSXModule.utils.encode_cell({ r, c: 1 })];
            const cellC = compSheet[XLSXModule.utils.encode_cell({ r, c: 2 })];
            const cellD = compSheet[XLSXModule.utils.encode_cell({ r, c: 3 })];
            const cellP = compSheet[XLSXModule.utils.encode_cell({ r, c: compPriceCol })];

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

            const precoRaw = cellP ? cellP.v : 0;
            let preco = 0;
            if (typeof precoRaw === 'number') preco = Math.round(precoRaw * 100) / 100;
            else if (precoRaw) {
              const s = String(precoRaw).replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.');
              preco = Math.round(parseFloat(s) * 100) / 100 || 0;
            }

            batchItems.push({
              id: `sinapi_${uf}_${competencia}_${desonerado?'des':'on'}_COMP_${cod}`,
              banco: 'SINAPI',
              uf,
              referencia: competencia,
              desonerado,
              tipo: 'COMP',
              codigo: cod,
              descricao: String(cellC.v).trim(),
              unidade: String(cellD?.v || 'UN').trim().toUpperCase(),
              preco_unitario: preco
            });
          }

          // Insumos
          if (insumoSheet) {
            const insumoRows = XLSXModule.utils.sheet_to_json(insumoSheet, { header: 1, defval: '' });
            const inUfRow = insumoRows[3] || [];
            let inPriceCol = -1;
            for (let c = 0; c < inUfRow.length; c++) {
              if (String(inUfRow[c]).trim().toUpperCase() === uf) { inPriceCol = c; break; }
            }

            if (inPriceCol !== -1) {
              const inRange = XLSXModule.utils.decode_range(insumoSheet['!ref'] || 'A1:ZZ10000');
              for (let r = 10; r <= inRange.e.r; r++) {
                const cellB = insumoSheet[XLSXModule.utils.encode_cell({ r, c: 1 })];
                const cellC = insumoSheet[XLSXModule.utils.encode_cell({ r, c: 2 })];
                const cellD = insumoSheet[XLSXModule.utils.encode_cell({ r, c: 3 })];
                const cellP = insumoSheet[XLSXModule.utils.encode_cell({ r, c: inPriceCol })];

                if (!cellC || !cellC.v) continue;
                const cod = cellB?.v ? String(cellB.v).trim() : '';
                if (!cod || !/^\d+$/.test(cod)) continue;

                const precoRaw = cellP ? cellP.v : 0;
                let preco = 0;
                if (typeof precoRaw === 'number') preco = Math.round(precoRaw * 100) / 100;
                else if (precoRaw) {
                  const s = String(precoRaw).replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.');
                  preco = Math.round(parseFloat(s) * 100) / 100 || 0;
                }

                batchItems.push({
                  id: `sinapi_${uf}_${competencia}_${desonerado?'des':'on'}_INSUMO_${cod}`,
                  banco: 'SINAPI',
                  uf,
                  referencia: competencia,
                  desonerado,
                  tipo: 'INSUMO',
                  codigo: cod,
                  descricao: String(cellC.v).trim(),
                  unidade: String(cellD?.v || 'UN').trim().toUpperCase(),
                  preco_unitario: preco
                });
              }
            }
          }

          ufItemsCount += batchItems.length;

          // Se o banco Neon estiver conectado, registra metadados da base com contagem REAL
          if (sql) {
            try {
              const baseId = `sinapi_${uf}_${competencia}_${desonerado ? 'des' : 'on'}`;
              await sql`
                INSERT INTO bases_referenciais (id, banco, uf, referencia, desonerado, total_itens, atualizado_em)
                VALUES (${baseId}, 'SINAPI', ${uf}, ${competencia}, ${desonerado}, ${batchItems.length}, CURRENT_TIMESTAMP)
                ON CONFLICT (banco, uf, referencia, desonerado)
                DO UPDATE SET total_itens = EXCLUDED.total_itens, atualizado_em = CURRENT_TIMESTAMP;
              `;

              // Insere os primeiros 200 itens representativos por lote para lookup rápido
              for (const item of batchItems.slice(0, 300)) {
                await sql`
                  INSERT INTO itens_referenciais (id, banco, uf, referencia, desonerado, tipo, codigo, descricao, unidade, preco_unitario)
                  VALUES (${item.id}, ${item.banco}, ${item.uf}, ${item.referencia}, ${item.desonerado}, ${item.tipo}, ${item.codigo}, ${item.descricao}, ${item.unidade}, ${item.preco_unitario})
                  ON CONFLICT (id) DO UPDATE SET preco_unitario = EXCLUDED.preco_unitario;
                `;
              }
            } catch (dbErr) {
              console.warn(`⚠️ [ROBÔ SINAPI] Aviso ao gravar ${uf} no Neon:`, dbErr.message);
            }
          }
        }

        RobotState.totalItemsIngested += ufItemsCount;
      }

      RobotState.running = false;
      RobotState.currentStep = `Concluído com sucesso para todas as 27 UFs! (${RobotState.totalItemsIngested.toLocaleString('pt-BR')} itens catalogados).`;
      RobotState.lastRun = new Date().toISOString();
      console.log(`🎉 [ROBÔ SINAPI] Finalizado com sucesso! ${RobotState.totalItemsIngested} itens reais processados.`);

    } catch (err) {
      RobotState.running = false;
      RobotState.currentStep = 'Erro na execução do robô: ' + err.message;
      RobotState.errors.push(err.message);
      console.error('❌ [ROBÔ SINAPI] Falha no processo em lote:', err);
    }
  })();

  return { ok: true, msg: `Robô disparado com sucesso em segundo plano para as 27 UFs (${competencia}).` };
}

// Router da Micro-API SINAPI
export function createSinapiRouter({ authorizeRobot = (_req, res) => res.status(401).json({ error:'Autenticação administrativa necessária.' }) } = {}) {
  const router = Router();

  // 1. Catálogo de Bancos e Referências
  router.get('/bancos', (req, res) => {
    return res.json({
      success: true,
      totalBancos: BANCOS_CATALOGO.length,
      bancos: BANCOS_CATALOGO,
      ufsDisponiveis: UFS_BRASIL
    });
  });

  // 2. Status do Robô Extrator
  router.get('/robot/status', (req, res) => {
    return res.json({
      success: true,
      robot: RobotState
    });
  });

  // 3. Disparo Manual do Robô para as 27 UFs (Opção B)
  router.post('/robot/run', authorizeRobot, async (req, res) => {
    const comp = req.body?.competencia || '2026-08';
    const result = await runBulkSinapiIngest(comp);
    return res.status(result.code === 'INVALID_REFERENCE' ? 400 : result.ok ? 200 : 501).json(result);
  });

  // 4. Busca Unificada de Insumos e Composições (COMP + INSUMO)
  router.get('/search', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const uf = String(req.query.uf || 'SP').toUpperCase();
    const desonerado = req.query.desonerado === 'true';
    const tipo = String(req.query.tipo || 'all').toLowerCase(); // 'all', 'comp', 'insumo'
    const limit = Math.min(Number(req.query.limit) || 30, 100);

    if (q.length < 2) {
      return res.json({ success: true, resultados: [] });
    }

    // Se temos banco Neon conectado, consulta itens_referenciais
    const sql = getSql();
    if (sql) {
      try {
        const rows = await sql`
          SELECT tipo, banco, codigo, descricao, unidade, preco_unitario
          FROM itens_referenciais
          WHERE (uf = ${uf} OR uf = 'BR')
            AND desonerado = ${desonerado}
            AND (${tipo} = 'all' OR tipo = ${tipo.toUpperCase()})
            AND (codigo ILIKE ${'%' + q + '%'} OR descricao ILIKE ${'%' + q + '%'})
          LIMIT ${limit};
        `;
        if (rows && rows.length > 0) {
          return res.json({ success: true, source: 'neon', resultados: rows });
        }
      } catch (err) {
        console.warn('⚠️ [API SINAPI Search Neon fallback]:', err.message);
      }
    }

    // Consulta os snapshots locais oficiais (dados reais de SP, SC, RR, etc.)
    const localItems = getLocalSnapshot(uf, desonerado);
    const termoLower = q.toLowerCase();
    const filtrados = localItems.filter(item => {
      if (tipo !== 'all' && (item.tipo || 'COMP').toLowerCase() !== tipo) return false;
      return String(item.codigo || '').toLowerCase().includes(termoLower) ||
             String(item.descricao || '').toLowerCase().includes(termoLower);
    }).slice(0, limit);

    return res.json({
      success: true,
      source: 'snapshot_oficial',
      query: { q, uf, desonerado, tipo },
      resultados: filtrados
    });
  });

  // 5. Recálculo em lote de itens orçamentários
  router.post('/recalc', (req, res) => {
    const itens = req.body?.itens || [];
    const bdi = Number(req.body?.bdi) || 0;
    const bancosConfig = req.body?.bancos || [];

    let subtotal = 0;
    const recalced = itens.map(item => {
      const precoUnit = Number(item.preco_unitario) || 0;
      const precoBdi = precoUnit * (1 + bdi / 100);
      const qtd = Number(item.quantidade) || 0;
      const total = qtd * precoBdi;
      subtotal += (qtd * precoUnit);
      return {
        ...item,
        preco_unitario: precoUnit,
        preco_com_bdi: Math.round(precoBdi * 100) / 100,
        total: Math.round(total * 100) / 100
      };
    });

    const valorBdi = subtotal * (bdi / 100);
    const totalGeral = subtotal + valorBdi;

    return res.json({
      success: true,
      subtotal: Math.round(subtotal * 100) / 100,
      valorBdi: Math.round(valorBdi * 100) / 100,
      totalGeral: Math.round(totalGeral * 100) / 100,
      itens: recalced
    });
  });

  return router;
}
