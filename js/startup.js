// Métricas locais sem dados pessoais; disponíveis em performance.getEntriesByType('measure').
(() => {
  const mark = name => { try { performance.mark(`finobra:${name}`); } catch {} };
  const measure = (name, start, end) => {
    try { performance.measure(`finobra:${name}`, start ? `finobra:${start}` : undefined, `finobra:${end}`); } catch {}
  };
  const fail = (message = 'Não foi possível abrir o sistema. Verifique sua conexão e tente novamente.') => {
    const root = document.getElementById('app-startup');
    if (!root) return;
    root.setAttribute('aria-busy', 'false');
    document.getElementById('startup-title').textContent = 'Vamos tentar novamente';
    document.getElementById('startup-message').textContent = message;
    document.getElementById('startup-actions').hidden = false;
    clearTimeout(watchdog);
    mark('startup-error');
  };
  const watchdog = setTimeout(() => fail('O carregamento está demorando mais que o esperado. Você pode tentar novamente.'), 20000);
  window.FinObraStartup = Object.freeze({
    mark, measure, fail,
    ready() {
      clearTimeout(watchdog);
      mark('shell-visible');
      measure('navigation-to-shell', null, 'shell-visible');
    }
  });
  mark('startup-script');
  window.addEventListener('error', event => {
    if (event.target?.tagName === 'SCRIPT' || event.error) fail();
  }, true);
})();
