// api/_ai-key-pool.js — Gerenciador Inteligente de Pool de Chaves com Rotação, Cooldown e Fallback
// Garante uso contínuo das cotas gratuitas (Gemini Free Tier) sem cobrança e com alta disponibilidade.

/**
 * Estado interno do pool de chaves em memória no Worker/Processo.
 */
const keyStates = new Map();
let currentKeyIndex = 0;

/**
 * Obtém a lista deduplicada de chaves do Gemini a partir do ambiente.
 */
function getGeminiKeys() {
  const rawList = String(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').trim();
  if (!rawList) return [];

  const keys = rawList
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 10);

  return [...new Set(keys)];
}

/**
 * Obtém o estado de uma chave específica ou inicializa.
 */
function getKeyState(key) {
  if (!keyStates.has(key)) {
    keyStates.set(key, {
      key,
      masked: `${key.slice(0, 6)}...${key.slice(-4)}`,
      cooldownUntil: 0,
      failures: 0,
      successes: 0
    });
  }
  return keyStates.get(key);
}

/**
 * Seleciona a próxima chave disponível utilizando Round-Robin entre chaves ativas.
 */
function selectNextAvailableKey(keys) {
  const now = Date.now();
  const total = keys.length;

  for (let i = 0; i < total; i++) {
    const idx = (currentKeyIndex + i) % total;
    const candidate = keys[idx];
    const state = getKeyState(candidate);

    if (state.cooldownUntil <= now) {
      currentKeyIndex = (idx + 1) % total;
      return state;
    }
  }

  return null; // Todas as chaves estão em cooldown
}

/**
 * Marca uma chave em cooldown ao detectar limite de cota (HTTP 429 ou Quota Exceeded).
 */
function markKeyCooldown(key, reason = 'Rate Limit / Quota Exceeded', cooldownMinutes = 60) {
  const state = getKeyState(key);
  state.cooldownUntil = Date.now() + cooldownMinutes * 60 * 1000;
  state.failures++;
  console.warn(`⚠️ [FinBot Key Pool] Chave ${state.masked} entrou em cooldown por ${cooldownMinutes} min. Motivo: ${reason}`);
}

/**
 * Registra sucesso na execução da chave.
 */
function markKeySuccess(key) {
  const state = getKeyState(key);
  state.successes++;
  state.failures = 0;
}

/**
 * Chama o Google Gemini utilizando o pool inteligente com rotação e fallback automático.
 *
 * @param {string} prompt Mensagem do usuário
 * @param {object} options Configurações adicionais
 * @param {string} options.systemInstruction Instrução de sistema (persona e contexto)
 * @param {Array} options.history Histórico recente de mensagens [{ role: 'user'|'model', text: string }]
 * @param {number} options.temperature Criatividade da resposta (padrão 0.3)
 * @param {number} options.maxTokens Limite de tokens na resposta (padrão 800)
 * @returns {Promise<string|null>} Resposta gerada ou null se todas as chaves falharem
 */
