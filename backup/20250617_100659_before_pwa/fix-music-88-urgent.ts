/**
 * 음악 ID 88 긴급 GCS 다운로드
 * Suno URL을 안정적인 GCS로 즉시 변경
 */

import { db } from './db/index.js';
import { music } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import { uploadToGCS } from './server/utils/gcs.js';

async function fixMusic88Urgent() {
  console.log('🚨 음악 ID 88 긴급 GCS 다운로드 시작...');
  
  try {
    // 음악 ID 88 조회
    const musicItem = await db.query.music.findFirst({
      where: eq(music.id, 88)
    });
    
    if (!musicItem) {
      console.log('❌ 음악 ID 88을 찾을 수 없습니다.');
      return;
    }
    
    console.log(`📍 현재 URL: ${musicItem.url}`);
    
    if (!musicItem.url || !musicItem.url.includes('suno.ai')) {
      console.log('✅ 이미 GCS URL입니다.');
      return;
    }
    
    // GCS 파일 경로 생성
    const fileName = `88_${Date.now()}.mp3`;
    const gcsFilePath = `music/${fileName}`;
    
    console.log('📥 Suno URL에서 GCS로 다운로드 시작...');
    
    // GCS에 업로드
    const gcsUrl = await uploadToGCS(musicItem.url, gcsFilePath);
    
    console.log('✅ GCS 파일 업로드 완료');
    
    // DB URL을 GCS URL로 업데이트
    await db.update(music)
      .set({ 
        url: gcsUrl,
        updatedAt: new Date()
      })
      .where(eq(music.id, 88));
    
    console.log(`✅ DB 업데이트 완료: ${gcsUrl}`);
    
    // 최종 확인
    const updatedMusic = await db.query.music.findFirst({
      where: eq(music.id, 88)
    });
    
    console.log(`🎵 최종 URL: ${updatedMusic?.url}`);
    console.log('🎉 음악 ID 88 GCS 이전 완료!');
    
  } catch (error) {
    console.error('❌ 처리 오류:', error);
  }
}

// 스크립트 실행
fixMusic88Urgent();