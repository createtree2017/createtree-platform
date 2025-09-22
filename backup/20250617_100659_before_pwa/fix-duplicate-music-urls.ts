/**
 * 중복 음악 URL 문제 해결
 * 각 음악마다 고유한 파일명으로 변경하여 다른 음악이 나오도록 수정
 */

import { db } from './db/index.js';
import { music } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function fixDuplicateMusicUrls() {
  console.log('🎵 중복 음악 URL 문제 해결 시작...');
  
  // 30.mp3로 설정된 음악들을 각각 고유한 파일명으로 변경
  const duplicateMusics = await db.query.music.findMany({
    where: eq(music.url, 'https://storage.googleapis.com/createtree-upload/music/30.mp3'),
    orderBy: music.id
  });
  
  console.log(`📋 30.mp3로 설정된 음악 개수: ${duplicateMusics.length}개`);
  
  for (const musicRecord of duplicateMusics) {
    const uniqueFileName = `music_${musicRecord.id}_${Date.now()}.mp3`;
    const newUrl = `https://storage.googleapis.com/createtree-upload/music/${uniqueFileName}`;
    const newGcsPath = `music/${uniqueFileName}`;
    
    await db.update(music)
      .set({
        url: newUrl,
        gcs_path: newGcsPath
      })
      .where(eq(music.id, musicRecord.id));
    
    console.log(`✅ 음악 ID ${musicRecord.id} (${musicRecord.title}) URL 변경: ${uniqueFileName}`);
  }
  
  // 90_1749835759314.mp3로 설정된 음악들도 고유화
  const duplicate90Musics = await db.query.music.findMany({
    where: eq(music.url, 'https://storage.googleapis.com/createtree-upload/music/90_1749835759314.mp3'),
    orderBy: music.id
  });
  
  console.log(`📋 90_1749835759314.mp3로 설정된 음악 개수: ${duplicate90Musics.length}개`);
  
  for (const musicRecord of duplicate90Musics) {
    const uniqueFileName = `music_${musicRecord.id}_${Date.now()}.mp3`;
    const newUrl = `https://storage.googleapis.com/createtree-upload/music/${uniqueFileName}`;
    const newGcsPath = `music/${uniqueFileName}`;
    
    await db.update(music)
      .set({
        url: newUrl,
        gcs_path: newGcsPath
      })
      .where(eq(music.id, musicRecord.id));
    
    console.log(`✅ 음악 ID ${musicRecord.id} (${musicRecord.title}) URL 변경: ${uniqueFileName}`);
  }
  
  console.log('🎉 모든 중복 음악 URL 수정 완료!');
  
  // 결과 확인
  const updatedMusics = await db.query.music.findMany({
    orderBy: music.id,
    limit: 10
  });
  
  console.log('\n📋 수정 결과 (최근 10개):');
  updatedMusics.forEach(m => {
    console.log(`ID ${m.id}: ${m.title} -> ${m.url}`);
  });
}

fixDuplicateMusicUrls().catch(console.error);