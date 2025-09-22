// ES 모듈 변환
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAdminOrSuperAdmin } from '../middleware/admin-auth';
// 🔄 검증된 GCS 인스턴스 재사용 (private key 처리 문제 해결)
import { storage, bucket, bucketName } from '../utils/gcs-image-storage';

/**
 * 파일명을 안전하게 sanitize하는 함수
 * 경로 조작 공격 방지 및 안전한 문자만 허용
 */
function sanitizeFilename(originalName: string): string {
  if (!originalName || typeof originalName !== 'string') {
    return `unknown_${Date.now()}.jpg`;
  }
  
  // Unicode 정규화 (NFC)
  let filename = originalName.normalize('NFC');
  
  // 경로 구분자 및 위험한 문자 제거
  filename = filename.replace(/[\/\\:\*\?\"<>\|]/g, '_');
  
  // 연속된 점들 제거 (../ 공격 방지)
  filename = filename.replace(/\.{2,}/g, '_');
  
  // 앞뒤 공백 및 점 제거
  filename = filename.trim().replace(/^\.|\.$/g, '_');
  
  // 너무 긴 파일명 제한 (확장자 포함 최대 100자)
  if (filename.length > 100) {
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);
    filename = name.substring(0, 100 - ext.length - 1) + ext;
  }
  
  // 빈 파일명 처리
  if (!filename || filename === '_') {
    filename = `file_${Date.now()}.jpg`;
  }
  
  return filename;
}

// HIPAA 컴플라이언스 보안 설정
const SIGNED_URL_TTL_MINUTES = parseInt(process.env.SIGNED_URL_TTL_MINUTES || '30'); // 기본 30분

// 🔄 GCS 인스턴스는 gcs-image-storage.ts에서 검증된 것을 재사용 (private key 처리 해결됨)

const router = express.Router();

// Multer 설정 - 메모리 저장으로 변경 (더 안정적)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한
  },
  fileFilter: (req, file, cb) => {
    console.log('[Upload] 파일 필터 체크:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      fieldname: file.fieldname
    });
    // 이미지 파일만 허용
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
});

