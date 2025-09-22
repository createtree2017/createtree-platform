/**
 * Service Worker for AI 우리병원 문화센터
 * Firebase 인증과 호환되도록 설계됨
 */

const CACHE_NAME = 'hospital-ai-v2025070301';
const STATIC_CACHE = 'static-v2025070301';
const DYNAMIC_CACHE = 'dynamic-v2025070301';
const IMAGE_CACHE = 'images-v2025070301';
const MUSIC_CACHE = 'music-v2025070301';

// 캐시할 정적 리소스 (핵심 파일만)
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.svg'
];

// 캐시에서 제외할 경로 (Firebase 인증 관련)
const EXCLUDE_PATHS = [
  '/__/auth/',
  '/auth/',
  '/api/auth/',
  'firebaseapp.com',
  'googleapis.com',
  'google.com/recaptcha'
];

// 설치 이벤트 - 핵심 리소스만 캐시
self.addEventListener('install', (event) => {
  console.log('[SW] 설치 중... 버전:', CACHE_NAME);
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] 정적 리소스 캐시 중');
      return cache.addAll(STATIC_ASSETS.filter(url => url !== '/'));
    }).then(() => {
      console.log('[SW] 설치 완료');
    }).catch((error) => {
      console.error('[SW] 설치 중 오류:', error);
      // 캐시 실패해도 설치는 진행
      return Promise.resolve();
    })
  );
  
  // 즉시 활성화
  self.skipWaiting();
});

// 활성화 이벤트 - 이전 캐시 정리
self.addEventListener('activate', (event) => {
  console.log('[SW] 활성화 중...');
  
  event.waitUntil(
    Promise.all([
      // 이전 캐시 삭제
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== IMAGE_CACHE &&
                cacheName !== MUSIC_CACHE) {
              console.log('[SW] 이전 캐시 삭제:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // 모든 클라이언트 제어
      self.clients.claim()
    ])
  );
});

// Fetch 이벤트 - 네트워크 요청 처리
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Firebase 인증 관련 요청은 캐시하지 않음
  if (shouldExcludeFromCache(url.href)) {
    return; // 기본 네트워크 요청 사용
  }
  
  // GET 요청만 캐시 처리
  if (request.method !== 'GET') {
    return;
  }
  
  event.respondWith(handleFetchRequest(request, url));
});

// 캐시 제외 여부 확인
function shouldExcludeFromCache(url) {
  return EXCLUDE_PATHS.some(path => url.includes(path));
}

// Fetch 요청 처리
async function handleFetchRequest(request, url) {
  try {
    // API 요청은 네트워크 우선
    if (url.pathname.startsWith('/api/')) {
      return await networkFirst(request);
    }
    
    // 이미지 요청은 캐시 우선
    if (isImageRequest(request)) {
      return await cacheFirst(request, IMAGE_CACHE);
    }
    
    // 음악 파일은 캐시 우선
    if (isMusicRequest(request)) {
      return await cacheFirst(request, MUSIC_CACHE);
    }
    
    // 정적 리소스는 캐시 우선
    if (isStaticAsset(url)) {
      return await cacheFirst(request, STATIC_CACHE);
    }
    
    // 기타 요청은 네트워크 우선
    return await networkFirst(request);
    
  } catch (error) {
    console.error('[SW] Fetch 처리 오류:', error);
    
    // 오프라인 시 폴백 페이지 제공
    if (url.pathname === '/' || url.pathname.includes('.html')) {
      const cache = await caches.open(STATIC_CACHE);
      return await cache.match('/') || new Response('오프라인입니다', { status: 503 });
    }
    
    throw error;
  }
}

// 네트워크 우선 전략
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    // 성공적인 응답만 캐시
    if (response && response.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // 네트워크 실패 시 캐시에서 찾기
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// 캐시 우선 전략
async function cacheFirst(request, cacheName = DYNAMIC_CACHE) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // 백그라운드에서 업데이트
    fetch(request).then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
    });
    
    return cachedResponse;
  }
  
  // 캐시에 없으면 네트워크에서 가져와서 캐시
  const response = await fetch(request);
  
  if (response && response.status === 200) {
    cache.put(request, response.clone());
  }
  
  return response;
}

// 이미지 요청 확인
function isImageRequest(request) {
  return request.destination === 'image' || 
         request.url.includes('/images/') ||
         request.url.includes('.jpg') ||
         request.url.includes('.jpeg') ||
         request.url.includes('.png') ||
         request.url.includes('.webp') ||
         request.url.includes('.svg');
}

// 음악 파일 요청 확인
function isMusicRequest(request) {
  return request.url.includes('/api/music/stream/') ||
         request.url.includes('.mp3') ||
         request.url.includes('.wav') ||
         request.url.includes('.m4a');
}

// 정적 자산 확인
function isStaticAsset(url) {
  return url.pathname.includes('/static/') ||
         url.pathname.includes('.css') ||
         url.pathname.includes('.js') ||
         url.pathname === '/manifest.json' ||
         url.pathname === '/logo.svg';
}

// 메시지 이벤트 처리 (클라이언트와의 통신)
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
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

console.log('[SW] Service Worker 로드됨');