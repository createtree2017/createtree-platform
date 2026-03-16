import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CollageLayoutPicker from '@/components/CollageBuilder/LayoutPicker';
import CollageImageSelector, { SelectedImage } from '@/components/CollageBuilder/ImageSelector';
import CollagePreview from '@/components/CollageBuilder/CollagePreview';

export default function GalleryCollagePage() {
  const { toast } = useToast();
  const [selectedLayout, setSelectedLayout] = useState<'2' | '6' | '12' | '24' | null>(null);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [resolution] = useState<'web' | 'high' | 'print'>('print');
  const [isCreating, setIsCreating] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const requiredCount = selectedLayout ? parseInt(selectedLayout) : 0;
  const isReady = !!selectedLayout && selectedImages.length === requiredCount;

  // 레이아웃 변경 시 이미지 선택 초기화
  const handleSelectLayout = useCallback((layout: '2' | '6' | '12' | '24') => {
    if (layout !== selectedLayout) {
      setSelectedImages([]);
      setSessionId(null);
    }
    setSelectedLayout(layout);
  }, [selectedLayout]);

  // 이미지 추가
  const handleImageAdd = useCallback((image: SelectedImage) => {
    setSelectedImages((prev) => {
      if (prev.length >= requiredCount) return prev;
      return [...prev, image];
    });
  }, [requiredCount]);

  // 인덱스 기반 이미지 제거
  const handleImageRemove = useCallback((index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 전체 해제
  const handleClearAll = useCallback(() => {
    setSelectedImages([]);
    toast({ title: '전체 해제', description: '이미지 선택이 초기화되었습니다.' });
  }, [toast]);

  // 콜라주 생성
  const handleCreateCollage = async () => {
    if (!isReady) return;

    setIsCreating(true);
    try {
      // 갤러리 ID 배열
      const galleryIds = selectedImages
        .filter((img) => img.type === 'gallery')
        .map((img) => (img as Extract<SelectedImage, { type: 'gallery' }>).id);

      // 디바이스 파일 배열
      const deviceFiles = selectedImages
        .filter((img) => img.type === 'device')
        .map((img) => (img as Extract<SelectedImage, { type: 'device' }>).file);

      // FormData 조합 (갤러리 + 디바이스 하이브리드)
      const formData = new FormData();
      formData.append('layout', selectedLayout!);
      formData.append('resolution', resolution);
      formData.append('format', 'webp');
      if (galleryIds.length > 0) {
        formData.append('imageIds', JSON.stringify(galleryIds));
      }
      deviceFiles.forEach((file) => formData.append('deviceFiles', file));

      const response = await fetch('/api/collage/create', {
        method: 'POST',
        body: formData, // Content-Type은 브라우저가 자동 설정 (multipart/form-data)
      });

      if (!response.ok) throw new Error('콜라주 생성 실패');

      const data = await response.json();
      setSessionId(data.sessionId);
      toast({ title: '콜라주 생성 준비 완료', description: '이미지 처리를 시작합니다.' });
    } catch (error) {
      console.error('콜라주 생성 오류:', error);
      toast({ title: '오류 발생', description: '콜라주 생성 중 문제가 발생했습니다.', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  // ── 생성 완료 후 프리뷰 화면 ──────────────────────────
  if (sessionId) {
    return (
      <div className="min-h-[var(--dvh)] px-4 py-6">
        <CollagePreview sessionId={sessionId} />
        <div className="mt-4">
          <Button
            onClick={() => { setSessionId(null); setSelectedImages([]); setSelectedLayout(null); }}
            variant="outline"
            className="w-full"
          >
            다시 만들기
          </Button>
        </div>
      </div>
    );
  }

  // ── 메인 화면 ─────────────────────────────────────────
  return (
    <div className="min-h-[var(--dvh)] flex flex-col pb-24">
      {/* 헤더 */}
      <div className="text-center pt-8 pb-6 px-4">
        <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          콜라주 만들기
        </h1>
        <p className="text-gray-400 text-sm mt-1">여러 이미지를 하나로 결합하세요</p>
      </div>

      {/* 섹션 1: 레이아웃 선택 */}
      <section className="px-4 mb-6">
        <SectionLabel index={1} label="분할 선택" />
        <CollageLayoutPicker
          selectedLayout={selectedLayout}
          onSelectLayout={handleSelectLayout}
          selectedCount={selectedImages.length}
        />
      </section>

      {/* 섹션 2: 이미지 선택 (분할 선택 후 표시) */}
      <section className={`px-4 flex-1 transition-all duration-300 ${selectedLayout ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        <SectionLabel index={2} label="이미지 추가" />
        <CollageImageSelector
          selectedLayout={selectedLayout}
          selectedImages={selectedImages}
          onImageAdd={handleImageAdd}
          onImageRemove={handleImageRemove}
          onClearAll={handleClearAll}
        />
      </section>

      {/* 하단 고정 생성 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none">
        <Button
          onClick={handleCreateCollage}
          disabled={!isReady || isCreating}
          className="w-full h-12 text-base font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 pointer-events-auto shadow-lg shadow-purple-500/20 transition-all"
        >
          {isCreating ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              처리 중...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              콜라주 생성하기
              {isReady && <span className="ml-1 opacity-70 text-sm">✓</span>}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── 섹션 레이블 컴포넌트 ───────────────────────────────
function SectionLabel({ index, label }: { index: number; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
        {index}
      </span>
      <span className="text-sm font-semibold text-gray-200">{label}</span>
    </div>
  );
}