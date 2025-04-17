const CACHE_NAME = 'map-resources-v1';
const urlsToCache = [
  './',  // المسار النسبي لملف index.html
  'https://api.mapbox.com/mapbox-gl-js/v2.14.1/mapbox-gl.css',
  'https://api.mapbox.com/mapbox-gl-js/v2.14.1/mapbox-gl.js',
  'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-directions/v4.1.1/mapbox-gl-directions.css',
  'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-directions/v4.1.1/mapbox-gl-directions.js'
];

self.addEventListener('install', event => {
  console.log('تثبيت Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.all(
          urlsToCache.map(url => {
            return fetch(url)
              .then(response => {
                if (!response.ok) throw new Error(`فشل تحميل ${url}`);
                return cache.put(url, response);
              })
              .catch(err => console.error('خطأ في تخزين', url, err));
          })
        );
      })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method === 'POST') return;

  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request)
        .then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }))
      .catch(() => new Response('⚠️ لا يمكن تحميل المحتوى، تأكد من اتصالك بالإنترنت.', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({ 'Content-Type': 'text/plain' })
      }))
  );
});

self.addEventListener('activate', event => {
  console.log('تنشيط Service Worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('🔄 حذف الكاش القديم:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});
