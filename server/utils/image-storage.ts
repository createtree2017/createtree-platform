/**
 * 🎯 통합 이미지 저장 시스템
 * Base64 → .webp 파일 저장 + 자동 썸네일 생성
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { IMAGE_PROCESSING } from '../constants';

export interface ImageSaveResult {
  imageUrl: string;
  thumbnailUrl: string;
  filename: string;
  thumbnailFilename: string;
}

/**
 * 📂 저장 경로 생성
 * uploads/full/2025/05/27/
 * uploads/thumbnails/2025/05/27/
 */
function createDateBasedPath(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  return `${year}/${month}/${day}`;
}

/**
 * 📁 디렉토리 생성 (재귀적)
 */
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 🎨 Base64 이미지를 .webp 파일로 저장 + 썸네일 생성
 */
export async function saveImageFromBase64(
  base64Data: string,
  categoryId?: string
): Promise<ImageSaveResult> {
  try {
    // Base64 데이터 추출
    const base64String = base64Data.includes(',') 
      ? base64Data.split(',')[1] 
      : base64Data;
    
    const buffer = Buffer.from(base64String, 'base64');
    
    // 파일명 생성
    const uniqueId = uuidv4();
    const datePath = createDateBasedPath();
    const filename = `${uniqueId}.webp`;
    const thumbnailFilename = `${uniqueId}_thumb.webp`;
    
    // 저장 경로 설정
    const fullDir = path.join(process.cwd(), 'uploads', 'full', datePath);
    const thumbnailDir = path.join(process.cwd(), 'uploads', 'thumbnails', datePath);
    
    // 디렉토리 생성
    ensureDirectoryExists(fullDir);
    ensureDirectoryExists(thumbnailDir);
    
    const fullPath = path.join(fullDir, filename);
    const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
    
    // 원본 이미지를 .webp로 저장 (품질 85%)
    await sharp(buffer)
      .webp({ quality: 85 })
      .toFile(fullPath);
    
    // 썸네일 생성 (1024px, 비율 유지)
    await sharp(buffer)
      .resize(IMAGE_PROCESSING.THUMBNAIL.MAX_SIZE, IMAGE_PROCESSING.THUMBNAIL.MAX_SIZE, { 
        fit: IMAGE_PROCESSING.THUMBNAIL.FIT_MODE 
      })
      .webp({ quality: IMAGE_PROCESSING.THUMBNAIL.QUALITY })
      .toFile(thumbnailPath);
    
    // 웹 접근 URL 생성
    const imageUrl = `/uploads/full/${datePath}/${filename}`;
    const thumbnailUrl = `/uploads/thumbnails/${datePath}/${thumbnailFilename}`;
    
    console.log(`✅ 이미지 저장 완료: ${imageUrl}`);
    console.log(`🖼️ 썸네일 생성 완료: ${thumbnailUrl}`);
    
    return {
      imageUrl,
      thumbnailUrl,
      filename,
      thumbnailFilename
    };
    
  } catch (error) {
    console.error('❌ 이미지 저장 실패:', error);
    throw new Error('이미지 저장 중 오류가 발생했습니다');
  }
}

/**
 * 📷 업로드된 파일을 .webp로 변환 + 썸네일 생성
 */
export async function saveUploadedImage(
  inputPath: string,
  categoryId?: string
): Promise<ImageSaveResult> {
  try {
    // 파일명 생성
    const uniqueId = uuidv4();
    const datePath = createDateBasedPath();
    const filename = `${uniqueId}.webp`;
    const thumbnailFilename = `${uniqueId}_thumb.webp`;
    
    // 저장 경로 설정
    const fullDir = path.join(process.cwd(), 'uploads', 'full', datePath);
    const thumbnailDir = path.join(process.cwd(), 'uploads', 'thumbnails', datePath);
    
    // 디렉토리 생성
    ensureDirectoryExists(fullDir);
    ensureDirectoryExists(thumbnailDir);
    
    const fullPath = path.join(fullDir, filename);
    const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
    
    // 원본 이미지를 .webp로 변환 및 저장
    await sharp(inputPath)
      .webp({ quality: 85 })
      .toFile(fullPath);
    
    // 썸네일 생성 (1024px, 비율 유지)
    await sharp(inputPath)
      .resize(IMAGE_PROCESSING.THUMBNAIL.MAX_SIZE, IMAGE_PROCESSING.THUMBNAIL.MAX_SIZE, { 
        fit: IMAGE_PROCESSING.THUMBNAIL.FIT_MODE 
      })
      .webp({ quality: IMAGE_PROCESSING.THUMBNAIL.QUALITY })
      .toFile(thumbnailPath);
    
    // 웹 접근 URL 생성
    const imageUrl = `/uploads/full/${datePath}/${filename}`;
    const thumbnailUrl = `/uploads/thumbnails/${datePath}/${thumbnailFilename}`;
    
    console.log(`✅ 업로드 이미지 변환 완료: ${imageUrl}`);
    console.log(`🖼️ 썸네일 생성 완료: ${thumbnailUrl}`);
    
    return {
      imageUrl,
      thumbnailUrl,
      filename,
      thumbnailFilename
    };
    
  } catch (error) {
    console.error('❌ 업로드 이미지 처리 실패:', error);
    throw new Error('업로드 이미지 처리 중 오류가 발생했습니다');
  }
}

/**
 * 🗑️ 이미지 파일 삭제 (원본 + 썸네일)
 */
export async function deleteImageFiles(imageUrl: string, thumbnailUrl?: string): Promise<void> {
  try {
    // 원본 파일 삭제
    if (imageUrl && imageUrl.startsWith('/uploads/')) {
      const fullPath = path.join(process.cwd(), imageUrl);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`🗑️ 원본 파일 삭제: ${imageUrl}`);
      }
    }
    
    // 썸네일 파일 삭제
    if (thumbnailUrl && thumbnailUrl.startsWith('/uploads/')) {
      const thumbPath = path.join(process.cwd(), thumbnailUrl);
      if (fs.existsSync(thumbPath)) {
        fs.unlinkSync(thumbPath);
        console.log(`🗑️ 썸네일 파일 삭제: ${thumbnailUrl}`);
      }
    }
  } catch (error) {
    console.error('❌ 파일 삭제 실패:', error);
  }
}