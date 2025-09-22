/**
 * GCS 파일들과 DB 동기화
 * 파일명에서 music ID를 추출하여 gcs_path와 url 필드 업데이트
 */

import { db } from './db';
import { music } from './shared/schema';
import { eq } from 'drizzle-orm';

// GCS에 실제 존재하는 파일들 (스크린샷에서 확인)
const actualGCSFiles = [
  // 스크린샷에서 확인된 실제 파일들
  { id: 90, filename: '90_1749835759314.mp3' },
  { filename: '19189b81-2e62-47e3-a577-ce63da6ccd3e.mp3' }, // ID 추출 불가
  { filename: '204a5d1e-9f18-4133-b114-e52d403b6e59.mp3' }, // ID 추출 불가  
  { filename: '205ec20e-9916-46e5-8e70-11dc917e3a8f.mp3' }, // ID 추출 불가
  { filename: '30.mp3' }, // ID 30으로 추정
  { filename: '359dbea2-b125-406a-b8d4-7902fdff3547.mp3' }, // ID 추출 불가
  { filename: '4bedc9aa-7160-4106-9c92-50533a4d0c7e.mp3' }, // ID 추출 불가
  { filename: '54f41c69-24c4-4b7d-83d3-38ed543b7d18.mp3' }, // ID 추출 불가
  { filename: '58061f45-66a3-4046-84a7-2dea6d3ec0d2.mp3' }, // ID 추출 불가
  { filename: '61abd76b-a2c7-4756-b83c-80cf972aa1c3.mp3' }, // ID 추출 불가
  { filename: '6a0725bb-b879-4777-b9c4-3391b7ee08a0.mp3' }, // ID 추출 불가
  { filename: '77c4c31b-ff5d-4dce-89e4-90f0b8f2e3f2.mp3' }, // ID 추출 불가
  { filename: '80c05d8a-9ebb-4f68-baaa-7d1cba7b6c4d.mp3' }, // ID 추출 불가
  { filename: 'a1b6b7d0-b211-49ea-b969-80675fb3c02d.mp3' }, // ID 추출 불가
  { filename: 'a8adbf6d-7589-4e43-bdf4-2784fdc8e3bc.mp3' }, // ID 추출 불가
  { filename: 'c74a62bc-328b-451a-93bd-979f34d2b4e6.mp3' }, // ID 추출 불가
  { filename: 'cd94a531-dd3b-4a3f-ae48-c635f321e4b0.mp3' }, // ID 추출 불가
  { filename: 'd91cdebb-e7df-4412-9d87-2849b38e4f5e.mp3' }, // ID 추출 불가
  { filename: 'd9f72699-35b1-414b-9a3d-2541f4d28c1a.mp3' }, // ID 추출 불가
  { filename: 'df56f881-8394-4943-9dcc-e4489aca1d25.mp3' }, // ID 추출 불가
  { filename: 'e3a403be-f53e-42ed-ace1-716574ad8bff.mp3' }, // ID 추출 불가
  { filename: 'test-1749740758015.mp3' } // 테스트 파일
];

async function restoreGCSPaths() {
  try {
    console.log('🔄 GCS 파일 경로 복원 시작');
    
    let updateCount = 0;
    
    for (const file of knownGCSFiles) {
      // DB에서 해당 음악 확인
      const musicRecord = await db.query.music.findFirst({
        where: eq(music.id, file.id),
        columns: { id: true, title: true, url: true, gcsPath: true, status: true }
      });
      
      if (musicRecord) {
        const gcsUrl = `https://storage.cloud.google.com/createtree-upload/music/${file.filename}`;
        
        // GCS URL이 아닌 경우에만 업데이트
        if (!musicRecord.url.includes('storage.cloud.google.com')) {
          await db.update(music)
            .set({
              url: gcsUrl,
              gcsPath: `music/${file.filename}`,
              status: 'completed',
              updatedAt: new Date()
            })
            .where(eq(music.id, file.id));
          
          updateCount++;
          console.log(`✅ 업데이트: ID ${file.id} - ${musicRecord.title}`);
          console.log(`   URL: ${gcsUrl}`);
        } else {
          console.log(`⏭️  이미 GCS URL: ID ${file.id} - ${musicRecord.title}`);
        }
      } else {
        console.log(`⚠️  DB에 없는 음악: ID ${file.id}`);
      }
    }
    
    console.log(`\n🎉 복원 완료!`);
    console.log(`📊 업데이트된 음악: ${updateCount}개`);
    
    // 최종 GCS 음악 목록 확인
    const finalResult = await db.execute(`
      SELECT id, title, url 
      FROM music 
      WHERE url LIKE 'https://storage.cloud.google.com%' 
      ORDER BY id DESC
    `);
    
    console.log(`\n🎵 최종 GCS 음악 목록: ${finalResult.rows.length}개`);
    finalResult.rows.forEach((row: any) => {
      console.log(`  - ID ${row.id}: ${row.title}`);
    });
    
  } catch (error) {
    console.error('❌ 복원 중 오류:', error);
  }
}

restoreGCSPaths();