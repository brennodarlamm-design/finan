import fs from 'fs';

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Patch36 bloco5: trecho não encontrado (${label})`);
  return source.replace(needle, replacement);
}
function replaceBetween(source,start,end,replacement,label){
  const a=source.indexOf(start), b=source.indexOf(end,a+start.length);
  if(a<0||b<0) throw new Error(`Patch36 bloco5: intervalo não encontrado (${label})`);
  return source.slice(0,a)+replacement+source.slice(b);
}

// 1) Permissões granulares só existem se a feature advancedPermissions estiver contratada.
let perms=fs.readFileSync('api/_permissions.js','utf8');
perms=replaceOnce(perms,
  "import { canUseModule } from './_plans.js';",
  "import { canUseModule, canUseFeature } from './_plans.js';",
  'import canUseFeature');
perms=replaceOnce(perms,
`  const role = normalizeRole(auth?.user?.perfil);

  // Superadmin da plataforma precisa conseguir diagnosticar todos os módulos no modo suporte.
  if (role !== 'superadmin') {
    const tenantPlan = auth?.user?.tenantPlan || auth?.user?.plano || 'trial';
    if (MODULES.includes(module) && !canUseModule(tenantPlan, module)) return false;
  }

  if (role === 'superadmin' || role === 'admin') return true;
  const base = Boolean(roleRule(role)?.[action]);
  if (!base) return false;
  if (!MODULES.includes(module)) return base;

  // Hierarquia de segurança: sem leitura não existe escrita/exclusão;`,
`  const role = normalizeRole(auth?.user?.perfil);
  const tenantPlan = auth?.user?.tenantPlan || auth?.user?.plano || 'trial';

  // Superadmin da plataforma precisa conseguir diagnosticar todos os módulos no modo suporte.
  if (role !== 'superadmin' && MODULES.includes(module) && !canUseModule(tenantPlan, module)) return false;

  if (role === 'superadmin' || role === 'admin') return true;
  const base = Boolean(roleRule(role)?.[action]);
  if (!base) return false;
  if (!MODULES.includes(module)) return base;

  // Planos sem permissões avançadas usam somente as capacidades do perfil.
  if (!canUseFeature(tenantPlan, 'advancedPermissions')) return base;

  // Hierarquia de segurança: sem leitura não existe escrita/exclusão;`,
  'enforce advanced permissions feature');
fs.writeFileSync('api/_permissions.js',perms,'utf8');

// 2) API de usuários: ignora matriz granular fora do Ilimitado e informa essa capacidade na UI.
let users=fs.readFileSync('api/users.js','utf8');
users=replaceOnce(users,
`    maxUsers: rule.maxUsers,
    activeUsers,
    totalUsers,
    remainingUsers: rule.maxUsers == null ? null : Math.max(0, rule.maxUsers - activeUsers)
`,
`    maxUsers: rule.maxUsers,
    advancedPermissions: Boolean(rule.features?.advancedPermissions),
    activeUsers,
    totalUsers,
    remainingUsers: rule.maxUsers == null ? null : Math.max(0, rule.maxUsers - activeUsers)
`,
  'planUsage advancedPermissions');
users=replaceOnce(users,
`      const cleanPermissions = ['admin','superadmin'].includes(String(perfil)) ? {} : sanitizePermissions(permissions);`,
`      const cleanPermissions = (!planUsage.advancedPermissions || ['admin','superadmin'].includes(String(perfil))) ? {} : sanitizePermissions(permissions);`,
  'POST granular permissions');
users=replaceOnce(users,
`      const newPermissions = ['admin','superadmin'].includes(String(newPerfil)) ? {} : (actorIsAdmin && permissions !== undefined ? sanitizePermissions(permissions) : ((cur.permissoes && typeof cur.permissoes === 'object') ? cur.permissoes : {}));`,
`      const permissionPlanUsage = await getUserPlanUsage(sql, auth.tenantId);
      const newPermissions = (!permissionPlanUsage.advancedPermissions || ['admin','superadmin'].includes(String(newPerfil))) ? {} : (actorIsAdmin && permissions !== undefined ? sanitizePermissions(permissions) : ((cur.permissoes && typeof cur.permissoes === 'object') ? cur.permissoes : {}));`,
  'PATCH granular permissions');
