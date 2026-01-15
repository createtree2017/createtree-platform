import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth';
import { storage, bucket, bucketName } from '../utils/gcs-image-storage';

const router = express.Router();

const PREVIEW_MAX_WIDTH = 800;
const PREVIEW_QUALITY = 80;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
});

function sanitizeFilename(originalName: string): string {
  if (!originalName || typeof originalName !== 'string') {
    return `unknown_${Date.now()}.jpg`;
  }
  
  let filename = originalName.normalize('NFC');
  filename = filename.replace(/[\/\\:\*\?\"<>\|]/g, '_');
  filename = filename.replace(/\.{2,}/g, '_');
  filename = filename.trim().replace(/^\.|\.$/g, '_');
  
  if (filename.length > 100) {
    const ext = filename.split('.').pop() || 'jpg';
    const name = filename.substring(0, 95 - ext.length);
    filename = `${name}.${ext}`;
  }
  
  if (!filename || filename === '_') {
    filename = `file_${Date.now()}.jpg`;
  }
  
  return filename;
}

async function uploadBufferToGCS(
  buffer: Buffer,
  destination: string,
  contentType: string
): Promise<string> {
  const gcsFile = bucket.file(destination);
  
  await gcsFile.save(buffer, {
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000',
      metadata: {
        uploadedAt: new Date().toISOString()
      }
    },
    predefinedAcl: 'publicRead',
    resumable: false
  });
  
  await gcsFile.makePublic();
  
  return `https://storage.googleapis.com/${bucketName}/${destination}`;
}

async function normalizeImageBuffer(buffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  const normalized = await sharp(buffer)
    .rotate()
    .withMetadata()
    .toBuffer();
  
  const metadata = await sharp(normalized).metadata();
  return {
    buffer: normalized,
    width: metadata.width || 0,
    height: metadata.height || 0
  };
}

async function generatePreview(buffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width || 800;
  const originalHeight = metadata.height || 600;
  
  if (originalWidth <= PREVIEW_MAX_WIDTH) {
    const previewBuffer = await sharp(buffer)
      .rotate()
      .webp({ quality: PREVIEW_QUALITY })
      .toBuffer();
    return { buffer: previewBuffer, width: originalWidth, height: originalHeight };
  }
  
  const ratio = originalHeight / originalWidth;
  const previewWidth = PREVIEW_MAX_WIDTH;
  const previewHeight = Math.round(PREVIEW_MAX_WIDTH * ratio);
  
  const previewBuffer = await sharp(buffer)
    .rotate()
    .resize(previewWidth, previewHeight, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: PREVIEW_QUALITY })
    .toBuffer();
  
  return { buffer: previewBuffer, width: previewWidth, height: previewHeight };
}

router.post('/single', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '파일이 없습니다.' });
    }

    const userId = req.user?.id || 'anonymous';
    const file = req.file;
    const uniqueId = uuidv4().substring(0, 8);
    const safeFilename = sanitizeFilename(file.originalname);
    const timestamp = Date.now();
    
    console.log(`[Editor Upload] 업로드 시작: ${file.originalname} (${file.size} bytes)`);

    const normalized = await normalizeImageBuffer(file.buffer);
    const originalWidth = normalized.width;
    const originalHeight = normalized.height;

    const originalPath = `editor/${userId}/${timestamp}_${uniqueId}_original_${safeFilename}`;
    const originalUrl = await uploadBufferToGCS(normalized.buffer, originalPath, file.mimetype);
    console.log(`[Editor Upload] 원본 저장 완료: ${originalPath} (EXIF 회전 적용)`);

    const preview = await generatePreview(normalized.buffer);
    const previewFilename = safeFilename.replace(/\.[^.]+$/, '.webp');
    const previewPath = `editor/${userId}/${timestamp}_${uniqueId}_preview_${previewFilename}`;
    const previewUrl = await uploadBufferToGCS(preview.buffer, previewPath, 'image/webp');
    console.log(`[Editor Upload] 프리뷰 저장 완료: ${previewPath}`);

    res.status(200).json({
      success: true,
      data: {
        originalUrl,
        previewUrl,
        filename: file.originalname,
        originalWidth,
        originalHeight,
        previewWidth: preview.width,
        previewHeight: preview.height
      }
    });

  } catch (error) {
    console.error('[Editor Upload] 업로드 실패:', error);
    res.status(500).json({
      success: false,
      error: '이미지 업로드 실패',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

router.post('/multiple', requireAuth, upload.array('files', 20), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: '파일이 없습니다.' });
    }

    const userId = req.user?.id || 'anonymous';
    const timestamp = Date.now();
    
    console.log(`[Editor Upload] 다중 업로드 시작: ${files.length}개 파일`);

    const results = await Promise.all(files.map(async (file, index) => {
      const uniqueId = uuidv4().substring(0, 8);
      const safeFilename = sanitizeFilename(file.originalname);

      const normalized = await normalizeImageBuffer(file.buffer);
      const originalWidth = normalized.width;
      const originalHeight = normalized.height;

      const originalPath = `editor/${userId}/${timestamp}_${index}_${uniqueId}_original_${safeFilename}`;
      const originalUrl = await uploadBufferToGCS(normalized.buffer, originalPath, file.mimetype);

      const preview = await generatePreview(normalized.buffer);
      const previewFilename = safeFilename.replace(/\.[^.]+$/, '.webp');
      const previewPath = `editor/${userId}/${timestamp}_${index}_${uniqueId}_preview_${previewFilename}`;
      const previewUrl = await uploadBufferToGCS(preview.buffer, previewPath, 'image/webp');

      return {
        originalUrl,
        previewUrl,
        filename: file.originalname,
        originalWidth,
        originalHeight,
        previewWidth: preview.width,
        previewHeight: preview.height
      };
    }));

    console.log(`[Editor Upload] 다중 업로드 완료: ${results.length}개 파일`);

    res.status(200).json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('[Editor Upload] 다중 업로드 실패:', error);
    res.status(500).json({
      success: false,
      error: '이미지 업로드 실패',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
