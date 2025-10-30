/**
 * AI Snapshot Generator Constants
 * 
 * All configurations for the snapshot feature
 */

export const SNAPSHOT_MODES = {
  INDIVIDUAL: 'individual',
  COUPLE: 'couple',
  FAMILY: 'family'
} as const;

export const SNAPSHOT_STYLES = {
  MIX: 'mix',
  DAILY: 'daily',
  TRAVEL: 'travel',
  FILM: 'film'
} as const;

export const SNAPSHOT_GENDERS = {
  MALE: 'male',
  FEMALE: 'female'
} as const;

export type SnapshotMode = typeof SNAPSHOT_MODES[keyof typeof SNAPSHOT_MODES];
export type SnapshotStyle = typeof SNAPSHOT_STYLES[keyof typeof SNAPSHOT_STYLES];
export type SnapshotGender = typeof SNAPSHOT_GENDERS[keyof typeof SNAPSHOT_GENDERS];

export const MODE_OPTIONS = [
  {
    value: SNAPSHOT_MODES.INDIVIDUAL,
    label: '개인',
    description: '1인 AI 스냅샷',
    icon: '👤'
  },
  {
    value: SNAPSHOT_MODES.COUPLE,
    label: '커플',
    description: '2인 커플 스냅샷',
    icon: '💑'
  },
  {
    value: SNAPSHOT_MODES.FAMILY,
    label: '가족',
    description: '가족 단체 스냅샷',
    icon: '👨‍👩‍👧‍👦'
  }
] as const;

export const STYLE_OPTIONS = [
  {
    value: SNAPSHOT_STYLES.MIX,
    label: '믹스',
    description: '다양한 스타일 랜덤 조합',
    bgColor: 'bg-gradient-to-br from-purple-500 to-pink-500'
  },
  {
    value: SNAPSHOT_STYLES.DAILY,
    label: '데일리',
    description: '일상적인 분위기',
    bgColor: 'bg-gradient-to-br from-blue-400 to-cyan-400'
  },
  {
    value: SNAPSHOT_STYLES.TRAVEL,
    label: '여행',
    description: '여행지에서의 추억',
    bgColor: 'bg-gradient-to-br from-green-400 to-emerald-500'
  },
  {
    value: SNAPSHOT_STYLES.FILM,
    label: '필름',
    description: '감성적인 필름 느낌',
    bgColor: 'bg-gradient-to-br from-orange-400 to-red-500'
  }
] as const;

export const GENDER_OPTIONS = [
  {
    value: SNAPSHOT_GENDERS.MALE,
    label: '남성',
    icon: '♂️'
  },
  {
    value: SNAPSHOT_GENDERS.FEMALE,
    label: '여성',
    icon: '♀️'
  }
] as const;

export const SNAPSHOT_CONFIG = {
  MIN_PHOTOS: 1,
  MAX_PHOTOS: 4,
  GENERATION_COUNT: 5,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ACCEPTED_FORMATS: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  ACCEPTED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp']
} as const;

export const SNAPSHOT_MESSAGES = {
  UPLOAD_PROMPT: '사진을 1~4장 업로드해주세요',
  UPLOAD_HINT: 'JPG, PNG, WEBP 형식 지원 (최대 10MB)',
  SELECT_MODE: '모드를 선택해주세요',
  SELECT_STYLE: '스타일을 선택해주세요',
  SELECT_GENDER: '성별을 선택해주세요 (선택사항)',
  GENERATING: 'AI가 스냅샷을 생성하고 있습니다...',
  GENERATION_COMPLETE: '스냅샷 생성이 완료되었습니다!',
  GENERATION_ERROR: '스냅샷 생성 중 오류가 발생했습니다.',
  NO_PHOTOS: '최소 1장의 사진을 업로드해주세요',
  TOO_MANY_PHOTOS: '최대 4장까지 업로드 가능합니다',
  INVALID_FORMAT: '지원하지 않는 파일 형식입니다',
  FILE_TOO_LARGE: '파일 크기가 너무 큽니다 (최대 10MB)'
} as const;

export const SNAPSHOT_STEPS = [
  {
    step: 1,
    title: '사진 업로드',
    description: '원하는 사진을 1~4장 업로드해주세요'
  },
  {
    step: 2,
    title: '모드 선택',
    description: '개인, 커플, 가족 중 선택해주세요'
  },
  {
    step: 3,
    title: '스타일 선택',
    description: '원하는 스타일을 선택해주세요'
  },
  {
    step: 4,
    title: '생성 완료',
    description: '5장의 AI 스냅샷이 생성됩니다'
  }
] as const;
