/**
 * GCS Private Key 최종 진단 및 클린 테스트
 */

async function finalGCSDiagnosis() {
  console.log('🔍 GCS Private Key 최종 진단');
  console.log('='.repeat(50));
  
  const rawKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;
  
  if (!rawKey) {
    console.log('❌ GOOGLE_CLOUD_PRIVATE_KEY 환경변수 없음');
    return false;
  }
  
  // 환경변수에서 실제 Private Key 추출
  let cleanKey = rawKey;
  
  // 환경변수 프리픽스 제거
  if (cleanKey.includes('GOOGLE_CLOUD_PRIVATE_KEY=')) {
    cleanKey = cleanKey.split('GOOGLE_CLOUD_PRIVATE_KEY=')[1];
  }
  
  // 앞뒤 공백 및 따옴표 제거
  cleanKey = cleanKey.trim().replace(/^["']|["']$/g, '');
  
  console.log('📋 정리된 Private Key 정보:');
  console.log(`원본 길이: ${rawKey.length}자`);
  console.log(`정리 후 길이: ${cleanKey.length}자`);
  console.log(`시작: ${cleanKey.substring(0, 30)}`);
  console.log(`종료: ${cleanKey.substring(cleanKey.length - 30)}`);
  
  // Base64 인코딩 여부 확인
  const isBase64Encoded = !cleanKey.includes('-----BEGIN');
  console.log(`Base64 인코딩 상태: ${isBase64Encoded ? 'Encoded' : 'Plain Text'}`);
  
  if (isBase64Encoded) {
    try {
      // Base64 디코딩 시도
      const decodedKey = Buffer.from(cleanKey, 'base64').toString('utf8');
      console.log('🔄 Base64 디코딩 성공');
      console.log(`디코딩 후 길이: ${decodedKey.length}자`);
      cleanKey = decodedKey;
    } catch (error) {
      console.log('❌ Base64 디코딩 실패');
    }
  }
  
  // \\n을 실제 개행으로 변환
  const finalKey = cleanKey.replace(/\\n/g, '\n');
  
  console.log('🔧 최종 Private Key 상태:');
  const lines = finalKey.split('\n');
  console.log(`줄 수: ${lines.length}`);
  console.log(`첫 줄: "${lines[0]}"`);
  console.log(`마지막 줄: "${lines[lines.length - 1]}"`);
  
  // PEM 형식 검증
  const hasValidBegin = lines[0]?.trim() === '-----BEGIN PRIVATE KEY-----';
  const hasValidEnd = lines[lines.length - 1]?.trim() === '-----END PRIVATE KEY-----';
  const keyContentLines = lines.slice(1, -1).filter(line => line.trim().length > 0);
  
  console.log(`유효한 BEGIN: ${hasValidBegin ? '✅' : '❌'}`);
  console.log(`유효한 END: ${hasValidEnd ? '✅' : '❌'}`);
  console.log(`키 내용 줄: ${keyContentLines.length}개`);
  
  if (keyContentLines.length > 0) {
    console.log(`첫 키 줄: "${keyContentLines[0]?.substring(0, 20)}..."`);
  }
  
  // Node.js crypto 모듈로 직접 테스트
  console.log('\n🧪 Node.js crypto 직접 테스트:');
  try {
    const crypto = require('crypto');
    const keyObject = crypto.createPrivateKey(finalKey);
    console.log('✅ Node.js crypto 검증 성공');
    console.log(`키 타입: ${keyObject.asymmetricKeyType}`);
    console.log(`키 크기: ${keyObject.asymmetricKeySize} bytes`);
    return true;
  } catch (error) {
    console.log('❌ Node.js crypto 검증 실패');
    if (error instanceof Error) {
      console.log(`오류: ${error.message}`);
    }
    return false;
  }
}

// 스크립트 실행
finalGCSDiagnosis()
  .then(success => {
    console.log(`\n최종 결과: ${success ? 'Private Key 유효' : 'Private Key 무효'}`);
    
    if (!success) {
      console.log('\n🔧 해결 방안:');
      console.log('1. Firebase 콘솔에서 새 서비스 계정 생성');
      console.log('2. JSON 파일 다운로드 후 텍스트 에디터로 열기');
      console.log('3. private_key 필드 값만 따옴표와 함께 정확히 복사');
      console.log('4. 복사한 값을 그대로 Replit Secrets에 붙여넣기');
    }
    
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('진단 중 오류:', error);
    process.exit(2);
  });