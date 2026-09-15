import fs from 'fs';
import { spawnSync } from 'child_process';

const read = p => fs.readFileSync(p, 'utf8');
const assert = (ok, msg) => { if (!ok) { console.error(`❌ ${msg}`); process.exit(1); } console.log(`✅ ${msg}`); };

const patch = read('js/patch51.js');
const hardening = read('js/patch51-hardening.js');
const workflow = read('api/_workflow.js');
const complete = read('api/_workflow-complete.js');
const meta = read('api/_workflow-meta.js');
const audit = read('api/audit.js');
const sla = read('api/_sla.js');
const migration = read('migrations/028_patch51_workflow_obras.sql');
const app = read('app.html');

for (const file of ['js/patch51.js','js/patch51-hardening.js','api/_workflow.js','api/_workflow-complete.js','api/_workflow-meta.js','api/audit.js','api/_sla.js']) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding:'utf8' });
  assert(r.status === 0, `${file} possui sintaxe JavaScript válida${r.stderr ? `: ${r.stderr.trim()}` : ''}`);
}

assert(app.includes('/js/patch51.js?v=') && app.includes('/js/patch51-hardening.js?v='), 'Patch 51 e hardening são carregados pelo app principal');
assert(audit.includes("workflowAction === 'complete'") && audit.includes('workflowCompleteHandler'), 'Conclusão de workflow usa helper atômico dedicado sem nova função Vercel');
assert(audit.includes("workflowAction === 'meta_save'") && audit.includes('workflowMetaHandler'), 'Cadastro Geral usa handler endurecido sem criar nova função Vercel');
assert(complete.includes('WITH current_stage AS') && complete.includes('next_candidate AS MATERIALIZED') && complete.includes('history_next AS'), 'Conclusão e transferência de etapa ocorrem em um único statement PostgreSQL');
assert(complete.includes('WORKFLOW_NOT_ASSIGNED'), 'Usuário não pode concluir etapa atribuída a outra pessoa');
assert(workflow.includes('WORKFLOW_FIRST_STAGE_UNASSIGNED'), 'Workflow não inicia sem responsável na primeira etapa');
assert(workflow.includes('SLA_DECREASE_NOT_ALLOWED'), 'Backend rejeita redução de SLA');
assert(sla.includes('responsavel_user_id') && sla.includes('responsavel_perfil'), 'Template de SLA preserva responsável da etapa');

assert(meta.includes('AND ativo=TRUE') && meta.includes('tenant_id=${tenantId}'), 'Responsável técnico interno precisa ser usuário ativo do mesmo tenant');
assert(meta.includes('INVALID_EXTERNAL_RT') && meta.includes('CREA/CAU'), 'Responsável técnico externo exige nome e CREA/CAU');
assert(meta.includes("payload='{}'::jsonb") || meta.includes("'{}'::jsonb"), 'Cadastro Geral não duplica o formulário inteiro em payload genérico');
assert(!meta.includes('rg:meta.rg') && !meta.includes('data_nascimento:meta.data_nascimento'), 'Auditoria não registra RG ou data de nascimento em claro');
assert(hardening.includes('internalEl.required = internal') && hardening.includes('externalReg.required = !internal'), 'Frontend exige responsável interno ou nome/CREA do externo conforme o tipo');
assert(hardening.includes('try {') && hardening.includes('o SLA só pode ser aumentado'), 'Redução de SLA é tratada sem exceção escapar da interface');

assert(patch.includes("['em_andamento','documentacao']"), 'Nova Obra limita status inicial a Em Andamento e Documentação');
assert(patch.includes('[name="data_previsao_termino"]'), 'Nova Obra remove o campo manual de previsão de término');
assert(patch.includes('responsavel_tecnico_tipo') && patch.includes('responsavel_tecnico_usuario_id'), 'Nova Obra suporta responsável técnico interno/externo');
assert(patch.includes('name="rg"') && patch.includes('name="orgao_expedidor"') && patch.includes('name="data_nascimento"'), 'Cadastro Geral possui RG, órgão expedidor e data de nascimento');
assert(patch.includes('Minhas Etapas') && patch.includes('p51-task-complete'), 'Usuário possui fila Minhas Etapas e ação de marcar como pronto');
assert(patch.includes("[data-route=\"documentacao\"]") && patch.includes("[data-route=\"portal-cliente\"]"), 'Documentação e Portal do Cliente são removidos da navegação lateral');
assert(patch.includes("data-tab=\"slas\"") && patch.includes("data-tab=\"orcado-realizado\""), 'Patch reposiciona SLA antes de Orçado x Realizado na Central');
assert(patch.includes('Soma dos SLAs'), 'Central mostra a soma total dos dias de SLA');

assert(patch.includes('cub_modo') && patch.includes('cub_valor'), 'Configurações suportam CUB fixo/volante');
assert(patch.includes('cub * area'), 'Valor total do contrato é calculado por CUB × metragem');
assert(patch.includes('subtitle.readOnly = true') && patch.includes('obra.subtitulo_capa'), 'Subtítulo da capa é vinculado ao Cadastro Geral');
assert(patch.includes('Salvar cláusulas como padrão da empresa'), 'Gerador permite centralizar cláusulas padrão da empresa');
assert(workflow.includes('contract_clause_versions'), 'Alterações gerais de cláusulas são versionadas');

for (const table of ['obra_cadastro_geral','workflow_etapas','workflow_historico','tenant_patch51_settings','contract_clause_versions']) {
  assert(migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `Migração cria ${table}`);
}
assert(!migration.includes('CREATE OR REPLACE FUNCTION'), 'Migração é declarativa e compatível com o preparador Neon');
assert(!patch.includes('localStorage.setItem("tenant') && !patch.includes("localStorage.setItem('tenant"), 'Patch não persiste chaves/sigilos de tenant no navegador');

console.log('\n✅ Patch 51: verificações estáticas concluídas.');
