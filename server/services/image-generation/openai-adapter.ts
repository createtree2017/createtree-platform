import fetch from "node-fetch";
import FormData from "form-data";
import sharp from "sharp";
import {
  getImageModelCapability,
  getOpenAIImageSizeForSettings,
  normalizeGenerationSettingsForModel,
  type OpenAIOutputFormat,
} from "@shared/model-capabilities";
import { buildFinalPrompt } from "../../utils/prompt";
import type { ImageGenerationAdapterInput, ImageGenerationResult } from "./types";

const OPENAI_IMAGE_GENERATIONS_URL = "https://api.openai.com/v1/images/generations";
const OPENAI_IMAGE_EDITS_URL = "https://api.openai.com/v1/images/edits";
const OPENAI_IMAGE_TIMEOUT_MS = 5 * 60 * 1000;
const API_KEY = process.env.OPENAI_API_KEY;

function isValidApiKey(apiKey: string | undefined): boolean {
  return !!apiKey && (apiKey.startsWith("sk-") || apiKey.startsWith("sk-proj-"));
}

function createOpenAIImageError(message: string, status?: number): Error {
  const error = new Error(message);
  if (status) {
    (error as any).status = status;
  }
  return error;
}

function mimeTypeForOutputFormat(format: OpenAIOutputFormat | undefined): string {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  return "image/webp";
}

function extensionForOutputFormat(format: OpenAIOutputFormat | undefined): string {
  if (format === "jpeg") return "jpg";
  if (format === "png") return "png";
  return "webp";
}

