import fs from 'fs';

const file='js/configuracoes.js';
let src=fs.readFileSync(file,'utf8');

if (!src.includes('cfg-audit-mobile-render')) {
  const re=/  _refreshAudit\(\) \{[\s\S]*?\n  \},\n\n  showAuditDetail\(id\) \{/;
  if(!re.test(src)) throw new Error('Patch37 bloco3: método _refreshAudit não encontrado.');
  const method=String.raw`  _refreshAudit() {
    const el = document.getElementById('audit-list');
    if (!el) return;
    const rows = this._auditCache || [];
    if (!rows.length) {
      el.innerHTML = '<div style="padding:28px;text-align:center;color:var(--text3);">Nenhum evento de auditoria registrado ainda.</div>';
    } else {
      const desktopRows = rows.map(r => {
        const id = this._esc(r.id || '');
        const data = r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '—';
        return \`<tr>
          <td style="white-space:nowrap;font-size:.78rem;">\${this._esc(data)}</td>
          <td><strong>\${this._esc(r.usuario_nome || 'Sistema')}</strong><div style="font-size:.7rem;color:var(--text3);">\${this._esc(r.usuario_username || '')}</div></td>
          <td><span class="badge badge-secondary">\${this._esc(r.acao || '—')}</span></td>
          <td>\${this._esc(r.entidade || '—')}</td>
          <td style="font-family:monospace;font-size:.72rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;">\${this._esc(r.entidade_id || '—')}</td>
          <td style="font-size:.72rem;color:var(--text3);">\${this._esc(r.ip || '—')}</td>
          <td><button class="btn btn-ghost btn-sm" data-fb-click="Configuracoes.showAuditDetail" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="\${encodeURIComponent(String(id))}">Detalhes</button></td>
        </tr>\`;
      }).join('');
      const auditCards = rows.map(r => {
        const id = this._esc(r.id || '');
        const data = r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '—';
        return \`<article class="cfg-audit-card">
          <div class="cfg-audit-card-head">
            <div><strong>\${this._esc(r.acao || 'Evento')}</strong><div style="font-size:.72rem;color:var(--text3);margin-top:2px">\${this._esc(data)}</div></div>
            <span class="badge badge-secondary">\${this._esc(r.entidade || '—')}</span>
          </div>
          <div class="cfg-audit-card-meta"><strong>Usuário:</strong> \${this._esc(r.usuario_nome || 'Sistema')}<br><strong>Registro:</strong> \${this._esc(r.entidade_id || '—')}<br><strong>Origem:</strong> \${this._esc(r.ip || '—')}</div>
          <button class="btn btn-secondary btn-sm" data-fb-click="Configuracoes.showAuditDetail" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="\${encodeURIComponent(String(id))}">Ver detalhes</button>
        </article>\`;
      }).join('');
      // cfg-audit-mobile-render: tabela no desktop, cards legíveis no celular.
      el.innerHTML = \`<div class="cfg-audit-desktop tbl-wrap" style="border:none;"><table>
        <thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Registro</th><th>Origem</th><th></th></tr></thead>
        <tbody>\${desktopRows}</tbody>
      </table></div><div class="cfg-audit-mobile">\${auditCards}</div>\`;
    }
    const more = document.getElementById('audit-load-more');
    if (more) more.style.display = this._auditHasMore ? '' : 'none';
  },

  showAuditDetail(id) {`;
  src=src.replace(re,method);
}

fs.writeFileSync(file,src,'utf8');
console.log('✅ Auditoria mobile concluída com cards sem remover a tabela desktop.');
