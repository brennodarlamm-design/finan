// Patch 26 Stage B — normalize known complex legacy handlers into named safe actions.
// Runs BEFORE apply-patch26-build.cjs. It never evaluates handler text.
const fs = require('fs');
const path = require('path');

const root = __dirname;
const jsDir = path.join(root, 'js');
const htmlNames = ['app.html', 'index.html', 'master.html', 'landing.html', 'validar.html'];
const eventAttr = /\s+on(click|change|input|submit|mouseover|mouseout|mouseenter|mouseleave|keydown|keyup|keypress|focus|blur|dblclick|contextmenu|pointerdown|pointerup|mousedown|mouseup|touchstart|touchend|dragstart|drop)="([^"]*)"/gi;
let normalized = 0;

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function write(rel, src) { fs.writeFileSync(path.join(root, rel), src); }
function escJsSingle(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

// Handlers whose source contains double quotes inside a template expression cannot be
// parsed by a normal HTML-attribute regex. Normalize those first at source level.
{
  let src = read('js/dashboard.js');
  src = src.replace(
    /onclick="\$\{isEscritorio \? "App\.navigate\('escritorio'\)" : "App\.navigate\('orcamentos'\)"\}"/g,
    "onclick=\"App.navigate('${isEscritorio ? 'escritorio' : 'orcamentos'}')\""
  );
  src = src.replace(
    /onclick="\$\{isEscritorio \? "App\.navigate\('escritorio'\)" : "App\.navigate\('lancamentos'\)"\}"/g,
    "onclick=\"App.navigate('${isEscritorio ? 'escritorio' : 'lancamentos'}')\""
  );
  write('js/dashboard.js', src);
}

// Stop serializing whole objects into onclick for SINAPI. Keep the selected item in
// module state and expose one explicit method that Stage A can safely bind.
{
  let src = read('js/orcamento_sinapi.js');
  if (!src.includes('addPendingItem(orcId) {')) {
    src = src.replace(
      '  showAddItem(orcId, item) {',
      '  showAddItem(orcId, item) {\n    this._pendingAddItem = item;'
    );
    src = src.replace(
      /onclick="OrcamentoSINAPI\.addItem\('\$\{orcId\}', \$\{JSON\.stringify\(item\)\.replace\(\/"\/g, '&quot;'\)\}\)"/g,
      "onclick=\"OrcamentoSINAPI.addPendingItem('${orcId}')\""
    );
    src = src.replace(
      '  _calcPreview(precoUnit) {',
      "  addPendingItem(orcId) {\n    if (this._pendingAddItem) this.addItem(orcId, this._pendingAddItem);\n  },\n\n  _calcPreview(precoUnit) {"
    );
  }
  write('js/orcamento_sinapi.js', src);
}

// Same principle for XML batch import: keep parsed data in memory instead of embedding
// JSON inside executable HTML attributes.
{
  let src = read('js/notas.js');
  if (!src.includes('confirmPendingXmlImport() {')) {
    src = src.replace(
      '    const toImport = ok.filter(r => !r.duplicate);',
      '    const toImport = ok.filter(r => !r.duplicate);\n    this._pendingXmlImport = toImport.map(r => r.data);'
    );
    src = src.replace(
      /onclick="Notas\.confirmXmlImport\(\$\{JSON\.stringify\(toImport\.map\(r=>r\.data\)\)\.replace\(\/"\/g,'&quot;'\)\}\)"/g,
      'onclick="Notas.confirmPendingXmlImport()"'
    );
    src = src.replace(
      '  confirmXmlImport(nfsData) {',
      "  confirmPendingXmlImport() {\n    return this.confirmXmlImport(this._pendingXmlImport || []);\n  },\n\n  confirmXmlImport(nfsData) {"
    );
  }
  write('js/notas.js', src);
}

// Gov.br: retain the callback as an object reference instead of serializing function
// source into onclick.
{
  let src = read('js/assinador.js');
  if (!src.includes('executarGovBrDownload() {')) {
    src = src.replace(
      "  modalGovBr({ nomeDocumento = 'Documento FinObra', onBaixarPDF = null } = {}) {",
      "  executarGovBrDownload() {\n    if (typeof this._govBrDownload === 'function') this._govBrDownload();\n    Utils.toast('PDF preparado para Gov.br!','info');\n  },\n\n  modalGovBr({ nomeDocumento = 'Documento FinObra', onBaixarPDF = null } = {}) {\n    this._govBrDownload = typeof onBaixarPDF === 'function' ? onBaixarPDF : null;"
    );
    src = src.replace(
      "onclick=\"(${onBaixarPDF.toString()})();Utils.toast('PDF preparado para Gov.br!','info');\"",
      'onclick="Assinador.executarGovBrDownload()"'
    );
  }
  write('js/assinador.js', src);
}

