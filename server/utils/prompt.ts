/**
 * 통일된 프롬프트 빌더 유틸리티
 * Gemini와 OpenAI 모든 모델에서 동일한 프롬프트 구조 사용
 * 모든 하드코딩 제거, 관리자 제어만 허용
 */

export interface PromptBuildOptions {
  template: string;           // 필수: 관리자 설정 기본 프롬프트 템플릿
  systemPrompt?: string;      // 선택: 관리자 설정 시스템 프롬프트 (고급설정)
  variables?: Record<string, string>; // 선택: 변수 치환용
}

/**
 * 통일된 최종 프롬프트 빌드
 * @param options 프롬프트 구성 옵션
 * @returns 최종 프롬프트 문자열
 * @throws Error 필수 템플릿이 없는 경우
 */
export function buildFinalPrompt(options: PromptBuildOptions): string {
  const { template, systemPrompt, variables } = options;
  
  // 1. 필수 검증: 템플릿이 반드시 있어야 함 (하드코딩 fallback 없음)
  if (!template || template.trim() === '') {
    throw new Error('Prompt template is required. Admin must configure template in concept settings.');
  }
  
  console.log('🔧 [프롬프트 빌더] 시작');
  console.log('📝 [프롬프트 빌더] 기본 템플릿:', template.substring(0, 100) + '...');
  
  // 2. 변수 치환 (기존 함수 활용)
  let finalPrompt = template;
  if (variables && Object.keys(variables).length > 0) {
    console.log('🔄 [프롬프트 빌더] 변수 치환 적용');
    finalPrompt = applyTemplateVariables(finalPrompt, variables);
  }
  
  // 3. 시스템 프롬프트 추가 (있는 경우만) - 타입 안전성 보장
  if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim() !== '') {
    console.log('➕ [프롬프트 빌더] 시스템 프롬프트 추가:', systemPrompt.substring(0, 50) + '...');
    finalPrompt += `\n\nAdditional instructions: ${systemPrompt}`;
  }
  
  // 4. 최종 정리
  finalPrompt = finalPrompt.trim();
  
  console.log('✅ [프롬프트 빌더] 완료 - 길이:', finalPrompt.length);
  console.log('🎯 [프롬프트 빌더] 최종 프롬프트 미리보기:', finalPrompt.substring(0, 150) + '...');
  
  return finalPrompt;
}

/**
 * 프롬프트 구성 유효성 검사
 * @param options 검사할 옵션
 * @returns 검증 결과
 */
export function validatePromptOptions(options: PromptBuildOptions): {
  isValid: boolean;
  error?: string;
} {
  if (!options.template || options.template.trim() === '') {
    return {
      isValid: false,
      error: 'Template is required - admin must configure concept template'
    };
  }
  
  return { isValid: true };
}

/**
 * 템플릿 문자열에서 변수를 치환하는 유틸리티 함수
 * 기존 {var} 형식과 새로운 {{var}} 형식을 모두 지원
 * 
 * @param template 치환할 템플릿 문자열
 * @param vars 치환할 변수들의 키-값 쌍
 * @returns 변수가 치환된 문자열
 */
export function applyTemplateVariables(
  template: string, 
  vars?: Record<string, string | number | boolean | null | undefined>
): string {
  if (!template || !vars) return template;
  
  let result = template;
  
  // 각 변수에 대해 치환 수행
  for (const [key, value] of Object.entries(vars)) {
    const stringValue = value == null ? '' : String(value);
    
    // 1. {{var}} 형식 치환 (새로운 형식 우선 처리)
    const doublePlaceholder = `{{${key}}}`;
    const escapedDoublePlaceholder = doublePlaceholder.replace(/[{}]/g, '\\$&');
    const beforeDouble = result;
    result = result.replace(new RegExp(escapedDoublePlaceholder, 'g'), stringValue);
    if (beforeDouble !== result) {
      console.log(`✅ [변수 치환] ${doublePlaceholder} → "${stringValue}"`);
    }
    
    // 2. {var} 형식 치환 (기존 호환성)
    const singlePlaceholder = `{${key}}`;
    const beforeSingle = result;
    result = result.replace(new RegExp(singlePlaceholder, 'g'), stringValue);
    if (beforeSingle !== result) {
      console.log(`✅ [변수 치환] ${singlePlaceholder} → "${stringValue}"`);
    }
  }
  
  return result;
}

