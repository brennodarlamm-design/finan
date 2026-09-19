/**
 * FinGo — Service Worker Oficial (PWA / TWA / Offline Cache & Web Push)
 * Versão: 2.38.0
 */

const CACHE_NAME = 'fingo-static-v2.38.0';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
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
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Estratégia: Network-first com fallback para Cache para navegação HTML
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/app.html') || caches.match('/');
        }
      })
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
