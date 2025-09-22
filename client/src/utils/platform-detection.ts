/**
 * 플랫폼 및 PWA 환경 감지 유틸리티
 * iOS PWA 다운로드 문제 해결을 위한 환경 감지
 */

export interface PlatformInfo {
  isIOS: boolean;
  isPWA: boolean;
  isIOSPWA: boolean;
  isMobile: boolean;
  userAgent: string;
}

/**
 * 현재 플랫폼 정보를 감지합니다
 */
export function detectPlatform(): PlatformInfo {
  const userAgent = navigator.userAgent;
  
  // iOS 감지 (iPhone, iPad, iPod)
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
  
  // PWA 감지 (홈화면에서 실행 중인지)
  const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true ||
                document.referrer.includes('android-app://');
  
  // iOS PWA 조합
  const isIOSPWA = isIOS && isPWA;
  
  // 모바일 감지
  const isMobile = /Mobi|Android/i.test(userAgent) || isIOS;
  
  return {
    isIOS,
    isPWA,
    isIOSPWA,
    isMobile,
    userAgent
  };
}

/**
 * Web Share API 지원 여부를 확인합니다
 */
export function isWebShareSupported(): boolean {
  return 'share' in navigator;
}

/**
 * 파일 공유를 위한 Web Share API 지원 여부 확인
 */
export function isWebShareFilesSupported(): boolean {
  return 'share' in navigator && 'canShare' in navigator;
}

/**
 * 현재 환경에서 권장되는 다운로드 방식을 반환합니다
 */
export function getRecommendedDownloadMethod(): 'standard' | 'webshare' | 'instruction' {
  const platform = detectPlatform();
  
  if (platform.isIOSPWA) {
    // iOS PWA: Web Share API 우선, 없으면 안내 메시지
    return isWebShareSupported() ? 'webshare' : 'instruction';
  }
  
  // 일반 브라우저: 기존 방식
  return 'standard';
}

/**
 * 디버깅을 위한 플랫폼 정보 로깅
 */
export function logPlatformInfo(): void {
  const platform = detectPlatform();
  const webShareSupported = isWebShareSupported();
  const webShareFilesSupported = isWebShareFilesSupported();
  
  console.log('🔍 Platform Detection Results:', {
    ...platform,
    webShareSupported,
    webShareFilesSupported,
    recommendedMethod: getRecommendedDownloadMethod()
  });
}