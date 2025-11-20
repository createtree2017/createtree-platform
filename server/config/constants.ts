import path from 'path';

/**
 * 파일 경로 상수
 * - 모든 파일 저장 경로를 중앙 관리
 * - 환경에 따라 동적 변경 가능
 */
export const PATHS = {
  UPLOADS: path.join(process.cwd(), 'uploads'),
  STATIC: path.join(process.cwd(), 'static'),
  STATIC_BANNER: path.join(process.cwd(), 'static', 'banner'),
  STATIC_BANNER_SLIDE: path.join(process.cwd(), 'static', 'banner', 'slide-banners'),
  STATIC_BANNER_SMALL: path.join(process.cwd(), 'static', 'banner', 'small-banners'),
  STATIC_MILESTONE: path.join(process.cwd(), 'static', 'milestones'),
  THUMBNAILS: path.join(process.cwd(), 'uploads', 'thumbnails'),
  TEMP: path.join(process.cwd(), 'uploads', 'temp'),
} as const;

/**
 * 파일 업로드 제한
 */
export const FILE_LIMITS = {
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,      // 10MB
  MAX_AUDIO_SIZE: 50 * 1024 * 1024,      // 50MB
  MAX_VIDEO_SIZE: 100 * 1024 * 1024,     // 100MB
  MAX_DOCUMENT_SIZE: 5 * 1024 * 1024,    // 5MB
} as const;

/**
 * 허용 파일 타입
 */
export const ALLOWED_MIME_TYPES = {
  IMAGES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ],
  AUDIO: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
  ],
  VIDEO: [
    'video/mp4',
    'video/webm',
    'video/ogg',
  ],
  ALL_FILES: [
    // 이미지
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
    // 문서
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript',
    'application/json', 'application/xml',
    // 압축
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/gzip',
    // 비디오
    'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm',
    // 오디오
    'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp3',
  ],
} as const;

/**
 * 사용자 역할 및 권한
 */
export const USER_ROLES = {
  FREE: 'free',
  PRO: 'pro',
  MEMBERSHIP: 'membership',
  HOSPITAL_ADMIN: 'hospital_admin',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
} as const;

export const ADMIN_ROLES = [
  USER_ROLES.ADMIN,
  USER_ROLES.SUPERADMIN,
] as const;

export const HOSPITAL_ADMIN_ROLES = [
  USER_ROLES.HOSPITAL_ADMIN,
  USER_ROLES.ADMIN,
  USER_ROLES.SUPERADMIN,
] as const;

/**
 * 마일스톤 상태
 */
export const MILESTONE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
} as const;

/**
 * 신청 상태
 */
export const APPLICATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

/**
 * 이미지 카테고리
 */
export const IMAGE_CATEGORIES = {
  MATERNITY: 'mansak_img',      // 만삭 사진
  FAMILY: 'family_img',          // 가족 사진
  STICKER: 'sticker_img',        // 스티커
} as const;

/**
 * 음악 스타일 (TopMediai)
 */
export const MUSIC_STYLES = {
  POP: 'pop',
  BALLAD: 'ballad',
  ACOUSTIC: 'acoustic',
  LULLABY: 'lullaby',
  CLASSICAL: 'classical',
} as const;

/**
 * AI 모델 제공자
 */
export const AI_PROVIDERS = {
  OPENAI: 'openai',
  GEMINI: 'gemini',
  TOPMEDIA: 'topmedia',
} as const;

/**
 * 페이지네이션 기본값
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/**
 * Rate Limiting (요청 제한)
 */
export const RATE_LIMITS = {
  API_GENERAL: {
    windowMs: 15 * 60 * 1000,  // 15분
    max: 100,                   // 최대 100 요청
  },
  API_AUTH: {
    windowMs: 15 * 60 * 1000,
    max: 5,                     // 로그인 시도 5회
  },
  API_UPLOAD: {
    windowMs: 60 * 60 * 1000,  // 1시간
    max: 20,                    // 업로드 20회
  },
  API_AI_GENERATION: {
    windowMs: 60 * 60 * 1000,
    max: 10,                    // AI 생성 10회
  },
} as const;

/**
 * 세션 설정
 */
export const SESSION_CONFIG = {
  SECRET: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  MAX_AGE: 7 * 24 * 60 * 60 * 1000,  // 7일
  COOKIE_NAME: 'chango_ai_session',
} as const;

/**
 * JWT 설정
 */
export const JWT_CONFIG = {
  SECRET: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
  EXPIRES_IN: '7d',
  REFRESH_EXPIRES_IN: '30d',
} as const;

/**
 * 에러 메시지
 */
export const ERROR_MESSAGES = {
  UNAUTHORIZED: '인증이 필요합니다',
  FORBIDDEN: '권한이 없습니다',
  NOT_FOUND: '리소스를 찾을 수 없습니다',
  VALIDATION_FAILED: '입력값 검증에 실패했습니다',
  INTERNAL_SERVER_ERROR: '서버 오류가 발생했습니다',
  INVALID_FILE_TYPE: '지원하지 않는 파일 형식입니다',
  FILE_TOO_LARGE: '파일 크기가 너무 큽니다',
  RATE_LIMIT_EXCEEDED: '요청 한도를 초과했습니다',
} as const;

/**
 * 성공 메시지
 */
export const SUCCESS_MESSAGES = {
  CREATED: '생성되었습니다',
  UPDATED: '수정되었습니다',
  DELETED: '삭제되었습니다',
  UPLOADED: '업로드되었습니다',
} as const;

/**
 * 타입 헬퍼
 */
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export type MilestoneStatus = typeof MILESTONE_STATUS[keyof typeof MILESTONE_STATUS];
export type ApplicationStatus = typeof APPLICATION_STATUS[keyof typeof APPLICATION_STATUS];
export type ImageCategory = typeof IMAGE_CATEGORIES[keyof typeof IMAGE_CATEGORIES];
