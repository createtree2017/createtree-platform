/**
 * GCS 인증 우회 - 수동 DB 동기화
 * 알려진 GCS 파일명을 기준으로 누락된 레코드만 삽입
 */

import { db } from './db';
import { music } from './shared/schema';
import { eq } from 'drizzle-orm';

// 알려진 GCS 파일 목록 (22개)
const knownGCSFiles = [
  'music/6a0725bb-b879-4777-b9c4-3391b7ee08a0.mp3',
  'music/54f41c69-24c4-4b7d-83d3-38ed543b7d18.mp3', 
  'music/0001be6a-b4dc-44e6-8e0d-a38c98ad7c0c.mp3',
  'music/72b5aa25-2094-4cad-b8fb-4b6a3b54c1a8.mp3',
  'music/45c0e062-c89c-42d8-a45e-9e4e5da47e4c.mp3',
  'music/d74bcc12-9b39-4999-9ea8-dd5cc6b44cfe.mp3',
  'music/8e754aeb-eb7a-44d0-9e1b-bfbd1de9ebc0.mp3',
  'music/7b5e89c5-80fd-4cc9-84c7-72c60e45a922.mp3',
  'music/bba54f3e-74af-4b74-8b93-b2b6b65d6b5a.mp3',
  'music/bd5b6a8a-2b5e-4b90-95b1-414b-9a3d-2541f4d28c1a.mp3',
  'music/df56f881-8394-4943-9dcc-e4489aca1d25.mp3',
  'music/e3a403be-f53e-42ed-ace1-716574ad8bff.mp3',
  'music/test-1749740758015.mp3',
  'music/music_90_1749858383838.mp3',
  'music/music_89_1749857842344.mp3',
  'music/music_88_1749857566493.mp3',
  'music/music_87_1749857243068.mp3',
  'music/music_86_1749857008145.mp3',
  'music/music_85_1749856730246.mp3',
  'music/music_84_1749856374404.mp3',
  'music/music_83_1749856072998.mp3',
  'music/music_82_1749855822357.mp3'
];

async function manualSyncGCSToDb() {
  try {
    console.log('🔄 수동 GCS-DB 동기화 시작...');
    console.log(`📁 대상 파일 수: ${knownGCSFiles.length}개`);
    
    // 기존 DB 레코드 조회
    const existingMusic = await db.select({
      id: music.id,
      url: music.url,
      gcsPath: music.gcsPath,
      title: music.title
    }).from(music);
    
    console.log(`📋 기존 DB 레코드: ${existingMusic.length}개`);
    
    // 기존 URL과 gcsPath 패턴 추출
    const existingUrls = new Set(existingMusic.map(m => m.url).filter(Boolean));
    const existingPaths = new Set(existingMusic.map(m => m.gcsPath).filter(Boolean));
    
    let insertCount = 0;
    let skipCount = 0;
    
    // 각 GCS 파일에 대해 DB 확인 및 삽입
    for (const gcsPath of knownGCSFiles) {
      const fileName = gcsPath.replace('music/', '');
      const gcsUrl = `https://storage.googleapis.com/createtree-upload/${gcsPath}`;
      
      // 중복 확인 (URL 또는 gcsPath 기준)
      const isDuplicate = existingUrls.has(gcsUrl) || 
                         existingPaths.has(gcsPath) ||
                         existingMusic.some(m => 
                           m.url?.includes(fileName) || 
                           m.gcsPath?.includes(fileName)
                         );
      
      if (isDuplicate) {
        console.log(`⏭️  이미 존재: ${fileName}`);
        skipCount++;
        continue;
      }
      
      // 파일명에서 제목 추출
      let title = fileName.replace(/\.mp3$/, '');
      
      // music_ID_timestamp 패턴인 경우
      if (title.startsWith('music_')) {
        const parts = title.split('_');
        if (parts.length >= 2) {
          title = `음악 ${parts[1]}`;
        }
      } else {
        // UUID 패턴 정리
        title = title.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '');
        title = title.replace(/^[-_]+|[-_]+$/g, ''); // 앞뒤 구분자 제거
        if (title.length < 3) {
          title = `GCS 음악 ${insertCount + 1}`;
        }
      }
      
      // DB에 레코드 삽입
      try {
        const [newRecord] = await db.insert(music).values({
          title: title,
          prompt: '자동 동기화된 GCS 음악',
          style: 'unknown',
          url: gcsUrl,
          gcsPath: gcsPath,
          status: 'completed',
          provider: 'gcs_sync',
          engine: 'unknown',
          duration: 180,
          creditUsed: 0,
          userId: 10, // 슈퍼관리자
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning();
        
        console.log(`✅ 삽입 완료: ID ${newRecord.id} - ${title}`);
        console.log(`   URL: ${gcsUrl}`);
        insertCount++;
        
      } catch (insertError: any) {
        console.error(`❌ 삽입 실패 (${fileName}):`, insertError.message);
      }
    }
    
    console.log('\n🎉 수동 동기화 완료!');
    console.log(`📊 결과: 신규 삽입 ${insertCount}개, 기존 유지 ${skipCount}개`);
    console.log(`📋 총 대상 파일: ${knownGCSFiles.length}개`);
    
    // 최종 확인
    const finalMusic = await db.select().from(music).where(eq(music.status, 'completed'));
    console.log(`🔍 최종 완료 상태 음악: ${finalMusic.length}개`);
    
  } catch (error) {
    console.error('❌ 수동 동기화 실패:', error);
    throw error;
  }
}

manualSyncGCSToDb().then(() => {
  console.log('✅ 수동 동기화 완료');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 동기화 실패:', error);
  process.exit(1);
});