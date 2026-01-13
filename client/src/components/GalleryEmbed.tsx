import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Eye, Trash2 } from "lucide-react";
import { useAuthContext } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { GALLERY_FILTERS, GalleryFilterKey } from "@shared/constants";

interface ImageItem {
  id: number;
  title: string;
  url: string;
  transformedUrl: string;
  thumbnailUrl?: string;
  categoryId?: string;
  conceptId?: string;
  createdAt: string;
  userId: number;
  style: string;
}

interface GalleryEmbedProps {
  filter?: GalleryFilterKey;
  showFilters?: boolean;
  maxItems?: number;
  columns?: number;
  showDelete?: boolean;
}

export default function GalleryEmbed({ 
  filter = "all", 
  showFilters = true, 
  maxItems, 
  columns = 3,
  showDelete = true 
}: GalleryEmbedProps) {
  // 모든 Hook을 컴포넌트 최상단에 배치
  const { toast } = useToast();
  const { user } = useAuthContext();
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<GalleryFilterKey>((filter as GalleryFilterKey) || ('all' as GalleryFilterKey));
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

  // activeFilter 변경시 filter prop 반영
  useEffect(() => {
    setActiveFilter((filter as GalleryFilterKey) || ('all' as GalleryFilterKey));
  }, [filter]);

  // 갤러리 전용 쿼리 함수
  const fetchGalleryData = async () => {
    const filterParam = activeFilter && activeFilter !== "all" ? `?filter=${activeFilter}` : "";
    const url = `/api/gallery${filterParam}`;
    
    console.log('🔥 갤러리 직접 요청:', { url, filter: activeFilter });
    
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('🔥 갤러리 직접 응답:', { status: response.status, ok: response.ok });
    
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('🔥 갤러리 직접 데이터:', data);
    return data;
  };

  // 강제 갤러리 API 테스트 useEffect (Hook 순서 보장)
  useEffect(() => {
    const testGallery = async () => {
      try {
        console.log('🧪 직접 갤러리 API 테스트 시작');
        const response = await fetch('/api/gallery', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        console.log('🧪 직접 테스트 응답:', response.status, response.ok);
        const data = await response.json();
        console.log('🧪 직접 테스트 데이터:', data);
      } catch (err) {
        console.error('🧪 직접 테스트 오류:', err);
      }
    };
    testGallery();
  }, []);

  // 이미지 데이터 조회 (카테고리 필터링 포함) - GCS URL 지원 갤러리 API 사용
  const { data: imageData, isLoading, refetch, error } = useQuery({
    queryKey: ["/api/gallery", activeFilter],
    queryFn: fetchGalleryData,
    enabled: true, // 서버에서 인증 처리
    retry: 1,
    staleTime: 0, // 항상 새 데이터 가져오기
  });

  // 이미지 배열 처리 - 갤러리 API는 배열을 직접 반환
  const images = Array.isArray(imageData)
    ? imageData.filter((img: any) => img && img.id).slice(0, maxItems)
    : [];

  console.log('🔍 갤러리 데이터 디버깅:', { 
    filter: activeFilter, 
    user: user ? '인증됨' : '미인증',
    enabled: true,
    isLoading,
    error: error ? error.message : '없음',
    rawImageData: imageData,
    isArray: Array.isArray(imageData),
    processedImages: images,
    imagesCount: images.length,
    firstImage: images[0],
    queryKey: ["/api/gallery", activeFilter],
    fullResponse: imageData,
    renderConditions: {
      isLoading,
      hasError: !!error,
      hasImages: images.length > 0,
      shouldShowGrid: !isLoading && !error && images.length > 0
    }
  });

  // WEBP 다운로드 핸들러
  const handleDownload = async (image: ImageItem) => {
    try {
      // 🎯 WEBP 파일 직접 다운로드 (transformedUrl 우선 사용)
      const downloadUrl = image.transformedUrl || image.url;
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error('파일을 가져올 수 없습니다');
      }
      
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      
      // 📌 올바른 WEBP 확장자로 저장
      const fileName = (image.title || 'image').replace(/\.(jpg|jpeg|png|webp)$/i, '');
      link.download = `${fileName}.webp`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
      
      console.log('✅ WEBP 다운로드 완료:', link.download);
      
      toast({
        title: "다운로드 완료",
        description: "이미지가 성공적으로 다운로드되었습니다.",
      });
    } catch (error) {
      console.error('❌ 다운로드 실패:', error);
      toast({
        title: "다운로드 실패",
        description: "이미지 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 이미지 삭제 핸들러 (확인 대화상자 포함)
  const handleDelete = async (imageId: number) => {
    // 이미 삭제 중인 이미지는 중복 처리 방지
    if (deletingIds.has(imageId)) {
      return;
    }

    // 🚨 삭제 확인 대화상자
    const confirmDelete = window.confirm(
      "정말로 이 이미지를 삭제하시겠어요?\n\n삭제된 이미지는 복구할 수 없습니다."
    );
    
    if (!confirmDelete) {
      return; // 사용자가 취소를 선택한 경우
    }

    try {
      // 삭제 시작 - 중복 클릭 방지
      setDeletingIds(prev => new Set(prev).add(imageId));

      const response = await fetch(`/api/images/${imageId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "삭제 완료",
          description: "이미지가 성공적으로 삭제되었습니다.",
        });
        refetch();
      } else {
        throw new Error('삭제 실패');
      }
    } catch (error) {
      console.error('삭제 오류:', error);
      toast({
        title: "삭제 실패",
        description: "이미지 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      // 삭제 완료 - 상태 정리
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(imageId);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: Math.min(6, maxItems || 6) }).map((_, i) => (
          <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  // 디버깅: 이미지 렌더링 조건 확인
  console.log('🎯 렌더링 조건 체크:', { 
    hasImages: !!images, 
    imagesLength: images?.length, 
    shouldRender: images && images.length > 0 
  });

  if (!images || images.length === 0) {
    console.log('❌ 이미지 없음 - 빈 상태 표시');
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">🖼️</div>
        <p className="text-gray-400">
          {filter === "mansak_img" && "만삭사진을 만들어보세요!"}
          {filter === "family_img" && "가족사진을 만들어보세요!"}
          {filter === "sticker_img" && "스티커를 만들어보세요!"}
          {filter === "all" && "아직 이미지가 없어요"}
        </p>
      </div>
    );
  }

  console.log('✅ 이미지 렌더링 시작:', images.length, '개');
  
  // 이미지 URL 디버깅을 위한 useEffect (Hook 순서 보장)
  useEffect(() => {
    if (images && images.length > 0) {
      console.log('🖼️ 첫 번째 이미지 URL 정보:', {
        id: images[0].id,
        title: images[0].title,
        thumbnailUrl: images[0].thumbnailUrl,
        transformedUrl: images[0].transformedUrl,
        url: images[0].url,
        selectedUrl: images[0].thumbnailUrl || images[0].transformedUrl || images[0].url
      });
      
      // 모든 이미지의 URL 상태 확인
      images.slice(0, 3).forEach((image: any, index: number) => {
        console.log(`🖼️ 이미지 ${index + 1} URL 체크:`, {
          id: image.id,
          hasThumb: !!image.thumbnailUrl,
          hasTransformed: !!image.transformedUrl,
          hasOriginal: !!image.url,
          finalUrl: image.thumbnailUrl || image.transformedUrl || image.url
        });
      });
    }
  }, [images]);

  // 필터 제목 가져오기
  const getFilterTitle = (filter: GalleryFilterKey) => {
    return GALLERY_FILTERS.find(f => f.key === filter)?.label || "전체";
  };

  return (
    <>
      {/* 필터링 버튼 */}
      {showFilters && (
        <div className="flex gap-2 mb-6">
          {GALLERY_FILTERS.map((filter) => (
            <Button
              key={filter.key}
              variant={activeFilter === filter.key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter(filter.key)}
              className={`transition-all duration-200 ${
                activeFilter === filter.key 
                  ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white'
              }`}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      )}

      {/* 로딩 및 에러 상태 표시 */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="text-gray-400">갤러리 로딩 중...</div>
        </div>
      )}

      {error && (
        <div className="text-center py-8">
          <div className="text-red-400">갤러리 로딩 실패: {error.message}</div>
        </div>
      )}

      {!isLoading && !error && images.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-400">표시할 이미지가 없습니다.</div>
        </div>
      )}

      {/* 이미지 그리드 - 반응형: 모바일 1열, 태블릿 2열, 데스크탑 3-4열 */}
      {!isLoading && !error && images.length > 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {images.slice(0, 10).map((image: ImageItem) => (
          <div
            key={image.id}
            className="group relative bg-gray-700 rounded-xl overflow-hidden shadow-sm border border-gray-600 hover:shadow-md transition-all duration-200"
          >
            <div className="aspect-square w-full overflow-hidden bg-gray-600 flex items-center justify-center">
              <img
                src={image.thumbnailUrl || image.transformedUrl || image.url}
                alt={image.title}
                className="w-full h-full object-cover cursor-pointer"
                loading="lazy"
                onClick={() => {
                  setSelectedImage(image);
                  setViewerOpen(true);
                }}
                onLoad={() => {
                  console.log('✅ 이미지 로드 성공:', image.id);
                }}
                onError={(e) => {
                  console.log('❌ 이미지 로드 실패:', image.id, 'URL:', (e.target as HTMLImageElement).src);
                  // 썸네일 로드 실패 시 원본 이미지로 폴백
                  const target = e.target as HTMLImageElement;
                  if (target.src === image.thumbnailUrl && image.transformedUrl) {
                    console.log('🔄 썸네일 → transformedUrl 전환:', image.transformedUrl);
                    target.src = image.transformedUrl;
                  } else if (target.src === image.transformedUrl && image.url) {
                    console.log('🔄 transformedUrl → url 전환:', image.url);
                    target.src = image.url;
                  } else {
                    console.log('💥 모든 이미지 URL 실패');
                    // 플레이스홀더 표시
                    target.style.display = 'none';
                    const placeholder = target.parentElement;
                    if (placeholder) {
                      placeholder.innerHTML = `
                        <div class="w-full h-full bg-gray-600 flex items-center justify-center text-gray-400">
                          <div class="text-center">
                            <div class="text-2xl mb-2">📷</div>
                            <div class="text-xs">이미지 로드 실패</div>
                          </div>
                        </div>
                      `;
                    }
                  }
                }}
              />
            </div>

            {/* 호버 오버레이 */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-white/90 hover:bg-white text-gray-800"
                  onClick={() => handleDownload(image)}
                >
                  <Download className="w-4 h-4" />
                </Button>
                {showDelete && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="bg-red-500/90 hover:bg-red-600 text-white"
                    onClick={() => handleDelete(image.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="p-3">
              <h4 className="font-medium text-sm text-white line-clamp-1">
                {image.title}
              </h4>
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-gray-400">
                  {new Date(image.createdAt).toLocaleDateString('ko-KR')}
                </p>
                <span className="text-xs bg-gray-600 text-gray-200 rounded-full px-2 py-0.5">
                  {image.style}
                </span>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}

      {/* 이미지 뷰어 다이얼로그 */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="sm:max-w-[90vw] sm:max-h-[90vh] p-0 overflow-hidden bg-card">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="text-lg font-semibold text-card-foreground">
              {selectedImage?.title || "이미지 뷰어"}
            </DialogTitle>
          </DialogHeader>
          
          {selectedImage && (
            <div className="flex flex-col items-center p-4 pt-0">
              <div className="relative w-full max-w-3xl">
                <img 
                  src={selectedImage.transformedUrl || selectedImage.url} 
                  alt={selectedImage.title} 
                  className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
                />
              </div>
              
              <div className="mt-4 flex gap-3 w-full max-w-3xl">
                <Button
                  onClick={() => handleDownload(selectedImage)}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Download className="mr-2 h-4 w-4" />
                  다운로드
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setViewerOpen(false)}
                  className="flex-1"
                >
                  닫기
                </Button>
              </div>
              
              <div className="mt-3 text-center text-sm text-muted-foreground">
                <p>스타일: {selectedImage.style}</p>
                <p>생성일: {new Date(selectedImage.createdAt).toLocaleDateString('ko-KR')}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}