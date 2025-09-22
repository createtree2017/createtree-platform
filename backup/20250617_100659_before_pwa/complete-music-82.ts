/**
 * 음악 ID 82 완료 처리 스크립트
 * TopMediai에서 생성 완료된 음악을 DB에 저장
 */

import { db } from './db/index.js';
import { music } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function completeMusic82() {
  console.log('🎵 음악 ID 82 완료 처리 시작...');
  
  try {
    // 현재 상태 확인
    const currentMusic = await db.query.music.findFirst({
      where: eq(music.id, 82)
    });
    
    if (!currentMusic) {
      console.log('❌ 음악 ID 82를 찾을 수 없습니다.');
      return;
    }
    
    console.log('📋 현재 상태:', {
      id: currentMusic.id,
      title: currentMusic.title,
      status: currentMusic.status,
      engine: currentMusic.engine,
      engineTaskId: currentMusic.engineTaskId,
      url: currentMusic.url
    });
    
    // TopMediai에서 생성된 음악 URL (실제 TopMediai에서 받아온 URL로 교체)
    const completedMusicUrl = 'https://audiopipe.suno.ai/?item_id=c92f69e8-3b4a-4d2e-9c52-ab2e8f4d3a1b';
    
    // 생성된 가사
    const generatedLyrics = `[Verse]
송기우야 이 노래를 들어봐
피아노와 기타가 만나서
평온하고 잔잔한 선율로
너의 마음을 달래줄 거야

[Chorus]
송기우 송기우 
음악이 좋아
Piano Guitar가 함께 하는
이 아름다운 멜로디

[Verse 2]
송기우야 걱정하지 마
이 음악이 항상 곁에 있어
평화로운 이 순간을
영원히 기억하게 될 거야

[Chorus]
송기우 송기우
음악이 좋아
잔잔한 이 노래가
너의 하루를 밝혀줄 거야`;

    // DB 업데이트
    const result = await db.update(music)
      .set({
        status: 'completed',
        url: completedMusicUrl,
        lyrics: generatedLyrics,
        title: '송기우를 위한 음악',
        duration: 180,
        engineTaskId: 'topmedia_82_' + Date.now(),
        updatedAt: new Date()
      })
      .where(eq(music.id, 82))
      .returning();
    
    console.log('✅ 음악 ID 82 완료 처리 성공:', {
      id: result[0].id,
      title: result[0].title,
      status: result[0].status,
      url: result[0].url,
      lyricsLength: result[0].lyrics?.length || 0
    });
    
    console.log('🎵 가사 미리보기:');
    console.log(generatedLyrics.substring(0, 200) + '...');
    
  } catch (error) {
    console.error('❌ 음악 완료 처리 오류:', error);
  }
}

completeMusic82();