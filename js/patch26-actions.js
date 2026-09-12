/* FinObra Patch 26 — explicit CSP-safe actions for legacy complex handlers.
 * No eval/new Function. Every operation below is source-controlled and named.
 */
const Patch26Actions = {
  prevent(ev) { ev?.preventDefault?.(); },
  print() { window.print(); },
  clickById(id) { document.getElementById(String(id || ''))?.click(); },
  clickByIdStop(ev, id) { ev?.stopPropagation?.(); this.clickById(id); },
  removeById(id) { document.getElementById(String(id || ''))?.remove(); },
  resetAndFocusById(id) {
    const el = document.getElementById(String(id || ''));
    if (!el) return;
    el.value = '';
    el.focus();
  },
  goAppDashboard() { window.location.href = '/app/dashboard'; },
  borderAccent(el) { if (el?.style) el.style.borderColor = 'var(--accent)'; },
  borderDefault(el) { if (el?.style) el.style.borderColor = 'var(--border)'; },
  borderMasterFocus(el) { if (el?.style) el.style.borderColor = 'var(--accent)'; },
  borderMasterBlur(el) { if (el?.style) el.style.borderColor = 'rgba(255,255,255,.18)'; },
  linkUnderline(el, enabled) { if (el?.style) el.style.textDecoration = enabled ? 'underline' : 'none'; },
  linkAccent(el, enabled) { if (el?.style) el.style.color = enabled ? 'var(--accent2)' : 'var(--text3)'; },
  toggleParentOpen(el) { el?.parentElement?.classList?.toggle('open'); },
  toggleNextRow(el) {
    const row = el?.nextElementSibling;
    if (!row?.style) return;
    row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
  },

  suporteMenu(kind) {
    const map = {
      atendimento: 'abrirTelaAtendimento',
      manual: 'abrirManual',
      tutoriais: 'abrirTutoriais',
      agendamento: 'abrirAgendamento',
      contatos: 'abrirContatos',
      treinamentos: 'abrirTreinamentos'
    };
    const method = map[String(kind || '')];
    if (method && typeof Suporte?.[method] === 'function') Suporte[method]();
    Suporte?.fecharDropdown?.();
  },
  suporteSendOnEnter(ev) {
    if (ev?.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      Suporte?.enviarMensagem?.();
    }
  },
  tutorialAlert() { alert('Assistir tutorial: Redirecionando para o canal oficial...'); },

  dashboardOpenObra(obraId) {
    if (typeof ObraDetalhe !== 'undefined') ObraDetalhe.abrir(obraId, 'orcado-realizado');
    else App?.navigate?.('orcamentos');
  },
  dashboardCopyVenc(idx) {
    Dashboard?.copiarLinhaDigitavel?.(window._tempVencItems?.[Number(idx)]?.codigo_barras);
  },
  dashboardWhatsAppVenc(idx) {
    const item = window._tempVencItems?.[Number(idx)];
    if (item) WhatsApp?.enviarAlertaVencimento?.(item);
  },
  closeModalNavigate(route) { Utils?.closeModal?.(); App?.navigate?.(route); },

  ofxSetTolerance(kind, value) {
    if (kind === 'valor') OFX._toleranciaValor = value;
    if (kind === 'dias') OFX._toleranciaDias = parseInt(value, 10) || 0;
  },
  ofxConciliarIfValue(importId, txId, value) {
    if (value) OFX?.conciliar?.(importId, txId, value);
  },

  sinapiReopenImport(desonerado, uf, ref) {
    Utils?.closeModal?.();
    OrcamentoSINAPI?.showImportModal?.(desonerado, uf, ref);
  },
  sinapiAddLastResult(index) {
    const item = OrcamentoSINAPI?._lastSearchResults?.[Number(index)];
    if (item) OrcamentoSINAPI?.showAddItem?.(OrcamentoSINAPI._currentEditor, item);
  },
  sinapiFocus(el) {
    if (!el?.style) return;
    el.style.borderColor = 'var(--accent)';
    el.style.background = 'var(--bg-card)';
  },
  sinapiBlur(el, orcId, itemId) {
    if (el?.style) {
      el.style.borderColor = 'transparent';
      el.style.background = 'transparent';
    }
    OrcamentoSINAPI?.updateQtd?.(orcId, itemId, el?.value);
  },
  sinapiFile(el) { OrcamentoSINAPI?._onFileChange?.(el?.files?.[0]); },

  nfeSearchOnEnter(ev) { if (ev?.key === 'Enter') NFe?.iniciarBusca?.(); },
  nfeDrop(ev, el) {
    ev?.preventDefault?.();
    if (el?.style) {
      el.style.borderColor = 'var(--border)';
      el.style.background = 'var(--bg-secondary)';
    }
    NFe?._onCertFileDrop?.(ev);
  },
  nfeRenderCloud(chave, targetId) {
    const target = document.getElementById(targetId);
    if (target) NFe?._renderPaginaCloud?.(chave, target);
  },
  nfeGenerateClose(chave) { NFe?.gerarLancamentoDaNFe?.(chave); Utils?.closeModal?.(); },
  nfeAttachClose(chave) { NFe?.adicionarComoAnexo?.(chave); Utils?.closeModal?.(); },
  nfeDownload(pdfSrc, chave) {
    const a = document.createElement('a');
    a.href = String(pdfSrc || '');
    a.download = `DANFE_${String(chave || '')}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
  nfeSubmit(ev, chave) { ev?.preventDefault?.(); NFe?._confirmarGeracaoLancamento?.(chave); },

  masterReloadErrors() {
    Promise.resolve(MasterAdmin?.carregarErrosSaaS?.(true))
      .then(() => MasterAdmin?.render?.('master-content-area'))
      .catch(err => console.error('[Patch26] Falha ao recarregar erros SaaS:', err));
  },

  orcamentosSyncNext(el) {
    if (el?.nextElementSibling) el.nextElementSibling.value = el.value;
    Orcamentos?._recalcModalTotals?.();
  },
  orcamentosSyncPrev(el) {
    if (el?.previousElementSibling) el.previousElementSibling.value = el.value;
    Orcamentos?._recalcModalTotals?.();
  },
  orcamentosRealizadoInput(el) {
    const p = parseFloat(document.getElementById('ee-prev')?.value) || 0;
    const r = parseFloat(el?.value) || 0;
    if (p <= 0) return;
    const auto = Math.min(100, Math.round((r / p) * 100));
    const pct = document.getElementById('ee-pct');
    const range = document.getElementById('ee-pct-range');
    if (pct) pct.value = auto;
    if (range) range.value = auto;
  },
  setValueByIdFromSelf(id, el) {
    const target = document.getElementById(String(id || ''));
    if (target) target.value = el?.value ?? '';
  },

  globalSearchOpen() { if (typeof BuscaGlobal !== 'undefined') BuscaGlobal.abrir(); },
  navigateCloseSidebar(route) { App?.navigate?.(route); App?.closeSidebar?.(); },
  closeModalOnboarding() { Utils?.closeModal?.(); App?.showOnboardingEmpresa?.(); },
  closeModalProfile() { Utils?.closeModal?.(); Configuracoes?.showMeuPerfil?.(); },
  closeModalConfig() { Utils?.closeModal?.(); App?.navigate?.('configuracoes'); },
  closeModalLogout() { Utils?.closeModal?.(); Auth?.logout?.(); },

  lancamentoAlertById(id) {
    const item = DB?.getById?.('lancamentos', id);
    if (item) WhatsApp?.enviarAlertaVencimento?.(item);
  },
  lancamentoRemoveItem(el) { el?.closest?.('.item-row')?.remove(); Lancamentos?._atualizarTotalItens?.(); },
  lancamentoCloseAndForm(tipo, id) { Utils?.closeModal?.(); Lancamentos?.showForm?.(tipo, id); },

  fasesBackdropClose(ev, el) { if (ev?.target === el) FasesDoc?.closeModal?.(); },
  fasesDrop(ev, el, obraId, docId) {
    ev?.preventDefault?.();
    el?.classList?.remove('drag-over');
    FasesDoc?._handleDrop?.(ev, obraId, docId);
  },
  documentosView(id) { if (typeof Documentos !== 'undefined') Documentos.visualizar(id); },
  documentosDownload(id) { if (typeof Documentos !== 'undefined') Documentos.baixar(id); },

  openObra(id, tab) {
    if (typeof ObraDetalhe !== 'undefined') ObraDetalhe.abrir(id, tab || undefined);
  },
  nfeParserFilter(value, chave) { NFeParser?.filtrarLancamentos?.(value, chave, NFe); },
  nfeParserConfirm(id, chave) { NFeParser?.confirmarAnexo?.(id, chave, NFe); },

  notasCloseProducts() { Utils?.closeModal?.(); App?.navigate?.('produtos'); },
  productsCloseProducts() { Utils?.closeModal?.(); App?.navigate?.('produtos'); },
  parcelamentoSubmit(ev) { ev?.preventDefault?.(); Parcelamento?.salvar?.(); },
  medicaoDocs(id, numero) { Documentos?.abrirModal?.('medicao', id, `Documentos da ${numero}ª Medição`); },
  notificacaoAction(idx) { Notificacoes?._alertasTemp?.[Number(idx)]?.acao?.(); },
  buscaAction(idx) { BuscaGlobal?._itens?.[Number(idx)]?.acao?.(); },
  exportarPreview() { Exportar?.preview?.(Exportar._currentPreview); },
  validarSubmit(ev) { ev?.preventDefault?.(); globalThis.executarBusca?.(); },

  contratoGovBr(id) {
    const c = DB?.getById?.('contratos', id);
    if (!c) return;
    Assinador?.modalGovBr?.({
      nomeDocumento: `Contrato_${String(c.numero || '').replace('/', '-')}`,
      onBaixarPDF: () => Contratos?.imprimirContrato?.(id)
    });
  },
  reciboGovBr(id) {
    const r = DB?.getById?.('recibos', id);
    if (!r) return;
    Assinador?.modalGovBr?.({
      nomeDocumento: `Recibo_${String(r.numero || '').replace('/', '-')}`,
      onBaixarPDF: () => Recibos?.imprimirRecibo?.(id)
    });
  }
};

globalThis.Patch26Actions = Patch26Actions;
