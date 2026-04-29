import type { Concept } from "@shared/schema";
import { getImageModelCapability, normalizeImageModelValue } from "@shared/model-capabilities";

export type ConceptGenerationType = "image_upload" | "text_only";

export interface GenerationModeDecision {
  generationType: ConceptGenerationType;
  requiresImageUpload: boolean;
  isTextOnly: boolean;
  error?: string;
}

export function getConceptGenerationType(concept?: Concept | null): ConceptGenerationType {
  return (concept as any)?.generationType === "text_only" ? "text_only" : "image_upload";
}

export function decideGenerationMode(input: {
  concept?: Concept | null;
  modelKey: string;
  referenceImageCount: number;
}): GenerationModeDecision {
  const generationType = getConceptGenerationType(input.concept);
  const requiresImageUpload = generationType === "image_upload";
  const hasReferenceImages = input.referenceImageCount > 0;
  const isTextOnly = !hasReferenceImages;

  if (requiresImageUpload && !hasReferenceImages) {
    return {
      generationType,
      requiresImageUpload,
      isTextOnly,
      error: "이미지 업로드가 필요한 컨셉입니다. 이미지를 업로드해주세요.",
    };
  }

  const normalizedModel = normalizeImageModelValue(input.modelKey);
  const capability = getImageModelCapability(normalizedModel);
  if (requiresImageUpload && capability && !capability.supportsImageUpload) {
    return {
      generationType,
      requiresImageUpload,
      isTextOnly,
      error: `${capability.label} 모델은 이미지 첨부 생성을 지원하지 않습니다.`,
    };
  }

  if (!requiresImageUpload && isTextOnly && capability && !capability.supportsTextOnly) {
    return {
      generationType,
      requiresImageUpload,
      isTextOnly,
      error: `${capability.label} 모델은 텍스트 전용 이미지 생성을 지원하지 않습니다.`,
    };
  }

  return {
    generationType,
    requiresImageUpload,
    isTextOnly,
  };
}
