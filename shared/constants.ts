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
  },

  // 메시지
  MESSAGES: {
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
  },
  MESSAGES: {
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