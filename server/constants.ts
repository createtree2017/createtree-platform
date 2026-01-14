/**
 * Server-only constants
 * These constants use environment variables and should never be imported by client code
 */

// ===== GCS (Google Cloud Storage) 상수 =====
export const GCS_CONSTANTS = {
  BUCKET: {
    // CRITICAL FIX: Check GOOGLE_CLOUD_STORAGE_BUCKET first, then GCS_BUCKET_NAME
    DEFAULT_NAME: process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 
                  process.env.GCS_BUCKET_NAME || 
                  'createtree-upload',
    BASE_URL: 'https://storage.googleapis.com'
  },
  PATHS: {
    IMAGES_PREFIX: 'images/',
    COLLAGES_PREFIX: 'collages/',
    SYSTEM_IMAGES: 'images/general/system/',
    MUSIC_PREFIX: 'music/',
    THUMBNAILS_SUFFIX: 'thumbnails/'
  },
  CACHE: {
    MAX_AGE_SECONDS: 31536000, // 1년
    CONTROL_HEADER: 'public, max-age=31536000'
  }
} as const;

// ===== Firebase 및 인증 상수 =====
export const FIREBASE_CONSTANTS = {
  PEM: {
    HEADER: '-----BEGIN PRIVATE KEY-----',
    FOOTER: '-----END PRIVATE KEY-----',
    LINE_LENGTH: 64 // Base64 라인 길이
  },
  BASE64: {
    REGEX: /[^A-Za-z0-9+/=]/g, // Base64가 아닌 문자 제거용 정규식
    CHUNK_SIZE: 64, // Base64 라인당 문자 수
    PREVIEW_LENGTH: 64 // 로그용 미리보기 길이
  },
  LOGGING: {
    PREVIEW_LENGTH: 100, // 로그에 표시할 문자열 미리보기 길이
    BASE64_PREVIEW_LENGTH: 64
  },
  MESSAGES: {
    ERRORS: {
      EMPTY_PRIVATE_KEY: 'Private key is empty or undefined',
      NO_BASE64_DATA: 'Private key에서 Base64 데이터를 찾을 수 없습니다',
      MISSING_FIELDS: 'JSON credentials missing required fields',
      INVALID_JSON: 'Invalid JSON credentials',
      MISSING_ENV_VARS: 'Missing required environment variables',
      ADC_UNAVAILABLE: 'Firebase ADC를 사용할 수 없습니다',
      NOT_CONFIGURED: 'Firebase가 설정되지 않았습니다'
    },
    SUCCESS: {
      JSON_LOADED: 'Firebase JSON credentials 로드 성공',
      ENV_LOADED: 'Firebase 개별 환경변수 로드 성공',
      ADC_INIT: 'Firebase Admin ADC로 초기화 완료',
      INIT_COMPLETE: 'Firebase Admin 초기화 완료'
    }
  }
} as const;

// ===== 병원 관리 메시지 (Server-only) =====
export const HOSPITAL_MESSAGES = {
  ERRORS: {
    HOSPITAL_NOT_FOUND: '병원을 찾을 수 없습니다',
    INVALID_NAME: '병원명을 입력해주세요',
    INVALID_ADDRESS: '병원 주소를 입력해주세요',
    INVALID_PHONE: '올바른 전화번호를 입력해주세요',
    DUPLICATE_NAME: '이미 등록된 병원명입니다',
    CREATE_FAILED: '병원 등록 중 오류가 발생했습니다',
    UPDATE_FAILED: '병원 정보 수정 중 오류가 발생했습니다',
    DELETE_FAILED: '병원 삭제 중 오류가 발생했습니다',
    FETCH_FAILED: '병원 목록을 불러올 수 없습니다'
  },
  SUCCESS: {
    CREATED: '병원이 성공적으로 등록되었습니다',
    UPDATED: '병원 정보가 성공적으로 수정되었습니다',
    DELETED: '병원이 성공적으로 삭제되었습니다'
  }
} as const;

// ===== 회원 관리 메시지 (Server-only) =====
export const USER_MESSAGES = {
  ERRORS: {
    USER_NOT_FOUND: '사용자를 찾을 수 없습니다',
    INVALID_MEMBER_TYPE: '유효하지 않은 회원 등급입니다',
    USERNAME_REQUIRED: '닉네임을 입력해주세요',
    EMAIL_REQUIRED: '이메일을 입력해주세요',
    INVALID_EMAIL: '유효한 이메일을 입력해주세요',
    USERNAME_TOO_SHORT: '닉네임은 최소 2자 이상이어야 합니다',
    PHONE_INVALID: '유효한 전화번호를 입력해주세요',
    UNAUTHORIZED: '권한이 없습니다',
    SUPERADMIN_REQUIRED: '슈퍼관리자 권한이 필요합니다',
    CANNOT_DELETE_SUPERADMIN: '슈퍼관리자는 삭제할 수 없습니다',
    CANNOT_MODIFY_SUPERADMIN: '다른 슈퍼관리자의 정보는 수정할 수 없습니다'
  },
  SUCCESS: {
    USER_CREATED: '사용자가 성공적으로 생성되었습니다',
    USER_UPDATED: '사용자 정보가 성공적으로 수정되었습니다',
    USER_DELETED: '사용자가 성공적으로 삭제되었습니다'
  }
} as const;

