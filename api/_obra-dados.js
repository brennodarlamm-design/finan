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

const CAMPOS_TECNICOS = new Set(['id', 'tenant_id', 'dados', 'created_at', 'updated_at', 'sync_version', 'xmin', 'cloud_id', 'client_mutation_id']);

/** Campos do cadastro da obra que não têm coluna própria, prontos para `obras.dados`. */
export function dadosExtrasDaObra(obra) {
  return extrairExtras(obra, COLUNAS_PROPRIAS);
}

function extrairExtras(registro, excluidos) {
  const out = {};
  if (!registro || typeof registro !== 'object') return out;
  for (const [k, v] of Object.entries(registro)) {
    if (excluidos.has(k) || CAMPOS_TECNICOS.has(k) || k.startsWith('_') || !/^[a-zA-Z0-9_]{1,64}$/.test(k)) continue;
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

// ── Lançamentos ──────────────────────────────────────────────────────────────────────────────
// Campos do lançamento sem coluna própria que o app grava e usa depois (origem no formulário e
// nos relatórios, competência do escritório, vínculos com medição/pré-compra para exclusão em
// cascata e checagem de duplicidade, parcela da NF-e). Lista explícita: só o que tem uso real.
const CAMPOS_EXTRAS_LANCAMENTO = [
  'origem', 'competencia', 'medicao_id', 'precompra_id', 'numero_parcela', 'total_parcelas',
  'grupo_parcelamento_id', 'orcamento_id', 'categoria_obra', 'centro_custo', 'retencao_de',
  // Baixa parcial: o título guarda o valor total e cada pagamento parcial aponta para ele.
  'valor_original', 'baixa_de'
];

/** Campos extras do lançamento, prontos para `lancamentos.dados` (migração 046). */
export function dadosExtrasDoLancamento(l) {
  const out = {};
  if (!l || typeof l !== 'object') return out;
  for (const k of CAMPOS_EXTRAS_LANCAMENTO) {
    if (!(k in l)) continue;
    const s = valorSeguro(l[k]);
    if (s !== undefined && (typeof s !== 'object' || s === null)) out[k] = s;
  }
  return out;
}

// ── Demais tabelas sem payload jsonb ─────────────────────────────────────────────────────────
// Mesmo problema das obras (varredura de 07/10): campos do formulário sem coluna própria nunca iam
// para o banco e a sincronização os apagava. Tudo o que não é coluna (nem apelido de coluna usado
// pelo app) vai para `<tabela>.dados` (migração 046).
const COLUNAS_POR_TABELA = {
  fornecedores: ['nome', 'razao_social', 'cnpj_cpf', 'cnpj', 'telefone', 'email', 'categoria', 'chave_pix',
    'banco_info', 'endereco', 'municipio', 'uf', 'ativo'],
  produtos: ['nome', 'unidade', 'categoria', 'codigo', 'valor_medio', 'observacoes'],
  orcamentos: ['obra_id', 'titulo', 'nome', 'valor_total', 'valor_total_previsto', 'itens', 'etapas',
    'categorias', 'itens_json', 'status', 'descricao', 'data_criacao'],
  documentos: ['tipo', 'referencia_id', 'titulo', 'categoria', 'nome_arquivo', 'tipo_arquivo', 'tamanho_bytes',
    'base64_data', 'url', 'entidade_tipo', 'entidade_id', 'tipo_mime', 'tamanho', 'data_base64', 'base64',
    'conteudo_base64', 'criado_em']
};

/** Campos sem coluna própria de um registro de `tabela`, prontos para `<tabela>.dados`. */
export function dadosExtras(tabela, registro) {
  return extrairExtras(registro, new Set(COLUNAS_POR_TABELA[tabela] || []));
}
