import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface CollagePreviewProps {
  sessionId: string;
}

export default function CollagePreview({ sessionId }: CollagePreviewProps) {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [collageStatus, setCollageStatus] = useState<'pending' | 'generating' | 'completed' | 'failed'>('pending');
  const generatingRef = useRef(false);  // 중복 요청 방지용

  // 콜라주 생성 시작
  useEffect(() => {
    if (sessionId && !generatingRef.current) {
      generateCollage();
    }
  }, [sessionId]);

  // 콜라주 생성
  const generateCollage = async () => {
    // 이미 생성 중이면 중복 실행 방지
    if (generatingRef.current) {
      console.log('콜라주 생성이 이미 진행 중입니다.');
      return;
    }
    
    generatingRef.current = true;
    setIsGenerating(true);
    setCollageStatus('generating');
    
    try {
      const response = await fetch(`/api/collage/generate/${sessionId}`);
      if (!response.ok) throw new Error('콜라주 생성 실패');
      
      const data = await response.json();
      
      if (data.status === 'completed' && data.outputUrl) {
        setPreviewUrl(data.outputUrl);
        setCollageStatus('completed');
        
        // 갤러리 캐시 무효화 - 새로 생성된 콜라주가 갤러리에 즉시 표시되도록
        queryClient.invalidateQueries({ queryKey: ['/api/gallery'] });
        
        toast({
          title: "콜라주 생성 완료",
          description: "이제 다운로드할 수 있습니다",
        });
      } else if (data.status === 'failed') {
        throw new Error(data.error || '콜라주 생성 실패');
      }
    } catch (error) {
      console.error('콜라주 생성 오류:', error);
      setCollageStatus('failed');
      toast({
        title: "생성 실패",
        description: error instanceof Error ? error.message : "콜라주 생성 중 문제가 발생했습니다",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
      generatingRef.current = false;  // 생성 완료 후 플래그 리셋
    }
  };

  // 다운로드 처리
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // 파일 다운로드를 위해 새 창에서 열기
      window.open(`/api/collage/download/${sessionId}`, '_blank');
      
      toast({
        title: "다운로드 시작",
        description: "콜라주 이미지를 다운로드하고 있습니다",
      });
    } catch (error) {
      console.error('다운로드 오류:', error);
      toast({
        title: "다운로드 실패",
        description: "파일 다운로드 중 문제가 발생했습니다",
        variant: "destructive"
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card className="p-6 bg-gray-800 border-gray-700">
      <div className="text-center">
        {collageStatus === 'completed' ? (
          <div className="mb-6">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">콜라주 생성 완료!</h2>
            <p className="text-gray-400">세션 ID: {sessionId}</p>
          </div>
        ) : collageStatus === 'generating' ? (
          <div className="mb-6">
            <Loader2 className="mx-auto h-16 w-16 text-purple-500 animate-spin mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">콜라주 생성 중...</h2>
            <p className="text-gray-400">잠시만 기다려주세요</p>
          </div>
        ) : collageStatus === 'failed' ? (
          <div className="mb-6">
            <div className="mx-auto h-16 w-16 text-red-500 mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-white mb-2">생성 실패</h2>
            <p className="text-gray-400">콜라주 생성 중 오류가 발생했습니다</p>
          </div>
        ) : null}

        {/* 프리뷰 영역 */}
        <div className="mb-6 p-8 bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-600">
          {previewUrl ? (
            <img 
              src={previewUrl} 
              alt="콜라주 프리뷰" 
              className="max-w-full mx-auto rounded shadow-lg"
            />
          ) : isGenerating ? (
            <div className="py-12">
              <Loader2 className="mx-auto h-8 w-8 text-gray-400 animate-spin mb-3" />
              <p className="text-gray-400">이미지 처리 중...</p>
              <p className="text-gray-500 text-sm mt-1">레이아웃에 따라 1-2분 소요될 수 있습니다</p>
            </div>
          ) : collageStatus === 'failed' ? (
            <div className="py-12">
              <p className="text-red-400">콜라주 생성에 실패했습니다</p>
              <p className="text-gray-500 text-sm mt-1">다시 시도해주세요</p>
            </div>
          ) : (
            <div className="py-12">
              <p className="text-gray-400">콜라주를 준비하고 있습니다...</p>
            </div>
          )}
        </div>

        {/* 다운로드 버튼 */}
        <div className="flex gap-3 justify-center">
          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            {isDownloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                콜라주 다운로드
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="border-gray-600"
          >
            새 콜라주 만들기
          </Button>
        </div>

        {/* 정보 표시 */}
        <div className="mt-6 p-4 bg-gray-700/30 rounded-lg">
          <h3 className="font-semibold text-white mb-2">콜라주 정보</h3>
          <div className="text-sm text-gray-400 space-y-1">
            <p>• 세션: {sessionId}</p>
            <p>• 생성 시간: {new Date().toLocaleString()}</p>
            <p>• 상태: 준비 완료</p>
          </div>
        </div>
      </div>
    </Card>
  );
}