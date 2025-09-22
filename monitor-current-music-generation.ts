/**
 * 현재 진행 중인 음악 생성 실시간 모니터링
 * 2025-07-04
 */

import { db } from "./db";
import { music } from "./shared/schema";
import { eq, desc, or, sql } from "drizzle-orm";

async function monitorCurrentMusicGeneration() {
  console.log('🎵 음악 생성 실시간 모니터링 시작\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // 최근 5개 음악 상태 확인
  const recentMusic = await db.query.music.findMany({
    where: or(
      eq(music.status, 'pending'),
      eq(music.status, 'processing'),
      eq(music.status, 'generating')
    ),
    orderBy: [desc(music.createdAt)],
    limit: 5
  });

  if (recentMusic.length === 0) {
    console.log('❌ 현재 생성 중인 음악이 없습니다.\n');
    
    // 최근 완료된 음악 확인
    const completedMusic = await db.query.music.findMany({
      orderBy: [desc(music.createdAt)],
      limit: 3
    });
    
    console.log('📋 최근 완료된 음악:');
    completedMusic.forEach(m => {
      const duration = m.updatedAt && m.createdAt ? 
        (new Date(m.updatedAt).getTime() - new Date(m.createdAt).getTime()) / 1000 : 0;
      
      console.log(`  - ID: ${m.id}, 제목: ${m.title}`);
      console.log(`    상태: ${m.status}, 소요시간: ${duration.toFixed(1)}초`);
      console.log(`    생성시각: ${new Date(m.createdAt).toLocaleString('ko-KR')}`);
      console.log(`    완료시각: ${m.updatedAt ? new Date(m.updatedAt).toLocaleString('ko-KR') : 'N/A'}`);
      console.log('');
    });
    
    return;
  }

  // 생성 중인 음악 상세 정보
  console.log(`✅ 현재 생성 중인 음악: ${recentMusic.length}개\n`);
  
  for (const musicItem of recentMusic) {
    const startTime = new Date(musicItem.createdAt);
    const now = new Date();
    const elapsedSeconds = (now.getTime() - startTime.getTime()) / 1000;
    
    console.log(`📍 음악 ID: ${musicItem.id}`);
    console.log(`   제목: ${musicItem.title || '제목 없음'}`);
    console.log(`   상태: ${musicItem.status}`);
    console.log(`   엔진: ${musicItem.engine || 'topmedia'}`);
    console.log(`   시작 시각: ${startTime.toLocaleString('ko-KR')}`);
    console.log(`   경과 시간: ${elapsedSeconds.toFixed(1)}초`);
    
    if (musicItem.engineTaskId) {
      console.log(`   작업 ID: ${musicItem.engineTaskId}`);
    }
    
    // 예상 완료 시간
    const expectedDuration = musicItem.engine === 'topmedia' ? 30 : 120;
    const remainingSeconds = Math.max(0, expectedDuration - elapsedSeconds);
    console.log(`   예상 남은 시간: ${remainingSeconds.toFixed(1)}초`);
    
    // 진행률 표시
    const progress = Math.min(100, (elapsedSeconds / expectedDuration) * 100);
    const progressBar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
    console.log(`   진행률: [${progressBar}] ${progress.toFixed(1)}%`);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
  
  // 성능 분석
  console.log('📊 성능 분석:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // 최근 1시간 동안 완료된 음악의 평균 처리 시간 계산
  const completedMusic = await db.query.music.findMany({
    where: eq(music.status, 'completed'),
    orderBy: desc(music.createdAt),
    limit: 50
  });
  
  let totalDuration = 0;
  let validCount = 0;
  
  completedMusic.forEach(m => {
    if (m.updatedAt && m.createdAt) {
      const duration = (new Date(m.updatedAt).getTime() - new Date(m.createdAt).getTime()) / 1000;
      if (duration > 0 && duration < 600) { // 10분 이내만 유효한 데이터로 간주
        totalDuration += duration;
        validCount++;
      }
    }
  });
  
  const avgDuration = validCount > 0 ? totalDuration / validCount : 0;
  
  console.log(`최근 1시간 평균 완료 시간: ${Number(avgDuration).toFixed(1)}초`);
  console.log(`최근 1시간 완료된 음악: ${validCount}개`);
  
  // 실시간 업데이트를 위한 폴링 제안
  console.log('\n💡 실시간 모니터링을 위해 이 스크립트를 반복 실행하세요.');
}

// 실행
monitorCurrentMusicGeneration();

export { monitorCurrentMusicGeneration };