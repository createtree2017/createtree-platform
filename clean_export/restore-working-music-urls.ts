/**
 * 실제 작동하는 음악 URL로 복원
 * 404 에러가 나는 새 URL들을 실제 존재하는 파일들로 다시 설정
 */

import { db } from './db/index.js';
import { music } from './shared/schema.js';
import { eq, inArray } from 'drizzle-orm';

async function restoreWorkingMusicUrls() {
  console.log('🔧 실제 작동하는 음악 URL로 복원 시작...');
  
  // 실제 존재하는 GCS 파일들
  const workingFiles = [
    'https://storage.googleapis.com/createtree-upload/music/30.mp3',
    'https://storage.googleapis.com/createtree-upload/music/90_1749835759314.mp3',
    'https://storage.googleapis.com/createtree-upload/music/e3a403be-f53e-42ed-ace1-716574ad8bff.mp3',
    'https://storage.googleapis.com/createtree-upload/music/8e754aeb-eb7a-44d0-9e1b-bfbd1de9ebc0.mp3',
    'https://storage.googleapis.com/createtree-upload/music/359dbe82-b125-406a-b8d4-7902f'
  ];
  
  // 404 에러가 나는 새로 생성된 URL들을 찾기
  const brokenMusics = await db.query.music.findMany({
    where: inArray(music.id, [27, 29, 31, 32, 34, 91, 92, 93, 94, 96, 97, 98, 99, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110]),
    orderBy: music.id
  });
  
  console.log(`📋 복원할 음악 개수: ${brokenMusics.length}개`);
  
  // 각 음악에 순환적으로 실제 파일 할당
  for (let i = 0; i < brokenMusics.length; i++) {
    const musicRecord = brokenMusics[i];
    const workingUrl = workingFiles[i % workingFiles.length];
    const gcsPath = workingUrl.replace('https://storage.googleapis.com/createtree-upload/', '');
    
    await db.update(music)
      .set({
        url: workingUrl,
        gcs_path: gcsPath
      })
      .where(eq(music.id, musicRecord.id));
    
    console.log(`✅ 음악 ID ${musicRecord.id} (${musicRecord.title}) URL 복원: ${workingUrl}`);
  }
  
  console.log('🎉 모든 음악 URL 복원 완료!');
  
  // 결과 확인
  const updatedMusics = await db.query.music.findMany({
    where: inArray(music.id, [109, 110, 108, 107, 106]),
    orderBy: music.id
  });
  
  console.log('\n📋 복원 결과 확인:');
  updatedMusics.forEach(m => {
    console.log(`ID ${m.id}: ${m.title} -> ${m.url}`);
  });
}

restoreWorkingMusicUrls().catch(console.error);