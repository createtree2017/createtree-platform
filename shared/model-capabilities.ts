export const IMAGE_MODEL_KEYS = [
  "openai_gpt2",
  "openai_gpt1_5",
  "gemini_3_1",
  "gemini_3",
] as const;

export type ImageModelKey = typeof IMAGE_MODEL_KEYS[number];
export type ImageProvider = "openai" | "gemini";
export type OpenAIImageQuality = "low" | "medium" | "high" | "auto";
export type OpenAIOutputFormat = "webp" | "jpeg" | "png";
export type ResolutionPreset = "fast" | "standard" | "high";
export type GeminiImageSize = "512" | "1K" | "2K" | "4K";

export interface ImageGenerationSettings {
  aspectRatios?: string[];
  resolutionPreset?: ResolutionPreset;
  quality?: OpenAIImageQuality;
  outputFormat?: OpenAIOutputFormat;
  inputMaxEdge?: number;
  imageSize?: GeminiImageSize;
}

export type ConceptGenerationSettings = Partial<Record<ImageModelKey, ImageGenerationSettings>>;

export interface ImageModelCapability {
  modelKey: ImageModelKey;
  label: string;
  provider: ImageProvider;
  apiModel: string;
  supportsTextOnly: boolean;
  supportsImageUpload: boolean;
  aspectRatios: string[];
  resolutionPresets?: ResolutionPreset[];
  sizeByPreset?: Partial<Record<ResolutionPreset, Record<string, string>>>;
  qualityOptions?: OpenAIImageQuality[];
  outputFormats?: OpenAIOutputFormat[];
  inputMaxEdgeOptions?: number[];
  imageSizeOptions?: GeminiImageSize[];
  defaults: ImageGenerationSettings;
  estimatedDurationLabel: string;
}