// Atualiza FinBot para as regras novas do produto.
users=users.replace(
  "answer:'Em Orçamentos você monta a planilha da obra com categorias, itens, quantidades e preços. O FinObra calcula totais e permite comparar o orçamento com o realizado.'",
  "answer:'Em Orçamentos você monta a planilha da obra com categorias, itens, quantidades e preços. O FinObra calcula totais e compara orçamento com realizado. SINAPI e controles avançados de engenharia fazem parte do plano Construtora Ilimitado.'"
);
users=users.replace(
  "answer:'O orçamento SINAPI trabalha com UF, competência/referência e dados oficiais disponíveis para a seleção. O FinObra mantém o orçamento separado por obra e permite aplicar BDI e Leis Sociais.'",
  "answer:'O SINAPI / Caixa está disponível no plano Construtora Ilimitado. Ele trabalha com UF e competência/referência, bases oficiais e composições por obra.'"
);
users=users.replace(
  "answer:'Em Configurações > Usuários, o administrador pode criar usuários, escolher perfis e restringir módulos. As permissões específicas reduzem acesso; não elevam o poder do perfil.'",
  "answer:'Em Configurações > Usuários, o administrador gerencia as pessoas da equipe. O Básico inclui 1 usuário ativo, o Profissional 2 e o Ilimitado 5. Celular, notebook e outros dispositivos da mesma pessoa não contam como usuários extras. Permissões granulares por módulo ficam disponíveis no Ilimitado.'"
);
users=users.replace(
  "answer:'Abra Planos & Cobrança para consultar plano, limites e mensalidade. Cobranças PIX pendentes aparecem com valor, identificação e histórico.'",
  "answer:'Abra Conta & Assinatura para consultar plano, usuários e obras em uso, módulos incluídos, cobranças por competência e opções de plano.'"
);
users=users.replace(
  "answer:'Em Configurações > Sessões você pode ver os dispositivos conectados à sua conta e encerrar acessos que não reconhece.'",
  "answer:'Em Configurações > Sessões você vê os dispositivos conectados à sua conta e pode encerrar acessos. Sessões de celular, notebook ou navegador não consomem usuários extras do plano.'"
);
fs.writeFileSync('api/users.js',users,'utf8');

// 3) Configurações: explicar perfil x permissão avançada e dispositivos x usuários.
let cfg=fs.readFileSync('js/configuracoes.js','utf8');
cfg=replaceOnce(cfg,
`  _permissionMatrix(role, permissions = {}) {
    const caps = this._roleCaps(role);
    const fullAdmin = ['admin','superadmin'].includes(String(role));
    if (fullAdmin) return '<div style="padding:12px;border:1px solid var(--border);border-radius:8px;color:var(--text3);font-size:.8rem;">Administrador possui acesso integral <strong>dentro dos módulos contratados no plano</strong>. O plano da empresa continua sendo aplicado pelo servidor.</div>';
`,
`  _permissionMatrix(role, permissions = {}) {
    const caps = this._roleCaps(role);
    const fullAdmin = ['admin','superadmin'].includes(String(role));
    if (fullAdmin) return '<div style="padding:12px;border:1px solid var(--border);border-radius:8px;color:var(--text3);font-size:.8rem;">Administrador possui acesso integral <strong>dentro dos módulos contratados no plano</strong>. O plano da empresa continua sendo aplicado pelo servidor.</div>';
    if (Auth?.getPlanAccess?.()?.features?.advancedPermissions === false) return '<div style="padding:14px;border:1px solid rgba(201,162,39,.3);border-radius:10px;background:rgba(201,162,39,.06);color:var(--text2);font-size:.8rem;line-height:1.5;"><strong>Permissões por perfil</strong><br>Neste plano, Gestor, Operador e Visualizador seguem as permissões padrão de cada perfil. A personalização módulo por módulo está disponível no plano Construtora Ilimitado.</div>';
`,
  'permission matrix plan UX');
