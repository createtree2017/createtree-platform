import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializePWA } from "./utils/pwa";

// 🛡️ 동적 import 실패 시 자동 새로고침 (배포 후 이전 JS 청크 파일이 없어진 경우)
// 무한 새로고침 방지를 위해 sessionStorage로 1회만 시도
window.addEventListener('error', (event) => {
  const isChunkError = event.message?.includes('Failed to fetch dynamically imported module') ||
    event.message?.includes('Loading chunk') ||
    event.message?.includes('Loading CSS chunk') ||
    event.message?.includes('Failed to load module script');

  if (isChunkError) {
    const lastReload = sessionStorage.getItem('chunk-reload');
    const now = Date.now();

    // 30초 이내 재시도 방지 (무한 루프 차단)
    if (!lastReload || (now - parseInt(lastReload)) > 30000) {
      sessionStorage.setItem('chunk-reload', now.toString());
      console.warn('[ChunkReload] 청크 로딩 실패 → 페이지 새로고침');
      window.location.reload();
    }
  }
});

// unhandledrejection으로도 동적 import 실패 잡기 (Promise 기반)
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message || event.reason?.toString() || '';
  const isChunkError = reason.includes('Failed to fetch dynamically imported module') ||
    reason.includes('Loading chunk') ||
    reason.includes('Failed to load module script');

  if (isChunkError) {
    const lastReload = sessionStorage.getItem('chunk-reload');
    const now = Date.now();

    if (!lastReload || (now - parseInt(lastReload)) > 30000) {
      sessionStorage.setItem('chunk-reload', now.toString());
      console.warn('[ChunkReload] 청크 로딩 실패(Promise) → 페이지 새로고침');
      window.location.reload();
    }
  }
});

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA 초기화 - DOM 로드 후 실행
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Main] DOM 로드 완료, PWA 초기화 시작');

  initializePWA().then((success) => {
    if (success) {
      console.log('[Main] PWA 초기화 성공');

      // beforeinstallprompt 이벤트 강제 체크
      setTimeout(() => {
        console.log('[Main] PWA 설치 조건 체크 완료');
      }, 2000);
    } else {
      console.log('[Main] PWA 초기화 실패 또는 지원하지 않음');
    }
  }).catch((error) => {
    console.error('[Main] PWA 초기화 오류:', error);
  });
});
