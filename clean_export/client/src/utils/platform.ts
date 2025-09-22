/**
 * 플랫폼 및 브라우저 감지 유틸리티
 * PWA 설치 상태와 플랫폼별 특성 감지
 */

// 플랫폼 타입 정의
export type Platform = 'android' | 'ios' | 'desktop' | 'unknown';
export type Browser = 'chrome' | 'safari' | 'firefox' | 'edge' | 'unknown';

class PlatformDetector {
  private userAgent: string;
  private platform: string;
  
  constructor() {
    this.userAgent = navigator.userAgent.toLowerCase();
    this.platform = navigator.platform.toLowerCase();
  }

  // 안드로이드 감지 (다중 검증)
  isAndroid(): boolean {
    return /android/i.test(this.userAgent) ||
           /android/i.test(this.platform) ||
           (navigator as any).userAgentData?.platform === 'Android';
  }

  // iOS 감지 (다중 검증)
  isIOS(): boolean {
    return /iphone|ipad|ipod/i.test(this.userAgent) ||
           /iphone|ipad|ipod/i.test(this.platform) ||
           (navigator as any).userAgentData?.platform === 'iOS' ||
           (navigator.maxTouchPoints > 1 && /macintosh/i.test(this.userAgent));
  }

  // 데스크톱 감지
  isDesktop(): boolean {
    return !this.isAndroid() && !this.isIOS();
  }

  // 브라우저 감지
  getBrowser(): Browser {
    if (/chrome|chromium|crios/i.test(this.userAgent) && !/edge/i.test(this.userAgent)) {
      return 'chrome';
    } else if (/safari/i.test(this.userAgent) && !/chrome|chromium|crios/i.test(this.userAgent)) {
      return 'safari';
    } else if (/firefox|fxios/i.test(this.userAgent)) {
      return 'firefox';
    } else if (/edge|edg/i.test(this.userAgent)) {
      return 'edge';
    }
    return 'unknown';
  }

  // 플랫폼 가져오기
  getPlatform(): Platform {
    if (this.isAndroid()) return 'android';
    if (this.isIOS()) return 'ios';
    if (this.isDesktop()) return 'desktop';
    return 'unknown';
  }

  // PWA 설치 가능 여부 (브라우저별)
  canInstallPWA(): boolean {
    const browser = this.getBrowser();
    const platform = this.getPlatform();

    // Chrome, Edge on Android/Desktop
    if ((browser === 'chrome' || browser === 'edge') && 
        (platform === 'android' || platform === 'desktop')) {
      return true;
    }

    // Safari on iOS (수동 설치만 가능)
    if (browser === 'safari' && platform === 'ios') {
      return false; // beforeinstallprompt 미지원
    }

    return false;
  }

  // iOS Safari 감지 (특별 처리 필요)
  isIOSSafari(): boolean {
    return this.isIOS() && this.getBrowser() === 'safari';
  }

  // 안드로이드 Chrome/Edge 감지
  isAndroidChrome(): boolean {
    return this.isAndroid() && (this.getBrowser() === 'chrome' || this.getBrowser() === 'edge');
  }
}

// 싱글톤 인스턴스
export const platformDetector = new PlatformDetector();

// 편의 함수들
export const isAndroid = () => platformDetector.isAndroid();
export const isIOS = () => platformDetector.isIOS();
export const isDesktop = () => platformDetector.isDesktop();
export const getPlatform = () => platformDetector.getPlatform();
export const getBrowser = () => platformDetector.getBrowser();
export const canInstallPWA = () => platformDetector.canInstallPWA();
export const isIOSSafari = () => platformDetector.isIOSSafari();
export const isAndroidChrome = () => platformDetector.isAndroidChrome();

// PWA 설치 상태 캐싱 (성능 최적화)
let cachedPWAStatus: boolean | null = null;
let lastCheckTime = 0;
const CACHE_DURATION = 5000; // 5초

export const isPWAInstalled = (): boolean => {
  const now = Date.now();
  
  // 캐시 유효성 검사
  if (cachedPWAStatus !== null && now - lastCheckTime < CACHE_DURATION) {
    return cachedPWAStatus;
  }

  // 새로 감지
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as any).standalone === true ||
                      document.referrer.includes('android-app://');

  // 캐시 업데이트
  cachedPWAStatus = isStandalone;
  lastCheckTime = now;

  return isStandalone;
};

// 디버깅용 정보
export const getPlatformInfo = () => ({
  platform: getPlatform(),
  browser: getBrowser(),
  isPWA: isPWAInstalled(),
  canInstall: canInstallPWA(),
  userAgent: navigator.userAgent,
  isOnline: navigator.onLine
});