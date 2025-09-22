import React from 'react';
import { Loader2 } from 'lucide-react';

interface SplashScreenProps {
  isVisible: boolean;
}

export function SplashScreen({ isVisible }: SplashScreenProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center z-50">
      <div className="text-center text-white">
        {/* 로고 */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-purple-600">AI</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold">우리병원 문화센터</h1>
          <p className="text-purple-100 mt-2">AI 기반 문화 서비스</p>
        </div>

        {/* 로딩 애니메이션 */}
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-lg">앱을 준비하고 있습니다...</span>
        </div>

        {/* 진행 표시 */}
        <div className="mt-6 w-64 mx-auto">
          <div className="w-full bg-white/20 rounded-full h-2">
            <div className="bg-white h-2 rounded-full animate-pulse w-3/4"></div>
          </div>
        </div>
      </div>
    </div>
  );
}