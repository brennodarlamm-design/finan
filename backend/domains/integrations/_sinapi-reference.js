// api/_sinapi-reference.js — Consulta única à base SINAPI importada no Neon.
//
// AUDIT-2026-10-02 F7: os endpoints de SINAPI consultavam a tabela `sinapi_itens`,
// que não existe em nenhuma migration/schema. A base real é gravada pelo robô em
// `itens_referenciais` (banco, uf, referencia, desonerado, tipo, codigo, descricao,
// unidade, preco_unitario). Quando a consulta falhava, as rotas devolviam um
// catálogo fixo de poucos itens (preços de SP/2026-08) para qualquer UF e competência,
// rotulado como oficial. Este módulo centraliza
// a consulta correta e NUNCA devolve preços fictícios.

export const UFS_SINAPI = Object.freeze([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
]);

export function normalizeSinapiParams(input = {}) {
  const rawUf = String(input.uf || input.estado || 'SP').trim().toUpperCase();
  const uf = UFS_SINAPI.includes(rawUf) ? rawUf : 'SP';
  const rawRef = String(input.referencia || input.competencia || '').trim();
  const referencia = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawRef) ? rawRef : null;
  const rawDes = String(input.desonerado ?? '').trim().toLowerCase();
  const desonerado = rawDes === '' ? null : ['1', 'true', 'sim', 'des', 'desonerado'].includes(rawDes);
  const termo = String(input.q || input.busca || input.termo || '').trim().slice(0, 120);
  const limit = Math.max(1, Math.min(1000, Number(input.limit) || 200));
  return { uf, referencia, desonerado, termo, limit };
}

/**
 * Retorna itens SINAPI da base importada. Se `referencia` não vier, usa a
 * competência mais recente disponível para a UF/regime.
 * Lança erro em falha de banco — o chamador decide como sinalizar indisponibilidade.
 */
export async function querySinapiReferencia(sql, params = {}) {
  const { uf, desonerado, termo, limit } = normalizeSinapiParams(params);
  let { referencia } = normalizeSinapiParams(params);

  if (!referencia) {
    const latest = await sql`
      SELECT MAX(referencia) AS referencia
      FROM itens_referenciais
      WHERE banco = 'SINAPI' AND uf = ${uf}
        AND (${desonerado}::boolean IS NULL OR desonerado = ${desonerado});
    `;
    referencia = latest?.[0]?.referencia || null;
    if (!referencia) return { uf, referencia: null, desonerado, termo, items: [] };
  }

  const like = termo ? `%${termo}%` : null;
  const rows = await sql`
    SELECT codigo, descricao, unidade, preco_unitario, tipo, desonerado, referencia, uf
    FROM itens_referenciais
    WHERE banco = 'SINAPI'
      AND uf = ${uf}
      AND referencia = ${referencia}
      AND (${desonerado}::boolean IS NULL OR desonerado = ${desonerado})
      AND (${like}::text IS NULL OR descricao ILIKE ${like} OR codigo ILIKE ${like})
    ORDER BY codigo ASC
    LIMIT ${limit};
  `;

  const items = (rows || []).map(r => ({
    codigo: String(r.codigo),
    descricao: String(r.descricao),
    unidade: String(r.unidade || 'UN'),
    preco: Number(r.preco_unitario || 0),
    tipo: r.tipo || null,
    desonerado: Boolean(r.desonerado),
    referencia: r.referencia,
    uf: r.uf
  }));

  return { uf, referencia, desonerado, termo, items };
}
