/**
 * 브라우저 환경에서 권한 시스템 실제 테스트
 * 새로 추가된 /api/test-permissions 엔드포인트 사용
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

async function testBrowserPermissionSystem(): Promise<void> {
  console.log('\n=== 브라우저 권한 시스템 실제 테스트 ===\n');

  // 테스트 케이스 1: 관리자 계정으로 권한 테스트 (성공해야 함)
  try {
    console.log('1. 관리자 계정 (superadmin) 권한 테스트');
    
    // 실제 브라우저에서 사용되는 관리자 토큰
    const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjQsInVzZXJJZCI6MjQsImVtYWlsIjoiOTA1OTA1NkBnbWFpbC5jb20iLCJtZW1iZXJUeXBlIjoic3VwZXJhZG1pbiIsInJvbGVzIjpbXSwiaWF0IjoxNzUwNjQ2MDAxLCJleHAiOjE3NTA2Njc2MDF9.CWpjalpp-JlJTBZvY4tAChCiPqM_t53gLzMHfMfPZ7Y';

    const adminResponse = await axios.post(`${BASE_URL}/api/test-permissions`, {}, {
      headers: {
        'Cookie': `auth_token=${adminToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000,
      validateStatus: () => true
    });

    console.log(`관리자 테스트 결과: ${adminResponse.status}`);
    console.log(`응답:`, adminResponse.data);
    
    if (adminResponse.status === 200) {
      console.log('✅ 관리자 권한 테스트 성공');
    } else {
      console.log('❌ 관리자 권한 테스트 실패');
      console.log('에러:', adminResponse.data?.error || adminResponse.data?.message);
    }

  } catch (error: any) {
    console.log('❌ 관리자 테스트 오류:', error.message);
    if (error.response?.data) {
      console.log('서버 응답:', error.response.data);
    }
  }

  // 테스트 케이스 2: curl을 사용한 직접 테스트
  console.log('\n2. curl 명령으로 직접 테스트');
  console.log('다음 명령을 실행하여 수동으로 테스트할 수 있습니다:');
  console.log('');
  console.log('관리자 테스트:');
  console.log(`curl -X POST "${BASE_URL}/api/test-permissions" \\`);
  console.log(`  -H "Cookie: auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjQsInVzZXJJZCI6MjQsImVtYWlsIjoiOTA1OTA1NkBnbWFpbC5jb20iLCJtZW1iZXJUeXBlIjoic3VwZXJhZG1pbiIsInJvbGVzIjpbXSwiaWF0IjoxNzUwNjQ2MDAxLCJleHAiOjE3NTA2Njc2MDF9.CWpjalpp-JlJTBZvY4tAChCiPqM_t53gLzMHfMfPZ7Y" \\`);
  console.log(`  -H "Content-Type: application/json"`);
  console.log('');
  console.log('FREE 회원 테스트 (차단되어야 함):');
  console.log(`curl -X POST "${BASE_URL}/api/test-permissions" \\`);
  console.log(`  -H "Content-Type: application/json"`);
  console.log('');

  // 테스트 케이스 3: 실제 브라우저에서 권한 확인을 위한 안내
  console.log('\n3. 실제 브라우저 테스트 안내');
  console.log('브라우저 개발자 도구에서 다음을 실행하세요:');
  console.log('');
  console.log('fetch("/api/test-permissions", {');
  console.log('  method: "POST",');
  console.log('  headers: { "Content-Type": "application/json" },');
  console.log('  body: JSON.stringify({})');
  console.log('}).then(r => r.json()).then(console.log);');
  console.log('');

  console.log('\n4. 권한 시스템 검증 포인트');
  console.log('✓ FREE 회원: 403 Forbidden (권한 부족)');
  console.log('✓ PRO 회원: 200 OK (접근 허용)');
  console.log('✓ MEMBERSHIP + 활성화 병원: 200 OK (접근 허용)');
  console.log('✓ MEMBERSHIP + 비활성화 병원: 403 Forbidden (병원 비활성화)');
  console.log('✓ 관리자: 200 OK (모든 권한)');
  console.log('');

  console.log('\n5. 포유문산부인과 비활성화 영향 확인');
  console.log('포유문산부인과 소속 테스트200 회원(membership)은:');
  console.log('- 병원이 비활성화되어 있어 403 Forbidden이 나와야 합니다');
  console.log('- 이는 requireActiveHospital() 미들웨어가 정상 작동함을 의미합니다');
  console.log('');

  console.log('다른 활성화된 병원 소속 membership 회원은:');
  console.log('- 정상적으로 200 OK가 나와야 합니다');
  console.log('- 이는 병원별 활성화 상태가 올바르게 체크됨을 의미합니다');
}

// 실행
testBrowserPermissionSystem().catch(console.error);