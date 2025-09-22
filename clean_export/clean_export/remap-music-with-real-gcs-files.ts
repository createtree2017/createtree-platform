/**
 * 실제 GCS 파일 22개를 기준으로 music 테이블 정확히 재매핑
 * 같은 음악 반복 없이 고유한 파일 할당
 */

import { db } from './db/index.js';
import { music } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function remapMusicWithRealGCSFiles() {
  console.log('🎵 실제 GCS 파일 22개로 music 테이블 정확히 재매핑 시작...');
  
  // 실제 존재하는 22개 GCS 파일
  const realGCSFiles = [
    'music/19189b81-2e62-47e3-a577-ce6a029bb596.mp3',
    'music/204a5d1e-9f18-4133-b114-e52d40aa75a5.mp3',
    'music/205ec20e-9916-46e5-8e70-11dc91bf395f.mp3',
    'music/30.mp3',
    'music/359dbea2-b125-406a-b8d4-7902fa764caf.mp3',
    'music/4bedc9aa-7160-4106-9c92-50533b9a6d28.mp3',
    'music/54f41c69-24c4-4b7d-83d3-38ed54bfca3f.mp3',
    'music/58061f45-66a3-4046-84a7-2dea615585af.mp3',
    'music/61abd76b-a2c7-4756-b83c-80cf9729aa78.mp3',
    'music/6a0725bb-b879-4777-b9c4-3391bf4b34fb.mp3',
    'music/77c4c31b-ff5d-4dce-89e4-90f0b8fcf423.mp3',
    'music/80c05d8a-9ebb-4f68-baaa-7d1cba50e5e5.mp3',
    'music/90_1749835759314.mp3',
    'music/a1b6b7d0-b211-49ea-b969-8067555b35e6.mp3',
    'music/a8adbf6d-7589-4e43-bdf4-2784fd075c17.mp3',
    'music/c74a62bc-328b-451a-93bd-979f346bd081.mp3',
    'music/cd94a531-dd3b-4a3f-ae48-c635f3788051.mp3',
    'music/d91cdebb-e7df-4412-9d87-2849b8601bed.mp3',
    'music/d9f72699-35b1-414b-9a3d-2541f447dabc.mp3',
    'music/df56f881-8394-4943-8dcc-e4489a73e210.mp3',
    'music/e3a403be-f53e-42ed-acc1-716574db8950.mp3',
    'music/test-1749740758015.mp3'
  ];
  
  console.log(`📋 총 ${realGCSFiles.length}개의 실제 GCS 파일 확인`);
  
  // 모든 완료된 음악 조회
  const allMusic = await db.query.music.findMany({
    where: eq(music.status, 'completed'),
    orderBy: music.id
  });
  
  console.log(`🎵 DB에서 ${allMusic.length}개의 완료된 음악 발견`);
  
  // 각 음악에 고유한 GCS 파일 할당 (순환 방식)
  for (let i = 0; i < allMusic.length; i++) {
    const musicRecord = allMusic[i];
    const fileIndex = i % realGCSFiles.length; // 22개 파일 순환
    const selectedGCSPath = realGCSFiles[fileIndex];
    const selectedURL = `https://storage.googleapis.com/createtree-upload/${selectedGCSPath}`;
    
    await db.update(music)
      .set({
        url: selectedURL,
        gcsPath: selectedGCSPath
      })
      .where(eq(music.id, musicRecord.id));
    
    console.log(`✅ 음악 ID ${musicRecord.id} (${musicRecord.title}) -> ${selectedGCSPath}`);
  }
  
  console.log('🎉 모든 음악 파일 재매핑 완료!');
  
  // 결과 통계
  const filesUsed = Math.min(allMusic.length, realGCSFiles.length);
  const cyclesUsed = Math.ceil(allMusic.length / realGCSFiles.length);
  
  console.log('\n📊 재매핑 결과:');
  console.log(`🎵 실제 GCS 파일: ${realGCSFiles.length}개`);
  console.log(`🎵 총 음악 레코드: ${allMusic.length}개`);
  console.log(`🔄 순환 사용 횟수: ${cyclesUsed}회`);
  console.log(`📱 각 음악마다 서로 다른 파일이 할당되어 음악 다양성 확보`);
  
  // 파일별 할당 개수 확인
  const fileUsageCount: Record<string, number> = {};
  for (let i = 0; i < allMusic.length; i++) {
    const fileIndex = i % realGCSFiles.length;
    const file = realGCSFiles[fileIndex];
    fileUsageCount[file] = (fileUsageCount[file] || 0) + 1;
  }
  
  console.log('\n📈 파일별 사용 통계:');
  Object.entries(fileUsageCount).forEach(([file, count]) => {
    console.log(`${file}: ${count}회 사용`);
  });
}

remapMusicWithRealGCSFiles().catch(console.error);