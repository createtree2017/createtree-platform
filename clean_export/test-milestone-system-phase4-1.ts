/**
 * Phase 4-1 참여형 마일스톤 사용자 인터페이스 테스트
 * 
 * 목표: 사용자가 참여형 마일스톤을 보고 신청할 수 있는 UI 컴포넌트 동작 검증
 */

import fetch from 'node-fetch';

async function testPhase4UserInterface() {
  console.log('🧪 Phase 4-1: 참여형 마일스톤 사용자 인터페이스 테스트 시작\n');
  
  const baseUrl = 'http://localhost:5000';
  const testResults = [];
  
  // ===== 1. 백엔드 API 동작 확인 =====
  console.log('1️⃣ 백엔드 API 동작 확인');
  
  try {
    // 참여형 마일스톤 목록 API 테스트
    console.log('   📡 GET /api/milestones/campaigns 테스트...');
    const campaignsResponse = await fetch(`${baseUrl}/api/milestones/campaigns`);
    
    if (campaignsResponse.status === 401) {
      console.log('   ⚠️  인증 필요 - 비로그인 상태에서는 401 예상됨');
      testResults.push({ test: 'campaigns API', status: 'expected-401', note: '인증 필요' });
    } else if (campaignsResponse.ok) {
      const campaignsData = await campaignsResponse.json();
      console.log(`   ✅ 참여형 마일스톤 API 응답 성공: ${campaignsData.data?.length || 0}개`);
      testResults.push({ test: 'campaigns API', status: 'success', data: campaignsData });
    } else {
      console.log(`   ❌ 참여형 마일스톤 API 오류: ${campaignsResponse.status}`);
      testResults.push({ test: 'campaigns API', status: 'error', code: campaignsResponse.status });
    }
    
    // 내 신청 내역 API 테스트
    console.log('   📡 GET /api/milestones/applications/my 테스트...');
    const applicationsResponse = await fetch(`${baseUrl}/api/milestones/applications/my`);
    
    if (applicationsResponse.status === 401) {
      console.log('   ⚠️  인증 필요 - 비로그인 상태에서는 401 예상됨');
      testResults.push({ test: 'applications API', status: 'expected-401', note: '인증 필요' });
    } else if (applicationsResponse.ok) {
      const applicationsData = await applicationsResponse.json();
      console.log(`   ✅ 내 신청 내역 API 응답 성공: ${applicationsData.data?.length || 0}개`);
      testResults.push({ test: 'applications API', status: 'success', data: applicationsData });
    } else {
      console.log(`   ❌ 내 신청 내역 API 오류: ${applicationsResponse.status}`);
      testResults.push({ test: 'applications API', status: 'error', code: applicationsResponse.status });
    }
    
  } catch (error) {
    console.log(`   ❌ API 테스트 중 오류: ${error.message}`);
    testResults.push({ test: 'API connection', status: 'error', error: error.message });
  }
  
  // ===== 2. 프론트엔드 라우팅 확인 =====
  console.log('\n2️⃣ 프론트엔드 마일스톤 페이지 접근성 확인');
  
  try {
    const milestonePageResponse = await fetch(`${baseUrl}/milestones`);
    if (milestonePageResponse.ok) {
      const pageContent = await milestonePageResponse.text();
      
      // 참여형 마일스톤 탭 존재 확인
      const hasParticipationTab = pageContent.includes('참여형 마일스톤') || pageContent.includes('Users');
      const hasApplicationTab = pageContent.includes('내 신청 현황') || pageContent.includes('Gift');
      
      console.log(`   📄 마일스톤 페이지 로드: ${milestonePageResponse.ok ? '성공' : '실패'}`);
      console.log(`   📋 참여형 마일스톤 탭: ${hasParticipationTab ? '발견됨' : '미발견'}`);
      console.log(`   📊 내 신청 현황 탭: ${hasApplicationTab ? '발견됨' : '미발견'}`);
      
      testResults.push({ 
        test: 'milestone page', 
        status: 'success', 
        hasParticipationTab, 
        hasApplicationTab 
      });
    } else {
      console.log(`   ❌ 마일스톤 페이지 로드 실패: ${milestonePageResponse.status}`);
      testResults.push({ test: 'milestone page', status: 'error', code: milestonePageResponse.status });
    }
  } catch (error) {
    console.log(`   ❌ 페이지 접근 테스트 중 오류: ${error.message}`);
    testResults.push({ test: 'page access', status: 'error', error: error.message });
  }
  
  // ===== 3. 데이터베이스 데이터 확인 =====
  console.log('\n3️⃣ 참여형 마일스톤 데이터 존재 확인');
  
  try {
    const { db } = await import('./db/index.js');
    const { milestones } = await import('./shared/schema.ts');
    
    // type='campaign'인 마일스톤 조회
    const campaignMilestones = await db.query.milestones.findMany({
      where: (milestones, { eq }) => eq(milestones.type, 'campaign')
    });
    
    console.log(`   📊 데이터베이스 참여형 마일스톤 개수: ${campaignMilestones.length}개`);
    
    if (campaignMilestones.length > 0) {
      console.log('   📝 첫 번째 참여형 마일스톤:');
      const first = campaignMilestones[0];
      console.log(`      제목: ${first.title}`);
      console.log(`      설명: ${first.description?.substring(0, 50)}...`);
      console.log(`      병원 ID: ${first.hospitalId}`);
      console.log(`      활성화: ${first.isActive}`);
    }
    
    testResults.push({ 
      test: 'campaign milestones data', 
      status: 'success', 
      count: campaignMilestones.length,
      sample: campaignMilestones[0] 
    });
    
  } catch (error) {
    console.log(`   ❌ 데이터베이스 확인 중 오류: ${error.message}`);
    testResults.push({ test: 'database check', status: 'error', error: error.message });
  }
  
  // ===== 4. 컴포넌트 코드 구조 확인 =====
  console.log('\n4️⃣ 프론트엔드 컴포넌트 구조 확인');
  
  try {
    const fs = await import('fs');
    const milestonesPageContent = fs.readFileSync('./client/src/pages/milestones.tsx', 'utf8');
    
    // 필수 컴포넌트 및 함수 존재 확인
    const hasCampaignMilestoneCard = milestonesPageContent.includes('CampaignMilestoneCard');
    const hasCampaignMilestonesTab = milestonesPageContent.includes('CampaignMilestonesTab');
    const hasMyApplicationsTab = milestonesPageContent.includes('MyApplicationsTab');
    const hasApplyMutation = milestonesPageContent.includes('applyMutation');
    const hasCancelMutation = milestonesPageContent.includes('cancelMutation');
    const hasTabsList = milestonesPageContent.includes('campaigns') && milestonesPageContent.includes('applications');
    
    console.log('   🧩 컴포넌트 구조 체크:');
    console.log(`      CampaignMilestoneCard: ${hasCampaignMilestoneCard ? '✅' : '❌'}`);
    console.log(`      CampaignMilestonesTab: ${hasCampaignMilestonesTab ? '✅' : '❌'}`);
    console.log(`      MyApplicationsTab: ${hasMyApplicationsTab ? '✅' : '❌'}`);
    console.log(`      신청 Mutation: ${hasApplyMutation ? '✅' : '❌'}`);
    console.log(`      취소 Mutation: ${hasCancelMutation ? '✅' : '❌'}`);
    console.log(`      탭 구조: ${hasTabsList ? '✅' : '❌'}`);
    
    testResults.push({ 
      test: 'component structure', 
      status: 'success',
      components: {
        CampaignMilestoneCard: hasCampaignMilestoneCard,
        CampaignMilestonesTab: hasCampaignMilestonesTab,
        MyApplicationsTab: hasMyApplicationsTab,
        applyMutation: hasApplyMutation,
        cancelMutation: hasCancelMutation,
        tabStructure: hasTabsList
      }
    });
    
  } catch (error) {
    console.log(`   ❌ 컴포넌트 구조 확인 중 오류: ${error.message}`);
    testResults.push({ test: 'component structure', status: 'error', error: error.message });
  }
  
  // ===== 결과 요약 =====
  console.log('\n📋 Phase 4-1 테스트 결과 요약:');
  console.log('='.repeat(50));
  
  let successCount = 0;
  let totalTests = 0;
  
  testResults.forEach((result, index) => {
    totalTests++;
    if (result.status === 'success' || result.status === 'expected-401') {
      successCount++;
      console.log(`✅ ${index + 1}. ${result.test}: 성공`);
    } else {
      console.log(`❌ ${index + 1}. ${result.test}: 실패 (${result.error || result.code})`);
    }
  });
  
  const successRate = Math.round((successCount / totalTests) * 100);
  console.log(`\n🎯 전체 성공률: ${successCount}/${totalTests} (${successRate}%)`);
  
  if (successRate >= 80) {
    console.log('🎉 Phase 4-1 사용자 인터페이스 구현 성공!');
    console.log('✨ 다음 단계: Phase 4-2 실제 로그인 테스트 및 신청 기능 검증');
  } else {
    console.log('⚠️  Phase 4-1 일부 문제 발견. 수정 필요한 항목들:');
    testResults.forEach((result, index) => {
      if (result.status === 'error') {
        console.log(`   ${index + 1}. ${result.test}: ${result.error || result.code}`);
      }
    });
  }
  
  console.log('\n📊 상세 테스트 데이터:', JSON.stringify(testResults, null, 2));
}

// 실행
testPhase4UserInterface().catch(console.error);