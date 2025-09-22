/**
 * 올바른 API 테스트 실행 스크립트
 * 
 * 이 스크립트는 병원 회원 등급 자동화 시스템을 올바른 방법으로 테스트합니다.
 * - API 호출을 통한 테스트 (DB 직접 수정 금지)
 * - 자동화 트리거 정상 작동 확인
 * - 실제 회원 등급 변경 검증
 */

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
}

interface User {
  id: number;
  username: string;
  memberType: string;
  hospitalId: number | null;
  email: string;
}

interface Hospital {
  id: number;
  name: string;
  isActive: boolean;
}

async function makeApiRequest(url: string, options: RequestInit = {}): Promise<any> {
  const baseUrl = 'http://localhost:5000';
  
  const response = await fetch(`${baseUrl}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`API 오류: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function runHospitalMembershipAutomationTest(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  let adminToken = '';
  let testHospitalId = 0;
  let membersBefore: User[] = [];
  let membersAfter: User[] = [];

  try {
    // 1단계: 관리자 로그인
    console.log('\n🔐 1단계: 관리자 로그인');
    try {
      const loginResponse = await makeApiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: 'admin',  // 실제 관리자 계정으로 변경 필요
          password: 'password'  // 실제 비밀번호로 변경 필요
        })
      });

      adminToken = loginResponse.token;
      results.push({
        step: '관리자 로그인',
        success: true,
        message: '관리자 로그인 성공',
        data: { username: loginResponse.user?.username }
      });
    } catch (error) {
      results.push({
        step: '관리자 로그인',
        success: false,
        message: `로그인 실패: ${error.message}`
      });
      return results;
    }

    // 2단계: 테스트 대상 병원 선택
    console.log('\n🏥 2단계: 테스트 대상 병원 선택');
    try {
      const hospitalsResponse = await makeApiRequest('/api/admin/hospitals', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });

      const activeHospitals = hospitalsResponse.filter((h: Hospital) => h.isActive);
      if (activeHospitals.length === 0) {
        throw new Error('활성화된 병원이 없습니다');
      }

      testHospitalId = activeHospitals[0].id;
      results.push({
        step: '병원 선택',
        success: true,
        message: `테스트 대상 병원: ${activeHospitals[0].name} (ID: ${testHospitalId})`,
        data: { hospitalId: testHospitalId, hospitalName: activeHospitals[0].name }
      });
    } catch (error) {
      results.push({
        step: '병원 선택',
        success: false,
        message: `병원 조회 실패: ${error.message}`
      });
      return results;
    }

    // 3단계: 병원 소속 회원 확인
    console.log('\n👥 3단계: 병원 소속 회원 확인');
    try {
      const usersResponse = await makeApiRequest(`/api/admin/users?hospitalId=${testHospitalId}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });

      membersBefore = usersResponse.users || usersResponse;
      const membershipUsers = membersBefore.filter((u: User) => u.memberType === 'membership');
      
      results.push({
        step: '회원 현황 확인',
        success: true,
        message: `병원 소속 회원: ${membersBefore.length}명, membership 회원: ${membershipUsers.length}명`,
        data: { 
          totalMembers: membersBefore.length,
          membershipMembers: membershipUsers.length,
          memberTypes: membersBefore.reduce((acc, user) => {
            acc[user.memberType] = (acc[user.memberType] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }
      });

      if (membershipUsers.length === 0) {
        results.push({
          step: '회원 검증',
          success: false,
          message: 'membership 등급 회원이 없어 자동화 테스트를 진행할 수 없습니다'
        });
        return results;
      }
    } catch (error) {
      results.push({
        step: '회원 현황 확인',
        success: false,
        message: `회원 조회 실패: ${error.message}`
      });
      return results;
    }

    // 4단계: 병원 비활성화 (자동화 트리거)
    console.log('\n🔽 4단계: 병원 비활성화 - 자동화 트리거 실행');
    try {
      const deactivateResponse = await makeApiRequest(`/api/admin/hospitals/${testHospitalId}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ isActive: false })
      });

      results.push({
        step: '병원 비활성화',
        success: true,
        message: '병원 비활성화 API 호출 성공',
        data: deactivateResponse
      });
    } catch (error) {
      results.push({
        step: '병원 비활성화',
        success: false,
        message: `병원 비활성화 실패: ${error.message}`
      });
      return results;
    }

    // 5단계: 자동화 결과 확인 (회원 등급 변경)
    console.log('\n✅ 5단계: 자동화 결과 확인');
    try {
      // 잠깐 대기 (자동화 처리 시간)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const usersAfterResponse = await makeApiRequest(`/api/admin/users?hospitalId=${testHospitalId}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });

      membersAfter = usersAfterResponse.users || usersAfterResponse;
      
      const membersBecameFree = membersAfter.filter((u: User) => {
        const beforeUser = membersBefore.find(b => b.id === u.id);
        return beforeUser?.memberType === 'membership' && u.memberType === 'free';
      });

      const automationWorked = membersBecameFree.length > 0;
      
      results.push({
        step: '자동화 결과 확인',
        success: automationWorked,
        message: automationWorked 
          ? `자동화 성공: ${membersBecameFree.length}명이 membership → free로 변경됨`
          : '자동화 실패: 회원 등급 변경이 감지되지 않음',
        data: {
          changedMembers: membersBecameFree.map(u => ({
            id: u.id,
            username: u.username,
            before: 'membership',
            after: 'free'
          }))
        }
      });
    } catch (error) {
      results.push({
        step: '자동화 결과 확인',
        success: false,
        message: `결과 확인 실패: ${error.message}`
      });
    }

    // 6단계: 병원 재활성화 (복구 테스트)
    console.log('\n🔼 6단계: 병원 재활성화 - 복구 테스트');
    try {
      const reactivateResponse = await makeApiRequest(`/api/admin/hospitals/${testHospitalId}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ isActive: true })
      });

      results.push({
        step: '병원 재활성화',
        success: true,
        message: '병원 재활성화 API 호출 성공',
        data: reactivateResponse
      });

      // 복구 결과 확인
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const usersAfterReactivateResponse = await makeApiRequest(`/api/admin/users?hospitalId=${testHospitalId}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });

      const usersAfterReactivate = usersAfterReactivateResponse.users || usersAfterReactivateResponse;
      const membersBecamePro = usersAfterReactivate.filter((u: User) => {
        return membersAfter.find(b => b.id === u.id && b.memberType === 'free') && u.memberType === 'pro';
      });

      const recoveryWorked = membersBecamePro.length > 0;
      
      results.push({
        step: '복구 자동화 확인',
        success: recoveryWorked,
        message: recoveryWorked 
          ? `복구 자동화 성공: ${membersBecamePro.length}명이 free → pro로 변경됨`
          : '복구 자동화 실패: 회원 등급 복구가 감지되지 않음',
        data: {
          changedMembers: membersBecamePro.map(u => ({
            id: u.id,
            username: u.username,
            before: 'free',
            after: 'pro'
          }))
        }
      });
    } catch (error) {
      results.push({
        step: '병원 재활성화',
        success: false,
        message: `재활성화 실패: ${error.message}`
      });
    }

  } catch (globalError) {
    results.push({
      step: '전체 테스트',
      success: false,
      message: `전체 테스트 실패: ${globalError.message}`
    });
  }

  return results;
}

