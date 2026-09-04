// js/contratos.js — Módulo Completo Premium de Emissão e Gestão de Contratos de Construção Civil
// Angelim Construtora — Suporte a Assinatura Eletrônica, Gov.br, WhatsApp e GED

const Contratos = {
  _getKey() {
    return (typeof DB !== 'undefined' && DB._ck) ? DB._ck('finobra_contratos') : 'finobra_contratos';
  },

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this._getKey()) || '[]');
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
      status: 'pendente', // pendente, assinado, cancelado
      assinatura_contratante: null,
      assinatura_contratado: null,
      assinatura_testemunha1: null,
      assinatura_testemunha2: null,
      ...contrato
    };
    lista.unshift(item);
    this.salvarLista(lista);
    return item;
  },

  atualizar(id, dados) {
    const lista = this.getAll();
    const idx = lista.findIndex(c => c.id === id);
    if (idx !== -1) {
      lista[idx] = { ...lista[idx], ...dados, atualizado_em: new Date().toISOString() };
      
      // Atualiza status geral se ambas as partes principais assinaram
      if (lista[idx].assinatura_contratante && lista[idx].assinatura_contratado) {
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

  // ─────────────────────────────────────────────────────────────
  // TEMPLATES / MODELOS PRONTOS DE CLÁUSULAS PARA CONSTRUÇÃO CIVIL
  // ─────────────────────────────────────────────────────────────
  getModelos() {
    return {
      empreitada_mao_obra: {
        nome: 'Empreitada Global de Mão de Obra',
        descricao: 'Ideal para contratação de empreiteiros, pedreiros e mestres de obra para etapas completas ou obra toda.',
        tipo: 'prestacao_servicos',
        clausulas: [
          {
            id: 'cl_obj',
            numero: 'CLÁUSULA 1ª',
            titulo: 'DO OBJETO E ESCOPO DOS SERVIÇOS',
            texto: 'O presente contrato tem por objeto a prestação de serviços especializados de construção civil e execução de mão de obra na obra vinculada à CONTRATANTE, localizada em {OBRA_ENDERECO}, sob a responsabilidade técnica e supervisão da equipe de engenharia da CONTRATANTE.'
          },
          {
            id: 'cl_val',
            numero: 'CLÁUSULA 2ª',
            titulo: 'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO',
            texto: 'Pela execução dos serviços descritos neste instrumento, a CONTRATANTE pagará à CONTRATADA o valor global de {VALOR_TOTAL} ({VALOR_EXTENSO}), a ser quitado de acordo com o seguinte cronograma e condições: {FORMA_PAGAMENTO}. Os pagamentos serão liberados exclusivamente após a medição e aprovação formal do serviço pelo engenheiro responsável da obra.'
          },
          {
            id: 'cl_prazo',
            numero: 'CLÁUSULA 3ª',
            titulo: 'DOS PRAZOS E CRONOGRAMA DE EXECUÇÃO',
            texto: 'Os serviços terão início em {DATA_INICIO} e prazo de conclusão previsto para {DATA_PREVISAO} ({PRAZO_DIAS} dias corridos), devendo a CONTRATADA cumprir rigorosamente as datas estabelecidas no cronograma físico-financeiro da obra.'
          },
          {
            id: 'cl_obrig_contratada',
            numero: 'CLÁUSULA 4ª',
            titulo: 'DAS OBRIGAÇÕES DA CONTRATADA',
            texto: 'A CONTRATADA se compromete a: a) Executar os serviços em estrita conformidade com as normas técnicas da ABNT, plantas e projetos executivos; b) Fornecer mão de obra qualificada e ferramentas adequadas para a perfeita execução dos serviços; c) Refazer, às suas próprias expensas e sem ônus para a CONTRATANTE, qualquer serviço executado com vício, imperfeição ou defeito constatado pela fiscalização.'
          },
          {
            id: 'cl_seguranca',
            numero: 'CLÁUSULA 5ª',
            titulo: 'DA SEGURANÇA DO TRABALHO E EPIs (NR-18)',
            texto: 'É dever indeclinável da CONTRATADA exigir e fiscalizar o uso obrigatório e diário de todos os Equipamentos de Proteção Individual (EPIs) adequados para sua equipe no canteiro de obras (capacete, bota com biqueira de aço, óculos, luvas e cinto de segurança onde couber), respondendo civil e administrativamente pelo descumprimento das normas de segurança do trabalho vigentes.'
          },
          {
            id: 'cl_trabalhista',
            numero: 'CLÁUSULA 6ª',
            titulo: 'DA INEXISTÊNCIA DE VÍNCULO EMPREGATÍCIO',
            texto: 'Fica expressamente convencionado que o presente contrato possui natureza estritamente civil e autônoma, nos termos da Lei nº 13.467/2017 e art. 455 da CLT, inexistindo qualquer vínculo de emprego, subordinação jurídica ou previdenciária entre os funcionários ou subcontratados da CONTRATADA e a CONTRATANTE.'
          },
          {
            id: 'cl_retencao',
            numero: 'CLÁUSULA 7ª',
            titulo: 'DA RETENÇÃO TÉCNICA E GARANTIA',
            texto: 'A CONTRATANTE fica autorizada a reter o percentual de 5% (cinco por cento) sobre o valor de cada medição faturada a título de Retenção Técnica de Garantia, montante este que será integralmente liberado à CONTRATADA em até 15 (quinze) dias após a vistoria final e entrega formal e sem ressalvas da obra.'
          },
          {
            id: 'cl_rescisao',
            numero: 'CLÁUSULA 8ª',
            titulo: 'DA RESCISÃO E PENALIDADES',
            texto: 'O presente contrato poderá ser rescindido de pleno direito por qualquer das partes em caso de inadimplemento das obrigações assumidas, abandono da obra por mais de 3 (três) dias úteis consecutivos sem justificativa prévia, ou atraso injustificado na execução do cronograma. A parte infratora incorrerá em multa rescisória fixada em 10% (dez por cento) sobre o saldo remanescente do contrato.'
          },
          {
            id: 'cl_foro',
            numero: 'CLÁUSULA 9ª',
            titulo: 'DO FORO DE ELEIÇÃO',
            texto: 'Para dirimir quaisquer controvérsias oriundas da interpretação ou execução do presente contrato, as partes elegem o foro da Comarca de {CIDADE_UF}, com expressa renúncia a qualquer outro, por mais privilegiado que seja.'
          }
        ]
      },

      subempreitada_etapa: {
        nome: 'Subempreitada por Etapa Específica',
        descricao: 'Contrato focado em serviços pontuais: Instalações Elétricas, Hidrossanitárias, Pintura, Cobertura, Gesso ou Alvenaria.',
        tipo: 'prestacao_servicos',
        clausulas: [
          {
            id: 'cl_obj',
            numero: 'CLÁUSULA 1ª',
            titulo: 'DO OBJETO ESPECÍFICO',
            texto: 'O presente contrato destina-se à execução da etapa específica de serviços descrita como: "{OBJETO_DETALHADO}", a ser executada pela CONTRATADA nas instalações da obra situada em {OBRA_ENDERECO}.'
          },
          {
            id: 'cl_mat',
            numero: 'CLÁUSULA 2ª',
            titulo: 'DO FORNECIMENTO DE MATERIAIS E FERRAMENTAS',
            texto: 'Os materiais básicos e acabamentos necessários para a execução dos serviços serão fornecidos pela CONTRATANTE, competindo exclusivamente à CONTRATADA o fornecimento de ferramentas de mão, equipamentos próprios, maquinário portátil e mão de obra devidamente capacitada.'
          },
          {
            id: 'cl_preco',
            numero: 'CLÁUSULA 3ª',
            titulo: 'DO VALOR E PAGAMENTO POR ETAPA CONCLUÍDA',
            texto: 'O valor total acordado para esta etapa é de {VALOR_TOTAL} ({VALOR_EXTENSO}), a ser pago da seguinte forma: {FORMA_PAGAMENTO}, sempre condicionado ao teste de funcionamento e aprovação técnica dos serviços executados.'
          },
          {
            id: 'cl_prazos',
            numero: 'CLÁUSULA 4ª',
            titulo: 'DO PRAZO DE EXECUÇÃO',
            texto: 'A CONTRATADA iniciará os trabalhos em {DATA_INICIO} com prazo improrrogável de conclusão até {DATA_PREVISAO}, sob pena de desconto diário de 0,5% por dia de atraso injustificado.'
          },
          {
            id: 'cl_qualidade',
            numero: 'CLÁUSULA 5ª',
            titulo: 'DA QUALIDADE E GARANTIA DOS SERVIÇOS',
            texto: 'A CONTRATADA oferece garantia técnica de 01 (um) ano sobre a solidez e perfeito acabamento dos serviços prestados, obrigando-se a sanar sem custos quaisquer inconformidades que venham a surgir no período.'
          },
          {
            id: 'cl_foro',
            numero: 'CLÁUSULA 6ª',
            titulo: 'DO FORO',
            texto: 'As partes elegem o foro da Comarca de {CIDADE_UF} para solução de dúvidas decorrentes deste instrumento.'
          }
        ]
      },

      contrato_cliente_final: {
        nome: 'Contrato de Construção / Reforma com Cliente Final',
        descricao: 'Contrato da Angelim Construtora com o proprietário/cliente final da obra financiada pela Caixa ou com recursos próprios.',
        tipo: 'cliente_obra',
        clausulas: [
          {
            id: 'cl_obj',
            numero: 'CLÁUSULA 1ª',
            titulo: 'DO OBJETO DA CONSTRUÇÃO',
            texto: 'O presente instrumento tem como objeto a construção / reforma residencial unifamiliar no imóvel de propriedade do CONTRATANTE, localizado em {OBRA_ENDERECO}, em conformidade com os projetos arquitetônicos, estruturais, hidrossanitários e elétricos previamente aprovados e vinculados ao Contrato de Financiamento Habitacional da Caixa Econômica Federal nº {NUM_CONTRATO_CAIXA}.'
          },
          {
            id: 'cl_investimento',
            numero: 'CLÁUSULA 2ª',
            titulo: 'DO VALOR GLOBAL E RECURSOS DO FINANCIAMENTO',
            texto: 'O valor global da obra e serviços contratados é de {VALOR_TOTAL} ({VALOR_EXTENSO}), sendo composto pelas parcelas de financiamento bancário concedidas pela Caixa Econômica Federal somadas aos recursos próprios aportados pelo CONTRATANTE, conforme plano de desembolso acordado.'
          },
          {
            id: 'cl_medicoes',
            numero: 'CLÁUSULA 3ª',
            titulo: 'DAS MEDIÇÕES E LIBERAÇÃO DE PARCELAS',
            texto: 'As parcelas do valor contratado serão faturadas e liberadas à CONTRATADA conforme a evolução percentual das etapas de obra atestadas pelos Relatórios de Acompanhamento de Engenharia (RAE) emitidos pelos fiscais da Caixa Econômica Federal e medições internas da construtora.'
          },
          {
            id: 'cl_cronograma',
            numero: 'CLÁUSULA 4ª',
            titulo: 'DO PRAZO E CRONOGRAMA DE ENTREGA',
            texto: 'A CONTRATADA se compromete a entregar a obra concluída e apta para habitação no prazo de {PRAZO_DIAS} dias, com início previsto em {DATA_INICIO} e término estimado para {DATA_PREVISAO}, admitida prorrogação em casos comprovados de chuvas atípicas, atraso nas vistorias bancárias ou caso fortuito/força maior.'
          },
          {
            id: 'cl_garantia',
            numero: 'CLÁUSULA 5ª',
            titulo: 'DA GARANTIA LEGAL DA CONSTRUÇÃO',
            texto: 'A CONTRATADA responde pela solidez e segurança da obra pelo prazo irredutível de 05 (cinco) anos, nos termos do artigo 618 do Código Civil Brasileiro, a contar da data de expedição do Habite-se ou entrega das chaves.'
          },
          {
            id: 'cl_foro',
            numero: 'CLÁUSULA 6ª',
            titulo: 'DO FORO DE ELEIÇÃO',
            texto: 'Fica eleito o foro da Comarca de {CIDADE_UF} para dirimir quaisquer pendências judiciais.'
          }
        ]
      },

      fornecimento_materiais: {
        nome: 'Fornecimento de Materiais com Entrega Programada',
        descricao: 'Contrato com fornecedores de agregados, cimento, aço, esquadrias ou materiais de acabamento.',
        tipo: 'fornecedor',
        clausulas: [
          {
            id: 'cl_obj',
            numero: 'CLÁUSULA 1ª',
            titulo: 'DO OBJETO DO FORNECIMENTO',
            texto: 'Constitui objeto deste contrato o fornecimento programado de materiais de construção descritos em anexo ou na ordem de compra vinculada, com entregas fracionadas conforme solicitação no canteiro de obras em {OBRA_ENDERECO}.'
          },
          {
            id: 'cl_val',
            numero: 'CLÁUSULA 2ª',
            titulo: 'DO PREÇO E CONDIÇÕES DE FATURAMENTO',
            texto: 'O valor total do fornecimento é de {VALOR_TOTAL} ({VALOR_EXTENSO}), a ser faturado mediante emissão de Nota Fiscal Eletrônica (NF-e) correspondente a cada lote entregue e conferido.'
          },
          {
            id: 'cl_qualidade',
            numero: 'CLÁUSULA 3ª',
            titulo: 'DA CONFERÊNCIA E QUALIDADE DOS MATERIAIS',
            texto: 'Os materiais entregues deverão atender às especificações técnicas e normas vigentes. A CONTRATANTE se reserva o direito de recusar qualquer produto avariado, fora de especificação ou com prazo de validade vencido, obrigando-se a FORNECEDORA a efetuar a substituição em até 24 horas.'
          },
          {
            id: 'cl_foro',
            numero: 'CLÁUSULA 4ª',
            titulo: 'DO FORO',
            texto: 'Eleito o foro da Comarca de {CIDADE_UF}.'
          }
        ]
      },

      personalizado: {
        nome: 'Contrato Personalizado em Branco',
        descricao: 'Crie seu contrato com cláusulas totalmente personalizadas.',
        tipo: 'personalizado',
        clausulas: [
          {
            id: 'cl_1',
            numero: 'CLÁUSULA 1ª',
            titulo: 'DO OBJETO',
            texto: 'Descreva aqui o objeto e escopo principal deste contrato.'
          },
          {
            id: 'cl_2',
            numero: 'CLÁUSULA 2ª',
            titulo: 'DO VALOR E FORMA DE PAGAMENTO',
            texto: 'O valor total acordado é de {VALOR_TOTAL} ({VALOR_EXTENSO}), a ser pago mediante as seguintes condições: {FORMA_PAGAMENTO}.'
          },
          {
            id: 'cl_3',
            numero: 'CLÁUSULA 3ª',
            titulo: 'DO FORO',
            texto: 'Fica eleito o foro da Comarca de {CIDADE_UF}.'
          }
        ]
      }
    };
  },

  // ─────────────────────────────────────────────────────────────
  // RENDER DA TELA PRINCIPAL DE CONTRATOS (#contratos)
  // ─────────────────────────────────────────────────────────────
  render(obraId) {
    const lista = this.getAll();
    const cs = DB.getAll('clientes');
    const filtrados = obraId && obraId !== 'todas' ? lista.filter(c => c.obra_id === obraId) : lista;

    const totalValor = filtrados.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0);
    const assinadosQtd = filtrados.filter(c => c.status === 'assinado' || (c.assinatura_contratante && c.assinatura_contratado)).length;
    const pendentesQtd = filtrados.length - assinadosQtd;

    return `
    <div class="page-header">
      <div>
        <h1 class="page-title">📜 Gestão de Contratos de Obras</h1>
        <p class="page-sub">Elabore contratos de empreitada e prestação de serviços com preenchimento automático, cláusulas dinâmicas e assinaturas digitais</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="Contratos.novoContratoModal()">
          + Novo Contrato de Obra
        </button>
      </div>
    </div>

    <!-- Indicadores no Topo -->
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
        <div style="font-size:.72rem;color:var(--text3);text-transform:uppercase;font-weight:800;letter-spacing:0.5px;">Pendentes de Assinatura</div>
        <div style="font-size:1.45rem;font-weight:900;color:#f59e0b;margin-top:2px;">${pendentesQtd}</div>
      </div>
      <div class="card" style="padding:14px 18px;">
        <div style="font-size:.72rem;color:var(--text3);text-transform:uppercase;font-weight:800;letter-spacing:0.5px;">Valor Total Contratado</div>
        <div style="font-size:1.45rem;font-weight:900;color:var(--accent);margin-top:2px;">${Utils.fmt.currency(totalValor)}</div>
      </div>
    </div>

    <!-- Tabela de Contratos -->
    <div class="card" style="padding:0;">
      <div class="card-header" style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div class="card-title">📜 Contratos Registrados (${filtrados.length})</div>
      </div>
      <div class="tbl-wrap" style="border:none;border-radius:0 0 14px 14px;">
        <table>
          <thead>
            <tr>
              <th>Nº Contrato</th>
              <th>Data</th>
              <th>Modelo / Tipo</th>
              <th>Obra / Local</th>
              <th>Partes (Contratante &rarr; Contratada)</th>
              <th style="text-align:right;">Valor Global</th>
              <th style="text-align:center;">Assinaturas</th>
              <th style="text-align:center;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${filtrados.length ? filtrados.map(c => this._renderContratoRow(c)).join('') : `
            <tr>
              <td colspan="8" style="text-align:center;padding:40px;color:var(--text3);">
                Nenhum contrato cadastrado ainda. Clique em "+ Novo Contrato de Obra" para começar.
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

    const sigContratante = c.assinatura_contratante ? '<span class="badge badge-success" title="Contratante Assinou">✓ Contratante</span>' : '<span class="badge" style="background:rgba(148,163,184,.15);color:var(--text3);" title="Aguardando assinatura do Contratante">Contratante ?</span>';
    const sigContratado = c.assinatura_contratado ? '<span class="badge badge-success" title="Contratado Assinou">✓ Contratado</span>' : '<span class="badge" style="background:rgba(148,163,184,.15);color:var(--text3);" title="Aguardando assinatura do Contratado">Contratado ?</span>';

    return `
    <tr>
      <td style="font-weight:800;color:var(--accent);font-family:monospace;white-space:nowrap;">${c.numero}</td>
      <td style="white-space:nowrap;font-weight:600;">${Utils.fmt.date(c.data_emissao || c.criado_em)}</td>
      <td>
        <strong style="color:var(--text);display:block;">${c.titulo || 'Contrato de Obra'}</strong>
        <span style="font-size:.72rem;color:var(--text3);">${c.modelo_nome || 'Prestação de Serviços'}</span>
      </td>
      <td style="color:var(--text2);font-weight:600;">${obraNome}</td>
      <td>
        <div style="font-size:.82rem;"><span style="color:var(--text3);">Contratante:</span> <strong>${c.contratante_nome}</strong></div>
        <div style="font-size:.82rem;"><span style="color:var(--text3);">Contratada:</span> <strong>${c.contratado_nome}</strong></div>
      </td>
      <td style="text-align:right;font-weight:900;color:var(--text);white-space:nowrap;">${Utils.fmt.currency(c.valor)}</td>
      <td style="text-align:center;">
        <div style="display:flex;flex-direction:column;gap:3px;align-items:center;">
          ${sigContratante}
          ${sigContratado}
        </div>
      </td>
      <td style="text-align:center;">
        <div style="display:flex;gap:6px;justify-content:center;align-items:center;">
          <button class="btn btn-sm btn-primary" onclick="Contratos.visualizarContrato('${c.id}')" title="Visualizar minuta, assinaturas e imprimir" style="padding:4px 8px;font-size:.75rem;">
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
  // MODAL DE NOVO CONTRATO / EDIÇÃO COM CLÁUSULAS DINÂMICAS
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

  _abrirFormularioModal(dadosContrato = {}) {
    const cs = DB.getAll('clientes');
    const fs = DB.getAll('fornecedores');
    const emp = DB.getEmpresa();
    const modelos = this.getModelos();
    const isEdit = !!dadosContrato.id;

    // Se é novo, carrega template padrão de empreitada
    const modeloKeyPadrao = dadosContrato.modelo_key || 'empreitada_mao_obra';
    const modeloPadrao = modelos[modeloKeyPadrao] || modelos.empreitada_mao_obra;

    this._clausulasTemporarias = dadosContrato.clausulas && dadosContrato.clausulas.length 
      ? JSON.parse(JSON.stringify(dadosContrato.clausulas))
      : JSON.parse(JSON.stringify(modeloPadrao.clausulas));

    const hoje = Utils.today();

    Utils.showModal(`
      <div class="modal" style="max-width:920px;width:96vw;max-height:92vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="flex-shrink:0;">
          <div>
            <span class="modal-title">📜 ${isEdit ? 'Editar Contrato' : 'Novo Contrato de Construção Civil'}</span>
            <div style="font-size:.76rem;color:var(--text3);margin-top:2px;">Configure as partes, vincule a obra e formule as cláusulas contratuais</div>
          </div>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>

        <div class="modal-body" style="overflow-y:auto;padding:20px;flex:1;">
          <form id="f-contrato">
            <input type="hidden" name="id" value="${dadosContrato.id || ''}">

            <!-- Etapa 1: Modelo e Obra -->
            <div style="background:var(--bg-secondary);border:1px solid var(--border-s);border-radius:8px;padding:16px;margin-bottom:18px;">
              <div style="font-size:.82rem;font-weight:900;color:var(--accent);text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                <span>1.</span> Modelo de Contrato &amp; Obra Vinculada
              </div>

              <div class="form-row cols-2" style="margin-bottom:12px;">
                <div class="form-group">
                  <label class="form-label">Modelo Pré-definido *</label>
                  <select class="form-control" name="modelo_key" id="ct-modelo-select" onchange="Contratos._onModeloChange(this.value)">
                    ${Object.entries(modelos).map(([k, m]) => `<option value="${k}" ${k===modeloKeyPadrao?'selected':''}>${m.nome}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Obra / Centro de Custo Vinculado *</label>
                  <select class="form-control" name="obra_id" id="ct-obra-select" onchange="Contratos._onObraSelect(this.value)" required>
                    <option value="">Selecione a Obra...</option>
                    ${cs.map(c => `<option value="${c.id}" ${c.id===(dadosContrato.obra_id||App.obraId)?'selected':''}>${c.nome} &mdash; ${c.cidade}/${c.estado} (Contrato: ${c.num_contrato_caixa||'—'})</option>`).join('')}
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Título / Identificação do Contrato *</label>
                <input class="form-control" name="titulo" id="ct-titulo" value="${dadosContrato.titulo || modeloPadrao.nome}" required placeholder="Ex: Contrato de Empreitada de Alvenaria e Reboco">
              </div>
            </div>

            <!-- Etapa 2: Qualificação das Partes -->
            <div style="background:var(--bg-secondary);border:1px solid var(--border-s);border-radius:8px;padding:16px;margin-bottom:18px;">
              <div style="font-size:.82rem;font-weight:900;color:var(--accent);text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                <span>2.</span> Qualificação das Partes (Contratante e Contratada)
              </div>

              <!-- Contratante -->
              <div style="border-left:3px solid var(--accent);padding-left:12px;margin-bottom:14px;">
                <div style="font-size:.78rem;font-weight:800;color:var(--text);margin-bottom:6px;">CONTRATANTE (Quem Contrata / Paga)</div>
                <div class="form-row cols-2" style="margin-bottom:8px;">
                  <div class="form-group">
                    <label class="form-label">Nome / Razão Social *</label>
                    <input class="form-control" name="contratante_nome" id="ct-contratante-nome" value="${dadosContrato.contratante_nome || emp.razao_social || emp.nome_fantasia || 'Angelim Construtora LTDA'}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">CPF ou CNPJ</label>
                    <input class="form-control" name="contratante_doc" id="ct-contratante-doc" value="${dadosContrato.contratante_doc || emp.cnpj || ''}" placeholder="00.000.000/0001-00">
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Endereço Completo do Contratante</label>
                  <input class="form-control" name="contratante_endereco" id="ct-contratante-end" value="${dadosContrato.contratante_endereco || emp.endereco || 'Boa Vista - RR'}">
                </div>
              </div>

              <!-- Contratada -->
              <div style="border-left:3px solid #0284c7;padding-left:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                  <div style="font-size:.78rem;font-weight:800;color:var(--text);">CONTRATADA (Quem Executa os Serviços / Fornecedor)</div>
                  <select class="form-control" style="width:auto;max-width:280px;padding:3px 8px;font-size:.75rem;" onchange="Contratos._onFornecedorSelect(this.value)">
                    <option value="">Puxar Fornecedor Cadastrado...</option>
                    ${fs.map(f => `<option value="${f.id}">${f.nome} &mdash; ${f.cnpj||f.cnpj_cpf||'S/ CPF'}</option>`).join('')}
                  </select>
                </div>
                
                <div class="form-row cols-2" style="margin-bottom:8px;">
                  <div class="form-group">
                    <label class="form-label">Nome / Razão Social do Prestador *</label>
                    <input class="form-control" name="contratado_nome" id="ct-contratado-nome" value="${dadosContrato.contratado_nome || ''}" required placeholder="Nome do profissional, mestre ou empreiteira">
                  </div>
                  <div class="form-group">
                    <label class="form-label">CPF ou CNPJ</label>
                    <input class="form-control" name="contratado_doc" id="ct-contratado-doc" value="${dadosContrato.contratado_doc || ''}" placeholder="000.000.000-00">
                  </div>
                </div>

                <div class="form-row cols-2" style="margin-bottom:8px;">
                  <div class="form-group">
                    <label class="form-label">Telefone / WhatsApp</label>
                    <input class="form-control" name="contratado_telefone" id="ct-contratado-tel" value="${dadosContrato.contratado_telefone || ''}" placeholder="(00) 00000-0000">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Chave PIX / Dados Bancários</label>
                    <input class="form-control" name="contratado_pix" id="ct-contratado-pix" value="${dadosContrato.contratado_pix || ''}" placeholder="Chave PIX para quitação">
                  </div>
                </div>
              </div>
            </div>

            <!-- Etapa 3: Valores, Prazos e Objeto -->
            <div style="background:var(--bg-secondary);border:1px solid var(--border-s);border-radius:8px;padding:16px;margin-bottom:18px;">
              <div style="font-size:.82rem;font-weight:900;color:var(--accent);text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                <span>3.</span> Valores, Condições e Prazos
              </div>

              <div class="form-row cols-3" style="margin-bottom:12px;">
                <div class="form-group">
                  <label class="form-label">Valor Global (R$) *</label>
                  <div class="input-prefix">
                    <span class="input-pfx-txt">R$</span>
                    <input class="form-control" type="number" step="0.01" min="0.01" name="valor" id="ct-valor" value="${dadosContrato.valor || ''}" required placeholder="0,00">
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Data de Início Prevista *</label>
                  <input class="form-control" type="date" name="data_inicio" id="ct-inicio" value="${dadosContrato.data_inicio || hoje}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Data de Conclusão Prevista *</label>
                  <input class="form-control" type="date" name="data_previsao" id="ct-termino" value="${dadosContrato.data_previsao || hoje}" required>
                </div>
              </div>

              <div class="form-group" style="margin-bottom:12px;">
                <label class="form-label">Forma e Condições de Pagamento *</label>
                <input class="form-control" name="forma_pagamento" id="ct-forma-pag" value="${dadosContrato.forma_pagamento || 'Conforme medições semanais aprovadas pelo engenheiro da obra, com retenção técnica de 5%'}" required placeholder="Ex: 30% de entrada e o restante dividido em 4 medições quinzenais">
              </div>

              <div class="form-group">
                <label class="form-label">Endereço Físico do Canteiro de Obras *</label>
                <input class="form-control" name="obra_endereco" id="ct-obra-endereco" value="${dadosContrato.obra_endereco || ''}" required placeholder="Rua, Número, Bairro, Cidade - UF">
              </div>
            </div>

            <!-- Etapa 4: Formulador Dinâmico de Cláusulas -->
            <div style="background:var(--bg-secondary);border:1px solid var(--border-s);border-radius:8px;padding:16px;margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                <div>
                  <div style="font-size:.82rem;font-weight:900;color:var(--accent);text-transform:uppercase;display:flex;align-items:center;gap:6px;">
                    <span>4.</span> Cláusulas Contratuais Dinâmicas
                  </div>
                  <div style="font-size:.72rem;color:var(--text3);margin-top:2px;">
                    Edite livremente o texto, reordene, remova ou adicione novas regras ao contrato.
                  </div>
                </div>
                <button type="button" class="btn btn-sm btn-primary" onclick="Contratos.adicionarClausula()" style="font-size:.76rem;padding:5px 10px;">
                  + Adicionar Nova Cláusula
                </button>
              </div>

              <!-- Lista de Cláusulas Renderizadas -->
              <div id="ct-clausulas-container" style="display:flex;flex-direction:column;gap:12px;">
                <!-- Preenchido dinamicamente por Contratos._renderClausulasNoForm() -->
              </div>
            </div>
          </form>
        </div>

        <div class="modal-footer" style="flex-shrink:0;display:flex;justify-content:space-between;align-items:center;">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary" onclick="Contratos.salvarContratoSubmit()">
              💾 Salvar Contrato &amp; Visualizar Minuta
            </button>
          </div>
        </div>
      </div>
    `);

    setTimeout(() => {
      this._renderClausulasNoForm();
      if (!dadosContrato.obra_endereco && dadosContrato.obra_id) {
        this._onObraSelect(dadosContrato.obra_id);
      }
    }, 80);
  },

  _renderClausulasNoForm() {
    const container = document.getElementById('ct-clausulas-container');
    if (!container) return;

    if (!this._clausulasTemporarias.length) {
      container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3);font-size:.8rem;">Nenhuma cláusula definida. Clique no botão acima para adicionar.</div>`;
      return;
    }

    container.innerHTML = this._clausulasTemporarias.map((cl, idx) => `
      <div class="card" style="padding:12px 14px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;position:relative;" data-cl-idx="${idx}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;flex:1;">
            <input class="form-control" style="font-weight:900;font-size:.78rem;color:var(--accent);width:150px;padding:3px 8px;" value="${cl.numero || `CLÁUSULA ${idx+1}ª`}" onchange="Contratos._atualizarClausula(${idx}, 'numero', this.value)">
            <input class="form-control" style="font-weight:800;font-size:.78rem;color:var(--text);flex:1;padding:3px 8px;" value="${cl.titulo || ''}" placeholder="Título da Cláusula" onchange="Contratos._atualizarClausula(${idx}, 'titulo', this.value)">
          </div>

          <div style="display:flex;gap:4px;">
            ${idx > 0 ? `<button type="button" class="icon-btn btn-sm" onclick="Contratos._moverClausula(${idx}, -1)" title="Subir cláusula" style="font-size:.75rem;">⬆️</button>` : ''}
            ${idx < this._clausulasTemporarias.length - 1 ? `<button type="button" class="icon-btn btn-sm" onclick="Contratos._moverClausula(${idx}, 1)" title="Descer cláusula" style="font-size:.75rem;">⬇️</button>` : ''}
            <button type="button" class="icon-btn btn-sm" onclick="Contratos._removerClausula(${idx})" title="Excluir cláusula" style="color:var(--danger);font-size:.75rem;">🗑️</button>
          </div>
        </div>

        <textarea class="form-control" rows="3" style="font-size:.82rem;line-height:1.5;resize:vertical;" onchange="Contratos._atualizarClausula(${idx}, 'texto', this.value)" placeholder="Texto detalhado da cláusula">${cl.texto || ''}</textarea>
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
      numero: `CLÁUSULA ${num}ª`,
      titulo: 'NOVA CLÁUSULA',
      texto: 'Descreva os termos, condições ou penalidades desta cláusula.'
    });
    this._renderClausulasNoForm();
  },

  _removerClausula(idx) {
    this._clausulasTemporarias.splice(idx, 1);
    this._renderClausulasNoForm();
  },

  _moverClausula(idx, dir) {
    const novoIdx = idx + dir;
    if (novoIdx < 0 || novoIdx >= this._clausulasTemporarias.length) return;
    const item = this._clausulasTemporarias.splice(idx, 1)[0];
    this._clausulasTemporarias.splice(novoIdx, 0, item);
    this._renderClausulasNoForm();
  },

  _onModeloChange(modeloKey) {
    const modelos = this.getModelos();
    const mod = modelos[modeloKey];
    if (!mod) return;

    const tituloInput = document.getElementById('ct-titulo');
    if (tituloInput && (!tituloInput.value || Object.values(modelos).some(m => m.nome === tituloInput.value))) {
      tituloInput.value = mod.nome;
    }

    Utils.confirm(`Deseja carregar as cláusulas padrão do modelo "${mod.nome}"? As cláusulas atuais serão substituídas.`, () => {
      this._clausulasTemporarias = JSON.parse(JSON.stringify(mod.clausulas));
      this._renderClausulasNoForm();
    });
  },

  _onObraSelect(obraId) {
    if (!obraId) return;
    const cli = DB.getById('clientes', obraId);
    if (!cli) return;

    const endInput = document.getElementById('ct-obra-endereco');
    if (endInput && !endInput.value) {
      endInput.value = `${cli.endereco || cli.cidade || 'Boa Vista'} - ${cli.cidade}/${cli.estado}`;
    }

    // Se o contratante for o cliente da obra (ex: no modelo com cliente final)
    const modeloSelect = document.getElementById('ct-modelo-select');
    if (modeloSelect && modeloSelect.value === 'contrato_cliente_final') {
      const cNome = document.getElementById('ct-contratante-nome');
      const cDoc = document.getElementById('ct-contratante-doc');
      const cEnd = document.getElementById('ct-contratante-end');
      if (cNome) cNome.value = cli.nome;
      if (cDoc) cDoc.value = cli.cpf_cnpj || '';
      if (cEnd) cEnd.value = cli.endereco ? `${cli.endereco}, ${cli.cidade}/${cli.estado}` : `${cli.cidade}/${cli.estado}`;
    }
  },

  _onFornecedorSelect(fornId) {
    if (!fornId) return;
    const f = DB.getById('fornecedores', fornId);
    if (!f) return;

    const n = document.getElementById('ct-contratado-nome');
    const d = document.getElementById('ct-contratado-doc');
    const t = document.getElementById('ct-contratado-tel');
    const p = document.getElementById('ct-contratado-pix');

    if (n) n.value = f.nome || f.razao_social || '';
    if (d) d.value = f.cnpj || f.cnpj_cpf || '';
    if (t) t.value = f.telefone || '';
    if (p) p.value = f.chave_pix ? `Chave PIX: ${f.chave_pix}` : (f.banco_info || '');
  },

  // ─────────────────────────────────────────────────────────────
  // SALVAR CONTRATO (SUBMIT)
  // ─────────────────────────────────────────────────────────────
  salvarContratoSubmit() {
    const f = document.getElementById('f-contrato');
    if (!f.checkValidity()) { f.reportValidity(); return; }

    const fd = new FormData(f);
    const d = Object.fromEntries(fd);
    d.valor = parseFloat(d.valor) || 0;
    d.clausulas = this._clausulasTemporarias;

    const modelos = this.getModelos();
    d.modelo_nome = modelos[d.modelo_key]?.nome || 'Contrato de Construção';

    let contratoSalvo;
    if (d.id) {
      contratoSalvo = this.atualizar(d.id, d);
      Utils.toast('Contrato atualizado com sucesso!', 'success');
    } else {
      contratoSalvo = this.adicionar(d);
      Utils.toast('Contrato gerado com sucesso!', 'success');
    }

    Utils.closeModal();

    // Sincronizar com GED / Documentos da Obra
    this._sincronizarComDocumentos(contratoSalvo);

    // Abrir a visualização do contrato
    setTimeout(() => this.visualizarContrato(contratoSalvo.id), 200);

    if (App.route === 'contratos') {
      App.navigate('contratos');
    }
  },

  _sincronizarComDocumentos(c) {
    if (c.obra_id && typeof Documentos !== 'undefined') {
      const htmlDoc = this.gerarHTMLContrato(c);
      Documentos.adicionar({
        entidade_tipo: 'obra',
        entidade_id: c.obra_id,
        titulo: `Contrato Oficial ${c.numero} - ${c.titulo}`,
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
  // COLETAR ASSINATURA DIGITAL DO CONTRATANTE / CONTRATADO / TESTEMUNHA
  // ─────────────────────────────────────────────────────────────
  assinarContrato(id, papelAlvo = 'contratada') {
    const c = this.getById(id);
    if (!c) return;

    if (typeof Assinador === 'undefined') {
      Utils.toast('Módulo Assinador não carregado.', 'error');
      return;
    }

    let tituloAssinatura = 'Assinar Contrato';
    let nomePadrao = '';
    let docPadrao = '';
    let papelTxt = '';

    if (papelAlvo === 'contratante') {
      tituloAssinatura = `Assinatura do CONTRATANTE — Contrato Nº ${c.numero}`;
      nomePadrao = c.contratante_nome || '';
      docPadrao = c.contratante_doc || '';
      papelTxt = 'Contratante';
    } else if (papelAlvo === 'contratado') {
      tituloAssinatura = `Assinatura da CONTRATADA — Contrato Nº ${c.numero}`;
      nomePadrao = c.contratado_nome || '';
      docPadrao = c.contratado_doc || '';
      papelTxt = 'Contratada / Prestador';
    } else if (papelAlvo === 'testemunha1') {
      tituloAssinatura = `Assinatura da 1ª Testemunha — Contrato Nº ${c.numero}`;
      papelTxt = '1ª Testemunha';
    } else {
      tituloAssinatura = `Assinatura da 2ª Testemunha — Contrato Nº ${c.numero}`;
      papelTxt = '2ª Testemunha';
    }

    Assinador.abrirModal({
      titulo: tituloAssinatura,
      subtitulo: `Validação jurídica digital via touchscreen no celular ou mouse`,
      papel: papelTxt,
      nomePredefinido: nomePadrao,
      docPredefinido: docPadrao,
      dadosDocumento: {
        id: c.id,
        numero: c.numero,
        valor: c.valor,
        tipo: 'contrato'
      },
      onSalvar: (sig) => {
        const update = {};
        if (papelAlvo === 'contratante') update.assinatura_contratante = sig;
        else if (papelAlvo === 'contratado') update.assinatura_contratado = sig;
        else if (papelAlvo === 'testemunha1') update.assinatura_testemunha1 = sig;
        else update.assinatura_testemunha2 = sig;

        this.atualizar(id, update);
        const atualizado = this.getById(id);
        this._sincronizarComDocumentos(atualizado);

        Utils.toast(`✅ Assinatura do ${papelTxt} registrada com sucesso!`, 'success');

        if (App.route === 'contratos') App.navigate('contratos');
        setTimeout(() => this.visualizarContrato(id), 150);
      }
    });
  },

  // ─────────────────────────────────────────────────────────────
  // COMPARTILHAR CONTRATO NO WHATSAPP
  // ─────────────────────────────────────────────────────────────
  enviarWhatsApp(id) {
    const c = this.getById(id);
    if (!c) return;

    const cli = DB.getById('clientes', c.obra_id);
    const obraNome = cli ? `${cli.nome} (${cli.cidade}/${cli.estado})` : (c.obra_nome || 'Geral');
    const valorFmt = Utils.fmt.currency(c.valor);
    const sigStatus = (c.assinatura_contratante && c.assinatura_contratado) 
      ? '✅ 100% ASSINADO DIGITALMENTE' 
      : '⏳ AGUARDANDO ASSINATURAS';

    const emp = DB.getEmpresa();
    const brandName = emp.nome_fantasia || emp.razao_social || 'Angelim Construtora';

    const texto = `📜 *MINUTA DE CONTRATO DE OBRA*\n*${brandName.toUpperCase()}*\n\n` +
      `*Contrato Nº:* ${c.numero}\n` +
      `*Título:* ${c.titulo}\n` +
      `*Obra:* ${obraNome}\n` +
      `*Contratante:* ${c.contratante_nome}\n` +
      `*Contratada:* ${c.contratado_nome}\n` +
      `*Valor Global:* ${valorFmt}\n` +
      `*Prazo:* ${Utils.fmt.date(c.data_inicio)} até ${Utils.fmt.date(c.data_previsao)}\n` +
      `*Status:* ${sigStatus}\n\n` +
      `_Acesse o sistema FinObra para visualizar a minuta completa e assinar com seu dedo na tela ou via Gov.br._`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  },

  // ─────────────────────────────────────────────────────────────
  // VISUALIZADOR DO CONTRATO (FORMATO A4 PREMIUM)
  // ─────────────────────────────────────────────────────────────
  visualizarContrato(id) {
    const c = this.getById(id);
    if (!c) return;
    const htmlContrato = this.gerarHTMLContrato(c);

    Utils.showModal(`
      <div class="modal" style="max-width:920px;width:96vw;max-height:94vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="flex-shrink:0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <span class="modal-title">📜 Contrato Nº ${c.numero}</span>
            ${c.status === 'assinado' ? `<span class="badge badge-success" style="margin-left:8px;">✓ Assinado</span>` : `<span class="badge badge-warning" style="margin-left:8px;">Pendente de Assinaturas</span>`}
          </div>

          <!-- Ações de Assinatura e Exportação -->
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            <!-- Assinatura Contratante -->
            <button class="btn btn-sm ${c.assinatura_contratante ? 'btn-secondary' : 'btn-primary'}" onclick="Contratos.assinarContrato('${c.id}', 'contratante')" title="Assinatura do Contratante" style="font-size:.75rem;">
              ✍️ ${c.assinatura_contratante ? '✓ Contratante (Reassinar)' : 'Assinar Contratante'}
            </button>

            <!-- Assinatura Contratado -->
            <button class="btn btn-sm ${c.assinatura_contratado ? 'btn-secondary' : 'btn-primary'}" onclick="Contratos.assinarContrato('${c.id}', 'contratado')" title="Assinatura do Contratado" style="font-size:.75rem;background:${c.assinatura_contratado ? '' : '#10b981'};border-color:${c.assinatura_contratado ? '' : '#10b981'};color:#fff;">
              ✍️ ${c.assinatura_contratado ? '✓ Contratado (Reassinar)' : 'Assinar Contratado'}
            </button>

            <!-- WhatsApp -->
            <button class="btn btn-sm btn-secondary" onclick="Contratos.enviarWhatsApp('${c.id}')" style="color:#25d366;" title="Enviar resumo via WhatsApp">
              📲 WhatsApp
            </button>

            <!-- Gov.br -->
            <button class="btn btn-sm btn-secondary" onclick="Assinador.modalGovBr({ nomeDocumento:'Contrato_${c.numero.replace('/','-')}', onBaixarPDF: () => Contratos.imprimirContrato('${c.id}') })" style="color:#0284c7;" title="Assinar oficialmente pelo Gov.br">
              🏛️ Gov.br
            </button>

            <!-- Imprimir / PDF -->
            <button class="btn btn-sm btn-primary" onclick="Contratos.imprimirContrato('${c.id}')">
              🖨️ Imprimir / PDF
            </button>

            <button class="modal-close" onclick="Utils.closeModal()">✕</button>
          </div>
        </div>

        <div class="modal-body" style="background:#334155;padding:24px;overflow-y:auto;flex:1;display:flex;justify-content:center;">
          <div style="background:#ffffff;color:#0f172a;width:100%;max-width:760px;padding:44px;border-radius:4px;box-shadow:0 12px 35px rgba(0,0,0,0.35);font-family:'Segoe UI',Georgia,serif;">
            ${htmlContrato}
          </div>
        </div>
      </div>
    `);
  },

  // ─────────────────────────────────────────────────────────────
  // GERADOR DO HTML INSTITUCIONAL DO CONTRATO
  // ─────────────────────────────────────────────────────────────
  gerarHTMLContrato(c) {
    const emp = DB.getEmpresa();
    const brandName = (emp.nome_fantasia || emp.razao_social || 'Angelim Construtora').toUpperCase();
    const logoHtml = emp.logo_url 
      ? `<img src="${emp.logo_url}" alt="${brandName}" style="max-width:65px;max-height:65px;border-radius:6px;border:1px solid #c9a227;object-fit:contain;">`
      : `<div style="width:48px;height:48px;border-radius:6px;background:#182713;border:1px solid #c9a227;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">🏢</div>`;

    const cli = DB.getById('clientes', c.obra_id);
    const obraNome = cli ? `${cli.nome} (${cli.cidade}/${cli.estado})` : (c.obra_nome || 'Obra Geral');
    const valorFmt = Utils.fmt.currency(c.valor);
    const extensoFmt = Utils.extenso(c.valor);

    const [y, m, d] = (Utils.cleanDate(c.data_emissao || c.criado_em) || Utils.today()).split('-');
    const meses = ['','janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const dataExtenso = `${parseInt(d, 10)} de ${meses[parseInt(m, 10)]} de ${y}`;

    // Substituição de variáveis no texto das cláusulas
    const replaceVars = (txt) => {
      if (!txt) return '';
      return txt
        .replace(/\{OBRA_NOME\}/g, obraNome)
        .replace(/\{OBRA_ENDERECO\}/g, c.obra_endereco || (cli ? `${cli.endereco}, ${cli.cidade}/${cli.estado}` : 'Boa Vista - RR'))
        .replace(/\{CONTRATANTE_NOME\}/g, c.contratante_nome || brandName)
        .replace(/\{CONTRATANTE_DOC\}/g, c.contratante_doc || emp.cnpj || '')
        .replace(/\{CONTRATANTE_ENDERECO\}/g, c.contratante_endereco || emp.endereco || '')
        .replace(/\{CONTRATADO_NOME\}/g, c.contratado_nome || 'CONTRATADA')
        .replace(/\{CONTRATADO_DOC\}/g, c.contratado_doc || '')
        .replace(/\{CONTRATADO_PIX\}/g, c.contratado_pix || '')
        .replace(/\{VALOR_TOTAL\}/g, valorFmt)
        .replace(/\{VALOR_EXTENSO\}/g, extensoFmt)
        .replace(/\{FORMA_PAGAMENTO\}/g, c.forma_pagamento || 'Conforme medições aprovadas')
        .replace(/\{DATA_INICIO\}/g, Utils.fmt.date(c.data_inicio))
        .replace(/\{DATA_PREVISAO\}/g, Utils.fmt.date(c.data_previsao))
        .replace(/\{PRAZO_DIAS\}/g, Utils.diasEntre(c.data_inicio, c.data_previsao) || '30')
        .replace(/\{NUM_CONTRATO_CAIXA\}/g, cli?.num_contrato_caixa || '—')
        .replace(/\{CIDADE_UF\}/g, cli ? `${cli.cidade} - ${cli.estado}` : (emp.cidade ? `${emp.cidade} - ${emp.uf}` : 'Boa Vista - RR'))
        .replace(/\{OBJETO_DETALHADO\}/g, c.titulo || 'Serviços de Construção Civil');
    };

    // Render das Cláusulas
    const clausulasHtml = (c.clausulas || []).map((cl, idx) => `
      <div style="margin-bottom:18px;text-align:justify;line-height:1.7;font-size:.92rem;color:#0f172a;">
        <strong style="font-size:.94rem;color:#0f172a;letter-spacing:0.2px;">${cl.numero || `CLÁUSULA ${idx+1}ª`} &mdash; ${cl.titulo || ''}</strong>
        <p style="margin:4px 0 0 0;text-indent:28px;">
          ${replaceVars(cl.texto)}
        </p>
      </div>
    `).join('');

    // Assinaturas Digitais Renderizadas
    const renderSigBox = (sig, nomePadrao, docPadrao, papelPadrao) => {
      const sigImg = sig && sig.imagem_base64 
        ? `<div style="margin-bottom:-10px;"><img src="${sig.imagem_base64}" alt="Assinatura" style="max-height:60px;max-width:220px;display:block;margin:0 auto;object-fit:contain;"></div>`
        : `<div style="height:45px;"></div>`;

      const statusEletronico = sig 
        ? `<span style="color:#059669;font-size:.7rem;font-weight:700;display:block;margin-top:2px;">✓ Assinado Eletronicamente em ${sig.data_hora_fmt}</span>`
        : '';

      return `
        <div style="border-top:1.5px solid #0f172a;padding-top:6px;text-align:center;font-size:.8rem;">
          ${sigImg}
          <strong style="color:#0f172a;display:block;font-size:.88rem;">${sig?.nome || nomePadrao}</strong>
          <span style="color:#475569;font-size:.75rem;display:block;">${sig?.doc ? `CPF/CNPJ: ${sig.doc}` : (docPadrao ? `CPF/CNPJ: ${docPadrao}` : '')}</span>
          <span style="color:#64748b;font-size:.72rem;text-transform:uppercase;font-weight:600;">${papelPadrao}</span>
          ${statusEletronico}
        </div>
      `;
    };

    return `
    <div style="color:#0f172a;line-height:1.6;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
      
      <!-- Cabeçalho Institucional -->
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #c9a227;padding-bottom:14px;margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:12px;">
          ${logoHtml}
          <div>
            <div style="font-size:1.18rem;font-weight:900;color:#0f172a;line-height:1.1;letter-spacing:0.5px;">${brandName}</div>
            <div style="font-size:.72rem;font-weight:800;color:#b45309;text-transform:uppercase;">Engenharia Civil &amp; Gestão de Obras</div>
            <div style="font-size:.68rem;color:#64748b;">${emp.endereco || 'Boa Vista - RR'} &bull; ${emp.cnpj ? `CNPJ: ${emp.cnpj}` : ''}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:1.15rem;font-weight:900;color:#0f172a;letter-spacing:0.5px;">INSTRUMENTO DE CONTRATO</div>
          <div style="font-size:.84rem;font-weight:800;color:#0284c7;font-family:monospace;">Nº ${c.numero}</div>
        </div>
      </div>

      <!-- Título Central -->
      <div style="text-align:center;margin-bottom:24px;">
        <h2 style="font-size:1.1rem;font-weight:900;text-transform:uppercase;margin:0;letter-spacing:0.5px;color:#0f172a;">
          ${c.titulo || 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE CONSTRUÇÃO CIVIL'}
        </h2>
        <div style="font-size:.76rem;font-weight:700;color:#64748b;text-transform:uppercase;margin-top:3px;">
          Obra: ${obraNome}
        </div>
      </div>

      <!-- Preâmbulo das Partes -->
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:14px 18px;margin-bottom:22px;font-size:.88rem;line-height:1.7;text-align:justify;">
        Pelo presente instrumento particular, de um lado:
        <br>
        <strong>CONTRATANTE:</strong> <strong style="color:#0f172a;">${c.contratante_nome}</strong>, inscrito(a) no CPF/CNPJ sob o nº <strong>${c.contratante_doc || '—'}</strong>, com sede/domicílio em ${c.contratante_endereco || 'Boa Vista - RR'}; e, de outro lado,
        <br>
        <strong>CONTRATADA:</strong> <strong style="color:#0f172a;">${c.contratado_nome}</strong>, inscrito(a) no CPF/CNPJ sob o nº <strong>${c.contratado_doc || '—'}</strong>${c.contratado_telefone ? `, telefone ${c.contratado_telefone}` : ''};
        <br>
        Têm entre si justo e acordado o presente contrato, que se regerá pelas seguintes cláusulas e condições mutuamente aceitas:
      </div>

      <!-- Cláusulas do Contrato -->
      <div style="margin-bottom:28px;">
        ${clausulasHtml}
      </div>

      <!-- Fechamento e Foro -->
      <div style="margin-bottom:34px;font-size:.9rem;line-height:1.7;text-align:justify;">
        E, por estarem assim justos e contratados, assinam o presente instrumento em vias de igual teor e forma, para que produza seus jurídicos e legais efeitos.
        <div style="text-align:right;margin-top:16px;font-weight:700;">
          ${cli?.cidade || emp.cidade || 'Boa Vista - RR'}, ${dataExtenso}.
        </div>
      </div>

      <!-- Bloco de Assinaturas das Partes -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-bottom:28px;">
        ${renderSigBox(c.assinatura_contratante, c.contratante_nome, c.contratante_doc, 'Contratante')}
        ${renderSigBox(c.assinatura_contratado, c.contratado_nome, c.contratado_doc, 'Contratada')}
      </div>

      <!-- Testemunhas (Opcional) -->
      ${(c.assinatura_testemunha1 || c.assinatura_testemunha2) ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-bottom:24px;">
        ${renderSigBox(c.assinatura_testemunha1, '1ª Testemunha', '', 'Testemunha 1')}
        ${renderSigBox(c.assinatura_testemunha2, '2ª Testemunha', '', 'Testemunha 2')}
      </div>` : ''}

      <!-- Carimbos de Auditoria Criptográfica das Assinaturas -->
      ${c.assinatura_contratante ? Assinador.renderCarimboAssinatura(c.assinatura_contratante) : ''}
      ${c.assinatura_contratado ? Assinador.renderCarimboAssinatura(c.assinatura_contratado) : ''}

      <!-- Rodapé do Contrato -->
      <div style="margin-top:24px;border-top:1px dashed #cbd5e1;padding-top:8px;display:flex;justify-content:space-between;align-items:center;font-size:.68rem;color:#94a3b8;">
        <span>Documento emitido eletronicamente via Sistema FinObra</span>
        <span>Autenticação: ${c.numero} &bull; FinObra Digital</span>
      </div>
    </div>`;
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
          <title>Contrato Nº ${c.numero} — ${c.titulo} — Angelim Construtora</title>
          <meta charset="utf-8">
          <style>
            @page { size: A4 portrait; margin: 18mm 15mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          </style>
        </head>
        <body>
          <div style="max-width:760px;margin:0 auto;padding-top:10px;">
            ${htmlContrato}
          </div>
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
