// service-worker.js
const isProduction = process.env.NODE_ENV === 'production'

self.addEventListener('fetch', function(event) {
    // Intercepta la solicitud
    if (isProduction && !event.request.url.includes('v1')) return;
    console.log('event.request.url: ', event.request.url);
    event.respondWith(
      console.log('event.request: ', event.request),
      caches.match(event.request).then(function(response) {
        // Si hay una respuesta en caché, la devuelve
        if (response) {
          return response;
        }
        // De lo contrario, hace la solicitud a la red
        return fetch(event.request).then(function(response) {
          // Abre la caché y guarda la respuesta para la próxima vez
          return caches.open('dynamic-cache').then(function(cache) {
            cache.put(event.request.url, response.clone());
            return response;
          });
        });
      })
    );
  });
