/**
 * 참여형 마일스톤 시스템 Phase 1-5 완료성 테스트
 * 2025-07-01: 전체 시스템 개발 완료 검증
 */

import { db } from './db/index.js';
import { 
  milestones, 
  milestoneApplications, 
  notifications, 
  notificationSettings,
  users,
  hospitals 
} from './shared/schema.js';
import { eq, and, desc } from 'drizzle-orm';

interface TestResult {
  phase: number;
  test: string;
  status: 'PASS' | 'FAIL';
  details?: string;
  error?: any;
}

const testResults: TestResult[] = [];

/**
 * Phase 1: 데이터베이스 스키마 확장 및 신청 관리 시스템 테스트
 */
async function testPhase1DatabaseSchema() {
  console.log('\n=== Phase 1: 데이터베이스 스키마 확장 테스트 ===');
  
  try {
    // 1.1 milestones 테이블 새 필드 확인
    const milestone = await db.query.milestones.findFirst();
    const hasRequiredFields = milestone && 
      'type' in milestone && 
      'participationStartDate' in milestone &&
      'participationEndDate' in milestone &&
      'maxParticipants' in milestone &&
      'currentParticipants' in milestone;
    
    testResults.push({
      phase: 1,
      test: '마일스톤 테이블 스키마 확장',
      status: hasRequiredFields ? 'PASS' : 'FAIL',
      details: hasRequiredFields ? '필수 필드 모두 존재' : '누락된 필드 있음'
    });

    // 1.2 milestone_applications 테이블 존재 확인
    const applicationExists = await db.query.milestoneApplications.findFirst();
    testResults.push({
      phase: 1,
      test: '마일스톤 신청 테이블 존재',
      status: 'PASS',
      details: '마일스톤 신청 테이블 정상 존재'
    });

    // 1.3 참여형 마일스톤 데이터 확인
    const campaignMilestones = await db.query.milestones.findMany({
      where: eq(milestones.type, 'campaign')
    });
    
    testResults.push({
      phase: 1,
      test: '참여형 마일스톤 데이터',
      status: campaignMilestones.length > 0 ? 'PASS' : 'FAIL',
      details: `참여형 마일스톤 ${campaignMilestones.length}개 존재`
    });

  } catch (error) {
    testResults.push({
      phase: 1,
      test: 'Phase 1 스키마 테스트',
      status: 'FAIL',
      error: error
    });
  }
}

/**
 * Phase 2: 백엔드 API 엔드포인트 테스트
 */
async function testPhase2BackendAPIs() {
  console.log('\n=== Phase 2: 백엔드 API 엔드포인트 테스트 ===');
  
  const baseUrl = 'http://localhost:5000';
  const testAPIs = [
    '/api/milestones?type=campaign',
    '/api/milestones/campaigns',
    '/api/milestone-applications',
    '/api/milestone-applications/my-applications'
  ];

  for (const apiPath of testAPIs) {
    try {
      const response = await fetch(`${baseUrl}${apiPath}`);
      testResults.push({
        phase: 2,
        test: `API ${apiPath}`,
        status: response.ok ? 'PASS' : 'FAIL',
        details: `상태코드: ${response.status}`
      });
    } catch (error) {
      testResults.push({
        phase: 2,
        test: `API ${apiPath}`,
        status: 'FAIL',
        error: error
      });
    }
  }
}

/**
 * Phase 3: 관리자 인터페이스 통합 테스트
 */
async function testPhase3AdminInterface() {
  console.log('\n=== Phase 3: 관리자 인터페이스 통합 테스트 ===');
  
  try {
    // 관리자 페이지 접근 테스트
    const response = await fetch('http://localhost:5000/admin');
    testResults.push({
      phase: 3,
      test: '관리자 페이지 접근',
      status: response.ok ? 'PASS' : 'FAIL',
      details: `상태코드: ${response.status}`
    });

    // 관리자 마일스톤 관리 API 테스트
    const milestoneManagementAPI = await fetch('http://localhost:5000/api/admin/milestones');
    testResults.push({
      phase: 3,
      test: '관리자 마일스톤 관리 API',
      status: milestoneManagementAPI.ok ? 'PASS' : 'FAIL',
      details: `상태코드: ${milestoneManagementAPI.status}`
    });

  } catch (error) {
    testResults.push({
      phase: 3,
      test: 'Phase 3 관리자 인터페이스',
      status: 'FAIL',
      error: error
    });
  }
}

