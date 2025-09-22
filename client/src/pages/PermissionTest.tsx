import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  message: string;
  timestamp: string;
}

export default function PermissionTest() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runPermissionTest = async () => {
    setIsRunning(true);
    setTestResults([]);

    const tests = [
      {
        name: '권한 테스트 API',
        endpoint: '/api/test-permissions',
        method: 'POST',
        expectedSuccess: true,
        description: '모든 권한 미들웨어 통과 테스트'
      },
      {
        name: '이미지 생성 권한',
        endpoint: '/api/generate-image',
        method: 'POST',
        expectedSuccess: false, // 파일이 없어서 400 에러 예상
        description: '파일 업로드 없이 권한만 확인'
      },
      {
        name: '음악 생성 권한',
        endpoint: '/api/music-engine/generate',
        method: 'POST',
        expectedSuccess: false, // 데이터가 없어서 400 에러 예상
        description: '데이터 없이 권한만 확인'
      }
    ];

    for (const test of tests) {
      try {
        const response = await fetch(test.endpoint, {
          method: test.method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({})
        });

        const responseText = await response.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { message: '응답이 JSON이 아님', rawResponse: responseText.substring(0, 100) };
        }

        const result: TestResult = {
          endpoint: test.endpoint,
          method: test.method,
          status: response.status,
          success: response.ok || (response.status === 400 && test.expectedSuccess === false),
          message: responseData.message || responseData.error || `${response.status} ${response.statusText}`,
          timestamp: new Date().toLocaleTimeString()
        };

        setTestResults(prev => [...prev, result]);
      } catch (error) {
        const result: TestResult = {
          endpoint: test.endpoint,
          method: test.method,
          status: 0,
          success: false,
          message: error instanceof Error ? error.message : '네트워크 오류',
          timestamp: new Date().toLocaleTimeString()
        };

        setTestResults(prev => [...prev, result]);
      }

      // 테스트 간 간격
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRunning(false);
  };

  const getStatusBadge = (status: number) => {
    if (status === 200) return <Badge variant="default" className="bg-green-500">200 OK</Badge>;
    if (status === 400) return <Badge variant="secondary">400 Bad Request</Badge>;
    if (status === 401) return <Badge variant="destructive">401 Unauthorized</Badge>;
    if (status === 403) return <Badge variant="destructive">403 Forbidden</Badge>;
    if (status === 0) return <Badge variant="outline">Network Error</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>권한 시스템 실시간 테스트</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              현재 로그인된 사용자의 권한으로 보호된 API들을 테스트합니다.
              관리자는 모든 API에 접근 가능하고, FREE 회원은 403 Forbidden이 나와야 합니다.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={runPermissionTest} 
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? '테스트 실행 중...' : '권한 테스트 시작'}
          </Button>

          {testResults.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">테스트 결과</h3>
              {testResults.map((result, index) => (
                <Card key={index} className={`border-l-4 ${
                  result.success ? 'border-l-green-500' : 'border-l-red-500'
                }`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{result.method}</Badge>
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {result.endpoint}
                        </code>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(result.status)}
                        <span className="text-sm text-gray-500">{result.timestamp}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{result.message}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Alert>
            <AlertDescription>
              <strong>권한 시스템 검증 기준:</strong>
              <ul className="mt-2 space-y-1">
                <li>• FREE 회원: 403 Forbidden (권한 부족)</li>
                <li>• PRO 회원: 200 OK 또는 400 Bad Request (권한 통과, 데이터 문제)</li>
                <li>• MEMBERSHIP (활성화 병원): 200 OK 또는 400 Bad Request</li>
                <li>• MEMBERSHIP (비활성화 병원): 403 Forbidden</li>
                <li>• 관리자: 200 OK 또는 400 Bad Request (모든 권한)</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}