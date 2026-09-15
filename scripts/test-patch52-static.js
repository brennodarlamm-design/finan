// scripts/test-patch52-static.js — Validação Estática do Patch 52: Gestão Operacional & Workflow
import fs from 'fs';
import path from 'path';

let failed = 0;
const ok = (name, cond) => {
  if (cond) {
    console.log(`✓ ${name}`);
  } else {
    console.error(`✗ ${name}`);
    failed++;
  }
};

const root = process.cwd();
console.log('=== FinObra Patch 52 — Gestão Operacional e Automação do Workflow ===\n');

// 1. API Sanitizers
console.log('[1] API Sanitizers (_sla.js e _cargos.js)');
const slaApiSrc = fs.readFileSync(path.join(root, 'api/_sla.js'), 'utf8');
ok('_sla.js sanitiza cargo_responsavel', slaApiSrc.includes('cargo_responsavel:text(raw.cargo_responsavel'));
ok('_sla.js sanitiza checklist', slaApiSrc.includes('checklist:Array.isArray(raw.checklist)'));
ok('_sla.js sanitiza motivo_atraso', slaApiSrc.includes('motivo_atraso:text(raw.motivo_atraso'));
ok('_sla.js sanitiza checklist_status', slaApiSrc.includes('checklist_status:text(raw.checklist_status'));

const cargosApiSrc = fs.readFileSync(path.join(root, 'api/_cargos.js'), 'utf8');
ok('_cargos.js exporta sanitizeCargos', cargosApiSrc.includes('export function sanitizeCargos'));
ok('_cargos.js exporta sanitizeWorkflowTemplates', cargosApiSrc.includes('export function sanitizeWorkflowTemplates'));
ok('_cargos.js valida usuario_id e usuario_nome nos cargos', cargosApiSrc.includes('usuario_id:') && cargosApiSrc.includes('usuario_nome:'));
ok('_cargos.js valida checklist nos templates', cargosApiSrc.includes('checklist:'));

// 2. CronogramaSLA Core
console.log('\n[2] js/cronograma_sla.js (Motor de Workflow, Templates & Responsáveis)');
const slaJsSrc = fs.readFileSync(path.join(root, 'js/cronograma_sla.js'), 'utf8');
ok('Possui TEMPLATES_PADRAO com tipos de obra', (slaJsSrc.includes('TEMPLATES_PADRAO:') || slaJsSrc.includes('TEMPLATES_PADRAO =')) && slaJsSrc.includes('casa_caixa:') && slaJsSrc.includes('obra_particular:') && slaJsSrc.includes('reforma:'));
ok('Implementa getCargos() e saveCargos()', slaJsSrc.includes('getCargos()') && slaJsSrc.includes('saveCargos(cargos)'));
ok('Implementa getResponsavelEtapa() com resolução dinâmica por cargo', slaJsSrc.includes('getResponsavelEtapa(processo)'));
ok('Implementa getDemandas(usuarioId)', slaJsSrc.includes('getDemandas(usuarioId)'));
ok('SLA evolutivo calcula dias_executados e dias_restantes', slaJsSrc.includes('p.dias_executados =') && slaJsSrc.includes('p.dias_restantes ='));
ok('SLA evolutivo anexa responsavel_resolvido', slaJsSrc.includes('p.responsavel_resolvido = this.getResponsavelEtapa(p)'));
ok('Modal de apontamento suporta checklist interativo', slaJsSrc.includes('sla-checklist-item') && slaJsSrc.includes('_updateChecklistBtn()'));
ok('Modal de apontamento valida motivo_atraso quando atrasado', slaJsSrc.includes('sla-motivo-sel') && slaJsSrc.includes('motivoSel.focus()'));
ok('Não possui handlers inline em cronograma_sla.js', !/\bon[a-z]+=/i.test(slaJsSrc));

// 3. Configurações — Aba Workflow
console.log('\n[3] js/configuracoes.js (Aba Workflow: Cargos & Templates)');
const cfgJsSrc = fs.readFileSync(path.join(root, 'js/configuracoes.js'), 'utf8');
ok('Configurações possui aba workflow no router de abas', cfgJsSrc.includes("tab === 'workflow'") && cfgJsSrc.includes('this._renderWorkflow()'));
ok('Implementa _renderWorkflow() com listagem de cargos e templates', cfgJsSrc.includes('_renderWorkflow()') && cfgJsSrc.includes('CronogramaSLA.getCargos()') && cfgJsSrc.includes('CronogramaSLA.getTemplates()'));
ok('Implementa _addCargo(), _removerCargo(), _salvarCargos() e _removerTemplate()', cfgJsSrc.includes('_addCargo()') && cfgJsSrc.includes('_removerCargo(') && cfgJsSrc.includes('_salvarCargos()') && cfgJsSrc.includes('_removerTemplate('));
ok('Não possui handlers inline em configuracoes.js', !/\bon[a-z]+=/i.test(cfgJsSrc));

