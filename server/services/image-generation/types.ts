import type { Concept } from "@shared/schema";
import type { ImageGenerationSettings, ImageModelKey } from "@shared/model-capabilities";

export interface ImageGenerationAdapterInput {
  modelKey: ImageModelKey;
  prompt: string;
  imageBuffer?: Buffer | null;
  imageBuffers?: Buffer[];
  systemPrompt?: string;
  variables?: Record<string, string>;
  aspectRatio?: string;
  settings?: ImageGenerationSettings;
  isTextOnly?: boolean;
  generationType?: "image_upload" | "text_only";
}

export interface ImageGenerationServiceInput {
  modelKey: string;
  prompt: string;
  concept?: Concept | null;
  imageBuffer?: Buffer | null;
  imageBuffers?: Buffer[];
  systemPrompt?: string;
  variables?: Record<string, string>;
  aspectRatio?: string;
  isTextOnly?: boolean;
  generationType?: "image_upload" | "text_only";
}

export interface ImageGenerationResult {
  imageUrl: string;
  provider: string;
  apiModel: string;
  elapsedMs: number;
}
