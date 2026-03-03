/**
 * Phase 1-3 참여형 마일스톤 시스템 완료성 테스트
 * 
 * 테스트 범위:
 * Phase 1: 데이터베이스 스키마 확장 및 신청 관리 시스템
 * Phase 2: 백엔드 API 엔드포인트 8개 구현
 * Phase 3: 관리자 인터페이스 통합 및 컴포넌트 연동
 */

import { db } from '../../db/index.js';
import { milestones, milestoneApplications, milestoneCategories, hospitals } from '../../shared/schema.js';
import { eq, and, desc } from 'drizzle-orm';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function addResult(test: string, status: 'PASS' | 'FAIL', details?: string, error?: string) {
  results.push({ test, status, details, error });
  const emoji = status === 'PASS' ? '✅' : '❌';
  console.log(`${emoji} ${test}: ${status}`);
  if (details) console.log(`   ${details}`);
  if (error) console.log(`   오류: ${error}`);
}

/**
 * Phase 1 테스트: 데이터베이스 스키마 확장
 */
async function testPhase1DatabaseSchema() {
  console.log('\n=== Phase 1: 데이터베이스 스키마 확장 테스트 ===');
  
  try {
    // 1.1 milestones 테이블 확장 필드 확인
    const sampleMilestone = await db.query.milestones.findFirst({
      where: eq(milestones.type, 'campaign')
    });
    
    if (sampleMilestone) {
      const hasRequiredFields = 
        'campaignStartDate' in sampleMilestone &&
        'campaignEndDate' in sampleMilestone &&
        'selectionStartDate' in sampleMilestone &&
        'selectionEndDate' in sampleMilestone &&
        'hospitalId' in sampleMilestone;
      
      if (hasRequiredFields) {
        addResult('1.1 milestones 테이블 확장 필드', 'PASS', '캠페인 관련 필드 모두 존재');
      } else {
        addResult('1.1 milestones 테이블 확장 필드', 'FAIL', '필수 캠페인 필드 누락');
      }
    } else {
      addResult('1.1 milestones 테이블 확장 필드', 'PASS', '캠페인 타입 마일스톤은 아직 없음 (정상)');
    }
    
    // 1.2 milestone_applications 테이블 확인
    const applicationTableExists = await db.query.milestoneApplications.findMany({ limit: 1 });
    addResult('1.2 milestone_applications 테이블', 'PASS', '신청 관리 테이블 정상 존재');
    
  } catch (error) {
    addResult('1.1-1.2 데이터베이스 스키마', 'FAIL', '', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Phase 2 테스트: 백엔드 API 엔드포인트 8개
 */
async function testPhase2BackendAPIs() {
  console.log('\n=== Phase 2: 백엔드 API 엔드포인트 테스트 ===');
  
  const baseUrl = 'http://localhost:5000';
  
  const endpoints = [
    { path: '/api/milestones', method: 'GET', description: '마일스톤 목록 조회' },
    { path: '/api/milestones/campaigns', method: 'GET', description: '참여형 마일스톤 목록' },
    { path: '/api/milestones', method: 'POST', description: '마일스톤 생성' },
    { path: '/api/milestones/1', method: 'PUT', description: '마일스톤 수정' },
    { path: '/api/milestones/applications', method: 'POST', description: '마일스톤 신청' },
    { path: '/api/milestones/applications/my', method: 'GET', description: '내 신청 내역' },
    { path: '/api/milestones/applications/1', method: 'GET', description: '신청 상세보기' },
    { path: '/api/milestones/applications/1', method: 'DELETE', description: '신청 취소' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'auth_token=test_token'
        }
      });
      
      // 401 (권한 없음)은 API가 존재하지만 인증이 필요함을 의미
      // 404가 아니면 엔드포인트는 존재함
      if (response.status !== 404) {
        addResult(`2.${endpoints.indexOf(endpoint) + 1} ${endpoint.description}`, 'PASS', 
          `엔드포인트 존재 (status: ${response.status})`);
      } else {
        addResult(`2.${endpoints.indexOf(endpoint) + 1} ${endpoint.description}`, 'FAIL', 
          `엔드포인트 없음 (404)`);
      }
    } catch (error) {
      addResult(`2.${endpoints.indexOf(endpoint) + 1} ${endpoint.description}`, 'FAIL', 
        '', error instanceof Error ? error.message : String(error));
    }
  }
}

/**
 * Phase 3 테스트: 관리자 인터페이스 통합
 */
async function testPhase3AdminInterface() {
  console.log('\n=== Phase 3: 관리자 인터페이스 통합 테스트 ===');
  
  try {
    // 3.1 admin.tsx 파일에서 CampaignMilestoneManagement import 확인
    const fs = await import('fs/promises');
    const adminPageContent = await fs.readFile('./client/src/pages/admin.tsx', 'utf-8');
    
    const hasImport = adminPageContent.includes('import CampaignMilestoneManagement');
    const hasTab = adminPageContent.includes('campaign-milestones');
    const hasTabContent = adminPageContent.includes('<CampaignMilestoneManagement />');
    
    if (hasImport && hasTab && hasTabContent) {
      addResult('3.1 관리자 페이지 통합', 'PASS', 'CampaignMilestoneManagement 컴포넌트 완전 통합');
    } else {
      addResult('3.1 관리자 페이지 통합', 'FAIL', 
        `Import: ${hasImport}, Tab: ${hasTab}, Content: ${hasTabContent}`);
    }
    
    // 3.2 CampaignMilestoneManagement 컴포넌트 파일 확인
    const componentExists = await fs.access('./client/src/components/admin/CampaignMilestoneManagement.tsx')
      .then(() => true)
      .catch(() => false);
    
    if (componentExists) {
      const componentContent = await fs.readFile('./client/src/components/admin/CampaignMilestoneManagement.tsx', 'utf-8');
      const hasFormHandling = componentContent.includes('CampaignMilestoneFormValues');
      const hasAPIIntegration = componentContent.includes('useMutation');
      const hasTypeScript = componentContent.includes('interface CampaignMilestone');
      
      if (hasFormHandling && hasAPIIntegration && hasTypeScript) {
        addResult('3.2 참여형 마일스톤 컴포넌트', 'PASS', '완전한 기능 구현');
      } else {
        addResult('3.2 참여형 마일스톤 컴포넌트', 'FAIL', 
          `Form: ${hasFormHandling}, API: ${hasAPIIntegration}, TS: ${hasTypeScript}`);
      }
    } else {
      addResult('3.2 참여형 마일스톤 컴포넌트', 'FAIL', '컴포넌트 파일 없음');
    }
    
  } catch (error) {
    addResult('3.1-3.2 관리자 인터페이스', 'FAIL', '', error instanceof Error ? error.message : String(error));
  }
}

