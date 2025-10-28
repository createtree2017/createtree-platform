import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Download, Grid2X2, ImageIcon, Trash2 } from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import CollageLayoutPicker from '@/components/CollageBuilder/LayoutPicker';
import CollageImageSelector from '@/components/CollageBuilder/ImageSelector';
import CollagePreview from '@/components/CollageBuilder/CollagePreview';

export default function GalleryCollagePage() {
  const { toast } = useToast();
  const [selectedLayout, setSelectedLayout] = useState<'2' | '6' | '12' | '24' | null>(null);
  const [selectedImages, setSelectedImages] = useState<number[]>([]);
  const [resolution, setResolution] = useState<'web' | 'high' | 'print'>('print');
  const [isCreating, setIsCreating] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // 레이아웃별 필요한 이미지 개수
  const getRequiredCount = (layout: string | null) => {
    if (!layout) return 0;
    return parseInt(layout);
  };

  // 이미지 추가 핸들러 (중복 선택 가능)
  const handleImageAdd = (imageId: number) => {
    const required = getRequiredCount(selectedLayout);
    
    // 이미지 추가 (필요 개수 이하일 때만)
    if (selectedImages.length < required) {
      setSelectedImages(prev => [...prev, imageId]);
    } else {
      toast({
        title: "선택 제한",
        description: `${selectedLayout}분할 레이아웃은 ${required}개까지만 선택 가능합니다`,
        variant: "destructive"
      });
    }
  };

  // 특정 이미지 제거 핸들러 (인덱스 기반)
  const handleImageRemove = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  // 특정 이미지의 모든 인스턴스 제거
  const handleImageRemoveAll = (imageId: number) => {
    setSelectedImages(prev => prev.filter(id => id !== imageId));
  };

  // 전체 선택 해제
  const handleClearAll = () => {
    setSelectedImages([]);
    toast({
      title: "전체 해제",
      description: "모든 이미지 선택이 해제되었습니다",
    });
  };

  // 콜라주 생성 요청
  const handleCreateCollage = async () => {
    if (!selectedLayout) {
      toast({
        title: "레이아웃을 선택하세요",
        description: "콜라주 레이아웃을 먼저 선택해주세요",
        variant: "destructive"
      });
      return;
    }

    const required = getRequiredCount(selectedLayout);
    if (selectedImages.length !== required) {
      toast({
        title: "이미지 개수 확인",
        description: `${required}개의 이미지를 선택해주세요 (현재: ${selectedImages.length}개)`,
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/collage/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageIds: selectedImages,
          layout: selectedLayout,
          resolution: resolution,
          format: 'webp'
        })
      });

      if (!response.ok) throw new Error('콜라주 생성 실패');
      
      const data = await response.json();
      setSessionId(data.sessionId);
      
      toast({
        title: "콜라주 생성 준비 완료",
        description: "이미지 처리를 시작합니다",
      });
    } catch (error) {
      console.error('콜라주 생성 오류:', error);
      toast({
        title: "오류 발생",
        description: "콜라주 생성 중 문제가 발생했습니다",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <Link href="/gallery">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              갤러리로 돌아가기
            </Button>
          </Link>
          
          <h1 className="text-4xl font-bold text-white mb-2">콜라주 만들기</h1>
          <p className="text-gray-300">여러 이미지를 하나로 결합하여 특별한 작품을 만드세요</p>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 레이아웃 선택 */}
          <div className="lg:col-span-1">
            <Card className="p-6 bg-gray-800 border-gray-700">
              <h2 className="text-xl font-semibold text-white mb-4">
                <Grid2X2 className="inline mr-2 h-5 w-5" />
                레이아웃 선택
              </h2>
              <CollageLayoutPicker
                selectedLayout={selectedLayout}
                onSelectLayout={setSelectedLayout}
                selectedCount={selectedImages.length}
              />

              {/* 선택된 이미지 수와 전체 해제 버튼 */}
              {selectedImages.length > 0 && (
                <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">
                      선택된 이미지: {selectedImages.length}/{getRequiredCount(selectedLayout)}개
                    </span>
                    <Button
                      onClick={handleClearAll}
                      variant="destructive"
                      size="sm"
                      className="h-7"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      전체 해제
                    </Button>
                  </div>
                </div>
              )}

              {/* 해상도 안내 */}
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-300 mb-3">해상도 설정</h3>
                <div className="p-3 bg-purple-600/20 border border-purple-500/30 rounded-lg">
                  <div className="text-purple-300 text-sm font-medium mb-1">
                    고화질(인쇄용)의 콜라주를 생성합니다.
                  </div>
                  <div className="text-purple-400/80 text-xs">
                    300 DPI - 실물 인쇄, 포토북용 최고 품질
                  </div>
                </div>
                
                {/* 숨겨진 해상도 선택 옵션들 (추후 사용을 위해 보관) */}
                <div className="space-y-2" style={{ display: 'none' }}>
                  <button
                    onClick={() => setResolution('web')}
                    className={`w-full p-3 rounded-lg border ${
                      resolution === 'web' 
                        ? 'bg-purple-600 border-purple-500 text-white' 
                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <div className="font-medium">웹용 (72 DPI)</div>
                    <div className="text-xs opacity-80">SNS 공유, 웹 게시용</div>
                  </button>
                  <button
                    onClick={() => setResolution('high')}
                    className={`w-full p-3 rounded-lg border ${
                      resolution === 'high' 
                        ? 'bg-purple-600 border-purple-500 text-white' 
                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <div className="font-medium">고품질 (150 DPI)</div>
                    <div className="text-xs opacity-80">디지털 앨범용</div>
                  </button>
                  <button
                    onClick={() => setResolution('print')}
                    className={`w-full p-3 rounded-lg border ${
                      resolution === 'print' 
                        ? 'bg-purple-600 border-purple-500 text-white' 
                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <div className="font-medium">인쇄용 (300 DPI)</div>
                    <div className="text-xs opacity-80">실물 인쇄, 포토북용</div>
                  </button>
                </div>
              </div>

              {/* 생성 버튼 */}
              <Button
                onClick={handleCreateCollage}
                disabled={!selectedLayout || selectedImages.length !== getRequiredCount(selectedLayout) || isCreating}
                className="w-full mt-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                {isCreating ? (
                  <>처리 중...</>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    콜라주 생성하기
                  </>
                )}
              </Button>
            </Card>
          </div>

          {/* 오른쪽: 이미지 선택 또는 프리뷰 */}
          <div className="lg:col-span-2">
            {sessionId ? (
              <CollagePreview sessionId={sessionId} />
            ) : (
              <CollageImageSelector
                selectedLayout={selectedLayout}
                selectedImages={selectedImages}
                onImageAdd={handleImageAdd}
                onImageRemove={handleImageRemove}
                onImageRemoveAll={handleImageRemoveAll}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}