/**
 * 다중 이미지/텍스트 매핑 정보
 * 초음파 앨범, 콜라주 등에서 이미지와 텍스트를 매핑하는 데 사용
 */
export interface ImageTextMapping {
  imageIndex: number;      // 1-based index (1, 2, 3...)
  imageUrl?: string;       // 이미지 URL (업로드된 이미지)
  text?: string;           // 이미지에 대응하는 텍스트
}

/**
 * 프롬프트 템플릿에서 [IMAGE_N], [TEXT_N] 플레이스홀더를 분석
 * 
 * @param template 분석할 프롬프트 템플릿
 * @returns 발견된 이미지/텍스트 플레이스홀더 정보
 * 
 * @example
 * // 템플릿: "1번 이미지: [IMAGE_1] - [TEXT_1], 2번 이미지: [IMAGE_2] - [TEXT_2]"
 * // 결과: { maxImageIndex: 2, maxTextIndex: 2, imagePlaceholders: ['[IMAGE_1]', '[IMAGE_2]'], textPlaceholders: ['[TEXT_1]', '[TEXT_2]'] }
 */
export function analyzeImageTextPlaceholders(template: string): {
  maxImageIndex: number;
  maxTextIndex: number;
  imagePlaceholders: string[];
  textPlaceholders: string[];
} {
  if (!template) {
    return { maxImageIndex: 0, maxTextIndex: 0, imagePlaceholders: [], textPlaceholders: [] };
  }

  const imagePattern = /\[IMAGE_(\d+)\]/g;
  const textPattern = /\[TEXT_(\d+)\]/g;
  
  const imagePlaceholders: string[] = [];
  const textPlaceholders: string[] = [];
  let maxImageIndex = 0;
  let maxTextIndex = 0;

  let match;
  
  while ((match = imagePattern.exec(template)) !== null) {
    imagePlaceholders.push(match[0]);
    const index = parseInt(match[1], 10);
    if (index > maxImageIndex) maxImageIndex = index;
  }

  while ((match = textPattern.exec(template)) !== null) {
    textPlaceholders.push(match[0]);
    const index = parseInt(match[1], 10);
    if (index > maxTextIndex) maxTextIndex = index;
  }

  console.log(`🔍 [플레이스홀더 분석] IMAGE: ${imagePlaceholders.length}개 (최대 ${maxImageIndex}), TEXT: ${textPlaceholders.length}개 (최대 ${maxTextIndex})`);

  return {
    maxImageIndex,
    maxTextIndex,
    imagePlaceholders: [...new Set(imagePlaceholders)],
    textPlaceholders: [...new Set(textPlaceholders)]
  };
}

/**
 * 다중 이미지/텍스트 플레이스홀더를 실제 값으로 치환
 * 
 * @param template 프롬프트 템플릿
 * @param mappings 이미지-텍스트 매핑 배열
 * @returns 치환된 프롬프트
 * 
 * @example
 * const template = "[IMAGE_1]에 표시할 텍스트: [TEXT_1], [IMAGE_2]: [TEXT_2]";
 * const mappings = [
 *   { imageIndex: 1, imageUrl: "url1", text: "첫번째 설명" },
 *   { imageIndex: 2, imageUrl: "url2", text: "두번째 설명" }
 * ];
 * // 결과: "[첨부된 이미지 1]에 표시할 텍스트: 첫번째 설명, [첨부된 이미지 2]: 두번째 설명"
 */
