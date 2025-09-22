/**
 * 음악 스트리밍 API 테스트 스크립트
 * GCS URL을 가진 음악들의 실제 상태 확인
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { music } from './shared/schema';
import { eq } from 'drizzle-orm';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function checkMusicStream() {
  try {
    console.log('🎵 음악 스트리밍 테스트 시작\n');

    // ID 89 음악 확인
    const musicRecord = await db.query.music.findFirst({ 
      where: eq(music.id, 89) 
    });
    
    if (musicRecord) {
      console.log('음악 ID 89 정보:');
      console.log('- ID:', musicRecord.id);
      console.log('- Title:', musicRecord.title);
      console.log('- URL:', musicRecord.url);
      console.log('- Status:', musicRecord.status);
      console.log('- GCS Path:', musicRecord.gcsPath);
      console.log('- GCS URL 검증:', musicRecord.url?.startsWith('https://storage.googleapis.com') ? '✅' : '❌');
    } else {
      console.log('❌ 음악 ID 89를 찾을 수 없습니다.');
    }
    
    console.log('\n완료된 GCS 음악 목록:');
    const gcsMusics = await db.select().from(music)
      .where(eq(music.status, 'completed'))
      .limit(10);
    
    gcsMusics.forEach(m => {
      const isGCS = m.url?.startsWith('https://storage.googleapis.com') ? '✅' : '❌';
      console.log(`- ID: ${m.id}, Title: ${m.title?.substring(0, 20)}..., GCS: ${isGCS}`);
    });

    // 실제 스트리밍 테스트할 수 있는 음악 ID 찾기
    const validMusic = gcsMusics.find(m => m.url?.startsWith('https://storage.googleapis.com'));
    if (validMusic) {
      console.log(`\n✅ 테스트 가능한 음악: ID ${validMusic.id}`);
      console.log(`   URL: ${validMusic.url}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('오류:', error);
    process.exit(1);
  }
}

checkMusicStream();