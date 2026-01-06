import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, Download, Trash2 } from "lucide-react";
import { DownloadModal } from "@/components/DownloadModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ImageItem {
  id: number;
  title?: string;
  url: string;
  transformedUrl?: string;
  thumbnailUrl?: string;
  type?: string;
}

type ImageFilterType = "all" | "mansak_img" | "family_img" | "baby_face_img" | "snapshot" | "sticker_img" | "collage" | "extracted";

interface GalleryEmbedSimpleProps {
  filter?: ImageFilterType;
  maxItems?: number;
  columns?: number;
  showFilters?: boolean;
}

export default function GalleryEmbedSimple({
  filter = "all",
  maxItems = 12,
  columns = 3,
  showFilters = true
}: GalleryEmbedSimpleProps) {
  const [activeFilter, setActiveFilter] = useState<ImageFilterType>(filter);
  const [viewImage, setViewImage] = useState<ImageItem | null>(null);
  const [downloadModal, setDownloadModal] = useState<{
    isOpen: boolean;
    image: ImageItem | null;
  }>({ isOpen: false, image: null });
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 갤러리 데이터 가져오기
  const fetchGalleryData = async (): Promise<ImageItem[]> => {
    const filterParam = activeFilter !== "all" ? `?filter=${activeFilter}` : "";
    const url = `/api/gallery${filterParam}`;
    
    console.log('갤러리 데이터 로드:', activeFilter);
    
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`갤러리 로드 실패: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('갤러리 데이터:', data.length + '개');
    
    return Array.isArray(data) ? data : [];
  };

  const { data: images = [], isLoading, error } = useQuery({
    queryKey: ["/api/gallery", activeFilter],
    queryFn: fetchGalleryData,
    enabled: true,
    retry: 1
  });

  // 필터 변경 시 페이지를 1로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  // 이미지 생성 완료 이벤트 리스너
  useEffect(() => {
    const handleImageCreated = (event: CustomEvent) => {
      console.log('🔄 이미지 생성 완료 이벤트 감지, 갤러리 즉시 새로고침');
      
      // 즉시 갤러리 새로고침
      queryClient.invalidateQueries({ queryKey: ["/api/gallery"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gallery", activeFilter] });
      
      // 캐시 제거 후 재조회
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["/api/gallery", activeFilter] });
      }, 100);
    };

    // 갤러리에서 이미지 보기 이벤트 리스너 (이미지 생성 완료 시 사용)
    const handleOpenImageInGallery = (event: CustomEvent) => {
      console.log('🖼️ 갤러리에서 이미지 열기 이벤트 감지:', event.detail.image);
      
      // 갤러리의 setViewImage와 동일하게 모달 열기
      setViewImage(event.detail.image);
    };

    // 커스텀 이벤트 리스너 등록
    window.addEventListener('imageCreated', handleImageCreated as EventListener);
    window.addEventListener('openImageInGallery', handleOpenImageInGallery as EventListener);
    
    return () => {
      window.removeEventListener('imageCreated', handleImageCreated as EventListener);
      window.removeEventListener('openImageInGallery', handleOpenImageInGallery as EventListener);
    };
  }, [queryClient, activeFilter]);

  // 모바일 뒤로가기 버튼 처리 (이미지 뷰어용)
  useEffect(() => {
    if (!viewImage) return;

    // 이미지 뷰어가 열릴 때 히스토리 추가
    const modalState = { modal: 'gallery-viewer', imageId: viewImage.id };
    window.history.pushState(modalState, '', window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      // 현재 상태가 모달이 열린 상태가 아니면 뷰어 닫기
      const currentState = e.state;
      if (!currentState || currentState.modal !== 'gallery-viewer') {
        setViewImage(null);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [viewImage]);

  const getFilterTitle = (filterType: ImageFilterType) => {
    switch (filterType) {
      case "mansak_img": return "만삭사진";
      case "family_img": return "가족사진";
      case "baby_face_img": return "아기얼굴";
      case "snapshot": return "스냅사진";
      case "sticker_img": return "스티커";
      case "collage": return "콜라주";
      case "extracted": return "편집이미지";
      default: return "전체";
    }
  };

  const handleDownload = async (image: ImageItem) => {
    try {
      // 서버 프록시를 통해 이미지 다운로드 (CORS 문제 해결)
      const downloadUrl = `/api/download-image/${image.id}`;
      const filename = `${(image.title || 'image').replace(/\.(jpg|jpeg|png|webp)$/i, '')}.webp`;
      const title = image.title || 'image';
      
      // iOS PWA 환경 감지 및 향상된 다운로드 적용
      const { detectPlatform } = await import('@/utils/platform-detection');
      const platform = detectPlatform();
      
      if (platform.isIOSPWA) {
        const { downloadImageSafely, getDownloadToastMessage } = await import('@/utils/ios-pwa-download');
        
        // iOS PWA용 다운로드 실행
        const result = await downloadImageSafely(
          image.transformedUrl || image.url,
          downloadUrl,
          title,
          filename
        );
        
        // 모달 표시가 필요한 경우
        if (result.needsModal) {
          console.log('📱 iOS PWA 백업 모달 표시');
          setDownloadModal({ isOpen: true, image });
          return;
        }
        
        // 결과에 따른 토스트 메시지 표시
        const toastMessage = getDownloadToastMessage(result);
        toast(toastMessage);
        return;
      }
      
      // 기존 방식 (일반 브라우저)
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "다운로드 시작",
        description: "이미지 다운로드가 시작되었습니다."
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "다운로드 실패",
        description: "이미지 다운로드 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (image: ImageItem, closeViewer: boolean = false) => {
    // 삭제 전에 뷰어 먼저 닫기 (이벤트 버블링 방지)
    if (closeViewer) {
      setViewImage(null);
    }
    
    try {
      const response = await fetch(`/api/gallery/${image.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('삭제 요청에 실패했습니다');
      }

      // 캐시 무효화하여 갤러리 새로고침
      queryClient.invalidateQueries({ queryKey: ["/api/gallery"] });
      
      // 삭제 후 뷰어가 열려있으면 닫기
      setViewImage(null);
      
      toast({
        title: "삭제 완료",
        description: "이미지가 성공적으로 삭제되었습니다."
      });
    } catch (error) {
      toast({
        title: "삭제 실패",
        description: "이미지 삭제 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-lg">이미지를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500">이미지 로드 중 오류가 발생했습니다</div>
      </div>
    );
  }

  // 페이지네이션 계산
  const itemsPerPage = maxItems;
  const totalPages = Math.ceil((images?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentImages = images?.slice(startIndex, endIndex) || [];

  // 페이지 번호 배열 생성 (최대 5개씩 표시)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      // 전체 페이지가 5개 이하면 모두 표시
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 페이지가 많을 때는 현재 페이지 기준으로 표시
      if (currentPage <= 3) {
        // 시작 부분
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // 끝 부분
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        // 중간 부분
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const renderEmptyState = () => (
    <div className="text-center py-8">
      <div className="text-4xl mb-4">🖼️</div>
      <p className="text-gray-400">
        {activeFilter === "mansak_img" && "만삭사진을 만들어보세요!"}
        {activeFilter === "family_img" && "사진스타일을 멋지게 변환해 보세요!"}
        {activeFilter === "baby_face_img" && "아기얼굴을 생성해보세요!"}
        {activeFilter === "snapshot" && "스냅사진을 생성해보세요!"}
        {activeFilter === "sticker_img" && "스티커를 만들어보세요!"}
        {activeFilter === "collage" && "콜라주를 만들어보세요!"}
        {activeFilter === "extracted" && "포토북에서 이미지를 편집해보세요!"}
        {activeFilter === "all" && "아직 이미지가 없어요"}
      </p>
    </div>
  );

  return (
    <>
      {showFilters && (
        <div className="flex flex-wrap gap-2 mb-6">
          {(["all", "mansak_img", "family_img", "baby_face_img", "snapshot", "sticker_img", "collage", "extracted"] as ImageFilterType[]).map((filterType) => (
            <Button
              key={filterType}
              variant={activeFilter === filterType ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter(filterType)}
              className={`transition-all duration-200 ${
                activeFilter === filterType 
                  ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white'
              }`}
            >
              {getFilterTitle(filterType)}
            </Button>
          ))}
        </div>
      )}

      {!images || images.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {currentImages.map((image) => (
            <Card
              key={image.id}
              className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-transform hover:scale-105"
              onClick={() => setViewImage(image)}
            >
            <div className="relative w-full h-full bg-gray-600 flex items-center justify-center">
              <img
                src={image.thumbnailUrl || image.transformedUrl || image.url}
                alt={image.title || '갤러리 이미지'}
                className="w-full h-full object-cover"
                loading="lazy"
                onLoad={(e) => {
                  // 이미지 로드 성공 시 배경 숨기기
                  const target = e.target as HTMLImageElement;
                  const parent = target.parentElement;
                  parent?.classList.remove('bg-gray-600');
                  const placeholder = parent?.querySelector('.error-placeholder');
                  if (placeholder) placeholder.remove();
                }}
                onError={(e) => {
                  console.error('이미지 로드 실패:', image.id, image.title);
                  console.error('시도한 URL:', image.thumbnailUrl || image.transformedUrl || image.url);
                  // 썸네일 실패 시 원본 이미지 시도
                  const target = e.target as HTMLImageElement;
                  const fallbackUrl = image.transformedUrl || image.url;
                  if (target.src.includes('thumbnail') && fallbackUrl) {
                    console.log('썸네일 실패, 원본 이미지로 전환:', fallbackUrl);
                    target.src = fallbackUrl;
                  } else {
                    // 이미지 숨기고 placeholder 표시
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector('.error-placeholder')) {
                      const placeholder = document.createElement('div');
                      placeholder.className = 'error-placeholder absolute inset-0 flex items-center justify-center text-white text-sm';
                      placeholder.textContent = '이미지 로드 실패';
                      parent.appendChild(placeholder);
                    }
                  }
                }}
              />
            </div>
            
            {/* 제목 표시 숨김 - 이미지만 표시 */}
            
            {/* 모바일용 항상 표시되는 버튼들 */}
            <div className="absolute top-2 right-2 flex gap-1">
              {/* 다운로드 버튼 */}
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(image);
                }}
                size="sm"
                variant="secondary"
                className="h-8 w-8 p-0 bg-black/70 hover:bg-black/90 border-0"
              >
                <Download className="w-4 h-4 text-white" />
              </Button>

              {/* 삭제 버튼 */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => e.stopPropagation()}
                    className="h-8 w-8 p-0 bg-red-600/80 hover:bg-red-600 border-0"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>이미지 삭제</AlertDialogTitle>
                    <AlertDialogDescription>
                      이 이미지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(image, true);
                      }}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      삭제
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            </Card>
          ))}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            {/* 이전 버튼 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 disabled:opacity-50"
            >
              이전
            </Button>

            {/* 페이지 번호들 */}
            {getPageNumbers().map((page, index) => (
              typeof page === 'number' ? (
                <Button
                  key={index}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className={`w-10 ${
                    currentPage === page 
                      ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {page}
                </Button>
              ) : (
                <span key={index} className="px-2 text-gray-400">
                  {page}
                </span>
              )
            ))}

            {/* 다음 버튼 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 disabled:opacity-50"
            >
              다음
            </Button>
          </div>
        )}
        </>
      )}

      {/* 이미지 뷰어 다이얼로그 */}
      <Dialog open={!!viewImage} onOpenChange={(open) => !open && setViewImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewImage?.title || '이미지 보기'}</DialogTitle>
          </DialogHeader>
          {viewImage && (
            <>
              <div className="flex justify-center">
                <img
                  src={viewImage.transformedUrl || viewImage.url}
                  alt={viewImage.title || '이미지'}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              </div>
              
              {/* 뷰어 하단 버튼들 */}
              <div className="flex justify-center gap-3 mt-4 pb-2">
                <Button
                  onClick={() => handleDownload(viewImage)}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  다운로드
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      삭제
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>이미지 삭제</AlertDialogTitle>
                      <AlertDialogDescription>
                        이 이미지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(viewImage, true)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        삭제
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* iOS PWA 다운로드 백업 모달 */}
      <DownloadModal
        isOpen={downloadModal.isOpen}
        onClose={() => setDownloadModal({ isOpen: false, image: null })}
        imageUrl={downloadModal.image?.transformedUrl || downloadModal.image?.url || ''}
        title={downloadModal.image?.title || 'image'}
        onBackToGallery={() => {
          setDownloadModal({ isOpen: false, image: null });
          // 갤러리 메인으로 돌아가는 로직 (필요시)
        }}
      />
    </>
  );
}