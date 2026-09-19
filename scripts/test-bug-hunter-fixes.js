// scripts/test-bug-hunter-fixes.js — Validação Automatizada das Correções dos 4 Bugs Críticos
import fs from 'fs';
import path from 'path';

let fails = 0;
function test(name, cond) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    console.error(`  ✗ ${name}`);
    fails++;
  }
}

console.log('=== Suíte de Testes: Correções dos 4 Bugs Críticos (audit_bug_hunter) ===\n');

// 1. Arquivos afetados
const mutationsFile = path.resolve('api/_db-mutations.js');
const syncFile = path.resolve('api/_db-sync.js');
const queriesFile = path.resolve('api/_db-queries.js');
const orcSinapiFile = path.resolve('js/orcamento_sinapi.js');
const dataFile = path.resolve('js/data.js');

test('Arquivos de backend e frontend existem fisicamente', [mutationsFile, syncFile, queriesFile, orcSinapiFile, dataFile].every(f => fs.existsSync(f)));

const mutationsCode = fs.readFileSync(mutationsFile, 'utf8');
const syncCode = fs.readFileSync(syncFile, 'utf8');
const queriesCode = fs.readFileSync(queriesFile, 'utf8');
const orcSinapiCode = fs.readFileSync(orcSinapiFile, 'utf8');
const dataCode = fs.readFileSync(dataFile, 'utf8');

// BUG-CRIT-01: BDI Duplicado em Cascata (Compound BDI)
console.log('\n[BUG-CRIT-01] BDI Duplicado em Cascata no SINAPI:');
test('_db-mutations.js prioriza o.valor_total e evita duplicar BDI', /cleanNum\(o\.valor_total\)\s*>\s*0\s*\?\s*cleanNum\(o\.valor_total\)\s*:\s*\(subtotal\s*\*\s*\(1\s*\+\s*cleanNum\(o\.bdi\)\s*\/\s*100\)\)/.test(mutationsCode));
test('_db-sync.js prioriza o.valor_total e evita duplicar BDI', /cleanNum\(o\.valor_total\)\s*>\s*0\s*\?\s*cleanNum\(o\.valor_total\)\s*:\s*\(subtotal\s*\*\s*\(1\s*\+\s*cleanNum\(o\.bdi\)\s*\/\s*100\)\)/.test(syncCode));
test('orcamento_sinapi.js separa total (custo direto) de total_com_bdi', /total_com_bdi:\s*Math\.round\(precoBdi\s*\*\s*100\)\s*\/\s*100/.test(orcSinapiCode) && /total:\s*Math\.round\(precoUnit\s*\*\s*100\)\s*\/\s*100/.test(orcSinapiCode));
test('orcamento_sinapi.js calcula valor_total no _save e _add', /orc\.valor_total\s*=\s*t\.totalGeral/.test(orcSinapiCode));
test('data.js consolida SINAPI sem multiplicar BDI duplamente', /Number\(orc\.valor_total\)\s*\|\|\s*\(subtotal\s*\*\s*\(1\s*\+\s*bdi\s*\/\s*100\)\)/.test(dataCode) && /Number\(i\.total_com_bdi\)\s*\|\|\s*\(Number\(i\.total\s*\|\|\s*0\)\s*\*\s*\(1\s*\+\s*bdi\s*\/\s*100\)\)/.test(dataCode));

// BUG-CRIT-02: Quebra Silenciosa do Delta Sync
console.log('\n[BUG-CRIT-02] Quebra Silenciosa do Delta Sync para Obras, Fornecedores e Produtos:');
test('_db-queries.js inclui created_at e audit_logs no delta sync de obras', /SELECT \* FROM obras WHERE.*\(created_at >= \$\{sinceIso\} OR id IN \(SELECT entidade_id FROM audit_logs WHERE tenant_id = \$\{tenantId\} AND entidade = 'obras'/.test(queriesCode));
test('_db-queries.js inclui created_at e audit_logs no delta sync de fornecedores', /SELECT \* FROM fornecedores WHERE.*\(created_at >= \$\{sinceIso\} OR id IN \(SELECT entidade_id FROM audit_logs WHERE tenant_id = \$\{tenantId\} AND entidade = 'fornecedores'/.test(queriesCode));
test('_db-queries.js inclui created_at e audit_logs no delta sync de produtos', /SELECT \* FROM produtos WHERE.*\(created_at >= \$\{sinceIso\} OR id IN \(SELECT entidade_id FROM audit_logs WHERE tenant_id = \$\{tenantId\} AND entidade = 'produtos'/.test(queriesCode));

// BUG-CRIT-03: Ressuscitação Fantasma de Registros no IndexedDB
console.log('\n[BUG-CRIT-03] Ressuscitação Fantasma de Registros pelo IndexedDB:');
test('data.js removeu a heurística ingênua idbVal.length > current.length', !/idbVal\.length\s*>\s*current\.length(?!\s*\)\s*\{[\s\S]*alinh)/.test(dataCode));
test('data.js alinha IDB quando itens foram excluídos na sessão ativa', /IDBStorage\.setItem\(k,\s*current\)/.test(dataCode));

// BUG-CRIT-04: Orçado vs Realizado e Curva ABC para Orçamentos Convencionais
console.log('\n[BUG-CRIT-04] Orçado vs Realizado e Curva ABC para Orçamentos Convencionais:');
test('data.js processa orc.etapas em consolidarOrcamentoObra', /Array\.isArray\(orc\.etapas\)\s*&&\s*orc\.etapas\.length\s*>\s*0/.test(dataCode) && /et\.categoria_id/.test(dataCode));
test('data.js processa orc.etapas em calcularCurvaABC', /etapasList\s*=\s*Array\.isArray\(orc\.etapas\)\s*&&\s*orc\.etapas\.length\s*>\s*0\s*\?\s*orc\.etapas\s*:\s*\[\]/.test(dataCode));

console.log(`\nResultado: ${13 - fails}/13 testes aprovados.`);
if (fails > 0) {
  process.exit(1);
}
console.log('🚀 Todos os 4 Bugs Críticos foram corrigidos e validados com sucesso!\n');
