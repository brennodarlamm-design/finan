// scripts/test-monolito-modular.js
// Teste de Conformidade e Integridade do Monólito Modular FinGo

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

console.log('🧪 Iniciando teste de conformidade do Monólito Modular...');

// 1. Validar estrutura canônica de diretórios
const requiredDirs = [
  'frontend/core',
  'frontend/domains/fiscal',
  'frontend/domains/financeiro',
  'frontend/domains/obras',
  'frontend/domains/suprimentos',
  'frontend/domains/contratos',
  'frontend/domains/atendimento',
  'frontend/domains/gestao',
  'frontend/domains/configuracoes',
  'frontend/modules',
  'marketing/pages',
  'backend/domains',
  'docs/architecture'
];

for (const d of requiredDirs) {
  assert(fs.existsSync(path.join(root, d)), `Diretório canônico obrigatório ausente: ${d}`);
}
console.log('  ✓ 1. Estrutura canônica de diretórios validada');

// 2. Validar paridade 100% entre frontend/ (core + domains) e js/
function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(walk(full));
    } else if (item.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

const feFiles = [...walk(path.join(root, 'frontend', 'core')), ...walk(path.join(root, 'frontend', 'domains'))];
const jsDir = path.join(root, 'js');
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

assert.strictEqual(feFiles.length, jsFiles.length, `Quantidade divergente de arquivos: frontend=${feFiles.length}, js=${jsFiles.length}`);

const feByBase = new Map();
for (const f of feFiles) {
  feByBase.set(path.basename(f), f);
}

for (const jsFile of jsFiles) {
  const fePath = feByBase.get(jsFile);
  assert(fePath, `Arquivo ${jsFile} de js/ não encontrado em frontend/`);
  const bufJs = fs.readFileSync(path.join(jsDir, jsFile));
  const bufFe = fs.readFileSync(fePath);
  assert(bufJs.equals(bufFe), `Conteúdo divergente entre js/${jsFile} e ${path.relative(root, fePath)}`);
}
console.log(`  ✓ 2. Paridade 100% de ${jsFiles.length} módulos e pontes de compatibilidade confirmada`);

// 3. Validar fachadas de frontend/modules
const moduleFacades = [
  'fiscal.js',
  'financeiro.js',
  'obras.js',
  'suprimentos.js',
  'contratos.js',
  'atendimento.js',
  'gestao.js',
  'configuracoes.js',
  'core.js',
  'index.js',
  'README.md'
];

for (const m of moduleFacades) {
  assert(fs.existsSync(path.join(root, 'frontend', 'modules', m)), `Fachada modular ausente: frontend/modules/${m}`);
}
console.log(`  ✓ 3. Todas as ${moduleFacades.length} fachadas de frontend/modules/ verificadas`);

// 4. Validar páginas de marketing
const marketingPages = [
  'blog.html',
  'calculadora-bdi.html',
  'landing.html',
  'manuais.html',
  'planos.html',
  'privacidade.html',
  'sobre-nos.html',
  'termos.html',
  'validar.html'
];

for (const page of marketingPages) {
  const mktgPath = path.join(root, 'marketing', 'pages', page);
  const rootPath = path.join(root, page);
  assert(fs.existsSync(mktgPath), `Página de marketing ausente em marketing/pages/${page}`);
  assert(fs.existsSync(rootPath), `Página raiz correspondente ausente: ${page}`);
  const mktgBuf = fs.readFileSync(mktgPath);
  const rootBuf = fs.readFileSync(rootPath);
  assert(mktgBuf.equals(rootBuf), `Divergência entre marketing/pages/${page} e ${page}`);
}
console.log(`  ✓ 4. Todas as ${marketingPages.length} páginas públicas de marketing validadas com 100% de paridade`);

// 5. Validar shells de aplicação em frontend/
const shells = ['app.html', 'master.html', 'bim.html'];
for (const shell of shells) {
  const feShell = path.join(root, 'frontend', shell);
  const rootShell = path.join(root, shell);
  assert(fs.existsSync(feShell), `Shell ausente em frontend/${shell}`);
  const feBuf = fs.readFileSync(feShell);
  const rootBuf = fs.readFileSync(rootShell);
  assert(feBuf.equals(rootBuf), `Divergência entre frontend/${shell} e ${shell}`);
}
console.log(`  ✓ 5. Shells de aplicação (${shells.join(', ')}) validados`);

// 6. Validar CSS em frontend/css
const cssDir = path.join(root, 'css');
const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
for (const cssFile of cssFiles) {
  const feCss = path.join(root, 'frontend', 'css', cssFile);
  assert(fs.existsSync(feCss), `CSS ausente em frontend/css/${cssFile}`);
  const feBuf = fs.readFileSync(feCss);
  const rootBuf = fs.readFileSync(path.join(cssDir, cssFile));
  assert(feBuf.equals(rootBuf), `Divergência entre frontend/css/${cssFile} e css/${cssFile}`);
}
console.log(`  ✓ 6. Folhas de estilo (${cssFiles.length} arquivos CSS) validadas`);

// 7. Validar documentação arquitetural
assert(fs.existsSync(path.join(root, 'docs', 'architecture', 'MONOLITO_MODULAR.md')), 'docs/architecture/MONOLITO_MODULAR.md ausente');
assert(fs.existsSync(path.join(root, 'frontend', 'README.md')), 'frontend/README.md ausente');
assert(fs.existsSync(path.join(root, 'conductor', 'tracks', 'monolito-modular', 'spec.md')), 'conductor spec ausente');
assert(fs.existsSync(path.join(root, 'conductor', 'tracks', 'monolito-modular', 'plan.md')), 'conductor plan ausente');
console.log('  ✓ 7. Governança e documentação técnica Conductor validadas');

console.log('\n🎉 Monólito Modular FinGo: 100% em conformidade com as regras arquiteturais!');
