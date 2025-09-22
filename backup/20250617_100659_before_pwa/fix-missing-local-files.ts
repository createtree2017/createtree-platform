/**
 * 존재하지 않는 로컬 파일들을 DB에서 정리
 * 파일이 없는 음악은 failed 상태로 변경
 */

import { db } from './db';
import { music } from './shared/schema';
import { eq, and } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function fixMissingLocalFiles() {
  try {
    console.log('🔍 존재하지 않는 로컬 파일 정리 시작');
    
    // 로컬 파일 경로를 가진 모든 음악 조회
    const localMusicRecords = await db.query.music.findMany({
      where: and(
        eq(music.status, 'completed')
      ),
      columns: {
        id: true,
        title: true,
        url: true,
        status: true
      }
    });
    
    const localMusic = localMusicRecords.filter(record => 
      record.url && record.url.startsWith('/static/')
    );
    
    console.log(`📋 로컬 경로 음악 개수: ${localMusic.length}개`);
    
    let fixedCount = 0;
    
    for (const musicRecord of localMusic) {
      const localPath = path.join(process.cwd(), musicRecord.url);
      
      if (!fs.existsSync(localPath)) {
        console.log(`❌ 파일 없음: ID ${musicRecord.id} - ${musicRecord.title}`);
        
        // 파일이 없는 음악을 failed 상태로 변경
        await db.update(music)
          .set({
            status: 'failed',
            url: '', // URL 제거
            updatedAt: new Date()
          })
          .where(eq(music.id, musicRecord.id));
        
        fixedCount++;
      } else {
        console.log(`✅ 파일 존재: ID ${musicRecord.id} - ${musicRecord.title}`);
      }
    }
    
    console.log(`\n🎉 정리 완료!`);
    console.log(`❌ Failed로 변경된 음악: ${fixedCount}개`);
    
    // 최종 상태 확인
    const finalStatus = await db.execute(`
      SELECT 
        COUNT(*) as total_completed,
        COUNT(CASE WHEN url LIKE '/static/%' THEN 1 END) as local_files,
        COUNT(CASE WHEN url LIKE 'https://storage.cloud.google.com/%' THEN 1 END) as gcs_files,
        COUNT(CASE WHEN url LIKE '%suno%' THEN 1 END) as suno_files
      FROM music WHERE status = 'completed'
    `);
    
    console.log('\n📊 정리 후 상태:');
    console.log('- 완료된 음악:', finalStatus.rows[0].total_completed);
    console.log('- 로컬 파일:', finalStatus.rows[0].local_files);
    console.log('- GCS 파일:', finalStatus.rows[0].gcs_files);
    console.log('- Suno URL:', finalStatus.rows[0].suno_files);
    
  } catch (error) {
    console.error('❌ 정리 중 오류:', error);
  }
}

fixMissingLocalFiles();