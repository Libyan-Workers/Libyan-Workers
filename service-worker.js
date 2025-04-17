const CACHE_NAME = 'map-resources-v1';
const urlsToCache = [
  '/',  // عند طلب "/" سيُعاد ملف index.html من الخادم
  'https://api.mapbox.com/mapbox-gl-js/v2.14.1/mapbox-gl.css',
  'https://api.mapbox.com/mapbox-gl-js/v2.14.1/mapbox-gl.js',
  'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-directions/v4.1.1/mapbox-gl-directions.css',
  'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-directions/v4.1.1/mapbox-gl-directions.js'
];

// عند تثبيت Service Worker نقوم بتخزين الموارد في الكاش
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

// منع تخزين طلبات POST والتعامل مع الطلبات من الكاش أولاً
self.addEventListener('fetch', event => {
  if (event.request.method === 'POST') {
    return;  // منع تخزين الطلبات من نوع POST
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // إعادة الاستجابة من الكاش إذا كانت موجودة
        }

        return fetch(event.request)
          .then(networkResponse => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // تخزين نسخة من الاستجابة في الكاش
            return caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          });
      })
      .catch(() => {
        // رد افتراضي إذا لم يكن هناك اتصال بالإنترنت
        return new Response('⚠️ لا يمكن تحميل المحتوى، تأكد من اتصالك بالإنترنت.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      })
  );
});

// تنظيف الكاش عند تحديث Service Worker
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
