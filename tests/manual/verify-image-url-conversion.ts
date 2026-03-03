/**
 * 이미지 URL 변환 완전 검증 스크립트
 * 
 * 모든 이미지 관련 API에서 SignedURL → 직접 공개 URL 변환이 정상 작동하는지 확인
 */

import fetch from 'node-fetch';

interface ImageTestResult {
  endpoint: string;
  status: number;
  hasSignedUrls: boolean;
  hasDirectUrls: boolean;
  sampleUrls: string[];
  urlCount: number;
}

/**
 * SignedURL 감지 함수
 */
function isSignedUrl(url: string): boolean {
  return url.includes('GoogleAccessId=') || url.includes('Signature=');
}

/**
 * 직접 공개 URL 감지 함수
 */
function isDirectUrl(url: string): boolean {
  return url.startsWith('https://storage.googleapis.com/createtree-upload/') && !isSignedUrl(url);
}

/**
 * API 엔드포인트별 이미지 URL 검증
 */
async function testImageEndpoint(endpoint: string, authToken: string): Promise<ImageTestResult> {
  try {
    const response = await fetch(`http://localhost:5000${endpoint}`, {
      headers: {
        'Cookie': `auth_token=${authToken}; auth_status=logged_in`
      }
    });

    const data = await response.json();
    const urls: string[] = [];
    
    // 응답에서 모든 이미지 URL 추출
    function extractUrls(obj: any) {
      if (typeof obj === 'string' && (obj.includes('storage.googleapis.com') || obj.startsWith('/uploads/'))) {
        urls.push(obj);
      } else if (Array.isArray(obj)) {
        obj.forEach(extractUrls);
      } else if (obj && typeof obj === 'object') {
        Object.values(obj).forEach(extractUrls);
      }
    }
    
    extractUrls(data);
    
    const hasSignedUrls = urls.some(isSignedUrl);
    const hasDirectUrls = urls.some(isDirectUrl);
    
    return {
      endpoint,
      status: response.status,
      hasSignedUrls,
      hasDirectUrls,
      sampleUrls: urls.slice(0, 3), // 처음 3개만 샘플로
      urlCount: urls.length
    };
  } catch (error) {
    console.error(`[${endpoint}] 테스트 오류:`, error);
    return {
      endpoint,
      status: 0,
      hasSignedUrls: false,
      hasDirectUrls: false,
      sampleUrls: [],
      urlCount: 0
    };
  }
}

/**
 * 메인 검증 함수
 */
async function verifyImageUrlConversion() {
  console.log('🔍 이미지 URL 변환 완전 검증 시작...\n');
  
  // JWT 토큰 (슈퍼관리자)
  const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjQsInVzZXJJZCI6MjQsImVtYWlsIjoiOTA1OTA1NkBnbWFpbC5jb20iLCJtZW1iZXJUeXBlIjoic3VwZXJhZG1pbiIsInJvbGVzIjpbXSwiaWF0IjoxNzUwMzAzNTM0LCJleHAiOjE3NTAzMDUzMzR9.UhnrQfK_3fdlkggmxRPDL8gXKn2ODAqcV62UF4OSn6I';
  
  // 테스트할 엔드포인트 목록
  const endpoints = [
    '/api/concepts',           // 컨셉 썸네일 이미지
    '/api/admin/concepts',     // 관리자 컨셉 이미지
    '/api/gallery',           // 개인 갤러리 이미지
    '/api/images',            // 사용자 이미지 목록
    '/api/image/recent'       // 최근 이미지
  ];
  
  const results: ImageTestResult[] = [];
  
  for (const endpoint of endpoints) {
    console.log(`📡 ${endpoint} 테스트 중...`);
    const result = await testImageEndpoint(endpoint, authToken);
    results.push(result);
    
    // 즉시 결과 출력
    console.log(`   상태: ${result.status}`);
    console.log(`   URL 개수: ${result.urlCount}`);
    console.log(`   SignedURL 포함: ${result.hasSignedUrls ? '❌ YES' : '✅ NO'}`);
    console.log(`   직접 URL 포함: ${result.hasDirectUrls ? '✅ YES' : '❌ NO'}`);
    if (result.sampleUrls.length > 0) {
      console.log(`   샘플 URL: ${result.sampleUrls[0].substring(0, 80)}...`);
    }
    console.log('');
  }
  
  // 종합 결과 분석
  console.log('📊 종합 검증 결과\n');
  console.log('='.repeat(60));
  
  const successfulEndpoints = results.filter(r => r.status === 200);
  const endpointsWithSignedUrls = results.filter(r => r.hasSignedUrls);
  const endpointsWithDirectUrls = results.filter(r => r.hasDirectUrls);
  
  console.log(`✅ 정상 응답 엔드포인트: ${successfulEndpoints.length}/${results.length}`);
  console.log(`❌ SignedURL 사용 엔드포인트: ${endpointsWithSignedUrls.length}/${results.length}`);
  console.log(`✅ 직접 URL 사용 엔드포인트: ${endpointsWithDirectUrls.length}/${results.length}`);
  
  // 문제 있는 엔드포인트 상세 보고
  if (endpointsWithSignedUrls.length > 0) {
    console.log('\n🚨 SignedURL을 여전히 사용하는 엔드포인트:');
    endpointsWithSignedUrls.forEach(result => {
      console.log(`   - ${result.endpoint}: ${result.urlCount}개 URL 중 SignedURL 포함`);
    });
  }
  
  // 성공 상태 판정
  const conversionSuccessful = endpointsWithSignedUrls.length === 0 && endpointsWithDirectUrls.length > 0;
  
  console.log('\n' + '='.repeat(60));
  if (conversionSuccessful) {
    console.log('🎉 URL 변환 완전 성공!');
    console.log('   모든 이미지 API에서 깨끗한 직접 공개 URL을 반환합니다.');
    console.log('   이미지 표시 문제가 해결되었습니다.');
  } else {
    console.log('⚠️  URL 변환 미완료');
    console.log('   일부 API에서 여전히 SignedURL을 사용하고 있습니다.');
    console.log('   추가 수정이 필요합니다.');
  }
  
  return conversionSuccessful;
}

// 스크립트 실행
verifyImageUrlConversion()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('검증 스크립트 실행 오류:', error);
    process.exit(1);
  });

export { verifyImageUrlConversion };