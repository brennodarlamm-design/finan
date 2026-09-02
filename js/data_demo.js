// js/data_demo.js — Fixtures e gerador de dados de demonstração para testes
// Isolado de data.js para manter o motor de banco de dados leve e modular

const DBDemo = {
  _fmtDateAdd(days = 0) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  },

  refreshVencimentos(db) {
    if (!db.isDemoLoaded()) return;
    let lans = db.getAll('lancamentos');
    let mudou = false;
    const prazos = { l021: 6, l026: 9, l022: 15, l027: 21, l023: 28, l024: 38, l025: 52 };
    
    const listaNovos = [
      { id:'l021', obra_id:'cli_001', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(6), descricao:'Boleto Madeireira Central — Esquadrias e Vigas', categoria:'material', valor:14500, status:'a_pagar', fornecedor_beneficiario:'Madeireira Central Ltda', conta_bancaria:'CC 0501-123456-7', codigo_barras:'34191.79001 01043.510047 91020.150008 5 98760001450000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l026', obra_id:'cli_001', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(9), descricao:'Boleto Votorantim Cimentos — CP-II e Argamassa', categoria:'material', valor:3850, status:'a_pagar', fornecedor_beneficiario:'Votorantim Cimentos S.A.', conta_bancaria:'CC 0501-123456-7', codigo_barras:'23793.38128 60000.778899 12000.456789 4 98850000385000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l022', obra_id:'cli_001', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(15), descricao:'Boleto Cerâmica Vale Verde — Tijolos e Pisos', categoria:'material', valor:8200, status:'a_pagar', fornecedor_beneficiario:'Cerâmica Vale Verde', conta_bancaria:'CC 0501-123456-7', codigo_barras:'03399.81234 12345.678901 23456.789012 1 98800000820000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l027', obra_id:'cli_002', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(21), descricao:'Boleto Tubos Tigre — Tubulações e Conexões', categoria:'material', valor:2940, status:'a_pagar', fornecedor_beneficiario:'Tigre Materiais Hidráulicos', conta_bancaria:'CC 0843-987654-3', codigo_barras:'34191.79001 01043.998877 66020.150008 2 98890000294000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l023', obra_id:'cli_001', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(28), descricao:'Boleto Siderúrgica Paulo — Ferragens CA-50', categoria:'material', valor:6800, status:'a_pagar', fornecedor_beneficiario:'Siderúrgica Paulo & Cia', conta_bancaria:'CC 0501-123456-7', codigo_barras:'23793.38128 60000.123456 78000.654321 3 98900000680000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l024', obra_id:'cli_002', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(38), descricao:'Boleto Elétrica Silva — Fiação e Disjuntores', categoria:'material', valor:5400, status:'a_pagar', fornecedor_beneficiario:'Elétrica Silva ME', conta_bancaria:'CC 0843-987654-3', codigo_barras:'10491.82345 98765.432109 87654.321098 7 99000000540000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l025', obra_id:'cli_002', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(52), descricao:'Boleto Tintas Coral — Textura e Pintura', categoria:'material', valor:4300, status:'a_pagar', fornecedor_beneficiario:'Casa das Tintas RR', conta_bancaria:'CC 0843-987654-3', codigo_barras:'00190.00009 01234.567890 12345.678901 9 99200000430000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true }
    ];

    listaNovos.forEach(b => {
      if (!lans.some(l => l.id === b.id)) {
        lans.push(b);
        mudou = true;
      }
    });

    lans = lans.map(l => {
      if (prazos[l.id] !== undefined) {
        mudou = true;
        return {
          ...l,
          data_vencimento: this._fmtDateAdd(prazos[l.id])
        };
      }
      return l;
    });

    if (mudou) db.save('lancamentos', lans);
  },

  seed(db, force = false) {
    if (!force) {
      if (localStorage.getItem(db._ck('finobra_clean_mode')) === 'true' || !db.isDemoLoaded()) {
        return;
      }
    }
    localStorage.removeItem(db._ck('finobra_clean_mode'));
    localStorage.setItem(db._ck('finobra_demo_v2'), 'true');

    let ld = db.getAll('lancamentos');
    const hasEscritorio = ld.some(l => l.obra_id === 'escritorio');

    let changedLans = false;
    ld.forEach(l => {
      if ((l.status === 'pago' || l.status === 'recebido') && !l.data_pagamento) {
        l.data_pagamento = l.data;
        changedLans = true;
      }
    });

    let nd = db.getAll('notas');
    let changedNotas = false;
    nd.forEach(n => {
      if (n.status === 'paga' && !n.data_pagamento) {
        n.data_pagamento = n.data_emissao;
        changedNotas = true;
      }
    });
    if (changedNotas) db.save('notas', nd);

    if (db.isDemoLoaded() && !force) {
      if (!hasEscritorio) {
        const demoAdm = [
          { id:'l_adm_001', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(5), descricao:'Conta de Energia Elétrica — Sede Escritório Central', categoria:'energia', valor:1280, status:'a_pagar', fornecedor_beneficiario:'Equatorial / Roraima Energia', conta_bancaria:'BB — Movimento Principal', codigo_barras:'83640.00001 28000.123456 78901.234567 1 99200000128000', competencia:'2026-08', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
          { id:'l_adm_002', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-10), data_vencimento:this._fmtDateAdd(-5), data_pagamento:this._fmtDateAdd(-5), descricao:'Conta de Água e Esgoto — Sede', categoria:'agua', valor:340, status:'pago', fornecedor_beneficiario:'CAER Companhia de Águas', conta_bancaria:'BB — Movimento Principal', codigo_barras:'83620.00000 34000.987654 32100.123456 8 98800000034000', competencia:'2026-08', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true },
          { id:'l_adm_003', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(3), descricao:'Guia DAS — Simples Nacional (Comp. 07/2026)', categoria:'imposto_simples', valor:4850, status:'a_pagar', fornecedor_beneficiario:'Receita Federal do Brasil / Simples Nacional', conta_bancaria:'BB — Movimento Principal', codigo_barras:'85820.00004 85000.104050 12345.678901 3 99200000485000', competencia:'2026-07', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
          { id:'l_adm_004', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-12), data_vencimento:this._fmtDateAdd(-8), data_pagamento:this._fmtDateAdd(-8), descricao:'Aluguel da Sede Comercial — Angelim Construtora', categoria:'aluguel_sede', valor:3500, status:'pago', fornecedor_beneficiario:'Imobiliária Nova Era Ltda', conta_bancaria:'BB — Movimento Principal', codigo_barras:'00190.00009 01234.567890 12345.678901 9 99200000350000', competencia:'2026-08', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true },
          { id:'l_adm_005', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-15), data_vencimento:this._fmtDateAdd(-10), data_pagamento:this._fmtDateAdd(-10), descricao:'Internet Fibra Óptica Empresarial 500MB + Telefonia', categoria:'internet_tel', valor:249.90, status:'pago', fornecedor_beneficiario:'Vivo / Telefônica Brasil', conta_bancaria:'BB — Movimento Principal', competencia:'2026-08', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true },
          { id:'l_adm_006', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(8), descricao:'Honorários Contábeis e Assessoria Fiscal Mensal', categoria:'contabilidade', valor:1800, status:'a_pagar', fornecedor_beneficiario:'Meta Contabilidade & Consultoria', conta_bancaria:'BB — Movimento Principal', codigo_barras:'23793.38128 60000.123456 78000.654321 3 98900000180000', competencia:'2026-08', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
          { id:'l_adm_007', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-10), data_vencimento:this._fmtDateAdd(-5), data_pagamento:this._fmtDateAdd(-5), descricao:'Folha de Pagamento Funcionários — Equipe Sede', categoria:'salario', valor:14200, status:'pago', fornecedor_beneficiario:'Colaboradores Angelim Construtora', conta_bancaria:'BB — Movimento Principal', competencia:'2026-08', observacoes:'Engenheiro Civil, Projetista CAD, Assistente Financeiro e Recepcionista', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true },
          { id:'l_adm_008', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-10), data_vencimento:this._fmtDateAdd(-5), data_pagamento:this._fmtDateAdd(-5), descricao:'Pró-Labore Sócios Administradores', categoria:'pro_labore', valor:10000, status:'pago', fornecedor_beneficiario:'Sócios Administradores Angelim', conta_bancaria:'BB — Movimento Principal', competencia:'2026-08', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true },
          { id:'l_adm_009', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-18), data_vencimento:this._fmtDateAdd(-15), data_pagamento:this._fmtDateAdd(-15), descricao:'Licenças Softwares AutoCAD & Google Workspace Business', categoria:'software_ti', valor:680, status:'pago', fornecedor_beneficiario:'Autodesk & Google Cloud', conta_bancaria:'BB — Movimento Principal', competencia:'2026-08', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true },
          { id:'l_adm_010', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-5), data_vencimento:this._fmtDateAdd(-2), data_pagamento:this._fmtDateAdd(-2), descricao:'Material de Escritório, Papel A4, Toner e Café/Copa', categoria:'material_escritorio', valor:420, status:'pago', fornecedor_beneficiario:'Papelaria Central & Distribuidora', conta_bancaria:'BB — Movimento Principal', competencia:'2026-08', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true }
        ];
        demoAdm.forEach(item => ld.push(item));
        changedLans = true;
      }
      if (changedLans) db.save('lancamentos', ld);
      this.refreshVencimentos(db);
      return;
    }

    const clientes = [
      { id:'cli_001', nome:'João Carlos Ferreira', cpf_cnpj:'123.456.789-00', telefone:'(15) 99812-3456', email:'joao.ferreira@email.com', endereco:'Rua das Acácias, 120, Jd. Paraíso', cidade:'Sorocaba', estado:'SP', cep:'18040-000', num_contrato_caixa:'0012345-6/0501', agencia_caixa:'0501 — Sorocaba Centro', valor_financiado:285000, valor_proprio:35000, area_construida:120, data_inicio:'2026-01-10', data_previsao_termino:'2026-12-10', status:'em_andamento', engenheiro_responsavel:'Eng. Ricardo Almeida — CREA-SP 123456', observacoes:'Casa térrea 3 quartos, 2 banheiros, garagem', created_at:'2026-01-05T10:00:00Z', _demo:true },
      { id:'cli_002', nome:'Maria Aparecida Santos', cpf_cnpj:'987.654.321-00', telefone:'(19) 99723-8765', email:'maria.santos@email.com', endereco:'Av. Brasil, 450, Vila São Bento', cidade:'Campinas', estado:'SP', cep:'13010-000', num_contrato_caixa:'0098765-4/0843', agencia_caixa:'0843 — Campinas Taquaral', valor_financiado:195000, valor_proprio:20000, area_construida:90, data_inicio:'2026-02-15', data_previsao_termino:'2026-11-15', status:'em_andamento', engenheiro_responsavel:'Eng. Fernanda Costa — CREA-SP 789012', observacoes:'Casa geminada 2 quartos, 1 banheiro', created_at:'2026-02-10T10:00:00Z', _demo:true },
      { id:'cli_003', nome:'Roberto Silva Lima', cpf_cnpj:'456.789.123-00', telefone:'(11) 98765-4321', email:'roberto.lima@email.com', endereco:'Rua das Flores, 78, Jd. Bonfiglioli', cidade:'Jundiaí', estado:'SP', cep:'13200-000', num_contrato_caixa:'0045678-9/0621', agencia_caixa:'0621 — Jundiaí Centro', valor_financiado:350000, valor_proprio:50000, area_construida:160, data_inicio:'2025-06-01', data_previsao_termino:'2026-06-30', status:'concluida', engenheiro_responsavel:'Eng. Marcos Pereira — CREA-SP 345678', observacoes:'Sobrado 4 quartos, suíte, garagem dupla', created_at:'2025-05-25T10:00:00Z', _demo:true }
    ];
    clientes.forEach(c => { const d = db.getAll('clientes'); d.push(c); db.save('clientes', d); });

    const lans = [
      { id:'l001', obra_id:'cli_001', tipo:'receita', data:'2026-01-05', descricao:'Entrada Própria — Início da Obra', categoria:'entrada_propria', valor:35000, status:'recebido', fornecedor_beneficiario:'João Carlos Ferreira', conta_bancaria:'CC 0501-123456-7', observacoes:'Recursos próprios do cliente', origem:'manual', conciliado:true, created_at:'2026-01-05T10:00:00Z', _demo:true },
      { id:'l002', obra_id:'cli_001', tipo:'receita', data:'2026-02-08', descricao:'1ª Parcela Caixa — Medição 01 (25%)', categoria:'parcela_caixa', valor:57000, status:'recebido', fornecedor_beneficiario:'Caixa Econômica Federal', conta_bancaria:'CC 0501-123456-7', observacoes:'Fundação concluída', origem:'medicao', conciliado:true, medicao_id:'med_001', created_at:'2026-02-08T10:00:00Z', _demo:true },
      { id:'l003', obra_id:'cli_001', tipo:'receita', data:'2026-04-10', descricao:'2ª Parcela Caixa — Medição 02 (50%)', categoria:'parcela_caixa', valor:57000, status:'recebido', fornecedor_beneficiario:'Caixa Econômica Federal', conta_bancaria:'CC 0501-123456-7', observacoes:'Estrutura concluída', origem:'medicao', conciliado:true, medicao_id:'med_002', created_at:'2026-04-10T10:00:00Z', _demo:true },
      { id:'l004', obra_id:'cli_001', tipo:'receita', data:'2026-07-15', descricao:'3ª Parcela Caixa — Medição 03 (75%)', categoria:'parcela_caixa', valor:57000, status:'a_receber', fornecedor_beneficiario:'Caixa Econômica Federal', conta_bancaria:'CC 0501-123456-7', observacoes:'Aguardando aprovação da medição', origem:'medicao', conciliado:false, medicao_id:'med_003', created_at:'2026-07-01T10:00:00Z', _demo:true },
      { id:'l010', obra_id:'cli_001', tipo:'despesa', data:'2026-01-20', descricao:'Cimento Portland CP-II (100 sacos)', categoria:'material', valor:3200, status:'pago', fornecedor_beneficiario:'Materiais Para Construção XYZ Ltda', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_001', origem:'manual', conciliado:true, created_at:'2026-01-20T10:00:00Z', _demo:true },
      { id:'l011', obra_id:'cli_001', tipo:'despesa', data:'2026-01-20', descricao:'Areia grossa e brita (10m³)', categoria:'material', valor:2800, status:'pago', fornecedor_beneficiario:'Areeiro São Bento', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_002', origem:'manual', conciliado:true, created_at:'2026-01-20T10:00:00Z', _demo:true },
      { id:'l012', obra_id:'cli_001', tipo:'despesa', data:'2026-01-25', descricao:'Serviço — Fundação e Locação da Obra', categoria:'mao_de_obra', valor:15000, status:'pago', fornecedor_beneficiario:'Empreiteira Lima & Filhos ME', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_003', origem:'manual', conciliado:true, created_at:'2026-01-25T10:00:00Z', _demo:true },
      { id:'l013', obra_id:'cli_001', tipo:'despesa', data:'2026-02-10', descricao:'Aço CA-50 (500 kg)', categoria:'material', valor:4200, status:'pago', fornecedor_beneficiario:'Siderúrgica Paulo & Cia', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_004', origem:'manual', conciliado:true, created_at:'2026-02-10T10:00:00Z', _demo:true },
      { id:'l014', obra_id:'cli_001', tipo:'despesa', data:'2026-02-15', descricao:'Tijolos cerâmicos 9 furos (5.000 un)', categoria:'material', valor:3800, status:'pago', fornecedor_beneficiario:'Cerâmica Vale Verde', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_005', origem:'manual', conciliado:true, created_at:'2026-02-15T10:00:00Z', _demo:true },
      { id:'l015', obra_id:'cli_001', tipo:'despesa', data:'2026-03-01', descricao:'Mão de Obra — Pedreiros (Fev/2026)', categoria:'mao_de_obra', valor:18000, status:'pago', fornecedor_beneficiario:'Empreiteira Lima & Filhos ME', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_006', origem:'manual', conciliado:true, created_at:'2026-03-01T10:00:00Z', _demo:true },
      { id:'l016', obra_id:'cli_001', tipo:'despesa', data:'2026-03-20', descricao:'Caixilhos, janelas e portas internas', categoria:'material', valor:12000, status:'pago', fornecedor_beneficiario:'Madeireira Central Ltda', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_007', origem:'manual', conciliado:true, created_at:'2026-03-20T10:00:00Z', _demo:true },
      { id:'l017', obra_id:'cli_001', tipo:'despesa', data:'2026-04-05', descricao:'Instalação Elétrica Completa', categoria:'servico', valor:8500, status:'pago', fornecedor_beneficiario:'Elétrica Silva ME', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_008', origem:'manual', conciliado:true, created_at:'2026-04-05T10:00:00Z', _demo:true },
      { id:'l018', obra_id:'cli_001', tipo:'despesa', data:'2026-04-15', descricao:'Instalação Hidráulica Completa', categoria:'servico', valor:7200, status:'pago', fornecedor_beneficiario:'Hidráulica Santos ME', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_009', origem:'manual', conciliado:true, created_at:'2026-04-15T10:00:00Z', _demo:true }
    ];
    db.save('lancamentos', lans);

    this.seedSinapi(force);
    console.log('[FinObra] ✅ Dados de demonstração carregados com sucesso!');
  },

  seedSinapi(force = false) {
    const composicoesDemo = [
      { codigo:'98458', descricao:'ALVENARIA DE VEDAÇÃO DE BLOCOS CERÂMICOS FURADOS 9X19X19 CM', unidade:'M2', custo_total:68.50, desonerado:false },
      { codigo:'93358', descricao:'REVESTIMENTO CERÂMICO PARA PISO 45X45 CM', unidade:'M2', custo_total:54.20, desonerado:false },
      { codigo:'94962', descricao:'CONCRETO FCK = 25MPA COM BETONEIRA 400 L', unidade:'M3', custo_total:485.00, desonerado:false },
      { codigo:'96536', descricao:'REGISTRO DE PRESSÃO BRUTO 3/4"', unidade:'UN', custo_total:62.30, desonerado:false },
      { codigo:'92817', descricao:'CORTE E DOBRA DE AÇO CA-50, D = 10,0 MM', unidade:'KG', custo_total:14.80, desonerado:false },
      { codigo:'94441', descricao:'TELHAMENTO COM TELHA CERÂMICA TIPO PORTUGUESA', unidade:'M2', custo_total:88.40, desonerado:false },
      { codigo:'88489', descricao:'PINTURA COM TINTA LÁTEX ACRÍLICA EM PAREDES 2 DEMÃOS', unidade:'M2', custo_total:22.60, desonerado:false },
      { codigo:'91953', descricao:'INTERRUPTOR SIMPLES (1 MÓDULO) 10A/250V', unidade:'UN', custo_total:28.90, desonerado:false },
      { codigo:'97914', descricao:'TUBO PVC ESGOTO PREDIAL DN 100 MM', unidade:'M', custo_total:38.50, desonerado:false },
      { codigo:'98504', descricao:'PLANTIO DE GRAMA ESMERALDA EM PLACAS', unidade:'M2', custo_total:18.20, desonerado:false }
    ];

    if (force || !localStorage.getItem('sinapi_base_onerado')) {
      localStorage.setItem('sinapi_base_onerado', JSON.stringify({
        uf: 'RR', referencia: '2026-07', desonerado: false, importada_em: new Date().toISOString(), composicoes: composicoesDemo
      }));
    }
  }
};
