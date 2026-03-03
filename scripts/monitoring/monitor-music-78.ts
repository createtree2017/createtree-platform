/**
 * 음악 ID 78 실시간 모니터링
 */

import { db } from '../../db/index';
import { music } from '../../shared/schema';
import { eq } from 'drizzle-orm';

async function monitorMusic78() {
  console.log('🎵 음악 ID 78 모니터링 시작...\n');
  
  let previousStatus = null;
  let monitorCount = 0;
  const maxMonitors = 40; // 10분간 모니터링 (15초 간격)
  
  while (monitorCount < maxMonitors) {
    try {
      // 현재 상태 조회
      const musicRecord = await db.query.music.findFirst({
        where: eq(music.id, 78),
        columns: {
          id: true,
          title: true,
          status: true,
          url: true,
          gcsPath: true,
          lyrics: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!musicRecord) {
        console.log('❌ 음악 ID 78을 찾을 수 없습니다.');
        break;
      }

      const currentTime = new Date().toLocaleTimeString('ko-KR');
      const elapsedMinutes = Math.floor((Date.now() - new Date(musicRecord.createdAt).getTime()) / (1000 * 60));
      
      // 상태 변화가 있을 때만 출력
      if (musicRecord.status !== previousStatus) {
        console.log(`⏰ [${currentTime}] 상태 변화 감지!`);
        console.log(`📋 ID: ${musicRecord.id}`);
        console.log(`🎵 제목: ${musicRecord.title}`);
        console.log(`📊 상태: ${previousStatus} → ${musicRecord.status}`);
        console.log(`🔗 URL: ${musicRecord.url || '없음'}`);
        console.log(`📝 가사: ${musicRecord.lyrics ? '생성됨' : '없음'}`);
        console.log(`⏱️ 경과시간: ${elapsedMinutes}분`);
        console.log(`🔄 업데이트: ${musicRecord.updatedAt}`);
        console.log('─'.repeat(50));
        
        previousStatus = musicRecord.status;
      }
      
      // 완료 또는 실패 시 상세 정보 출력
      if (musicRecord.status === 'completed' || musicRecord.status === 'failed') {
        console.log('\n🎯 최종 결과:');
        console.log(`✅ 상태: ${musicRecord.status}`);
        console.log(`🎵 제목: ${musicRecord.title}`);
        console.log(`🔗 URL: ${musicRecord.url}`);
        console.log(`📁 GCS 경로: ${musicRecord.gcsPath || '없음'}`);
        console.log(`📝 가사 길이: ${musicRecord.lyrics?.length || 0}자`);
        console.log(`⏱️ 총 소요시간: ${elapsedMinutes}분`);
        
        if (musicRecord.lyrics) {
          console.log('\n📝 생성된 가사:');
          console.log(musicRecord.lyrics.substring(0, 200) + '...');
        }
        
        break;
      }
      
      // 7분 이상 pending이면 경고
      if (musicRecord.status === 'pending' && elapsedMinutes >= 7) {
        console.log(`⚠️ [${currentTime}] 주의: ${elapsedMinutes}분째 pending 상태`);
      }
      
      monitorCount++;
      
      // 15초 대기
      await new Promise(resolve => setTimeout(resolve, 15000));
      
    } catch (error) {
      console.error(`❌ 모니터링 오류:`, error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log('\n🏁 모니터링 완료');
}

monitorMusic78();