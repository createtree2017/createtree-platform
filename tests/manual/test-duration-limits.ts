/**
 * TopMediai API 음악 길이 제한 테스트
 * 더 긴 음악이 지원되는지 확인
 */

import { generateAiMusic } from '../../server/services/topmedia-service';

async function testDurationLimits() {
  console.log('🎵 TopMediai API 음악 길이 제한 테스트');
  
  const testDurations = [
    { duration: 240, label: '4분' },
    { duration: 300, label: '5분' },
    { duration: 360, label: '6분' },
    { duration: 600, label: '10분' }
  ];
  
  for (const test of testDurations) {
    console.log(`\n📊 ${test.label} (${test.duration}초) 테스트 중...`);
    
    try {
      const result = await generateAiMusic({
        prompt: `${test.label} 테스트 음악`,
        style: "piano",
        duration: test.duration,
        generateLyrics: false,
        instrumental: true,
        userId: "10",
        hospitalId: 1,
        title: `${test.label} 테스트`
      });
      
      if (result.success) {
        console.log(`✅ ${test.label} 성공: ${result.audioUrl}`);
      } else {
        console.log(`❌ ${test.label} 실패: ${result.error}`);
      }
      
    } catch (error: any) {
      console.log(`❌ ${test.label} 오류: ${error.message}`);
    }
    
    // API 부하 방지를 위한 대기
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

testDurationLimits();