export const GEMINI_3_PRO_ASPECT_RATIOS = [
  "auto",
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;

export const GEMINI_3_1_ASPECT_RATIOS = [
  "auto",
  "1:1",
  "1:4",
  "1:8",
  "2:3",
  "3:2",
  "3:4",
  "4:1",
  "4:3",
  "4:5",
  "5:4",
  "8:1",
  "9:16",
  "16:9",
  "21:9",
] as const;

export const GEMINI_ASPECT_RATIOS = GEMINI_3_PRO_ASPECT_RATIOS;

export const GPT_IMAGE_ASPECT_RATIOS = ["auto", "1:1", "2:3", "3:2"] as const;

const GPT_IMAGE_STANDARD_SIZES: Record<string, string> = {
  auto: "auto",
  "1:1": "1024x1024",
  "2:3": "1024x1536",
  "3:2": "1536x1024",
};

export const IMAGE_MODEL_CAPABILITIES: Record<ImageModelKey, ImageModelCapability> = {
  openai_gpt2: {
    modelKey: "openai_gpt2",
    label: "GPT-Image-2",
    provider: "openai",
    apiModel: "gpt-image-2",
    supportsTextOnly: true,
    supportsImageUpload: true,
    aspectRatios: [...GPT_IMAGE_ASPECT_RATIOS],
    resolutionPresets: ["standard"],
    sizeByPreset: {
      standard: GPT_IMAGE_STANDARD_SIZES,
    },
    qualityOptions: ["low", "medium", "high", "auto"],
    outputFormats: ["webp", "jpeg", "png"],
    inputMaxEdgeOptions: [1024, 1536, 2048],
    defaults: {
      aspectRatios: ["auto"],
      resolutionPreset: "standard",
      quality: "medium",
      outputFormat: "webp",
      inputMaxEdge: 1536,
    },
    estimatedDurationLabel: "표준 설정 약 2~3분",
  },
  openai_gpt1_5: {
    modelKey: "openai_gpt1_5",
    label: "GPT-Image-1.5",
    provider: "openai",
    apiModel: "gpt-image-1.5",
    supportsTextOnly: true,
    supportsImageUpload: true,
    aspectRatios: [...GPT_IMAGE_ASPECT_RATIOS],
    resolutionPresets: ["standard"],
    sizeByPreset: {
      standard: GPT_IMAGE_STANDARD_SIZES,
    },
    qualityOptions: ["low", "medium", "high", "auto"],
    outputFormats: ["webp", "jpeg", "png"],
    inputMaxEdgeOptions: [1024, 1536],
    defaults: {
      aspectRatios: ["auto"],
      resolutionPreset: "standard",
      quality: "medium",
      outputFormat: "webp",
      inputMaxEdge: 1536,
    },
    estimatedDurationLabel: "표준 설정 약 2~3분",
  },
  gemini_3_1: {
    modelKey: "gemini_3_1",
    label: "Gemini 3.1 Flash",
    provider: "gemini",
    apiModel: "gemini-3.1-flash-image-preview",
    supportsTextOnly: true,
    supportsImageUpload: true,
    aspectRatios: [...GEMINI_3_1_ASPECT_RATIOS],
    imageSizeOptions: ["512", "1K", "2K", "4K"],
    defaults: {
      aspectRatios: ["auto"],
      imageSize: "1K",
    },
    estimatedDurationLabel: "약 1~2분",
  },
  gemini_3: {
    modelKey: "gemini_3",
    label: "Gemini 3.0 Pro",
    provider: "gemini",
    apiModel: "gemini-3-pro-image-preview",
    supportsTextOnly: true,
    supportsImageUpload: true,
    aspectRatios: [...GEMINI_3_PRO_ASPECT_RATIOS],
    imageSizeOptions: ["1K", "2K", "4K"],
    defaults: {
      aspectRatios: ["auto"],
      imageSize: "1K",
    },
    estimatedDurationLabel: "약 1~2분",
  },
};

export function isImageModelKey(model: string | null | undefined): model is ImageModelKey {
  return !!model && (IMAGE_MODEL_KEYS as readonly string[]).includes(model);
}

export function getImageModelCapability(model: string | null | undefined): ImageModelCapability | undefined {
  return isImageModelKey(model) ? IMAGE_MODEL_CAPABILITIES[model] : undefined;
}

export function getAllImageModelCapabilities(): Record<ImageModelKey, ImageModelCapability> {
  return IMAGE_MODEL_CAPABILITIES;
}

export function normalizeImageModelValue(model?: string | null): ImageModelKey | null {
  if (!model) return null;
  if (model === "openai" || model === "openai_gpt1_mini") return "openai_gpt1_5";
  if (model === "gemini") return "gemini_3_1";
  return isImageModelKey(model) ? model : null;
}

export function normalizeImageModelList(
  models?: string[] | null,
  fallback: ImageModelKey[] = [...IMAGE_MODEL_KEYS]
): ImageModelKey[] {
  const normalized = (models || [])
    .map((model) => normalizeImageModelValue(model))
    .filter((model): model is ImageModelKey => !!model);
  const unique = normalized.filter((model, index, arr) => arr.indexOf(model) === index);
  return unique.length > 0 ? unique : fallback;
}

function filterSupportedValues<T extends string>(values: unknown, allowed: readonly T[], fallback: T[]): T[] {
  if (!Array.isArray(values)) return fallback;
  const filtered = values.filter((value): value is T => typeof value === "string" && allowed.includes(value as T));
  return filtered.length > 0 ? filtered : fallback;
}

export function normalizeGenerationSettingsForModel(
  model: string,
  settings?: ImageGenerationSettings | null
): ImageGenerationSettings {
  const capability = getImageModelCapability(model);
  if (!capability) return {};

  const defaults = capability.defaults;
  const normalized: ImageGenerationSettings = {
    ...defaults,
    ...(settings || {}),
  };

  const aspectRatios = filterSupportedValues(
    normalized.aspectRatios,
    capability.aspectRatios,
    defaults.aspectRatios || [capability.aspectRatios[0]]
  );
  normalized.aspectRatios = [aspectRatios.includes("auto") ? "auto" : aspectRatios[0]];

  if (capability.resolutionPresets) {
    normalized.resolutionPreset = capability.resolutionPresets.includes(normalized.resolutionPreset as ResolutionPreset)
      ? normalized.resolutionPreset
      : defaults.resolutionPreset || capability.resolutionPresets[0];
  } else {
    delete normalized.resolutionPreset;
  }

  if (capability.qualityOptions) {
    normalized.quality = capability.qualityOptions.includes(normalized.quality as OpenAIImageQuality)
      ? normalized.quality
      : defaults.quality || capability.qualityOptions[0];
  } else {
    delete normalized.quality;
  }

  if (capability.outputFormats) {
    normalized.outputFormat = capability.outputFormats.includes(normalized.outputFormat as OpenAIOutputFormat)
      ? normalized.outputFormat
      : defaults.outputFormat || capability.outputFormats[0];
  } else {
    delete normalized.outputFormat;
  }

  if (capability.inputMaxEdgeOptions) {
    normalized.inputMaxEdge = capability.inputMaxEdgeOptions.includes(Number(normalized.inputMaxEdge))
      ? Number(normalized.inputMaxEdge)
      : defaults.inputMaxEdge || capability.inputMaxEdgeOptions[0];
  } else {
    delete normalized.inputMaxEdge;
  }

  if (capability.imageSizeOptions) {
    normalized.imageSize = capability.imageSizeOptions.includes(normalized.imageSize as GeminiImageSize)
      ? normalized.imageSize
      : defaults.imageSize || capability.imageSizeOptions[0];
  } else {
    delete normalized.imageSize;
  }

  return normalized;
}

export function normalizeConceptGenerationSettings(
  settings?: Record<string, unknown> | null,
  models?: string[] | null
): ConceptGenerationSettings {
  const normalizedModels = normalizeImageModelList(models);
  const result: ConceptGenerationSettings = {};
  const source = settings && typeof settings === "object" ? settings : {};

  for (const model of normalizedModels) {
    const modelSettings = source[model] && typeof source[model] === "object"
      ? (source[model] as ImageGenerationSettings)
      : undefined;
    result[model] = normalizeGenerationSettingsForModel(model, modelSettings);
  }

  return result;
}

export function createGenerationSettingsFromLegacy(options: {
  models?: string[] | null;
  aspectRatios?: Record<string, string[]> | null;
  gemini3AspectRatio?: string | null;
  gemini3ImageSize?: string | null;
  existingSettings?: Record<string, unknown> | null;
}): ConceptGenerationSettings {
  const models = normalizeImageModelList(options.models);
  const result: ConceptGenerationSettings = {};

  for (const model of models) {
    const existing = options.existingSettings?.[model] && typeof options.existingSettings[model] === "object"
      ? (options.existingSettings[model] as ImageGenerationSettings)
      : undefined;
    const baseSettings: ImageGenerationSettings = {
      ...(existing || {}),
    };
    const existingRatios = Array.isArray(baseSettings.aspectRatios) ? baseSettings.aspectRatios : [];
    const hasSingleExistingRatio = existingRatios.length === 1;

    if (model === "gemini_3") {
      if (!baseSettings.imageSize && typeof options.gemini3ImageSize === "string") {
        baseSettings.imageSize = options.gemini3ImageSize as GeminiImageSize;
      }
      if (!hasSingleExistingRatio && typeof options.gemini3AspectRatio === "string") {
        baseSettings.aspectRatios = [options.gemini3AspectRatio];
      }
    }

    const legacyRatios = options.aspectRatios?.[model];
    if (!baseSettings.aspectRatios?.length && Array.isArray(legacyRatios) && legacyRatios.length > 0) {
      baseSettings.aspectRatios = legacyRatios;
    }

    result[model] = normalizeGenerationSettingsForModel(model, baseSettings);
  }

  return result;
}

export function getPrimaryAspectRatio(settings?: ImageGenerationSettings | null, capability?: ImageModelCapability): string {
  if (settings?.aspectRatios?.length) return settings.aspectRatios[0];
  if (capability?.defaults.aspectRatios?.length) return capability.defaults.aspectRatios[0];
  return capability?.aspectRatios[0] || "1:1";
}

export function getOpenAIImageSizeForSettings(
  model: string,
  settings?: ImageGenerationSettings | null,
  requestedAspectRatio?: string
): string {
  const capability = getImageModelCapability(model);
  if (!capability || capability.provider !== "openai") return "1024x1024";
  const normalized = normalizeGenerationSettingsForModel(model, settings);
  const aspectRatio = requestedAspectRatio && capability.aspectRatios.includes(requestedAspectRatio)
    ? requestedAspectRatio
    : getPrimaryAspectRatio(normalized, capability);
  const preset = normalized.resolutionPreset || capability.defaults.resolutionPreset || "standard";
  return capability.sizeByPreset?.[preset]?.[aspectRatio] || capability.sizeByPreset?.standard?.[aspectRatio] || "1024x1024";
}
