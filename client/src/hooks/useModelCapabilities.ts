import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Concept } from "@shared/schema";

/**
 * AI 모델별 지원하는 aspect ratio 정보를 나타내는 타입
 */
export interface ModelCapabilities {
  [model: string]: string[];
}

/**
 * AI 모델별 지원 가능한 aspect ratio 정보를 가져오는 훅
 * 
 * @returns React Query 결과 객체
 * @example
 * const { data: capabilities, isLoading, error } = useModelCapabilities();
 * // capabilities: { "openai": ["1:1", "2:3", "3:2"], "gemini": ["1:1", "9:16", "16:9"] }
 */
export function useModelCapabilities() {
  return useQuery<ModelCapabilities>({
    queryKey: ['/api/model-capabilities'],
    queryFn: async ({ queryKey }) => {
      const response = await getQueryFn()({ queryKey }) as ModelCapabilities | null;
      
      // 기본값을 반환하여 null을 방지
      const fallbackCapabilities: ModelCapabilities = {
        openai: ["1:1", "4:3", "3:4", "16:9", "9:16"],
        gemini: ["1:1", "4:3", "3:4", "16:9", "9:16"],
        gemini_3: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]
      };
      
      // API 응답에서 gemini_3가 없으면 fallback 추가
      if (response && !response.gemini_3) {
        response.gemini_3 = fallbackCapabilities.gemini_3;
      }
      
      return response || fallbackCapabilities;
    },
    staleTime: 1000 * 60 * 60, // 1시간 - 모델 capabilities는 자주 변경되지 않음
    gcTime: 1000 * 60 * 60 * 24, // 24시간 캐시 유지
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * 주어진 모델과 컨셉에 대해 유효한 aspect ratio 목록을 반환하는 헬퍼 함수
 * 
 * 우선순위:
 * 1. concept.availableAspectRatios[model] - 컨셉별 설정 우선
 * 2. capabilities[model] - 모델 기본값 사용
 * 3. [] - graceful fallback (빈 배열 반환)
 * 
 * @param model AI 모델명 (예: "openai", "gemini")
 * @param concept 컨셉 객체 (null/undefined 허용)
 * @param capabilities 모델 capabilities 객체 (null/undefined 허용)
 * @returns 유효한 aspect ratio 문자열 배열
 * 
 * @example
 * const effectiveRatios = getEffectiveAspectRatios("openai", concept, capabilities);
 * // concept에 설정이 있으면 그것을 사용, 없으면 capabilities 기본값 사용
 */
export function getEffectiveAspectRatios(
  model: string,
  concept: Concept | null | undefined,
  capabilities: ModelCapabilities | null | undefined
): string[] {
  // 입력 파라미터 검증
  if (!model || typeof model !== 'string') {
    console.warn('[getEffectiveAspectRatios] Invalid model parameter:', model);
    return [];
  }

  // 1. 컨셉별 설정 확인 (최우선)
  if (concept?.availableAspectRatios && typeof concept.availableAspectRatios === 'object') {
    const aspectRatios = concept.availableAspectRatios as Record<string, unknown>;
    const conceptRatios = aspectRatios[model];
    if (Array.isArray(conceptRatios) && conceptRatios.length > 0) {
      // 배열 내 모든 항목이 문자열인지 검증
      const validRatios = conceptRatios.filter(ratio => 
        typeof ratio === 'string' && ratio.trim().length > 0
      ) as string[];
      if (validRatios.length > 0) {
        return validRatios;
      }
    }
  }

  // 2. 모델 기본값 확인 (fallback)
  if (capabilities && typeof capabilities === 'object') {
    const defaultRatios = capabilities[model];
    if (Array.isArray(defaultRatios) && defaultRatios.length > 0) {
      // 배열 내 모든 항목이 문자열인지 검증
      const validRatios = defaultRatios.filter(ratio => 
        typeof ratio === 'string' && ratio.trim().length > 0
      );
      if (validRatios.length > 0) {
        return validRatios;
      }
    }
  }

  // 3. 최종 fallback - 빈 배열 (graceful degradation)
  console.warn(`[getEffectiveAspectRatios] No aspect ratios found for model "${model}"`);
  return [];
}

/**
 * 모델별 기본 aspect ratio 옵션을 UI 형태로 반환하는 헬퍼 함수
 * 
 * @param model AI 모델명
 * @param capabilities 모델 capabilities 객체
 * @returns UI에서 사용할 수 있는 {value, label} 형태의 배열
 * 
 * @example
 * const options = getAspectRatioOptions("openai", capabilities);
 * // [{ value: "1:1", label: "1:1 (정사각형)" }, { value: "2:3", label: "2:3 (세로형)" }]
 */
export function getAspectRatioOptions(
  model: string,
  capabilities: ModelCapabilities | null | undefined
): { value: string; label: string }[] {
  const ratios = getEffectiveAspectRatios(model, null, capabilities);
  
  return ratios.map(ratio => ({
    value: ratio,
    label: getAspectRatioLabel(ratio)
  }));
}

/**
 * Aspect ratio 값에 대한 사용자 친화적인 라벨을 반환하는 헬퍼 함수
 * 
 * @param ratio aspect ratio 문자열 (예: "1:1", "16:9")
 * @returns 사용자 친화적인 라벨
 */
function getAspectRatioLabel(ratio: string): string {
  const labels: Record<string, string> = {
    "1:1": "1:1 (정사각형)",
    "2:3": "2:3 (세로형)",
    "3:2": "3:2 (가로형)",
    "9:16": "9:16 (세로형)",
    "16:9": "16:9 (가로형)",
    "4:3": "4:3 (가로형)",
    "3:4": "3:4 (세로형)",
    "4:5": "4:5 (세로형)",
    "5:4": "5:4 (가로형)",
    "21:9": "21:9 (울트라와이드)"
  };

  return labels[ratio] || `${ratio} (비율)`;
}