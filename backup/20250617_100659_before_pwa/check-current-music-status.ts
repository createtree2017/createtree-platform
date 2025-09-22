/**
 * 현재 음악 생성 상태 확인 스크립트
 */

import { db } from './db/index.js';

async function checkCurrentMusicStatus() {
  try {
    console.log('🔍 현재 음악 생성 상태 확인...');
    
    // 최근 음악 목록 조회
    const recentMusic = await db.query.music.findMany({
      orderBy: (music, { desc }) => [desc(music.id)],
      limit: 5
    });
    
    console.log(`📊 최근 음악 ${recentMusic.length}개:`);
    
    recentMusic.forEach((music, index) => {
      console.log(`${index + 1}. [ID: ${music.id}] "${music.title}"`);
      console.log(`   상태: ${music.status}`);
      console.log(`   프롬프트: ${music.prompt?.substring(0, 50)}...`);
      console.log(`   생성시간: ${music.created_at}`);
      console.log(`   URL: ${music.url}`);
      console.log('');
    });
    
    // pending 상태인 음악 확인
    const pendingMusic = await db.query.music.findMany({
      where: (music, { eq }) => eq(music.status, 'pending')
    });
    
    if (pendingMusic.length > 0) {
      console.log('⏳ 현재 대기 중인 음악:');
      pendingMusic.forEach(music => {
        console.log(`- [ID: ${music.id}] "${music.title}" (songId: ${music.song_id})`);
      });
    } else {
      console.log('✅ 대기 중인 음악 없음');
    }
    
    // 최신 음악이 완료되었는지 확인
    const latestMusic = recentMusic[0];
    if (latestMusic) {
      console.log(`\n🎵 최신 음악: "${latestMusic.title}"`);
      console.log(`상태: ${latestMusic.status}`);
      
      if (latestMusic.status === 'completed') {
        console.log('✅ 최신 음악 생성 완료됨');
      } else if (latestMusic.status === 'pending') {
        console.log('⏳ 최신 음악이 아직 생성 중');
        
        // TopMediai API에서 상태 확인
        if (latestMusic.song_id) {
          console.log(`🔄 TopMediai 상태 확인 중... (songId: ${latestMusic.song_id})`);
          
          try {
            const response = await fetch('https://aimusic-api.topmediai.com/api/query', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.TOPMEDIA_API_KEY}`
              },
              body: JSON.stringify({
                song_id: latestMusic.song_id
              })
            });
            
            if (response.ok) {
              const result = await response.json();
              console.log('TopMediai 응답:', JSON.stringify(result, null, 2));
            } else {
              console.log(`TopMediai API 오류: ${response.status}`);
            }
          } catch (error) {
            console.error('TopMediai API 호출 실패:', error);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('음악 상태 확인 오류:', error);
  }
}

// 실행
checkCurrentMusicStatus();