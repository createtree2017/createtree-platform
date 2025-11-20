import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PATHS, FILE_LIMITS, ALLOWED_MIME_TYPES } from './constants';
import { AppError } from '../utils/error-handler';
import { logger } from '../utils/logger';

/**
 * 업로드 대상 타입
 */
export type UploadDestination = 
  | 'uploads'
  | 'banners'
  | 'small-banners'
  | 'milestones'
  | 'thumbnails'
  | 'temp';

/**
 * 파일 타입
 */
export type FileType = 'image' | 'audio' | 'video' | 'document' | 'all';

/**
 * 디렉토리 생성 (없으면 자동 생성)
 */
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.info(`Created directory: ${dirPath}`);
  }
}

/**
 * 모든 업로드 디렉토리 초기화
 */
export function initializeUploadDirectories(): void {
  Object.values(PATHS).forEach(dirPath => {
    ensureDirectoryExists(dirPath);
  });
  logger.info('All upload directories initialized');
}

/**
 * 파일 타입에 따른 크기 제한
 */
function getFileSizeLimit(fileType: FileType): number {
  switch (fileType) {
    case 'image':
      return FILE_LIMITS.MAX_IMAGE_SIZE;
    case 'audio':
      return FILE_LIMITS.MAX_AUDIO_SIZE;
    case 'video':
      return FILE_LIMITS.MAX_VIDEO_SIZE;
    case 'document':
      return FILE_LIMITS.MAX_DOCUMENT_SIZE;
    case 'all':
      return FILE_LIMITS.MAX_IMAGE_SIZE; // 10MB
    default:
      return FILE_LIMITS.MAX_IMAGE_SIZE;
  }
}

/**
 * 파일 타입에 따른 허용 MIME 타입
 */
function getAllowedMimeTypes(fileType: FileType): readonly string[] {
  switch (fileType) {
    case 'image':
      return ALLOWED_MIME_TYPES.IMAGES;
    case 'audio':
      return ALLOWED_MIME_TYPES.AUDIO;
    case 'video':
      return ALLOWED_MIME_TYPES.VIDEO;
    case 'all':
      return ALLOWED_MIME_TYPES.ALL_FILES;
    default:
      return ALLOWED_MIME_TYPES.IMAGES;
  }
}

/**
 * Multer 업로드 미들웨어 생성 (팩토리 패턴)
 */
export function createUploadMiddleware(
  destination: UploadDestination,
  fileType: FileType = 'image',
  options?: {
    maxFileSize?: number;
    allowedMimeTypes?: string[];
    fileFieldName?: string;
  }
) {
  // 대상 디렉토리 결정
  const destinationPath = (() => {
    switch (destination) {
      case 'uploads':
        return PATHS.UPLOADS;
      case 'banners':
        return PATHS.STATIC_BANNER_SLIDE;
      case 'small-banners':
        return PATHS.STATIC_BANNER_SMALL;
      case 'milestones':
        return PATHS.STATIC_MILESTONE;
      case 'thumbnails':
        return PATHS.THUMBNAILS;
      case 'temp':
        return PATHS.TEMP;
      default:
        return PATHS.UPLOADS;
    }
  })();

  // 디렉토리 존재 확인
  ensureDirectoryExists(destinationPath);

  // ✅ Multer Storage 설정: GCS 업로드를 위해 memoryStorage 사용
  // diskStorage는 req.file.path만 제공하지만, GCS 업로드는 req.file.buffer가 필요
  const storage = multer.memoryStorage();

  // 파일 필터 (MIME 타입 검증)
  const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // 'all' 타입: 실행 파일만 차단, 나머지 모두 허용
    if (fileType === 'all') {
      const blockedExecutableTypes = [
        'application/x-msdownload',
        'application/x-executable',
        'application/x-sh',
        'application/x-bat',
        'application/x-deb',
        'application/x-rpm',
      ];
      
      if (blockedExecutableTypes.includes(file.mimetype)) {
        cb(new AppError(400, '실행 파일은 업로드할 수 없습니다'));
      } else {
        cb(null, true); // 모든 비실행 파일 허용
      }
    } else {
      // 다른 타입: whitelist 검증
      const allowedTypes = options?.allowedMimeTypes || getAllowedMimeTypes(fileType);
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new AppError(400, `지원하지 않는 파일 형식입니다. 허용된 형식: ${allowedTypes.join(', ')}`));
      }
    }
  };

  // Multer 인스턴스 생성
  return multer({
    storage,
    limits: {
      fileSize: options?.maxFileSize || getFileSizeLimit(fileType),
    },
    fileFilter,
  });
}

/**
 * 사전 정의된 업로드 미들웨어
 */
export const uploadMiddlewares = {
  // 일반 이미지 업로드
  image: createUploadMiddleware('uploads', 'image'),
  
  // 배너 이미지 (슬라이드)
  banner: createUploadMiddleware('banners', 'image'),
  
  // 작은 배너
  smallBanner: createUploadMiddleware('small-banners', 'image'),
  
  // 마일스톤 이미지
  milestone: createUploadMiddleware('milestones', 'image'),
  
  // 썸네일
  thumbnail: createUploadMiddleware('thumbnails', 'image', {
    maxFileSize: 2 * 1024 * 1024, // 2MB
  }),
  
  // 음악 파일
  audio: createUploadMiddleware('uploads', 'audio'),
  
  // 임시 파일
  temp: createUploadMiddleware('temp', 'image'),
};

/**
 * 파일 삭제 헬퍼
 */
export function deleteFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        logger.error('Failed to delete file', { filePath, error: err });
        reject(err);
      } else {
        logger.info('File deleted', { filePath });
        resolve();
      }
    });
  });
}

/**
 * 파일 이동 헬퍼
 */
export function moveFile(sourcePath: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.rename(sourcePath, destPath, (err) => {
      if (err) {
        logger.error('Failed to move file', { sourcePath, destPath, error: err });
        reject(err);
      } else {
        logger.info('File moved', { sourcePath, destPath });
        resolve();
      }
    });
  });
}

/**
 * 파일 복사 헬퍼
 */
export function copyFile(sourcePath: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.copyFile(sourcePath, destPath, (err) => {
      if (err) {
        logger.error('Failed to copy file', { sourcePath, destPath, error: err });
        reject(err);
      } else {
        logger.info('File copied', { sourcePath, destPath });
        resolve();
      }
    });
  });
}
