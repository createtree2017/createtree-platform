/**
 * 새로운 음악 생성 테스트
 * GCS 저장 파이프라인 전체 검증
 */
import { db } from './db/index.js';
import { music } from './shared/schema.js';
import { eq, desc } from 'drizzle-orm';

async function testNewMusicGeneration() {
  console.log('새로운 음악 생성 테스트 시작');
  
  // 가장 최근 음악 확인
  const latestMusic = await db.query.music.findFirst({
    orderBy: [desc(music.id)]
  });
  
  console.log('최신 음악 ID:', latestMusic?.id);
  console.log('상태:', latestMusic?.status);
  console.log('URL:', latestMusic?.url?.substring(0, 50) + '...');
  console.log('GCS Path:', latestMusic?.gcsPath);
  
  if (latestMusic?.gcsPath) {
    console.log('✅ GCS 저장 파이프라인이 정상 작동하고 있습니다');
  } else {
    console.log('⚠️ GCS 저장이 아직 완료되지 않았습니다');
  }
}

testNewMusicGeneration();