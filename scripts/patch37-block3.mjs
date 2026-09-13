import fs from 'fs';
import path from 'path';

const root=process.cwd();
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const write=(f,s)=>fs.writeFileSync(path.join(root,f),s,'utf8');
function once(src,needle,repl,label){if(!src.includes(needle)) throw new Error(`Patch37 bloco3: trecho ausente em ${label}`);return src.replace(needle,repl);}

// 1) Viewport moderno, incluindo safe-area em iOS.
let app=read('app.html');
app=app.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">','<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">');
write('app.html',app);

// 2) Design system mobile: toque, modais, safe-area, ações e formulários.
let css=read('css/style.css');
if(!css.includes('FINOBRA_PATCH37_MOBILE_OPERATIONAL')){
  const marker='/* ===== PAINEL DE IMPRESSÃO E PRÉ-VISUALIZAÇÃO A4 (LIGHT/HIGH CONTRAST) ===== */';
  if(!css.includes(marker)) throw new Error('Patch37 bloco3: âncora CSS não encontrada.');
  const mobile=`/* FINOBRA_PATCH37_MOBILE_OPERATIONAL */
@media(max-width:768px) {
  html { -webkit-text-size-adjust:100%; }
  body { padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right); }
  .main-header { padding-left:max(12px,env(safe-area-inset-left));padding-right:max(12px,env(safe-area-inset-right)); }
  .main-content { padding-bottom:max(18px,env(safe-area-inset-bottom)); }

  /* Ações viram área de toque real, não uma fileira comprimida. */
  .page-actions { width:100%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px; }
  .page-actions>.btn,.page-actions>button { width:100%;justify-content:center; }
  .btn { min-height:44px;justify-content:center; }
  .btn-sm { min-height:40px;padding:8px 12px; }
  .icon-btn,.modal-close { min-width:40px;min-height:40px; }
  .form-control,.input-prefix input { min-height:44px;font-size:16px; }
  textarea.form-control { min-height:96px; }
  .filters-bar { align-items:stretch; }
  .filters-bar>.filter-group,.filters-bar>.search-bar { flex:1 1 100%;min-width:0; }

  /* Bottom-sheet modal: cabeçalho/rodapé ficam acessíveis e corpo rola. */
  .modal-overlay { padding:0;align-items:flex-end; }
  .modal {
    width:100vw!important;max-width:100vw!important;margin:0!important;
    max-height:min(92dvh,900px);border-radius:20px 20px 0 0;
    overflow:hidden;display:flex;flex-direction:column;
  }
  .modal-header { padding:14px 16px;flex:0 0 auto; }
  .modal-body { padding:16px;overflow-y:auto;overscroll-behavior:contain;min-height:0; }
  .modal-footer {
    padding:12px 16px max(12px,env(safe-area-inset-bottom));flex:0 0 auto;
    display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;
    background:var(--bg-card);
  }
  .modal-footer>.btn,.modal-footer>button { width:100%;justify-content:center; }

  /* Feedback não pode sair para fora da largura útil. */
  .toast-container { left:10px;right:10px;top:calc(var(--header-h) + 10px); }
  .toast { width:100%;min-width:0;max-width:none; }
  .drop-zone { padding:28px 16px; }
  .tbl-wrap { scroll-snap-type:x proximity;overscroll-behavior-x:contain; }
}

@media(max-width:430px) {
  .main-content { padding:10px 10px max(16px,env(safe-area-inset-bottom)); }
  .page-header { margin-bottom:16px; }
  .page-title { font-size:1.1rem; }
  .page-sub { font-size:.78rem;line-height:1.45; }
  .page-actions { grid-template-columns:1fr; }
  .modal { max-height:94dvh; }
  .modal-footer { grid-template-columns:1fr; }
  .modal-footer>.btn-secondary { order:2; }
  .modal-title { font-size:.96rem; }
  .card { padding:12px; }
}

`;
  css=css.replace(marker,mobile+marker);
}
write('css/style.css',css);

