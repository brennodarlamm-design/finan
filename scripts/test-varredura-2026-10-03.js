// scripts/test-varredura-2026-10-03.js
// Regressões da varredura geral de 03/10/2026 (docs/VARREDURA_SISTEMA_2026-10-03.md).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { EvolutionGoClient } from '../backend/domains/atendimento/evolution_client.js';

const read = (file) => fs.readFileSync(file, 'utf8');

console.log('=== Varredura 03/10/2026: correções rápidas ===\n');

// #13 — Resumo diário: interpolação dentro de comentário SQL vira parâmetro e derruba a query.
{
  const server = read('backend/server.js');
  const sqlTemplates = server.match(/sql`[\s\S]*?`/g) || [];
  for (const tpl of sqlTemplates) {
    assert(!/--[^\n]*\$\{/.test(tpl), `comentário SQL com interpolação: ${tpl.slice(0, 80)}`);
  }
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE lancamentos (id text, tenant_id text, tipo text, status text, obra_id text, data date, data_vencimento date);
      CREATE TABLE obras (id text, tenant_id text, nome text);
      INSERT INTO lancamentos VALUES ('l1','t1','despesa','a_pagar','o1','2026-10-01','2026-10-02');`);
    // Mesma forma da query do cron depois da correção ($1 = tenant, $2 = hoje).
    const rows = await db.query(`SELECT l.*, o.nome as obra_nome FROM lancamentos l LEFT JOIN obras o ON l.obra_id = o.id AND l.tenant_id = o.tenant_id
      WHERE l.tipo = 'despesa' AND l.tenant_id = $1 AND l.status IN ('a_pagar','pendente','em_atraso')
      AND (DATE(COALESCE(l.data_vencimento, l.data)) <= $2::date)`, ['t1', '2026-10-03']);
    assert.equal(rows.rows.length, 1);
    // A forma antiga (parâmetro sobrando só no comentário) falha no Postgres.
    await assert.rejects(db.query(`SELECT 1 FROM lancamentos l WHERE l.tenant_id = $1 -- l.tenant_id = $2`, ['t1', 'x']));
  } finally { await db.close(); }
  console.log('  ✓ Resumo das 08h: sem interpolação em comentário SQL e query válida no Postgres');
}

// #14 — DDD 55 (RS) recebia mensagem sem o código do país.
{
  const client = new EvolutionGoClient({ baseUrl: 'http://x', apiKey: 'k' });
  assert.equal(client.normalizePhoneNumber('(55) 99123-4567'), '5555991234567');
  assert.equal(client.normalizePhoneNumber('(55) 3222-1234'), '555532221234');
  assert.equal(client.normalizePhoneNumber('(11) 99123-4567'), '5511991234567');
  assert.equal(client.normalizePhoneNumber('+55 (55) 99123-4567'), '5555991234567');
  assert.equal(client.normalizePhoneNumber('5511991234567'), '5511991234567');
  const files = ['api/whatsapp.js', 'api/auth.js', 'api/admin.js', 'api/_admin-route.js', 'api/_webhook_pix_core.js', 'js/master.js', 'js/whatsapp.js', 'backend/domains/atendimento/evolution_client.js'];
  for (const f of files) {
    const src = read(f);
    assert(!/startsWith\('55'\)\s*\?/.test(src), `${f}: código do país decidido por startsWith('55')`);
    assert(!/&&\s*!\w+\.startsWith\('55'\)/.test(src), `${f}: 10/11 dígitos não podem depender de startsWith('55')`);
  }
  console.log('  ✓ Telefone: DDD 55 recebe o código do país (backend, admin, PIX e telas)');
}

// #31 — Arrastar arquivos: inline bloqueado pelo CSP; o barramento precisa tratar dragover.
{
  for (const f of ['js/nfe.js', 'js/ocr.js', 'js/fases_doc.js', 'js/documentos.js', 'js/contratos.js']) {
    assert(!/\son(dragover|dragleave|drop)=/.test(read(f)), `${f}: handler de arrastar inline (bloqueado pelo CSP)`);
  }
  const listeners = {};
  const ctx = vm.createContext({
    console, globalThis: {},
    document: { addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); } }
  });
  ctx.globalThis = ctx;
  vm.runInContext(read('js/patch26-events.js'), ctx);
  const classes = new Set();
  const zone = { classList: { add: c => classes.add(c), remove: c => classes.delete(c) }, contains: () => false, getAttribute: () => null };
  let prevented = false;
  const ev = { target: { closest: sel => (sel === '[data-fb-drop]' ? zone : null) }, preventDefault() { prevented = true; } };
  listeners.dragover.forEach(fn => fn(ev));
  assert.equal(prevented, true, 'dragover em [data-fb-drop] chama preventDefault (senão o drop não dispara)');
  assert(classes.has('drag-over'));
  listeners.dragleave.forEach(fn => fn({ ...ev, relatedTarget: null }));
  assert(!classes.has('drag-over'));
  let fora = false;
  listeners.dragover.forEach(fn => fn({ target: { closest: () => null }, preventDefault() { fora = true; } }));
  assert.equal(fora, false, 'fora de uma área de soltar, o navegador segue o padrão');
  console.log('  ✓ Arrastar arquivos: dragover tratado pelo barramento em NF-e, OCR e Fases');
}

// #25 — Valor por extenso (recibos e contratos).
{
  const ctx = vm.createContext({ console, window: {}, document: { addEventListener() {} }, navigator: {}, localStorage: { getItem: () => null, setItem() {} } });
  vm.runInContext(`${read('js/utils.js')}\nglobalThis.U = Utils;`, ctx);
  const casos = {
    1: 'um real', 100: 'cem reais', 101: 'cento e um reais', 1000: 'mil reais', 1001: 'mil e um reais',
    1200: 'mil e duzentos reais', 1250: 'mil duzentos e cinquenta reais',
    1000000: 'um milhão de reais', 2500000: 'dois milhões e quinhentos mil reais',
    14504.52: 'quatorze mil quinhentos e quatro reais e cinquenta e dois centavos',
    0.01: 'um centavo', 0: 'zero reais'
  };
  for (const [v, esperado] of Object.entries(casos)) assert.equal(ctx.U.extenso(Number(v)), esperado, `extenso(${v})`);
  assert.equal(ctx.U.numeroExtenso(85), 'oitenta e cinco');
  assert.equal(read('js/utils.js'), read('frontend/core/utils.js'), 'utils.js espelhado');
  console.log('  ✓ Extenso: "mil" (não "um mil"), "um milhão de reais" e "e" entre grupos pela regra');
}

// #18 — Contrato não imprime valores de exemplo.
{
  const src = read('js/contratos.js');
  assert(!/14504\.52/.test(src), 'entrada de exemplo R$ 14.504,52 não pode ser usada');
  assert(!/\|\|\s*'R\$ 10\.978,13'/.test(src), 'parcela de exemplo não pode ser valor padrão');
  assert(!/\|\|\s*'?122000/.test(src) && !/area_m2 \|\| '?40/.test(src), 'valor e área de exemplo não podem ser padrão');
  assert(/Não há valor de entrada com recursos próprios/.test(src), 'cláusula 08 sem entrada');
  assert.equal(src, read('frontend/domains/contratos/contratos.js'), 'contratos.js espelhado');
  console.log('  ✓ Contrato: sem valores de exemplo; entrada 0 gera cláusula própria');
}

console.log('\n✅ Varredura 03/10/2026 (correções rápidas): tudo certo.');
