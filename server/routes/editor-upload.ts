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

function extractGCSPath(url: string): string | null {
  if (!url) return null;
  
  let cleanUrl = url.split('?')[0];
  
  const gcsPrefix = `https://storage.googleapis.com/${bucketName}/`;
  if (cleanUrl.startsWith(gcsPrefix)) {
    return cleanUrl.substring(gcsPrefix.length);
  }
  
  const gsPrefix = `gs://${bucketName}/`;
  if (cleanUrl.startsWith(gsPrefix)) {
    return cleanUrl.substring(gsPrefix.length);
  }
  
  const encodedPattern = new RegExp(`https://storage\\.googleapis\\.com/.*?/o/(.+)`);
  const match = cleanUrl.match(encodedPattern);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  
  return null;
}

router.delete('/delete', requireAuth, express.json(), async (req, res) => {
  try {
    const { originalUrl, previewUrl } = req.body;
    
    if (!originalUrl && !previewUrl) {
      return res.status(400).json({ success: false, error: 'URL이 필요합니다.' });
    }

    const userId = req.user?.id;
    const deletedPaths: string[] = [];
    const errors: string[] = [];

    for (const url of [originalUrl, previewUrl]) {
      if (!url) continue;
      
      const path = extractGCSPath(url);
      if (!path) {
        errors.push(`잘못된 URL 형식: ${url}`);
        continue;
      }

      if (!path.startsWith(`editor/${userId}/`)) {
        errors.push(`권한 없음: ${path}`);
        continue;
      }

      try {
        const file = bucket.file(path);
        const [exists] = await file.exists();
        
        if (exists) {
          await file.delete();
          deletedPaths.push(path);
          console.log(`[Editor Upload] GCS 파일 삭제 완료: ${path}`);
        } else {
          console.log(`[Editor Upload] 파일 없음 (이미 삭제됨): ${path}`);
        }
      } catch (deleteError) {
        console.error(`[Editor Upload] 파일 삭제 실패: ${path}`, deleteError);
        errors.push(`삭제 실패: ${path}`);
      }
    }

    res.status(200).json({
      success: true,
      deleted: deletedPaths,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('[Editor Upload] 삭제 요청 실패:', error);
    res.status(500).json({
      success: false,
      error: '파일 삭제 실패',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// 갤러리 이미지를 프로젝트용 GCS에 복사하는 엔드포인트
router.post('/copy-from-gallery', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const { imageUrl, thumbnailUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ success: false, error: '이미지 URL이 필요합니다.' });
    }

    console.log(`[Editor Upload] 갤러리 이미지 복사 시작: ${imageUrl}`);

    // 이미지 fetch (갤러리 이미지는 다양한 소스에서 올 수 있음)
    const fetchImage = async (url: string): Promise<Buffer> => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`이미지 fetch 실패: ${response.status}`);
      }
      return Buffer.from(await response.arrayBuffer());
    };

    // 원본 이미지 다운로드
    const originalBuffer = await fetchImage(imageUrl);
    console.log(`[Editor Upload] 원본 이미지 다운로드 완료: ${originalBuffer.length} bytes`);

    // 이미지 정규화 및 메타데이터 추출
    const normalized = await normalizeImageBuffer(originalBuffer);
    const originalWidth = normalized.width;
    const originalHeight = normalized.height;

    const uniqueId = uuidv4().substring(0, 8);
    const timestamp = Date.now();
    const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const safeFilename = `gallery_${uniqueId}.${ext}`;

    // 원본 이미지 GCS 업로드
    const originalPath = `editor/${userId}/${timestamp}_${uniqueId}_original_${safeFilename}`;
    const originalGcsUrl = await uploadBufferToGCS(normalized.buffer, originalPath, `image/${ext}`);
    console.log(`[Editor Upload] 갤러리 원본 저장 완료: ${originalPath}`);

    // 프리뷰 생성 및 업로드
    const preview = await generatePreview(normalized.buffer);
    const previewFilename = `gallery_${uniqueId}.webp`;
    const previewPath = `editor/${userId}/${timestamp}_${uniqueId}_preview_${previewFilename}`;
    const previewGcsUrl = await uploadBufferToGCS(preview.buffer, previewPath, 'image/webp');
    console.log(`[Editor Upload] 갤러리 프리뷰 저장 완료: ${previewPath}`);

    res.status(200).json({
      success: true,
      data: {
        originalUrl: originalGcsUrl,
        previewUrl: previewGcsUrl,
        filename: safeFilename,
        originalWidth,
        originalHeight,
        previewWidth: preview.width,
        previewHeight: preview.height
      }
    });

  } catch (error) {
    console.error('[Editor Upload] 갤러리 이미지 복사 실패:', error);
    res.status(500).json({
      success: false,
      error: '갤러리 이미지 복사 실패',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
