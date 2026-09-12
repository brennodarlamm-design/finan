// scripts/test-patch14-static.js
// Testes estáticos para validação do Patch 14: Saneamento Global de Stored XSS e Endurecimento de Templates Frontend

import fs from 'fs';

let fails = 0;
function read(p) { return fs.readFileSync(p, 'utf8'); }
function ok(name, cond) {
  if (cond) console.log('✅ ' + name);
  else { console.error('❌ ' + name); fails++; }
}

console.log('\n--- TESTES ESTÁTICOS DO PATCH 14 (Saneamento Stored XSS & Templates Frontend) ---');

// 1. js/produtos.js
console.log('\n[1/6] Validando js/produtos.js...');
const produtosCode = read('js/produtos.js');

ok('js/produtos.js possui helper de escape _esc', produtosCode.includes('_esc(v)'));
ok('js/produtos.js escapa p.nome na listagem de produtos', produtosCode.includes('${this._esc(p.nome)}'));
ok('js/produtos.js escapa p.nome no input de edição', produtosCode.includes('value="${this._esc(p.nome || \'\')}"'));
ok('js/produtos.js escapa p.codigo no input de edição', produtosCode.includes('value="${this._esc(p.codigo || \'\')}"'));
ok('js/produtos.js escapa p.fornecedor_principal no input', produtosCode.includes('value="${this._esc(p.fornecedor_principal || \'\')}"'));
ok('js/produtos.js escapa p.observacoes no textarea', produtosCode.includes('>${this._esc(p.observacoes || \'\')}</textarea>'));
ok('js/produtos.js não possui sink desprotegido de p.nome', !produtosCode.includes('<div style="font-weight:700;color:var(--text);">${p.nome}</div>'));
ok('js/produtos.js escapa p.nome no modal de histórico', produtosCode.includes('📋 Histórico — ${this._esc(p.nome)}'));

// 2. js/precompras.js
console.log('\n[2/6] Validando js/precompras.js...');
const precomprasCode = read('js/precompras.js');

ok('js/precompras.js escapa numero_ordem no formulário', precomprasCode.includes('value="${esc(item?.numero_ordem || this._proximoNumeroOrdem())}"'));
ok('js/precompras.js escapa solicitante_nome no formulário', precomprasCode.includes('value="${esc(item?.solicitante_nome || user?.nome || \'Gestor\')}"'));
ok('js/precompras.js escapa descricao no formulário', precomprasCode.includes('value="${esc(item?.descricao || \'\')}"'));
ok('js/precompras.js escapa fornecedor_nome no formulário', precomprasCode.includes('value="${esc(item?.fornecedor_nome||\'\')}"'));
ok('js/precompras.js escapa fornecedor_cnpj no formulário', precomprasCode.includes('value="${esc(item?.fornecedor_cnpj || \'\')}"'));
ok('js/precompras.js escapa it.descricao na grade dinâmica de itens', precomprasCode.includes('value="${esc(it.descricao || \'\')}"'));

// 3. js/precompras_workflow.js
console.log('\n[3/6] Validando js/precompras_workflow.js...');
const workflowCode = read('js/precompras_workflow.js');

ok('js/precompras_workflow.js possui helper _esc', workflowCode.includes('_esc(v)'));
ok('js/precompras_workflow.js escapa numero_ordem no modal de aprovação', workflowCode.includes('${this._esc(p.numero_ordem)}'));
ok('js/precompras_workflow.js escapa p.descricao no modal de aprovação', workflowCode.includes('${this._esc(p.descricao)}'));
ok('js/precompras_workflow.js escapa it.descricao na folha oficial de ordem de compra', workflowCode.includes('${this._esc(it.descricao)}'));
ok('js/precompras_workflow.js não possui sink cru de item', !workflowCode.includes('<td style="padding:7px 10px;border:1px solid #cbd5e1;font-weight:600;color:#0f172a;">${it.descricao}</td>'));

// 4. js/configuracoes.js
console.log('\n[4/6] Validando js/configuracoes.js...');
const cfgCode = read('js/configuracoes.js');

ok('js/configuracoes.js escapa emp.nome_fantasia no input', cfgCode.includes('value="${this._esc(emp.nome_fantasia || \'\')}"'));
ok('js/configuracoes.js escapa emp.razao_social no input', cfgCode.includes('value="${this._esc(emp.razao_social || emp.nome_fantasia || \'\')}"'));
ok('js/configuracoes.js escapa emp.cnpj no input', cfgCode.includes('value="${this._esc(emp.cnpj || \'\')}"'));
ok('js/configuracoes.js escapa emp.telefone no input', cfgCode.includes('value="${this._esc(emp.telefone || \'\')}"'));
ok('js/configuracoes.js escapa nome da construtora no preview da marca', cfgCode.includes('${this._esc(emp.nome_fantasia || \'Nome da Construtora\')}'));

// 5. js/contas.js
console.log('\n[5/6] Validando js/contas.js...');
const contasCode = read('js/contas.js');

ok('js/contas.js escapa conta.agencia no formulário', contasCode.includes('value="${Utils.escapeHtml(conta?.agencia||\'\')}"'));
ok('js/contas.js escapa conta.numero no formulário', contasCode.includes('value="${Utils.escapeHtml(conta?.numero||\'\')}"'));
ok('js/contas.js escapa conta.apelido no formulário', contasCode.includes('value="${Utils.escapeHtml(conta?.apelido||\'\')}"'));
ok('js/contas.js escapa conta.obs no textarea', contasCode.includes('>${Utils.escapeHtml(conta?.obs||\'\')}</textarea>'));
ok('js/contas.js escapa obraAtiva.nome no cabeçalho', contasCode.includes('${Utils.escapeHtml(obraAtiva.nome)}'));

// 6. js/dashboard.js & js/contratos.js
console.log('\n[6/6] Validando js/dashboard.js e js/contratos.js...');
const dashCode = read('js/dashboard.js');
const contratosCode = read('js/contratos.js');

ok('js/dashboard.js escapa c.nome no relatório de impressão', dashCode.includes('${esc(c.nome)}'));
ok('js/dashboard.js escapa c.num_contrato_caixa no relatório de impressão', dashCode.includes('${esc(c.num_contrato_caixa||\'—\')}'));
ok('js/dashboard.js escapa l.descricao no relatório de impressão', dashCode.includes('${esc(l.descricao)}'));
ok('js/contratos.js não possui interpolação aninhada inválida no título', !contratosCode.includes('${isEdit ? \'Editar Contrato\' : \'Novo Contrato de Construção Civil — ${e(empNome)}\'}'));

console.log(`\nResultado dos testes do Patch 14: ${30 - fails}/30 passaram.`);

if (fails > 0) {
  process.exit(1);
} else {
  console.log('Todos os 30 testes do Patch 14 passaram com sucesso!\n');
  process.exit(0);
}
