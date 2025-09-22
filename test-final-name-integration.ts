/**
 * 최종 인물 이름 통합 테스트
 * 실제 API 엔드포인트를 통한 완전한 워크플로우 테스트
 */

async function testFinalNameIntegration() {
  const testData = {
    prompt: "따뜻한 자장가",
    babyName: "송기우",
    title: "송기우의 자장가",
    style: "lullaby",
    gender: "baby",
    duration: 120,
    instrumental: false,
    generateLyrics: true,
    preferredEngine: "topmedia"
  };

  console.log('🎵 최종 인물 이름 통합 테스트 시작');
  console.log('📝 테스트 데이터:', JSON.stringify(testData, null, 2));

  try {
    const response = await fetch('http://localhost:5000/api/music-engine/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTAsInVzZXJJZCI6MTAsImVtYWlsIjoiY3QuY3JlYXRldHJlZUBnbWFpbC5jb20iLCJtZW1iZXJUeXBlIjoic3VwZXJhZG1pbiIsImlhdCI6MTc0OTcwNzQwMSwiZXhwIjoxNzUyMjk5NDAxfQ.n9M8er0jKJdaXOQRE7OZ6PdpvwtWkbbXTpl2RzhnBwc'
      },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ API 요청 실패:', response.status, errorData);
      return;
    }

    const result = await response.json();
    console.log('✅ API 응답:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('🎉 음악 생성 요청 성공!');
      console.log(`📊 음악 ID: ${result.data.musicId}`);
      console.log(`🔧 사용된 엔진: ${result.data.engine}`);
      
      if (result.data.fallbackUsed) {
        console.log('⚠️ 대체 엔진 사용됨');
      }
    } else {
      console.log('❌ 음악 생성 실패:', result.error);
    }

  } catch (error: any) {
    console.error('❌ 네트워크 오류:', error.message);
  }
}

// 실행
testFinalNameIntegration().catch(console.error);