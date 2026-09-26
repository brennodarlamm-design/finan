// backend/domains/atendimento/evolution_client.js
// Cliente HTTP robusto para integração do FinGo com o Evolution Go (Golang WhatsApp Engine)
// Documentação: https://docs.evolutionfoundation.com.br/evolution-go/installation

export class EvolutionGoClient {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || process.env.EVOLUTION_GO_URL || 'http://localhost:8085').replace(/\/+$/, '');
    this.apiKey = options.apiKey || process.env.EVOLUTION_GO_API_KEY || '';
    // Teto de timeout HTTP configurável (padrão 2.5s para evitar congelamento de UI)
    this.timeoutMs = Number(options.timeoutMs || process.env.EVOLUTION_GO_TIMEOUT_MS || 2500);

    // Circuit Breaker (Disjuntor de Rede): CLOSED -> OPEN -> HALF_OPEN
    this.failureThreshold = Number(options.failureThreshold || 3);
    this.cooldownMs = Number(options.cooldownMs || 30000); // 30s
    this.circuitState = 'CLOSED';
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
    this.lastStateChange = Date.now();
    this.contingencyHandler = typeof options.contingencyHandler === 'function' ? options.contingencyHandler : null;
  }

  /**
   * Registra handler customizado de contingência a ser acionado com o circuito aberto
   */
  setContingencyHandler(fn) {
    this.contingencyHandler = typeof fn === 'function' ? fn : null;
  }

  /**
   * Retorna o estado atual do disjuntor avaliando o período de cooldown
   */
  getCircuitState() {
    if (this.circuitState === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.cooldownMs) {
        this.circuitState = 'HALF_OPEN';
        this.lastStateChange = Date.now();
      }
    }
    return this.circuitState;
  }

  /**
   * Verifica se o disjuntor está em estado ABERTO (tráfego barrado/contingência)
   */
  isCircuitOpen() {
    return this.getCircuitState() === 'OPEN';
  }

  /**
   * Registra sucesso de requisição, fechando o circuito se estiver em HALF_OPEN
   */
  recordSuccess() {
    if (this.circuitState === 'HALF_OPEN' || this.consecutiveFailures > 0) {
      this.circuitState = 'CLOSED';
      this.consecutiveFailures = 0;
      this.lastStateChange = Date.now();
    }
  }

  /**
   * Registra falha de rede/timeout/5xx, abrindo o circuito ao atingir o limiar
   */
  recordFailure(reason = '') {
    this.consecutiveFailures += 1;
    this.lastFailureTime = Date.now();

    if (this.circuitState === 'HALF_OPEN' || this.consecutiveFailures >= this.failureThreshold) {
      this.circuitState = 'OPEN';
      this.lastStateChange = Date.now();
    }
  }

  /**
   * Restaura o disjuntor para o estado fechado
   */
  resetCircuit() {
    this.circuitState = 'CLOSED';
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
    this.lastStateChange = Date.now();
  }

  /**
   * Força a abertura do disjuntor (para testes e contingências emergenciais)
   */
  tripCircuit() {
    this.circuitState = 'OPEN';
    this.consecutiveFailures = this.failureThreshold;
    this.lastFailureTime = Date.now();
    this.lastStateChange = Date.now();
  }

  /**
   * Sonda a saúde do container Evolution Go com latência e status do circuito
   */
  async checkHealth() {
    if (!this.isConfigured()) {
      return {
        healthy: false,
        status: 'unconfigured',
        circuitState: this.getCircuitState(),
        latencyMs: 0,
        error: 'Evolution Go não configurado (URL ou API Key ausente).'
      };
    }

    if (this.isCircuitOpen()) {
      return {
        healthy: false,
        status: 'circuit_open',
        circuitState: 'OPEN',
        latencyMs: 0,
        error: 'Circuit Breaker aberto: Evolution Go indisponível ou oscilando.'
      };
    }

    const start = Date.now();
    try {
      let res = await this.request('/server/ok', { timeoutMs: 2500 });
      if (!res.ok && res.status === 404) {
        res = await this.request('/health', { timeoutMs: 2500 });
      }
      const latencyMs = Date.now() - start;
      const healthy = Boolean(res.ok || res.status === 200);
      return {
        healthy,
        status: healthy ? 'healthy' : 'degraded',
        circuitState: this.getCircuitState(),
        latencyMs,
        statusCode: res.status,
        error: healthy ? null : (res.error || `HTTP ${res.status}`)
      };
    } catch (err) {
      return {
        healthy: false,
        status: 'unhealthy',
        circuitState: this.getCircuitState(),
        latencyMs: Date.now() - start,
        error: err.message
      };
    }
  }

  /**
   * Verifica se o provedor Evolution Go possui configuração mínima necessária
   */
  isConfigured() {
    return Boolean(this.baseUrl && this.apiKey);
  }

  /**
   * Limpa e padroniza o identificador do tenant para nomes válidos de instância
   */
  cleanInstanceName(tenantId) {
    const raw = String(tenantId || 'public').trim().toLowerCase();
    const sanitized = raw
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48);
    return sanitized || 'public';
  }

  /**
   * Normaliza números de telefone garantindo padrão E.164 brasileiro quando aplicável
   */
  normalizePhoneNumber(phone) {
    let clean = String(phone || '').replace(/\D/g, '');
    if (!clean) return '';
    // Adiciona código do Brasil 55 se o usuário informou DDD + número (10 ou 11 dígitos)
    if ((clean.length === 10 || clean.length === 11) && !clean.startsWith('55')) {
      clean = '55' + clean;
    }
    return clean;
  }

  /**
   * Executa requisições HTTP seguras contra a API do Evolution Go com proteção de Circuit Breaker
   */
  async request(path, options = {}) {
    if (!this.isConfigured()) {
      return { ok: false, status: 503, error: 'Evolution Go não configurado (URL ou API Key ausente).' };
    }

    // ── GATING DO CIRCUIT BREAKER ───────────────────────────────────────────
    if (this.isCircuitOpen()) {
      if (this.contingencyHandler) {
        try {
          const contingencyResult = await this.contingencyHandler(path, options);
          return {
            ...contingencyResult,
            circuitOpen: true,
            circuitState: 'OPEN',
            contingencyUsed: true
          };
        } catch (contingencyErr) {
          return {
            ok: false,
            status: 503,
            circuitOpen: true,
            circuitState: 'OPEN',
            contingencyUsed: true,
            error: `Falha no motor de contingência: ${contingencyErr.message}`
          };
        }
      }

      return {
        ok: false,
        status: 503,
        circuitOpen: true,
        circuitState: 'OPEN',
        fallback: true,
        data: null,
        error: 'Circuit Breaker aberto: Evolution Go indisponível ou oscilando. Chaveado para contingência.'
      };
    }

    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'apikey': this.apiKey,
      ...(options.headers || {})
    };

    const effectiveTimeout = Number(options.timeoutMs || this.timeoutMs || 2500);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeout);
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        this.recordSuccess();
        return {
          ok: true,
          status: response.status,
          circuitState: this.getCircuitState(),
          data,
          error: null
        };
      }

      // Falhas 5xx do servidor indicam oscilação ou quebra do container
      if (response.status >= 500 && options.recordFailure !== false) {
        this.recordFailure(`HTTP ${response.status}`);
      }

      return {
        ok: false,
        status: response.status,
        circuitState: this.getCircuitState(),
        data,
        error: !response.ok ? (data.message || data.error || `HTTP ${response.status}`) : null
      };
    } catch (err) {
      clearTimeout(timeout);
      if (options.recordFailure !== false) {
        this.recordFailure(err.message);
      }
      const isAbort = err.name === 'AbortError' || err.name === 'TimeoutError';
      return {
        ok: false,
        status: isAbort ? 504 : 502,
        circuitState: this.getCircuitState(),
        data: null,
        error: isAbort ? 'Tempo limite esgotado ao contatar o Evolution Go.' : `Falha de rede no Evolution Go: ${err.message}`
      };
    }
  }

  /**
   * Localiza uma instância existente pelo nome do tenant
   */
  async findInstance(tenantId) {
    const instanceName = this.cleanInstanceName(tenantId);
    try {
      const res = await this.request('/instance/all', { recordFailure: false });
      if (!res.ok || !Array.isArray(res.data?.data)) return null;
      return res.data.data.find(i => i.name === instanceName) || null;
    } catch {
      return null;
    }
  }

  /**
   * Cria ou garante a existência de uma instância do tenant
   */
  async createInstance(tenantId) {
    const instanceName = this.cleanInstanceName(tenantId);
    const token = `token_${instanceName}_123`;
    const webhookUrl = (process.env.EVOLUTION_GO_WEBHOOK_URL || '').trim();

    // No Evolution Go (Golang), o body exige "name" e "token"
    const body = {
      name: instanceName,
      token,
      qrcode: true
    };

    if (webhookUrl) {
      body.webhook = webhookUrl;
    }

    const res = await this.request('/instance/create', {
      method: 'POST',
      body
    });

    // Inicia a geração imediata do QR code conectando a instância criada
    await this.request('/instance/connect', {
      method: 'POST',
      headers: { apikey: token },
      body: {}
    }).catch(() => {});

    return res;
  }

  /**
   * Obtém o QR Code em base64 da instância
   */
  async getQrCode(tenantId) {
    const instanceName = this.cleanInstanceName(tenantId);
    let inst = await this.findInstance(tenantId);
    if (!inst) {
      await this.createInstance(tenantId);
      inst = await this.findInstance(tenantId);
    }

    if (inst) {
      let rawCode = inst.qrcode || '';
      if (!rawCode && !inst.connected) {
        await this.request('/instance/connect', {
          method: 'POST',
          headers: { apikey: inst.token || this.apiKey },
          body: {}
        }).catch(() => {});

        const qrFetch = await this.request('/instance/qr', {
          headers: { apikey: inst.token || this.apiKey }
        });
        if (qrFetch.ok && qrFetch.data?.data?.qrcode) {
          rawCode = qrFetch.data.data.qrcode;
        }
      }

      if (rawCode) {
        const base64Part = rawCode.split('|')[0].trim();
        const qrDataUrl = base64Part.startsWith('data:') ? base64Part : `data:image/png;base64,${base64Part}`;
        return {
          ok: true,
          qrDataUrl,
          pairingCode: rawCode.includes('|') ? rawCode.split('|')[1] : null,
          status: 'qr_ready'
        };
      }
    }

    // Fallback legado para /instance/:name/qrcode
    const res = await this.request(`/instance/${instanceName}/qrcode`);
    if (res.ok && res.data) {
      const rawCode = res.data.base64 || res.data.qrcode || res.data.code || null;
      let qrDataUrl = null;
      if (rawCode) {
        qrDataUrl = rawCode.startsWith('data:') ? rawCode : `data:image/png;base64,${rawCode}`;
      }
      return {
        ok: true,
        qrDataUrl,
        pairingCode: res.data.pairingCode || null,
        status: res.data.status || 'qr_ready'
      };
    }
    return res;
  }

  /**
   * Consulta o estado atual da conexão da instância
   */
  async getConnectionStatus(tenantId) {
    const instanceName = this.cleanInstanceName(tenantId);
    const inst = await this.findInstance(tenantId);
    if (inst) {
      const connected = Boolean(inst.connected);
      const connectedNumber = inst.jid ? inst.jid.replace(/@.*$/, '') : null;
      return {
        ok: true,
        connected,
        status: connected ? 'connected' : (inst.qrcode ? 'qr_ready' : 'connecting'),
        connectedNumber,
        raw: inst
      };
    }

    // Fallback legado para /instance/:name/status
    const res = await this.request(`/instance/${instanceName}/status`);
    if (res.ok && res.data) {
      const state = String(res.data.state || res.data.status || '').toLowerCase();
      const connected = state === 'open' || state === 'connected';
      return {
        ok: true,
        connected,
        status: connected ? 'connected' : (state === 'connecting' ? 'connecting' : 'disconnected'),
        connectedNumber: res.data.number || res.data.userJid || null,
        raw: res.data
      };
    }
    return {
      ok: false,
      connected: false,
      status: 'disconnected',
      connectedNumber: null,
      error: res.error
    };
  }

  /**
   * Envia mensagem de texto simples
   */
  async sendTextMessage(tenantId, phone, text) {
    const instanceName = this.cleanInstanceName(tenantId);
    const cleanPhone = this.normalizePhoneNumber(phone);
    if (!cleanPhone) {
      return { ok: false, status: 400, error: 'Telefone de destino inválido.' };
    }

    const inst = await this.findInstance(tenantId);
    const token = inst?.token || this.apiKey;

    // Tenta primeiro /send/text (Evolution Go oficial)
    const res = await this.request('/send/text', {
      method: 'POST',
      headers: { apikey: token },
      body: {
        number: cleanPhone,
        text: String(text || '').trim()
      }
    });

    if (res.ok || res.status !== 404) {
      return res;
    }

    // Fallback para rota legada v1/v2 caso a API externa seja NodeJS
    return await this.request(`/message/sendText/${instanceName}`, {
      method: 'POST',
      body: {
        number: cleanPhone,
        text: String(text || '').trim()
      }
    });
  }

  /**
   * Envia documento ou mídia (imagem/pdf)
   */
  async sendMediaMessage(tenantId, phone, { base64, mimeType, fileName, caption }) {
    const instanceName = this.cleanInstanceName(tenantId);
    const cleanPhone = this.normalizePhoneNumber(phone);
    if (!cleanPhone) {
      return { ok: false, status: 400, error: 'Telefone de destino inválido.' };
    }

    return await this.request(`/message/sendMedia/${instanceName}`, {
      method: 'POST',
      body: {
        number: cleanPhone,
        media: base64,
        mimetype: mimeType || 'application/pdf',
        fileName: fileName || 'documento.pdf',
        caption: caption || undefined
      }
    });
  }

  /**
   * Configura a URL de webhook e os eventos observados para a instância do tenant
   */
  async setWebhook(tenantId, webhookUrl, options = {}) {
    const instanceName = this.cleanInstanceName(tenantId);
    const events = options.events || [
      'CONNECTION_UPDATE',
      'MESSAGES_UPSERT',
      'QRCODE_UPDATED'
    ];

    return await this.request(`/webhook/set/${instanceName}`, {
      method: 'POST',
      body: {
        url: webhookUrl,
        enabled: options.enabled !== false,
        webhook_by_events: true,
        events
      }
    });
  }

  /**
   * Consulta a configuração de webhook cadastrada para a instância
   */
  async findWebhook(tenantId) {
    const instanceName = this.cleanInstanceName(tenantId);
    return await this.request(`/webhook/find/${instanceName}`);
  }

  /**
   * Reinicia a instância do tenant
   */
  async restartInstance(tenantId) {
    const instanceName = this.cleanInstanceName(tenantId);
    return await this.request(`/instance/restart/${instanceName}`, {
      method: 'POST'
    });
  }

  /**
   * Executa logout/desconexão graciosa da sessão no WhatsApp
   */
  async logoutInstance(tenantId) {
    const instanceName = this.cleanInstanceName(tenantId);
    const inst = await this.findInstance(tenantId);
    const token = inst?.token || this.apiKey;
    const res = await this.request('/instance/logout', {
      method: 'DELETE',
      headers: { apikey: token }
    });
    if (res.ok || res.status !== 404) return res;

    return await this.request(`/instance/logout/${instanceName}`, {
      method: 'DELETE'
    });
  }

  /**
   * Interpreta e normaliza eventos recebidos via webhook do Evolution Go
   */
  parseWebhookPayload(payload = {}) {
    const event = String(payload.event || payload.type || '').toLowerCase();
    const instance = this.cleanInstanceName(payload.instance || payload.tenantId || 'public');
    const data = payload.data || payload;

    if (event === 'qrcode.updated' || event === 'qrcode') {
      const rawCode = data.base64 || data.qrcode || data.code || null;
      let qrDataUrl = null;
      if (rawCode) {
        qrDataUrl = rawCode.startsWith('data:') ? rawCode : `data:image/png;base64,${rawCode}`;
      }
      return {
        type: 'qrcode',
        event,
        tenantId: instance,
        qrDataUrl,
        raw: data
      };
    }

    if (event === 'connection.update' || event === 'status') {
      const state = String(data.state || data.status || '').toLowerCase();
      const connected = state === 'open' || state === 'connected';
      return {
        type: 'connection',
        event,
        tenantId: instance,
        state,
        connected,
        status: connected ? 'connected' : (state === 'connecting' ? 'connecting' : 'disconnected'),
        number: data.number || data.userJid || null,
        raw: data
      };
    }

    if (event === 'messages.upsert' || event === 'message') {
      const key = data.key || {};
      const remoteJid = String(key.remoteJid || data.from || '').trim();
      const phone = remoteJid.replace(/@.*$/, '').replace(/\D/g, '');
      const isFromMe = Boolean(key.fromMe || data.fromMe);
      const pushName = data.pushName || data.senderName || 'Desconhecido';

      const messageContent = data.message || {};
      const text = String(
        messageContent.conversation ||
        messageContent.extendedTextMessage?.text ||
        messageContent.imageMessage?.caption ||
        messageContent.documentMessage?.caption ||
        data.text ||
        ''
      ).trim();

      const hasMedia = Boolean(
        messageContent.imageMessage ||
        messageContent.documentMessage ||
        messageContent.audioMessage ||
        messageContent.videoMessage
      );

      const mediaType = messageContent.imageMessage ? 'image' :
                        messageContent.documentMessage ? 'document' :
                        messageContent.audioMessage ? 'audio' :
                        messageContent.videoMessage ? 'video' : null;

      return {
        type: 'message',
        event,
        tenantId: instance,
        messageId: key.id || data.id || null,
        phone,
        remoteJid,
        pushName,
        isFromMe,
        text,
        hasMedia,
        mediaType,
        timestamp: data.messageTimestamp || Math.floor(Date.now() / 1000),
        raw: data
      };
    }

    return {
      type: 'unknown',
      event,
      tenantId: instance,
      data
    };
  }

  /**
   * Deleta/reseta a instância para forçar nova reconexão
   */
  async deleteInstance(tenantId) {
    const instanceName = this.cleanInstanceName(tenantId);
    const inst = await this.findInstance(tenantId);
    if (inst?.id) {
      const res = await this.request(`/instance/delete/${inst.id}`, {
        method: 'DELETE'
      });
      if (res.ok || res.status !== 404) return res;
    }
    return await this.request(`/instance/delete/${instanceName}`, {
      method: 'DELETE'
    });
  }

  /**
   * Resumo de status unificado no contrato 1:1 esperado pelo frontend do FinGo
   */
  async getUnifiedSessionSummary(tenantId) {
    const instanceName = this.cleanInstanceName(tenantId);
    const conn = await this.getConnectionStatus(tenantId);

    if (conn.connected) {
      return {
        success: true,
        tenantId: instanceName,
        status: 'connected',
        connected: true,
        connectedNumber: conn.connectedNumber,
        qrDataUrl: null,
        lastConnectedAt: new Date().toISOString(),
        engine: 'evolution-go'
      };
    }

    // Se não estiver conectado, tenta obter o QR code ativo
    const qrRes = await this.getQrCode(tenantId);
    if (qrRes.ok && qrRes.qrDataUrl) {
      return {
        success: true,
        tenantId: instanceName,
        status: 'qr_ready',
        connected: false,
        connectedNumber: null,
        qrDataUrl: qrRes.qrDataUrl,
        lastConnectedAt: null,
        engine: 'evolution-go'
      };
    }

    // Se a instância não existe ainda, tenta criá-la
    await this.createInstance(tenantId);

    return {
      success: true,
      tenantId: instanceName,
      status: 'connecting',
      connected: false,
      connectedNumber: null,
      qrDataUrl: null,
      warmingUp: true,
      engine: 'evolution-go'
    };
  }
}

// Instância singleton padrão exportada
export const evolutionGo = new EvolutionGoClient();
