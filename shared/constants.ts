// 병원 관리 시스템 상수 정의

export const HOSPITAL_CONSTANTS = {
  // 패키지 타입
  PACKAGE_TYPES: {
    BASIC: 'basic',
    PREMIUM: 'premium',
    ENTERPRISE: 'enterprise',
    UNLIMITED: 'unlimited'
  } as const,

  // 기본값
  DEFAULTS: {
    PACKAGE_TYPE: 'basic',
    IS_ACTIVE: true,
    THEME_COLOR: '#3b82f6',
    CONTRACT_DURATION_MONTHS: 12,
    SLUG_PREFIX: 'hospital-'
  },

  // 페이지네이션
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100
  },

  // 유효성 검사
  VALIDATION: {
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 100,
    PHONE_PATTERN: /^[0-9-+\s()]+$/,
    EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    SLUG_PATTERN: /^[a-z0-9-]+$/
  }
} as const;

// 타입 정의
export type PackageType = typeof HOSPITAL_CONSTANTS.PACKAGE_TYPES[keyof typeof HOSPITAL_CONSTANTS.PACKAGE_TYPES];

// 패키지 타입 옵션 (UI용)
export const PACKAGE_TYPE_OPTIONS = [
  { value: HOSPITAL_CONSTANTS.PACKAGE_TYPES.BASIC, label: '기본', description: '기본 기능 제공' },
  { value: HOSPITAL_CONSTANTS.PACKAGE_TYPES.PREMIUM, label: '프리미엄', description: '고급 기능 포함' },
  { value: HOSPITAL_CONSTANTS.PACKAGE_TYPES.ENTERPRISE, label: '엔터프라이즈', description: '모든 기능 + 전용 지원' },
  { value: HOSPITAL_CONSTANTS.PACKAGE_TYPES.UNLIMITED, label: '무제한', description: '제한 없는 사용' }
] as const;

// 유틸리티 함수
export const hospitalUtils = {
  // 슬러그 생성
  generateSlug: (name: string): string => {
    return `${HOSPITAL_CONSTANTS.DEFAULTS.SLUG_PREFIX}${Date.now()}`;
  },

  // 계약 종료일 계산
  calculateContractEndDate: (startDate: Date, months: number = HOSPITAL_CONSTANTS.DEFAULTS.CONTRACT_DURATION_MONTHS): Date => {
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);
    return endDate;
  },

  // 병원명 유효성 검사
  validateHospitalName: (name: string): boolean => {
    return name.trim().length >= HOSPITAL_CONSTANTS.VALIDATION.NAME_MIN_LENGTH &&
           name.trim().length <= HOSPITAL_CONSTANTS.VALIDATION.NAME_MAX_LENGTH;
  },

  // 전화번호 유효성 검사
  validatePhoneNumber: (phone: string): boolean => {
    return HOSPITAL_CONSTANTS.VALIDATION.PHONE_PATTERN.test(phone);
  },

  // 이메일 유효성 검사
  validateEmail: (email: string): boolean => {
    return HOSPITAL_CONSTANTS.VALIDATION.EMAIL_PATTERN.test(email);
  }
};

// ===== 회원 관리 상수 =====
export const USER_CONSTANTS = {
  MEMBER_TYPES: {
    FREE: 'free',
    PRO: 'pro', 
    MEMBERSHIP: 'membership',
    HOSPITAL_ADMIN: 'hospital_admin',
    ADMIN: 'admin',
    SUPERADMIN: 'superadmin'
  },
  DEFAULTS: {
    MEMBER_TYPE: 'free',
    IS_ACTIVE: true
  },
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 100
  },
  VALIDATION: {
    USERNAME_MIN_LENGTH: 2,
    USERNAME_MAX_LENGTH: 50,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE_MIN_LENGTH: 10
  }
};

// 회원 유형 옵션 (프론트엔드용)
export const MEMBER_TYPE_OPTIONS = [
  { value: 'free', label: '일반회원' },
  { value: 'pro', label: '프로회원' },
  { value: 'membership', label: '멤버십회원' },
  { value: 'hospital_admin', label: '병원관리자' },
  { value: 'admin', label: '관리자' },
  { value: 'superadmin', label: '슈퍼관리자' }
];

