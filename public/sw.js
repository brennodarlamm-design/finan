/**
 * FinGo — Service Worker Oficial (PWA / TWA / Offline Cache & Web Push)
 * Versão: 2.40.7
 *
 * VARREDURA 2026-10-03 #35: cada deploy (novo ?v=) somava mais uma cópia de todo o JS no cache
 * (cerca de 3,4 MB por versão), e vídeos e JSONs grandes também iam parar lá. Agora:
 *   • JS/CSS/imagens ficam guardados pelo caminho, sem a query: a versão nova substitui a antiga;
 *   • vídeos, respostas parciais (206) e /data (SINAPI, ~3 MB cada) não entram no cache;
 *   • fora de JS/CSS/imagens, só a navegação HTML é guardada (para abrir offline).
 */

const CACHE_NAME = 'fingo-static-v2.40.7';

// Chave sem query string: /js/data.js?v=A e ?v=B ocupam a mesma entrada.
function chaveSemQuery(request) {
  const u = new URL(request.url);
  u.search = '';
  return u.toString();
}

function naoCachear(url) {
  return /\.(mp4|webm|mov|m4v|mp3)$/i.test(url.pathname) || url.pathname.startsWith('/data/');
}

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/login',
  '/app.html',
  '/css/tokens.css',
  '/css/style.css',
  '/css/premium.css',
  '/css/startup.css',
  '/favicon.svg',
  '/favicon-192x192.png',
  '/apple-touch-icon.png',
  '/img/fingo/fingo-symbol.png',
  '/img/fingo/fingo-wordmark.png',
  '/site.webmanifest'
];

// 1. Instalação: Pré-cache dos ativos estruturais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[FinGo SW] Pré-cache parcial:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Ativação: Limpeza de caches obsoletos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Interceptação de Requisições (Fetch)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Não intercepta chamadas de API nem WebSockets/Mutations (sempre rede)
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  if (naoCachear(url)) return; // segue direto para a rede (o navegador usa o cache HTTP)

  // Estratégia: rede primeiro (código sempre atualizado), com cópia local para usar offline.
  if (
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/img/') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const mesmaOrigem = url.origin === self.location.origin;
        const chave = mesmaOrigem ? chaveSemQuery(event.request) : event.request;
        const cachedResponse = await cache.match(chave);
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(chave, networkResponse.clone()).catch(() => {});
          }
          return networkResponse;
        } catch (e) {
          if (cachedResponse) return cachedResponse;
          return new Response('', { status: 408, statusText: 'Offline' });
        }
      })
    );
    return;
  }

  // Estratégia: Network-first com fallback garantido para navegação HTML
  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(event.request);
        const ehNavegacao = event.request.mode === 'navigate';
        if (ehNavegacao && networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(chaveSemQuery(event.request), resClone).catch(() => {}));
        }
        return networkResponse;
      } catch (err) {
        const cached = (await caches.match(event.request)) || (await caches.match(chaveSemQuery(event.request)));
        if (cached) return cached;
        const accept = event.request.headers.get('accept') || '';
        const isHtml = event.request.mode === 'navigate' || accept.includes('text/html') || url.pathname.startsWith('/app');
        if (isHtml) {
          if (url.pathname === '/login' || url.pathname === '/login.html' || url.pathname === '/cadastro') {
            const loginCached = (await caches.match('/login.html')) || (await caches.match('/login')) || (await caches.match('/index.html'));
            if (loginCached) return loginCached;
          }
          const appCached = await caches.match('/app.html');
          if (appCached) return appCached;
          const indexCached = (await caches.match('/index.html')) || (await caches.match('/'));
          if (indexCached) return indexCached;
        }
        return new Response('<html><body><h1>Modo Offline</h1><p>Conexão indisponível no momento.</p></body></html>', {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'text/html;charset=utf-8' }
        });
      }
    })()
  );
});

// 4. Notificações Web Push Nativas
self.addEventListener('push', (event) => {
  let data = {
    title: 'FinGo — Obras em Fluxo',
    body: 'Você possui uma nova atualização de canteiro ou aprovação pendente.',
    icon: '/favicon-192x192.png',
    badge: '/favicon-32x32.png',
    data: { url: '/app' }
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon-192x192.png',
    badge: data.badge || '/favicon-32x32.png',
    vibrate: [100, 50, 100],
    data: data.data || { url: '/app' },
    actions: [
      { action: 'open', title: 'Abrir no FinGo' },
      { action: 'close', title: 'Fechar' }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 5. Clique na Notificação Push
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/app';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
