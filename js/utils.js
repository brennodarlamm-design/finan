// js/utils.js — Utility Helpers

const Utils = {
  fmt: {
    currency(v) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0); },
    date(d) {
      if (!d || d === '—' || d === '-') return '—';
      if (d instanceof Date) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${day}/${m}/${y}`;
      }
      let s = String(d).trim();
      if (s.includes('T')) s = s.split('T')[0];
      if (s.includes(' ')) s = s.split(' ')[0];
      const parts = s.split('-');
      if (parts.length === 3) {
        const [y, m, dd] = parts;
        return `${dd.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
      }
      if (s.includes('/')) return s;
      return s;
    },
    datetime(d) {
      if (!d || d === '—' || d === '-') return '—';
      try {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return d;
        return dt.toLocaleString('pt-BR');
      } catch {
        return d;
      }
    },
    percent(v) { return `${(v||0).toFixed(1)}%`; },
    num(v) { return new Intl.NumberFormat('pt-BR').format(v||0); },
  },

  cleanDate(d) {
    if (!d || d === '—' || d === '-') return '';
    if (d instanceof Date) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    let s = String(d).trim();
    if (s.includes('T')) s = s.split('T')[0];
    if (s.includes(' ')) s = s.split(' ')[0];
    const match = s.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
    const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`;
    return s;
  },

  today() { return new Date().toISOString().split('T')[0]; },

  diasEntre(d1, d2) {
    if (!d1 || !d2) return 0;
    try {
      const dt1 = new Date(this.cleanDate(d1) + 'T00:00:00');
      const dt2 = new Date(this.cleanDate(d2) + 'T00:00:00');
      const diff = dt2.getTime() - dt1.getTime();
      const dias = Math.round(diff / (1000 * 60 * 60 * 24));
      return isNaN(dias) || dias < 0 ? 0 : dias;
    } catch {
      return 0;
    }
  },

  badge(status) {
    const m = {
      pago:'<span class="badge badge-success">✓ Pago</span>',
      recebido:'<span class="badge badge-success">✓ Recebido</span>',
      a_pagar:'<span class="badge badge-warning">⏳ A Pagar</span>',
      a_receber:'<span class="badge badge-warning">⏳ A Receber</span>',
      em_atraso:'<span class="badge badge-danger">⚠ Em Atraso</span>',
      pendente:'<span class="badge badge-warning">⏳ Pendente</span>',
      pendente_aprovacao:'<span class="badge badge-warning" style="background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.35);font-weight:700;">⏳ Aguardando Aprovação</span>',
      vencida:'<span class="badge badge-danger">⚠ Vencida</span>',
      cancelada:'<span class="badge badge-secondary">✕ Cancelada</span>',
      em_andamento:'<span class="badge badge-info">🔨 Em Andamento</span>',
      documentacao:'<span class="badge badge-info" style="background:rgba(59,130,246,.18);color:#60a5fa;border:1px solid rgba(59,130,246,.4);font-weight:700;">📑 Documentação</span>',
      aprovada:'<span class="badge badge-success" style="background:rgba(16,185,129,.18);color:#34d399;border:1px solid rgba(16,185,129,.4);font-weight:700;">✓ Aprovada</span>',
      concluida:'<span class="badge badge-success">✓ Concluída</span>',
      pausada:'<span class="badge badge-warning">⏸ Pausada</span>',
      preparando:'<span class="badge badge-secondary">📋 Preparando</span>',
      submetida:'<span class="badge badge-info">📤 Submetida</span>',
      em_analise:'<span class="badge badge-warning">🔍 Em Análise</span>',
      liberada:'<span class="badge badge-success" style="background:rgba(16,185,129,.2)">💰 Liberada</span>',
      convertida:'<span class="badge badge-success" style="background:rgba(201,162,39,.18);color:var(--accent2);border:1px solid rgba(201,162,39,.4)">💰 Despesa Gerada</span>',
      rejeitada:'<span class="badge badge-danger">✕ Rejeitada</span>',
      paga:'<span class="badge badge-success">✓ Paga</span>',
      ativo:'<span class="badge badge-success">✓ Ativo</span>',
    };
    return m[status] || `<span class="badge badge-secondary">${status}</span>`;
  },

  prioridadeBadge(p) {
    const m = {
      baixa: '<span class="badge" style="background:rgba(148,163,184,.12);color:#94a3b8;border:1px solid rgba(148,163,184,.3)">🟢 Baixa</span>',
      normal: '<span class="badge badge-info">🔵 Normal</span>',
      alta: '<span class="badge badge-warning">🟠 Alta</span>',
      urgente: '<span class="badge badge-danger" style="font-weight:800;border:1px solid rgba(239,68,68,.5)">🔴 Urgente</span>'
    };
    return m[p] || `<span class="badge badge-secondary">${p||'Normal'}</span>`;
  },

  catLabel(c) {
    const m = {
      // Receitas e Obras
      parcela_caixa:'🏦 Parcela Caixa',
      entrada_propria:'💵 Entrada Própria',
      aporte_financeiro:'💼 Aporte Financeiro',
      emprestimo:'🤝 Empréstimo',
      financiamento:'🏗️ Financiamento',
      material:'🧱 Material',
      mao_de_obra:'👷 Mão de Obra',
      servico:'🔧 Serviço',
      equipamento:'🏗️ Equipamento',
      taxa:'📋 Taxa/Imposto',
      outro:'📦 Outros',
      // Despesas Administrativas & Sede
      energia:'💡 Energia Elétrica',
      agua:'💧 Água e Esgoto',
      internet_tel:'🌐 Internet & Telefonia',
      imposto_simples:'🏛️ DAS Simples Nacional',
      tributos_trabalhistas:'📄 INSS / FGTS / Tributos',
      salario:'👥 Salários / Folha',
      pro_labore:'💼 Pró-Labore Sócios',
      beneficios:'🎫 Benefícios (VT / VR)',
      aluguel_sede:'🏢 Aluguel / Condomínio Sede',
      contabilidade:'⚖️ Contábil / Jurídico',
      software_ti:'💻 Softwares, TI & Domínio',
      material_escritorio:'📦 Material Escritório & Copa',
      manutencao_sede:'🔧 Manutenção da Sede',
      veiculos_sede:'🚗 Veículos & Combustível',
      // Marketing
      marketing:'📣 Marketing',
      trafego_pago:'🎯 Tráfego Pago',
      comercial:'🤝 Comercial',
    };
    if (m[c]) return m[c];
    // Busca em categorias customizadas (despesas e fornecedores)
    try {
      const customDesp = JSON.parse(localStorage.getItem('finobra_cats_despesa_custom') || '[]');
      const customForn = JSON.parse(localStorage.getItem('finobra_categorias_custom') || '[]');
      const found = [...customDesp, ...customForn].find(x => x.value === c);
      if (found) return found.label;
    } catch(e) {}
    return c;
  },


  toast(msg, type='success') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const icons = { success:'✓', warning:'⚠', error:'✕', info:'ℹ' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span style="font-size:15px;flex-shrink:0">${icons[type]||'ℹ'}</span><span style="flex:1">${msg}</span>`;
    c.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0';t.style.transform='translateX(60px)';t.style.transition='all .25s'; setTimeout(()=>t.remove(),250); }, 3200);
  },

  showModal(html) {
    this.closeModal();
    const el = document.createElement('div');
    el.id = 'modal-overlay';
    el.className = 'modal-overlay';
    el.innerHTML = html;
    el.addEventListener('click', e => { if(e.target===el) this.closeModal(); });
    document.body.appendChild(el);
  },

  closeModal() {
    const el = document.getElementById('modal-overlay');
    if (el) el.remove();
  },

  confirm(msg, onYes) {
    this.showModal(`
      <div class="modal" style="max-width:400px">
        <div class="modal-header"><span class="modal-title">⚠ Confirmar</span><button class="modal-close" onclick="Utils.closeModal()">✕</button></div>
        <div class="modal-body"><p style="color:var(--text2);line-height:1.6">${msg}</p></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-danger" id="_confirm_btn">Confirmar</button>
        </div>
      </div>`);
    document.getElementById('_confirm_btn').onclick = () => { this.closeModal(); onYes(); };
  },

  stateOptions(sel='SP') {
    const states=['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
    return states.map(s=>`<option value="${s}" ${s===sel?'selected':''}>${s}</option>`).join('');
  },

  clienteOptions(selectedId='', allText='Selecione o centro de custo / obra...', includeEscritorio = true) {
    const cs = DB.getAll('clientes');
    let opts = `<option value="">${allText}</option>`;
    if (includeEscritorio) {
      opts += `<option value="escritorio" ${selectedId==='escritorio'?'selected':''}>🏢 Sede / Escritório Central</option>`;
    }
    opts += cs.map(c=>`<option value="${c.id}" ${c.id===selectedId?'selected':''}>${c.nome} — ${c.cidade}</option>`).join('');
    return opts;
  },

  extenso(valor) {
    const v = parseFloat(valor) || 0;
    if (v === 0) return 'zero reais';
    
    const unidades = ['','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
    const dezenas = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
    const centenas = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];

    function converterCentena(n) {
      if (n === 100) return 'cem';
      let r = '';
      const c = Math.floor(n / 100);
      const d = Math.floor((n % 100) / 10);
      const u = n % 10;
      if (c > 0) r += centenas[c];
      const du = n % 100;
      if (du > 0 && du < 20) {
        if (r) r += ' e ';
        r += unidades[du];
      } else {
        if (d > 0) {
          if (r) r += ' e ';
          r += dezenas[d];
        }
        if (u > 0) {
          if (r) r += ' e ';
          r += unidades[u];
        }
      }
      return r;
    }

    const inteira = Math.floor(v);
    const centavos = Math.round((v - inteira) * 100);

    let partes = [];
    const milhoes = Math.floor(inteira / 1000000);
    const milhares = Math.floor((inteira % 1000000) / 1000);
    const resto = inteira % 1000;

    if (milhoes > 0) {
      partes.push(converterCentena(milhoes) + (milhoes === 1 ? ' milhão' : ' milhões'));
    }
    if (milhares > 0) {
      partes.push((milhares === 1 ? 'um mil' : converterCentena(milhares) + ' mil'));
    }
    if (resto > 0) {
      partes.push(converterCentena(resto));
    }

    let textoReais = '';
    if (inteira > 0) {
      textoReais = partes.join(' e ') + (inteira === 1 ? ' real' : ' reais');
    }

    let textoCentavos = '';
    if (centavos > 0) {
      textoCentavos = converterCentena(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
    }

    if (textoReais && textoCentavos) return `${textoReais} e ${textoCentavos}`;
    if (textoReais) return textoReais;
    if (textoCentavos) return textoCentavos;
    return 'zero reais';
  }
};