// 회원 관리 유틸리티 함수
export const userUtils = {
  /**
   * 유효한 회원 등급인지 확인
   */
  validateMemberType: (memberType: string): boolean => {
    return Object.values(USER_CONSTANTS.MEMBER_TYPES).includes(memberType);
  },

  /**
   * 사용자명 검증
   */
  validateUsername: (username: string): boolean => {
    if (!username) return false;
    return username.trim().length >= USER_CONSTANTS.VALIDATION.USERNAME_MIN_LENGTH &&
           username.trim().length <= USER_CONSTANTS.VALIDATION.USERNAME_MAX_LENGTH;
  },

  /**
   * 이메일 검증
   */
  validateEmail: (email: string): boolean => {
    if (!email) return false;
    return USER_CONSTANTS.VALIDATION.EMAIL_REGEX.test(email);
  },

  /**
   * 전화번호 검증
   */
  validatePhoneNumber: (phone: string): boolean => {
    if (!phone) return false;
    return phone.trim().length >= USER_CONSTANTS.VALIDATION.PHONE_MIN_LENGTH;
  },

  /**
   * 회원 등급의 한글명 반환
   */
  getMemberTypeLabel: (memberType: string): string => {
    const option = MEMBER_TYPE_OPTIONS.find(opt => opt.value === memberType);
    return option ? option.label : memberType;
  }
};

// ===== 이미지 처리 상수 =====
export const IMAGE_CONSTANTS = {
  CONTENT_TYPES: {
    WEBP: 'image/webp',
    JPEG: 'image/jpeg',
    PNG: 'image/png',
    JPG: 'image/jpg'
  },
  PATHS: {
    LOCAL_UPLOADS: '/uploads/',
    LOCAL_STATIC: '/static/',
    LOCAL_COLLAGES: '/uploads/collages/'
  }
} as const;

// ===== 음악 생성 상수 =====
export const MUSIC_CONSTANTS = {
  DURATION: {
    MIN_SECONDS: 30,
    MAX_SECONDS: 300,
    DEFAULT_SECONDS: 120
  },
  ENGINES: {
    TOPMEDIA: 'topmedia',
    SUNO: 'suno'
  },
  STATUS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed'
  },
  TIMEOUT: {
    GENERATION_MS: 3 * 60 * 1000, // 3분
    POLLING_INTERVAL_MS: 5000 // 5초
  }
} as const;

// ===== 이미지 생성 카테고리 상수 =====
export const IMAGE_GENERATION_CATEGORIES = {
  MATERNITY: {
    ID: 'mansak_img',
    NAME: '만삭사진',
    DESCRIPTION: 'AI가 당신의 특별한 이미지를 만들어드립니다',
    PAGE_TITLE: '만삭사진 스타일',
    GENERATION_PAGE: '/maternity-photo',
    GALLERY_PAGE: '/maternity-styles'
  },
  FAMILY: {
    ID: 'family_img',
    NAME: '가족사진',
    DESCRIPTION: '다양하고 멋진 스타일로 바꿔보세요.',
    PAGE_TITLE: '사진스타일 바꾸기',
    GENERATION_PAGE: '/family-photo',
    GALLERY_PAGE: '/family-styles'
  },
  BABY_FACE: {
    ID: 'baby_face_img',
    NAME: '아기얼굴',
    DESCRIPTION: '아기의 미래 모습을 AI로 예측해보세요',
    PAGE_TITLE: '아기얼굴 스타일',
    GENERATION_PAGE: '/baby-face',
    GALLERY_PAGE: '/baby-styles'
  },
  STICKER: {
    ID: 'sticker_img',
    NAME: '스티커',
    DESCRIPTION: '나만의 특별한 스티커를 만들어보세요',
    PAGE_TITLE: '스티커 스타일',
    GENERATION_PAGE: '/stickers',
    GALLERY_PAGE: '/sticker-styles'
  }
} as const;

// 카테고리 배열 (순회용)
export const IMAGE_CATEGORY_LIST = [
  IMAGE_GENERATION_CATEGORIES.MATERNITY,
  IMAGE_GENERATION_CATEGORIES.FAMILY,
  IMAGE_GENERATION_CATEGORIES.BABY_FACE,
  IMAGE_GENERATION_CATEGORIES.STICKER
] as const;