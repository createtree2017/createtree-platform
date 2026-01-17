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
// 최적화: 같은 버킷 내 파일은 서버 측 복사 사용 (네트워크 I/O 최소화)
router.post('/copy-from-gallery', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const { imageUrl, thumbnailUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ success: false, error: '이미지 URL이 필요합니다.' });
    }

    const startTime = Date.now();
    console.log(`[Editor Upload] 갤러리 이미지 복사 시작: ${imageUrl}`);

    // GCS URL에서 파일 경로 추출
    const extractGcsPath = (url: string): string | null => {
      if (!url) return null;
      const cleanUrl = url.split('?')[0];
      const gcsPattern = new RegExp(`https://storage\\.googleapis\\.com/${bucketName}/(.+)`);
      const match = cleanUrl.match(gcsPattern);
      return match ? match[1] : null;
    };

    // GCS 서버 측 복사 (같은 버킷 내) - 재시도 및 존재 확인 포함
    const copyWithinGcs = async (srcPath: string, destPath: string, maxRetries: number = 3): Promise<string> => {
      const srcFile = bucket.file(srcPath);
      const destFile = bucket.file(destPath);
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await srcFile.copy(destFile);
          await destFile.makePublic();
          
          // 복사 후 파일 존재 확인
          const [exists] = await destFile.exists();
          if (!exists) {
            throw new Error(`복사 후 파일 존재 확인 실패: ${destPath}`);
          }
          
          console.log(`[Editor Upload] ✅ GCS 복사 성공 (시도 ${attempt}/${maxRetries}): ${destPath}`);
          return `https://storage.googleapis.com/${bucketName}/${destPath}`;
        } catch (error) {
          console.warn(`[Editor Upload] ⚠️ GCS 복사 실패 (시도 ${attempt}/${maxRetries}): ${destPath}`, error);
          if (attempt === maxRetries) {
            throw new Error(`GCS 복사 최종 실패 (${maxRetries}회 시도): ${destPath}`);
          }
          // 재시도 전 대기 (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
      throw new Error(`GCS 복사 실패: ${destPath}`); // 타입스크립트용
    };

    // GCS에서 직접 파일 다운로드 (비공개 버킷도 접근 가능)
    const downloadFromGcs = async (gcsPath: string): Promise<Buffer> => {
      const file = bucket.file(gcsPath);
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`GCS 파일 없음: ${gcsPath}`);
      }
      const [buffer] = await file.download();
      return buffer;
    };

    // 이미지 fetch (외부 URL용)
    const fetchImage = async (url: string): Promise<Buffer> => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`이미지 fetch 실패: ${response.status}`);
      }
      return Buffer.from(await response.arrayBuffer());
    };

    const uniqueId = uuidv4().substring(0, 8);
    const timestamp = Date.now();
    const ext = imageUrl.split('.').pop()?.split('?')[0] || 'webp';
    const safeFilename = `gallery_${uniqueId}.${ext}`;

    const originalPath = `editor/${userId}/${timestamp}_${uniqueId}_original_${safeFilename}`;
    const previewFilename = `gallery_${uniqueId}.webp`;
    const previewPath = `editor/${userId}/${timestamp}_${uniqueId}_preview_${previewFilename}`;

    const srcGcsPath = extractGcsPath(imageUrl);
    const thumbGcsPath = thumbnailUrl ? extractGcsPath(thumbnailUrl) : null;
    
    let originalGcsUrl: string;
    let previewGcsUrl: string;
    let originalWidth: number;
    let originalHeight: number;
    let previewWidth: number;
    let previewHeight: number;

    // 빠른 경로: GCS 내부 복사 (원본과 썸네일 모두 GCS에 있는 경우)
    if (srcGcsPath && thumbGcsPath) {
      console.log(`[Editor Upload] ⚡ GCS 서버 측 복사 사용 (빠른 경로)`);
      
      // 원본 파일 존재 확인
      const [srcExists] = await bucket.file(srcGcsPath).exists();
      const [thumbExists] = await bucket.file(thumbGcsPath).exists();
      
      if (srcExists && thumbExists) {
        // 병렬로 복사 실행
        const [origUrl, prevUrl] = await Promise.all([
          copyWithinGcs(srcGcsPath, originalPath),
          copyWithinGcs(thumbGcsPath, previewPath)
        ]);
        
        originalGcsUrl = origUrl;
        previewGcsUrl = prevUrl;
        
        // 원본 파일과 썸네일 파일의 메타데이터를 병렬로 가져옴
        const [origBuffer, thumbBuffer] = await Promise.all([
          downloadFromGcs(srcGcsPath),
          downloadFromGcs(thumbGcsPath)
        ]);
        
        const [origMeta, thumbMeta] = await Promise.all([
          sharp(origBuffer).metadata(),
          sharp(thumbBuffer).metadata()
        ]);
        
        // 원본 파일의 실제 크기 사용 (정확한 크기)
        originalWidth = origMeta.width || 1200;
        originalHeight = origMeta.height || 900;
        
        // 썸네일의 실제 크기 사용 (프리뷰 크기)
        previewWidth = thumbMeta.width || 800;
        previewHeight = thumbMeta.height || 600;
        
        console.log(`[Editor Upload] 원본 크기: ${originalWidth}x${originalHeight}, 프리뷰 크기: ${previewWidth}x${previewHeight}`);
        
        const elapsed = Date.now() - startTime;
        console.log(`[Editor Upload] ⚡ GCS 복사 완료: ${elapsed}ms (서버 측 복사)`);
        
        return res.status(200).json({
          success: true,
          data: {
            originalUrl: originalGcsUrl,
            previewUrl: previewGcsUrl,
            filename: safeFilename,
            originalWidth,
            originalHeight,
            previewWidth,
            previewHeight,
            method: 'gcs-server-copy'
          }
        });
      }
    }
    
    // 표준 경로: 다운로드 후 처리
    console.log(`[Editor Upload] 📥 표준 복사 경로 사용 (다운로드/업로드)`);
    
    let originalBuffer: Buffer;
    if (srcGcsPath) {
      console.log(`[Editor Upload] GCS 직접 다운로드: ${srcGcsPath}`);
      originalBuffer = await downloadFromGcs(srcGcsPath);
    } else {
      console.log(`[Editor Upload] HTTP fetch: ${imageUrl}`);
      originalBuffer = await fetchImage(imageUrl);
    }
    console.log(`[Editor Upload] 원본 이미지 다운로드 완료: ${originalBuffer.length} bytes`);

    // 이미지 정규화 및 메타데이터 추출
    const normalized = await normalizeImageBuffer(originalBuffer);
    originalWidth = normalized.width;
    originalHeight = normalized.height;

    // 원본 이미지 GCS 업로드
    originalGcsUrl = await uploadBufferToGCS(normalized.buffer, originalPath, `image/${ext}`);
    console.log(`[Editor Upload] 갤러리 원본 저장 완료: ${originalPath}`);

    // 프리뷰 생성 및 업로드
    const preview = await generatePreview(normalized.buffer);
    previewGcsUrl = await uploadBufferToGCS(preview.buffer, previewPath, 'image/webp');
    previewWidth = preview.width;
    previewHeight = preview.height;
    console.log(`[Editor Upload] 갤러리 프리뷰 저장 완료: ${previewPath}`);

    const elapsed = Date.now() - startTime;
    console.log(`[Editor Upload] 갤러리 복사 완료: ${elapsed}ms (표준 경로)`);

    res.status(200).json({
      success: true,
      data: {
        originalUrl: originalGcsUrl,
        previewUrl: previewGcsUrl,
        filename: safeFilename,
        originalWidth,
        originalHeight,
        previewWidth,
        previewHeight,
        method: 'download-upload'
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

const THUMBNAIL_SIZE = 400;
const THUMBNAIL_QUALITY = 85;

const ALLOWED_PROJECT_TYPES = ['photobook', 'postcard', 'party', 'calendar', 'sticker'] as const;
type AllowedProjectType = typeof ALLOWED_PROJECT_TYPES[number];

router.post('/thumbnail', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '썸네일 파일이 없습니다.' });
    }

    const { projectId, projectType } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: '인증이 필요합니다.' });
    }
    
    if (!projectId || !projectType) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectId와 projectType이 필요합니다.' 
      });
    }

    const normalizedType = String(projectType).toLowerCase() as AllowedProjectType;
    if (!ALLOWED_PROJECT_TYPES.includes(normalizedType)) {
      console.warn(`[Thumbnail] 허용되지 않은 projectType: ${projectType} (userId: ${userId})`);
      return res.status(400).json({ 
        success: false, 
        error: `유효하지 않은 projectType: ${projectType}` 
      });
    }

    console.log(`[Thumbnail] 썸네일 업로드 시작: ${normalizedType}/${projectId} (userId: ${userId})`);

    const metadata = await sharp(req.file.buffer).metadata();
    const originalWidth = metadata.width || 800;
    const originalHeight = metadata.height || 600;
    
    const aspectRatio = originalHeight / originalWidth;
    let targetWidth = THUMBNAIL_SIZE;
    let targetHeight = Math.round(THUMBNAIL_SIZE * aspectRatio);
    
    if (targetHeight > THUMBNAIL_SIZE) {
      targetHeight = THUMBNAIL_SIZE;
      targetWidth = Math.round(THUMBNAIL_SIZE / aspectRatio);
    }

    const thumbnailBuffer = await sharp(req.file.buffer)
      .rotate()
      .resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: false })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toBuffer();

    const thumbnailPath = `thumbnails/${normalizedType}/${projectId}.webp`;
    const thumbnailUrl = await uploadBufferToGCS(thumbnailBuffer, thumbnailPath, 'image/webp');
    
    console.log(`[Thumbnail] 썸네일 저장 완료 (덮어쓰기): ${thumbnailPath}`);

    res.status(200).json({
      success: true,
      data: {
        thumbnailUrl,
        width: targetWidth,
        height: targetHeight
      }
    });

  } catch (error) {
    console.error('[Thumbnail] 썸네일 업로드 실패:', error);
    res.status(500).json({
      success: false,
      error: '썸네일 업로드 실패',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
