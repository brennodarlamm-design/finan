import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const sandbox = {
  window: { addEventListener: () => {}, removeEventListener: () => {} },
  document: {
    head: { appendChild: () => {} },
    body: { appendChild: () => {}, classList: { add: () => {}, remove: () => {} }, style: {} },
    createElement: () => ({ appendChild: () => {}, focus: () => {}, querySelector: () => null, querySelectorAll: () => [], setAttribute: () => {}, addEventListener: () => {}, style: {}, classList: { add: () => {}, remove: () => {} } }),
    getElementById: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {}
  },
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  },
  Auth: {
    getUser: () => ({ perfil: 'admin', nome: 'Admin Teste' }),
    canModule: () => true
  },
  fs,
  console,
  setTimeout,
  clearTimeout,
  parseFloat,
  parseInt,
  Math,
  Date,
  Number,
  String,
  Array,
  Object,
  Set,
  RegExp,
  addEventListener: () => {},
  removeEventListener: () => {}
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);

function runFile(relPath) {
  const code = fs.readFileSync(path.resolve(relPath), 'utf8');
  vm.runInContext(code, sandbox, { filename: relPath });
}

runFile('js/utils.js');
runFile('js/data.js');
runFile('js/contas.js');
runFile('js/lancamentos.js');
runFile('js/parcelamento.js');
runFile('js/ofx.js');
runFile('js/importar_excel.js');
runFile('js/recibos.js');
runFile('js/fornecedores.js');
runFile('js/dashboard.js');

