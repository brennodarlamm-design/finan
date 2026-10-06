/* FINOBRA_PATCH26_EVENT_BRIDGE — generated at build time; no eval/new Function. */
(() => {
  if (globalThis.__finobraPatch26Bridge) return;
  globalThis.__finobraPatch26Bridge = true;
  const ALLOWED = new Set(["Academia._onSearchInput","Academia.abrir","Academia.fechar","Academia.filtrarTrilha","Academia.onVideoEnded","Academia.praticarNaRota","Academia.restartVideo","Academia.setVideoRate","Academia.toggleConcluido","Academia.toggleVideoFullscreen","Academia.verAula","Academia.voltarLista","AgendaEventos.abrirModal","AgendaEventos.adicionarAoGoogleCalendar","AgendaEventos.excluirEvento","AgendaEventos.salvarNovoEventoSubmit","AgendaEventos.setTab","App._onSearchObraInput","App.abrirBuscaObras","App.closeSidebar","App.consultarCnpjOnboarding","App.fecharAvisoServidor","App.handleLogoUploadOnboarding","App.navigate","App.removerLogoOnboarding","App.retrySyncIssues","App.sairModoSuporte","App.saveOnboardingEmpresa","App.selecionarObra","App.setColorblind","App.setTheme","App.showAccessibilityModal","App.showSyncIssues","App.showUserMenu","App.toggleFavorite","App.toggleNavSection","App.toggleSidebar","App.tentarReconectar","Assinador.confirmarAssinatura","Assinador.desfazer","Assinador.executarGovBrDownload","Assinador.limpar","Assinador.setCor","Assinador.verificarPdfAssinado","Auth.logout","BuscaGlobal._pesquisar","CentralGestor.cobrarWhatsApp","CentralGestor.render","Clientes.del","Clientes.onCepChange","Clientes.onModalidadeChange","Clientes.save","Clientes.showForm","Cobranca.abrirModalPagamentoPix","Cobranca.cancelarAssinatura","Cobranca.goToPlans","Cobranca.openSettingsTab","Cobranca.openSupport","Cobranca.reabrirModalPix","Cobranca.selecionarPlano","Cobranca.setBillingCycle","Cobranca.showLockedModule","Cobranca.switchAccountTab","Configuracoes._addCargo","Configuracoes._removerCargo","Configuracoes._removerTemplate","Configuracoes._salvarCargos","Configuracoes._switch","Configuracoes.buscarCep","Configuracoes.buscarCnpj","Configuracoes.excluirCategoria","Configuracoes.handleLogoUpload","Configuracoes.loadAudit","Configuracoes.loadErrors","Configuracoes.loadSessions","Configuracoes.permissionChanged","Configuracoes.refreshPermissionMatrix","Configuracoes.removerLogo","Configuracoes.restaurarSlasPadrao","Configuracoes.revokeOtherSessions","Configuracoes.revokeSession","Configuracoes.salvarSlasEmpresa","Configuracoes.saveCategoria","Configuracoes.saveEmpresa","Configuracoes.saveMeuPerfil","Configuracoes.saveUser","Configuracoes.showAuditDetail","Configuracoes.showMeuPerfil","Configuracoes.showUserForm","Configuracoes.showUserLimitModal","Configuracoes.toggleAtivo","Contas._onBancoChange","Contas.excluir","Contas.save","Contas.setFiltro","Contas.showForm","Contas.sincronizarComNuvem","Contratos._atualizarClausula","Contratos._confirmDel","Contratos._onModeloSelect","Contratos._onObraChange","Contratos._recalcularValores","Contratos._removerClausula","Contratos.adicionarClausula","Contratos.assinarContrato","Contratos.editarContratoModal","Contratos.enviarWhatsApp","Contratos.imprimirContrato","Contratos.novoContratoModal","Contratos.salvarContratoSubmit","Contratos.visualizarContrato","CronogramaSLA.abrirModalApontamento","CronogramaSLA.abrirModalConfigObra","CronogramaSLA.iniciarEtapaRapido","CronogramaSLA.salvarApontamento","CronogramaSLA.salvarConfigObraSubmit","CronogramaSLA.setModoVisualizacao","Dashboard.abrirModalImpressao","Dashboard.dismissOnboarding","Dashboard.imprimirDadosEmLista","Dashboard.imprimirPainelDashboard","Documentos._abrirGooglePicker","Documentos._confirmDel","Documentos._onAddLink","Documentos._onUpload","Documentos._switchTab","Documentos.abrirModal","Documentos.baixar","Documentos.visualizar","Escritorio._onCatChange","Escritorio._onFornecedorChange","Escritorio._recalcLoteTotal","Escritorio._toggleAllLote","Escritorio.abrirModalLote","Escritorio.aplicarFiltros","Escritorio.confirmarPagamento","Escritorio.emitirRecibo","Escritorio.excluir","Escritorio.gerarLote","Escritorio.limparFiltros","Escritorio.marcarPago","Escritorio.salvar","Escritorio.showForm","Escritorio.switchGroup","Exportar.abrirEmNovaAba","Exportar.exportarExcel","Exportar.imprimirRelatorio","Exportar.onObraChange","Exportar.preview","FasesDoc._abrirGooglePicker","FasesDoc._adicionarLinkModal","FasesDoc._handleFileSelect","FasesDoc._removerArqModal","FasesDoc._switchModalTab","FasesDoc._toggleFase","FasesDoc._toggleObra","FasesDoc.closeModal","FasesDoc.collapseAll","FasesDoc.expandAll","FasesDoc.salvarDoc","FasesDoc.showDocModal","Fornecedores._onCnpjInput","Fornecedores._onCpfInput","Fornecedores._onTipoChange","Fornecedores.aplicarFiltros","Fornecedores.consultarCnpj","Fornecedores.excluir","Fornecedores.limparDuplicados","Fornecedores.limparFiltros","Fornecedores.onCepChange","Fornecedores.salvar","Fornecedores.showForm","Fornecedores.toggleAtivo","ImportarExcel.abrirModal","ImportarExcel.aplicarObraGlobal","ImportarExcel.baixarModeloExcel","ImportarExcel.onFileSelect","ImportarExcel.processarGravacao","ImportarExcel.removerLinha","ImportarExcel.toggleRow","ImportarExcel.toggleSelectAll","ImportarExcel.updateCell","ImportarExcel.usarExemploDemo","ImportarExcel.voltarUpload","Lancamentos._addItem","Lancamentos._onContaChange","Lancamentos._onBaixaContaChange","Lancamentos._onExportModalFilterChange","Lancamentos._onExportModalPeriodoChange","Lancamentos._onFornecedorChange","Lancamentos._onProdutoInput","Lancamentos._onStatusChange","Lancamentos._recalcItem","Lancamentos._toggleItens","Lancamentos.abrirAnaliseProdutos","Lancamentos.abrirModalExportar","Lancamentos.carregarMais","Lancamentos.carregarTodos","Lancamentos.clearFilters","Lancamentos.confirmarBaixa","Lancamentos.del","Lancamentos.emitirRecibo","Lancamentos.exportarModalExcel","Lancamentos.exportarModalNovaAba","Lancamentos.exportarModalPDF","Lancamentos.marcarBaixa","Lancamentos.save","Lancamentos.setTipo","Lancamentos.showForm","Lancamentos.showParcelamento","Lancamentos.verItens","MasterAdmin._adicionarDiasVencimento","MasterAdmin.abrirDetalhesErro","MasterAdmin.abrirEmailModal","MasterAdmin.abrirModalCobranca","MasterAdmin.abrirModalMfa","MasterAdmin.abrirModalNovaEmpresa","MasterAdmin.abrirModalNovoEmail","MasterAdmin.abrirModalPlanos","MasterAdmin.abrirSimuladorWebhookPix","MasterAdmin.abrirWaWebDireto","MasterAdmin.alterarStatusEmpresa","MasterAdmin.alternarModoEditorEmail","MasterAdmin.atualizarPreviaEmail","MasterAdmin.atualizarPreviaPlano","MasterAdmin.atualizarStatusLeadClick","MasterAdmin.baixarDadosNeon","MasterAdmin.buscarSolicitacoesAcesso","MasterAdmin.confirmarPagamento","MasterAdmin.converterLeadClick","MasterAdmin.copiarChaveDev","MasterAdmin.copiarChaveGerada","MasterAdmin.copiarChaveMfa","MasterAdmin.copiarMsgWhatsAppDev","MasterAdmin.copiarNovosBackupCodes","MasterAdmin.copiarTabelaMarkdownDev","MasterAdmin.criarSnapshot","MasterAdmin.enviarEmailSubmit","MasterAdmin.enviarNotificacaoCobranca","MasterAdmin.excluirSolicitacaoAcessoClick","MasterAdmin.executarVarreduraCobranca","MasterAdmin.exportarBackup","MasterAdmin.fecharDetalhesErro","MasterAdmin.fecharEmailModal","MasterAdmin.fecharModalMfa","MasterAdmin.fecharModalNovoEmail","MasterAdmin.filtrarEmailsCanal","MasterAdmin.filtrarEmailsDirecao","MasterAdmin.filtrarSolicitacoesAcesso","MasterAdmin.gerarChaveEmpresa","MasterAdmin.gerarSenhaForte","MasterAdmin.impersonarEmpresa","MasterAdmin.importarBackup","MasterAdmin.limparDadosGlobal","MasterAdmin.limparErrosAntigos","MasterAdmin.mudarTemplateCobranca","MasterAdmin.recarregarContasBancarias","MasterAdmin.recarregarEmails","MasterAdmin.recarregarSolicitacoesAcesso","MasterAdmin.regenerarBackupCodes","MasterAdmin.salvarEdicaoEmpresa","MasterAdmin.salvarNovaEmpresa","MasterAdmin.selecionarPresetEmail","MasterAdmin.simularEmailInboundTeste","MasterAdmin.simularWebhookPix","MasterAdmin.sincronizarTudoNeon","MasterAdmin.switchTab","Medicoes._confirmLiberar","Medicoes.avancarStatus","Medicoes.del","Medicoes.liberarValor","Medicoes.save","Medicoes.showForm","MinhasDemandas.setModoVisualizacao","NFe._cancelarSubstituicao","NFe._carregarMinhasNFes","NFe._onCertFileSelect","NFe._onChaveInput","NFe._removeFromCache","NFe._removerCertificadoA1","NFe._setTab","NFe._sincronizarTudo","NFe._substituirCertificadoA1","NFe._toggleJaPago","NFe.abrirDanfe","NFe.adicionarComoAnexo","NFe.baixarXMLEAbrir","NFe.gerarLancamentoDaNFe","NFe.iniciarBusca","NFe.puxarProdutosDoLancamento","NFe.rebuscarChave","NFe.salvarCertificadoA1","Notas._onStatusChange","Notas.calcLiq","Notas.confirmPendingXmlImport","Notas.confirmarPagamento","Notas.del","Notas.handleXmlFiles","Notas.marcarPaga","Notas.save","Notas.showForm","Notas.triggerXmlImport","Notas.verItens","Notificacoes.abrirPainel","Notificacoes.setTab","Notificacoes.solicitarPush","OCR._onDrop","OCR._onFileSelected","OCR._onStatusChange","OCR.abrirHistorico","OCR.abrirModal","OCR.confirmarESalvarLancamento","OCR.limparHistorico","OCR.reutilizarHistorico","OFX._abrirModalRobo","OFX._confirmarTodosMatchesRobo","OFX._onContaSel","OFX._onMudarToleranciaModal","OFX.conciliar","OFX.criarLancamento","OFX.deleteImport","OFX.demoOFX","OFX.desconciliar","OFX.ignorar","OFX.processImport","OFX.reativar","OFX.viewImport","OrcamentoBancos._changeEstado","OrcamentoBancos._changeRef","OrcamentoBancos._onDesoneradoChange","OrcamentoBancos._onFiltroInput","OrcamentoBancos._toggleBanco","OrcamentoBancos._toggleSomenteMarcados","OrcamentoBancos.abrirModal","OrcamentoBancos.marcarTodos","OrcamentoBancos.salvar","OrcamentoProposta._compartilharWhatsApp","OrcamentoProposta._gerarDocumento","OrcamentoProposta.abrirModal","OrcamentoSINAPI._calcPreview","OrcamentoSINAPI._catPaginaAnterior","OrcamentoSINAPI._catProximaPagina","OrcamentoSINAPI._limparBuscaCat","OrcamentoSINAPI._onCatChangeDes","OrcamentoSINAPI._onCatChangeUF","OrcamentoSINAPI._onCatSearchInput","OrcamentoSINAPI._onCatSetTipo","OrcamentoSINAPI._onDrop","OrcamentoSINAPI._onFilterObra","OrcamentoSINAPI._onFilterStatus","OrcamentoSINAPI._onQuickSearchInput","OrcamentoSINAPI._onQuickSearchKeyDown","OrcamentoSINAPI._onSearch","OrcamentoSINAPI._onSearchLista","OrcamentoSINAPI._reopenEditor","OrcamentoSINAPI._selectSerie","OrcamentoSINAPI._toggleArquivados","OrcamentoSINAPI._toggleComProposta","OrcamentoSINAPI._toggleFiltroComposicoes","OrcamentoSINAPI._toggleFiltroInsumos","OrcamentoSINAPI._toggleMostrarBdi","OrcamentoSINAPI._toggleSelectAll","OrcamentoSINAPI._toggleSelectRow","OrcamentoSINAPI._updateOfficialSnapshotAvailability","OrcamentoSINAPI._useOfficialPreset","OrcamentoSINAPI.abrirCatalogoSINAPI","OrcamentoSINAPI.addPendingItem","OrcamentoSINAPI.ajustarItens","OrcamentoSINAPI.alterarQuantidadeItem","OrcamentoSINAPI.arquivarSelecionados","OrcamentoSINAPI.atualizarParaBaseAtual","OrcamentoSINAPI.confirmarAdicionarItem","OrcamentoSINAPI.copiarCodigo","OrcamentoSINAPI.copiarParaModeloSelecionado","OrcamentoSINAPI.copiarSelecionado","OrcamentoSINAPI.criarOrcamentoComItem","OrcamentoSINAPI.del","OrcamentoSINAPI.editarParametro","OrcamentoSINAPI.exportExcel","OrcamentoSINAPI.exportPDF","OrcamentoSINAPI.filtroGrid","OrcamentoSINAPI.focarBusca","OrcamentoSINAPI.incluirEtapa","OrcamentoSINAPI.infoAjuda","OrcamentoSINAPI.inserirItemRapido","OrcamentoSINAPI.legendaBdi","OrcamentoSINAPI.menuFerramentas","OrcamentoSINAPI.openEditor","OrcamentoSINAPI.promptAdicionarItem","OrcamentoSINAPI.puxarDiretoNoEditor","OrcamentoSINAPI.puxarOficialAutomatico","OrcamentoSINAPI.recalcularOrcamento","OrcamentoSINAPI.removeItem","OrcamentoSINAPI.removerItemDoEditor","OrcamentoSINAPI.removerItensVazios","OrcamentoSINAPI.removerSelecionados","OrcamentoSINAPI.renomearRapido","OrcamentoSINAPI.save","OrcamentoSINAPI.showForm","OrcamentoSINAPI.showImportModal","OrcamentoSINAPI.toggleAnalitico","OrcamentoTemplates._executarCopiaParaModelo","OrcamentoTemplates._executarInstanciacao","OrcamentoTemplates._onBuscaInput","OrcamentoTemplates._onCategoriaChange","OrcamentoTemplates._promptCriarDoSelecionado","OrcamentoTemplates._removerSelecionado","OrcamentoTemplates._selecionarLinha","OrcamentoTemplates.abrirModalCatalogo","OrcamentoTemplates.instanciarParaObra","OrcamentoTemplates.visualizarTemplate","Orcamentos._addItemToCategory","Orcamentos._addLinkAttachment","Orcamentos._calcItemRow","Orcamentos._filterByObra","Orcamentos._filterByStatus","Orcamentos._onCatFornecedorChange","Orcamentos._onFileSelect","Orcamentos._onRealizadoChange","Orcamentos._onSearch","Orcamentos._onSelectAddPadrao","Orcamentos._promptCustomCategory","Orcamentos._recalcModalTotals","Orcamentos._removeAttachment","Orcamentos._removeCategory","Orcamentos._removeItemRow","Orcamentos._switchTab","Orcamentos._toggleAllCategories","Orcamentos._toggleCategory","Orcamentos._toggleSelectAllDespesas","Orcamentos.abrirModalGerarDespesa","Orcamentos.aprovar","Orcamentos.cancelar","Orcamentos.colocarEmRevisao","Orcamentos.confirmarGerarDespesaSubmit","Orcamentos.del","Orcamentos.editEtapa","Orcamentos.printOrcamento","Orcamentos.save","Orcamentos.saveEtapa","Orcamentos.showForm","Parcelamento._gerarPreview","Patch26Actions.borderAccent","Patch26Actions.borderDefault","Patch26Actions.borderMasterBlur","Patch26Actions.buscaAction","Patch26Actions.clickById","Patch26Actions.clickByIdStop","Patch26Actions.closeModalConfig","Patch26Actions.closeModalLogout","Patch26Actions.closeModalNavigate","Patch26Actions.closeModalOnboarding","Patch26Actions.closeModalProfile","Patch26Actions.contratoGovBr","Patch26Actions.dashboardCopyVenc","Patch26Actions.dashboardOpenObra","Patch26Actions.dashboardWhatsAppVenc","Patch26Actions.documentosDownload","Patch26Actions.documentosView","Patch26Actions.exportarPreview","Patch26Actions.fasesBackdropClose","Patch26Actions.fasesClickFile","Patch26Actions.fasesDrop","Patch26Actions.globalSearchOpen","Patch26Actions.goAppDashboard","Patch26Actions.lancamentoAlertById","Patch26Actions.lancamentoCloseAndForm","Patch26Actions.lancamentoRemoveItem","Patch26Actions.linkAccent","Patch26Actions.linkUnderline","Patch26Actions.masterReloadErrors","Patch26Actions.medicaoDocs","Patch26Actions.navigateCloseSidebar","Patch26Actions.nfeAttachClose","Patch26Actions.nfeDownload","Patch26Actions.nfeDrop","Patch26Actions.nfeGenerateClose","Patch26Actions.nfeParserConfirm","Patch26Actions.nfeParserFilter","Patch26Actions.nfeRenderCloud","Patch26Actions.nfeSearchOnEnter","Patch26Actions.nfeSubmit","Patch26Actions.notasCloseProducts","Patch26Actions.notificacaoAction","Patch26Actions.ofxConciliarAndReopen","Patch26Actions.ofxConciliarIfValue","Patch26Actions.ofxSetTolerance","Patch26Actions.ofxViewImport","Patch26Actions.openObra","Patch26Actions.orcamentosRealizadoInput","Patch26Actions.orcamentosSyncNext","Patch26Actions.orcamentosSyncPrev","Patch26Actions.parcelamentoSubmit","Patch26Actions.prevent","Patch26Actions.print","Patch26Actions.reciboGovBr","Patch26Actions.removeById","Patch26Actions.resetAndFocusById","Patch26Actions.setValueByIdFromSelf","Patch26Actions.sinapiAddLastResult","Patch26Actions.sinapiBlur","Patch26Actions.sinapiFile","Patch26Actions.sinapiFocus","Patch26Actions.sinapiReopenImport","Patch26Actions.suporteMenu","Patch26Actions.suporteSendOnEnter","Patch26Actions.toggleNextRow","Patch26Actions.toggleParentOpen","Patch26Actions.tutorialAlert","Patch26Actions.validarSubmit","PortalCliente.abrirModalCompartilhar","PortalCliente.abrirModalExplicativo","PortalCliente.abrirPortalInterno","PortalCliente.abrirVisualizacaoCliente","PortalCliente.assinarDocumentoCliente","PortalCliente.copiarLink","PortalCliente.copiarLinkDireto","PortalCliente.enviarWhatsAppLink","PortalCliente.setTab","PreCompras._atualizarItem","PreCompras._onFornecedorChange","PreCompras._toggleContaBancariaSelect","PreCompras.abrirAnexosNotaFiscal","PreCompras.abrirModalAprovacao","PreCompras.abrirModalRejeicao","PreCompras.adicionarLinhaItem","PreCompras.aplicarFiltros","PreCompras.confirmarAprovacao","PreCompras.confirmarRejeicao","PreCompras.converterEmLancamentoModal","PreCompras.excluir","PreCompras.executarConversaoLancamento","PreCompras.filtrarPendentes","PreCompras.imprimirOrdem","PreCompras.limparFiltros","PreCompras.removerLinhaItem","PreCompras.salvar","PreCompras.showForm","PreCompras.visualizarOrdem","Produtos._filtrarAnalise","Produtos._refresh","Produtos.carregarMais","Produtos.carregarTodos","Produtos.del","Produtos.save","Produtos.showAnalise","Produtos.showForm","Produtos.verHistorico","Recibos._confirmDel","Recibos._onTipoChange","Recibos._onValorInput","Recibos.assinarRecibo","Recibos.enviarWhatsApp","Recibos.gerarReciboSubmit","Recibos.imprimirRecibo","Recibos.novoReciboModal","Recibos.visualizarRecibo","Suporte.abrirTelaAtendimento","Suporte.chamarAtendente","Suporte.desistirAtendimento","Suporte.encerrarChat","Suporte.enviarMensagem","Suporte.enviarMensagemRapida","Suporte.novaConversa","Suporte.toggleDropdown","SuporteDev.abrirCentral","SuporteDev.abrirConversa","SuporteDev.assumir","SuporteDev.enviar","SuporteDev.fecharCentral","SuporteDev.resolver","SuporteDev.setFilter","Utils.closeModal","WhatsApp.abrirModalConexao","WhatsApp.abrirModalNotificacaoEtapa","WhatsApp.abrirModalTelefone","WhatsApp.confirmarDesconexao","WhatsApp.enviarNotificacaoEtapaSubmit","WhatsApp.enviarResumoDiario","WhatsApp.enviarResumoWorkflowObra","WhatsApp.executarTesteConexao","WhatsApp.fecharModalConexao","WhatsApp.forcarNovoQR","WhatsApp.salvarTelefoneCliente","WhatsApp.testarEnvioCliente","alternarModoBackupMfa","alternarVisibilidadeSenha","closeRecoveryModal","closeRegisterModal","concluirRecuperacao","enviarCodigoRecuperacao","executarAtivacaoMfa","executarLoginMaster","executarVerificacaoMfa","fn","iniciarLoginGoogle","novaConsulta","openRecoveryModal","openRegisterModal","sairMaster","salvarNovaSenha","togglePwd","verificarCodigoOtp","voltarEtapaLoginMaster"]);
  /* FINOBRA_PATCH26_LEXICAL_ROOTS_HOTFIX */
  const ROOTS = Object.freeze({
    "Academia": (typeof Academia !== 'undefined' ? Academia : globalThis["Academia"]),
    "AgendaEventos": (typeof AgendaEventos !== 'undefined' ? AgendaEventos : globalThis["AgendaEventos"]),
    "App": (typeof App !== 'undefined' ? App : globalThis["App"]),
    "Assinador": (typeof Assinador !== 'undefined' ? Assinador : globalThis["Assinador"]),
    "Auth": (typeof Auth !== 'undefined' ? Auth : globalThis["Auth"]),
    "BuscaGlobal": (typeof BuscaGlobal !== 'undefined' ? BuscaGlobal : globalThis["BuscaGlobal"]),
    "CentralGestor": (typeof CentralGestor !== 'undefined' ? CentralGestor : globalThis["CentralGestor"]),
    "Clientes": (typeof Clientes !== 'undefined' ? Clientes : globalThis["Clientes"]),
    "Cobranca": (typeof Cobranca !== 'undefined' ? Cobranca : globalThis["Cobranca"]),
    "Configuracoes": (typeof Configuracoes !== 'undefined' ? Configuracoes : globalThis["Configuracoes"]),
    "Contas": (typeof Contas !== 'undefined' ? Contas : globalThis["Contas"]),
    "Contratos": (typeof Contratos !== 'undefined' ? Contratos : globalThis["Contratos"]),
    "CronogramaSLA": (typeof CronogramaSLA !== 'undefined' ? CronogramaSLA : globalThis["CronogramaSLA"]),
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
    "MinhasDemandas": (typeof MinhasDemandas !== 'undefined' ? MinhasDemandas : globalThis["MinhasDemandas"]),
    "NFe": (typeof NFe !== 'undefined' ? NFe : globalThis["NFe"]),
    "Notas": (typeof Notas !== 'undefined' ? Notas : globalThis["Notas"]),
    "Notificacoes": (typeof Notificacoes !== 'undefined' ? Notificacoes : globalThis["Notificacoes"]),
    "OCR": (typeof OCR !== 'undefined' ? OCR : globalThis["OCR"]),
    get OFX() { return (typeof OFX !== 'undefined' ? OFX : globalThis["OFX"]); },
    get OrcamentoBancos() { return (typeof OrcamentoBancos !== 'undefined' ? OrcamentoBancos : globalThis["OrcamentoBancos"]); },
    get OrcamentoTemplates() { return (typeof OrcamentoTemplates !== 'undefined' ? OrcamentoTemplates : globalThis["OrcamentoTemplates"]); },
    get OrcamentoProposta() { return (typeof OrcamentoProposta !== 'undefined' ? OrcamentoProposta : globalThis["OrcamentoProposta"]); },
    get OrcamentoSINAPI() { return (typeof OrcamentoSINAPI !== 'undefined' ? OrcamentoSINAPI : globalThis["OrcamentoSINAPI"]); },
    "Orcamentos": (typeof Orcamentos !== 'undefined' ? Orcamentos : globalThis["Orcamentos"]),
    "Parcelamento": (typeof Parcelamento !== 'undefined' ? Parcelamento : globalThis["Parcelamento"]),
    "Patch26Actions": (typeof Patch26Actions !== 'undefined' ? Patch26Actions : globalThis["Patch26Actions"]),
    "Produtos": (typeof Produtos !== 'undefined' ? Produtos : globalThis["Produtos"]),
    "PreCompras": (typeof PreCompras !== 'undefined' ? PreCompras : globalThis["PreCompras"]),
    "Recibos": (typeof Recibos !== 'undefined' ? Recibos : globalThis["Recibos"]),
    "Suporte": (typeof Suporte !== 'undefined' ? Suporte : globalThis["Suporte"]),
    "SuporteDev": (typeof SuporteDev !== 'undefined' ? SuporteDev : globalThis["SuporteDev"]),
    "Utils": (typeof Utils !== 'undefined' ? Utils : globalThis["Utils"]),
    "WhatsApp": (typeof WhatsApp !== 'undefined' ? WhatsApp : globalThis["WhatsApp"]),
    "alternarModoBackupMfa": (typeof alternarModoBackupMfa !== 'undefined' ? alternarModoBackupMfa : globalThis["alternarModoBackupMfa"]),
    "alternarVisibilidadeSenha": (typeof alternarVisibilidadeSenha !== 'undefined' ? alternarVisibilidadeSenha : globalThis["alternarVisibilidadeSenha"]),
    "closeRecoveryModal": (typeof closeRecoveryModal !== 'undefined' ? closeRecoveryModal : globalThis["closeRecoveryModal"]),
    "closeRegisterModal": (typeof closeRegisterModal !== 'undefined' ? closeRegisterModal : globalThis["closeRegisterModal"]),
    "concluirRecuperacao": (typeof concluirRecuperacao !== 'undefined' ? concluirRecuperacao : globalThis["concluirRecuperacao"]),
    "enviarCodigoRecuperacao": (typeof enviarCodigoRecuperacao !== 'undefined' ? enviarCodigoRecuperacao : globalThis["enviarCodigoRecuperacao"]),
    "executarAtivacaoMfa": (typeof executarAtivacaoMfa !== 'undefined' ? executarAtivacaoMfa : globalThis["executarAtivacaoMfa"]),
    "executarLoginMaster": (typeof executarLoginMaster !== 'undefined' ? executarLoginMaster : globalThis["executarLoginMaster"]),
    "executarVerificacaoMfa": (typeof executarVerificacaoMfa !== 'undefined' ? executarVerificacaoMfa : globalThis["executarVerificacaoMfa"]),
    "fn": (typeof fn !== 'undefined' ? fn : globalThis["fn"]),
    "iniciarLoginGoogle": (typeof iniciarLoginGoogle !== 'undefined' ? iniciarLoginGoogle : globalThis["iniciarLoginGoogle"]),
    "novaConsulta": (typeof novaConsulta !== 'undefined' ? novaConsulta : globalThis["novaConsulta"]),
    "openRecoveryModal": (typeof openRecoveryModal !== 'undefined' ? openRecoveryModal : globalThis["openRecoveryModal"]),
    "openRegisterModal": (typeof openRegisterModal !== 'undefined' ? openRegisterModal : globalThis["openRegisterModal"]),
    "sairMaster": (typeof sairMaster !== 'undefined' ? sairMaster : globalThis["sairMaster"]),
    "salvarNovaSenha": (typeof salvarNovaSenha !== 'undefined' ? salvarNovaSenha : globalThis["salvarNovaSenha"]),
    "togglePwd": (typeof togglePwd !== 'undefined' ? togglePwd : globalThis["togglePwd"]),
    "verificarCodigoOtp": (typeof verificarCodigoOtp !== 'undefined' ? verificarCodigoOtp : globalThis["verificarCodigoOtp"]),
    "voltarEtapaLoginMaster": (typeof voltarEtapaLoginMaster !== 'undefined' ? voltarEtapaLoginMaster : globalThis["voltarEtapaLoginMaster"])
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
  /* AUDIT-2026-10-02 X3: o portal público é aberto por link montado por qualquer pessoa,
     dentro do app completo (com a sessão de quem abre). Ali só as ações do próprio portal. */
  const PUBLIC_PORTAL_PREFIXES = ['PortalCliente.', 'Utils.closeModal'];
  function resolve(path) {
    if (!ALLOWED.has(path)) throw new Error('ação fora da allowlist');
    if (document.body?.classList?.contains('portal-public-mode') && !PUBLIC_PORTAL_PREFIXES.some(p => path === p || path.startsWith(p))) {
      throw new Error('ação indisponível no portal público');
    }
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
  // AUDITORIA 2026-10-04 #11: eventos passivos (passar o mouse, foco, sair do campo) só podem chamar
  // ações sem efeito colateral. Antes, um HTML injetado com data-fb-mouseover disparava qualquer
  // ação da lista (ex.: logout, revogar sessões) só com o movimento do mouse.
  const PASSIVE_EVENTS = new Set(['mouseover', 'mouseout', 'focus', 'blur']);
  const PASSIVE_ACTIONS = new Set([
    'Patch26Actions.borderAccent', 'Patch26Actions.borderDefault', 'Patch26Actions.borderMasterBlur',
    'Patch26Actions.linkAccent', 'Patch26Actions.linkUnderline',
    'Clientes.onCepChange', 'Configuracoes.buscarCep', 'Fornecedores.onCepChange'
  ]);
  function bind(e) {
    document.addEventListener(e, ev => {
      const attr = 'data-fb-' + e;
      const el = ev.target?.closest?.('[' + attr + ']');
      if (!el) return;
      try {
        const action = el.getAttribute(attr);
        if (PASSIVE_EVENTS.has(e) && !PASSIVE_ACTIONS.has(action)) throw new Error('ação não permitida neste evento');
        const { fn, ctx } = resolve(action);
        const n = Number(el.getAttribute(attr + '-n') || 0);
        const args = [];
        for (let i = 0; i < n; i++) args.push(arg(el, ev, e, i));
        const result = fn.apply(ctx, args);
        if (result === false) ev.preventDefault();
      } catch (err) {
        console.error('[Patch26 CSP]', err?.message || err);
        ROOTS.Utils?.toast?.('Não foi possível executar esta ação. Tente novamente.', 'warning');
      }
    }, true);
  }
  EVENTS.forEach(bind);
  /* Arrastar arquivos: ondragover/ondragleave inline são bloqueados pelo CSP
     (script-src-attr 'none') e, sem preventDefault no dragover, o navegador
     nunca dispara o drop (abre o arquivo na aba). Vale para todo [data-fb-drop]. */
  const dropZone = ev => ev.target?.closest?.('[data-fb-drop]');
  document.addEventListener('dragover', ev => {
    const el = dropZone(ev);
    if (!el) return;
    ev.preventDefault();
    el.classList.add('drag-over');
  }, true);
  document.addEventListener('dragleave', ev => {
    const el = dropZone(ev);
    if (el && !el.contains(ev.relatedTarget)) el.classList.remove('drag-over');
  }, true);
  document.addEventListener('drop', ev => {
    const el = dropZone(ev);
    if (!el) return;
    ev.preventDefault();
    el.classList.remove('drag-over');
  }, true);

  /* VARREDURA 2026-10-03 #37: acessibilidade para o HTML gerado pelos módulos.
     • botão só com "✕" ganha aria-label "Fechar"; botão só com ícone usa o title como nome;
     • campo dentro de .form-group fica ligado ao rótulo (for/id) — antes 85% a 100% dos campos
       não tinham rótulo associado; sem rótulo, usa o placeholder/title como aria-label. */
  const SO_FECHAR = /^[\s✕×✖]+$/;
  const TEM_TEXTO = /[0-9A-Za-zÀ-ÿ]/;
  let a11ySeq = 0;
  function nomearBotao(b) {
    if (b.hasAttribute('aria-label') || b.hasAttribute('aria-labelledby')) return;
    const txt = b.textContent || '';
    if (SO_FECHAR.test(txt) && txt.trim()) { b.setAttribute('aria-label', b.getAttribute('title') || 'Fechar'); return; }
    if (!TEM_TEXTO.test(txt) && b.getAttribute('title')) b.setAttribute('aria-label', b.getAttribute('title'));
  }
  function rotularCampo(field) {
    if (field.type === 'hidden' || field.hasAttribute('aria-label') || field.hasAttribute('aria-labelledby')) return;
    if (field.labels && field.labels.length) return;
    let texto = '';
    const grupo = field.closest('.form-group, .form-field');
    if (grupo) {
      const campos = grupo.querySelectorAll('input:not([type=hidden]), select, textarea');
      const rotulo = grupo.querySelector('label, .form-label');
      if (rotulo && campos.length === 1) {
        if (rotulo.tagName === 'LABEL' && !rotulo.htmlFor) {
          if (!field.id) field.id = 'fb-campo-' + (++a11ySeq);
          rotulo.htmlFor = field.id;
          return;
        }
        texto = rotulo.textContent;
      }
    }
    texto = (texto || field.getAttribute('placeholder') || field.getAttribute('title') || '').replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').trim();
    if (texto) field.setAttribute('aria-label', texto.slice(0, 120));
  }
  function aplicarA11y(raiz) {
    if (!raiz || !raiz.querySelectorAll) return;
    if (raiz.matches?.('button')) nomearBotao(raiz);
    raiz.querySelectorAll('button').forEach(nomearBotao);
    if (raiz.matches?.('input, select, textarea')) rotularCampo(raiz);
    raiz.querySelectorAll('input, select, textarea').forEach(rotularCampo);
  }
  const pendentes = new Set();
  let agendado = false;
  function processarPendentes() {
    agendado = false;
    pendentes.forEach(n => { if (n.isConnected) aplicarA11y(n); });
    pendentes.clear();
  }
  function iniciarA11y() {
    if (!document.body || typeof MutationObserver === 'undefined') return;
    aplicarA11y(document.body);
    new MutationObserver(lista => {
      for (const m of lista) m.addedNodes.forEach(n => { if (n.nodeType === 1) pendentes.add(n); });
      if (pendentes.size && !agendado) {
        agendado = true;
        (window.requestAnimationFrame || setTimeout)(processarPendentes);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarA11y, { once: true });
  else iniciarA11y();
})();
