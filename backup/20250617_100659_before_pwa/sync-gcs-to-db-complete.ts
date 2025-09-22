/**
 * GCS 버킷의 모든 music/*.mp3 파일을 기준으로 DB 동기화
 * 누락된 레코드만 삽입, 기존 레코드는 건드리지 않음
 */

import { db } from './db';
import { music } from './shared/schema';
import { eq, and } from 'drizzle-orm';
import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: 'createtreeai'
});
const bucket = storage.bucket('createtree-upload');

async function syncAllGCSMusicToDb() {
  try {
    console.log('🔄 GCS 음악 파일 전체 동기화 시작...');
    
    // 1. GCS에서 모든 music/*.mp3 파일 목록 조회
    const [files] = await bucket.getFiles({ prefix: 'music/' });
    const musicFiles = files.filter(file => 
      file.name.endsWith('.mp3') || 
      file.name.endsWith('.wav') || 
      file.name.endsWith('.m4a')
    );
    
    console.log(`📁 GCS에서 발견된 음악 파일: ${musicFiles.length}개`);
    
    // 2. 기존 DB 레코드 조회 (중복 방지용)
    const existingMusic = await db.select({
      id: music.id,
      gcsPath: music.gcsPath,
      url: music.url
    }).from(music);
    
    const existingGcsPaths = new Set(existingMusic.map(m => m.gcsPath).filter(Boolean));
    const existingUrls = new Set(existingMusic.map(m => m.url).filter(Boolean));
    
    console.log(`📋 기존 DB 레코드: ${existingMusic.length}개`);
    
    // 3. 각 GCS 파일에 대해 DB 레코드 확인 및 삽입
    let insertCount = 0;
    let skipCount = 0;
    
    for (const file of musicFiles) {
      const fileName = file.name.replace('music/', '');
      const gcsPath = file.name;
      const gcsUrl = `https://storage.googleapis.com/createtree-upload/${file.name}`;
      
      // 중복 확인
      const isDuplicate = existingGcsPaths.has(gcsPath) || 
                         existingUrls.has(gcsUrl) ||
                         existingMusic.some(m => m.url?.includes(fileName));
      
      if (isDuplicate) {
        console.log(`⏭️  이미 존재: ${fileName}`);
        skipCount++;
        continue;
      }
      
      // 메타데이터 조회
      const [metadata] = await file.getMetadata();
      const createdAt = new Date(metadata.timeCreated);
      
      // 파일명에서 제목 생성 (UUID 제거하고 읽기 쉽게)
      let title = fileName.replace(/\.mp3$/, '');
      if (title.includes('_')) {
        const parts = title.split('_');
        title = parts.length > 1 ? parts.slice(0, -1).join('_') : title;
      }
      title = title.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'GCS음악');
      if (title.length < 3) title = `GCS 음악 ${insertCount + 1}`;
      
      // DB에 레코드 삽입
      try {
        const [newRecord] = await db.insert(music).values({
          title: title,
          prompt: '자동 동기화된 음악',
          style: 'unknown',
          url: gcsUrl,
          gcsPath: gcsPath,
          status: 'completed',
          provider: 'gcs_sync',
          engine: 'unknown',
          duration: 180,
          creditUsed: 0,
          userId: 10, // 슈퍼관리자로 설정
          createdAt: createdAt,
          updatedAt: new Date()
        }).returning();
        
        console.log(`✅ 삽입 완료: ID ${newRecord.id} - ${title}`);
        console.log(`   URL: ${gcsUrl}`);
        insertCount++;
        
      } catch (insertError) {
        console.error(`❌ 삽입 실패 (${fileName}):`, insertError);
      }
    }
    
    console.log('\n🎉 GCS 음악 동기화 완료!');
    console.log(`📊 결과: 신규 삽입 ${insertCount}개, 기존 유지 ${skipCount}개`);
    console.log(`📋 전체 파일: ${musicFiles.length}개`);
    
    // 4. 동기화 후 상태 확인
    const finalCount = await db.select().from(music);
    console.log(`🔍 최종 DB 음악 레코드 수: ${finalCount.length}개`);
    
  } catch (error) {
    console.error('❌ GCS 동기화 실패:', error);
    throw error;
  }
}

syncAllGCSMusicToDb().then(() => {
  console.log('✅ 동기화 스크립트 완료');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 동기화 스크립트 실패:', error);
  process.exit(1);
});