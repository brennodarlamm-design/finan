// js/master.js — Painel do Desenvolvedor / Super Admin Master Backoffice (/app/master)

const MasterAdmin = {
  STORAGE_EMPRESAS_KEY: 'finobra_tenants_master',

  _empresas: null,
  _isLoading: false,
  _billing: null,
  _billingLoading: false,
  _errorsGlobal: null,
  _errorsGlobalLoading: false,
  _integrity: null,
  _integrityLoading: false,
  _bankAccounts: null,
  _bankAccountsLoading: false,

  async _fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
    if (typeof Auth !== 'undefined' && typeof Auth._fetchWithTimeout === 'function') {
      return Auth._fetchWithTimeout(url, options, timeoutMs);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  },

  _esc(value) {
    if (typeof Utils !== 'undefined' && Utils.escapeHtml) return Utils.escapeHtml(String(value ?? ''));
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  },

  async carregarEmpresas(force = false) {
    if (this._empresas && !force) return this._empresas;
    this._isLoading = true;
    try {
      const resp = await this._fetchWithTimeout('/api/admin?action=tenants', {
        headers: (typeof Auth !== 'undefined' && Auth.getAuthHeaders) ? Auth.getAuthHeaders() : {}
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && Array.isArray(data.tenants)) {
          this._empresas = data.tenants.map(t => ({
            id: t.id,
            nome_fantasia: t.nome_fantasia || t.nome || t.id,
            razao_social: t.razao_social || t.nome || '',
            cnpj: t.cnpj || '—',
            responsavel: t.responsavel || '—',
            email: t.email || '',
            telefone: t.telefone || '',
            plano: t.plano || 'pro',
            status: t.status || 'ativo',
            obrasQtd: parseInt(t.obrasQtd || 0, 10),
            criadoEm: t.criado_em || t.criadoEm || '',
            vencimento: t.vencimento ? String(t.vencimento).split('T')[0] : '',
            diasRestantes: t.diasRestantes !== undefined ? t.diasRestantes : null,
            expirado: Boolean(t.expirado)
          }));
          this.salvarEmpresas(this._empresas);
          this._isLoading = false;
          return this._empresas;
        }
      }
    } catch (err) {
      console.warn('Falha ao carregar tenants do Neon API:', err);
    }
    this._isLoading = false;
    return this.getEmpresasLocal();
  },

  async carregarCobrancas(force = false) {
    if (this._billing && !force) return this._billing;
    if (this._billingLoading) return this._billing || { invoices:[], summary:{} };
    this._billingLoading = true;
    try {
      const resp = await this._fetchWithTimeout('/api/admin?action=billing', {
        headers:(typeof Auth !== 'undefined' && Auth.getAuthHeaders) ? Auth.getAuthHeaders() : {}
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success) {
        this._billing = { invoices:Array.isArray(data.invoices) ? data.invoices : [], summary:data.summary || {} };
      }
    } catch (err) {
      console.warn('Falha ao carregar cobranças do SaaS:', err);
    }
    this._billingLoading = false;
    if (!this._billing) this._billing = { invoices:[], summary:{} };
    return this._billing;
  },

  async carregarErrosSaaS(force = false) {
    if (this._errorsGlobal && !force) return this._errorsGlobal;
    if (this._errorsGlobalLoading) return this._errorsGlobal || { errors:[], summary:{}, top_routes:[], clusters:[] };
    this._errorsGlobalLoading = true;
    try {
      const resp = await this._fetchWithTimeout('/api/admin?action=client_errors&limit=100', {
        headers:(typeof Auth !== 'undefined' && Auth.getAuthHeaders) ? Auth.getAuthHeaders() : {}
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success) {
        this._errorsGlobal = {
          errors: Array.isArray(data.errors) ? data.errors : [],
          summary: data.summary || {},
          top_routes: Array.isArray(data.top_routes) ? data.top_routes : [],
          clusters: Array.isArray(data.clusters) ? data.clusters : []
        };
      }
    } catch (err) { console.warn('Falha ao carregar diagnóstico global:', err); }
    this._errorsGlobalLoading = false;
    if (!this._errorsGlobal) this._errorsGlobal = { errors:[], summary:{}, top_routes:[], clusters:[] };
    return this._errorsGlobal;
  },

  async carregarIntegridade(force = false) {
    if (this._integrity && !force) return this._integrity;
    if (this._integrityLoading) return this._integrity || null;
    this._integrityLoading = true;
    try {
      const resp = await this._fetchWithTimeout('/api/admin?action=integrity_status', { headers:(typeof Auth !== 'undefined' && Auth.getAuthHeaders) ? Auth.getAuthHeaders() : {} });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success) this._integrity = data;
    } catch (err) { console.warn('Falha ao carregar integridade:', err); }
    this._integrityLoading = false;
    return this._integrity;
  },

  async carregarContasBancarias(force = false) {
    if (this._bankAccounts && !force) return this._bankAccounts;
    if (this._bankAccountsLoading) return this._bankAccounts || { accounts: [], tenant_stats: [], summary: {} };
    this._bankAccountsLoading = true;
    try {
      const resp = await this._fetchWithTimeout('/api/admin?action=bank_accounts_overview', {
        headers: (typeof Auth !== 'undefined' && Auth.getAuthHeaders) ? Auth.getAuthHeaders() : {}
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success) {
        this._bankAccounts = {
          accounts: Array.isArray(data.accounts) ? data.accounts : [],
          tenant_stats: Array.isArray(data.tenant_stats) ? data.tenant_stats : [],
          summary: data.summary || {}
        };
      }
    } catch (err) {
      console.warn('Falha ao carregar visão de contas bancárias:', err);
    }
    this._bankAccountsLoading = false;
    if (!this._bankAccounts) this._bankAccounts = { accounts: [], tenant_stats: [], summary: {} };
    return this._bankAccounts;
  },

  async recarregarContasBancarias() {
    await this.carregarContasBancarias(true);
    const target = document.getElementById('master-content-area') ? 'master-content-area' : 'route-content';
    this.render(target);
  },

  _renderIntegridade() {
    const d = this._integrity;
    if (!d) return `<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:18px;color:#94a3b8;margin-bottom:20px;">🧩 Verificando integridade relacional…</div>`;
    const constraints = Array.isArray(d.constraints) ? d.constraints : [];
    const audit = Array.isArray(d.audit) ? d.audit : [];
    const byName = new Map(audit.map(x => [x.constraint_name, x]));
    const pending = constraints.filter(c => !c.validated);
    const issues = audit.filter(x => Number(x.issue_count || 0) > 0);
    const storagePrivate = d.storage?.configured_access === 'private' && d.storage?.private_ready;
    const rows = constraints.map(c => {
      const a = byName.get(c.constraint_name) || {};
      const count = Number(a.issue_count || 0);
      const ok = !!c.validated && count === 0;
      return `<tr><td style="padding:8px 10px;color:#cbd5e1">${this._esc(c.constraint_name)}</td><td style="padding:8px 10px">${this._esc(c.table_name)}</td><td style="padding:8px 10px;color:${count?'#fca5a5':(ok?'#86efac':'#fbbf24')}">${count ? `${count} pendência(s)` : (ok?'Validada':'Aguardando validação')}</td></tr>`;
    }).join('');
    return `<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden;margin-bottom:20px;"><div style="padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><div style="font-weight:900;color:#fff">🧩 Integridade Multi-Tenant</div><div style="font-size:.72rem;color:#64748b;margin-top:3px">Build ${this._esc(d.build || '—')} · Blob ${storagePrivate?'privado':'público/pendente'}</div></div><div style="font-size:.78rem;font-weight:800;color:${issues.length?'#ef4444':pending.length?'#f59e0b':'#22c55e'}">${issues.length ? `${issues.length} relação(ões) com legado inconsistente` : pending.length ? `${pending.length} constraint(s) aguardando validação` : 'Todas as constraints validadas'}</div></div><div style="overflow:auto;max-height:300px"><table style="width:100%;border-collapse:collapse;font-size:.75rem"><tbody>${rows || '<tr><td style="padding:14px;color:#64748b">Sem dados de auditoria ainda.</td></tr>'}</tbody></table></div></div>`;
  },

  _renderContasBancariasSaaS() {
    const bundle = this._bankAccounts || { accounts: [], tenant_stats: [], summary: {} };
    const summary = bundle.summary || {};
    const accounts = bundle.accounts || [];
    const stats = bundle.tenant_stats || [];

    const totalAccounts = Number(summary.total_contas || 0);
    const saldoConsolidado = (Number(summary.saldo_consolidado || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const taxaGlobal = Number(summary.taxa_global_pct || 0);
    const totalLanc = Number(summary.total_lancamentos || 0);
    const concLanc = Number(summary.lancamentos_conciliados || 0);
    const tenantsComContas = Number(summary.tenants_com_contas || 0);

    // Linhas de estatísticas por construtora
    const statsRows = stats.length ? stats.map(s => {
      const nome = this._esc(s.tenant_nome || s.tenant_id);
      const plano = this._esc(String(s.tenant_plano || 'pro').toUpperCase());
      const contas = Number(s.total_contas || 0);
      const saldo = (Number(s.saldo_total_contas || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const total = Number(s.total_lancamentos || 0);
      const conc = Number(s.lancamentos_conciliados || 0);
      const pend = Number(s.lancamentos_pendentes || 0);
      const pct = s.taxa_conciliacao_pct !== null && s.taxa_conciliacao_pct !== undefined ? Number(s.taxa_conciliacao_pct) : (total > 0 ? Math.round((conc / total) * 100) : 0);
      const badgeColor = pct >= 90 ? '#22c55e' : pct >= 50 ? '#f59e0b' : pct > 0 ? '#f97316' : '#94a3b8';
      const badgeBg = pct >= 90 ? 'rgba(34,197,94,.12)' : pct >= 50 ? 'rgba(245,158,11,.12)' : pct > 0 ? 'rgba(249,115,22,.12)' : 'rgba(148,163,184,.12)';

      return `
        <tr style="border-bottom:1px solid rgba(255,255,255,.06);">
          <td style="padding:12px 16px;font-weight:700;color:#fff;">
            <div>${nome}</div>
            <div style="font-size:.72rem;color:#64748b;font-family:monospace;">${this._esc(s.tenant_id)} · <span style="color:var(--accent2);">${plano}</span></div>
          </td>
          <td style="padding:12px 16px;font-weight:800;color:${contas ? '#38bdf8' : '#64748b'};text-align:center;">${contas} conta(s)</td>
          <td style="padding:12px 16px;font-weight:800;color:#fff;text-align:right;">R$ ${saldo}</td>
          <td style="padding:12px 16px;text-align:center;">
            <span style="display:inline-block;padding:4px 10px;border-radius:12px;font-size:.75rem;font-weight:800;color:${badgeColor};background:${badgeBg};">
              ${pct}% (${conc}/${total})
            </span>
          </td>
          <td style="padding:12px 16px;color:${pend ? '#fca5a5' : '#86efac'};font-size:.8rem;text-align:center;">
            ${pend ? `⚠️ ${pend} pendente(s)` : '✅ 0 pendências'}
          </td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="5" style="padding:32px;text-align:center;color:#64748b;">Nenhuma construtora com lançamentos encontrada.</td></tr>`;

    // Linhas de contas detalhadas
    const accountRows = accounts.length ? accounts.map(a => {
      const nomeEmpresa = this._esc(a.tenant_nome || a.tenant_id);
      const banco = this._esc(a.banco_nome || (a.banco_codigo ? `Banco ${a.banco_codigo}` : 'Banco'));
      const agencia = this._esc(a.agencia || '—');
      const numero = this._esc(a.numero || '—');
      const titular = this._esc(a.titular || a.apelido || '—');
      const obra = this._esc(a.obra_nome || (a.obra_id ? `Obra ${a.obra_id}` : 'Geral (Sem vínculo)'));
      const saldo = (Number(a.saldo_atual || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const saldoPositivo = Number(a.saldo_atual || 0) >= 0;

      return `
        <tr style="border-bottom:1px solid rgba(255,255,255,.06);">
          <td style="padding:12px 16px;font-weight:700;color:#fff;">${nomeEmpresa}</td>
          <td style="padding:12px 16px;">
            <div style="font-weight:700;color:#e2e8f0;">${banco}</div>
            <div style="font-size:.7rem;color:#64748b;text-transform:uppercase;">${this._esc(a.tipo || 'Corrente')}</div>
          </td>
          <td style="padding:12px 16px;font-family:monospace;font-size:.78rem;color:#cbd5e1;">Ag. ${agencia} / CC ${numero}</td>
          <td style="padding:12px 16px;color:#94a3b8;font-size:.8rem;">${titular}</td>
          <td style="padding:12px 16px;font-size:.8rem;color:#cbd5e1;">${obra}</td>
          <td style="padding:12px 16px;font-weight:800;color:${saldoPositivo ? '#4ade80' : '#f87171'};text-align:right;">R$ ${saldo}</td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="6" style="padding:32px;text-align:center;color:#64748b;">Nenhuma conta bancária cadastrada no banco de dados ainda.</td></tr>`;

    return `
      <div>
        <!-- Top Title & Metrics -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:14px;">
          <div>
            <h2 style="font-size:1.5rem;font-weight:900;color:#fff;margin:0 0 6px 0;">🏦 Contas Bancárias &amp; Conciliação Multi-Tenant</h2>
            <p style="font-size:.82rem;color:#94a3b8;margin:0;">Diagnóstico em tempo real de contas ativas, saldos consolidados e taxa de conciliação das construtoras</p>
          </div>
          <button data-fb-click="MasterAdmin.recarregarContasBancarias" data-fb-click-n="0" class="btn-clean" style="padding:9px 15px;background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:8px;color:#fff;font-weight:700;font-size:.8rem;display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
            <span>↻</span> Atualizar Indicadores
          </button>
        </div>

        <!-- 4 Metric Cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:28px;">
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;">
            <div style="font-size:.75rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Contas Ativas no SaaS</div>
            <div style="font-size:1.8rem;font-weight:900;color:#38bdf8;margin:8px 0 4px 0;">${totalAccounts}</div>
            <div style="font-size:.75rem;color:#64748b;">Distribuídas em ${tenantsComContas} construtora(s)</div>
          </div>
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;">
            <div style="font-size:.75rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Saldo Consolidado em Contas</div>
            <div style="font-size:1.8rem;font-weight:900;color:#22c55e;margin:8px 0 4px 0;">R$ ${saldoConsolidado}</div>
            <div style="font-size:.75rem;color:#64748b;">Soma dos saldos atuais no Neon</div>
          </div>
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;">
            <div style="font-size:.75rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Índice Global de Conciliação</div>
            <div style="font-size:1.8rem;font-weight:900;color:${taxaGlobal>=80?'#22c55e':taxaGlobal>=50?'#f59e0b':'#f97316'};margin:8px 0 4px 0;">${taxaGlobal}%</div>
            <div style="font-size:.75rem;color:#64748b;">${concLanc} de ${totalLanc} lançamentos conciliados</div>
          </div>
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;">
            <div style="font-size:.75rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Auditoria Bancária Multi-Tenant</div>
            <div style="font-size:1.8rem;font-weight:900;color:var(--accent2);margin:8px 0 4px 0;">Ativa 🛡️</div>
            <div style="font-size:.75rem;color:#64748b;">Isolamento estrito por tenant_id</div>
          </div>
        </div>

        <!-- Section 1: Conciliação por Construtora -->
        <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden;margin-bottom:32px;">
          <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center;">
            <div>
              <h3 style="font-size:1.05rem;font-weight:800;color:#fff;margin:0 0 4px 0;">⚖️ Taxa de Conciliação por Empresa</h3>
              <div style="font-size:.75rem;color:#94a3b8;">Acompanhamento da integridade contábil dos lançamentos frente aos extratos bancários</div>
            </div>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;text-align:left;font-size:.82rem;">
              <thead>
                <tr style="background:rgba(255,255,255,.03);color:#94a3b8;font-size:.72rem;text-transform:uppercase;">
                  <th style="padding:11px 16px;">Empresa</th>
                  <th style="padding:11px 16px;text-align:center;">Contas</th>
                  <th style="padding:11px 16px;text-align:right;">Saldo em Contas</th>
                  <th style="padding:11px 16px;text-align:center;">Taxa de Conciliação</th>
                  <th style="padding:11px 16px;text-align:center;">Status</th>
                </tr>
              </thead>
              <tbody>${statsRows}</tbody>
            </table>
          </div>
        </div>

        <!-- Section 2: Contas Bancárias Cadastradas -->
        <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden;">
          <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center;">
            <div>
              <h3 style="font-size:1.05rem;font-weight:800;color:#fff;margin:0 0 4px 0;">💳 Contas Bancárias Cadastradas no SaaS</h3>
              <div style="font-size:.75rem;color:#94a3b8;">Relação de contas correntes e aplicações cadastradas pelas construtoras</div>
            </div>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;text-align:left;font-size:.82rem;">
              <thead>
                <tr style="background:rgba(255,255,255,.03);color:#94a3b8;font-size:.72rem;text-transform:uppercase;">
                  <th style="padding:11px 16px;">Empresa</th>
                  <th style="padding:11px 16px;">Banco / Tipo</th>
                  <th style="padding:11px 16px;">Agência &amp; Conta</th>
                  <th style="padding:11px 16px;">Titular / Apelido</th>
                  <th style="padding:11px 16px;">Obra Vinculada</th>
                  <th style="padding:11px 16px;text-align:right;">Saldo Atual</th>
                </tr>
              </thead>
              <tbody>${accountRows}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  _renderErrosSaaS() {
    const bundle = this._errorsGlobal || { errors:[], summary:{}, top_routes:[], clusters:[] };
    const summary = bundle.summary || {};
    const count24 = Number(summary.last_24h || 0);
    const count7d = Number(summary.last_7d || 0);
    const tenants24 = Number(summary.tenants_24h || 0);
    const anon24 = Number(summary.anonymous_24h || 0);

    const topRoutes = bundle.top_routes || [];
    const clusters = bundle.clusters || [];
    const recent = (bundle.errors || []).slice(0, 15);

    // Linhas de Clusters (Assinaturas Frequentes)
    const clusterRows = clusters.length ? clusters.map(c => {
      const sig = this._esc(c.signature || 'Erro Desconhecido');
      const src = this._esc(c.source || '—');
      const count = Number(c.count || 0);
      const tenants = Number(c.affected_tenants || 0);
      const lastSeen = c.last_seen ? new Date(c.last_seen).toLocaleString('pt-BR') : '—';
      const sampleId = this._esc(c.sample_id || '');

      return `
        <tr style="border-bottom:1px solid rgba(255,255,255,.06);">
          <td style="padding:10px 14px;font-weight:700;color:#fca5a5;max-width:350px;">
            <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${sig}">${sig}</div>
          </td>
          <td style="padding:10px 14px;color:#94a3b8;font-size:.72rem;font-family:monospace;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${src}
          </td>
          <td style="padding:10px 14px;text-align:center;font-weight:900;color:#f87171;">
            ${count}
          </td>
          <td style="padding:10px 14px;text-align:center;color:#38bdf8;font-weight:800;">
            ${tenants}
          </td>
          <td style="padding:10px 14px;color:#94a3b8;font-size:.75rem;">
            ${lastSeen}
          </td>
          <td style="padding:10px 14px;text-align:right;">
            <button data-error-id="${sampleId}" data-fb-click="MasterAdmin.abrirDetalhesErro" data-fb-click-n="1" data-fb-click-t0="dataset" data-fb-click-v0="errorId" style="background:rgba(56,189,248,.15);border:1px solid #38bdf8;color:#7dd3fc;border-radius:6px;padding:4px 9px;font-size:.72rem;font-weight:800;cursor:pointer;">
              🔍 Inspecionar
            </button>
          </td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="6" style="padding:22px;text-align:center;color:#64748b;">Nenhum cluster de erro identificado nos últimos 7 dias. ✨</td></tr>`;

    // Linhas de Erros Recentes
    const recentRows = recent.length ? recent.map(e => {
      const id = this._esc(e.id);
      const when = e.created_at ? new Date(e.created_at).toLocaleString('pt-BR') : '—';
      const tenant = this._esc(e.tenant_nome || e.tenant_id || 'Anônimo');
      const user = this._esc(e.usuario_nome || '—');
      const route = this._esc(e.route || 'Geral');
      const msg = this._esc(e.message || 'Erro');

      let meta = e.metadata;
      if (typeof meta === 'string') {
        try { meta = JSON.parse(meta); } catch {}
      }
      const hasBreadcrumbs = Array.isArray(meta?.breadcrumbs) && meta.breadcrumbs.length > 0;

      return `
        <tr style="border-bottom:1px solid rgba(255,255,255,.06);">
          <td style="padding:9px 12px;color:#94a3b8;white-space:nowrap;font-size:.75rem;">${this._esc(when)}</td>
          <td style="padding:9px 12px;font-weight:700;color:#fff;">${tenant}</td>
          <td style="padding:9px 12px;color:#cbd5e1;">${user}</td>
          <td style="padding:9px 12px;color:#38bdf8;font-weight:800;">${route}</td>
          <td style="padding:9px 12px;max-width:320px;">
            <div style="font-weight:700;color:#fca5a5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${this._esc(e.stack || msg)}">${msg}</div>
            <div style="font-size:.68rem;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this._esc(e.source || '')}</div>
          </td>
          <td style="padding:9px 12px;text-align:right;white-space:nowrap;">
            <button data-error-id="${id}" data-fb-click="MasterAdmin.abrirDetalhesErro" data-fb-click-n="1" data-fb-click-t0="dataset" data-fb-click-v0="errorId" style="background:${hasBreadcrumbs ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.08)'};border:1px solid ${hasBreadcrumbs ? '#22c55e' : 'rgba(255,255,255,.2)'};color:${hasBreadcrumbs ? '#86efac' : '#cbd5e1'};border-radius:6px;padding:4px 8px;font-size:.72rem;font-weight:800;cursor:pointer;" title="${hasBreadcrumbs ? 'Ver ações anteriores e stack' : 'Ver stack trace'}">
              ${hasBreadcrumbs ? '🎬 Replay' : '🔍 Stack'}
            </button>
          </td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="6" style="padding:22px;text-align:center;color:#64748b;">Nenhum erro de frontend registrado. ✅</td></tr>`;

    // Badges de Top Rotas
    const routeBadges = topRoutes.length ? topRoutes.map(r => `
      <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;font-size:.72rem;color:#e2e8f0;">
        <strong style="color:var(--accent2);">${this._esc(r.route)}:</strong> ${Number(r.count)}
      </span>
    `).join('') : '<span style="font-size:.72rem;color:#64748b;">Nenhuma rota com erros recorrentes</span>';

    return `
      <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden;margin-bottom:34px;">
        <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
          <div>
            <h3 style="font-size:1.05rem;font-weight:800;color:#fff;margin:0;">🛠️ Observabilidade &amp; Saúde do Sistema (Frontend SaaS)</h3>
            <div style="font-size:.72rem;color:#94a3b8;margin-top:3px;">Monitoramento de exceções em tempo real com captura de breadcrumbs e diagnóstico de falhas</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button data-fb-click="MasterAdmin.limparErrosAntigos" data-fb-click-n="0" style="background:rgba(239,68,68,.1);border:1px solid #ef4444;color:#fca5a5;border-radius:6px;padding:6px 12px;font-size:.75rem;font-weight:800;cursor:pointer;" title="Expurgar registros com mais de 30 dias">
              🧹 Limpar &gt; 30d
            </button>
            <button data-fb-click="Patch26Actions.masterReloadErrors" data-fb-click-n="0" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#cbd5e1;border-radius:6px;padding:6px 12px;font-size:.75rem;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
              <span>↻</span> Atualizar
            </button>
          </div>
        </div>

        <!-- 4 Cards de Métricas de Telemetria -->
        <div style="padding:18px 20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;background:rgba(0,0,0,.15);border-bottom:1px solid rgba(255,255,255,.06);">
          <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px 14px;">
            <div style="font-size:.7rem;color:#94a3b8;text-transform:uppercase;font-weight:700;">Erros (24h)</div>
            <div style="font-size:1.5rem;font-weight:900;color:${count24 ? '#f87171' : '#22c55e'};margin-top:4px;">${count24}</div>
            <div style="font-size:.68rem;color:#64748b;">Incidentes recentes</div>
          </div>
          <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px 14px;">
            <div style="font-size:.7rem;color:#94a3b8;text-transform:uppercase;font-weight:700;">Volume (7 dias)</div>
            <div style="font-size:1.5rem;font-weight:900;color:#e2e8f0;margin-top:4px;">${count7d}</div>
            <div style="font-size:.68rem;color:#64748b;">Total acumulado</div>
          </div>
          <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px 14px;">
            <div style="font-size:.7rem;color:#94a3b8;text-transform:uppercase;font-weight:700;">Empresas Impactadas</div>
            <div style="font-size:1.5rem;font-weight:900;color:${tenants24 ? '#f59e0b' : '#22c55e'};margin-top:4px;">${tenants24}</div>
            <div style="font-size:.68rem;color:#64748b;">Nas últimas 24 horas</div>
          </div>
          <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px 14px;">
            <div style="font-size:.7rem;color:#94a3b8;text-transform:uppercase;font-weight:700;">Pré-Auth / Anônimos</div>
            <div style="font-size:1.5rem;font-weight:900;color:${anon24 ? '#fb923c' : '#22c55e'};margin-top:4px;">${anon24}</div>
            <div style="font-size:.68rem;color:#64748b;">Login ou landing</div>
          </div>
        </div>

        <!-- Distribuição por Rotas -->
        <div style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span style="font-size:.75rem;font-weight:800;color:#94a3b8;">Rotas com mais incidentes:</span>
          ${routeBadges}
        </div>

        <!-- Clusters de Erros Frequentes -->
        <div style="padding:14px 20px 6px;border-bottom:1px solid rgba(255,255,255,.06);">
          <h4 style="font-size:.85rem;font-weight:800;color:#fff;margin:0 0 4px 0;">🎯 Assinaturas Agrupadas de Erros (Clusters 7d)</h4>
          <div style="font-size:.7rem;color:#94a3b8;">Problemas consolidados por causa-raiz para priorização de correções</div>
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;text-align:left;font-size:.76rem;">
            <thead>
              <tr style="background:rgba(255,255,255,.02);color:#94a3b8;">
                <th style="padding:9px 14px;">Assinatura / Mensagem</th>
                <th style="padding:9px 14px;">Origem</th>
                <th style="padding:9px 14px;text-align:center;">Qtd</th>
                <th style="padding:9px 14px;text-align:center;">Empresas</th>
                <th style="padding:9px 14px;">Última Ocorrência</th>
                <th style="padding:9px 14px;text-align:right;">Ação</th>
              </tr>
            </thead>
            <tbody>${clusterRows}</tbody>
          </table>
        </div>

        <!-- Logs Recentes de Incidentes -->
        <div style="padding:16px 20px 6px;border-top:1px solid rgba(255,255,255,.06);">
          <h4 style="font-size:.85rem;font-weight:800;color:#fff;margin:0 0 4px 0;">📜 Ocorrências Recentes &amp; Breadcrumbs</h4>
          <div style="font-size:.7rem;color:#94a3b8;">Eventos individuais com passos de navegação antes da falha</div>
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;text-align:left;font-size:.76rem;">
            <thead>
              <tr style="background:rgba(255,255,255,.02);color:#94a3b8;">
                <th style="padding:9px 12px;">Quando</th>
                <th style="padding:9px 12px;">Empresa</th>
                <th style="padding:9px 12px;">Usuário</th>
                <th style="padding:9px 12px;">Tela</th>
                <th style="padding:9px 12px;">Erro</th>
                <th style="padding:9px 12px;text-align:right;">Diagnóstico</th>
              </tr>
            </thead>
            <tbody>${recentRows}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  abrirDetalhesErro(errorId) {
    const bundle = this._errorsGlobal || { errors: [] };
    const errObj = (bundle.errors || []).find(e => e.id === errorId);
    if (!errObj) {
      alert('Registro de telemetria não encontrado.');
      return;
    }

    let meta = errObj.metadata;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch {}
    }
    meta = meta || {};

    const breadcrumbs = Array.isArray(meta.breadcrumbs) ? meta.breadcrumbs : [];
    const when = errObj.created_at ? new Date(errObj.created_at).toLocaleString('pt-BR') : '—';
    const tenant = this._esc(errObj.tenant_nome || errObj.tenant_id || 'Anônimo');
    const user = this._esc(errObj.usuario_nome || '—');
    const route = this._esc(errObj.route || 'Geral');
    const viewport = this._esc(meta.viewport || 'Não informada');
    const url = this._esc(meta.url || '—');
    const connection = this._esc(meta.connection || '—');
    const online = meta.online !== false ? '🟢 Online' : '🔴 Offline';
    const message = this._esc(errObj.message || 'Sem mensagem');
    const stack = this._esc(errObj.stack || 'Stack trace não disponível.');

    // Timeline dos passos
    const timelineHtml = breadcrumbs.length ? breadcrumbs.map((b, idx) => {
      const typeIcons = { click: '🖱️ Clique', navigation: '🧭 Navegação', action: '⚡ Ação', input: '⌨️ Entrada' };
      const icon = typeIcons[b.type] || '📌 Evento';
      const timeStr = b.t ? new Date(b.t).toLocaleTimeString('pt-BR') : `Passo ${idx + 1}`;
      return `
        <div style="display:flex;gap:12px;align-items:flex-start;padding:8px 0;border-left:2px solid var(--accent);margin-left:10px;padding-left:14px;position:relative;">
          <div style="position:absolute;left:-6px;top:10px;width:10px;height:10px;border-radius:50%;background:var(--accent);"></div>
          <div style="font-size:.72rem;color:#94a3b8;white-space:nowrap;min-width:60px;">${this._esc(timeStr)}</div>
          <div>
            <div style="font-size:.78rem;font-weight:800;color:#fff;">${icon} em <code style="color:var(--accent2);">${this._esc(b.target || 'elemento')}</code></div>
            ${b.details ? `<div style="font-size:.72rem;color:#cbd5e1;margin-top:2px;">${this._esc(b.details)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('') : '<div style="font-size:.75rem;color:#94a3b8;padding:10px 0;">Nenhum passo prévio registrado pelo navegador antes da falha.</div>';

    // Remove modal anterior se houver
    document.getElementById('modal-error-replay')?.remove();

    const modalEl = document.createElement('div');
    modalEl.id = 'modal-error-replay';
    modalEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(6px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';

    modalEl.innerHTML = `
      <div style="background:#0f172a;border:1px solid rgba(255,255,255,.15);border-radius:16px;max-width:760px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px -12px rgba(0,0,0,.7);">
        <div style="padding:18px 24px;border-bottom:1px solid rgba(255,255,255,.1);display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h3 style="font-size:1.15rem;font-weight:900;color:#fff;margin:0 0 3px 0;">🎬 Diagnóstico de Telemetria &amp; Replay</h3>
            <div style="font-size:.75rem;color:#94a3b8;">ID: ${this._esc(errObj.id)} · ${when}</div>
          </div>
          <button data-fb-click="MasterAdmin.fecharDetalhesErro" data-fb-click-n="0" style="background:transparent;border:none;color:#94a3b8;font-size:1.5rem;cursor:pointer;line-height:1;">&times;</button>
        </div>

        <div style="padding:20px 24px;">
          <!-- Informações de Contexto -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px;margin-bottom:18px;font-size:.78rem;">
            <div><span style="color:#94a3b8;">Empresa:</span> <strong style="color:#fff;">${tenant}</strong></div>
            <div><span style="color:#94a3b8;">Usuário:</span> <strong style="color:#fff;">${user}</strong></div>
            <div><span style="color:#94a3b8;">Tela / Rota:</span> <strong style="color:#38bdf8;">${route}</strong></div>
            <div><span style="color:#94a3b8;">Resolução:</span> <strong style="color:#fff;">${viewport}</strong></div>
            <div><span style="color:#94a3b8;">Conexão:</span> <strong style="color:#fff;">${online} (${connection})</strong></div>
            <div style="grid-column:1/-1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><span style="color:#94a3b8;">URL:</span> <code style="color:#cbd5e1;font-size:.72rem;">${url}</code></div>
          </div>

          <!-- Mensagem do Erro -->
          <div style="margin-bottom:18px;">
            <div style="font-size:.75rem;font-weight:800;color:#fca5a5;text-transform:uppercase;margin-bottom:6px;">Mensagem de Erro</div>
            <div style="background:rgba(239,68,68,.1);border:1px solid #ef4444;border-radius:8px;padding:12px;font-family:monospace;font-size:.8rem;color:#fca5a5;word-break:break-word;">
              ${message}
            </div>
          </div>

          <!-- Linha do Tempo de Breadcrumbs -->
          <div style="margin-bottom:18px;">
            <div style="font-size:.75rem;font-weight:800;color:#38bdf8;text-transform:uppercase;margin-bottom:8px;">Passos Anteriores à Falha (Replay)</div>
            <div style="background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:14px;">
              ${timelineHtml}
              <div style="display:flex;gap:12px;align-items:flex-start;padding:8px 0;margin-left:10px;padding-left:14px;position:relative;">
                <div style="position:absolute;left:-6px;top:10px;width:10px;height:10px;border-radius:50%;background:#ef4444;"></div>
                <div style="font-size:.72rem;color:#ef4444;font-weight:800;">💥 CRASH</div>
                <div style="font-size:.78rem;font-weight:800;color:#fca5a5;">Exceção capturada pela telemetria</div>
              </div>
            </div>
          </div>

          <!-- Stack Trace -->
          <div>
            <div style="font-size:.75rem;font-weight:800;color:#94a3b8;text-transform:uppercase;margin-bottom:6px;">Rastreamento de Pilha (Stack Trace)</div>
            <pre style="background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:12px;font-size:.72rem;color:#cbd5e1;overflow-x:auto;max-height:160px;margin:0;white-space:pre-wrap;word-break:break-word;">${stack}</pre>
          </div>
        </div>

        <div style="padding:14px 24px;border-top:1px solid rgba(255,255,255,.1);text-align:right;">
          <button data-fb-click="MasterAdmin.fecharDetalhesErro" data-fb-click-n="0" class="btn-primary" style="padding:8px 18px;border-radius:8px;font-weight:800;font-size:.82rem;">
            Fechar Diagnóstico
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);
  },

  fecharDetalhesErro() {
    document.getElementById('modal-error-replay')?.remove();
  },

  async limparErrosAntigos() {
    if (!confirm('Deseja realmente expurgar os registros de telemetria com mais de 30 dias?\n\nEssa ação é irreversível e ajuda a manter a base de dados enxuta.')) return;
    try {
      const resp = await this._fetchWithTimeout('/api/admin?action=clear_old_client_errors', {
        method: 'POST',
        headers: (typeof Auth !== 'undefined' ? Auth.getAuthHeaders() : { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ days: 30 })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) throw new Error(data.error || 'Falha ao limpar erros antigos.');
      alert(`🧹 ${data.message || 'Registros expurgados com sucesso!'}`);
      await this.carregarErrosSaaS(true);
      this.render(document.getElementById('master-content-area') ? 'master-content-area' : 'route-content');
    } catch (err) {
      alert(err?.message || 'Falha ao executar limpeza de telemetria.');
    }
  },

  async confirmarPagamento(invoiceId) {
    const inv = (this._billing?.invoices || []).find(i => i.id === invoiceId);
    if (!inv) return;
    const nome = inv.tenant_nome || inv.tenant_id || 'empresa';
    const valor = (Number(inv.amount_cents || 0) / 100).toFixed(2).replace('.', ',');
    const cycleNames = { monthly: '30 dias (Mensal)', quarterly: '90 dias (Trimestral)', semiannual: '180 dias (Semestral)', annual: '365 dias (Anual)' };
    const cycleDesc = cycleNames[inv.cycle] || '30 dias';
    if (!confirm(`Confirmar recebimento de R$ ${valor} da ${nome}? O plano será ativado/renovado por ${cycleDesc}.`)) return;
    try {
      const resp = await this._fetchWithTimeout('/api/admin?action=confirm_payment', {
        method:'POST',
        headers:(typeof Auth !== 'undefined' ? Auth.getAuthHeaders() : { 'Content-Type':'application/json' }),
        body:JSON.stringify({ invoiceId })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) throw new Error(data.error || 'Não foi possível confirmar o pagamento.');
      await Promise.all([this.carregarCobrancas(true), this.carregarEmpresas(true)]);
      alert(data.message || 'Pagamento confirmado com sucesso.');
      this.render(document.getElementById('master-content-area') ? 'master-content-area' : 'route-content');
    } catch (err) {
      alert(err?.message || 'Falha ao confirmar pagamento.');
    }
  },

  async simularWebhookPix(invoiceId) {
    const inv = (this._billing?.invoices || []).find(i => i.id === invoiceId);
    if (!inv) return;
    const nome = inv.tenant_nome || inv.tenant_id || 'empresa';
    const valor = (Number(inv.amount_cents || 0) / 100).toFixed(2).replace('.', ',');
    if (!confirm(`Simular recebimento de Webhook PIX de R$ ${valor} para a empresa "${nome}"?\n\nO sistema executará a liquidação automática, renovará o acesso e disparará o comprovante no WhatsApp.`)) return;

    try {
      const resp = await this._fetchWithTimeout('/api/admin?action=simulate_webhook_pix', {
        method: 'POST',
        headers: (typeof Auth !== 'undefined' ? Auth.getAuthHeaders() : { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          invoiceId: inv.id,
          txid: inv.txid,
          tenantId: inv.tenant_id,
          amount_cents: inv.amount_cents,
          gateway: 'simulated_master'
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) throw new Error(data.error || 'Falha ao processar simulação do webhook PIX.');
      await Promise.all([this.carregarCobrancas(true), this.carregarEmpresas(true)]);
      const wpStatus = data.receipt?.whatsapp?.success ? '✅ Enviado' : 'ℹ️ ' + (data.receipt?.whatsapp?.error || 'Não disparado');
      alert(`🎉 Webhook PIX processado com sucesso!\n\nEmpresa: ${data.invoice?.nome_fantasia || nome}\nNovo Vencimento: ${data.invoice?.vencimento || 'Atualizado'}\nWhatsApp Comprovante: ${wpStatus}`);
      this.render(document.getElementById('master-content-area') ? 'master-content-area' : 'route-content');
    } catch (err) {
      alert(err?.message || 'Falha ao simular webhook PIX.');
    }
  },

  async abrirSimuladorWebhookPix() {
    const empresas = this.getEmpresasLocal();
    const opcoes = empresas.slice(0, 15).map(e => `• ${e.id} (${e.nome_fantasia || e.razao_social || e.id})`).join('\n');
    const tenantId = prompt(`Informe o Tenant ID da empresa para simular o Webhook PIX:\n\nExemplos de empresas:\n${opcoes || 'Nenhuma empresa listada'}`);
    if (!tenantId || !tenantId.trim()) return;

    try {
      const resp = await this._fetchWithTimeout('/api/admin?action=simulate_webhook_pix', {
        method: 'POST',
        headers: (typeof Auth !== 'undefined' ? Auth.getAuthHeaders() : { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          tenantId: tenantId.trim(),
          amount: 279.90,
          gateway: 'simulated_master'
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) throw new Error(data.error || 'Falha ao simular recebimento.');
      await Promise.all([this.carregarCobrancas(true), this.carregarEmpresas(true)]);
      const wpStatus = data.receipt?.whatsapp?.success ? '✅ Enviado' : 'ℹ️ ' + (data.receipt?.whatsapp?.error || 'Não disparado');
      alert(`🎉 Webhook PIX recebido e liquidado com sucesso!\n\nEmpresa: ${data.invoice?.nome_fantasia || tenantId}\nNovo Vencimento: ${data.invoice?.vencimento || 'Atualizado'}\nWhatsApp Comprovante: ${wpStatus}`);
      this.render(document.getElementById('master-content-area') ? 'master-content-area' : 'route-content');
    } catch (err) {
      alert(err?.message || 'Falha ao simular webhook PIX.');
    }
  },

  _renderCobrancas() {
    const invoices = (this._billing?.invoices || []).slice(0, 20);
    const pendentes = invoices.filter(i => i.status === 'pending');
    const rows = invoices.length ? invoices.map(i => {
      const id = this._esc(i.id);
      const nome = this._esc(i.tenant_nome || i.tenant_id || '—');
      const plano = this._esc(i.plan_id || '—');
      const txid = this._esc(i.txid || '—');
      const valor = (Number(i.amount_cents || 0) / 100).toFixed(2).replace('.', ',');
      const statusMap = { pending:'🟡 Pendente', paid:'🟢 Pago', expired:'⚪ Expirado', canceled:'🔴 Cancelado' };
      const status = this._esc(statusMap[i.status] || i.status || '—');
      const cycleNames = { monthly:'Mensal', quarterly:'Trimestral', semiannual:'Semestral', annual:'Anual' };
      const cycleLabel = cycleNames[i.cycle] || (i.cycle && i.cycle !== 'monthly' ? i.cycle : '');
      const dt = i.created_at ? new Date(i.created_at).toLocaleString('pt-BR') : '—';
      return `<tr style="border-bottom:1px solid rgba(255,255,255,.06);"><td style="padding:11px 14px;font-weight:700;color:#fff;">${nome}</td><td style="padding:11px 14px;">${plano}${cycleLabel?` <span style="font-size:.7rem;color:var(--accent2)">(${cycleLabel})</span>`:''}</td><td style="padding:11px 14px;font-weight:800;">R$ ${valor}</td><td style="padding:11px 14px;font-family:monospace;font-size:.72rem;">${txid}</td><td style="padding:11px 14px;">${status}</td><td style="padding:11px 14px;color:#94a3b8;">${this._esc(dt)}</td><td style="padding:11px 14px;text-align:right;">${i.status==='pending' ? `<button data-invoice-id="${id}" data-fb-click="MasterAdmin.simularWebhookPix" data-fb-click-n="1" data-fb-click-t0="dataset" data-fb-click-v0="invoiceId" style="background:#0284c7;color:#fff;border:none;border-radius:6px;padding:6px 10px;font-size:.75rem;font-weight:800;cursor:pointer;margin-right:6px;" title="Simular Webhook PIX desta fatura">⚡ Webhook</button><button data-invoice-id="${id}" data-fb-click="MasterAdmin.confirmarPagamento" data-fb-click-n="1" data-fb-click-t0="dataset" data-fb-click-v0="invoiceId" style="background:#22c55e;color:#fff;border:none;border-radius:6px;padding:6px 10px;font-size:.75rem;font-weight:800;cursor:pointer;">✓ Confirmar</button>` : '—'}</td></tr>`;
    }).join('') : `<tr><td colspan="7" style="padding:28px;text-align:center;color:#64748b;">Nenhuma cobrança registrada ainda.</td></tr>`;
    return `<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden;margin-bottom:34px;"><div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;"><div style="display:flex;align-items:center;gap:12px;"><h3 style="font-size:1.05rem;font-weight:800;color:#fff;margin:0;">💳 Cobranças & Assinaturas</h3><span style="font-size:.78rem;color:${pendentes.length?'#f59e0b':'#22c55e'};font-weight:800;">${pendentes.length} pendente(s)</span></div><button data-fb-click="MasterAdmin.abrirSimuladorWebhookPix" data-fb-click-n="0" style="background:rgba(2,132,199,.15);border:1px solid #0284c7;color:#38bdf8;border-radius:6px;padding:6px 12px;font-size:.75rem;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;" title="Simular recebimento de pagamento via Webhook PIX">⚡ Testar Webhook PIX</button></div><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;text-align:left;font-size:.8rem;"><thead><tr style="background:rgba(255,255,255,.03);color:#94a3b8;font-size:.72rem;text-transform:uppercase;"><th style="padding:10px 14px;">Empresa</th><th style="padding:10px 14px;">Plano</th><th style="padding:10px 14px;">Valor</th><th style="padding:10px 14px;">TXID</th><th style="padding:10px 14px;">Status</th><th style="padding:10px 14px;">Criada</th><th style="padding:10px 14px;text-align:right;">Ação</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  },

  getEmpresasLocal() {
    try {
      const s = localStorage.getItem(this.STORAGE_EMPRESAS_KEY);
      if (s) return JSON.parse(s);
    } catch {}
    return [];
  },

  getEmpresas() {
    if (this._empresas) return this._empresas;
    return this.getEmpresasLocal();
  },

  salvarEmpresas(lista) {
    try { localStorage.setItem(this.STORAGE_EMPRESAS_KEY, JSON.stringify(lista)); } catch {}
  },

  isSuperAdmin() {
    const u = (typeof Auth !== 'undefined' && Auth.getUser()) || {};
    return u.perfil === 'superadmin';
  },

  _activeTab: 'empresas',

  switchTab(tab) {
    this._activeTab = tab;
    const target = document.getElementById('master-content-area') ? 'master-content-area' : 'route-content';
    this.render(target);
  },

  // ── RENDERIZAÇÃO DO PAINEL MASTER ──────────────────────────────────────────
  render(containerId = 'route-content') {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (!this.isSuperAdmin()) {
      el.innerHTML = `
        <div style="padding:60px 20px;text-align:center;color:#ef4444;">
          <div style="font-size:3rem;margin-bottom:12px;">🔒</div>
          <h2 style="font-size:1.4rem;font-weight:800;color:#fff;">Acesso Restrito ao Super Admin</h2>
          <p style="color:#94a3b8;font-size:.9rem;margin-top:6px;">Apenas o superadministrador da plataforma tem permissão para gerenciar as empresas e o faturamento SaaS.</p>
          <button data-fb-click="Patch26Actions.goAppDashboard" data-fb-click-n="0" class="btn-primary" style="margin-top:20px;padding:8px 20px;">Voltar ao Dashboard</button>
        </div>
      `;
      return;
    }

    if (!this._empresas && !this._isLoading) {
      el.innerHTML = `
        <div style="padding:80px 20px;text-align:center;color:#94a3b8;">
          <div style="font-size:2rem;margin-bottom:12px;">⏳</div>
          <p style="font-size:.95rem;font-weight:700;color:#fff;">Carregando empresas do banco de dados Neon...</p>
        </div>
      `;
      this.carregarEmpresas().then(() => this.render(containerId));
      return;
    }

    const empresas = this.getEmpresas();
    if (!this._billing && !this._billingLoading) this.carregarCobrancas().then(() => this.render(containerId));
    if (!this._errorsGlobal && !this._errorsGlobalLoading) this.carregarErrosSaaS().then(() => this.render(containerId));
    if (!this._integrity && !this._integrityLoading) this.carregarIntegridade().then(() => this.render(containerId));
    if (!this._bankAccounts && !this._bankAccountsLoading) this.carregarContasBancarias().then(() => this.render(containerId));

    // Cálculo das métricas globais
    const totalEmpresas = empresas.length;
    const ativas = empresas.filter(e => e.status === 'ativo').length;
    const trials = empresas.filter(e => e.status === 'trial').length;
    const totalObras = empresas.reduce((acc, e) => acc + (e.obrasQtd || 0), 0);
    const billingSummary = this._billing?.summary || {};
    const cobrancasPendentes = Number(billingSummary.pending_count || 0);
    const valorPendente = Number(billingSummary.pending_cents || 0) / 100;
    
    // MRR estimado
    const precos = { starter: 119.90, pro: 279.90, unlimited: 499.90 };
    const mrr = empresas.reduce((acc, e) => {
      if (e.status === 'ativo') {
        return acc + (precos[e.plano] || 279.90);
      }
      return acc;
    }, 0);

    const isSistema = this._activeTab === 'sistema';
    const isContas = this._activeTab === 'contas';
    const isAgenda = this._activeTab === 'agenda';
    const isEmpresas = !isSistema && !isContas && !isAgenda;

    let tabContent = '';
    if (isAgenda) {
      tabContent = this._renderAgendaDev();
    } else if (isContas) {
      tabContent = this._renderContasBancariasSaaS();
    } else if (isSistema) {
      tabContent = this._renderSistema();
    } else {
      tabContent = `
        <!-- Top Bar Master -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:26px;flex-wrap:wrap;gap:14px;">
          <div>
            <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(201,162,39,.15);border:1px solid var(--accent);color:var(--accent2);padding:4px 12px;border-radius:20px;font-size:.75rem;font-weight:800;margin-bottom:6px;">
              <span>🛡️</span><span>SUPER ADMIN MASTER BACKOFFICE</span>
            </div>
            <h2 style="font-size:1.6rem;font-weight:900;color:#fff;">Gestão de Empresas &amp; SaaS</h2>
            <div style="font-size:.82rem;color:#94a3b8;">Acompanhamento de construtoras cadastradas, faturamento e atendimento de suporte</div>
          </div>

          <div style="display:flex;align-items:center;gap:10px;">
            <button data-fb-click="MasterAdmin.abrirModalNovaEmpresa" data-fb-click-n="0" class="btn-primary" style="padding:10px 18px;border-radius:8px;font-weight:800;display:inline-flex;align-items:center;gap:8px;font-size:.85rem;">
              <span>➕ Nova Construtora</span>
            </button>
            <button data-fb-click="MasterAdmin.abrirModalPlanos" data-fb-click-n="0" class="btn-clean" style="padding:10px 16px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:#f0ead6;font-size:.85rem;font-weight:700;cursor:pointer;">
              <span>💎 Tabela de Planos</span>
            </button>
          </div>
        </div>

        <!-- 4 Cards de Métricas SaaS -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-bottom:28px;">
          
          <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px 20px;">
            <div style="font-size:.75rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;">Empresas Cadastradas</div>
            <div style="font-size:1.8rem;font-weight:900;color:#fff;margin:8px 0 4px;">${totalEmpresas}</div>
            <div style="font-size:.78rem;color:#22c55e;">${ativas} Ativas &bull; ${trials} em Trial</div>
          </div>

          <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px 20px;">
            <div style="font-size:.75rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;">Obras Gerenciadas</div>
            <div style="font-size:1.8rem;font-weight:900;color:var(--accent2);margin:8px 0 4px;">${totalObras}</div>
            <div style="font-size:.78rem;color:#94a3b8;">Somatório de todos os clientes</div>
          </div>

          <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px 20px;">
            <div style="font-size:.75rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;">MRR (Receita Recorrente)</div>
            <div style="font-size:1.8rem;font-weight:900;color:#22c55e;margin:8px 0 4px;">R$ ${mrr.toFixed(2).replace('.', ',')}</div>
            <div style="font-size:.78rem;color:#94a3b8;">Estimativa dos assinantes ativos</div>
          </div>

          <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px 20px;">
            <div style="font-size:.75rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;">Cobranças Pendentes</div>
            <div style="font-size:1.8rem;font-weight:900;color:#f59e0b;margin:8px 0 4px;">${cobrancasPendentes}</div>
            <div style="font-size:.78rem;color:#94a3b8;">R$ ${valorPendente.toFixed(2).replace('.', ',')} aguardando confirmação</div>
          </div>

        </div>

        <!-- Tabela de Construtoras / Clientes -->
        <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden;margin-bottom:34px;">
          <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;">
            <h3 style="font-size:1.05rem;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px;">
              <span>🏢 Construtoras &amp; Clientes Cadastrados</span>
              <span style="font-size:.75rem;background:rgba(255,255,255,.08);padding:2px 8px;border-radius:12px;color:#94a3b8;">${empresas.length}</span>
            </h3>
            <span style="font-size:.78rem;color:#94a3b8;">Gestão multi-tenant</span>
          </div>

          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;text-align:left;font-size:.85rem;">
              <thead>
                <tr style="background:rgba(255,255,255,.03);border-bottom:1px solid rgba(255,255,255,.06);color:#94a3b8;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;">
                  <th style="padding:12px 18px;">Empresa / Construtora</th>
                  <th style="padding:12px 18px;">CNPJ</th>
                  <th style="padding:12px 18px;">Responsável / Contato</th>
                  <th style="padding:12px 18px;">Plano</th>
                  <th style="padding:12px 18px;">Obras</th>
                  <th style="padding:12px 18px;">Status</th>
                  <th style="padding:12px 18px;">Vencimento</th>
                  <th style="padding:12px 18px;text-align:right;">Ações</th>
                </tr>
              </thead>
              <tbody>
                ${empresas.map(e => this._renderLinhaEmpresa(e)).join('')}
              </tbody>
            </table>
          </div>
        </div>

        ${this._renderCobrancas()}

        ${this._renderErrosSaaS()}

        <!-- Central de Atendimento exclusiva do DEV / Master -->
        ${typeof SuporteDev !== 'undefined' ? SuporteDev.renderResumoCard() : `
          <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;color:#94a3b8;">
            💬 Central de Atendimento DEV carregando...
          </div>
        `}
      `;
    }

    el.innerHTML = `
      <div style="max-width:1200px;margin:0 auto;padding:10px 0 50px;">
        
        <!-- Navigation Tabs Master -->
        <div style="display:flex;gap:0;border-bottom:2px solid rgba(255,255,255,.1);margin-bottom:26px;overflow-x:auto;">
          <button data-fb-click="MasterAdmin.switchTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="empresas" style="padding:12px 20px;border:none;background:transparent;color:${isEmpresas?'var(--accent)':'#94a3b8'};font-family:inherit;font-size:.875rem;font-weight:800;cursor:pointer;border-bottom:3px solid ${isEmpresas?'var(--accent)':'transparent'};margin-bottom:-2px;transition:all .2s;display:flex;align-items:center;gap:8px;">
            <span>🏢</span> Gestão de Construtoras &amp; SaaS
          </button>
          <button data-fb-click="MasterAdmin.switchTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="contas" style="padding:12px 20px;border:none;background:transparent;color:${isContas?'var(--accent)':'#94a3b8'};font-family:inherit;font-size:.875rem;font-weight:800;cursor:pointer;border-bottom:3px solid ${isContas?'var(--accent)':'transparent'};margin-bottom:-2px;transition:all .2s;display:flex;align-items:center;gap:8px;">
            <span>🏦</span> Contas Bancárias &amp; Conciliação
          </button>
          <button data-fb-click="MasterAdmin.switchTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="agenda" style="padding:12px 20px;border:none;background:transparent;color:${isAgenda?'var(--accent)':'#94a3b8'};font-family:inherit;font-size:.875rem;font-weight:800;cursor:pointer;border-bottom:3px solid ${isAgenda?'var(--accent)':'transparent'};margin-bottom:-2px;transition:all .2s;display:flex;align-items:center;gap:8px;">
            <span>📅</span> Agenda &amp; Lives Dev
          </button>
          <button data-fb-click="MasterAdmin.switchTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="sistema" style="padding:12px 20px;border:none;background:transparent;color:${isSistema?'var(--accent)':'#94a3b8'};font-family:inherit;font-size:.875rem;font-weight:800;cursor:pointer;border-bottom:3px solid ${isSistema?'var(--accent)':'transparent'};margin-bottom:-2px;transition:all .2s;display:flex;align-items:center;gap:8px;">
            <span>⚙️</span> Manutenção do Sistema &amp; Banco de Dados (Dev / Master)
          </button>
        </div>

        ${tabContent}

      </div>
    `;
    if (typeof SuporteDev !== 'undefined') setTimeout(() => SuporteDev.initNotifications(), 50);
  },

  // ── ABA SISTEMA & BANCO DE DADOS (DEV / MASTER) ────────────────────────────
  _renderSistema() {
    const totalClientes = (typeof DB !== 'undefined' && DB.getAll) ? DB.getAll('clientes').length : 0;
    const totalLancamentos = (typeof DB !== 'undefined' && DB.getAll) ? DB.getAll('lancamentos').length : 0;
    const totalFornecedores = (typeof DB !== 'undefined' && DB.getAll) ? DB.getAll('fornecedores').length : 0;
    const snapshotRaw = localStorage.getItem('finobra_snapshot_seguranca');
    let snapshotInfo = 'Nenhum snapshot gravado ainda.';
    if (snapshotRaw) {
      try {
        const snap = JSON.parse(snapshotRaw);
        snapshotInfo = `Último snapshot: ${snap.saved_at ? new Date(snap.saved_at).toLocaleString('pt-BR') : '—'} (${snap.totalLancamentos || 0} lançamentos)`;
      } catch {}
    }

    return `
      <div>
        <div style="margin-bottom:22px;">
          <h2 style="font-size:1.45rem;font-weight:900;color:#fff;margin:0 0 6px;">⚙️ Manutenção do Sistema &amp; Infraestrutura (Super Admin)</h2>
          <p style="color:#94a3b8;font-size:.85rem;margin:0;">Painel restrito para controle do banco de dados Neon PostgreSQL, restauração de snapshots, backups de emergência e servidor WhatsApp.</p>
        </div>

        ${this._renderIntegridade()}

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(360px, 1fr));gap:20px;margin-bottom:24px;">
          
          <!-- Card Gerenciamento de Dados -->
          <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;">
            <div style="font-size:.95rem;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px;margin-bottom:12px;">
              <span>🗄️</span> Gerenciamento e Limpeza de Dados
            </div>
            <p style="color:#94a3b8;font-size:.84rem;margin-bottom:8px;">
              <strong>Status do Ambiente:</strong> <span style="background:rgba(34,197,94,.15);color:#22c55e;padding:2px 8px;border-radius:6px;font-size:.75rem;font-weight:700;">Sistema em Produção</span>
            </p>
            <p style="color:#64748b;font-size:.8rem;margin-bottom:18px;">
              ${totalClientes} obra(s) cadastrada(s) &middot; ${totalLancamentos} lançamento(s) &middot; ${totalFornecedores} fornecedor(es) no cache local.
            </p>
            <button data-fb-click="MasterAdmin.limparDadosGlobal" data-fb-click-n="0" style="background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#fca5a5;padding:9px 16px;border-radius:8px;font-size:.8rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;">
              <span>🗑️</span> Zerar / Limpar Todos os Dados Locais
            </button>
          </div>

          <!-- Card Backup & Restauração -->
          <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;">
            <div style="font-size:.95rem;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px;margin-bottom:12px;">
              <span>💾</span> Backup &amp; Restauração JSON
            </div>
            <p style="color:#94a3b8;font-size:.84rem;margin-bottom:14px;">Exporte ou restaure todos os cadastros, despesas, obras, orçamentos e comprovantes em arquivo JSON.</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
              <button data-fb-click="MasterAdmin.exportarBackup" data-fb-click-n="0" style="background:var(--accent);color:#0f1710;padding:8px 16px;border-radius:8px;font-size:.8rem;font-weight:800;border:none;cursor:pointer;">
                ⬇️ Baixar Backup JSON
              </button>
              <button data-fb-click="Patch26Actions.clickById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="master-import-backup-input" style="background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.15);padding:8px 16px;border-radius:8px;font-size:.8rem;font-weight:700;cursor:pointer;">
                ⬆️ Restaurar Arquivo JSON
              </button>
              <input type="file" id="master-import-backup-input" accept=".json,application/json" style="display:none;" data-fb-change="MasterAdmin.importarBackup" data-fb-change-n="1" data-fb-change-t0="self">
            </div>
            <div style="background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:10px 14px;font-size:.78rem;color:#94a3b8;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
              <span>🛡️ ${snapshotInfo}</span>
              <button data-fb-click="MasterAdmin.criarSnapshot" data-fb-click-n="0" style="background:none;border:none;color:var(--accent2);text-decoration:underline;cursor:pointer;font-size:.76rem;">
                Criar Ponto de Restauração
              </button>
            </div>
          </div>

          <!-- Card Neon PostgreSQL -->
          <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;">
            <div style="font-size:.95rem;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px;margin-bottom:12px;">
              <span>🐘</span> Banco de Dados em Nuvem (Neon PostgreSQL)
            </div>
            <p style="color:#94a3b8;font-size:.84rem;margin-bottom:14px;">
              PostgreSQL Serverless conectado em tempo real (AWS São Paulo sa-east-1). Multi-tenancy isolado cryptograficamente.
            </p>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px;">
              <button data-fb-click="MasterAdmin.sincronizarTudoNeon" data-fb-click-n="0" style="background:var(--accent);color:#0f1710;padding:8px 16px;border-radius:8px;font-size:.8rem;font-weight:800;border:none;cursor:pointer;">
                🔄 Sincronizar Tudo para o Neon
              </button>
              <button data-fb-click="MasterAdmin.baixarDadosNeon" data-fb-click-n="0" style="background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.15);padding:8px 16px;border-radius:8px;font-size:.8rem;font-weight:700;cursor:pointer;">
                ⬇️ Recarregar do Neon
              </button>
            </div>
            <div style="font-size:.76rem;color:#22c55e;background:rgba(34,197,94,.1);padding:6px 12px;border-radius:6px;display:inline-flex;align-items:center;gap:6px;">
              <span>🟢 Neon PostgreSQL Conectado &middot; AWS sa-east-1 (São Paulo)</span>
            </div>
          </div>

          <!-- Card WhatsApp Server 24/7 -->
          <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <div style="font-size:.95rem;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px;">
                <span>📲</span> Servidor 24/7 de WhatsApp (Baileys Render)
              </div>
              <span style="font-size:.72rem;background:rgba(37,211,102,.12);color:#25D366;padding:3px 8px;border-radius:999px;font-weight:700;">
                ⚡ Servidor Nuvem
              </span>
            </div>
            <p style="color:#94a3b8;font-size:.84rem;margin-bottom:16px;">
              Instância autônoma no Render com persistência de chaves de autenticação no PostgreSQL Neon. Dispara relatórios diários matinais e alertas de boletos.
            </p>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <button data-fb-click="WhatsApp.abrirModalConexao" data-fb-click-n="0" style="background:#25D366;color:#fff;font-weight:800;font-size:.8rem;border:none;padding:9px 16px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:6px;">
                📲 Abrir Conexão &amp; QR Code
              </button>
            </div>
          </div>

        </div>

        <!-- Card Sobre o Sistema -->
        <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;">
          <div style="font-size:.95rem;font-weight:800;color:#fff;margin-bottom:14px;">ℹ️ Diagnóstico &amp; Metadados do Sistema</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;font-size:.84rem;">
            <div><div style="color:#64748b;margin-bottom:4px;">Sistema / Plataforma</div><div style="font-weight:700;color:#fff;">FinGo SaaS Backoffice</div></div>
            <div><div style="color:#64748b;margin-bottom:4px;">Versão em Produção</div><div style="font-weight:700;color:#fff;">2.4.0 (FinGo Cloud)</div></div>
            <div><div style="color:#64748b;margin-bottom:4px;">Armazenamento Central</div><div style="font-weight:700;color:#22c55e;">🐘 Neon PostgreSQL + Vercel Blob</div></div>
            <div><div style="color:#64748b;margin-bottom:4px;">Isolamento Multi-Tenant</div><div style="font-weight:700;color:#22c55e;">Ativo (Cryptographic Tenant Tokens)</div></div>
          </div>
        </div>

      </div>
    `;
  },

  limparDadosGlobal() {
    Utils.confirm('🚨 ATENÇÃO SUPER ADMIN: Deseja realmente zerar todos os dados locais do sistema? Esta ação é irreversível.', () => {
      if (typeof App !== 'undefined' && App.clearAllData) {
        App.clearAllData();
      } else {
        localStorage.clear();
        sessionStorage.clear();
        location.reload();
      }
    });
  },

  criarSnapshot() {
    if (typeof Configuracoes !== 'undefined' && Configuracoes.criarSnapshot) {
      Configuracoes.criarSnapshot();
    } else {
      Utils.toast('Ponto de restauração gravado!', 'info');
    }
  },

  exportarBackup() {
    if (typeof Configuracoes !== 'undefined' && Configuracoes.exportarBackup) {
      Configuracoes.exportarBackup();
    } else {
      Utils.toast('Função de exportação indisponível.', 'warning');
    }
  },

  importarBackup(input) {
    if (typeof Configuracoes !== 'undefined' && Configuracoes.importarBackup) {
      Configuracoes.importarBackup(input);
    } else {
      Utils.toast('Função de importação indisponível.', 'warning');
    }
  },

  async sincronizarTudoNeon() {
    if (typeof Configuracoes !== 'undefined' && Configuracoes.sincronizarTudoNeon) {
      await Configuracoes.sincronizarTudoNeon();
    } else if (typeof DB !== 'undefined' && DB.syncAllToCloud) {
      await DB.syncAllToCloud();
    }
  },

  async baixarDadosNeon() {
    if (typeof Configuracoes !== 'undefined' && Configuracoes.baixarDadosNeon) {
      await Configuracoes.baixarDadosNeon();
    } else if (typeof DB !== 'undefined' && DB.syncFromCloud) {
      await DB.syncFromCloud();
    }
  },

  _renderLinhaEmpresa(e) {
    const badgeStatus = {
      'ativo': '<span style="background:rgba(34,197,94,.15);color:#22c55e;border:1px solid rgba(34,197,94,.3);padding:2px 8px;border-radius:10px;font-size:.72rem;font-weight:700;">🟢 Ativo</span>',
      'trial': '<span style="background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3);padding:2px 8px;border-radius:10px;font-size:.72rem;font-weight:700;">🟡 Em Teste (Trial)</span>',
      'inadimplente': '<span style="background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3);padding:2px 8px;border-radius:10px;font-size:.72rem;font-weight:700;">🔴 Inadimplente</span>',
      'bloqueado': '<span style="background:rgba(148,163,184,.15);color:#94a3b8;border:1px solid rgba(148,163,184,.3);padding:2px 8px;border-radius:10px;font-size:.72rem;font-weight:700;">⚪ Bloqueado</span>',
      'cancelado': '<span style="background:rgba(239,68,68,.12);color:#f87171;border:1px solid rgba(239,68,68,.25);padding:2px 8px;border-radius:10px;font-size:.72rem;font-weight:700;">⛔ Cancelado</span>'
    };
    const planosNome = { starter:'Básico (R$ 119,90)', pro:'Profissional (R$ 279,90)', unlimited:'Ilimitado (R$ 499,90)', trial:'Trial' };
    const nome=this._esc(e.nome_fantasia), razao=this._esc(e.razao_social||''), cnpj=this._esc(e.cnpj||'—');
    const resp=this._esc(e.responsavel||'—'), contato=this._esc(e.telefone||e.email||'—');
    const plano=this._esc(planosNome[e.plano]||e.plano||'—');
    const id=String(e.id||''); // IDs de tenant são gerados pelo servidor e não são texto livre.
    const telDigits=String(e.telefone||'').replace(/\D/g,'');
    const wa=(telDigits ? (telDigits.startsWith('55')?telDigits:'55'+telDigits) : '5595991363678');
    const waText=encodeURIComponent(`Olá, ${e.responsavel||''}! Aqui é do FinGo referente à assinatura da ${e.nome_fantasia||''}.`);

    let vencHtml = '<span style="color:#64748b;">—</span>';
    if (e.vencimento) {
      const parts = String(e.vencimento).split('-');
      const fmtData = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : e.vencimento;
      const dr = e.diasRestantes;
      if (e.status === 'trial') {
        if (dr > 0) {
          vencHtml = `<div><span style="font-weight:700;color:#f59e0b;">${fmtData}</span></div><div style="font-size:.7rem;color:#fbbf24;">(restam ${dr} dia${dr>1?'s':''})</div>`;
        } else if (dr === 0) {
          vencHtml = `<div><span style="font-weight:700;color:#ef4444;">${fmtData}</span></div><div style="font-size:.7rem;color:#f87171;font-weight:700;">(vence hoje)</div>`;
        } else {
          const pass = Math.abs(dr);
          vencHtml = `<div><span style="font-weight:700;color:#ef4444;">${fmtData}</span></div><div style="font-size:.7rem;color:#f87171;font-weight:700;">(expirado há ${pass}d)</div>`;
        }
      } else if (e.status === 'ativo') {
        if (dr > 5) {
          vencHtml = `<div><span style="font-weight:700;color:#22c55e;">${fmtData}</span></div><div style="font-size:.7rem;color:#86efac;">(em ${dr} dias)</div>`;
        } else if (dr >= 0) {
          vencHtml = `<div><span style="font-weight:700;color:#f59e0b;">${fmtData}</span></div><div style="font-size:.7rem;color:#fbbf24;">(renovação próxima)</div>`;
        } else {
          vencHtml = `<div><span style="font-weight:700;color:#ef4444;">${fmtData}</span></div><div style="font-size:.7rem;color:#f87171;">(vencido)</div>`;
        }
      } else {
        vencHtml = `<div><span style="font-weight:700;color:#94a3b8;">${fmtData}</span></div>`;
      }
    }

    const keyBadge = e.access_key_last4
      ? `<span style="display:inline-block;margin-top:4px;font-size:.68rem;padding:2px 6px;border-radius:4px;background:rgba(201,162,39,.12);color:var(--accent2);border:1px solid rgba(201,162,39,.25);font-family:monospace;" title="Chave da Empresa ativa">🔑 ...${this._esc(e.access_key_last4)}</span>`
      : `<span style="display:inline-block;margin-top:4px;font-size:.68rem;padding:2px 6px;border-radius:4px;background:rgba(239,68,68,.12);color:#fca5a5;border:1px solid rgba(239,68,68,.25);" title="Sem Chave de Acesso configurada">⚠️ Sem Chave</span>`;

    return `
      <tr style="border-bottom:1px solid rgba(255,255,255,.04);transition:background .15s;">
        <td style="padding:14px 18px;"><div style="font-weight:800;color:#fff;">${nome}</div><div style="font-size:.72rem;color:#94a3b8;">${razao}</div>${keyBadge}</td>
        <td style="padding:14px 18px;font-family:monospace;font-size:.78rem;color:#cbd5e1;">${cnpj}</td>
        <td style="padding:14px 18px;"><div style="color:#e2e8f0;">${resp}</div><div style="font-size:.72rem;color:#94a3b8;">${contato}</div></td>
        <td style="padding:14px 18px;font-weight:700;color:var(--accent2);font-size:.8rem;">${plano}</td>
        <td style="padding:14px 18px;font-weight:700;color:#fff;">${Number(e.obrasQtd||0)}</td>
        <td style="padding:14px 18px;">${badgeStatus[e.status] || this._esc(e.status||'—')}</td>
        <td style="padding:14px 18px;">${vencHtml}</td>
        <td style="padding:14px 18px;text-align:right;">
          <div style="display:inline-flex;gap:6px;">
            <button data-tenant-id="${this._esc(id)}" data-fb-click="MasterAdmin.impersonarEmpresa" data-fb-click-n="1" data-fb-click-t0="dataset" data-fb-click-v0="tenantId" title="Acessar sistema como esta empresa para dar suporte" style="background:rgba(201,162,39,.15);border:1px solid var(--accent);color:var(--accent2);padding:4px 8px;border-radius:6px;font-size:.75rem;font-weight:700;cursor:pointer;">👁️ Acessar</button>
            <button data-tenant-id="${this._esc(id)}" data-fb-click="MasterAdmin.abrirModalCobranca" data-fb-click-n="1" data-fb-click-t0="dataset" data-fb-click-v0="tenantId" title="Cobrar / Notificar assinatura (WhatsApp e E-mail)" style="background:rgba(34,197,94,.15);border:1px solid #22c55e;color:#22c55e;padding:4px 8px;border-radius:6px;font-size:.75rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;">💬 Cobrar</button>
            <button data-tenant-id="${this._esc(id)}" data-fb-click="MasterAdmin.alterarStatusEmpresa" data-fb-click-n="1" data-fb-click-t0="dataset" data-fb-click-v0="tenantId" title="Alterar status, plano ou vencimento" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);color:#cbd5e1;padding:4px 8px;border-radius:6px;font-size:.75rem;cursor:pointer;">✏️</button>
          </div>
        </td>
      </tr>`;
  },

  // ── IMPERSONATE: ACESSAR COMO A EMPRESA PARA SUPORTE ───────────────────────
  async impersonarEmpresa(tenantId) {
    const empresas = this.getEmpresas();
    const emp = empresas.find(e => e.id === tenantId);
    const nomeEmp = emp ? (emp.nome_fantasia || emp.razao_social) : tenantId;

    if (!confirm(`Deseja alternar a visualização para a empresa "${nomeEmp}" para prestar suporte?\n\nOs dados da tela serão isolados exclusivamente para esta empresa.`)) {
      return;
    }

    try {
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast('Alternando ambiente para a empresa...', 'info');
      }

      // Mantém sessão/token Master originais para retorno seguro ao backoffice.
      if (typeof Auth !== 'undefined' && Auth.backupSessionForImpersonation) {
        Auth.backupSessionForImpersonation();
      } else {
        const currentSession = (typeof Auth !== 'undefined' && Auth.getSession()) || {};
        sessionStorage.setItem('finobra_master_backup_session', JSON.stringify(currentSession));
      }

      // Registra a entrada no suporte antes de trocar o token.
      try {
        await this._fetchWithTimeout('/api/admin?action=support_start', {
          method: 'POST',
          headers: (typeof Auth !== 'undefined' && Auth.getAuthHeaders) ? Auth.getAuthHeaders() : { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId })
        });
      } catch {}

      // O backend emite um token de curta duração já vinculado ao tenant selecionado.
      const res = await this._fetchWithTimeout('/api/admin?action=impersonate', {
        method: 'POST',
        headers: (typeof Auth !== 'undefined' && Auth.getAuthHeaders) ? Auth.getAuthHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.session) {
        throw new Error(data.error || 'Não foi possível acessar os dados da empresa solicitada.');
      }

      // O token de impersonação agora vive apenas em cookie HttpOnly. Remove o
      // snapshot Master local e grava somente metadados da sessão visual de suporte.
      localStorage.removeItem('finobra_session');
      sessionStorage.removeItem('finobra_session');
      localStorage.removeItem('finobra_token');
      sessionStorage.removeItem('finobra_token');
      if (typeof Auth !== 'undefined' && Auth.createSession) Auth.createSession(data.session, false);
      else sessionStorage.setItem('finobra_session', JSON.stringify(data.session));

      window.location.href = '/app/dashboard';
    } catch (err) {
      alert('Erro de comunicação ao acessar a empresa: ' + (err?.message || err));
    }
  },

  abrirModalPlanos() {
    const rawPlans = (typeof Cobranca !== 'undefined' && Cobranca.PLANOS) ? Cobranca.PLANOS : {};
    const formatPrice = (plan, fallback) => {
      if (plan && plan.valorTexto) return plan.valorTexto;
      if (plan && typeof plan.valorMensal === 'number') {
        return (typeof Utils !== 'undefined' && Utils.formatCurrency
          ? Utils.formatCurrency(plan.valorMensal)
          : `R$ ${plan.valorMensal.toFixed(2).replace('.', ',')}`) + ' / mês';
      }
      return fallback;
    };

    const p = {
      starter: {
        nome: rawPlans.starter?.nome || 'Plano Básico',
        valorTexto: formatPrice(rawPlans.starter, 'R$ 119,90 / mês'),
        limiteObras: rawPlans.starter?.limiteObras ?? 3
      },
      pro: {
        nome: rawPlans.pro?.nome || 'Plano Profissional',
        valorTexto: formatPrice(rawPlans.pro, 'R$ 279,90 / mês'),
        limiteObras: rawPlans.pro?.limiteObras ?? 10
      },
      unlimited: {
        nome: rawPlans.unlimited?.nome || 'Construtora Ilimitado',
        valorTexto: formatPrice(rawPlans.unlimited, 'R$ 499,90 / mês'),
        limiteObras: rawPlans.unlimited?.limiteObras || 'ILIMITADAS'
      }
    };

    Utils.showModal(`
      <div class="modal" style="max-width:720px;background:#0f1a0b;border:1px solid var(--border);color:#f0ead6;">
        <div class="modal-header" style="border-bottom:1px solid rgba(201,162,39,.25);">
          <span class="modal-title" style="color:var(--accent2);font-weight:900;">💎 Tabela de Planos &amp; Mensalidades SaaS</span>
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>
        <div class="modal-body" style="padding:20px;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;">
            
            <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px;">
              <div style="font-weight:800;font-size:1.05rem;color:#fff;">${p.starter.nome}</div>
              <div style="font-size:1.25rem;font-weight:900;color:var(--accent2);margin:6px 0;">${p.starter.valorTexto}</div>
              <div style="font-size:.78rem;color:#94a3b8;margin-bottom:12px;">Até ${p.starter.limiteObras} Obras Ativas simultâneas</div>
              <ul style="font-size:.75rem;color:#cbd5e1;padding-left:18px;line-height:1.6;margin:0;">
                <li>Financeiro de Receitas e Despesas</li>
                <li>Medições e Cronograma</li>
                <li>Conciliação Bancária OFX</li>
                <li>Exportação de Relatórios</li>
              </ul>
            </div>

            <div style="background:rgba(201,162,39,.06);border:1px solid var(--accent);border-radius:10px;padding:16px;position:relative;">
              <div style="position:absolute;top:-10px;right:12px;background:var(--accent);color:#182713;font-size:.65rem;font-weight:900;padding:2px 8px;border-radius:10px;">MAIS POPULAR</div>
              <div style="font-weight:800;font-size:1.05rem;color:#fff;">${p.pro.nome}</div>
              <div style="font-size:1.25rem;font-weight:900;color:var(--accent2);margin:6px 0;">${p.pro.valorTexto}</div>
              <div style="font-size:.78rem;color:#94a3b8;margin-bottom:12px;">Até ${p.pro.limiteObras} Obras Ativas simultâneas</div>
              <ul style="font-size:.75rem;color:#cbd5e1;padding-left:18px;line-height:1.6;margin:0;">
                <li>Tudo do Plano Básico</li>
                <li>Leitura OCR de NF com IA</li>
                <li>Assinatura Eletrônica com QR Code</li>
                <li>Portal Público de Validação</li>
                <li>Gestão de Ordens de Compra</li>
              </ul>
            </div>

            <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px;">
              <div style="font-weight:800;font-size:1.05rem;color:#fff;">${p.unlimited.nome}</div>
              <div style="font-size:1.25rem;font-weight:900;color:var(--accent2);margin:6px 0;">${p.unlimited.valorTexto}</div>
              <div style="font-size:.78rem;color:#94a3b8;margin-bottom:12px;">Obras e Clientes ILIMITADOS</div>
              <ul style="font-size:.75rem;color:#cbd5e1;padding-left:18px;line-height:1.6;margin:0;">
                <li>Tudo do Plano Profissional</li>
                <li>Obras e Clientes sem limite</li>
                <li>Multi-usuários com controle RBAC</li>
                <li>Planilhas SINAPI / Caixa</li>
                <li>Suporte Prioritário VIP</li>
              </ul>
            </div>

          </div>
        </div>
        <div class="modal-footer" style="border-top:1px solid rgba(201,162,39,.2);justify-content:space-between;">
          <a href="/app/planos" class="btn btn-secondary" style="font-size:.8rem;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
            <span>Abrir Tela Completa no Sistema ↗</span>
          </a>
          <button type="button" class="btn btn-primary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Fechar</button>
        </div>
      </div>
    `);
  },

  alterarStatusEmpresa(tenantId) {
    this.abrirModalEditarEmpresa(tenantId);
  },

  abrirModalEditarEmpresa(tenantId) {
    const empresas = this.getEmpresas();
    const emp = empresas.find(e => e.id === tenantId);
    if (!emp) return;

    let modal = document.getElementById('master-editar-empresa-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'master-editar-empresa-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(6px);padding:16px;';
      document.body.appendChild(modal);
    }

    const vencAtual = emp.vencimento ? String(emp.vencimento).split('T')[0] : '';
    const nome = this._esc(emp.nome_fantasia || emp.id);

    modal.innerHTML = `
      <div style="background:#0f1710;border:1px solid rgba(201,162,39,.4);border-radius:14px;width:100%;max-width:520px;box-shadow:0 24px 60px rgba(0,0,0,.85);overflow:hidden;color:#f0ead6;font-family:inherit;">
        <div style="background:linear-gradient(135deg,#1C2D12,#243818);padding:16px 20px;border-bottom:1px solid rgba(201,162,39,.3);display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;">✏️</span>
            <div>
              <div style="font-weight:800;font-size:1rem;color:var(--accent2);">Gerenciar Construtora</div>
              <div style="font-size:.75rem;color:#94a3b8;">${nome}</div>
            </div>
          </div>
          <button data-fb-click="Patch26Actions.removeById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="master-editar-empresa-modal" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>
        </div>

        <form id="form-editar-tenant" data-fb-submit="MasterAdmin.salvarEdicaoEmpresa" data-fb-submit-n="2" data-fb-submit-t0="event" data-fb-submit-t1="string" data-fb-submit-v1="${encodeURIComponent(String(this._esc(emp.id)))}" style="padding:22px;display:flex;flex-direction:column;gap:14px;">
          <div>
            <label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:4px;">Status da Assinatura *</label>
            <select id="me-edit-status" style="width:100%;background:#182713;border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:9px 12px;color:#fff;font-size:.85rem;">
              <option value="trial" ${emp.status==='trial'?'selected':''}>🟡 Em Teste (Trial de 15 dias)</option>
              <option value="ativo" ${emp.status==='ativo'?'selected':''}>🟢 Ativo (Assinante regular)</option>
              <option value="inadimplente" ${emp.status==='inadimplente'?'selected':''}>🔴 Inadimplente (Fatura em aberto)</option>
              <option value="bloqueado" ${emp.status==='bloqueado'?'selected':''}>⚪ Bloqueado (Acesso suspenso)</option>
              <option value="cancelado" ${emp.status==='cancelado'?'selected':''}>⛔ Cancelado</option>
            </select>
          </div>

          <div>
            <label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:4px;">Plano Contratado *</label>
            <select id="me-edit-plano" style="width:100%;background:#182713;border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:9px 12px;color:#fff;font-size:.85rem;">
              <option value="trial" ${emp.plano==='trial'?'selected':''}>Trial (Gratuito 15 dias)</option>
              <option value="starter" ${emp.plano==='starter'?'selected':''}>Básico (até 3 obras - R$ 119,90)</option>
              <option value="pro" ${emp.plano==='pro'?'selected':''}>Profissional (até 10 obras - R$ 279,90)</option>
              <option value="unlimited" ${emp.plano==='unlimited'?'selected':''}>Ilimitado (obras ilimitadas - R$ 499,90)</option>
            </select>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <label style="font-size:.78rem;color:#94a3b8;">Data de Vencimento do Plano / Trial *</label>
              <div style="display:flex;gap:6px;">
                <button type="button" data-fb-click="MasterAdmin._adicionarDiasVencimento" data-fb-click-n="1" data-fb-click-t0="number" data-fb-click-v0="15" style="background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.3);color:#fbbf24;padding:2px 8px;border-radius:4px;font-size:.7rem;cursor:pointer;">+15 dias</button>
                <button type="button" data-fb-click="MasterAdmin._adicionarDiasVencimento" data-fb-click-n="1" data-fb-click-t0="number" data-fb-click-v0="30" style="background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.3);color:#4ade80;padding:2px 8px;border-radius:4px;font-size:.7rem;cursor:pointer;">+30 dias</button>
              </div>
            </div>
            <input type="date" id="me-edit-vencimento" required value="${vencAtual}" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:9px 12px;color:#fff;font-size:.85rem;">
            <div style="font-size:.7rem;color:#94a3b8;margin-top:4px;">Define o prazo do período trial ou a próxima fatura mensal.</div>
          </div>

          <div style="background:rgba(201,162,39,0.06);border:1px solid rgba(201,162,39,0.25);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div style="font-weight:700;font-size:.82rem;color:var(--accent2);display:flex;align-items:center;gap:6px;">
                🔑 Chave da Empresa (P50 Access Key)
              </div>
              <span style="font-size:.72rem;padding:2px 8px;border-radius:12px;${emp.access_key_last4 ? 'background:rgba(34,197,94,.15);color:#4ade80;' : 'background:rgba(239,68,68,.15);color:#f87171;'}">
                ${emp.access_key_last4 ? 'Ativa (Final ' + emp.access_key_last4 + ')' : 'Não Configurada'}
              </span>
            </div>
            <div style="font-size:.73rem;color:#94a3b8;line-height:1.4;">
              ${emp.access_key_last4
                ? 'Os usuários desta construtora utilizam a Chave da Empresa para login seguro. A chave completa não fica exposta no banco de dados.'
                : 'Esta empresa ainda não possui Chave de Acesso gerada. Gere uma chave para habilitar o login empresarial dos usuários.'}
            </div>
            <div style="display:flex;gap:8px;margin-top:4px;">
              <button type="button" data-fb-click="MasterAdmin.gerarChaveEmpresa" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(this._esc(emp.id)))}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(String(this._esc(nome)))}" style="background:rgba(201,162,39,0.15);border:1px solid rgba(201,162,39,0.4);color:var(--accent2);padding:6px 12px;border-radius:6px;font-size:.76rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                🔑 ${emp.access_key_last4 ? 'Rotacionar Chave da Empresa' : 'Gerar Chave de Acesso'}
              </button>
            </div>
          </div>

          <div style="padding-top:10px;display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" data-fb-click="Patch26Actions.removeById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="master-editar-empresa-modal" style="background:none;border:1px solid rgba(255,255,255,.2);color:#cbd5e1;padding:8px 16px;border-radius:8px;cursor:pointer;">
              Cancelar
            </button>
            <button type="submit" class="btn-primary" style="padding:8px 20px;border-radius:8px;font-weight:800;">
              Salvar Alterações 💾
            </button>
          </div>
        </form>
      </div>
    `;
  },

  _adicionarDiasVencimento(dias) {
    const input = document.getElementById('me-edit-vencimento');
    if (!input) return;
    const base = input.value ? new Date(input.value + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + dias);
    input.value = base.toISOString().split('T')[0];
  },

  async salvarEdicaoEmpresa(e, tenantId) {
    e.preventDefault();
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerText = 'Salvando no Neon...';
    }

    const status = document.getElementById('me-edit-status').value;
    const plano = document.getElementById('me-edit-plano').value;
    const vencimento = document.getElementById('me-edit-vencimento').value;

    try {
      const res = await this._fetchWithTimeout('/api/admin?action=update_tenant', {
        method: 'PATCH',
        headers: (typeof Auth !== 'undefined' && Auth.getAuthHeaders) ? Auth.getAuthHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          status,
          plano,
          vencimento
        })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Erro ao atualizar dados no servidor');
      }

      const modal = document.getElementById('master-editar-empresa-modal');
      if (modal) modal.remove();

      await this.carregarEmpresas(true);
      const target = document.getElementById('master-content-area') ? 'master-content-area' : 'route-content';
      this.render(target);
      alert('Dados da construtora atualizados com sucesso no Neon!');
    } catch (err) {
      alert('Erro ao atualizar: ' + err.message);
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerText = 'Salvar Alterações 💾';
      }
    }
  },

  async gerarChaveEmpresa(tenantIdEnc, tenantNomeEnc) {
    const tid = decodeURIComponent(tenantIdEnc || '');
    const nome = decodeURIComponent(tenantNomeEnc || 'Construtora');
    if (!tid) return;

    const confirmed = confirm(
      `Deseja gerar/rotacionar a Chave da Empresa para "${nome}"?\n\n` +
      `⚠️ ATENÇÃO: A nova chave será exibida UMA ÚNICA VEZ na tela. Se a empresa já possuía uma chave anterior, ela deixará de funcionar imediatamente.`
    );
    if (!confirmed) return;

    try {
      const res = await this._fetchWithTimeout('/api/admin?action=generate_tenant_access_key', {
        method: 'POST',
        headers: (typeof Auth !== 'undefined' && Auth.getAuthHeaders) ? Auth.getAuthHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tid })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Erro ao gerar chave da empresa');
      }

      const modal = document.getElementById('master-editar-empresa-modal');
      if (modal) modal.remove();

      await this.carregarEmpresas(true);
      const target = document.getElementById('master-content-area') ? 'master-content-area' : 'route-content';
      this.render(target);

      this.exibirModalChaveGerada(nome, data.accessKey, data.access_key_last4);
    } catch (err) {
      alert('Erro ao gerar chave da empresa: ' + err.message);
    }
  },

  exibirModalChaveGerada(nome, accessKey, last4) {
    let modal = document.getElementById('master-chave-gerada-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'master-chave-gerada-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);backdrop-filter:blur(8px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `
      <div style="background:#0f1d0a;border:1.5px solid var(--accent);border-radius:14px;max-width:540px;width:100%;box-shadow:0 12px 48px rgba(0,0,0,.9);overflow:hidden;">
        <div style="padding:20px;border-bottom:1px solid rgba(255,255,255,.1);display:flex;align-items:center;gap:12px;">
          <div style="width:40px;height:40px;border-radius:10px;background:rgba(201,162,39,.15);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:1.3rem;">
            🔑
          </div>
          <div>
            <div style="font-weight:800;font-size:1.1rem;color:var(--accent2);">Chave da Empresa Gerada com Sucesso!</div>
            <div style="font-size:.78rem;color:#94a3b8;">${this._esc(nome)} (Final ${this._esc(last4 || '')})</div>
          </div>
        </div>
        <div style="padding:22px;display:flex;flex-direction:column;gap:16px;">
          <div style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:12px;font-size:.78rem;color:#fca5a5;line-height:1.4;">
            ⚠️ <strong>ATENÇÃO:</strong> Esta chave é exibida <strong>UMA ÚNICA VEZ</strong> por motivos de segurança criptográfica. Copie-a e envie ao administrador da construtora antes de fechar esta janela.
          </div>
          <div>
            <label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:6px;">Chave da Empresa (P50 Access Key):</label>
            <div style="display:flex;gap:8px;">
              <input type="text" id="input-chave-gerada" readonly value="${this._esc(accessKey)}" style="flex:1;background:#060d04;border:1px solid var(--accent);border-radius:8px;padding:12px;color:#fff;font-family:monospace;font-size:.95rem;font-weight:700;letter-spacing:1px;text-align:center;">
              <button type="button" data-fb-click="MasterAdmin.copiarChaveGerada" data-fb-click-n="0" id="btn-copiar-chave-p50" style="background:var(--accent);color:#000;border:none;border-radius:8px;padding:0 18px;font-weight:800;font-size:.82rem;cursor:pointer;">Copiar 📋</button>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;">
            <button type="button" data-fb-click="Patch26Actions.removeById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="master-chave-gerada-modal" style="background:none;border:1px solid rgba(255,255,255,.2);color:#cbd5e1;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:.85rem;">
              Fechar
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  copiarChaveGerada() {
    const inp = document.getElementById('input-chave-gerada');
    const btn = document.getElementById('btn-copiar-chave-p50');
    if (inp) {
      inp.select();
      navigator.clipboard.writeText(inp.value).then(() => {
        if (btn) btn.innerText = 'Copiado! ✓';
        setTimeout(() => { if (btn) btn.innerText = 'Copiar 📋'; }, 2500);
      }).catch(() => {
        document.execCommand('copy');
        if (btn) btn.innerText = 'Copiado! ✓';
        setTimeout(() => { if (btn) btn.innerText = 'Copiar 📋'; }, 2500);
      });
    }
  },

  // ── MODAL: CADASTRAR NOVA CONSTRUTORA ──────────────────────────────────────
  abrirModalNovaEmpresa() {
    let modal = document.getElementById('master-nova-empresa-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'master-nova-empresa-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(6px);padding:16px;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#0f1710;border:1px solid rgba(201,162,39,.4);border-radius:14px;width:100%;max-width:580px;box-shadow:0 24px 60px rgba(0,0,0,.85);overflow:hidden;color:#f0ead6;font-family:inherit;">
        <div style="background:linear-gradient(135deg,#1C2D12,#243818);padding:16px 20px;border-bottom:1px solid rgba(201,162,39,.3);display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;">➕</span>
            <div>
              <div style="font-weight:800;font-size:1rem;color:var(--accent2);">Cadastrar Nova Construtora / Cliente</div>
              <div style="font-size:.75rem;color:#94a3b8;">Criar tenant e liberar acesso à plataforma</div>
            </div>
          </div>
          <button data-fb-click="Patch26Actions.removeById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="master-nova-empresa-modal" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>
        </div>

        <form data-fb-submit="MasterAdmin.salvarNovaEmpresa" data-fb-submit-n="1" data-fb-submit-t0="event" style="padding:22px;display:flex;flex-direction:column;gap:14px;">
          <div>
            <label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:4px;">Nome Fantasia da Construtora *</label>
            <input type="text" id="ne-nome" required placeholder="Ex: Vanguard Engenharia" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:9px 12px;color:#fff;font-size:.85rem;">
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:4px;">CNPJ</label>
              <input type="text" id="ne-cnpj" placeholder="00.000.000/0001-00" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:9px 12px;color:#fff;font-size:.85rem;">
            </div>
            <div>
              <label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:4px;">Plano SaaS *</label>
              <select id="ne-plano" style="width:100%;background:#182713;border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:9px 12px;color:#fff;font-size:.85rem;">
                <option value="starter">Básico (até 3 obras - R$ 119,90)</option>
                <option value="pro" selected>Profissional (até 10 obras - R$ 279,90)</option>
                <option value="unlimited">Ilimitado (obras ilimitadas - R$ 499,90)</option>
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:4px;">Nome do Responsável *</label>
              <input type="text" id="ne-resp" required placeholder="Ex: Eng. Carlos Silva" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:9px 12px;color:#fff;font-size:.85rem;">
            </div>
            <div>
              <label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:4px;">WhatsApp com DDD *</label>
              <input type="text" id="ne-whats" required placeholder="95991234567" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:9px 12px;color:#fff;font-size:.85rem;">
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:4px;">E-mail de Login *</label>
              <input type="email" id="ne-email" required placeholder="carlos@vanguard.com.br" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:9px 12px;color:#fff;font-size:.85rem;">
            </div>
            <div>
              <label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:4px;">Senha de Acesso *</label>
              <input type="password" id="ne-senha" required minlength="8" placeholder="Mínimo 8 caracteres" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:9px 12px;color:#fff;font-size:.85rem;">
            </div>
          </div>

          <div style="padding-top:10px;display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" data-fb-click="Patch26Actions.removeById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="master-nova-empresa-modal" style="background:none;border:1px solid rgba(255,255,255,.2);color:#cbd5e1;padding:8px 16px;border-radius:8px;cursor:pointer;">
              Cancelar
            </button>
            <button type="submit" class="btn-primary" style="padding:8px 20px;border-radius:8px;font-weight:800;">
              Salvar e Criar Acesso 🚀
            </button>
          </div>
        </form>
      </div>
    `;
  },

  async salvarNovaEmpresa(e) {
    e.preventDefault();
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerText = 'Salvando no Neon...';
    }

    const nome = document.getElementById('ne-nome').value.trim();
    const cnpj = document.getElementById('ne-cnpj').value.trim();
    const plano = document.getElementById('ne-plano').value;
    const resp = document.getElementById('ne-resp').value.trim();
    const whats = document.getElementById('ne-whats').value.trim();
    const email = document.getElementById('ne-email').value.trim();
    const senha = document.getElementById('ne-senha').value.trim();

    try {
      const res = await this._fetchWithTimeout('/api/admin?action=create_tenant', {
        method: 'POST',
        headers: (typeof Auth !== 'undefined' && Auth.getAuthHeaders) ? Auth.getAuthHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_fantasia: nome,
          razao_social: nome,
          cnpj,
          plano,
          responsavel: resp,
          telefone: whats,
          email,
          senha,
          status: 'ativo'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao criar construtora no banco de dados');
      }

      const modal = document.getElementById('master-nova-empresa-modal');
      if (modal) modal.remove();

      await this.carregarEmpresas(true);
      const target = document.getElementById('master-content-area') ? 'master-content-area' : 'route-content';
      this.render(target);

      if (data.tenant?.accessKey) {
        this.exibirModalChaveGerada(nome, data.tenant.accessKey, data.tenant.access_key_last4);
      } else {
        alert(`✓ Construtora "${nome}" criada com sucesso no PostgreSQL!\nLogin: ${email}\nSenha: ${senha}`);
      }
    } catch (err) {
      alert('Erro ao cadastrar construtora: ' + err.message);
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerText = 'Salvar e Criar Acesso 🚀';
      }
    }
  },

  // ── MODAL: COBRANÇA E NOTIFICAÇÃO DE ASSINATURA SAAS ──────────────────────
  abrirModalCobranca(tenantId) {
    const empresas = this.getEmpresas();
    const emp = empresas.find(e => String(e.id) === String(tenantId)) || { id: tenantId };
    this._currentCobrancaEmpresa = emp;

    let modal = document.getElementById('master-cobranca-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'master-cobranca-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(8px);padding:16px;';
      document.body.appendChild(modal);
    }

    const nome = this._esc(emp.nome_fantasia || emp.razao_social || 'Empresa');
    const resp = this._esc(emp.responsavel || 'Gestor(a)');
    const tel = this._esc(emp.telefone || '');
    const email = this._esc(emp.email || '');
    const planosMap = { starter: 'Básico (R$ 119,90)', pro: 'Profissional (R$ 279,90)', unlimited: 'Ilimitado (R$ 499,90)', trial: 'Trial' };
    const plano = planosMap[emp.plano] || emp.plano || 'Profissional';
    const venc = emp.vencimento ? emp.vencimento.split('-').reverse().join('/') : 'A definir';
    const dr = emp.diasRestantes;

    let situacao = 'Vencimento em dia';
    let defaultTemplate = 'reminder';
    if (emp.status === 'trial') {
      situacao = dr > 0 ? `Trial termina em ${dr} dia(s)` : 'Trial expirado';
      defaultTemplate = 'trial_ending';
    } else if (dr <= 0) {
      situacao = dr === 0 ? 'Vence HOJE' : `Vencido há ${Math.abs(dr)} dia(s)`;
      defaultTemplate = dr === 0 ? 'due_today' : 'overdue';
    } else {
      situacao = `Vence em ${dr} dia(s)`;
      defaultTemplate = dr <= 3 ? 'due_today' : 'reminder';
    }

    modal.innerHTML = `
      <div style="background:#0f1710;border:1px solid rgba(201,162,39,.45);border-radius:16px;width:100%;max-width:640px;box-shadow:0 24px 70px rgba(0,0,0,.9);overflow:hidden;color:#f0ead6;font-family:inherit;max-height:92vh;display:flex;flex-direction:column;">
        
        <!-- Cabeçalho -->
        <div style="background:linear-gradient(135deg,#15250f,#1f3616);padding:16px 22px;border-bottom:1px solid rgba(201,162,39,.3);display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:1.4rem;">💳</span>
            <div>
              <div style="font-weight:900;font-size:1.05rem;color:var(--accent2);">Cobrança &amp; Notificação de Assinatura</div>
              <div style="font-size:.76rem;color:#94a3b8;">Disparo multicanal: WhatsApp (Robô/Web) e E-mail Institucional (Resend)</div>
            </div>
          </div>
          <button data-fb-click="Patch26Actions.removeById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="master-cobranca-modal" style="background:none;border:none;color:#94a3b8;font-size:1.3rem;cursor:pointer;padding:4px 8px;">✕</button>
        </div>

        <!-- Conteúdo Scrollável -->
        <div style="padding:20px 22px;overflow-y:auto;display:flex;flex-direction:column;gap:16px;">
          
          <!-- Card de Dados da Empresa -->
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;font-size:.82rem;">
            <div><span style="color:#94a3b8;font-size:.72rem;display:block;">EMPRESA:</span><strong style="color:#fff;">${nome}</strong></div>
            <div><span style="color:#94a3b8;font-size:.72rem;display:block;">RESPONSÁVEL:</span><span style="color:#cbd5e1;">${resp}</span></div>
            <div><span style="color:#94a3b8;font-size:.72rem;display:block;">PLANO:</span><span style="color:var(--accent2);font-weight:700;">${plano}</span></div>
            <div><span style="color:#94a3b8;font-size:.72rem;display:block;">VENCIMENTO:</span><span style="color:${dr<=0?'#ef4444':'#22c55e'};font-weight:800;">${venc} (${situacao})</span></div>
          </div>

          <!-- Seletor de Template -->
          <div>
            <label style="display:block;font-size:.78rem;font-weight:800;color:var(--accent2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">1. Escolha o Template da Mensagem</label>
            <select id="mc-template-type" data-fb-change="MasterAdmin.mudarTemplateCobranca" data-fb-change-n="1" data-fb-change-t0="self" style="width:100%;background:#182713;border:1px solid rgba(201,162,39,.35);border-radius:8px;padding:9px 12px;color:#fff;font-size:.86rem;font-weight:700;">
              <option value="reminder" ${defaultTemplate==='reminder'?'selected':''}>⏳ Lembrete Prévio de Vencimento (Faltam dias)</option>
              <option value="due_today" ${defaultTemplate==='due_today'?'selected':''}>🔔 Vencimento Hoje (Renovação imediata)</option>
              <option value="overdue" ${defaultTemplate==='overdue'?'selected':''}>⚠️ Em Atraso (Aviso de regularização / suspensão)</option>
              <option value="trial_ending" ${defaultTemplate==='trial_ending'?'selected':''}>🚀 Fim de Período de Testes (Trial)</option>
              <option value="custom">✍️ Mensagem Personalizada / Livre</option>
            </select>
          </div>

          <!-- Seletor de Canais -->
          <div>
            <label style="display:block;font-size:.78rem;font-weight:800;color:var(--accent2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">2. Canal de Envio</label>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;">
              <label style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:9px 10px;font-size:.8rem;cursor:pointer;">
                <input type="radio" name="mc-channel" value="both" checked> ⚡ Ambos (Bot + E-mail)
              </label>
              <label style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:9px 10px;font-size:.8rem;cursor:pointer;">
                <input type="radio" name="mc-channel" value="whatsapp"> 🤖 WhatsApp Direto (Bot)
              </label>
              <label style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:9px 10px;font-size:.8rem;cursor:pointer;">
                <input type="radio" name="mc-channel" value="email"> 📧 E-mail (Resend)
              </label>
              <label style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:9px 10px;font-size:.8rem;cursor:pointer;">
                <input type="radio" name="mc-channel" value="wa_web"> 📱 WhatsApp Web (wa.me)
              </label>
            </div>
          </div>

          <!-- Contatos e Chave PIX -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            <div>
              <label style="display:block;font-size:.74rem;color:#94a3b8;margin-bottom:4px;">Telefone WhatsApp</label>
              <input type="text" id="mc-phone" value="${tel}" placeholder="5595991234567" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:8px 10px;color:#fff;font-size:.82rem;">
            </div>
            <div>
              <label style="display:block;font-size:.74rem;color:#94a3b8;margin-bottom:4px;">E-mail do Cliente</label>
              <input type="email" id="mc-email" value="${email}" placeholder="cliente@empresa.com" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:8px 10px;color:#fff;font-size:.82rem;">
            </div>
            <div>
              <label style="display:block;font-size:.74rem;color:#94a3b8;margin-bottom:4px;">Chave PIX de Recebimento</label>
              <input type="text" id="mc-pix" value="5595991363678" placeholder="Chave PIX" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:8px 10px;color:#fff;font-size:.82rem;font-weight:700;">
            </div>
          </div>

          <!-- Assunto do E-mail -->
          <div id="mc-subject-wrap">
            <label style="display:block;font-size:.74rem;color:#94a3b8;margin-bottom:4px;">Assunto do E-mail</label>
            <input type="text" id="mc-subject" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:8px 10px;color:#fff;font-size:.82rem;">
          </div>

          <!-- Mensagem / Pré-visualização -->
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <label style="font-size:.74rem;color:#94a3b8;">Texto da Notificação / Mensagem de WhatsApp (Editável)</label>
              <span style="font-size:.7rem;color:#64748b;">Você pode personalizar antes de disparar</span>
            </div>
            <textarea id="mc-message" rows="6" style="width:100%;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:10px 12px;color:#fff;font-size:.82rem;line-height:1.5;font-family:monospace;resize:vertical;"></textarea>
          </div>

          <!-- Área de Feedback / Status -->
          <div id="mc-feedback" style="display:none;padding:12px 14px;border-radius:8px;font-size:.82rem;line-height:1.4;"></div>

        </div>

        <!-- Rodapé e Ações -->
        <div style="background:rgba(0,0,0,.25);padding:14px 22px;border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <button type="button" data-fb-click="Patch26Actions.removeById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="master-cobranca-modal" style="background:transparent;border:1px solid rgba(255,255,255,.2);color:#cbd5e1;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:.82rem;">
            Fechar
          </button>
          <div style="display:flex;gap:8px;">
            <button type="button" id="mc-btn-wa-web" data-fb-click="MasterAdmin.abrirWaWebDireto" data-fb-click-n="0" style="background:rgba(37,211,102,.15);border:1px solid #25D366;color:#25D366;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:.82rem;font-weight:700;">
              💬 Abrir WhatsApp Web
            </button>
            <button type="button" id="mc-btn-submit" data-fb-click="MasterAdmin.enviarNotificacaoCobranca" data-fb-click-n="0" class="btn-primary" style="padding:8px 20px;border-radius:8px;font-weight:900;font-size:.86rem;">
              🚀 Disparar Notificação
            </button>
          </div>
        </div>

      </div>
    `;

    this.mudarTemplateCobranca(defaultTemplate);
  },

  mudarTemplateCobranca(arg) {
    const type = typeof arg === 'string' ? arg : (document.getElementById('mc-template-type')?.value || 'reminder');
    const emp = this._currentCobrancaEmpresa || {};
    const nome = emp.nome_fantasia || emp.razao_social || 'Empresa';
    const resp = emp.responsavel || 'Gestor(a)';
    const dr = emp.diasRestantes;
    const venc = emp.vencimento ? emp.vencimento.split('-').reverse().join('/') : 'A definir';
    const pix = document.getElementById('mc-pix')?.value || '5595991363678';
    
    const planosMap = { starter: { n: 'Básico', v: '119,90' }, pro: { n: 'Profissional', v: '279,90' }, unlimited: { n: 'Ilimitado', v: '499,90' }, trial: { n: 'Trial', v: '279,90' } };
    const pInfo = planosMap[emp.plano] || { n: 'Profissional', v: '279,90' };

    let situacaoTxt = '';
    if (dr > 1) situacaoTxt = `vence em ${dr} dias`;
    else if (dr === 1) situacaoTxt = 'vence amanhã';
    else if (dr === 0) situacaoTxt = 'vence hoje';
    else if (dr < 0) situacaoTxt = `vencido há ${Math.abs(dr)} dia(s)`;
    else situacaoTxt = 'renovação próxima';

    let msg = '';
    let subject = '';

    if (type === 'reminder') {
      subject = `🔔 FinGo — Lembrete de Renovação de Assinatura (${venc})`;
      msg = `Olá, ${resp}! 👋\n\nPassando para lembrar que a assinatura do *FinGo* da empresa *${nome}* (Plano ${pInfo.n}) vence em *${venc}* (${situacaoTxt}).\n\n💰 *Valor:* R$ ${pInfo.v}\n🔑 *Chave PIX:* ${pix}\n👤 *Beneficiário:* FinGo Soluções Tecnológicas\n\nQualquer dúvida ou caso precise de emissão de NF, estamos à disposição!`;
    } else if (type === 'due_today') {
      subject = `⚠️ FinGo — Sua assinatura vence hoje (${venc})`;
      msg = `Olá, ${resp}! 🔔\n\nA assinatura do *FinGo* da empresa *${nome}* vence *hoje (${venc})*.\n\nPara garantir a continuidade dos acessos da sua equipe e sincronização das obras sem interrupção:\n\n💰 *Valor:* R$ ${pInfo.v}\n🔑 *Chave PIX:* ${pix}\n👤 *Beneficiário:* FinGo Soluções Tecnológicas\n\nApós o pagamento via PIX, a renovação é confirmada e os acessos continuam ativos normalmente.`;
    } else if (type === 'overdue') {
      subject = `🚨 FinGo — Aviso de Vencimento e Regularização de Acesso`;
      msg = `Olá, ${resp}! ⚠️\n\nIdentificamos que a assinatura do *FinGo* da empresa *${nome}* venceu em *${venc}* (${situacaoTxt}) e consta pendente.\n\nPara evitar o bloqueio preventivo dos acessos, emissão de relatórios e sincronização no canteiro de obras, solicitamos a regularização:\n\n💰 *Valor:* R$ ${pInfo.v}\n🔑 *Chave PIX:* ${pix}\n👤 *Beneficiário:* FinGo Soluções Tecnológicas\n\nSe já realizou o pagamento, desconsidere este aviso ou nos envie o comprovante por aqui!`;
    } else if (type === 'trial_ending') {
      subject = `🚀 FinGo — Seu período de testes termina em ${venc}`;
      msg = `Olá, ${resp}! 🚀\n\nSeu período de teste gratuito do *FinGo* na empresa *${nome}* termina em *${venc}*.\n\nEsperamos que a plataforma esteja transformando a gestão das suas obras! Para continuar utilizando todos os recursos com a sua equipe:\n\n👉 Conheça os planos e assine: https://fingo.api.br/app.html#planos\n💰 *Valor de referência:* R$ ${pInfo.v}/mês (${pInfo.n})\n🔑 *Chave PIX:* ${pix}\n👤 *Beneficiário:* FinGo Soluções Tecnológicas\n\nEstamos à disposição para ajudar na escolha do melhor plano!`;
    } else {
      subject = `FinGo — Notificação de Assinatura (${nome})`;
      msg = `Olá, ${resp}! Aqui é do FinGo referente à assinatura da empresa ${nome}.`;
    }

    const msgEl = document.getElementById('mc-message');
    if (msgEl) msgEl.value = msg;
    const subEl = document.getElementById('mc-subject');
    if (subEl) subEl.value = subject;
  },

  abrirWaWebDireto() {
    const phone = (document.getElementById('mc-phone')?.value || '').replace(/\D/g, '');
    const msg = document.getElementById('mc-message')?.value || '';
    if (!phone) {
      alert('Informe um telefone válido com DDD para abrir o WhatsApp Web.');
      return;
    }
    const fullPhone = phone.startsWith('55') ? phone : '55' + phone;
    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  async enviarNotificacaoCobranca() {
    const emp = this._currentCobrancaEmpresa;
    if (!emp || !emp.id) {
      alert('Empresa não identificada.');
      return;
    }

    const templateType = document.getElementById('mc-template-type')?.value || 'reminder';
    const channel = document.querySelector('input[name="mc-channel"]:checked')?.value || 'both';
    const phone = (document.getElementById('mc-phone')?.value || '').replace(/\D/g, '');
    const email = (document.getElementById('mc-email')?.value || '').trim();
    const pix = (document.getElementById('mc-pix')?.value || '').trim();
    const subject = (document.getElementById('mc-subject')?.value || '').trim();
    const message = (document.getElementById('mc-message')?.value || '').trim();

    if (channel === 'wa_web') {
      this.abrirWaWebDireto();
      return;
    }

    const fb = document.getElementById('mc-feedback');
    const btn = document.getElementById('mc-btn-submit');
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Enviando... ⏳';
    }
    if (fb) {
      fb.style.display = 'block';
      fb.style.background = 'rgba(59,130,246,.15)';
      fb.style.border = '1px solid #3b82f6';
      fb.style.color = '#93c5fd';
      fb.innerHTML = 'Processando disparo de notificação no servidor...';
    }

    try {
      const headers = (typeof Auth !== 'undefined' && Auth.getAuthHeaders) ? Auth.getAuthHeaders() : { 'Content-Type': 'application/json' };
      const res = await this._fetchWithTimeout('/api/admin?action=send_billing_notice', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tenantId: emp.id,
          channel,
          templateType,
          customMessage: message,
          customSubject: subject,
          targetPhone: phone,
          targetEmail: email,
          pixKey: pix
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Erro ${res.status} ao disparar notificação`);
      }

      const results = data.results || {};
      let relatorioHtml = `<div style="font-weight:800;margin-bottom:6px;color:#86efac;">✅ Notificação de cobrança processada:</div><ul style="margin:0;padding-left:18px;">`;
      
      if (results.whatsapp?.attempted) {
        if (results.whatsapp.success) {
          relatorioHtml += `<li><strong>WhatsApp:</strong> Entregue com sucesso pelo robô (ID: ${results.whatsapp.messageId})</li>`;
        } else {
          relatorioHtml += `<li style="color:#fca5a5;"><strong>WhatsApp:</strong> ${results.whatsapp.error} <a href="${results.waLink}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8;text-decoration:underline;">[Abrir manualmente no WhatsApp Web]</a></li>`;
        }
      }

      if (results.email?.attempted) {
        if (results.email.success) {
          relatorioHtml += `<li><strong>E-mail:</strong> Enviado com sucesso via Resend (ID: ${results.email.id})</li>`;
        } else {
          relatorioHtml += `<li style="color:#fca5a5;"><strong>E-mail:</strong> ${results.email.error}</li>`;
        }
      }
      relatorioHtml += `</ul>`;

      if (fb) {
        fb.style.background = 'rgba(34,197,94,.15)';
        fb.style.border = '1px solid #22c55e';
        fb.style.color = '#f0ead6';
        fb.innerHTML = relatorioHtml;
      }

      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast('Notificação de cobrança enviada com sucesso!', 'success');
      }
    } catch (err) {
      if (fb) {
        fb.style.background = 'rgba(239,68,68,.15)';
        fb.style.border = '1px solid #ef4444';
        fb.style.color = '#fca5a5';
        fb.innerHTML = `<strong>Falha ao enviar:</strong> ${err.message}`;
      }
      alert('Erro no envio da cobrança: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = '🚀 Disparar Notificação';
      }
    }
  },

  async executarVarreduraCobranca() {
    if (!confirm('Deseja iniciar agora a varredura de cobrança 24/7 de todos os contratos e assinaturas do FinGo?')) {
      return;
    }

    if (typeof Utils !== 'undefined' && Utils.toast) {
      Utils.toast('Executando varredura de cobrança nos servidores...', 'info');
    }

    try {
      const headers = (typeof Auth !== 'undefined' && Auth.getAuthHeaders) ? Auth.getAuthHeaders() : { 'Content-Type': 'application/json' };
      const res = await this._fetchWithTimeout('/api/admin?action=trigger_billing_sweep', {
        method: 'POST',
        headers
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Erro ${res.status} na varredura`);
      }

      const resObj = data.result || {};
      const msg = `⚡ Varredura Concluída!\n\n• Empresas avaliadas: ${resObj.totalEvaluated || 0}\n• Notificações enviadas: ${resObj.notified || 0}\n• Bloqueadas por anti-spam (já notificadas hoje): ${resObj.skippedAntiSpam || 0}\n• Engine utilizada: ${data.engine === 'render' ? 'Robô 24/7 Render' : 'Neon Serverless Fallback'}`;

      alert(msg);
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast('Varredura de cobrança finalizada com sucesso!', 'success');
      }

      if (typeof this.loadData === 'function') {
        await this.loadData();
      }
    } catch (err) {
      alert('Falha ao executar varredura: ' + err.message);
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast('Erro na varredura: ' + err.message, 'error');
      }
    }
  },

  // PATCH 49: Gerenciamento de Segurança Master & 2FA
  _lastBackupCodes: [],

  async abrirModalMfa() {
    const modal = document.getElementById('master-mfa-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    const regenPass = document.getElementById('mfa-regen-pass');
    if (regenPass) regenPass.value = '';
    const codesDisplay = document.getElementById('mfa-backup-codes-display');
    if (codesDisplay) codesDisplay.style.display = 'none';
  },

  fecharModalMfa() {
    const modal = document.getElementById('master-mfa-modal');
    if (modal) modal.style.display = 'none';
  },

  copiarChaveMfa() {
    const display = document.getElementById('master-secret-key-display');
    const raw = display?.getAttribute('data-secret-raw') || display?.textContent || '';
    if (!raw || raw === '...') return;
    navigator.clipboard.writeText(raw).then(() => {
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast('Chave secreta copiada!', 'success');
      } else {
        alert('Chave secreta copiada com sucesso!');
      }
    }).catch(() => {
      alert('Chave: ' + raw);
    });
  },

  async regenerarBackupCodes() {
    const passInp = document.getElementById('mfa-regen-pass');
    const password = (passInp?.value || '').trim();
    if (!password) {
      alert('Informe sua senha master para confirmar a geração de novos códigos.');
      if (passInp) passInp.focus();
      return;
    }

    try {
      const headers = (typeof Auth !== 'undefined' && Auth.getAuthHeaders)
        ? { ...Auth.getAuthHeaders(), 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' };

      const res = await this._fetchWithTimeout('/api/admin?action=mfa_regenerate_backup_codes', {
        method: 'POST',
        headers,
        body: JSON.stringify({ password })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        alert(data.error || 'Erro ao gerar novos códigos de emergência.');
        return;
      }

      this._lastBackupCodes = data.backup_codes || [];
      const grid = document.getElementById('mfa-backup-codes-grid');
      if (grid && Array.isArray(data.backup_codes)) {
        grid.innerHTML = data.backup_codes.map(c => `<div style="padding:4px;background:rgba(255,255,255,.05);border-radius:4px;">${c}</div>`).join('');
      }

      const display = document.getElementById('mfa-backup-codes-display');
      if (display) display.style.display = 'block';

      if (passInp) passInp.value = '';

      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast('Novos códigos de emergência gerados!', 'success');
      } else {
        alert('Novos códigos gerados com sucesso! Guarde-os em local seguro.');
      }
    } catch (err) {
      alert('Falha de conexão: ' + err.message);
    }
  },

  copiarNovosBackupCodes() {
    if (!this._lastBackupCodes || !this._lastBackupCodes.length) {
      alert('Nenhum código para copiar.');
      return;
    }
    const text = this._lastBackupCodes.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast('Códigos copiados!', 'success');
      } else {
        alert('Códigos de emergência copiados para a área de transferência!');
      }
    }).catch(() => {
      alert('Códigos:\n' + text);
    });
  },

  _renderAgendaDev() {
    const eventos = (typeof AgendaEventos !== 'undefined') ? AgendaEventos.getEventos() : [];
    const hoje = typeof Utils !== 'undefined' ? Utils.today() : new Date().toISOString().slice(0, 10);
    const futuros = eventos.filter(e => !e.gravado && e.data >= hoje);
    const gravados = eventos.filter(e => e.gravado || e.data < hoje);

    return `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:26px;box-shadow:0 8px 30px rgba(0,0,0,.35);">
        
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:14px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:18px;">
          <div>
            <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(198,255,0,.12);border:1px solid #C6FF00;color:#C6FF00;padding:4px 12px;border-radius:4px;font-size:.75rem;font-weight:800;margin-bottom:6px;">
              <span>📅</span><span>AGENDA DEV &amp; CAPACITAÇÃO TÉCNICA</span>
            </div>
            <h2 style="font-size:1.5rem;font-weight:900;color:#fff;margin:0 0 4px;">Gerenciador de Lives, Workshops &amp; Calendário</h2>
            <div style="font-size:.82rem;color:#94a3b8;">Cadastre novas programações ao vivo ou workshops operacionais para todos os clientes e construtoras do FinGo.</div>
          </div>

          <div style="display:flex;align-items:center;gap:10px;">
            <button type="button" data-fb-click="AgendaEventos.abrirModal" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="novo" class="btn-primary" style="padding:10px 18px;border-radius:4px;font-weight:800;display:inline-flex;align-items:center;gap:8px;font-size:.85rem;background:#C6FF00;color:#0A0A0A;border:none;cursor:pointer;">
              <span>➕ Agendar Novo Evento / Live</span>
            </button>
            <button type="button" data-fb-click="MasterAdmin.switchTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="agenda" class="btn-action" style="padding:10px 14px;border-radius:4px;font-size:.85rem;">
              <span>🔄 Atualizar</span>
            </button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-bottom:24px;">
          <div class="metric-card">
            <div style="font-size:.75rem;color:#94a3b8;font-weight:700;text-transform:uppercase;">Próximas Lives Agendadas</div>
            <div style="font-size:1.8rem;font-weight:900;color:#3EE8B5;margin-top:4px;">${futuros.length}</div>
          </div>
          <div class="metric-card">
            <div style="font-size:.75rem;color:#94a3b8;font-weight:700;text-transform:uppercase;">Treinamentos / Gravados</div>
            <div style="font-size:1.8rem;font-weight:900;color:#F3CF67;margin-top:4px;">${gravados.length}</div>
          </div>
          <div class="metric-card">
            <div style="font-size:.75rem;color:#94a3b8;font-weight:700;text-transform:uppercase;">Total de Eventos no Calendário</div>
            <div style="font-size:1.8rem;font-weight:900;color:#fff;margin-top:4px;">${eventos.length}</div>
          </div>
        </div>

        <h3 style="font-size:1.1rem;font-weight:800;color:#fff;margin-bottom:14px;">Programações Cadastradas</h3>
        
        ${eventos.length === 0 ? `
          <div style="padding:40px 20px;text-align:center;background:rgba(255,255,255,.02);border:1px dashed rgba(255,255,255,.15);border-radius:12px;">
            <div style="font-size:2.4rem;margin-bottom:10px;">☕</div>
            <h4 style="font-size:1rem;font-weight:800;color:#fff;margin-bottom:6px;">Nenhum evento agendado no momento</h4>
            <p style="font-size:.82rem;color:#94a3b8;max-width:500px;margin:0 auto 16px;line-height:1.5;">
              A agenda está vazia. Clique no botão abaixo para adicionar a primeira live, treinamento ou comunicado técnico para os clientes.
            </p>
            <button type="button" data-fb-click="AgendaEventos.abrirModal" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="novo" class="btn-primary" style="padding:8px 20px;font-weight:800;border-radius:8px;font-size:.84rem;cursor:pointer;">
              ➕ Cadastrar Primeiro Evento
            </button>
          </div>
        ` : `
          <div class="table-container">
            <table style="width:100%;border-collapse:collapse;font-size:.84rem;text-align:left;">
              <thead>
                <tr style="background:rgba(255,255,255,.05);border-bottom:1px solid var(--border);color:#cbd5e1;">
                  <th style="padding:12px 16px;">Data &amp; Hora</th>
                  <th style="padding:12px 16px;">Tipo</th>
                  <th style="padding:12px 16px;">Título da Aula / Live</th>
                  <th style="padding:12px 16px;">Instrutor</th>
                  <th style="padding:12px 16px;">Link</th>
                  <th style="padding:12px 16px;text-align:right;">Ações</th>
                </tr>
              </thead>
              <tbody>
                ${eventos.map(e => `
                  <tr style="border-bottom:1px solid rgba(255,255,255,.05);">
                    <td style="padding:12px 16px;white-space:nowrap;font-weight:700;color:#3EE8B5;">
                      📅 ${e.data} às ${this._esc(e.hora)} (${this._esc(e.duracao || '60 min')})
                    </td>
                    <td style="padding:12px 16px;">
                      <span style="font-size:.72rem;font-weight:800;padding:2px 8px;border-radius:6px;background:${e.tipo==='live'?'rgba(239,68,68,.2)':(e.tipo==='workshop'?'rgba(56,189,248,.2)':'rgba(16,185,129,.2)')};color:${e.tipo==='live'?'#fca5a5':(e.tipo==='workshop'?'#7dd3fc':'#6ee7b7')};">
                        ${e.tipo === 'live' ? '🔴 Live' : (e.tipo === 'workshop' ? '🛠️ Workshop' : '🚀 Release')}
                      </span>
                    </td>
                    <td style="padding:12px 16px;font-weight:700;color:#fff;">
                      ${this._esc(e.titulo)}
                    </td>
                    <td style="padding:12px 16px;color:#94a3b8;">
                      ${this._esc(e.instrutor || 'Dev FinGo')}
                    </td>
                    <td style="padding:12px 16px;">
                      <a href="${this._esc(e.link)}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8;text-decoration:none;font-size:.78rem;">
                        Abrir Link ↗
                      </a>
                    </td>
                    <td style="padding:12px 16px;text-align:right;">
                      <button type="button" data-fb-click="AgendaEventos.excluirEvento" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(e.id)}" style="background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#fca5a5;padding:4px 10px;border-radius:6px;font-size:.72rem;cursor:pointer;" title="Excluir evento">
                        🗑️ Excluir
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }
};

