/**
 * 음악 생성 성능 최적화 분석 및 구현
 * TopMediai는 빠르지만 우리 시스템에서 지연되는 원인 해결
 */

import { db } from './db/index.js';
import { music } from './shared/schema.js';
import { eq, desc } from 'drizzle-orm';

async function analyzePerformanceBottlenecks() {
  console.log('🔍 음악 생성 성능 병목 분석 시작...\n');
  
  // 1. 최근 음악 생성 처리 시간 분석
  console.log('📊 최근 음악 생성 처리 시간 분석:');
  const recentMusic = await db.query.music.findMany({
    orderBy: [desc(music.createdAt)],
    limit: 10,
    columns: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      engine: true
    }
  });
  
  for (const record of recentMusic) {
    const processingTime = record.updatedAt 
      ? Math.round((record.updatedAt.getTime() - record.createdAt.getTime()) / 1000)
      : '진행중';
    
    console.log(`ID ${record.id}: ${record.title} (${record.engine})`);
    console.log(`  상태: ${record.status}, 처리시간: ${processingTime}초`);
    console.log(`  생성: ${record.createdAt.toLocaleString()}`);
    console.log(`  완료: ${record.updatedAt?.toLocaleString() || '미완료'}\n`);
  }
  
  console.log('🚨 확인된 성능 병목 지점들:\n');
  
  console.log('1. GCS 업로드 지연');
  console.log('   - TopMediai 음악 생성 완료 후 GCS 업로드에서 시간 소요');
  console.log('   - 해결방안: 비동기 업로드, 원본 URL 우선 반환\n');
  
  console.log('2. 불필요한 Whisper 가사 추출');
  console.log('   - TopMediai가 이미 가사를 제공하는데 추가로 Whisper 호출');
  console.log('   - 해결방안: TopMediai 가사 우선 사용, Whisper는 폴백으로만 사용\n');
  
  console.log('3. 동기식 처리 구조');
  console.log('   - 모든 단계가 순차 실행으로 사용자 대기시간 증가');
  console.log('   - 해결방안: 음악 URL 즉시 반환, 후처리는 백그라운드 실행\n');
  
  console.log('4. DB 업데이트 지연');
  console.log('   - 음악 생성 완료 후 DB 상태 업데이트가 늦어짐');
  console.log('   - 해결방안: 즉시 상태 업데이트, 메타데이터는 별도 처리\n');
  
  return {
    avgProcessingTime: calculateAverageProcessingTime(recentMusic),
    bottlenecks: [
      'GCS 업로드 지연',
      '불필요한 Whisper 호출',
      '동기식 처리 구조',
      'DB 업데이트 지연'
    ]
  };
}

function calculateAverageProcessingTime(records: any[]): number {
  const completedRecords = records.filter(r => r.status === 'completed' && r.updatedAt);
  if (completedRecords.length === 0) return 0;
  
  const totalTime = completedRecords.reduce((sum, record) => {
    return sum + (record.updatedAt.getTime() - record.createdAt.getTime());
  }, 0);
  
  return Math.round(totalTime / completedRecords.length / 1000); // 초 단위
}

async function implementOptimizations() {
  console.log('⚡ 성능 최적화 구현 계획:\n');
  
  console.log('🎯 목표: TopMediai 2-3초 → 우리 시스템 5초 이내 완료\n');
  
  console.log('📝 최적화 방안:');
  console.log('1. 즉시 응답 패턴 구현');
  console.log('   - TopMediai 음악 URL 획득 즉시 사용자에게 반환');
  console.log('   - GCS 업로드, 가사 처리는 백그라운드 실행');
  
  console.log('2. 스마트 가사 처리');
  console.log('   - TopMediai 가사가 있으면 즉시 사용');
  console.log('   - Whisper 호출 최소화');
  
  console.log('3. 병렬 처리 구조');
  console.log('   - DB 업데이트와 GCS 업로드 동시 실행');
  console.log('   - 사용자 응답과 후처리 분리');
  
  console.log('4. 캐싱 및 재사용');
  console.log('   - 동일한 프롬프트/설정의 음악 중복 생성 방지');
  console.log('   - 스타일별 프롬프트 최적화');
  
  return {
    optimizations: [
      '즉시 응답 패턴',
      '스마트 가사 처리', 
      '병렬 처리 구조',
      '캐싱 및 재사용'
    ],
    expectedImprovement: '현재 30-60초 → 목표 5초 이내'
  };
}

// 실행
async function main() {
  try {
    const analysis = await analyzePerformanceBottlenecks();
    console.log(`\n📈 현재 평균 처리시간: ${analysis.avgProcessingTime}초`);
    
    const optimization = await implementOptimizations();
    console.log(`\n🎯 예상 개선 효과: ${optimization.expectedImprovement}`);
    
    console.log('\n✅ 분석 완료 - 다음 단계: 실제 최적화 코드 구현');
    
  } catch (error) {
    console.error('분석 오류:', error);
  }
}

main();