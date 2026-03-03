/**
 * 기존 음악 파일 GCS 업로드 테스트
 */
import { uploadToGCS } from '../../server/utils/gcs';
import { db } from '../../db';
import { music } from '../../shared/schema';
import { eq } from 'drizzle-orm';

async function testExistingMusicGCS() {
  console.log('📁 기존 음악 파일 GCS 업로드 테스트');
  
  try {
    // TopMediai URL로 된 음악 찾기
    const existingMusic = await db.query.music.findFirst({
      where: eq(music.url, 'https://files.topmediai.com/aimusic/api/14933000/66544bba-0b17-4776-bc5c-97b73951079d-audio.mp3')
    });
    
    if (!existingMusic) {
      console.log('❌ TopMediai URL 음악을 찾을 수 없습니다');
      return;
    }
    
    console.log('🎵 기존 음악 정보:', {
      id: existingMusic.id,
      title: existingMusic.title,
      originalUrl: existingMusic.url
    });
    
    // GCS 업로드
    const gcsPath = `music/${existingMusic.songId || existingMusic.id}.mp3`;
    console.log('⬆️ GCS 업로드 시작:', gcsPath);
    
    const gcsUrl = await uploadToGCS(existingMusic.url, gcsPath);
    console.log('✅ GCS 업로드 성공:', gcsUrl);
    
    // 데이터베이스 URL 업데이트
    await db.update(music)
      .set({ url: gcsUrl })
      .where(eq(music.id, existingMusic.id));
    
    console.log('✅ 데이터베이스 URL 업데이트 완료');
    console.log(`📱 브라우저에서 접속 테스트: ${gcsUrl}`);
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
}

testExistingMusicGCS();