cfg=replaceOnce(cfg,
`  _collectPermissionMatrix(form) {
    const role = form?.querySelector('[name="perfil"]')?.value || 'visualizador';
    if (['admin','superadmin'].includes(role)) return {};`,
`  _collectPermissionMatrix(form) {
    const role = form?.querySelector('[name="perfil"]')?.value || 'visualizador';
    if (Auth?.getPlanAccess?.()?.features?.advancedPermissions === false) return {};
    if (['admin','superadmin'].includes(role)) return {};`,
  'collect matrix feature');
cfg=replaceOnce(cfg,
`  _renderSessoes() {
    return \`<div class="page-header"><div><h1 class="page-title">&#x1F4F1; Sess&otilde;es & Dispositivos</h1><p class="page-sub">Veja onde sua conta est&aacute; conectada e encerre acessos que voc&ecirc; n&atilde;o reconhece.</p></div><div class="page-actions"><button class="btn btn-secondary btn-sm" data-fb-click="Configuracoes.loadSessions" data-fb-click-n="0">↻ Atualizar</button><button class="btn btn-warning btn-sm" data-fb-click="Configuracoes.revokeOtherSessions" data-fb-click-n="0">Encerrar outras sess&otilde;es</button></div></div><div id="sessions-list" class="card" style="padding:18px;color:var(--text3);">Carregando sess&otilde;es…</div>\`;
  },`,
`  _renderSessoes() {
    return \`<div class="page-header"><div><h1 class="page-title">&#x1F4F1; Sess&otilde;es & Dispositivos</h1><p class="page-sub">Veja onde sua conta est&aacute; conectada e encerre acessos que voc&ecirc; n&atilde;o reconhece.</p></div><div class="page-actions"><button class="btn btn-secondary btn-sm" data-fb-click="Configuracoes.loadSessions" data-fb-click-n="0">↻ Atualizar</button><button class="btn btn-warning btn-sm" data-fb-click="Configuracoes.revokeOtherSessions" data-fb-click-n="0">Encerrar outras sess&otilde;es</button></div></div><div style="margin-bottom:14px;padding:13px 15px;border:1px solid rgba(18,217,160,.28);background:rgba(18,217,160,.05);border-radius:10px;font-size:.8rem;line-height:1.5;color:var(--text2);"><strong style="color:var(--accent)">Dispositivo não é usuário.</strong> Você pode usar a mesma conta no notebook e no celular. Essas sessões aparecem aqui por segurança, mas não consomem acessos adicionais do plano.</div><div id="sessions-list" class="card" style="padding:18px;color:var(--text3);">Carregando sess&otilde;es…</div>\`;
  },`,
  'sessions friendly explanation');
fs.writeFileSync('js/configuracoes.js',cfg,'utf8');

// 4) Conta & Assinatura: módulos + recursos avançados separados para não enganar o cliente.
let cob=fs.readFileSync('js/cobranca.js','utf8');
const start="  _renderModules(p) {";
const end="\n\n  _renderCardPlano(plano,isAtual,canManage=false) {";
const block=`  _renderModules(p) {
    const el=document.getElementById('finobra-module-list'); if(!el)return;
    const catalog={dashboard:'Dashboard',obras:'Obras & Clientes',financeiro:'Financeiro',fornecedores:'Fornecedores',produtos:'Produtos / Insumos',precompras:'Pré-Compras',recibos:'Recibos',contratos:'Contratos',notas:'Notas / NF-e / OCR',orcamentos:'Orçamentos',medicoes:'Medições',documentos:'Documentos',relatorios:'Relatórios',contas:'Contas Bancárias',whatsapp:'WhatsApp',assinatura:'Assinatura eletrônica',planos:'Conta & Assinatura',configuracoes:'Configurações'};
    const allowed=new Set(p.modules||[]); const f=p.features||{};
    const advanced=[['ocr','OCR com IA'],['signatures','Assinatura eletrônica + QR'],['sinapi','SINAPI / Caixa'],['engineering','Curva S, EVM, ABC e BDI'],['advancedPermissions','Permissões avançadas por módulo']];
    el.innerHTML=\`<div style="font-weight:900;font-size:1rem;margin-bottom:6px">Módulos do seu plano</div><div style="font-size:.78rem;color:var(--text3);margin-bottom:14px">Módulo contratado e recurso avançado são coisas diferentes. Por exemplo, Orçamentos pode estar incluído sem liberar SINAPI.</div><div class="acc-mod-grid">\${Object.entries(catalog).map(([k,v])=>\`<div class="acc-mod"><span style="color:\${allowed.has(k)?'#22c55e':'#94a3b8'}">\${allowed.has(k)?'✓':'🔒'}</span><span style="flex:1">\${v}</span><span style="font-size:.68rem;color:var(--text3)">\${allowed.has(k)?'Incluído':'Outro plano'}</span></div>\`).join('')}</div><div style="font-weight:900;font-size:1rem;margin:22px 0 10px">Recursos avançados</div><div class="acc-mod-grid">\${advanced.map(([k,v])=>\`<div class="acc-mod"><span style="color:\${f[k]?'#22c55e':'#94a3b8'}">\${f[k]?'✓':'🔒'}</span><span style="flex:1">\${v}</span><span style="font-size:.68rem;color:var(--text3)">\${f[k]?'Incluído':'Outro plano'}</span></div>\`).join('')}</div>\`;
  },`;