// GCS 업로드 테스트 API (관리자 인증 필요) - 직접 메모리 버퍼 업로드
router.post('/test', requireAdminOrSuperAdmin, upload.single('file'), async (req, res) => {
  console.log('[Upload Test] 요청 시작:', {
    headers: req.headers,
    user: req.user,
    hasFile: !!req.file,
    fileInfo: req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : null
  });

  try {
    if (!req.file) {
      console.error('[Upload Test] 파일이 없습니다. req.file:', req.file);
      return res.status(400).json({ error: '파일이 없습니다.' });
    }

    const userId = 'test-user';
    const file = req.file;
    
    // 파일명 보안 처리
    const safeFilename = sanitizeFilename(file.originalname);
    const destination = `uploads/${userId}/${Date.now()}_${safeFilename}`;
    
    console.log('[Upload Test] 파일명 보안 처리:', {
      original: file.originalname,
      sanitized: safeFilename,
      destination: destination
    });

    console.log('[Upload Test] GCS 직접 업로드 시작:', destination);

    // GCS에 직접 메모리 버퍼 업로드 (올바른 공개 ACL 설정)
    const gcsFile = bucket.file(destination);
    
    // 1단계: 파일 업로드 (PRIVATE 모드 - 의료 환경 보안 강화)
    await gcsFile.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
        cacheControl: 'private, max-age=0, no-store', // HIPAA 캐시 방지
        metadata: {
          // 의료 환경 보안 메타데이터 추가
          uploadedAt: new Date().toISOString(),
          securityLevel: 'private',
          accessType: 'authenticated_only',
          uploadedBy: userId
        }
      },
      // predefinedAcl: 'publicRead', // 의료 보안을 위해 공개 ACL 완전 제거
      resumable: false, // 작은 파일은 단일 업로드
    });
    
    // 2단계: makePublic() 호출 제거 - 의료 환경에서는 인증된 접근만 허용
    console.log('[Upload Test] ✅ 파일이 PRIVATE 모드로 안전하게 저장됨:', destination);
    console.log('[Upload Test] 🔒 의료 환경 보안 정책에 따라 인증된 접근만 허용됩니다.');

    // Signed URL 생성 (시간 제한된 인증 접근)
    const [signedUrl] = await gcsFile.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + (SIGNED_URL_TTL_MINUTES * 60 * 1000), // 환경변수 기반 TTL
      responseDisposition: 'inline',
      responseType: file.mimetype,
      // HIPAA 보안 헤더 추가
      extensionHeaders: {
        'Cache-Control': 'private, max-age=0, no-store',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    // 보안 메타데이터 확인 로깅
    try {
      const [metadata] = await gcsFile.getMetadata();
      console.log('[Upload Test] 🔒 보안 파일 메타데이터 확인:', {
        name: metadata.name,
        contentType: metadata.contentType,
        size: metadata.size,
        timeCreated: metadata.timeCreated,
        securityLevel: metadata.metadata?.securityLevel || 'private',
        accessType: metadata.metadata?.accessType || 'authenticated_only'
      });
    } catch (metadataError) {
      console.warn('[Upload Test] 메타데이터 확인 실패:', metadataError);
    }
    
    console.log('[Upload Test] 🔒 GCS 보안 업로드 성공:', destination);
    res.status(200).json({ 
      url: signedUrl, // Signed URL로 변경 (시간 제한된 접근)
      gsPath: `gs://${bucketName}/${destination}`,
      message: '🔒 의료 환경 보안 강화: Private 모드 업로드 성공 (인증된 접근만 허용)',
      destination: destination,
      securityLevel: 'private',
      accessType: 'authenticated_only',
      expiresIn: `${SIGNED_URL_TTL_MINUTES} minutes`
    });

  } catch (error) {
    console.error('[Upload Test] 업로드 실패:', error);
    res.status(500).json({ 
      error: 'Upload failed', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// GCS 업로드 API (관리자 인증 필요) - 직접 메모리 버퍼 업로드
router.post('/', requireAdminOrSuperAdmin, upload.single('file'), async (req, res) => {
  console.log('[Upload] 요청 시작:', {
    method: req.method,
    url: req.url,
    headers: {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length'],
      authorization: req.headers.authorization ? 'Bearer ***' : 'none',
      cookie: req.headers.cookie ? 'present' : 'none'
    },
    user: req.user,
    hasFile: !!req.file,
    fileInfo: req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      fieldname: req.file.fieldname
    } : null
  });

  try {
    if (!req.file) {
      console.error('[Upload] 파일이 없습니다. 디버깅 정보:', {
        bodyKeys: Object.keys(req.body || {}),
        hasFiles: !!req.files,
        multerError: (req as any).multerError
      });
      return res.status(400).json({ error: '파일이 없습니다.' });
    }

    // 사용자 ID 가져오기 (인증된 사용자 또는 요청에서)
    const userId = req.user?.id || req.body.userId || 'anonymous';
    
    const file = req.file;
    
    // 파일명 보안 처리
    const safeFilename = sanitizeFilename(file.originalname);
    const destination = `uploads/${userId}/${Date.now()}_${safeFilename}`;
    
    console.log('[Upload] 파일명 보안 처리:', {
      original: file.originalname,
      sanitized: safeFilename,
      destination: destination
    });

    console.log('[Upload] GCS 직접 업로드 시작:', destination);

    // GCS에 직접 메모리 버퍼 업로드 (올바른 공개 ACL 설정)
    const gcsFile = bucket.file(destination);
    
    // 1단계: 파일 업로드 (PRIVATE 모드 - 의료 환경 보안 강화)
    await gcsFile.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
        cacheControl: 'private, max-age=0, no-store', // HIPAA 캐시 방지
        metadata: {
          // 의료 환경 보안 메타데이터 추가
          uploadedAt: new Date().toISOString(),
          securityLevel: 'private',
          accessType: 'authenticated_only',
          uploadedBy: userId
        }
      },
      // predefinedAcl: 'publicRead', // 의료 보안을 위해 공개 ACL 완전 제거
      resumable: false, // 작은 파일은 단일 업로드
    });
    
    // 2단계: makePublic() 호출 제거 - 의료 환경에서는 인증된 접근만 허용
    console.log('[Upload] ✅ 파일이 PRIVATE 모드로 안전하게 저장됨:', destination);
    console.log('[Upload] 🔒 의료 환경 보안 정책에 따라 인증된 접근만 허용됩니다.');

    // Signed URL 생성 (시간 제한된 인증 접근)
    const [signedUrl] = await gcsFile.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + (SIGNED_URL_TTL_MINUTES * 60 * 1000), // 환경변수 기반 TTL
      responseDisposition: 'inline',
      responseType: file.mimetype,
      // HIPAA 보안 헤더 추가
      extensionHeaders: {
        'Cache-Control': 'private, max-age=0, no-store',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    // 보안 메타데이터 확인 로깅
    try {
      const [metadata] = await gcsFile.getMetadata();
      console.log('[Upload] 🔒 보안 파일 메타데이터 확인:', {
        name: metadata.name,
        contentType: metadata.contentType,
        size: metadata.size,
        timeCreated: metadata.timeCreated,
        securityLevel: metadata.metadata?.securityLevel || 'private',
        accessType: metadata.metadata?.accessType || 'authenticated_only'
      });
    } catch (metadataError) {
      console.warn('[Upload] 메타데이터 확인 실패:', metadataError);
    }
    
    console.log('[Upload] 🔒 GCS 보안 업로드 성공:', destination);
    res.status(200).json({ 
      url: signedUrl, // Signed URL로 변경 (시간 제한된 접근)
      gsPath: `gs://${bucketName}/${destination}`,
      destination: destination,
      securityLevel: 'private',
      accessType: 'authenticated_only',
      expiresIn: `${SIGNED_URL_TTL_MINUTES} minutes`,
      message: '🔒 의료 환경 보안 강화: Private 모드 업로드 성공'
    });

  } catch (error) {
    console.error('[Upload] 업로드 실패:', error);
    res.status(500).json({ 
      error: 'Upload failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;