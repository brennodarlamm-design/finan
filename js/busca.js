// js/busca.js — Busca Global Ctrl+K
// Pesquisa em tempo real por Lancamentos, Obras, Fornecedores, Notas, Pre-Compras

const BuscaGlobal = {
  _aberta: false,

  init() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this._aberta ? this.fechar() : this.abrir();
      }
      if (e.key === 'Escape' && this._aberta) this.fechar();
    });
  },

  abrir() {
    if (document.getElementById('busca-global-overlay')) return;
    this._aberta = true;

    const overlay = document.createElement('div');
    overlay.id = 'busca-global-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:88888;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:center;padding-top:80px;';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.fechar(); });

    overlay.innerHTML = `
      <div id="busca-global-box" style="
        width:100%;max-width:640px;margin:0 16px;
        background:var(--bg-card);border:1px solid var(--border);border-radius:16px;
        box-shadow:0 24px 80px rgba(0,0,0,.6);overflow:hidden;
        animation:buscaIn .15s ease;">

        <!-- Input -->
        <div style="display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--border);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input id="busca-global-input" placeholder="Buscar lançamentos, obras, fornecedores, notas..." autocomplete="off"
            style="flex:1;background:transparent;border:none;outline:none;font-size:1rem;color:var(--text);font-family:inherit;"
            oninput="BuscaGlobal._pesquisar(this.value)">
          <kbd style="font-size:.7rem;color:var(--text3);border:1px solid var(--border);border-radius:4px;padding:2px 6px;">ESC</kbd>
        </div>

        <!-- Resultados -->
        <div id="busca-global-results" style="max-height:420px;overflow-y:auto;">
          <div style="text-align:center;padding:32px;color:var(--text3);font-size:.85rem;">
            🔍 Digite para pesquisar em todo o sistema...
          </div>
        </div>

        <!-- Footer -->
        <div style="padding:10px 20px;border-top:1px solid var(--border);display:flex;gap:16px;font-size:.72rem;color:var(--text3);">
          <span>↑↓ Navegar</span><span>↵ Abrir</span><span>ESC Fechar</span>
          <span style="margin-left:auto;">Ctrl+K para abrir</span>
        </div>
      </div>
      <style>
        @keyframes buscaIn { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
        #busca-global-results .busca-item:hover { background:var(--bg-secondary)!important; }
        #busca-global-results .busca-item { cursor:pointer;transition:background .1s; }
        #busca-global-results .busca-item.selected { background:var(--bg-secondary)!important; }
      </style>`;

    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('busca-global-input')?.focus(), 50);
    this._setupNavKeys();
  },

  fechar() {
    this._aberta = false;
    document.getElementById('busca-global-overlay')?.remove();
  },

  _pesquisar(query) {
    const q = (query || '').toLowerCase().trim();
    const container = document.getElementById('busca-global-results');
    if (!container) return;

    if (!q || q.length < 2) {
      container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3);font-size:.85rem;">🔍 Digite pelo menos 2 caracteres...</div>';
      return;
    }

    const resultados = [];

    // Lançamentos
    (DB.getAll('lancamentos') || []).forEach(l => {
      if ((l.descricao||'').toLowerCase().includes(q) ||
          (l.fornecedor_beneficiario||'').toLowerCase().includes(q) ||
          (l.codigo_barras||'').includes(q)) {
        resultados.push({
          tipo: 'lancamento', icone: l.tipo === 'receita' ? '↑' : '↓',
          cor: l.tipo === 'receita' ? 'var(--success)' : 'var(--danger)',
          titulo: l.descricao,
          sub: `${l.tipo === 'receita' ? 'Receita' : 'Despesa'} · ${Utils.fmt.currency(l.valor)} · Venc. ${Utils.fmt.date(l.data_vencimento || l.data)}`,
          badge: 'Lançamento', acao: () => { this.fechar(); App.navigate('lancamentos'); }
        });
      }
    });

    // Obras / Clientes
    (DB.getAll('clientes') || []).forEach(c => {
      if ((c.nome||'').toLowerCase().includes(q) || (c.cidade||'').toLowerCase().includes(q) || (c.cliente||'').toLowerCase().includes(q)) {
        resultados.push({
          tipo: 'obra', icone: '🏗️', cor: 'var(--accent2)',
          titulo: c.nome,
          sub: `${c.cidade || ''}${c.uf ? '/' + c.uf : ''} · ${c.status || ''} · ${Utils.fmt.currency(c.orcamento_total || 0)}`,
          badge: 'Obra', acao: () => { this.fechar(); App.navigate('clientes'); }
        });
      }
    });

    // Fornecedores
    (DB.getAll('fornecedores') || []).forEach(f => {
      if ((f.nome||'').toLowerCase().includes(q) || (f.razao_social||'').toLowerCase().includes(q) || (f.cnpj_cpf||'').includes(q)) {
        resultados.push({
          tipo: 'fornecedor', icone: '🏭', cor: '#f59e0b',
          titulo: f.nome || f.razao_social,
          sub: `CNPJ: ${f.cnpj_cpf || '—'} · ${f.telefone || ''} · ${Utils.catLabel(f.categoria || 'outro')}`,
          badge: 'Fornecedor', acao: () => { this.fechar(); App.navigate('fornecedores'); }
        });
      }
    });

    // Notas Fiscais
    (DB.getAll('notas') || []).forEach(n => {
      if ((n.emitente||'').toLowerCase().includes(q) || (n.numero_nf||'').includes(q) || (n.chave_acesso||'').includes(q)) {
        resultados.push({
          tipo: 'nota', icone: '📄', cor: '#8b5cf6',
          titulo: `NF ${n.numero_nf || n.chave_nfe || ''} — ${n.emitente || ''}`,
          sub: `${Utils.fmt.date(n.data_emissao)} · ${Utils.fmt.currency(n.valor_bruto || n.valor_total || 0)}`,
          badge: 'Nota Fiscal', acao: () => { this.fechar(); App.navigate('notas'); }
        });
      }
    });

    // Pré-Compras
    (DB.getAll('precompras') || []).forEach(p => {
      const itensStr = (p.itens || []).map(i => i.descricao || '').join(' ').toLowerCase();
      if ((p.descricao||'').toLowerCase().includes(q) || (p.numero_ordem||'').toLowerCase().includes(q) || itensStr.includes(q)) {
        resultados.push({
          tipo: 'precompra', icone: '🛒', cor: '#06b6d4',
          titulo: `${p.numero_ordem || ''} — ${p.descricao || ''}`,
          sub: `${Utils.badge(p.status || 'pendente_aprovacao')} · ${p.fornecedor_nome || 'Sem fornecedor'} · ${Utils.fmt.currency(p.valor_total || 0)}`,
          badge: 'Pré-Compra', acao: () => { this.fechar(); App.navigate('precompras'); }
        });
      }
    });

    if (resultados.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text3);">😕 Nenhum resultado para "<strong style="color:var(--text);">${this._esc(query)}</strong>"</div>`;
      return;
    }

    const grupos = {};
    resultados.forEach(r => {
      if (!grupos[r.badge]) grupos[r.badge] = [];
      grupos[r.badge].push(r);
    });

    let html = '';
    let itemIdx = 0;
    Object.entries(grupos).forEach(([label, items]) => {
      html += `<div style="padding:8px 16px 4px;font-size:.68rem;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;">${label} (${items.length})</div>`;
      items.slice(0, 5).forEach(r => {
        html += `
          <div class="busca-item" data-idx="${itemIdx}" style="padding:10px 16px;display:flex;align-items:center;gap:12px;" onclick="BuscaGlobal._itens[${itemIdx}]?.acao()">
            <div style="width:32px;height:32px;border-radius:8px;background:${r.cor}22;border:1px solid ${r.cor}44;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">
              <span style="color:${r.cor};font-weight:900;font-size:.9rem;">${r.icone}</span>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:.85rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this._esc(r.titulo)}</div>
              <div style="font-size:.72rem;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.sub}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
          </div>`;
        itemIdx++;
      });
    });

    this._itens = resultados;
    container.innerHTML = html;
    this._selectedIdx = -1;
  },

  _itens: [],
  _selectedIdx: -1,

  _setupNavKeys() {
    const overlay = document.getElementById('busca-global-overlay');
    if (!overlay) return;
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this._moverSelecao(1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); this._moverSelecao(-1); }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this._selectedIdx >= 0 && this._itens[this._selectedIdx]) {
          this._itens[this._selectedIdx].acao();
        }
      }
    });
  },

  _moverSelecao(dir) {
    const items = document.querySelectorAll('#busca-global-results .busca-item');
    if (!items.length) return;
    items.forEach(el => el.classList.remove('selected'));
    this._selectedIdx = Math.max(0, Math.min(items.length - 1, this._selectedIdx + dir));
    const el = items[this._selectedIdx];
    if (el) { el.classList.add('selected'); el.scrollIntoView({ block: 'nearest' }); }
  },

  _esc(v) {
    if (!v) return '';
    return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
};
