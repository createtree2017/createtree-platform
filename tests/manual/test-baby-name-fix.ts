/**
 * 아기 이름 가사 반영 수정 테스트
 * 수정된 코드로 "송예승"이 가사에 올바르게 포함되는지 확인
 */

const TOPMEDIA_API_KEY = process.env.TOPMEDIA_API_KEY;

interface TestMusicRequest {
  title: string;
  prompt: string;
  babyName: string;
  style: string;
  duration: number;
  userId: string;
  generateLyrics: boolean;
}

async function testBabyNameFix() {
  console.log('👶 아기 이름 가사 반영 테스트 시작...');
  
  const testRequest: TestMusicRequest = {
    title: "예승이를 위한 특별한 노래",
    prompt: "예승이를 사랑하는 마음을 담은 따뜻한 노래",
    babyName: "송예승",
    style: "lullaby",
    duration: 120, // 짧게 테스트
    userId: "10",
    generateLyrics: true
  };

  try {
    console.log('📝 테스트 요청 데이터:', testRequest);
    
    const response = await fetch('http://localhost:5000/api/music-engine/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTAsInVzZXJJZCI6MTAsImVtYWlsIjoiY3QuY3JlYXRldHJlZUBnbWFpbC5jb20iLCJtZW1iZXJUeXBlIjoic3VwZXJhZG1pbiIsImlhdCI6MTc0OTcwNzQwMSwiZXhwIjoxNzUyMjk5NDAxfQ.n9M8er0jKJdaXOQRE7OZ6PdpvwtWkbbXTpl2RzhnBwc'
      },
      body: JSON.stringify(testRequest)
    });

    const result = await response.json();
    
    console.log('🎵 테스트 결과:', {
      status: response.status,
      success: result.success,
      musicId: result.data?.musicId,
      title: result.data?.title
    });

    if (result.success && result.data?.lyrics) {
      console.log('\n📝 생성된 가사:');
      console.log('=' .repeat(50));
      console.log(result.data.lyrics);
      console.log('=' .repeat(50));
      
      const hasCorrectName = result.data.lyrics.includes('예승') || result.data.lyrics.includes('송예승');
      console.log(`\n✅ 아기 이름 포함 여부: ${hasCorrectName ? '성공' : '실패'}`);
      
      if (!hasCorrectName) {
        console.log('❌ 가사에 "예승" 또는 "송예승"이 포함되지 않았습니다.');
      } else {
        console.log('🎉 가사에 올바른 아기 이름이 포함되었습니다!');
      }
    } else {
      console.log('❌ 음악 생성 실패 또는 가사 없음');
    }

  } catch (error: any) {
    console.error('❌ 테스트 실패:', error.message);
  }
}

testBabyNameFix();