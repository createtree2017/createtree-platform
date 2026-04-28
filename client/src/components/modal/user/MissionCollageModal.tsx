import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CollageLayoutPicker from '@/components/CollageBuilder/LayoutPicker';
import CollageImageSelector, { SelectedImage } from '@/components/CollageBuilder/ImageSelector';

interface MissionCollageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (outputUrl: string, sessionId: string) => void;
}

export function MissionCollageModal({ isOpen, onClose, onComplete }: MissionCollageModalProps) {
  const { toast } = useToast();
  const [selectedLayout, setSelectedLayout] = useState<'1' | '2' | '6' | '12' | '24' | null>(null);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const requiredCount = selectedLayout ? parseInt(selectedLayout) : 0;
  const isReady = !!selectedLayout && selectedImages.length === requiredCount;

  const handleSelectLayout = useCallback((layout: '1' | '2' | '6' | '12' | '24') => {
    if (layout !== selectedLayout) {
      setSelectedImages([]);
    }
    setSelectedLayout(layout);
  }, [selectedLayout]);

  const handleImageAdd = useCallback((image: SelectedImage) => {
    setSelectedImages((prev) => {
      if (prev.length >= requiredCount) return prev;
      return [...prev, image];
    });
  }, [requiredCount]);

  const handleImageRemove = useCallback((index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearAll = useCallback(() => {
    setSelectedImages([]);
    toast({ title: '전체 해제', description: '이미지 선택이 초기화되었습니다.' });
  }, [toast]);

  const pollGenerationStatus = async (sessionId: string) => {
    try {
      setIsPolling(true);
      const response = await fetch(`/api/collage/generate/${sessionId}`);
      if (!response.ok) throw new Error('콜라주 생성 실패');
      
      const data = await response.json();
      
      if (data.status === 'completed' && data.outputUrl) {
        toast({ title: '사진 준비 완료', description: '사진이 성공적으로 적용되었습니다.' });
        if (onComplete) onComplete(data.outputUrl, sessionId);
        onClose();
      } else if (data.status === 'failed') {
        throw new Error(data.error || '콜라주 생성 실패');
      } else {
         toast({ title: '처리 중', description: '생성이 진행 중입니다.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('콜라주 생성 오류:', error);
      toast({
        title: '생성 실패',
        description: error instanceof Error ? error.message : '콜라주 생성 중 문제가 발생했습니다',
        variant: 'destructive'
      });
    } finally {
      setIsPolling(false);
    }
  };

  const handleCreateCollage = async () => {
    if (!isReady) return;

    setIsCreating(true);
    try {
      const galleryIds = selectedImages
        .filter((img) => img.type === 'gallery')
        .map((img) => (img as Extract<SelectedImage, { type: 'gallery' }>).id);

      const deviceFiles = selectedImages
        .filter((img) => img.type === 'device')
        .map((img) => (img as Extract<SelectedImage, { type: 'device' }>).file);

      const formData = new FormData();
      formData.append('layout', selectedLayout!);
      formData.append('resolution', 'print'); // default high res
      formData.append('format', 'webp');
      if (galleryIds.length > 0) {
        formData.append('imageIds', JSON.stringify(galleryIds));
      }
      deviceFiles.forEach((file) => formData.append('deviceFiles', file));

      const response = await fetch('/api/collage/create', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('이미지 처리 준비 실패');

      const data = await response.json();
      const sessionId = data.sessionId;
      
      toast({ title: '이미지 처리 중', description: '잠시만 기다려주세요.' });
      
      // 즉시 폴링(동기 대기) 시작
      await pollGenerationStatus(sessionId);

    } catch (error) {
      console.error('이미지 처리 오류:', error);
      toast({ title: '오류 발생', description: '이미지 처리 중 문제가 발생했습니다.', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && !isCreating && !isPolling) onClose();
    }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle>사진 선택하기</DialogTitle>
          <DialogDescription>
            제출할 사진의 분할 레이아웃을 선택하고 사진을 추가해주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
              <span className="text-sm font-semibold text-gray-200">레이아웃 선택 (1장만 제출하려면 1분할 선택)</span>
            </div>
            <CollageLayoutPicker
              selectedLayout={selectedLayout}
              onSelectLayout={handleSelectLayout}
              selectedCount={selectedImages.length}
            />
          </section>

          <section className={`transition-all duration-300 ${selectedLayout ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
              <span className="text-sm font-semibold text-gray-200">이미지 추가</span>
            </div>
            <CollageImageSelector
              selectedLayout={selectedLayout}
              selectedImages={selectedImages}
              onImageAdd={handleImageAdd}
              onImageRemove={handleImageRemove}
              onClearAll={handleClearAll}
            />
          </section>
        </div>

        <div className="pt-4 mt-2 border-t border-gray-800">
          <Button
            onClick={handleCreateCollage}
            disabled={!isReady || isCreating || isPolling}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40"
          >
            {isCreating || isPolling ? (
              <span className="flex items-center gap-2">
                <Loader2 className="animate-spin w-4 h-4" />
                이미지 병합 및 준비 중...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                선택 완료 및 적용하기
                {isReady && <span className="ml-1 opacity-70 text-sm">✓</span>}
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
