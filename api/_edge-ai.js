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

export const OCR_MAX_BYTES = 10 * 1024 * 1024;

function tipoDaImagem(base64) {
  const inicio = Buffer.from(base64.slice(0, 24), 'base64');
  const hex = inicio.toString('hex').toUpperCase();
  if (hex.startsWith('FFD8FF')) return 'image/jpeg';
  if (hex.startsWith('89504E47')) return 'image/png';
  if (hex.startsWith('52494646') && inicio.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return '';
}

function imagemComoDataUrl(entrada) {
  let base64;
  if (Buffer.isBuffer(entrada) || entrada instanceof Uint8Array) {
    if (entrada.length > OCR_MAX_BYTES) throw new Error('Imagem acima do limite de 10 MB.');
    base64 = Buffer.from(entrada).toString('base64');
  } else if (typeof entrada === 'string') {
    const texto = entrada.trim();
    base64 = texto.startsWith('data:') ? texto.slice(texto.indexOf(',') + 1) : texto;
    if (Math.ceil(base64.length * 0.75) > OCR_MAX_BYTES) throw new Error('Imagem acima do limite de 10 MB.');
  } else {
    throw new Error('Formato de imagem não suportado para OCR no Edge.');
  }
  // O tipo vem dos bytes, não do cabeçalho enviado: só JPEG, PNG e WEBP vão para o modelo de visão.
  const tipo = tipoDaImagem(base64);
  if (!tipo) throw new Error('Formato de imagem não suportado para OCR no Edge.');
  return `data:${tipo};base64,${base64}`;
}

/**
 * Realiza OCR e extração estruturada de dados de uma foto de nota ou cupom fiscal.
 */
export async function runEdgeDocumentOcr(env, imageBase64OrBuffer, options = {}) {
  if (!imageBase64OrBuffer) {
    throw new Error('Imagem obrigatória para processamento OCR.');
  }
  // AUDITORIA 2026-10-04 #34: o modelo aceita a imagem como data URL em base64. Antes ela virava
  // um array JS com um número por byte (uma foto de 8 MB ocupava centenas de MB no Worker).
  const imagem = imagemComoDataUrl(imageBase64OrBuffer);

  if (env && env.AI && typeof env.AI.run === 'function') {
    try {
      const prompt = `Analise este comprovante, cupom fiscal, nota fiscal ou boleto de construção civil.
Retorne EXCLUSIVAMENTE um objeto JSON válido no seguinte formato:
{
  "tipo_documento": "comprovante_pix | comprovante_ted | boleto | nfe | nfce | nfse | recibo | cupom_fiscal | outro",
  "fornecedor": "Razão social ou nome do fornecedor/favorecido",
  "razao_social": "Razão social ou nome do fornecedor",
  "cnpj_emitente": "CNPJ formatado ou CPF ou null",
  "data_emissao": "AAAA-MM-DD",
  "data_vencimento": "AAAA-MM-DD ou null",
  "valor": 0.00,
  "valor_total": 0.00,
  "chave_acesso": "Chave NF-e 44 dígitos se visível ou null",
  "numero_documento": "Número da NF ou autenticação se houver ou null",
  "codigo_barras": "Linha digitável se boleto ou null",
  "itens": ["item 1", "item 2"],
  "categoria_sugerida": "Material Bruto | Mão de Obra | Ferramentas | Combustível | Geral",
  "descricao_sugerida": "Resumo objetivo da despesa"
}`;

      const input = {
        image: imagem,
        prompt: prompt,
        max_tokens: 1000
      };

      const result = await env.AI.run(DEFAULT_OCR_MODEL, input);
      const text = result.response || result.text || '';
      
      // Tenta fazer parse do JSON retornado pela IA
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        parsed.valor = typeof parsed.valor === 'number' ? parsed.valor : (parsed.valor_total || null);
        parsed.valor_total = parsed.valor || parsed.valor_total || null;
        parsed.fornecedor = parsed.fornecedor || parsed.razao_social || null;
        parsed.razao_social = parsed.fornecedor;
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

  // AUDITORIA 2026-10-04 #34: sem leitura válida, devolve falha. Antes inventava fornecedor,
  // itens e data de hoje, que podiam virar despesa sem ninguém perceber.
  return {
    success: false,
    error: 'Não foi possível ler o documento. Confira a foto ou preencha os dados manualmente.',
    provider: 'fingo_ocr_indisponivel'
  };
}