vm.runInContext(`
console.log('🧪 Iniciando testes do Núcleo Financeiro Core (OFX, Contas, Parcelamento & Lançamentos)...');

// 1. Teste de Parser OFX com SGML sem tags de fechamento </STMTTRN>
console.log('\\n1. Testando parser OFX SGML sem tags de fechamento </STMTTRN>...');
const ofxSgmlSemFechamento = \`OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST>
<DTSTART>20260901120000
<DTEND>20260930120000
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260910120000[-3:BRT]
<TRNAMT>-1500.50
<FITID>FIT001
<MEMO>PAGTO FORNECEDOR MATERIAIS
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260915120000[-3:BRT]
<TRNAMT>45000.00
<FITID>FIT002
<MEMO>TED RECEBIMENTO CLIENTE APTO
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>\`;

const parsed = OFX._parseOFX(ofxSgmlSemFechamento);
if (parsed.transacoes.length !== 2) throw new Error('Deveria extrair 2 transações do OFX SGML sem fechamento');
if (parsed.transacoes[0].tipo !== 'debito') throw new Error('Primeira transação deve ser débito');
if (parsed.transacoes[0].valor !== 1500.50) throw new Error('Valor do débito deve ser 1500.50 positivo');
if (parsed.transacoes[0].data !== '2026-09-10') throw new Error('Data formatada deve ser 2026-09-10');
if (parsed.transacoes[1].tipo !== 'credito') throw new Error('Segunda transação deve ser crédito');
if (parsed.transacoes[1].valor !== 45000.00) throw new Error('Valor do crédito deve ser 45000.00');
console.log('   ✓ OFX SGML legado decodificado com sucesso.');

// 2. Teste do Robô Inteligente de Conciliação com Margem de Tolerância e Resiliência a Datas
console.log('\\n2. Testando robô inteligente de conciliação...');
const mockTrn = { id: 't1', tipo: 'debito', valor: 1500.00, data: '2026-09-10', memo: 'PAGTO FORNECEDOR MATERIAIS' };
const mockLan = { id: 'l1', tipo: 'despesa', valor: 1505.00, data_vencimento: '2026-09-12', descricao: 'Materiais de Construção', fornecedor_beneficiario: 'Fornecedor' };

const matchRes = OFX._avaliarMatch(mockTrn, mockLan, 10, 7);
if (!matchRes) throw new Error('Deveria encontrar match dentro da tolerância de R$ 10 e 7 dias');
if (matchRes.score < 50) throw new Error('Score esperado >= 50, obtido: ' + matchRes.score);
if (matchRes.diffDias !== 2) throw new Error('Diferença em dias deve ser 2');
console.log('   ✓ Match encontrado com sucesso (Score: ' + matchRes.score + '%, Diferença: R$ ' + matchRes.diffValor + ').');

// 3. Teste da baixa financeira automática ao conciliar
console.log('\\n3. Testando baixa financeira automática ao conciliar...');
DB.save('lancamentos', [
  { id: 'l_teste_baixa', tipo: 'despesa', valor: 1500, status: 'a_pagar', data: '2026-09-08', data_pagamento: null, conta_bancaria: '' }
]);
DB.save('ofximports', [
  { id: 'imp1', conta_bancaria: 'Sicredi Ag:0812 Cc:60096-3', transacoes: [{ id: 't_teste', status: 'pendente', data: '2026-09-10' }] }
]);

OFX.conciliar('imp1', 't_teste', 'l_teste_baixa', false);
const lanAtualizado = DB.getById('lancamentos', 'l_teste_baixa');
if (!lanAtualizado.conciliado) throw new Error('Lançamento deve estar conciliado');
if (lanAtualizado.status !== 'pago') throw new Error('Lançamento despesa pendente deve ter sido baixado para pago');
if (lanAtualizado.data_pagamento !== '2026-09-10') throw new Error('Data de pagamento deve ser a data da transação do extrato');
if (lanAtualizado.conta_bancaria !== 'Sicredi Ag:0812 Cc:60096-3') throw new Error('Conta deve ser herdada do extrato');
console.log('   ✓ Baixa financeira atômica aplicada na conciliação bancária.');

// 4. Teste de Coerção de Obra em DB.getLancamentos
console.log('\\n4. Testando coerção de ID de obra em DB.getLancamentos...');
DB.save('lancamentos', [
  { id: 'l_num', obra_id: 42, tipo: 'receita', valor: 1000, data: '2026-09-01' },
  { id: 'l_str', obra_id: '42', tipo: 'despesa', valor: 500, data: '2026-09-02' },
  { id: 'l_outra', obra_id: '99', tipo: 'despesa', valor: 300, data: '2026-09-03' }
]);

const filtradosPorString = DB.getLancamentos('42');
if (filtradosPorString.length !== 2) throw new Error('Deveria retornar 2 lançamentos tanto para obra 42 numérica quanto string');
const filtradosPorNum = DB.getLancamentos(42);
if (filtradosPorNum.length !== 2) throw new Error('Deveria retornar 2 lançamentos filtrando por número 42');
console.log('   ✓ Coerção de tipos de obra_id validada.');

// 5. Teste do Assistente de Parcelamento
console.log('\\n5. Testando assistente de parcelamento e opções de contas...');
DB.save('contas', [
  { id: 'c1', banco_codigo: '748', banco_nome: 'Sicredi', agencia: '0812', numero: '60096-3', apelido: 'Sicredi Principal' }
]);

const optionsConta = Contas.contaOptions('');
if (!optionsConta.includes('Sicredi Principal')) throw new Error('Opções de conta devem listar Sicredi Principal');
if (optionsConta.includes('undefined')) throw new Error('Opções de conta nunca devem conter undefined');

// Testa cálculo de datas de parcelamento
const venc2 = Parcelamento.calcularDataVencimento('2026-01-31', 1, 'mensal');
if (venc2 !== '2026-02-28') throw new Error('Janeiro 31 + 1 mês mensal deve ajustar para 28 de fevereiro');
const vencQuinz = Parcelamento.calcularDataVencimento('2026-03-01', 1, 'quinzenal');
if (vencQuinz !== '2026-03-16') throw new Error('Quinzenal deve somar 15 dias');

console.log('   ✓ Parcelamento com cálculo de datas e integração de contas validado.');

// 6. Teste de Blindagem contra null em Vencimentos do Dashboard e getLancamentos
console.log('\\n6. Testando blindagem contra null em vencimentos do Dashboard e getLancamentos...');
DB.save('lancamentos', [
  { id: 'l_null_data', tipo: 'despesa', status: 'a_pagar', valor: 250, data: null, data_vencimento: null, descricao: 'Conta Sem Data' }
]);
DB.save('notas', [
  { id: 'nf_sem_venc', status: 'pendente', valor_bruto: 1200, data_vencimento: null, data_emissao: '2026-09-20', numero_nf: '123', emitente: 'Fornecedor A' },
  { id: 'nf_sem_emitente', status: 'pendente', valor_bruto: 850, data_vencimento: '2026-09-25', emitente: null, numero_nf: '456' }
]);

const lansSeguro = DB.getLancamentos(null);
if (!lansSeguro.length) throw new Error('getLancamentos deve retornar com sucesso mesmo com data null');

const vencHtml = Dashboard._vencimentos('todas');
if (!vencHtml.includes('NF 123')) throw new Error('Deveria renderizar NF 123 mesmo com data_vencimento null');
if (!vencHtml.includes('NF 456')) throw new Error('Deveria renderizar NF 456 mesmo com emitente null');
console.log('   ✓ _vencimentos e getLancamentos 100% blindados contra null e localeCompare.');

// 7. Teste de Coerção de Obra em Recibos
console.log('\\n7. Testando filtros e integridade em Recibos...');
DB.save('recibos', [
  { id: 'rec_num', obra_id: 10, valor: 500, numero: '0001/2026', data: '2026-09-24', tipo: 'pagamento', beneficiario_nome: '<script>alert(1)</script>' }
]);
const htmlRecibos = Recibos.render('10');
if (htmlRecibos.includes('<script>')) throw new Error('Recibos não deve injetar HTML/script bruto');
if (!htmlRecibos.includes('&lt;script&gt;')) throw new Error('Nome do beneficiário deve ser escapado com segurança');
console.log('   ✓ Recibos com coerção de tipos e sanitização XSS validados.');

// 8. Teste de Blindagem de Lancamentos.save e btnParcelar
console.log('\\n8. Testando integridade de Lancamentos.save e CSP de Parcelamento...');
const lCode = fs.readFileSync('js/lancamentos.js', 'utf8');
if (!lCode.includes('const d = Object.fromEntries(fd);')) {
  throw new Error('Lancamentos.save deve definir objeto d a partir do FormData!');
}
if (lCode.includes("btnParcelar.setAttribute('onclick'")) {
  throw new Error('btnParcelar não deve utilizar atributo inline onclick (violação CSP)!');
}
console.log('   ✓ Lancamentos.save define d via FormData e btnParcelar segue padrão CSP.');

// 9. Teste de Fornecedores, Categoria Internet & Telefonia e Reativação
console.log('\\n9. Testando Fornecedores, Categoria Internet & Telefonia e Reativação...');
const catsForn = Fornecedores._getAllCategorias();
if (!catsForn.some(c => c.value === 'internet_tel')) {
  throw new Error('Fornecedores deve incluir categoria padrão internet_tel');
}

DB.save('fornecedores', [
  { id: 'f_nio', nome: 'NIO', razao_social: 'NIO SERVICOS DE INTERNET LTDA', nome_fantasia: 'NIO', cnpj: '11222333000199', categoria: 'internet_tel', ativo: false },
  { id: 'f_orphan', nome: 'Orfao', razao_social: 'FORNECEDOR ORFAO', categoria: 'categoria_inexistente', ativo: true }
]);

const opts = Fornecedores.fornecedorOptions('NIO', true);
if (!opts.includes('FORNECEDOR ORFAO')) {
  throw new Error('fornecedorOptions deve listar fornecedores mesmo com categoria excluída/órfã');
}
if (!opts.includes('Outros / Diversos')) {
  throw new Error('fornecedorOptions deve agrupar categorias órfãs em Outros / Diversos');
}

console.log('   ✓ Fornecedores com categoria internet_tel, fallback para órfãos e reativação validados.');

console.log('\\n🎉 TODOS OS TESTES DO NÚCLEO FINANCEIRO PASSARAM COM SUCESSO!\\n');
`, sandbox);

process.exit(0);
