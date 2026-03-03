/**
 * GCS에 실제 저장된 음악 파일들과 DB를 동기화
 * GCS 파일 목록을 조회하여 DB의 url 필드를 업데이트
 */

import { db } from '../../db';
import { music } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// GCS에 실제 존재하는 22개 파일 (스크린샷에서 확인)
const gcsFiles = [
  { filename: '19189b81-2e62-47e3-a577-ce63da6ccd3e.mp3', size: '1.9MB', date: '2025.6.13 AM 12:43:53' },
  { filename: '204a5d1e-9f18-4133-b114-e52d403b6e59.mp3', size: '4.5MB', date: '2025.6.13 PM 5:10:35' },
  { filename: '205ec20e-9916-46e5-8e70-11dc917e3a8f.mp3', size: '3.5MB', date: '2025.6.13 PM 4:48:03' },
  { filename: '30.mp3', size: '5.2MB', date: '2025.6.13 AM 12:08:24' },
  { filename: '359dbea2-b125-406a-b8d4-7902fdff3547.mp3', size: '3.9MB', date: '2025.6.13 PM 5:20:48' },
  { filename: '4bedc9aa-7160-4106-9c92-50533a4d0c7e.mp3', size: '4.4MB', date: '2025.6.13 PM 2:39:39' },
  { filename: '54f41c69-24c4-4b7d-83d3-38ed543b7d18.mp3', size: '5.1MB', date: '2025.6.13 AM 12:29:49' },
  { filename: '58061f45-66a3-4046-84a7-2dea6d3ec0d2.mp3', size: '4.5MB', date: '2025.6.13 AM 9:08:56' },
  { filename: '61abd76b-a2c7-4756-b83c-80cf972aa1c3.mp3', size: '3.6MB', date: '2025.6.13 PM 5:31:07' },
  { filename: '6a0725bb-b879-4777-b9c4-3391b7ee08a0.mp3', size: '4.8MB', date: '2025.6.13 AM 10:01:02' },
  { filename: '77c4c31b-ff5d-4dce-89e4-90f0b8f2e3f2.mp3', size: '3.9MB', date: '2025.6.13 PM 6:45:39' },
  { filename: '80c05d8a-9ebb-4f68-baaa-7d1cba7b6c4d.mp3', size: '4.5MB', date: '2025.6.13 AM 10:29:22' },
  { filename: '90_1749835759314.mp3', size: '4.6MB', date: '2025.6.14 AM 2:31:29' },
  { filename: 'a1b6b7d0-b211-49ea-b969-80675fb3c02d.mp3', size: '5.7MB', date: '2025.6.13 PM 2:44:48' },
  { filename: 'a8adbf6d-7589-4e43-bdf4-2784fdc8e3bc.mp3', size: '3.9MB', date: '2025.6.13 PM 1:32:41' },
  { filename: 'c74a62bc-328b-451a-93bd-979f34d2b4e6.mp3', size: '4.6MB', date: '2025.6.13 PM 5:23:40' },
  { filename: 'cd94a531-dd3b-4a3f-ae48-c635f321e4b0.mp3', size: '4MB', date: '2025.6.13 PM 6:03:43' },
  { filename: 'd91cdebb-e7df-4412-9d87-2849b38e4f5e.mp3', size: '4.5MB', date: '2025.6.13 PM 1:52:30' },
  { filename: 'd9f72699-35b1-414b-9a3d-2541f4d28c1a.mp3', size: '3.4MB', date: '2025.6.13 PM 4:57:06' },
  { filename: 'df56f881-8394-4943-9dcc-e4489aca1d25.mp3', size: '5.4MB', date: '2025.6.13 PM 2:15:07' },
  { filename: 'e3a403be-f53e-42ed-ace1-716574ad8bff.mp3', size: '3.6MB', date: '2025.6.13 PM 7:11:03' },
  { filename: 'test-1749740758015.mp3', size: '5.2MB', date: '2025.6.13 AM 12:06:00' }
];

