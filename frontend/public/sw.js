const CACHE_NAME = "sessaoink-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// Instalação: cria cache inicial
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Ativação: limpa caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: estratégia Network-First com Fallback para Cache
self.addEventListener("fetch", (event) => {
  // Evitar interceptar chamadas de API ou extensões de terceiros
  if (
    event.request.url.startsWith(self.location.origin) &&
    !event.request.url.includes("/api/")
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Atualiza o cache com a resposta mais recente
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Se falhar a rede (offline), serve do cache
          return caches.match(event.request);
        })
    );
  }
});
