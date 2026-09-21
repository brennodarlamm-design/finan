// js/whatsapp.js — Integração e Alertas de Boletos / Vencimentos no WhatsApp

const WhatsApp = {
  async _fetchWithTimeout(url, options = {}, timeoutMs = 18000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let externalAbortHandler = null;
    try {
      if (options.signal) {
        if (options.signal.aborted) controller.abort();
        else {
          externalAbortHandler = () => controller.abort();
          options.signal.addEventListener('abort', externalAbortHandler, { once: true });
        }
      }
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      if (controller.signal.aborted && err?.name === 'AbortError') {
        const timeoutError = new Error('A comunicação com o WhatsApp demorou mais que o esperado. Tente novamente.');
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }
      throw err;
    } finally {
      clearTimeout(timer);
      if (externalAbortHandler && options.signal) options.signal.removeEventListener('abort', externalAbortHandler);
    }
  },

  _prefKey(name) {
    return (typeof DB !== 'undefined' && DB._ck) ? DB._ck(name) : name;
  },

  getTelefonePadrao() {
    const salvo = localStorage.getItem(this._prefKey('finobra_whatsapp_telefone'));
    if (salvo && salvo.trim()) return salvo.trim();
    try {
      if (typeof DB !== 'undefined' && DB.getEmpresa) {
        const emp = DB.getEmpresa();
        const telEmp = (emp?.whatsapp || emp?.telefone || '').replace(/\D/g, '');
        if (telEmp) return telEmp;
      }
    } catch (_) {}
    return '';
  },

  setTelefonePadrao(tel) {
    const limpo = (tel || '').replace(/\D/g, '');
    localStorage.setItem(this._prefKey('finobra_whatsapp_telefone'), limpo);
    if (typeof DB !== 'undefined' && DB.saveTenantPreferences) DB.saveTenantPreferences({ whatsapp_telefone: limpo });
    try {
      if (typeof DB !== 'undefined' && DB.getEmpresa && DB.saveEmpresa) {
        const emp = DB.getEmpresa() || {};
        emp.whatsapp = limpo;
        DB.saveEmpresa(emp);
      }
    } catch (_) {}
  },


  getModoEnvio() {
    return localStorage.getItem(this._prefKey('finobra_whatsapp_modo')) || 'api'; // 'api' (silencioso) ou 'web' (abre aba)
  },

  setModoEnvio(modo) {
    const safeModo = ['api','web'].includes(modo) ? modo : 'api';
    localStorage.setItem(this._prefKey('finobra_whatsapp_modo'), safeModo);
    if (typeof DB !== 'undefined' && DB.saveTenantPreferences) DB.saveTenantPreferences({ whatsapp_modo: safeModo });
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
      Utils.toast('⚠️ Por favor, informe o número de WhatsApp para recebimento.', 'warning');
      this.abrirModalTelefone();
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

    // Disparo via Proxy Serverless Seguro da aplicação
    try {
      const authHeaders = (typeof Auth !== 'undefined' && Auth.getAuthHeaders)
        ? Auth.getAuthHeaders()
        : { 'Content-Type': 'application/json' };

      const resProxy = await this._fetchWithTimeout('/api/send-whatsapp', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          phone: numFmt,
          text: texto
        })
      });

      const dataProxy = await resProxy.json().catch(() => ({}));
      if (resProxy.ok && dataProxy.success) {
        Utils.toast('✅ Mensagem enviada com sucesso para o WhatsApp!', 'success');
        return;
      }

      if (dataProxy.notConnected || resProxy.status === 503 || (dataProxy.error && dataProxy.error.includes('não está conectado'))) {
        Utils.toast('⚠️ WhatsApp desconectado: Conecte o aparelho no menu para envio automático.', 'warning');
        return;
      }

      if (dataProxy.error) {
        Utils.toast(`⚠️ Falha no envio: ${dataProxy.error}`, 'warning');
        return;
      }
    } catch (errProxy) {
      console.warn('Proxy de envio indisponível:', errProxy);
    }

    // Fallback amigável: WhatsApp Web
    Utils.toast('⚠️ Não foi possível enviar em segundo plano. Abrindo WhatsApp Web...', 'info');
    window.open(this.gerarLink(texto, telefone), '_blank');
  },

  // Alerta de Boleto / Vencimento Individual
  enviarAlertaVencimento(dados) {
    const obra = DB.getById('clientes', dados.obra_id);
    const nomeObra = obra ? obra.nome : (dados.obra_id === 'escritorio' ? '🏢 Sede / Escritório Central' : 'Geral');
    const dataVenc = Utils.fmt.date(dados.data_vencimento || dados.data);
    const hoje = Utils.today();
    const isHoje = (dados.data_vencimento || dados.data) === hoje;

    const emp = typeof DB !== 'undefined' ? DB.getEmpresa() : null;
    const nomeEmp = emp?.nome_fantasia || emp?.razao_social || 'Sua Empresa';
    let msg = `🚨 *${nomeEmp.toUpperCase()} — AVISO DE VENCIMENTO* 🚨\n\n`;
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

    msg += `\n👉 _Notificação gerada pelo FinGo — ${nomeEmp}_`;

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

    const emp = typeof DB !== 'undefined' ? DB.getEmpresa() : null;
    const nomeEmp = emp?.nome_fantasia || emp?.razao_social || 'Sua Empresa';
    let msg = `☀️ *${nomeEmp.toUpperCase()} — RESUMO DE CONTAS A PAGAR* ☀️\n`;
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
    msg += `👉 _Resumo automático gerado pelo FinGo — ${nomeEmp}_`;

    this.abrirEnvio(msg);
  },

  // ── WORKFLOW & ETAPAS DE OBRA (Patch 53) ──────────────────────────────────
  gerarMensagemEtapa(obraId, processoId) {
    if (typeof CronogramaSLA === 'undefined' || typeof DB === 'undefined') return '';
    const obra = DB.getById('clientes', obraId);
    if (!obra) return '';
    const processos = CronogramaSLA.getObraProcessos(obraId);
    const p = processos.find(x => x.id === processoId);
    if (!p) return '';

    const resp = p.responsavel_resolvido || CronogramaSLA.getResponsavelEtapa(p);
    const isAtrasado = p.status_sla === 'atrasado';
    const isAtencao = p.status_sla === 'atencao';
    const statusIcon = isAtrasado ? '🔴 ATRASADA' : isAtencao ? '🟡 EM ATENÇÃO' : (p.status === 'concluido' ? '✅ CONCLUÍDA' : '🟢 NO PRAZO');

    const emp = typeof DB !== 'undefined' ? DB.getEmpresa() : null;
    const nomeEmp = emp?.nome_fantasia || emp?.razao_social || 'FinGo';

    let msg = `🏗️ *${nomeEmp.toUpperCase()} — WORKFLOW DE OBRA*\n`;
    msg += `-------------------------------------------\n`;
    msg += `🏢 *Obra:* ${obra.nome}\n`;
    msg += `📌 *Etapa:* ${p.nome} (${p.codigo || 'SLA'})\n`;
    msg += `👤 *Responsável:* ${resp ? `${resp.nome} (${resp.cargo || 'Equipe'})` : 'Não atribuído'}\n`;
    msg += `⏱️ *SLA:* ${p.dias_sla} dias\n`;
    msg += `📅 *Prazo:* ${typeof Utils !== 'undefined' ? Utils.fmt.date(p.data_fim_prevista) : p.data_fim_prevista}\n`;
    msg += `🚦 *Status:* ${statusIcon}${isAtrasado ? ` (+${p.dias_atraso}d)` : ''}\n`;

    if (p.motivo_atraso) {
      msg += `⚠️ *Motivo do atraso:* ${p.motivo_atraso}${p.motivo_atraso_detalhe ? ` - ${p.motivo_atraso_detalhe}` : ''}\n`;
    }

    if (Array.isArray(p.checklist) && p.checklist.length > 0) {
      const concluidos = p.checklist.filter(i => p.checklist_status?.[i] === true).length;
      msg += `✅ *Checklist:* ${concluidos}/${p.checklist.length} itens concluídos\n`;
    }

    msg += `-------------------------------------------\n`;
    msg += `👉 _Acesse o sistema para consultar ou apontar o progresso._`;
    return msg;
  },

  abrirModalNotificacaoEtapa(obraId, processoId) {
    if (typeof DB === 'undefined' || typeof CronogramaSLA === 'undefined') return;
    const obra = DB.getById('clientes', obraId);
    if (!obra) return;
    const processos = CronogramaSLA.getObraProcessos(obraId);
    const p = processos.find(x => x.id === processoId);
    if (!p) return;

    const resp = p.responsavel_resolvido || CronogramaSLA.getResponsavelEtapa(p);
    let telSugerido = '';
    if (resp && resp.id) {
      const users = (typeof Auth !== 'undefined' && Auth.getUsers) ? Auth.getUsers() : [];
      const u = users.find(x => x.id === resp.id);
      telSugerido = u?.telefone || '';
    }
    if (!telSugerido) telSugerido = obra.telefone || this.getTelefonePadrao();

    const msg = this.gerarMensagemEtapa(obraId, processoId);
    const e = Utils.escapeHtml.bind(Utils);

    Utils.showModal(`
      <div class="modal" style="max-width:480px;">
        <div class="modal-header">
          <span class="modal-title">📲 Notificar Responsável no WhatsApp</span>
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-weight:700;">Telefone WhatsApp (com DDD) *</label>
            <input type="tel" class="form-control" id="sla-wa-tel" value="${e(telSugerido)}" placeholder="(11) 99999-9999">
          </div>
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-size:.78rem;color:var(--text3);">Prévia da Mensagem</label>
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 12px;font-size:.76rem;font-family:monospace;white-space:pre-wrap;max-height:160px;overflow-y:auto;color:var(--text);">
              ${e(msg)}
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Cancelar</button>
          <button class="btn btn-primary" style="background:#25D366;border-color:#25D366;color:#fff;font-weight:800;"
            data-fb-click="WhatsApp.enviarNotificacaoEtapaSubmit" data-fb-click-n="3"
            data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(obraId))}"
            data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(String(processoId))}"
            data-fb-click-t2="domvalue" data-fb-click-v2="sla-wa-tel">
            🚀 Enviar WhatsApp
          </button>
        </div>
      </div>
    `);
  },

  enviarNotificacaoEtapaSubmit(obraId, processoId, telefone) {
    const msg = this.gerarMensagemEtapa(obraId, processoId);
    if (!msg) return Utils.toast('Não foi possível gerar a mensagem da etapa.', 'error');
    const tel = (telefone || '').replace(/\D/g, '');
    if (!tel) {
      Utils.toast('Informe um número de telefone com DDD válido.', 'warning');
      document.getElementById('sla-wa-tel')?.focus();
      return;
    }
    Utils.closeModal();
    this.abrirEnvio(msg, tel);
    Utils.toast('Notificação enviada com sucesso!', 'success');
  },

  enviarResumoWorkflowObra(obraId, telefone = '') {
    if (typeof DB === 'undefined' || typeof CronogramaSLA === 'undefined') return;
    const obra = DB.getById('clientes', obraId);
    if (!obra) return;
    const resumo = CronogramaSLA.getResumoObra(obraId);
    if (!resumo) return;

    const emp = typeof DB !== 'undefined' ? DB.getEmpresa() : null;
    const nomeEmp = emp?.nome_fantasia || emp?.razao_social || 'FinGo';

    let msg = `☀️ *${nomeEmp.toUpperCase()} — STATUS DE WORKFLOW DA OBRA* ☀️\n`;
    msg += `-------------------------------------------\n`;
    msg += `🏢 *Obra:* ${obra.nome}\n`;
    msg += `📊 *Progresso:* ${resumo.percentualConcluido}% (${resumo.totalConcluidos}/${resumo.totalProcessos} etapas concluídas)\n`;
    if (resumo.etapaAtual) {
      msg += `📌 *Etapa Atual:* ${resumo.etapaAtual.nome}\n`;
      msg += `⏱️ *SLA:* ${resumo.etapaAtual.dias_sla}d | 📅 *Prazo:* ${Utils.fmt.date(resumo.etapaAtual.data_fim_prevista)}\n`;
    }
    msg += `🚦 *Situação dos Prazos:* ${resumo.totalAtrasados > 0 ? `🔴 ${resumo.totalAtrasados} etapa(s) em atraso` : '🟢 Cronograma 100% no prazo'}\n`;
    msg += `-------------------------------------------\n`;
    msg += `👉 _Acompanhe os detalhes completos no FinGo._`;

    const telFinal = (telefone || obra.telefone || this.getTelefonePadrao() || '').replace(/\D/g, '');
    this.abrirEnvio(msg, telFinal);
  },

  // Modal simples e direto para o CLIENTE definir seu WhatsApp de recebimento de boletos
  abrirModalTelefone() {
    const telAtual = this.getTelefonePadrao();
    Utils.showModal(`
      <div class="modal" style="max-width:440px;">
        <div class="modal-header">
          <span class="modal-title">📲 WhatsApp para Alertas &amp; Boletos</span>
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>
        <div class="modal-body">
          <p style="font-size:.84rem;color:var(--text2);margin-bottom:14px;line-height:1.4;">
            Informe o número de WhatsApp (com DDD) da sua construtora para receber os resumos diários de contas e alertas de vencimento de boletos.
          </p>

          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label" style="font-weight:700;color:var(--accent);">Telefone / WhatsApp com DDD *</label>
            <input type="text" id="cli-wa-phone" class="form-control"
              placeholder="Ex: 95 99123-4567 ou 11 98765-4321"
              value="${telAtual}"
              style="font-size:1.05rem;font-weight:700;letter-spacing:.02em;"
              autofocus>
            <span style="font-size:.74rem;color:var(--text3);margin-top:4px;display:block;">
              Informe o DDD e o número do celular onde os alertas e boletos serão entregues.
            </span>
          </div>

          <div style="background:rgba(37,211,102,.08);border:1px solid rgba(37,211,102,.25);border-radius:var(--r-md);padding:12px;font-size:.8rem;color:var(--text);">
            <div style="font-weight:700;color:#25d366;margin-bottom:3px;">⚡ Notificações Ativas:</div>
            Ao clicar em <strong>📲 Resumo WhatsApp</strong> no Dashboard ou nos alertas de boletos, o relatório é enviado diretamente para este número!
          </div>
        </div>
        <div class="modal-footer" style="display:flex;justify-content:space-between;">
          <button class="btn btn-secondary" data-fb-click="WhatsApp.testarEnvioCliente" data-fb-click-n="0">📲 Testar Envio</button>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Cancelar</button>
            <button class="btn btn-primary" data-fb-click="WhatsApp.salvarTelefoneCliente" data-fb-click-n="0">💾 Salvar Número</button>
          </div>
        </div>
      </div>
    `);
  },

  salvarTelefoneCliente() {
    const val = document.getElementById('cli-wa-phone')?.value || '';
    const limpo = val.replace(/\D/g, '');
    if (!limpo || limpo.length < 10) {
      Utils.toast('Por favor, informe um número válido com DDD (mínimo 10 dígitos).', 'warning');
      return;
    }
    this.setTelefonePadrao(limpo);
    Utils.toast('Número de WhatsApp atualizado com sucesso!', 'success');
    Utils.closeModal();

    const inputCfgTel = document.getElementById('cfg-emp-tel');
    if (inputCfgTel) inputCfgTel.value = val;
    const badgeTel = document.getElementById('cfg-wa-ativo-txt');
    if (badgeTel) badgeTel.innerHTML = `Número ativo para alertas: <strong style="color:var(--success);">${this.formatarTelefone(limpo)}</strong>`;
  },

  testarEnvioCliente() {
    const val = document.getElementById('cli-wa-phone')?.value || '';
    const limpo = val.replace(/\D/g, '');
    if (!limpo || limpo.length < 10) {
      Utils.toast('Por favor, informe um número válido com DDD antes de testar.', 'warning');
      return;
    }
    this.setTelefonePadrao(limpo);
    const msg = `*FinGo — Teste de Notificação*\n\n✅ Olá! Este número foi conectado com sucesso ao FinGo para o recebimento de alertas de boletos e resumos financeiros da construtora.`;
    this.abrirEnvio(msg, limpo);
  },

  _pollTimer: null,
  _currentSession: null,

  formatarTelefone(tel) {
    if (!tel) return '';
    const limpo = String(tel).replace(/\D/g, '');
    if (limpo.length === 13 && limpo.startsWith('55')) {
      return `+55 (${limpo.substring(2, 4)}) ${limpo.substring(4, 9)}-${limpo.substring(9)}`;
    }
    if (limpo.length === 12 && limpo.startsWith('55')) {
      return `+55 (${limpo.substring(2, 4)}) ${limpo.substring(4, 8)}-${limpo.substring(8)}`;
    }
    if (limpo.length === 11) {
      return `(${limpo.substring(0, 2)}) ${limpo.substring(2, 7)}-${limpo.substring(7)}`;
    }
    if (limpo.length === 10) {
      return `(${limpo.substring(0, 2)}) ${limpo.substring(2, 6)}-${limpo.substring(6)}`;
    }
    return limpo;
  },

  fecharModalConexao() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    Utils.closeModal();
  },

  async consultarSessao() {
    try {
      const headers = (typeof Auth !== 'undefined' && Auth.getAuthHeaders)
        ? Auth.getAuthHeaders()
        : { 'Content-Type': 'application/json' };

      const res = await this._fetchWithTimeout('/api/whatsapp?action=session', {
        method: 'GET',
        headers: headers
      });

      if (!res.ok) {
        throw new Error(`Servidor respondeu com status ${res.status}`);
      }

      const data = await res.json();
      this._currentSession = data;
      return data;
    } catch (err) {
      console.warn('⚠️ [WhatsApp] Falha ao consultar status da sessão:', err.message);
      return {
        success: false,
        status: 'connecting',
        connected: false,
        connectedNumber: null,
        qrDataUrl: null,
        error: err.message
      };
    }
  },

  // Abre o Modal Principal de Conexão e Gerenciamento do WhatsApp para o Cliente
  async abrirModalConexao() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }

    Utils.showModal(`
      <div class="modal" id="wa-conexao-modal" style="max-width:500px;border-radius:16px;">
        <div class="modal-header" style="border-bottom:1px solid var(--border);padding-bottom:12px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.3rem;">📲</span>
            <div>
              <span class="modal-title" style="font-size:1.05rem;font-weight:700;">Conexão com WhatsApp</span>
              <div style="font-size:.74rem;color:var(--text3);">Disparo automático de boletos e relatórios diários</div>
            </div>
          </div>
          <button class="modal-close" data-fb-click="WhatsApp.fecharModalConexao" data-fb-click-n="0">✕</button>
        </div>
        <div class="modal-body" id="wa-conexao-modal-body" style="padding-top:16px;">
          <div style="text-align:center;padding:36px 16px;">
            <div class="spinner" style="width:40px;height:40px;border:3px solid rgba(37,211,102,0.2);border-top-color:#25D366;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px;"></div>
            <h4 style="margin:0 0 6px;font-size:1rem;color:var(--text);">Verificando servidor de WhatsApp...</h4>
            <p style="color:var(--text3);font-size:.82rem;margin:0;">Conectando ao serviço em nuvem...</p>
          </div>
        </div>
      </div>
    `);

    // Inicia a primeira verificação imediata
    const inicial = await this.consultarSessao();
    this.renderModalEstado(inicial);

    // Inicia polling a cada 2.5 segundos enquanto o modal estiver aberto
    this._pollTimer = setInterval(async () => {
      // Se o modal foi fechado pelo usuário, cancela o timer
      if (!document.getElementById('wa-conexao-modal')) {
        clearInterval(this._pollTimer);
        this._pollTimer = null;
        return;
      }

      const prevStatus = this._currentSession?.status;
      const prevConnected = this._currentSession?.connected;
      const prevQR = this._currentSession?.qrDataUrl;

      const atual = await this.consultarSessao();

      // Se conectou após a leitura do QR Code, avisa com toast e atualiza a tela
      if (!prevConnected && atual.connected) {
        Utils.toast('🎉 WhatsApp conectado com sucesso!', 'success');
        this.renderModalEstado(atual);
        // Atualiza indicadores na tela de configurações se estiver aberta
        const badgeTel = document.getElementById('cfg-wa-ativo-txt');
        if (badgeTel && atual.connectedNumber) {
          badgeTel.innerHTML = `Número ativo: <strong style="color:var(--success);">${this.formatarTelefone(atual.connectedNumber)}</strong>`;
        }
      } else if (prevStatus !== atual.status || (atual.qrDataUrl && atual.qrDataUrl !== prevQR)) {
        this.renderModalEstado(atual);
      }
    }, 2500);
  },

  renderModalEstado(session) {
    const container = document.getElementById('wa-conexao-modal-body');
    if (!container) return;

    const status = session?.status || 'connecting';
    const isConnected = !!session?.connected;
    const connectedNum = session?.connectedNumber || '';
    const qrDataUrl = session?.qrDataUrl;
    const telPadrao = this.getTelefonePadrao();

    // ── ESTADO 1: CONECTADO ──
    if (isConnected) {
      const numFmt = this.formatarTelefone(connectedNum || telPadrao);
      let lastConFmt = 'Ativo agora';
      if (session.lastConnectedAt) {
        try {
          const d = new Date(session.lastConnectedAt);
          lastConFmt = d.toLocaleString('pt-BR');
        } catch (_) {}
      }

      container.innerHTML = `
        <div style="text-align:center;padding:4px 0 10px;">
          <div style="width:64px;height:64px;border-radius:50%;background:rgba(16,185,129,0.12);border:2px solid #10b981;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:28px;color:#10b981;">
            ✓
          </div>
          <div style="display:inline-block;background:rgba(16,185,129,0.15);color:#10b981;font-weight:700;padding:4px 14px;border-radius:999px;font-size:0.75rem;letter-spacing:0.04em;margin-bottom:8px;">
            🟢 100% CONECTADO E PRONTO
          </div>
          <h3 style="margin:0 0 6px;font-size:1.2rem;font-weight:700;">WhatsApp Conectado!</h3>
          <p style="color:var(--text2);font-size:0.82rem;max-width:380px;margin:0 auto 16px;line-height:1.4;">
            O servidor está online e enviando notificações de boletos, alertas de vencimento e resumos da construtora.
          </p>

          <div style="background:var(--bg2, #1e293b);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:16px;text-align:left;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="font-size:0.78rem;color:var(--text3);">Aparelho Conectado:</span>
              <span style="font-weight:700;color:var(--text);font-size:0.92rem;display:flex;align-items:center;gap:6px;">
                <span>📱</span> ${numFmt || 'Identificado na Nuvem'}
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="font-size:0.78rem;color:var(--text3);">Servidor:</span>
              <span style="font-weight:600;color:#10b981;font-size:0.8rem;">⚡ 24/7 Alta Disponibilidade (Render)</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:0.78rem;color:var(--text3);">Conectado desde:</span>
              <span style="font-size:0.78rem;color:var(--text2);">${lastConFmt}</span>
            </div>
          </div>

          <!-- Teste de Envio -->
          <div style="background:rgba(255,255,255,0.02);border:1px dashed var(--border);border-radius:12px;padding:12px 14px;margin-bottom:16px;text-align:left;">
            <label style="font-size:0.75rem;font-weight:700;color:var(--text2);display:block;margin-bottom:6px;">
              📲 Disparar Mensagem de Teste:
            </label>
            <div style="display:flex;gap:8px;">
              <input type="text" id="wa-teste-phone" class="form-control"
                placeholder="DDD + Telefone (ex: 95 99136-3678)"
                value="${connectedNum || telPadrao || ''}"
                style="font-size:0.86rem;">
              <button class="btn btn-sm" id="wa-btn-teste" data-fb-click="WhatsApp.executarTesteConexao" data-fb-click-n="0" style="background:#25D366;color:#fff;font-weight:700;white-space:nowrap;display:flex;align-items:center;gap:6px;">
                <span>🚀 Testar</span>
              </button>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;">
            <button class="btn btn-sm btn-danger" data-fb-click="WhatsApp.confirmarDesconexao" data-fb-click-n="0" style="font-size:0.78rem;background:transparent;color:#ef4444;border:1px solid rgba(239,68,68,0.35);">
              🔌 Desconectar Aparelho
            </button>
            <button class="btn btn-secondary btn-sm" data-fb-click="WhatsApp.fecharModalConexao" data-fb-click-n="0">
              Concluído
            </button>
          </div>
        </div>
      `;
      return;
    }

    // ── ESTADO 2: QR CODE PRONTO ──
    if (status === 'qr_ready' && qrDataUrl) {
      container.innerHTML = `
        <div style="text-align:center;padding:4px 0 10px;">
          <div style="display:inline-block;background:rgba(245,158,11,0.12);color:#f59e0b;font-weight:700;padding:4px 12px;border-radius:999px;font-size:0.75rem;margin-bottom:8px;">
            ⚡ QR CODE PRONTO PARA LEITURA
          </div>
          <h3 style="margin:0 0 4px;font-size:1.15rem;font-weight:700;">Aponte a Câmera do WhatsApp</h3>
          <p style="color:var(--text2);font-size:0.82rem;max-width:380px;margin:0 auto 14px;line-height:1.4;">
            Abra o WhatsApp no celular da construtora e aponte para a imagem abaixo:
          </p>

          <div style="display:inline-block;background:#ffffff;padding:12px;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,0.3);margin-bottom:14px;border:3px solid #25D366;">
            <img src="${qrDataUrl}" alt="QR Code WhatsApp" style="width:220px;height:220px;display:block;border-radius:6px;" />
          </div>

          <div style="background:var(--bg2, #1e293b);border:1px solid var(--border);border-radius:12px;padding:12px 16px;margin-bottom:16px;text-align:left;">
            <div style="font-size:0.75rem;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px;letter-spacing:0.04em;">
              Passo a passo rápido:
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:0.82rem;color:var(--text);">
              <span style="background:rgba(37,211,102,0.15);color:#25D366;font-weight:700;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;flex-shrink:0;">1</span>
              <span>Abra o <strong>WhatsApp</strong> no seu celular</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:0.82rem;color:var(--text);">
              <span style="background:rgba(37,211,102,0.15);color:#25D366;font-weight:700;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;flex-shrink:0;">2</span>
              <span>Acesse <strong>Aparelhos Conectados</strong> (nos 3 pontinhos ou Configurações)</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;font-size:0.82rem;color:var(--text);">
              <span style="background:rgba(37,211,102,0.15);color:#25D366;font-weight:700;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;flex-shrink:0;">3</span>
              <span>Toque em <strong>Conectar Aparelho</strong> e aponte para o QR Code</span>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;">
            <button class="btn btn-sm btn-secondary" data-fb-click="WhatsApp.forcarNovoQR" data-fb-click-n="0" style="font-size:0.78rem;display:flex;align-items:center;gap:6px;">
              🔄 Atualizar QR Code
            </button>
            <button class="btn btn-secondary btn-sm" data-fb-click="WhatsApp.fecharModalConexao" data-fb-click-n="0">
              Cancelar
            </button>
          </div>
        </div>
      `;
      return;
    }

    // ── ESTADO 3: INICIANDO / CONECTANDO ──
    container.innerHTML = `
      <div style="text-align:center;padding:36px 16px;">
        <div class="spinner" style="width:44px;height:44px;border:3px solid rgba(37,211,102,0.2);border-top-color:#25D366;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px;"></div>
        <h4 style="margin:0 0 6px;font-size:1.05rem;font-weight:700;color:var(--text);">Iniciando Motor do WhatsApp...</h4>
        <p style="color:var(--text2);font-size:.84rem;max-width:320px;margin:0 auto 14px;line-height:1.4;">
          Sincronizando com o servidor em nuvem. O QR Code aparecerá nesta tela em instantes.
        </p>
        <span style="font-size:.74rem;color:var(--text3);display:block;margin-bottom:20px;">
          ⚡ Verificando automaticamente a cada 2 segundos...
        </span>
        <button class="btn btn-sm btn-secondary" data-fb-click="WhatsApp.forcarNovoQR" data-fb-click-n="0" style="font-size:.76rem;">
          🔄 Forçar Novo QR Code
        </button>
      </div>
    `;
  },

  async forcarNovoQR() {
    Utils.toast('🔄 Solicitando novo QR Code ao servidor...', 'info');
    const container = document.getElementById('wa-conexao-modal-body');
    if (container) {
      container.innerHTML = `
        <div style="text-align:center;padding:36px 16px;">
          <div class="spinner" style="width:40px;height:40px;border:3px solid rgba(37,211,102,0.2);border-top-color:#25D366;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px;"></div>
          <h4 style="margin:0 0 6px;font-size:1rem;color:var(--text);">Gerando novo QR Code...</h4>
          <p style="color:var(--text3);font-size:.82rem;margin:0;">Limpando credenciais anteriores...</p>
        </div>
      `;
    }

    try {
      const headers = (typeof Auth !== 'undefined' && Auth.getAuthHeaders)
        ? Auth.getAuthHeaders()
        : { 'Content-Type': 'application/json' };

      await this._fetchWithTimeout('/api/whatsapp?action=disconnect', {
        method: 'POST',
        headers: headers
      });

      // Aguarda 1.5s e consulta novamente
      setTimeout(async () => {
        const data = await this.consultarSessao();
        this.renderModalEstado(data);
      }, 1500);
    } catch (err) {
      Utils.toast('Erro ao resetar: ' + err.message, 'error');
    }
  },

  confirmarDesconexao() {
    Utils.confirm('Deseja realmente desconectar este aparelho WhatsApp? O robô deixará de enviar mensagens até que outro aparelho seja conectado.', () => {
      this.executarDesconexao();
    });
  },

  async executarDesconexao() {
    Utils.toast('🔌 Desconectando aparelho...', 'info');
    try {
      const headers = (typeof Auth !== 'undefined' && Auth.getAuthHeaders)
        ? Auth.getAuthHeaders()
        : { 'Content-Type': 'application/json' };

      await this._fetchWithTimeout('/api/whatsapp?action=disconnect', {
        method: 'POST',
        headers: headers
      });

      Utils.toast('Aparelho desconectado. Gerando novo QR Code...', 'success');
      this.forcarNovoQR();
    } catch (err) {
      Utils.toast('Falha ao desconectar: ' + err.message, 'error');
    }
  },

  async executarTesteConexao() {
    const input = document.getElementById('wa-teste-phone');
    const raw = input?.value || this.getTelefonePadrao();
    const limpo = String(raw).replace(/\D/g, '');

    if (!limpo || limpo.length < 10) {
      Utils.toast('Informe um número válido com DDD para o teste.', 'warning');
      return;
    }

    const btn = document.getElementById('wa-btn-teste');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Enviando...</span>';
    }

    try {
      const headers = (typeof Auth !== 'undefined' && Auth.getAuthHeaders)
        ? Auth.getAuthHeaders()
        : { 'Content-Type': 'application/json' };

      const res = await this._fetchWithTimeout('/api/whatsapp?action=test', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          phone: limpo,
          message: `*FinGo — Teste de Notificação*\n\n✅ Olá! Seu WhatsApp está conectado e pronto para enviar relatórios diários e alertas de boletos da construtora.`
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        Utils.toast('✅ Mensagem de teste enviada com sucesso para o WhatsApp!', 'success');
      } else if (data.notConnected || res.status === 503 || (data.error && data.error.includes('não está conectado'))) {
        Utils.toast('⚠️ WhatsApp desconectado: Escaneie o QR Code para parear o aparelho.', 'warning');
        this.forcarNovoQR();
      } else {
        Utils.toast('⚠️ Erro ao enviar: ' + (data.error || 'Verifique o status do aparelho'), 'warning');
      }
    } catch (err) {
      Utils.toast('Erro na conexão com o servidor: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>🚀 Testar</span>';
      }
    }
  },

  async testarEnvioCliente() {
    const tel = this.getTelefonePadrao();
    if (!tel) {
      Utils.toast('Por favor, cadastre primeiro o número de telefone para alertas.', 'warning');
      this.abrirModalTelefone();
      return;
    }

    Utils.toast('📲 Disparando teste de notificação para ' + this.formatarTelefone(tel) + '...', 'info');

    try {
      const headers = (typeof Auth !== 'undefined' && Auth.getAuthHeaders)
        ? Auth.getAuthHeaders()
        : { 'Content-Type': 'application/json' };

      const res = await this._fetchWithTimeout('/api/whatsapp?action=test', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          phone: tel,
          message: `*FinGo — Teste de Notificação*\n\n✅ Olá! Seu WhatsApp está conectado e pronto para enviar relatórios diários e alertas de boletos da construtora.`
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        Utils.toast('✅ Mensagem de teste enviada com sucesso para o WhatsApp!', 'success');
      } else if (data.notConnected || res.status === 503 || (data.error && data.error.includes('não está conectado'))) {
        Utils.toast('⚠️ Aparelho desconectado: Escaneie o QR Code para ativar os envios.', 'warning');
        this.abrirModalConexao();
      } else {
        Utils.toast('⚠️ Erro no envio: ' + (data.error || 'Verifique o número informado'), 'warning');
      }
    } catch (err) {
      Utils.toast('Erro na conexão: ' + err.message, 'error');
    }
  },

  // Alias para manter compatibilidade total com chamadas legadas
  abrirModalConfig() {
    this.abrirModalConexao();
  },

  // ── TEMPLATES DE MENSAGEM DE WORKFLOW (Patch 53) ──
  gerarMensagemEtapa(tipoNotificacao, dados = {}) {
    const { etapa = {}, obra = {}, responsavel = {}, diasAtraso = 0, motivo = '' } = dados;
    const nomeObra = obra.nome || 'Obra';
    const nomeEtapa = etapa.nome || 'Etapa';
    const codigoEtapa = etapa.codigo || 'FASE';
    const nomeResp = responsavel.nome || 'Equipe';
    const prazoFmt = etapa.data_fim_prevista ? (typeof Utils !== 'undefined' && Utils.fmt?.date ? Utils.fmt.date(etapa.data_fim_prevista) : etapa.data_fim_prevista) : 'A definir';
    const inicioFmt = (etapa.data_inicio_real || etapa.data_inicio_prevista) ? (typeof Utils !== 'undefined' && Utils.fmt?.date ? Utils.fmt.date(etapa.data_inicio_real || etapa.data_inicio_prevista) : (etapa.data_inicio_real || etapa.data_inicio_prevista)) : 'Hoje';

    switch (tipoNotificacao) {
      case 'inicio':
        return `*FinGo — Início de Etapa*\n\n` +
          `Olá, *${nomeResp}*!\n\n` +
          `A seguinte fase da obra *${nomeObra}* foi iniciada:\n` +
          `📌 *Etapa:* ${codigoEtapa} — ${nomeEtapa}\n` +
          `📅 *Início:* ${inicioFmt}\n` +
          `🏁 *Prazo Final (SLA):* ${prazoFmt} (${etapa.dias_sla || 15} dias)\n\n` +
          `Favor acompanhar os apontamentos no sistema FinGo. Bom trabalho!`;

      case 'conclusao':
        return `*FinGo — Etapa Concluída com Sucesso!*\n\n` +
          `Informamos que uma nova etapa foi concluída na obra *${nomeObra}*:\n` +
          `✅ *Etapa:* ${codigoEtapa} — ${nomeEtapa}\n` +
          `👤 *Responsável:* ${nomeResp}\n` +
          `🏁 *Data de Conclusão:* ${etapa.data_fim_real ? (typeof Utils !== 'undefined' && Utils.fmt?.date ? Utils.fmt.date(etapa.data_fim_real) : etapa.data_fim_real) : 'Hoje'}\n\n` +
          `O cronograma da obra foi atualizado e as próximas etapas já estão em andamento.`;

      case 'atraso':
        return `*FinGo — Alerta de Prazo / Atraso de SLA*\n\n` +
          `Atenção *${nomeResp}*!\n\n` +
          `A etapa *${codigoEtapa} — ${nomeEtapa}* da obra *${nomeObra}* excedeu o prazo previsto de SLA.\n` +
          `🔴 *Atraso:* +${diasAtraso || etapa.dias_atraso || 1} dias\n` +
          `🏁 *Prazo Previsto:* ${prazoFmt}\n` +
          (motivo ? `📝 *Motivo Registrado:* ${motivo}\n` : '') +
          `\nPor favor, atualize o status ou revise as pendências de campo no FinGo para recalcular o cronograma.`;

      case 'cobranca':
      default:
        return `*FinGo — Cobrança de Status / Prazos*\n\n` +
          `Olá, *${nomeResp}*!\n\n` +
          `Gostaríamos de um alinhamento sobre o andamento da fase na obra *${nomeObra}*:\n` +
          `📋 *Etapa:* ${codigoEtapa} — ${nomeEtapa}\n` +
          `🏁 *Prazo Limite:* ${prazoFmt}\n` +
          (diasAtraso > 0 ? `⚠️ *Situação:* +${diasAtraso} dias de atraso\n` : `⏱️ *Situação:* Em andamento dentro do SLA\n`) +
          `\nPoderia nos enviar uma previsão ou registrar o apontamento no sistema? Obrigado!`;
    }
  },

  abrirWhatsAppWeb(phone, message) {
    const limpo = String(phone || '').replace(/\D/g, '');
    const num = limpo ? (limpo.startsWith('55') ? limpo : '55' + limpo) : '';
    const url = num
      ? `https://wa.me/${num}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  abrirModalNotificacaoEtapa(obraId, etapaId, preTipo = 'cobranca') {
    const obra = (typeof DB !== 'undefined') ? DB.getById('clientes', obraId) || {} : {};
    const processos = (typeof CronogramaSLA !== 'undefined') ? CronogramaSLA.getObraProcessos(obraId) : [];
    const p = processos.find(x => x.id === etapaId) || {};
    const resp = (typeof CronogramaSLA !== 'undefined') ? CronogramaSLA.getResponsavelEtapa(p) : null;
    const e = (typeof Utils !== 'undefined' && Utils.escapeHtml) ? Utils.escapeHtml.bind(Utils) : String;

    let telSugerido = obra.telefone || '';
    if (resp && resp.id && typeof Auth !== 'undefined' && Auth.getUsers) {
      const u = Auth.getUsers().find(user => user.id === resp.id);
      if (u && u.telefone) telSugerido = u.telefone;
    }

    const defaultTipo = p.status_sla === 'atrasado' ? 'atraso' : p.status === 'concluido' ? 'conclusao' : preTipo;
    const msgInicial = this.gerarMensagemEtapa(defaultTipo, {
      etapa: p,
      obra,
      responsavel: resp || { nome: p.cargo_responsavel || 'Equipe' },
      diasAtraso: p.dias_atraso || 0,
      motivo: p.motivo_atraso_detalhe || p.motivo_atraso || ''
    });

    Utils.showModal(`
      <div class="modal" style="max-width:540px;">
        <div class="modal-header">
          <span class="modal-title">💬 Notificar Etapa via WhatsApp</span>
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">&#x2715;</button>
        </div>
        <div class="modal-body" style="max-height:calc(80vh - 120px);overflow-y:auto;">
          <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 14px;margin-bottom:14px;font-size:.82rem;">
            <div style="font-weight:800;color:var(--text);">${e(p.icone || '📋')} ${e(p.nome || 'Etapa')}</div>
            <div style="color:var(--text3);margin-top:2px;">Obra: <strong>${e(obra.nome || '')}</strong> &middot; Resp: <strong>${e(resp?.nome || 'Não atribuído')}</strong></div>
          </div>

          <div class="form-row cols-2" style="margin-bottom:12px;">
            <div class="form-group">
              <label class="form-label">Modelo de Mensagem</label>
              <select class="form-control" id="wa-etp-tipo-sel">
                <option value="cobranca" ${defaultTipo === 'cobranca' ? 'selected' : ''}>📋 Cobrança / Alinhamento</option>
                <option value="atraso" ${defaultTipo === 'atraso' ? 'selected' : ''}>🔴 Alerta de Atraso de SLA</option>
                <option value="inicio" ${defaultTipo === 'inicio' ? 'selected' : ''}>🚀 Início da Etapa</option>
                <option value="conclusao" ${defaultTipo === 'conclusao' ? 'selected' : ''}>✅ Conclusão da Etapa</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Telefone Destinatário</label>
              <input type="text" class="form-control" id="wa-etp-dest-phone" placeholder="DDD + Telefone" value="${e(telSugerido)}">
            </div>
          </div>

          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Mensagem (Editável)</label>
            <textarea class="form-control" id="wa-etp-msg" rows="7" style="font-size:.82rem;font-family:inherit;">${e(msgInicial)}</textarea>
          </div>
        </div>
        <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;">
          <button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Cancelar</button>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary" style="background:#25D366;border-color:#25D366;color:#fff;font-weight:700;"
              data-fb-click="WhatsApp.enviarNotificacaoEtapaSubmit" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(obraId))}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(String(etapaId))}">
              📲 Enviar WhatsApp
            </button>
          </div>
        </div>
      </div>
    `);

    const selTipo = document.getElementById('wa-etp-tipo-sel');
    if (selTipo) {
      selTipo.addEventListener('change', () => {
        const msgEl = document.getElementById('wa-etp-msg');
        if (msgEl) {
          msgEl.value = this.gerarMensagemEtapa(selTipo.value, {
            etapa: p,
            obra,
            responsavel: resp || { nome: p.cargo_responsavel || 'Equipe' },
            diasAtraso: p.dias_atraso || 0,
            motivo: p.motivo_atraso_detalhe || p.motivo_atraso || ''
          });
        }
      });
    }
  },

  async enviarNotificacaoEtapaSubmit(obraId, etapaId) {
    const phoneInput = document.getElementById('wa-etp-dest-phone');
    const msgInput = document.getElementById('wa-etp-msg');
    const rawPhone = phoneInput ? phoneInput.value : '';
    const message = msgInput ? msgInput.value.trim() : '';

    if (!message) {
      Utils.toast('Mensagem não pode estar vazia.', 'warning');
      return;
    }

    const limpo = String(rawPhone).replace(/\D/g, '');
    const session = await this.consultarSessao();

    if (session && session.connected && limpo.length >= 10) {
      Utils.toast('📲 Enviando notificação via servidor WhatsApp...', 'info');
      try {
        const headers = (typeof Auth !== 'undefined' && Auth.getAuthHeaders)
          ? Auth.getAuthHeaders()
          : { 'Content-Type': 'application/json' };

        const res = await this._fetchWithTimeout('/api/whatsapp?action=test', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ phone: limpo, message })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          Utils.toast('✅ Notificação enviada com sucesso via WhatsApp!', 'success');
          Utils.closeModal();
          return;
        }
      } catch (e) {
        console.warn('[WhatsApp] Fallback para WhatsApp Web:', e);
      }
    }

    // Fallback gracioso: abre wa.me diretamente no navegador/app
    this.abrirWhatsAppWeb(limpo, message);
    Utils.toast('WhatsApp Web aberto com a mensagem pronta!', 'success');
    Utils.closeModal();
  },

  enviarResumoWorkflowObra(obraId) {
    const obra = (typeof DB !== 'undefined') ? DB.getById('clientes', obraId) || {} : {};
    const resumo = (typeof CronogramaSLA !== 'undefined') ? CronogramaSLA.getResumoObra(obraId) : {};
    const e = (typeof Utils !== 'undefined' && Utils.escapeHtml) ? Utils.escapeHtml.bind(Utils) : String;

    const dataEntrega = resumo.dataEntregaEstimada ? (Utils.fmt?.date ? Utils.fmt.date(resumo.dataEntregaEstimada) : resumo.dataEntregaEstimada) : 'A definir';
    const statusMsg = resumo.statusGeral === 'atrasado'
      ? `🔴 Atrasado (+${resumo.diasAtrasoAcumulado} dias)`
      : resumo.statusGeral === 'atencao'
        ? `🟡 Em Atenção`
        : `🟢 No Prazo`;

    const texto = `*FinGo — Status e Prazos do Projeto*\n\n` +
      `Obra: *${obra.nome || 'Obra'}*\n` +
      `Situação do Cronograma: *${statusMsg}*\n` +
      `Fases Concluídas: *${resumo.concluidos || 0} de ${resumo.totalProcessos || 0}* (${resumo.pctGeral || 0}%)\n` +
      `Previsão Atual de Entrega: *${dataEntrega}*\n` +
      (resumo.etapaAtual ? `Fase Atual em Execução: *${resumo.etapaAtual.nome}*\n` : '') +
      `\nRelatório gerado via FinGo — Obras em Fluxo.`;

    const telSugerido = obra.telefone || '';

    Utils.showModal(`
      <div class="modal" style="max-width:540px;">
        <div class="modal-header">
          <span class="modal-title">📊 Resumo do Cronograma para WhatsApp</span>
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">&#x2715;</button>
        </div>
        <div class="modal-body">
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Telefone do Destinatário</label>
            <input type="text" class="form-control" id="wa-resumo-phone" placeholder="DDD + Telefone (ex: 95 99136-3678)" value="${e(telSugerido)}">
          </div>
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Texto da Mensagem</label>
            <textarea class="form-control" id="wa-resumo-texto" rows="8" style="font-size:.82rem;font-family:inherit;">${e(texto)}</textarea>
          </div>
        </div>
        <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;">
          <button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Cancelar</button>
          <button class="btn btn-primary" style="background:#25D366;border-color:#25D366;color:#fff;font-weight:700;"
            id="wa-btn-resumo-enviar">
            📲 Enviar no WhatsApp
          </button>
        </div>
      </div>
    `);

    const btnEnviar = document.getElementById('wa-btn-resumo-enviar');
    if (btnEnviar) {
      btnEnviar.addEventListener('click', async () => {
        const phone = document.getElementById('wa-resumo-phone')?.value || '';
        const msg = document.getElementById('wa-resumo-texto')?.value || texto;
        const limpo = String(phone).replace(/\D/g, '');
        const session = await WhatsApp.consultarSessao();

        if (session && session.connected && limpo.length >= 10) {
          Utils.toast('📲 Enviando resumo via servidor WhatsApp...', 'info');
          try {
            const headers = (typeof Auth !== 'undefined' && Auth.getAuthHeaders)
              ? Auth.getAuthHeaders()
              : { 'Content-Type': 'application/json' };

            const res = await this._fetchWithTimeout('/api/whatsapp?action=test', {
              method: 'POST',
              headers: headers,
              body: JSON.stringify({ phone: limpo, message: msg })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
              Utils.toast('✅ Resumo enviado com sucesso!', 'success');
              Utils.closeModal();
              return;
            }
          } catch (e) {
            console.warn('[WhatsApp] Fallback:', e);
          }
        }

        WhatsApp.abrirWhatsAppWeb(limpo, msg);
        Utils.toast('WhatsApp Web aberto com o resumo!', 'success');
        Utils.closeModal();
      });
    }
  }
};

