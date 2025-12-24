import { db } from "@db";
import { 
  systemSettings, 
  type SystemSettings,
  type SystemSettingsUpdate,
  systemSettingsInsertSchema,
  systemSettingsUpdateSchema,
  AI_MODELS,
  type AiModel 
} from "@shared/schema.ts";
import { eq, sql } from "drizzle-orm";

// 설정 캐시 (메모리 캐싱)
let cachedSettings: SystemSettings | null = null;
let lastRefreshTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5분 캐시

// 동시성 문제 해결을 위한 초기화 상태 추적
let isInitializing = false;
let initializationPromise: Promise<SystemSettings> | null = null;

/**
 * Singleton 설정 초기화 (동시성 안전)
 * 여러 요청이 동시에 들어와도 하나의 초기화만 실행
 */
async function initializeSystemSettings(): Promise<SystemSettings> {
  // 이미 초기화 중인 경우 해당 Promise 반환
  if (isInitializing && initializationPromise) {
    return initializationPromise;
  }

  isInitializing = true;
  
  initializationPromise = (async () => {
    try {
      // 트랜잭션으로 Singleton 초기화 보장
      const result = await db.transaction(async (tx) => {
        // 기존 설정 확인
        const existing = await tx.query.systemSettings.findFirst();
        
        if (existing) {
          return existing;
        }

        // 설정이 없으면 기본값으로 생성 (ID=1 고정)
        const defaultSettings = {
          id: 1 as const,
          defaultAiModel: AI_MODELS.OPENAI,
          supportedAiModels: [AI_MODELS.OPENAI, AI_MODELS.GEMINI] as AiModel[],
          clientDefaultModel: AI_MODELS.OPENAI,
        };

        // Zod 검증
        const validatedData = systemSettingsInsertSchema.parse(defaultSettings);
        
        // UPSERT로 안전하게 생성 (Singleton 보장)
        const [newSettings] = await tx
          .insert(systemSettings)
          .values(validatedData)
          .onConflictDoUpdate({
            target: systemSettings.id,
            set: {
              updatedAt: sql`CURRENT_TIMESTAMP`
            }
          })
          .returning();

        return newSettings as SystemSettings;
      });

      return result;
    } catch (error) {
      console.error('시스템 설정 초기화 오류:', error);
      throw error;
    } finally {
      isInitializing = false;
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

/**
 * 시스템 설정 조회 (캐시된)
 * Singleton 패턴으로 단일 설정 행만 사용
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  const now = Date.now();
  
  // 캐시가 유효한 경우 반환
  if (cachedSettings && (now - lastRefreshTime) < CACHE_TTL) {
    return cachedSettings;
  }
  
  try {
    // DB에서 Singleton 설정 조회 (ID=1)
    let settings = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.id, 1)
    });
    
    // 설정이 없으면 초기화
    if (!settings) {
      settings = await initializeSystemSettings();
    }
    
    // 캐시 업데이트  
    cachedSettings = settings as SystemSettings;
    lastRefreshTime = now;
    
    return settings as SystemSettings;
    
  } catch (error) {
    console.error('시스템 설정 조회 오류:', error);
    
    // 오류 시 기본값 반환
    const fallbackSettings: SystemSettings = {
      id: 1,
      defaultAiModel: AI_MODELS.OPENAI,
      supportedAiModels: [AI_MODELS.OPENAI, AI_MODELS.GEMINI],
      clientDefaultModel: AI_MODELS.OPENAI,
      milestoneEnabled: true,
      bgRemovalQuality: "1.0",
      bgRemovalModel: "medium",
      updatedAt: new Date(),
    };
    
    return fallbackSettings;
  }
}

/**
 * 시스템 설정 업데이트 (관리자 전용)
 * Singleton이므로 항상 ID=1 업데이트
 */
export async function updateSystemSettings(
  updates: SystemSettingsUpdate
): Promise<SystemSettings> {
  try {
    // Zod 검증
    const validatedUpdates = systemSettingsUpdateSchema.parse(updates);
    
    // 트랜잭션으로 업데이트
    const result = await db.transaction(async (tx) => {
      // 현재 설정 존재 확인
      const currentSettings = await tx.query.systemSettings.findFirst({
        where: eq(systemSettings.id, 1)
      });
      
      if (!currentSettings) {
        // 설정이 없으면 초기화 후 업데이트
        await initializeSystemSettings();
      }
      
      // Singleton 업데이트 (ID=1 고정)
      const [updatedSettings] = await tx
        .update(systemSettings)
        .set({
          ...validatedUpdates,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.id, 1))
        .returning();
      
      return updatedSettings;
    });
    
    // 캐시 무효화
    refreshSettingsCache();
    
    // 캐시 업데이트를 위해 다시 조회
    return await getSystemSettings();
    
  } catch (error) {
    console.error('시스템 설정 업데이트 오류:', error);
    
    if (error instanceof Error) {
      throw new Error(`시스템 설정 업데이트 실패: ${error.message}`);
    }
    
    throw new Error('시스템 설정 업데이트에 실패했습니다');
  }
}

/**
 * 설정 캐시 강제 새로고침
 */
export function refreshSettingsCache(): void {
  cachedSettings = null;
  lastRefreshTime = 0;
}

/**
 * AI 모델이 시스템에서 지원되는지 확인
 */
export async function isModelSupported(model: string): Promise<boolean> {
  try {
    const settings = await getSystemSettings();
    return settings.supportedAiModels.includes(model as AiModel);
  } catch {
    // 오류 시 기본 지원 모델만 허용
    return Object.values(AI_MODELS).includes(model as AiModel);
  }
}

/**
 * 컨셉의 사용 가능한 모델과 시스템 지원 모델의 교집합 반환
 */
export async function getValidModelsForConcept(
  conceptAvailableModels?: string[] | null
): Promise<AiModel[]> {
  try {
    const settings = await getSystemSettings();
    const supportedModels = settings.supportedAiModels as AiModel[];
    
    // 컨셉에 사용가능 모델이 설정되지 않은 경우 시스템 지원 모델 모두 사용
    if (!conceptAvailableModels || conceptAvailableModels.length === 0) {
      return supportedModels;
    }
    
    // 교집합 반환 (타입 안전성 보장)
    return conceptAvailableModels.filter((model): model is AiModel => 
      supportedModels.includes(model as AiModel)
    ) as AiModel[];
    
  } catch {
    // 오류 시 기본값
    return [AI_MODELS.OPENAI, AI_MODELS.GEMINI];
  }
}

/**
 * 요청에서 유효한 AI 모델 결정
 * 우선순위: 요청 모델 > 컨셉 제한 > 시스템 기본값
 */
export async function resolveAiModel(
  requestedModel?: string,
  conceptAvailableModels?: string[] | null
): Promise<AiModel> {
  try {
    const settings = await getSystemSettings();
    const validModels = await getValidModelsForConcept(conceptAvailableModels);
    
    // 1. 요청된 모델이 유효한 경우 사용
    if (requestedModel && validModels.includes(requestedModel as AiModel)) {
      return requestedModel as AiModel;
    }
    
    // 2. 유효한 모델 중 첫 번째 사용
    if (validModels.length > 0) {
      return validModels[0];
    }
    
    // 3. 시스템 기본값 사용 (최후 수단)
    return settings.defaultAiModel as AiModel;
    
  } catch (error) {
    console.error('AI 모델 결정 오류:', error);
    return AI_MODELS.OPENAI; // 타입 안전한 최후 수단
  }
}

/**
 * 요청된 모델이 유효한지 검증
 * 유효하지 않으면 에러 정보를 반환
 */
export async function validateRequestedModel(
  requestedModel?: string,
  conceptAvailableModels?: string[] | null
): Promise<{
  isValid: boolean;
  error?: {
    message: string;
    requestedModel: string;
    allowedModels: AiModel[];
  };
}> {
  try {
    // 모델이 요청되지 않은 경우는 유효함 (기본값 사용)
    if (!requestedModel) {
      return { isValid: true };
    }

    // 시스템 지원 모델과 컨셉 허용 모델의 교집합 구하기
    const validModels = await getValidModelsForConcept(conceptAvailableModels);
    
    // 요청된 모델이 유효한 모델 목록에 있는지 확인
    if (validModels.includes(requestedModel as AiModel)) {
      return { isValid: true };
    }

    // 유효하지 않은 경우 에러 정보 반환
    return {
      isValid: false,
      error: {
        message: "지원되지 않는 AI 모델입니다",
        requestedModel,
        allowedModels: validModels
      }
    };

  } catch (error) {
    console.error('모델 검증 오류:', error);
    
    // 오류 시 기본값으로 처리
    const fallbackModels = [AI_MODELS.OPENAI, AI_MODELS.GEMINI];
    
    if (!requestedModel) {
      return { isValid: true };
    }

    if (fallbackModels.includes(requestedModel as AiModel)) {
      return { isValid: true };
    }

    return {
      isValid: false,
      error: {
        message: "지원되지 않는 AI 모델입니다",
        requestedModel,
        allowedModels: fallbackModels
      }
    };
  }
}

/**
 * 시스템 설정 상태 확인 (헬스체크용)
 */
export async function checkSystemSettingsHealth(): Promise<{
  isInitialized: boolean;
  cacheStatus: 'hit' | 'miss' | 'expired';
  settings?: SystemSettings;
}> {
  try {
    const now = Date.now();
    const cacheStatus = cachedSettings 
      ? (now - lastRefreshTime) < CACHE_TTL 
        ? 'hit' 
        : 'expired'
      : 'miss';
    
    const settings = await getSystemSettings();
    
    return {
      isInitialized: Boolean(settings),
      cacheStatus,
      settings
    };
  } catch (error) {
    console.error('시스템 설정 상태 확인 오류:', error);
    return {
      isInitialized: false,
      cacheStatus: 'miss'
    };
  }
}