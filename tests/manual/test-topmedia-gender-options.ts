/**
 * TopMediai API 성별/목소리 옵션 테스트
 * 실제 지원되는 gender 값들을 확인
 */

import { submitMusicTask, queryMusic } from "../../server/services/topmedia-service";

interface SubmitMusicDTO {
  is_auto: 0 | 1;
  prompt: string;
  lyrics?: string;
  title?: string;
  instrumental: 0 | 1;
  model_version?: string;
  gender?: string;
}

async function testTopMediaiGenderOptions() {
  console.log('🎵 TopMediai 성별 옵션 테스트 시작');
  
  // 테스트할 성별 옵션들
  const genderOptions = [
    'male',
    'female', 
    'child',
    'baby',
    'boy',
    'girl',
    'auto',
    undefined // 성별 미지정
  ];
  
  for (const gender of genderOptions) {
    console.log(`\n📝 테스트 중: gender = ${gender || 'undefined'}`);
    
    try {
      const musicData: SubmitMusicDTO = {
        is_auto: 1,
        prompt: "간단한 자장가",
        lyrics: "",
        title: `성별테스트_${gender || 'none'}`,
        instrumental: 0,
        model_version: "v4.0",
        gender: gender
      };
      
      console.log('📤 요청 데이터:', JSON.stringify(musicData, null, 2));
      
      // API 요청 보내기
      const songId = await submitMusicTask(musicData);
      console.log(`✅ 성공: songId = ${songId}`);
      
      // 잠시 대기 후 상태 확인
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const result = await queryMusic(songId);
      console.log('📊 초기 응답:', JSON.stringify(result, null, 2));
      
    } catch (error: any) {
      console.error(`❌ 실패 (gender: ${gender}):`, error.message);
      
      // 에러 응답에서 지원되지 않는 값인지 확인
      if (error.message.includes('gender') || error.message.includes('invalid')) {
        console.log('💡 이 gender 값은 지원되지 않는 것 같습니다');
      }
    }
    
    // API 요청 간격 조절
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🔍 TopMediai 공식 문서 확인 필요:');
  console.log('- https://api.topmediai.com/docs');
  console.log('- 지원되는 gender 파라미터 값들');
  console.log('- 아기/어린이 목소리 지원 여부');
}

// 실행
testTopMediaiGenderOptions().catch(console.error);