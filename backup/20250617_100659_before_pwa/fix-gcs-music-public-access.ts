/**
 * GCS 음악 파일 공개 접근 권한 설정
 * 403 Forbidden 오류 해결
 */

import { Storage } from '@google-cloud/storage';
import { db } from './db/index.js';
import { music } from './shared/schema.js';
import { like } from 'drizzle-orm';

const storage = new Storage({
  projectId: 'createtreeai'
});

const bucket = storage.bucket('createtree-upload');

async function fixGCSMusicPublicAccess() {
  console.log('🔧 GCS 음악 파일 공개 접근 권한 설정 시작...');
  
  try {
    // 모든 음악 파일 조회
    const musicList = await db.select().from(music).where(like(music.url, '%storage.googleapis.com%'));
    
    console.log(`📂 처리할 음악 파일 수: ${musicList.length}개`);
    
    for (const musicItem of musicList) {
      if (!musicItem.url) continue;
      
      // GCS 파일 경로 추출
      const urlParts = musicItem.url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `music/${fileName}`;
      
      console.log(`🎵 처리 중: ${musicItem.title} (${filePath})`);
      
      try {
        const file = bucket.file(filePath);
        
        // 파일 존재 확인
        const [exists] = await file.exists();
        if (!exists) {
          console.log(`❌ 파일이 존재하지 않음: ${filePath}`);
          continue;
        }
        
        // 공개 읽기 권한 설정
        await file.makePublic();
        console.log(`✅ 공개 접근 권한 설정 완료: ${filePath}`);
        
      } catch (fileError) {
        console.error(`❌ 파일 처리 오류 (${filePath}):`, fileError);
      }
    }
    
    console.log('🎉 GCS 음악 파일 공개 접근 권한 설정 완료!');
    
  } catch (error) {
    console.error('❌ GCS 접근 권한 설정 실패:', error);
  }
}

// 스크립트 실행
fixGCSMusicPublicAccess().then(() => {
  console.log('✅ 작업 완료');
  process.exit(0);
}).catch(error => {
  console.error('❌ 스크립트 실행 오류:', error);
  process.exit(1);
});