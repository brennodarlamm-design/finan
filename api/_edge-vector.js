// api/_edge-vector.js — Busca Semântica e Indexação Vetorial no Edge (Vectorize + Workers AI)
// Permite buscar insumos e composições SINAPI por linguagem natural (ex: "muro de arrimo com blocos").

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

/**
 * Calcula a similaridade de cosseno entre dois vetores.
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Gera embeddings vetoriais para um termo de busca no Workers AI.
 */
export async function generateTextEmbedding(env, text) {
  if (!text) return [];

  if (env && env.AI && typeof env.AI.run === 'function') {
    try {
      const response = await env.AI.run(EMBEDDING_MODEL, {
        text: [String(text).trim()]
      });
      if (response && response.data && response.data[0]) {
        return response.data[0];
      }
    } catch (err) {
      console.warn('[FinGo Edge Vector] Erro gerando embeddings no Workers AI:', err?.message || err);
    }
  }

  // Fallback determinístico de embedding baseado em hash de termos
  const clean = String(text).toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const tokens = clean.split(/\s+/).filter(Boolean);
  const vector = new Array(32).fill(0);
  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash << 5) - hash + token.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % 32;
    vector[idx] += 1;
  }
  const norm = Math.sqrt(vector.reduce((a, b) => a + b * b, 0)) || 1;
  return vector.map(v => v / norm);
}

/**
 * Executa busca semântica no catálogo SINAPI / engenharia.
 */
export async function searchSemanticSinapi(env, query, catalogItems = [], options = {}) {
  const { topK = 10, threshold = 0.3 } = options;
  if (!query) return [];

  // 1. Se o binding do Cloudflare Vectorize estiver disponível
  if (env && env.SINAPI_INDEX && typeof env.SINAPI_INDEX.query === 'function') {
    try {
      const queryVector = await generateTextEmbedding(env, query);
      const matches = await env.SINAPI_INDEX.query(queryVector, { topK, returnMetadata: true });
      if (matches && matches.matches) {
        return matches.matches.map(m => ({
          id: m.id,
          score: m.score,
          ...m.metadata
        }));
      }
    } catch (err) {
      console.warn('[FinGo Edge Vector] Erro no Vectorize remoto, usando busca local:', err?.message || err);
    }
  }

  // 2. Busca semântica local / por relevância de termos em memória
  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = catalogItems.map(item => {
    const text = `${item.codigo || ''} ${item.descricao || ''} ${item.unidade || ''} ${item.grupo || ''}`.toLowerCase();
    let matchesCount = 0;
    for (const term of queryTerms) {
      if (text.includes(term)) matchesCount++;
    }
    const score = queryTerms.length > 0 ? matchesCount / queryTerms.length : 0;
    return { item, score };
  });

  return scored
    .filter(s => s.score >= threshold || s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => ({
      ...s.item,
      relevance_score: Number(s.score.toFixed(2))
    }));
}
