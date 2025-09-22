/**
 * QR 코드 시스템 설정 상수
 */

export const QR_CONFIG = {
  // QR 이미지 설정
  IMAGE_WIDTH: parseInt(process.env.QR_IMAGE_WIDTH || '300'),
  IMAGE_MARGIN: parseInt(process.env.QR_IMAGE_MARGIN || '2'),
  
  // QR 데이터 설정
  TYPE: process.env.QR_TYPE || 'hospital_auth',
  VERSION: process.env.QR_VERSION || '1.0',
  
  // QR 색상 설정
  DARK_COLOR: process.env.QR_DARK_COLOR || '#000000',
  LIGHT_COLOR: process.env.QR_LIGHT_COLOR || '#FFFFFF',
  
  // 캐시 설정
  CACHE_CONTROL: process.env.QR_CACHE_CONTROL || 'no-cache',
} as const;

export type QRConfigType = typeof QR_CONFIG;