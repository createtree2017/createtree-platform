/**
 * 음악 중복 표시 문제 진단
 */
import { db } from './db';
import { music } from './shared/schema';

async function checkMusicDuplicates() {
  console.log('=== 음악 중복 문제 진단 ===');
  
  // 전체 음악 목록 조회
  const allMusic = await db.query.music.findMany({
    orderBy: (music, { desc }) => [desc(music.createdAt)],
    columns: {
      id: true,
      title: true,
      url: true,
      babyName: true,
      createdAt: true,
      userId: true
    }
  });
  
  console.log(`총 음악 개수: ${allMusic.length}`);
  
  // 제목별 그룹화
  const titleGroups: Record<string, any[]> = {};
  allMusic.forEach(m => {
    if (!titleGroups[m.title]) {
      titleGroups[m.title] = [];
    }
    titleGroups[m.title].push(m);
  });
  
  console.log('\n=== 제목별 중복 분석 ===');
  Object.entries(titleGroups).forEach(([title, musicList]) => {
    if (musicList.length > 1) {
      console.log(`\n중복 제목: "${title}" (${musicList.length}개)`);
      musicList.forEach(m => {
        console.log(`  - ID: ${m.id}, 생성일: ${m.createdAt}, URL: ${m.url?.substring(0, 50)}...`);
      });
    }
  });
  
  // URL별 그룹화
  const urlGroups: Record<string, any[]> = {};
  allMusic.forEach(m => {
    if (m.url) {
      if (!urlGroups[m.url]) {
        urlGroups[m.url] = [];
      }
      urlGroups[m.url].push(m);
    }
  });
  
  console.log('\n=== URL별 중복 분석 ===');
  Object.entries(urlGroups).forEach(([url, musicList]) => {
    if (musicList.length > 1) {
      console.log(`\n중복 URL: ${url.substring(0, 50)}... (${musicList.length}개)`);
      musicList.forEach(m => {
        console.log(`  - ID: ${m.id}, 제목: ${m.title}, 생성일: ${m.createdAt}`);
      });
    }
  });
  
  // 최근 5개 음악 상세 정보
  console.log('\n=== 최근 5개 음악 상세 정보 ===');
  allMusic.slice(0, 5).forEach(m => {
    console.log(`ID: ${m.id}, 제목: ${m.title}, URL: ${m.url}`);
  });
}

checkMusicDuplicates().catch(console.error);
