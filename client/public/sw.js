/**
 * Service Worker for AI 우리병원 문화센터
 * Firebase 인증과 호환되도록 설계됨
 * 
 * ⚠️ 캐시 전략:
 * - HTML/네비게이션 요청: network-only (항상 최신 버전 사용)
 * - JS/CSS (해시 파일): network-only (서버 Cache-Control에 위임)
 * - 이미지/음악: cache-first (성능 최적화)
 * - API 요청: network-only (실시간 데이터)
 */

// __SW_BUILD_VERSION__ 은 Vite 빌드 시 자동으로 현재 날짜(예: v202602201330)로 교체됩니다
const SW_VERSION = '__SW_BUILD_VERSION__';
const CACHE_NAME = `hospital-ai-${SW_VERSION}`;
const IMAGE_CACHE = `images-${SW_VERSION}`;
const MUSIC_CACHE = `music-${SW_VERSION}`;

// 캐시에서 제외할 경로 (Firebase 인증 관련)
const EXCLUDE_PATHS = [
  '/__/auth/',
  '/auth/',
  '/api/auth/',
  'firebaseapp.com',
  'googleapis.com',
  'google.com/recaptcha'
];

// 설치 이벤트 - 즉시 활성화 (이전 캐시 의존 제거)
self.addEventListener('install', (event) => {
  console.log('[SW] 설치 중... 버전:', CACHE_NAME);
  // 즉시 활성화 - 이전 SW를 기다리지 않음
  self.skipWaiting();
});

// 활성화 이벤트 - 이전 캐시 전부 삭제
self.addEventListener('activate', (event) => {
  console.log('[SW] 활성화 중...');

  event.waitUntil(
    Promise.all([
      // 이전 버전의 캐시 모두 삭제
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // 현재 버전의 이미지/음악 캐시만 유지
            if (cacheName !== IMAGE_CACHE && cacheName !== MUSIC_CACHE) {
              console.log('[SW] 이전 캐시 삭제:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // 모든 클라이언트 즉시 제어
      self.clients.claim()
    ])
  );
});

// Fetch 이벤트 - 네트워크 요청 처리
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. 캐시 불가능한 스킴 필터링
  const unsupportedSchemes = ['chrome-extension:', 'devtools:', 'blob:', 'data:', 'file:'];
  if (unsupportedSchemes.some(scheme => request.url.startsWith(scheme))) {
    return;
  }

  // 2. http/https만 허용
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // 3. Firebase 인증 관련 요청은 무조건 통과
  if (shouldExcludeFromCache(url.href)) {
    return;
  }

  // 4. GET 요청만 처리
  if (request.method !== 'GET') {
    return;
  }

  // 5. 네비게이션 요청 (HTML 페이지) → 항상 네트워크에서 가져옴
  //    이것이 배포 후 캐시 불일치 문제를 방지하는 핵심!
  if (request.mode === 'navigate') {
    return; // SW가 개입하지 않음 → 브라우저 기본 동작 (서버에서 최신 HTML)
  }

  // 6. JS/CSS 파일 → SW가 개입하지 않음 (서버 Cache-Control 헤더에 위임)
  //    해시 포함 파일은 서버에서 immutable 캐시, index.html은 no-cache
  if (isJsCssRequest(url)) {
    return;
  }

  // 7. API 요청 → SW가 개입하지 않음
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 8. 이미지 요청 → 캐시 우선 (성능 최적화)
  if (isImageRequest(request, url)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // 9. 음악 파일 → 캐시 우선 (성능 최적화)
  if (isMusicRequest(request, url)) {
    event.respondWith(cacheFirst(request, MUSIC_CACHE));
    return;
  }

  // 10. 기타 요청 → SW가 개입하지 않음
  return;
});

// 캐시 제외 여부 확인
function shouldExcludeFromCache(url) {
  return EXCLUDE_PATHS.some(path => url.includes(path));
}

// JS/CSS 파일 확인
function isJsCssRequest(url) {
  return url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.mjs') ||
    url.pathname.includes('/assets/');
}

// 캐시 우선 전략 (이미지/음악 전용)
async function cacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      // 백그라운드에서 조용히 업데이트
      fetch(request).then((response) => {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
      }).catch(() => { /* 백그라운드 업데이트 실패 무시 */ });

      return cachedResponse;
    }

    // 캐시에 없으면 네트워크에서 가져와서 캐시
    const response = await fetch(request);

    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // 네트워크도 캐시도 실패하면 그냥 에러 전파
    throw error;
  }
}

// 이미지 요청 확인
function isImageRequest(request, url) {
  return request.destination === 'image' ||
    url.pathname.includes('/images/') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.gif');
}

// 음악 파일 요청 확인
function isMusicRequest(request, url) {
  return url.pathname.includes('/api/music/stream/') ||
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.wav') ||
    url.pathname.endsWith('.m4a');
}

// 메시지 이벤트 처리 (클라이언트와의 통신)
self.addEventListener('message', (event) => {
  const { type } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_NAME });
      break;

    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;

    default:
      console.log('[SW] 알 수 없는 메시지:', type);
  }
});

// 모든 캐시 삭제
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
}

console.log('[SW] Service Worker 로드됨 - 버전:', SW_VERSION);