cob=replaceBetween(cob,start,end,block,'account features matrix');
fs.writeFileSync('js/cobranca.js',cob,'utf8');

// 5) Testes permanentes e de coerência das APIs críticas.
let test=fs.readFileSync('scripts/test-patch36-static.js','utf8');
test=test.replace("console.log('\\n✅ Patch 36 blocos 1–4 validados.');", `
const apiPerms=fs.readFileSync('api/_permissions.js','utf8');
const apiUsers=fs.readFileSync('api/users.js','utf8');
const apiNfe=fs.readFileSync('api/nfe.js','utf8');
const apiUpload=fs.readFileSync('api/upload.js','utf8');
const apiWhatsapp=fs.readFileSync('api/whatsapp.js','utf8');
const apiOcr=fs.readFileSync('api/reconhecer-documento.js','utf8');
const apiSign=fs.readFileSync('api/assinaturas.js','utf8');
assert(apiPerms.includes("canUseFeature(tenantPlan, 'advancedPermissions')"),'Permissão granular só é aplicada quando o plano inclui a feature.');
assert(apiUsers.includes('advancedPermissions: Boolean(rule.features?.advancedPermissions)') && apiUsers.includes('!planUsage.advancedPermissions') && apiUsers.includes('!permissionPlanUsage.advancedPermissions'),'API de usuários ignora matriz granular fora do Ilimitado.');
assert(cfg.includes('Dispositivo não é usuário') && cfg.includes('não consomem acessos adicionais do plano'),'Tela de Sessões diferencia dispositivos de usuários do plano.');
assert(cob.includes('Recursos avançados') && cob.includes("['sinapi','SINAPI / Caixa']") && cob.includes("['engineering','Curva S, EVM, ABC e BDI']"),'Central da Conta separa módulos de recursos avançados.');
for (const [name,src,module] of [['NF-e',apiNfe,'notas'],['Upload',apiUpload,'documentos'],['WhatsApp',apiWhatsapp,'whatsapp']]) assert(src.includes('canAccessModule') && src.includes("'"+module+"'"), name+' usa a camada central de módulos.');
assert(apiOcr.includes("canUseFeature(auth.user?.tenantPlan, 'ocr')") && apiSign.includes("canUseFeature(auth.user?.tenantPlan, 'signatures')"),'OCR e assinatura mantêm gates de feature no servidor.');
assert(apiUsers.includes('Sessões você vê os dispositivos') && apiUsers.includes('Básico inclui 1 usuário ativo'),'FinBot conhece limites e separação entre usuário e dispositivo.');
console.log('\\n✅ Patch 36 blocos 1–5 validados.');`);
fs.writeFileSync('scripts/test-patch36-static.js',test,'utf8');
console.log('Patch36 bloco 5 aplicado localmente; aguardando validação.');