export async function callGeminiKeyPool(prompt, {
  systemInstruction = '',
  history = [],
  temperature = 0.3,
  maxTokens = 800
} = {}) {
  const keys = getGeminiKeys();
  if (!keys.length) {
    console.warn('[FinBot AI] Nenhuma chave GEMINI_API_KEY ou GEMINI_API_KEYS configurada.');
    return null;
  }

  // Modelos de última geração com alta velocidade e suporte gratuito no endpoint v1beta
  const models = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.5-flash'];
  let attempts = 0;
  const maxAttempts = keys.length;

  while (attempts < maxAttempts) {
    attempts++;
    const keyState = selectNextAvailableKey(keys);

    if (!keyState) {
      console.warn('[FinBot AI] Todas as chaves do Gemini estão temporariamente em cooldown de cota.');
      break;
    }

    const currentKey = keyState.key;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentKey}`;

        // Monta o histórico de conversação no formato Gemini
        const contents = [];
        if (Array.isArray(history) && history.length) {
          for (const msg of history.slice(-6)) {
            const role = msg.role === 'model' || msg.role === 'bot' || msg.role === 'assistant' ? 'model' : 'user';
            const text = String(msg.text || msg.body || '').trim();
            if (text) contents.push({ role, parts: [{ text }] });
          }
        }
        contents.push({ role: 'user', parts: [{ text: String(prompt || '') }] });

        const payload = {
          contents,
          generationConfig: {
            temperature: Math.max(0, Math.min(1, temperature)),
            maxOutputTokens: maxTokens
          }
        };

        if (systemInstruction) {
          payload.systemInstruction = {
            parts: [{ text: systemInstruction }]
          };
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000)
        });

        if (response.ok) {
          const data = await response.json();
          const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText && typeof candidateText === 'string') {
            markKeySuccess(currentKey);
            return candidateText.trim();
          }
        }

        // Tratamento de Rate Limit / Quota Exceeded (429 ou 403 RESOURCE_EXHAUSTED)
        if (response.status === 429 || response.status === 403) {
          const errBody = await response.text().catch(() => '');
          const isQuota = response.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(errBody);

          if (isQuota) {
            // Se for cota diária ou limite de minuto, aplica cooldown de 30 minutos a essa chave
            markKeyCooldown(currentKey, `HTTP ${response.status} Quota Exceeded`, 30);
            break; // Sai do loop de modelos e tenta a próxima chave do pool
          }
        }

        console.warn(`[FinBot AI] Modelo ${model} com chave ${keyState.masked} retornou HTTP ${response.status}. Tentando fallback...`);
      } catch (err) {
        if (err.name === 'TimeoutError') {
          console.warn(`[FinBot AI] Timeout na requisição com a chave ${keyState.masked}.`);
        } else {
          console.warn(`[FinBot AI] Erro de rede com chave ${keyState.masked}:`, err.message);
        }
        break; // Tenta próxima chave
      }
    }
  }

  // Fallback opcional para OpenAI se configurada
  const openAiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (openAiKey && openAiKey.startsWith('sk-')) {
    try {
      console.log('[FinBot AI] Acionando fallback de segurança OpenAI GPT-4o-mini...');
      const messages = [];
      if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
      for (const msg of history.slice(-4)) {
        const role = msg.role === 'model' || msg.role === 'bot' ? 'assistant' : 'user';
        messages.push({ role, content: String(msg.text || msg.body || '') });
      }
      messages.push({ role: 'user', content: String(prompt || '') });

      const oaRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          temperature,
          max_tokens: maxTokens
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (oaRes.ok) {
        const oaData = await oaRes.json();
        const oaText = oaData?.choices?.[0]?.message?.content;
        if (oaText) return oaText.trim();
      }
    } catch (oaErr) {
      console.warn('[FinBot AI] Falha no fallback OpenAI:', oaErr.message);
    }
  }

  return null; // Permite fallback gracioso para FAQ de regras estáticas
}

/**
 * Gera uma renderização fotorrealista arquitetônica a partir de um prompt e imagem base.
 * Utiliza o pool inteligente de chaves Gemini (Google Imagen 3) com fallback de alta fidelidade.
 */
export async function callGeminiImageGeneration({
  prompt = '',
  imageBase64 = '',
  mimeType = 'image/jpeg',
  aspectRatio = '16:9'
} = {}) {
  const keys = getGeminiKeys();
  const defaultPrompt = 'Ultra-photorealistic architectural photography of a luxury modern residential villa, 8k resolution, cumaru wood deck, illuminated swimming pool, elegant lighting, professional architectural visualization published in ArchDaily, clean modern lines, realistic materials, photorealistic concrete and glass.';
  const finalPrompt = (prompt && prompt.trim()) ? prompt.trim() : defaultPrompt;

  // 1. Tentar Google Imagen 3 (imagen-3.0-generate-002) usando o pool de chaves Gemini
  if (keys.length > 0) {
    const total = keys.length;
    for (let i = 0; i < total; i++) {
      const keyState = selectNextAvailableKey(keys);
      if (!keyState) break;
      const currentKey = keyState.key;

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${currentKey}`;
        const payload = {
          instances: [{ prompt: finalPrompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: aspectRatio === '16:9' ? '16:9' : '4:3',
            outputMimeType: 'image/jpeg'
          }
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(25000)
        });

        if (res.ok) {
          const data = await res.json();
          const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
          if (b64) {
            markKeySuccess(currentKey);
            return {
              success: true,
              imageUrl: `data:image/jpeg;base64,${b64}`,
              provider: 'google-imagen-3',
              source: 'gemini-key-pool'
            };
          }
        } else if (res.status === 429 || res.status === 403) {
          markKeyCooldown(currentKey, `HTTP ${res.status} Imagen quota`, 30);
        }
      } catch (err) {
        console.warn(`[FinGo AI Render] Erro ao chamar Imagen 3 com chave ${keyState.masked}:`, err.message);
      }
    }
  }

  // 2. Fallback Gratuito de Alto Nível (Neural FLUX ArchViz):
  // Gera renderização arquitetônica fotorrealista instantânea sem depender de cotas
  try {
    const seed = Math.floor(Math.random() * 999999);
    const archPrompt = encodeURIComponent(`${finalPrompt}, 8k architectural photography, octane render, unreal engine 5, masterpiece, highly detailed, luxurious mansion`);
    const fallbackUrl = `https://image.pollinations.ai/prompt/${archPrompt}?width=1280&height=720&model=flux&seed=${seed}&nologo=true`;
    
    return {
      success: true,
      imageUrl: fallbackUrl,
      provider: 'flux-archviz-engine',
      source: 'free-neural-pool'
    };
  } catch (err) {
    console.error('[FinGo AI Render] Erro no fallback neural:', err);
    return {
      success: false,
      error: 'Não foi possível gerar a renderização no momento.'
    };
  }
}

/**
 * Retorna o status atual de saúde e telemetria do pool de chaves.
 */
export function getKeyPoolStatus() {
  const keys = getGeminiKeys();
  const now = Date.now();
  return {
    totalKeys: keys.length,
    activeKeys: keys.filter(k => getKeyState(k).cooldownUntil <= now).length,
    inCooldown: keys.filter(k => getKeyState(k).cooldownUntil > now).length,
    details: keys.map(k => {
      const s = getKeyState(k);
      return {
        masked: s.masked,
        active: s.cooldownUntil <= now,
        cooldownRemainingSeconds: Math.max(0, Math.round((s.cooldownUntil - now) / 1000)),
        successes: s.successes,
        failures: s.failures
      };
    })
  };
}
