import { bucket } from '../firebase.js';
import sharp from 'sharp';
import path from 'path';

interface GCSImageResult {
  originalUrl: string;
  thumbnailUrl: string;
  gsPath: string;
  gsThumbnailPath: string;
  fileName: string;
  thumbnailFileName: string;
}

/**
 * GCS에 이미지와 썸네일을 저장하고 공개 URL을 반환
 * @param imageBuffer 이미지 버퍼
 * @param userId 사용자 ID
 * @param category 카테고리 (기본값: 'general')
 * @param originalFileName 원본 파일명 (선택사항)
 * @returns GCS 경로와 공개 URL 정보
 */
export async function saveImageToGCS(
  imageBuffer: Buffer,
  userId: string,
  category: string = 'general',
  originalFileName?: string
): Promise<GCSImageResult> {
  try {
    // 이미지 버퍼 유효성 검증
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('유효하지 않은 이미지 버퍼입니다');
    }

    console.log('GCS 이미지 저장 시작:', {
      bufferSize: imageBuffer.length,
      userId,
      category,
      originalFileName
    });

    const timestamp = Date.now();
    const fileExtension = '.webp'; // 최적화를 위해 WebP 사용
    const fileName = originalFileName 
      ? `${timestamp}_${path.parse(originalFileName).name}${fileExtension}`
      : `${timestamp}_generated_image${fileExtension}`;
    
    // GCS 경로 구성
    const originalPath = `images/${category}/${userId}/${fileName}`;
    const thumbnailPath = `images/${category}/${userId}/thumbnails/${fileName}`;
    
    // Sharp 인스턴스 유효성 검증
    let sharpInstance;
    try {
      sharpInstance = sharp(imageBuffer);
      await sharpInstance.metadata(); // 이미지 유효성 검증
    } catch (error) {
      console.error('Sharp 이미지 처리 오류:', error);
      throw new Error('이미지 형식이 지원되지 않습니다');
    }
    
    // 원본 이미지 최적화 (WebP로 변환, 최대 2048px)
    const optimizedOriginal = await sharp(imageBuffer)
      .webp({ quality: 90 })
      .resize(2048, 2048, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .toBuffer();
    
    // 썸네일 생성 (300x300)
    const thumbnailBuffer = await sharp(imageBuffer)
      .webp({ quality: 80 })
      .resize(300, 300, { 
        fit: 'cover' 
      })
      .toBuffer();
    
    // 원본 이미지 업로드 (권한 설정 없이)
    const originalFile = bucket.file(originalPath);
    await originalFile.save(optimizedOriginal, {
      metadata: {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000', // 1년 캐시
        metadata: {
          category,
          userId,
          originalFileName: originalFileName || 'generated',
          createdAt: new Date().toISOString(),
        },
      },
    });
    
    // 썸네일 업로드 (권한 설정 없이)
    const thumbnailFile = bucket.file(thumbnailPath);
    await thumbnailFile.save(thumbnailBuffer, {
      metadata: {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000',
        metadata: {
          category,
          userId,
          imageType: 'thumbnail',
          createdAt: new Date().toISOString(),
        },
      },
    });
    
    // 서명된 URL 생성 (장기간 유효)
    const [originalUrl] = await originalFile.getSignedUrl({
      action: 'read',
      expires: '01-01-2030',
    });
    
    const [thumbnailUrl] = await thumbnailFile.getSignedUrl({
      action: 'read',
      expires: '01-01-2030',
    });
    
    console.log(`🔗 GCS 서명된 URL 생성: ${originalUrl}`);
    console.log(`✅ GCS 이미지 저장 완료: ${originalPath}`);
    
    const bucketName = bucket.name;
    return {
      originalUrl,
      thumbnailUrl,
      gsPath: `gs://${bucketName}/${originalPath}`,
      gsThumbnailPath: `gs://${bucketName}/${thumbnailPath}`,
      fileName,
      thumbnailFileName: fileName,
    };
    
  } catch (error) {
    console.error('❌ GCS 이미지 저장 실패:', error);
    throw new Error(`GCS 이미지 저장 실패: ${error.message}`);
  }
}

/**
 * Base64 이미지를 GCS에 저장
 * @param base64Data Base64 인코딩된 이미지 데이터
 * @param userId 사용자 ID
 * @param category 카테고리
 * @param originalFileName 원본 파일명
 * @returns GCS 저장 결과
 */
export async function saveBase64ImageToGCS(
  base64Data: string,
  userId: string,
  category: string = 'general',
  originalFileName?: string
): Promise<GCSImageResult> {
  // Base64에서 Buffer로 변환
  const base64String = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
  const imageBuffer = Buffer.from(base64String, 'base64');
  
  return saveImageToGCS(imageBuffer, userId, category, originalFileName);
}

/**
 * URL에서 이미지를 다운로드하여 GCS에 저장
 * @param imageUrl 이미지 URL
 * @param userId 사용자 ID
 * @param category 카테고리
 * @param originalFileName 원본 파일명
 * @returns GCS 저장 결과
 */
export async function saveImageFromUrlToGCS(
  imageUrl: string,
  userId: string,
  category: string = 'general',
  originalFileName?: string
): Promise<GCSImageResult> {
  try {
    console.log(`📥 이미지 다운로드 시작: ${imageUrl}`);
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`이미지 다운로드 실패: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    
    console.log(`📦 이미지 다운로드 완료: ${(imageBuffer.length / 1024).toFixed(2)}KB`);
    
    return saveImageToGCS(imageBuffer, userId, category, originalFileName);
    
  } catch (error) {
    console.error('❌ URL 이미지 저장 실패:', error);
    throw new Error(`URL 이미지 저장 실패: ${error.message}`);
  }
}

/**
 * GCS 파일의 공개 URL 생성
 * @param gsPath GS 경로 (gs://bucket/path/to/file)
 * @returns 공개 URL
 */
export function generatePublicUrl(gsPath: string): string {
  try {
    // gs:// 접두사 제거하고 파일 경로 추출
    const filePath = gsPath.replace(`gs://${bucket.name}/`, '');
    return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
  } catch (error) {
    console.error('❌ 공개 URL 생성 실패:', error);
    throw new Error(`공개 URL 생성 실패: ${error.message}`);
  }
}