/**
 * 음악 파일에서 가사 추출 서비스
 * OpenAI Whisper API를 사용하여 생성된 음악에서 가사를 추출
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n')
  }
});

const bucket = storage.bucket('createtree-upload');

/**
 * GCS에서 음악 파일을 다운로드하여 임시 파일로 저장
 */
async function downloadMusicFromGCS(gcsUrl: string): Promise<string> {
  try {
    // GCS URL에서 파일 경로 추출
    const urlParts = gcsUrl.replace('https://storage.googleapis.com/createtree-upload/', '');
    const file = bucket.file(urlParts);
    
    // 임시 파일 경로 생성
    const tempDir = './temp';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, `music_${Date.now()}.mp3`);
    
    // 파일 다운로드
    console.log(`[가사 추출] GCS에서 파일 다운로드 중: ${urlParts}`);
    await file.download({ destination: tempFilePath });
    
    console.log(`[가사 추출] 임시 파일 저장 완료: ${tempFilePath}`);
    return tempFilePath;
    
  } catch (error) {
    console.error('[가사 추출] GCS 다운로드 실패:', error);
    throw new Error('음악 파일 다운로드에 실패했습니다.');
  }
}

/**
 * 임시 파일 삭제
 */
function cleanupTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[가사 추출] 임시 파일 삭제 완료: ${filePath}`);
    }
  } catch (error) {
    console.warn('[가사 추출] 임시 파일 삭제 실패:', error);
  }
}

/**
 * OpenAI Whisper API를 사용하여 음악에서 가사 추출
 */
async function extractLyricsWithWhisper(filePath: string): Promise<string | null> {
  try {
    console.log('[가사 추출] Whisper API로 가사 추출 시작');
    
    // 파일 스트림 생성
    const audioStream = fs.createReadStream(filePath);
    
    // Whisper API 호출 (가사 조작 금지)
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      language: 'ko', // 한국어 우선
      prompt: '이것은 음악 파일입니다. 실제로 불린 가사만 정확하게 추출해주세요. 없는 내용은 추가하지 마세요.', // 원본 유지 강조
      response_format: 'text'
    });
    
    const extractedText = transcription.trim();
    console.log(`[가사 추출] 추출된 텍스트 (${extractedText.length}자): ${extractedText.substring(0, 100)}...`);
    
    // 가사로 판단되는 텍스트인지 검증
    if (extractedText.length < 10) {
      console.log('[가사 추출] 추출된 텍스트가 너무 짧음 - 가사 아닐 가능성');
      return null;
    }
    
    // 음악/노래 관련 키워드가 있는지 확인 (선택적)
    const musicKeywords = ['라라라', '후후후', '아아아', '음음음', '나나나'];
    const hasMusicalContent = musicKeywords.some(keyword => extractedText.includes(keyword));
    
    if (hasMusicalContent || extractedText.length > 30) {
      return extractedText;
    }
    
    console.log('[가사 추출] 의미있는 가사를 찾을 수 없음');
    return null;
    
  } catch (error) {
    console.error('[가사 추출] Whisper API 호출 실패:', error);
    throw new Error('가사 추출 중 오류가 발생했습니다.');
  }
}

/**
 * 메인 가사 추출 함수
 */
export async function extractLyricsFromMusic(musicUrl: string): Promise<string | null> {
  let tempFilePath: string | null = null;
  
  try {
    console.log(`[가사 추출] 시작: ${musicUrl}`);
    
    // 1. GCS에서 음악 파일 다운로드
    tempFilePath = await downloadMusicFromGCS(musicUrl);
    
    // 2. Whisper API로 가사 추출
    const lyrics = await extractLyricsWithWhisper(tempFilePath);
    
    if (lyrics) {
      console.log(`[가사 추출] 성공: ${lyrics.length}자의 가사 추출됨`);
      return lyrics;
    } else {
      console.log('[가사 추출] 가사를 찾을 수 없음');
      return null;
    }
    
  } catch (error) {
    console.error('[가사 추출] 전체 프로세스 실패:', error);
    return null;
  } finally {
    // 3. 임시 파일 정리
    if (tempFilePath) {
      cleanupTempFile(tempFilePath);
    }
  }
}

/**
 * 여러 음악 파일에서 배치로 가사 추출
 */
export async function extractLyricsBatch(musicUrls: string[]): Promise<{ url: string; lyrics: string | null }[]> {
  console.log(`[가사 추출] 배치 작업 시작: ${musicUrls.length}개 파일`);
  
  const results: { url: string; lyrics: string | null }[] = [];
  
  for (const [index, url] of musicUrls.entries()) {
    console.log(`[가사 추출] 배치 진행 ${index + 1}/${musicUrls.length}: ${url}`);
    
    try {
      const lyrics = await extractLyricsFromMusic(url);
      results.push({ url, lyrics });
      
      // API 레이트 리미트 방지를 위한 대기
      if (index < musicUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
      }
      
    } catch (error) {
      console.error(`[가사 추출] 배치 오류 ${url}:`, error);
      results.push({ url, lyrics: null });
    }
  }
  
  console.log(`[가사 추출] 배치 완료: ${results.filter(r => r.lyrics).length}/${results.length}개 성공`);
  return results;
}

/**
 * 가사 품질 검증 및 후처리
 */
export function processExtractedLyrics(rawLyrics: string): string {
  if (!rawLyrics) return '';
  
  // 기본 정리
  let processed = rawLyrics
    .trim()
    .replace(/\s+/g, ' ') // 연속 공백 제거
    .replace(/\n\s*\n/g, '\n'); // 연속 줄바꿈 정리
  
  // 음악 기호나 반복 패턴 정리
  processed = processed
    .replace(/\b(라라라|나나나|후후후|아아아|음음음){2,}/gi, '$1') // 과도한 반복 제거
    .replace(/[♪♫♬♩♭♯]{2,}/g, '♪'); // 음악 기호 정리
  
  return processed;
}