// 테스트 결과 출력
function printTestResults(results: TestResult[]) {
  console.log('\n📊 === 병원 회원 등급 자동화 테스트 결과 ===\n');
  
  let successCount = 0;
  let failCount = 0;

  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌';
    const status = result.success ? 'SUCCESS' : 'FAIL';
    
    console.log(`${index + 1}. ${icon} [${status}] ${result.step}`);
    console.log(`   ${result.message}`);
    
    if (result.data) {
      console.log(`   데이터:`, JSON.stringify(result.data, null, 2));
    }
    console.log('');

    if (result.success) successCount++;
    else failCount++;
  });

  console.log(`📈 최종 결과: 성공 ${successCount}개, 실패 ${failCount}개`);
  
  const overallSuccess = failCount === 0;
  console.log(`🎯 전체 테스트: ${overallSuccess ? '✅ 성공' : '❌ 실패'}`);

  if (overallSuccess) {
    console.log('\n🎉 병원 회원 등급 자동화 시스템이 올바르게 작동합니다!');
  } else {
    console.log('\n⚠️  자동화 시스템에 문제가 있습니다. 로그를 확인하세요.');
  }
}

// 메인 실행 함수
async function main() {
  console.log('🚀 병원 회원 등급 자동화 시스템 테스트 시작');
  console.log('================================\n');
  
  try {
    const results = await runHospitalMembershipAutomationTest();
    printTestResults(results);
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error);
  }
}

// 실행
if (require.main === module) {
  main().catch(console.error);
}

export {
  runHospitalMembershipAutomationTest,
  printTestResults,
  makeApiRequest
};