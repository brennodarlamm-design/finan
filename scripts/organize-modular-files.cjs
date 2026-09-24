// scripts/organize-modular-files.cjs
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const frontendMap = {
  // Core
  'js/auth.js': 'frontend/core/auth.js',
  'js/data.js': 'frontend/core/data.js',
  'js/data_demo.js': 'frontend/core/data_demo.js',
  'js/ui.js': 'frontend/core/ui.js',
  'js/utils.js': 'frontend/core/utils.js',
  'js/assets.js': 'frontend/core/assets.js',
  'js/app.js': 'frontend/core/app.js',
  'js/busca.js': 'frontend/core/busca.js',
  'js/cookie_banner.js': 'frontend/core/cookie_banner.js',
  'js/webmcp.js': 'frontend/core/webmcp.js',
  'js/patch26-events.js': 'frontend/core/patch26-events.js',
  'js/patch26-actions.js': 'frontend/core/patch26-actions.js',
  'js/patch22.js': 'frontend/core/patch22.js',
  'js/patch51.js': 'frontend/core/patch51.js',
  'js/patch51-hardening.js': 'frontend/core/patch51-hardening.js',
  'js/patch51-followup.js': 'frontend/core/patch51-followup.js',
  'js/patch51-sla-sync.js': 'frontend/core/patch51-sla-sync.js',

  // Fiscal
  'js/notas.js': 'frontend/domains/fiscal/notas.js',
  'js/nfe.js': 'frontend/domains/fiscal/nfe.js',
  'js/nfe_parser.js': 'frontend/domains/fiscal/nfe_parser.js',

  // Financeiro
  'js/contas.js': 'frontend/domains/financeiro/contas.js',
  'js/lancamentos.js': 'frontend/domains/financeiro/lancamentos.js',
  'js/recibos.js': 'frontend/domains/financeiro/recibos.js',
  'js/parcelamento.js': 'frontend/domains/financeiro/parcelamento.js',
  'js/cobranca.js': 'frontend/domains/financeiro/cobranca.js',
  'js/exportar.js': 'frontend/domains/financeiro/exportar.js',
  'js/importar_excel.js': 'frontend/domains/financeiro/importar_excel.js',
  'js/ofx.js': 'frontend/domains/financeiro/ofx.js',

  // Obras
  'js/clientes.js': 'frontend/domains/obras/clientes.js',
  'js/obra_detalhe.js': 'frontend/domains/obras/obra_detalhe.js',
  'js/medicoes.js': 'frontend/domains/obras/medicoes.js',
  'js/cronograma_sla.js': 'frontend/domains/obras/cronograma_sla.js',
  'js/fases_doc.js': 'frontend/domains/obras/fases_doc.js',
  'js/bim_viewer.js': 'frontend/domains/obras/bim_viewer.js',
  'js/bim_csg.js': 'frontend/domains/obras/bim_csg.js',
  'js/bim_ifc_extended.js': 'frontend/domains/obras/bim_ifc_extended.js',
  'js/bim_geometry_importer.js': 'frontend/domains/obras/bim_geometry_importer.js',
  'js/bim_clash_engine.js': 'frontend/domains/obras/bim_clash_engine.js',
  'js/bim_presets.js': 'frontend/domains/obras/bim_presets.js',
  'js/bim_presets_data.js': 'frontend/domains/obras/bim_presets_data.js',

  // Suprimentos
  'js/precompras.js': 'frontend/domains/suprimentos/precompras.js',
  'js/precompras_workflow.js': 'frontend/domains/suprimentos/precompras_workflow.js',
  'js/produtos.js': 'frontend/domains/suprimentos/produtos.js',
  'js/fornecedores.js': 'frontend/domains/suprimentos/fornecedores.js',

  // Contratos
  'js/contratos.js': 'frontend/domains/contratos/contratos.js',
  'js/assinador.js': 'frontend/domains/contratos/assinador.js',
  'js/documentos.js': 'frontend/domains/contratos/documentos.js',
  'js/gdrive.js': 'frontend/domains/contratos/gdrive.js',

  // Atendimento
  'js/suporte.js': 'frontend/domains/atendimento/suporte.js',
  'js/suporte_dev.js': 'frontend/domains/atendimento/suporte_dev.js',
  'js/whatsapp.js': 'frontend/domains/atendimento/whatsapp.js',
  'js/notificacoes.js': 'frontend/domains/atendimento/notificacoes.js',

  // Gestão
  'js/dashboard.js': 'frontend/domains/gestao/dashboard.js',
  'js/central_gestor.js': 'frontend/domains/gestao/central_gestor.js',
  'js/minhas_demandas.js': 'frontend/domains/gestao/minhas_demandas.js',
  'js/agenda_eventos.js': 'frontend/domains/gestao/agenda_eventos.js',
  'js/escritorio.js': 'frontend/domains/gestao/escritorio.js',
  'js/portal_cliente.js': 'frontend/domains/gestao/portal_cliente.js',

  // Configurações
  'js/configuracoes.js': 'frontend/domains/configuracoes/configuracoes.js',
  'js/master.js': 'frontend/domains/configuracoes/master.js',
  'js/dev-tenant-keys.js': 'frontend/domains/configuracoes/dev-tenant-keys.js',
  'js/ocr.js': 'frontend/domains/configuracoes/ocr.js',
  'js/academia.js': 'frontend/domains/configuracoes/academia.js'
};

