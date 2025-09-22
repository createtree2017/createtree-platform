/**
 * 음악 ID 89 "살려줘"를 GCS로 즉시 업로드
 * 로컬 파일을 GCS로 이동하여 무조건 GCS 저장 정책 준수
 */

import { Storage } from '@google-cloud/storage';
import { db } from './db';
import { music } from './shared/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

const storage = new Storage({
  projectId: 'createtreeai',
  keyFilename: './server/createtree-ai-firebase-adminsdk.json'
});

const bucket = storage.bucket('createtree-upload');

async function uploadMusicToGCS() {
  try {
    console.log('🎵 음악 ID 89 "살려줘" GCS 업로드 시작');
    
    // 1. 현재 음악 정보 확인
    const musicRecord = await db.query.music.findFirst({
      where: eq(music.id, 89)
    });
    
    if (!musicRecord) {
      console.error('❌ 음악 ID 89를 찾을 수 없습니다');
      return;
    }
    
    console.log('📋 현재 음악 정보:', {
      id: musicRecord.id,
      title: musicRecord.title,
      url: musicRecord.url,
      status: musicRecord.status
    });
    
    // 2. 로컬 파일 경로 확인
    const localPath = path.join(process.cwd(), 'static', 'music', '89_1749835540319.mp3');
    
    if (!fs.existsSync(localPath)) {
      console.error('❌ 로컬 파일이 존재하지 않습니다:', localPath);
      return;
    }
    
    console.log('✅ 로컬 파일 확인됨:', localPath);
    
    // 3. GCS 업로드
    const gcsKey = `music/89_살려줘_${Date.now()}.mp3`;
    const file = bucket.file(gcsKey);
    
    console.log('🔄 GCS 업로드 중...');
    
    await bucket.upload(localPath, {
      destination: gcsKey,
      metadata: {
        contentType: 'audio/mpeg',
        metadata: {
          originalName: '89_1749835540319.mp3',
          musicId: '89',
          title: '살려줘'
        }
      }
    });
    
    // 4. 공개 접근 권한 설정
    await file.makePublic();
    
    const gcsUrl = `https://storage.cloud.google.com/createtree-upload/${gcsKey}`;
    console.log('✅ GCS 업로드 완료:', gcsUrl);
    
    // 5. 데이터베이스 업데이트
    await db.update(music)
      .set({
        url: gcsUrl,
        updatedAt: new Date()
      })
      .where(eq(music.id, 89));
    
    console.log('✅ 데이터베이스 업데이트 완료');
    
    // 6. 업로드 검증
    const updatedRecord = await db.query.music.findFirst({
      where: eq(music.id, 89)
    });
    
    console.log('🎯 최종 결과:', {
      id: updatedRecord?.id,
      title: updatedRecord?.title,
      url: updatedRecord?.url,
      status: updatedRecord?.status
    });
    
    console.log('🎉 음악 ID 89 "살려줘" GCS 업로드 및 데이터베이스 업데이트 완료!');
    
  } catch (error) {
    console.error('❌ GCS 업로드 오류:', error);
  }
}

uploadMusicToGCS();