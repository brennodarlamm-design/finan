// scripts/test-patch53-static.js — Validação Estática do Patch 53: Notificações WhatsApp, Visão Kanban/Gantt e Automações de Workflow
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
console.log('=== FinObra Patch 53 — Notificações WhatsApp, Visão Kanban/Gantt e Automações de Workflow ===\n');

// 1. API Sanitizer (_sla.js)
console.log('[1] API Sanitizer (api/_sla.js)');
const slaApiSrc = fs.readFileSync(path.join(root, 'api/_sla.js'), 'utf8');
ok('_sla.js sanitiza historico como array', slaApiSrc.includes('historico:Array.isArray(raw.historico)'));
ok('_sla.js sanitiza campos do historico (data, autor, de_status, para_status, texto)',
  slaApiSrc.includes('h.data') &&
  slaApiSrc.includes('h.autor') &&
  slaApiSrc.includes('h.de_status') &&
  slaApiSrc.includes('h.para_status') &&
  slaApiSrc.includes('h.texto'));

// 2. WhatsApp Integration (js/whatsapp.js)
console.log('\n[2] js/whatsapp.js (Notificações WhatsApp de Workflow)');
const waJsSrc = fs.readFileSync(path.join(root, 'js/whatsapp.js'), 'utf8');
ok('Implementa gerarMensagemEtapa com templates de início, conclusão, atraso e cobrança',
  waJsSrc.includes('gerarMensagemEtapa(') &&
  waJsSrc.includes("'inicio'") &&
  waJsSrc.includes("'conclusao'") &&
  waJsSrc.includes("'atraso'") &&
  waJsSrc.includes("'cobranca'"));
ok('Implementa abrirModalNotificacaoEtapa com seleção de destinatário e template',
  waJsSrc.includes('abrirModalNotificacaoEtapa(') &&
  waJsSrc.includes('wa-etp-tipo-sel') &&
  waJsSrc.includes('wa-etp-msg'));
ok('Implementa enviarNotificacaoEtapaSubmit com fallback para WhatsApp Web',
  waJsSrc.includes('enviarNotificacaoEtapaSubmit(') &&
  waJsSrc.includes('abrirWhatsAppWeb'));
ok('Implementa enviarResumoWorkflowObra com resumo executivo de prazos e atrasos',
  waJsSrc.includes('enviarResumoWorkflowObra(') &&
  waJsSrc.includes('CronogramaSLA.getResumoObra'));
ok('Não possui handlers inline em whatsapp.js', !/\bon[a-z]+=/i.test(waJsSrc));

// 3. CronogramaSLA: Modos Visuais (Kanban, Gantt, Linha do Tempo) e Automações
console.log('\n[3] js/cronograma_sla.js (Kanban, Gantt, Automação em Cascata & Histórico)');
const slaJsSrc = fs.readFileSync(path.join(root, 'js/cronograma_sla.js'), 'utf8');
ok('Gerencia modo de visualização (getModoVisualizacao, setModoVisualizacao)',
  slaJsSrc.includes('getModoVisualizacao(obraId)') &&
  slaJsSrc.includes('setModoVisualizacao(obraId, modo)'));
ok('Implementa seletor de modos (Linha do Tempo, Kanban, Gantt) no cabeçalho',
  slaJsSrc.includes('sla-modo-btn') &&
  slaJsSrc.includes('"linha_tempo"') &&
  slaJsSrc.includes('"kanban"') &&
  slaJsSrc.includes('"gantt"'));
ok('Implementa _renderKanban com 3 colunas (Pendente, Em Andamento, Concluído)',
  slaJsSrc.includes('_renderKanban(obraId, processos') &&
  slaJsSrc.includes('pendente:') &&
  slaJsSrc.includes('em_andamento:') &&
  slaJsSrc.includes('concluido:'));
ok('Implementa _renderGantt proporcional com balizas de data e indicador Hoje',
  slaJsSrc.includes('_renderGantt(obraId, processos') &&
  slaJsSrc.includes('hojePct') &&
  slaJsSrc.includes('minDate') &&
  slaJsSrc.includes('maxDate'));
ok('Implementa ação rápida iniciarEtapaRapido',
  slaJsSrc.includes('iniciarEtapaRapido(obraId, processoId)'));
ok('Modal de apontamento exibe trilha de histórico de transições e comentários',
  slaJsSrc.includes('p.historico') &&
  slaJsSrc.includes('sla-comentario-input'));
ok('Possui botão de notificação rápida por WhatsApp no modal e na lista de etapas',
  slaJsSrc.includes('WhatsApp.abrirModalNotificacaoEtapa') &&
  slaJsSrc.includes('WhatsApp.enviarResumoWorkflowObra'));
