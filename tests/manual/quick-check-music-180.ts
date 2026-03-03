/**
 * 음악 ID 180 상세 점검
 */

import { db } from "../../db";
import { music } from "../../shared/schema";
import { eq } from "drizzle-orm";

async function checkMusic180() {
  console.log('🔍 음악 ID 180 상세 점검\n');
  
  const musicItem = await db.query.music.findFirst({
    where: eq(music.id, 180)
  });
  
  if (!musicItem) {
    console.log('❌ 음악 ID 180을 찾을 수 없습니다.');
    return;
  }
  
  console.log('📋 음악 정보:');
  console.log(`  ID: ${musicItem.id}`);
  console.log(`  제목: ${musicItem.title}`);
  console.log(`  상태: ${musicItem.status}`);
  console.log(`  URL: ${musicItem.url ? '있음' : '없음'}`);
  console.log(`  GCS Path: ${musicItem.gcsPath ? '있음' : '없음'}`);
  console.log(`  엔진: ${musicItem.engine}`);
  console.log(`  작업 ID: ${musicItem.engineTaskId}`);
  console.log(`  생성 시각: ${new Date(musicItem.createdAt).toLocaleString('ko-KR')}`);
  console.log(`  업데이트 시각: ${musicItem.updatedAt ? new Date(musicItem.updatedAt).toLocaleString('ko-KR') : 'N/A'}`);
  
  const now = new Date();
  const elapsedSeconds = (now.getTime() - new Date(musicItem.createdAt).getTime()) / 1000;
  console.log(`\n⏱️  경과 시간: ${elapsedSeconds.toFixed(1)}초`);
  
  if (musicItem.status === 'pending') {
    console.log('\n⚠️  문제: 음악이 pending 상태로 멈춰있습니다!');
    console.log('  - TopMediai API 응답을 받지 못했거나');
    console.log('  - 서버 응답이 실패했을 가능성이 있습니다.');
  }
  
  // 최근 완료된 음악과 비교
  const recentCompleted = await db.query.music.findFirst({
    where: eq(music.status, 'completed'),
    orderBy: (music, { desc }) => [desc(music.createdAt)]
  });
  
  if (recentCompleted) {
    const completionTime = recentCompleted.updatedAt && recentCompleted.createdAt ? 
      (new Date(recentCompleted.updatedAt).getTime() - new Date(recentCompleted.createdAt).getTime()) / 1000 : 0;
    
    console.log('\n📊 최근 완료된 음악과 비교:');
    console.log(`  ID: ${recentCompleted.id}`);
    console.log(`  완료 시간: ${completionTime.toFixed(1)}초`);
  }
}

checkMusic180();

export { checkMusic180 };