// scripts/test-segmentation-agenda.js
// Valida a segmentação da sidebar por áreas da Construção Civil, Agenda Dev e Central de Notificações com E-mails

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}:`, err.message);
    process.exit(1);
  }
}

console.log('=== FinObra — Testes de Segmentação da Sidebar, Agenda Dev & E-mails ===\n');

// 1. Sidebar Segmentada por Construção Civil
test('app.js define 7 segmentos da Construção Civil no _navSections', () => {
  const appSrc = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
  assert.ok(appSrc.includes("id: 'gestao'"), 'Deve conter segmento gestao');
  assert.ok(appSrc.includes("id: 'obras'"), 'Deve conter segmento obras');
  assert.ok(appSrc.includes("id: 'financeiro'"), 'Deve conter segmento financeiro');
  assert.ok(appSrc.includes("id: 'suprimentos'"), 'Deve conter segmento suprimentos');
  assert.ok(appSrc.includes("id: 'fiscal'"), 'Deve conter segmento fiscal');
  assert.ok(appSrc.includes("id: 'planejamento'"), 'Deve conter segmento planejamento');
  assert.ok(appSrc.includes("id: 'sistema'"), 'Deve conter segmento sistema');
  assert.ok(appSrc.includes('Visão Geral & Gestão'), 'Rótulo do segmento gestao');
  assert.ok(appSrc.includes('Obras & Canteiro'), 'Rótulo do segmento obras');
  assert.ok(appSrc.includes('Financeiro & Caixa'), 'Rótulo do segmento financeiro');
  assert.ok(appSrc.includes('Suprimentos & Compras'), 'Rótulo do segmento suprimentos');
  assert.ok(appSrc.includes('Fiscal & SEFAZ'), 'Rótulo do segmento fiscal');
  assert.ok(appSrc.includes('Engenharia & SINAPI'), 'Rótulo do segmento engenharia/planejamento');
});

test('app.js implementa controle colapsável de seções (toggleNavSection, isSectionExpanded, _renderSidebarNav)', () => {
  const appSrc = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
  assert.ok(appSrc.includes('toggleNavSection('), 'App deve implementar toggleNavSection');
  assert.ok(appSrc.includes('isSectionExpanded('), 'App deve implementar isSectionExpanded');
  assert.ok(appSrc.includes('_renderSidebarNav('), 'App deve implementar _renderSidebarNav');
  assert.ok(appSrc.includes('AgendaEventos.renderHeaderBtn()'), 'Header deve conter botão de Agenda');
});

// 2. Módulo de Agenda Dev & Capacitação
test('js/agenda_eventos.js está implementado com zero handlers inline', () => {
  const agendaSrc = fs.readFileSync(path.join(root, 'js', 'agenda_eventos.js'), 'utf8');
  assert.ok(agendaSrc.includes('renderHeaderBtn()'), 'Deve ter renderHeaderBtn');
  assert.ok(agendaSrc.includes('abrirModal('), 'Deve ter abrirModal');
  assert.ok(agendaSrc.includes('setTab('), 'Deve ter setTab');
  assert.ok(agendaSrc.includes('salvarNovoEventoSubmit('), 'Deve ter salvarNovoEventoSubmit');
  assert.ok(agendaSrc.includes('adicionarAoGoogleCalendar('), 'Deve ter adicionarAoGoogleCalendar');
  assert.ok(!/\bon[a-z]+=/i.test(agendaSrc), 'Não deve conter handlers inline');
});

// 3. Central de Notificações com E-mails & Atualizações
test('js/notificacoes.js implementa abas de Alertas, E-mails e Atualizações', () => {
  const notifSrc = fs.readFileSync(path.join(root, 'js', 'notificacoes.js'), 'utf8');
  assert.ok(notifSrc.includes("setTab("), 'Deve implementar setTab');
  assert.ok(notifSrc.includes("getEmails()"), 'Deve implementar getEmails');
  assert.ok(notifSrc.includes("registrarEnvioEmail("), 'Deve implementar registrarEnvioEmail');
  assert.ok(notifSrc.includes("getAtualizacoes()"), 'Deve implementar getAtualizacoes');
  assert.ok(notifSrc.includes("E-mails Enviados"), 'Deve conter aba de E-mails');
  assert.ok(notifSrc.includes("Novidades"), 'Deve conter aba de Novidades/Dev');
});

// 4. Integração HTML e CSS
test('app.html importa agenda_eventos.js', () => {
  const appHtml = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
  assert.ok(appHtml.includes('/js/agenda_eventos.js'), 'app.html deve importar agenda_eventos.js');
});

test('css/style.css inclui classes de accordion, agenda e notificações', () => {
  const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
  assert.ok(css.includes('.nav-accordion-header'), 'Deve estilizar .nav-accordion-header');
  assert.ok(css.includes('.nav-accordion-body'), 'Deve estilizar .nav-accordion-body');
  assert.ok(css.includes('.agenda-card'), 'Deve estilizar .agenda-card');
  assert.ok(css.includes('.notif-tab-nav'), 'Deve estilizar .notif-tab-nav');
});

console.log('\n======================================================');
console.log('Relatório de Validação: Todas as 6 verificações passaram!');
console.log('======================================================\n');
