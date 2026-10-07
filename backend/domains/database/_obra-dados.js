// api/_obra-dados.js — Cadastro completo da obra (campos que não têm coluna própria em `obras`).
//
// A tabela `obras` só tem nome, cliente, endereço, orçamento, status e datas. O formulário da obra
// tem muito mais (modalidade, valor financiado, entrada, área, CPF/CNPJ, cidade/UF, contrato Caixa,
// telefone, responsável...), e esses campos nunca iam para o banco: ficavam só no navegador de quem
// digitou e sumiam na sincronização seguinte. Agora vão para `obras.dados` (jsonb, migração 045).

const COLUNAS_PROPRIAS = new Set([
  'id', 'tenant_id', 'nome', 'cliente', 'endereco', 'orcamento_total', 'status', 'data_inicio',
  'data_previsao', 'cronograma_config', 'bdi_config', 'dados', 'created_at', 'updated_at',
  'sync_version', 'xmin', 'cloud_id', 'processos_sla', 'client_mutation_id'
]);
const MAX_BYTES = 32 * 1024;
const MAX_TEXTO = 2000;

function valorSeguro(v, profundidade = 0) {
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') return v.slice(0, MAX_TEXTO);
  if (profundidade >= 2) return undefined;
  if (Array.isArray(v)) return v.slice(0, 50).map(x => valorSeguro(x, profundidade + 1)).filter(x => x !== undefined);
  if (typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v).slice(0, 50)) {
      const s = valorSeguro(x, profundidade + 1);
      if (s !== undefined) out[String(k).slice(0, 64)] = s;
    }
    return out;
  }
  return undefined;
}

/** Campos do cadastro da obra que não têm coluna própria, prontos para `obras.dados`. */
export function dadosExtrasDaObra(obra) {
  const out = {};
  if (!obra || typeof obra !== 'object') return out;
  for (const [k, v] of Object.entries(obra)) {
    if (COLUNAS_PROPRIAS.has(k) || k.startsWith('_') || !/^[a-zA-Z0-9_]{1,64}$/.test(k)) continue;
    // Arquivos em base64 não pertencem ao cadastro (têm o próprio armazenamento).
    if (typeof v === 'string' && v.length > 1000 && /^data:|^[A-Za-z0-9+/=\s]{1000,}$/.test(v)) continue;
    const s = valorSeguro(v);
    if (s !== undefined) out[k] = s;
  }
  let json = JSON.stringify(out);
  if (json.length > MAX_BYTES) {
    // Corta os campos maiores até caber; o cadastro em si é pequeno.
    for (const k of Object.keys(out).sort((a, b) => JSON.stringify(out[b]).length - JSON.stringify(out[a]).length)) {
      delete out[k];
      json = JSON.stringify(out);
      if (json.length <= MAX_BYTES) break;
    }
  }
  return out;
}
