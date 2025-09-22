/**
 * GCS Private Key 상세 검증 보고서
 */

async function inspectGCSPrivateKey() {
  console.log('🔍 GCS Private Key 상세 검증 시작');
  console.log('='.repeat(60));
  
  const report = {
    exists: false,
    length: 0,
    hasBackslashN: false,
    hasBeginMarker: false,
    hasEndMarker: false,
    hasKeyContent: false,
    format: 'invalid',
    status: 'fail'
  };
  
  // 1. 존재 여부 확인
  console.log('1️⃣ 환경변수 존재 여부 확인');
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;
  
  if (!privateKey) {
    console.log('❌ GOOGLE_CLOUD_PRIVATE_KEY 환경변수 없음');
    return report;
  }
  
  report.exists = true;
  report.length = privateKey.length;
  console.log(`✅ GOOGLE_CLOUD_PRIVATE_KEY 존재함`);
  console.log(`📏 길이: ${report.length}자`);
  
  // 2. 길이 검증 (1500자 이상)
  console.log('\n2️⃣ 길이 검증 (권장: 1500자 이상)');
  if (report.length >= 1500) {
    console.log(`✅ 충분한 길이: ${report.length}자`);
  } else {
    console.log(`❌ 길이 부족: ${report.length}자 (권장: 1500자+)`);
  }
  
  // 3. 내용 샘플 표시
  console.log('\n3️⃣ Private Key 내용 샘플');
  console.log(`시작 30자: "${privateKey.substring(0, 30)}"`);
  console.log(`종료 30자: "${privateKey.substring(privateKey.length - 30)}"`);
  
  // 4. \\n 패턴 확인
  console.log('\n4️⃣ 개행 문자(\\n) 패턴 검증');
  report.hasBackslashN = privateKey.includes('\\n');
  const hasRealNewlines = privateKey.includes('\n');
  
  console.log(`\\n 문자열 포함: ${report.hasBackslashN ? '✅' : '❌'}`);
  console.log(`실제 개행 포함: ${hasRealNewlines ? '✅' : '❌'}`);
  
  if (report.hasBackslashN && !hasRealNewlines) {
    console.log('✅ 올바른 형식: \\n이 문자열로 저장됨');
  } else if (!report.hasBackslashN && hasRealNewlines) {
    console.log('⚠️ 변환 필요: 실제 개행 → \\n 문자열');
  } else if (report.hasBackslashN && hasRealNewlines) {
    console.log('⚠️ 혼재 상태: \\n과 실제 개행 모두 존재');
  } else {
    console.log('❌ 개행 문자 없음');
  }
  
  // 5. BEGIN/END 마커 확인
  console.log('\n5️⃣ RSA Private Key 마커 검증');
  report.hasBeginMarker = privateKey.includes('-----BEGIN PRIVATE KEY-----');
  report.hasEndMarker = privateKey.includes('-----END PRIVATE KEY-----');
  
  console.log(`BEGIN 마커: ${report.hasBeginMarker ? '✅' : '❌'}`);
  console.log(`END 마커: ${report.hasEndMarker ? '✅' : '❌'}`);
  
  // 6. 키 내용 확인
  console.log('\n6️⃣ 키 내용 검증');
  const lines = privateKey.split(/\\n|\n/);
  const keyContentLines = lines.filter(line => 
    line.length > 50 && 
    !line.includes('-----BEGIN') && 
    !line.includes('-----END') &&
    line.trim().length > 0
  );
  
  report.hasKeyContent = keyContentLines.length > 10; // 최소 10줄의 키 내용
  console.log(`총 줄 수: ${lines.length}`);
  console.log(`키 내용 줄 수: ${keyContentLines.length}`);
  console.log(`키 내용 충분: ${report.hasKeyContent ? '✅' : '❌'}`);
  
  if (keyContentLines.length > 0) {
    console.log(`첫 키 줄 샘플: "${keyContentLines[0].substring(0, 20)}..."`);
  }
  
  // 7. 전체 형식 평가
  console.log('\n7️⃣ 전체 형식 평가');
  
  if (report.hasBeginMarker && report.hasEndMarker && report.hasKeyContent && report.hasBackslashN) {
    report.format = 'valid';
    report.status = 'pass';
    console.log('✅ 형식 검증 통과: 올바른 RSA Private Key');
  } else if (report.hasBeginMarker && report.hasEndMarker) {
    report.format = 'partial';
    report.status = 'warning';
    console.log('⚠️ 부분 통과: 마커는 있으나 내용 또는 형식 문제');
  } else {
    report.format = 'invalid';
    report.status = 'fail';
    console.log('❌ 형식 불량: Private Key 형식이 아님');
  }
  
  // 8. 상세 진단 및 해결 방안
  console.log('\n' + '='.repeat(60));
  console.log('📋 종합 진단 결과');
  console.log('='.repeat(60));
  
  console.log(`존재 여부: ${report.exists ? '✅' : '❌'}`);
  console.log(`길이 적정: ${report.length >= 1500 ? '✅' : '❌'} (${report.length}자)`);
  console.log(`\\n 형식: ${report.hasBackslashN ? '✅' : '❌'}`);
  console.log(`BEGIN 마커: ${report.hasBeginMarker ? '✅' : '❌'}`);
  console.log(`END 마커: ${report.hasEndMarker ? '✅' : '❌'}`);
  console.log(`키 내용: ${report.hasKeyContent ? '✅' : '❌'}`);
  
  console.log(`\n전체 상태: ${
    report.status === 'pass' ? '✅ 정상' : 
    report.status === 'warning' ? '⚠️ 부분 문제' : 
    '❌ 수정 필요'
  }`);
  
  // 9. 해결 방안 제시
  if (report.status !== 'pass') {
    console.log('\n🔧 해결 방안:');
    
    if (!report.exists) {
      console.log('1. Replit Secrets에서 GOOGLE_CLOUD_PRIVATE_KEY 환경변수 설정');
    }
    
    if (report.length < 1500) {
      console.log('2. Firebase 콘솔에서 새 서비스 계정 키 생성');
      console.log('   - Firebase 콘솔 → 프로젝트 설정 → 서비스 계정');
      console.log('   - "새 비공개 키 생성" 클릭');
      console.log('   - JSON 파일 다운로드');
    }
    
    if (!report.hasBeginMarker || !report.hasEndMarker) {
      console.log('3. JSON 파일에서 "private_key" 필드 전체 복사');
      console.log('   - 따옴표 포함하여 복사');
      console.log('   - \\n이 문자열로 표시되는지 확인');
    }
    
    if (!report.hasBackslashN) {
      console.log('4. 복사 시 주의사항:');
      console.log('   - 실제 줄바꿈이 아닌 \\n 문자열로 복사');
      console.log('   - 텍스트 에디터에서 따옴표 안의 내용만 복사');
    }
    
    console.log('\n📝 올바른 형식 예시:');
    console.log('-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkq...\\n-----END PRIVATE KEY-----\\n');
  }
  
  console.log('\n' + '='.repeat(60));
  
  return report;
}

// 스크립트 실행
inspectGCSPrivateKey()
  .then(report => {
    console.log(`\n최종 결과: ${report.status.toUpperCase()}`);
    process.exit(report.status === 'pass' ? 0 : 1);
  })
  .catch(error => {
    console.error('검증 중 오류:', error);
    process.exit(2);
  });