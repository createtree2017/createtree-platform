import fs from "fs/promises";
import type { Request } from "express";

export type ReferenceImageSource = "upload" | "firebase";

export interface ReferenceImage {
  buffer: Buffer;
  source: ReferenceImageSource;
  fieldName?: string;
  originalName?: string;
  mimeType?: string;
  size: number;
  index: number;
}

export interface ExtractReferenceImagesOptions {
  fileFields?: string[];
  includeOtherImageFields?: boolean;
  includeFirebaseBuffers?: boolean;
}

type MulterFileMap = Record<string, Express.Multer.File[]>;

function isMulterFileArray(files: unknown): files is Express.Multer.File[] {
  return Array.isArray(files);
}

function isMulterFileMap(files: unknown): files is MulterFileMap {
  return !!files && typeof files === "object" && !Array.isArray(files);
}

function getRequestFiles(
  req: Request,
  fileFields: string[],
  includeOtherImageFields: boolean
): Array<{ file: Express.Multer.File; fieldName?: string }> {
  const files = req.files;
  if (!files) return [];

  if (isMulterFileArray(files)) {
    return files
      .filter((file) => file.mimetype?.startsWith("image/"))
      .map((file) => ({ file, fieldName: file.fieldname }));
  }

  if (!isMulterFileMap(files)) return [];

  const picked: Array<{ file: Express.Multer.File; fieldName?: string }> = [];
  const seen = new Set<Express.Multer.File>();

  for (const fieldName of fileFields) {
    const fieldFiles = files[fieldName] || [];
    for (const file of fieldFiles) {
      if (!seen.has(file) && file.mimetype?.startsWith("image/")) {
        picked.push({ file, fieldName });
        seen.add(file);
      }
    }
  }

  if (includeOtherImageFields) {
    for (const [fieldName, fieldFiles] of Object.entries(files)) {
      for (const file of fieldFiles || []) {
        if (!seen.has(file) && file.mimetype?.startsWith("image/")) {
          picked.push({ file, fieldName });
          seen.add(file);
        }
      }
    }
  }

  return picked;
}

async function bufferFromMulterFile(file: Express.Multer.File): Promise<Buffer> {
  if (file.buffer && file.buffer.length > 0) {
    return file.buffer;
  }

  if (file.path) {
    return fs.readFile(file.path);
  }

  throw new Error(`Uploaded image has no buffer or path: ${file.originalname || file.fieldname}`);
}

export async function extractReferenceImages(
  req: Request,
  options: ExtractReferenceImagesOptions = {}
): Promise<ReferenceImage[]> {
  const fileFields = options.fileFields || ["image", "images"];
  const includeOtherImageFields = options.includeOtherImageFields ?? true;
  const includeFirebaseBuffers = options.includeFirebaseBuffers ?? true;
  const referenceImages: ReferenceImage[] = [];

  const uploadFiles = getRequestFiles(req, fileFields, includeOtherImageFields);
  for (const { file, fieldName } of uploadFiles) {
    const buffer = await bufferFromMulterFile(file);
    referenceImages.push({
      buffer,
      source: "upload",
      fieldName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: buffer.length,
      index: referenceImages.length,
    });
  }

  if (includeFirebaseBuffers) {
    for (const buffer of req.downloadedBuffers || []) {
      if (!buffer || buffer.length === 0) continue;
      referenceImages.push({
        buffer,
        source: "firebase",
        size: buffer.length,
        index: referenceImages.length,
      });
    }
  }

  return referenceImages;
}

export function summarizeReferenceImages(referenceImages: ReferenceImage[]) {
  return {
    count: referenceImages.length,
    sources: Array.from(new Set(referenceImages.map((image) => image.source))),
    images: referenceImages.map((image) => ({
      index: image.index,
      source: image.source,
      fieldName: image.fieldName,
      originalName: image.originalName,
      mimeType: image.mimeType,
      size: image.size,
    })),
  };
}
