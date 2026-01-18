import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getImageDetail } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Share, Heart, AlertCircle } from "lucide-react";

interface ImageDetailModalProps {
  imageId: number | null;
  onClose: () => void;
}

interface ImageDetail {
  id: number;
  title: string;
  description?: string;
  originalUrl: string;
  transformedUrl: string;
  thumbnailUrl?: string;
  style: string;
  createdAt: string;
  originalVerified?: boolean;
  metadata: {
    userId?: string | number;
    username?: string;
    isShared?: boolean;
    [key: string]: any;
  };
}

export default function ImageDetailModal({ imageId, onClose }: ImageDetailModalProps) {
  const [imageDetail, setImageDetail] = useState<ImageDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // 모바일 뒤로가기 버튼 처리
  useEffect(() => {
    if (!imageId) return;

    // 팝업이 열릴 때 히스토리 추가 (한 번만)
    const modalState = { modal: 'image-detail', id: imageId };
    window.history.pushState(modalState, '', window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      // 현재 상태가 모달이 열린 상태가 아니면 팝업 닫기
      const currentState = e.state;
      if (!currentState || currentState.modal !== 'image-detail') {
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [imageId, onClose]);

  useEffect(() => {
    if (!imageId) return;

    const loadImageDetail = async () => {
      console.log(`이미지 상세 정보 로드 시작: ID ${imageId}`);
      setIsLoading(true);
      setError(null);
      
      try {
        console.log(`API 호출: getImageDetail(${imageId})`);
        const data = await getImageDetail(imageId);
        console.log("이미지 상세 정보 로드 성공:", data);
        setImageDetail(data);
      } catch (err) {
        console.error("이미지 상세 정보 로드 오류:", err);
        setError("이미지를 불러오는 중 오류가 발생했습니다.");
        toast({
          title: "이미지 로드 오류",
          description: "이미지 상세 정보를 불러오는 중 문제가 발생했습니다.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadImageDetail();
  }, [imageId, toast]);

  const handleDownload = () => {
    if (!imageDetail) return;
    
    // 이미지 다운로드 로직
    const link = document.createElement("a");
    link.href = imageDetail.transformedUrl;
    link.download = `${imageDetail.title}-${imageDetail.id}.webp`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "이미지 다운로드",
      description: "이미지 다운로드가 시작되었습니다.",
    });
  };

  return (
    <Dialog open={!!imageId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isLoading ? "이미지 로딩 중..." : error ? "오류 발생" : imageDetail ? imageDetail.title : "이미지 상세보기"}
          </DialogTitle>
          {imageDetail && (
            <DialogDescription>
              스타일: {imageDetail.style} • 생성일: {new Date(imageDetail.createdAt).toLocaleDateString()}
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">이미지를 불러오는 중...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-destructive">
            <p>{error}</p>
          </div>
        ) : imageDetail ? (
          <>
            {imageDetail.originalVerified === false && (
              <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-3 mb-4 rounded">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">⚠️ 원본 파일 없음</p>
                    <p className="text-sm">이 이미지의 원본 파일이 없어 다운로드할 수 없습니다.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="relative mt-4 rounded-lg overflow-hidden">
              <img
                src={imageDetail.transformedUrl}
                alt={imageDetail.title}
                className="w-full object-contain max-h-[400px]"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const currentSrc = target.src;
                  
                  // 1차 fallback: thumbnailUrl 시도
                  if (imageDetail.thumbnailUrl && currentSrc !== imageDetail.thumbnailUrl) {
                    console.log('원본 이미지 로드 실패, 썸네일로 전환');
                    target.src = imageDetail.thumbnailUrl;
                  } else if (currentSrc !== imageDetail.originalUrl) {
                    // 2차 fallback: originalUrl 시도
                    console.log('썸네일도 실패, originalUrl로 전환');
                    target.src = imageDetail.originalUrl;
                  } else {
                    // 모든 URL 실패
                    console.error("모든 이미지 URL 로드 실패");
                    target.src = "https://placehold.co/600x400/e2e8f0/1e293b?text=이미지+로드+실패";
                  }
                }}
              />
            </div>

            {imageDetail.description && (
              <div className="mt-4">
                <h4 className="font-medium mb-1">설명</h4>
                <p className="text-sm text-neutral-dark">{imageDetail.description}</p>
              </div>
            )}

            <DialogFooter className="flex items-center justify-between mt-6 gap-2">
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={handleDownload}
                        disabled={imageDetail.originalVerified === false}
                      >
                        <Download className="w-4 h-4" /> 다운로드
                      </Button>
                    </TooltipTrigger>
                    {imageDetail.originalVerified === false && (
                      <TooltipContent>원본 파일이 없어 다운로드할 수 없습니다</TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
              <DialogClose asChild>
                <Button variant="secondary" size="sm">닫기</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <div className="text-center py-12">
            <p>이미지 정보가 없습니다.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}