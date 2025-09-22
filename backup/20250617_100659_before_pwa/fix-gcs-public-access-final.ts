/**
 * GCS 음악 파일 공개 접근 권한 최종 설정
 * 모든 음악 파일에 allUsers:objectViewer 권한 부여
 */

import { Storage } from '@google-cloud/storage';
import { db } from "./db/index.js";
import { music } from "./shared/schema.js";
import { eq } from "drizzle-orm";

const storage = new Storage({
  projectId: 'createtreeai',
  keyFilename: './server/firebase.json'
});

const bucket = storage.bucket('createtree-upload');

async function setPublicAccess() {
  console.log('🔧 GCS 음악 파일 공개 접근 권한 설정 시작...');
  
  try {
    // DB에서 모든 GCS URL 음악 조회
    const musicList = await db.query.music.findMany({
      where: (music, { like }) => like(music.url, '%storage.%google%'),
      orderBy: (music, { desc }) => desc(music.id)
    });
    
    console.log(`📋 총 ${musicList.length}개의 GCS 음악 파일 발견`);
    
    for (const musicRecord of musicList) {
      try {
        console.log(`\n🎵 처리 중: ID=${musicRecord.id}, URL=${musicRecord.url}`);
        
        // URL에서 파일 경로 추출
        const urlParts = musicRecord.url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const filePath = `music/${fileName}`;
        
        console.log(`📁 파일 경로: ${filePath}`);
        
        const file = bucket.file(filePath);
        
        // 파일 존재 확인
        const [exists] = await file.exists();
        if (!exists) {
          console.log(`❌ 파일이 존재하지 않음: ${filePath}`);
          continue;
        }
        
        // 공개 읽기 권한 부여
        await file.makePublic();
        console.log(`✅ 공개 접근 권한 설정 완료: ${filePath}`);
        
        // 새로운 공개 URL 생성
        const publicUrl = `https://storage.googleapis.com/createtree-upload/${filePath}`;
        
        // URL 접근 테스트
        const testResponse = await fetch(publicUrl, { method: 'HEAD' });
        console.log(`🔍 접근 테스트: ${testResponse.status} ${testResponse.statusText}`);
        
        if (testResponse.ok) {
          // DB 업데이트
          await db.update(music)
            .set({ 
              url: publicUrl,
              updatedAt: new Date()
            })
            .where(eq(music.id, musicRecord.id));
          
          console.log(`✅ DB 업데이트 완료: ${publicUrl}`);
        } else {
          console.log(`⚠️ 공개 URL 접근 실패, 원본 URL 유지`);
        }
        
      } catch (error) {
        console.error(`❌ 파일 처리 오류 (ID: ${musicRecord.id}):`, error);
      }
    }
    
    console.log('\n🎉 GCS 공개 접근 권한 설정 완료!');
    
  } catch (error) {
    console.error('❌ 전체 처리 오류:', error);
  }
}

setPublicAccess();