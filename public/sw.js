/**
 * 최소 PWA 서비스 워커.
 * 설치 가능 조건(HTTPS + manifest + SW) 충족용. 오프라인 캐시는 없음.
 */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