// One explicit helper is needed for OFX because its filter text comes from another DOM
// element. Keep that lookup inside trusted source code, not in an attribute expression.
{
  let src = read('js/patch26-actions.js');
  if (!src.includes('ofxViewImport(importId, status) {')) {
    src = src.replace(
      '  ofxSetTolerance(kind, value) {',
      "  ofxViewImport(importId, status) {\n    OFX?.viewImport?.(importId, status, document.getElementById('rec-search')?.value || '');\n  },\n  ofxSetTolerance(kind, value) {"
    );
  }
  write('js/patch26-actions.js', src);
}

function normalize(handler) {
  const h = String(handler || '').trim();

  // Generic DOM operations.
  let m = h.match(/^document\.getElementById\('([^']+)'\)\.click\(\);?$/);
  if (m) return `Patch26Actions.clickById('${m[1]}')`;
  m = h.match(/^document\.getElementById\('([^']+)'\)\.remove\(\);?$/);
  if (m) return `Patch26Actions.removeById('${m[1]}')`;
  if (/^window\.print\(\);?$/.test(h)) return 'Patch26Actions.print()';
  if (/^event\.preventDefault\(\);?$/.test(h)) return 'Patch26Actions.prevent(event)';
  if (h === "this.parentElement.classList.toggle('open')") return 'Patch26Actions.toggleParentOpen(this)';
  if (h === "this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'table-row':'none'") return 'Patch26Actions.toggleNextRow(this)';
  if (h === "this.style.borderColor='var(--accent)'") return 'Patch26Actions.borderAccent(this)';
  if (h === "this.style.borderColor='var(--border)'") return 'Patch26Actions.borderDefault(this)';
  if (h === "this.style.borderColor='rgba(255,255,255,.18)'") return 'Patch26Actions.borderMasterBlur(this)';
  if (h === "this.style.textDecoration='underline'") return 'Patch26Actions.linkUnderline(this,true)';
  if (h === "this.style.textDecoration='none'") return 'Patch26Actions.linkUnderline(this,false)';
  if (h === "this.style.color='var(--accent2)'") return 'Patch26Actions.linkAccent(this,true)';
  if (h === "this.style.color='var(--text3)'") return 'Patch26Actions.linkAccent(this,false)';

  // Support menu + keyboard.
  m = h.match(/^Suporte\.(abrirTelaAtendimento|abrirManual|abrirTutoriais|abrirAgendamento|abrirContatos|abrirTreinamentos)\(\);Suporte\.fecharDropdown\(\);?$/);
  if (m) {
    const kind = ({ abrirTelaAtendimento:'atendimento', abrirManual:'manual', abrirTutoriais:'tutoriais', abrirAgendamento:'agendamento', abrirContatos:'contatos', abrirTreinamentos:'treinamentos' })[m[1]];
    return `Patch26Actions.suporteMenu('${kind}')`;
  }
  if (h.includes("event.key==='Enter'&&!event.shiftKey") && h.includes('Suporte.enviarMensagem()')) return 'Patch26Actions.suporteSendOnEnter(event)';
  if (h.startsWith("alert('Assistir tutorial:")) return 'Patch26Actions.tutorialAlert()';

  // Dashboard.
  if (h.startsWith("typeof ObraDetalhe !== 'undefined' ? ObraDetalhe.abrir(")) {
    m = h.match(/ObraDetalhe\.abrir\('([^']+)'/);
    return m ? `Patch26Actions.dashboardOpenObra('${m[1]}')` : null;
  }
  m = h.match(/^Dashboard\.copiarLinhaDigitavel\(window\._tempVencItems\[\$\{idx\}\]\?\.codigo_barras\)$/);
  if (m) return "Patch26Actions.dashboardCopyVenc('${idx}')";
  if (/^WhatsApp\.enviarAlertaVencimento\(window\._tempVencItems\[\$\{idx\}\]\)$/.test(h)) return "Patch26Actions.dashboardWhatsAppVenc('${idx}')";
  if (h === "Utils.closeModal();App.navigate('exportar');") return "Patch26Actions.closeModalNavigate('exportar')";

  // OFX.
  if (h === 'OFX._toleranciaValor = this.value') return "Patch26Actions.ofxSetTolerance('valor',this.value)";
  if (h === 'OFX._toleranciaDias = parseInt(this.value)') return "Patch26Actions.ofxSetTolerance('dias',this.value)";
  m = h.match(/^OFX\.viewImport\('\$\{importId\}','(todas|pendentes|conciliadas|ignoradas)',document\.getElementById\('rec-search'\)\?\.value\|\|''\)$/);
  if (m) return `Patch26Actions.ofxViewImport('\${importId}','${m[1]}')`;
  m = h.match(/^if\(this\.value\) OFX\.conciliar\('\$\{j\(importId\)\}','\$\{j\(t\.id\)\}',this\.value\)$/);
  if (m) return "Patch26Actions.ofxConciliarIfValue('${j(importId)}','${j(t.id)}',this.value)";

  // SINAPI.
  if (h.startsWith('Utils.closeModal();OrcamentoSINAPI.showImportModal(')) {
    return "Patch26Actions.sinapiReopenImport(${orc.desonerado},'${Utils.escapeHtml(uf)}','${Utils.escapeHtml(ref)}')";
  }
  if (h === "OrcamentoSINAPI.showAddItem('${this._currentEditor}', OrcamentoSINAPI._lastSearchResults[${i}])") return "Patch26Actions.sinapiAddLastResult('${i}')";
  if (h === "this.style.borderColor='var(--accent)';this.style.background='var(--bg-card)'") return 'Patch26Actions.sinapiFocus(this)';
  if (h.startsWith("this.style.borderColor='transparent';this.style.background='transparent';OrcamentoSINAPI.updateQtd(")) return "Patch26Actions.sinapiBlur(this,'${orcId}','${item.id}')";
  if (h === "event.stopPropagation();document.getElementById('imp-file-input').click()") return "Patch26Actions.clickByIdStop(event,'imp-file-input')";
  if (h === 'OrcamentoSINAPI._onFileChange(this.files[0])') return 'Patch26Actions.sinapiFile(this)';

  // NF-e.
  if (h === "if(event.key==='Enter') NFe.iniciarBusca()") return 'Patch26Actions.nfeSearchOnEnter(event)';
  if (h.includes("NFe._onCertFileDrop(event)")) return 'Patch26Actions.nfeDrop(event,this)';
  if (h.startsWith("NFe._renderPaginaCloud('${chaves[chaves.length-1]}'")) return "Patch26Actions.nfeRenderCloud('${chaves[chaves.length-1]}','nfe-cloud-content')";
  if (h === "NFe.gerarLancamentoDaNFe('${chave}');Utils.closeModal();") return "Patch26Actions.nfeGenerateClose('${chave}')";
  if (h === "NFe.adicionarComoAnexo('${chave}');Utils.closeModal();") return "Patch26Actions.nfeAttachClose('${chave}')";
  if (h.startsWith('(function(){var a=document.createElement')) return "Patch26Actions.nfeDownload('${pdfSrc}','${chave}')";
  if (h === "event.preventDefault(); NFe._confirmarGeracaoLancamento('${chave}');") return "Patch26Actions.nfeSubmit(event,'${chave}')";

  // Master / app shell.
  if (h.startsWith('MasterAdmin.carregarErrosSaaS(true).then(')) return 'Patch26Actions.masterReloadErrors()';
  if (h === "window.location.href='/app/dashboard'") return 'Patch26Actions.goAppDashboard()';
  if (h === "typeof BuscaGlobal !== 'undefined' && BuscaGlobal.abrir()") return 'Patch26Actions.globalSearchOpen()';
  if (h === "App.navigate('${targetRoute}');App.closeSidebar();") return "Patch26Actions.navigateCloseSidebar('${targetRoute}')";
  if (h === 'Utils.closeModal();App.showOnboardingEmpresa()') return 'Patch26Actions.closeModalOnboarding()';
  if (h === 'Utils.closeModal();Configuracoes.showMeuPerfil()') return 'Patch26Actions.closeModalProfile()';
  if (h === "Utils.closeModal();App.navigate('configuracoes')") return 'Patch26Actions.closeModalConfig()';
  if (h === 'Utils.closeModal();Auth.logout()') return 'Patch26Actions.closeModalLogout()';

  // Orçamentos.
  if (h === 'this.nextElementSibling.value=this.value;Orcamentos._recalcModalTotals()') return 'Patch26Actions.orcamentosSyncNext(this)';
  if (h === 'this.previousElementSibling.value=this.value;Orcamentos._recalcModalTotals()') return 'Patch26Actions.orcamentosSyncPrev(this)';
  if (h.includes("const p = parseFloat(document.getElementById('ee-prev').value)") && h.includes("document.getElementById('ee-pct-range').value = auto")) return 'Patch26Actions.orcamentosRealizadoInput(this)';
  if (h === "document.getElementById('ee-pct').value=this.value") return "Patch26Actions.setValueByIdFromSelf('ee-pct',this)";
  if (h === "document.getElementById('ee-pct-range').value=this.value") return "Patch26Actions.setValueByIdFromSelf('ee-pct-range',this)";

  // Lançamentos.
  if (h === "WhatsApp.enviarAlertaVencimento(DB.getById('lancamentos','${l.id}'))") return "Patch26Actions.lancamentoAlertById('${l.id}')";
  if (h === "this.closest('.item-row').remove();Lancamentos._atualizarTotalItens()") return 'Patch26Actions.lancamentoRemoveItem(this)';
  if (h === "Utils.closeModal();Lancamentos.showForm('${l.tipo}','${l.id}')") return "Patch26Actions.lancamentoCloseAndForm('${l.tipo}','${l.id}')";

  // Fases documentais.
  if (h === 'if(event.target===this)FasesDoc.closeModal()') return 'Patch26Actions.fasesBackdropClose(event,this)';
  if (h.includes("FasesDoc._handleDrop(event,'${obraId}','${docId}')")) return "Patch26Actions.fasesDrop(event,this,'${obraId}','${docId}')";
  if (h === "typeof Documentos!=='undefined'&&Documentos.visualizar('${aid}')") return "Patch26Actions.documentosView('${aid}')";
  if (h === "typeof Documentos!=='undefined'&&Documentos.baixar('${aid}')") return "Patch26Actions.documentosDownload('${aid}')";

  // Obras / NFe parser.
  m = h.match(/^typeof ObraDetalhe!=='undefined'\?ObraDetalhe\.abrir\('\$\{c\.id\}'(?:,'([^']+)')?\):null$/);
  if (m) return m[1] ? `Patch26Actions.openObra('\${c.id}','${m[1]}')` : "Patch26Actions.openObra('${c.id}','')";
  if (h === "NFeParser.filtrarLancamentos(this.value,'${chave}',NFe)") return "Patch26Actions.nfeParserFilter(this.value,'${chave}')";
  if (h === "NFeParser.confirmarAnexo('${l.id}','${chave}',NFe)") return "Patch26Actions.nfeParserConfirm('${l.id}','${chave}')";

  // Misc modules.
  if (h === "document.getElementById('input-codigo').value='';document.getElementById('input-codigo').focus();") return "Patch26Actions.resetAndFocusById('input-codigo')";
  if (h === "Utils.closeModal();App.navigate('produtos')") return 'Patch26Actions.notasCloseProducts()';
  if (h === 'event.preventDefault();Parcelamento.salvar();') return 'Patch26Actions.parcelamentoSubmit(event)';
  if (h === "Documentos.abrirModal('medicao', '${m.id}', 'Documentos da ${m.numero_medicao}ª Medição')") return "Patch26Actions.medicaoDocs('${m.id}','${m.numero_medicao}')";
  if (h === 'Notificacoes._alertasTemp[${idx}].acao()') return "Patch26Actions.notificacaoAction('${idx}')";
  if (h === 'BuscaGlobal._itens[${itemIdx}]?.acao()') return "Patch26Actions.buscaAction('${itemIdx}')";
  if (h.startsWith("Assinador.modalGovBr({ nomeDocumento:'Contrato_")) return "Patch26Actions.contratoGovBr('${c.id}')";
  if (h.startsWith("Assinador.modalGovBr({ nomeDocumento:'Recibo_")) return "Patch26Actions.reciboGovBr('${r.id}')";
  if (h === 'Exportar.preview(Exportar._currentPreview)') return 'Patch26Actions.exportarPreview()';
  if (h === 'event.preventDefault(); executarBusca();') return 'Patch26Actions.validarSubmit(event)';

  return null;
}

const files = [];
for (const name of htmlNames) if (fs.existsSync(path.join(root, name))) files.push(name);
for (const name of fs.readdirSync(jsDir)) {
  if (!name.endsWith('.js') || name === 'obra_detalhe.js' || name === 'patch26-actions.js' || name === 'patch26-events.js') continue;
  files.push(`js/${name}`);
}

for (const rel of files) {
  let src = read(rel);
  src = src.replace(eventAttr, (full, eventName, handler) => {
    const safe = normalize(handler);
    if (!safe) return full;
    normalized++;
    return ` on${eventName.toLowerCase()}="${safe}"`;
  });
  write(rel, src);
}

// Load named actions before the generated delegation bridge on all relevant pages.
for (const name of htmlNames) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) continue;
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('/js/patch26-actions.js')) {
    src = src.replace('</body>', '  <script src="/js/patch26-actions.js"></script>\n</body>');
    fs.writeFileSync(file, src);
  }
}

console.log(`[Patch26 prepare] ${normalized} handlers complexos normalizados para ações nomeadas.`);
