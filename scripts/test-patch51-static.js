import fs from 'fs';
import { spawnSync } from 'child_process';

const read = p => fs.readFileSync(p, 'utf8');
const assert = (ok, msg) => { if (!ok) { console.error(`❌ ${msg}`); process.exit(1); } console.log(`✅ ${msg}`); };

const patch = read('js/patch51.js');
const hardening = read('js/patch51-hardening.js');
const followup = read('js/patch51-followup.js');
const slaSync = read('js/patch51-sla-sync.js');
const workflow = read('api/_workflow.js');
const complete = read('api/_workflow-complete.js');
const stageUpdate = read('api/_workflow-stage-update.js');
const meta = read('api/_workflow-meta.js');
const users = read('api/_workflow-users.js');
const audit = read('api/audit.js');
const sla = read('api/_sla.js');
const migration = read('migrations/028_patch51_workflow_obras.sql');
const app = read('app.html');

for (const file of ['js/patch51.js','js/patch51-hardening.js','js/patch51-followup.js','js/patch51-sla-sync.js','api/_workflow.js','api/_workflow-complete.js','api/_workflow-stage-update.js','api/_workflow-meta.js','api/_workflow-users.js','api/audit.js','api/_sla.js']) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding:'utf8' });
  assert(r.status === 0, `${file} possui sintaxe JavaScript válida${r.stderr ? `: ${r.stderr.trim()}` : ''}`);
}

assert(app.includes('/js/patch51.js?v=') && app.includes('/js/patch51-hardening.js?v=') && app.includes('/js/patch51-followup.js?v=') && app.includes('/js/patch51-sla-sync.js?v='), 'Patch 51 e camadas de hardening/sincronização são carregados pelo app principal');
assert(audit.includes("workflowAction === 'complete'") && audit.includes('workflowCompleteHandler'), 'Conclusão de workflow usa helper atômico dedicado sem nova função Vercel');
assert(audit.includes("workflowAction === 'meta_save'") && audit.includes('workflowMetaHandler'), 'Cadastro Geral usa handler endurecido sem criar nova função Vercel');
assert(audit.includes("workflowAction === 'users'") && audit.includes('workflowUsersHandler'), 'Workflow possui lista mínima de responsáveis sem reutilizar gestão de contas');
assert(audit.includes("workflowAction === 'stage_update'") && audit.includes('workflowStageUpdateHandler'), 'Ajuste de etapa usa helper endurecido sem criar nova função Vercel');
assert(users.includes('tenant_id=${auth.tenantId}') && users.includes('ativo=TRUE'), 'Lista de responsáveis é limitada a usuários ativos do mesmo tenant');
assert(!users.includes('email') && !users.includes('senha_hash'), 'Endpoint de responsáveis não expõe e-mail ou credenciais');
assert(hardening.includes("this.api('users')"), 'Frontend do workflow usa o endpoint mínimo de responsáveis');
assert(complete.includes('WITH current_stage AS') && complete.includes('next_candidate AS MATERIALIZED') && complete.includes('history_next AS'), 'Conclusão e transferência de etapa ocorrem em um único statement PostgreSQL');
assert(complete.includes('WORKFLOW_NOT_ASSIGNED'), 'Usuário não pode concluir etapa atribuída a outra pessoa');
assert(stageUpdate.includes("current.status === 'em_andamento' && !responsibleId") && stageUpdate.includes("? 'bloqueado'"), 'Etapa ativa sem responsável passa para Bloqueada');
assert(stageUpdate.includes("current.status === 'bloqueado' && responsibleId") && stageUpdate.includes("? 'em_andamento'"), 'Etapa bloqueada volta a Em andamento quando recebe responsável');
assert(stageUpdate.includes('WORKFLOW_STAGE_COMPLETED'), 'Etapa concluída não pode ser reconfigurada pelo endpoint de ajuste');
assert(stageUpdate.includes('SLA_DECREASE_NOT_ALLOWED'), 'Helper de ajuste também rejeita redução de SLA');
assert(workflow.includes('WORKFLOW_FIRST_STAGE_UNASSIGNED'), 'Workflow não inicia sem responsável na primeira etapa');
assert(workflow.includes('SLA_DECREASE_NOT_ALLOWED'), 'Backend legado de fallback também rejeita redução de SLA');
assert(sla.includes('responsavel_user_id') && sla.includes('responsavel_perfil'), 'Template de SLA preserva responsável da etapa');

assert(meta.includes('AND ativo=TRUE') && meta.includes('tenant_id=${tenantId}'), 'Responsável técnico interno precisa ser usuário ativo do mesmo tenant');
assert(meta.includes('INVALID_EXTERNAL_RT') && meta.includes('CREA/CAU'), 'Responsável técnico externo exige nome e CREA/CAU');
assert(meta.includes("payload='{}'::jsonb") || meta.includes("'{}'::jsonb"), 'Cadastro Geral não duplica o formulário inteiro em payload genérico');
assert(!meta.includes('rg:meta.rg') && !meta.includes('data_nascimento:meta.data_nascimento'), 'Auditoria não registra RG ou data de nascimento em claro');
assert(hardening.includes('internalEl.required = internal') && hardening.includes('externalReg.required = !internal'), 'Frontend exige responsável interno ou nome/CREA do externo conforme o tipo');
assert(hardening.includes('try {') && hardening.includes('o SLA só pode ser aumentado'), 'Redução de SLA é tratada sem exceção escapar da interface');
assert(hardening.includes('p51-workflow-board') && hardening.includes('Visão do Processo'), 'Workflow possui visão Kanban compacta por status');
assert(hardening.includes('p51-workflow-history') && hardening.includes('Histórico do Workflow'), 'Workflow exibe timeline de movimentações');
assert(hardening.includes('deadlineFor') && hardening.includes('📅 Prazo'), 'Workflow mostra prazo estimado por etapa');
assert(hardening.includes('p51-stage-note') && hardening.includes('observacoes:note'), 'Gestor pode registrar orientações/observações por etapa');
assert(hardening.includes('p51-stage-docs') && hardening.includes("ObraDetalhe.setTab('documentos')"), 'Cada etapa oferece acesso contextual à documentação da obra');

