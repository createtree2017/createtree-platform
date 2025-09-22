import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

/**
 * 썸네일 생성 유틸리티
 * 고화질 이미지에서 300x300 썸네일을 생성합니다
 */

// 썸네일 설정
const THUMBNAIL_SIZE = 300;
const THUMBNAIL_QUALITY = 80;

/**
 * 썸네일 디렉토리 생성
 */
export function ensureThumbnailDirectory() {
  const thumbnailDir = path.join(process.cwd(), 'uploads', 'thumbnails');
  if (!fs.existsSync(thumbnailDir)) {
    fs.mkdirSync(thumbnailDir, { recursive: true });
    console.log('[썸네일] 디렉토리 생성:', thumbnailDir);
  }
  return thumbnailDir;
}

/**
 * 이미지 파일에서 썸네일 생성
 * @param originalPath 원본 이미지 경로 (예: /uploads/image-123.jpg)
 * @param filename 파일명 (예: image-123.jpg)
 * @returns 썸네일 경로 (예: /uploads/thumbnails/image-123.jpg)
 */
export async function generateThumbnail(originalPath: string, filename: string): Promise<string> {
  try {
    // 썸네일 디렉토리 확인
    ensureThumbnailDirectory();
    
    // 경로 설정
    const fullOriginalPath = originalPath.startsWith('/') 
      ? path.join(process.cwd(), originalPath.slice(1))
      : path.join(process.cwd(), originalPath);
    
    const thumbnailPath = path.join(process.cwd(), 'uploads', 'thumbnails', filename);
    const webThumbnailPath = `/uploads/thumbnails/${filename}`;
    
    // 이미 썸네일이 존재하면 기존 경로 반환
    if (fs.existsSync(thumbnailPath)) {
      console.log('[썸네일] 기존 썸네일 사용:', webThumbnailPath);
      return webThumbnailPath;
    }
    
    console.log('[썸네일] 생성 시작:', {
      원본: fullOriginalPath,
      썸네일: thumbnailPath
    });
    
    // Sharp로 썸네일 생성
    await sharp(fullOriginalPath)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'cover', // 비율 유지하며 크롭
        position: 'center'
      })
      .jpeg({ 
        quality: THUMBNAIL_QUALITY,
        progressive: true 
      })
      .toFile(thumbnailPath);
    
    console.log('[썸네일] 생성 완료:', webThumbnailPath);
    return webThumbnailPath;
    
  } catch (error) {
    console.error('[썸네일] 생성 실패:', error);
    console.error('원본 경로:', originalPath);
    console.error('파일명:', filename);
    
    // 썸네일 생성 실패 시 원본 이미지 경로 반환
    return originalPath;
  }
}

/**
 * Base64 이미지에서 썸네일 생성
 * @param base64Data Base64 이미지 데이터
 * @param filename 저장할 파일명
 * @returns 썸네일 경로
 */
export async function generateThumbnailFromBase64(base64Data: string, filename: string): Promise<string> {
  try {
    ensureThumbnailDirectory();
    
    // Base64 데이터 정리
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    const thumbnailPath = path.join(process.cwd(), 'uploads', 'thumbnails', filename);
    const webThumbnailPath = `/uploads/thumbnails/${filename}`;
    
    // Sharp로 썸네일 생성
    await sharp(buffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ 
        quality: THUMBNAIL_QUALITY,
        progressive: true 
      })
      .toFile(thumbnailPath);
    
    console.log('[썸네일] Base64에서 생성 완료:', webThumbnailPath);
    return webThumbnailPath;
    
  } catch (error) {
    console.error('[썸네일] Base64 생성 실패:', error);
    return '/uploads/fallback-thumbnail.jpg'; // 기본 썸네일
  }
}

/**
 * 원본 이미지 경로에서 썸네일 경로 자동 구성
 * @param originalUrl 원본 이미지 URL
 * @returns 썸네일 URL
 */
export function getThumbnailUrl(originalUrl: string): string {
  if (!originalUrl || originalUrl.includes('thumbnails/')) {
    return originalUrl;
  }
  
  // /uploads/image-123.jpg → /uploads/thumbnails/image-123.jpg
  if (originalUrl.startsWith('/uploads/')) {
    const filename = path.basename(originalUrl);
    return `/uploads/thumbnails/${filename}`;
  }
  
  return originalUrl;
}

/**
 * 기존 이미지들의 썸네일을 일괄 생성
 * @param imagePaths 이미지 경로 배열
 */
export async function batchGenerateThumbnails(imagePaths: string[]): Promise<void> {
  console.log(`[썸네일] 일괄 생성 시작: ${imagePaths.length}개 이미지`);
  
  for (const imagePath of imagePaths) {
    try {
      const filename = path.basename(imagePath);
      await generateThumbnail(imagePath, filename);
    } catch (error) {
      console.error(`[썸네일] 일괄 생성 실패 (${imagePath}):`, error);
    }
  }
  
  console.log('[썸네일] 일괄 생성 완료');
}