async function fetchWithTimeout(url: string, init: any) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_IMAGE_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function prepareInputImage(buffer: Buffer, maxEdge = 1536): Promise<Buffer> {
  const image = sharp(buffer, { failOn: "none" }).rotate();
  const metadata = await image.metadata();
  const width = metadata.width || maxEdge;
  const height = metadata.height || maxEdge;
  const shouldResize = Math.max(width, height) > maxEdge;

  return image
    .resize({
      width: shouldResize && width >= height ? maxEdge : undefined,
      height: shouldResize && height > width ? maxEdge : undefined,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function prepareMultiImageGrid(buffers: Buffer[], maxEdge = 1536): Promise<Buffer> {
  if (buffers.length === 1) {
    return prepareInputImage(buffers[0], maxEdge);
  }

  const cellSize = Math.min(768, Math.max(512, Math.floor(maxEdge / 2)));
  const resizedImages: Buffer[] = [];

  for (const buffer of buffers) {
    const resized = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize(cellSize, cellSize, { fit: "cover" })
      .jpeg({ quality: 88 })
      .toBuffer();
    resizedImages.push(resized);
  }

  const cols = buffers.length <= 3 ? buffers.length : Math.ceil(Math.sqrt(buffers.length));
  const rows = Math.ceil(buffers.length / cols);
  const compositeImages = resizedImages.map((input, index) => ({
    input,
    left: (index % cols) * cellSize,
    top: Math.floor(index / cols) * cellSize,
  }));

  return sharp({
    create: {
      width: cols * cellSize,
      height: rows * cellSize,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(compositeImages)
    .jpeg({ quality: 90 })
    .toBuffer();
}

function parseOpenAIImageResponse(responseData: any, outputFormat: OpenAIOutputFormat | undefined): string {
  const first = responseData?.data?.[0];
  const imageUrl = first?.url;
  const base64Data = first?.b64_json;

  if (imageUrl) return imageUrl;
  if (base64Data) {
    return `data:${mimeTypeForOutputFormat(outputFormat)};base64,${base64Data}`;
  }

  throw new Error("OpenAI image response did not include url or b64_json");
}

function parseJsonResponse(responseText: string): any {
  try {
    return JSON.parse(responseText);
  } catch {
    return {
      error: {
        message: responseText || "OpenAI image API returned an empty non-JSON response",
      },
    };
  }
}

export async function generateWithOpenAI(input: ImageGenerationAdapterInput): Promise<ImageGenerationResult> {
  if (!isValidApiKey(API_KEY)) {
    throw createOpenAIImageError("OpenAI image API key is not configured");
  }

  const startedAt = Date.now();
  const capability = getImageModelCapability(input.modelKey);
  if (!capability || capability.provider !== "openai") {
    throw new Error(`OpenAI adapter received unsupported model: ${input.modelKey}`);
  }

  const settings = normalizeGenerationSettingsForModel(input.modelKey, input.settings);
  const outputFormat = settings.outputFormat || "webp";
  const imageSize = getOpenAIImageSizeForSettings(input.modelKey, settings, input.aspectRatio);
  const finalPrompt = buildFinalPrompt({
    template: input.prompt,
    systemPrompt: input.systemPrompt,
    variables: input.variables,
  });
  const isTextOnly = input.isTextOnly || (!input.imageBuffer && (!input.imageBuffers || input.imageBuffers.length === 0));

  console.log("[OpenAI Adapter] request prepared", {
    model: capability.apiModel,
    mode: isTextOnly ? "generation" : "edit",
    size: imageSize,
    quality: settings.quality,
    outputFormat,
    inputMaxEdge: settings.inputMaxEdge,
    promptLength: finalPrompt.length,
  });

  if (isTextOnly) {
    const requestBody = {
      model: capability.apiModel,
      prompt: finalPrompt,
      n: 1,
      size: imageSize,
      quality: settings.quality || "medium",
      output_format: outputFormat,
    };

    const apiResponse = await fetchWithTimeout(OPENAI_IMAGE_GENERATIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await apiResponse.text();
    const responseData = parseJsonResponse(responseText);
    if (!apiResponse.ok || responseData.error) {
      throw createOpenAIImageError(
        responseData.error?.message || `OpenAI image generation failed with status ${apiResponse.status}`,
        apiResponse.status
      );
    }

    return {
      imageUrl: parseOpenAIImageResponse(responseData, outputFormat),
      provider: "openai",
      apiModel: capability.apiModel,
      elapsedMs: Date.now() - startedAt,
    };
  }

  const sourceBuffers = input.imageBuffers && input.imageBuffers.length > 0
    ? input.imageBuffers
    : input.imageBuffer
      ? [input.imageBuffer]
      : [];

  if (sourceBuffers.length === 0) {
    throw new Error("OpenAI edit mode requires at least one input image");
  }

  const preparedImage = sourceBuffers.length > 1
    ? await prepareMultiImageGrid(sourceBuffers, settings.inputMaxEdge)
    : await prepareInputImage(sourceBuffers[0], settings.inputMaxEdge);

  const formData = new FormData();
  formData.append("model", capability.apiModel);
  formData.append("prompt", finalPrompt);
  formData.append("image", preparedImage, {
    filename: `input.${extensionForOutputFormat("jpeg")}`,
    contentType: "image/jpeg",
  });
  formData.append("size", imageSize);
  formData.append("quality", settings.quality || "medium");
  formData.append("output_format", outputFormat);
  formData.append("n", "1");

  const contentLength = await new Promise<number>((resolve, reject) => {
    formData.getLength((err, length) => {
      if (err) reject(err);
      else resolve(length);
    });
  });

  const apiResponse = await fetchWithTimeout(OPENAI_IMAGE_EDITS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      ...formData.getHeaders(),
      "Content-Length": contentLength.toString(),
    },
    body: formData,
  });

  const responseText = await apiResponse.text();
  const responseData = parseJsonResponse(responseText);
  if (!apiResponse.ok || responseData.error) {
    throw createOpenAIImageError(
      responseData.error?.message || `OpenAI image edit failed with status ${apiResponse.status}`,
      apiResponse.status
    );
  }

  return {
    imageUrl: parseOpenAIImageResponse(responseData, outputFormat),
    provider: "openai",
    apiModel: capability.apiModel,
    elapsedMs: Date.now() - startedAt,
  };
}
