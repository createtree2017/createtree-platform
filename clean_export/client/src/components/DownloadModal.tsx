import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
  onBackToGallery?: () => void;
}

export function DownloadModal({ 
  isOpen, 
  onClose, 
  imageUrl, 
  title, 
  onBackToGallery 
}: DownloadModalProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showAutoCloseOption, setShowAutoCloseOption] = useState(false);

  // 모달이 열릴 때 히스토리 상태 추가
  useEffect(() => {
    if (isOpen) {
      // popstate 이벤트 처리 (뒤로가기)
      const handlePopState = (event: PopStateEvent) => {
        event.preventDefault();
        onClose();
      };

      // 히스토리에 상태 추가
      if (window.history.state?.downloadModal !== true) {
        window.history.pushState({ downloadModal: true }, '', window.location.href);
      }

      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isOpen, onClose]);

  // 자동 닫기 카운트다운
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      handleClose();
    }
  }, [countdown]);

  const handleClose = () => {
    setCountdown(null);
    setShowAutoCloseOption(false);
    onClose();
    
    // 히스토리 정리
    if (window.history.state?.downloadModal === true) {
      window.history.back();
    }
  };

  const handleBackToGallery = () => {
    handleClose();
    if (onBackToGallery) {
      onBackToGallery();
    }
  };

  const startAutoClose = () => {
    setCountdown(5);
    setShowAutoCloseOption(false);
  };

  const stopAutoClose = () => {
    setCountdown(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 bg-black/95 border-gray-800">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">이미지 저장</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClose}
            className="text-gray-400 hover:text-white p-1"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 이미지 미리보기 */}
        <div className="p-4">
          <div className="relative bg-gray-900 rounded-lg overflow-hidden mb-4">
            <img 
              src={imageUrl} 
              alt={title}
              className="w-full h-auto max-h-96 object-contain"
              draggable={false}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/70 rounded-lg px-3 py-2 text-white text-sm opacity-0 hover:opacity-100 transition-opacity">
                길게 누르세요
              </div>
            </div>
          </div>

          {/* 안내 메시지 */}
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-3">
              <Download className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-100">
                <p className="font-medium mb-1">iOS에서 이미지 저장하기:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-200">
                  <li>위 이미지를 <strong>길게 눌러주세요</strong></li>
                  <li>나타나는 메뉴에서 <strong>"사진에 저장"</strong>을 선택하세요</li>
                  <li>이미지가 아이폰 갤러리에 저장됩니다</li>
                </ol>
              </div>
            </div>
          </div>

          {/* 카운트다운 표시 */}
          {countdown !== null && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between text-yellow-100">
                <span className="text-sm">
                  {countdown}초 후 자동으로 닫힙니다
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={stopAutoClose}
                  className="text-yellow-200 hover:text-yellow-100 h-6 px-2 text-xs"
                >
                  취소
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼들 */}
        <div className="p-4 border-t border-gray-800 space-y-3">
          <div className="flex space-x-3">
            <Button 
              onClick={handleBackToGallery}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              갤러리로 돌아가기
            </Button>
            <Button 
              onClick={handleClose}
              variant="outline"
              className="flex-1 border-gray-600 text-gray-300 hover:text-white"
            >
              완료
            </Button>
          </div>

          {/* 자동 닫기 옵션 */}
          {!countdown && (
            <div className="flex justify-center">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={startAutoClose}
                className="text-gray-400 hover:text-gray-300 text-xs"
              >
                5초 후 자동으로 닫기
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}