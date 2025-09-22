/**
 * 음악 ID 181 실시간 모니터링
 * 생성 과정 전체 추적
 */

import { db } from "./db";
import { music } from "./shared/schema";
import { eq } from "drizzle-orm";

async function monitorMusic181() {
  console.log('🎵 음악 ID 181 생성 과정 추적 시작\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const startTime = new Date();
  let previousStatus = '';
  let checkCount = 0;
  
  const interval = setInterval(async () => {
    checkCount++;
    
    try {
      // 음악 정보 조회
      const musicRecord = await db.query.music.findFirst({
        where: eq(music.id, 181)
      });
      
      if (!musicRecord) {
        console.log(`[${new Date().toLocaleTimeString()}] ❌ 음악 ID 181을 찾을 수 없습니다.`);
        clearInterval(interval);
        return;
      }
      
      const elapsedTime = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
      
      // 상태 변경 시에만 로그
      if (musicRecord.status !== previousStatus) {
        console.log(`\n[${new Date().toLocaleTimeString()}] 상태 변경 감지!`);
        console.log(`이전 상태: ${previousStatus || '없음'} → 현재 상태: ${musicRecord.status}`);
        console.log(`경과 시간: ${elapsedTime}초 (${Math.floor(elapsedTime / 60)}분 ${elapsedTime % 60}초)`);
        
        if (musicRecord.status === 'pending') {
          console.log('📝 음악 생성 요청이 데이터베이스에 등록되었습니다.');
          console.log(`   - 제목: ${musicRecord.title}`);
          console.log(`   - 프롬프트: ${musicRecord.prompt}`);
          console.log(`   - 스타일: ${musicRecord.style}`);
          console.log(`   - 엔진: ${musicRecord.engine || 'TopMediai'}`);
          console.log(`   - 성별: ${musicRecord.gender}`);
          console.log(`   - 무반주: ${musicRecord.instrumental ? '예' : '아니오'}`);
        } else if (musicRecord.status === 'processing') {
          console.log('⚙️  TopMediai API에서 음악 생성 중...');
          if (musicRecord.topmediaTaskId) {
            console.log(`   - Task ID: ${musicRecord.topmediaTaskId}`);
          }
        } else if (musicRecord.status === 'completed') {
          console.log('✅ 음악 생성 완료!');
          console.log(`   - 음악 URL: ${musicRecord.musicUrl || 'URL 대기 중...'}`);
          console.log(`   - 커버 이미지: ${musicRecord.coverUrl || '없음'}`);
          if (musicRecord.lyrics) {
            console.log(`   - 가사: ${musicRecord.lyrics.substring(0, 100)}...`);
          }
          console.log(`   - 총 소요 시간: ${elapsedTime}초`);
        } else if (musicRecord.status === 'failed') {
          console.log('❌ 음악 생성 실패!');
          console.log(`   - 에러: ${musicRecord.error || '알 수 없는 오류'}`);
        }
        
        previousStatus = musicRecord.status;
      } else {
        // 5번마다 진행 상황 표시
        if (checkCount % 5 === 0) {
          console.log(`[${new Date().toLocaleTimeString()}] 진행 중... (${elapsedTime}초 경과, 상태: ${musicRecord.status})`);
        }
      }
      
      // TopMediai 추가 정보 표시
      if (musicRecord.topmediaTaskId && musicRecord.status === 'processing') {
        if (musicRecord.progress) {
          console.log(`   - 진행률: ${musicRecord.progress}%`);
        }
      }
      
      // 완료 또는 실패 시 모니터링 종료
      if (musicRecord.status === 'completed' || musicRecord.status === 'failed') {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🏁 모니터링 종료\n');
        
        // 최종 상태 요약
        console.log('📊 최종 요약:');
        console.log(`   - 음악 ID: ${musicRecord.id}`);
        console.log(`   - 제목: ${musicRecord.title}`);
        console.log(`   - 상태: ${musicRecord.status}`);
        console.log(`   - 총 소요 시간: ${elapsedTime}초`);
        console.log(`   - 생성일: ${musicRecord.createdAt}`);
        console.log(`   - 업데이트: ${musicRecord.updatedAt}`);
        
        clearInterval(interval);
      }
      
      // 3분 타임아웃 체크
      if (elapsedTime > 180 && musicRecord.status === 'pending') {
        console.log('\n⏰ 3분 타임아웃 도달! 서버에서 자동으로 failed로 변경될 예정입니다.');
      }
      
    } catch (error) {
      console.error('모니터링 중 오류 발생:', error);
      clearInterval(interval);
    }
  }, 2000); // 2초마다 체크
  
  console.log('모니터링 시작됨. 2초마다 상태를 확인합니다...\n');
}

// 실행
monitorMusic181();