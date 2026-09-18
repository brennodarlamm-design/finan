// api/reconhecer-documento.js — Robô de Reconhecimento de Documentos Fiscais
// Recebe PDF/imagem em base64, envia ao Google Gemini Vision e retorna dados estruturados

import { resolveAuthAndTenant } from './_auth.js';
import { checkRateLimit, getClientIp } from './_ratelimit.js';
import { canUseFeature, planError } from './_plans.js';
import { canWriteData, canAccessModule, permissionError } from './_permissions.js';
import { triggerOcr, isTriggerConfigured } from './_trigger-client.js';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '4.5mb'
    }
  }
};

const ALLOWED_ORIGINS = [
  'https://fingo.api.br',
  'https://www.fingo.api.br',
  'http://localhost:3000',
  'http://localhost:3333',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3333',
  'http://127.0.0.1:5000'
];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || /^https:\/\/finan-as(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin);
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-api-key, x-tenant-id, X-Requested-With');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({ error: auth.error || 'Acesso não autorizado. Forneça o token de autenticação.' });
  }

  if (!canWriteData(auth)) {
    return res.status(403).json(permissionError('ROLE_READ_ONLY'));
  }

  if (!canAccessModule(auth, 'notas', 'write')) return res.status(403).json(permissionError('MODULE_WRITE_FORBIDDEN','notas'));

  if (!auth.isSystem && auth.user?.perfil !== 'superadmin' && !canUseFeature(auth.user?.tenantPlan, 'ocr')) {
    return res.status(403).json(planError('ocr', auth.user?.tenantPlan));
  }

  // Proteção Multi-Camada contra Abuso de Custos e DoS no OCR
  const clientIp = getClientIp(req);
  const userKey = auth.user?.userId || clientIp;
  const userRl = await checkRateLimit(`ocr:user:${userKey}`, 10, 300000); // Max 10 requisições a cada 5 min por usuário/IP
  if (!userRl.allowed) {
    return res.status(429).json({
      error: 'Limite individual de leituras OCR atingido (máximo 10 a cada 5 minutos). Aguarde para tentar novamente.'
    });
  }

  const tenantKey = auth.tenantId || clientIp;
  const rl = await checkRateLimit(`ocr:tenant:${tenantKey}`, 30, 600000); // Max 30 requisições a cada 10 min por tenant
  if (!rl.allowed) {
    return res.status(429).json({
      error: 'Limite de processamento OCR do tenant atingido (máximo 30 a cada 10 minutos). Aguarde para enviar mais documentos.'
    });
  }

  const geminiApiKey = String(process.env.GEMINI_API_KEY || '').trim();

  if (!geminiApiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
  }

  const { base64, mimeType } = req.body || {};
  if (!base64 || !mimeType) {
    return res.status(400).json({ error: 'Campos "base64" e "mimeType" são obrigatórios.' });
  }

  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const cleanMime   = mimeType.includes(';') ? mimeType.split(';')[0].toLowerCase().trim() : mimeType.toLowerCase().trim();

  // Fail-early check por tamanho max de 10MB no payload base64
  const approxBytes = Math.ceil(cleanBase64.length * 0.75);
  if (approxBytes > 10 * 1024 * 1024) {
    return res.status(413).json({ error: 'Arquivo excede o limite máximo de 10 MB para leitura OCR.' });
  }

  const buffer = Buffer.from(cleanBase64, 'base64');
  if (buffer.length > 10 * 1024 * 1024) {
    return res.status(413).json({ error: 'Arquivo excede o limite máximo de 10 MB para leitura OCR.' });
  }

  // Validação estrita de Magic Bytes (Somente PDF, JPEG, PNG, WEBP)
  const magicHex = buffer.slice(0, 8).toString('hex').toUpperCase();
  const isPdf  = magicHex.startsWith('25504446');
  const isPng  = magicHex.startsWith('89504E47');
  const isJpg  = magicHex.startsWith('FFD8FF');
  const isWebp = magicHex.startsWith('52494646') && buffer.length >= 12 && buffer.slice(8, 12).toString('ascii') === 'WEBP';

  if (!isPdf && !isPng && !isJpg && !isWebp) {
    return res.status(400).json({
      error: 'Assinatura binária do documento inválida. O OCR aceita estritamente arquivos PDF e imagens JPEG, PNG ou WEBP.'
    });
  }

  // Desvio para processamento assíncrono em background via Trigger.dev (elimina timeout de 10s da Vercel Hobby)
  if (req.body?.async === true || req.body?.modo === 'async') {
    if (isTriggerConfigured()) {
      try {
        const trigJob = await triggerOcr({
          base64: cleanBase64,
          mimeType: cleanMime,
          tenantId: auth.tenantId,
          userId: auth.user?.userId,
          obraId: req.body?.obraId || null,
          documentId: req.body?.documentId || null
        });

        if (trigJob.success) {
          return res.status(202).json({
            ok: true,
            queued: true,
            runId: trigJob.runId,
            message: 'Documento enfileirado para processamento assíncrono via Trigger.dev.'
          });
        }
      } catch (trigErr) {
        console.warn('[OCR] Falha ao despachar para Trigger.dev, prosseguindo com execução síncrona:', trigErr.message);
      }
    }
  }

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
    let ocrResult = null;
    let modeloUsado = null;
    let lastError = null;

    // Fluxo sem OpenAI: restaura a família Gemini usada antes da integração ChatGPT.
    const models = [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest'
    ];

    const geminiPayload = {
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

    for (const model of models) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify(geminiPayload)
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const parts = geminiData?.candidates?.[0]?.content?.parts || [];
          let rawText = '';
          for (const part of parts) {
            if (part.text) rawText += part.text;
          }
          rawText = rawText.trim();
          if (rawText) {
            ocrResult = repairJson(rawText);
            modeloUsado = model;
            break;
          }
        } else {
          const errTxt = await geminiRes.text();
          lastError = `[${model}] HTTP ${geminiRes.status}: ${errTxt.slice(0, 150)}`;
          console.warn('[OCR] Tentativa Gemini falhou:', model, geminiRes.status);
        }
      } catch (errNetGemini) {
        lastError = `[${model}] ${errNetGemini.message}`;
        console.warn('[OCR] Tentativa Gemini falhou:', model, errNetGemini.message);
      }
    }

    if (!ocrResult) {
      console.error('[OCR] Todos os modelos Gemini falharam:', lastError);
      return res.status(502).json({
        error: 'O reconhecimento de documentos está temporariamente indisponível. Tente novamente.'
      });
    }

    normalizarDadosOCR(ocrResult);

    return res.status(200).json({
      ok: true,
      provedor: 'gemini',
      modelo: modeloUsado,
      dados: ocrResult
    });

  } catch (err) {
    console.error('[OCR] Erro inesperado:', err);
    return res.status(500).json({ error: 'Erro interno ao processar o documento.' });
  }
}

function normalizarDadosOCR(dadosOCR) {
  if (!dadosOCR || typeof dadosOCR !== 'object') return;

  dadosOCR.valor     = typeof dadosOCR.valor === 'number' && !isNaN(dadosOCR.valor) ? dadosOCR.valor : null;
  dadosOCR.itens     = Array.isArray(dadosOCR.itens) ? dadosOCR.itens : [];
  dadosOCR.confianca = typeof dadosOCR.confianca === 'number' ? Math.min(1, Math.max(0, dadosOCR.confianca)) : 0.5;

  // Normalização rigorosa de Comprovantes Bancários
  const tipoDoc   = (dadosOCR.tipo_documento || '').toLowerCase();
  const descLower = (dadosOCR.descricao_sugerida || '').toLowerCase();
  const obsLower  = (dadosOCR.observacoes || '').toLowerCase();

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

