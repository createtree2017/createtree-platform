import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, Download, Trash2 } from "lucide-react";
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

type ImageFilterType = "all" | "mansak_img" | "family_img" | "sticker_img";

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

    // 커스텀 이벤트 리스너 등록
    window.addEventListener('imageCreated', handleImageCreated as EventListener);
    
    return () => {
      window.removeEventListener('imageCreated', handleImageCreated as EventListener);
    };
  }, [queryClient, activeFilter]);

  const getFilterTitle = (filterType: ImageFilterType) => {
    switch (filterType) {
      case "mansak_img": return "만삭사진";
      case "family_img": return "가족사진";
      case "sticker_img": return "스티커";
      default: return "전체";
    }
  };

  const handleDownload = async (image: ImageItem) => {
    try {
      // 서버 프록시를 통해 이미지 다운로드 (CORS 문제 해결)
      const downloadUrl = `/api/download-image/${image.id}`;
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${(image.title || 'image').replace(/\.(jpg|jpeg|png|webp)$/i, '')}.webp`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "다운로드 시작",
        description: "이미지 다운로드가 시작되었습니다."
      });
    } catch (error) {
      toast({
        title: "다운로드 실패",
        description: "이미지 다운로드 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (image: ImageItem) => {
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

  const renderEmptyState = () => (
    <div className="text-center py-8">
      <div className="text-4xl mb-4">🖼️</div>
      <p className="text-gray-400">
        {activeFilter === "mansak_img" && "만삭사진을 만들어보세요!"}
        {activeFilter === "family_img" && "가족사진을 만들어보세요!"}
        {activeFilter === "sticker_img" && "스티커를 만들어보세요!"}
        {activeFilter === "all" && "아직 이미지가 없어요"}
      </p>
    </div>
  );

  return (
    <>
      {showFilters && (
        <div className="flex gap-2 mb-6">
          {(["all", "mansak_img", "family_img", "sticker_img"] as ImageFilterType[]).map((filterType) => (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.slice(0, maxItems).map((image) => (
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
            
            {/* 호버 시 버튼들 */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center pointer-events-none">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2 pointer-events-auto">


                {/* 다운로드 버튼 */}
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(image);
                  }}
                  size="sm"
                  variant="secondary"
                >
                  <Download className="w-4 h-4" />
                </Button>

                {/* 삭제 버튼 */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="w-4 h-4" />
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
                        onClick={() => handleDelete(image)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        삭제
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            </Card>
          ))}
        </div>
      )}

      {/* 이미지 뷰어 다이얼로그 */}
      <Dialog open={!!viewImage} onOpenChange={(open) => !open && setViewImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{viewImage?.title || '이미지 보기'}</DialogTitle>
          </DialogHeader>
          {viewImage && (
            <div className="flex justify-center">
              <img
                src={viewImage.transformedUrl || viewImage.url}
                alt={viewImage.title || '이미지'}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}