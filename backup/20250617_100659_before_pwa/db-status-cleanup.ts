/**
 * DB status 필드 정합성 스크립트
 * pending 상태이면서 3시간 이상 경과한 레코드를 failed로 마킹
 */

import { db } from './db/index.js';
import { music } from './shared/schema.js';
import { eq, and, lt } from 'drizzle-orm';

async function cleanupStaleMusic() {
  console.log('🔍 Checking for stale music records...');
  
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
  
  try {
    // pending 상태이면서 3시간 이상 된 레코드 조회
    const staleMusicRecords = await db
      .select()
      .from(music)
      .where(
        and(
          eq(music.status, 'pending'),
          lt(music.createdAt, threeHoursAgo)
        )
      );
    
    if (staleMusicRecords.length === 0) {
      console.log('✅ No stale records found');
      return;
    }
    
    console.log(`🔧 Found ${staleMusicRecords.length} stale records to update`);
    
    // failed로 상태 업데이트
    const updated = await db
      .update(music)
      .set({ 
        status: 'failed',
        updatedAt: new Date()
      })
      .where(
        and(
          eq(music.status, 'pending'),
          lt(music.createdAt, threeHoursAgo)
        )
      )
      .returning();
    
    console.log(`✅ Updated ${updated.length} stale records to failed status`);
    
    // 업데이트된 레코드 상세 출력
    updated.forEach(record => {
      const ageHours = Math.round((Date.now() - new Date(record.createdAt).getTime()) / (1000 * 60 * 60));
      console.log(`  - ID ${record.id}: "${record.title}" (${ageHours}h old)`);
    });
    
  } catch (error) {
    console.error('❌ Error during status cleanup:', error);
    throw error;
  }
}

// Cron job 스타일 실행 함수
export async function runStatusCleanup() {
  console.log(`🚀 Starting status cleanup at ${new Date().toISOString()}`);
  
  try {
    await cleanupStaleMusic();
    console.log('✅ Status cleanup completed successfully');
  } catch (error) {
    console.error('❌ Status cleanup failed:', error);
  }
}

// 직접 실행 시
if (require.main === module) {
  runStatusCleanup().then(() => process.exit(0));
}