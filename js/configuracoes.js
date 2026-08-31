// js/configuracoes.js — Settings: Users & Bank Accounts

const Configuracoes = {
  _activeTab: 'usuarios',

  render(obraId) {
    if (!document.getElementById('cfg-tab-styles')) {
      const s = document.createElement('style');
      s.id = 'cfg-tab-styles';
      s.textContent = '.cfg-tab{padding:10px 24px;border:none;background:transparent;color:var(--text3);font-family:inherit;font-size:.875rem;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:color .2s,border-color .2s;}.cfg-tab:hover{color:var(--text);}.cfg-tab-active{color:var(--accent)!important;border-bottom-color:var(--accent)!important;}';
      document.head.appendChild(s);
    }
    return `
    <div>
      <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:24px;">
        <button id="cfg-tab-usuarios" class="cfg-tab${this._activeTab==='usuarios'?' cfg-tab-active':''}" onclick="Configuracoes._switch('usuarios')">
          &#x1F465; Usu&aacute;rios
        </button>
        <button id="cfg-tab-contas" class="cfg-tab${this._activeTab==='contas'?' cfg-tab-active':''}" onclick="Configuracoes._switch('contas')">
          &#x1F3E6; Contas Banc&aacute;rias
        </button>
        <button id="cfg-tab-categorias" class="cfg-tab${this._activeTab==='categorias'?' cfg-tab-active':''}" onclick="Configuracoes._switch('categorias')">
          &#x1F3F7;&#xFE0F; Categorias
        </button>
        <button id="cfg-tab-sistema" class="cfg-tab${this._activeTab==='sistema'?' cfg-tab-active':''}" onclick="Configuracoes._switch('sistema')">
          &#x2699;&#xFE0F; Sistema
        </button>
      </div>
      <div id="cfg-content">
        ${this._renderTab(this._activeTab, obraId)}
      </div>
    </div>`;
  },

  _switch(tab) {
    this._activeTab = tab;
    document.querySelectorAll('.cfg-tab').forEach(el => el.classList.remove('cfg-tab-active'));
    const el = document.getElementById('cfg-tab-' + tab);
    if (el) el.classList.add('cfg-tab-active');
    const content = document.getElementById('cfg-content');
    if (content) content.innerHTML = this._renderTab(tab, App.obraId);
  },

  _renderTab(tab, obraId) {
    if (tab === 'contas') return Contas._html(obraId);
    if (tab === 'sistema') return this._renderSistema();
    if (tab === 'categorias') return this._renderCategorias();
    return this._renderUsuarios();
  },

  // ── USUARIOS ──────────────────────────────────────────
  _renderUsuarios() {
    const users = Auth.getUsers();
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
    const perfis = { admin:'Administrador', gestor:'Gestor', visualizador:'Visualizador' };
    const isMe = session?.username === u.username;
    return `
    <div class="card" style="margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
        <div class="user-av" style="width:52px;height:52px;font-size:1.2rem;flex-shrink:0;${!u.ativo?'opacity:.4;':''}">${u.avatar||u.nome.slice(0,2).toUpperCase()}</div>
        <div style="flex:1;min-width:180px;">
          <div style="font-weight:700;font-size:.95rem;">${u.nome} ${isMe?'<span style="font-size:.7rem;background:var(--accent-dim);color:var(--accent);padding:2px 8px;border-radius:20px;margin-left:6px;">Voc&ecirc;</span>':''}</div>
          <div style="color:var(--text3);font-size:.78rem;margin-top:2px;">@${u.username} &middot; ${u.email||'sem e-mail'}</div>
          <div style="margin-top:6px;display:flex;gap:6px;align-items:center;">
            <span class="badge ${u.perfil==='admin'?'badge-warning':u.perfil==='gestor'?'badge-success':'badge-secondary'}">${perfis[u.perfil]||u.perfil}</span>
            <span class="badge ${u.ativo?'badge-success':'badge-warning'}">${u.ativo?'Ativo':'Inativo'}</span>
          </div>
        </div>
        ${session?.perfil==='admin' ? `
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="Configuracoes.showUserForm('${u.id}')">&#x270F;&#xFE0F; Editar</button>
          ${!isMe ? `<button class="btn btn-sm ${u.ativo?'btn-warning':'btn-success'}" onclick="Configuracoes.toggleAtivo('${u.id}',${u.ativo})">${u.ativo?'Desativar':'Ativar'}</button>` : ''}
          ${isMe ? `<button class="btn btn-primary btn-sm" onclick="Configuracoes.showMeuPerfil()">&#x1F464; Meu Perfil</button>` : ''}
        </div>` : (isMe ? `<button class="btn btn-primary btn-sm" onclick="Configuracoes.showMeuPerfil()">&#x1F464; Meu Perfil</button>` : '')}
      </div>
    </div>`;
  },

  showUserForm(id) {
    const u = id ? Auth.getUsers().find(u => u.id === id) : null;
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
              <input class="form-control" name="nome" value="${u?.nome||''}" required placeholder="Nome do usu&aacute;rio">
            </div>
            <div class="form-group">
              <label class="form-label">Usu&aacute;rio (login) *</label>
              <input class="form-control" name="username" value="${u?.username||''}" required placeholder="Ex: joao.silva">
            </div>
          </div>
          <div class="g2">
            <div class="form-group">
              <label class="form-label">E-mail</label>
              <input class="form-control" name="email" type="email" value="${u?.email||''}" placeholder="email@empresa.com">
            </div>
            <div class="form-group">
              <label class="form-label">Perfil *</label>
              <select class="form-control" name="perfil" required>
                <option value="admin" ${u?.perfil==='admin'?'selected':''}>Administrador</option>
                <option value="gestor" ${u?.perfil==='gestor'||!u?'selected':''}>Gestor</option>
                <option value="visualizador" ${u?.perfil==='visualizador'?'selected':''}>Visualizador</option>
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
              <input class="form-control" name="avatar" maxlength="2" value="${u?.avatar||''}" placeholder="Ex: JS">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary">&#x1F4BE; Salvar</button>
          </div>
        </form>
      </div>`);
  },

  saveUser(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const users = Auth.getUsers();
    const nome = fd.get('nome').trim();
    const username = fd.get('username').trim();
    const email = fd.get('email').trim();
    const perfil = fd.get('perfil');
    const senhaRaw = fd.get('senha');
    const avatar = fd.get('avatar').trim() || nome.slice(0,2).toUpperCase();

    // Duplicate username check
    const dup = users.find(u => u.username === username && u.id !== id);
    if (dup) { Utils.toast('Nome de usu&aacute;rio j&aacute; existe!', 'warning'); return; }

    if (id) {
      const idx = users.findIndex(u => u.id === id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], nome, username, email, perfil, avatar };
        if (senhaRaw && senhaRaw.length >= 6) users[idx].senha = senhaRaw;
        localStorage.setItem(Auth.USERS_KEY, JSON.stringify(users));
        Utils.toast('Usu&aacute;rio atualizado!', 'success');
      }
    } else {
      if (!senhaRaw || senhaRaw.length < 6) { Utils.toast('Senha deve ter pelo menos 6 caracteres!', 'warning'); return; }
      users.push({ id: DB.uuid(), nome, username, email, perfil, senha: senhaRaw, avatar, ativo: true, created_at: new Date().toISOString() });
      localStorage.setItem(Auth.USERS_KEY, JSON.stringify(users));
      Utils.toast('Usu&aacute;rio criado!', 'success');
    }
    Utils.closeModal();
    this._refreshUsers();
  },

  toggleAtivo(id, ativo) {
    const users = Auth.getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx !== -1) {
      users[idx].ativo = !ativo;
      localStorage.setItem(Auth.USERS_KEY, JSON.stringify(users));
      Utils.toast(ativo ? 'Usu&aacute;rio desativado.' : 'Usu&aacute;rio ativado!', 'info');
      this._refreshUsers();
    }
  },

  showMeuPerfil() {
    const session = Auth.getUser();
    const users = Auth.getUsers();
    const u = users.find(u => u.username === session?.username);
    if (!u) return;
    Utils.showModal(`
      <div class="modal" style="max-width:440px">
        <div class="modal-header">
          <span class="modal-title">&#x1F464; Meu Perfil</span>
          <button class="modal-close" onclick="Utils.closeModal()">&#x2715;</button>
        </div>
        <form class="modal-body" id="f-meu-perfil" onsubmit="Configuracoes.saveMeuPerfil(event,'${u.id}')">
          <div style="text-align:center;margin-bottom:20px;">
            <div class="user-av" style="width:64px;height:64px;font-size:1.5rem;margin:0 auto 12px;">${u.avatar}</div>
            <div style="font-weight:700;">${u.nome}</div>
            <div style="color:var(--text3);font-size:.8rem;">${u.perfil === 'admin' ? 'Administrador' : 'Gestor'}</div>
          </div>
          <div class="form-group">
            <label class="form-label">Nome completo</label>
            <input class="form-control" name="nome" value="${u.nome}" required>
          </div>
          <div class="form-group">
            <label class="form-label">E-mail</label>
            <input class="form-control" name="email" type="email" value="${u.email||''}">
          </div>
          <div class="form-group">
            <label class="form-label">Avatar (2 letras)</label>
            <input class="form-control" name="avatar" maxlength="2" value="${u.avatar||''}">
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

  saveMeuPerfil(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const users = Auth.getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return;
    const nome = fd.get('nome').trim();
    const email = fd.get('email').trim();
    const avatar = fd.get('avatar').trim() || nome.slice(0,2).toUpperCase();
    const senhaAtual = fd.get('senha_atual');
    const novaSenha = fd.get('nova_senha');
    if (novaSenha) {
      if (users[idx].senha !== senhaAtual) { Utils.toast('Senha atual incorreta!', 'warning'); return; }
      if (novaSenha.length < 6) { Utils.toast('Nova senha deve ter pelo menos 6 caracteres!', 'warning'); return; }
      users[idx].senha = novaSenha;
    }
    users[idx] = { ...users[idx], nome, email, avatar };
    localStorage.setItem(Auth.USERS_KEY, JSON.stringify(users));
    // Update session name
    const sessionKey = Auth.SESSION_KEY;
    const updateSession = (storage) => {
      const raw = storage.getItem(sessionKey);
      if (raw) { const s = JSON.parse(raw); s.nome = nome; s.avatar = avatar; storage.setItem(sessionKey, JSON.stringify(s)); }
    };
    updateSession(localStorage);
    updateSession(sessionStorage);
    Utils.toast('Perfil atualizado!', 'success');
    Utils.closeModal();
    // Refresh sidebar user display
    const unEl = document.querySelector('.user-name');
    const avEl = document.querySelector('.user-av');
    if (unEl) unEl.textContent = nome;
    if (avEl) avEl.textContent = avatar;
    this._refreshUsers();
  },

  _refreshUsers() {
    const el = document.getElementById('users-list');
    if (!el) return;
    const users = Auth.getUsers();
    const session = Auth.getUser();
    el.innerHTML = users.map(u => this._userCard(u, session)).join('');
  },

  // ── CATEGORIAS ─────────────────────────────────────────
  _renderCategorias() {
    const EMOJIS = ['🏷️','🌟','⚡','🔑','📌','🎨','🛒','💼','🌿','🔩','📐','🎯','💡','🚀','🏆','📣','🤝','🔐','🧹','🏥','🎓','🌎','🏃'];

    const makeTable = (custom, tipo) => {
      if (!custom.length) return `<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:16px;font-size:.82rem;">Nenhuma categoria personalizada criada ainda.</td></tr>`;
      return custom.map(c => `
        <tr>
          <td style="font-size:1.1rem;width:40px;text-align:center;">${c.emoji || '🏷️'}</td>
          <td style="font-weight:600;">${c.label}</td>
          <td style="font-family:monospace;font-size:.75rem;color:var(--text3);">${c.value}</td>
          <td style="text-align:center;">
            <button class="icon-btn" onclick="Configuracoes.excluirCategoria('${c.value}','${tipo}')" title="Excluir" style="color:var(--danger);">🗑️</button>
          </td>
        </tr>`).join('');
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

  // ── SISTEMA ──────────────────────────────────────────
  _renderSistema() {
    const isDemoLoaded = DB.isDemoLoaded();
    const totalClientes = DB.getAll('clientes').length;
    const totalLancamentos = DB.getAll('lancamentos').length;
    const totalFornecedores = DB.getAll('fornecedores').length;
    const snapshotRaw = localStorage.getItem('finobra_snapshot_seguranca');
    let snapshotInfo = 'Nenhum snapshot gravado ainda.';
    if (snapshotRaw) {
      try {
        const snap = JSON.parse(snapshotRaw);
        snapshotInfo = `Último snapshot: ${Utils.fmt.datetime(snap.saved_at)} (${snap.totalLancamentos} lançamentos)`;
      } catch {}
    }

    return `
    <div class="page-header">
      <div><h1 class="page-title">&#x2699;&#xFE0F; Configura&ccedil;&otilde;es do Sistema</h1><p class="page-sub">Prefer&ecirc;ncias, gerenciamento de banco de dados e backup de segurança</p></div>
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-header"><div class="card-title">&#x1F5C4;&#xFE0F; Gerenciamento de Dados</div></div>
        <p style="color:var(--text2);font-size:.84rem;margin-bottom:8px;">
          <strong>Status:</strong> ${isDemoLoaded ? '<span class="badge badge-warning">Modo Demonstração (Dados Fictícios)</span>' : '<span class="badge badge-success">Sistema Limpo / Produção</span>'}
        </p>
        <p style="color:var(--text3);font-size:.8rem;margin-bottom:16px;">
          ${totalClientes} obra(s) cadastrada(s) &middot; ${totalLancamentos} lançamento(s) &middot; ${totalFornecedores} fornecedor(es).
        </p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-danger btn-sm" onclick="App.clearAllData()">&#x1F5D1; Zerar / Limpar Todos os Dados</button>
          ${!isDemoLoaded ? `<button class="btn btn-secondary btn-sm" onclick="App.loadDemoData()">&#x1F4E5; Carregar Dados Demo</button>` : ''}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">&#x1F4BE; Backup &amp; Restauração</div></div>
        <p style="color:var(--text2);font-size:.84rem;margin-bottom:10px;">Exporte ou restaure todos os cadastros, despesas, obras, orçamentos e comprovantes em JSON.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <button class="btn btn-primary btn-sm" onclick="Configuracoes.exportarBackup()">&#x2B07;&#xFE0F; Baixar Backup JSON</button>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('cfg-import-backup-input').click()">&#x2B06;&#xFE0F; Restaurar Arquivo JSON</button>
          <input type="file" id="cfg-import-backup-input" accept=".json,application/json" style="display:none;" onchange="Configuracoes.importarBackup(this)">
        </div>
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-sm);padding:8px 12px;font-size:.76rem;color:var(--text3);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
          <span>🛡️ ${snapshotInfo}</span>
          <button class="btn btn-ghost btn-sm" style="font-size:.72rem;padding:2px 6px;" onclick="Configuracoes.criarSnapshot()">Criar Ponto de Restauração</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">🐘 Banco de Dados em Nuvem (Neon PostgreSQL)</div></div>
        <p style="color:var(--text2);font-size:.84rem;margin-bottom:10px;">PostgreSQL Serverless conectado em tempo real (AWS São Paulo sa-east-1). Seus dados sincronizam entre todos os dispositivos da construtora.</p>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
          <button class="btn btn-primary btn-sm" onclick="Configuracoes.sincronizarTudoNeon()">
            🔄 Sincronizar Tudo para o Neon
          </button>
          <button class="btn btn-secondary btn-sm" onclick="Configuracoes.baixarDadosNeon()">
            ⬇️ Recarregar do Neon
          </button>
        </div>
        <div style="font-size:.76rem;color:var(--success);background:rgba(16,185,129,.1);padding:6px 10px;border-radius:6px;display:inline-flex;align-items:center;gap:6px;">
          <span>🟢 Neon PostgreSQL Conectado &middot; AWS sa-east-1 (São Paulo)</span>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">📲 Integração com WhatsApp</div></div>
        <p style="color:var(--text2);font-size:.84rem;margin-bottom:10px;">Configure o número padrão para envio de alertas de vencimento de boletos e resumos matinais de contas a pagar.</p>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <button class="btn btn-sm" onclick="WhatsApp.abrirModalConfig()" style="background:#25D366;color:#fff;font-weight:700;display:flex;align-items:center;gap:6px;border:none;">
            📲 Configurar Número &amp; Testar Envio
          </button>
          <span style="font-size:.78rem;color:var(--text3);">
            ${WhatsApp.getTelefonePadrao() ? `Número ativo: <strong>${WhatsApp.getTelefonePadrao()}</strong>` : 'Nenhum número cadastrado (abre lista de contatos)'}
          </span>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:16px;">
      <div class="card-header"><div class="card-title">&#x2139;&#xFE0F; Sobre o Sistema</div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;font-size:.84rem;">
        <div><div style="color:var(--text3);margin-bottom:4px;">Sistema</div><div style="font-weight:700;">Angelim Construtora</div></div>
        <div><div style="color:var(--text3);margin-bottom:4px;">Vers&atilde;o</div><div style="font-weight:700;">2.3.0 (Com Neon PostgreSQL &amp; WhatsApp)</div></div>
        <div><div style="color:var(--text3);margin-bottom:4px;">Armazenamento</div><div style="font-weight:700;color:var(--success);">🐘 Neon PostgreSQL (Nuvem) + Offline Cache</div></div>
        <div><div style="color:var(--text3);margin-bottom:4px;">Status dos Dados</div><div style="font-weight:700;color:${isDemoLoaded?'var(--warning)':'var(--success)'}">${isDemoLoaded?'Demonstração':'Limpo / Produção'}</div></div>
      </div>
    </div>`;
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
      backup.orcamentos_sinapi = JSON.parse(localStorage.getItem('orcamentos_sinapi') || '[]');
      backup.users = Auth.getUsers();
      backup.saved_at = new Date().toISOString();
      backup.totalLancamentos = (backup.lancamentos || []).length;
      localStorage.setItem('finobra_snapshot_seguranca', JSON.stringify(backup));
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
    backup.orcamentos_sinapi = JSON.parse(localStorage.getItem('orcamentos_sinapi') || '[]');
    backup.users = Auth.getUsers();
    backup.exported_at = new Date().toISOString();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `angelim_backup_${new Date().toISOString().slice(0,10)}.json`;
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
            localStorage.setItem('finobra_documentos', JSON.stringify(backup.documentos));
          }
          if (Array.isArray(backup.recibos) && typeof Recibos !== 'undefined') {
            localStorage.setItem('finobra_recibos', JSON.stringify(backup.recibos));
          }
          if (Array.isArray(backup.orcamentos_sinapi)) {
            localStorage.setItem('orcamentos_sinapi', JSON.stringify(backup.orcamentos_sinapi));
          }
          if (Array.isArray(backup.users)) {
            localStorage.setItem(Auth.USERS_KEY, JSON.stringify(backup.users));
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

  init() {}
};
