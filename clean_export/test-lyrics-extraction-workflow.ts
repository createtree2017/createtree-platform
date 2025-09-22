/**
 * TopMediai 가사 추출 워크플로우 테스트
 * 실제 음악 생성 → 가사 추출 → DB 저장 → UI 표시 전체 과정 검증
 */

import { generateMusic } from './server/services/music-engine-service.js';
import { extractLyricsFromMusic } from './server/services/lyrics-extraction-service.js';
import { db } from './db/index.js';
import { music } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function testLyricsExtractionWorkflow() {
  console.log('🎵 TopMediai 가사 추출 워크플로우 전체 테스트');
  
  try {
    // 1단계: TopMediai로 음악 생성
    console.log('\n1️⃣ TopMediai 음악 생성');
    
    const musicRequest = {
      prompt: "아기를 위한 부드러운 자장가",
      style: "lullaby",
      duration: 60,
      title: "가사 추출 테스트 음악",
      userId: "10"
    };
    
    console.log('음악 생성 요청:', musicRequest);
    
    const musicResult = await generateMusic(musicRequest);
    console.log('음악 생성 결과:', musicResult);
    
    if (!musicResult.success || !musicResult.audioUrl) {
      console.log('❌ 음악 생성 실패');
      return;
    }
    
    // 2단계: 데이터베이스에 저장
    console.log('\n2️⃣ 데이터베이스에 음악 저장');
    
    const [savedMusic] = await db.insert(music).values({
      title: musicRequest.title,
      prompt: musicRequest.prompt,
      style: musicRequest.style,
      originalUrl: musicResult.audioUrl,
      transformedUrl: musicResult.audioUrl,
      engine: 'topmedia',
      status: 'completed',
      userId: musicRequest.userId,
      externalId: musicResult.taskId,
      duration: musicResult.duration || 60,
      lyrics: musicResult.lyrics || null
    }).returning();
    
    console.log('DB 저장 완료:', { id: savedMusic.id, title: savedMusic.title });
    
    // 3단계: 가사가 없으면 Whisper로 추출
    if (!savedMusic.lyrics && savedMusic.originalUrl) {
      console.log('\n3️⃣ Whisper를 사용한 가사 추출');
      
      try {
        const extractedLyrics = await extractLyricsFromMusic(savedMusic.originalUrl);
        
        if (extractedLyrics) {
          console.log(`✅ 가사 추출 성공: ${extractedLyrics.length}자`);
          console.log('추출된 가사 미리보기:', extractedLyrics.substring(0, 100) + '...');
          
          // 데이터베이스에 가사 업데이트
          await db.update(music)
            .set({ lyrics: extractedLyrics })
            .where(eq(music.id, savedMusic.id));
          
          console.log('✅ 데이터베이스에 가사 저장 완료');
          
        } else {
          console.log('❌ 가사 추출 실패 - 음성에서 의미있는 가사를 찾을 수 없음');
        }
        
      } catch (extractionError: any) {
        console.log(`❌ 가사 추출 오류: ${extractionError.message}`);
      }
    } else {
      console.log('\n3️⃣ 이미 가사가 있거나 음악 URL이 없음');
    }
    
    // 4단계: 최종 결과 확인
    console.log('\n4️⃣ 최종 결과 확인');
    
    const finalMusic = await db.query.music.findFirst({
      where: eq(music.id, savedMusic.id)
    });
    
    if (finalMusic) {
      console.log('최종 음악 정보:');
      console.log(`- ID: ${finalMusic.id}`);
      console.log(`- 제목: ${finalMusic.title}`);
      console.log(`- 상태: ${finalMusic.status}`);
      console.log(`- 엔진: ${finalMusic.engine}`);
      console.log(`- 가사 여부: ${finalMusic.lyrics ? '있음' : '없음'}`);
      if (finalMusic.lyrics) {
        console.log(`- 가사 길이: ${finalMusic.lyrics.length}자`);
        console.log(`- 가사 미리보기: ${finalMusic.lyrics.substring(0, 50)}...`);
      }
    }
    
    console.log('\n🎉 가사 추출 워크플로우 테스트 완료');
    
  } catch (error: any) {
    console.error('❌ 워크플로우 테스트 실패:', error.message);
    console.error('상세 오류:', error);
  }
}

testLyricsExtractionWorkflow().catch(console.error);