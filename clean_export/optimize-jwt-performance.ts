/**
 * JWT 성능 최적화 테스트 및 검증
 * 기존 2초 → 목표 500ms 이내
 */

import { authenticateJWT } from './server/services/auth';
import { jwtCache } from './server/utils/jwt-cache';

async function testJWTPerformance() {
  console.log('🔍 JWT 성능 최적화 테스트 시작...');
  
  // 테스트용 토큰 (실제 사용자 토큰)
  const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjI0LCJpYXQiOjE3NTAyOTMyMDcsImV4cCI6MTc1MDM3OTYwN30.g1R3mYb33Eahc6YyE3Xdq0j8EOWST8gQ4D_uRxt2cZo';
  
  // 모킹된 요청 객체
  const mockReq = {
    cookies: { auth_token: testToken },
    user: null
  };
  
  const mockRes = {
    status: (code: number) => ({ json: (data: any) => ({ statusCode: code, data }) }),
    json: (data: any) => ({ data })
  };
  
  const mockNext = () => {};
  
  // 성능 테스트 실행
  const iterations = 10;
  const times: number[] = [];
  
  console.log(`📊 ${iterations}회 반복 테스트 실행...`);
  
  for (let i = 0; i < iterations; i++) {
    // 캐시 초기화 (첫 번째 요청 시뮬레이션)
    if (i === 0) {
      jwtCache.clear();
    }
    
    const startTime = Date.now();
    
    try {
      // @ts-ignore
      await authenticateJWT(mockReq, mockRes, mockNext);
      const endTime = Date.now();
      const duration = endTime - startTime;
      times.push(duration);
      
      console.log(`   테스트 ${i + 1}: ${duration}ms ${i === 0 ? '(캐시 미스)' : '(캐시 히트)'}`);
    } catch (error) {
      console.log(`   테스트 ${i + 1}: 실패 - ${error}`);
    }
  }
  
  // 결과 분석
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const cacheHitTimes = times.slice(1); // 첫 번째 제외
  const avgCacheHitTime = cacheHitTimes.length > 0 ? 
    cacheHitTimes.reduce((a, b) => a + b, 0) / cacheHitTimes.length : 0;
  
  console.log('\n📈 성능 분석 결과:');
  console.log(`   평균 응답 시간: ${avgTime.toFixed(1)}ms`);
  console.log(`   최소 응답 시간: ${minTime}ms`);
  console.log(`   최대 응답 시간: ${maxTime}ms`);
  console.log(`   캐시 히트 평균: ${avgCacheHitTime.toFixed(1)}ms`);
  
  // 목표 달성 여부 확인
  const targetTime = 500;
  const cacheTargetTime = 50; // 캐시 히트는 50ms 이내 목표
  
  console.log('\n🎯 목표 달성 여부:');
  console.log(`   전체 평균 < ${targetTime}ms: ${avgTime < targetTime ? '✅ 달성' : '❌ 미달성'}`);
  console.log(`   캐시 히트 < ${cacheTargetTime}ms: ${avgCacheHitTime < cacheTargetTime ? '✅ 달성' : '❌ 미달성'}`);
  
  // 캐시 통계
  const cacheStats = jwtCache.getStats();
  console.log('\n💾 캐시 통계:');
  console.log(`   캐시 크기: ${cacheStats.size}개`);
  console.log(`   TTL: ${cacheStats.ttl / 1000}초`);
  console.log(`   최대 크기: ${cacheStats.maxSize}개`);
  
  // 개선 권장사항
  console.log('\n💡 성능 개선 권장사항:');
  
  if (avgTime > targetTime) {
    console.log('   - 데이터베이스 쿼리 최적화 필요');
    console.log('   - 인덱스 추가 검토');
    console.log('   - 커넥션 풀 설정 확인');
  }
  
  if (avgCacheHitTime > cacheTargetTime) {
    console.log('   - 캐시 TTL 연장 고려');
    console.log('   - 메모리 캐시 크기 증가');
  }
  
  if (avgTime < targetTime && avgCacheHitTime < cacheTargetTime) {
    console.log('   ✅ 모든 성능 목표 달성!');
    console.log('   - 현재 최적화가 충분히 효과적임');
    console.log('   - 프로덕션 배포 준비 완료');
  }
  
  return {
    avgTime,
    minTime,
    maxTime,
    avgCacheHitTime,
    targetAchieved: avgTime < targetTime,
    cacheTargetAchieved: avgCacheHitTime < cacheTargetTime
  };
}

// API Rate Limiting 구현
export function createRateLimiter() {
  const requests = new Map<string, { count: number; resetTime: number }>();
  const WINDOW_MS = 60 * 1000; // 1분
  const MAX_REQUESTS = 100; // 분당 100회
  
  return (req: any, res: any, next: any) => {
    const clientId = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    // 기존 기록 확인
    const clientRecord = requests.get(clientId);
    
    if (!clientRecord || now > clientRecord.resetTime) {
      // 새로운 윈도우 시작
      requests.set(clientId, {
        count: 1,
        resetTime: now + WINDOW_MS
      });
      return next();
    }
    
    // 요청 수 증가
    clientRecord.count++;
    
    if (clientRecord.count > MAX_REQUESTS) {
      return res.status(429).json({
        error: '요청 한도 초과',
        message: '분당 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
        retryAfter: Math.ceil((clientRecord.resetTime - now) / 1000)
      });
    }
    
    // 남은 요청 수를 헤더에 추가
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', MAX_REQUESTS - clientRecord.count);
    res.setHeader('X-RateLimit-Reset', Math.ceil(clientRecord.resetTime / 1000));
    
    next();
  };
}

testJWTPerformance().catch(console.error);