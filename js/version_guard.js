// FinObra Patch 37 — release guard por commit real de Edge/API.
(() => {
  const edgeKey = 'finobra_edge_release_commit';
  const reloadKey = 'finobra_release_reload_once';

  const loadEdge = async () => {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache:'no-store', credentials:'same-origin' });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data || !data.commit || data.commit === 'unknown') return null;
    return data;
  };

  const loadApi = async () => {
    const res = await fetch(`/api/health?t=${Date.now()}`, { cache:'no-store', credentials:'same-origin' });
    if (!res.ok) return null;
    return res.json().catch(() => null);
  };

  const check = async () => {
    try {
      const edge = await loadEdge();
      if (!edge) return;
      window.FINOBRA_RELEASE = edge;

      const previous = sessionStorage.getItem(edgeKey);
      sessionStorage.setItem(edgeKey, edge.commit);
      if (previous && previous !== edge.commit && sessionStorage.getItem(reloadKey) !== edge.commit) {
        sessionStorage.setItem(reloadKey, edge.commit);
        location.reload();
        return;
      }

      const api = await loadApi();
      if (api) window.FINOBRA_API_RELEASE = api.release || null;
      const apiCommit = api?.release?.commit || null;
      const aligned = !!apiCommit && apiCommit !== 'unknown' && apiCommit === edge.commit;
      window.FINOBRA_RELEASE_ALIGNED = aligned;
      document.dispatchEvent(new CustomEvent('finobra:release-status', { detail:{ edge, api, aligned } }));
      if (apiCommit && apiCommit !== 'unknown' && !aligned) {
        console.warn('[FinObra Release] Frontend e API estão em versões diferentes.', { edge:edge.commit, api:apiCommit });
      }
    } catch {}
  };

  setTimeout(check, 1200);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
})();
