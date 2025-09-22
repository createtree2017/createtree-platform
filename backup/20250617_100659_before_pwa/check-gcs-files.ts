/**
 * GCS 버킷의 실제 파일 목록 확인 스크립트
 */

import { bucket } from './server/firebase.js';

async function checkGCSFiles() {
  try {
    console.log('🔍 GCS 버킷 파일 목록 확인 중...');
    
    // 버킷의 모든 경로 확인
    const [allFiles] = await bucket.getFiles({
      maxResults: 50
    });
    
    console.log(`📁 버킷 전체에서 ${allFiles.length}개 파일 발견:`);
    
    // 경로별로 그룹화
    const pathGroups = {};
    for (const file of allFiles) {
      const pathParts = file.name.split('/');
      const directory = pathParts.slice(0, -1).join('/');
      if (!pathGroups[directory]) {
        pathGroups[directory] = [];
      }
      pathGroups[directory].push(file.name);
    }
    
    console.log('\n📂 디렉토리별 파일 목록:');
    for (const [dir, files] of Object.entries(pathGroups)) {
      console.log(`${dir}: ${files.length}개 파일`);
      files.slice(0, 3).forEach(fileName => {
        console.log(`  - ${fileName}`);
      });
    }
    
    // images/ 경로 확인
    const [imagesFiles] = await bucket.getFiles({
      prefix: 'images/',
      maxResults: 20
    });
    
    console.log(`\n📁 images/ 경로에서 ${imagesFiles.length}개 파일 발견:`);
    for (const file of imagesFiles.slice(0, 10)) {
      console.log(`  - ${file.name}`);
    }
    
    // 사용자 24의 파일들 확인
    console.log('\n🔍 사용자 24의 이미지 확인:');
    const [user24Files] = await bucket.getFiles({
      prefix: 'images/general/24/',
      maxResults: 20
    });
    
    console.log(`📁 images/general/24/ 경로에서 ${user24Files.length}개 파일 발견:`);
    for (const file of user24Files.slice(0, 10)) {
      console.log(`  - ${file.name}`);
    }
    
    // 최근 생성된 파일들 확인
    console.log('\n🔍 최근 파일들 확인:');
    const targetFiles = [
      'images/general/24/21eaec0b-1968-4af2-b58a-3bd106ebe9ea_thumb.webp',
      'images/general/24/ccacaf39-8fa3-412b-9bb2-60944e0dedd0_thumb.webp',
      'images/general/24/dabd2078-2345-44aa-9be8-fd329c602e16_thumb.webp'
    ];
    
    for (const fileName of targetFiles) {
      const file = bucket.file(fileName);
      const [exists] = await file.exists();
      
      if (exists) {
        const [metadata] = await file.getMetadata();
        console.log(`✅ ${fileName} - 크기: ${metadata.size} bytes`);
        
        // 테스트용 서명된 URL 생성
        try {
          const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 60 * 1000, // 1분
          });
          console.log(`🔗 서명 URL: ${signedUrl.substring(0, 100)}...`);
        } catch (urlError) {
          console.error(`❌ URL 생성 실패: ${urlError.message}`);
        }
      } else {
        console.log(`❌ ${fileName} - 파일 없음`);
      }
    }
    
    // 버킷 권한 확인
    console.log('\n🔍 버킷 권한 확인:');
    try {
      const [policy] = await bucket.iam.getPolicy();
      console.log('📋 버킷 IAM 정책:', JSON.stringify(policy, null, 2));
    } catch (policyError) {
      console.error('❌ 권한 확인 실패:', policyError.message);
    }
    
  } catch (error) {
    console.error('❌ GCS 확인 중 오류:', error);
  }
}

// 스크립트 실행
checkGCSFiles()
  .then(() => {
    console.log('✅ GCS 확인 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 오류:', error);
    process.exit(1);
  });