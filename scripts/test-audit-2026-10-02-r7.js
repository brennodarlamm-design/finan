// scripts/test-audit-2026-10-02-r7.js
// Regressões da sétima rodada da auditoria de 02/10/2026 (X1–X3, frontend).
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

console.log('=== Auditoria 2026-10-02 (7ª rodada) — regressões do frontend ===\n');

// X1 — Dados de NF-e (externos) e de outros usuários escapados antes do innerHTML.
{
  const mustEscape = {
    'js/nfe.js': ['<strong>${Utils.escapeHtml(i.nome)}</strong>', '<strong>${Utils.escapeHtml(parsed.emitente)}</strong>', '<strong>${Utils.escapeHtml(fornExistente.nome)}</strong>', '>${Utils.escapeHtml(o.nome)}</option>'],
    'js/lancamentos.js': ["${Utils.escapeHtml((n.emitente||'Sem emitente').slice(0,30))}"],
    'js/notas.js': ['${Utils.escapeHtml(r.error)}', '>${Utils.escapeHtml(c.apelido||c.banco_nome)}</option>'],
    'js/ocr.js': ['>${Utils.escapeHtml(o.nome)}</option>'],
    'js/fornecedores.js': ["data-contato=\"${Utils.escapeHtml(f.contato_nome||'')}\""],
    'js/fases_doc.js': ['${Utils.escapeHtml(doc.responsavel)}'],
    // AUDITORIA 2026-10-04 #7: o escape agora vem da origem (DB seguro dentro de gerar()).
    'js/exportar_templates.js': ['const DB = this._dbSeguro();', "if (typeof valor === 'string') return Utils.escapeHtml(valor);"],
    'js/parcelamento.js': ['>${Utils.escapeHtml(c.nome)}</option>'],
    'js/master.js': ['${this._esc(results.email.error)}', '${this._esc(err.message)}']
  };
  for (const [file, snippets] of Object.entries(mustEscape)) {
    const src = read(file);
    for (const s of snippets) assert(src.includes(s), `X1: ${file} deve conter ${s}`);
  }
  assert(!read('js/nfe.js').includes('<strong>${parsed.emitente}</strong>'), 'X1: emitente cru removido');
  console.log('  ✓ X1 NF-e, contas, obras, fornecedores e erros escapados');
}

// X2 — Portal público: payload da URL não injeta HTML.
{
  const src = read('js/portal_cliente.js');
  assert(!src.includes('Atrasado +${p.dias_atraso}d'), 'X2: dias_atraso cru removido');
  assert(src.includes('Math.max(0, parseInt(p.dias_atraso, 10) || 0)'), 'X2: dias_atraso numérico');
  console.log('  ✓ X2 portal público não aceita HTML vindo do link');
}

// X3 — Barramento de eventos restrito no portal público.
{
  for (const f of ['js/patch26-events.js', 'frontend/core/patch26-events.js']) {
    const src = read(f);
    assert(src.includes("const PUBLIC_PORTAL_PREFIXES = ['PortalCliente.', 'Utils.closeModal'];"), `X3: ${f} lista de ações do portal`);
    assert(src.includes("classList?.contains('portal-public-mode')"), `X3: ${f} checa modo público`);
  }
  console.log('  ✓ X3 portal público só dispara ações do próprio portal');
}

// Espelhos idênticos.
for (const f of ['nfe', 'notas', 'lancamentos', 'ocr', 'fornecedores', 'fases_doc', 'exportar_templates', 'parcelamento', 'master', 'portal_cliente', 'documentos']) {
  const js = read(`js/${f}.js`);
  const mirror = fs.readdirSync(path.join(root, 'frontend/domains')).map(d => path.join('frontend/domains', d, `${f}.js`)).find(p => fs.existsSync(path.join(root, p)));
  assert(mirror && read(mirror) === js, `espelho de js/${f}.js idêntico`);
}
console.log('  ✓ espelhos em frontend/ idênticos');

console.log('\n✅ Auditoria 2026-10-02 (7ª rodada): todas as regressões passaram.');
