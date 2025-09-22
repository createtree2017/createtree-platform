/**
 * 간단한 Whisper 가사 추출 테스트
 * 기존 음악 파일에서 가사 추출 가능성 확인
 */

import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testWhisperWithSampleAudio() {
  console.log('🎤 Whisper API 가사 추출 테스트');
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY가 설정되지 않았습니다.');
    return;
  }
  
  // 샘플 오디오 파일 경로 (실제 파일이 있다고 가정)
  const sampleAudioPath = './static/audio/sample-lullaby.mp3';
  
  try {
    // 파일이 존재하는지 확인
    if (!fs.existsSync(sampleAudioPath)) {
      console.log(`❌ 샘플 오디오 파일이 없습니다: ${sampleAudioPath}`);
      console.log('실제 TopMediai 생성 음악으로 테스트하려면 GCS URL이 필요합니다.');
      return;
    }
    
    console.log(`📁 오디오 파일 확인: ${sampleAudioPath}`);
    
    // 파일 스트림 생성
    const audioStream = fs.createReadStream(sampleAudioPath);
    
    console.log('🔄 Whisper API 호출 중...');
    
    // Whisper API로 음성 인식
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      language: 'ko', // 한국어 우선
      prompt: '이것은 자장가 또는 태교 음악입니다. 가사를 정확하게 추출해주세요.',
      response_format: 'text'
    });
    
    const extractedText = transcription.trim();
    
    console.log('✅ Whisper API 응답 받음');
    console.log(`📝 추출된 텍스트 (${extractedText.length}자):`);
    console.log(extractedText);
    
    // 가사 품질 평가
    if (extractedText.length < 10) {
      console.log('⚠️ 추출된 텍스트가 너무 짧습니다.');
    } else if (extractedText.length > 30) {
      console.log('✅ 의미있는 가사로 판단됩니다.');
    } else {
      console.log('🤔 짧은 텍스트이지만 가사일 가능성이 있습니다.');
    }
    
    // 음악 관련 패턴 확인
    const musicPatterns = ['라라라', '후후후', '아아아', '음음음', '나나나'];
    const hasMusicalContent = musicPatterns.some(pattern => extractedText.includes(pattern));
    
    if (hasMusicalContent) {
      console.log('🎵 음악적 패턴이 감지되었습니다.');
    }
    
  } catch (error: any) {
    console.error('❌ Whisper API 테스트 실패:', error.message);
    
    if (error.code === 'invalid_api_key') {
      console.log('🔑 OpenAI API 키를 확인해주세요.');
    } else if (error.code === 'audio_file_invalid') {
      console.log('📁 오디오 파일 형식이 지원되지 않습니다.');
    }
  }
}

// 실제 GCS URL로 테스트하는 함수
async function testWhisperWithGCSUrl() {
  console.log('\n🌐 GCS URL 기반 가사 추출 테스트 준비');
  console.log('실제 TopMediai 생성 음악 URL이 필요합니다:');
  console.log('- https://storage.googleapis.com/createtree-upload/music/[파일명].mp3');
  console.log('음악 갤러리에서 최근 생성된 음악의 GCS URL을 확인하여 테스트 가능');
}

async function main() {
  await testWhisperWithSampleAudio();
  await testWhisperWithGCSUrl();
  
  console.log('\n📋 다음 단계:');
  console.log('1. TopMediai로 새 음악 생성');
  console.log('2. 생성된 GCS URL로 Whisper 가사 추출 테스트');
  console.log('3. UI에서 가사 표시 확인');
}

main().catch(console.error);