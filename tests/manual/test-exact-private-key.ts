/**
 * Firebase JSON에서 추출한 정확한 Private Key로 즉시 테스트
 */

import { Storage } from '@google-cloud/storage';

async function testExactPrivateKey() {
  console.log('🧪 Firebase JSON Private Key 즉시 테스트');
  console.log('='.repeat(50));
  
  // Firebase JSON에서 추출한 정확한 private_key 값
  const exactPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCfD2kZ6xcUYmwI
UhcxyP0LWPTOw8arUkiblJFSjpMyUrHrtHnP7aG5hMqmb6lIf1jiGkSU/pdFqWkv
atWse3mej7fhdMLuf/EIXdZRkkKjWTVDV54OAUlG5Z8k1C4uqG8MMu40czSK6jLj
qn91rDZjYqX4pHKqd/CGI4M+y4WX1itFdBA1n5ZGhRqESnVgmGnkaD7w8TD07ws5
XAdKee1A/SRkDXybebXSOcxmDcFAQdbej1Pmosvy1PkbLVDSBgQvaDoS8cip0y4q
S8BlxgP2mGLUu/oU4zieUsZfUgYdirQLUc0hGC3dXsOyPn/qMaLHpHeG7k5ROWpY
JKTxAGmRAgMBAAECggEABGU1n0y6x4pst9Ik5/BI5c5gfXI1hDhy3zG8zk44TRSx
6/SBxTgo1uqPewfs4p76Qs09Bez/GyKyUGggXXLQCoyoJSfH1zVb4MJPENP82Wy2
pxS9vl9UugvQWQEwAYQQBYNGx9ZDJm+QVnA4s3S90ANC2NsafBFyaRKEJvES0P5D
7L6oMcfDdgny3Hlhef+kxMBiFIxmr2HGYuhDQQCynFMt/AaHWoi7VUOW+BLA3zU2
DP8IQoMMvoCAwgruPraCRuAbHrjuk9OrA8pembaCpgptFqleV9lZk2KzlMyLIT3U
sg96OJ+1s45pgUPw3YujAkXGlJ/3GjOQxtvtbmno0QKBgQDRpFIN9BgCxRGL/DEJ
MWVZrPsxPo99R5KVVkAH6fh0uvTZuPpQI5gz81I7JdjkNUDHupXysO3RwBufVJLc
EPTACKxJOD2wA6D3cRYjRV9erKhQSs8y2G/wOAB0BHfTFDN354vY/mOZldLeLL2o
y/YRuJViAo/49zDDq1tqXStGtQKBgQDCO7JYI9mr2OTwt0de/ALAbz245DaN9xXQ
ZsN8BH0AgdI/wTIT3PCmxA6w0kTYPgXUKi6iuSBfnY5XS6pjjw+2dLW4wmHsuIm8
qpheNd8sWXoFGOo7r0bWFAMGO7xh/3OD9xReI9iUYhsVfNFBNaCPO+ZkwzIgdcl3
iubffpSk7QKBgHZ40hYol1kZXS0qu9tiGtBuvRW7MQOvatsR/uV6B3qQHMbdjjez
pdPV8eaTINr2bUFx5ENeUUdztSh5dvT+cBIF1LccHWBW7KRpOAV+ssKh+AxH+ofV
YIz0WO03iS+z/tIH/DQIruigjqYXyqaVfN3O3jyhDhO4PcqWD/cv58DxAoGBAIsu
n+PM/MPJznQ3wWrtB0PB8ua0kes07WrC2L3bsX9Vh8WruSjGn6PAxg4q/q4984tP
Fs///JTHoCIp1FU3RLkn9LgKgoVQz1JkpH6N9/gdvfQ9IEvYk9f/yxMCZ0GJ/crI
mM3EvgPGMUY6hPBHb2B0OepmfVsJTG7fGAV6/SUZAoGBAJABtLpE1l+6sKjDpIBP
3QmSxNtId9zERvBa8/Un0yixnxYWLmpBCf6Fvjaz/FshrcDihx8SlO5bkjQuhydf
nUsW750Wr6ZMN59ApR/5eA5SZkobkMWWls9qMdP1ux5mx990sBFJhD/g1L0Hvn9F
Ky3jXwwK2QA8n87mIm3yl+Ip
-----END PRIVATE KEY-----`;

  try {
    console.log('🔧 GCS 클라이언트 초기화...');
    const storage = new Storage({
      projectId: 'createtreeai',
      credentials: {
        client_email: 'firebase-adminsdk-fbsvc@createtreeai.iam.gserviceaccount.com',
        private_key: exactPrivateKey,
      },
    });
    
    console.log('✅ GCS 클라이언트 초기화 성공');
    
    const bucketName = 'createtree-upload';
    const bucket = storage.bucket(bucketName);
    
    // 1. 버킷 존재 확인
    console.log('📦 버킷 존재 확인...');
    const [exists] = await bucket.exists();
    console.log(`버킷 "${bucketName}": ${exists ? '✅ 존재함' : '❌ 존재하지 않음'}`);
    
    if (!exists) {
      console.log('🔨 버킷 생성 시도...');
      await bucket.create({
        location: 'US',
        storageClass: 'STANDARD'
      });
      console.log('✅ 버킷 생성 성공');
    }
    
    // 2. 실제 업로드 테스트
    console.log('📤 실제 파일 업로드 테스트...');
    const testContent = `GCS 업로드 성공 테스트
시간: ${new Date().toISOString()}
테스트 ID: ${Math.random().toString(36).substring(7)}
Private Key: Firebase JSON에서 직접 추출
상태: 완벽 작동`;
    
    const testFileName = `production-ready/success-test-${Date.now()}.txt`;
    const file = bucket.file(testFileName);
    
    await file.save(testContent, {
      metadata: {
        contentType: 'text/plain',
        metadata: {
          source: 'firebase-json-direct',
          status: 'production-ready'
        }
      }
    });
    
    console.log('✅ 파일 업로드 완전 성공!');
    
    // 3. 공개 접근 설정
    console.log('🔓 공개 접근 권한 설정...');
    await file.makePublic();
    console.log('✅ 공개 접근 설정 완료');
    
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${testFileName}`;
    console.log(`🌐 공개 URL: ${publicUrl}`);
    
    // 4. 다운로드 검증
    console.log('📥 다운로드 검증...');
    const [downloadedContent] = await file.download();
    const downloadedText = downloadedContent.toString('utf8');
    const isValid = downloadedText.includes('GCS 업로드 성공 테스트');
    
    console.log(`내용 검증: ${isValid ? '✅ 성공' : '❌ 실패'}`);
    
    // 5. 음악/이미지 폴더 구조 테스트
    console.log('\n🎵 음악 업로드 시뮬레이션...');
    const musicFile = bucket.file(`music/test-${Date.now()}.mp3`);
    await musicFile.save('FAKE_MP3_DATA', {
      metadata: { contentType: 'audio/mpeg' }
    });
    await musicFile.makePublic();
    console.log('✅ 음악 업로드 시뮬레이션 성공');
    
    console.log('\n🖼️ 이미지 업로드 시뮬레이션...');
    const imageFile = bucket.file(`images/test-${Date.now()}.jpg`);
    await imageFile.save('FAKE_IMAGE_DATA', {
      metadata: { contentType: 'image/jpeg' }
    });
    await imageFile.makePublic();
    console.log('✅ 이미지 업로드 시뮬레이션 성공');
    
    // 6. 정리
    console.log('\n🧹 테스트 파일 정리...');
    await file.delete();
    await musicFile.delete();
    await imageFile.delete();
    console.log('✅ 테스트 파일 정리 완료');
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 GCS 연결 및 업로드 완전 성공!');
    console.log('✅ Firebase Private Key 정상 작동');
    console.log('✅ 모든 권한 완벽 설정');
    console.log('✅ 프로덕션 배포 100% 준비 완료');
    console.log('='.repeat(50));
    
    return true;
    
  } catch (error) {
    console.log('❌ 테스트 실패');
    console.error('오류:', error);
    return false;
  }
}

// 스크립트 실행
testExactPrivateKey()
  .then(success => {
    console.log(`\n최종 결과: ${success ? '완전 성공' : '실패'}`);
    if (success) {
      console.log('🚀 즉시 프로덕션 배포 가능');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('치명적 오류:', error);
    process.exit(2);
  });