/**
 * PWA Service Worker 등록 및 관리
 * Firebase 인증과 호환되도록 설계
 */

interface PWAInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAUtils {
  isSupported: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  canInstall: boolean;
  installPrompt: PWAInstallPromptEvent | null;
  registerServiceWorker: () => Promise<boolean>;
  promptInstall: () => Promise<boolean>;
  checkForUpdates: () => Promise<boolean>;
  clearCache: () => Promise<boolean>;
}

class PWAManager {
  private installPrompt: PWAInstallPromptEvent | null = null;
  private swRegistration: ServiceWorkerRegistration | null = null;

  constructor() {
    this.setupInstallPrompt();
  }

  // PWA 지원 여부 확인
  get isSupported(): boolean {
    return 'serviceWorker' in navigator;
  }

  // PWA 설치 여부 확인
  get isInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }

  // 독립 실행 모드 확인
  get isStandalone(): boolean {
    return this.isInstalled;
  }

  // 설치 가능 여부 확인
  get canInstall(): boolean {
    return this.installPrompt !== null && !this.isInstalled;
  }

  // 설치 프롬프트 설정
  private setupInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e as PWAInstallPromptEvent;
      console.log('[PWA] 설치 프롬프트 준비됨');
    });
  }

  // Service Worker 등록
  async registerServiceWorker(): Promise<boolean> {
    if (!this.isSupported) {
      console.log('[PWA] Service Worker가 지원되지 않습니다');
      return false;
    }

    try {
      console.log('[PWA] Service Worker 등록 시작...');
      
      // 기존 Service Worker 해제
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log('[PWA] 기존 Service Worker 해제됨');
      }

      this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });

      console.log('[PWA] Service Worker 등록 성공:', this.swRegistration.scope);
      
      // 등록 상태 확인
      if (this.swRegistration.installing) {
        console.log('[PWA] Service Worker 설치 중...');
      } else if (this.swRegistration.waiting) {
        console.log('[PWA] Service Worker 대기 중...');
      } else if (this.swRegistration.active) {
        console.log('[PWA] Service Worker 활성화됨');
      }

      // 업데이트 확인
      this.swRegistration.addEventListener('updatefound', () => {
        console.log('[PWA] 새 버전이 발견되었습니다');
        const newWorker = this.swRegistration!.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] 새 버전이 설치되었습니다. 새로고침이 필요합니다.');
              // 사용자에게 새로고침 알림 표시
              this.notifyUpdate();
            }
          });
        }
      });

      return true;
    } catch (error) {
      console.error('[PWA] Service Worker 등록 실패:', error);
      return false;
    }
  }

  // PWA 설치 프롬프트 표시
  async promptInstall(): Promise<boolean> {
    if (!this.canInstall) {
      console.log('[PWA] 설치할 수 없습니다');
      return false;
    }

    try {
      await this.installPrompt!.prompt();
      const choiceResult = await this.installPrompt!.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] 사용자가 설치를 승인했습니다');
        this.installPrompt = null;
        return true;
      } else {
        console.log('[PWA] 사용자가 설치를 거부했습니다');
        return false;
      }
    } catch (error) {
      console.error('[PWA] 설치 프롬프트 오류:', error);
      return false;
    }
  }

  // 업데이트 확인
  async checkForUpdates(): Promise<boolean> {
    if (!this.swRegistration) {
      return false;
    }

    try {
      await this.swRegistration.update();
      console.log('[PWA] 업데이트 확인 완료');
      return true;
    } catch (error) {
      console.error('[PWA] 업데이트 확인 실패:', error);
      return false;
    }
  }

  // 캐시 삭제
  async clearCache(): Promise<boolean> {
    if (!this.swRegistration || !this.swRegistration.active) {
      return false;
    }

    try {
      // Service Worker에게 캐시 삭제 요청
      const messageChannel = new MessageChannel();
      
      return new Promise((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data.success || false);
        };

        this.swRegistration!.active!.postMessage(
          { type: 'CLEAR_CACHE' },
          [messageChannel.port2]
        );

        // 5초 타임아웃
        setTimeout(() => resolve(false), 5000);
      });
    } catch (error) {
      console.error('[PWA] 캐시 삭제 실패:', error);
      return false;
    }
  }

  // 업데이트 알림
  private notifyUpdate(): void {
    // 커스텀 이벤트 발생으로 컴포넌트에서 처리 가능
    window.dispatchEvent(new CustomEvent('pwa-update-available'));
  }

  // 네트워크 상태 모니터링
  setupNetworkMonitoring(): void {
    window.addEventListener('online', () => {
      console.log('[PWA] 온라인 상태');
      window.dispatchEvent(new CustomEvent('pwa-online'));
    });

    window.addEventListener('offline', () => {
      console.log('[PWA] 오프라인 상태');
      window.dispatchEvent(new CustomEvent('pwa-offline'));
    });
  }

  // Replit 환경 감지
  isReplitEnvironment(): boolean {
    const hostname = window.location.hostname;
    return hostname.includes('replit.dev') || hostname.includes('replit.co');
  }

  // PWA 상태 정보 반환
  getStatus() {
    return {
      isSupported: this.isSupported,
      isInstalled: this.isInstalled,
      isStandalone: this.isStandalone,
      canInstall: this.canInstall,
      isReplitEnv: this.isReplitEnvironment(),
      isOnline: navigator.onLine,
      swRegistered: !!this.swRegistration
    };
  }
}

// 싱글톤 인스턴스 생성
export const pwaManager = new PWAManager();

// 편의 함수들
export const initializePWA = async (): Promise<boolean> => {
  console.log('[PWA] 초기화 시작');
  
  const success = await pwaManager.registerServiceWorker();
  if (success) {
    pwaManager.setupNetworkMonitoring();
    console.log('[PWA] 초기화 완료');
  }
  
  return success;
};

export const isPWASupported = (): boolean => pwaManager.isSupported;
export const isPWAInstalled = (): boolean => pwaManager.isInstalled;
export const canInstallPWA = (): boolean => pwaManager.canInstall;
export const promptPWAInstall = (): Promise<boolean> => pwaManager.promptInstall();
export const getPWAStatus = () => pwaManager.getStatus();