/**
 * GCS 음악 파일을 로컬 static 폴더로 다운로드
 * 브라우저 직접 접근을 위한 로컬 파일 생성
 */

import { db } from "./db/index.js";
import { music } from "./shared/schema.js";
import { eq } from "drizzle-orm";
import fs from 'fs';
import path from 'path';

async function downloadMusicToStatic() {
  console.log('🎵 음악 파일 로컬 다운로드 시작...');
  
  try {
    // static/music 디렉토리 생성
    const musicDir = './static/music';
    if (!fs.existsSync(musicDir)) {
      fs.mkdirSync(musicDir, { recursive: true });
      console.log(`📁 디렉토리 생성: ${musicDir}`);
    }
    
    // DB에서 모든 완료된 GCS 음악 조회
    const musicList = await db.query.music.findMany({
      where: (music, { and, eq, like, isNotNull, ne }) => and(
        eq(music.status, 'completed'),
        isNotNull(music.url),
        ne(music.url, ''),
        like(music.url, '%storage.%google%')
      ),
      orderBy: (music, { desc }) => desc(music.id)
    });
    
    console.log(`📋 총 ${musicList.length}개의 음악 파일 다운로드 대상`);
    
    for (const musicRecord of musicList) {
      try {
        console.log(`\n🎵 처리 중: ID=${musicRecord.id}, 제목=${musicRecord.title}`);
        
        // URL에서 파일명 추출
        const urlParts = musicRecord.url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const localPath = path.join(musicDir, fileName);
        
        console.log(`📁 저장 경로: ${localPath}`);
        
        // 이미 파일이 있으면 스킵
        if (fs.existsSync(localPath)) {
          console.log(`✅ 파일이 이미 존재함: ${fileName}`);
          
          // DB URL을 로컬 경로로 업데이트
          const staticUrl = `/static/music/${fileName}`;
          await db.update(music)
            .set({ 
              url: staticUrl,
              updatedAt: new Date()
            })
            .where(eq(music.id, musicRecord.id));
          
          console.log(`✅ DB URL 업데이트: ${staticUrl}`);
          continue;
        }
        
        console.log(`⬇️ 다운로드 시작: ${musicRecord.url}`);
        
        // GCS에서 파일 다운로드 (인증 없이 시도)
        const response = await fetch(musicRecord.url);
        
        if (response.ok && response.body) {
          const buffer = await response.arrayBuffer();
          fs.writeFileSync(localPath, Buffer.from(buffer));
          
          const fileSizeKB = Math.round(buffer.byteLength / 1024);
          console.log(`✅ 다운로드 완료: ${fileName} (${fileSizeKB}KB)`);
          
          // DB URL을 로컬 경로로 업데이트
          const staticUrl = `/static/music/${fileName}`;
          await db.update(music)
            .set({ 
              url: staticUrl,
              updatedAt: new Date()
            })
            .where(eq(music.id, musicRecord.id));
          
          console.log(`✅ DB URL 업데이트: ${staticUrl}`);
          
        } else {
          console.log(`❌ 다운로드 실패: ${response.status} ${response.statusText}`);
          
          // 응답이 HTML인지 확인 (Google 로그인 페이지)
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
            console.log(`❌ Google 인증 페이지 반환됨, 파일 접근 불가`);
          }
        }
        
      } catch (error) {
        console.error(`❌ 파일 처리 오류 (ID: ${musicRecord.id}):`, error);
      }
    }
    
    console.log('\n🎉 음악 파일 다운로드 작업 완료!');
    
    // 다운로드된 파일 목록 확인
    if (fs.existsSync(musicDir)) {
      const files = fs.readdirSync(musicDir);
      console.log(`📁 로컬 음악 파일: ${files.length}개`);
      files.forEach(file => {
        const filePath = path.join(musicDir, file);
        const stats = fs.statSync(filePath);
        const sizeKB = Math.round(stats.size / 1024);
        console.log(`  - ${file} (${sizeKB}KB)`);
      });
    }
    
  } catch (error) {
    console.error('❌ 전체 처리 오류:', error);
  }
}

downloadMusicToStatic();