// js/academia.js — Academia FinGo & Central de Aprendizado Interativo

const Academia = {
  filtroAtual: 'todas',
  buscaTermo: '',
  aulaAtivaId: null,

  trilhas: [
    { id: 'todas', label: 'Todas as Trilhas', icone: '📚' },
    { id: 'obras', label: 'Obras & Canteiro', icone: '🏗️' },
    { id: 'financeiro', label: 'Financeiro & Caixa', icone: '💰' },
    { id: 'fiscal', label: 'Fiscal & Suprimentos', icone: '📄' },
    { id: 'engenharia', label: 'Engenharia & SINAPI', icone: '📐' },
    { id: 'bim', label: 'BIM 3D & Inovação', icone: '🧊' }
  ],

  aulas: [
    {
      id: 'aula-1-inicio-obra',
      trilha: 'obras',
      titulo: 'Como Iniciar uma Obra, Cadastrar Clientes e Etapas',
      duracao: '4 min',
      nivel: 'Iniciante',
      rota: 'obras',
      moduloNome: 'Obras & Clientes',
      videoUrl: '/img/fingo/feature-demo.mp4',
      videoPoster: '/img/fingo/logo-reveal-poster.png',
      videoPlaceholder: 'https://images.unsplash.com/photo-1541888946425-d0fbb186156a?w=800&q=80',
      resumo: 'Aprenda a estruturar uma nova obra, vincular o cliente, prever etapas construtivas e cadastrar o contrato Caixa.',
      passos: [
        'Acesse o menu lateral e clique em <strong>Obras & Clientes</strong>.',
        'Clique no botão <strong>+ Nova Obra</strong> no canto superior direito.',
        'Preencha a Razão Social/Nome do Cliente, CPF/CNPJ, Endereço e Engenheiro Responsável.',
        'Defina as datas previstas de início e término e o valor total do contrato.',
        'Clique em <strong>Salvar Obra</strong> para gerar o painel de controle e cronograma da obra.'
      ],
      dica: 'Definir o número do contrato de financiamento (Caixa Econômica) no cadastro agiliza a aprovação das medições de campo posteriormente.'
    },
    {
      id: 'aula-2-diario-documentacao',
      trilha: 'obras',
      titulo: 'Documentação de Obras, Fotos de Canteiro e Fases',
      duracao: '3 min',
      nivel: 'Iniciante',
      rota: 'documentacao',
      moduloNome: 'Documentação de Obras',
      videoUrl: '/img/fingo/hero-video.mp4',
      videoPoster: '/img/fingo/logo-reveal-poster.png',
      videoPlaceholder: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80',
      resumo: 'Organize alvarás, memoriais descritivos e registre a evolução fotográfica da obra dividida por etapas.',
      passos: [
        'Acesse o módulo <strong>Documentação de Obras</strong>.',
        'Selecione a obra ativa no seletor superior.',
        'Navegue entre as pastas de fases (Fundação, Estrutura, Alvenaria, Acabamento).',
        'Arraste e solte arquivos PDF, projetos ou fotos registradas em campo pelo celular.',
        'Compartilhe o percurso documental com o cliente com 1 clique através do link protegido.'
      ],
      dica: 'Fotos tiradas pelo celular da equipe de campo são salvas e otimizadas automaticamente no cache offline mesmo se o canteiro estiver sem internet.'
    },
    {
      id: 'aula-3-medicoes-faturamento',
      trilha: 'obras',
      titulo: 'Boletim de Medição de Engenharia e Liberação de Valores',
      duracao: '5 min',
      nivel: 'Intermediário',
      rota: 'medicoes',
      moduloNome: 'Medições & Faturamento',
      videoUrl: '/img/fingo/feature-demo.mp4',
      videoPoster: '/img/fingo/logo-reveal-poster.png',
      videoPlaceholder: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800&q=80',
      resumo: 'Como calcular o percentual acumulado de cada serviço, gerar espelho de medição para bancos e liberar valores a receber.',
      passos: [
        'Abra o módulo <strong>Medições & Faturamento</strong>.',
        'Selecione a obra e clique em <strong>+ Nova Medição</strong>.',
        'Informe o percentual executado no período para cada item da planilha.',
        'O FinGo calcula automaticamente o saldo a faturar, retenções técnicas e valor líquido.',
        'Avance o status para <em>Aprovada</em> e gere o espelho de medição em PDF oficial.'
      ],
      dica: 'Medições liberadas podem ser convertidas diretamente em faturas e cobranças PIX com QR code dinâmico no Portal do Cliente.'
    },
    {
      id: 'aula-4-lancamentos-centros-custo',
      trilha: 'financeiro',
      titulo: 'Lançamentos Financeiros, Despesas de Obra vs Escritório',
      duracao: '4 min',
      nivel: 'Iniciante',
      rota: 'lancamentos',
      moduloNome: 'Lançamentos',
      videoUrl: '/img/fingo/feature-demo.mp4',
      videoPoster: '/img/fingo/logo-reveal-poster.png',
      videoPlaceholder: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80',
      resumo: 'Domine a segregação de custos por centro de custo para garantir DRE preciso e saber a margem real de cada obra.',
      passos: [
        'Acesse <strong>Lançamentos</strong> no menu lateral.',
        'Clique em <strong>+ Novo Lançamento</strong> (ou pressione a tecla de atalho).',
        'Selecione o tipo: <em>Despesa</em> ou <em>Receita</em>.',
        'Escolha o Centro de Custo: a Obra específica ou a <em>Sede / Escritório Central</em>.',
        'Defina a Categoria (ex: Materiais, Mão de Obra, Equipamentos, Administrativo) e a data de vencimento.',
        'Anexe o comprovante ou nota e clique em <strong>Salvar</strong>.'
      ],
      dica: 'Nunca misture custos corporativos da construtora com custos diretos da obra para manter o indicador de BDI e margem líquida blindados.'
    },
    {
      id: 'aula-5-conciliacao-ofx',
      trilha: 'financeiro',
      titulo: 'Conciliação Bancária Automática com Extrato OFX',
      duracao: '5 min',
      nivel: 'Avançado',
      rota: 'conciliacao-ofx',
      moduloNome: 'Conciliação OFX',
      videoUrl: '/img/fingo/feature-demo.mp4',
      videoPoster: '/img/fingo/logo-reveal-poster.png',
      videoPlaceholder: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&q=80',
      resumo: 'Importe extratos do seu banco em formato OFX e deixe o robô do FinGo casar as transações automaticamente.',
      passos: [
        'Acesse <strong>Conciliação OFX</strong>.',
        'Baixe o arquivo <code>.ofx</code> do Internet Banking da sua construtora.',
        'Arraste o arquivo para a área de upload do FinGo.',
        'O robô inteligente identificará automaticamente lançamentos que coincidem por valor e data aproximada.',
        'Revise os matches e clique em <strong>Conciliar Todos</strong> ou crie lançamentos para itens novos em 1 clique.'
      ],
      dica: 'Você pode ajustar a tolerância de dias no modal do robô para conciliar compras feitas no fim de semana compensadas na segunda-feira.'
    },
    {
      id: 'aula-6-recibos-oficiais',
      trilha: 'financeiro',
      titulo: 'Emissão de Recibos Oficiais e Assinatura Digital Gov.br',
      duracao: '3 min',
      nivel: 'Iniciante',
      rota: 'recibos',
      moduloNome: 'Recibos Oficiais',
      videoUrl: '/img/fingo/hero-video.mp4',
      videoPoster: '/img/fingo/logo-reveal-poster.png',
      videoPlaceholder: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&q=80',
      resumo: 'Gere recibos para empreiteiros e fornecedores autônomos com QR Code de autenticidade pública e assinatura.',
      passos: [
        'Acesse <strong>Recibos Oficiais</strong> no menu lateral.',
        'Clique em <strong>+ Novo Recibo</strong> e selecione o favorecido e o valor.',
        'O sistema redige o texto por extenso e vincula o recibo à obra correspondente.',
        'Colete a assinatura na tela ou integre com a assinatura digital oficial.',
        'Envie o comprovante instantaneamente pelo WhatsApp do favorecido.'
      ],
      dica: 'Todo recibo gerado no FinGo possui um hash de segurança e pode ser validado no portal público /validar por qualquer pessoa.'
    },
    {
      id: 'aula-7-nfe-ocr-scanner',
      trilha: 'fiscal',
      titulo: 'Leitura Inteligente de NF-e, Importação XML e OCR',
      duracao: '4 min',
      nivel: 'Intermediário',
      rota: 'notas-fiscais',
      moduloNome: 'Notas Fiscais',
      videoUrl: '/img/fingo/feature-demo.mp4',
      videoPoster: '/img/fingo/logo-reveal-poster.png',
      videoPlaceholder: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&q=80',
      resumo: 'Acabe com a digitação manual de notas fiscais de materiais: importe lotes de XML ou fotos de notas em papel.',
      passos: [
        'Abra o módulo <strong>Notas Fiscais</strong>.',
        'Clique em <strong>Importar XML / OCR</strong>.',
        'Arraste arquivos XML de notas ou fotos de cupons/DANFEs.',
        'O motor extrai automaticamente CNPJ do fornecedor, número da nota, itens, impostos e parcelas.',
        'Confirme para gerar a nota e os lançamentos de pagamento no contas a pagar de forma instantânea.'
      ],
      dica: 'Você pode usar a ferramenta Busca NF-e para consultar notas emitidas contra o CNPJ da sua construtora direto na SEFAZ.'
    },
    {
      id: 'aula-8-precompras-suprimentos',
      trilha: 'fiscal',
      titulo: 'Requisições de Pré-Compras e Contratos de Empreiteiros',
      duracao: '4 min',
      nivel: 'Intermediário',
      rota: 'pre-compras',
      moduloNome: 'Pré-Compras',
      videoUrl: '/img/fingo/hero-video.mp4',
      videoPoster: '/img/fingo/logo-reveal-poster.png',
      videoPlaceholder: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80',
      resumo: 'Controle o fluxo de cotações, pedidos de compra do canteiro e aprovações antes de comprometer o caixa.',
      passos: [
        'Acesse <strong>Pré-Compras</strong> no menu lateral.',
        'Mestre de obras ou engenheiro cria a solicitação de materiais (ex: 200 sacos de cimento).',
        'O setor de compras cadastra as cotações de fornecedores.',
        'O gestor financeiro aprova o melhor orçamento com 1 clique.',
        'Ao receber os materiais, converta a pré-compra em nota fiscal ou lançamento com facilidade.'
      ],
      dica: 'O badge no menu lateral alerta o comprador sempre que houver pedidos aguardando cotação ou aprovação urgente.'
    },
    {
      id: 'aula-9-orcamento-sinapi',
      trilha: 'engenharia',
      titulo: 'Orçamento Paramétrico, Composições SINAPI e BDI Caixa',
      duracao: '6 min',
      nivel: 'Avançado',
      rota: 'orcamentos',
      moduloNome: 'Orçamentos',
      videoUrl: '/img/fingo/feature-demo.mp4',
      videoPoster: '/img/fingo/logo-reveal-poster.png',
      videoPlaceholder: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80',
      resumo: 'Construa orçamentos analíticos com a base oficial da Caixa Econômica Federal e aplique taxa de BDI determinística.',
      passos: [
        'Acesse <strong>Orçamentos</strong>.',
        'Crie uma nova planilha e selecione o banco de preços SINAPI do seu estado.',
        'Pesquise composições (ex: alvenaria de bloco, contrapiso, pintura látex).',
        'Insira os quantitativos de projeto.',
        'Defina a porcentagem de BDI (Bonificação e Despesas Indiretas) para calcular o preço de venda exato.'
      ],
      dica: 'O FinGo atualiza os coeficientes desonerados e não desonerados do SINAPI por estado e gera relatórios em formato aceito pela Caixa.'
    },
    {
      id: 'aula-10-proposta-comercial',
      trilha: 'engenharia',
      titulo: 'Geração de Proposta Comercial Profissional para Clientes',
      duracao: '3 min',
      nivel: 'Iniciante',
      rota: 'relatorios',
      moduloNome: 'Exportar Relatórios',
      videoUrl: '/img/fingo/hero-video.mp4',
      videoPoster: '/img/fingo/logo-reveal-poster.png',
      videoPlaceholder: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80',
      resumo: 'Transforme o orçamento técnico em uma proposta executiva atraente com a logomarca da sua construtora.',
      passos: [
        'Acesse <strong>Orçamentos</strong> ou <strong>Exportar Relatórios</strong>.',
        'Selecione a obra e clique em <strong>Gerar Proposta Comercial</strong>.',
        'Escolha o modelo de apresentação (Sintético para cliente final ou Analítico com BDI).',
        'Personalize o texto de introdução, condições de pagamento e prazos.',
        'Exporte em PDF com design premium ou envie diretamente por e-mail e WhatsApp.'
      ],
      dica: 'Uma proposta bem estruturada aumenta a taxa de fechamento de contratos em até 40% ao transmitir transparência técnica.'
    },
    {
      id: 'aula-11-bim-3d-navegacao',
      trilha: 'bim',
      titulo: 'Navegação 3D no Canteiro, Cortes Interativos e Pavimentos',
      duracao: '5 min',
      nivel: 'Intermediário',
      rota: 'obra-detalhe',
      moduloNome: 'BIM Viewer 3D',
      videoUrl: '/img/fingo/feature-demo.mp4',
      videoPoster: '/img/fingo/logo-reveal-poster.png',
      videoPlaceholder: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80',
      resumo: 'Visualize o modelo 3D da edificação direto no navegador com alto desempenho sem travar seu celular.',
      passos: [
        'Abra o painel da obra e acesse a aba <strong>Modelo 3D (BIM)</strong>.',
        'Use o mouse ou toque na tela para orbitar, dar zoom e rotacionar a volumetria.',
        'Ative a ferramenta de <strong>Corte / Plano de Seção</strong> para inspecionar o interior dos cômodos.',
        'Isole pavimentos (Térreo, 1º Andar, Cobertura) para verificar execução de alvenaria e vigas.',
        'Selecione qualquer elemento para ver suas propriedades e dimensões reais.'
      ],
      dica: 'O motor 3D do FinGo conta com LOD inteligente (nível de detalhe adaptativo) para manter taxas fluidas de 60 FPS mesmo em projetos complexos.'
    },
    {
      id: 'aula-12-bim-clash-detection',
      trilha: 'bim',
      titulo: 'Coordenação Espacial e Detecção de Interferências (Clash)',
      duracao: '6 min',
      nivel: 'Avançado',
      rota: 'obra-detalhe',
      moduloNome: 'BIM Clash Detection',
      videoUrl: '/img/fingo/feature-demo.mp4',
      videoPoster: '/img/fingo/logo-reveal-poster.png',
      videoPlaceholder: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&q=80',
      resumo: 'Evite retrabalhos caros na obra: encontre tubulações hidráulicas atravessando vigas antes de concretar.',
      passos: [
        'No visualizador BIM 3D, abra o painel <strong>Clash Detection</strong>.',
        'Selecione as disciplinas para análise cruzada (ex: Estrutura vs Instalações Hidráulicas).',
        'Clique em <strong>Executar Análise de Interferências</strong>.',
        'O motor geométrico BVH analisa cada elemento e destaca em vermelho os pontos de colisão física.',
        'Gere uma pendência de coordenação com foto da colisão para enviar ao projetista.'
      ],
      dica: 'Identificar um clash no modelo digital custa zero reais; quebrar uma viga concretada no canteiro custa milhares de reais e atrasa a entrega.'
    }
  ],

  getProgresso() {
    try {
      const tenant = (typeof Auth !== 'undefined' && Auth.getTenantId) ? Auth.getTenantId() : (Auth?.getUser?.()?.tenant_id || 'default');
      const raw = localStorage.getItem(`finobra_academia_prog_${tenant}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  },

  isConcluido(aulaId) {
    return this.getProgresso().includes(aulaId);
  },

  toggleConcluido(aulaId) {
    const tenant = (typeof Auth !== 'undefined' && Auth.getTenantId) ? Auth.getTenantId() : (Auth?.getUser?.()?.tenant_id || 'default');
    let prog = this.getProgresso();
    const jaConcluido = prog.includes(aulaId);

    if (jaConcluido) {
      prog = prog.filter(id => id !== aulaId);
      if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast('Aula desmarcada como concluída.', 'info');
    } else {
      prog.push(aulaId);
      if (typeof Utils !== 'undefined' && Utils.toast) {
        const aula = this.aulas.find(a => a.id === aulaId);
        Utils.toast(`🎉 Parabéns! Aula "${aula?.titulo || ''}" concluída!`, 'success');
      }
    }

    try {
      localStorage.setItem(`finobra_academia_prog_${tenant}`, JSON.stringify(prog));
    } catch {}

    // Atualiza a visualização da modal
    if (this.aulaAtivaId) {
      this.verAula(this.aulaAtivaId);
    } else {
      this.renderCatalogo();
    }
  },

  abrir(aulaId = null) {
    if (typeof Suporte !== 'undefined' && typeof Suporte.fecharDropdown === 'function') {
      Suporte.fecharDropdown();
    }

    let modal = document.getElementById('academia-fingo-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'academia-fingo-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(6px);padding:14px;';
      document.body.appendChild(modal);
    }

    if (aulaId) {
      this.aulaAtivaId = aulaId;
      this.verAula(aulaId);
    } else {
      this.aulaAtivaId = null;
      this.renderCatalogo();
    }
  },

  fechar() {
    const modal = document.getElementById('academia-fingo-modal');
    if (modal) modal.remove();
    this.aulaAtivaId = null;
  },

  filtrarTrilha(encodedTrilha) {
    this.filtroAtual = decodeURIComponent(encodedTrilha || 'todas');
    this.renderCatalogo();
  },

  _onSearchInput(termo) {
    this.buscaTermo = (termo || '').toLowerCase().trim();
    this.renderCatalogo();
  },

  voltarLista() {
    this.aulaAtivaId = null;
    this.renderCatalogo();
  },

  praticarNaRota(encodedRota) {
    const rota = decodeURIComponent(encodedRota || '');
    this.fechar();
    if (rota && typeof App !== 'undefined' && typeof App.navigate === 'function') {
      App.navigate(rota);
    }
  },

  renderCatalogo() {
    const modal = document.getElementById('academia-fingo-modal');
    if (!modal) return;

    const prog = this.getProgresso();
    const totalAulas = this.aulas.length;
    const concluidasCount = prog.length;
    const porcentagem = Math.round((concluidasCount / totalAulas) * 100);

    // Filtra aulas por trilha e termo de busca
    const filtradas = this.aulas.filter(aula => {
      const matchTrilha = this.filtroAtual === 'todas' || aula.trilha === this.filtroAtual;
      const matchBusca = !this.buscaTermo || 
        aula.titulo.toLowerCase().includes(this.buscaTermo) ||
        aula.resumo.toLowerCase().includes(this.buscaTermo) ||
        aula.moduloNome.toLowerCase().includes(this.buscaTermo);
      return matchTrilha && matchBusca;
    });

    const trilhasHtml = this.trilhas.map(t => {
      const isActive = this.filtroAtual === t.id;
      return `
        <button type="button" 
          data-fb-click="Academia.filtrarTrilha" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(t.id)}"
          style="padding:6px 14px;border-radius:20px;font-size:.78rem;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .2s;
          background:${isActive ? 'var(--accent)' : 'rgba(255,255,255,0.06)'};
          color:${isActive ? '#060E09' : 'var(--text2)'};
          border:1px solid ${isActive ? 'var(--accent)' : 'rgba(255,255,255,0.12)'};">
          <span>${t.icone}</span> <span>${t.label}</span>
        </button>
      `;
    }).join('');

    const cardsHtml = filtradas.length > 0 ? filtradas.map((aula, idx) => {
      const isDone = prog.includes(aula.id);
      return `
        <div class="academia-card" style="background:rgba(255,255,255,0.02);border:1px solid ${isDone ? 'rgba(198,255,0,0.3)' : 'rgba(255,255,255,0.08)'};border-radius:12px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;position:relative;">
          
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:.7rem;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:.06em;">
                ${aula.nivel} • ${aula.duracao}
              </span>
              ${isDone ? `<span style="font-size:.7rem;background:rgba(198,255,0,0.15);color:var(--accent);padding:2px 8px;border-radius:999px;font-weight:800;display:flex;align-items:center;gap:4px;">✓ Concluída</span>` : ''}
            </div>

            <h4 style="font-size:.92rem;font-weight:800;color:#fff;margin:0 0 6px;line-height:1.35;">
              ${aula.titulo}
            </h4>

            <p style="font-size:.78rem;color:var(--text3);line-height:1.45;margin:0 0 12px;">
              ${aula.resumo}
            </p>
          </div>

          <div style="display:flex;align-items:center;gap:8px;margin-top:10px;border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;">
            <button type="button" class="btn btn-primary btn-sm"
              data-fb-click="Academia.verAula" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(aula.id)}"
              style="flex:1;justify-content:center;font-weight:800;font-size:.78rem;padding:7px 12px;">
              ▶ Assistir Aula
            </button>
            <button type="button" class="btn btn-ghost btn-sm"
              data-fb-click="Academia.toggleConcluido" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(aula.id)}"
              title="${isDone ? 'Marcar como não concluída' : 'Marcar como concluída'}"
              style="padding:7px 10px;font-size:.85rem;color:${isDone ? 'var(--accent)' : 'var(--text3)'};">
              ${isDone ? '✅' : '⚪'}
            </button>
          </div>

        </div>
      `;
    }).join('') : `
      <div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--text3);">
        <span style="font-size:2rem;display:block;margin-bottom:8px;">🔍</span>
        <div style="font-weight:700;color:#fff;margin-bottom:4px;">Nenhum tutorial encontrado</div>
        <div style="font-size:.82rem;">Tente buscar por outros termos como "SINAPI", "OFX", "Medição" ou limpe o filtro.</div>
      </div>
    `;

    modal.innerHTML = `
      <div style="background:#0b110c;border:1px solid rgba(198,255,0,0.35);border-radius:16px;width:100%;max-width:920px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.9);overflow:hidden;color:#f0ead6;font-family:inherit;">
        
        <!-- Header da Academia -->
        <div style="background:linear-gradient(135deg,#121d13,#1a2b1b);padding:18px 24px;border-bottom:1px solid rgba(198,255,0,0.25);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:42px;height:42px;border-radius:10px;background:rgba(198,255,0,0.12);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:1.4rem;">
              🎓
            </div>
            <div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-weight:900;font-size:1.15rem;color:#fff;letter-spacing:-0.02em;">Academia FinGo</span>
                <span style="font-size:.65rem;background:var(--accent);color:#060E09;font-weight:900;padding:2px 7px;border-radius:4px;text-transform:uppercase;">Treinamento Oficial</span>
              </div>
              <div style="font-size:.78rem;color:var(--text3);margin-top:2px;">
                Domine a gestão de obras, finanças de canteiro, orçamentos SINAPI e BIM 3D
              </div>
            </div>
          </div>
          <button type="button" class="academia-close-btn" data-fb-click="Academia.fechar" data-fb-click-n="0" title="Fechar">✕</button>
        </div>

        <!-- Barra de Progresso & Estatísticas -->
        <div style="padding:12px 24px;background:rgba(255,255,255,0.02);border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;gap:20px;flex-shrink:0;">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:.78rem;margin-bottom:6px;">
              <span style="color:var(--text2);font-weight:700;">Seu Progresso de Aprendizado</span>
              <span style="color:var(--accent);font-weight:900;">${concluidasCount} de ${totalAulas} aulas concluídas (${porcentagem}%)</span>
            </div>
            <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:999px;overflow:hidden;">
              <div style="height:100%;width:${porcentagem}%;background:linear-gradient(90deg,var(--accent),#a3e635);border-radius:999px;transition:width .3s;"></div>
            </div>
          </div>
        </div>

        <!-- Controles: Busca & Filtros de Trilha -->
        <div style="padding:14px 24px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;gap:12px;flex-shrink:0;">
          <div style="position:relative;">
            <input type="text" id="academia-busca-input" class="form-control" placeholder="Buscar por tema (ex: SINAPI, NF-e, Medição, Conciliação, BIM)..." value="${Utils.escapeHtml(this.buscaTermo)}"
              style="padding-left:36px;font-size:.88rem;background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.12);"
              data-fb-input="Academia._onSearchInput" data-fb-input-n="1" data-fb-input-t0="value">
            <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:.9rem;color:var(--text3);pointer-events:none;">🔍</span>
          </div>

          <div style="display:flex;align-items:center;gap:8px;overflow-x:auto;padding-bottom:4px;">
            ${trilhasHtml}
          </div>
        </div>

        <!-- Grid de Cards de Aulas -->
        <div style="flex:1;overflow-y:auto;padding:20px 24px;display:grid;grid-template-columns:repeat(auto-fill, minmax(270px, 1fr));gap:16px;">
          ${cardsHtml}
        </div>

        <!-- Rodapé da Academia -->
        <div style="padding:12px 24px;background:rgba(0,0,0,0.35);border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div style="font-size:.78rem;color:var(--text3);display:flex;align-items:center;gap:8px;">
            <span>📺 Canal Oficial FinGo no YouTube</span>
            <span>•</span>
            <span>12 Aulas Práticas</span>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" data-fb-click="Academia.fechar" data-fb-click-n="0">Fechar</button>
        </div>

      </div>
    `;
  },

  verAula(aulaId) {
    const modal = document.getElementById('academia-fingo-modal');
    if (!modal) return;

    this.aulaAtivaId = aulaId;
    const aula = this.aulas.find(a => a.id === aulaId);
    if (!aula) {
      this.renderCatalogo();
      return;
    }

    const prog = this.getProgresso();
    const isDone = prog.includes(aula.id);

    const passosHtml = aula.passos.map((p, i) => `
      <li style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;font-size:.85rem;line-height:1.5;color:var(--text2);">
        <span style="width:24px;height:24px;border-radius:50%;background:rgba(198,255,0,0.12);border:1px solid var(--accent);color:var(--accent);font-weight:900;font-size:.75rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">
          ${i + 1}
        </span>
        <div style="flex:1;">${p}</div>
      </li>
    `).join('');

    modal.innerHTML = `
      <div style="background:#0b110c;border:1px solid rgba(198,255,0,0.35);border-radius:16px;width:100%;max-width:880px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.9);overflow:hidden;color:#f0ead6;font-family:inherit;">
        
        <!-- Header da Aula -->
        <div style="background:linear-gradient(135deg,#121d13,#1a2b1b);padding:16px 22px;border-bottom:1px solid rgba(198,255,0,0.25);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:10px;">
            <button type="button" class="btn btn-secondary btn-sm" data-fb-click="Academia.voltarLista" data-fb-click-n="0" style="padding:5px 10px;font-size:.78rem;font-weight:700;">
              ← Voltar às Aulas
            </button>
            <span style="font-size:.75rem;color:var(--text3);text-transform:uppercase;font-weight:800;letter-spacing:.05em;">
              ${aula.nivel} • ${aula.duracao}
            </span>
          </div>
          <button type="button" data-fb-click="Academia.fechar" data-fb-click-n="0" title="Fechar" style="background:none;border:none;color:var(--text3);font-size:1.3rem;cursor:pointer;padding:4px 8px;">✕</button>
        </div>

        <!-- Conteúdo Scrollável -->
        <div style="flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:20px;">
          
          <!-- Título & Resumo -->
          <div>
            <h2 style="font-size:1.3rem;font-weight:900;color:#fff;margin:0 0 8px;line-height:1.3;">
              ${aula.titulo}
            </h2>
            <p style="font-size:.9rem;color:var(--text2);line-height:1.5;margin:0;">
              ${aula.resumo}
            </p>
          </div>

          <!-- Player de Vídeo Real da Aula -->
          <div style="position:relative;background:#050a06;border:1px solid rgba(198,255,0,0.35);border-radius:12px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,0.85);display:flex;flex-direction:column;min-height:340px;">
            <!-- Topbar do Player -->
            <div style="padding:10px 18px;background:linear-gradient(90deg,#101c12,#18281a);border-bottom:1px solid rgba(198,255,0,0.2);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
              <div style="display:flex;align-items:center;gap:8px;font-size:.82rem;font-weight:800;color:var(--accent);">
                <span>▶ Vídeo Aula Oficial FinGo</span>
                <span style="color:var(--text3);font-weight:400;">•</span>
                <span style="color:var(--text2);font-weight:600;">${aula.duracao}</span>
              </div>
              <span style="font-size:.7rem;background:rgba(198,255,0,0.12);color:var(--accent);border:1px solid rgba(198,255,0,0.3);padding:2px 8px;border-radius:4px;font-weight:800;">HD 1080p</span>
            </div>

            <!-- Área de Vídeo com Altura e Proporção Garantidas -->
            <div style="position:relative;width:100%;aspect-ratio:16/9;min-height:280px;background:#000;display:flex;align-items:center;justify-content:center;">
              <video id="academia-video-player"
                controls
                playsinline
                preload="auto"
                poster="${aula.videoPoster || '/img/fingo/logo-reveal-poster.png'}"
                style="width:100%;height:100%;min-height:280px;aspect-ratio:16/9;display:block;background:#000;outline:none;"
                data-fb-ended="Academia.onVideoEnded" data-fb-ended-n="1" data-fb-ended-t0="string" data-fb-ended-v0="${encodeURIComponent(aula.id)}"
              >
                <source src="${aula.videoUrl || '/img/fingo/feature-demo.mp4'}" type="video/mp4">
                Seu navegador não suporta reprodução de vídeo HTML5.
              </video>
            </div>

            <!-- Barra de Ferramentas e Controles Rápidos do Vídeo -->
            <div style="padding:10px 18px;background:#0f1710;border-top:1px solid rgba(198,255,0,0.2);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;flex-shrink:0;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:.72rem;color:var(--text3);font-weight:800;text-transform:uppercase;letter-spacing:.05em;">Velocidade:</span>
                <button type="button" class="btn btn-ghost btn-sm" data-fb-click="Academia.setVideoRate" data-fb-click-n="1" data-fb-click-t0="number" data-fb-click-v0="1" style="padding:3px 8px;font-size:.75rem;font-weight:700;">1x</button>
                <button type="button" class="btn btn-ghost btn-sm" data-fb-click="Academia.setVideoRate" data-fb-click-n="1" data-fb-click-t0="number" data-fb-click-v0="1.25" style="padding:3px 8px;font-size:.75rem;font-weight:700;">1.25x</button>
                <button type="button" class="btn btn-ghost btn-sm" data-fb-click="Academia.setVideoRate" data-fb-click-n="1" data-fb-click-t0="number" data-fb-click-v0="1.5" style="padding:3px 8px;font-size:.75rem;font-weight:700;">1.5x</button>
                <button type="button" class="btn btn-ghost btn-sm" data-fb-click="Academia.setVideoRate" data-fb-click-n="1" data-fb-click-t0="number" data-fb-click-v0="2" style="padding:3px 8px;font-size:.75rem;font-weight:700;">2x</button>
              </div>

              <div style="display:flex;align-items:center;gap:8px;">
                <button type="button" class="btn btn-ghost btn-sm" data-fb-click="Academia.restartVideo" data-fb-click-n="0" style="padding:4px 10px;font-size:.75rem;font-weight:700;color:var(--text2);">
                  ↺ Reiniciar
                </button>
                <button type="button" class="btn btn-secondary btn-sm" data-fb-click="Academia.toggleVideoFullscreen" data-fb-click-n="0" style="padding:4px 10px;font-size:.75rem;font-weight:800;color:var(--accent);">
                  ⛶ Tela Cheia
                </button>
              </div>
            </div>
          </div>

          <!-- Passo a Passo Detalhado -->
          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;">
            <h3 style="font-size:.95rem;font-weight:900;color:var(--accent);margin:0 0 16px;text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:center;gap:8px;">
              <span>📋</span> <span>Passo a Passo de Execução</span>
            </h3>
            <ul style="list-style:none;padding:0;margin:0;">
              ${passosHtml}
            </ul>
          </div>

          <!-- Dica de Ouro de Engenharia / Gestão -->
          <div style="background:rgba(201,162,39,0.08);border:1px solid rgba(201,162,39,0.3);border-radius:10px;padding:14px 18px;display:flex;align-items:flex-start;gap:12px;">
            <span style="font-size:1.4rem;flex-shrink:0;">💡</span>
            <div>
              <div style="font-size:.78rem;font-weight:900;color:var(--accent2);text-transform:uppercase;letter-spacing:.05em;">Dica de Ouro da Engenharia</div>
              <div style="font-size:.85rem;color:#e2e8f0;line-height:1.45;margin-top:2px;">
                ${aula.dica}
              </div>
            </div>
          </div>

        </div>

        <!-- Ações no Rodapé -->
        <div style="padding:16px 24px;background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0;">
          <button type="button" class="btn btn-secondary" data-fb-click="Academia.voltarLista" data-fb-click-n="0" style="font-weight:700;">
            ← Todas as Aulas
          </button>

          <div style="display:flex;align-items:center;gap:10px;">
            <button type="button" class="btn btn-ghost"
              data-fb-click="Academia.toggleConcluido" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(aula.id)}"
              style="color:${isDone ? 'var(--accent)' : 'var(--text2)'};font-weight:700;">
              ${isDone ? '✓ Aula Concluída' : '⚪ Marcar como Concluída'}
            </button>

            <button type="button" class="btn btn-primary"
              data-fb-click="Academia.praticarNaRota" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(aula.rota)}"
              style="font-weight:900;box-shadow:0 0 16px rgba(198,255,0,0.35);">
              🚀 Praticar Agora em ${aula.moduloNome}
            </button>
          </div>
        </div>

      </div>
    `;
  },

  setVideoRate(rate) {
    const video = document.getElementById('academia-video-player');
    if (video) {
      const r = Number(rate) || 1;
      video.playbackRate = r;
      if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast(`Velocidade de reprodução: ${r}x`, 'info');
    }
  },

  restartVideo() {
    const video = document.getElementById('academia-video-player');
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  },

  toggleVideoFullscreen() {
    const video = document.getElementById('academia-video-player');
    if (video) {
      if (video.requestFullscreen) {
        video.requestFullscreen().catch(() => {});
      } else if (video.webkitRequestFullscreen) {
        video.webkitRequestFullscreen();
      }
    }
  },

  onVideoEnded(encodedAulaId) {
    const aulaId = decodeURIComponent(encodedAulaId || '');
    if (aulaId && !this.isConcluido(aulaId)) {
      this.toggleConcluido(aulaId);
    }
  }
};

