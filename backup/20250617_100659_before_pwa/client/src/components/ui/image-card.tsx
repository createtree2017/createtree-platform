import { useState } from "react";
import { Download, Eye, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ImageCardProps {
  id: number;
  title: string;
  url: string;
  thumbnailUrl?: string;
  createdAt: string;
  categoryId?: string;
  onView?: (image: any) => void;
  onDownload?: (image: any) => void;
  onDelete?: (imageId: number) => void;
  className?: string;
  showDownload?: boolean;
  showViewButton?: boolean;
  showDelete?: boolean;
}

export function ImageCard({
  id,
  title,
  url,
  thumbnailUrl,
  createdAt,
  categoryId,
  onView,
  onDownload,
  onDelete,
  className,
  showDownload = true,
  showViewButton = true,
  showDelete = false,
}: ImageCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 🎯 작업지시서: 썸네일 우선 로딩 최적화
  // thumbnailUrl → transformedUrl → originalUrl 순으로 우선순위
  const displayUrl = thumbnailUrl || transformedUrl || url;

  // 삭제 뮤테이션
  const deleteMutation = useMutation({
    mutationFn: async (imageId: number) => {
      const response = await fetch(`/api/image/${imageId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('이미지 삭제에 실패했습니다');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/images'] });
      toast({
        title: "삭제 완료",
        description: "이미지가 성공적으로 삭제되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "삭제 실패",
        description: "이미지 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });
  
  const imageData = {
    id,
    title,
    url,
    thumbnailUrl,
    createdAt,
    categoryId,
  };

  const handleDownload = async () => {
    if (onDownload) {
      onDownload(imageData);
      return;
    }

    try {
      // 🎯 WEBP 파일 직접 다운로드 (transformedUrl 또는 originalUrl 사용)
      const downloadUrl = transformedUrl || url;
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error('파일을 가져올 수 없습니다');
      }
      
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      
      // 📌 올바른 WEBP 확장자로 저장
      const fileName = (title || 'image').replace(/\.(jpg|jpeg|png|webp)$/i, '');
      link.download = `${fileName}.webp`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
      
      console.log('✅ WEBP 다운로드 완료:', link.download);
    } catch (error) {
      console.error('❌ 다운로드 실패:', error);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className={cn(
      "group relative bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100",
      className
    )}>
      {/* 이미지 영역 - 썸네일 우선 로딩 */}
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse">
            <div className="w-8 h-8 bg-gray-300 rounded-full animate-bounce"></div>
          </div>
        )}
        
        <img
          src={displayUrl}
          alt={title || "이미지"}
          className={cn(
            "w-full h-full object-cover transition-all duration-300",
            imageLoaded ? "opacity-100" : "opacity-0",
            "group-hover:scale-105"
          )}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          loading="lazy"
        />

        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center text-gray-500">
              <div className="text-2xl mb-2">📷</div>
              <div className="text-sm">이미지를 불러올 수 없습니다</div>
            </div>
          </div>
        )}

        {/* 호버 오버레이 */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex gap-2">
            {showViewButton && onView && (
              <Button
                size="sm"
                variant="secondary"
                className="bg-white/90 hover:bg-white text-gray-800"
                onClick={() => onView(imageData)}
              >
                <Eye className="w-4 h-4" />
              </Button>
            )}
            {showDownload && (
              <Button
                size="sm"
                variant="secondary"
                className="bg-white/90 hover:bg-white text-gray-800"
                onClick={handleDownload}
              >
                <Download className="w-4 h-4" />
              </Button>
            )}
            {showDelete && (
              <Button
                size="sm"
                variant="destructive"
                className="bg-red-500/90 hover:bg-red-600 text-white"
                onClick={() => {
                  if (onDelete) {
                    onDelete(id);
                  } else {
                    deleteMutation.mutate(id);
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* 썸네일 표시기 */}
        {thumbnailUrl && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
            ⚡ 빠른로딩
          </div>
        )}
      </div>

      {/* 정보 영역 */}
      <div className="p-4">
        <h3 className="font-medium text-gray-900 truncate mb-2">
          {title || "제목 없음"}
        </h3>
        
        {createdAt && (
          <div className="flex items-center text-xs text-gray-500">
            <Clock className="w-3 h-3 mr-1" />
            {formatDate(createdAt)}
          </div>
        )}
      </div>
    </div>
  );
}