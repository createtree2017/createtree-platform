/**
 * GCS 버킷 공개 접근 정책 설정
 * 이미지가 표시되지 않는 문제 해결
 */

import { bucket } from './server/firebase.js';

async function fixBucketPublicAccess() {
  try {
    console.log('🔧 GCS 버킷 공개 접근 정책 설정 시작...');
    
    // 버킷 정보 확인
    const [metadata] = await bucket.getMetadata();
    console.log('📋 버킷 이름:', bucket.name);
    console.log('📋 현재 정책:', metadata.iamConfiguration);
    
    // 버킷에 공개 읽기 정책 추가
    await bucket.iam.setPolicy({
      bindings: [
        {
          role: 'roles/storage.objectViewer',
          members: ['allUsers'],
        },
      ],
    });
    
    console.log('✅ 버킷 공개 읽기 정책 설정 완료');
    
    // 버킷의 기본 ACL 설정
    await bucket.acl.add({
      entity: 'allUsers',
      role: 'READER',
    });
    
    console.log('✅ 버킷 기본 ACL 설정 완료');
    
    // 최근 파일들 확인
    const [files] = await bucket.getFiles({
      prefix: 'images/',
      maxResults: 10,
    });
    
    console.log(`📁 버킷의 최근 파일들 (${files.length}개):`);
    for (const file of files) {
      console.log(`- ${file.name}`);
      // 각 파일에 공개 접근 권한 설정
      try {
        await file.makePublic();
        console.log(`  ✅ 공개 설정 완료: ${file.name}`);
      } catch (error) {
        console.log(`  ⚠️ 공개 설정 실패: ${file.name} - ${error.message}`);
      }
    }
    
    console.log('🎉 버킷 공개 접근 설정 완료!');
    
  } catch (error) {
    console.error('❌ 작업 실패:', error);
  }
  
  process.exit(0);
}

// 실행
fixBucketPublicAccess().catch(console.error);