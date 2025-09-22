/**
 * Phase 6 참여형 마일스톤 파일 업로드 시스템 종합 테스트
 * 6개 하위 단계의 완전한 구현 상태 검증
 */

interface TestResult {
  phase: number;
  step: string;
  test: string;
  status: 'success' | 'failed';
  details?: string;
  issue?: string;
  error?: any;
}

async function testPhase6FileUploadSystem(): Promise<void> {
  console.log('🔍 Phase 6 참여형 마일스톤 파일 업로드 시스템 종합 테스트 시작\n');
  
  const results: TestResult[] = [];
  let successCount = 0;
  let totalTests = 0;

  // Phase 6-1: 데이터베이스 스키마 검증
  console.log('📋 Phase 6-1: 데이터베이스 스키마 검증');
  try {
    // milestone_application_files 테이블 구조 확인
    const schemaResponse = await fetch('/api/test/schema/milestone_application_files');
    if (schemaResponse.ok) {
      const schemaData = await schemaResponse.json();
      results.push({
        phase: 6.1,
        step: 'Database Schema',
        test: 'milestone_application_files 테이블 존재',
        status: 'success',
        details: `필드 개수: ${schemaData.columns?.length || 0}`
      });
      successCount++;
    } else {
      results.push({
        phase: 6.1,
        step: 'Database Schema',
        test: 'milestone_application_files 테이블 존재',
        status: 'failed',
        issue: '테이블 구조 조회 실패'
      });
    }
    totalTests++;

    // 필수 컬럼 존재 확인
    const requiredColumns = ['id', 'applicationId', 'fileName', 'originalName', 'mimeType', 'fileSize', 'filePath', 'uploadedAt', 'uploadedBy'];
    const hasAllColumns = requiredColumns.every(col => 
      schemaData?.columns?.some((column: any) => column.name === col)
    );
    
    results.push({
      phase: 6.1,
      step: 'Schema Validation',
      test: '필수 컬럼 완성도 검증',
      status: hasAllColumns ? 'success' : 'failed',
      details: hasAllColumns ? '모든 필수 컬럼 존재' : '일부 컬럼 누락'
    });
    if (hasAllColumns) successCount++;
    totalTests++;

  } catch (error) {
    results.push({
      phase: 6.1,
      step: 'Database Schema',
      test: '스키마 검증',
      status: 'failed',
      error: error
    });
    totalTests++;
  }

  // Phase 6-2: 백엔드 API 엔드포인트 검증
  console.log('\n🔧 Phase 6-2: 백엔드 API 엔드포인트 검증');
  
  // 파일 업로드 API 존재 확인
  try {
    const uploadResponse = await fetch('/api/milestone-applications/1/files', {
      method: 'OPTIONS'
    });
    
    results.push({
      phase: 6.2,
      step: 'Upload API',
      test: '파일 업로드 엔드포인트 존재',
      status: uploadResponse.status === 200 || uploadResponse.status === 405 ? 'success' : 'failed',
      details: `Status: ${uploadResponse.status}`
    });
    
    if (uploadResponse.status === 200 || uploadResponse.status === 405) successCount++;
    totalTests++;
  } catch (error) {
    results.push({
      phase: 6.2,
      step: 'Upload API',
      test: '파일 업로드 엔드포인트 존재',
      status: 'failed',
      error: error
    });
    totalTests++;
  }

  // 파일 조회 API 확인
  try {
    const filesResponse = await fetch('/api/milestone-applications/1/files');
    
    results.push({
      phase: 6.2,
      step: 'Files API',
      test: '파일 목록 조회 엔드포인트',
      status: filesResponse.ok ? 'success' : 'failed',
      details: `Status: ${filesResponse.status}`
    });
    
    if (filesResponse.ok) successCount++;
    totalTests++;
  } catch (error) {
    results.push({
      phase: 6.2,
      step: 'Files API',
      test: '파일 목록 조회 엔드포인트',
      status: 'failed',
      error: error
    });
    totalTests++;
  }

  // Phase 6-3: 프론트엔드 컴포넌트 검증
  console.log('\n🎨 Phase 6-3: 프론트엔드 컴포넌트 검증');
  
  // 마일스톤 페이지 로드 확인
  try {
    const milestonesResponse = await fetch('/milestones');
    
    results.push({
      phase: 6.3,
      step: 'Frontend Page',
      test: '마일스톤 페이지 로드',
      status: milestonesResponse.ok ? 'success' : 'failed',
      details: `Status: ${milestonesResponse.status}`
    });
    
    if (milestonesResponse.ok) successCount++;
    totalTests++;
  } catch (error) {
    results.push({
      phase: 6.3,
      step: 'Frontend Page',
      test: '마일스톤 페이지 로드',
      status: 'failed',
      error: error
    });
    totalTests++;
  }

  // Phase 6-4: 서비스 함수 검증
  console.log('\n⚙️ Phase 6-4: 서비스 함수 검증');
  
  // 파일 업로드 서비스 함수 존재 확인 (간접 검증)
  try {
    // 실제 멀터 설정 확인
    const multerTestResponse = await fetch('/api/test/multer-config');
    
    results.push({
      phase: 6.4,
      step: 'Service Functions',
      test: 'Multer 설정 및 파일 처리 함수',
      status: multerTestResponse.ok ? 'success' : 'failed',
      details: multerTestResponse.ok ? 'Multer 설정 정상' : 'Multer 설정 문제'
    });
    
    if (multerTestResponse.ok) successCount++;
    totalTests++;
  } catch (error) {
    results.push({
      phase: 6.4,
      step: 'Service Functions',
      test: 'Multer 설정 확인',
      status: 'failed',
      error: error
    });
    totalTests++;
  }

  // Phase 6-5: 통합 테스트
  console.log('\n🔗 Phase 6-5: 시스템 통합 테스트');
  
  // 참여형 마일스톤 목록 조회
  try {
    const campaignsResponse = await fetch('/api/milestones/campaigns');
    const campaignsData = await campaignsResponse.json();
    
    results.push({
      phase: 6.5,
      step: 'Integration Test',
      test: '참여형 마일스톤 목록 조회',
      status: campaignsResponse.ok ? 'success' : 'failed',
      details: `캠페인 수: ${campaignsData?.length || 0}`
    });
    
    if (campaignsResponse.ok) successCount++;
    totalTests++;
  } catch (error) {
    results.push({
      phase: 6.5,
      step: 'Integration Test',
      test: '참여형 마일스톤 목록 조회',
      status: 'failed',
      error: error
    });
    totalTests++;
  }

  // 신청 목록 조회 (사용자별)
  try {
    const applicationsResponse = await fetch('/api/milestones/applications/my');
    
    results.push({
      phase: 6.5,
      step: 'Integration Test',
      test: '내 신청 목록 조회',
      status: applicationsResponse.ok ? 'success' : 'failed',
      details: `Status: ${applicationsResponse.status}`
    });
    
    if (applicationsResponse.ok) successCount++;
    totalTests++;
  } catch (error) {
    results.push({
      phase: 6.5,
      step: 'Integration Test',
      test: '내 신청 목록 조회',
      status: 'failed',
      error: error
    });
    totalTests++;
  }

  // Phase 6-6: 보안 및 검증 테스트
  console.log('\n🔒 Phase 6-6: 보안 및 검증 테스트');
  
  // 파일 타입 검증 로직 확인
  try {
    // 비허용 파일 타입으로 업로드 시도 (시뮬레이션)
    const formData = new FormData();
    const invalidFile = new Blob(['test content'], { type: 'application/x-executable' });
    formData.append('file', invalidFile, 'malicious.exe');
    formData.append('description', 'test');
    
    const invalidUploadResponse = await fetch('/api/milestone-applications/1/files', {
      method: 'POST',
      body: formData
    });
    
    // 400 또는 403이면 올바른 검증
    const isValidationWorking = invalidUploadResponse.status === 400 || invalidUploadResponse.status === 403;
    
    results.push({
      phase: 6.6,
      step: 'Security Test',
      test: '파일 타입 검증 로직',
      status: isValidationWorking ? 'success' : 'failed',
      details: `응답 코드: ${invalidUploadResponse.status}`
    });
    
    if (isValidationWorking) successCount++;
    totalTests++;
  } catch (error) {
    results.push({
      phase: 6.6,
      step: 'Security Test',
      test: '파일 타입 검증 로직',
      status: 'failed',
      error: error
    });
    totalTests++;
  }

  // 결과 출력
  console.log('\n📊 Phase 6 종합 테스트 결과');
  console.log('='.repeat(60));
  
  results.forEach(result => {
    const icon = result.status === 'success' ? '✅' : '❌';
    console.log(`${icon} Phase ${result.phase} ${result.step}: ${result.test}`);
    if (result.details) console.log(`   ℹ️  ${result.details}`);
    if (result.issue) console.log(`   ⚠️  ${result.issue}`);
    if (result.error) console.log(`   🔥 ${result.error.message || result.error}`);
  });

  const successRate = Math.round((successCount / totalTests) * 100);
  console.log('\n📈 전체 성과');
  console.log(`성공: ${successCount}/${totalTests} (${successRate}%)`);
  
  let gradeEmoji = '';
  let grade = '';
  
  if (successRate >= 95) {
    gradeEmoji = '🏆';
    grade = '완벽 등급';
  } else if (successRate >= 85) {
    gradeEmoji = '🥇';
    grade = '우수 등급';
  } else if (successRate >= 75) {
    gradeEmoji = '🥈';
    grade = '양호 등급';
  } else if (successRate >= 60) {
    gradeEmoji = '🥉';
    grade = '보통 등급';
  } else {
    gradeEmoji = '⚠️';
    grade = '개선 필요';
  }
  
  console.log(`등급: ${gradeEmoji} ${grade}`);
  
  if (successRate >= 85) {
    console.log('\n🎉 Phase 6 참여형 마일스톤 파일 업로드 시스템이 성공적으로 구현되었습니다!');
    console.log('✨ 다음 단계(Phase 7) 진행 가능 상태입니다.');
  } else {
    console.log('\n⚠️ 일부 구성요소에서 문제가 발견되었습니다.');
    console.log('🔧 Phase 7 진행 전 이슈 해결을 권장합니다.');
    
    const failedTests = results.filter(r => r.status === 'failed');
    if (failedTests.length > 0) {
      console.log('\n🔴 실패한 테스트:');
      failedTests.forEach(test => {
        console.log(`- Phase ${test.phase} ${test.step}: ${test.test}`);
        if (test.issue) console.log(`  문제: ${test.issue}`);
      });
    }
  }
  
  console.log('\n' + '='.repeat(60));
}

// 테스트 실행
testPhase6FileUploadSystem().catch(console.error);