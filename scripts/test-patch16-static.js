// scripts/test-patch16-static.js — Validação Estática do Patch 16 (Orçamentos Estruturados + Persistência)
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('=== Iniciando Testes Estáticos Patch 16 (Orçamentos) ===\n');

// 1. Schema & Migration 014
console.log('[1] Schema & Migrations');
const schema = fs.readFileSync('schema.sql', 'utf8');
assert(schema.includes('status VARCHAR(32) DEFAULT \'ativo\''), 'schema.sql inclui status em orcamentos');
assert(schema.includes('descricao TEXT DEFAULT \'\''), 'schema.sql inclui descricao em orcamentos');
assert(schema.includes('data_criacao DATE DEFAULT CURRENT_DATE'), 'schema.sql inclui data_criacao em orcamentos');
assert(schema.includes('idx_orcamentos_tenant_status'), 'schema.sql inclui índice idx_orcamentos_tenant_status');

assert(fs.existsSync('migrations/014_orcamentos_enrichment.sql'), 'migrations/014_orcamentos_enrichment.sql existe');
const mig014 = fs.readFileSync('migrations/014_orcamentos_enrichment.sql', 'utf8');
assert(mig014.includes('014_orcamentos_enrichment.sql'), 'Migration 014 registrada em schema_migrations');

// 2. API db.js
console.log('\n[2] Backend API (api/db.js)');
const dbJs = fs.readFileSync('api/db.js', 'utf8');
assert(dbJs.includes('function normalizeOrcamento(o)'), 'api/db.js define função auxiliar normalizeOrcamento');
assert(dbJs.includes('orcamentos: tableAllowed(auth, \'orcamentos\', \'read\') ? orcamentos.map(normalizeOrcamento) : []'), 'api/db.js mapeia orcamentos com normalizeOrcamento no snapshot total');
assert(dbJs.includes('const normalized = items.map(normalizeOrcamento)'), 'api/db.js mapeia orcamentos paginados com normalizeOrcamento');
assert(dbJs.includes('INSERT INTO orcamentos (id, tenant_id, obra_id, titulo, valor_total, itens_json, status, descricao, data_criacao)'), 'api/db.js persiste status, descricao e data_criacao no banco');

// 3. Data layer (js/data.js)
console.log('\n[3] Frontend Data Layer (js/data.js)');
const dataJs = fs.readFileSync('js/data.js', 'utf8');
assert(dataJs.includes('data_criacao: (typeof Utils !== \'undefined\' && Utils.cleanDate) ? Utils.cleanDate(o.data_criacao)'), 'js/data.js normaliza data_criacao no syncFromCloud');
assert(dataJs.includes('categorias: Array.isArray(o.categorias) ? o.categorias : []'), 'js/data.js preserva array de categorias');

// 4. Módulo de Orçamentos (js/orcamentos.js)
console.log('\n[4] Módulo de Orçamentos (js/orcamentos.js)');
const orcJs = fs.readFileSync('js/orcamentos.js', 'utf8');
assert(orcJs.includes('CATEGORIAS_PADRAO: ['), 'js/orcamentos.js define catálogo padrão da construção civil');
assert(orcJs.includes('Serviços Preliminares') && orcJs.includes('Fundações e Terraplenagem') && orcJs.includes('Estrutura e Concreto'), 'js/orcamentos.js inclui categorias padrão essenciais');
assert(orcJs.includes('_renderCategoryAccordion'), 'js/orcamentos.js implementa accordion estruturado por categoria');
assert(orcJs.includes('_renderItemFormRow'), 'js/orcamentos.js implementa linha de item com quantitativos e cálculos');
assert(orcJs.includes('_promptCustomCategory'), 'js/orcamentos.js permite adicionar categoria personalizada');
assert(orcJs.includes('_recalcModalTotals'), 'js/orcamentos.js possui cálculo de totais em tempo real');
assert(orcJs.includes('printOrcamento(id)'), 'js/orcamentos.js possui visualização para impressão/PDF');
assert(!orcJs.includes('fd.get(`etapa_nome_${i}`)'), 'js/orcamentos.js eliminou leitura frágil por índice de FormData');

console.log(`\n========================================`);
console.log(`Testes Patch 16: ${passed} passaram, ${failed} falharam.`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
