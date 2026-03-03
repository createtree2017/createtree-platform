/**
 * 음악 ID 138 실시간 모니터링
 * 생성 과정 전체 추적
 */
import { db } from '../../db/index.js';
import { music } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

async function monitorMusic138() {
  const musicId = 138;
  console.log(`🎵 음악 ID ${musicId} 모니터링 시작`);
  
  let previousStatus = '';
  let checkCount = 0;
  const maxChecks = 120; // 10분간 모니터링
  
  const interval = setInterval(async () => {
    try {
      checkCount++;
      console.log(`\n📊 체크 ${checkCount}/${maxChecks} (${new Date().toLocaleTimeString()})`);
      
      // DB에서 현재 상태 확인
      const musicRecord = await db.query.music.findFirst({
        where: eq(music.id, musicId)
      });
      
      if (!musicRecord) {
        console.log('❌ 음악 레코드를 찾을 수 없습니다');
        clearInterval(interval);
        return;
      }
      
      const currentStatus = musicRecord.status;
      const currentUrl = musicRecord.url;
      const gcsPath = musicRecord.gcsPath;
      
      console.log(`📍 현재 상태: ${currentStatus}`);
      console.log(`🔗 URL: ${currentUrl || '없음'}`);
      console.log(`📦 GCS Path: ${gcsPath || '없음'}`);
      
      // 상태 변경 감지
      if (currentStatus !== previousStatus) {
        console.log(`🔄 상태 변경: ${previousStatus} → ${currentStatus}`);
        
        if (currentStatus === 'completed' && currentUrl) {
          console.log('🎉 음악 생성 완료!');
          console.log(`✅ 최종 URL: ${currentUrl}`);
          console.log(`💾 GCS 저장: ${gcsPath ? '성공' : '실패'}`);
          
          // 추가 정보 출력
          console.log(`📋 음악 정보:`);
          console.log(`  - 제목: ${musicRecord.title}`);
          console.log(`  - 엔진: ${musicRecord.engine}`);
          console.log(`  - 생성일: ${musicRecord.createdAt}`);
          console.log(`  - 업데이트일: ${musicRecord.updatedAt}`);
          
          clearInterval(interval);
          return;
        }
        
        if (currentStatus === 'failed') {
          console.log('❌ 음악 생성 실패');
          clearInterval(interval);
          return;
        }
        
        previousStatus = currentStatus;
      }
      
      // 타임아웃 체크
      if (checkCount >= maxChecks) {
        console.log('⏰ 모니터링 타임아웃 (10분)');
        clearInterval(interval);
      }
      
    } catch (error) {
      console.error('모니터링 중 오류:', error);
    }
  }, 5000); // 5초마다 체크
}

monitorMusic138();