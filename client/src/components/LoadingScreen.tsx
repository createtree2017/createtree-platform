interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "로딩중..." }: LoadingScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="text-center">
        {/* 로고 */}
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto flex items-center justify-center">
            <img 
              src="/icons/icon-192x192.png" 
              alt="AI 우리병원 문화센터 로고" 
              className="w-20 h-20 rounded-full shadow-lg"
            />
          </div>
        </div>
        
        {/* 앱 이름 */}
        <h1 className="text-2xl font-bold text-gray-800 mb-4">AI 우리병원 문화센터</h1>
        
        {/* 로딩 스피너 */}
        <div className="flex items-center justify-center mb-4">
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
        </div>
        
        {/* 로딩 메시지 */}
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}