export function applyImageTextMappings(
  template: string,
  mappings: ImageTextMapping[]
): string {
  if (!template || !mappings || mappings.length === 0) {
    return template;
  }

  const isDev = process.env.NODE_ENV !== 'production';
  let result = template;

  for (const mapping of mappings) {
    const { imageIndex, imageUrl, text } = mapping;
    
    // [IMAGE_N] 치환 - 실제 이미지는 별도로 전송되므로 표시용 텍스트로 변환
    const imagePlaceholder = `[IMAGE_${imageIndex}]`;
    const imageReplacement = imageUrl 
      ? `[첨부된 이미지 ${imageIndex}]` 
      : `[이미지 ${imageIndex} 없음]`;
    
    if (result.includes(imagePlaceholder)) {
      result = result.replace(new RegExp(`\\[IMAGE_${imageIndex}\\]`, 'g'), imageReplacement);
      if (isDev) console.log(`✅ [다중 이미지 치환] ${imagePlaceholder} → "${imageReplacement}"`);
    }
    
    // [TEXT_N] 치환
    const textPlaceholder = `[TEXT_${imageIndex}]`;
    const textReplacement = text || '';
    
    if (result.includes(textPlaceholder)) {
      result = result.replace(new RegExp(`\\[TEXT_${imageIndex}\\]`, 'g'), textReplacement);
      if (isDev) console.log(`✅ [다중 텍스트 치환] ${textPlaceholder} → "${textReplacement}"`);
    }
  }

  // 매핑되지 않은 나머지 플레이스홀더 제거 (AI에 리터럴 토큰이 전달되지 않도록)
  const remainingImagePlaceholders = result.match(/\[IMAGE_\d+\]/g) || [];
  const remainingTextPlaceholders = result.match(/\[TEXT_\d+\]/g) || [];
  
  if (remainingImagePlaceholders.length > 0 || remainingTextPlaceholders.length > 0) {
    if (isDev) {
      console.log(`🧹 [플레이스홀더 정리] 미매핑 플레이스홀더 ${remainingImagePlaceholders.length + remainingTextPlaceholders.length}개 제거`);
    }
    // 남은 [IMAGE_N] 플레이스홀더 제거
    result = result.replace(/\[IMAGE_\d+\]/g, '');
    // 남은 [TEXT_N] 플레이스홀더 제거
    result = result.replace(/\[TEXT_\d+\]/g, '');
    // 연속된 공백 정리
    result = result.replace(/\s+/g, ' ').trim();
  }

  return result;
}

/**
 * 통합 프롬프트 빌더: 일반 변수 + 다중 이미지/텍스트 매핑 지원
 * 
 * @param options 프롬프트 빌드 옵션
 * @param imageMappings 다중 이미지/텍스트 매핑 (선택)
 * @returns 최종 프롬프트
 */
export function buildPromptWithImageMappings(
  options: PromptBuildOptions,
  imageMappings?: ImageTextMapping[]
): string {
  const { template, systemPrompt, variables } = options;
  
  if (!template || template.trim() === '') {
    throw new Error('Prompt template is required. Admin must configure template in concept settings.');
  }

  console.log('🔧 [통합 프롬프트 빌더] 시작');
  
  let finalPrompt = template;

  // 1. 다중 이미지/텍스트 매핑 치환 (우선 처리)
  if (imageMappings && imageMappings.length > 0) {
    console.log(`🖼️ [통합 프롬프트 빌더] 다중 이미지/텍스트 매핑: ${imageMappings.length}개`);
    finalPrompt = applyImageTextMappings(finalPrompt, imageMappings);
  }

  // 2. 일반 변수 치환
  if (variables && Object.keys(variables).length > 0) {
    console.log('🔄 [통합 프롬프트 빌더] 일반 변수 치환 적용');
    finalPrompt = applyTemplateVariables(finalPrompt, variables);
  }

  // 3. 시스템 프롬프트 추가
  if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim() !== '') {
    finalPrompt += `\n\nAdditional instructions: ${systemPrompt}`;
  }

  finalPrompt = finalPrompt.trim();
  
  console.log('✅ [통합 프롬프트 빌더] 완료 - 길이:', finalPrompt.length);
  
  return finalPrompt;
}