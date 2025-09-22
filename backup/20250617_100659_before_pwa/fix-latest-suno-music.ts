/**
 * 최신 Suno URL 음악들을 즉시 GCS로 다운로드
 * 음악 ID 88, 89를 안정적인 저장소로 이동
 */

import { db } from './db/index.js';
import { music } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import { uploadToGCS } from './server/utils/gcs.js';

async function fixLatestSunoMusic() {
  console.log('🎵 최신 Suno URL 음악들을 GCS로 즉시 다운로드 시작...');
  
  try {
    // Suno URL을 가진 최신 음악들 조회
    const sunoMusicList = await db.query.music.findMany({
      where: (music, { and, inArray, like }) => and(
        inArray(music.id, [88, 89]),
        like(music.url, '%suno.ai%')
      ),
      orderBy: (music, { desc }) => desc(music.id)
    });

    console.log(`📋 처리할 Suno 음악: ${sunoMusicList.length}개`);

    for (const musicItem of sunoMusicList) {
      console.log(`\n🎵 처리 중: ID ${musicItem.id} - ${musicItem.title}`);
      console.log(`📍 현재 URL: ${musicItem.url}`);

      if (!musicItem.url || !musicItem.url.includes('suno.ai')) {
        console.log(`⏭️ Suno URL이 아님, 건너뛰기`);
        continue;
      }

      // GCS 파일 경로 생성
      const fileName = `${musicItem.id}_${Date.now()}.mp3`;
      const gcsFilePath = `music/${fileName}`;
      
      try {
        console.log('📥 Suno URL에서 오디오 다운로드 시작...');
        
        // GCS에 업로드 (기존 유틸리티 사용)
        const gcsUrl = await uploadToGCS(musicItem.url, gcsFilePath);
        
        console.log('✅ GCS 파일 업로드 완료');
        
        // DB URL을 GCS URL로 업데이트
        await db.update(music)
          .set({ 
            url: gcsUrl,
            updatedAt: new Date()
          })
          .where(eq(music.id, musicItem.id));
        
        console.log(`✅ DB 업데이트 완료: ${gcsUrl}`);
        
      } catch (error) {
        console.error(`❌ 처리 오류 (ID: ${musicItem.id}):`, error);
      }
    }
    
    // 최종 상태 확인
    console.log('\n📊 최종 상태 확인:');
    const finalList = await db.query.music.findMany({
      where: (music, { inArray }) => inArray(music.id, [88, 89]),
      orderBy: (music, { desc }) => desc(music.id)
    });
    
    for (const musicItem of finalList) {
      const urlType = musicItem.url?.includes('storage.googleapis.com') ? 'GCS ✅' : 
                     musicItem.url?.includes('suno.ai') ? 'Suno ⚠️' : 
                     'Unknown ❓';
      console.log(`🎵 ID ${musicItem.id}: ${musicItem.title} - ${urlType}`);
    }
    
    console.log('\n🎉 최신 Suno 음악 GCS 이전 완료!');
    
  } catch (error) {
    console.error('❌ 전체 처리 오류:', error);
  }
}

// 스크립트 실행
fixLatestSunoMusic();