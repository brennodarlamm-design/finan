// Recursos opcionais: URLs fixas, carregamento único e nova tentativa após falha.
const FinObraAssets = (() => {
  const registry = Object.freeze({
    excel: { src:'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js', ready:() => typeof XLSX !== 'undefined' },
    zip: { src:'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', ready:() => typeof JSZip !== 'undefined' },
    pdf: { src:'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', ready:() => !!window.jspdf?.jsPDF },
    sinapiData: { src:'/js/sinapi.js', ready:() => typeof SINAPI !== 'undefined' },
    sinapi: { src:'/js/orcamento_sinapi.js', dependencies:['sinapiData'], ready:() => typeof OrcamentoSINAPI !== 'undefined' },
    reports: { src:'/js/exportar_templates.js', dependencies:['sinapi'], ready:() => typeof ExportarTemplates !== 'undefined' }
  });
  const pending = new Map();
  const ready = name => Object.prototype.hasOwnProperty.call(registry, name) && registry[name].ready();
  function load(name) {
    const resource = registry[name];
    if (!Object.prototype.hasOwnProperty.call(registry, name)) return Promise.reject(new Error('Recurso não permitido.'));
    if (ready(name)) return Promise.resolve();
    if (pending.has(name)) return pending.get(name);
    const promise = Promise.all((resource.dependencies || []).map(load)).then(() => new Promise((resolve, reject) => {
      if (ready(name)) { resolve(); return; }
      const script = document.createElement('script');
      script.src = resource.src;
      script.async = true;
      script.onload = () => {
        if (ready(name)) resolve();
        else { script.remove(); reject(new Error('O recurso não ficou disponível. Tente novamente.')); }
      };
      script.onerror = () => {
        script.remove();
        reject(new Error('Não foi possível carregar este recurso. Verifique a conexão e tente novamente.'));
      };
      document.head.appendChild(script);
    })).catch(error => { pending.delete(name); throw error; });
    pending.set(name, promise);
    return promise;
  }
  async function requireResource(name) {
    try {
      if (!ready(name)) Utils.toast('Preparando recurso…', 'info');
      await load(name);
      return true;
    } catch (error) { Utils.toast(error.message, 'warning'); return false; }
  }
  return Object.freeze({ load, ready, require:requireResource });
})();