// 3) Configurações: tabs swipe, cards de usuário/sessão e auditoria em cards no celular.
let cfg=read('js/configuracoes.js');
const oldStyle="s.textContent = '.cfg-tab{padding:10px 20px;border:none;background:transparent;color:var(--text3);font-family:inherit;font-size:.875rem;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:color .2s,border-color .2s;}.cfg-tab:hover{color:var(--text);}.cfg-tab-active{color:var(--accent)!important;border-bottom-color:var(--accent)!important;}';";
const newStyle=`s.textContent = '.cfg-tabs{display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:24px;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:none;-webkit-overflow-scrolling:touch}.cfg-tabs::-webkit-scrollbar{display:none}.cfg-tab{padding:10px 20px;border:none;background:transparent;color:var(--text3);font-family:inherit;font-size:.875rem;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:color .2s,border-color .2s;white-space:nowrap;scroll-snap-align:start;min-height:44px}.cfg-tab:hover{color:var(--text);}.cfg-tab-active{color:var(--accent)!important;border-bottom-color:var(--accent)!important}.cfg-audit-mobile{display:none}.cfg-user-card,.cfg-session-card{min-width:0}.cfg-user-actions{display:flex;gap:8px;flex-wrap:wrap}.cfg-session-main{flex:1;min-width:220px}@media(max-width:768px){.cfg-tabs{margin-left:-14px;margin-right:-14px;padding:0 14px 2px;position:relative}.cfg-tab{padding:10px 14px}.cfg-user-card{padding:14px!important}.cfg-user-actions{width:100%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.cfg-user-actions .btn{width:100%}.cfg-session-card{align-items:flex-start!important}.cfg-session-main{min-width:0;width:100%}.cfg-audit-desktop{display:none!important}.cfg-audit-mobile{display:flex;flex-direction:column;gap:10px}.cfg-audit-card{padding:14px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.02)}.cfg-audit-card-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:9px}.cfg-audit-card-meta{font-size:.72rem;color:var(--text3);line-height:1.5}.cfg-audit-card .btn{margin-top:10px;width:100%}}@media(max-width:430px){.cfg-tabs{margin-left:-10px;margin-right:-10px;padding-left:10px;padding-right:10px}.cfg-user-actions{grid-template-columns:1fr}.cfg-user-card>div{align-items:flex-start!important}.cfg-session-card{display:grid!important;grid-template-columns:auto 1fr}.cfg-session-card>.btn{grid-column:1/-1;width:100%}}';`;
if(!cfg.includes('cfg-tabs{display:flex')){
  if(!cfg.includes(oldStyle)) throw new Error('Patch37 bloco3: estilo de tabs Configurações não encontrado.');
  cfg=cfg.replace(oldStyle,newStyle);
}
cfg=cfg.replace('<div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:24px;overflow-x:auto;">','<div class="cfg-tabs">');
cfg=cfg.replaceAll('<div class="card" style="margin-bottom:12px;">','<div class="card cfg-user-card" style="margin-bottom:12px;">');
cfg=cfg.replace('<div style="display:flex;gap:8px;flex-wrap:wrap;">\n          <button class="btn btn-secondary btn-sm" data-fb-click="Configuracoes.showUserForm"','<div class="cfg-user-actions">\n          <button class="btn btn-secondary btn-sm" data-fb-click="Configuracoes.showUserForm"');
cfg=cfg.replace('return `<div style="display:flex;gap:14px;align-items:center;padding:13px 0;border-bottom:1px solid var(--border);flex-wrap:wrap"><div style="font-size:1.4rem">${x.current?\'&#x1F4BB;\':\'&#x1F4F1;\'}</div><div style="flex:1;min-width:220px">','return `<div class="cfg-session-card" style="display:flex;gap:14px;align-items:center;padding:13px 0;border-bottom:1px solid var(--border);flex-wrap:wrap"><div style="font-size:1.4rem">${x.current?\'&#x1F4BB;\':\'&#x1F4F1;\'}</div><div class="cfg-session-main">');

