/**
 * TopMediai API 실제 응답 구조 분석 및 테스트
 */

// 실제 로그에서 확인된 응답 구조
const 실제응답예시 = {
  status: 200,
  message: 'Success',
  data: [
    {
      audio: 'https://aimusic-api.topmediai.com/api/audio/9c4e64dd-d9ff-49bf-81dd-c800485313f4',
      audio_duration: -1,
      image: 'https://files.topmediai.com/aimusic/8998299/c8361a47-e7c0-4ed8-a62d-75069774a320-image.png',
      lyric: '[verse 1]...',
      song_id: '9c4e64dd-d9ff-49bf-81dd-c800485313f4',
      status: 'RUNNING',
      tags: 'piano music: ...',
      title: '우리집 보물'
    }
  ]
};

function 응답구조분석(response: any) {
  console.log('=== TopMediai 응답 구조 분석 ===');
  console.log('전체 응답:', JSON.stringify(response, null, 2));
  
  // song_id 추출 로직 테스트
  let songId;
  
  if (response.data && Array.isArray(response.data) && response.data.length > 0) {
    songId = response.data[0].song_id;
    console.log('✅ 배열 첫번째 요소에서 song_id 추출:', songId);
    
    // 음악 정보도 함께 추출
    const 첫번째음악 = response.data[0];
    console.log('🎵 음악 정보:', {
      song_id: 첫번째음악.song_id,
      audio: 첫번째음악.audio,
      status: 첫번째음악.status,
      title: 첫번째음악.title
    });
    
    return {
      songId: 첫번째음악.song_id,
      audioUrl: 첫번째음악.audio,
      status: 첫번째음악.status,
      lyrics: 첫번째음악.lyric,
      title: 첫번째음악.title
    };
  }
  
  console.log('❌ song_id 추출 실패');
  return null;
}

// 테스트 실행
const 결과 = 응답구조분석(실제응답예시);
console.log('최종 추출 결과:', 결과);