import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Play, Volume2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function TopMediaTest() {
  const [prompt, setPrompt] = useState('우리 아기를 위한 자장가');
  const [style, setStyle] = useState('lullaby');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const testTopMediaAPI = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/topmedia-test/test-music', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, style }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        toast({
          title: '성공',
          description: 'TopMediai API 테스트가 완료되었습니다.',
        });
      } else {
        throw new Error(data.message || 'API 테스트 실패');
      }
    } catch (error) {
      console.error('TopMediai API 테스트 오류:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">TopMediai API 테스트</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>음악 생성 테스트</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">프롬프트</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="생성하고 싶은 음악에 대한 설명을 입력하세요"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">스타일</label>
            <Input
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="예: lullaby, classical, pop"
            />
          </div>

          <Button
            onClick={testTopMediaAPI}
            disabled={isLoading || !prompt.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                음악 생성 중...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                TopMediai API 테스트
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              테스트 결과
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <strong>상태:</strong>
                <span className={`ml-2 px-2 py-1 rounded text-sm ${
                  result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {result.success ? '성공' : '실패'}
                </span>
              </div>

              <div>
                <strong>메시지:</strong>
                <p className="mt-1 text-gray-600">{result.message}</p>
              </div>

              {result.data && (
                <div>
                  <strong>생성된 데이터:</strong>
                  <pre className="mt-2 p-4 bg-gray-100 rounded-md overflow-auto text-sm">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                  
                  {result.data.audioUrl && (
                    <div className="mt-4">
                      <strong>오디오 파일:</strong>
                      <audio 
                        controls 
                        className="w-full mt-2"
                        src={result.data.audioUrl}
                      >
                        브라우저가 오디오를 지원하지 않습니다.
                      </audio>
                    </div>
                  )}
                </div>
              )}

              {result.error && (
                <div>
                  <strong>오류 상세:</strong>
                  <p className="mt-1 text-red-600">{result.error}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}