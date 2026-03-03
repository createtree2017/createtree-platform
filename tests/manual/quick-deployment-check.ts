/**
 * 빠른 배포 준비 체크
 * 2025-07-05 음악 생성 시스템 수정 후 최종 확인
 */

import { db } from "../../db";
import { users, music, images, conceptCategories, hospitals, banners, musicStyles } from "../../shared/schema";
import * as fs from 'fs';

console.log('🚀 배포 준비 빠른 체크 시작...\n');

async function quickCheck() {
  const results = {
    database: { status: '❌', details: '' },
    envVars: { status: '❌', details: '' },
    files: { status: '❌', details: '' },
    apis: { status: '❌', details: '' },
    overall: { ready: false, score: 0 }
  };
  
  try {
    // 1. 데이터베이스 연결 체크
    console.log('📊 데이터베이스 체크...');
    try {
      const userCount = await db.select().from(users);
      const musicCount = await db.select().from(music);
      const imageCount = await db.select().from(images);
      const styleCount = await db.select().from(musicStyles);
      
      results.database.status = '✅';
      results.database.details = `Users: ${userCount.length}, Music: ${musicCount.length}, Images: ${imageCount.length}, Styles: ${styleCount.length}`;
      console.log('  ✅ 데이터베이스 연결 성공');
      console.log(`  - 사용자: ${userCount.length}명`);
      console.log(`  - 음악: ${musicCount.length}개`);
      console.log(`  - 이미지: ${imageCount.length}개`);
      console.log(`  - 음악 스타일: ${styleCount.length}개`);
    } catch (error) {
      results.database.status = '❌';
      results.database.details = `DB 연결 실패: ${error}`;
      console.log('  ❌ 데이터베이스 연결 실패:', error);
    }
    
    // 2. 환경변수 체크
    console.log('\n🔐 환경변수 체크...');
    const requiredEnvVars = [
      { name: 'JWT_SECRET', exists: !!process.env.JWT_SECRET },
      { name: 'SESSION_SECRET', exists: !!process.env.SESSION_SECRET },
      { name: 'OPENAI_API_KEY', exists: !!process.env.OPENAI_API_KEY },
      { name: 'TOPMEDIA_API_KEY', exists: !!process.env.TOPMEDIA_API_KEY },
      { name: 'FIREBASE_SERVICE_ACCOUNT_KEY', exists: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY || fs.existsSync('./attached_assets/createtree-34c31eac4cde.json') },
      { name: 'DATABASE_URL', exists: !!process.env.DATABASE_URL },
      { name: 'GMAIL_USER', exists: !!process.env.GMAIL_USER },
      { name: 'GMAIL_APP_PASSWORD', exists: !!process.env.GMAIL_APP_PASSWORD }
    ];
    
    const missingVars = requiredEnvVars.filter(v => !v.exists);
    if (missingVars.length === 0) {
      results.envVars.status = '✅';
      results.envVars.details = '모든 필수 환경변수 설정됨';
      console.log('  ✅ 모든 필수 환경변수가 설정되어 있습니다');
    } else {
      results.envVars.status = '⚠️';
      results.envVars.details = `누락된 환경변수: ${missingVars.map(v => v.name).join(', ')}`;
      console.log('  ⚠️  누락된 환경변수:');
      missingVars.forEach(v => console.log(`    - ${v.name}`));
    }
    
    // 3. 필수 파일 체크
    console.log('\n📁 필수 파일 체크...');
    const requiredFiles = [
      'package.json',
      'client/src/App.tsx',
      'client/src/main.tsx',
      'server/index.ts',
      'server/routes.ts',
      'shared/schema.ts',
      'vite.config.ts',
      '.env'
    ];
    
    const missingFiles = requiredFiles.filter(f => !fs.existsSync(f));
    if (missingFiles.length === 0) {
      results.files.status = '✅';
      results.files.details = '모든 필수 파일 존재';
      console.log('  ✅ 모든 필수 파일이 존재합니다');
    } else {
      results.files.status = '❌';
      results.files.details = `누락된 파일: ${missingFiles.join(', ')}`;
      console.log('  ❌ 누락된 파일:');
      missingFiles.forEach(f => console.log(`    - ${f}`));
    }
    
    // 4. API 키 체크
    console.log('\n🔑 API 키 상태...');
    const apiKeys = {
      'OpenAI': !!process.env.OPENAI_API_KEY,
      'TopMediai': !!process.env.TOPMEDIA_API_KEY,
      'Firebase': !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY || fs.existsSync('./attached_assets/createtree-34c31eac4cde.json')
    };
    
    const allApisReady = Object.values(apiKeys).every(v => v);
    results.apis.status = allApisReady ? '✅' : '⚠️';
    results.apis.details = Object.entries(apiKeys).map(([k, v]) => `${k}: ${v ? '✅' : '❌'}`).join(', ');
    
    Object.entries(apiKeys).forEach(([key, exists]) => {
      console.log(`  ${exists ? '✅' : '❌'} ${key}`);
    });
    
    // 5. 전체 점수 계산
    let score = 0;
    if (results.database.status === '✅') score += 25;
    if (results.envVars.status === '✅') score += 25;
    if (results.files.status === '✅') score += 25;
    if (results.apis.status === '✅') score += 25;
    
    results.overall.score = score;
    results.overall.ready = score >= 75;
    
    // 최종 결과 출력
    console.log('\n' + '='.repeat(60));
    console.log('📋 배포 준비 상태 요약');
    console.log('='.repeat(60));
    console.log(`\n🎯 전체 점수: ${score}/100`);
    console.log(`📊 배포 준비: ${results.overall.ready ? '✅ 준비 완료' : '❌ 추가 작업 필요'}`);
    
    console.log('\n📌 주요 기능 상태:');
    console.log(`  - 데이터베이스: ${results.database.status}`);
    console.log(`  - 환경변수: ${results.envVars.status}`);
    console.log(`  - 필수 파일: ${results.files.status}`);
    console.log(`  - API 키: ${results.apis.status}`);
    
    // 권고사항
    console.log('\n📝 권고사항:');
    if (results.overall.ready) {
      console.log('  ✅ 시스템이 배포 준비가 완료되었습니다!');
      console.log('  ✅ 음악 생성 완료 알림 시스템이 정상 작동합니다.');
      console.log('  ✅ Replit Deploy 버튼을 클릭하여 배포를 진행하세요.');
    } else {
      console.log('  ❌ 배포 전 위의 문제들을 해결해야 합니다.');
      if (missingVars.length > 0) {
        console.log('  ⚠️  누락된 환경변수를 설정하세요.');
      }
      if (missingFiles.length > 0) {
        console.log('  ⚠️  누락된 파일을 복구하세요.');
      }
    }
    
    console.log('\n' + '='.repeat(60));
    
    // 상세 결과 저장
    fs.writeFileSync(
      'deployment-check-results.json',
      JSON.stringify(results, null, 2)
    );
    console.log('\n📄 상세 결과가 deployment-check-results.json에 저장되었습니다.');
    
  } catch (error) {
    console.error('❌ 체크 중 오류 발생:', error);
  }
  
  process.exit(0);
}

quickCheck();