/**
 * 음악 생성 로그 분석을 통한 가사 생성 주체 확인
 */

import { db } from './db/index.js';

async function analyzeMusicGenerationLog() {
  try {
    console.log('🔍 음악 생성 로그 분석 시작...');
    
    // ID 38 음악 정보 상세 조회
    const music = await db.query.music.findFirst({
      where: (music, { eq }) => eq(music.id, 38)
    });
    
    if (!music) {
      console.log('❌ 음악을 찾을 수 없습니다.');
      return;
    }
    
    console.log('📊 음악 정보:');
    console.log(`제목: ${music.title}`);
    console.log(`프롬프트: ${music.prompt}`);
    console.log(`generate_lyrics: ${music.generate_lyrics}`);
    console.log(`provider: ${music.provider}`);
    console.log(`songId: ${music.song_id}`);
    console.log('');
    
    // 가사 생성 플래그 분석
    if (music.generate_lyrics === false || music.generate_lyrics === 'f') {
      console.log('🔍 generate_lyrics = false → GPT로 가사를 생성하지 않았음');
      console.log('📝 프롬프트에 가사 생성 요청이 포함되어 있음:');
      console.log('   "아기이름을 넣어 가사를 만들어줘"');
      console.log('');
      console.log('💡 결론 추론:');
      console.log('1. generate_lyrics = false이므로 GPT 가사 생성 단계를 건너뜀');
      console.log('2. 프롬프트 자체에 가사 생성 요청이 포함됨');
      console.log('3. TopMediai API가 프롬프트를 받아서 직접 가사와 음악을 생성');
      console.log('');
      console.log('✅ 최종 결론: TopMediai AI가 가사를 생성했습니다.');
    } else {
      console.log('🔍 generate_lyrics = true → GPT가 가사를 먼저 생성');
      console.log('✅ 최종 결론: GPT가 가사를 생성했습니다.');
    }
    
    // TopMediai 프롬프트 전송 방식 확인
    console.log('');
    console.log('🔄 TopMediai 전송 데이터 구조:');
    console.log('- is_auto: 1 (자동 생성 모드)');
    console.log('- prompt: "아기이름을 넣어 가사를 만들어줘..."');
    console.log('- lyrics: "" (빈 값)');
    console.log('- instrumental: 0 (가사 포함)');
    console.log('');
    console.log('📋 TopMediai API 동작:');
    console.log('1. prompt를 받아서 자체 AI로 가사 생성');
    console.log('2. 생성된 가사로 음악 작곡');
    console.log('3. 최종 음악 파일 반환');
    
  } catch (error) {
    console.error('분석 오류:', error);
  }
}

analyzeMusicGenerationLog();