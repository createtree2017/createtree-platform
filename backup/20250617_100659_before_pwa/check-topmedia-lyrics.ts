/**
 * TopMediai API에서 실제 가사 확인
 */

async function checkTopMediaLyrics() {
  const songId = '58061f45-66a3-4046-84a7-2dea615585af';
  
  try {
    console.log(`🔍 TopMediai API에서 가사 확인 중... (songId: ${songId})`);
    
    const response = await fetch('https://aimusic-api.topmediai.com/api/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TOPMEDIA_API_KEY}`
      },
      body: JSON.stringify({
        song_id: songId
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('TopMediai 응답:', JSON.stringify(result, null, 2));
      
      if (result.data && Array.isArray(result.data)) {
        const musicData = result.data.find((item: any) => item.song_id === songId);
        if (musicData && musicData.lyric) {
          console.log('\n📝 TopMediai에서 생성된 가사:');
          console.log('=' .repeat(50));
          console.log(musicData.lyric);
          console.log('=' .repeat(50));
          console.log('\n✅ 결론: 가사는 TopMediai AI가 생성했습니다.');
        } else {
          console.log('❌ TopMediai 응답에서 가사를 찾을 수 없습니다.');
        }
      } else {
        console.log('❌ TopMediai 응답 형식이 예상과 다릅니다.');
      }
    } else {
      console.log(`❌ TopMediai API 오류: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    console.error('❌ TopMediai API 호출 실패:', error);
  }
}

checkTopMediaLyrics();