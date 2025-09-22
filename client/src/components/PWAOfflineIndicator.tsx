import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export const PWAOfflineIndicator = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-14 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-2">
      <div className="flex items-center justify-center gap-2">
        <WifiOff size={16} />
        <span className="text-sm font-medium">오프라인 상태입니다</span>
      </div>
    </div>
  );
};