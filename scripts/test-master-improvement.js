/**
 * scripts/test-master-improvement.js
 * Suíte de Testes Automatizados — Master Plan de Modernização FinObra
 * Valida: Conductor (CDD), Tailwind Specialist (Tokens/Haptic), Neon Egress, API RESTful, CSP e llms.txt
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import * as slaModule from '../api/_sla.js';

const root = process.cwd();
let passCount = 0;
let failCount = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✓ ${description}`);
    passCount++;
  } catch (err) {
    console.error(`✗ ${description}`);
    console.error(`  ${err.message}`);
    failCount++;
  }
}

console.log('\n=== FinObra — Suíte Master de Modernização & Governança ===\n');

// ── [1] ARQUITETURA CONDUCTOR & DOMAIN-DRIVEN DESIGN ─────────────
console.log('[1] Conductor & Context-Driven Development');

test('conductor/product.md existe e documenta personas e bounded contexts', () => {
  const p = path.join(root, 'conductor', 'product.md');
  assert.ok(fs.existsSync(p), 'conductor/product.md deve existir');
  const c = fs.readFileSync(p, 'utf8');
  assert.ok(c.includes('Bounded Contexts'), 'deve conter seção de Bounded Contexts');
  assert.ok(c.includes('Personas & Perfis'), 'deve conter personas');
  assert.ok(c.includes('Contexto Financeiro') && c.includes('Contexto Engenharia & Custos'), 'deve cobrir módulos centrais');
});

test('conductor/tech-stack.md existe e documenta invariantes de Neon, Serverless e CSP', () => {
  const p = path.join(root, 'conductor', 'tech-stack.md');
  assert.ok(fs.existsSync(p), 'conductor/tech-stack.md deve existir');
  const c = fs.readFileSync(p, 'utf8');
  assert.ok(c.includes('Neon PostgreSQL'), 'deve documentar Neon DB');
  assert.ok(c.includes('script-src-attr'), 'deve documentar política CSP');
  assert.ok(c.includes('empresa_id'), 'deve documentar multitenancy');
});

test('conductor/workflow.md existe e define gates de teste e commits semânticos', () => {
  const p = path.join(root, 'conductor', 'workflow.md');
  assert.ok(fs.existsSync(p), 'conductor/workflow.md deve existir');
  const c = fs.readFileSync(p, 'utf8');
  assert.ok(c.includes('Gates de Verificação'), 'deve definir gates');
  assert.ok(c.includes('Conventional Commits'), 'deve definir convenção de commits');
});

test('conductor/tracks.md e trilha modernizacao-master existem e estão sincronizados', () => {
  const tracksPath = path.join(root, 'conductor', 'tracks.md');
  assert.ok(fs.existsSync(tracksPath), 'conductor/tracks.md deve existir');
  const specPath = path.join(root, 'conductor', 'tracks', 'modernizacao-master', 'spec.md');
  const planPath = path.join(root, 'conductor', 'tracks', 'modernizacao-master', 'plan.md');
  assert.ok(fs.existsSync(specPath), 'spec.md da trilha ativa deve existir');
  assert.ok(fs.existsSync(planPath), 'plan.md da trilha ativa deve existir');
});

// ── [2] DESIGN SYSTEM & TAILWIND SPECIALIST ──────────────────────
console.log('\n[2] Design System, Tailwind Specialist & Micro-Interações');

test('css/style.css contém tokens semânticos e escala de espaçamento base 4px/8px', () => {
  const c = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
  assert.ok(c.includes('--space-1:') && c.includes('--space-4:') && c.includes('--space-8:'), 'deve conter escala de espaçamento');
  assert.ok(c.includes('--slate-900:') && c.includes('--emerald-500:') && c.includes('--amber-400:'), 'deve conter tokens semânticos');
  assert.ok(c.includes('--ease-spring:'), 'deve conter curva de aceleração de mola hápica');
});

test('css/style.css contém classes utilitárias agency-grade (Double-Bezel, Haptic e Tabular)', () => {
  const c = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
  assert.ok(c.includes('.bezel-shell') && c.includes('.bezel-core'), 'deve conter utilitários double-bezel');
  assert.ok(c.includes('.haptic-card') && c.includes('.haptic-press'), 'deve conter utilitários haptic');
  assert.ok(c.includes('.tabular-nums'), 'deve conter classe tabular-nums');
  assert.ok(c.includes('.kpi-grid-dashboard'), 'deve conter grid responsivo de KPIs');
  assert.ok(c.includes('.kpi-badge-pill'), 'deve conter badges semânticos');
});

test('minhas_demandas.js e central_gestor.js utilizam componentes agency-grade', () => {
  const md = fs.readFileSync(path.join(root, 'js', 'minhas_demandas.js'), 'utf8');
  const cg = fs.readFileSync(path.join(root, 'js', 'central_gestor.js'), 'utf8');
  assert.ok(md.includes('haptic-card') && md.includes('tabular-nums'), 'minhas_demandas deve usar haptic-card e tabular-nums');
  assert.ok(cg.includes('haptic-card') && cg.includes('kpi-grid-dashboard'), 'central_gestor deve usar haptic-card e kpi-grid-dashboard');
});

// ── [3] NEON POSTGRES, EGRESS & API RESTFUL ──────────────────────
console.log('\n[3] Neon Postgres, Egress & API Design');

test('api/_sla.js implementa envelopes padronizados RESTful e projeção de egress', () => {
  assert.equal(typeof slaModule.formatApiResponse, 'function', 'formatApiResponse deve ser função exportada');
  assert.equal(typeof slaModule.formatApiError, 'function', 'formatApiError deve ser função exportada');
  assert.equal(typeof slaModule.projectSlaSummary, 'function', 'projectSlaSummary deve ser função exportada');

  const okResp = slaModule.formatApiResponse({ id: 123 });
  assert.equal(okResp.success, true);
  assert.equal(okResp.data.id, 123);
  assert.ok(okResp.timestamp);

  const errResp = slaModule.formatApiError('Teste erro', { code: 'TEST_CODE', status: 422 });
  assert.equal(errResp.success, false);
  assert.equal(errResp.error, 'Teste erro');
  assert.equal(errResp.code, 'TEST_CODE');
  assert.equal(errResp.status, 422);

  const mockProcessos = [
    { id: 'p1', nome: 'Fase 1', historico: [{ texto: 'log longo' }], checklist: ['item 1'] }
  ];
  const compact = slaModule.projectSlaSummary(mockProcessos, { includeHistorico: false });
  assert.strictEqual(compact[0].historico, undefined, 'deve omitir histórico por padrão para salvar egress');
  assert.strictEqual(compact[0].total_historico, 1, 'deve expor contador do histórico');
});

// ── [4] ECOSSISTEMA DE IA & PADRÃO llms.txt ──────────────────────
console.log('\n[4] Padrão llms.txt & Descoberta por IA');

test('llms.txt e llms-full.txt existem e seguem padrão llmstxt.org', () => {
  const txtPath = path.join(root, 'llms.txt');
  const fullPath = path.join(root, 'llms-full.txt');
  assert.ok(fs.existsSync(txtPath), 'llms.txt deve existir');
  assert.ok(fs.existsSync(fullPath), 'llms-full.txt deve existir');

  const txtContent = fs.readFileSync(txtPath, 'utf8');
  assert.ok(txtContent.startsWith('# FinObra'), 'llms.txt deve iniciar com H1');
  assert.ok(txtContent.includes('> FinObra é uma plataforma'), 'llms.txt deve conter resumo em blockquote');

  const fullContent = fs.readFileSync(fullPath, 'utf8');
  assert.ok(fullContent.includes('Documentação Completa para LLMs'), 'llms-full.txt deve ter escopo completo');
  assert.ok(fullContent.includes('Especificação dos Endpoints RESTful'), 'llms-full.txt deve documentar endpoints');
});

test('robots.txt permite acesso público a /llms.txt e /llms-full.txt', () => {
  const r = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
  assert.ok(r.includes('Allow: /llms.txt'), 'robots.txt deve conter Allow: /llms.txt');
  assert.ok(r.includes('Allow: /llms-full.txt'), 'robots.txt deve conter Allow: /llms-full.txt');
});

test('sitemap.xml e data/sitemap.xml indexam as rotas de LLMs', () => {
  const s1 = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const s2 = fs.readFileSync(path.join(root, 'data', 'sitemap.xml'), 'utf8');
  assert.ok(s1.includes('https://finobra.app.br/llms.txt') && s1.includes('https://finobra.app.br/llms-full.txt'), 'sitemap.xml deve conter URLs de LLM');
  assert.ok(s2.includes('https://finobra.app.br/llms.txt') && s2.includes('https://finobra.app.br/llms-full.txt'), 'data/sitemap.xml deve conter URLs de LLM');
});

// ── [5] AUDITORIA DE SEGURANÇA & CONFORMIDADE CSP ───────────────
console.log('\n[5] Segurança CSP Estrita & Barramento');

test('Arquivos modificados não possuem nenhum inline event handler (script-src-attr none)', () => {
  const files = [
    'js/minhas_demandas.js',
    'js/central_gestor.js',
    'js/cronograma_sla.js'
  ];
  const inlineRegex = /\son\w+\s*=/i;
  for (const rel of files) {
    const content = fs.readFileSync(path.join(root, rel), 'utf8');
    const match = content.match(inlineRegex);
    assert.ok(!match, `Arquivo ${rel} violou CSP com manipulador inline: ${match ? match[0] : ''}`);
  }
});

// ── RELATÓRIO FINAL ──────────────────────────────────────────────
console.log('\n======================================================');
console.log(`Relatório de Validação: ${passCount} passaram, ${failCount} falharam.`);
console.log('======================================================\n');

if (failCount > 0) {
  process.exit(1);
}
