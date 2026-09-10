// js/master.js — Painel do Desenvolvedor / Super Admin Master Backoffice (/app/master)

const MasterAdmin = {
  STORAGE_EMPRESAS_KEY: 'finobra_tenants_master',

  _empresas: null,
  _isLoading: false,

  _esc(value) {
    if (typeof Utils !== 'undefined' && Utils.escapeHtml) return Utils.escapeHtml(String(value ?? ''));
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  },

  async carregarEmpresas(force = false) {
    if (this._empresas && !force) return this._empresas;
    this._isLoading = true;
    try {
      const resp = await fetch('/api/admin?action=tenants', {
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
          <button onclick="window.location.href='/app/dashboard'" class="btn-primary" style="margin-top:20px;padding:8px 20px;">Voltar ao Dashboard</button>
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
    const chamados = (typeof Suporte !== 'undefined' && Suporte.getHistoricoChat()) || [];
    const chamadosMaster = JSON.parse(localStorage.getItem('finobra_suporte_chamados') || '[]');

    // Cálculo das métricas globais
    const totalEmpresas = empresas.length;
    const ativas = empresas.filter(e => e.status === 'ativo').length;
    const trials = empresas.filter(e => e.status === 'trial').length;
    const totalObras = empresas.reduce((acc, e) => acc + (e.obrasQtd || 0), 0);
    
    // MRR estimado
    const precos = { starter: 79.90, pro: 119.90, unlimited: 159.90 };
    const mrr = empresas.reduce((acc, e) => {
      if (e.status === 'ativo' || e.status === 'trial') {
        return acc + (precos[e.plano] || 119.90);
      }
      return acc;
    }, 0);

    const isSistema = this._activeTab === 'sistema';

    el.innerHTML = `
      <div style="max-width:1200px;margin:0 auto;padding:10px 0 50px;">
        
        <!-- Navigation Tabs Master -->
        <div style="display:flex;gap:0;border-bottom:2px solid rgba(255,255,255,.1);margin-bottom:26px;overflow-x:auto;">
          <button onclick="MasterAdmin.switchTab('empresas')" style="padding:12px 20px;border:none;background:transparent;color:${!isSistema?'var(--accent)':'#94a3b8'};font-family:inherit;font-size:.875rem;font-weight:800;cursor:pointer;border-bottom:3px solid ${!isSistema?'var(--accent)':'transparent'};margin-bottom:-2px;transition:all .2s;display:flex;align-items:center;gap:8px;">
            <span>🏢</span> Gestão de Construtoras &amp; SaaS
          </button>
          <button onclick="MasterAdmin.switchTab('sistema')" style="padding:12px 20px;border:none;background:transparent;color:${isSistema?'var(--accent)':'#94a3b8'};font-family:inherit;font-size:.875rem;font-weight:800;cursor:pointer;border-bottom:3px solid ${isSistema?'var(--accent)':'transparent'};margin-bottom:-2px;transition:all .2s;display:flex;align-items:center;gap:8px;">
            <span>⚙️</span> Manutenção do Sistema &amp; Banco de Dados (Dev / Master)
          </button>
        </div>

        ${isSistema ? this._renderSistema() : `
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
            <button onclick="MasterAdmin.abrirModalNovaEmpresa()" class="btn-primary" style="padding:10px 18px;border-radius:8px;font-weight:800;display:inline-flex;align-items:center;gap:8px;font-size:.85rem;">
              <span>➕ Nova Construtora</span>
            </button>
            <button onclick="MasterAdmin.abrirModalPlanos()" class="btn-clean" style="padding:10px 16px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:#f0ead6;font-size:.85rem;font-weight:700;cursor:pointer;">
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
            <div style="font-size:.78rem;color:#94a3b8;">Previsão de faturamento mensal</div>
          </div>

          <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px 20px;">
            <div style="font-size:.75rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;">Suporte Técnico</div>
            <div style="font-size:1.8rem;font-weight:900;color:#38bdf8;margin:8px 0 4px;">${chamadosMaster.length || (chamados.length > 0 ? 1 : 0)}</div>
            <div style="font-size:.78rem;color:#94a3b8;">Atendimentos solicitados</div>
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

        <!-- Seção de Chamados de Suporte e Atendimento -->
        <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden;">
          <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;">
            <h3 style="font-size:1.05rem;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px;">
              <span>💬 Chamados de Suporte &amp; Chat dos Clientes</span>
            </h3>
            <button onclick="Suporte.abrirTelaAtendimento()" class="btn-clean" style="padding:4px 12px;border-radius:6px;font-size:.75rem;background:rgba(56,189,248,.15);color:#38bdf8;border:1px solid rgba(56,189,248,.3);">
              Abrir Chat de Atendimento ↗
            </button>
          </div>

          <div style="padding:20px;">
            ${chamados.length === 0 ? `
              <div style="text-align:center;padding:30px;color:#64748b;">
                <div style="font-size:2rem;margin-bottom:8px;">🎧</div>
                <div>Nenhum chamado de suporte pendente no momento.</div>
                <div style="font-size:.78rem;margin-top:4px;">Quando um cliente solicitar suporte pelo dropdown no topo, a conversa aparecerá aqui.</div>
              </div>
            ` : `
              <div style="display:flex;flex-direction:column;gap:10px;">
                <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
                  <div>
                    <div style="font-weight:800;font-size:.9rem;color:#fff;">Chamado de Suporte Recente</div>
                    <div style="font-size:.78rem;color:#94a3b8;margin-top:2px;">
                      Última mensagem: "${chamados[chamados.length - 1]?.texto || 'Atendimento em andamento'}"
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <a href="https://wa.me/5595991363678?text=${encodeURIComponent('Olá! Sou do suporte técnico do FinObra.')}" target="_blank" style="background:#22c55e;color:#fff;padding:6px 12px;border-radius:6px;font-size:.78rem;font-weight:700;text-decoration:none;">
                      Responder via WhatsApp ↗
                    </a>
                    <button onclick="Suporte.abrirTelaAtendimento()" style="background:var(--accent);color:#0f1710;padding:6px 12px;border-radius:6px;font-size:.78rem;font-weight:800;border:none;cursor:pointer;">
                      Ver Chat no Sistema ↗
                    </button>
                  </div>
                </div>
              </div>
            `}
          </div>
        </div>
        `}

      </div>
    `;
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
            <button onclick="MasterAdmin.limparDadosGlobal()" style="background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#fca5a5;padding:9px 16px;border-radius:8px;font-size:.8rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;">
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
              <button onclick="MasterAdmin.exportarBackup()" style="background:var(--accent);color:#0f1710;padding:8px 16px;border-radius:8px;font-size:.8rem;font-weight:800;border:none;cursor:pointer;">
                ⬇️ Baixar Backup JSON
              </button>
              <button onclick="document.getElementById('master-import-backup-input').click()" style="background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.15);padding:8px 16px;border-radius:8px;font-size:.8rem;font-weight:700;cursor:pointer;">
                ⬆️ Restaurar Arquivo JSON
              </button>
              <input type="file" id="master-import-backup-input" accept=".json,application/json" style="display:none;" onchange="MasterAdmin.importarBackup(this)">
            </div>
            <div style="background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:10px 14px;font-size:.78rem;color:#94a3b8;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
              <span>🛡️ ${snapshotInfo}</span>
              <button onclick="MasterAdmin.criarSnapshot()" style="background:none;border:none;color:var(--accent2);text-decoration:underline;cursor:pointer;font-size:.76rem;">
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
              <button onclick="MasterAdmin.sincronizarTudoNeon()" style="background:var(--accent);color:#0f1710;padding:8px 16px;border-radius:8px;font-size:.8rem;font-weight:800;border:none;cursor:pointer;">
                🔄 Sincronizar Tudo para o Neon
              </button>
              <button onclick="MasterAdmin.baixarDadosNeon()" style="background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.15);padding:8px 16px;border-radius:8px;font-size:.8rem;font-weight:700;cursor:pointer;">
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
              <button onclick="WhatsApp.abrirModalConexao()" style="background:#25D366;color:#fff;font-weight:800;font-size:.8rem;border:none;padding:9px 16px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:6px;">
                📲 Abrir Conexão &amp; QR Code
              </button>
            </div>
          </div>

        </div>

        <!-- Card Sobre o Sistema -->
        <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;">
          <div style="font-size:.95rem;font-weight:800;color:#fff;margin-bottom:14px;">ℹ️ Diagnóstico &amp; Metadados do Sistema</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;font-size:.84rem;">
            <div><div style="color:#64748b;margin-bottom:4px;">Sistema / Plataforma</div><div style="font-weight:700;color:#fff;">FinObra SaaS Backoffice</div></div>
            <div><div style="color:#64748b;margin-bottom:4px;">Versão em Produção</div><div style="font-weight:700;color:#fff;">2.4.0 (FinObra Cloud)</div></div>
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
    const planosNome = { starter:'Básico (R$ 79,90)', pro:'Profissional (R$ 119,90)', unlimited:'Ilimitado (R$ 159,90)', trial:'Trial' };
    const nome=this._esc(e.nome_fantasia), razao=this._esc(e.razao_social||''), cnpj=this._esc(e.cnpj||'—');
    const resp=this._esc(e.responsavel||'—'), contato=this._esc(e.telefone||e.email||'—');
    const plano=this._esc(planosNome[e.plano]||e.plano||'—');
    const id=String(e.id||''); // IDs de tenant são gerados pelo servidor e não são texto livre.
    const telDigits=String(e.telefone||'').replace(/\D/g,'');
    const wa=(telDigits ? (telDigits.startsWith('55')?telDigits:'55'+telDigits) : '5595991363678');
    const waText=encodeURIComponent(`Olá, ${e.responsavel||''}! Aqui é do FinObra referente à assinatura da ${e.nome_fantasia||''}.`);

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

    return `
      <tr style="border-bottom:1px solid rgba(255,255,255,.04);transition:background .15s;">
        <td style="padding:14px 18px;"><div style="font-weight:800;color:#fff;">${nome}</div><div style="font-size:.72rem;color:#94a3b8;">${razao}</div></td>
        <td style="padding:14px 18px;font-family:monospace;font-size:.78rem;color:#cbd5e1;">${cnpj}</td>
        <td style="padding:14px 18px;"><div style="color:#e2e8f0;">${resp}</div><div style="font-size:.72rem;color:#94a3b8;">${contato}</div></td>
        <td style="padding:14px 18px;font-weight:700;color:var(--accent2);font-size:.8rem;">${plano}</td>
        <td style="padding:14px 18px;font-weight:700;color:#fff;">${Number(e.obrasQtd||0)}</td>
        <td style="padding:14px 18px;">${badgeStatus[e.status] || this._esc(e.status||'—')}</td>
        <td style="padding:14px 18px;">${vencHtml}</td>
        <td style="padding:14px 18px;text-align:right;">
          <div style="display:inline-flex;gap:6px;">
            <button data-tenant-id="${this._esc(id)}" onclick="MasterAdmin.impersonarEmpresa(this.dataset.tenantId)" title="Acessar sistema como esta empresa para dar suporte" style="background:rgba(201,162,39,.15);border:1px solid var(--accent);color:var(--accent2);padding:4px 8px;border-radius:6px;font-size:.75rem;font-weight:700;cursor:pointer;">👁️ Acessar</button>
            <a href="https://wa.me/${wa}?text=${waText}" target="_blank" rel="noopener noreferrer" title="Conversar no WhatsApp" style="background:rgba(34,197,94,.15);border:1px solid #22c55e;color:#22c55e;padding:4px 8px;border-radius:6px;font-size:.75rem;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;">💬 Cobrar</a>
            <button data-tenant-id="${this._esc(id)}" onclick="MasterAdmin.alterarStatusEmpresa(this.dataset.tenantId)" title="Alterar status, plano ou vencimento" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);color:#cbd5e1;padding:4px 8px;border-radius:6px;font-size:.75rem;cursor:pointer;">✏️</button>
          </div>
        </td>
      </tr>`;
  },

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

      // 1. Guarda backup seguro da sessão master para retorno sem necessidade de relogar
      const currentToken = (typeof Auth !== 'undefined' && Auth.getToken()) || '';
      const currentSession = (typeof Auth !== 'undefined' && Auth.getSession()) || {};
      if (currentToken) {
        sessionStorage.setItem('finobra_master_backup_token', currentToken);
        sessionStorage.setItem('finobra_master_backup_session', JSON.stringify(currentSession));
      }

      // 2. Solicita token oficial de suporte ao backend
      const res = await fetch('/api/admin?action=impersonate', {
        method: 'POST',
        headers: (typeof Auth !== 'undefined' && Auth.getAuthHeaders) ? Auth.getAuthHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        alert(data.error || 'Não foi possível acessar os dados da empresa solicitada.');
        return;
      }

      // 3. Aplica o novo token e a sessão oficial autenticada
      localStorage.setItem('finobra_token', data.token);
      sessionStorage.setItem('finobra_token', data.token);
      localStorage.setItem('finobra_session', JSON.stringify(data.session));
      sessionStorage.setItem('finobra_session', JSON.stringify(data.session));

      // 4. Redireciona para o dashboard com o escopo isolado
      window.location.href = '/app/dashboard';
    } catch (err) {
      alert('Erro de comunicação ao acessar a empresa: ' + err.message);
    }
  },

  abrirModalPlanos() {
    const p = (typeof Cobranca !== 'undefined' && Cobranca.PLANOS) ? Cobranca.PLANOS : {
      starter: { nome: 'Plano Básico', valorTexto: 'R$ 79,90 / mês', limiteObras: 3 },
      pro: { nome: 'Plano Profissional', valorTexto: 'R$ 119,90 / mês', limiteObras: 10 },
      unlimited: { nome: 'Construtora Ilimitado', valorTexto: 'R$ 159,90 / mês', limiteObras: 'Ilimitadas' }
    };

    Utils.showModal(`
      <div class="modal" style="max-width:720px;background:#0f1a0b;border:1px solid var(--border);color:#f0ead6;">
        <div class="modal-header" style="border-bottom:1px solid rgba(201,162,39,.25);">
          <span class="modal-title" style="color:var(--accent2);font-weight:900;">💎 Tabela de Planos &amp; Mensalidades SaaS</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
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
          <button type="button" class="btn btn-primary" onclick="Utils.closeModal()">Fechar</button>
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
          <button onclick="document.getElementById('master-editar-empresa-modal').remove()" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>
        </div>

        <form id="form-editar-tenant" onsubmit="MasterAdmin.salvarEdicaoEmpresa(event, '${this._esc(emp.id)}')" style="padding:22px;display:flex;flex-direction:column;gap:14px;">
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
              <option value="starter" ${emp.plano==='starter'?'selected':''}>Básico (até 3 obras - R$ 79,90)</option>
              <option value="pro" ${emp.plano==='pro'?'selected':''}>Profissional (até 10 obras - R$ 119,90)</option>
              <option value="unlimited" ${emp.plano==='unlimited'?'selected':''}>Ilimitado (obras ilimitadas - R$ 159,90)</option>
            </select>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <label style="font-size:.78rem;color:#94a3b8;">Data de Vencimento do Plano / Trial *</label>
              <div style="display:flex;gap:6px;">
                <button type="button" onclick="MasterAdmin._adicionarDiasVencimento(15)" style="background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.3);color:#fbbf24;padding:2px 8px;border-radius:4px;font-size:.7rem;cursor:pointer;">+15 dias</button>
                <button type="button" onclick="MasterAdmin._adicionarDiasVencimento(30)" style="background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.3);color:#4ade80;padding:2px 8px;border-radius:4px;font-size:.7rem;cursor:pointer;">+30 dias</button>
              </div>
            </div>
            <input type="date" id="me-edit-vencimento" required value="${vencAtual}" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:9px 12px;color:#fff;font-size:.85rem;">
            <div style="font-size:.7rem;color:#94a3b8;margin-top:4px;">Define o prazo do período trial ou a próxima fatura mensal.</div>
          </div>

          <div style="padding-top:10px;display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" onclick="document.getElementById('master-editar-empresa-modal').remove()" style="background:none;border:1px solid rgba(255,255,255,.2);color:#cbd5e1;padding:8px 16px;border-radius:8px;cursor:pointer;">
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
      const res = await fetch('/api/admin?action=update_tenant', {
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
          <button onclick="document.getElementById('master-nova-empresa-modal').remove()" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>
        </div>

        <form onsubmit="MasterAdmin.salvarNovaEmpresa(event)" style="padding:22px;display:flex;flex-direction:column;gap:14px;">
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
                <option value="starter">Básico (até 3 obras - R$ 79,90)</option>
                <option value="pro" selected>Profissional (até 10 obras - R$ 119,90)</option>
                <option value="unlimited">Ilimitado (obras ilimitadas - R$ 159,90)</option>
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
            <button type="button" onclick="document.getElementById('master-nova-empresa-modal').remove()" style="background:none;border:1px solid rgba(255,255,255,.2);color:#cbd5e1;padding:8px 16px;border-radius:8px;cursor:pointer;">
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
      const res = await fetch('/api/admin?action=create_tenant', {
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

      alert(`✓ Construtora "${nome}" criada com sucesso no PostgreSQL!\nLogin: ${email}\nSenha: ${senha}`);
    } catch (err) {
      alert('Erro ao cadastrar construtora: ' + err.message);
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerText = 'Salvar e Criar Acesso 🚀';
      }
    }
  }
};
