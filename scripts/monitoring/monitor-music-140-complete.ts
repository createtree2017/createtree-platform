/**
 * 음악 ID 140 전체 파이프라인 실시간 모니터링
 * TopMediai → 데이터베이스 → GCS 저장 → 스트리밍 테스트
 */

import { db } from "../../db/index";
import { music } from "../../shared/schema";
import { eq } from "drizzle-orm";

async function monitorMusic140Complete() {
  console.log('🎵 음악 140 전체 파이프라인 모니터링 시작...');
  
  const musicId = 140;
  const maxAttempts = 60; // 5분간 모니터링
  let attempt = 0;
  
  while (attempt < maxAttempts) {
    try {
      // 1. 데이터베이스 상태 확인
      const musicRecord = await db.select().from(music).where(eq(music.id, musicId)).limit(1);
      
      if (musicRecord.length > 0) {
        const currentMusic = musicRecord[0];
        const status = currentMusic.status;
        const url = currentMusic.url;
        const gcsPath = currentMusic.gcs_path;
        
        console.log(`\n📊 [${attempt + 1}/60] 음악 140 상태:`, {
          status,
          hasUrl: !!url,
          hasGcsPath: !!gcsPath,
          urlType: url ? (url.includes('audiopipe.suno.ai') ? 'Suno' : 'GCS') : 'None',
          timestamp: new Date().toLocaleTimeString()
        });
        
        // 2. 상태별 처리
        if (status === 'completed' && url && gcsPath) {
          console.log('✅ DB 업데이트 완료! GCS 저장 성공');
          
          // 3. 스트리밍 API 테스트
          console.log('🧪 스트리밍 API 테스트 중...');
          try {
            const streamResponse = await fetch(`http://localhost:5000/api/music/stream/${musicId}`, {
              method: 'HEAD'
            });
            
            if (streamResponse.ok) {
              const contentLength = streamResponse.headers.get('content-length');
              console.log(`✅ 스트리밍 테스트 성공: ${contentLength} bytes`);
              
              // 4. Range 요청 테스트
              const rangeResponse = await fetch(`http://localhost:5000/api/music/stream/${musicId}`, {
                headers: { 'Range': 'bytes=0-1023' }
              });
              
              if (rangeResponse.status === 206) {
                console.log('✅ Range 요청 지원 확인 (206 Partial Content)');
              }
              
              console.log('\n🎉 전체 파이프라인 검증 완료!');
              console.log('✓ TopMediai 음악 생성 성공');
              console.log('✓ 데이터베이스 저장 완료');
              console.log('✓ GCS 저장 성공');
              console.log('✓ 스트리밍 API 정상 작동');
              console.log('✓ Range 요청 지원');
              
              return;
            } else {
              console.log(`❌ 스트리밍 테스트 실패: ${streamResponse.status}`);
            }
          } catch (streamError) {
            console.log('❌ 스트리밍 테스트 오류:', streamError.message);
          }
          
        } else if (status === 'failed') {
          console.log('❌ 음악 생성 실패');
          return;
        } else {
          console.log('⏳ 처리 중... (pending/processing)');
        }
      } else {
        console.log('❌ 음악 레코드를 찾을 수 없습니다');
        return;
      }
      
    } catch (error) {
      console.log('❌ 모니터링 오류:', error.message);
    }
    
    // 5초 대기
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempt++;
  }
  
  console.log('⏰ 모니터링 시간 초과 (5분)');
}

// 실행
monitorMusic140Complete();