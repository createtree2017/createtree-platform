/**
 * 현재 GCS 버킷의 음악 파일 확인
 */

import { Storage } from '@google-cloud/storage';
import { db } from './db/index';
import { music } from '@shared/schema';
import { eq } from 'drizzle-orm';

const storage = new Storage({
  projectId: 'createtreeai'
});

const bucketName = 'createtree-upload';

async function checkCurrentGCSMusic() {
  try {
    console.log('🔍 GCS 음악 파일 확인 시작...');
    
    // 1. 최근 생성된 음악 DB 조회
    const recentMusic = await db.query.music.findMany({
      where: (music, { gte }) => gte(music.createdAt, new Date('2025-06-13 08:30:00')),
      columns: {
        id: true,
        title: true,
        url: true,
        gcsPath: true,
        status: true,
        createdAt: true
      },
      orderBy: (music, { desc }) => [desc(music.createdAt)],
      limit: 10
    });

    console.log('📋 최근 음악 DB 레코드:', recentMusic);

    // 2. GCS 버킷에서 music/ 폴더 파일 목록 조회
    const [files] = await storage.bucket(bucketName).getFiles({
      prefix: 'music/',
      delimiter: '/'
    });

    const musicFiles = files
      .filter(file => file.name.endsWith('.mp3'))
      .map(file => ({
        name: file.name,
        size: file.metadata.size,
        timeCreated: file.metadata.timeCreated,
        publicUrl: `https://storage.googleapis.com/${bucketName}/${file.name}`
      }))
      .sort((a, b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime())
      .slice(0, 10);

    console.log('🎵 GCS 음악 파일 목록:', musicFiles);

    // 3. 최근 음악 파일 세부 정보
    if (musicFiles.length > 0) {
      console.log('\n📁 최근 GCS 음악 파일들:');
      for (const file of musicFiles) {
        console.log(`- ${file.name}`);
        console.log(`  크기: ${Math.round(parseInt(file.size) / 1024 / 1024 * 100) / 100} MB`);
        console.log(`  생성시간: ${file.timeCreated}`);
        console.log(`  공개 URL: ${file.publicUrl}`);
        console.log('');
      }
    }

    // 4. DB와 GCS 파일 매칭 확인
    console.log('\n🔗 DB와 GCS 매칭 확인:');
    for (const dbRecord of recentMusic) {
      if (dbRecord.url) {
        const gcsFileName = dbRecord.url.includes('googleapis.com') ? 
          dbRecord.url.split('/').slice(-1)[0] : 
          null;
        
        const matchingFile = musicFiles.find(f => f.name.includes(gcsFileName || ''));
        
        console.log(`ID ${dbRecord.id} (${dbRecord.title}):`);
        console.log(`  DB URL: ${dbRecord.url}`);
        console.log(`  GCS 파일: ${matchingFile ? '✅ 존재' : '❌ 없음'}`);
        console.log(`  상태: ${dbRecord.status}`);
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ GCS 음악 확인 실패:', error);
  }
}

checkCurrentGCSMusic();