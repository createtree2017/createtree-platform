import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Share, Download, Monitor, Smartphone, Tablet } from "lucide-react";
import { getPlatform, getBrowser } from "@/utils/platform";

export default function PWAInstallGuide() {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('ios');
  
  useEffect(() => {
    const currentPlatform = getPlatform();
    if (currentPlatform === 'ios' || currentPlatform === 'android' || currentPlatform === 'desktop') {
      setPlatform(currentPlatform);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-indigo-100">
      {/* 헤더 */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-purple-600 hover:text-purple-700">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">앱 설치 가이드</h1>
        </div>
      </div>

      {/* 플랫폼 선택 탭 */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <div className="bg-white rounded-lg shadow-sm p-1 flex gap-1">
          <button
            onClick={() => setPlatform('ios')}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${
              platform === 'ios' 
                ? 'bg-purple-600 text-white' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Smartphone className="h-5 w-5" />
            iPhone/iPad
          </button>
          <button
            onClick={() => setPlatform('android')}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${
              platform === 'android' 
                ? 'bg-purple-600 text-white' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Smartphone className="h-5 w-5" />
            Android
          </button>
          <button
            onClick={() => setPlatform('desktop')}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${
              platform === 'desktop' 
                ? 'bg-purple-600 text-white' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Monitor className="h-5 w-5" />
            PC/노트북
          </button>
        </div>
      </div>

      {/* 설치 가이드 내용 */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {platform === 'ios' && <IOSInstallGuide />}
        {platform === 'android' && <AndroidInstallGuide />}
        {platform === 'desktop' && <DesktopInstallGuide />}
      </div>
    </div>
  );
}

// iOS 설치 가이드
function IOSInstallGuide() {
  const currentBrowser = getBrowser();
  const isSafari = currentBrowser === 'safari';

  if (!isSafari) {
    return (
      <div className="bg-yellow-50 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-bold text-yellow-900 mb-2">
          Safari 브라우저에서 접속해 주세요
        </h2>
        <p className="text-yellow-800 mb-4">
          iOS에서는 Safari 브라우저에서만 홈 화면에 추가할 수 있습니다.
        </p>
        <ol className="space-y-2 text-yellow-800">
          <li>1. Safari 브라우저를 실행하세요</li>
          <li>2. 주소창에 현재 사이트 주소를 입력하세요</li>
          <li>3. 아래 안내를 따라 설치를 진행하세요</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          iPhone/iPad에서 앱 설치하기
        </h2>
        
        {/* Step 1 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
              1
            </div>
            <h3 className="text-lg font-semibold">하단의 공유 버튼을 누르세요</h3>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 flex flex-col items-center">
            <div className="w-full max-w-xs bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex justify-center">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Share className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-center text-sm text-gray-600 mt-2">
                Safari 하단 중앙의 공유 아이콘
              </p>
            </div>
            <div className="mt-3 text-sm text-gray-500">
              화면 하단 가운데 있는 공유 버튼을 찾아 탭하세요
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
              2
            </div>
            <h3 className="text-lg font-semibold">"홈 화면에 추가"를 선택하세요</h3>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                    <Download className="h-5 w-5 text-gray-600" />
                  </div>
                  <span className="text-gray-900">홈 화면에 추가</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              메뉴에서 "홈 화면에 추가"를 찾아 선택하세요
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
              3
            </div>
            <h3 className="text-lg font-semibold">"추가" 버튼을 누르세요</h3>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-600">취소</span>
                <span className="font-semibold">홈 화면에 추가</span>
                <span className="text-blue-500 font-medium">추가</span>
              </div>
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-xl">AI</span>
                  </div>
                  <div className="flex-1">
                    <input 
                      type="text" 
                      value="우리병원문화센터" 
                      readOnly
                      className="bg-white rounded px-2 py-1 text-sm w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              우측 상단의 "추가" 버튼을 탭하면 설치가 완료됩니다
            </p>
          </div>
        </div>

        {/* 완료 메시지 */}
        <div className="bg-purple-50 rounded-lg p-6 text-center">
          <div className="w-16 h-16 bg-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <span className="text-white font-bold text-2xl">AI</span>
          </div>
          <h3 className="text-lg font-bold text-purple-900 mb-2">
            설치 완료!
          </h3>
          <p className="text-purple-700">
            홈 화면에서 앱 아이콘을 찾아 실행하세요
          </p>
        </div>
      </div>
    </div>
  );
}

// Android 설치 가이드
function AndroidInstallGuide() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Android에서 앱 설치하기
      </h2>
      <div className="bg-blue-50 rounded-lg p-6 mb-6">
        <p className="text-blue-900">
          Android에서는 설치 알림이 자동으로 표시됩니다.
          알림이 표시되지 않는 경우 아래 방법을 따라주세요.
        </p>
      </div>
      <ol className="space-y-4">
        <li className="flex gap-3">
          <span className="font-bold text-purple-600">1.</span>
          <span>Chrome 브라우저 우측 상단 메뉴(⋮)를 탭하세요</span>
        </li>
        <li className="flex gap-3">
          <span className="font-bold text-purple-600">2.</span>
          <span>"홈 화면에 추가" 또는 "앱 설치"를 선택하세요</span>
        </li>
        <li className="flex gap-3">
          <span className="font-bold text-purple-600">3.</span>
          <span>"설치" 버튼을 탭하면 완료됩니다</span>
        </li>
      </ol>
    </div>
  );
}

// Desktop 설치 가이드
function DesktopInstallGuide() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        PC/노트북에서 앱 설치하기
      </h2>
      <div className="bg-green-50 rounded-lg p-6 mb-6">
        <p className="text-green-900">
          Chrome, Edge 브라우저에서 설치 가능합니다.
        </p>
      </div>
      <ol className="space-y-4">
        <li className="flex gap-3">
          <span className="font-bold text-purple-600">1.</span>
          <span>주소창 우측 끝의 설치 아이콘(⊕)을 클릭하세요</span>
        </li>
        <li className="flex gap-3">
          <span className="font-bold text-purple-600">2.</span>
          <span>"설치" 버튼을 클릭하면 앱이 설치됩니다</span>
        </li>
        <li className="flex gap-3">
          <span className="font-bold text-purple-600">3.</span>
          <span>바탕화면이나 앱 목록에서 실행할 수 있습니다</span>
        </li>
      </ol>
    </div>
  );
}