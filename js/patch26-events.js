/* FINOBRA_PATCH26_EVENT_BRIDGE — generated at build time; no eval/new Function. */
(() => {
  if (globalThis.__finobraPatch26Bridge) return;
  globalThis.__finobraPatch26Bridge = true;
  const ALLOWED = new Set(["App._onSearchObraInput","App.abrirBuscaObras","App.closeSidebar","App.consultarCnpjOnboarding","App.handleLogoUploadOnboarding","App.navigate","App.removerLogoOnboarding","App.retrySyncIssues","App.sairModoSuporte","App.saveOnboardingEmpresa","App.selecionarObra","App.showSyncIssues","App.showUserMenu","App.toggleSidebar","Assinador.confirmarAssinatura","Assinador.desfazer","Assinador.executarGovBrDownload","Assinador.limpar","Assinador.setCor","Auth.logout","BuscaGlobal._pesquisar","Clientes.del","Clientes.onCepChange","Clientes.onModalidadeChange","Clientes.save","Clientes.showForm","Cobranca.abrirModalPagamentoPix","Cobranca.selecionarPlano","Configuracoes._switch","Configuracoes.buscarCep","Configuracoes.buscarCnpj","Configuracoes.excluirCategoria","Configuracoes.handleLogoUpload","Configuracoes.loadAudit","Configuracoes.loadErrors","Configuracoes.loadSessions","Configuracoes.permissionChanged","Configuracoes.refreshPermissionMatrix","Configuracoes.removerLogo","Configuracoes.revokeOtherSessions","Configuracoes.revokeSession","Configuracoes.saveCategoria","Configuracoes.saveEmpresa","Configuracoes.saveMeuPerfil","Configuracoes.saveUser","Configuracoes.showAuditDetail","Configuracoes.showMeuPerfil","Configuracoes.showUserForm","Configuracoes.toggleAtivo","Contas._onBancoChange","Contas.excluir","Contas.save","Contas.setFiltro","Contas.showForm","Contas.sincronizarComNuvem","Contratos._atualizarClausula","Contratos._confirmDel","Contratos._onModeloSelect","Contratos._onObraChange","Contratos._recalcularValores","Contratos._removerClausula","Contratos.adicionarClausula","Contratos.assinarContrato","Contratos.editarContratoModal","Contratos.enviarWhatsApp","Contratos.imprimirContrato","Contratos.novoContratoModal","Contratos.salvarContratoSubmit","Contratos.visualizarContrato","Dashboard.abrirModalImpressao","Dashboard.imprimirDadosEmLista","Dashboard.imprimirPainelDashboard","Documentos._abrirGooglePicker","Documentos._confirmDel","Documentos._onAddLink","Documentos._onUpload","Documentos._switchTab","Documentos.abrirModal","Documentos.baixar","Documentos.visualizar","Escritorio._onCatChange","Escritorio._onFornecedorChange","Escritorio._recalcLoteTotal","Escritorio._toggleAllLote","Escritorio.abrirModalLote","Escritorio.aplicarFiltros","Escritorio.confirmarPagamento","Escritorio.emitirRecibo","Escritorio.excluir","Escritorio.gerarLote","Escritorio.limparFiltros","Escritorio.marcarPago","Escritorio.salvar","Escritorio.showForm","Escritorio.switchGroup","Exportar.abrirEmNovaAba","Exportar.exportarExcel","Exportar.imprimirRelatorio","Exportar.onObraChange","Exportar.preview","FasesDoc._abrirGooglePicker","FasesDoc._adicionarLinkModal","FasesDoc._handleFileSelect","FasesDoc._removerArqModal","FasesDoc._switchModalTab","FasesDoc._toggleFase","FasesDoc._toggleObra","FasesDoc.closeModal","FasesDoc.collapseAll","FasesDoc.expandAll","FasesDoc.salvarDoc","FasesDoc.showDocModal","Fornecedores._onCnpjInput","Fornecedores._onCpfInput","Fornecedores._onTipoChange","Fornecedores.aplicarFiltros","Fornecedores.consultarCnpj","Fornecedores.excluir","Fornecedores.limparDuplicados","Fornecedores.limparFiltros","Fornecedores.onCepChange","Fornecedores.salvar","Fornecedores.showForm","Fornecedores.toggleAtivo","ImportarExcel.abrirModal","ImportarExcel.aplicarObraGlobal","ImportarExcel.baixarModeloExcel","ImportarExcel.onFileSelect","ImportarExcel.processarGravacao","ImportarExcel.removerLinha","ImportarExcel.toggleRow","ImportarExcel.toggleSelectAll","ImportarExcel.updateCell","ImportarExcel.usarExemploDemo","ImportarExcel.voltarUpload","Lancamentos._addItem","Lancamentos._onContaChange","Lancamentos._onFornecedorChange","Lancamentos._onProdutoInput","Lancamentos._onStatusChange","Lancamentos._recalcItem","Lancamentos._toggleItens","Lancamentos.abrirAnaliseProdutos","Lancamentos.carregarMais","Lancamentos.carregarTodos","Lancamentos.clearFilters","Lancamentos.confirmarBaixa","Lancamentos.del","Lancamentos.emitirRecibo","Lancamentos.marcarBaixa","Lancamentos.save","Lancamentos.setTipo","Lancamentos.showForm","Lancamentos.showParcelamento","Lancamentos.verItens","MasterAdmin._adicionarDiasVencimento","MasterAdmin.abrirModalNovaEmpresa","MasterAdmin.abrirModalPlanos","MasterAdmin.alterarStatusEmpresa","MasterAdmin.baixarDadosNeon","MasterAdmin.confirmarPagamento","MasterAdmin.criarSnapshot","MasterAdmin.exportarBackup","MasterAdmin.impersonarEmpresa","MasterAdmin.importarBackup","MasterAdmin.limparDadosGlobal","MasterAdmin.salvarEdicaoEmpresa","MasterAdmin.salvarNovaEmpresa","MasterAdmin.sincronizarTudoNeon","MasterAdmin.switchTab","Medicoes._confirmLiberar","Medicoes.avancarStatus","Medicoes.del","Medicoes.liberarValor","Medicoes.save","Medicoes.showForm","NFe._cancelarSubstituicao","NFe._carregarMinhasNFes","NFe._onCertFileSelect","NFe._onChaveInput","NFe._removeFromCache","NFe._removerCertificadoA1","NFe._setTab","NFe._sincronizarTudo","NFe._substituirCertificadoA1","NFe._toggleJaPago","NFe.abrirDanfe","NFe.adicionarComoAnexo","NFe.baixarXMLEAbrir","NFe.gerarLancamentoDaNFe","NFe.iniciarBusca","NFe.rebuscarChave","NFe.salvarCertificadoA1","Notas._onStatusChange","Notas.calcLiq","Notas.confirmPendingXmlImport","Notas.confirmarPagamento","Notas.del","Notas.handleXmlFiles","Notas.marcarPaga","Notas.save","Notas.showForm","Notas.triggerXmlImport","Notas.verItens","Notificacoes.abrirPainel","Notificacoes.solicitarPush","OCR._onDrop","OCR._onFileSelected","OCR._onStatusChange","OCR.abrirHistorico","OCR.abrirModal","OCR.confirmarESalvarLancamento","OCR.limparHistorico","OCR.reutilizarHistorico","OFX._abrirModalRobo","OFX._confirmarTodosMatchesRobo","OFX._onContaSel","OFX._onMudarToleranciaModal","OFX.conciliar","OFX.criarLancamento","OFX.deleteImport","OFX.demoOFX","OFX.desconciliar","OFX.ignorar","OFX.processImport","OFX.reativar","OFX.viewImport","OrcamentoSINAPI._calcPreview","OrcamentoSINAPI._onDrop","OrcamentoSINAPI._onSearch","OrcamentoSINAPI._reopenEditor","OrcamentoSINAPI._selectSerie","OrcamentoSINAPI._updateOfficialSnapshotAvailability","OrcamentoSINAPI._useOfficialPreset","OrcamentoSINAPI.addPendingItem","OrcamentoSINAPI.del","OrcamentoSINAPI.executarImport","OrcamentoSINAPI.exportExcel","OrcamentoSINAPI.exportPDF","OrcamentoSINAPI.openEditor","OrcamentoSINAPI.puxarDiretoNoEditor","OrcamentoSINAPI.puxarOficialAutomatico","OrcamentoSINAPI.removeItem","OrcamentoSINAPI.save","OrcamentoSINAPI.showForm","OrcamentoSINAPI.showImportModal","Orcamentos._addItemToCategory","Orcamentos._calcItemRow","Orcamentos._filterByObra","Orcamentos._filterByStatus","Orcamentos._onRealizadoChange","Orcamentos._onSearch","Orcamentos._onSelectAddPadrao","Orcamentos._promptCustomCategory","Orcamentos._recalcModalTotals","Orcamentos._removeCategory","Orcamentos._removeItemRow","Orcamentos._switchTab","Orcamentos._toggleAllCategories","Orcamentos._toggleCategory","Orcamentos.del","Orcamentos.editEtapa","Orcamentos.printOrcamento","Orcamentos.save","Orcamentos.saveEtapa","Orcamentos.showForm","Parcelamento._gerarPreview","Patch26Actions.borderAccent","Patch26Actions.borderDefault","Patch26Actions.borderMasterBlur","Patch26Actions.buscaAction","Patch26Actions.clickById","Patch26Actions.clickByIdStop","Patch26Actions.closeModalConfig","Patch26Actions.closeModalLogout","Patch26Actions.closeModalNavigate","Patch26Actions.closeModalOnboarding","Patch26Actions.closeModalProfile","Patch26Actions.contratoGovBr","Patch26Actions.dashboardCopyVenc","Patch26Actions.dashboardOpenObra","Patch26Actions.dashboardWhatsAppVenc","Patch26Actions.documentosDownload","Patch26Actions.documentosView","Patch26Actions.exportarPreview","Patch26Actions.fasesBackdropClose","Patch26Actions.fasesClickFile","Patch26Actions.fasesDrop","Patch26Actions.globalSearchOpen","Patch26Actions.goAppDashboard","Patch26Actions.lancamentoAlertById","Patch26Actions.lancamentoCloseAndForm","Patch26Actions.lancamentoRemoveItem","Patch26Actions.linkAccent","Patch26Actions.linkUnderline","Patch26Actions.masterReloadErrors","Patch26Actions.medicaoDocs","Patch26Actions.navigateCloseSidebar","Patch26Actions.nfeAttachClose","Patch26Actions.nfeDownload","Patch26Actions.nfeDrop","Patch26Actions.nfeGenerateClose","Patch26Actions.nfeParserConfirm","Patch26Actions.nfeParserFilter","Patch26Actions.nfeRenderCloud","Patch26Actions.nfeSearchOnEnter","Patch26Actions.nfeSubmit","Patch26Actions.notasCloseProducts","Patch26Actions.notificacaoAction","Patch26Actions.ofxConciliarAndReopen","Patch26Actions.ofxConciliarIfValue","Patch26Actions.ofxSetTolerance","Patch26Actions.ofxViewImport","Patch26Actions.openObra","Patch26Actions.orcamentosRealizadoInput","Patch26Actions.orcamentosSyncNext","Patch26Actions.orcamentosSyncPrev","Patch26Actions.parcelamentoSubmit","Patch26Actions.prevent","Patch26Actions.print","Patch26Actions.reciboGovBr","Patch26Actions.removeById","Patch26Actions.resetAndFocusById","Patch26Actions.setValueByIdFromSelf","Patch26Actions.sinapiAddLastResult","Patch26Actions.sinapiBlur","Patch26Actions.sinapiFile","Patch26Actions.sinapiFocus","Patch26Actions.sinapiReopenImport","Patch26Actions.suporteMenu","Patch26Actions.suporteSendOnEnter","Patch26Actions.toggleNextRow","Patch26Actions.toggleParentOpen","Patch26Actions.tutorialAlert","Patch26Actions.validarSubmit","PreCompras._atualizarItem","PreCompras._onFornecedorChange","PreCompras._toggleContaBancariaSelect","PreCompras.abrirAnexosNotaFiscal","PreCompras.abrirModalAprovacao","PreCompras.abrirModalRejeicao","PreCompras.adicionarLinhaItem","PreCompras.aplicarFiltros","PreCompras.confirmarAprovacao","PreCompras.confirmarRejeicao","PreCompras.converterEmLancamentoModal","PreCompras.excluir","PreCompras.executarConversaoLancamento","PreCompras.filtrarPendentes","PreCompras.imprimirOrdem","PreCompras.limparFiltros","PreCompras.removerLinhaItem","PreCompras.salvar","PreCompras.showForm","PreCompras.visualizarOrdem","Produtos._filtrarAnalise","Produtos._refresh","Produtos.carregarMais","Produtos.carregarTodos","Produtos.del","Produtos.save","Produtos.showAnalise","Produtos.showForm","Produtos.verHistorico","Recibos._confirmDel","Recibos._onTipoChange","Recibos._onValorInput","Recibos.assinarRecibo","Recibos.enviarWhatsApp","Recibos.gerarReciboSubmit","Recibos.imprimirRecibo","Recibos.novoReciboModal","Recibos.visualizarRecibo","Suporte.abrirTelaAtendimento","Suporte.chamarAtendente","Suporte.desistirAtendimento","Suporte.encerrarChat","Suporte.enviarMensagem","Suporte.enviarMensagemRapida","Suporte.novaConversa","Suporte.toggleDropdown","SuporteDev.abrirCentral","SuporteDev.abrirConversa","SuporteDev.assumir","SuporteDev.enviar","SuporteDev.fecharCentral","SuporteDev.resolver","SuporteDev.setFilter","Utils.closeModal","WhatsApp.abrirModalConexao","WhatsApp.abrirModalTelefone","WhatsApp.confirmarDesconexao","WhatsApp.enviarResumoDiario","WhatsApp.executarTesteConexao","WhatsApp.fecharModalConexao","WhatsApp.forcarNovoQR","WhatsApp.salvarTelefoneCliente","WhatsApp.testarEnvioCliente","alternarVisibilidadeSenha","closeRecoveryModal","closeRegisterModal","concluirRecuperacao","enviarCodigoRecuperacao","executarLoginMaster","fn","iniciarLoginGoogle","novaConsulta","openRecoveryModal","openRegisterModal","sairMaster","salvarNovaSenha","togglePwd","verificarCodigoOtp"]);
  /* FINOBRA_PATCH26_LEXICAL_ROOTS_HOTFIX */
  const ROOTS = Object.freeze({
    "App": (typeof App !== 'undefined' ? App : globalThis["App"]),
    "Assinador": (typeof Assinador !== 'undefined' ? Assinador : globalThis["Assinador"]),
    "Auth": (typeof Auth !== 'undefined' ? Auth : globalThis["Auth"]),
    "BuscaGlobal": (typeof BuscaGlobal !== 'undefined' ? BuscaGlobal : globalThis["BuscaGlobal"]),
    "Clientes": (typeof Clientes !== 'undefined' ? Clientes : globalThis["Clientes"]),
    "Cobranca": (typeof Cobranca !== 'undefined' ? Cobranca : globalThis["Cobranca"]),
    "Configuracoes": (typeof Configuracoes !== 'undefined' ? Configuracoes : globalThis["Configuracoes"]),
    "Contas": (typeof Contas !== 'undefined' ? Contas : globalThis["Contas"]),
    "Contratos": (typeof Contratos !== 'undefined' ? Contratos : globalThis["Contratos"]),
    "Dashboard": (typeof Dashboard !== 'undefined' ? Dashboard : globalThis["Dashboard"]),
    "Documentos": (typeof Documentos !== 'undefined' ? Documentos : globalThis["Documentos"]),
    "Escritorio": (typeof Escritorio !== 'undefined' ? Escritorio : globalThis["Escritorio"]),
    "Exportar": (typeof Exportar !== 'undefined' ? Exportar : globalThis["Exportar"]),
    "FasesDoc": (typeof FasesDoc !== 'undefined' ? FasesDoc : globalThis["FasesDoc"]),
    "Fornecedores": (typeof Fornecedores !== 'undefined' ? Fornecedores : globalThis["Fornecedores"]),
    "ImportarExcel": (typeof ImportarExcel !== 'undefined' ? ImportarExcel : globalThis["ImportarExcel"]),
    "Lancamentos": (typeof Lancamentos !== 'undefined' ? Lancamentos : globalThis["Lancamentos"]),
    "MasterAdmin": (typeof MasterAdmin !== 'undefined' ? MasterAdmin : globalThis["MasterAdmin"]),
    "Medicoes": (typeof Medicoes !== 'undefined' ? Medicoes : globalThis["Medicoes"]),
    "NFe": (typeof NFe !== 'undefined' ? NFe : globalThis["NFe"]),
    "Notas": (typeof Notas !== 'undefined' ? Notas : globalThis["Notas"]),
    "Notificacoes": (typeof Notificacoes !== 'undefined' ? Notificacoes : globalThis["Notificacoes"]),
    "OCR": (typeof OCR !== 'undefined' ? OCR : globalThis["OCR"]),
    "OFX": (typeof OFX !== 'undefined' ? OFX : globalThis["OFX"]),
    "OrcamentoSINAPI": (typeof OrcamentoSINAPI !== 'undefined' ? OrcamentoSINAPI : globalThis["OrcamentoSINAPI"]),
    "Orcamentos": (typeof Orcamentos !== 'undefined' ? Orcamentos : globalThis["Orcamentos"]),
    "Parcelamento": (typeof Parcelamento !== 'undefined' ? Parcelamento : globalThis["Parcelamento"]),
    "Patch26Actions": (typeof Patch26Actions !== 'undefined' ? Patch26Actions : globalThis["Patch26Actions"]),
    "PreCompras": (typeof PreCompras !== 'undefined' ? PreCompras : globalThis["PreCompras"]),
    "Produtos": (typeof Produtos !== 'undefined' ? Produtos : globalThis["Produtos"]),
    "Recibos": (typeof Recibos !== 'undefined' ? Recibos : globalThis["Recibos"]),
    "Suporte": (typeof Suporte !== 'undefined' ? Suporte : globalThis["Suporte"]),
    "SuporteDev": (typeof SuporteDev !== 'undefined' ? SuporteDev : globalThis["SuporteDev"]),
    "Utils": (typeof Utils !== 'undefined' ? Utils : globalThis["Utils"]),
    "WhatsApp": (typeof WhatsApp !== 'undefined' ? WhatsApp : globalThis["WhatsApp"]),
    "alternarVisibilidadeSenha": (typeof alternarVisibilidadeSenha !== 'undefined' ? alternarVisibilidadeSenha : globalThis["alternarVisibilidadeSenha"]),
    "closeRecoveryModal": (typeof closeRecoveryModal !== 'undefined' ? closeRecoveryModal : globalThis["closeRecoveryModal"]),
    "closeRegisterModal": (typeof closeRegisterModal !== 'undefined' ? closeRegisterModal : globalThis["closeRegisterModal"]),
    "concluirRecuperacao": (typeof concluirRecuperacao !== 'undefined' ? concluirRecuperacao : globalThis["concluirRecuperacao"]),
    "enviarCodigoRecuperacao": (typeof enviarCodigoRecuperacao !== 'undefined' ? enviarCodigoRecuperacao : globalThis["enviarCodigoRecuperacao"]),
    "executarLoginMaster": (typeof executarLoginMaster !== 'undefined' ? executarLoginMaster : globalThis["executarLoginMaster"]),
    "fn": (typeof fn !== 'undefined' ? fn : globalThis["fn"]),
    "iniciarLoginGoogle": (typeof iniciarLoginGoogle !== 'undefined' ? iniciarLoginGoogle : globalThis["iniciarLoginGoogle"]),
    "novaConsulta": (typeof novaConsulta !== 'undefined' ? novaConsulta : globalThis["novaConsulta"]),
    "openRecoveryModal": (typeof openRecoveryModal !== 'undefined' ? openRecoveryModal : globalThis["openRecoveryModal"]),
    "openRegisterModal": (typeof openRegisterModal !== 'undefined' ? openRegisterModal : globalThis["openRegisterModal"]),
    "sairMaster": (typeof sairMaster !== 'undefined' ? sairMaster : globalThis["sairMaster"]),
    "salvarNovaSenha": (typeof salvarNovaSenha !== 'undefined' ? salvarNovaSenha : globalThis["salvarNovaSenha"]),
    "togglePwd": (typeof togglePwd !== 'undefined' ? togglePwd : globalThis["togglePwd"]),
    "verificarCodigoOtp": (typeof verificarCodigoOtp !== 'undefined' ? verificarCodigoOtp : globalThis["verificarCodigoOtp"])
  });
  const EVENTS = ["blur","change","click","drop","focus","input","keydown","mouseout","mouseover","submit"];
  const decode = v => { try { return decodeURIComponent(String(v ?? '')); } catch { return String(v ?? ''); } };
  function auto(v) { const s = decode(v); if (s === 'true') return true; if (s === 'false') return false; if (s === 'null') return null; if (/^-?\d+(?:\.\d+)?$/.test(s)) return Number(s); return s; }
  function arg(el, ev, e, i) {
    const t = el.getAttribute('data-fb-' + e + '-t' + i) || '';
    const v = el.getAttribute('data-fb-' + e + '-v' + i);
    if (t === 'self') return el;
    if (t === 'event') return ev;
    if (t === 'value') return el.value;
    if (t === 'checked') return !!el.checked;
    if (t === 'files') return el.files;
    if (t === 'dataset') return el.dataset[decode(v)];
    if (t === 'float') return parseFloat(el.value) || 0;
    if (t === 'int') return parseInt(el.value, 10) || 0;
    if (t === 'domvalue') return document.getElementById(decode(v))?.value || '';
    if (t === 'bool') return v === 'true';
    if (t === 'null') return null;
    if (t === 'undefined') return undefined;
    if (t === 'number') return Number(v);
    if (t === 'auto') return auto(v);
    if (t === 'string') return decode(v);
    throw new Error('argumento não permitido');
  }
  function resolve(path) {
    if (!ALLOWED.has(path)) throw new Error('ação fora da allowlist');
    const parts = path.split('.');
    let ctx = globalThis;
    let cur = Object.prototype.hasOwnProperty.call(ROOTS, parts[0]) ? ROOTS[parts[0]] : globalThis[parts[0]];
    if (parts.length === 1) {
      if (typeof cur !== 'function') throw new Error('ação indisponível');
      return { fn: cur, ctx };
    }
    for (let i = 1; i < parts.length; i++) { ctx = cur; cur = cur?.[parts[i]]; }
    if (typeof cur !== 'function') throw new Error('ação indisponível');
    return { fn: cur, ctx };
  }
  function bind(e) {
    document.addEventListener(e, ev => {
      const attr = 'data-fb-' + e;
      const el = ev.target?.closest?.('[' + attr + ']');
      if (!el) return;
      try {
        const action = el.getAttribute(attr);
        const { fn, ctx } = resolve(action);
        const n = Number(el.getAttribute(attr + '-n') || 0);
        const args = [];
        for (let i = 0; i < n; i++) args.push(arg(el, ev, e, i));
        const result = fn.apply(ctx, args);
        if (result === false) ev.preventDefault();
      } catch (err) {
        console.error('[Patch26 CSP]', err?.message || err);
        globalThis.Utils?.toast?.('Ação bloqueada por política de segurança.', 'warning');
      }
    }, true);
  }
  EVENTS.forEach(bind);
})();
