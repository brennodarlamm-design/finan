// Identidade visual e apresentação responsiva, sem alterações de dados.
const FinObraUI = (() => {
  const paths = {
    dashboard:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    obras:'M3 21V8l9-5 9 5v13M8 21v-7h8v7M8 9h.01M16 9h.01',
    lancamentos:'M4 7h16M16 3l4 4-4 4M20 17H4M8 13l-4 4 4 4',
    fornecedores:'M3 6h11v12H3zM14 10h4l3 4v4h-7M6 18v3M18 18v3',
    produtos:'M12 3l9 5-9 5-9-5 9-5zM3 8v9l9 5 9-5V8M12 13v9',
    escritorio:'M4 21V3h12v18M16 9h4v12M8 7h4M8 11h4M8 15h4M2 21h20',
    'pre-compras':'M3 3h2l3 12h11l2-8H6M9 20h.01M18 20h.01',
    recibos:'M5 3h14v18l-3-2-4 2-4-2-3 2V3zM9 7h6M9 11h6',
    contratos:'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5',
    'notas-fiscais':'M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h5',
    'consulta-nfe':'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M15 15l6 6',
    'conciliacao-ofx':'M4 9a8 8 0 0 1 14-4l2 2M20 3v4h-4M20 15a8 8 0 0 1-14 4l-2-2M4 21v-4h4',
    orcamentos:'M5 3h14v18H5zM8 7h8M8 12h2M14 12h2M8 16h2M14 16h2',
    medicoes:'M4 20V11M10 20V4M16 20v-7M22 20H2',
    documentacao:'M3 6h7l2 3h9v11H3V6zM3 6V4h7l2 2h8v3',
    relatorios:'M5 3h14v18H5zM9 16v-4M13 16V8M17 16v-6',
    planos:'M12 3l9 5-3 11H6L3 8l9-5zM3 8h18M8 8l4 11 4-11',
    'contas-bancarias':'M3 10h18M12 3l9 5H3l9-5zM5 12v7M10 12v7M15 12v7M20 12v7M2 21h20',
    configuracoes:'M4 7h16M4 17h16M8 4v6M16 14v6',
    menu:'M4 6h16M4 12h16M4 18h16'
  };
  const icon = name => `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.documentacao}"/></svg>`;
  function enhance(root) {
    if (!root) return;
    root.querySelectorAll('table').forEach(table => {
      let region = table.parentElement;
      while (region && region !== root && !/auto|scroll/.test(getComputedStyle(region).overflowX)) region = region.parentElement;
      if (!region || region === root) return;
      if (!region.classList.contains('table-scroll-region')) {
        region.classList.add('table-scroll-region');
        region.setAttribute('role','region');
        region.setAttribute('aria-label','Tabela: role horizontalmente para visualizar todas as colunas');
        region.addEventListener('keydown', event => {
          if (event.target !== region || event.ctrlKey || event.altKey || event.metaKey) return;
          const positions = {ArrowLeft:region.scrollLeft-80,ArrowRight:region.scrollLeft+80,Home:0,End:region.scrollWidth};
          if (!(event.key in positions)) return;
          event.preventDefault();
          region.scrollLeft = positions[event.key];
        });
      }
      region.tabIndex = region.scrollWidth > region.clientWidth + 2 ? 0 : -1;
    });
    root.querySelectorAll('.page-title,.card-title,.kpi-change').forEach(element => {
      const node = element.firstChild;
      if (node?.nodeType !== 3) return;
      const value = node.textContent.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '');
      if (value !== node.textContent) node.textContent = value;
    });
    root.querySelectorAll('.tbl-wrap>table,.table-wrap>table').forEach(table => {
      if (table.closest('#print-sheet,#print-sheet-wrapper')) return;
      const headers = Array.from(table.querySelectorAll('thead tr:first-child th'));
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      if (headers.length < 4 || !rows.length || rows.some(row => row.children.length !== headers.length || Array.from(row.children).some(cell => cell.colSpan > 1 || cell.rowSpan > 1))) { delete table.dataset.mobileCards; return; }
      table.dataset.mobileCards = 'true';
      rows.forEach(row => Array.from(row.children).forEach((cell,index) => {
        const label = headers[index].textContent.trim();
        if (cell.dataset.label !== label) cell.dataset.label = label;
      }));
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    const mobile = matchMedia('(max-width:768px)');
    mobile.addEventListener('change', () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) { sidebar.classList.remove('open'); sidebar.inert = mobile.matches; }
      document.getElementById('sidebar-overlay')?.classList.remove('active');
      document.getElementById('mob-menu')?.setAttribute('aria-expanded','false');
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.getElementById('sidebar')?.classList.contains('open')) {
        App.closeSidebar(); document.getElementById('mob-menu')?.focus();
      }
    });
    const root = document.getElementById('app-root');
    if (!root) return;
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; enhance(document.getElementById('route-content')); });
    }).observe(root,{childList:true,subtree:true});
    enhance(document.getElementById('route-content'));
    window.addEventListener('resize', () => enhance(document.getElementById('route-content')));
  }, {once:true});
  return Object.freeze({icon,enhance});
})();
