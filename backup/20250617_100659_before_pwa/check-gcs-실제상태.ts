/**
 * GCS 버킷의 실제 음악 파일 저장 상태 확인
 */
import { Storage } from '@google-cloud/storage';

async function checkGCSMusicFiles() {
  try {
    const storage = new Storage({
      projectId: 'createtreeai',
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });
    
    const bucketName = 'createtree-music';
    const bucket = storage.bucket(bucketName);
    
    console.log('=== GCS 음악 파일 실제 상태 확인 ===');
    
    const [files] = await bucket.getFiles({
      prefix: 'music/',
      maxResults: 20
    });
    
    console.log(`📁 총 ${files.length}개의 음악 파일이 GCS에 저장되어 있음`);
    
    if (files.length > 0) {
      console.log('\n최근 음악 파일들:');
      files.slice(-10).forEach((file, index) => {
        console.log(`${index + 1}. ${file.name}`);
        console.log(`   - 크기: ${Math.round(file.metadata.size / 1024)}KB`);
        console.log(`   - 생성일: ${file.metadata.timeCreated}`);
        console.log(`   - 공개 URL: https://storage.googleapis.com/${bucketName}/${file.name}`);
      });
    } else {
      console.log('❌ GCS에 음악 파일이 하나도 없음');
    }
    
    // 가장 최근 파일 상세 정보
    if (files.length > 0) {
      const latestFile = files[files.length - 1];
      console.log('\n🎵 가장 최근 파일 상세:');
      console.log(`파일명: ${latestFile.name}`);
      console.log(`크기: ${Math.round(latestFile.metadata.size / 1024)}KB`);
      console.log(`타입: ${latestFile.metadata.contentType}`);
      console.log(`생성시간: ${latestFile.metadata.timeCreated}`);
      
      // 공개 접근 가능한지 확인
      try {
        await latestFile.makePublic();
        console.log('✅ 파일이 공개 접근 가능함');
      } catch (error) {
        console.log('⚠️ 파일 공개 접근 설정 실패:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ GCS 확인 실패:', error.message);
  }
}

checkGCSMusicFiles();