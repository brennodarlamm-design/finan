// api/reconhecer-documento.js — Robô de Reconhecimento de Documentos Fiscais
// Recebe PDF/imagem em base64, envia ao Google Gemini Vision e retorna dados estruturados

import { resolveAuthAndTenant } from './_auth.js';
import { checkRateLimit, getClientIp } from './_ratelimit.js';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '4.5mb'
    }
  }
};

const ALLOWED_ORIGINS = [
  'https://finobra.app.br',
  'https://www.finobra.app.br',
  'http://localhost:3000',
  'http://localhost:3333',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3333',
  'http://127.0.0.1:5000'
];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app');
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-api-key, x-tenant-id, X-Requested-With');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({ error: auth.error || 'Acesso não autorizado. Forneça o token de autenticação.' });
  }

  // Rate Limiting para proteção contra abuso de custos no Gemini OCR
  const tenantKey = auth.tenantId || getClientIp(req);
  const rl = checkRateLimit(`ocr:${tenantKey}`, 30, 600000); // 30 requisições a cada 10 min por tenant
  if (!rl.allowed) {
    return res.status(429).json({
      error: 'Limite de processamento OCR atingido para este período (máximo 30 a cada 10 minutos). Aguarde para enviar mais documentos.'
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
  }

  const { base64, mimeType } = req.body || {};
  if (!base64 || !mimeType) {
    return res.status(400).json({ error: 'Campos "base64" e "mimeType" são obrigatórios.' });
  }

  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const cleanMime   = mimeType.includes(';') ? mimeType.split(';')[0] : mimeType;

  const prompt = `Você é um especialista em documentos fiscais e bancários brasileiros. Analise a imagem ou PDF fornecido e extraia as informações relevantes.

Retorne APENAS um objeto JSON válido (sem markdown, sem explicações) com os seguintes campos:

{
  "tipo_documento": "comprovante_pix | comprovante_ted | comprovante_transferencia | comprovante | boleto | nfe | nfce | nfse | conta_energia | conta_agua | conta_gas | conta_telefone | das | gps | darf | recibo | orcamento | outro",
  "fornecedor": "Nome completo do emitente/fornecedor/credor ou favorecido da transferência",
  "cnpj_emitente": "CNPJ formatado xx.xxx.xxx/xxxx-xx ou CPF formatado ou null",
  "valor": numero decimal (ex: 3850.00) ou null,
  "data_emissao": "YYYY-MM-DD ou null",
  "data_vencimento": "YYYY-MM-DD ou null",
  "codigo_barras": "Linha digitável completa ou null",
  "chave_pix": "Chave Pix se houver ou null",
  "numero_documento": "Número da NF, autenticação do comprovante ou documento ou null",
  "chave_acesso": "Chave de acesso NF-e 44 dígitos ou null",
  "descricao_sugerida": "Descrição curta e clara do que é este documento (max 80 chars)",
  "categoria_sugerida": "material | mao_de_obra | servico | equipamento | taxa | energia | agua | internet_tel | imposto_simples | tributos_trabalhistas | salario | aluguel_sede | contabilidade | software_ti | material_escritorio | outro",
  "tipo_lancamento": "despesa | receita",
  "observacoes": "Observações relevantes adicionais ou null",
  "itens": [
    {
      "produto": "Descrição do produto/serviço",
      "qtd": numero decimal,
      "unidade": "sc | kg | m2 | m3 | un | cx | pc | hr | m | l | t",
      "valor_unit": numero decimal
    }
  ],
  "confianca": numero de 0 a 1 indicando confiança na leitura
}

REGRAS CRÍTICAS PARA 'itens' E 'tipo_documento':
1. COMPROVANTES BANCÁRIOS (PIX, TED, DOC, transferência bancária, comprovante de pagamento ou agendamento):
   - tipo_documento DEVE ser 'comprovante_pix', 'comprovante_ted' ou 'comprovante_transferencia'.
   - O campo 'itens' DEVE SER OBRIGATORIAMENTE UM ARRAY VAZIO []!
   - NUNCA extraia produtos nem preencha 'itens' para comprovantes bancários. O motivo, mensagem ou favorecido da transferência NÃO é um produto.
2. BOLETOS, CONTAS DE CONSUMO (água, luz, gás, telefone) E GUIAS (DAS, GPS, DARF):
   - O campo 'itens' DEVE SER OBRIGATORIAMENTE UM ARRAY VAZIO [].
3. NOTAS FISCAIS (NF-e, NFC-e, NFS-e, DANFE, Cupom Fiscal):
   - Apenas para Notas Fiscais com mercadorias/serviços discriminados, extraia para a lista 'itens' com descrição, quantidade (default 1), unidade (default 'un') e valor unitário.
4. valor = total do documento (numero). Datas ISO YYYY-MM-DD. Não invente dados - use null. Retorne APENAS o JSON.`;

  try {
    // Modelos atuais. Mantemos aliases/estáveis recentes em ordem de preferência.
    const models = [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest'
    ];

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: cleanMime, data: cleanBase64 } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json'
      }
    };

    let geminiData = null;
    let lastError = null;

    for (const model of models) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify(payload)
        });

        if (geminiRes.ok) {
          geminiData = await geminiRes.json();
          break;
        } else {
          const errTxt = await geminiRes.text();
          lastError = `[${model}] HTTP ${geminiRes.status}: ${errTxt.slice(0, 150)}`;
          console.warn('[OCR] Tentativa falhou com modelo', model, geminiRes.status);
        }
      } catch (errNet) {
        lastError = `[${model}] ${errNet.message}`;
        console.warn('[OCR] Tentativa falhou com modelo', model, errNet.message);
      }
    }

    if (!geminiData) {
      console.error('[OCR] Todos os modelos Gemini falharam:', lastError);
      return res.status(502).json({ error: 'Erro na API do Gemini Vision', detalhe: lastError });
    }

    // Extrai o texto de todos os parts da resposta
    const parts = geminiData?.candidates?.[0]?.content?.parts || [];
    let rawText = '';
    for (const part of parts) {
      if (part.text) rawText += part.text;
    }
    rawText = rawText.trim();

    let dadosOCR;
    try {
      dadosOCR = repairJson(rawText);
    } catch (parseErr) {
      console.error('[OCR] Falha ao parsear JSON do Gemini:', rawText);
      return res.status(422).json({ error: 'Não foi possível interpretar a resposta da IA.', rawResponse: rawText.slice(0, 500) });
    }

    dadosOCR.valor     = typeof dadosOCR.valor === 'number' && !isNaN(dadosOCR.valor) ? dadosOCR.valor : null;
    dadosOCR.itens     = Array.isArray(dadosOCR.itens) ? dadosOCR.itens : [];
    dadosOCR.confianca = typeof dadosOCR.confianca === 'number' ? Math.min(1, Math.max(0, dadosOCR.confianca)) : 0.5;

    // Normalização rigorosa de Comprovantes Bancários
    const tipoDoc = (dadosOCR.tipo_documento || '').toLowerCase();
    const descLower = (dadosOCR.descricao_sugerida || '').toLowerCase();
    const obsLower = (dadosOCR.observacoes || '').toLowerCase();

    if (/pix/i.test(descLower) || /pix/i.test(obsLower) || tipoDoc.includes('pix')) {
      dadosOCR.tipo_documento = 'comprovante_pix';
    } else if (/ted\b|doc\b|transfer[êe]ncia/i.test(descLower) || /ted\b|doc\b|transfer[êe]ncia/i.test(obsLower) || tipoDoc.includes('ted') || tipoDoc.includes('transf')) {
      dadosOCR.tipo_documento = 'comprovante_ted';
    } else if (/comprovante/i.test(descLower) || /comprovante/i.test(obsLower) || tipoDoc.includes('comprovante')) {
      dadosOCR.tipo_documento = 'comprovante';
    }

    const tipoFinal = (dadosOCR.tipo_documento || '').toLowerCase();
    const isNotaFiscal = ['nfe', 'nfce', 'nfse', 'danfe', 'cupom_fiscal'].includes(tipoFinal)
      || Boolean(dadosOCR.chave_acesso && String(dadosOCR.chave_acesso).replace(/\D/g, '').length >= 44);

    // Se NÃO for nota fiscal, 'itens' DEVE ser vazio (especialmente para PIX, TED, boletos e contas)
    if (!isNotaFiscal) {
      dadosOCR.itens = [];
    }

    return res.status(200).json({ ok: true, dados: dadosOCR });

  } catch (err) {
    console.error('[OCR] Erro inesperado:', err);
    return res.status(500).json({ error: 'Erro interno ao processar o documento.', detalhe: err.message });
  }
}

