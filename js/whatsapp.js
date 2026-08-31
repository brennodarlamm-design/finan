// js/whatsapp.js — Integração e Alertas de Boletos / Vencimentos no WhatsApp

const WhatsApp = {
  getTelefonePadrao() {
    return localStorage.getItem('finobra_whatsapp_telefone') || '5595991363678';
  },

  setTelefonePadrao(tel) {
    const limpo = (tel || '').replace(/\D/g, '');
    localStorage.setItem('finobra_whatsapp_telefone', limpo);
  },

  getEvolutionUrl() {
    let saved = (localStorage.getItem('finobra_evolution_url') || '').trim();
    // Limpa automaticamente túneis temporários mortos (trycloudflare, ngrok, loca.lt) ou localhost
    if (!saved || saved.includes('trycloudflare.com') || saved.includes('loca.lt') || saved.includes('ngrok') || saved.includes('localhost:3333')) {
      saved = 'https://finan-wf12.onrender.com/send-message';
      localStorage.setItem('finobra_evolution_url', saved);
    }
    return saved;
  },

  setEvolutionUrl(url) {
    localStorage.setItem('finobra_evolution_url', (url || '').trim());
  },

  getEvolutionKey() {
    return localStorage.getItem('finobra_evolution_key') || 'ANGELIM-FINANCAS-EVOLUTION-2026-KEY';
  },

  setEvolutionKey(key) {
    localStorage.setItem('finobra_evolution_key', (key || '').trim());
  },

  getEvolutionInstance() {
    return localStorage.getItem('finobra_evolution_instance') || 'angelim';
  },

  setEvolutionInstance(inst) {
    localStorage.setItem('finobra_evolution_instance', (inst || '').trim());
  },

  getModoEnvio() {
    return localStorage.getItem('finobra_whatsapp_modo') || 'api'; // 'api' (silencioso) ou 'web' (abre aba)
  },

  setModoEnvio(modo) {
    localStorage.setItem('finobra_whatsapp_modo', modo);
  },

  // Formata o link do WhatsApp Web/App
  gerarLink(texto, telefone = '') {
    const num = (telefone || this.getTelefonePadrao() || '').replace(/\D/g, '');
    const numFmt = num ? (num.startsWith('55') ? num : `55${num}`) : '';
    const encoded = encodeURIComponent(texto);
    return numFmt ? `https://api.whatsapp.com/send?phone=${numFmt}&text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
  },

  // Dispara envio DIRETO e SILENCIOSO (Sem abrir novas abas)
  async abrirEnvio(texto, telefone = '') {
    const modo = this.getModoEnvio();
    const tel = (telefone || this.getTelefonePadrao() || '').replace(/\D/g, '');
    const numFmt = tel ? (tel.startsWith('55') ? tel : `55${tel}`) : '';

    if (!numFmt) {
      Utils.toast('⚠️ Por favor, informe um número de telefone com DDD.', 'warning');
      this.abrirModalConfig();
      return;
    }

    // Se o usuário configurou para abrir no WhatsApp Web explicitamente
    if (modo === 'web') {
      const link = this.gerarLink(texto, telefone);
      window.open(link, '_blank');
      return;
    }

    // MODO PADRÃO: Disparo 100% silencioso em segundo plano
    Utils.toast('📲 Enviando mensagem para o WhatsApp...', 'info');

    const apiUrl = this.getEvolutionUrl();
    const apiKey = this.getEvolutionKey();
    const instance = this.getEvolutionInstance();

    // 1. Tenta envio via Proxy Serverless da aplicação (evita qualquer bloqueio de CORS do navegador)
    try {
      const resProxy = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: numFmt,
          text: texto,
          apiUrl: apiUrl,
          apiKey: apiKey,
          instance: instance
        })
      });

      const dataProxy = await resProxy.json().catch(() => ({}));
      if (resProxy.ok && dataProxy.success) {
        Utils.toast('✅ Mensagem enviada com sucesso para o WhatsApp!', 'success');
        return;
      }
    } catch (errProxy) {
      console.log('Proxy falhou, tentando chamada direta ao backend Render...');
    }

    // 2. Fallback direto para o backend 24/7 do Render
    try {
      const cloudUrl = 'https://finan-wf12.onrender.com/send-message';
      const resCloud = await fetch(cloudUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: numFmt,
          message: texto
        })
      });

      const dataCloud = await resCloud.json().catch(() => ({}));
      if (resCloud.ok && dataCloud.success) {
        Utils.toast('✅ Mensagem enviada com sucesso para o WhatsApp!', 'success');
        return;
      }
    } catch (errCloud) {
      console.warn('Erro no envio direto Render:', errCloud);
    }

    // 3. Fallback amigável: WhatsApp Web
    Utils.toast('⚠️ Abrindo WhatsApp Web...', 'info');
    window.open(this.gerarLink(texto, telefone), '_blank');
  },

  // Alerta de Boleto / Vencimento Individual
  enviarAlertaVencimento(dados) {
    const obra = DB.getById('clientes', dados.obra_id);
    const nomeObra = obra ? obra.nome : (dados.obra_id === 'escritorio' ? '🏢 Sede / Escritório Central' : 'Geral');
    const dataVenc = Utils.fmt.date(dados.data_vencimento || dados.data);
    const hoje = Utils.today();
    const isHoje = (dados.data_vencimento || dados.data) === hoje;

    let msg = `🚨 *ANGELIM CONSTRUTORA — AVISO DE VENCIMENTO* 🚨\n\n`;
    msg += `📄 *Boleto / Conta:* ${dados.descricao || dados.desc || 'Despesa'}\n`;
    msg += `🏢 *Obra / Centro de Custo:* ${nomeObra}\n`;
    if (dados.fornecedor || dados.fornecedor_beneficiario) {
      msg += `👤 *Fornecedor:* ${dados.fornecedor || dados.fornecedor_beneficiario}\n`;
    }
    msg += `💰 *Valor:* ${Utils.fmt.currency(dados.valor || dados.val || 0)}\n`;
    msg += `⏰ *Vencimento:* ${dataVenc} ${isHoje ? '⚠️ *(VENCE HOJE!)*' : ''}\n`;

    if (dados.codigo_barras) {
      msg += `\n🔢 *Linha Digitável / Código de Barras:*\n\`${dados.codigo_barras}\`\n`;
    }

    if (dados.chave_nfe) {
      msg += `\n🧾 *Chave NF-e:*\n\`${dados.chave_nfe}\`\n`;
    }

    const emp = typeof DB !== 'undefined' ? DB.getEmpresa() : null;
    const nomeEmp = emp?.nome_fantasia || emp?.razao_social || 'Sistema Financeiro';
    msg += `\n👉 _Notificação gerada pelo Sistema Financeiro ${nomeEmp}_`;

    this.abrirEnvio(msg);
  },

  // Resumo Diário de Boletos (Hoje + Próximos 3 Dias)
  enviarResumoDiario(obraId = null) {
    const today = Utils.today();
    const d3 = new Date();
    d3.setDate(d3.getDate() + 3);
    const d3Str = d3.toISOString().split('T')[0];

    const lans = DB.getLancamentos(obraId === 'todas' ? null : obraId).filter(l => {
      const venc = l.data_vencimento || l.data;
      return l.tipo === 'despesa' && (l.status === 'a_pagar' || l.status === 'pendente') && venc >= today && venc <= d3Str;
    });

    const hojeItems = lans.filter(l => (l.data_vencimento || l.data) === today);
    const proxItems = lans.filter(l => (l.data_vencimento || l.data) > today && (l.data_vencimento || l.data) <= d3Str);

    if (!lans.length) {
      Utils.toast('🎉 Não há boletos vencendo hoje nem nos próximos 3 dias!', 'info');
      return;
    }

    const totalHoje = hojeItems.reduce((s, l) => s + (l.valor || 0), 0);
    const totalProx = proxItems.reduce((s, l) => s + (l.valor || 0), 0);
    const totalGeral = totalHoje + totalProx;

    let msg = `☀️ *ANGELIM CONSTRUTORA — RESUMO DE CONTAS A PAGAR* ☀️\n`;
    msg += `📅 *Data:* ${Utils.fmt.date(today)}\n\n`;

    if (hojeItems.length) {
      msg += `🔴 *VENCEM HOJE (${hojeItems.length} conta(s) — Total: ${Utils.fmt.currency(totalHoje)}):*\n`;
      hojeItems.forEach((l, idx) => {
        const obra = DB.getById('clientes', l.obra_id);
        const nomeObra = obra ? obra.nome : (l.obra_id === 'escritorio' ? 'Sede' : 'Geral');
        msg += `\n${idx + 1}. *${Utils.fmt.currency(l.valor)}* — ${l.descricao}\n`;
        msg += `   🏢 Obra: ${nomeObra}\n`;
        if (l.codigo_barras) {
          msg += `   🔢 Boleto: \`${l.codigo_barras}\`\n`;
        }
      });
      msg += `\n`;
    } else {
      msg += `✅ *Nenhuma conta vencendo hoje.*\n\n`;
    }

    if (proxItems.length) {
      msg += `🟡 *VENCEM NOS PRÓXIMOS 3 DIAS (${proxItems.length} conta(s) — Total: ${Utils.fmt.currency(totalProx)}):*\n`;
      proxItems.forEach((l, idx) => {
        const obra = DB.getById('clientes', l.obra_id);
        const nomeObra = obra ? obra.nome : (l.obra_id === 'escritorio' ? 'Sede' : 'Geral');
        const dt = Utils.fmt.date(l.data_vencimento || l.data);
        msg += `• *${Utils.fmt.currency(l.valor)}* (${dt}) — ${l.descricao} [${nomeObra}]\n`;
        if (l.codigo_barras) {
          msg += `  Linha: \`${l.codigo_barras}\`\n`;
        }
      });
      msg += `\n`;
    }

    msg += `💵 *TOTAL GERAL A PAGAR:* ${Utils.fmt.currency(totalGeral)}\n`;
    msg += `-------------------------------------------\n`;
    msg += `👉 _Resumo automático gerado pelo Sistema Financeiro_`;

    this.abrirEnvio(msg);
  },

  // Modal para configurar o WhatsApp / Evolution API
  abrirModalConfig() {
    const tel = this.getTelefonePadrao();
    const url = this.getEvolutionUrl();
    const key = this.getEvolutionKey();
    const inst = this.getEvolutionInstance();
    const modo = this.getModoEnvio();

    Utils.showModal(`
      <div class="modal" style="max-width:520px;">
        <div class="modal-header">
          <span class="modal-title">📲 Integração WhatsApp & Evolution API</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <p style="font-size:.84rem;color:var(--text2);margin-bottom:14px;">
            Configure o envio direto sem abrir novas abas no navegador.
          </p>
          
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-size:.78rem;font-weight:700;">Número de WhatsApp de Destino (com DDD)</label>
            <input type="text" id="cfg-wa-phone" class="form-control"
              placeholder="Ex: 5595991363678"
              value="${tel}">
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-size:.78rem;font-weight:700;">Modo de Envio ao Clicar nos Botões</label>
            <select id="cfg-wa-modo" class="form-control" style="font-size:.84rem;">
              <option value="api" ${modo === 'api' ? 'selected' : ''}>⚡ Envio Silencioso em Segundo Plano (Sem abrir abas)</option>
              <option value="web" ${modo === 'web' ? 'selected' : ''}>🌐 Abrir no WhatsApp Web (Abre nova aba)</option>
            </select>
          </div>

          <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-md);padding:12px;margin-bottom:14px;">
            <div style="font-size:.8rem;font-weight:700;color:var(--accent2);margin-bottom:8px;">⚡ Servidor / Evolution API v2:</div>
            
            <div class="form-group" style="margin-bottom:8px;">
              <label class="form-label" style="font-size:.74rem;">URL da API / Endpoint</label>
              <input type="text" id="cfg-wa-url" class="form-control"
                placeholder="https://finan-wf12.onrender.com/send-message ou http://localhost:3333/send-message"
                value="${url}">
            </div>

            <div class="g2" style="gap:8px;">
              <div class="form-group">
                <label class="form-label" style="font-size:.74rem;">API Key (Opcional)</label>
                <input type="text" id="cfg-wa-key" class="form-control"
                  placeholder="ANGELIM-FINANCAS-EVOLUTION-2026-KEY"
                  value="${key}">
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:.74rem;">Nome da Instância</label>
                <input type="text" id="cfg-wa-inst" class="form-control"
                  placeholder="angelim"
                  value="${inst}">
              </div>
            </div>
          </div>

          <div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:var(--r-md);padding:10px 14px;font-size:.78rem;color:var(--text);">
            <div style="font-weight:700;color:var(--success);margin-bottom:2px;">🟢 Envio Silencioso Ativo:</div>
            Ao clicar no botão <strong>📲 Resumo WhatsApp</strong> ou <strong>📲 WhatsApp</strong>, a mensagem é enviada instantaneamente em segundo plano sem abrir nenhuma aba nova!
          </div>
        </div>
        <div class="modal-footer" style="display:flex;justify-content:space-between;">
          <button class="btn btn-secondary" onclick="WhatsApp.testarEnvio()">📲 Testar Envio</button>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="WhatsApp.salvarConfig()">💾 Salvar</button>
          </div>
        </div>
      </div>`);
  },

  salvarConfig() {
    const tel = document.getElementById('cfg-wa-phone')?.value || '';
    const url = document.getElementById('cfg-wa-url')?.value || '';
    const key = document.getElementById('cfg-wa-key')?.value || '';
    const inst = document.getElementById('cfg-wa-inst')?.value || '';
    const modo = document.getElementById('cfg-wa-modo')?.value || 'api';

    this.setTelefonePadrao(tel);
    this.setEvolutionUrl(url);
    this.setEvolutionKey(key);
    this.setEvolutionInstance(inst);
    this.setModoEnvio(modo);

    Utils.toast('Configurações salvas com sucesso!', 'success');
    Utils.closeModal();
  },

  testarEnvio() {
    const tel = document.getElementById('cfg-wa-phone')?.value || this.getTelefonePadrao();
    const url = document.getElementById('cfg-wa-url')?.value || this.getEvolutionUrl();
    const key = document.getElementById('cfg-wa-key')?.value || this.getEvolutionKey();
    const inst = document.getElementById('cfg-wa-inst')?.value || this.getEvolutionInstance();
    const modo = document.getElementById('cfg-wa-modo')?.value || 'api';

    this.setTelefonePadrao(tel);
    this.setEvolutionUrl(url);
    this.setEvolutionKey(key);
    this.setEvolutionInstance(inst);
    this.setModoEnvio(modo);

    const msg = `✅ *ANGELIM CONSTRUTORA*\n\nTeste de disparo silencioso em segundo plano realizado com sucesso! Sem abrir novas abas.`;
    this.abrirEnvio(msg, tel);
  }
};
