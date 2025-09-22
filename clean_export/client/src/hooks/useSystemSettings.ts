import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { AiModel, AI_MODELS } from "@shared/schema";

/**
 * 클라이언트에서 사용하는 시스템 설정 타입
 */
export interface SystemSettingsPublic {
  supportedAiModels: AiModel[];
  clientDefaultModel: AiModel;
  defaultAiModel: AiModel;
}

/**
 * API 응답 타입 (서버에서 반환하는 전체 구조)
 */
interface SystemSettingsApiResponse {
  success: boolean;
  settings: SystemSettingsPublic;
}

/**
 * 시스템 설정을 조회하는 Hook
 * 
 * @returns React Query 결과 객체
 * @example
 * const { data: settings, isLoading, error } = useSystemSettings();
 * // settings: { supportedAiModels: ["openai", "gemini"], clientDefaultModel: "openai", defaultAiModel: "openai" }
 */
export function useSystemSettings() {
  return useQuery<SystemSettingsPublic>({
    queryKey: ['/api/system-settings'],
    queryFn: async ({ queryKey }) => {
      const response = await getQueryFn()({ queryKey }) as SystemSettingsApiResponse | null;
      
      // 기본값을 반환하여 null을 방지
      const fallbackSettings: SystemSettingsPublic = {
        supportedAiModels: [AI_MODELS.OPENAI, AI_MODELS.GEMINI],
        clientDefaultModel: AI_MODELS.OPENAI,
        defaultAiModel: AI_MODELS.OPENAI
      };
      
      return response?.settings || fallbackSettings;
    },
    staleTime: 1000 * 60 * 10, // 10분 - 시스템 설정은 자주 변경되지 않음
    gcTime: 1000 * 60 * 60, // 1시간 캐시 유지
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // 에러 시 기본값 반환
    placeholderData: {
      supportedAiModels: [AI_MODELS.OPENAI, AI_MODELS.GEMINI],
      clientDefaultModel: AI_MODELS.OPENAI,
      defaultAiModel: AI_MODELS.OPENAI
    }
  });
}

/**
 * 시스템에서 지원하는 AI 모델과 컨셉에서 허용하는 모델의 교집합을 반환하는 헬퍼 함수
 * 
 * @param systemSettings 시스템 설정 객체
 * @param conceptAvailableModels 컨셉에서 허용하는 모델 목록
 * @returns 실제 사용 가능한 모델 목록
 * 
 * @example
 * const availableModels = getAvailableModelsForConcept(settings, concept?.availableModels);
 * // 시스템에서 지원하고 컨셉에서도 허용하는 모델만 반환
 */
export function getAvailableModelsForConcept(
  systemSettings: SystemSettingsPublic | null | undefined,
  conceptAvailableModels?: string[] | null
): AiModel[] {
  // 시스템 설정이 없으면 기본값 사용
  if (!systemSettings) {
    const fallbackModels = [AI_MODELS.OPENAI, AI_MODELS.GEMINI];
    if (!conceptAvailableModels || conceptAvailableModels.length === 0) {
      return fallbackModels;
    }
    return conceptAvailableModels.filter((model): model is AiModel => 
      fallbackModels.includes(model as AiModel)
    );
  }

  const supportedModels = systemSettings.supportedAiModels;

  // 컨셉에 제한이 없으면 시스템에서 지원하는 모든 모델 사용
  if (!conceptAvailableModels || conceptAvailableModels.length === 0) {
    return supportedModels;
  }

  // 시스템 지원 모델과 컨셉 허용 모델의 교집합 반환
  return conceptAvailableModels.filter((model): model is AiModel => 
    supportedModels.includes(model as AiModel)
  );
}

/**
 * 기본 AI 모델을 반환하는 헬퍼 함수
 * 
 * @param systemSettings 시스템 설정 객체
 * @param availableModels 사용 가능한 모델 목록
 * @returns 기본으로 선택될 AI 모델
 * 
 * @example
 * const defaultModel = getDefaultModel(settings, availableModels);
 * // clientDefaultModel이 availableModels에 포함되면 그것을 사용, 아니면 첫 번째 모델
 */
export function getDefaultModel(
  systemSettings: SystemSettingsPublic | null | undefined,
  availableModels: AiModel[]
): AiModel {
  // 사용 가능한 모델이 없으면 OpenAI 기본값
  if (!availableModels || availableModels.length === 0) {
    return AI_MODELS.OPENAI;
  }

  // 시스템 설정이 없으면 첫 번째 사용 가능한 모델
  if (!systemSettings) {
    return availableModels[0];
  }

  // clientDefaultModel이 사용 가능한 모델 중에 있으면 사용
  if (availableModels.includes(systemSettings.clientDefaultModel)) {
    return systemSettings.clientDefaultModel;
  }

  // 없으면 첫 번째 사용 가능한 모델
  return availableModels[0];
}