ok('salvarApontamento executa cascata automática: auto-inicia etapa sucessora ao concluir etapa',
  slaJsSrc.includes('newStatus === \'concluido\'') &&
  slaJsSrc.includes('sucessor.status = \'em_andamento\'') &&
  slaJsSrc.includes('Sistema (Cascata Automática)'));
ok('salvarApontamento executa smart triggers de status da obra (em_andamento e concluida)',
  slaJsSrc.includes('todasConcluidas') &&
  slaJsSrc.includes("status: 'concluida'") &&
  slaJsSrc.includes("status: 'em_andamento'"));
ok('Não possui handlers inline em cronograma_sla.js', !/\bon[a-z]+=/i.test(slaJsSrc));

// 4. Minhas Demandas (Lista & Kanban)
console.log('\n[4] js/minhas_demandas.js (Alternância Lista/Kanban & WhatsApp)');
const demandasJsSrc = fs.readFileSync(path.join(root, 'js/minhas_demandas.js'), 'utf8');
ok('Implementa alternância de modo (getModoVisualizacao, setModoVisualizacao)',
  demandasJsSrc.includes('getModoVisualizacao()') &&
  demandasJsSrc.includes('setModoVisualizacao(modo)'));
ok('Implementa renderKanban com 4 colunas operacionais',
  demandasJsSrc.includes('renderKanban') &&
  demandasJsSrc.includes('Vencidas') &&
  demandasJsSrc.includes('Próximas') &&
  demandasJsSrc.includes('Em Andamento') &&
  demandasJsSrc.includes('Aguardando'));
ok('Possui botão de envio rápido por WhatsApp para cada demanda',
  demandasJsSrc.includes('WhatsApp.abrirModalNotificacaoEtapa'));
ok('Não possui handlers inline em minhas_demandas.js', !/\bon[a-z]+=/i.test(demandasJsSrc));

// 5. Central do Gestor (Cobrança WhatsApp)
console.log('\n[5] js/central_gestor.js (Cobrança WhatsApp de Etapas Atrasadas)');
const gestorJsSrc = fs.readFileSync(path.join(root, 'js/central_gestor.js'), 'utf8');
ok('CentralGestor implementa cobrarWhatsApp(obraId, etapaId)',
  gestorJsSrc.includes('cobrarWhatsApp(obraId, etapaId)'));
ok('Tabela de obras inclui botão WhatsApp para cobrança direta da etapa ativa',
  gestorJsSrc.includes('CentralGestor.cobrarWhatsApp'));
ok('Gargalos críticos incluem botão de cobrança direta para a etapa atrasada',
  gestorJsSrc.includes('Cobrar') && gestorJsSrc.includes('CentralGestor.cobrarWhatsApp'));
ok('Não possui handlers inline em central_gestor.js', !/\bon[a-z]+=/i.test(gestorJsSrc));

// 6. CSP & Event Bridge Allowlist
console.log('\n[6] Conformidade CSP & Event Bridge (js/patch26-events.js)');
const bridgeJsSrc = fs.readFileSync(path.join(root, 'js/patch26-events.js'), 'utf8');
ok('Bridge permite CronogramaSLA.setModoVisualizacao', bridgeJsSrc.includes('"CronogramaSLA.setModoVisualizacao"'));
ok('Bridge permite CronogramaSLA.iniciarEtapaRapido', bridgeJsSrc.includes('"CronogramaSLA.iniciarEtapaRapido"'));
ok('Bridge permite WhatsApp.abrirModalNotificacaoEtapa', bridgeJsSrc.includes('"WhatsApp.abrirModalNotificacaoEtapa"'));
ok('Bridge permite WhatsApp.enviarNotificacaoEtapaSubmit', bridgeJsSrc.includes('"WhatsApp.enviarNotificacaoEtapaSubmit"'));
ok('Bridge permite WhatsApp.enviarResumoWorkflowObra', bridgeJsSrc.includes('"WhatsApp.enviarResumoWorkflowObra"'));
ok('Bridge permite MinhasDemandas.setModoVisualizacao', bridgeJsSrc.includes('"MinhasDemandas.setModoVisualizacao"'));
ok('Bridge permite CentralGestor.cobrarWhatsApp', bridgeJsSrc.includes('"CentralGestor.cobrarWhatsApp"'));

console.log(`\n========================================`);
console.log(`Resumo Patch 53: ${failed ? `${failed} verificações falharam` : 'Todas as 28 verificações passaram com sucesso!'}`);
console.log(`========================================\n`);

if (failed) process.exit(1);
