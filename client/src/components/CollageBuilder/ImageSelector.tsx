import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ImageIcon, X, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface ImageSelectorProps {
  selectedLayout: '2' | '6' | '12' | '24' | null;
  selectedImages: number[];
  onImageAdd: (imageId: number) => void;
  onImageRemove: (index: number) => void;
  onImageRemoveAll: (imageId: number) => void;
}

interface GalleryImage {
  id: number;
  title: string;
  url: string;
  thumbnailUrl?: string;
  transformedUrl?: string;  // 배경제거 결과물
  type: string;
}

export default function CollageImageSelector({ 
  selectedLayout, 
  selectedImages, 
  onImageAdd,
  onImageRemove,
  onImageRemoveAll
}: ImageSelectorProps) {
  const [imageCount, setImageCount] = useState<Record<number, number>>({});
  
  // 갤러리 이미지 가져오기
  const { data: images = [], isLoading } = useQuery<GalleryImage[]>({
    queryKey: ['/api/gallery'],
    queryFn: async () => {
      const response = await fetch('/api/gallery');
      if (!response.ok) throw new Error('갤러리 조회 실패');
      return response.json();
    }
  });

  // 이미지 선택 횟수 계산
  useEffect(() => {
    const counts: Record<number, number> = {};
    selectedImages.forEach(id => {
      counts[id] = (counts[id] || 0) + 1;
    });
    setImageCount(counts);
  }, [selectedImages]);

  const requiredCount = selectedLayout ? parseInt(selectedLayout) : 0;

  if (!selectedLayout) {
    return (
      <Card className="p-12 bg-gray-800 border-gray-700 text-center">
        <ImageIcon className="mx-auto h-16 w-16 text-gray-500 mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">레이아웃을 먼저 선택하세요</h3>
        <p className="text-gray-400">왼쪽에서 원하는 분할 레이아웃을 선택해주세요</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gray-800 border-gray-700">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white mb-2">
          <ImageIcon className="inline mr-2 h-5 w-5" />
          이미지 선택
        </h2>
        <div className="space-y-1">
          <p className="text-gray-400 text-sm">
            {requiredCount}개의 이미지를 선택하세요 (현재: {selectedImages.length}개)
          </p>
          <p className="text-gray-400 text-xs">
            💡 클릭으로 추가 • 같은 이미지를 여러 번 선택 가능
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {[...Array(12)].map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-12">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-500 mb-3" />
          <p className="text-gray-400">갤러리에 이미지가 없습니다</p>
          <p className="text-gray-500 text-sm mt-1">먼저 이미지를 생성해주세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-h-[600px] overflow-y-auto pr-2">
          {images.map((image) => {
            const count = imageCount[image.id] || 0;
            const isSelected = count > 0;
            const canAddMore = selectedImages.length < requiredCount;
            
            return (
              <div key={image.id} className="relative group">
                <button
                  onClick={() => canAddMore && onImageAdd(image.id)}
                  disabled={!canAddMore}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all w-full ${
                    isSelected 
                      ? 'border-purple-500 ring-2 ring-purple-500/50' 
                      : canAddMore
                      ? 'border-gray-600 hover:border-gray-500 hover:scale-105'
                      : 'border-gray-700 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <img
                    src={image.transformedUrl || image.thumbnailUrl || image.url}
                    alt={image.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  
                  {/* 선택 표시 */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-purple-600/30 flex items-center justify-center">
                      <div className="bg-purple-600 rounded-full p-1">
                        <CheckCircle2 className="h-6 w-6 text-white" />
                      </div>
                      {count > 1 && (
                        <div className="absolute top-1 right-1 bg-purple-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                          {count}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 추가 가능 표시 */}
                  {canAddMore && !isSelected && (
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <Plus className="h-8 w-8 text-white bg-purple-600 rounded-full p-1" />
                    </div>
                  )}

                  {/* 이미지 타입 표시 */}
                  <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
                    {image.type.replace('_img', '')}
                  </div>
                </button>

                {/* 개별 제거 버튼 (선택된 경우만 표시) */}
                {isSelected && (
                  <button
                    onClick={() => onImageRemoveAll(image.id)}
                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="이 이미지 모두 제거"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 선택된 이미지 순서 미리보기 */}
      {selectedImages.length > 0 && (
        <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
          <p className="text-xs text-gray-300 mb-2">선택된 이미지 순서:</p>
          <div className="flex flex-wrap gap-2">
            {selectedImages.map((imageId, index) => {
              const image = images.find(img => img.id === imageId);
              if (!image) return null;
              
              return (
                <div key={index} className="relative group">
                  <div className="w-12 h-12 rounded border border-gray-600 overflow-hidden">
                    <img
                      src={image.transformedUrl || image.thumbnailUrl || image.url}
                      alt={`${index + 1}번`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={() => onImageRemove(index)}
                    className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="제거"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <div className="absolute bottom-0 left-0 bg-black/60 text-white text-[10px] px-1 rounded-tl">
                    {index + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}