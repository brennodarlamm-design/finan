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

  formatDate(d) {
    return this.fmt.date(d);
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

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  esc(str) {
    return this.escapeHtml(str);
  },

  escapeJsAttr(value) {
    // Valor seguro para uso dentro de string JS entre aspas simples em atributos HTML.
    // Ex.: data-fb-click="fn" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="...". Prefira addEventListener quando possível.
    const js = String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/</g, '\\x3c')
      .replace(/>/g, '\\x3e')
      .replace(/&/g, '\\x26');
    return this.escapeHtml(js);
  },

  safeUrl(value) {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(raw)) return raw;
    try {
      const u = new URL(raw, window.location.origin);
      if (!['http:', 'https:'].includes(u.protocol)) return '';
      return this.escapeHtml(u.href);
    } catch {
      return '';
    }
  },

  sanitizeHtml(dirty) {
    if (!dirty) return '';
    if (typeof window === 'undefined' || !window.DOMParser) return this.escapeHtml(dirty);
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(String(dirty), 'text/html');
      const ALLOWED_TAGS = new Set([
        'b', 'i', 'u', 'em', 'strong', 'a', 'p', 'br', 'span', 'ul', 'ol', 'li',
        'code', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr'
      ]);
      const ALLOWED_ATTRS = new Set(['href', 'target', 'rel', 'class', 'title']);

      function cleanNode(node) {
        const toRemove = [];
        for (let i = 0; i < node.childNodes.length; i++) {
          const child = node.childNodes[i];
          if (child.nodeType === 1) {
            const tag = child.tagName.toLowerCase();
            if (!ALLOWED_TAGS.has(tag)) {
              toRemove.push(child);
              continue;
            }
            const attrs = Array.from(child.attributes);
            for (const attr of attrs) {
              const name = attr.name.toLowerCase();
              if (name.startsWith('on') || !ALLOWED_ATTRS.has(name)) {
                child.removeAttribute(attr.name);
              } else if (name === 'href') {
                const val = String(attr.value || '').trim().toLowerCase();
                if (val.startsWith('javascript:') || val.startsWith('data:') || val.startsWith('vbscript:')) {
                  child.removeAttribute('href');
                }
              }
            }
            cleanNode(child);
          } else if (child.nodeType !== 3) {
            toRemove.push(child);
          }
        }
        for (const bad of toRemove) {
          bad.remove();
        }
      }

      cleanNode(doc.body);
      return doc.body.innerHTML;
    } catch {
      return this.escapeHtml(dirty);
    }
  },

  today() {
    // Retorna YYYY-MM-DD no fuso horário oficial (America/Boa_Vista, UTC-4), evitando virada indevida de data às 20h UTC
    try {
      const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Boa_Vista',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(new Date());
      const y = parts.find(p => p.type === 'year')?.value;
      const m = parts.find(p => p.type === 'month')?.value;
      const d = parts.find(p => p.type === 'day')?.value;
      if (y && m && d) return `${y}-${m}-${d}`;
    } catch {}
    const dt = new Date();
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  },

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
      pago:'<span class="badge badge-success"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Pago</span>',
      recebido:'<span class="badge badge-success"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Recebido</span>',
      a_pagar:'<span class="badge badge-warning"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>A Pagar</span>',
      a_receber:'<span class="badge badge-warning"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>A Receber</span>',
      em_atraso:'<span class="badge badge-danger"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Em Atraso</span>',
      pendente:'<span class="badge badge-warning"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Pendente</span>',
      pendente_aprovacao:'<span class="badge badge-warning" style="background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.35);font-weight:700;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Aguardando Aprovação</span>',
      vencida:'<span class="badge badge-danger"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Vencida</span>',
      cancelada:'<span class="badge badge-secondary"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Cancelada</span>',
      em_andamento:'<span class="badge badge-info"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Em Andamento</span>',
      documentacao:'<span class="badge" style="background:rgba(198,255,0,.14);color:#C6FF00;border:1px solid rgba(198,255,0,.35);font-weight:700;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Documentação</span>',
      aprovada:'<span class="badge badge-success" style="background:rgba(16,185,129,.18);color:#34d399;border:1px solid rgba(16,185,129,.4);font-weight:700;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Aprovada</span>',
      concluida:'<span class="badge badge-success"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Concluída</span>',
      pausada:'<span class="badge badge-warning"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Pausada</span>',
      preparando:'<span class="badge badge-secondary"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Preparando</span>',
      submetida:'<span class="badge badge-info"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Submetida</span>',
      em_analise:'<span class="badge badge-warning"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Em Análise</span>',
      liberada:'<span class="badge badge-success" style="background:rgba(16,185,129,.2)"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Liberada</span>',
      convertida:'<span class="badge badge-success" style="background:rgba(201,162,39,.18);color:var(--accent2);border:1px solid rgba(201,162,39,.4)"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Despesa Gerada</span>',
      rejeitada:'<span class="badge badge-danger"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Rejeitada</span>',
      paga:'<span class="badge badge-success"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Paga</span>',
      ativo:'<span class="badge badge-success"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Ativo</span>',
      a_revisar:'<span class="badge" style="background:rgba(245,158,11,.18);color:#f59e0b;border:1px solid rgba(245,158,11,.4);font-weight:700;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>A Revisar</span>',
      revisao:'<span class="badge" style="background:rgba(245,158,11,.18);color:#f59e0b;border:1px solid rgba(245,158,11,.4);font-weight:700;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>A Revisar</span>',
      aprovado:'<span class="badge badge-success" style="background:rgba(16,185,129,.18);color:#34d399;border:1px solid rgba(16,185,129,.4);font-weight:700;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Aprovado</span>',
      cancelado:'<span class="badge badge-danger" style="background:rgba(239,68,68,.18);color:#f87171;border:1px solid rgba(239,68,68,.4);font-weight:700;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Cancelado</span>',
      despesa_gerada:'<span class="badge" style="background:rgba(201,162,39,.18);color:var(--accent2);border:1px solid rgba(201,162,39,.4);font-weight:700;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;"></span>Despesas Geradas</span>',
    };
    return m[status] || `<span class="badge badge-secondary">${this.escapeHtml(status || '')}</span>`;
  },

  prioridadeBadge(p) {
    const m = {
      baixa: '<span class="badge" style="background:rgba(148,163,184,.12);color:#e9ecf0;border:1px solid rgba(148,163,184,.3)"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#10b981;margin-right:5px;vertical-align:middle;"></span>Baixa</span>',
      normal: '<span class="badge badge-info"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#38bdf8;margin-right:5px;vertical-align:middle;"></span>Normal</span>',
      alta: '<span class="badge badge-warning"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#f59e0b;margin-right:5px;vertical-align:middle;"></span>Alta</span>',
      urgente: '<span class="badge badge-danger" style="font-weight:800;border:1px solid rgba(239,68,68,.5)"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ef4444;margin-right:5px;vertical-align:middle;"></span>Urgente</span>'
    };
    return m[p] || `<span class="badge badge-secondary">${this.escapeHtml(p || 'Normal')}</span>`;
  },

  // ── CATÁLOGO UNIFICADO DE CATEGORIAS FINANCIERAS & OPERACIONAIS ──
  CATEGORIAS_PADRAO: {
    receitas: [
      { value: 'parcela_caixa', label: '🏦 Parcela Caixa (Financiamento)' },
      { value: 'aporte_cliente', label: '💰 Aporte do Cliente / Particular' },
      { value: 'medicao_obra', label: '📋 Medição / Faturamento de Obra' },
      { value: 'taxa_adm', label: '💼 Taxa de Administração de Obra' },
      { value: 'entrada_propria', label: '💵 Entrada Própria' },
      { value: 'aporte_financeiro', label: '💼 Aporte Financeiro' },
      { value: 'emprestimo', label: '🤝 Empréstimo' },
      { value: 'financiamento', label: '🏗️ Financiamento' }
    ],
    custos_obra: [
      { value: 'material', label: '🧱 Material de Obra' },
      { value: 'mao_de_obra', label: '👷 Mão de Obra' },
      { value: 'servico', label: '🔧 Serviço Especializado' },
      { value: 'equipamento', label: '🏗️ Equipamento & Locação' },
      { value: 'taxa', label: '📋 Taxa & Licenciamento' }
    ],
    despesas_sede: [
      { value: 'energia', label: '💡 Energia Elétrica' },
      { value: 'agua', label: '💧 Água e Esgoto' },
      { value: 'internet_tel', label: '🌐 Internet & Telefonia' },
      { value: 'imposto_simples', label: '🏛️ DAS Simples Nacional' },
      { value: 'tributos_trabalhistas', label: '📄 INSS / FGTS / Tributos' },
      { value: 'salario', label: '👥 Salários / Folha' },
      { value: 'pro_labore', label: '💼 Pró-Labore Sócios' },
      { value: 'beneficios', label: '🥗 Benefícios (VT / VR)' },
      { value: 'aluguel_sede', label: '🏢 Aluguel & Condomínio' },
      { value: 'contabilidade', label: '⚖️ Contábil & Jurídico' },
      { value: 'software_ti', label: '💻 Softwares, TI & Domínio' },
      { value: 'material_escritorio', label: '📦 Material Escritório & Copa' },
      { value: 'manutencao_sede', label: '🔧 Manutenção da Sede' },
      { value: 'veiculos_sede', label: '🚗 Veículos & Combustível' },
      { value: 'marketing', label: '📣 Marketing' },
      { value: 'trafego_pago', label: '🎯 Tráfego Pago' },
      { value: 'comercial', label: '🤝 Comercial & Vendas' }
    ],
    outros: [
      { value: 'outro', label: '📦 Outros' }
    ]
  },

  getCustomCats(tipo = 'despesa') {
    try {
      const scoped = (name) => (typeof DB !== 'undefined' && DB._ck) ? DB._ck(name) : name;
      const keyMap = {
        despesa: 'finobra_cats_despesa_custom',
        receita: 'finobra_cats_receita_custom',
        fornecedor: 'finobra_categorias_custom'
      };
      const key = keyMap[tipo] || keyMap.despesa;
      const list = JSON.parse(localStorage.getItem(scoped(key)) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },

  saveCustomCat(tipo, item) {
    const list = this.getCustomCats(tipo);
    const existing = list.findIndex(c => c.value === item.value);
    if (existing >= 0) {
      list[existing] = item;
    } else {
      list.push(item);
    }
    const safe = list.slice(0, 100);
    const scoped = (name) => (typeof DB !== 'undefined' && DB._ck) ? DB._ck(name) : name;
    const keyMap = {
      despesa: 'finobra_cats_despesa_custom',
      receita: 'finobra_cats_receita_custom',
      fornecedor: 'finobra_categorias_custom'
    };
    const key = keyMap[tipo] || keyMap.despesa;
    try { localStorage.setItem(scoped(key), JSON.stringify(safe)); } catch {}
    if (typeof DB !== 'undefined' && DB.saveTenantPreferences) {
      const prefKey = tipo === 'fornecedor' ? 'categorias_fornecedor' : (tipo === 'receita' ? 'categorias_receita' : 'categorias_despesa');
      DB.saveTenantPreferences({ [prefKey]: safe });
    }
  },

  deleteCustomCat(tipo, value) {
    const list = this.getCustomCats(tipo).filter(c => c.value !== value);
    const scoped = (name) => (typeof DB !== 'undefined' && DB._ck) ? DB._ck(name) : name;
    const keyMap = {
      despesa: 'finobra_cats_despesa_custom',
      receita: 'finobra_cats_receita_custom',
      fornecedor: 'finobra_categorias_custom'
    };
    const key = keyMap[tipo] || keyMap.despesa;
    try { localStorage.setItem(scoped(key), JSON.stringify(list)); } catch {}
    if (typeof DB !== 'undefined' && DB.saveTenantPreferences) {
      const prefKey = tipo === 'fornecedor' ? 'categorias_fornecedor' : (tipo === 'receita' ? 'categorias_receita' : 'categorias_despesa');
      DB.saveTenantPreferences({ [prefKey]: list });
    }
  },

  renderSelectOptionsDespesa(selectedValue = '') {
    const custom = this.getCustomCats('despesa');
    const esc = this.escapeHtml.bind(this);
    let html = '';
    
    html += '<optgroup label="🏗️ Custos Diretos de Obra">';
    for (const c of this.CATEGORIAS_PADRAO.custos_obra) {
      html += `<option value="${c.value}" ${selectedValue === c.value ? 'selected' : ''}>${c.label}</option>`;
    }
    html += '</optgroup>';

    html += '<optgroup label="🏢 Despesas da Sede / Administrativo">';
    for (const c of this.CATEGORIAS_PADRAO.despesas_sede) {
      html += `<option value="${c.value}" ${selectedValue === c.value ? 'selected' : ''}>${c.label}</option>`;
    }
    html += '</optgroup>';

    if (custom.length > 0) {
      html += '<optgroup label="⭐ Categorias Personalizadas">';
      for (const c of custom) {
        html += `<option value="${esc(c.value)}" ${selectedValue === c.value ? 'selected' : ''}>${esc(c.label || c.value)}</option>`;
      }
      html += '</optgroup>';
    }

    html += '<optgroup label="📦 Outros">';
    for (const c of this.CATEGORIAS_PADRAO.outros) {
      html += `<option value="${c.value}" ${selectedValue === c.value ? 'selected' : ''}>${c.label}</option>`;
    }
    html += '</optgroup>';

    return html;
  },

  renderSelectOptionsReceita(selectedValue = '') {
    const custom = this.getCustomCats('receita');
    const esc = this.escapeHtml.bind(this);
    let html = '';

    html += '<optgroup label="💰 Entradas & Faturamento">';
    for (const c of this.CATEGORIAS_PADRAO.receitas) {
      html += `<option value="${c.value}" ${selectedValue === c.value ? 'selected' : ''}>${c.label}</option>`;
    }
    html += '</optgroup>';

    if (custom.length > 0) {
      html += '<optgroup label="⭐ Receitas Personalizadas">';
      for (const c of custom) {
        html += `<option value="${esc(c.value)}" ${selectedValue === c.value ? 'selected' : ''}>${esc(c.label || c.value)}</option>`;
      }
      html += '</optgroup>';
    }

    html += '<optgroup label="📦 Outros">';
    for (const c of this.CATEGORIAS_PADRAO.outros) {
      html += `<option value="${c.value}" ${selectedValue === c.value ? 'selected' : ''}>${c.label}</option>`;
    }
    html += '</optgroup>';

    return html;
  },

  renderFilterCategoryOptions(selectedValue = '', tipo = '') {
    const esc = this.escapeHtml.bind(this);
    let html = '<option value="">Todas as Categorias</option>';

    if (tipo === 'receita') {
      return html + this.renderSelectOptionsReceita(selectedValue);
    }
    if (tipo === 'despesa') {
      return html + this.renderSelectOptionsDespesa(selectedValue);
    }

    html += '<optgroup label="💰 Receitas">';
    for (const c of this.CATEGORIAS_PADRAO.receitas) {
      html += `<option value="${c.value}" ${selectedValue === c.value ? 'selected' : ''}>${c.label}</option>`;
    }
    const customRec = this.getCustomCats('receita');
    for (const c of customRec) {
      html += `<option value="${esc(c.value)}" ${selectedValue === c.value ? 'selected' : ''}>${esc(c.label || c.value)}</option>`;
    }
    html += '</optgroup>';

    html += '<optgroup label="🏗️ Custos de Obra">';
    for (const c of this.CATEGORIAS_PADRAO.custos_obra) {
      html += `<option value="${c.value}" ${selectedValue === c.value ? 'selected' : ''}>${c.label}</option>`;
    }
    html += '</optgroup>';

    html += '<optgroup label="🏢 Escritório / Sede">';
    for (const c of this.CATEGORIAS_PADRAO.despesas_sede) {
      html += `<option value="${c.value}" ${selectedValue === c.value ? 'selected' : ''}>${c.label}</option>`;
    }
    html += '</optgroup>';

    const customDesp = this.getCustomCats('despesa');
    if (customDesp.length > 0) {
      html += '<optgroup label="⭐ Personalizadas">';
      for (const c of customDesp) {
        html += `<option value="${esc(c.value)}" ${selectedValue === c.value ? 'selected' : ''}>${esc(c.label || c.value)}</option>`;
      }
      html += '</optgroup>';
    }

    html += '<option value="outro" ' + (selectedValue === 'outro' ? 'selected' : '') + '>📦 Outros</option>';
    return html;
  },

  catLabel(c) {
    const m = {
      // Receitas e Obras
      parcela_caixa:'Parcela Caixa (Financiamento)',
      aporte_cliente:'Aporte do Cliente / Parcela Particular',
      medicao_obra:'Medição / Faturamento de Obra',
      taxa_adm:'Taxa de Administração de Obra',
      entrada_propria:'Entrada Própria',
      aporte_financeiro:'Aporte Financeiro',
      emprestimo:'Empréstimo',
      financiamento:'Financiamento',
      material:'Material',
      mao_de_obra:'Mão de Obra',
      servico:'Serviço',
      equipamento:'Equipamento',
      taxa:'Taxa / Imposto',
      outro:'Outros',
      // Despesas Administrativas & Sede
      energia:'Energia Elétrica',
      agua:'Água e Esgoto',
      internet_tel:'Internet & Telefonia',
      imposto_simples:'DAS Simples Nacional',
      tributos_trabalhistas:'INSS / FGTS / Tributos',
      salario:'Salários / Folha',
      pro_labore:'Pró-Labore Sócios',
      beneficios:'Benefícios (VT / VR)',
      aluguel_sede:'Aluguel / Condomínio Sede',
      contabilidade:'Contábil / Jurídico',
      software_ti:'Softwares, TI & Domínio',
      material_escritorio:'Material Escritório & Copa',
      manutencao_sede:'Manutenção da Sede',
      veiculos_sede:'Veículos & Combustível',
      // Marketing
      marketing:'Marketing',
      trafego_pago:'Tráfego Pago',
      comercial:'Comercial',
    };
    if (m[c]) return m[c];
    // Busca em categorias customizadas (despesas, receitas e fornecedores)
    try {
      const customDesp = this.getCustomCats ? this.getCustomCats('despesa') : [];
      const customRec = this.getCustomCats ? this.getCustomCats('receita') : [];
      const customForn = this.getCustomCats ? this.getCustomCats('fornecedor') : [];
      const found = [...customDesp, ...customRec, ...customForn].find(x => x.value === c);
      if (found) {
        found.label = String(found.label || '').replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '').trim();
        return this.escapeHtml(found.label);
      }
    } catch(e) {}
    c = String(c || '').replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '').trim();
    return this.escapeHtml(c || '');
  },


  toast(msg, type='success') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const icons = { success:'✓', warning:'⚠', error:'✕', info:'ℹ' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;

    // Não injeta mensagens em innerHTML: erros de API e nomes cadastrados podem conter texto não confiável.
    const icon = document.createElement('span');
    icon.style.fontSize = '15px';
    icon.style.flexShrink = '0';
    icon.textContent = icons[type] || 'ℹ';
    const text = document.createElement('span');
    text.style.flex = '1';
    text.textContent = String(msg ?? '');
    t.append(icon, text);

    c.appendChild(t);
    setTimeout(() => {
      t.classList.add('exiting');
      setTimeout(() => t.remove(), 200);
    }, 3200);
  },

  _modalDirty: false,

  setModalDirty(val = true) {
    this._modalDirty = !!val;
  },

  showModal(html) {
    this.closeModal();
    this._modalDirty = false;
    this._modalReturnFocus = document.activeElement;
    const el = document.createElement('div');
    el.id = 'modal-overlay';
    el.className = 'modal-overlay';
    el.innerHTML = html;

    const markDirty = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) {
        this._modalDirty = true;
      }
    };
    el.addEventListener('input', markDirty);
    el.addEventListener('change', markDirty);

    const checkAndClose = () => {
      if (this._modalDirty) {
        if (!window.confirm('Você possui alterações não salvas neste formulário. Deseja realmente fechar e perder os dados preenchidos?')) {
          return;
        }
      }
      this.closeModal();
    };

    el.addEventListener('click', e => { if(e.target===el) checkAndClose(); });
    document.body.appendChild(el);
    document.body.classList.add('modal-open');
    const dialog = el.querySelector('.modal') || el;
    dialog.setAttribute('role','dialog');
    dialog.setAttribute('aria-modal','true');
    dialog.tabIndex = -1;
    const title = dialog.querySelector('.modal-title');
    if (title) dialog.setAttribute('aria-label',title.textContent.trim());
    dialog.focus({preventScroll:true});
    el.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); checkAndClose(); }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')).filter(node => !node.disabled && node.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length-1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement===first || document.activeElement===dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
    });
  },

  closeModal() {
    this._modalDirty = false;
    const el = document.getElementById('modal-overlay');
    if (el) el.remove();
    document.body.classList.remove('modal-open');
    if (this._modalReturnFocus?.isConnected) this._modalReturnFocus.focus({preventScroll:true});
    this._modalReturnFocus = null;
  },

  confirm(msg, onYes, options = {}) {
    const allowHtml = options?.allowHtml === true;
    const safeMsg = allowHtml ? String(msg ?? '') : this.escapeHtml(String(msg ?? ''));
    this.showModal(`
      <div class="modal" style="max-width:400px">
        <div class="modal-header"><span class="modal-title">⚠ Confirmar</span><button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button></div>
        <div class="modal-body"><p style="color:var(--text2);line-height:1.6">${safeMsg}</p></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Cancelar</button>
          <button class="btn btn-danger" id="_confirm_btn">Confirmar</button>
        </div>
      </div>`);
    document.getElementById('_confirm_btn').onclick = () => { this.closeModal(); onYes(); };
  },

  prompt(title, onConfirm, defaultValue = '', placeholder = '') {
    const safeTitle = this.escapeHtml(title || 'Informação');
    const safeVal = this.escapeHtml(defaultValue || '');
    const safePh = this.escapeHtml(placeholder || '');
    const overlay = document.createElement('div');
    overlay.id = 'modal-prompt-overlay';
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '99999';
    overlay.innerHTML = `
      <div class="modal" style="max-width:440px">
        <div class="modal-header">
          <span class="modal-title">${safeTitle}</span>
          <button class="modal-close" id="_prompt_close">✕</button>
        </div>
        <div class="modal-body">
          <input type="text" id="_prompt_input" class="form-control" value="${safeVal}" placeholder="${safePh}" style="width:100%;font-size:1rem;padding:10px 12px;" autofocus>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="_prompt_cancel">Cancelar</button>
          <button class="btn btn-primary" id="_prompt_ok">Confirmar</button>
        </div>
      </div>
    `;
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);

    const input = document.getElementById('_prompt_input');
    const btnOk = document.getElementById('_prompt_ok');
    const btnCancel = document.getElementById('_prompt_cancel');
    const btnClose = document.getElementById('_prompt_close');

    btnClose.onclick = close;
    btnCancel.onclick = close;
    btnOk.onclick = () => {
      const val = input.value;
      close();
      if (typeof onConfirm === 'function') onConfirm(val);
    };
    input.focus();
    input.select();
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnOk.click();
      } else if (e.key === 'Escape') {
        close();
      }
    };
  },

  stateOptions(sel='') {
    const states=['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
    const selected = String(sel || '').trim().toUpperCase();
    const placeholder = `<option value="" ${selected ? '' : 'selected'}>Selecione...</option>`;
    return placeholder + states.map(s=>`<option value="${s}" ${s===selected?'selected':''}>${s}</option>`).join('');
  },

  clienteOptions(selectedId='', allText='Selecione o centro de custo / obra...', includeEscritorio = true) {
    const cs = DB.getAll('clientes');
    const e = this.escapeHtml.bind(this);
    let opts = `<option value="">${e(allText)}</option>`;
    if (includeEscritorio) {
      opts += `<option value="escritorio" ${selectedId==='escritorio'?'selected':''}>🏢 Sede / Escritório Central</option>`;
    }
    opts += cs.map(c=>`<option value="${e(c.id)}" ${c.id===selectedId?'selected':''}>${e(c.nome)} — ${e(c.cidade)}</option>`).join('');
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
  },

  compressImage(file, maxW = 400, maxH = 200, quality = 0.88) {
    return new Promise((resolve, reject) => {
      if (!file || !(file.type || '').startsWith('image/')) {
        return reject(new Error('O arquivo selecionado não é uma imagem válida.'));
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Erro ao ler arquivo de imagem.'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Falha ao decodificar a imagem. Formato incompatível.'));
        img.onload = () => {
          let { width, height } = img;
          if (width > maxW || height > maxH) {
            const ratio = Math.min(maxW / width, maxH / height);
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(outputType, quality);
          resolve({
            dataUrl,
            width,
            height,
            sizeBytes: Math.round((dataUrl.length * 3) / 4),
            name: file.name
          });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  // Cache em memória para consultas de CEP
  _cepCache: {},

  async consultarCep(rawCep) {
    if (!rawCep) return null;
    const cep = String(rawCep).replace(/\D/g, '');
    if (cep.length !== 8) return null;

    if (this._cepCache && this._cepCache[cep]) {
      return this._cepCache[cep];
    }

    try {
      const res = await fetch(`/api/cep?cep=${cep}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      if (data && (data.success || data.cep)) {
        if (!this._cepCache) this._cepCache = {};
        this._cepCache[cep] = data;
        return data;
      }
      return null;
    } catch (e) {
      console.warn('[Utils] Erro ao consultar CEP:', e);
      return null;
    }
  },

  renderKpiSkeletons(count = 6) {
    return `
      <div class="kpi-grid">
        ${Array(count).fill(0).map(() => `
          <div class="kpi-card" style="position:relative;overflow:hidden;">
            <div class="skeleton" style="width:36px;height:36px;border-radius:10px;margin-bottom:12px;"></div>
            <div class="skeleton skeleton-kpi-label"></div>
            <div class="skeleton skeleton-kpi-value"></div>
            <div class="skeleton skeleton-kpi-change"></div>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderTableSkeleton({ cols = 6, rows = 6 } = {}) {
    return `
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px;">
        <div class="tbl-wrap" style="border:none;">
          <table style="width:100%;">
            <thead>
              <tr>
                ${Array(cols).fill(0).map(() => `
                  <th style="padding:12px 14px;">
                    <div class="skeleton" style="height:12px;width:75%;border-radius:3px;"></div>
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${Array(rows).fill(0).map(() => `
                <tr>
                  ${Array(cols).fill(0).map(() => `
                    <td style="padding:12px 14px;">
                      <div class="skeleton skeleton-row" style="height:20px;margin:2px 0;"></div>
                    </td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderPageSkeleton(type = 'dashboard') {
    const a11ySr = '<span style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;">Carregando módulo…</span>';
    if (type === 'table') {
      return `
        <div role="status" aria-label="Carregando módulo" class="page-skeleton">
          ${a11ySr}
          <div class="page-header">
            <div>
              <div class="skeleton" style="height:26px;width:240px;margin-bottom:8px;border-radius:6px;"></div>
              <div class="skeleton" style="height:14px;width:380px;border-radius:4px;"></div>
            </div>
            <div class="page-actions">
              <div class="skeleton" style="height:44px;width:140px;border-radius:8px;"></div>
            </div>
          </div>
          <div style="display:flex;gap:12px;margin-bottom:16px;">
            <div class="skeleton" style="height:44px;flex:1;border-radius:8px;"></div>
            <div class="skeleton" style="height:44px;width:160px;border-radius:8px;"></div>
          </div>
          ${this.renderTableSkeleton({ cols: 7, rows: 8 })}
        </div>
      `;
    }

    // Padrão Dashboard
    return `
      <div role="status" aria-label="Carregando módulo" class="page-skeleton">
        ${a11ySr}
        <div class="page-header">
          <div>
            <div class="skeleton" style="height:26px;width:220px;margin-bottom:8px;border-radius:6px;"></div>
            <div class="skeleton" style="height:14px;width:340px;border-radius:4px;"></div>
          </div>
          <div class="page-actions">
            <div class="skeleton" style="height:44px;width:150px;border-radius:8px;"></div>
          </div>
        </div>
        ${this.renderKpiSkeletons(6)}
        <div class="g2" style="margin-bottom:16px;">
          <div class="card" style="height:280px;padding:18px;">
            <div class="skeleton" style="height:18px;width:180px;margin-bottom:16px;"></div>
            <div class="skeleton" style="height:210px;width:100%;border-radius:8px;"></div>
          </div>
          <div class="card" style="height:280px;padding:18px;">
            <div class="skeleton" style="height:18px;width:180px;margin-bottom:16px;"></div>
            <div class="skeleton" style="height:210px;width:100%;border-radius:8px;"></div>
          </div>
        </div>
      </div>
    `;
  }
};

if (typeof window !== 'undefined' && !window.esc) {
  window.esc = (v) => (typeof Utils !== 'undefined' && Utils.escapeHtml) ? Utils.escapeHtml(String(v ?? '')) : (v == null ? '' : String(v));
}
