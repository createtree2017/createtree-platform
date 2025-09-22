/**
 * 음악 ID 139 실시간 모니터링
 * 개선된 GCS 업로드 과정 추적
 */
import { db } from './db/index.js';
import { music } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function monitorMusic139() {
  const musicId = 139;
  console.log(`🎵 음악 ID ${musicId} 실시간 모니터링 시작`);
  
  let previousStatus = '';
  let checkCount = 0;
  const maxChecks = 60; // 5분간 모니터링
  
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
      
      console.log(`📍 상태: ${currentStatus}`);
      console.log(`🔗 URL: ${currentUrl ? currentUrl.substring(0, 60) + '...' : '없음'}`);
      console.log(`📦 GCS Path: ${gcsPath || '없음'}`);
      
      // 상태 변경 감지
      if (currentStatus !== previousStatus) {
        console.log(`🔄 상태 변경: ${previousStatus || '시작'} → ${currentStatus}`);
        
        if (currentStatus === 'completed' && currentUrl) {
          console.log('🎉 음악 생성 완료!');
          
          // GCS URL인지 확인
          if (currentUrl.includes('storage.googleapis.com')) {
            console.log('✅ GCS 저장 성공');
            
            // 파일 크기 확인
            try {
              const response = await fetch(currentUrl, { method: 'HEAD' });
              const size = response.headers.get('content-length');
              console.log(`📏 파일 크기: ${size} bytes (${Math.round(parseInt(size || '0') / 1024 / 1024 * 100) / 100} MB)`);
              
              if (parseInt(size || '0') > 1000) {
                console.log('✅ 유효한 크기의 파일 확인됨');
              } else {
                console.log('⚠️ 파일 크기가 너무 작음');
              }
            } catch (error) {
              console.log(`❌ 파일 크기 확인 실패: ${error.message}`);
            }
          } else {
            console.log('⚠️ 원본 URL 사용 (GCS 저장 실패)');
          }
          
          console.log(`📋 최종 정보:`);
          console.log(`  - 제목: ${musicRecord.title}`);
          console.log(`  - 엔진: ${musicRecord.engine}`);
          console.log(`  - 생성일: ${musicRecord.createdAt}`);
          console.log(`  - 완료일: ${musicRecord.updatedAt}`);
          
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
        console.log('⏰ 모니터링 타임아웃 (5분)');
        clearInterval(interval);
      }
      
    } catch (error) {
      console.error('모니터링 중 오류:', error);
    }
  }, 5000); // 5초마다 체크
}

monitorMusic139();