// Auditoria: desktop permanece tabela; mobile recebe cards legíveis e com ação de detalhe.
const auditStart="      el.innerHTML = `<div class=\"tbl-wrap\" style=\"border:none;\"><table>";
if(cfg.includes(auditStart) && !cfg.includes('cfg-audit-mobile')){
  throw new Error('Patch37 bloco3: marca de estilos audit mobile presente sem render; estado inesperado.');
}
// Usa substituição localizada no bloco _refreshAudit.
const auditRegex=/      el\.innerHTML = `<div class="tbl-wrap" style="border:none;"><table>[\s\S]*?<\/table><\/div>`;/;
if(!cfg.includes('cfg-audit-desktop')){
  const m=cfg.match(auditRegex);
  if(!m) throw new Error('Patch37 bloco3: tabela de auditoria não encontrada.');
  const original=m[0].replace('<div class="tbl-wrap"','<div class="cfg-audit-desktop tbl-wrap"');
  const mobile=`\n      const auditCards = rows.map(r => {\n        const id=this._esc(r.id || '');\n        const data=r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '—';\n        return \`<article class="cfg-audit-card"><div class="cfg-audit-card-head"><div><strong>\${this._esc(r.acao||'Evento')}</strong><div style="font-size:.72rem;color:var(--text3);margin-top:2px">\${this._esc(data)}</div></div><span class="badge badge-secondary">\${this._esc(r.entidade||'—')}</span></div><div class="cfg-audit-card-meta"><strong>Usuário:</strong> \${this._esc(r.usuario_nome||'Sistema')}<br><strong>Registro:</strong> \${this._esc(r.entidade_id||'—')}<br><strong>Origem:</strong> \${this._esc(r.ip||'—')}</div><button class="btn btn-secondary btn-sm" data-fb-click="Configuracoes.showAuditDetail" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="\${encodeURIComponent(String(id))}">Ver detalhes</button></article>\`;\n      }).join('');\n      el.insertAdjacentHTML('beforeend', \`<div class="cfg-audit-mobile">\${auditCards}</div>\`);`;
  cfg=cfg.replace(m[0],original+mobile);
}
write('js/configuracoes.js',cfg);

// 4) Conta & Assinatura: tabs snap, herói e ações internas pensadas para 360–430px.
let cob=read('js/cobranca.js');
if(!cob.includes('FINOBRA_PATCH37_ACCOUNT_MOBILE')){
  cob=cob.replace(".acc-tabs{display:flex;gap:6px;overflow:auto;padding:5px;background:rgba(255,255,255,.025);border:1px solid var(--border);border-radius:12px;margin-bottom:18px}",".acc-tabs{display:flex;gap:6px;overflow:auto;padding:5px;background:rgba(255,255,255,.025);border:1px solid var(--border);border-radius:12px;margin-bottom:18px;scroll-snap-type:x proximity;scrollbar-width:none;-webkit-overflow-scrolling:touch}.acc-tabs::-webkit-scrollbar{display:none}");
  cob=cob.replace(".acc-tab{white-space:nowrap;border:0;background:transparent;color:var(--text3);padding:9px 14px;border-radius:8px;font-weight:750;cursor:pointer}",".acc-tab{white-space:nowrap;border:0;background:transparent;color:var(--text3);padding:9px 14px;border-radius:8px;font-weight:750;cursor:pointer;scroll-snap-align:start;min-height:42px}");
  cob=cob.replace("@media(max-width:760px){.acc-shell{padding:0 2px 30px}","/* FINOBRA_PATCH37_ACCOUNT_MOBILE */@media(max-width:760px){.acc-shell{padding:0 2px 30px}");
  cob=cob.replace(".acc-hero-actions{width:100%}.acc-hero-actions .btn{width:100%;justify-content:center}}",".acc-hero-actions{width:100%;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch!important}.acc-hero-actions .btn{width:100%;justify-content:center}.acc-panel[data-panel=\"equipe\"] .btn,.acc-panel[data-panel=\"suporte\"] .btn{min-height:44px}.acc-panel[data-panel=\"equipe\"] [style*=\"display:flex\"]{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))}}</style-placeholder>");
  // Remove placeholder and append the closing media + 430 rules safely.
  cob=cob.replace('}</style-placeholder>', '}@media(max-width:430px){.acc-hero-actions{grid-template-columns:1fr}.acc-panel[data-panel="equipe"] [style*="display:flex"]{grid-template-columns:1fr}.acc-tabs{margin-left:-2px;margin-right:-2px}.acc-tab{padding:9px 11px}.acc-billing-cards .acc-kpi{padding:12px}}');
}
write('js/cobranca.js',cob);

