/**
 * 음악 생성 상태 확인 스크립트
 */

import { db } from "./db";
import { music } from "./shared/schema";
import { desc } from "drizzle-orm";

async function checkMusicStatus() {
  console.log("=== 최근 음악 생성 상태 확인 ===\n");
  
  // 최근 10개 음악 조회
  const recentMusic = await db.select().from(music).orderBy(desc(music.createdAt)).limit(10);
  
  console.log(`총 ${recentMusic.length}개 음악 (최신순):\n`);
  
  recentMusic.forEach((m, index) => {
    const createdAt = new Date(m.createdAt);
    const age = Math.floor((Date.now() - createdAt.getTime()) / 1000);
    const ageStr = age < 60 ? `${age}초` : age < 3600 ? `${Math.floor(age/60)}분` : `${Math.floor(age/3600)}시간`;
    
    console.log(`${index + 1}. ID ${m.id}: "${m.title}"`);
    console.log(`   상태: ${m.status || '완료'} | URL: ${m.url ? '있음' : '없음'} | 생성시간: ${ageStr} 전`);
    
    // 생성 중인 음악 강조
    if (m.status === 'generating' || m.status === 'processing' || (!m.url && !m.status)) {
      console.log(`   ⏳ 현재 생성 중...`);
    }
    console.log('');
  });
  
  // 생성 중인 음악 개수
  const generatingCount = recentMusic.filter(m => 
    m.status === 'generating' || 
    m.status === 'processing' || 
    m.status === 'pending' ||
    (!m.url && !m.status)
  ).length;
  
  console.log(`\n현재 생성 중인 음악: ${generatingCount}개`);
  
  process.exit(0);
}

checkMusicStatus().catch(console.error);