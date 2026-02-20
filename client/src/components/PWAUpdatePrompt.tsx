import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const PWAUpdatePrompt = () => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  useEffect(() => {
    const handleUpdateAvailable = () => {
      console.log('[PWA] 업데이트가 사용 가능합니다');
      setShowUpdatePrompt(true);
    };

    window.addEventListener('pwa-update-available', handleUpdateAvailable);

    // SW controller 변경 시 자동 새로고침
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] 새 Service Worker 활성화 — 페이지 새로고침');
        window.location.reload();
      });
    }

    return () => {
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
    };
  }, []);

  const handleUpdate = async () => {
    // SW에 SKIP_WAITING 메시지를 보내 새 SW를 즉시 활성화
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        // controllerchange 이벤트에서 자동 새로고침됨
        return;
      }
    }
    // fallback: SW가 없으면 직접 새로고침
    window.location.reload();
  };

  if (!showUpdatePrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-slide-up">
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            새 버전이 있습니다
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-4">
            최신 버전이 준비되었습니다. 업데이트하면 새로운 기능을 사용할 수 있습니다.
          </CardDescription>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleUpdate}
            >
              지금 업데이트
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => setShowUpdatePrompt(false)}
            >
              나중에
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};