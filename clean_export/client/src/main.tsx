import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializePWA } from "./utils/pwa";

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
