/**
 * [DEPRECATED] 가사 생성 서비스 - TopMediai 통합으로 완전 비활성화
 * 이 파일은 TopMediai API 통합으로 더 이상 사용되지 않습니다.
 */

export interface LyricsGenerationRequest {
  prompt: string;
  style?: string;
  mood?: string;
  language?: string;
  theme?: string;
}

export interface LyricsGenerationResult {
  lyrics: string;
  musicPrompt: string;
  theme: string;
  style: string;
}

/**
 * [DEPRECATED] GPT 가사 생성 - TopMediai로 대체됨
 */
export async function generateLyrics(
  babyName: string, 
  style: string = '자장가',
  additionalPrompt?: string
): Promise<LyricsGenerationResult> {
  throw new Error('GPT 가사 생성은 TopMediai 통합으로 비활성화되었습니다.');
}

/**
 * [DEPRECATED] Gemini 가사 생성 - TopMediai로 대체됨
 */
export async function generateLyricsGemini(request: LyricsGenerationRequest): Promise<string> {
  throw new Error('Gemini 가사 생성은 TopMediai 통합으로 비활성화되었습니다.');
}