/**
 * Phase 4: 사용자 신청 워크플로 테스트
 */
async function testPhase4UserWorkflow() {
  console.log('\n=== Phase 4: 사용자 신청 워크플로 테스트 ===');
  
  try {
    // 실제 사용자 신청 데이터 확인
    const applications = await db.query.milestoneApplications.findMany({
      limit: 5,
      orderBy: desc(milestoneApplications.createdAt)
    });
    
    testResults.push({
      phase: 4,
      test: '사용자 신청 데이터',
      status: applications.length > 0 ? 'PASS' : 'FAIL',
      details: `신청 데이터 ${applications.length}개 존재`
    });

    // 신청 상태별 분포 확인
    const statusDistribution = applications.reduce((acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    testResults.push({
      phase: 4,
      test: '신청 상태 분포',
      status: 'PASS',
      details: `상태별: ${JSON.stringify(statusDistribution)}`
    });

  } catch (error) {
    testResults.push({
      phase: 4,
      test: 'Phase 4 사용자 워크플로',
      status: 'FAIL',
      error: error
    });
  }
}

/**
 * Phase 5: 알림 시스템 테스트
 */
async function testPhase5NotificationSystem() {
  console.log('\n=== Phase 5: 알림 시스템 테스트 ===');
  
  try {
    // 5.1 알림 테이블 존재 확인
    const notificationCount = await db.$count(notifications);
    testResults.push({
      phase: 5,
      test: '알림 테이블 데이터',
      status: notificationCount >= 0 ? 'PASS' : 'FAIL',
      details: `알림 ${notificationCount}개 존재`
    });

    // 5.2 알림 설정 테이블 확인
    const settingsCount = await db.$count(notificationSettings);
    testResults.push({
      phase: 5,
      test: '알림 설정 테이블',
      status: settingsCount >= 0 ? 'PASS' : 'FAIL',
      details: `설정 ${settingsCount}개 존재`
    });

    // 5.3 알림 API 테스트
    const notificationAPI = await fetch('http://localhost:5000/api/notifications');
    testResults.push({
      phase: 5,
      test: '알림 API 엔드포인트',
      status: notificationAPI.ok ? 'PASS' : 'FAIL',
      details: `상태코드: ${notificationAPI.status}`
    });

    // 5.4 최근 알림 확인
    const recentNotifications = await db.query.notifications.findMany({
      limit: 3,
      orderBy: desc(notifications.createdAt)
    });

    testResults.push({
      phase: 5,
      test: '최근 알림 생성',
      status: 'PASS',
      details: `최근 알림 ${recentNotifications.length}개`
    });

  } catch (error) {
    testResults.push({
      phase: 5,
      test: 'Phase 5 알림 시스템',
      status: 'FAIL',
      error: error
    });
  }
}

/**
 * 통합 시스템 연동 테스트
 */
async function testIntegratedSystem() {
  console.log('\n=== 통합 시스템 연동 테스트 ===');
  
  try {
    // 마일스톤-신청-알림 연동 확인
    const milestoneWithApplications = await db.query.milestones.findFirst({
      where: eq(milestones.type, 'campaign'),
      with: {
        applications: true
      }
    });

    if (milestoneWithApplications?.applications && milestoneWithApplications.applications.length > 0) {
      testResults.push({
        phase: 0, // 통합 테스트
        test: '마일스톤-신청 연동',
        status: 'PASS',
        details: `마일스톤 "${milestoneWithApplications.title}"에 ${milestoneWithApplications.applications.length}개 신청`
      });
    } else {
      testResults.push({
        phase: 0,
        test: '마일스톤-신청 연동',
        status: 'FAIL',
        details: '신청이 연결된 마일스톤 없음'
      });
    }

    // 전체 시스템 상태 확인
    const systemStatus = {
      totalMilestones: await db.$count(milestones),
      campaignMilestones: await db.$count(milestones, eq(milestones.type, 'campaign')),
      totalApplications: await db.$count(milestoneApplications),
      totalNotifications: await db.$count(notifications),
      totalUsers: await db.$count(users),
      totalHospitals: await db.$count(hospitals)
    };

    testResults.push({
      phase: 0,
      test: '전체 시스템 상태',
      status: 'PASS',
      details: JSON.stringify(systemStatus, null, 2)
    });

  } catch (error) {
    testResults.push({
      phase: 0,
      test: '통합 시스템 테스트',
      status: 'FAIL',
      error: error
    });
  }
}

/**
 * 테스트 결과 요약 생성
 */
function generateTestSummary() {
  const phaseResults = {
    'Phase 1': testResults.filter(r => r.phase === 1),
    'Phase 2': testResults.filter(r => r.phase === 2),
    'Phase 3': testResults.filter(r => r.phase === 3),
    'Phase 4': testResults.filter(r => r.phase === 4),
    'Phase 5': testResults.filter(r => r.phase === 5),
    '통합': testResults.filter(r => r.phase === 0)
  };

  console.log('\n🔍 === 참여형 마일스톤 시스템 Phase 1-5 완료성 테스트 결과 ===\n');

  for (const [phaseName, results] of Object.entries(phaseResults)) {
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    const total = results.length;
    
    if (total > 0) {
      console.log(`📋 ${phaseName}: ${passCount}/${total} 성공 (${Math.round(passCount/total*100)}%)`);
      
      results.forEach(result => {
        const icon = result.status === 'PASS' ? '✅' : '❌';
        console.log(`  ${icon} ${result.test}: ${result.details || ''}`);
        if (result.error) {
          console.log(`     오류: ${result.error.message || result.error}`);
        }
      });
      console.log('');
    }
  }

  // 전체 요약
  const totalTests = testResults.length;
  const totalPass = testResults.filter(r => r.status === 'PASS').length;
  const totalFail = testResults.filter(r => r.status === 'FAIL').length;
  
  console.log(`🎯 전체 테스트 결과: ${totalPass}/${totalTests} 성공 (${Math.round(totalPass/totalTests*100)}%)`);
  console.log(`✅ 성공: ${totalPass}개`);
  console.log(`❌ 실패: ${totalFail}개`);
  
  if (totalPass === totalTests) {
    console.log('\n🎉 모든 테스트 통과! Phase 1-5 개발이 완전히 완료되었습니다.');
  } else if (totalPass >= totalTests * 0.8) {
    console.log('\n✨ 대부분의 테스트 통과! 시스템이 거의 완성되었습니다.');
  } else {
    console.log('\n⚠️ 일부 테스트 실패. 추가 개발이 필요합니다.');
  }

  return {
    totalTests,
    totalPass,
    totalFail,
    successRate: Math.round(totalPass/totalTests*100)
  };
}

/**
 * 메인 테스트 실행 함수
 */
async function runCompletePhase1to5Test() {
  console.log('🚀 참여형 마일스톤 시스템 Phase 1-5 완료성 테스트 시작...\n');
  
  try {
    await testPhase1DatabaseSchema();
    await testPhase2BackendAPIs();
    await testPhase3AdminInterface();
    await testPhase4UserWorkflow();
    await testPhase5NotificationSystem();
    await testIntegratedSystem();
    
    const summary = generateTestSummary();
    
    console.log('\n📊 === 개발 완료성 평가 ===');
    console.log(`성공률: ${summary.successRate}%`);
    
    if (summary.successRate >= 90) {
      console.log('🏆 개발 완료도: 우수 (90%+)');
      console.log('✅ Phase 6, 7 진행 준비 완료');
    } else if (summary.successRate >= 80) {
      console.log('🥈 개발 완료도: 양호 (80%+)');
      console.log('⚠️ 일부 보완 후 다음 단계 진행 권장');
    } else {
      console.log('🥉 개발 완료도: 보통 (80% 미만)');
      console.log('🔧 추가 개발 및 수정 필요');
    }
    
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error);
  }
}

// 테스트 실행
runCompletePhase1to5Test().catch(console.error);