/**
 * 음악 ID 81 완료 처리 스크립트
 * TopMediai에서 생성 완료된 음악을 DB에 수동 저장
 */

import { db } from './db/index.js';
import { music } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function completeMusic81() {
  try {
    console.log('🎵 음악 ID 81 완료 처리 시작...');
    
    // 현재 상태 확인
    const currentRecord = await db.query.music.findFirst({
      where: eq(music.id, 81)
    });
    
    if (!currentRecord) {
      console.log('❌ 음악 ID 81을 찾을 수 없습니다');
      return;
    }
    
    console.log('📋 현재 상태:', currentRecord.status);
    console.log('📋 제목:', currentRecord.title);
    
    if (currentRecord.status === 'completed') {
      console.log('✅ 이미 완료된 음악입니다');
      return;
    }
    
    // TopMediai에서 생성된 음악 정보
    const musicUrl = 'https://audiopipe.suno.ai/?item_id=b31f58d3-92da-430a-ac52-bb1e7d22ccaf';
    const extractedLyrics = `[Verse]
깊은 밤의 고요 속에
피아노 건반 위로 흘러내린
송예승의 맑은 목소리
별빛처럼 빛나는 이야기

[Verse 2]
눈 감으면 들려오는 소리
심장 속에 새겨진 멜로디
송예승의 이름이 울리네
끝없는 꿈의 바다 속에서

[Chorus]
송예승 그 이름 속에
사랑과 희망이 춤추네
음표 하나하나에 담긴
우리의 이야기를 노래해

[Verse 3]
피아노가 속삭이는 비밀
송예승이 전하는 그 진실
바람 속에 흐르는 그 노래
우릴 이어주는 시간의 끈

[Bridge]
별이 되어 하늘을 비추고
노래가 되어 마음을 감싸네
송예승의 멜로디는
끝없는 하늘을 가득 채우네

[Chorus]
송예승 그 이름 속에
사랑과 희망이 춤추네
음표 하나하나에 담긴
우리의 이야기를 노래해`;
    
    // GCS 업로드를 위한 경로
    const gcsPath = `music/b31f58d3-92da-430a-ac52-bb1e7d22ccaf.mp3`;
    
    // GCS 업로드 시도
    let finalUrl = musicUrl;
    try {
      const { uploadToGCS } = await import('./server/utils/gcs.js');
      finalUrl = await uploadToGCS(musicUrl, gcsPath);
      console.log('✅ GCS 업로드 성공:', finalUrl);
    } catch (gcsError) {
      console.warn('⚠️ GCS 업로드 실패, 원본 URL 사용:', gcsError.message);
    }
    
    // DB 업데이트
    const updatedRecord = await db.update(music)
      .set({
        status: 'completed',
        originalUrl: finalUrl,
        transformedUrl: finalUrl,
        lyrics: extractedLyrics,
        title: '송예승의 멜로디',
        duration: 180,
        updatedAt: new Date(),
        metadata: JSON.stringify({
          engine: 'topmedia',
          songId: 'b31f58d3-92da-430a-ac52-bb1e7d22ccaf',
          completedAt: new Date().toISOString(),
          originalPrompt: 'Piano\\n인물의 이름을 가사에 넣어줘',
          babyName: '송예승'
        })
      })
      .where(eq(music.id, 81))
      .returning();
    
    console.log('🎉 음악 ID 81 완료 처리 성공!');
    console.log('📊 업데이트된 레코드:', {
      id: updatedRecord[0].id,
      title: updatedRecord[0].title,
      status: updatedRecord[0].status,
      url: updatedRecord[0].originalUrl
    });
    
    // 가사에서 인물 이름 확인
    const nameCount = extractedLyrics.split('송예승').length - 1;
    console.log(`🎵 가사에서 "송예승" 언급 횟수: ${nameCount}회`);
    
    if (nameCount > 0) {
      console.log('✅ 인물 이름이 가사에 성공적으로 포함됨');
    } else {
      console.log('⚠️ 인물 이름이 가사에 포함되지 않음');
    }
    
  } catch (error) {
    console.error('❌ 완료 처리 실패:', error);
  }
}

// 실행
completeMusic81().then(() => {
  console.log('스크립트 완료');
  process.exit(0);
}).catch(error => {
  console.error('스크립트 오류:', error);
  process.exit(1);
});