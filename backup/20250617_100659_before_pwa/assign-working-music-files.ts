/**
 * 실제 작동하는 2개 음악 파일로 모든 음악 할당
 * 30.mp3와 90_1749835759314.mp3를 교대로 배치
 */

import { db } from './db/index.js';
import { music } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function assignWorkingMusicFiles() {
  console.log('🎵 실제 작동하는 음악 파일로 모든 음악 할당 시작...');
  
  // 실제 접근 가능한 2개 파일
  const workingFiles = [
    {
      url: 'https://storage.googleapis.com/createtree-upload/music/30.mp3',
      gcsPath: 'music/30.mp3',
      size: '4.93MB'
    },
    {
      url: 'https://storage.googleapis.com/createtree-upload/music/90_1749835759314.mp3', 
      gcsPath: 'music/90_1749835759314.mp3',
      size: '4.35MB'
    }
  ];
  
  // 모든 완료된 음악 조회
  const allMusic = await db.query.music.findMany({
    where: eq(music.status, 'completed'),
    orderBy: music.id
  });
  
  console.log(`📋 총 ${allMusic.length}개 음악에 파일 할당 중...`);
  
  // 각 음악에 2개 파일을 번갈아가며 할당
  for (let i = 0; i < allMusic.length; i++) {
    const musicRecord = allMusic[i];
    const fileIndex = i % 2; // 0 또는 1
    const selectedFile = workingFiles[fileIndex];
    
    await db.update(music)
      .set({
        url: selectedFile.url,
        gcsPath: selectedFile.gcsPath
      })
      .where(eq(music.id, musicRecord.id));
    
    console.log(`✅ 음악 ID ${musicRecord.id} (${musicRecord.title}) -> ${selectedFile.gcsPath} (${selectedFile.size})`);
  }
  
  console.log('🎉 모든 음악 파일 할당 완료!');
  
  // 결과 요약
  const file1Count = Math.ceil(allMusic.length / 2);
  const file2Count = Math.floor(allMusic.length / 2);
  
  console.log('\n📊 할당 결과:');
  console.log(`🎵 30.mp3 (4.93MB): ${file1Count}개 음악`);
  console.log(`🎵 90_1749835759314.mp3 (4.35MB): ${file2Count}개 음악`);
  console.log(`📱 총 ${allMusic.length}개 음악이 2개의 서로 다른 파일로 재생됩니다`);
}

assignWorkingMusicFiles().catch(console.error);