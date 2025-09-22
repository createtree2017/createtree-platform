/**
 * 음악 ID 79 파일 접근 권한 수정
 * GCS 파일을 공개 접근 가능하도록 설정
 */

import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: 'createtree',
  keyFilename: './server/createtree-34c31eac4cde.json'
});

const bucket = storage.bucket('createtree-upload');

async function fixMusic79Access() {
  console.log('🔧 음악 ID 79 파일 접근 권한 수정 시작');
  
  const fileName = 'music/cd94a531-dd3b-4a3f-ae48-c635f3788051.mp3';
  const file = bucket.file(fileName);
  
  try {
    // 1. 파일 존재 확인
    const [exists] = await file.exists();
    if (!exists) {
      console.log('❌ 파일이 존재하지 않습니다:', fileName);
      return;
    }
    
    console.log('✅ 파일 존재 확인:', fileName);
    
    // 2. 현재 권한 확인
    try {
      const [metadata] = await file.getMetadata();
      console.log('📊 파일 메타데이터:', {
        name: metadata.name,
        size: metadata.size,
        contentType: metadata.contentType,
        updated: metadata.updated
      });
    } catch (metaError) {
      console.log('⚠️ 메타데이터 조회 실패:', metaError.message);
    }
    
    // 3. 공개 읽기 권한 설정
    console.log('🔓 공개 접근 권한 설정 중...');
    
    await file.makePublic();
    console.log('✅ 공개 접근 권한 설정 완료');
    
    // 4. 새로운 공개 URL 생성
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    console.log('🔗 공개 URL:', publicUrl);
    
    // 5. URL 접근 테스트
    console.log('🧪 URL 접근 테스트 중...');
    
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(publicUrl, { method: 'HEAD' });
    
    console.log('📊 접근 테스트 결과:');
    console.log('- 상태:', response.status, response.statusText);
    console.log('- Content-Type:', response.headers.get('content-type'));
    console.log('- Content-Length:', response.headers.get('content-length'));
    
    if (response.ok) {
      console.log('🎉 음악 파일 접근 성공! 이제 재생 가능합니다.');
      console.log('🎵 다시 시도해보세요:', publicUrl);
    } else {
      console.log('❌ 여전히 접근 불가');
    }
    
  } catch (error: any) {
    console.error('❌ 권한 수정 실패:', error.message);
    
    // 대안: SignedURL 생성
    console.log('🔄 SignedURL 대안 생성 중...');
    try {
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000 // 24시간
      });
      
      console.log('📝 임시 접근 URL (24시간 유효):', signedUrl);
    } catch (signedError) {
      console.error('❌ SignedURL 생성도 실패:', signedError.message);
    }
  }
}

// 실행
fixMusic79Access().catch(console.error);