const backendMap = {
  // Auth
  'api/_auth.js': 'backend/domains/auth/_auth.js',
  'api/_totp.js': 'backend/domains/auth/_totp.js',
  'api/_permissions.js': 'backend/domains/auth/_permissions.js',
  'api/_cargos.js': 'backend/domains/auth/_cargos.js',
  'api/auth.js': 'backend/domains/auth/auth.js',
  'api/users.js': 'backend/domains/auth/users.js',

  // Fiscal
  'api/_sefaz-dfe.js': 'backend/domains/fiscal/_sefaz-dfe.js',
  'api/_certificado.js': 'backend/domains/fiscal/_certificado.js',
  'api/nfe.js': 'backend/domains/fiscal/nfe.js',

  // Financeiro
  'api/_webhook_pix.js': 'backend/domains/financeiro/_webhook_pix.js',
  'api/_webhook_pix_core.js': 'backend/domains/financeiro/_webhook_pix_core.js',
  'api/_plans.js': 'backend/domains/financeiro/_plans.js',
  'api/plano.js': 'backend/domains/financeiro/plano.js',
  'api/assinaturas.js': 'backend/domains/financeiro/assinaturas.js',

  // Obras
  'api/_workflow.js': 'backend/domains/obras/_workflow.js',
  'api/_workflow-meta.js': 'backend/domains/obras/_workflow-meta.js',
  'api/_workflow-stage-update.js': 'backend/domains/obras/_workflow-stage-update.js',
  'api/_workflow-users.js': 'backend/domains/obras/_workflow-users.js',
  'api/_workflow-complete.js': 'backend/domains/obras/_workflow-complete.js',
  'api/_sla.js': 'backend/domains/obras/_sla.js',

  // Database
  'api/_database.js': 'backend/domains/database/_database.js',
  'api/_db-mutations.js': 'backend/domains/database/_db-mutations.js',
  'api/_db-queries.js': 'backend/domains/database/_db-queries.js',
  'api/_db-sync.js': 'backend/domains/database/_db-sync.js',
  'api/_db-normalizers.js': 'backend/domains/database/_db-normalizers.js',
  'api/_tenant-sql.js': 'backend/domains/database/_tenant-sql.js',
  'api/_tenant-access-key.js': 'backend/domains/database/_tenant-access-key.js',
  'api/db.js': 'backend/domains/database/db.js',

  // Edge
  'api/_edge-adapter.js': 'backend/domains/edge/_edge-adapter.js',
  'api/_edge-ai.js': 'backend/domains/edge/_edge-ai.js',
  'api/_edge-alerts.js': 'backend/domains/edge/_edge-alerts.js',
  'api/_edge-backup.js': 'backend/domains/edge/_edge-backup.js',
  'api/_edge-kv.js': 'backend/domains/edge/_edge-kv.js',
  'api/_edge-ledger.js': 'backend/domains/edge/_edge-ledger.js',
  'api/_edge-media.js': 'backend/domains/edge/_edge-media.js',
  'api/_edge-metrics.js': 'backend/domains/edge/_edge-metrics.js',
  'api/_edge-r2.js': 'backend/domains/edge/_edge-r2.js',
  'api/_edge-realtime.js': 'backend/domains/edge/_edge-realtime.js',
  'api/_edge-security.js': 'backend/domains/edge/_edge-security.js',
  'api/_edge-vector.js': 'backend/domains/edge/_edge-vector.js',
  'api/_v2-routes.js': 'backend/domains/edge/_v2-routes.js',

  // Integrations
  'backend/sinapi_robot.js': 'backend/domains/integrations/sinapi_robot.js',
  'api/_ai-key-pool.js': 'backend/domains/integrations/_ai-key-pool.js',
  'api/_trigger-client.js': 'backend/domains/integrations/_trigger-client.js',
  'api/_dev-tenant-keys.js': 'backend/domains/integrations/_dev-tenant-keys.js',
  'api/whatsapp.js': 'backend/domains/integrations/whatsapp.js',
  'api/reconhecer-documento.js': 'backend/domains/integrations/reconhecer-documento.js',
  'api/upload.js': 'backend/domains/integrations/upload.js',
  'api/admin.js': 'backend/domains/integrations/admin.js',
  'api/_admin-route.js': 'backend/domains/integrations/_admin-route.js',
  'api/audit.js': 'backend/domains/integrations/audit.js',
  'api/_audit.js': 'backend/domains/integrations/_audit.js',
  'api/_audit-route.js': 'backend/domains/integrations/_audit-route.js',
  'api/_ratelimit.js': 'backend/domains/integrations/_ratelimit.js',
  'api/_security-ip.js': 'backend/domains/integrations/_security-ip.js',
  'api/_http.js': 'backend/domains/integrations/_http.js',
  'api/dashboard.js': 'backend/domains/integrations/dashboard.js'
};

function copyMap(map, label) {
  let count = 0;
  for (const [srcRel, dstRel] of Object.entries(map)) {
    const src = path.join(root, srcRel);
    const dst = path.join(root, dstRel);
    const dir = path.dirname(dst);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      count++;
    } else {
      console.warn(`[${label}] Arquivo fonte não encontrado: ${srcRel}`);
    }
  }
  console.log(`✅ [${label}] ${count} arquivos organizados com sucesso.`);
}

copyMap(frontendMap, 'Frontend');
copyMap(backendMap, 'Backend');
