/**
 * GCS 실제 파일명과 DB URL 동기화
 * 화면에서 확인된 실제 GCS 파일들과 DB 레코드를 매칭
 */

import { db } from './db/index';
import { music } from './shared/schema';
import { eq } from 'drizzle-orm';

// GCS 화면에서 확인된 실제 파일명들 (확장자 포함)
const actualGCSFiles = [
  "1918b981-2e62-47e3-a577-ce6a0.mp3",
  "204a501e-9f18-4133-b114-e532d4.mp3", 
  "205ec20e-9916-46e5-8e70-11dc9.mp3",
  "30.mp3",
  "359dbe82-b125-406a-b8d4-7902f.mp3",
  "4bedc9ae-7160-4106-9c92-50533.mp3",
  "54f41c69-24c4-4b7d-83d3-38ed54.mp3",
  "5861f45-66a3-4046-8447-2dea6.mp3",
  "61abd76b-a2c7-4756-b83c-80cf97.mp3",
  "6af7259b-b879-4777-b9c4-3391b.mp3",
  "77cdc31b-ff5d-4dce-89e4-90f0b8f.mp3",
  "80c05d8a-9ebb-4f68-baaa-7d1cba.mp3",
  "90_1749835759314.mp3",
  "a16cb7d0-6211-49ea-b969-80675.mp3",
  "a8adbf6d-7589-4e43-bdf4-2784fd.mp3",
  "c74a62bc-328b-451a-93bd-979f34.mp3",
  "cd94a531-dd3b-4a3f-aa48-cc53f3.mp3",
  "d91cdebe-e7df-4412-9d87-2849b.mp3",
  "d9f72699-35b1-414b-9a58-25414.mp3",
  "ef56f881-8394-4943-8dcc-e4489a.mp3",
  "e3a403bc-f53c-42ed-acc1-716574.mp3"
];

async function fixGCSMusicUrls() {
  try {
    console.log('🔧 GCS 음악 URL 수정 시작');

    // DB에서 GCS URL을 가진 모든 음악 레코드 조회
    const musicRecords = await db.select().from(music)
      .where(eq(music.status, 'completed'));

    console.log(`📋 총 ${musicRecords.length}개 음악 레코드 확인`);

    let fixedCount = 0;

    for (const record of musicRecords) {
      if (!record.url || !record.url.startsWith('https://storage.googleapis.com')) {
        continue;
      }

      // 현재 URL에서 파일명 추출
      const currentFileName = record.url.split('/').pop();
      if (!currentFileName) continue;

      // 실제 GCS 파일명과 매칭 시도
      const matchingFile = actualGCSFiles.find(file => 
        file.includes(record.id.toString()) || 
        currentFileName.includes(file) ||
        file.includes(currentFileName.replace('.mp3', ''))
      );

      if (matchingFile) {
        const newUrl = `https://storage.googleapis.com/createtree-upload/music/${matchingFile}`;
        const newGcsPath = `music/${matchingFile}`;

        await db.update(music)
          .set({ 
            url: newUrl,
            gcsPath: newGcsPath 
          })
          .where(eq(music.id, record.id));

        console.log(`✅ 음악 ID ${record.id}: ${currentFileName} → ${matchingFile}`);
        fixedCount++;
      }
    }

    console.log(`🎉 총 ${fixedCount}개 음악 URL 수정 완료`);

    // 테스트용 몇 개 URL 직접 확인
    const testUrls = [
      "https://storage.googleapis.com/createtree-upload/music/30.mp3",
      "https://storage.googleapis.com/createtree-upload/music/90_1749835759314.mp3"
    ];

    for (const url of testUrls) {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        console.log(`🔍 ${url}: ${response.status} ${response.statusText}`);
      } catch (error) {
        console.log(`❌ ${url}: 접근 실패`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('오류:', error);
    process.exit(1);
  }
}

fixGCSMusicUrls();