// 5) Revarre CSP por segurança (não depende da lembrança manual de novas ações).
const events='click|change|input|submit|mouseover|mouseout|mouseenter|mouseleave|keydown|keyup|keypress|focus|blur|dblclick|contextmenu|pointerdown|pointerup|mousedown|mouseup|touchstart|touchend|dragstart|drop';
const actionRe=new RegExp(`data-fb-(?:${events})=["']([^"']+)["']`,'g');
const files=[...fs.readdirSync(root).filter(x=>x.endsWith('.html')).map(x=>path.join(root,x)),...fs.readdirSync(path.join(root,'js')).filter(x=>x.endsWith('.js')&&x!=='patch26-events.js').map(x=>path.join(root,'js',x))];
const used=new Set();for(const f of files){const s=fs.readFileSync(f,'utf8');for(const m of s.matchAll(actionRe))used.add(m[1]);}
let bridge=read('js/patch26-events.js');const mm=bridge.match(/const ALLOWED = new Set\((\[[\s\S]*?\])\);/);if(!mm)throw new Error('Patch37 bloco3: allowlist não encontrada.');
const merged=[...new Set([...JSON.parse(mm[1]),...used])].sort();bridge=bridge.replace(mm[0],`const ALLOWED = new Set(${JSON.stringify(merged)});`);write('js/patch26-events.js',bridge);

// 6) Teste estático permanente de mobile operacional.
write('scripts/test-patch37-block3-static.js',`import fs from 'fs';\nfunction a(c,m){if(!c){console.error('❌ '+m);process.exit(1)}console.log('✅ '+m)}\nconst css=fs.readFileSync('css/style.css','utf8');\nconst app=fs.readFileSync('app.html','utf8');\nconst cfg=fs.readFileSync('js/configuracoes.js','utf8');\nconst cob=fs.readFileSync('js/cobranca.js','utf8');\na(app.includes('viewport-fit=cover'),'App respeita safe-area de dispositivos móveis.');\na(css.includes('FINOBRA_PATCH37_MOBILE_OPERATIONAL')&&css.includes('max-width:430px'),'Design system possui breakpoint operacional específico até 430px.');\na(css.includes('min-height:44px')&&css.includes('font-size:16px'),'Controles móveis têm área de toque e inputs evitam zoom automático.');\na(css.includes('align-items:flex-end')&&css.includes('92dvh')&&css.includes('safe-area-inset-bottom'),'Modais mobile funcionam como bottom sheet com corpo rolável e safe-area.');\na(css.includes('.page-actions { grid-template-columns:1fr; }'),'Ações de página não ficam espremidas em telas estreitas.');\na(cfg.includes('cfg-tabs')&&cfg.includes('scroll-snap-type:x proximity'),'Tabs de Configurações usam swipe horizontal.');\na(cfg.includes('cfg-user-card')&&cfg.includes('cfg-user-actions'),'Usuários possuem cards e ações adaptáveis no celular.');\na(cfg.includes('cfg-session-card')&&cfg.includes('cfg-session-main'),'Sessões possuem cards mobile dedicados.');\na(cfg.includes('cfg-audit-mobile')&&cfg.includes('cfg-audit-card')&&cfg.includes('Ver detalhes'),'Auditoria troca tabela larga por cards no celular.');\na(cob.includes('FINOBRA_PATCH37_ACCOUNT_MOBILE')&&cob.includes('grid-template-columns:1fr}.acc-panel[data-panel="equipe"]'),'Conta & Assinatura possui tratamento próprio até 430px.');\nconsole.log('\\n✅ Patch 37 bloco 3 mobile validado.');\n`);
let all=read('scripts/test-static-all.js');if(!all.includes("'scripts/test-patch37-block3-static.js'")){all=all.replace("  'scripts/test-patch37-block2-static.js',\n","  'scripts/test-patch37-block2-static.js',\n  'scripts/test-patch37-block3-static.js',\n");write('scripts/test-static-all.js',all);}
console.log('✅ Patch 37 bloco 3 aplicado: mobile operacional 360–430, cards e bottom sheets.');
