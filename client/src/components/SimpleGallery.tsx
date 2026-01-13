import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Download, Eye, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GALLERY_FILTERS, GalleryFilterKey } from "@shared/constants";

interface ImageItem {
  id: number;
  title: string;
  original_url: string;
  thumbnail_url: string;
  created_at: string;
  category: string;
}

interface SimpleGalleryProps {
  maxItems?: number;
  showFilters?: boolean;
  enableDelete?: boolean;
}

export function SimpleGallery({ 
  maxItems = 10, 
  showFilters = true, 
  enableDelete = false 
}: SimpleGalleryProps) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<GalleryFilterKey>("all" as GalleryFilterKey);
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  // 갤러리 데이터 로드
  const fetchGalleryData = async (filter: GalleryFilterKey = "all" as GalleryFilterKey) => {
    try {
      setIsLoading(true);
      console.log('🔄 갤러리 데이터 로드 시작:', filter);
      
      const response = await fetch(`/api/gallery?filter=${filter}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ 갤러리 데이터 로드 성공:', data);
      
      if (data.items && Array.isArray(data.items)) {
        setImages(data.items.slice(0, maxItems));
        console.log(`📸 이미지 ${data.items.length}개 중 ${Math.min(data.items.length, maxItems)}개 표시`);
      } else {
        console.warn('⚠️ 예상과 다른 데이터 형식:', data);
        setImages([]);
      }
    } catch (error) {
      console.error('❌ 갤러리 데이터 로드 실패:', error);
      setImages([]);
      toast({
        title: "갤러리 로드 실패",
        description: "이미지를 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 초기 로드 및 필터 변경시 데이터 재로드
  useEffect(() => {
    fetchGalleryData(activeFilter);
  }, [activeFilter, maxItems]);

  // 이미지 삭제
  const handleDelete = async (imageId: number) => {
    if (!enableDelete) return;

    try {
      setDeletingIds(prev => new Set([...prev, imageId]));

      const response = await fetch(`/api/images/${imageId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: "삭제 완료",
          description: "이미지가 성공적으로 삭제되었습니다.",
        });
        // 데이터 재로드
        fetchGalleryData(activeFilter);
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
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(imageId);
        return newSet;
      });
    }
  };

  // 이미지 다운로드
  const handleDownload = async (image: ImageItem) => {
    try {
      const imageUrl = image.original_url;
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${image.title || 'image'}.webp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "다운로드 시작",
        description: "이미지 다운로드가 시작되었습니다.",
      });
    } catch (error) {
      console.error('다운로드 오류:', error);
      toast({
        title: "다운로드 실패",
        description: "이미지 다운로드에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: Math.min(6, maxItems) }).map((_, i) => (
          <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  // 빈 상태
  if (!images || images.length === 0) {
    return (
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
  }

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

      {/* 이미지 그리드 - 정식서버 스타일 */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {images.map((image) => {
          return (
            <div
              key={image.id}
              className="group relative aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:bg-gray-700 transition-colors duration-200"
              onClick={() => {
                setSelectedImage(image);
                setViewerOpen(true);
              }}
            >
              {/* 실제 이미지 */}
              <img
                src={image.thumbnail_url}
                alt={image.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `
                      <div class="w-full h-full bg-gray-200 flex flex-col items-center justify-center text-gray-500">
                        <div class="text-2xl mb-2">📷</div>
                        <div class="text-xs text-center px-2">이미지를 준비 중</div>
                      </div>
                    `;
                  }
                }}
              />

              {/* 제목 오버레이 */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2">
                <p className="text-white text-xs font-medium truncate text-center">
                  {image.title}
                </p>
                <p className="text-gray-300 text-xs">
                  {new Date(image.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 이미지 뷰어 다이얼로그 */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl w-full bg-gray-900 border-gray-700">
          <DialogTitle className="text-white">
            {selectedImage?.title}
          </DialogTitle>
          {selectedImage && (
            <div className="flex flex-col items-center">
              <img
                src={selectedImage.original_url}
                alt={selectedImage.title}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
              <div className="flex gap-4 mt-4">
                <Button
                  variant="outline"
                  onClick={() => handleDownload(selectedImage)}
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  다운로드
                </Button>
                {enableDelete && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleDelete(selectedImage.id);
                      setViewerOpen(false);
                    }}
                    disabled={deletingIds.has(selectedImage.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    삭제
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}