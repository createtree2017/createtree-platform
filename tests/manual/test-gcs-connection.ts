/**
 * GCS 연결 및 파일 업로드 테스트
 */

import { Storage } from '@google-cloud/storage';
import { promises as fs } from 'fs';
import { join } from 'path';

async function testGCSConnection() {
  console.log('🔍 GCS 연결 테스트 시작');
  console.log('='.repeat(50));
  
  try {
    // GCS 클라이언트 초기화
    console.log('📡 GCS 클라이언트 초기화...');
    const storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    });
    
    const bucketName = 'createtree-upload';
    const bucket = storage.bucket(bucketName);
    
    // 1. 버킷 존재 확인
    console.log('🪣 버킷 존재 확인...');
    const [bucketExists] = await bucket.exists();
    console.log(`버킷 "${bucketName}": ${bucketExists ? '✅ 존재함' : '❌ 존재하지 않음'}`);
    
    if (!bucketExists) {
      console.log('❌ 버킷이 존재하지 않습니다. 먼저 버킷을 생성해야 합니다.');
      return false;
    }
    
    // 2. 테스트 파일 생성
    console.log('📄 테스트 파일 생성...');
    const testContent = `GCS 연결 테스트 파일\n생성 시간: ${new Date().toISOString()}\n프로젝트: AI 우리병원 문화센터`;
    const testFileName = `test-connection-${Date.now()}.txt`;
    const localPath = join(process.cwd(), testFileName);
    
    await fs.writeFile(localPath, testContent, 'utf8');
    console.log(`✅ 로컬 테스트 파일 생성: ${testFileName}`);
    
    // 3. GCS 업로드 테스트
    console.log('📤 GCS 업로드 테스트...');
    const gcsPath = `test/${testFileName}`;
    const file = bucket.file(gcsPath);
    
    await bucket.upload(localPath, {
      destination: gcsPath,
      metadata: {
        contentType: 'text/plain',
        metadata: {
          source: 'environment-test',
          timestamp: Date.now().toString()
        }
      }
    });
    console.log(`✅ GCS 업로드 성공: gs://${bucketName}/${gcsPath}`);
    
    // 4. 공개 접근 권한 설정
    console.log('🔓 공개 접근 권한 설정...');
    await file.makePublic();
    console.log('✅ 공개 접근 권한 설정 완료');
    
    // 5. 공개 URL 생성 및 확인
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${gcsPath}`;
    console.log(`🌐 공개 URL: ${publicUrl}`);
    
    // 6. 파일 다운로드 테스트
    console.log('📥 파일 다운로드 테스트...');
    const [downloadedContent] = await file.download();
    const downloadedText = downloadedContent.toString('utf8');
    console.log('✅ 다운로드 성공');
    console.log(`내용 일치: ${downloadedText === testContent ? '✅' : '❌'}`);
    
    // 7. 기존 음악 파일 확인
    console.log('🎵 기존 음악 파일 확인...');
    const [musicFiles] = await bucket.getFiles({ prefix: 'music/' });
    console.log(`음악 파일 개수: ${musicFiles.length}개`);
    
    if (musicFiles.length > 0) {
      console.log('최근 음악 파일 3개:');
      musicFiles.slice(0, 3).forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.name}`);
      });
    }
    
    // 8. 기존 이미지 파일 확인
    console.log('🖼️ 기존 이미지 파일 확인...');
    const [imageFiles] = await bucket.getFiles({ prefix: 'images/' });
    console.log(`이미지 파일 개수: ${imageFiles.length}개`);
    
    if (imageFiles.length > 0) {
      console.log('최근 이미지 파일 3개:');
      imageFiles.slice(0, 3).forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.name}`);
      });
    }
    
    // 9. 정리
    console.log('🧹 테스트 파일 정리...');
    await file.delete();
    await fs.unlink(localPath);
    console.log('✅ 테스트 파일 삭제 완료');
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 GCS 연결 테스트 완료 - 모든 기능 정상');
    console.log('='.repeat(50));
    
    return true;
    
  } catch (error) {
    console.error('❌ GCS 연결 테스트 실패:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('private_key')) {
        console.log('\n💡 Private Key 형식 확인:');
        console.log('- \\n이 실제 개행으로 변환되는지 확인');
        console.log('- Private Key 전체가 올바르게 설정되었는지 확인');
      } else if (error.message.includes('project')) {
        console.log('\n💡 Project ID 확인:');
        console.log('- GOOGLE_CLOUD_PROJECT_ID가 올바른지 확인');
      } else if (error.message.includes('client_email')) {
        console.log('\n💡 Client Email 확인:');
        console.log('- GOOGLE_CLOUD_CLIENT_EMAIL이 올바른지 확인');
      }
    }
    
    return false;
  }
}

// 스크립트 실행
testGCSConnection()
  .then(success => {
    console.log(`\n최종 결과: ${success ? '성공' : '실패'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('치명적 오류:', error);
    process.exit(2);
  });