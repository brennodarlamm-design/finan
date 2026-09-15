// js/dev-tenant-keys.js — tabela segura das Chaves da Empresa no painel DEV / Master
// Nenhuma chave completa é hardcoded ou persistida no navegador.

(() => {
  if (globalThis.__finobraDevTenantKeysLoaded) return;
  globalThis.__finobraDevTenantKeysLoaded = true;

  const state = {
    rows: [],
    revealed: new Map(),
    loading: false,
    lastError: ''
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function authHeaders() {
    return (typeof Auth !== 'undefined' && Auth.getAuthHeaders)
      ? Auth.getAuthHeaders()
      : { 'Content-Type': 'application/json' };
  }

  function masked(last4) {
    return last4 ? `••${esc(last4)}` : '—';
  }

  function findSystemAnchor() {
    const headings = Array.from(document.querySelectorAll('h2'));
    return headings.find(h => String(h.textContent || '').includes('Manutenção do Sistema')) || null;
  }

  function ensurePanel() {
    const anchor = findSystemAnchor();
    if (!anchor) return null;

    let panel = document.getElementById('dev-tenant-keys-panel');
    if (panel && document.contains(panel)) return panel;

    panel = document.createElement('section');
    panel.id = 'dev-tenant-keys-panel';
    panel.style.cssText = 'background:rgba(255,255,255,.02);border:1px solid rgba(201,162,39,.32);border-radius:14px;overflow:hidden;margin:0 0 22px 0;box-shadow:0 8px 30px rgba(0,0,0,.25);';

    const intro = anchor.parentElement;
    if (intro?.parentElement) intro.insertAdjacentElement('afterend', panel);
    else anchor.insertAdjacentElement('afterend', panel);

    render();
    if (!state.rows.length && !state.loading) load();
    return panel;
  }

  function render() {
    const panel = document.getElementById('dev-tenant-keys-panel');
    if (!panel) return;

    const rowsHtml = state.rows.length
      ? state.rows.map(row => {
          const key = state.revealed.get(row.tenantId) || '';
          const vaultReady = !!row.vaultReady;
          const statusBadge = row.status === 'ativo'
            ? '<span style="color:#86efac;font-weight:800;">🟢 Ativo</span>'
            : `<span style="color:#fbbf24;font-weight:800;">${esc(row.status || '—')}</span>`;
          const vaultBadge = vaultReady
            ? '<span style="color:#86efac;font-weight:800;">🔐 Cofre OK</span>'
            : '<span style="color:#fca5a5;font-weight:800;">⚠️ Rotação necessária</span>';
          const keyDisplay = key
            ? `<span style="font-family:monospace;font-size:1rem;font-weight:900;letter-spacing:.12em;color:var(--accent2);">${esc(key)}</span>`
            : `<span style="font-family:monospace;color:#cbd5e1;letter-spacing:.08em;">${masked(row.last4)}</span>`;

          return `
            <tr style="border-bottom:1px solid rgba(255,255,255,.05);">
              <td style="padding:12px 14px;vertical-align:top;">
                <div style="font-weight:850;color:#fff;">${esc(row.nomeFantasia || row.tenantId)}</div>
                <div style="font-size:.72rem;color:#64748b;margin-top:3px;"><code>${esc(row.tenantId)}</code></div>
              </td>
              <td style="padding:12px 14px;vertical-align:top;">${statusBadge}</td>
              <td style="padding:12px 14px;vertical-align:top;">${vaultBadge}</td>
              <td style="padding:12px 14px;vertical-align:top;">${keyDisplay}</td>
              <td style="padding:12px 14px;text-align:right;vertical-align:top;">
                <div style="display:inline-flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
                  ${vaultReady ? `<button type="button" data-devkey-action="reveal" data-tenant-id="${esc(row.tenantId)}" style="background:rgba(56,189,248,.12);border:1px solid #38bdf8;color:#7dd3fc;padding:6px 9px;border-radius:7px;font-size:.74rem;font-weight:800;cursor:pointer;">${key ? '🙈 Ocultar' : '👁️ Mostrar'}</button>` : ''}
                  ${key ? `<button type="button" data-devkey-action="copy" data-tenant-id="${esc(row.tenantId)}" style="background:rgba(201,162,39,.14);border:1px solid var(--accent);color:var(--accent2);padding:6px 9px;border-radius:7px;font-size:.74rem;font-weight:800;cursor:pointer;">📋 Copiar</button>` : ''}
                  ${key ? `<button type="button" data-devkey-action="whatsapp" data-tenant-id="${esc(row.tenantId)}" style="background:rgba(37,211,102,.12);border:1px solid #25D366;color:#4ade80;padding:6px 9px;border-radius:7px;font-size:.74rem;font-weight:800;cursor:pointer;">💬 WhatsApp</button>` : ''}
                  <button type="button" data-devkey-action="rotate" data-tenant-id="${esc(row.tenantId)}" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.16);color:#cbd5e1;padding:6px 9px;border-radius:7px;font-size:.74rem;font-weight:800;cursor:pointer;">🔄 Rotacionar</button>
                </div>
              </td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="5" style="padding:20px;text-align:center;color:#94a3b8;">${state.loading ? 'Carregando chaves do cofre DEV…' : (state.lastError ? esc(state.lastError) : 'Nenhuma empresa encontrada.')}</td></tr>`;

    panel.innerHTML = `
      <div style="padding:15px 18px;border-bottom:1px solid rgba(201,162,39,.2);display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;background:linear-gradient(135deg,rgba(201,162,39,.08),rgba(0,0,0,.18));">
        <div>
          <div style="font-size:.98rem;font-weight:900;color:#fff;">🔑 Chaves das Empresas — DEV / Master</div>
          <div style="font-size:.74rem;color:#94a3b8;margin-top:3px;">Puxadas do cofre server-side. Nenhuma chave completa fica salva no frontend ou no localStorage.</div>
        </div>
        <button type="button" id="dev-tenant-keys-refresh" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#fff;padding:7px 11px;border-radius:7px;font-size:.75rem;font-weight:800;cursor:pointer;">↻ Atualizar</button>
      </div>
      <div style="overflow:auto;">
        <table style="width:100%;border-collapse:collapse;text-align:left;font-size:.8rem;">
          <thead><tr style="background:rgba(255,255,255,.025);color:#94a3b8;font-size:.7rem;text-transform:uppercase;">
            <th style="padding:10px 14px;">Empresa</th>
            <th style="padding:10px 14px;">Status</th>
            <th style="padding:10px 14px;">Cofre</th>
            <th style="padding:10px 14px;">Chave</th>
            <th style="padding:10px 14px;text-align:right;">Ações</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;

    panel.querySelector('#dev-tenant-keys-refresh')?.addEventListener('click', () => load(true));
    panel.querySelectorAll('[data-devkey-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.devkeyAction;
        const tenantId = btn.dataset.tenantId;
        if (action === 'reveal') return toggleReveal(tenantId);
        if (action === 'copy') return copyKey(tenantId);
        if (action === 'whatsapp') return copyWhatsApp(tenantId);
        if (action === 'rotate') return rotateTenant(tenantId);
      });
    });
  }

  async function load(force = false) {
    if (state.loading) return;
    if (state.rows.length && !force) return;
    state.loading = true;
    state.lastError = '';
    render();
    try {
      const resp = await fetch('/api/dev-tenant-keys?action=list', { headers: authHeaders(), cache: 'no-store' });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) throw new Error(data.error || 'Falha ao carregar cofre DEV.');
      state.rows = Array.isArray(data.keys) ? data.keys : [];
      state.revealed.clear();
    } catch (err) {
      state.lastError = err?.message || 'Falha ao carregar cofre DEV.';
    } finally {
      state.loading = false;
      render();
    }
  }

  async function toggleReveal(tenantId) {
    if (state.revealed.has(tenantId)) {
      state.revealed.delete(tenantId);
      render();
      return;
    }
    try {
      const resp = await fetch(`/api/dev-tenant-keys?action=reveal&tenantId=${encodeURIComponent(tenantId)}`, {
        headers: authHeaders(),
        cache: 'no-store'
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success || !data.accessKey) throw new Error(data.error || 'Não foi possível revelar a chave.');
      state.revealed.set(tenantId, String(data.accessKey));
      render();
    } catch (err) {
      alert(err?.message || 'Não foi possível revelar a chave.');
    }
  }

  async function rotateTenant(tenantId, displayName = '') {
    const row = state.rows.find(r => r.tenantId === tenantId);
    const nome = displayName || row?.nomeFantasia || tenantId;
    if (!confirm(`Rotacionar a Chave da Empresa de "${nome}"?\n\nA chave anterior deixará de funcionar imediatamente. A nova chave ficará armazenada no cofre DEV e poderá ser consultada somente pelo Master com MFA.`)) return null;

    try {
      const resp = await fetch('/api/dev-tenant-keys?action=rotate', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ tenantId })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success || !data.accessKey) throw new Error(data.error || 'Falha ao rotacionar a chave.');

      state.revealed.set(tenantId, String(data.accessKey));
      const idx = state.rows.findIndex(r => r.tenantId === tenantId);
      if (idx >= 0) state.rows[idx] = { ...state.rows[idx], last4: data.last4, vaultReady: true };
      render();
      alert(`Chave rotacionada com sucesso para ${nome}.\n\nNova chave: ${data.accessKey}\n\nEla também ficou salva no cofre DEV.`);
      return data;
    } catch (err) {
      alert(err?.message || 'Falha ao rotacionar a chave.');
      return null;
    }
  }

  async function copyKey(tenantId) {
    const key = state.revealed.get(tenantId);
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast('Chave copiada.', 'success');
    } catch {
      prompt('Copie a chave:', key);
    }
  }

  async function copyWhatsApp(tenantId) {
    const key = state.revealed.get(tenantId);
    const row = state.rows.find(r => r.tenantId === tenantId);
    if (!key || !row) return;
    const msg = `Olá! Segue sua Chave da Empresa FinObra para ${row.nomeFantasia || 'sua construtora'}:\n\n🔑 Chave da Empresa: *${key}*\n\nUse essa chave junto com seu usuário/e-mail e senha em https://finobra.app.br/login`;
    try {
      await navigator.clipboard.writeText(msg);
      if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast('Mensagem pronta para WhatsApp copiada.', 'success');
    } catch {
      prompt('Copie a mensagem:', msg);
    }
  }

  function installMasterOverride() {
    try {
      if (typeof MasterAdmin === 'undefined' || !MasterAdmin || MasterAdmin.__tenantVaultHookInstalled) return;
      MasterAdmin.__tenantVaultHookInstalled = true;
      MasterAdmin.gerarChaveEmpresa = async function(tenantIdEnc, tenantNomeEnc) {
        const tenantId = decodeURIComponent(tenantIdEnc || '');
        const nome = decodeURIComponent(tenantNomeEnc || 'Construtora');
        if (!tenantId) return;
        return rotateTenant(tenantId, nome);
      };
    } catch {}
  }

  const observer = new MutationObserver(() => {
    installMasterOverride();
    ensurePanel();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('load', () => {
    installMasterOverride();
    ensurePanel();
  });

  globalThis.DevTenantKeys = { load, rotateTenant, toggleReveal };
})();
