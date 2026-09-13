import fs from 'fs';
function a(c,m){if(!c){console.error('❌ '+m);process.exit(1)}console.log('✅ '+m)}
const css=fs.readFileSync('css/style.css','utf8');
const app=fs.readFileSync('app.html','utf8');
const cfg=fs.readFileSync('js/configuracoes.js','utf8');
const cob=fs.readFileSync('js/cobranca.js','utf8');
a(app.includes('viewport-fit=cover'),'App respeita safe-area de dispositivos móveis.');
a(css.includes('FINOBRA_PATCH37_MOBILE_OPERATIONAL')&&css.includes('max-width:430px'),'Design system possui breakpoint operacional específico até 430px.');
a(css.includes('min-height:44px')&&css.includes('font-size:16px'),'Controles móveis têm área de toque e inputs evitam zoom automático.');
a(css.includes('align-items:flex-end')&&css.includes('92dvh')&&css.includes('safe-area-inset-bottom'),'Modais mobile funcionam como bottom sheet com corpo rolável e safe-area.');
a(css.includes('.page-actions { grid-template-columns:1fr; }'),'Ações de página não ficam espremidas em telas estreitas.');
a(cfg.includes('cfg-tabs')&&cfg.includes('scroll-snap-type:x proximity'),'Tabs de Configurações usam swipe horizontal.');
a(cfg.includes('cfg-user-card')&&cfg.includes('cfg-user-actions'),'Usuários possuem cards e ações adaptáveis no celular.');
a(cfg.includes('cfg-session-card')&&cfg.includes('cfg-session-main'),'Sessões possuem cards mobile dedicados.');
a(cfg.includes('cfg-audit-mobile')&&cfg.includes('cfg-audit-card')&&cfg.includes('Ver detalhes'),'Auditoria troca tabela larga por cards no celular.');
a(cob.includes('FINOBRA_PATCH37_ACCOUNT_MOBILE')&&cob.includes('grid-template-columns:1fr}.acc-panel[data-panel="equipe"]'),'Conta & Assinatura possui tratamento próprio até 430px.');
console.log('\n✅ Patch 37 bloco 3 mobile validado.');
