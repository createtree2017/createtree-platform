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