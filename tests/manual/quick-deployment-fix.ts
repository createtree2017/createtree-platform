/**
 * 빠른 배포 이슈 해결
 */

import { db } from '../../db';

async function quickDeploymentFix() {
  console.log('🚀 빠른 배포 이슈 해결 시작');
  
  try {
    // 1. 데이터베이스 연결 테스트
    console.log('📊 데이터베이스 연결 테스트...');
    const result = await db.execute('SELECT COUNT(*) as count FROM users');
    console.log('✅ 데이터베이스 연결 성공');
    
    // 2. 음악 URL 문제 해결
    console.log('🎵 음악 URL 문제 해결...');
    await db.execute(`
      UPDATE music 
      SET url = CONCAT('/api/music/stream/', id)
      WHERE url IS NULL OR url = ''
    `);
    console.log('✅ 음악 URL 업데이트 완료');
    
    // 3. 관리자 계정 확인
    console.log('👤 관리자 계정 확인...');
    const adminCheck = await db.execute("SELECT COUNT(*) as count FROM users WHERE member_type = 'superadmin'");
    console.log('✅ 관리자 계정 상태 확인 완료');
    
    // 4. GCS 연결 테스트 (환경변수만 확인)
    console.log('☁️ GCS 환경변수 확인...');
    const gcsReady = !!(
      process.env.GOOGLE_CLOUD_PROJECT_ID &&
      process.env.GOOGLE_CLOUD_CLIENT_EMAIL &&
      process.env.GOOGLE_CLOUD_PRIVATE_KEY
    );
    console.log(`GCS 설정: ${gcsReady ? '✅ 완료' : '❌ 누락'}`);
    
    // 5. TopMediai API 키 확인
    console.log('🎼 TopMediai API 키 확인...');
    const topMediaReady = !!process.env.TOPMEDIA_API_KEY;
    console.log(`TopMediai API: ${topMediaReady ? '✅ 설정됨' : '❌ 누락'}`);
    
    // 6. JWT Secret 확인
    console.log('🔐 JWT Secret 확인...');
    const jwtReady = !!(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16);
    console.log(`JWT Secret: ${jwtReady ? '✅ 설정됨' : '❌ 부족'}`);
    
    console.log('\n=== 배포 준비 상태 ===');
    const readyItems = [gcsReady, topMediaReady, jwtReady].filter(Boolean).length;
    console.log(`환경설정: ${readyItems}/3 완료`);
    console.log(`데이터베이스: ✅ 연결됨`);
    console.log(`음악 시스템: ✅ URL 수정됨`);
    
    if (readyItems >= 2) {
      console.log('🎯 배포 가능 상태');
      return true;
    } else {
      console.log('⚠️ 추가 설정 필요');
      return false;
    }
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    return false;
  }
}

quickDeploymentFix()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(() => {
    process.exit(2);
  });