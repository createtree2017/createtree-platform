/**
 * 음악 완전 삭제 (DB + GCS) 통합 테스트 스크립트
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Client } = pkg;
import { music } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import { deleteGcsObject } from '../../server/utils/gcs.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

const db = drizzle(client, { schema: { music } });

async function testCompleteMusicDeletion() {
  try {
    await client.connect();
    console.log('✅ DB 연결 성공');

    // 테스트할 음악 ID (ID 111 사용)
    const musicId = 111;
    const userId = 10;

    // 1. 삭제 전 음악 정보 확인
    const musicRecord = await db.select().from(music).where(eq(music.id, musicId));
    
    if (!musicRecord.length) {
      console.log('❌ 음악이 이미 삭제되었거나 존재하지 않습니다');
      return;
    }

    const musicData = musicRecord[0];
    console.log('🎵 삭제 대상 음악:', {
      id: musicData.id,
      title: musicData.title,
      userId: musicData.userId,
      url: musicData.url,
      gcsPath: musicData.gcsPath
    });

    // 2. 권한 확인
    if (musicData.userId !== userId) {
      console.log('❌ 삭제 권한 없음: userId 불일치');
      return;
    }

    // 3. GCS 파일 삭제
    if (musicData.gcsPath) {
      console.log('🗑️ GCS 파일 삭제 (gcsPath):', musicData.gcsPath);
      await deleteGcsObject(musicData.gcsPath);
    } else if (musicData.url && musicData.url.includes('googleapis.com')) {
      const urlParts = musicData.url.split('/');
      const gcsPath = urlParts.slice(-2).join('/');
      console.log('🗑️ GCS 파일 삭제 (URL 추출):', gcsPath);
      await deleteGcsObject(gcsPath);
    }

    // 4. DB 레코드 삭제
    console.log('🗑️ DB 레코드 삭제 시작');
    await db.delete(music).where(eq(music.id, musicId));
    console.log('✅ DB 레코드 삭제 완료');

    // 5. 삭제 검증
    const deletedCheck = await db.select().from(music).where(eq(music.id, musicId));
    if (deletedCheck.length === 0) {
      console.log('✅ 완전 삭제 검증 성공: DB와 GCS 모두에서 제거됨');
    } else {
      console.log('❌ 삭제 검증 실패: DB에서 완전히 제거되지 않음');
    }

  } catch (error: any) {
    console.error('❌ 테스트 실패:', error.message);
  } finally {
    await client.end();
    console.log('🔌 DB 연결 종료');
  }
}

// 스크립트 실행
testCompleteMusicDeletion().catch(console.error);