// ===== 이미지 처리 설정 (Server-only) =====
export const IMAGE_PROCESSING = {
  THUMBNAIL: {
    MAX_SIZE: 1024,           // 최대 크기 (px) - 편집용 품질 확보
    QUALITY: 85,              // WebP/JPEG 품질 (0-100)
    FIT_MODE: 'inside' as const,  // 비율 유지, 자르지 않음
    FORMAT: 'webp' as const,  // 출력 포맷
    WITH_ENLARGEMENT: false,  // 원본보다 크게 확대하지 않음
  },
  ORIGINAL: {
    MAX_SIZE: 2048,           // 원본 최대 크기 (px)
    QUALITY: 90,              // 원본 품질
    FIT_MODE: 'inside' as const,
    FORMAT: 'webp' as const,
  },
  BANNER: {
    SLIDE_MAX_WIDTH: 1920,
    SLIDE_MAX_HEIGHT: 1080,
    SMALL_MAX_WIDTH: 800,
    SMALL_MAX_HEIGHT: 600,
    QUALITY: 95,
  },
} as const;

// ===== 이미지 처리 메시지 (Server-only) =====
export const IMAGE_MESSAGES = {
  ERRORS: {
    NO_FILE_UPLOADED: 'No image file uploaded',
    NO_STYLE_SELECTED: 'No style selected',
    IMAGE_NOT_FOUND: 'Image not found',
    NOT_FOUND: '이미지를 찾을 수 없습니다',
    FILE_NOT_FOUND: '파일을 찾을 수 없습니다',
    INVALID_ID: '잘못된 이미지 ID입니다',
    PROXY_ERROR: 'Image proxy error',
    STREAM_ERROR: 'Failed to load image',
    FETCH_FAILED: '이미지를 가져올 수 없습니다',
    DOWNLOAD_FAILED: '이미지 다운로드 중 오류가 발생했습니다',
    GENERATION_FAILED: '이미지 생성에 실패했습니다',
    USER_AUTH_ERROR: '사용자 인증 정보가 올바르지 않습니다'
  },
  SUCCESS: {
    UPLOADED: '이미지가 성공적으로 업로드되었습니다',
    GENERATED: '이미지가 성공적으로 생성되었습니다',
    DELETED: '이미지가 성공적으로 삭제되었습니다'
  }
} as const;

// ===== 음악 생성 메시지 (Server-only) =====
export const MUSIC_MESSAGES = {
  ERRORS: {
    PROMPT_REQUIRED: '프롬프트를 입력해주세요',
    VALIDATION_FAILED: '입력 데이터가 올바르지 않습니다',
    GENERATION_FAILED: '음악 생성에 실패했습니다',
    NOT_FOUND: '음악을 찾을 수 없습니다',
    ENGINE_ERROR: '엔진 상태 조회 중 오류가 발생했습니다',
    INVALID_MUSIC_ID: '올바른 음악 ID를 입력해주세요',
    STATUS_CHECK_ERROR: '상태 확인 중 오류가 발생했습니다'
  },
  SUCCESS: {
    GENERATION_STARTED: '음악 생성이 시작되었습니다',
    FALLBACK_USED: '기본 엔진에서 문제가 발생하여 대체 엔진으로 진행합니다'
  }
} as const;

// ===== API 응답 메시지 (Server-only) =====
export const API_MESSAGES = {
  ERRORS: {
    UNAUTHORIZED: '인증이 필요합니다',
    PERMISSION_DENIED: '권한이 없습니다',
    LOGIN_REQUIRED: '로그인이 필요합니다',
    USER_NOT_FOUND: '사용자 정보를 찾을 수 없습니다',
    SUPERADMIN_REQUIRED: '슈퍼관리자 권한이 필요합니다',
    FETCH_FAILED: '데이터를 가져오는 중 오류가 발생했습니다',
    SERVER_ERROR: '서버 내부 오류가 발생했습니다',
    INVALID_IMAGE_ID: '잘못된 이미지 ID입니다',
    DELETE_FAILED: '이미지 삭제 중 오류가 발생했습니다'
  },
  SUCCESS: {
    OPERATION_SUCCESS: '작업이 성공적으로 완료되었습니다',
    DELETE_SUCCESS: '이미지가 성공적으로 삭제되었습니다'
  }
} as const;
