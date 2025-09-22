import { useState, useEffect } from 'react';
import { X, Download, Share2, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { isPWAInstalled, isAndroid, isIOS, isIOSSafari, canInstallPWA } from '@/utils/platform';
import { pwaManager } from '@/utils/pwa';

export const PWAInstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // 이미 PWA로 실행 중이면 아무것도 표시하지 않음
    if (isPWAInstalled()) {
      setShowPrompt(false);
      return;
    }

    // 이전에 닫았는지 확인
    const dismissedTime = localStorage.getItem('pwa-install-dismissed');
    if (dismissedTime) {
      const dismissedDate = new Date(parseInt(dismissedTime));
      const now = new Date();
      const hoursSinceDismissed = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60);
      
      // 24시간 이내에 닫았으면 표시하지 않음
      if (hoursSinceDismissed < 24) {
        setDismissed(true);
        return;
      }
    }

    // 플랫폼별 설치 가능 여부 확인
    if (canInstallPWA()) {
      setCanInstall(pwaManager.canInstall);
      setShowPrompt(true);
    } else if (isIOSSafari()) {
      // iOS Safari는 수동 설치만 가능
      setCanInstall(false);
      setShowPrompt(true);
    }
  }, []);

  // beforeinstallprompt 이벤트 리스너
  useEffect(() => {
    const handleInstallPrompt = () => {
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (!canInstall || isInstalling) return;

    setIsInstalling(true);
    try {
      const result = await pwaManager.promptInstall();
      if (result) {
        // 설치 성공
        setShowPrompt(false);
        localStorage.setItem('pwa-installed', 'true');
      }
    } catch (error) {
      console.error('PWA 설치 오류:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (!showPrompt || dismissed || isPWAInstalled()) {
    return null;
  }

  // 안드로이드용 설치 프롬프트
  if (isAndroid() && canInstall) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up">
        <Card className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">앱으로 더 편리하게!</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-white/90 mb-4">
              홈 화면에 추가하면 오프라인에서도 사용할 수 있어요
            </CardDescription>
            <Button
              className="w-full bg-white text-purple-600 hover:bg-white/90"
              onClick={handleInstall}
              disabled={isInstalling}
            >
              <Download className="mr-2 h-4 w-4" />
              {isInstalling ? '설치 중...' : '지금 설치하기'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // iOS용 수동 설치 가이드
  if (isIOS()) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">앱처럼 사용하기</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertDescription>
                Safari에서 다음 단계를 따라주세요:
              </AlertDescription>
            </Alert>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-full">
                  <Share2 className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm">하단의 공유 버튼을 탭하세요</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-full">
                  <Home className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm">"홈 화면에 추가"를 선택하세요</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-full">
                  <Download className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm">"추가"를 탭하세요</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 데스크톱용 설치 프롬프트
  if (canInstall) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
        <Card className="shadow-lg max-w-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">앱 설치</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              더 빠르고 편리한 앱으로 사용해보세요
            </CardDescription>
            <Button
              className="w-full"
              onClick={handleInstall}
              disabled={isInstalling}
            >
              <Download className="mr-2 h-4 w-4" />
              {isInstalling ? '설치 중...' : '설치하기'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};