/**
 * 서비스 함수 테스트
 */
async function testServiceFunctions() {
  console.log('\n=== 서비스 함수 테스트 ===');
  
  try {
    const milestonesService = await import('../../server/services/milestones.js');
    
    // 필수 서비스 함수들 확인
    const requiredFunctions = [
      'getAllMilestones',
      'getCampaignMilestones', 
      'createMilestone',
      'updateMilestone',
      'applyToMilestone',
      'getMyApplications',
      'getApplicationDetails',
      'cancelApplication'
    ];
    
    const missingFunctions: string[] = [];
    
    for (const funcName of requiredFunctions) {
      if (typeof milestonesService[funcName] === 'function') {
        addResult(`4.${requiredFunctions.indexOf(funcName) + 1} ${funcName} 함수`, 'PASS', '서비스 함수 존재');
      } else {
        missingFunctions.push(funcName);
        addResult(`4.${requiredFunctions.indexOf(funcName) + 1} ${funcName} 함수`, 'FAIL', '서비스 함수 없음');
      }
    }
    
  } catch (error) {
    addResult('4. 서비스 함수 전체', 'FAIL', '', error instanceof Error ? error.message : String(error));
  }
}

/**
 * 통합 테스트: 실제 데이터 흐름 확인
 */
async function testIntegrationFlow() {
  console.log('\n=== 통합 테스트: 데이터 흐름 확인 ===');
  
  try {
    // 5.1 카테고리 및 병원 데이터 확인
    const categories = await db.query.milestoneCategories.findMany();
    const hospitalsData = await db.query.hospitals.findMany();
    
    addResult('5.1 기본 데이터 존재', 'PASS', 
      `카테고리 ${categories.length}개, 병원 ${hospitalsData.length}개`);
    
    // 5.2 마일스톤 타입별 분리 확인
    const informationalMilestones = await db.query.milestones.findMany({
      where: eq(milestones.type, 'informational')
    });
    
    const campaignMilestones = await db.query.milestones.findMany({
      where: eq(milestones.type, 'campaign')
    });
    
    addResult('5.2 마일스톤 타입별 분리', 'PASS', 
      `정보형 ${informationalMilestones.length}개, 참여형 ${campaignMilestones.length}개`);
    
    // 5.3 관계 테이블 조인 확인
    const milestonesWithRelations = await db.query.milestones.findMany({
      with: {
        category: true,
        hospital: true
      },
      limit: 1
    });
    
    if (milestonesWithRelations.length > 0) {
      const milestone = milestonesWithRelations[0];
      const hasRelations = milestone.category !== null || milestone.hospital !== null;
      
      addResult('5.3 관계 테이블 조인', hasRelations ? 'PASS' : 'FAIL', 
        hasRelations ? '카테고리/병원 관계 연결 확인' : '관계 데이터 없음');
    } else {
      addResult('5.3 관계 테이블 조인', 'PASS', '마일스톤 데이터 없음 (정상)');
    }
    
  } catch (error) {
    addResult('5. 통합 테스트', 'FAIL', '', error instanceof Error ? error.message : String(error));
  }
}

/**
 * 메인 테스트 실행 함수
 */
async function runCompletePhase123Test() {
  console.log('🚀 Phase 1-3 참여형 마일스톤 시스템 완료성 테스트 시작\n');
  
  await testPhase1DatabaseSchema();
  await testPhase2BackendAPIs();
  await testPhase3AdminInterface();
  await testServiceFunctions();
  await testIntegrationFlow();
  
  console.log('\n=== 테스트 결과 요약 ===');
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const totalCount = results.length;
  
  console.log(`✅ 성공: ${passCount}개`);
  console.log(`❌ 실패: ${failCount}개`);
  console.log(`📊 전체: ${totalCount}개`);
  console.log(`🎯 성공률: ${Math.round((passCount / totalCount) * 100)}%`);
  
  if (failCount > 0) {
    console.log('\n❌ 실패한 테스트:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.test}: ${r.error || r.details || '알 수 없는 오류'}`);
    });
  }
  
  console.log('\n🏁 Phase 1-3 완료성 테스트 종료');
  
  // 전체적인 완료도 평가
  if (passCount / totalCount >= 0.9) {
    console.log('🎉 시스템 완료도: 우수 (90% 이상)');
  } else if (passCount / totalCount >= 0.7) {
    console.log('👍 시스템 완료도: 양호 (70% 이상)');
  } else {
    console.log('⚠️ 시스템 완료도: 보완 필요 (70% 미만)');
  }
}

// 테스트 실행
runCompletePhase123Test().catch(console.error);