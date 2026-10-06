// js/danfe_simplificado.js — DANFE simplificado gerado no navegador a partir do XML da NF-e.
// Substitui o PDF que vinha do MeuDanfe (com custo por nota). É uma representação para conferência
// e arquivo do lançamento; o documento fiscal é o XML autorizado pela SEFAZ.
// Carregado sob demanda por FinObraAssets.load('danfe'), que antes carrega o jsPDF.

const DanfeSimplificado = {
  _dados(xmlText) {
    const doc = new DOMParser().parseFromString(String(xmlText || ''), 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('XML da NF-e com erro de formatação.');
    const todos = (raiz, tag) => Array.from((raiz || doc).getElementsByTagNameNS('*', tag));
    const um = (raiz, tag) => todos(raiz, tag)[0] || null;
    const txt = (raiz, tag) => (um(raiz, tag)?.textContent || '').trim();
    const inf = um(doc, 'infNFe');
    if (!inf) throw new Error('O DANFE precisa do XML completo da NF-e (o resumo da SEFAZ não traz os produtos).');
    const ide = um(inf, 'ide'); const emit = um(inf, 'emit'); const dest = um(inf, 'dest');
    const endEmit = um(emit, 'enderEmit'); const endDest = um(dest, 'enderDest');
    const tot = um(inf, 'ICMSTot');
    const prot = um(doc, 'infProt');
    const endereco = (e) => e ? [txt(e, 'xLgr'), txt(e, 'nro'), txt(e, 'xBairro'), `${txt(e, 'xMun')}/${txt(e, 'UF')}`, txt(e, 'CEP')].filter(Boolean).join(', ') : '';
    const num = (v) => Number(v) || 0;
    return {
      chave: (inf.getAttribute('Id') || '').replace(/^NFe/, ''),
      numero: txt(ide, 'nNF'), serie: txt(ide, 'serie'), natOp: txt(ide, 'natOp'),
      tipo: txt(ide, 'tpNF') === '0' ? '0 - Entrada' : '1 - Saída',
      emissao: txt(ide, 'dhEmi') || txt(ide, 'dEmi'),
      emitente: { nome: txt(emit, 'xNome'), doc: txt(emit, 'CNPJ') || txt(emit, 'CPF'), ie: txt(emit, 'IE'), endereco: endereco(endEmit), fone: txt(endEmit, 'fone') },
      destinatario: { nome: txt(dest, 'xNome'), doc: txt(dest, 'CNPJ') || txt(dest, 'CPF'), ie: txt(dest, 'IE'), endereco: endereco(endDest) },
      protocolo: prot ? `${txt(prot, 'nProt')} — ${txt(prot, 'dhRecbto')}` : '',
      itens: todos(inf, 'det').map(d => {
        const p = um(d, 'prod');
        return { codigo: txt(p, 'cProd'), descricao: txt(p, 'xProd'), ncm: txt(p, 'NCM'), unidade: txt(p, 'uCom'), qtd: num(txt(p, 'qCom')), unit: num(txt(p, 'vUnCom')), total: num(txt(p, 'vProd')) };
      }),
      totais: { vProd: num(txt(tot, 'vProd')), vDesc: num(txt(tot, 'vDesc')), vFrete: num(txt(tot, 'vFrete')), vIPI: num(txt(tot, 'vIPI')), vICMS: num(txt(tot, 'vICMS')), vNF: num(txt(tot, 'vNF')) },
      duplicatas: todos(inf, 'dup').map(d => ({ numero: txt(d, 'nDup'), vencimento: txt(d, 'dVenc'), valor: num(txt(d, 'vDup')) })),
      infCpl: txt(um(inf, 'infAdic'), 'infCpl')
    };
  },

  _fmtDoc(v) {
    const d = String(v || '').replace(/\D/g, '');
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return v || '';
  },
  _moeda(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); },
  _num(v, casas = 4, minimo = 0) { return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: minimo, maximumFractionDigits: casas }); },
  _data(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || ''); },

  /** Gera o PDF e devolve o base64 (sem o prefixo data:). */
  gerarBase64(xmlText) {
    const d = this._dados(xmlText);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const M = 10, L = 190, ALTURA = 287;
    let y = M;
    const caixa = (h) => { pdf.setDrawColor(120); pdf.rect(M, y, L, h); };
    const rotulo = (t, x, yy) => { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(90); pdf.text(t, x, yy); };
    const valor = (t, x, yy, tam = 9, negrito = false) => { pdf.setFont('helvetica', negrito ? 'bold' : 'normal'); pdf.setFontSize(tam); pdf.setTextColor(20); pdf.text(String(t || '—'), x, yy); };
    const novaPagina = () => { pdf.addPage(); y = M; };
    const garantir = (h) => { if (y + h > ALTURA - M) novaPagina(); };

    // Cabeçalho
    caixa(24);
    valor(d.emitente.nome, M + 3, y + 6, 11, true);
    valor(`CNPJ/CPF ${this._fmtDoc(d.emitente.doc)}${d.emitente.ie ? `  ·  IE ${d.emitente.ie}` : ''}`, M + 3, y + 11, 8);
    pdf.setFontSize(7.5); pdf.text(pdf.splitTextToSize(d.emitente.endereco + (d.emitente.fone ? `  ·  Fone ${d.emitente.fone}` : ''), 120), M + 3, y + 15);
    valor('DANFE SIMPLIFICADO', M + 135, y + 6, 11, true);
    valor(`NF-e nº ${d.numero}  ·  Série ${d.serie}`, M + 135, y + 11, 8.5);
    valor(`Emissão ${this._data(d.emissao)}  ·  ${d.tipo}`, M + 135, y + 15, 8);
    rotulo('Representação simplificada da NF-e.', M + 135, y + 19);
    rotulo('O documento fiscal é o XML autorizado.', M + 135, y + 22);
    y += 26;

    caixa(16);
    rotulo('CHAVE DE ACESSO', M + 3, y + 4);
    valor(d.chave.replace(/(\d{4})(?=\d)/g, '$1 '), M + 3, y + 9, 9.5, true);
    rotulo(`NATUREZA DA OPERAÇÃO: ${d.natOp || '—'}`, M + 3, y + 14);
    if (d.protocolo) rotulo(`PROTOCOLO DE AUTORIZAÇÃO: ${d.protocolo}`, M + 100, y + 14);
    y += 18;

    caixa(14);
    rotulo('DESTINATÁRIO', M + 3, y + 4);
    valor(`${d.destinatario.nome}  ·  ${this._fmtDoc(d.destinatario.doc)}`, M + 3, y + 8.5, 8.5, true);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.text(pdf.splitTextToSize(d.destinatario.endereco || '', L - 6)[0] || '', M + 3, y + 12);
    y += 16;

    // Itens
    const col = [M + 2, M + 24, M + 120, M + 133, M + 152, M + 172];
    const cabecalhoItens = () => {
      pdf.setFillColor(235); pdf.rect(M, y, L, 6, 'F');
      ['Código', 'Descrição', 'Un', 'Qtd', 'V. unit.', 'V. total'].forEach((t, i) => rotulo(t, col[i], y + 4));
      y += 7;
    };
    rotulo(`PRODUTOS / SERVIÇOS (${d.itens.length})`, M, y + 3); y += 5;
    cabecalhoItens();
    pdf.setFontSize(7.5);
    for (const it of d.itens) {
      const linhas = pdf.splitTextToSize(it.descricao || '', 94);
      const h = Math.max(4.5, linhas.length * 3.4 + 1.2);
      if (y + h > ALTURA - M) { novaPagina(); cabecalhoItens(); pdf.setFontSize(7.5); }
      pdf.setFont('helvetica', 'normal'); pdf.setTextColor(20);
      pdf.text(String(it.codigo || '').slice(0, 14), col[0], y + 3);
      pdf.text(linhas, col[1], y + 3);
      pdf.text(String(it.unidade || ''), col[2], y + 3);
      pdf.text(this._num(it.qtd), col[3], y + 3);
      pdf.text(this._num(it.unit, 4, 2), col[4], y + 3);
      pdf.text(this._moeda(it.total), col[5], y + 3);
      y += h;
      pdf.setDrawColor(225); pdf.line(M, y - 0.6, M + L, y - 0.6);
    }

    // Totais e duplicatas
    garantir(30);
    y += 3;
    caixa(14);
    const t = d.totais;
    [['Produtos', t.vProd], ['Desconto', t.vDesc], ['Frete', t.vFrete], ['IPI', t.vIPI], ['ICMS', t.vICMS]].forEach(([n, v], i) => {
      rotulo(n.toUpperCase(), M + 3 + i * 30, y + 4); valor(this._moeda(v), M + 3 + i * 30, y + 9, 8.5);
    });
    rotulo('VALOR TOTAL DA NOTA', M + 153, y + 4); valor(this._moeda(t.vNF), M + 153, y + 10, 11, true);
    y += 16;
    if (d.duplicatas.length) {
      garantir(10);
      rotulo('DUPLICATAS', M, y + 3); y += 5;
      const texto = d.duplicatas.map(dp => `${dp.numero || '—'}: ${this._data(dp.vencimento)} ${this._moeda(dp.valor)}`).join('    ');
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(20);
      const linhas = pdf.splitTextToSize(texto, L);
      garantir(linhas.length * 4);
      pdf.text(linhas, M, y + 3); y += linhas.length * 4 + 2;
    }
    if (d.infCpl) {
      const linhas = pdf.splitTextToSize(d.infCpl, L).slice(0, 12);
      garantir(linhas.length * 3.4 + 6);
      rotulo('INFORMAÇÕES COMPLEMENTARES', M, y + 3); y += 5;
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(40);
      pdf.text(linhas, M, y + 2);
    }

    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i); rotulo(`Gerado pelo FinGo a partir do XML da NF-e  ·  página ${i}/${total}`, M, ALTURA + 5);
    }
    return pdf.output('datauristring').split(',')[1];
  }
};

if (typeof window !== 'undefined') window.DanfeSimplificado = DanfeSimplificado;