// 4. Minhas Demandas & Central do Gestor
console.log('\n[4] js/minhas_demandas.js & js/central_gestor.js');
const minhasDemandasSrc = fs.readFileSync(path.join(root, 'js/minhas_demandas.js'), 'utf8');
ok('MinhasDemandas implementa render()', minhasDemandasSrc.includes('render()'));
ok('MinhasDemandas categoriza atrasadas, próximas, andamento e aguardando', minhasDemandasSrc.includes('atrasadas:') && minhasDemandasSrc.includes('proximas:') && minhasDemandasSrc.includes('andamento:') && minhasDemandasSrc.includes('aguardando:'));
ok('MinhasDemandas implementa getBadgeCount() para badge do menu', minhasDemandasSrc.includes('getBadgeCount()'));
ok('Não possui handlers inline em minhas_demandas.js', !/\bon[a-z]+=/i.test(minhasDemandasSrc));

const centralGestorSrc = fs.readFileSync(path.join(root, 'js/central_gestor.js'), 'utf8');
ok('CentralGestor implementa render() com visão executiva', centralGestorSrc.includes('render()'));
ok('CentralGestor calcula KPIs de obras ativas, atrasadas e sem responsável', centralGestorSrc.includes('totalObras') && centralGestorSrc.includes('obrasAtrasadas') && centralGestorSrc.includes('totalSemResponsavel'));
ok('CentralGestor possui detector de gargalos críticos', centralGestorSrc.includes('gargalos'));
ok('Não possui handlers inline em central_gestor.js', !/\bon[a-z]+=/i.test(centralGestorSrc));

// 5. Integração com App, Clientes & Notificações
console.log('\n[5] Integrações de App, Clientes, Notificações & HTML');
const appJsSrc = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
ok('App registra rotas minhas-demandas e central-gestor', appJsSrc.includes("'minhas-demandas'") && appJsSrc.includes("'central-gestor'"));
ok('Sidebar inclui links para Minhas Demandas com badge e Central do Gestor', appJsSrc.includes("MinhasDemandas.getBadgeCount()") && appJsSrc.includes("this._navItem('central-gestor'"));

const notifJsSrc = fs.readFileSync(path.join(root, 'js/notificacoes.js'), 'utf8');
ok('Notificacoes integra alertas de workflow no obterAlertas()', notifJsSrc.includes('wf_atrasadas') && notifJsSrc.includes('wf_hoje') && notifJsSrc.includes('wf_proximas'));

const clientesJsSrc = fs.readFileSync(path.join(root, 'js/clientes.js'), 'utf8');
ok('Clientes formulário inclui campo tipo_workflow', clientesJsSrc.includes('name="tipo_workflow"'));
ok('Clientes.save persiste tipo_workflow', clientesJsSrc.includes('d.tipo_workflow = d.tipo_workflow || null;'));

const appHtmlSrc = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
ok('app.html carrega minhas_demandas.js', appHtmlSrc.includes('/js/minhas_demandas.js'));
ok('app.html carrega central_gestor.js', appHtmlSrc.includes('/js/central_gestor.js'));

// 6. CSP & Bridge Compliance
console.log('\n[6] Conformidade CSP & Event Bridge (Patch 26)');
const bridgeJsSrc = fs.readFileSync(path.join(root, 'js/patch26-events.js'), 'utf8');
ok('Bridge permite ações de cargos em Configuracoes', bridgeJsSrc.includes('"Configuracoes._addCargo"') && bridgeJsSrc.includes('"Configuracoes._salvarCargos"'));
ok('Bridge mapeia CentralGestor e MinhasDemandas em ROOTS', bridgeJsSrc.includes('"CentralGestor":') && bridgeJsSrc.includes('"MinhasDemandas":'));

console.log(`\n========================================`);
console.log(`Resumo Patch 52: ${failed ? `${failed} verificações falharam` : 'Todas as 30 verificações passaram com sucesso!'}`);
console.log(`========================================\n`);

if (failed) process.exit(1);
