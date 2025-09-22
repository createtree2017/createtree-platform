/**
 * GCS 버킷의 모든 .mp3 파일 수집
 */

import { Storage } from '@google-cloud/storage';
import fs from 'fs';

async function collectAllGCSMp3Files() {
  console.log('🔍 GCS 버킷의 모든 .mp3 파일 수집 시작...');
  
  try {
    // GCS 클라이언트 초기화
    const storage = new Storage({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './server/createtreeai-firebase-adminsdk-k6ozb-59e3d2c3a5.json',
      projectId: 'createtreeai'
    });
    
    const bucketName = 'createtree-upload';
    const bucket = storage.bucket(bucketName);
    
    // 모든 파일 나열
    const [files] = await bucket.getFiles();
    
    // .mp3 파일만 필터링
    const mp3Files = files
      .filter(file => file.name.endsWith('.mp3'))
      .map(file => ({
        name: file.name,
        fullUrl: `https://storage.googleapis.com/createtree-upload/${file.name}`,
        size: file.metadata.size,
        created: file.metadata.timeCreated
      }));
    
    console.log(`✅ 총 ${mp3Files.length}개의 .mp3 파일 발견:`);
    console.log('');
    
    mp3Files.forEach((file, index) => {
      console.log(`${index + 1}. ${file.name}`);
      console.log(`   URL: ${file.fullUrl}`);
      console.log(`   크기: ${Math.round(parseInt(file.size) / 1024 / 1024 * 100) / 100}MB`);
      console.log(`   생성일: ${file.created}`);
      console.log('');
    });
    
    // 파일 목록을 JSON으로 저장
    const result = {
      totalCount: mp3Files.length,
      files: mp3Files
    };
    
    fs.writeFileSync('gcs-mp3-files.json', JSON.stringify(result, null, 2));
    console.log('📝 결과를 gcs-mp3-files.json에 저장했습니다.');
    
    return mp3Files;
    
  } catch (error) {
    console.error('❌ GCS 파일 수집 중 오류:', error);
    
    // 대안: 알려진 파일들을 직접 확인
    console.log('🔄 대안 방법: 알려진 파일들 직접 확인...');
    
    const knownFiles = [
      'music/30.mp3',
      'music/90_1749835759314.mp3',
      'music/e3a403be-f53e-42ed-ace1-716574ad8bff.mp3',
      'music/8e754aeb-eb7a-44d0-9e1b-bfbd1de9ebc0.mp3',
      'music/359dbe82-b125-406a-b8d4-7902f7c23456.mp3',
      'music/music_79_1749835759314.mp3',
      'music/music_80_1749835759314.mp3',
      'music/music_81_1749881687782.mp3',
      'music/music_82_1749881687803.mp3'
    ];
    
    console.log('📋 알려진 GCS 음악 파일들:');
    knownFiles.forEach((file, index) => {
      const fullUrl = `https://storage.googleapis.com/createtree-upload/${file}`;
      console.log(`${index + 1}. ${file}`);
      console.log(`   URL: ${fullUrl}`);
    });
    
    return knownFiles.map(file => ({
      name: file,
      fullUrl: `https://storage.googleapis.com/createtree-upload/${file}`
    }));
  }
}

collectAllGCSMp3Files().catch(console.error);