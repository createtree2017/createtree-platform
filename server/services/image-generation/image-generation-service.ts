import {
  createGenerationSettingsFromLegacy,
  getImageModelCapability,
  normalizeImageModelValue,
} from "@shared/model-capabilities";
import { generateWithGemini } from "./gemini-adapter";
import { generateWithOpenAI } from "./openai-adapter";
import type { ImageGenerationResult, ImageGenerationServiceInput } from "./types";

export async function generateImageWithConfiguredModel(
  input: ImageGenerationServiceInput
): Promise<ImageGenerationResult> {
  const startedAt = Date.now();
  const modelKey = normalizeImageModelValue(input.modelKey);
  if (!modelKey) {
    throw new Error(`Unsupported image model: ${input.modelKey}`);
  }

  const capability = getImageModelCapability(modelKey);
  if (!capability) {
    throw new Error(`Missing image model capability: ${modelKey}`);
  }

  const concept = input.concept as any;
  const generationSettings = createGenerationSettingsFromLegacy({
    models: [modelKey],
    aspectRatios: concept?.availableAspectRatios,
    gemini3AspectRatio: concept?.gemini3AspectRatio,
    gemini3ImageSize: concept?.gemini3ImageSize,
    existingSettings: concept?.generationSettings,
  });
  const settings = generationSettings[modelKey];
  const hasReferenceImage = !!input.imageBuffer || !!(input.imageBuffers && input.imageBuffers.length > 0);

  if (input.generationType === "image_upload" && !hasReferenceImage) {
    throw new Error("Image upload generation requires at least one reference image.");
  }

  console.log("[Image Generation Service] resolved settings", {
    modelKey,
    provider: capability.provider,
    requestedAspectRatio: input.aspectRatio,
    generationType: input.generationType,
    referenceImageCount: input.imageBuffers?.length || (input.imageBuffer ? 1 : 0),
    settings,
  });

  const adapterInput = {
    modelKey,
    prompt: input.prompt,
    imageBuffer: input.imageBuffer,
    imageBuffers: input.imageBuffers,
    systemPrompt: input.systemPrompt,
    variables: input.variables,
    aspectRatio: undefined,
    settings,
    isTextOnly: input.isTextOnly,
    generationType: input.generationType,
  };

  const result = capability.provider === "openai"
    ? await generateWithOpenAI(adapterInput)
    : await generateWithGemini(adapterInput);

  console.log("[Image Generation Service] completed", {
    modelKey,
    provider: result.provider,
    apiModel: result.apiModel,
    adapterElapsedMs: result.elapsedMs,
    totalElapsedMs: Date.now() - startedAt,
  });

  return result;
}
