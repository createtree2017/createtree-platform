/**
 * 음악 ID 80 완료 처리 스크립트
 * TopMediai에서 생성 완료된 음악을 DB에 저장
 */

import { db } from './db/index.js';
import { eq } from 'drizzle-orm';

async function completeMusicRecord() {
  console.log('\n=== 음악 ID 80 완료 처리 ===\n');

  try {
    // 1. 현재 상태 확인
    const musicRecord = await db.execute(`
      SELECT id, title, status, url, lyrics, created_at, updated_at 
      FROM music WHERE id = 80
    `);

    if (musicRecord.rows.length === 0) {
      console.log('❌ 음악 ID 80을 찾을 수 없습니다.');
      return;
    }

    const record = musicRecord.rows[0] as any;
    console.log('현재 상태:', record);

    // 2. TopMediai에서 생성된 데이터로 업데이트
    const finalUrl = 'https://audiopipe.suno.ai/?item_id=77c4c31b-ff5d-4dce-89e4-90f0b8fcf423';
    const lyrics = `[Verse]
작은 손가락에 꿈을 담아
따스한 햇살이 널 감싸 안아
내 품에 안긴 너의 미소
세상 가장 소중한 보물 같아

[Verse 2]
첫 걸음 떼는 널 바라보며
심장이 뛰는 걸 느껴보네
너의 모든 순간 기억할게
이 아빠의 마음 영원히 함께

[Chorus]
너는 나의 빛 너는 나의 별
밤하늘의 별처럼 반짝이는 널
세상이 변해도 변치 않을 사랑
내 마음은 언제나 너를 향해

[Verse 3]
네 목소리로 부르는 작은 노래
그 멜로디 속에 담긴 너의 꿈
언제나 너의 곁에 서 있을게
내 손을 잡고 함께 걸어가자

[Bridge]
울고 웃고 함께한 시간들
너와 나의 이야기는 끝이 없어
넌 내 삶의 이유 내 전부야
이 사랑은 멈추지 않을 거야

[Chorus]
너는 나의 빛 너는 나의 별
밤하늘의 별처럼 반짝이는 널
세상이 변해도 변치 않을 사랑
내 마음은 언제나 너를 향해`;

    // 3. 완료 상태로 업데이트
    const updateResult = await db.execute(`
      UPDATE music 
      SET 
        status = 'completed',
        url = $1,
        lyrics = $2,
        updated_at = NOW()
      WHERE id = 80
    `, [finalUrl, lyrics]);

    console.log('\n✅ 음악 ID 80 완료 처리 성공');
    console.log('- URL:', finalUrl);
    console.log('- 가사 길이:', lyrics.length, '자');
    console.log('- 업데이트된 행:', updateResult.rowCount);

    // 4. 최종 확인
    const finalRecord = await db.execute(`
      SELECT id, title, status, url, lyrics, created_at, updated_at 
      FROM music WHERE id = 80
    `);

    console.log('\n📋 최종 상태:');
    console.log(finalRecord.rows[0]);

  } catch (error) {
    console.error('❌ 완료 처리 중 오류:', error);
  }
}

completeMusicRecord();