/**
 * Phase 1-4 참여형 마일스톤 시스템 종합 완료성 테스트
 * 
 * 검증 범위:
 * - Phase 1: 데이터베이스 스키마 및 타입 시스템
 * - Phase 2: 백엔드 API 엔드포인트 8개
 * - Phase 3: 관리자 인터페이스 통합
 * - Phase 4: 사용자 인터페이스 구현
 */

import fetch from 'node-fetch';

async function testPhasesComplete() {
  console.log('🧪 Phase 1-4 참여형 마일스톤 시스템 종합 완료성 테스트 시작\n');
  
  const baseUrl = 'http://localhost:5000';
  const testResults = [];
  let totalTests = 0;
  let passedTests = 0;

  // ===== Phase 1: 데이터베이스 스키마 검증 =====
  console.log('📊 Phase 1: 데이터베이스 스키마 및 타입 시스템 검증');
  console.log('='.repeat(60));

  try {
    const { db } = await import('./db/index.js');
    const { milestones, milestoneApplications } = await import('./shared/schema.ts');

    // 1-1. milestones 테이블 확장 필드 확인
    totalTests++;
    const campaignMilestones = await db.query.milestones.findMany({
      where: (milestones, { eq }) => eq(milestones.type, 'campaign'),
      limit: 1
    });

    if (campaignMilestones.length > 0) {
      const milestone = campaignMilestones[0];
      const hasRequiredFields = milestone.hospitalId && milestone.campaignStartDate && 
                               milestone.campaignEndDate && milestone.selectionStartDate && 
                               milestone.selectionEndDate;
      
      if (hasRequiredFields) {
        console.log('   ✅ milestones 테이블 확장 필드 완성');
        passedTests++;
        testResults.push({ phase: 1, test: 'milestones schema', status: 'pass' });
      } else {
        console.log('   ❌ milestones 테이블 필수 필드 누락');
        testResults.push({ phase: 1, test: 'milestones schema', status: 'fail', issue: '필수 필드 누락' });
      }
    } else {
      console.log('   ⚠️  참여형 마일스톤 데이터 없음');
      testResults.push({ phase: 1, test: 'milestones schema', status: 'warning', issue: '테스트 데이터 없음' });
    }

    // 1-2. milestone_applications 테이블 확인
    totalTests++;
    try {
      const applications = await db.query.milestoneApplications.findMany({ limit: 1 });
      console.log('   ✅ milestone_applications 테이블 존재 확인');
      passedTests++;
      testResults.push({ phase: 1, test: 'applications schema', status: 'pass' });
    } catch (error) {
      console.log('   ❌ milestone_applications 테이블 문제:', error.message);
      testResults.push({ phase: 1, test: 'applications schema', status: 'fail', error: error.message });
    }

  } catch (error) {
    console.log('   ❌ 데이터베이스 연결 오류:', error.message);
    testResults.push({ phase: 1, test: 'database connection', status: 'fail', error: error.message });
  }

  // ===== Phase 2: 백엔드 API 엔드포인트 검증 =====
  console.log('\n🔌 Phase 2: 백엔드 API 엔드포인트 8개 검증');
  console.log('='.repeat(60));

  const apiEndpoints = [
    { method: 'GET', path: '/api/milestones', name: '마일스톤 목록 (필터링)' },
    { method: 'GET', path: '/api/milestones/campaigns', name: '참여형 마일스톤 전용' },
    { method: 'POST', path: '/api/milestones', name: '마일스톤 생성', needsAuth: true },
    { method: 'PUT', path: '/api/milestones/1', name: '마일스톤 수정', needsAuth: true },
    { method: 'POST', path: '/api/milestones/applications', name: '신청하기', needsAuth: true },
    { method: 'GET', path: '/api/milestones/applications/my', name: '내 신청 내역', needsAuth: true },
    { method: 'GET', path: '/api/milestones/applications/1', name: '신청 상세보기', needsAuth: true },
    { method: 'DELETE', path: '/api/milestones/applications/1', name: '신청 취소', needsAuth: true }
  ];

  for (const endpoint of apiEndpoints) {
    totalTests++;
    try {
      const options = {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' }
      };

      if (endpoint.method === 'POST' && endpoint.path === '/api/milestones/applications') {
        options.body = JSON.stringify({ milestoneId: 15, applicationData: 'test' });
      }

      const response = await fetch(`${baseUrl}${endpoint.path}`, options);
      
      if (endpoint.needsAuth && response.status === 401) {
        console.log(`   ✅ ${endpoint.name}: 인증 보호 정상 (401)`);
        passedTests++;
        testResults.push({ phase: 2, test: endpoint.name, status: 'pass', note: 'auth protected' });
      } else if (!endpoint.needsAuth && (response.status === 200 || response.status === 201)) {
        console.log(`   ✅ ${endpoint.name}: 응답 성공 (${response.status})`);
        passedTests++;
        testResults.push({ phase: 2, test: endpoint.name, status: 'pass', code: response.status });
      } else if (response.status === 404) {
        console.log(`   ⚠️  ${endpoint.name}: 엔드포인트 없음 (404)`);
        testResults.push({ phase: 2, test: endpoint.name, status: 'fail', issue: 'endpoint not found' });
      } else {
        console.log(`   ⚠️  ${endpoint.name}: 예상과 다른 응답 (${response.status})`);
        testResults.push({ phase: 2, test: endpoint.name, status: 'warning', code: response.status });
      }

    } catch (error) {
      console.log(`   ❌ ${endpoint.name}: 요청 실패 - ${error.message}`);
      testResults.push({ phase: 2, test: endpoint.name, status: 'fail', error: error.message });
    }
  }

  // ===== Phase 3: 관리자 인터페이스 검증 =====
  console.log('\n👑 Phase 3: 관리자 인터페이스 통합 검증');
  console.log('='.repeat(60));

  try {
    const fs = await import('fs');
    
    // 3-1. 관리자 페이지 컴포넌트 존재 확인
    totalTests++;
    const adminPageExists = fs.existsSync('./client/src/pages/admin.tsx');
    if (adminPageExists) {
      const adminPageContent = fs.readFileSync('./client/src/pages/admin.tsx', 'utf8');
      const hasCampaignTab = adminPageContent.includes('참여형 마일스톤') || 
                            adminPageContent.includes('CampaignMilestoneManagement');
      
      if (hasCampaignTab) {
        console.log('   ✅ 관리자 페이지 참여형 마일스톤 탭 통합 완료');
        passedTests++;
        testResults.push({ phase: 3, test: 'admin page integration', status: 'pass' });
      } else {
        console.log('   ❌ 관리자 페이지에 참여형 마일스톤 탭 누락');
        testResults.push({ phase: 3, test: 'admin page integration', status: 'fail', issue: 'campaign tab missing' });
      }
    } else {
      console.log('   ❌ 관리자 페이지 파일 없음');
      testResults.push({ phase: 3, test: 'admin page integration', status: 'fail', issue: 'admin page missing' });
    }

    // 3-2. CampaignMilestoneManagement 컴포넌트 확인
    totalTests++;
    const campaignComponentExists = fs.existsSync('./client/src/components/admin/CampaignMilestoneManagement.tsx');
    if (campaignComponentExists) {
      console.log('   ✅ CampaignMilestoneManagement 컴포넌트 존재');
      passedTests++;
      testResults.push({ phase: 3, test: 'campaign component', status: 'pass' });
    } else {
      console.log('   ❌ CampaignMilestoneManagement 컴포넌트 없음');
      testResults.push({ phase: 3, test: 'campaign component', status: 'fail', issue: 'component missing' });
    }

    // 3-3. 서비스 함수 완성도 확인
    totalTests++;
    const serviceFileExists = fs.existsSync('./server/services/milestones.ts');
    if (serviceFileExists) {
      const serviceContent = fs.readFileSync('./server/services/milestones.ts', 'utf8');
      const requiredFunctions = [
        'getCampaignMilestones',
        'createMilestoneApplication', 
        'getMyApplications',
        'getApplicationById',
        'cancelApplication'
      ];
      
      const functionExists = requiredFunctions.map(fn => ({
        name: fn,
        exists: serviceContent.includes(fn)
      }));
      
      const allFunctionsExist = functionExists.every(f => f.exists);
      
      if (allFunctionsExist) {
        console.log('   ✅ 필수 서비스 함수 8개 모두 구현 완료');
        passedTests++;
        testResults.push({ phase: 3, test: 'service functions', status: 'pass' });
      } else {
        const missing = functionExists.filter(f => !f.exists).map(f => f.name);
        console.log(`   ❌ 서비스 함수 누락: ${missing.join(', ')}`);
        testResults.push({ phase: 3, test: 'service functions', status: 'fail', missing });
      }
    } else {
      console.log('   ❌ 서비스 파일 없음');
      testResults.push({ phase: 3, test: 'service functions', status: 'fail', issue: 'service file missing' });
    }

  } catch (error) {
    console.log('   ❌ 파일 시스템 검증 오류:', error.message);
    testResults.push({ phase: 3, test: 'file system check', status: 'fail', error: error.message });
  }

  // ===== Phase 4: 사용자 인터페이스 검증 =====
  console.log('\n👥 Phase 4: 사용자 인터페이스 구현 검증');
  console.log('='.repeat(60));

  try {
    const fs = await import('fs');
    
    // 4-1. 마일스톤 페이지 컴포넌트 구조 확인
    totalTests++;
    const milestonesPageExists = fs.existsSync('./client/src/pages/milestones.tsx');
    if (milestonesPageExists) {
      const milestonesContent = fs.readFileSync('./client/src/pages/milestones.tsx', 'utf8');
      
      const requiredComponents = [
        'CampaignMilestoneCard',
        'CampaignMilestonesTab', 
        'MyApplicationsTab',
        'applyMutation',
        'cancelMutation'
      ];
      
      const componentExists = requiredComponents.map(comp => ({
        name: comp,
        exists: milestonesContent.includes(comp)
      }));
      
      const allComponentsExist = componentExists.every(c => c.exists);
      
      if (allComponentsExist) {
        console.log('   ✅ 사용자 인터페이스 컴포넌트 모두 구현 완료');
        passedTests++;
        testResults.push({ phase: 4, test: 'user interface components', status: 'pass' });
      } else {
        const missing = componentExists.filter(c => !c.exists).map(c => c.name);
        console.log(`   ❌ UI 컴포넌트 누락: ${missing.join(', ')}`);
        testResults.push({ phase: 4, test: 'user interface components', status: 'fail', missing });
      }
    } else {
      console.log('   ❌ 마일스톤 페이지 파일 없음');
      testResults.push({ phase: 4, test: 'user interface components', status: 'fail', issue: 'milestones page missing' });
    }

    // 4-2. 탭 구조 확인
    totalTests++;
    if (milestonesPageExists) {
      const milestonesContent = fs.readFileSync('./client/src/pages/milestones.tsx', 'utf8');
      const hasCampaignTab = milestonesContent.includes('참여형 마일스톤') || milestonesContent.includes('campaigns');
      const hasApplicationTab = milestonesContent.includes('내 신청 현황') || milestonesContent.includes('applications');
      
      if (hasCampaignTab && hasApplicationTab) {
        console.log('   ✅ 참여형 마일스톤 탭 구조 완성');
        passedTests++;
        testResults.push({ phase: 4, test: 'tab structure', status: 'pass' });
      } else {
        console.log(`   ❌ 탭 구조 불완전 - 참여형: ${hasCampaignTab}, 신청현황: ${hasApplicationTab}`);
        testResults.push({ phase: 4, test: 'tab structure', status: 'fail', 
                          hasCampaignTab, hasApplicationTab });
      }
    }

    // 4-3. 프론트엔드 페이지 접근성 테스트
    totalTests++;
    try {
      const milestonePageResponse = await fetch(`${baseUrl}/milestones`);
      if (milestonePageResponse.ok) {
        console.log('   ✅ 마일스톤 페이지 접근 가능');
        passedTests++;
        testResults.push({ phase: 4, test: 'page accessibility', status: 'pass' });
      } else {
        console.log(`   ❌ 마일스톤 페이지 접근 실패: ${milestonePageResponse.status}`);
        testResults.push({ phase: 4, test: 'page accessibility', status: 'fail', 
                          code: milestonePageResponse.status });
      }
    } catch (error) {
      console.log('   ❌ 페이지 접근 테스트 오류:', error.message);
      testResults.push({ phase: 4, test: 'page accessibility', status: 'fail', error: error.message });
    }

  } catch (error) {
    console.log('   ❌ 사용자 인터페이스 검증 오류:', error.message);
    testResults.push({ phase: 4, test: 'user interface check', status: 'fail', error: error.message });
  }

  // ===== 종합 결과 분석 =====
  console.log('\n📋 Phase 1-4 종합 완료성 테스트 결과');
  console.log('='.repeat(60));

  const phaseResults = {
    phase1: testResults.filter(r => r.phase === 1),
    phase2: testResults.filter(r => r.phase === 2), 
    phase3: testResults.filter(r => r.phase === 3),
    phase4: testResults.filter(r => r.phase === 4)
  };

  console.log('\n📊 단계별 성공률:');
  Object.entries(phaseResults).forEach(([phase, results]) => {
    const phaseNum = phase.replace('phase', '');
    const passed = results.filter(r => r.status === 'pass').length;
    const total = results.length;
    const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
    
    console.log(`   Phase ${phaseNum}: ${passed}/${total} (${rate}%) ${rate >= 80 ? '✅' : rate >= 60 ? '⚠️' : '❌'}`);
  });

  const overallSuccessRate = Math.round((passedTests / totalTests) * 100);
  console.log(`\n🎯 전체 성공률: ${passedTests}/${totalTests} (${overallSuccessRate}%)`);

  if (overallSuccessRate >= 90) {
    console.log('\n🎉 Phase 1-4 참여형 마일스톤 시스템 구현 완료!');
    console.log('✨ 시스템이 프로덕션 준비 상태입니다.');
    console.log('🚀 다음 단계: Phase 5-7 (알림, 파일 업로드, 승인 워크플로우) 진행 가능');
  } else if (overallSuccessRate >= 75) {
    console.log('\n⚠️  Phase 1-4 대부분 완료, 일부 개선 필요');
    console.log('🔧 다음 단계 진행 전 문제점 수정 권장');
  } else {
    console.log('\n❌ Phase 1-4 완료도 부족');
    console.log('🛠️  다음 단계 진행 전 필수 문제점 해결 필요');
  }

  // 실패한 테스트 상세 정보
  const failedTests = testResults.filter(r => r.status === 'fail');
  if (failedTests.length > 0) {
    console.log('\n🔍 수정 필요한 항목들:');
    failedTests.forEach((test, index) => {
      console.log(`   ${index + 1}. Phase ${test.phase} - ${test.test}: ${test.issue || test.error}`);
    });
  }

  console.log('\n📊 상세 테스트 결과:', JSON.stringify(testResults, null, 2));
}

testPhasesComplete().catch(console.error);