async function syncGCSUrls() {
  try {
    console.log('🔄 GCS URL 동기화 시작');
    
    // DB에서 최근 completed 음악 22개 조회
    const recentMusic = await db.execute(`
      SELECT id, title, url, created_at, status
      FROM music 
      WHERE status = 'completed'
      ORDER BY created_at DESC
      LIMIT 22
    `);
    
    console.log(`📊 DB completed 음악: ${recentMusic.rows.length}개`);
    console.log(`📊 GCS 파일: ${gcsFiles.length}개`);
    
    let updateCount = 0;
    
    // 수동 매핑 (생성일 기준)
    const manualMappings = [
      { musicId: 90, filename: '90_1749835759314.mp3' }, // 이미 매핑됨
      { musicId: 34, filename: '54f41c69-24c4-4b7d-83d3-38ed543b7d18.mp3' }, // 2025.6.13 AM 12:29:49
      { musicId: 32, filename: '58061f45-66a3-4046-84a7-2dea6d3ec0d2.mp3' }, // 2025.6.13 AM 9:08:56
      { musicId: 31, filename: '6a0725bb-b879-4777-b9c4-3391b7ee08a0.mp3' }, // 2025.6.13 AM 10:01:02
      { musicId: 29, filename: '80c05d8a-9ebb-4f68-baaa-7d1cba7b6c4d.mp3' }, // 2025.6.13 AM 10:29:22
      { musicId: 27, filename: '19189b81-2e62-47e3-a577-ce63da6ccd3e.mp3' }, // 2025.6.13 AM 12:43:53
    ];
    
    // 추가 음악들 매핑 (created_at 기준으로 추정)
    const additionalMappings = [
      { musicId: 30, filename: '30.mp3' },
      { musicId: 85, filename: 'a8adbf6d-7589-4e43-bdf4-2784fdc8e3bc.mp3' },
      { musicId: 82, filename: 'd91cdebb-e7df-4412-9d87-2849b38e4f5e.mp3' },
      { musicId: 80, filename: 'df56f881-8394-4943-9dcc-e4489aca1d25.mp3' },
      { musicId: 79, filename: '4bedc9aa-7160-4106-9c92-50533a4d0c7e.mp3' },
      { musicId: 69, filename: 'a1b6b7d0-b211-49ea-b969-80675fb3c02d.mp3' },
      { musicId: 68, filename: '205ec20e-9916-46e5-8e70-11dc917e3a8f.mp3' },
      { musicId: 67, filename: 'd9f72699-35b1-414b-9a3d-2541f4d28c1a.mp3' },
      { musicId: 65, filename: '204a5d1e-9f18-4133-b114-e52d403b6e59.mp3' },
      { musicId: 62, filename: '359dbea2-b125-406a-b8d4-7902fdff3547.mp3' },
      { musicId: 61, filename: 'c74a62bc-328b-451a-93bd-979f34d2b4e6.mp3' },
      { musicId: 56, filename: '61abd76b-a2c7-4756-b83c-80cf972aa1c3.mp3' },
      { musicId: 40, filename: 'cd94a531-dd3b-4a3f-ae48-c635f321e4b0.mp3' },
      { musicId: 39, filename: '77c4c31b-ff5d-4dce-89e4-90f0b8f2e3f2.mp3' },
      { musicId: 38, filename: 'e3a403be-f53e-42ed-ace1-716574ad8bff.mp3' },
      { musicId: 37, filename: 'test-1749740758015.mp3' }
    ];
    
    const allMappings = [...manualMappings, ...additionalMappings];
    
    for (const mapping of allMappings) {
      const gcsUrl = `https://storage.googleapis.com/createtree-upload/music/${mapping.filename}`;
      
      // DB에서 해당 음악 확인
      const musicRecord = await db.query.music.findFirst({
        where: eq(music.id, mapping.musicId),
        columns: { id: true, title: true, url: true, status: true }
      });
      
      if (musicRecord) {
        // GCS URL이 아닌 경우에만 업데이트
        if (!musicRecord.url.includes('storage.googleapis.com')) {
          await db.update(music)
            .set({
              url: gcsUrl,
              gcsPath: mapping.filename,
              status: 'completed',
              updatedAt: new Date()
            })
            .where(eq(music.id, mapping.musicId));
          
          updateCount++;
          console.log(`✅ 업데이트: ID ${mapping.musicId} - ${musicRecord.title}`);
          console.log(`   URL: ${gcsUrl}`);
        } else {
          console.log(`⏭️  이미 GCS URL: ID ${mapping.musicId} - ${musicRecord.title}`);
        }
      } else {
        console.log(`⚠️  DB에 없는 음악: ID ${mapping.musicId}`);
      }
    }
    
    console.log(`\n🎉 동기화 완료!`);
    console.log(`📊 업데이트된 음악: ${updateCount}개`);
    
    // 최종 GCS 음악 목록 확인
    const finalResult = await db.execute(`
      SELECT id, title, url 
      FROM music 
      WHERE url LIKE 'https://storage.googleapis.com%'
      AND status = 'completed'
      ORDER BY id DESC
    `);
    
    console.log(`\n🎵 최종 GCS 음악 목록: ${finalResult.rows.length}개`);
    finalResult.rows.forEach((row: any) => {
      console.log(`  - ID ${row.id}: ${row.title}`);
    });
    
  } catch (error) {
    console.error('❌ 동기화 중 오류:', error);
  }
}

syncGCSUrls();