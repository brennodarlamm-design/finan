// backend/domains/atendimento/evolution_client.js
// Cliente HTTP robusto para integração do FinGo com o Evolution Go (Golang WhatsApp Engine)
// Documentação: https://docs.evolutionfoundation.com.br/evolution-go/installation

export class EvolutionGoClient {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || process.env.EVOLUTION_GO_URL || 'http://localhost:8085').replace(/\/+$/, '');
    this.apiKey = options.apiKey || process.env.EVOLUTION_GO_API_KEY || '';
    this.timeoutMs = Number(options.timeoutMs || process.env.EVOLUTION_GO_TIMEOUT_MS || 12000);
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
   * Executa requisições HTTP seguras contra a API do Evolution Go
   */
  async request(path, options = {}) {
    if (!this.isConfigured()) {
      return { ok: false, status: 503, error: 'Evolution Go não configurado (URL ou API Key ausente).' };
    }

    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'apikey': this.apiKey,
      ...(options.headers || {})
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeout);
      const data = await response.json().catch(() => ({}));
      return {
        ok: response.ok,
        status: response.status,
        data,
        error: !response.ok ? (data.message || data.error || `HTTP ${response.status}`) : null
      };
    } catch (err) {
      clearTimeout(timeout);
      const isAbort = err.name === 'AbortError';
      return {
        ok: false,
        status: isAbort ? 504 : 502,
        data: null,
        error: isAbort ? 'Tempo limite esgotado ao contatar o Evolution Go.' : `Falha de rede no Evolution Go: ${err.message}`
      };
    }
  }

  /**
   * Cria ou garante a existência de uma instância do tenant
   */
  async createInstance(tenantId) {
    const instanceName = this.cleanInstanceName(tenantId);
    return await this.request('/instance/create', {
      method: 'POST',
      body: {
        instanceName,
        integration: 'WHATSAPP-BAILEYS'
      }
    });
  }

  /**
   * Obtém o QR Code em base64 da instância
   */
  async getQrCode(tenantId) {
    const instanceName = this.cleanInstanceName(tenantId);
    const res = await this.request(`/instance/${instanceName}/qrcode`);
    if (res.ok && res.data) {
      // O Evolution Go pode retornar o QR em qrcode, base64 ou pairingCode
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
   * Deleta/reseta a instância para forçar nova reconexão
   */
  async deleteInstance(tenantId) {
    const instanceName = this.cleanInstanceName(tenantId);
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
