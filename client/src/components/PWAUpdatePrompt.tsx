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

    return () => {
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
    };
  }, []);

  const handleUpdate = () => {
    window.location.reload();
  };

  if (!showUpdatePrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-slide-up">
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            업데이트 사용 가능
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-4">
            새로운 버전이 준비되었습니다. 지금 업데이트하시겠습니까?
          </CardDescription>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleUpdate}
            >
              업데이트
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