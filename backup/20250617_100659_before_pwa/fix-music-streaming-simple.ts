/**
 * 간단한 음악 스트리밍 수정
 * GCS URL을 공개 접근 가능한 URL로 변경
 */

import { db } from "./db/index.js";
import { music } from "./shared/schema.js";
import { eq } from "drizzle-orm";

async function fixMusicStreamingSimple() {
  console.log('🎵 음악 스트리밍 간단 수정 시작...');
  
  try {
    // GCS URL을 가진 음악 목록 조회
    const musicList = await db.query.music.findMany({
      where: (music, { like }) => like(music.url, '%storage.googleapis.com%'),
      orderBy: (music, { desc }) => desc(music.id)
    });
    
    console.log(`📋 총 ${musicList.length}개의 GCS 음악 파일 발견`);
    
    for (const musicRecord of musicList) {
      try {
        console.log(`\n🎵 처리 중: ID=${musicRecord.id}, URL=${musicRecord.url}`);
        
        // GCS URL을 공개 접근 URL로 변경
        // https://storage.googleapis.com/createtree-upload/music/89_1749835540319.mp3
        // -> https://storage.cloud.google.com/createtree-upload/music/89_1749835540319.mp3
        
        const currentUrl = musicRecord.url;
        const publicUrl = currentUrl.replace(
          'https://storage.googleapis.com/',
          'https://storage.cloud.google.com/'
        );
        
        console.log(`🔄 URL 변경: ${currentUrl} -> ${publicUrl}`);
        
        // 접근 테스트
        const testResponse = await fetch(publicUrl, { method: 'HEAD' });
        console.log(`🔍 접근 테스트 결과: ${testResponse.status} ${testResponse.statusText}`);
        
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
          console.log(`❌ 공개 URL 접근 실패: ${testResponse.status}`);
        }
        
      } catch (error) {
        console.error(`❌ 처리 오류 (ID: ${musicRecord.id}):`, error);
      }
    }
    
    console.log('\n🎉 음악 스트리밍 수정 완료!');
    
  } catch (error) {
    console.error('❌ 전체 처리 오류:', error);
  }
}

fixMusicStreamingSimple();