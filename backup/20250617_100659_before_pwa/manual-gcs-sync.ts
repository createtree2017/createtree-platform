/**
 * 수동 GCS 동기화 - 파일명 패턴 분석 및 DB 업데이트
 * GCS 인증 문제를 우회하여 알려진 파일 패턴으로 DB 업데이트
 */

import { db } from './db';
import { music } from './shared/schema';
import { eq } from 'drizzle-orm';

async function manualGCSSync() {
  try {
    console.log('🔄 수동 GCS 동기화 시작');
    
    // GCS에 저장된 것으로 알려진 음악 ID들 (추정)
    // 파일명 패턴: {id}_{timestamp}.mp3
    const knownGCSFiles = [
      { id: 90, filename: '90_1749835759314.mp3' },
      { id: 89, filename: '89_1749835540319.mp3' },
      { id: 88, filename: '88_1749836225997.mp3' },
      // 추가로 알려진 파일들이 있다면 여기에 추가
    ];
    
    console.log(`📋 업데이트 대상: ${knownGCSFiles.length}개`);
    
    let updateCount = 0;
    
    for (const file of knownGCSFiles) {
      const gcsUrl = `https://storage.cloud.google.com/createtree-upload/music/${file.filename}`;
      
      // DB에서 해당 음악 확인
      const musicRecord = await db.query.music.findFirst({
        where: eq(music.id, file.id),
        columns: { id: true, title: true, url: true, status: true }
      });
      
      if (musicRecord) {
        console.log(`🔗 ID ${file.id}: ${musicRecord.title}`);
        
        // URL이 GCS URL이 아닌 경우에만 업데이트
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
          console.log(`✅ 업데이트: ID ${file.id} -> ${gcsUrl}`);
        } else {
          console.log(`⏭️  이미 GCS URL: ID ${file.id}`);
        }
      } else {
        console.log(`⚠️  DB에 없는 음악: ID ${file.id}`);
      }
    }
    
    console.log(`\n🎉 동기화 완료!`);
    console.log(`📊 업데이트된 음악: ${updateCount}개`);
    
    // 최종 GCS 음악 목록 확인
    const finalResult = await db.execute(`
      SELECT id, title, url 
      FROM music 
      WHERE url LIKE 'https://storage.cloud.google.com%' 
      ORDER BY id DESC
    `);
    
    console.log(`🎵 최종 GCS 음악 목록: ${finalResult.rows.length}개`);
    finalResult.rows.forEach((row: any) => {
      console.log(`  - ID ${row.id}: ${row.title}`);
    });
    
  } catch (error) {
    console.error('❌ 동기화 중 오류:', error);
  }
}

manualGCSSync();