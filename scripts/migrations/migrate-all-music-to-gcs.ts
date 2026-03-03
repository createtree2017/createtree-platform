/**
 * 모든 로컬 음악 파일을 무조건 GCS로 이동
 * 19개 음악 파일을 일괄 GCS 업로드 및 DB 업데이트
 */

import { Storage } from '@google-cloud/storage';
import { db } from '../../db';
import { music } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

const storage = new Storage({
  projectId: 'createtreeai',
  keyFilename: './server/createtree-ai-firebase-adminsdk.json'
});

const bucket = storage.bucket('createtree-upload');

async function migrateAllMusicToGCS() {
  try {
    console.log('🎵 모든 로컬 음악 파일 GCS 마이그레이션 시작');
    
    // 1. 로컬에 저장된 모든 음악 조회
    const localMusicRecords = await db.query.music.findMany({
      where: eq(music.status, 'completed'),
      columns: {
        id: true,
        title: true,
        url: true,
        status: true
      }
    });
    
    const localMusic = localMusicRecords.filter(record => 
      record.url && record.url.startsWith('/static/')
    );
    
    console.log(`📋 로컬 음악 파일 개수: ${localMusic.length}개`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const musicRecord of localMusic) {
      try {
        console.log(`\n🔄 처리 중: ID ${musicRecord.id} - ${musicRecord.title}`);
        
        // 2. 로컬 파일 경로 추출
        const localPath = path.join(process.cwd(), musicRecord.url);
        
        // 3. 파일 존재 확인
        if (!fs.existsSync(localPath)) {
          console.log(`⚠️  파일 없음: ${localPath}`);
          continue;
        }
        
        // 4. GCS 키 생성
        const fileName = path.basename(musicRecord.url);
        const sanitizedTitle = musicRecord.title?.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_') || 'untitled';
        const gcsKey = `music/${musicRecord.id}_${sanitizedTitle}_${Date.now()}.mp3`;
        
        // 5. GCS 업로드
        console.log(`📤 GCS 업로드: ${gcsKey}`);
        
        const file = bucket.file(gcsKey);
        
        await bucket.upload(localPath, {
          destination: gcsKey,
          metadata: {
            contentType: 'audio/mpeg',
            metadata: {
              originalName: fileName,
              musicId: musicRecord.id.toString(),
              title: musicRecord.title || ''
            }
          }
        });
        
        // 6. 공개 접근 권한 설정
        await file.makePublic();
        
        const gcsUrl = `https://storage.cloud.google.com/createtree-upload/${gcsKey}`;
        
        // 7. 데이터베이스 업데이트
        await db.update(music)
          .set({
            url: gcsUrl,
            gcsPath: gcsKey,
            updatedAt: new Date()
          })
          .where(eq(music.id, musicRecord.id));
        
        console.log(`✅ 완료: ${gcsUrl}`);
        successCount++;
        
        // 8. 로컬 파일 삭제 (GCS 업로드 완료 후)
        try {
          fs.unlinkSync(localPath);
          console.log(`🗑️  로컬 파일 삭제: ${localPath}`);
        } catch (deleteError) {
          console.log(`⚠️  로컬 파일 삭제 실패: ${deleteError}`);
        }
        
      } catch (error) {
        console.error(`❌ 오류 - ID ${musicRecord.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 마이그레이션 완료!`);
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${errorCount}개`);
    
    // 9. 최종 결과 확인
    const updatedRecords = await db.query.music.findMany({
      where: eq(music.status, 'completed'),
      columns: {
        id: true,
        title: true,
        url: true
      }
    });
    
    const remainingLocalFiles = updatedRecords.filter(record => 
      record.url && record.url.startsWith('/static/')
    );
    
    console.log(`\n📊 최종 상태:`);
    console.log(`- GCS 저장: ${updatedRecords.filter(r => r.url?.includes('storage.cloud.google.com')).length}개`);
    console.log(`- Suno URL: ${updatedRecords.filter(r => r.url?.includes('suno')).length}개`);
    console.log(`- 남은 로컬 파일: ${remainingLocalFiles.length}개`);
    
    if (remainingLocalFiles.length > 0) {
      console.log('\n⚠️  아직 로컬에 남은 파일들:');
      remainingLocalFiles.forEach(record => {
        console.log(`- ID ${record.id}: ${record.title}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 마이그레이션 오류:', error);
  }
}

migrateAllMusicToGCS();