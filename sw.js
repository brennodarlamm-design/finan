/**
 * FinGo — Service Worker Oficial (PWA / TWA / Offline Cache & Web Push)
 * Versão: 2.40.0
 */

const CACHE_NAME = 'fingo-static-v2.40.0';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
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

  // Estratégia: Stale-While-Revalidate para CSS, JS, Imagens e Fontes
  if (
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/img/') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(event.request, networkResponse.clone()).catch(() => {});
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
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone).catch(() => {}));
        }
        return networkResponse;
      } catch (err) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        const accept = event.request.headers.get('accept') || '';
        const isHtml = event.request.mode === 'navigate' || accept.includes('text/html') || url.pathname.startsWith('/app');
        if (isHtml) {
          const appCached = await caches.match('/app.html');
          if (appCached) return appCached;
          const indexCached = (await caches.match('/index.html')) || (await caches.match('/'));
          if (indexCached) return indexCached;
        }
        return new Response('<html><body><h1>Modo Offline</h1><p>Conexão indisponível no momento.</p></body></html>', {
          status: 503,
          statusText: 'Service Unavailable',
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
