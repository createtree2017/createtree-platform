/**
 * TopMediai 가사 생성 API 상세 분석
 */

const API_BASE_URL = 'https://aimusic-api.topmediai.com';
const API_KEY = process.env.TOPMEDIA_API_KEY || '0696de496a39450790a5582fe823c730';

async function analyzeLyricsAPI() {
  console.log('🔍 TopMediai 가사 API 상세 분석');
  
  // 기본 요청으로 응답 구조 파악
  const basicRequest = {
    prompt: "아기를 위한 따뜻한 자장가"
  };

  try {
    const response = await fetch(`${API_BASE_URL}/v1/lyrics`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(basicRequest)
    });

    if (response.ok) {
      const data = await response.json();
      console.log('\n📋 전체 응답 구조:');
      console.log(JSON.stringify(data, null, 2));
      
      // 응답 필드 분석
      console.log('\n🔎 응답 필드 분석:');
      Object.keys(data).forEach(key => {
        console.log(`- ${key}: ${typeof data[key]} (${data[key] ? '값 있음' : '값 없음'})`);
      });
      
      // 가사 필드 위치 확인
      console.log('\n📝 가사 데이터 위치:');
      if (data.lyrics) {
        console.log('✅ data.lyrics 존재');
        console.log('가사 내용:', data.lyrics.substring(0, 100) + '...');
      }
      if (data.data?.lyrics) {
        console.log('✅ data.data.lyrics 존재');
      }
      if (data.result?.lyrics) {
        console.log('✅ data.result.lyrics 존재');
      }
      if (data.lyric) {
        console.log('✅ data.lyric 존재');
        console.log('가사 내용:', data.lyric.substring(0, 100) + '...');
      }
      
    } else {
      console.log('❌ 요청 실패:', response.status);
    }
    
  } catch (error) {
    console.error('❌ 오류:', error);
  }
}

analyzeLyricsAPI();