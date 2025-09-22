/**
 * 환경변수 설정 검증 스크립트
 */

import { db } from './db';

async function validateEnvironmentSetup() {
  console.log('🔍 환경변수 설정 검증 시작');
  console.log('='.repeat(50));
  
  const results = {
    jwt: false,
    gcs: false,
    database: false,
    topmedia: false
  };
  
  // 1. JWT Secret 검증
  console.log('\n🔐 JWT Secret 검증...');
  if (process.env.JWT_SECRET) {
    const jwtLength = process.env.JWT_SECRET.length;
    console.log(`JWT Secret 길이: ${jwtLength}자`);
    
    if (jwtLength >= 32) {
      console.log('✅ JWT Secret: 안전한 길이 (32자 이상)');
      results.jwt = true;
    } else {
      console.log('❌ JWT Secret: 너무 짧음 (32자 미만)');
    }
  } else {
    console.log('❌ JWT Secret: 설정되지 않음');
  }
  
  // 2. Google Cloud Storage 검증
  console.log('\n☁️ Google Cloud Storage 설정 검증...');
  const gcsVars = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    clientEmail: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    privateKey: process.env.GOOGLE_CLOUD_PRIVATE_KEY
  };
  
  console.log(`Project ID: ${gcsVars.projectId ? '✅ 설정됨' : '❌ 누락'}`);
  console.log(`Client Email: ${gcsVars.clientEmail ? '✅ 설정됨' : '❌ 누락'}`);
  console.log(`Private Key: ${gcsVars.privateKey ? '✅ 설정됨' : '❌ 누락'}`);
  
  if (gcsVars.projectId && gcsVars.clientEmail && gcsVars.privateKey) {
    // Private Key 형식 검증
    const keyStartsCorrect = gcsVars.privateKey.includes('-----BEGIN PRIVATE KEY-----');
    const keyEndsCorrect = gcsVars.privateKey.includes('-----END PRIVATE KEY-----');
    const hasNewlines = gcsVars.privateKey.includes('\\n');
    
    console.log(`Key 시작 형식: ${keyStartsCorrect ? '✅' : '❌'}`);
    console.log(`Key 종료 형식: ${keyEndsCorrect ? '✅' : '❌'}`);
    console.log(`개행 문자(\\n): ${hasNewlines ? '✅ 포함됨' : '❌ 누락'}`);
    
    if (keyStartsCorrect && keyEndsCorrect && hasNewlines) {
      results.gcs = true;
      console.log('✅ GCS 설정: 올바른 형식');
    } else {
      console.log('❌ GCS 설정: 형식 오류');
      console.log('📝 올바른 형식: -----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----\\n');
    }
  } else {
    console.log('❌ GCS 설정: 필수 환경변수 누락');
  }
  
  // 3. 데이터베이스 연결 검증
  console.log('\n🗄️ 데이터베이스 연결 검증...');
  try {
    await db.execute('SELECT 1');
    console.log('✅ 데이터베이스: 연결 성공');
    results.database = true;
  } catch (error) {
    console.log('❌ 데이터베이스: 연결 실패');
    console.error('에러:', error);
  }
  
  // 4. TopMediai API 키 검증
  console.log('\n🎼 TopMediai API 키 검증...');
  if (process.env.TOPMEDIA_API_KEY) {
    console.log('✅ TopMediai API 키: 설정됨');
    results.topmedia = true;
  } else {
    console.log('❌ TopMediai API 키: 설정되지 않음');
  }
  
  // 종합 결과
  console.log('\n' + '='.repeat(50));
  console.log('📊 환경변수 설정 검증 결과');
  console.log('='.repeat(50));
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  const successRate = Math.round((passedTests / totalTests) * 100);
  
  console.log(`JWT 인증: ${results.jwt ? '✅' : '❌'}`);
  console.log(`GCS 저장소: ${results.gcs ? '✅' : '❌'}`);
  console.log(`데이터베이스: ${results.database ? '✅' : '❌'}`);
  console.log(`TopMediai API: ${results.topmedia ? '✅' : '❌'}`);
  console.log(`\n성공률: ${successRate}% (${passedTests}/${totalTests})`);
  
  if (successRate === 100) {
    console.log('\n🎉 모든 환경변수 설정 완료 - 배포 준비됨');
  } else if (successRate >= 75) {
    console.log('\n⚠️ 대부분 설정 완료 - 일부 기능 제한');
  } else {
    console.log('\n❌ 추가 설정 필요 - 배포 지연 권장');
  }
  
  // 다음 단계 안내
  if (!results.jwt) {
    console.log('\n🔧 JWT Secret 수정 필요:');
    console.log('node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  
  if (!results.gcs) {
    console.log('\n🔧 GCS Private Key 수정 필요:');
    console.log('형식: -----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----\\n');
    console.log('주의: 실제 줄바꿈이 아닌 \\n 문자열로 입력');
  }
  
  console.log('\n' + '='.repeat(50));
  
  return results;
}

// 스크립트 실행
validateEnvironmentSetup()
  .then(results => {
    const allPassed = Object.values(results).every(Boolean);
    process.exit(allPassed ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ 검증 중 오류:', error);
    process.exit(2);
  });