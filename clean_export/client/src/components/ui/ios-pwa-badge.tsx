/**
 * iOS PWA 사용자를 위한 안내 배지 컴포넌트
 * 이미지 다운로드 관련 안내를 제공합니다.
 */

import React from 'react';
import { Smartphone, Share } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { detectPlatform } from '@/utils/platform-detection';

interface IOSPWABadgeProps {
  show?: boolean;
  className?: string;
}

export function IOSPWABadge({ show = true, className }: IOSPWABadgeProps) {
  const [shouldShow, setShouldShow] = React.useState(false);

  React.useEffect(() => {
    if (!show) return;
    
    const platform = detectPlatform();
    setShouldShow(platform.isIOSPWA);
  }, [show]);

  if (!shouldShow) return null;

  return (
    <Alert className={`bg-blue-50 border-blue-200 ${className}`}>
      <Smartphone className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-sm text-blue-800">
        <div className="flex items-center gap-2">
          <Share className="h-4 w-4" />
          <span>
            <strong>iOS 앱 모드:</strong> 이미지 저장 시 "사진에 저장"을 선택하세요
          </span>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export default IOSPWABadge;