// FinObra Patch 11 — proteção contra frontend antigo após deploy.
(() => {
  const CURRENT = '2026.09.11-p11';
  window.FINOBRA_BUILD = CURRENT;
  const key = 'finobra_active_build';
  const reloadKey = 'finobra_build_reload_once';
  try {
    const previous = sessionStorage.getItem(key);
    sessionStorage.setItem(key, CURRENT);
    if (previous && previous !== CURRENT && sessionStorage.getItem(reloadKey) !== CURRENT) {
      sessionStorage.setItem(reloadKey, CURRENT);
      location.reload();
      return;
    }
  } catch {}

  const check = async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache:'no-store', credentials:'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.build && data.build !== CURRENT) {
        const marker = `reload:${data.build}`;
        if (sessionStorage.getItem(reloadKey) === marker) return;
        sessionStorage.setItem(reloadKey, marker);
        location.reload();
      }
    } catch {}
  };
  setTimeout(check, 1500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
})();
