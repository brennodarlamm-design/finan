// trigger/ocr.js — Tarefa de OCR Assíncrono de Alta Capacidade para Documentos Fiscais
import { task, logger } from "@trigger.dev/sdk";
import { neon } from "@neondatabase/serverless";

function getDbClient() {
  const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
  return dbUrl ? neon(dbUrl) : null;
}

const OCR_PROMPT = `Você é um especialista em documentos fiscais e bancários brasileiros. Analise a imagem ou PDF fornecido e extraia as informações relevantes.

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
2. BOLETOS, CONTAS DE CONSUMO (água, luz, gás, telefone) E GUIAS (DAS, GPS, DARF):
   - O campo 'itens' DEVE SER OBRIGATORIAMENTE UM ARRAY VAZIO [].
3. NOTAS FISCAIS (NF-e, NFC-e, NFS-e, DANFE, Cupom Fiscal):
   - Apenas para Notas Fiscais com mercadorias/serviços discriminados, extraia para a lista 'itens' com descrição, quantidade (default 1), unidade (default 'un') e valor unitário.
4. valor = total do documento (numero). Datas ISO YYYY-MM-DD. Não invente dados - use null. Retorne APENAS o JSON.`;

export const asyncFiscalOcr = task({
  id: "async-fiscal-ocr",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 15000,
    factor: 2
  },
  maxDuration: 300, // 5 minutos de limite de execução no Trigger.dev
  run: async (payload) => {
    const { base64, mimeType, tenantId, userId, obraId, documentId } = payload || {};

    if (!base64 || !mimeType) {
      throw new Error("Parâmetros 'base64' e 'mimeType' são obrigatórios para OCR.");
    }

    const geminiApiKey = String(process.env.GEMINI_API_KEY || '').trim();
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY não configurada no ambiente do Trigger.dev.");
    }

    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const cleanMime = mimeType.includes(';') ? mimeType.split(';')[0].toLowerCase().trim() : mimeType.toLowerCase().trim();

    logger.info("Iniciando reconhecimento OCR via Google Gemini no Trigger.dev", {
      tenantId: tenantId || 'desconhecido',
      mimeType: cleanMime,
      tamanhoBytesAprox: Math.ceil(cleanBase64.length * 0.75)
    });

    const models = [
      'gemini-3-flash-preview',
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest'
    ];


    const geminiPayload = {
      contents: [{
        parts: [
          { text: OCR_PROMPT },
          { inline_data: { mime_type: cleanMime, data: cleanBase64 } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json'
      }
    };

    let ocrResult = null;
    let modeloUsado = null;
    let lastError = null;

    for (const model of models) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(45000), // Timeout seguro de 45s por modelo
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
          logger.warn("Tentativa do modelo Gemini falhou:", { model, status: geminiRes.status });
        }
      } catch (errNet) {
        lastError = `[${model}] ${errNet.message}`;
        logger.warn("Exceção na chamada ao Gemini:", { model, error: errNet.message });
      }
    }

    if (!ocrResult) {
      logger.error("Todos os modelos do Gemini falharam na leitura do documento:", { lastError });
      throw new Error(`Falha no reconhecimento OCR: ${lastError || 'Resposta vazia da IA'}`);
    }

    normalizarDadosOCR(ocrResult);

    logger.info("Reconhecimento OCR concluído com sucesso", {
      modelo: modeloUsado,
      tipoDocumento: ocrResult.tipo_documento,
      valor: ocrResult.valor,
      itensCount: ocrResult.itens?.length || 0
    });

    // Se temos tenantId e documentId, salvamos opcionalmente o resultado
    const sql = getDbClient();
    if (sql && tenantId && documentId) {
      try {
        await sql`
          UPDATE documentos_anexos
          SET ocr_status = 'concluido',
              ocr_dados = ${JSON.stringify(ocrResult)}::jsonb,
              updated_at = NOW()
          WHERE tenant_id = ${tenantId} AND id = ${documentId};
        `;
      } catch (errDb) {
        // Tabela ou campo pode ser opcional; loga e não falha o job
        logger.info("Atualização de documentos_anexos ignorada:", { message: errDb.message });
      }
    }

    return {
      ok: true,
      provedor: 'gemini',
      modelo: modeloUsado,
      dados: ocrResult,
      processadoEm: new Date().toISOString()
    };
  }
});

function normalizarDadosOCR(dadosOCR) {
  if (!dadosOCR || typeof dadosOCR !== 'object') return;

  dadosOCR.valor = typeof dadosOCR.valor === 'number' && !isNaN(dadosOCR.valor) ? dadosOCR.valor : null;
  dadosOCR.itens = Array.isArray(dadosOCR.itens) ? dadosOCR.itens : [];
  dadosOCR.confianca = typeof dadosOCR.confianca === 'number' ? Math.min(1, Math.max(0, dadosOCR.confianca)) : 0.5;

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

  if (!isNotaFiscal) {
    dadosOCR.itens = [];
  }
}

function repairJson(str) {
  if (!str || typeof str !== 'string') throw new Error('Conteúdo vazio da IA');

  let s = str.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const firstBrace = s.indexOf('{');
  if (firstBrace > 0) s = s.slice(firstBrace).trim();

  try { return JSON.parse(s); } catch (e) {}

  const lastBrace = s.lastIndexOf('}');
  if (lastBrace > 0 && lastBrace < s.length - 1) {
    try { return JSON.parse(s.slice(0, lastBrace + 1)); } catch (e) {}
  }

  let inString = false;
  let escape = false;
  const stack = [];

  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    if (escape) { escape = false; continue; }
    if (char === '\\') { escape = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (!inString) {
      if (char === '{' || char === '[') stack.push(char);
      else if (char === '}') { if (stack.length > 0 && stack[stack.length - 1] === '{') stack.pop(); }
      else if (char === ']') { if (stack.length > 0 && stack[stack.length - 1] === '[') stack.pop(); }
    }
  }

  if (inString) s += '"';
  s = s.trim().replace(/,\s*$/, '');
  while (stack.length > 0) {
    const last = stack.pop();
    if (last === '{') s += '}';
    else if (last === '[') s += ']';
  }

  return JSON.parse(s);
}
