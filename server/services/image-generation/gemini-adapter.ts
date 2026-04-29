import {
  getImageModelCapability,
  getPrimaryAspectRatio,
  normalizeGenerationSettingsForModel,
} from "@shared/model-capabilities";
import type { ImageGenerationAdapterInput, ImageGenerationResult } from "./types";

export async function generateWithGemini(input: ImageGenerationAdapterInput): Promise<ImageGenerationResult> {
  const startedAt = Date.now();
  const capability = getImageModelCapability(input.modelKey);
  if (!capability || capability.provider !== "gemini") {
    throw new Error(`Gemini adapter received unsupported model: ${input.modelKey}`);
  }

  const settings = normalizeGenerationSettingsForModel(input.modelKey, input.settings);
  const selectedAspectRatio = input.aspectRatio && capability.aspectRatios.includes(input.aspectRatio)
    ? input.aspectRatio
    : getPrimaryAspectRatio(settings, capability);
  const aspectRatio = selectedAspectRatio === "auto" ? undefined : selectedAspectRatio;
  const imageSize = settings.imageSize || capability.defaults.imageSize || "1K";
  const imageBuffers = input.imageBuffers || (input.imageBuffer ? [input.imageBuffer] : []);

  console.log("[Gemini Adapter] request prepared", {
    model: capability.apiModel,
    aspectRatio,
    imageSize,
    imageCount: imageBuffers.length,
  });

  const geminiService = await import("../gemini");
  let imageUrl: string;

  if (input.modelKey === "gemini_3") {
    if (imageBuffers.length > 1) {
      imageUrl = await geminiService.transformWithGemini3Multi(
        input.prompt,
        input.systemPrompt,
        imageBuffers,
        input.variables,
        aspectRatio,
        imageSize
      );
    } else {
      imageUrl = await geminiService.transformWithGemini3(
        input.prompt,
        input.systemPrompt,
        imageBuffers[0] || null,
        input.variables,
        aspectRatio,
        imageSize
      );
    }
  } else {
    if (imageBuffers.length > 1) {
      imageUrl = await geminiService.transformWithGeminiMulti(
        input.prompt,
        input.systemPrompt,
        imageBuffers,
        input.variables,
        aspectRatio,
        imageSize
      );
    } else {
      imageUrl = await geminiService.transformWithGemini(
        input.prompt,
        input.systemPrompt,
        imageBuffers[0] || null,
        input.variables,
        aspectRatio,
        imageSize
      );
    }
  }

  return {
    imageUrl,
    provider: "gemini",
    apiModel: capability.apiModel,
    elapsedMs: Date.now() - startedAt,
  };
}
