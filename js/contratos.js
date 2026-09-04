// js/contratos.js — Módulo Completo Premium de Emissão e Gestão de Contratos Angelim Construtora
// Modelo Oficial: Instrumento Particular de Proposta de Contratação de Serviços de Construção Civil (MCMV / Caixa)
// Conforme layout institucional da Angelim Construtora (Capa, Cabeçalho, Cláusulas e Assinaturas Gov.br / Digital)

const Contratos = {
  _getKey() {
    return (typeof DB !== 'undefined' && DB._ck) ? DB._ck('finobra_contratos') : 'finobra_contratos';
  },

  getAll() {
    try {
      const list = JSON.parse(localStorage.getItem(this._getKey()) || '[]');
      return list.map(c => {
        delete c.selo_govbr_contratada;
        delete c.selo_govbr_contratante;
        return c;
      });
    } catch { return []; }
  },

  salvarLista(contratos) {
    localStorage.setItem(this._getKey(), JSON.stringify(contratos));
  },

  getById(id) {
    return this.getAll().find(c => c.id === id) || null;
  },

  adicionar(contrato) {
    const lista = this.getAll();
    const item = {
      id: 'ct_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      numero: this._proximoNumero(),
      criado_em: new Date().toISOString(),
      status: 'pendente',
      assinatura_contratante: null,
      assinatura_contratada: null,
      ...contrato
    };
    delete item.selo_govbr_contratada;
    delete item.selo_govbr_contratante;
    lista.unshift(item);
    this.salvarLista(lista);
    return item;
  },

  atualizar(id, dados) {
    const lista = this.getAll();
    const idx = lista.findIndex(c => c.id === id);
    if (idx !== -1) {
      lista[idx] = { ...lista[idx], ...dados, atualizado_em: new Date().toISOString() };
      delete lista[idx].selo_govbr_contratada;
      delete lista[idx].selo_govbr_contratante;
      
      if (lista[idx].assinatura_contratante && lista[idx].assinatura_contratada) {
        lista[idx].status = 'assinado';
      } else {
        lista[idx].status = 'pendente';
      }

      this.salvarLista(lista);
      return lista[idx];
    }
    return null;
  },

  remover(id) {
    const lista = this.getAll().filter(c => c.id !== id);
    this.salvarLista(lista);
  },

  _proximoNumero() {
    const lista = this.getAll();
    if (!lista.length) return '0001/2026';
    const num = lista.length + 1;
    const ano = new Date().getFullYear();
    return `${String(num).padStart(4, '0')}/${ano}`;
  },

  _calcularDias(d1, d2) {
    if (!d1 || !d2) return '30';
    try {
      if (typeof Utils !== 'undefined' && typeof Utils.diasEntre === 'function') {
        const d = Utils.diasEntre(d1, d2);
        return d > 0 ? String(d) : '30';
      }
      const dt1 = new Date(d1);
      const dt2 = new Date(d2);
      const diff = dt2.getTime() - dt1.getTime();
      const dias = Math.round(diff / (1000 * 60 * 60 * 24));
      return isNaN(dias) || dias <= 0 ? '30' : String(dias);
    } catch {
      return '30';
    }
  },

  // ─────────────────────────────────────────────────────────────
  // TEMPLATES / MODELOS DE CONTRATO (OFICIAL ANGELIM CONSTRUTORA)
  // ─────────────────────────────────────────────────────────────
  getModelos() {
    return {
      contrato_caixa_mcmv: {
        nome: 'Proposta de Construção Civil Residencial (Contrato Anterior à Caixa - MCMV)',
        descricao: 'Modelo Oficial da Angelim Construtora: Proposta de contratação futura vinculada a financiamento Caixa Econômica Federal.',
        tipo: 'cliente_caixa',
        clausulas: [
          {
            id: 'cl_01',
            secao: 'DO OBJETO',
            numero: 'CLÁUSULA 01',
            titulo: 'DO OBJETO E SERVIÇOS DE GESTÃO DE OBRA',
            texto: 'O presente instrumento tem por objeto a proposta de contratação futura dos serviços de GESTÃO DE OBRA, compreendendo a aquisição de materiais e a contratação de mão de obra necessária à execução da obra, condicionada à aprovação e formalização do financiamento bancário.'
          },
          {
            id: 'cl_02',
            secao: '',
            numero: 'CLÁUSULA 02',
            titulo: 'DA ÁREA CONSTRUÍDA E PROJETOS',
            texto: 'A área a ser construída será de {AREA_M2}m² ({AREA_EXTENSO}), conforme projeto de engenharia apresentado à instituição bancária financeira e de acordo com o respectivo Memorial Descritivo.'
          },
          {
            id: 'cl_03',
            secao: '',
            numero: 'CLÁUSULA 03',
            titulo: 'DA DEFINIÇÃO DO TERRENO',
            texto: 'O terreno o qual a obra será executada ainda está em fase de negociação/definição, nesse caso, a CONTRATADA fica durante {DIAS_TERRENO} dias à espera da definição da CONTRATANTE a respeito dessa decisão.'
          },
          {
            id: 'cl_04',
            secao: 'DO VALOR',
            numero: 'CLÁUSULA 04',
            titulo: 'DO VALOR TOTAL ESTIMADO DA OBRA',
            texto: 'O valor total estimado da obra é de {VALOR_TOTAL} ({VALOR_EXTENSO}), correspondente ao valor de {VALOR_M2} por metro quadrado de área construída, englobando as despesas com: (i) aquisição de materiais; (ii) contratação de mão de obra; e (iii) serviço de gestão da obra.'
          },
          {
            id: 'cl_05',
            secao: '',
            numero: 'CLÁUSULA 05',
            titulo: 'DO PRAZO PARA FORMALIZAÇÃO E REAJUSTE',
            texto: 'Caso o contrato de financiamento bancário não seja formalizado no prazo de até 04 (quatro) meses contados do protocolo da proposta junto à instituição financeira, o valor mencionado na cláusula anterior poderá ser reajustado, conforme valores praticados à época da efetiva contratação.'
          },
          {
            id: 'cl_05a',
            secao: '',
            numero: 'CLÁUSULA 05.a',
            titulo: 'DA DESISTÊNCIA EM CASO DE REAJUSTE',
            texto: 'Na hipótese de reajuste, faculta-se à CONTRATANTE desistir da contratação, caso não concorde com o novo valor, sem incidência de multa ou ônus rescisório.'
          },
          {
            id: 'cl_07',
            secao: 'DA FORMA DE PAGAMENTO',
            numero: 'CLÁUSULA 07',
            titulo: 'DA COMPOSIÇÃO DOS RECURSOS',
            texto: 'O valor global da obra será pago mediante recursos provenientes de financiamento habitacional junto à Caixa Econômica Federal, acrescidos de recursos próprios da CONTRATANTE.'
          },
          {
            id: 'cl_08',
            secao: '',
            numero: 'CLÁUSULA 08',
            titulo: 'DOS RECURSOS PRÓPRIOS E FORMA DE ENTRADA',
            texto: 'O valor total referente à entrada, correspondente aos recursos próprios da CONTRATANTE, é de {VALOR_ENTRADA} ({VALOR_ENTRADA_EXTENSO}), a serem pagos da seguinte forma:\na) {PARCELAS_ENTRADA}, pagos na data da assinatura do contrato de financiamento junto à Caixa Econômica Federal;'
          },
          {
            id: 'cl_08a',
            secao: '',
            numero: 'CLÁUSULA 08.a',
            titulo: 'DA DIVERGÊNCIA DE RECURSOS PRÓPRIOS',
            texto: 'Havendo divergência entre o valor de recursos próprios inicialmente informado na proposta de financiamento e o valor efetivamente aprovado, a diferença será diluída nas parcelas vincendas, após a assinatura do contrato bancário.'
          },
          {
            id: 'cl_08b',
            secao: '',
            numero: 'CLÁUSULA 08.b',
            titulo: 'DA DIFERENÇA DE AVALIAÇÃO DO TERRENO',
            texto: 'Havendo diferença entre o valor do terreno apresentado na proposta e o valor efetivamente avaliado pela instituição financeira, tal diferença deverá ser quitada diretamente ao proprietário do terreno, antes da assinatura do contrato de financiamento.'
          },
          {
            id: 'cl_09',
            secao: '',
            numero: 'CLÁUSULA 09',
            titulo: 'DO ATRASO DE PAGAMENTO E MULTA RESCISÓRIA',
            texto: 'O atraso superior a 30 (trinta) dias no pagamento de quaisquer valores autoriza a rescisão unilateral do presente instrumento pela CONTRATADA, com aplicação de multa equivalente a 6% (seis por cento) sobre o valor total da obra.'
          },
          {
            id: 'cl_10',
            secao: 'DO PROCESSO DE FINANCIAMENTO BANCÁRIO',
            numero: 'CLÁUSULA 10',
            titulo: 'DO APOIO NOS TRÂMITES JUNTO AO BANCO',
            texto: 'A CONTRATADA prestará apoio à CONTRATANTE nos trâmites relativos ao processo de financiamento junto à instituição bancária e aos órgãos competentes, não se responsabilizando por atrasos, exigências adicionais, indeferimentos, falhas técnicas, morosidade administrativa ou erros cometidos por tais instituições ou órgãos públicos, inclusive quanto à emissão de documentos, análises, taxas ou prazos.'
          },
          {
            id: 'cl_11',
            secao: '',
            numero: 'CLÁUSULA 11',
            titulo: 'DA AUSÊNCIA DE RESPONSABILIDADE POR PRAZOS BANCÁRIOS',
            texto: 'O prazo necessário para conclusão do processo de financiamento, até a assinatura do contrato bancário, não será de responsabilidade da CONTRATADA, por tratar-se de procedimento alheio à sua ingerência.'
          },
          {
            id: 'cl_12',
            secao: '',
            numero: 'CLÁUSULA 12',
            titulo: 'DA COMPOSIÇÃO DA PROPOSTA DE CRÉDITO',
            texto: 'A proposta de financiamento é composta por simulação de crédito habitacional, projetos de engenharia e documentação do terreno e de seu proprietário.'
          },
          {
            id: 'cl_12a',
            secao: '',
            numero: 'CLÁUSULA 12.a',
            titulo: 'DAS ALTERAÇÕES PELAS POLÍTICAS DO AGENTE FINANCEIRO',
            texto: 'Os valores constantes da proposta de financiamento poderão sofrer alterações conforme critérios, normas internas e políticas da instituição financeira, sem qualquer responsabilidade da CONTRATADA.'
          },
          {
            id: 'cl_13',
            secao: 'DA ELABORAÇÃO DO PROJETO DE ENGENHARIA',
            numero: 'CLÁUSULA 13',
            titulo: 'DOS HONORÁRIOS TÉCNICOS E TAXAS DO PROJETO',
            texto: 'Todos os custos referentes à elaboração do projeto de engenharia, incluindo honorários técnicos e taxas, serão de responsabilidade exclusiva da CONTRATANTE.'
          },
          {
            id: 'cl_14',
            secao: '',
            numero: 'CLÁUSULA 14',
            titulo: 'DA INTERMEDIAÇÃO COM ENGENHEIROS E PROJETISTAS',
            texto: 'A CONTRATADA compromete-se a auxiliar a CONTRATANTE na intermediação com os profissionais responsáveis pela elaboração do projeto de engenharia.'
          },
          {
            id: 'cl_15',
            secao: 'DOS PRAZOS',
            numero: 'CLÁUSULA 15',
            titulo: 'DA VIGÊNCIA DA PROPOSTA',
            texto: 'O presente instrumento terá vigência de 05 (cinco) meses, contados da data de protocolo da proposta de financiamento, ou até a assinatura do contrato definitivo de prestação de serviços, podendo ser prorrogado mediante acordo entre as partes.'
          },
          {
            id: 'cl_16',
            secao: '',
            numero: 'CLÁUSULA 16',
            titulo: 'DA CELEBRAÇÃO DO CONTRATO DEFINITIVO',
            texto: 'Em até 02 (dois) dias úteis após a assinatura do contrato de financiamento, as partes deverão celebrar o contrato definitivo de prestação de serviços de construção civil.'
          },
          {
            id: 'cl_16a',
            secao: '',
            numero: 'CLÁUSULA 16.a',
            titulo: 'DO PRAZO DE EXECUÇÃO FÍSICA DA OBRA',
            texto: 'O prazo para execução da obra será de 05 (cinco) meses, contados a partir da assinatura do contrato definitivo de construção.'
          },
          {
            id: 'cl_17',
            secao: 'DAS OBRIGAÇÕES E CONDIÇÕES GERAIS',
            numero: 'CLÁUSULA 17',
            titulo: 'DA LEGALIZAÇÃO DA OBRA E IMPOSTOS',
            texto: 'A CONTRATANTE será responsável pelo pagamento de todos os impostos, taxas, encargos e custos relacionados à legalização da obra junto aos órgãos públicos competentes.'
          },
          {
            id: 'cl_18',
            secao: '',
            numero: 'CLÁUSULA 18',
            titulo: 'DA MULTA POR DESISTÊNCIA OU INADIMPLEMENTO',
            texto: 'A desistência ou o descumprimento de quaisquer cláusulas deste instrumento implicará sua rescisão, sujeitando a parte inadimplente ao pagamento de multa correspondente a 6% (seis por cento) do valor total da obra.'
          },
          {
            id: 'cl_19',
            secao: '',
            numero: 'CLÁUSULA 19',
            titulo: 'DO FORO DE ELEIÇÃO',
            texto: 'Fica eleito o foro da Comarca de Boa Vista/RR, com renúncia expressa de qualquer outro, por mais privilegiado que seja.'
          },
          {
            id: 'cl_20',
            secao: '',
            numero: 'CLÁUSULA 20',
            titulo: 'DA ENTRADA EM VIGOR',
            texto: 'O presente instrumento entra em vigor na data de sua assinatura.'
          }
        ]
      },

      empreitada_mao_obra: {
        nome: 'Contrato de Empreitada de Mão de Obra e Gestão',
        descricao: 'Contratação de empreiteiros, pedreiros ou serviços gerais com retenção técnica e regras de EPI.',
        tipo: 'prestacao_servicos',
        clausulas: [
          {
            id: 'cl_obj',
            secao: 'DO OBJETO',
            numero: 'CLÁUSULA 01',
            titulo: 'DO OBJETO E ESCOPO DOS SERVIÇOS',
            texto: 'O presente contrato tem por objeto a prestação de serviços especializados de construção civil e execução de mão de obra na obra localizada em {OBRA_ENDERECO}, sob a responsabilidade e supervisão da CONTRATANTE.'
          },
          {
            id: 'cl_val',
            secao: 'DO VALOR E PAGAMENTO',
            numero: 'CLÁUSULA 02',
            titulo: 'DO PREÇO E MEDIÇÕES',
            texto: 'Pela execução dos serviços, a CONTRATANTE pagará à CONTRATADA o valor global de {VALOR_TOTAL} ({VALOR_EXTENSO}), a ser quitado conforme medições aprovadas pelo engenheiro responsável.'
          },
          {
            id: 'cl_seguranca',
            secao: 'DA SEGURANÇA E EPIS',
            numero: 'CLÁUSULA 03',
            titulo: 'DOS EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL (NR-18)',
            texto: 'A CONTRATADA obriga-se a fornecer e fiscalizar o uso diário obrigatório de todos os EPIs de sua equipe no canteiro de obras.'
          },
          {
            id: 'cl_foro',
            secao: 'DO FORO',
            numero: 'CLÁUSULA 04',
            titulo: 'DO FORO DE ELEIÇÃO',
            texto: 'As partes elegem o foro da Comarca de Boa Vista/RR para dirimir quaisquer controvérsias.'
          }
        ]
      }
    };
  },

  // ─────────────────────────────────────────────────────────────
  // RENDER DA TELA PRINCIPAL (#contratos)
  // ─────────────────────────────────────────────────────────────
  render(obraId) {
    const lista = this.getAll();
    const cs = DB.getAll('clientes');
    const filtrados = obraId && obraId !== 'todas' ? lista.filter(c => c.obra_id === obraId) : lista;

    const totalValor = filtrados.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0);
    const assinadosQtd = filtrados.filter(c => c.status === 'assinado' || (c.assinatura_contratante && c.assinatura_contratada) || (c.selo_govbr_contratada && c.selo_govbr_contratante)).length;
    const pendentesQtd = filtrados.length - assinadosQtd;

    return `
    <div class="page-header">
      <div>
        <h1 class="page-title">📜 Contratos de Obras</h1>
        <p class="page-sub">Emissão oficial de propostas e contratos habitacionais padrão Angelim Construtora (MCMV / Caixa) com assinaturas digitais e Gov.br</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="Contratos.novoContratoModal()">
          + Novo Contrato de Obra
        </button>
      </div>
    </div>

    <!-- Indicadores -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:20px;">
      <div class="card" style="padding:14px 18px;">
        <div style="font-size:.72rem;color:var(--text3);text-transform:uppercase;font-weight:800;letter-spacing:0.5px;">Total de Contratos</div>
        <div style="font-size:1.45rem;font-weight:900;color:var(--text);margin-top:2px;">${filtrados.length}</div>
      </div>
      <div class="card" style="padding:14px 18px;">
        <div style="font-size:.72rem;color:var(--text3);text-transform:uppercase;font-weight:800;letter-spacing:0.5px;">Contratos Assinados</div>
        <div style="font-size:1.45rem;font-weight:900;color:#10b981;margin-top:2px;">${assinadosQtd}</div>
      </div>
      <div class="card" style="padding:14px 18px;">
        <div style="font-size:.72rem;color:var(--text3);text-transform:uppercase;font-weight:800;letter-spacing:0.5px;">Aguardando Assinatura</div>
        <div style="font-size:1.45rem;font-weight:900;color:#f59e0b;margin-top:2px;">${pendentesQtd}</div>
      </div>
      <div class="card" style="padding:14px 18px;">
        <div style="font-size:.72rem;color:var(--text3);text-transform:uppercase;font-weight:800;letter-spacing:0.5px;">Valor Total Contratado</div>
        <div style="font-size:1.45rem;font-weight:900;color:var(--accent);margin-top:2px;">${Utils.fmt.currency(totalValor)}</div>
      </div>
    </div>

    <!-- Tabela -->
    <div class="card" style="padding:0;">
      <div class="card-header" style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div class="card-title">📜 Contratos Emitidos (${filtrados.length})</div>
      </div>
      <div class="tbl-wrap" style="border:none;border-radius:0 0 14px 14px;">
        <table>
          <thead>
            <tr>
              <th>Nº Contrato</th>
              <th>Data</th>
              <th>Tipo de Contrato</th>
              <th>Obra / Cliente</th>
              <th>Contratante</th>
              <th style="text-align:right;">Valor Estimado</th>
              <th style="text-align:center;">Assinaturas</th>
              <th style="text-align:center;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${filtrados.length ? filtrados.map(c => this._renderContratoRow(c)).join('') : `
            <tr>
              <td colspan="8" style="text-align:center;padding:40px;color:var(--text3);">
                Nenhum contrato gerado ainda. Clique em "+ Novo Contrato de Obra" para emitir o modelo oficial da Angelim Construtora.
              </td>
            </tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
  },

  _renderContratoRow(c) {
    const cli = DB.getById('clientes', c.obra_id);
    const obraNome = cli ? `${cli.nome} (${cli.cidade}/${cli.estado})` : (c.obra_nome || 'Geral');

    const contratanteAssinou = !!(c.assinatura_contratante || c.selo_govbr_contratante);
    const contratadaAssinou = !!(c.assinatura_contratada || c.selo_govbr_contratada);

    const sigClienteBadge = contratanteAssinou 
      ? '<span class="badge badge-success" title="Cliente Assinou">✓ Cliente</span>' 
      : '<span class="badge" style="background:rgba(148,163,184,.15);color:var(--text3);">Cliente ?</span>';

    const sigAngelimBadge = contratadaAssinou 
      ? '<span class="badge badge-success" title="Angelim Assinou">✓ Angelim</span>' 
      : '<span class="badge" style="background:rgba(148,163,184,.15);color:var(--text3);">Angelim ?</span>';

    return `
    <tr>
      <td style="font-weight:800;color:var(--accent);font-family:monospace;white-space:nowrap;">${c.numero}</td>
      <td style="white-space:nowrap;font-weight:600;">${Utils.fmt.date(c.data_emissao || c.criado_em)}</td>
      <td>
        <strong style="color:var(--text);display:block;">${c.titulo || 'Contrato de Construção'}</strong>
        <span style="font-size:.72rem;color:var(--text3);">${c.subtitulo || 'MCMV - Caixa'}</span>
      </td>
      <td style="color:var(--text2);font-weight:600;">${obraNome}</td>
      <td><strong style="color:var(--text);">${c.contratante_nome}</strong>${c.contratante_doc ? `<div style="font-size:.72rem;color:var(--text3);">${c.contratante_doc}</div>` : ''}</td>
      <td style="text-align:right;font-weight:900;color:var(--text);white-space:nowrap;">${Utils.fmt.currency(c.valor)}</td>
      <td style="text-align:center;">
        <div style="display:flex;gap:4px;justify-content:center;">
          ${sigClienteBadge}
          ${sigAngelimBadge}
        </div>
      </td>
      <td style="text-align:center;">
        <div style="display:flex;gap:6px;justify-content:center;align-items:center;">
          <button class="btn btn-sm btn-primary" onclick="Contratos.visualizarContrato('${c.id}')" title="Visualizar documento completo e assinar" style="padding:4px 8px;font-size:.75rem;">
            👁️ Ver / Assinar
          </button>
          <button class="icon-btn btn-sm" onclick="Contratos.editarContratoModal('${c.id}')" title="Editar cláusulas e dados do contrato">
            ✏️
          </button>
          <button class="icon-btn btn-sm" onclick="Contratos.enviarWhatsApp('${c.id}')" title="Compartilhar resumo e link no WhatsApp" style="color:#25d366;">
            📲
          </button>
          <button class="icon-btn btn-sm" onclick="Contratos._confirmDel('${c.id}')" style="color:var(--danger);" title="Excluir contrato">
            🗑️
          </button>
        </div>
      </td>
    </tr>`;
  },

  // ─────────────────────────────────────────────────────────────
  // MODAL DE CADASTRO / EDIÇÃO DE CONTRATO COM PREENCHIMENTO AUTO
  // ─────────────────────────────────────────────────────────────
  _clausulasTemporarias: [],

  novoContratoModal() {
    this._abrirFormularioModal({});
  },

  editarContratoModal(id) {
    const c = this.getById(id);
    if (!c) return;
    this._abrirFormularioModal(c);
  },

  _abrirFormularioModal(dados = {}) {
    const cs = DB.getAll('clientes');
    const emp = DB.getEmpresa();
    const modelos = this.getModelos();
    const isEdit = !!dados.id;

    const modeloKey = dados.modelo_key || 'contrato_caixa_mcmv';
    const modelo = modelos[modeloKey] || modelos.contrato_caixa_mcmv;

    this._clausulasTemporarias = dados.clausulas && dados.clausulas.length 
      ? JSON.parse(JSON.stringify(dados.clausulas))
      : JSON.parse(JSON.stringify(modelo.clausulas));

    const hoje = Utils.today();

    Utils.showModal(`
      <div class="modal" style="max-width:960px;width:96vw;max-height:94vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="flex-shrink:0;">
          <div>
            <span class="modal-title">📜 ${isEdit ? 'Editar Contrato' : 'Novo Contrato de Construção Civil — Angelim Construtora'}</span>
            <div style="font-size:.76rem;color:var(--text3);margin-top:2px;">Modelo oficial pré-formatado com Capa, Qualificação das Partes, 20 Cláusulas e Assinaturas Gov.br</div>
          </div>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>

        <div class="modal-body" style="overflow-y:auto;padding:20px;flex:1;">
          <form id="f-contrato">
            <input type="hidden" name="id" value="${dados.id || ''}">

            <!-- Bloco 1: Vínculo da Obra e Modelo -->
            <div style="background:var(--bg-secondary);border:1px solid var(--border-s);border-radius:8px;padding:16px;margin-bottom:18px;">
              <div style="font-size:.82rem;font-weight:900;color:var(--accent);text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                <span>1.</span> Seleção da Obra &amp; Modelo do Contrato
              </div>

              <div class="form-row cols-2" style="margin-bottom:12px;">
                <div class="form-group">
                  <label class="form-label">Obra / Cliente Cadastrado *</label>
                  <select class="form-control" name="obra_id" id="ct-obra-select" onchange="Contratos._onObraChange(this.value)" required>
                    <option value="">Selecione uma Obra para Puxar os Dados...</option>
                    ${cs.map(c => `<option value="${c.id}" ${c.id===(dados.obra_id||App.obraId)?'selected':''}>${c.nome} &mdash; ${c.cidade}/${c.estado} (Contrato Caixa: ${c.num_contrato_caixa||'—'})</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Modelo Contratual *</label>
                  <select class="form-control" name="modelo_key" id="ct-modelo-select" onchange="Contratos._onModeloSelect(this.value)">
                    ${Object.entries(modelos).map(([k, m]) => `<option value="${k}" ${k===modeloKey?'selected':''}>${m.nome}</option>`).join('')}
                  </select>
                </div>
              </div>

              <div class="form-row cols-2">
                <div class="form-group">
                  <label class="form-label">Título da Capa *</label>
                  <input class="form-control" name="titulo" id="ct-titulo" value="${dados.titulo || 'CONTRATO DE PRESTAÇÃO DE SERVIÇO DE CONSTRUÇÃO'}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Subtítulo da Capa</label>
                  <input class="form-control" name="subtitulo" id="ct-subtitulo" value="${dados.subtitulo || 'MCMV — ANGELIM CONSTRUTORA'}">
                </div>
              </div>
            </div>

            <!-- Bloco 2: Qualificação da Contratante (Cliente) -->
            <div style="background:var(--bg-secondary);border:1px solid var(--border-s);border-radius:8px;padding:16px;margin-bottom:18px;">
              <div style="font-size:.82rem;font-weight:900;color:var(--accent);text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                <span>2.</span> Qualificação da CONTRATANTE (Cliente/Proprietário)
              </div>

              <div class="form-row cols-2" style="margin-bottom:10px;">
                <div class="form-group">
                  <label class="form-label">Nome Completo *</label>
                  <input class="form-control" name="contratante_nome" id="ct-cli-nome" value="${dados.contratante_nome || ''}" required placeholder="Ex: CAMILY TULYANA LIMA AZEVEDO">
                </div>
                <div class="form-group">
                  <label class="form-label">CPF *</label>
                  <input class="form-control" name="contratante_doc" id="ct-cli-doc" value="${dados.contratante_doc || ''}" required placeholder="000.000.000-00">
                </div>
              </div>

              <div class="form-row cols-3" style="margin-bottom:10px;">
                <div class="form-group">
                  <label class="form-label">RG / Órgão Emissor</label>
                  <input class="form-control" name="contratante_rg" id="ct-cli-rg" value="${dados.contratante_rg || ''}" placeholder="Ex: 541284-6 SSP/RR">
                </div>
                <div class="form-group">
                  <label class="form-label">Data de Nascimento</label>
                  <input class="form-control" name="contratante_nascimento" id="ct-cli-nasc" value="${dados.contratante_nascimento || ''}" placeholder="Ex: 24 de setembro de 2004">
                </div>
                <div class="form-group">
                  <label class="form-label">Nacionalidade / Estado Civil</label>
                  <input class="form-control" name="contratante_estado_civil" id="ct-cli-civil" value="${dados.contratante_estado_civil || 'brasileira, solteira'}" placeholder="brasileira, solteira">
                </div>
              </div>

              <div class="form-row cols-2" style="margin-bottom:10px;">
                <div class="form-group">
                  <label class="form-label">Endereço Residencial do Cliente</label>
                  <input class="form-control" name="contratante_endereco" id="ct-cli-end" value="${dados.contratante_endereco || ''}" placeholder="Rua, número, bairro">
                </div>
                <div class="form-group">
                  <label class="form-label">CEP / Cidade / UF</label>
                  <input class="form-control" name="contratante_cidade_uf" id="ct-cli-cid" value="${dados.contratante_cidade_uf || 'CEP 69.316-020, Boa Vista/RR'}">
                </div>
              </div>

              <div class="form-row cols-2">
                <div class="form-group">
                  <label class="form-label">Telefone / WhatsApp</label>
                  <input class="form-control" name="contratante_telefone" id="ct-cli-tel" value="${dados.contratante_telefone || ''}" placeholder="(95) 90000-0000">
                </div>
                <div class="form-group">
                  <label class="form-label">E-mail</label>
                  <input class="form-control" name="contratante_email" id="ct-cli-email" value="${dados.contratante_email || ''}" placeholder="cliente@email.com">
                </div>
              </div>
            </div>

            <!-- Bloco 3: Qualificação da CONTRATADA (Angelim Construtora) -->
            <div style="background:var(--bg-secondary);border:1px solid var(--border-s);border-radius:8px;padding:16px;margin-bottom:18px;">
              <div style="font-size:.82rem;font-weight:900;color:var(--accent);text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                <span>3.</span> Qualificação da CONTRATADA (Angelim Construtora)
              </div>

              <div class="form-row cols-2" style="margin-bottom:10px;">
                <div class="form-group">
                  <label class="form-label">Razão Social</label>
                  <input class="form-control" name="contratada_nome" id="ct-emp-nome" value="${dados.contratada_nome || emp.razao_social || 'ANGELIM CONSTRUTORA LTDA'}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">CNPJ</label>
                  <input class="form-control" name="contratada_doc" id="ct-emp-cnpj" value="${dados.contratada_doc || emp.cnpj || '65.512.273/0001-60'}">
                </div>
              </div>

              <div class="form-group" style="margin-bottom:10px;">
                <label class="form-label">Sede da Construtora</label>
                <input class="form-control" name="contratada_endereco" id="ct-emp-end" value="${dados.contratada_endereco || 'Rua Andrômeda, nº 228, Bairro Cidade Satélite, Boa Vista/RR'}">
              </div>

              <div class="form-group">
                <label class="form-label">Representante Legal &amp; Qualificação</label>
                <input class="form-control" name="contratada_rep" id="ct-emp-rep" value="${dados.contratada_rep || 'Naira de Amorim da Silva, brasileira, solteira, não convivente em regime de união estável, nascida em 07 de agosto de 1999, portadora da Cédula de Identidade RG nº 386634-3 SSP/RR, inscrita no CPF nº 029.525.532-38'}">
              </div>
            </div>

            <!-- Bloco 4: Valores da Obra e Condições de Pagamento -->
            <div style="background:var(--bg-secondary);border:1px solid var(--border-s);border-radius:8px;padding:16px;margin-bottom:18px;">
              <div style="font-size:.82rem;font-weight:900;color:var(--accent);text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                <span>4.</span> Valores da Construção, Metragem e Entrada
              </div>

              <div class="form-row cols-3" style="margin-bottom:10px;">
                <div class="form-group">
                  <label class="form-label">Valor Total da Obra (R$) *</label>
                  <input class="form-control" type="number" step="0.01" name="valor" id="ct-valor" value="${dados.valor || '122000.00'}" required oninput="Contratos._recalcularValores()">
                </div>
                <div class="form-group">
                  <label class="form-label">Área Construída (m²) *</label>
                  <input class="form-control" type="number" step="0.01" name="area_m2" id="ct-area" value="${dados.area_m2 || '40'}" required oninput="Contratos._recalcularValores()">
                </div>
                <div class="form-group">
                  <label class="form-label">Valor por m² (R$/m²)</label>
                  <input class="form-control" name="valor_m2" id="ct-valor-m2" value="${dados.valor_m2 || 'R$ 3.050,00'}" readonly style="background:var(--bg-card);font-weight:700;color:var(--accent);">
                </div>
              </div>

              <div class="form-row cols-2" style="margin-bottom:10px;">
                <div class="form-group">
                  <label class="form-label">Valor da Entrada / Recursos Próprios (R$)</label>
                  <input class="form-control" type="number" step="0.01" name="valor_entrada" id="ct-entrada" value="${dados.valor_entrada || '14504.52'}">
                </div>
                <div class="form-group">
                  <label class="form-label">Parcela Paga na Assinatura da Caixa (R$)</label>
                  <input class="form-control" name="parcela_entrada_caixa" id="ct-parc-caixa" value="${dados.parcela_entrada_caixa || 'R$ 10.978,13'}" placeholder="Ex: R$ 10.978,13">
                </div>
              </div>

              <div class="form-row cols-2">
                <div class="form-group">
                  <label class="form-label">Prazo de Espera do Terreno (Dias)</label>
                  <input class="form-control" type="number" name="dias_terreno" id="ct-dias-terreno" value="${dados.dias_terreno || '15'}">
                </div>
                <div class="form-group">
                  <label class="form-label">Data de Emissão do Contrato</label>
                  <input class="form-control" type="date" name="data_emissao" value="${dados.data_emissao || hoje}">
                </div>
              </div>
            </div>

            <!-- Bloco 5: Cláusulas Contratuais Dinâmicas -->
            <div style="background:var(--bg-secondary);border:1px solid var(--border-s);border-radius:8px;padding:16px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                <div>
                  <div style="font-size:.82rem;font-weight:900;color:var(--accent);text-transform:uppercase;">
                    <span>5.</span> Cláusulas Contratuais Formais (${this._clausulasTemporarias.length})
                  </div>
                  <div style="font-size:.72rem;color:var(--text3);margin-top:2px;">
                    Todas as 20 cláusulas oficiais pré-configuradas. Você pode editar, adicionar ou personalizar qualquer texto.
                  </div>
                </div>
                <button type="button" class="btn btn-sm btn-primary" onclick="Contratos.adicionarClausula()" style="font-size:.75rem;">
                  + Adicionar Cláusula
                </button>
              </div>

              <div id="ct-clausulas-container" style="display:flex;flex-direction:column;gap:10px;"></div>
            </div>
          </form>
        </div>

        <div class="modal-footer" style="flex-shrink:0;display:flex;justify-content:space-between;align-items:center;">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="Contratos.salvarContratoSubmit()">
            📄 Gerar &amp; Visualizar Contrato Oficial
          </button>
        </div>
      </div>
    `);

    setTimeout(() => {
      this._renderClausulasNoForm();
      this._recalcularValores();
    }, 60);
  },

  _onObraChange(obraId) {
    if (!obraId) return;
    const c = DB.getById('clientes', obraId);
    if (!c) return;

    const nome = document.getElementById('ct-cli-nome');
    const doc = document.getElementById('ct-cli-doc');
    const tel = document.getElementById('ct-cli-tel');
    const email = document.getElementById('ct-cli-email');
    const end = document.getElementById('ct-cli-end');
    const cid = document.getElementById('ct-cli-cid');
    const valor = document.getElementById('ct-valor');
    const area = document.getElementById('ct-area');
    const entrada = document.getElementById('ct-entrada');
    const subtitulo = document.getElementById('ct-subtitulo');

    if (nome) nome.value = (c.nome || '').toUpperCase();
    if (doc) doc.value = c.cpf_cnpj || '';
    if (tel) tel.value = c.telefone || '';
    if (email) email.value = c.email || '';
    if (end) end.value = c.endereco ? `${c.endereco}, ${c.cidade}/${c.estado}` : '';
    if (cid) cid.value = `CEP ${c.cep || '69.300-000'}, ${c.cidade}/${c.estado}`;

    if (c.area_construida && area) area.value = c.area_construida;
    if (c.valor_proprio && entrada) entrada.value = c.valor_proprio;

    const totalCalculado = (parseFloat(c.valor_financiado) || 0) + (parseFloat(c.valor_proprio) || 0);
    if (totalCalculado > 0 && valor) {
      valor.value = totalCalculado.toFixed(2);
    }

    if (subtitulo && c.nome) {
      subtitulo.value = `(CONTRATO ANTERIOR A CAIXA - ${c.nome.toUpperCase()}) MCMV`;
    }

    this._recalcularValores();
  },

  _recalcularValores() {
    const valorEl = document.getElementById('ct-valor');
    const areaEl = document.getElementById('ct-area');
    const valorM2El = document.getElementById('ct-valor-m2');
    const entradaEl = document.getElementById('ct-entrada');
    const parcCaixaEl = document.getElementById('ct-parc-caixa');

    const v = parseFloat(valorEl?.value) || 0;
    const a = parseFloat(areaEl?.value) || 0;

    if (valorM2El) {
      if (v > 0 && a > 0) {
        const m2 = v / a;
        valorM2El.value = Utils.fmt.currency(m2);
      } else {
        valorM2El.value = 'R$ 3.050,00';
      }
    }

    if (entradaEl && parcCaixaEl && !parcCaixaEl.value) {
      const ent = parseFloat(entradaEl.value) || 0;
      if (ent > 0) {
        parcCaixaEl.value = Utils.fmt.currency(ent * 0.75);
      }
    }
  },

  _renderClausulasNoForm() {
    const container = document.getElementById('ct-clausulas-container');
    if (!container) return;

    container.innerHTML = this._clausulasTemporarias.map((cl, idx) => `
      <div class="card" style="padding:10px 14px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;" data-idx="${idx}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;flex:1;">
            <input class="form-control" style="font-weight:900;font-size:.76rem;color:var(--accent);width:130px;padding:2px 6px;" value="${cl.numero || `CLÁUSULA ${idx+1}`}" onchange="Contratos._atualizarClausula(${idx}, 'numero', this.value)">
            ${cl.secao ? `<span style="font-size:.7rem;font-weight:800;color:var(--text3);text-transform:uppercase;">[${cl.secao}]</span>` : ''}
            <input class="form-control" style="font-weight:700;font-size:.76rem;color:var(--text);flex:1;padding:2px 6px;" value="${cl.titulo || ''}" placeholder="Título" onchange="Contratos._atualizarClausula(${idx}, 'titulo', this.value)">
          </div>
          <div style="display:flex;gap:4px;">
            <button type="button" class="icon-btn btn-sm" onclick="Contratos._removerClausula(${idx})" title="Excluir" style="color:var(--danger);font-size:.75rem;">🗑️</button>
          </div>
        </div>
        <textarea class="form-control" rows="2" style="font-size:.8rem;line-height:1.45;resize:vertical;" onchange="Contratos._atualizarClausula(${idx}, 'texto', this.value)">${cl.texto || ''}</textarea>
      </div>
    `).join('');
  },

  _atualizarClausula(idx, campo, valor) {
    if (this._clausulasTemporarias[idx]) {
      this._clausulasTemporarias[idx][campo] = valor;
    }
  },

  adicionarClausula() {
    const num = this._clausulasTemporarias.length + 1;
    this._clausulasTemporarias.push({
      id: 'cl_' + Date.now().toString(36),
      secao: '',
      numero: `CLÁUSULA ${String(num).padStart(2, '0')}`,
      titulo: 'NOVA CLÁUSULA',
      texto: 'Descreva aqui o teor desta cláusula contratual.'
    });
    this._renderClausulasNoForm();
  },

  _removerClausula(idx) {
    this._clausulasTemporarias.splice(idx, 1);
    this._renderClausulasNoForm();
  },

  salvarContratoSubmit() {
    const f = document.getElementById('f-contrato');
    if (!f.checkValidity()) { f.reportValidity(); return; }

    const fd = new FormData(f);
    const d = Object.fromEntries(fd);
    d.valor = parseFloat(d.valor) || 0;
    d.area_m2 = parseFloat(d.area_m2) || 40;
    d.valor_entrada = parseFloat(d.valor_entrada) || 0;
    d.clausulas = this._clausulasTemporarias;

    let contratoSalvo;
    if (d.id) {
      contratoSalvo = this.atualizar(d.id, d);
      Utils.toast('Contrato atualizado!', 'success');
    } else {
      contratoSalvo = this.adicionar(d);
      Utils.toast('Contrato gerado com sucesso!', 'success');
    }

    Utils.closeModal();
    this._sincronizarComDocumentos(contratoSalvo);
    setTimeout(() => this.visualizarContrato(contratoSalvo.id), 150);

    if (App.route === 'contratos') App.navigate('contratos');
  },

  _sincronizarComDocumentos(c) {
    if (c.obra_id && typeof Documentos !== 'undefined') {
      const htmlDoc = this.gerarHTMLContrato(c);
      Documentos.adicionar({
        entidade_tipo: 'obra',
        entidade_id: c.obra_id,
        titulo: `Contrato Oficial ${c.numero} - ${c.contratante_nome}`,
        nome_arquivo: `Contrato_${c.numero.replace('/','-')}.html`,
        tipo_mime: 'text/html',
        tamanho: htmlDoc.length,
        data_base64: 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlDoc)
      });
    }
  },

  _confirmDel(id) {
    Utils.confirm('Excluir este contrato permanentemente?', () => {
      this.remover(id);
      Utils.toast('Contrato excluído.', 'info');
      App.navigate('contratos');
    });
  },

  // ─────────────────────────────────────────────────────────────
  // COLETAR ASSINATURA DIGITAL DAS PARTES
  // ─────────────────────────────────────────────────────────────
  assinarContrato(id, papelAlvo = 'contratante') {
    const c = this.getById(id);
    if (!c) return;

    const isContratante = papelAlvo === 'contratante';
    const nomePadrao = isContratante ? c.contratante_nome : (c.contratada_rep ? c.contratada_rep.split(',')[0].trim() : 'Naira de Amorim da Silva');
    const docPadrao = isContratante ? c.contratante_doc : '029.525.532-38';

    Assinador.abrirModal({
      titulo: `Assinatura de ${isContratante ? 'CONTRATANTE' : 'CONTRATADA (Angelim)'}`,
      subtitulo: `Coleta de assinatura eletrônica legal na tela`,
      papel: isContratante ? 'Contratante' : 'Contratada (Administradora)',
      nomePredefinido: nomePadrao,
      docPredefinido: docPadrao,
      dadosDocumento: { id: c.id, numero: c.numero, valor: c.valor, tipo: 'contrato' },
      onSalvar: (sig) => {
        const update = {};
        if (isContratante) {
          update.assinatura_contratante = sig;
        } else {
          update.assinatura_contratada = sig;
        }

        this.atualizar(id, update);
        Utils.toast(`✅ Assinatura de ${nomePadrao} registrada com sucesso!`, 'success');
        this.visualizarContrato(id);
      }
    });
  },

  enviarWhatsApp(id) {
    const c = this.getById(id);
    if (!c) return;

    const valorFmt = Utils.fmt.currency(c.valor);
    const texto = `📜 *PROPOSTA DE CONTRATAÇÃO DE CONSTRUÇÃO CIVIL*\n*ANGELIM CONSTRUTORA*\n\n` +
      `*Contrato Nº:* ${c.numero}\n` +
      `*Cliente (Contratante):* ${c.contratante_nome}\n` +
      `*Valor Total da Obra:* ${valorFmt}\n` +
      `*Área Construída:* ${c.area_m2 || 40}m²\n` +
      `*Modalidade:* MCMV / Financiamento Caixa Econômica Federal\n\n` +
      `_Acesse a minuta completa em anexo ou no sistema FinObra para assinatura digital._`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  },

  // ─────────────────────────────────────────────────────────────
  // VISUALIZADOR DA MINUTA COMPLETA (EXATAMENTE COMO O MODELO PDF)
  // ─────────────────────────────────────────────────────────────
  visualizarContrato(id) {
    const c = this.getById(id);
    if (!c) return;
    const htmlContrato = this.gerarHTMLContrato(c);

    Utils.showModal(`
      <div class="modal" style="max-width:980px;width:96vw;max-height:94vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="flex-shrink:0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <span class="modal-title">📜 Contrato Nº ${c.numero}</span>
            <span class="badge badge-success" style="margin-left:8px;">Modelo Oficial Angelim (MCMV)</span>
          </div>

          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            <!-- Assinar Contratante -->
            <button class="btn btn-sm btn-primary" onclick="Contratos.assinarContrato('${c.id}', 'contratante')" style="font-size:.75rem;background:${c.assinatura_contratante ? '#10b981' : 'var(--primary)'};border-color:${c.assinatura_contratante ? '#10b981' : 'var(--primary)'};color:#fff;">
              ✍️ ${c.assinatura_contratante ? '✓ Cliente (Reassinar)' : 'Assinar Cliente'}
            </button>

            <!-- Assinar Angelim -->
            <button class="btn btn-sm btn-secondary" onclick="Contratos.assinarContrato('${c.id}', 'contratada')" style="font-size:.75rem;">
              ✍️ ${c.assinatura_contratada ? '✓ Angelim (Reassinar)' : 'Assinar Angelim'}
            </button>

            <button class="btn btn-sm btn-secondary" onclick="Contratos.enviarWhatsApp('${c.id}')" style="color:#25d366;font-size:.75rem;">
              📲 WhatsApp
            </button>

            <button class="btn btn-sm btn-secondary" onclick="Assinador.modalGovBr({ nomeDocumento:'Contrato_${c.numero.replace('/','-')}', onBaixarPDF: () => Contratos.imprimirContrato('${c.id}') })" style="color:#0284c7;font-size:.75rem;">
              🏛️ Gov.br
            </button>

            <button class="btn btn-sm btn-primary" onclick="Contratos.imprimirContrato('${c.id}')" style="font-size:.75rem;">
              🖨️ Imprimir / Salvar PDF
            </button>

            <button class="modal-close" onclick="Utils.closeModal()">✕</button>
          </div>
        </div>

        <div class="modal-body" style="background:#475569;padding:24px;overflow-y:auto;flex:1;display:flex;flex-direction:column;align-items:center;gap:24px;">
          ${htmlContrato}
        </div>
      </div>
    `);
  },

  // ─────────────────────────────────────────────────────────────
  // GERADOR DO HTML INSTITUCIONAL (6 PÁGINAS FIÉIS AO PDF DO USUÁRIO)
  // ─────────────────────────────────────────────────────────────
  gerarHTMLContrato(c) {
    const emp = DB.getEmpresa();
    const brandName = (emp.nome_fantasia || emp.razao_social || 'ANGELIM CONSTRUTORA').toUpperCase();
    
    // Logo SVG / PNG
    const logoPngUrl = 'img/logo.png';
    const logoHeaderHtml = `
      <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:28px;">
        <img src="${logoPngUrl}" alt="Angelim Construtora" style="max-height:56px;max-width:280px;object-fit:contain;" onerror="this.style.display='none'">
        <div style="text-align:left;">
          <div style="font-size:1.35rem;font-weight:900;color:#182713;letter-spacing:1px;line-height:1;">ANGELIM</div>
          <div style="font-size:.68rem;font-weight:800;color:#c9a227;letter-spacing:2px;text-transform:uppercase;">CONSTRUTORA</div>
        </div>
      </div>
    `;

    const valorFmt = Utils.fmt.currency(c.valor);
    const extensoFmt = Utils.extenso(c.valor);
    const areaFmt = `${c.area_m2 || 40}`;
    const areaExtensoFmt = `${areaFmt === '40' ? 'quarenta' : areaFmt}`;
    const valorM2Fmt = c.valor_m2 || Utils.fmt.currency((c.valor || 122000) / (c.area_m2 || 40));

    const valorEntradaFmt = Utils.fmt.currency(c.valor_entrada || 14504.52);
    const extensoEntradaFmt = Utils.extenso(c.valor_entrada || 14504.52);
    const parcelaEntradaFmt = c.parcela_entrada_caixa || 'R$ 10.978,13';

    const [y, m, d] = (Utils.cleanDate(c.data_emissao || c.criado_em) || Utils.today()).split('-');
    const meses = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const dataExtenso = `${parseInt(d, 10)} de ${meses[parseInt(m, 10)]} de ${y}`;

    // Estilo comum de cada folha A4
    const pageStyle = `background:#ffffff;color:#000000;width:100%;max-width:780px;min-height:1100px;padding:50px 60px;border-radius:2px;box-shadow:0 8px 24px rgba(0,0,0,0.25);box-sizing:border-box;position:relative;display:flex;flex-direction:column;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;page-break-after:always;`;

    // ── 1. CAPA DO CONTRATO (PAGE 1) ──────────────────────────
    const capaHtml = `
    <div class="contract-page" style="${pageStyle}justify-content:space-between;align-items:center;text-align:center;">
      <!-- Logo Superior -->
      <div style="width:100%;">
        ${logoHeaderHtml}
      </div>

      <!-- Marca D'água Central Gigante da Angelim -->
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0.18;margin:60px 0;">
        <img src="${logoPngUrl}" alt="Marca D'água" style="max-width:320px;max-height:320px;object-fit:contain;">
        <div style="font-size:2.8rem;font-weight:900;color:#555;letter-spacing:4px;margin-top:10px;">ANGELIM</div>
        <div style="font-size:1.1rem;font-weight:800;color:#777;letter-spacing:6px;">CONSTRUTORA</div>
      </div>

      <!-- Títulos Inferiores -->
      <div style="width:100%;padding-bottom:30px;">
        <h1 style="font-size:1.15rem;font-weight:900;color:#000;text-transform:uppercase;margin:0 0 10px 0;letter-spacing:0.5px;">
          ${c.titulo || 'CONTRATO DE PRESTAÇÃO DE SERVIÇO DE CONSTRUÇÃO'}
        </h1>
        <h2 style="font-size:1.05rem;font-weight:900;color:#000;text-transform:uppercase;margin:0 0 14px 0;">
          ${brandName}
        </h2>
        <div style="font-size:.84rem;font-weight:700;color:#222;text-transform:uppercase;margin-bottom:6px;">
          (CONTRATO ANTERIOR A CAIXA - ${c.contratante_nome.toUpperCase()})
        </div>
        <div style="font-size:.88rem;font-weight:900;color:#000;margin-bottom:28px;">
          MCMV
        </div>
        <div style="font-size:.84rem;font-weight:900;color:#000;margin-bottom:4px;">
          ${brandName}
        </div>
        <div style="font-size:.78rem;color:#333;margin-bottom:4px;">
          ${c.contratada_endereco || 'Rua Andrômeda, nº 228, bairro Cidade Satélite'}
        </div>
        <div style="font-size:.78rem;color:#333;">
          Contato: (95) 99142-3559 - email: angelimconstrutora@gmail.com
        </div>
      </div>
    </div>`;

    // ── 2. PÁGINA 2: PARTES E CLÁUSULA 01 ─────────────────────
    const pag2Html = `
    <div class="contract-page" style="${pageStyle}">
      ${logoHeaderHtml}

      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="font-size:1rem;font-weight:900;color:#000;text-decoration:underline;text-transform:uppercase;margin:0 0 16px 0;line-height:1.4;">
          INSTRUMENTO PARTICULAR DE PROPOSTA DE CONTRATAÇÃO DE SERVIÇOS DE CONSTRUÇÃO CIVIL DE UNIDADE RESIDENCIAL
        </h2>
        <div style="font-size:.9rem;font-weight:700;color:#000;text-align:left;margin-bottom:12px;">
          Pelo presente instrumento particular, de um lado:
        </div>
        <div style="font-size:.9rem;font-weight:900;color:#000;text-align:left;margin-bottom:8px;">
          DAS PARTES
        </div>
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:18px;">
        <strong>CONTRATANTE: ${c.contratante_nome.toUpperCase()}</strong>, ${c.contratante_estado_civil || 'brasileira, solteira'}, nascida em ${c.contratante_nascimento || '24 de setembro de 2004'}, portadora da Cédula de Identidade RG nº ${c.contratante_rg || '541284-6 SSP/RR'}, inscrita no CPF nº ${c.contratante_doc}, residente e domiciliada na ${c.contratante_endereco || 'Rua Estrela Bonita, nº 782, bairro Raiar do Sol'}, ${c.contratante_cidade_uf || 'CEP 69.316-020, na cidade de Boa Vista/RR'}, telefone ${c.contratante_telefone || '(95) 99921-8593'}, e-mail: ${c.contratante_email || 'camilytulyana9@gmail.com'}, doravante denominada simplesmente <strong>CONTRATANTE</strong>.
      </div>

      <div style="font-size:.88rem;font-weight:700;margin-bottom:14px;">
        E, de outro lado:
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:24px;">
        <strong>CONTRATADA: ${brandName} LTDA</strong>, devidamente inscrita no CNPJ de nº ${c.contratada_doc || '65.512.273/0001-60'}, com sede na ${c.contratada_endereco || 'Rua Andrômeda, nº 228, Bairro Cidade Satélite, Boa Vista/RR'}, neste ato representada por sua Administradora <strong>${c.contratada_rep || 'Naira de Amorim da Silva, brasileira, solteira, não convivente em regime de união estável, nascida em 07 de agosto de 1999, portadora da Cédula de Identidade RG nº 386634-3 SSP/RR, inscrita no CPF nº 029.525.532-38'}</strong>, doravante denominada simplesmente <strong>CONTRATADA</strong>.
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:28px;">
        As partes acima identificadas têm, entre si, justo e acordado o presente <strong>INSTRUMENTO DE PROPOSTA DE CONTRATAÇÃO FUTURA DE SERVIÇOS DE CONSTRUÇÃO CIVIL DE UNIDADE RESIDENCIAL</strong>, que se regerá pelas cláusulas e condições seguintes.
      </div>

      <div style="font-size:.9rem;font-weight:900;color:#000;text-decoration:underline;margin-bottom:12px;">
        DO OBJETO
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;">
        <strong>CLÁUSULA 01 –</strong> O presente instrumento tem por objeto a proposta de contratação futura dos serviços de GESTÃO DE OBRA, compreendendo a aquisição de materiais e a contratação de mão de obra necessária à execução da obra, condicionada à aprovação e formalização do financiamento bancário.
      </div>

      <div style="margin-top:auto;text-align:right;font-size:.8rem;color:#444;">
        Página 2 de 6
      </div>
    </div>`;

    // ── 3. PÁGINA 3: CLÁUSULAS 02 A 07 ────────────────────────
    const pag3Html = `
    <div class="contract-page" style="${pageStyle}">
      ${logoHeaderHtml}

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:18px;">
        <strong>CLÁUSULA 02 –</strong> A área a ser construída será de <strong>${areaFmt}m² (${areaExtensoFmt} metros quadrados)</strong>, conforme projeto de engenharia apresentado à instituição bancária financeira e de acordo com o respectivo Memorial Descritivo.
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:28px;">
        <strong>CLÁUSULA 03 –</strong> O terreno o qual a obra será executada ainda está em fase de negociação/definição, nesse caso, a CONTRATADA fica durante <strong>${c.dias_terreno || 15} dias</strong> à espera da definição da CONTRATANTE a respeito dessa decisão.
      </div>

      <div style="font-size:.9rem;font-weight:900;color:#000;text-decoration:underline;margin-bottom:12px;">
        DO VALOR
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:18px;">
        <strong>CLÁUSULA 04 –</strong> O valor total estimado da obra é de <strong>${valorFmt} (${extensoFmt})</strong>, correspondente ao valor de <strong>${valorM2Fmt}</strong> por metro quadrado de área construída, englobando as despesas com:
        <br>(i) aquisição de materiais;
        <br>(ii) contratação de mão de obra; e
        <br>(iii) serviço de gestão da obra.
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:18px;">
        <strong>CLÁUSULA 05 –</strong> Caso o contrato de financiamento bancário não seja formalizado no prazo de até 04 (quatro) meses contados do protocolo da proposta junto à instituição financeira, o valor mencionado na cláusula anterior poderá ser reajustado, conforme valores praticados à época da efetiva contratação.
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:28px;">
        <strong>CLÁUSULA 05.a –</strong> Na hipótese de reajuste, faculta-se à CONTRATANTE desistir da contratação, caso não concorde com o novo valor, sem incidência de multa ou ônus rescisório.
      </div>

      <div style="font-size:.9rem;font-weight:900;color:#000;text-decoration:underline;margin-bottom:12px;">
        DA FORMA DE PAGAMENTO
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;">
        <strong>CLÁUSULA 07 –</strong> O valor global da obra será pago mediante recursos provenientes de financiamento habitacional junto à Caixa Econômica Federal, acrescidos de recursos próprios da CONTRATANTE.
      </div>

      <div style="margin-top:auto;text-align:right;font-size:.8rem;color:#444;">
        Página 3 de 6
      </div>
    </div>`;

    // ── 4. PÁGINA 4: CLÁUSULAS 08 A 12 ────────────────────────
    const pag4Html = `
    <div class="contract-page" style="${pageStyle}">
      ${logoHeaderHtml}

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:18px;">
        <strong>CLÁUSULA 08 –</strong> O valor total referente à entrada, correspondente aos recursos próprios da CONTRATANTE, é de <strong>${valorEntradaFmt} (${extensoEntradaFmt})</strong>, a serem pagos da seguinte forma:
        <br>
        <strong>a) ${parcelaEntradaFmt}</strong>, pagos na data da assinatura do contrato de financiamento junto à Caixa Econômica Federal;
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:18px;">
        <strong>CLÁUSULA 08.a –</strong> Havendo divergência entre o valor de recursos próprios inicialmente informado na proposta de financiamento e o valor efetivamente aprovado, a diferença será diluída nas parcelas vincendas, após a assinatura do contrato bancário.
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:18px;">
        <strong>CLÁUSULA 08.b –</strong> Havendo diferença entre o valor do terreno apresentado na proposta e o valor efetivamente avaliado pela instituição financeira, tal diferença deverá ser quitada diretamente ao proprietário do terreno, antes da assinatura do contrato de financiamento.
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:28px;">
        <strong>CLÁUSULA 09 –</strong> O atraso superior a 30 (trinta) dias no pagamento de quaisquer valores autoriza a rescisão unilateral do presente instrumento pela CONTRATADA, com aplicação de multa equivalente a 6% (seis por cento) sobre o valor total da obra.
      </div>

      <div style="font-size:.9rem;font-weight:900;color:#000;text-decoration:underline;margin-bottom:12px;">
        DO PROCESSO DE FINANCIAMENTO BANCÁRIO
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:18px;">
        <strong>CLÁUSULA 10 –</strong> A CONTRATADA prestará apoio à CONTRATANTE nos trâmites relativos ao processo de financiamento junto à instituição bancária e aos órgãos competentes, não se responsabilizando por atrasos, exigências adicionais, indeferimentos, falhas técnicas, morosidade administrativa ou erros cometidos por tais instituições ou órgãos públicos, inclusive quanto à emissão de documentos, análises, taxas ou prazos.
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:18px;">
        <strong>CLÁUSULA 11 –</strong> O prazo necessário para conclusão do processo de financiamento, até a assinatura do contrato bancário, não será de responsabilidade da CONTRATADA, por tratar-se de procedimento alheio à sua ingerência.
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;">
        <strong>CLÁUSULA 12 –</strong> A proposta de financiamento é composta por simulação de crédito habitacional, projetos de engenharia e documentação do terreno e de seu proprietário.
      </div>

      <div style="margin-top:auto;text-align:right;font-size:.8rem;color:#444;">
        Página 4 de 6
      </div>
    </div>`;

    // ── 5. PÁGINA 5: CLÁUSULAS 12.a A 18 ──────────────────────
    const pag5Html = `
    <div class="contract-page" style="${pageStyle}">
      ${logoHeaderHtml}

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:24px;">
        <strong>CLÁUSULA 12.a –</strong> Os valores constantes da proposta de financiamento poderão sofrer alterações conforme critérios, normas internas e políticas da instituição financeira, sem qualquer responsabilidade da CONTRATADA.
      </div>

      <div style="font-size:.9rem;font-weight:900;color:#000;text-decoration:underline;margin-bottom:12px;">
        DA ELABORAÇÃO DO PROJETO DE ENGENHARIA
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:18px;">
        <strong>CLÁUSULA 13 –</strong> Todos os custos referentes à elaboração do projeto de engenharia, incluindo honorários técnicos e taxas, serão de responsabilidade exclusiva da CONTRATANTE.
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:24px;">
        <strong>CLÁUSULA 14 –</strong> A CONTRATADA compromete-se a auxiliar a CONTRATANTE na intermediação com os profissionais responsáveis pela elaboração do projeto de engenharia.
      </div>

      <div style="font-size:.9rem;font-weight:900;color:#000;text-decoration:underline;margin-bottom:12px;">
        DOS PRAZOS
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:18px;">
        <strong>CLÁUSULA 15 –</strong> O presente instrumento terá vigência de 05 (cinco) meses, contados da data de protocolo da proposta de financiamento, ou até a assinatura do contrato definitivo de prestação de serviços, podendo ser prorrogado mediante acordo entre as partes.
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:18px;">
        <strong>CLÁUSULA 16 –</strong> Em até 02 (dois) dias úteis após a assinatura do contrato de financiamento, as partes deverão celebrar o contrato definitivo de prestação de serviços de construção civil.
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:24px;">
        <strong>CLÁUSULA 16.a –</strong> O prazo para execução da obra será de 05 (cinco) meses, contados a partir da assinatura do contrato definitivo de construção.
      </div>

      <div style="font-size:.9rem;font-weight:900;color:#000;text-decoration:underline;margin-bottom:12px;">
        DAS OBRIGAÇÕES E CONDIÇÕES GERAIS
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:18px;">
        <strong>CLÁUSULA 17 –</strong> A CONTRATANTE será responsável pelo pagamento de todos os impostos, taxas, encargos e custos relacionados à legalização da obra junto aos órgãos públicos competentes.
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;">
        <strong>CLÁUSULA 18 –</strong> A desistência ou o descumprimento de quaisquer cláusulas deste instrumento implicará sua rescisão, sujeitando a parte inadimplente ao pagamento de multa correspondente a 6% (seis por cento) do valor total da obra.
      </div>

      <div style="margin-top:auto;text-align:right;font-size:.8rem;color:#444;">
        Página 5 de 6
      </div>
    </div>`;

    // ── 6. PÁGINA 6: CLÁUSULAS 19, 20 E ASSINATURAS ───────────
    const pag6Html = `
    <div class="contract-page" style="${pageStyle}">
      ${logoHeaderHtml}

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:18px;">
        <strong>CLÁUSULA 19 –</strong> Fica eleito o foro da Comarca de Boa Vista/RR, com renúncia expressa de qualquer outro, por mais privilegiado que seja.
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:28px;">
        <strong>CLÁUSULA 20 –</strong> O presente instrumento entra em vigor na data de sua assinatura.
      </div>

      <div style="font-size:.88rem;line-height:1.8;text-align:justify;margin-bottom:28px;">
        E, por estarem justas e contratadas, as partes assinam o presente instrumento em duas vias de igual teor, juntamente com duas testemunhas.
      </div>

      <div style="font-size:.9rem;font-weight:700;color:#000;margin-bottom:45px;">
        Boa Vista/RR, ${dataExtenso}.
      </div>

      <!-- Assinatura CONTRATADA (Angelim) -->
      <div style="text-align:center;margin-bottom:40px;">
        ${c.assinatura_contratada?.imagem_base64 ? `<img src="${c.assinatura_contratada.imagem_base64}" alt="Assinatura" style="max-height:55px;display:block;margin:0 auto 2px auto;">` : ''}
        <div style="border-top:1.5px solid #000;width:82%;margin:0 auto 6px auto;"></div>
        <strong style="font-size:.92rem;color:#000;display:block;">${brandName}</strong>
        <span style="font-size:.84rem;color:#222;display:block;">Naira de Amorim da Silva</span>
        <span style="font-size:.75rem;font-weight:700;color:#444;text-transform:uppercase;">CONTRATADA</span>
        ${c.assinatura_contratada ? Assinador.renderCarimboAssinatura(c.assinatura_contratada, { docTipo: 'contrato', docId: c.id }) : ''}
      </div>

      <!-- Assinatura CONTRATANTE (Cliente) -->
      <div style="text-align:center;margin-bottom:40px;">
        ${c.assinatura_contratante?.imagem_base64 ? `<img src="${c.assinatura_contratante.imagem_base64}" alt="Assinatura" style="max-height:55px;display:block;margin:0 auto 2px auto;">` : ''}
        <div style="border-top:1.5px solid #000;width:82%;margin:0 auto 6px auto;"></div>
        <strong style="font-size:.92rem;color:#000;display:block;">${c.contratante_nome.toUpperCase()}</strong>
        <span style="font-size:.75rem;font-weight:700;color:#444;text-transform:uppercase;">CONTRATANTE</span>
        ${c.assinatura_contratante ? Assinador.renderCarimboAssinatura(c.assinatura_contratante, { docTipo: 'contrato', docId: c.id }) : ''}
      </div>

      <!-- Testemunhas -->
      <div style="width:75%;margin:0 auto 30px auto;">
        <div style="border-top:1px solid #000;margin-bottom:6px;"></div>
        <span style="font-size:.82rem;color:#000;">Testemunha 1 CPF:</span>
      </div>

      <div style="width:75%;margin:0 auto 18px auto;">
        <div style="border-top:1px solid #000;margin-bottom:6px;"></div>
        <span style="font-size:.82rem;color:#000;">Testemunha 2 CPF:</span>
      </div>

      <!-- Bloco de Validação Criptográfica e QR Code Oficial se assinado -->
      ${(c.assinatura_contratada || c.assinatura_contratante) ? `
      <div style="margin:16px 0 10px 0;background:#f0fdf4;border:1.5px solid #10b981;border-radius:6px;padding:10px 14px;display:flex;align-items:center;gap:14px;text-align:left;">
        <img src="${Assinador.gerarQRCodeUrl(Assinador.gerarUrlValidacao(c.assinatura_contratada || c.assinatura_contratante, 'contrato', c.id), 120)}" alt="QR Code Validação" style="width:62px;height:62px;background:#fff;border:1px solid #10b981;padding:2px;border-radius:4px;flex-shrink:0;">
        <div style="font-size:.7rem;color:#065f46;line-height:1.4;">
          <strong style="font-size:.78rem;display:block;margin-bottom:2px;color:#047857;">VERIFICAÇÃO DE AUTENTICIDADE ELETRÔNICA &bull; LEI FEDERAL 14.063/2020</strong>
          O presente contrato foi assinado eletronicamente sob proteção de integridade criptográfica SHA-256. A autenticidade e identificação dos signatários podem ser consultadas a qualquer momento apontando a câmera para o QR Code ou acessando <strong>finan-as-bay.vercel.app/validar.html</strong> informando o código: <strong style="font-family:monospace;background:#dcfce7;padding:1px 6px;border-radius:3px;color:#065f46;">${(c.assinatura_contratada || c.assinatura_contratante)?.codigo_validacao}</strong>.
        </div>
      </div>` : ''}

      <div style="margin-top:auto;text-align:right;font-size:.8rem;color:#444;">
        Página 6 de 6
      </div>
    </div>`;

    return `
      ${capaHtml}
      ${pag2Html}
      ${pag3Html}
      ${pag4Html}
      ${pag5Html}
      ${pag6Html}
    `;
  },

  imprimirContrato(id) {
    const c = this.getById(id);
    if (!c) return;
    const htmlContrato = this.gerarHTMLContrato(c);

    let printFrame = document.getElementById('angelim-print-frame');
    if (!printFrame) {
      printFrame = document.createElement('iframe');
      printFrame.id = 'angelim-print-frame';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);
    }

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Contrato — ${c.contratante_nome} — Angelim Construtora</title>
          <meta charset="utf-8">
          <style>
            @page { size: A4 portrait; margin: 0; }
            * { box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
              margin: 0; 
              padding: 0; 
              background: #fff; 
              color: #000; 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact; 
            }
            .contract-page {
              width: 210mm !important;
              min-height: 297mm !important;
              max-height: 297mm !important;
              padding: 22mm 24mm !important;
              margin: 0 auto !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              page-break-after: always !important;
              page-break-inside: avoid !important;
              box-sizing: border-box !important;
              position: relative !important;
            }
          </style>
        </head>
        <body>
          ${htmlContrato}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
    }, 450);
  }
};

window.Contratos = Contratos;
