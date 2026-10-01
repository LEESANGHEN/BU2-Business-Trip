/* PWA 설치 조건(서비스 워커 등록)만 만족시키는 최소 버전이다.
   오프라인 캐싱은 일부러 하지 않는다 — 항상 네트워크에서 최신 파일을 가져와야
   git push로 배포한 변경 사항이 설치된 PWA 창에도 새로고침만으로 즉시 반영된다. */
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(e){
  e.respondWith(fetch(e.request));
});
