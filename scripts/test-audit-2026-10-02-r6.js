// scripts/test-audit-2026-10-02-r6.js
// Regressões da sexta rodada da auditoria de 02/10/2026 (W1–W4).
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

console.log('=== Auditoria 2026-10-02 (6ª rodada) — regressões ===\n');

// W1 — Visualizador de documentos: src filtrado e escapado.
{
  for (const f of ['js/documentos.js', 'frontend/domains/contratos/documentos.js']) {
    const src = read(f);
    assert(src.includes('const previewSrc = this._safePreviewSrc(conteudo);'), `W1: ${f} usa src filtrado`);
    assert(!src.includes('<iframe src="${conteudo}"') && !src.includes('<img src="${conteudo}"'), `W1: ${f} sem interpolação crua`);
  }
  const src = read('js/documentos.js');
  const fnSrc = src.slice(src.indexOf('  _safePreviewSrc(value) {'), src.indexOf('  async baixar(id) {'));
  const body = fnSrc.slice(fnSrc.indexOf('{') + 1, fnSrc.lastIndexOf('}'));
  const Utils = { escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') };
  const fn = new Function('value', 'Utils', 'window', body);
  const win = { location: { origin: 'https://fingo.api.br' } };
  assert.strictEqual(fn('javascript:alert(1)', Utils, win), '', 'W1: javascript: bloqueado');
  assert.strictEqual(fn('data:text/javascript,alert(1)', Utils, win), '', 'W1: data: não previsto bloqueado');
  assert(fn('data:application/pdf;base64,JVBER', Utils, win).startsWith('data:application/pdf'), 'W1: PDF permitido');
  assert(!fn('https://x/a.pdf" onload="x', Utils, win).includes('"'), 'W1: aspas escapadas');
  console.log('  ✓ W1 pré-visualização de documentos só com esquemas seguros e escapada');
}

// W2 — Delta: IDs excluídos filtrados pela permissão do módulo.
{
  const src = read('api/_db-queries.js');
  const block = src.slice(src.indexOf('const deleted = {};'), src.indexOf('const [\n'));
  assert(block.includes("if (!tableAllowed(auth, entTable, 'read')) continue;"), 'W2: filtro por permissão');
  console.log('  ✓ W2 delta não expõe exclusões de módulos sem leitura');
}

// W3 — SINAPI no Render: busca e recálculo exigem chave interna.
{
  for (const f of ['backend/sinapi_robot.js', 'backend/domains/integrations/sinapi_robot.js']) {
    const src = read(f);
    assert(src.includes("router.get('/search', authorizeRobot,"), `W3: ${f} /search protegido`);
    assert(src.includes("router.post('/recalc', authorizeRobot,"), `W3: ${f} /recalc protegido`);
  }
  console.log('  ✓ W3 /api/sinapi/search e /recalc do Render não são mais públicos');
}

// W4 — Chave Gemini vai no header, não na URL.
{
  for (const f of ['api/reconhecer-documento.js', 'api/_ai-key-pool.js']) {
    const src = read(f);
    assert(!src.includes('generateContent?key='), `W4: ${f} sem chave na URL`);
    assert(src.includes("'x-goog-api-key'"), `W4: ${f} usa header`);
  }
  console.log('  ✓ W4 chave Gemini enviada em header');
}

console.log('\n✅ Auditoria 2026-10-02 (6ª rodada): todas as regressões passaram.');