assert(patch.includes("['em_andamento','documentacao']"), 'Nova Obra limita status inicial a Em Andamento e Documentação');
assert(patch.includes('[name="data_previsao_termino"]'), 'Nova Obra remove o campo manual de previsão de término');
assert(patch.includes('responsavel_tecnico_tipo') && patch.includes('responsavel_tecnico_usuario_id'), 'Nova Obra suporta responsável técnico interno/externo');
assert(patch.includes('name="rg"') && patch.includes('name="orgao_expedidor"') && patch.includes('name="data_nascimento"'), 'Cadastro Geral possui RG, órgão expedidor e data de nascimento');
assert(patch.includes('Minhas Etapas') && patch.includes('p51-task-complete'), 'Usuário possui fila Minhas Etapas e ação de marcar como pronto');
assert(patch.includes("[data-route=\"documentacao\"]") && patch.includes("[data-route=\"portal-cliente\"]"), 'Documentação e Portal do Cliente são removidos da navegação lateral');
assert(patch.includes("data-tab=\"slas\"") && patch.includes("data-tab=\"orcado-realizado\""), 'Patch reposiciona SLA antes de Orçado x Realizado na Central');
assert(patch.includes('Soma dos SLAs'), 'Central possui componente de soma total dos dias de SLA');
assert(followup.includes("document.getElementById('od-tab-content')"), 'Soma dos SLAs usa o container real da Central de Obras');
assert(followup.includes('syncWorkflowSla') && followup.includes("Patch51.api('stage_update'") && followup.includes('applyForecastLocal'), 'Ajustes de SLA da obra sincronizam workflow e previsão automática');
assert(followup.includes('dataEntregaEstimada:previsaoOficial') && followup.includes('addDays(obra?.data_inicio, totalDias)'), 'Previsão oficial é normalizada para início da obra + soma dos SLAs');
assert(followup.includes('Status controlado pelo Workflow') && followup.includes('select.disabled = true'), 'Apontamento de SLA não cria um segundo caminho paralelo para concluir etapas');
assert(slaSync.includes('legacyGetObraProcessos') && slaSync.includes("Patch51._workflow.get(String(obraId || ''))"), 'Linha do tempo de SLA projeta o estado oficial do workflow sem duplicar persistência');
assert(slaSync.includes("bloqueado:'pendente'") && slaSync.includes('completed_at'), 'Timeline converte bloqueio para estado visual pendente e reflete conclusão do workflow');
assert(slaSync.includes("Patch51.loadWorkflow(obraId, { initialize:true })") && slaSync.includes("currentSetTab('slas')"), 'Abrir Prazos & SLAs atualiza o workflow antes de consolidar a timeline');
assert(followup.includes('WORKFLOW_FIRST_STAGE_UNASSIGNED') && followup.includes('Configurações > SLAs'), 'Criação de obra avisa quando falta responsável na primeira etapa');
assert(followup.includes('Prazo estimado') && followup.includes('p51-task-complete'), 'Fila Minhas Etapas exibe prazo estimado e vencimento');
assert(followup.includes('📝 Orientação:') && followup.includes('task.observacoes'), 'Fila Minhas Etapas mostra a orientação específica deixada pelo gestor');
assert(followup.includes('Central de Alertas e Demandas') && followup.includes("id:`workflow_${task.obra_id}_${task.etapa_id}`"), 'Demandas do workflow entram na Central de Alertas');
assert(followup.includes('FinGo — Nova etapa atribuída'), 'Nova atribuição pode gerar notificação nativa quando já autorizada');

assert(patch.includes('cub_modo') && patch.includes('cub_valor'), 'Configurações suportam CUB fixo/volante');
assert(patch.includes('cub * area'), 'Valor total do contrato é calculado por CUB × metragem');
assert(followup.includes('Informe um CUB maior que zero') && followup.includes('Informe uma metragem maior que zero'), 'Contrato não é gerado com CUB ou metragem zerados');
assert(patch.includes('subtitle.readOnly = true') && patch.includes('obra.subtitulo_capa'), 'Subtítulo da capa é vinculado ao Cadastro Geral');
assert(patch.includes('Salvar cláusulas como padrão da empresa'), 'Gerador permite centralizar cláusulas padrão da empresa');
assert(workflow.includes('contract_clause_versions'), 'Alterações gerais de cláusulas são versionadas');

for (const table of ['obra_cadastro_geral','workflow_etapas','workflow_historico','tenant_patch51_settings','contract_clause_versions']) {
  assert(migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `Migração cria ${table}`);
}
assert(!migration.includes('CREATE OR REPLACE FUNCTION'), 'Migração é declarativa e compatível com o preparador Neon');
assert(!patch.includes('localStorage.setItem("tenant') && !patch.includes("localStorage.setItem('tenant"), 'Patch não persiste chaves/sigilos de tenant no navegador');

console.log('\n✅ Patch 51: verificações estáticas concluídas.');
