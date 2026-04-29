import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Concept } from "@shared/schema";
import {
  getAllImageModelCapabilities,
  getImageModelCapability,
  getPrimaryAspectRatio,
  normalizeConceptGenerationSettings,
  type ConceptGenerationSettings,
  type ImageGenerationSettings,
  type ImageModelCapability,
  type ImageModelKey,
} from "@shared/model-capabilities";

export type ModelCapabilities = Record<string, ImageModelCapability>;

export interface AspectRatioOption {
  value: string;
  label: string;
}

export function useModelCapabilities() {
  return useQuery<ModelCapabilities>({
    queryKey: ["/api/model-capabilities"],
    queryFn: async ({ queryKey }) => {
      const response = await getQueryFn()({ queryKey }) as ModelCapabilities | null;
      return response || getAllImageModelCapabilities();
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

function getConceptGenerationSettings(concept: Concept | null | undefined): ConceptGenerationSettings {
  const generationSettings = (concept as any)?.generationSettings as Record<string, unknown> | null | undefined;
  const availableModels = concept?.availableModels as string[] | null | undefined;

  if (generationSettings && typeof generationSettings === "object") {
    return normalizeConceptGenerationSettings(generationSettings, availableModels);
  }

  return normalizeConceptGenerationSettings(undefined, availableModels);
}

export function getEffectiveGenerationSettings(
  model: string,
  concept: Concept | null | undefined,
  capabilities: ModelCapabilities | null | undefined
): ImageGenerationSettings {
  const capability = capabilities?.[model] || getImageModelCapability(model);
  if (!capability) return {};

  const conceptSettings = getConceptGenerationSettings(concept);
  const settings = conceptSettings[model as ImageModelKey] || capability.defaults;
  return {
    ...capability.defaults,
    ...settings,
  };
}

export function getEffectiveAspectRatios(
  model: string,
  concept: Concept | null | undefined,
  capabilities: ModelCapabilities | null | undefined
): string[] {
  const capability = capabilities?.[model] || getImageModelCapability(model);
  if (!capability) return [];

  if (concept?.availableAspectRatios && typeof concept.availableAspectRatios === "object") {
    const legacyRatios = (concept.availableAspectRatios as Record<string, unknown>)[model];
    if (Array.isArray(legacyRatios) && legacyRatios.length > 0) {
      const validLegacyRatios = legacyRatios.filter((ratio): ratio is string =>
        typeof ratio === "string" && capability.aspectRatios.includes(ratio)
      );
      if (validLegacyRatios.length > 0 && !(concept as any).generationSettings) {
        return validLegacyRatios;
      }
    }
  }

  const settings = getEffectiveGenerationSettings(model, concept, capabilities);
  const ratios = settings.aspectRatios?.filter((ratio) => capability.aspectRatios.includes(ratio)) || [];
  return ratios.length > 0 ? ratios : [getPrimaryAspectRatio(settings, capability)];
}

export function getAspectRatioOptions(
  model: string,
  capabilities: ModelCapabilities | null | undefined
): AspectRatioOption[] {
  const capability = capabilities?.[model] || getImageModelCapability(model);
  if (!capability) return [];

  return capability.aspectRatios.map((ratio) => ({
    value: ratio,
    label: getAspectRatioLabel(ratio),
  }));
}

export function getModelCapability(
  model: string,
  capabilities: ModelCapabilities | null | undefined
): ImageModelCapability | undefined {
  return capabilities?.[model] || getImageModelCapability(model);
}

function getAspectRatioLabel(ratio: string): string {
  const labels: Record<string, string> = {
    auto: "자동 (모델 선택)",
    "1:1": "1:1 (정사각형)",
    "1:4": "1:4 (초세로형)",
    "1:8": "1:8 (초세로형)",
    "2:3": "2:3 (세로형)",
    "3:2": "3:2 (가로형)",
    "9:16": "9:16 (세로형)",
    "16:9": "16:9 (가로형)",
    "4:3": "4:3 (가로형)",
    "3:4": "3:4 (세로형)",
    "4:5": "4:5 (세로형)",
    "5:4": "5:4 (가로형)",
    "4:1": "4:1 (초가로형)",
    "8:1": "8:1 (초가로형)",
    "21:9": "21:9 (울트라와이드)",
  };

  return labels[ratio] || `${ratio} (비율)`;
}
