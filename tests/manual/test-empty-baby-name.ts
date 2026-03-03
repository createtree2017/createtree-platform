/**
 * 빈 아기 이름으로 음악 생성 테스트
 */

import { db } from '../../db/index.js';
import { music } from '../../shared/schema.ts';

async function testEmptyBabyName() {
  try {
    console.log('🧪 빈 아기 이름으로 음악 레코드 생성 테스트...');
    
    const testRecord = await db.insert(music).values({
      title: '테스트 음악',
      babyName: null, // null 값 테스트
      prompt: '테스트 프롬프트',
      style: 'lullaby',
      translatedPrompt: 'test prompt',
      lyrics: '',
      instrumental: false,
      duration: 60,
      userId: 10,
      engine: 'topmedia',
      status: 'pending',
      generateLyrics: false,
      gender: 'auto',
      metadata: JSON.stringify({ test: true })
    }).returning();
    
    console.log('✅ 빈 아기 이름으로 음악 레코드 생성 성공:', testRecord[0]);
    
    // 테스트 레코드 삭제
    await db.delete(music).where(eq(music.id, testRecord[0].id));
    console.log('🗑️ 테스트 레코드 삭제 완료');
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
  }
  
  process.exit(0);
}

testEmptyBabyName();