function repairJson(str) {
  if (!str || typeof str !== 'string') {
    throw new Error('Conteúdo vazio da IA');
  }

  let s = str.trim();

  // Remove markdown code fences se houver
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Se houver texto introdutório antes do primeiro '{', descarta
  const firstBrace = s.indexOf('{');
  if (firstBrace > 0) {
    s = s.slice(firstBrace).trim();
  }

  // Tenta parse direto primeiro
  try {
    return JSON.parse(s);
  } catch (initialErr) {
    // Prossegue para reparo estrutural
  }

  // Se houver caracteres espúrios após a última chave '}', tenta cortar
  const lastBrace = s.lastIndexOf('}');
  if (lastBrace > 0 && lastBrace < s.length - 1) {
    try {
      return JSON.parse(s.slice(0, lastBrace + 1));
    } catch (e) {}
  }

  // Reparação de colchetes, chaves e aspas abertas (típico de respostas truncadas)
  let inString = false;
  let escape = false;
  const stack = [];

  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack.length > 0 && stack[stack.length - 1] === '{') stack.pop();
      } else if (char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === '[') stack.pop();
      }
    }
  }

  // Se ficou com string aberta, fecha aspas
  if (inString) s += '"';

  // Remove vírgulas órfãs no final
  s = s.trim().replace(/,\s*$/, '');

  // Fecha todos os colchetes e chaves pendentes
  while (stack.length > 0) {
    const last = stack.pop();
    if (last === '{') s += '}';
    else if (last === '[') s += ']';
  }

  return JSON.parse(s);
}

