/**
 * 음악 파일 공개 접근 권한 최종 설정
 * 모든 GCS 음악 파일에 대해 공개 읽기 권한 부여
 */

import { db } from "./db/index.js";
import { music } from "./shared/schema.js";
import { Storage } from '@google-cloud/storage';
import fs from 'fs';

async function fixMusicPublicAccessFinal() {
  console.log('🎵 음악 파일 공개 접근 권한 최종 설정 시작...');
  
  try {
    // 서비스 계정 키 로드
    const serviceAccountPath = './server/createtree-5ae3581cc6a4.json';
    const serviceAccountKey = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    const storage = new Storage({
      projectId: 'createtree',
      credentials: serviceAccountKey
    });
    
    const bucket = storage.bucket('createtree-upload');
    
    // GCS URL을 가진 음악 목록 조회
    const musicList = await db.query.music.findMany({
      where: (music, { like }) => like(music.url, '%storage.googleapis.com%'),
      orderBy: (music, { desc }) => desc(music.id)
    });
    
    console.log(`📋 총 ${musicList.length}개의 GCS 음악 파일 발견`);
    
    for (const musicRecord of musicList) {
      try {
        console.log(`\n🎵 처리 중: ID=${musicRecord.id}, URL=${musicRecord.url}`);
        
        // URL에서 파일 경로 추출
        const urlParts = musicRecord.url.split('/');
        const fileName = urlParts.slice(4).join('/'); // music/89_1749835540319.mp3
        
        console.log(`📁 파일 경로: ${fileName}`);
        
        const file = bucket.file(fileName);
        
        // 파일 존재 확인
        const [exists] = await file.exists();
        if (!exists) {
          console.log(`❌ 파일이 존재하지 않음: ${fileName}`);
          continue;
        }
        
        // 공개 접근 권한 설정
        await file.makePublic();
        console.log(`✅ 공개 접근 권한 설정 완료: ${fileName}`);
        
        // 접근 테스트
        const testResponse = await fetch(musicRecord.url, { method: 'HEAD' });
        console.log(`🔍 접근 테스트 결과: ${testResponse.status} ${testResponse.statusText}`);
        
      } catch (error) {
        console.error(`❌ 처리 오류 (ID: ${musicRecord.id}):`, error);
      }
    }
    
    console.log('\n🎉 음악 파일 공개 접근 권한 설정 완료!');
    
  } catch (error) {
    console.error('❌ 전체 처리 오류:', error);
  }
}

fixMusicPublicAccessFinal();