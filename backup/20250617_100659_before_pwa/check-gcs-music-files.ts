/**
 * GCS 버킷의 음악 파일 목록 확인 스크립트
 */
import { Storage } from '@google-cloud/storage';
import { db } from './db/index';
import { music } from './shared/schema';
import { eq } from 'drizzle-orm';

const storage = new Storage({
  projectId: 'createtreeai'
});

const bucketName = 'createtreeai.appspot.com';

async function checkGCSMusicFiles() {
  try {
    console.log('🎵 GCS 음악 파일 목록 확인 시작...');
    
    const bucket = storage.bucket(bucketName);
    const [files] = await bucket.getFiles({
      prefix: 'music/',
      delimiter: '/'
    });
    
    console.log(`\n📁 GCS 버킷 '${bucketName}'에서 음악 파일 ${files.length}개 발견:`);
    
    const musicFiles = [];
    
    for (const file of files) {
      const fileName = file.name;
      if (fileName.endsWith('.mp3') || fileName.endsWith('.wav') || fileName.endsWith('.m4a')) {
        const metadata = await file.getMetadata();
        const size = metadata[0].size;
        const created = metadata[0].timeCreated;
        
        musicFiles.push({
          name: fileName,
          size: `${Math.round(parseInt(size) / 1024)} KB`,
          created: new Date(created).toLocaleString('ko-KR'),
          url: `https://storage.googleapis.com/${bucketName}/${fileName}`
        });
        
        console.log(`\n🎵 파일명: ${fileName}`);
        console.log(`   크기: ${Math.round(parseInt(size) / 1024)} KB`);
        console.log(`   생성일: ${new Date(created).toLocaleString('ko-KR')}`);
        console.log(`   URL: https://storage.googleapis.com/${bucketName}/${fileName}`);
      }
    }
    
    console.log(`\n✅ 총 ${musicFiles.length}개의 음악 파일이 GCS에 저장되어 있습니다.`);
    
    // 데이터베이스의 음악 레코드와 GCS 파일 매칭 확인
    console.log('\n🔍 데이터베이스 음악 레코드와 GCS 파일 매칭 확인:');
    
    const dbMusicList = await db.query.music.findMany({
      where: eq(music.userId, 10),
      orderBy: (music, { desc }) => [desc(music.createdAt)]
    });
    
    for (const dbMusic of dbMusicList) {
      console.log(`\n📀 DB ID ${dbMusic.id}: "${dbMusic.title}"`);
      console.log(`   DB URL: ${dbMusic.url}`);
      
      // URL이 GCS 패턴인지 확인
      if (dbMusic.url && dbMusic.url.includes('googleapis.com')) {
        const fileName = dbMusic.url.split('/').pop();
        const matchingFile = musicFiles.find(f => f.name.includes(fileName || ''));
        
        if (matchingFile) {
          console.log(`   ✅ GCS 파일 매칭됨: ${matchingFile.name}`);
        } else {
          console.log(`   ❌ GCS 파일 찾을 수 없음`);
        }
      } else {
        console.log(`   ⚠️  외부 URL: ${dbMusic.url?.substring(0, 50)}...`);
      }
    }
    
    return musicFiles;
    
  } catch (error) {
    console.error('❌ GCS 음악 파일 확인 중 오류:', error);
    throw error;
  }
}

// 스크립트 실행
checkGCSMusicFiles()
  .then(() => {
    console.log('\n🎉 GCS 음악 파일 확인 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('스크립트 실행 실패:', error);
    process.exit(1);
  });