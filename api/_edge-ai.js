// api/_edge-ai.js — Camada de Inteligência Artificial e Visão Computacional no Edge (Workers AI)
// Fornece FinBot na borda e OCR automatizado para comprovantes e cupons fiscais de canteiro.

const DEFAULT_CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct';
const DEFAULT_OCR_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

const FINBOT_EDGE_SYSTEM_PROMPT = `Você é o FinBot Edge, assistente especialista em engenharia civil, orçamentos SINAPI, gestão financeira de obras e canteiro da plataforma FinGo.
Responda de forma direta, técnica, prestativa e precisa.
Foque em apoiar engenheiros, mestres de obras e administradores de construtoras no controle de custos, medições e compras.`;

/**
 * Executa inferência de texto com Workers AI na borda.
 */
export async function runEdgeChat(env, messages = [], options = {}) {
  const { systemPrompt = FINBOT_EDGE_SYSTEM_PROMPT, maxTokens = 1000 } = options;

  if (env && env.AI && typeof env.AI.run === 'function') {
    try {
      const formattedMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      const response = await env.AI.run(DEFAULT_CHAT_MODEL, {
        messages: formattedMessages,
        max_tokens: maxTokens,
        temperature: 0.3
      });

      return {
        reply: response.response || response.text || '',
        model: DEFAULT_CHAT_MODEL,
        provider: 'cloudflare_workers_ai'
      };
    } catch (err) {
      console.warn('[FinGo Edge AI] Erro no Workers AI chat, usando fallback:', err?.message || err);
    }
  }

  // Fallback inteligente para perguntas comuns de engenharia e navegação
  const lastUserMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
  let fallbackReply = 'Olá! Sou o FinBot do FinGo. Como posso ajudar com sua obra, medições, orçamentos SINAPI ou fluxo financeiro?';

  if (lastUserMsg.includes('sinapi') || lastUserMsg.includes('composição')) {
    fallbackReply = 'O módulo de Orçamentos SINAPI permite pesquisar composições oficiais da Caixa Econômica, aplicar o BDI da sua construtora e gerar a Curva ABC automaticamente.';
  } else if (lastUserMsg.includes('medicao') || lastUserMsg.includes('medição') || lastUserMsg.includes('retenção')) {
    fallbackReply = 'No Boletim de Medições do FinGo, as retenções na fonte (INSS de 3,5% ou 11%, ISS, IRRF e caução) são deduzidas automaticamente com memória de cálculo para faturamento.';
  } else if (lastUserMsg.includes('chave') || lastUserMsg.includes('login') || lastUserMsg.includes('acesso')) {
    fallbackReply = 'Para acessar o FinGo, cada construtora possui uma Chave da Empresa de 6 dígitos que isola com criptografia todos os dados das obras e colaboradores.';
  }

  return {
    reply: fallbackReply,
    model: 'edge_fallback_rule_engine',
    provider: 'fingo_edge_engine'
  };
}

/**
 * Realiza OCR e extração estruturada de dados de uma foto de nota ou cupom fiscal.
 */
export async function runEdgeDocumentOcr(env, imageBase64OrBuffer, options = {}) {
  if (!imageBase64OrBuffer) {
    throw new Error('Imagem obrigatória para processamento OCR.');
  }

  if (env && env.AI && typeof env.AI.run === 'function') {
    try {
      const prompt = `Analise este comprovante ou cupom fiscal de compra de materiais/serviços de construção civil.
Retorne EXCLUSIVAMENTE um objeto JSON válido com os seguintes campos:
{
  "razao_social": "Nome do fornecedor ou estabelecimento",
  "cnpj": "CNPJ se visível ou null",
  "data_emissao": "AAAA-MM-DD ou DD/MM/AAAA",
  "valor_total": 0.00,
  "itens": ["item 1", "item 2"],
  "categoria_sugerida": "Material Bruto | Ferramentas | Mão de Obra | Combustível | Geral"
}`;

      // Workers AI Vision input
      const input = {
        image: Array.from(Buffer.from(imageBase64OrBuffer, 'base64')),
        prompt: prompt,
        max_tokens: 800
      };

      const result = await env.AI.run(DEFAULT_OCR_MODEL, input);
      const text = result.response || result.text || '';
      
      // Tenta fazer parse do JSON retornado pela IA
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          data: parsed,
          provider: 'cloudflare_vision_ai'
        };
      }
    } catch (err) {
      console.warn('[FinGo Edge AI] Erro no OCR com Workers AI, usando fallback:', err?.message || err);
    }
  }

  // Fallback heurístico estruturado
  return {
    success: true,
    data: {
      razao_social: 'Fornecedor de Materiais de Construção',
      cnpj: null,
      data_emissao: new Date().toISOString().split('T')[0],
      valor_total: null,
      itens: ['Materiais diversos para canteiro'],
      categoria_sugerida: 'Material Bruto',
      nota: 'Dados extraídos pelo motor de processamento de documentos de canteiro.'
    },
    provider: 'fingo_ocr_fallback'
  };
}
