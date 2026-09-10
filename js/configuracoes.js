// js/configuracoes.js — Settings: Users & Bank Accounts

const Configuracoes = {
  _activeTab: 'empresa',
  _usersCache: null,
  _auditCache: [],
  _auditOffset: 0,
  _auditHasMore: false,

  _esc(value) {
    if (typeof Utils !== 'undefined' && Utils.escapeHtml) return Utils.escapeHtml(String(value ?? ''));
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  },

  _perfilLabel(perfil) {
    return ({ superadmin:'Superadministrador', admin:'Administrador', gestor:'Gestor', operador:'Operador', visualizador:'Visualizador' })[String(perfil || '').toLowerCase()] || 'Usuário';
  },

  async loadUsers() {
    try {
      const res = await fetch('/api/users', { headers: Auth.getAuthHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !Array.isArray(data.users)) throw new Error(data.error || 'Falha ao carregar usuários.');
      this._usersCache = data.users;
      localStorage.setItem(Auth.USERS_KEY, JSON.stringify(data.users)); // apenas cache de interface
      this._refreshUsers();
      return data.users;
    } catch (err) {
      console.warn('[Usuários] Não foi possível atualizar a lista:', err);
      return this._usersCache || Auth.getUsers();
    }
  },

  async loadEmpresaCloud() {
    try {
      const res = await fetch('/api/tenant', { headers: Auth.getAuthHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.tenant) {
        DB.saveEmpresa({ ...data.tenant, whatsapp: (data.tenant.telefone || '').replace(/\D/g, ''), configurada: true });
        if (this._activeTab === 'empresa') {
          const content = document.getElementById('cfg-content');
          if (content) content.innerHTML = this._renderEmpresa();
        }
      }
    } catch (err) { console.warn('[Empresa] Cache local mantido:', err); }
  },

  render(obraId) {
    if (this._activeTab === 'sistema') {
      this._activeTab = 'empresa';
    }

    if (!document.getElementById('cfg-tab-styles')) {
      const s = document.createElement('style');
      s.id = 'cfg-tab-styles';
      s.textContent = '.cfg-tab{padding:10px 20px;border:none;background:transparent;color:var(--text3);font-family:inherit;font-size:.875rem;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:color .2s,border-color .2s;}.cfg-tab:hover{color:var(--text);}.cfg-tab-active{color:var(--accent)!important;border-bottom-color:var(--accent)!important;}';
      document.head.appendChild(s);
    }

    const session = Auth.getUser();
    const isAdmin = ['admin','superadmin'].includes(session?.perfil);
    if (!isAdmin && ['usuarios','auditoria'].includes(this._activeTab)) this._activeTab = 'empresa';

    return `
    <div>
      <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:24px;overflow-x:auto;">
        <button id="cfg-tab-empresa" class="cfg-tab${this._activeTab==='empresa'?' cfg-tab-active':''}" onclick="Configuracoes._switch('empresa')">
          &#x1F3E2; Minha Empresa
        </button>
        ${isAdmin ? `<button id="cfg-tab-usuarios" class="cfg-tab${this._activeTab==='usuarios'?' cfg-tab-active':''}" onclick="Configuracoes._switch('usuarios')">
          &#x1F465; Usu&aacute;rios
        </button>` : ''}
        ${isAdmin ? `<button id="cfg-tab-auditoria" class="cfg-tab${this._activeTab==='auditoria'?' cfg-tab-active':''}" onclick="Configuracoes._switch('auditoria')">
          &#x1F6E1;&#xFE0F; Auditoria
        </button>` : ''}
        <button id="cfg-tab-contas" class="cfg-tab${this._activeTab==='contas'?' cfg-tab-active':''}" onclick="Configuracoes._switch('contas')">
          &#x1F3E6; Contas Banc&aacute;rias
        </button>
        <button id="cfg-tab-categorias" class="cfg-tab${this._activeTab==='categorias'?' cfg-tab-active':''}" onclick="Configuracoes._switch('categorias')">
          &#x1F3F7;&#xFE0F; Categorias
        </button>
      </div>
      <div id="cfg-content">
        ${this._renderTab(this._activeTab, obraId)}
      </div>
    </div>`;
  },

  _switch(tab) {
    const isAdmin = ['admin','superadmin'].includes(Auth.getUser()?.perfil);
    const validTabs = ['empresa', 'contas', 'categorias', ...(isAdmin ? ['usuarios','auditoria'] : [])];
    if (!validTabs.includes(tab)) tab = 'empresa';
    this._activeTab = tab;
    document.querySelectorAll('.cfg-tab').forEach(el => el.classList.remove('cfg-tab-active'));
    const el = document.getElementById('cfg-tab-' + tab);
    if (el) el.classList.add('cfg-tab-active');
    const content = document.getElementById('cfg-content');
    if (content) content.innerHTML = this._renderTab(tab, App.obraId);
    if (tab === 'usuarios') this.loadUsers();
    if (tab === 'auditoria') this.loadAudit(true);
    if (tab === 'empresa') this.loadEmpresaCloud();
  },

  _renderTab(tab, obraId) {
    if (tab === 'empresa') return this._renderEmpresa();
    if (tab === 'contas') return Contas._html(obraId);
    if (tab === 'categorias') return this._renderCategorias();
    if (tab === 'usuarios') return this._renderUsuarios();
    if (tab === 'auditoria') return this._renderAuditoria();
    return this._renderEmpresa();
  },

  // ── MINHA EMPRESA / DADOS CADASTRAIS ───────────────────
  _renderEmpresa() {
    const emp = DB.getEmpresa();
    return `
    <div class="page-header">
      <div>
        <h1 class="page-title">&#x1F3E2; Dados da Minha Empresa</h1>
        <p class="page-sub">Configure a raz&atilde;o social, CNPJ, contatos e logotipo exibidos nos recibos, relat&oacute;rios e no sistema</p>
      </div>
    </div>

    <div class="g2" style="align-items:start;">
      <!-- FORMULÁRIO -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">&#x270F;&#xFE0F; Informa&ccedil;&otilde;es Cadastrais</div>
        </div>
        <form id="cfg-empresa-form" onsubmit="Configuracoes.saveEmpresa(event)">
          <div class="g2">
            <div class="form-group">
              <label class="form-label">Nome Fantasia *</label>
              <input class="form-control" name="nome_fantasia" id="cfg-emp-fantasia" value="${emp.nome_fantasia || ''}" required placeholder="Ex: Silva &amp; Souza Engenharia">
            </div>
            <div class="form-group">
              <label class="form-label">Raz&atilde;o Social</label>
              <input class="form-control" name="razao_social" id="cfg-emp-razao" value="${emp.razao_social || emp.nome_fantasia || ''}" placeholder="Ex: Silva &amp; Souza Construtora LTDA">
            </div>
          </div>

          <div class="g2">
            <div class="form-group">
              <label class="form-label">CNPJ ou CPF</label>
              <div style="display:flex;gap:6px;">
                <input class="form-control" name="cnpj" id="cfg-emp-cnpj" value="${emp.cnpj || ''}" placeholder="00.000.000/0001-00">
                <button type="button" class="btn btn-secondary btn-sm" onclick="Configuracoes.buscarCnpj()" title="Buscar dados do CNPJ na Receita">🔍</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Telefone / WhatsApp</label>
              <input class="form-control" name="telefone" id="cfg-emp-tel" value="${emp.telefone || ''}" placeholder="(00) 90000-0000">
            </div>
          </div>

          <div class="g2">
            <div class="form-group">
              <label class="form-label">E-mail Comercial</label>
              <input class="form-control" name="email" id="cfg-emp-email" type="email" value="${emp.email || ''}" placeholder="contato@empresa.com">
            </div>
            <div class="form-group">
              <label class="form-label">Endere&ccedil;o Completo</label>
              <input class="form-control" name="endereco" id="cfg-emp-end" value="${emp.endereco || ''}" placeholder="Rua, N&uacute;mero, Bairro">
            </div>
          </div>

          <div class="g2">
            <div class="form-group">
              <label class="form-label">Cidade</label>
              <input class="form-control" name="cidade" id="cfg-emp-cidade" value="${emp.cidade || ''}" placeholder="Cidade">
            </div>
            <div class="form-group">
              <label class="form-label">UF (Estado)</label>
              <input class="form-control" name="uf" id="cfg-emp-uf" value="${emp.uf || ''}" placeholder="UF" maxlength="2" style="text-transform:uppercase;">
            </div>
          </div>

          <div class="g2">
            <div class="form-group">
              <label class="form-label">Respons&aacute;vel T&eacute;cnico / Engenheiro</label>
              <input class="form-control" name="responsavel" id="cfg-emp-resp" value="${emp.responsavel || ''}" placeholder="Nome do respons&aacute;vel">
            </div>
            <div class="form-group">
              <label class="form-label">Registro Profissional (CREA / CAU)</label>
              <input class="form-control" name="crea_cau" id="cfg-emp-crea" value="${emp.crea_cau || ''}" placeholder="Ex: CREA-SP 12345/D">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight:800;display:flex;align-items:center;gap:6px;">
              <span>🏢 Logotipo Oficial da Empresa</span>
            </label>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
              <input type="file" id="cfg-logo-file" accept="image/*" style="display:none;" onchange="Configuracoes.handleLogoUpload(this)">
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('cfg-logo-file').click()" style="font-weight:700;">
                📁 Escolher Nova Imagem
              </button>
              ${emp.logo_url ? `<button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger);font-weight:600;" onclick="Configuracoes.removerLogo()">🗑️ Remover Logo</button>` : ''}
              <span id="cfg-logo-txt" style="font-size:.78rem;color:var(--text3);">${emp.logo_url ? '✓ Logotipo ativo no sistema' : 'Nenhuma imagem selecionada'}</span>
            </div>

            <!-- QUADRO DE INSTRUÇÕES E RECOMENDAÇÕES PARA O USUÁRIO -->
            <div style="background:rgba(18,217,160,0.03);border:1px solid rgba(18,217,160,0.22);border-radius:10px;padding:14px 16px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                <span style="font-size:1.1rem;">💡</span>
                <strong style="font-size:.88rem;color:var(--accent);">Guia & Recomendações para o Logotipo Perfeito</strong>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:10px;font-size:.78rem;line-height:1.45;">
                <div style="background:rgba(0,0,0,0.25);padding:10px 12px;border-radius:8px;border:1px solid var(--border-s);">
                  <div style="font-weight:700;color:var(--text);margin-bottom:3px;display:flex;align-items:center;gap:5px;">
                    <span>📐</span> Proporção Ideal: Horizontal (3:1 a 4:1)
                  </div>
                  <div style="color:var(--text2);">
                    Dimensões ideais de <strong>300x100px</strong> ou <strong>400x120px</strong>. Se sua marca for um símbolo/brasão quadrado (1:1), recomendamos usar a versão horizontal que inclua o nome da empresa ao lado.
                  </div>
                </div>

                <div style="background:rgba(0,0,0,0.25);padding:10px 12px;border-radius:8px;border:1px solid var(--border-s);">
                  <div style="font-weight:700;color:var(--text);margin-bottom:3px;display:flex;align-items:center;gap:5px;">
                    <span>🎨</span> Fundo Transparente (.PNG)
                  </div>
                  <div style="color:var(--text2);">
                    Dê preferência a imagens em <strong>.PNG com fundo transparente</strong>. Assim, o logo fica perfeito tanto no tema escuro do menu quanto no papel branco dos relatórios e dossiês impressos.
                  </div>
                </div>

                <div style="background:rgba(0,0,0,0.25);padding:10px 12px;border-radius:8px;border:1px solid var(--border-s);">
                  <div style="font-weight:700;color:var(--text);margin-bottom:3px;display:flex;align-items:center;gap:5px;">
                    <span>🚀</span> Aplicações no FinObra
                  </div>
                  <div style="color:var(--text2);">
                    Seu logotipo timbrado é inserido automaticamente no <strong>Menu Lateral</strong>, no <strong>Dossiê Executivo da Obra</strong>, em <strong>Recibos Oficiais</strong>, <strong>Ordens de Compra</strong> e <strong>Contratos</strong>.
                  </div>
                </div>
              </div>
            </div>

            <input type="hidden" name="logo_url" id="cfg-emp-logo" value="${emp.logo_url || ''}">
          </div>

          <button type="submit" class="btn btn-primary" style="margin-top:10px;">
            💾 Salvar Alterações da Empresa
          </button>
        </form>
      </div>

        <!-- PREVIEW CARD -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">👁️ Pré-visualização da Marca</div>
          </div>
          <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:20px;text-align:center;">
            
            <!-- DUPLA PRÉ-VISUALIZAÇÃO: TEMA ESCURO (MENU) & TEMA CLARO (RELATÓRIOS/IMPRESSÃO) -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;text-align:center;">
              <!-- Visualização 1: Menu Escuro -->
              <div style="background:#090C07;border:1px solid rgba(201,162,39,.3);border-radius:10px;padding:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:95px;">
                <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:8px;font-weight:700;">No Menu Lateral (Escuro)</div>
                <div id="cfg-logo-preview-dark" style="display:inline-flex;align-items:center;justify-content:center;padding:2px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(201,162,39,0.25);">
                  ${emp.logo_url 
                    ? `<img id="cfg-preview-logo-img-dark" src="${emp.logo_url}" alt="Logo" style="max-height:48px;max-width:180px;width:auto;height:auto;object-fit:contain;border-radius:6px;display:block;">` 
                    : `<div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#1C2D12,#243818);border:1px solid rgba(201,162,39,.4);display:inline-flex;align-items:center;justify-content:center;font-size:1.4rem;">🏢</div>`}
                </div>
              </div>

              <!-- Visualização 2: Papel Branco / Dossiê -->
              <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:95px;">
                <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:8px;font-weight:700;">No Dossiê / Papel A4 (Claro)</div>
                <div id="cfg-logo-preview-light" style="display:inline-flex;align-items:center;justify-content:center;padding:2px;">
                  ${emp.logo_url 
                    ? `<img id="cfg-preview-logo-img-light" src="${emp.logo_url}" alt="Logo" style="max-height:48px;max-width:180px;width:auto;height:auto;object-fit:contain;border-radius:6px;display:block;">` 
                    : `<div style="font-size:1rem;font-weight:900;color:#0f172a;">🏢 ${emp.nome_fantasia || 'Construtora'}</div>`}
                </div>
              </div>
            </div>

            <div style="font-size:1.2rem;font-weight:900;background:linear-gradient(135deg,var(--accent2),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
              ${emp.nome_fantasia || 'Nome da Construtora'}
            </div>
            <div style="color:var(--text2);font-size:.82rem;margin-top:2px;">
              ${emp.razao_social || 'Razão Social Não Informada'}
            </div>
            <div style="color:var(--text3);font-size:.76rem;margin-top:8px;">
              CNPJ: ${emp.cnpj || '00.000.000/0000-00'} &middot; ${emp.cidade || 'Cidade'}/${emp.uf || 'UF'}
            </div>

            <!-- CARD INTEGRAÇÃO WHATSAPP & ALERTAS -->
            <div class="card" style="margin-top:16px;background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:12px;padding:16px;">
              <div class="card-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;padding:0 0 12px;border-bottom:1px solid rgba(255,255,255,0.06);">
                <div>
                  <div class="card-title" style="font-size:.95rem;display:flex;align-items:center;gap:6px;font-weight:700;">
                    <span>📲</span> WhatsApp para Envio de Boletos &amp; Alertas
                  </div>
                  <div style="font-size:.76rem;color:var(--text3);margin-top:3px;line-height:1.4;">
                    Conecte o WhatsApp da sua construtora para envio de relatórios diários e alertas automáticos de contas a pagar.
                  </div>
                </div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                  <button type="button" class="btn btn-sm" onclick="WhatsApp.abrirModalConexao()" style="background:#25D366;color:#fff;font-weight:700;font-size:.78rem;display:flex;align-items:center;gap:6px;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;box-shadow:0 2px 6px rgba(37,211,102,0.25);">
                    📲 Conectar Aparelho (QR Code)
                  </button>
                  <button type="button" class="btn btn-sm btn-secondary" onclick="WhatsApp.abrirModalTelefone()" style="font-size:.76rem;display:flex;align-items:center;gap:5px;border-radius:6px;">
                    ✏️ Alterar Telefone
                  </button>
                </div>
              </div>
              
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding-top:10px;font-size:.84rem;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:1.1rem;">📱</span>
                  <span id="cfg-wa-ativo-txt">
                    Número ativo para alertas: <strong style="color:var(--success);">${(typeof WhatsApp !== 'undefined' && WhatsApp.getTelefonePadrao()) ? WhatsApp.formatarTelefone(WhatsApp.getTelefonePadrao()) : 'Nenhum número cadastrado'}</strong>
                  </span>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="WhatsApp.testarEnvioCliente()" style="font-size:.74rem;display:flex;align-items:center;gap:5px;border-radius:6px;">
                  🚀 Testar Envio
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    },

  async handleLogoUpload(input) {
    const file = input?.files?.[0];
    if (!file) return;
    try {
      Utils.toast('Processando e otimizando imagem do logotipo...', 'info');
      const res = await Utils.compressImage(file, 600, 240, 0.9);
      
      const hiddenInput = document.getElementById('cfg-emp-logo');
      if (hiddenInput) hiddenInput.value = res.dataUrl;

      const txt = document.getElementById('cfg-logo-txt');
      if (txt) txt.textContent = `✓ ${res.name} (${Math.round(res.sizeBytes / 1024)} KB)`;

      const darkBox = document.getElementById('cfg-logo-preview-dark');
      if (darkBox) {
        darkBox.innerHTML = `<img id="cfg-preview-logo-img-dark" src="${res.dataUrl}" alt="Logo" style="max-height:48px;max-width:180px;width:auto;height:auto;object-fit:contain;border-radius:6px;display:block;">`;
      }
      const lightBox = document.getElementById('cfg-logo-preview-light');
      if (lightBox) {
        lightBox.innerHTML = `<img id="cfg-preview-logo-img-light" src="${res.dataUrl}" alt="Logo" style="max-height:48px;max-width:180px;width:auto;height:auto;object-fit:contain;border-radius:6px;display:block;">`;
      }
      
      Utils.toast('Logotipo carregado! Clique em Salvar Alterações para aplicar.', 'success');
    } catch (err) {
      console.error('Erro no upload de logo:', err);
      Utils.toast(err.message || 'Falha ao processar arquivo de imagem.', 'error');
    }
  },

  removerLogo() {
    const hiddenInput = document.getElementById('cfg-emp-logo');
    if (hiddenInput) hiddenInput.value = '';
    const txt = document.getElementById('cfg-logo-txt');
    if (txt) txt.textContent = 'Logotipo removido';
    const darkBox = document.getElementById('cfg-logo-preview-dark');
    if (darkBox) {
      darkBox.innerHTML = `<div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#1C2D12,#243818);border:1px solid rgba(201,162,39,.4);display:inline-flex;align-items:center;justify-content:center;font-size:1.4rem;">🏢</div>`;
    }
    const lightBox = document.getElementById('cfg-logo-preview-light');
    if (lightBox) {
      lightBox.innerHTML = `<div style="font-size:1rem;font-weight:900;color:#0f172a;">🏢 Construtora</div>`;
    }
    Utils.toast('Logotipo removido. Clique em Salvar Alterações para aplicar.', 'info');
  },

  async buscarCnpj() {
    const raw = (document.getElementById('cfg-emp-cnpj')?.value || '').replace(/\D/g, '');
    if (raw.length !== 14) {
      Utils.toast('Informe um CNPJ válido com 14 dígitos para consultar!', 'warning');
      return;
    }
    Utils.toast('Consultando CNPJ na Receita Federal...', 'info');
    try {
      const res = await fetch(`/api/cnpj?cnpj=${raw}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Utils.toast(data.message || data.error || 'CNPJ não encontrado na Receita Federal.', 'warning');
        return;
      }
      if (data.razao_social || data.nome_fantasia) {
        if (data.nome_fantasia && document.getElementById('cfg-emp-fantasia')) document.getElementById('cfg-emp-fantasia').value = data.nome_fantasia;
        if (data.razao_social && document.getElementById('cfg-emp-razao')) document.getElementById('cfg-emp-razao').value = data.razao_social;
        if (data.municipio && document.getElementById('cfg-emp-cidade')) document.getElementById('cfg-emp-cidade').value = data.municipio;
        if (data.uf && document.getElementById('cfg-emp-uf')) document.getElementById('cfg-emp-uf').value = data.uf;
        if (data.ddd_telefone_1 && document.getElementById('cfg-emp-tel')) document.getElementById('cfg-emp-tel').value = data.ddd_telefone_1;
        if (data.email && document.getElementById('cfg-emp-email')) document.getElementById('cfg-emp-email').value = data.email;
        if (data.logradouro && document.getElementById('cfg-emp-end')) document.getElementById('cfg-emp-end').value = `${data.logradouro}, ${data.numero || ''} - ${data.bairro || ''}`;
        Utils.toast('Dados do CNPJ preenchidos automaticamente!', 'success');
      } else {
        Utils.toast('CNPJ consultado mas sem dados cadastrais adicionais.', 'info');
      }
    } catch {
      Utils.toast('Não foi possível consultar o CNPJ online no momento.', 'warning');
    }
  },

  async saveEmpresa(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const empresaData = {
      nome_fantasia: fd.get('nome_fantasia').trim(),
      razao_social: (fd.get('razao_social') || fd.get('nome_fantasia')).trim(),
      cnpj: fd.get('cnpj').trim(), telefone: fd.get('telefone').trim(),
      email: fd.get('email').trim(), endereco: fd.get('endereco').trim(),
      cidade: fd.get('cidade').trim(), uf: fd.get('uf').trim().toUpperCase(),
      responsavel: fd.get('responsavel').trim(), crea_cau: fd.get('crea_cau').trim(),
      logo_url: fd.get('logo_url') || ''
    };
    try {
      const res = await fetch('/api/tenant', { method:'PATCH', headers:Auth.getAuthHeaders(), body:JSON.stringify(empresaData) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível salvar os dados da empresa.');
      const saved = { ...data.tenant, whatsapp:(data.tenant.telefone || '').replace(/\D/g,''), configurada:true };
      DB.saveEmpresa(saved);
      if (saved.whatsapp && typeof WhatsApp !== 'undefined') WhatsApp.setTelefonePadrao(saved.whatsapp);
      Utils.toast('Dados da empresa salvos e sincronizados com o servidor!', 'success');
      App.renderShell();
      this._switch('empresa');
    } catch (err) {
      Utils.toast(err.message || 'Erro ao salvar dados da empresa.', 'error');
    }
  },

  // ── USUARIOS ──────────────────────────────────────────
  _renderUsuarios() {
    const users = this._usersCache || Auth.getUsers();
    const session = Auth.getUser();
    return `
    <div class="page-header">
      <div><h1 class="page-title">&#x1F465; Usu&aacute;rios do Sistema</h1><p class="page-sub">Gerencie os perfis de acesso ao sistema</p></div>
      <div class="page-actions">
        ${session?.perfil==='admin' ? '<button class="btn btn-primary" onclick="Configuracoes.showUserForm()">+ Novo Usu&aacute;rio</button>' : ''}
      </div>
    </div>
    <div id="users-list">
      ${users.map(u => this._userCard(u, session)).join('')}
    </div>`;
  },

  _userCard(u, session) {
    const perfis = { admin:'Administrador', gestor:'Gestor', visualizador:'Visualizador', operador:'Operador' };
    const isMe = session?.userId === u.id || session?.username === u.username;
    const nome = this._esc(u.nome), username = this._esc(u.username), email = this._esc(u.email || 'sem e-mail');
    const avatar = this._esc(u.avatar || (u.nome || 'US').slice(0,2).toUpperCase());
    const id = this._esc(u.id);
    return `
    <div class="card" style="margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
        <div class="user-av" style="width:52px;height:52px;font-size:1.2rem;flex-shrink:0;${!u.ativo?'opacity:.4;':''}">${avatar}</div>
        <div style="flex:1;min-width:180px;">
          <div style="font-weight:700;font-size:.95rem;">${nome} ${isMe?'<span style="font-size:.7rem;background:var(--accent-dim);color:var(--accent);padding:2px 8px;border-radius:20px;margin-left:6px;">Você</span>':''}</div>
          <div style="color:var(--text3);font-size:.78rem;margin-top:2px;">@${username} &middot; ${email}</div>
          <div style="margin-top:6px;display:flex;gap:6px;align-items:center;">
            <span class="badge ${u.perfil==='admin'?'badge-warning':u.perfil==='gestor'?'badge-success':'badge-secondary'}">${this._esc(perfis[u.perfil]||u.perfil)}</span>
            <span class="badge ${u.ativo?'badge-success':'badge-warning'}">${u.ativo?'Ativo':'Inativo'}</span>
          </div>
        </div>
        ${session?.perfil==='admin' ? `
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="Configuracoes.showUserForm('${id}')">✏️ Editar</button>
          ${!isMe ? `<button class="btn btn-sm ${u.ativo?'btn-warning':'btn-success'}" onclick="Configuracoes.toggleAtivo('${id}',${!!u.ativo})">${u.ativo?'Desativar':'Ativar'}</button>` : ''}
          ${isMe ? `<button class="btn btn-primary btn-sm" onclick="Configuracoes.showMeuPerfil()">👤 Meu Perfil</button>` : ''}
        </div>` : (isMe ? `<button class="btn btn-primary btn-sm" onclick="Configuracoes.showMeuPerfil()">👤 Meu Perfil</button>` : '')}
      </div>
    </div>`;
  },

  showUserForm(id) {
    const u = id ? (this._usersCache || []).find(u => u.id === id) : null;
    Utils.showModal(`
      <div class="modal" style="max-width:500px">
        <div class="modal-header">
          <span class="modal-title">&#x1F465; ${u ? 'Editar' : 'Novo'} Usu&aacute;rio</span>
          <button class="modal-close" onclick="Utils.closeModal()">&#x2715;</button>
        </div>
        <form class="modal-body" id="f-user" onsubmit="Configuracoes.saveUser(event,'${id||''}')">
          <div class="g2">
            <div class="form-group">
              <label class="form-label">Nome completo *</label>
              <input class="form-control" name="nome" value="${this._esc(u?.nome||'')}" required placeholder="Nome do usu&aacute;rio">
            </div>
            <div class="form-group">
              <label class="form-label">Usu&aacute;rio (login) *</label>
              <input class="form-control" name="username" value="${this._esc(u?.username||'')}" required placeholder="Ex: joao.silva">
            </div>
          </div>
          <div class="g2">
            <div class="form-group">
              <label class="form-label">E-mail *</label>
              <input class="form-control" name="email" type="email" required value="${this._esc(u?.email||'')}" placeholder="email@empresa.com">
            </div>
            <div class="form-group">
              <label class="form-label">Perfil *</label>
              <select class="form-control" name="perfil" required>
                <option value="admin" ${u?.perfil==='admin'?'selected':''}>Administrador</option>
                <option value="gestor" ${u?.perfil==='gestor'||!u?'selected':''}>Gestor</option>
                <option value="visualizador" ${u?.perfil==='visualizador'?'selected':''}>Visualizador</option>
                <option value="operador" ${u?.perfil==='operador'?'selected':''}>Operador</option>
              </select>
            </div>
          </div>
          <div class="g2">
            <div class="form-group">
              <label class="form-label">${u ? 'Nova Senha (deixe em branco para manter)' : 'Senha *'}</label>
              <input class="form-control" name="senha" type="password" placeholder="M&iacute;nimo 6 caracteres" ${u?'':'required'} minlength="6">
            </div>
            <div class="form-group">
              <label class="form-label">Avatar (2 letras)</label>
              <input class="form-control" name="avatar" maxlength="2" value="${this._esc(u?.avatar||'')}" placeholder="Ex: JS">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary">&#x1F4BE; Salvar</button>
          </div>
        </form>
      </div>`);
  },

  async saveUser(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { nome:fd.get('nome').trim(), username:fd.get('username').trim(), email:fd.get('email').trim(), perfil:fd.get('perfil'), avatar:fd.get('avatar').trim(), senha:fd.get('senha') || undefined };
    if (!id && (!body.senha || body.senha.length < 6)) { Utils.toast('Senha deve ter pelo menos 6 caracteres!', 'warning'); return; }
    if (id) body.id = id;
    try {
      const res = await fetch('/api/users', { method:id?'PATCH':'POST', headers:Auth.getAuthHeaders(), body:JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao salvar usuário.');
      Utils.toast(id ? 'Usuário atualizado no servidor!' : 'Usuário criado no servidor!', 'success');
      Utils.closeModal(); await this.loadUsers();
    } catch (err) { Utils.toast(err.message, 'error'); }
  },

  async toggleAtivo(id, ativo) {
    try {
      const res = await fetch('/api/users', { method:'PATCH', headers:Auth.getAuthHeaders(), body:JSON.stringify({ id, ativo:!ativo }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao alterar usuário.');
      Utils.toast(ativo ? 'Usuário desativado.' : 'Usuário ativado!', 'info'); await this.loadUsers();
    } catch (err) { Utils.toast(err.message, 'error'); }
  },

  showMeuPerfil() {
    const session = Auth.getUser();
    const users = this._usersCache || Auth.getUsers();
    const u = users.find(u => u.id === session?.userId || u.username === session?.username) || {
      id: session?.userId || session?.id,
      username: session?.username || '', email: session?.email || '', nome: session?.nome || 'Usuário',
      perfil: session?.perfil || 'visualizador', avatar: session?.avatar || 'US', ativo: true
    };
    if (!u.id) return;
    Utils.showModal(`
      <div class="modal" style="max-width:440px">
        <div class="modal-header">
          <span class="modal-title">&#x1F464; Meu Perfil</span>
          <button class="modal-close" onclick="Utils.closeModal()">&#x2715;</button>
        </div>
        <form class="modal-body" id="f-meu-perfil" onsubmit="Configuracoes.saveMeuPerfil(event,'${u.id}')">
          <div style="text-align:center;margin-bottom:20px;">
            <div class="user-av" style="width:64px;height:64px;font-size:1.5rem;margin:0 auto 12px;">${this._esc(u.avatar)}</div>
            <div style="font-weight:700;">${this._esc(u.nome)}</div>
            <div style="color:var(--text3);font-size:.8rem;">${this._esc(this._perfilLabel(u.perfil))}</div>
          </div>
          <div class="form-group">
            <label class="form-label">Nome completo</label>
            <input class="form-control" name="nome" value="${this._esc(u.nome)}" required>
          </div>
          <div class="form-group">
            <label class="form-label">E-mail</label>
            <input class="form-control" name="email" type="email" value="${this._esc(u.email||'')}">
          </div>
          <div class="form-group">
            <label class="form-label">Avatar (2 letras)</label>
            <input class="form-control" name="avatar" maxlength="2" value="${this._esc(u.avatar||'')}">
          </div>
          <hr style="border-color:var(--border);margin:16px 0;">
          <div style="color:var(--text3);font-size:.8rem;margin-bottom:10px;">Alterar senha (deixe em branco para manter a atual)</div>
          <div class="g2">
            <div class="form-group">
              <label class="form-label">Senha atual</label>
              <input class="form-control" name="senha_atual" type="password" placeholder="Senha atual">
            </div>
            <div class="form-group">
              <label class="form-label">Nova senha</label>
              <input class="form-control" name="nova_senha" type="password" placeholder="M&iacute;nimo 6 caracteres">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary">&#x1F4BE; Salvar Perfil</button>
          </div>
        </form>
      </div>`);
  },

  async saveMeuPerfil(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { id, nome:fd.get('nome').trim(), email:fd.get('email').trim(), avatar:fd.get('avatar').trim(), senha_atual:fd.get('senha_atual') || undefined, senha:fd.get('nova_senha') || undefined };
    if (body.senha && body.senha.length < 6) { Utils.toast('Nova senha deve ter pelo menos 6 caracteres!', 'warning'); return; }
    try {
      const res = await fetch('/api/users', { method:'PATCH', headers:Auth.getAuthHeaders(), body:JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao atualizar perfil.');
      const updated = data.user;
      const updateSession = storage => { const raw=storage.getItem(Auth.SESSION_KEY); if(!raw)return; try{const sess=JSON.parse(raw); Object.assign(sess,{nome:updated.nome,email:updated.email,avatar:updated.avatar,username:updated.username}); storage.setItem(Auth.SESSION_KEY,JSON.stringify(sess));}catch{} };
      updateSession(localStorage); updateSession(sessionStorage);
      Utils.toast('Perfil atualizado no servidor!', 'success'); Utils.closeModal(); await this.loadUsers();
      if (typeof App !== 'undefined' && App.renderShell) App.renderShell();
    } catch (err) { Utils.toast(err.message, 'error'); }
  },

  _refreshUsers() {
    const el = document.getElementById('users-list');
    if (!el) return;
    const users = this._usersCache || Auth.getUsers();
    const session = Auth.getUser();
    el.innerHTML = users.map(u => this._userCard(u, session)).join('');
  },

  // ── AUDITORIA ───────────────────────────────────────────
  _renderAuditoria() {
    return `
    <div class="page-header">
      <div>
        <h1 class="page-title">🛡️ Auditoria</h1>
        <p class="page-sub">Histórico de alterações administrativas e operacionais registradas no servidor</p>
      </div>
      <div class="page-actions"><button class="btn btn-secondary btn-sm" onclick="Configuracoes.loadAudit(true)">↻ Atualizar</button></div>
    </div>
    <div class="card" style="padding:0;overflow:hidden;">
      <div id="audit-list" style="min-height:180px;padding:18px;color:var(--text3);">Carregando auditoria…</div>
    </div>
    <div style="display:flex;justify-content:center;margin-top:14px;">
      <button id="audit-load-more" class="btn btn-secondary btn-sm" style="display:none" onclick="Configuracoes.loadAudit(false)">Carregar mais</button>
    </div>`;
  },

  async loadAudit(reset = true) {
    if (!['admin','superadmin'].includes(Auth.getUser()?.perfil)) return;
    if (reset) { this._auditCache = []; this._auditOffset = 0; this._auditHasMore = false; }
    const list = document.getElementById('audit-list');
    if (list && reset) list.textContent = 'Carregando auditoria…';
    try {
      const res = await fetch(`/api/audit?limit=50&offset=${this._auditOffset}`, { headers: Auth.getAuthHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !Array.isArray(data.data)) throw new Error(data.error || 'Falha ao carregar auditoria.');
      this._auditCache.push(...data.data);
      this._auditOffset = Number(data.pagination?.nextOffset || this._auditCache.length);
      this._auditHasMore = !!data.pagination?.hasMore;
      this._refreshAudit();
    } catch (err) {
      if (list) list.textContent = err.message || 'Não foi possível carregar a auditoria.';
    }
  },

  _refreshAudit() {
    const el = document.getElementById('audit-list');
    if (!el) return;
    const rows = this._auditCache || [];
    if (!rows.length) {
      el.innerHTML = '<div style="padding:28px;text-align:center;color:var(--text3);">Nenhum evento de auditoria registrado ainda.</div>';
    } else {
      el.innerHTML = `<div class="tbl-wrap" style="border:none;"><table>
        <thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Registro</th><th>Origem</th><th></th></tr></thead>
        <tbody>${rows.map(r => {
          const id = this._esc(r.id || '');
          const data = r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '—';
          return `<tr>
            <td style="white-space:nowrap;font-size:.78rem;">${this._esc(data)}</td>
            <td><strong>${this._esc(r.usuario_nome || 'Sistema')}</strong><div style="font-size:.7rem;color:var(--text3);">${this._esc(r.usuario_username || '')}</div></td>
            <td><span class="badge badge-secondary">${this._esc(r.acao || '—')}</span></td>
            <td>${this._esc(r.entidade || '—')}</td>
            <td style="font-family:monospace;font-size:.72rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;">${this._esc(r.entidade_id || '—')}</td>
            <td style="font-size:.72rem;color:var(--text3);">${this._esc(r.ip || '—')}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="Configuracoes.showAuditDetail('${id}')">Detalhes</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`;
    }
    const more = document.getElementById('audit-load-more');
    if (more) more.style.display = this._auditHasMore ? '' : 'none';
  },

  showAuditDetail(id) {
    const r = (this._auditCache || []).find(x => String(x.id) === String(id));
    if (!r) return;
    const pretty = v => this._esc(JSON.stringify(v || {}, null, 2));
    Utils.showModal(`<div class="modal" style="max-width:720px;">
      <div class="modal-header"><span class="modal-title">🛡️ Detalhes da Auditoria</span><button class="modal-close" onclick="Utils.closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="g2" style="margin-bottom:14px;"><div><strong>Ação:</strong> ${this._esc(r.acao)}</div><div><strong>Entidade:</strong> ${this._esc(r.entidade)}</div></div>
        <div style="margin-bottom:8px;"><strong>Antes</strong></div><pre style="white-space:pre-wrap;background:var(--bg);padding:12px;border-radius:8px;max-height:220px;overflow:auto;font-size:.75rem;">${pretty(r.dados_anteriores)}</pre>
        <div style="margin:14px 0 8px;"><strong>Depois</strong></div><pre style="white-space:pre-wrap;background:var(--bg);padding:12px;border-radius:8px;max-height:220px;overflow:auto;font-size:.75rem;">${pretty(r.dados_novos)}</pre>
      </div>
    </div>`);
  },

  // ── CATEGORIAS ─────────────────────────────────────────
  _renderCategorias() {
    const EMOJIS = ['🏷️','🌟','⚡','🔑','📌','🎨','🛒','💼','🌿','🔩','📐','🎯','💡','🚀','🏆','📣','🤝','🔐','🧹','🏥','🎓','🌎','🏃'];

    const makeTable = (custom, tipo) => {
      if (!custom.length) return `<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:16px;font-size:.82rem;">Nenhuma categoria personalizada criada ainda.</td></tr>`;
      return custom.map(c => {
        const safeValue = String(c.value || '');
        const encodedValue = encodeURIComponent(safeValue);
        return `
        <tr>
          <td style="font-size:1.1rem;width:40px;text-align:center;">${this._esc(c.emoji || '🏷️')}</td>
          <td style="font-weight:600;">${this._esc(c.label || '')}</td>
          <td style="font-family:monospace;font-size:.75rem;color:var(--text3);">${this._esc(safeValue)}</td>
          <td style="text-align:center;">
            <button class="icon-btn" onclick="Configuracoes.excluirCategoria(decodeURIComponent('${encodedValue}'),'${tipo}')" title="Excluir" style="color:var(--danger);">🗑️</button>
          </td>
        </tr>`;
      }).join('');
    };

    const makeEmojiSelect = (id) =>
      `<select class="form-control" id="${id}" style="font-size:1.1rem;width:80px;">${EMOJIS.map(e => `<option value="${e}">${e}</option>`).join('')}</select>`;

    const customForn = typeof Fornecedores !== 'undefined' ? Fornecedores._getCustomCategorias() : [];
    const customDesp = typeof Escritorio !== 'undefined' ? Escritorio._getAllDespesaCats() : [];

    return `
    <div class="page-header">
      <div><h1 class="page-title">🏷️ Categorias Personalizadas</h1><p class="page-sub">Crie categorias para Fornecedores/Prestadores e para Despesas do Escritório</p></div>
    </div>

    <div style="font-size:.7rem;font-weight:800;color:var(--accent2);letter-spacing:.1em;margin-bottom:10px;">🏭 FORNECEDORES / PRESTADORES</div>
    <div class="card" style="margin-bottom:14px;">
      <div class="card-header"><div class="card-title">➕ Nova Categoria de Fornecedor</div></div>
      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;padding:4px 0 8px;">
        <div class="form-group" style="margin-bottom:0;"><label class="form-label">Emoji</label>${makeEmojiSelect('cfg-cat-emoji-forn')}</div>
        <div class="form-group" style="flex:1;min-width:180px;margin-bottom:0;"><label class="form-label">Nome da Categoria *</label><input class="form-control" id="cfg-cat-nome-forn" placeholder="Ex: Segurança, Limpeza, RH..." maxlength="60"></div>
        <button class="btn btn-primary" onclick="Configuracoes.saveCategoria('forn')">+ Criar</button>
      </div>
    </div>
    <div class="card" style="margin-bottom:28px;padding:0;">
      <div class="card-header" style="padding:12px 16px;"><div class="card-title">⭐ Personalizadas — Fornecedores</div></div>
      <div class="tbl-wrap" style="border:none;"><table>
        <thead><tr><th style="width:50px;"></th><th>Nome</th><th>Chave interna</th><th style="text-align:center;">Ações</th></tr></thead>
        <tbody>${makeTable(customForn, 'forn')}</tbody>
      </table></div>
    </div>

    <div style="font-size:.7rem;font-weight:800;color:var(--accent2);letter-spacing:.1em;margin-bottom:10px;">🏢 DESPESAS DO ESCRITÓRIO / SEDE</div>
    <div class="card" style="margin-bottom:14px;">
      <div class="card-header"><div class="card-title">➕ Nova Categoria de Despesa</div></div>
      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;padding:4px 0 8px;">
        <div class="form-group" style="margin-bottom:0;"><label class="form-label">Emoji</label>${makeEmojiSelect('cfg-cat-emoji-desp')}</div>
        <div class="form-group" style="flex:1;min-width:180px;margin-bottom:0;"><label class="form-label">Nome da Categoria *</label><input class="form-control" id="cfg-cat-nome-desp" placeholder="Ex: Farmácia, Alimentação, RH..." maxlength="60"></div>
        <button class="btn btn-primary" onclick="Configuracoes.saveCategoria('desp')">+ Criar</button>
      </div>
    </div>
    <div class="card" style="padding:0;">
      <div class="card-header" style="padding:12px 16px;"><div class="card-title">⭐ Personalizadas — Despesas</div></div>
      <div class="tbl-wrap" style="border:none;"><table>
        <thead><tr><th style="width:50px;"></th><th>Nome</th><th>Chave interna</th><th style="text-align:center;">Ações</th></tr></thead>
        <tbody>${makeTable(customDesp, 'desp')}</tbody>
      </table></div>
    </div>`;
  },

  saveCategoria(tipo) {
    const isForn = tipo === 'forn';
    const nomeEl  = document.getElementById(isForn ? 'cfg-cat-nome-forn' : 'cfg-cat-nome-desp');
    const emojiEl = document.getElementById(isForn ? 'cfg-cat-emoji-forn' : 'cfg-cat-emoji-desp');
    const nome  = (nomeEl?.value || '').trim();
    const emoji = emojiEl?.value || '🏷️';
    if (!nome) { Utils.toast('Informe o nome da categoria!', 'warning'); return; }

    const slug = nome.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    if (isForn) {
      const todas = typeof Fornecedores !== 'undefined' ? Fornecedores._getAllCategorias() : [];
      if (todas.find(c => c.value === slug)) { Utils.toast('Já existe uma categoria de fornecedor com esse nome!', 'warning'); return; }
      const custom = typeof Fornecedores !== 'undefined' ? Fornecedores._getCustomCategorias() : [];
      custom.push({ value: slug, label: `${emoji} ${nome}`, emoji });
      if (typeof Fornecedores !== 'undefined') Fornecedores._saveCustomCategorias(custom);
    } else {
      const todas = typeof Escritorio !== 'undefined' ? Escritorio._getAllDespesaCats() : [];
      if (todas.find(c => c.value === slug)) { Utils.toast('Já existe uma categoria de despesa com esse nome!', 'warning'); return; }
      todas.push({ value: slug, label: `${emoji} ${nome}`, emoji });
      if (typeof Escritorio !== 'undefined') Escritorio._saveDespesaCats(todas);
    }

    Utils.toast(`Categoria "${emoji} ${nome}" criada!`, 'success');
    if (nomeEl) nomeEl.value = '';
    this._switch('categorias');
  },

  excluirCategoria(value, tipo) {
    Utils.confirm('Excluir esta categoria? Registros já cadastrados nela não serão afetados.', () => {
      if (tipo === 'forn') {
        const custom = typeof Fornecedores !== 'undefined' ? Fornecedores._getCustomCategorias() : [];
        if (typeof Fornecedores !== 'undefined') Fornecedores._saveCustomCategorias(custom.filter(c => c.value !== value));
      } else {
        const custom = typeof Escritorio !== 'undefined' ? Escritorio._getAllDespesaCats() : [];
        if (typeof Escritorio !== 'undefined') Escritorio._saveDespesaCats(custom.filter(c => c.value !== value));
      }
      Utils.toast('Categoria excluída.', 'info');
      this._switch('categorias');
    });
  },



  criarSnapshot() {
    try {
      const backup = {};
      ['clientes','lancamentos','notas','orcamentos','medicoes','ofximports','contas','precompras','fornecedores'].forEach(k => {
        backup[k] = DB.getAll(k);
      });
      backup.documentos = (typeof Documentos !== 'undefined' ? Documentos.getAll() : []).map(d => {
        const { base64_data, base64, ...rest } = d;
        return rest;
      });
      backup.recibos = typeof Recibos !== 'undefined' ? Recibos.getAll() : [];
      backup.contratos = typeof Contratos !== 'undefined' ? Contratos.getAll() : [];
      backup.orcamentos_sinapi = JSON.parse(localStorage.getItem(DB._ck ? DB._ck('orcamentos_sinapi') : 'orcamentos_sinapi') || '[]');
      backup.preferencias = (DB._preferencesLocalSnapshot ? DB._preferencesLocalSnapshot() : {});
      backup.doc_fases = (DB._collectLocalDocPhases ? DB._collectLocalDocPhases() : []);
      backup.saved_at = new Date().toISOString();
      backup.totalLancamentos = (backup.lancamentos || []).length;
      localStorage.setItem(DB._ck ? DB._ck('finobra_snapshot_seguranca') : 'finobra_snapshot_seguranca', JSON.stringify(backup));
      Utils.toast('🛡️ Ponto de restauração gravado!', 'success');
      this._switch('sistema');
    } catch (e) {
      console.warn('Erro ao criar snapshot:', e);
      Utils.toast('Ponto de restauração salvo nos dados principais!', 'info');
    }
  },

  exportarBackup() {
    const backup = {};
    ['clientes','lancamentos','notas','orcamentos','medicoes','ofximports','contas','precompras','fornecedores'].forEach(k => {
      backup[k] = DB.getAll(k);
    });
    backup.documentos = typeof Documentos !== 'undefined' ? Documentos.getAll() : [];
    backup.recibos = typeof Recibos !== 'undefined' ? Recibos.getAll() : [];
    backup.contratos = typeof Contratos !== 'undefined' ? Contratos.getAll() : [];
    backup.orcamentos_sinapi = JSON.parse(localStorage.getItem(DB._ck ? DB._ck('orcamentos_sinapi') : 'orcamentos_sinapi') || '[]');
      backup.preferencias = (DB._preferencesLocalSnapshot ? DB._preferencesLocalSnapshot() : {});
      backup.doc_fases = (DB._collectLocalDocPhases ? DB._collectLocalDocPhases() : []);
    backup.exported_at = new Date().toISOString();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `finobra_backup_${Auth.getCurrentTenantId()}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    Utils.toast('Backup exportado com sucesso!', 'success');
  },

  importarBackup(input) {
    const file = input?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target.result);
        if (!backup || typeof backup !== 'object') throw new Error('Arquivo JSON inválido.');

        Utils.confirm('⚠️ Tem certeza que deseja restaurar este backup? Os dados atuais serão substituídos pelos do arquivo.', () => {
          // Salva snapshot de emergência antes
          Configuracoes.criarSnapshot();

          ['clientes','lancamentos','notas','orcamentos','medicoes','ofximports','contas','precompras','fornecedores'].forEach(k => {
            if (Array.isArray(backup[k])) DB.save(k, backup[k]);
          });

          if (Array.isArray(backup.documentos) && typeof Documentos !== 'undefined') {
            Documentos.salvarLista(backup.documentos);
          }
          if (Array.isArray(backup.recibos) && typeof Recibos !== 'undefined') {
            localStorage.setItem(DB._ck ? DB._ck('finobra_recibos') : 'finobra_recibos', JSON.stringify(backup.recibos));
          }
          if (Array.isArray(backup.contratos) && typeof Contratos !== 'undefined') {
            localStorage.setItem(DB._ck ? DB._ck('finobra_contratos') : 'finobra_contratos', JSON.stringify(backup.contratos));
          }
          if (Array.isArray(backup.orcamentos_sinapi)) {
            localStorage.setItem(DB._ck ? DB._ck('orcamentos_sinapi') : 'orcamentos_sinapi', JSON.stringify(backup.orcamentos_sinapi));
          }
          if (backup.preferencias && typeof backup.preferencias === 'object' && DB._applyTenantPreferences) {
            DB._applyTenantPreferences(backup.preferencias);
          }
          if (Array.isArray(backup.doc_fases) && DB._fasesDocKey) {
            const grouped = new Map();
            backup.doc_fases.forEach(d => {
              if (!d?.obra_id || !d?.doc_id || !d?.fase_key) return;
              if (!grouped.has(d.obra_id)) grouped.set(d.obra_id, {});
              const obj = grouped.get(d.obra_id);
              if (!Array.isArray(obj[d.fase_key])) obj[d.fase_key] = [];
              obj[d.fase_key].push({ ...d, id:d.doc_id });
            });
            grouped.forEach((value, obraId) => localStorage.setItem(DB._fasesDocKey(obraId), JSON.stringify(value)));
          }
          Utils.toast('✅ Backup restaurado com sucesso!', 'success');
          setTimeout(() => location.reload(), 800);
        });
      } catch (err) {
        Utils.toast(`Erro ao importar backup: ${err.message}`, 'error');
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  },

  async sincronizarTudoNeon() {
    Utils.toast('Enviando dados para o Neon PostgreSQL...', 'info');
    const res = await DB.syncAllToCloud();
    if (res && res.success) {
      Utils.toast(`✅ Sincronizado com sucesso! ${res.synced || 0} registros enviados ao Neon.`, 'success');
    } else {
      Utils.toast('Erro ao sincronizar com o Neon: ' + (res?.error || 'Falha na conexão'), 'error');
    }
  },

  async baixarDadosNeon() {
    Utils.toast('Baixando dados do Neon PostgreSQL...', 'info');
    const ok = await DB.syncFromCloud();
    if (ok) {
      Utils.toast('✅ Dados atualizados com sucesso da nuvem!', 'success');
      setTimeout(() => location.reload(), 600);
    } else {
      Utils.toast('Erro ao baixar dados do Neon.', 'error');
    }
  },

  init() {
    if (this._activeTab === 'usuarios') this.loadUsers();
    else if (this._activeTab === 'auditoria') this.loadAudit(true);
    else if (this._activeTab === 'empresa') this.loadEmpresaCloud();
  }
};

// Limpa qualquer flag antiga de dev mode que possa ter ficado no browser
try {
  localStorage.removeItem('finobra_dev_mode');
} catch (_) {}
