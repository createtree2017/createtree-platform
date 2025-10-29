export const SNAPSHOT_MODES = [
  { value: 'individual', label: '개인', description: '1인 스냅샷' },
  { value: 'couple', label: '커플', description: '2인 스냅샷' },
  { value: 'family', label: '가족', description: '가족 스냅샷' }
] as const;

export const SNAPSHOT_STYLES = [
  { value: 'mix', label: '믹스', description: '다양한 스타일 조합' },
  { value: 'daily', label: '일상', description: '일상적인 순간' },
  { value: 'travel', label: '여행', description: '여행 컨셉' },
  { value: 'film', label: '필름', description: '필름 감성' }
] as const;

export const SNAPSHOT_GENDERS = [
  { value: 'female', label: '여성' },
  { value: 'male', label: '남성' },
  { value: 'unisex', label: '중성' }
] as const;

export type SnapshotMode = typeof SNAPSHOT_MODES[number]['value'];
export type SnapshotStyle = typeof SNAPSHOT_STYLES[number]['value'];
export type SnapshotGender = typeof SNAPSHOT_GENDERS[number]['value'];
