/**
 * FinGo — Calculadora de BDI Online Oficial
 * Acórdão nº 2622/2013 - TCU e Decreto Federal nº 7.983/2013
 */

(function () {
  const presets = {
    min: { ac: 3.00, s: 0.80, r: 0.97, g: 0.80, df: 0.59, l: 6.16, iss: 2.00, pis: 0.65, cofins: 3.00 },
    med: { ac: 4.00, s: 0.80, r: 0.97, g: 0.80, df: 1.23, l: 7.40, iss: 2.00, pis: 0.65, cofins: 3.00 },
    max: { ac: 5.50, s: 1.00, r: 1.27, g: 1.00, df: 1.39, l: 8.96, iss: 2.00, pis: 0.65, cofins: 3.00 }
  };

  function applyPreset(key, clickedBtn) {
    const p = presets[key];
    if (!p) return;
    const acEl = document.getElementById('ac');
    const sEl = document.getElementById('s');
    const rEl = document.getElementById('r');
    const gEl = document.getElementById('g');
    const dfEl = document.getElementById('df');
    const lEl = document.getElementById('l');
    const issEl = document.getElementById('iss');
    const pisEl = document.getElementById('pis');
    const cofinsEl = document.getElementById('cofins');

    if (acEl) acEl.value = p.ac.toFixed(2);
    if (sEl) sEl.value = p.s.toFixed(2);
    if (rEl) rEl.value = p.r.toFixed(2);
    if (gEl) gEl.value = p.g.toFixed(2);
    if (dfEl) dfEl.value = p.df.toFixed(2);
    if (lEl) lEl.value = p.l.toFixed(2);
    if (issEl) issEl.value = p.iss.toFixed(2);
    if (pisEl) pisEl.value = p.pis.toFixed(2);
    if (cofinsEl) cofinsEl.value = p.cofins.toFixed(2);

    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    if (clickedBtn) clickedBtn.classList.add('active');
    calculateBDI();
  }

  function calculateBDI() {
    const ac = (parseFloat(document.getElementById('ac')?.value) || 0) / 100;
    const s = (parseFloat(document.getElementById('s')?.value) || 0) / 100;
    const r = (parseFloat(document.getElementById('r')?.value) || 0) / 100;
    const g = (parseFloat(document.getElementById('g')?.value) || 0) / 100;
    const df = (parseFloat(document.getElementById('df')?.value) || 0) / 100;
    const l = (parseFloat(document.getElementById('l')?.value) || 0) / 100;

    const pis = (parseFloat(document.getElementById('pis')?.value) || 0) / 100;
    const cofins = (parseFloat(document.getElementById('cofins')?.value) || 0) / 100;
    const iss = (parseFloat(document.getElementById('iss')?.value) || 0) / 100;
    const isDesonerado = !!document.getElementById('desoneracao')?.checked;
    const cprb = isDesonerado ? 0.045 : 0;

    const cprbEl = document.getElementById('cprb_display');
    if (cprbEl) cprbEl.value = (cprb * 100).toFixed(2).replace('.', ',');

    const totalI = pis + cofins + iss + cprb;

    // TCU Formula: [ ((1 + AC + S + R + G) * (1 + DF) * (1 + L)) / (1 - I) - 1 ] * 100
    const numerator = (1 + ac + s + r + g) * (1 + df) * (1 + l);
    const denominator = 1 - totalI;

    let bdi = 0;
    if (denominator > 0) {
      bdi = ((numerator / denominator) - 1) * 100;
    }

    const bdiFixed = bdi.toFixed(2);
    const bdiResultEl = document.getElementById('bdi_result');
    const sumTotalEl = document.getElementById('sum_total');
    if (bdiResultEl) bdiResultEl.innerText = bdiFixed.replace('.', ',') + '%';
    if (sumTotalEl) sumTotalEl.innerText = bdiFixed.replace('.', ',') + '%';

    const sumAcEl = document.getElementById('sum_ac');
    const sumSrgEl = document.getElementById('sum_srg');
    const sumDfEl = document.getElementById('sum_df');
    const sumLEl = document.getElementById('sum_l');
    const sumIEl = document.getElementById('sum_i');

    if (sumAcEl) sumAcEl.innerText = (ac * 100).toFixed(2).replace('.', ',') + '%';
    if (sumSrgEl) sumSrgEl.innerText = ((s + r + g) * 100).toFixed(2).replace('.', ',') + '%';
    if (sumDfEl) sumDfEl.innerText = (df * 100).toFixed(2).replace('.', ',') + '%';
    if (sumLEl) sumLEl.innerText = (l * 100).toFixed(2).replace('.', ',') + '%';
    if (sumIEl) sumIEl.innerText = (totalI * 100).toFixed(2).replace('.', ',') + '%';

    const statusEl = document.getElementById('bdi_status');
    if (statusEl) {
      if (bdi >= 20.34 && bdi <= 25.00) {
        statusEl.className = 'bdi-status status-ok';
        statusEl.innerText = 'Dentro da faixa recomendada pelo TCU (Edificações)';
      } else if (bdi < 20.34) {
        statusEl.className = 'bdi-status status-warn';
        statusEl.innerText = 'Abaixo do 1º quartil TCU (20,34%) — Risco de inexequibilidade';
      } else {
        statusEl.className = 'bdi-status status-warn';
        statusEl.innerText = 'Acima do 3º quartil TCU (25,00%) — Justificativa exigida em licitações';
      }
    }
  }

  function copyMemorial() {
    const bdi = document.getElementById('bdi_result')?.innerText || '';
    const ac = document.getElementById('sum_ac')?.innerText || '';
    const srg = document.getElementById('sum_srg')?.innerText || '';
    const df = document.getElementById('sum_df')?.innerText || '';
    const l = document.getElementById('sum_l')?.innerText || '';
    const i = document.getElementById('sum_i')?.innerText || '';
    const deson = document.getElementById('desoneracao')?.checked ? 'Sim (CPRB 4,5%)' : 'Não';

    const text = `MEMORIAL DE CÁLCULO DE BDI (TCU Acórdão 2622/2013)\nFonte: FinGo (https://fingo.api.br/calculadora-bdi)\n----------------------------------------\nAdministração Central (AC): ${ac}\nSeguro + Risco + Garantia (S+R+G): ${srg}\nDespesas Financeiras (DF): ${df}\nLucro Bruto (L): ${l}\nTributos Totais (I): ${i}\nRegime Desonerado: ${deson}\n----------------------------------------\nTAXA DE BDI FINAL: ${bdi}\nFórmula: [((1 + AC + S + R + G) * (1 + DF) * (1 + L)) / (1 - I) - 1] * 100`;

    navigator.clipboard.writeText(text).then(() => {
      const toast = document.getElementById('toast');
      if (toast) {
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
      }
    });
  }

  function init() {
    // Attach event listeners cleanly without inline attributes (CSP compliant)
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        applyPreset(btn.dataset.preset, e.currentTarget);
      });
    });

    const numInputIds = ['ac', 's', 'r', 'g', 'df', 'l', 'pis', 'cofins', 'iss'];
    numInputIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', calculateBDI);
    });

    const desonEl = document.getElementById('desoneracao');
    if (desonEl) desonEl.addEventListener('change', calculateBDI);

    const btnCopy = document.getElementById('btn_copy');
    if (btnCopy) btnCopy.addEventListener('click', copyMemorial);

    const btnPrint = document.getElementById('btn_print');
    if (btnPrint) btnPrint.addEventListener('click', () => window.print());

    // Inicializa o cálculo
    calculateBDI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
