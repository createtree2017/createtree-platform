import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { db } from '@db';
import { collages, images } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { uploadBufferToGCS } from '../utils/gcs';

export interface CollageOptions {
  imageIds: number[];
  layout: '2' | '6' | '12' | '24';
  resolution: 'web' | 'high' | 'print';
  format: 'png' | 'jpg' | 'webp';
  userId?: number;
}

export interface CollageResult {
  sessionId: string;
  status: 'ready' | 'processing' | 'completed' | 'failed';
  layout: string;
  resolution: string;
  format: string;
  imageCount: number;
  outputUrl?: string;
  outputPath?: string;
  message?: string;
  error?: string;
  failedImages?: Array<{
    imageId: number;
    title?: string;
    reason: string;
  }>;
}

// 레이아웃별 설정
interface LayoutConfig {
  cols: number;
  rows: number;
  imageWidth: number;
  imageHeight: number;
  gap: number;
}

class CollageServiceV2 {
  private collageDir = path.join(process.cwd(), 'static', 'collages');

  constructor() {
    // 콜라주 저장 디렉토리 생성
    this.ensureCollageDir();
  }

  private async ensureCollageDir() {
    try {
      await fs.mkdir(this.collageDir, { recursive: true });
    } catch (error) {
      console.error('콜라주 디렉토리 생성 실패:', error);
    }
  }

  // 세션 ID 생성
  generateSessionId(): string {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `collage_${timestamp}_${randomStr}`;
  }

  // 레이아웃 설정 가져오기
  private getLayoutConfig(layout: string, resolution: string): LayoutConfig {
    const baseSize = resolution === 'print' ? 800 : resolution === 'high' ? 600 : 400;
    const gap = resolution === 'print' ? 20 : 10;

    const configs: Record<string, LayoutConfig> = {
      '2': { cols: 1, rows: 2, imageWidth: baseSize, imageHeight: baseSize, gap },
      '6': { cols: 2, rows: 3, imageWidth: baseSize, imageHeight: baseSize, gap },
      '12': { cols: 3, rows: 4, imageWidth: baseSize, imageHeight: baseSize, gap },
      '24': { cols: 4, rows: 6, imageWidth: baseSize, imageHeight: baseSize, gap }
    };

    return configs[layout] || configs['2'];
  }

  // DPI 설정 가져오기
  private getDPI(resolution: string): number {
    switch(resolution) {
      case 'print': return 300;
      case 'high': return 150;
      default: return 72;
    }
  }

  // 콜라주 생성 준비 (DB 없이 임시 작동)
  async prepareCollage(options: CollageOptions): Promise<CollageResult> {
    try {
      const sessionId = this.generateSessionId();
      
      // collages 테이블이 없을 수 있으므로 임시로 세션만 반환
      console.log('📸 콜라주 세션 생성:', sessionId);
      
      return {
        sessionId,
        status: 'ready',
        layout: options.layout,
        resolution: options.resolution,
        format: options.format,
        imageCount: options.imageIds.length,
        message: '콜라주 생성 준비 완료'
      };
    } catch (error) {
      console.error('콜라주 준비 오류:', error);
      return {
        sessionId: '',
        status: 'failed',
        layout: options.layout,
        resolution: options.resolution,
        format: options.format,
        imageCount: 0,
        error: '콜라주 준비 중 오류가 발생했습니다'
      };
    }
  }

  // 이미지 URL을 로컬 경로로 변환
  private async downloadImage(url: string): Promise<Buffer> {
    try {
      // URL이 없는 경우 처리
      if (!url) {
        throw new Error('이미지 URL이 없습니다');
      }

      console.log(`🔄 이미지 다운로드 시도: ${url}`);

      // GCS URL인 경우 직접 다운로드 (재시도 로직 포함)
      if (url.includes('storage.googleapis.com')) {
        return await this.downloadWithRetry(url, 3);
      }
      
      // 로컬 파일인 경우
      if (url.startsWith('/')) {
        const localPath = path.join(process.cwd(), 'static', url);
        console.log(`📁 로컬 파일 읽기: ${localPath}`);
        return await fs.readFile(localPath);
      }

      // 기타 URL (http://, https://)
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return await this.downloadWithRetry(url, 3);
      }

      // 그 외의 경우 에러
      throw new Error(`지원하지 않는 URL 형식: ${url}`);
    } catch (error) {
      console.error('❌ 이미지 다운로드 최종 실패:', error);
      throw error;
    }
  }

  // 재시도 로직이 포함된 다운로드 함수
  private async downloadWithRetry(url: string, retries: number): Promise<Buffer> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🔄 다운로드 시도 ${attempt}/${retries}: ${url}`);
        
        // 타임아웃 설정 (30초)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(url, { 
          signal: controller.signal,
          headers: {
            'User-Agent': 'CollageSystem/1.0',
            'Accept': 'image/*,*/*'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // 이미지 크기 검증
        if (buffer.length < 100) {
          throw new Error(`이미지 파일이 너무 작습니다: ${buffer.length} bytes`);
        }
        
        console.log(`✅ 다운로드 성공: ${buffer.length} bytes`);
        return buffer;
        
      } catch (error) {
        console.warn(`⚠️ 다운로드 시도 ${attempt} 실패:`, error instanceof Error ? error.message : error);
        
        if (attempt === retries) {
          throw new Error(`이미지 다운로드 실패 (${retries}회 시도): ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
        
        // 재시도 전 대기 (1초, 2초, 3초...)
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
    
    throw new Error('재시도 로직 오류');
  }

  // 여러 URL을 시도하는 다운로드 함수
  private async downloadImageWithFallback(imageRecord: any): Promise<Buffer> {
    const urls = [
      imageRecord.transformedUrl,
      imageRecord.originalUrl,
      imageRecord.thumbnailUrl
    ].filter(Boolean); // null/undefined 제거

    if (urls.length === 0) {
      throw new Error(`이미지 ${imageRecord.id}에 사용 가능한 URL이 없습니다`);
    }

    let lastError: Error | null = null;

    for (const url of urls) {
      try {
        console.log(`🔄 URL 시도: ${url}`);
        return await this.downloadImage(url);
      } catch (error) {
        console.warn(`⚠️ URL 실패: ${url} - ${error instanceof Error ? error.message : error}`);
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw new Error(`모든 URL 시도 실패: ${lastError?.message || '알 수 없는 오류'}`);
  }

  // 실제 콜라주 생성 (DB 없이 직접 처리)
  async generateCollage(sessionId: string, options: CollageOptions): Promise<CollageResult> {
    try {
      console.log('🎨 콜라주 생성 시작:', sessionId);
      
      // 이미지 정보 조회
      const imageRecords = await db.query.images.findMany({
        where: inArray(images.id, options.imageIds)
      });

      if (imageRecords.length === 0) {
        throw new Error('이미지를 찾을 수 없습니다');
      }

      // 레이아웃 설정
      const config = this.getLayoutConfig(options.layout, options.resolution);
      const dpi = this.getDPI(options.resolution);

      // 캔버스 크기 계산
      const canvasWidth = config.cols * config.imageWidth + (config.cols - 1) * config.gap;
      const canvasHeight = config.rows * config.imageHeight + (config.rows - 1) * config.gap;

      console.log(`📐 캔버스 크기: ${canvasWidth}x${canvasHeight}px`);

      // Sharp 캔버스 생성
      const canvas = sharp({
        create: {
          width: canvasWidth,
          height: canvasHeight,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
      });

      // 이미지 합성 준비
      const compositeImages = [];
      const failedImages = [];
      
      for (let i = 0; i < options.imageIds.length && i < parseInt(options.layout); i++) {
        const imageId = options.imageIds[i];
        const imageRecord = imageRecords.find(img => img.id === imageId);
        
        if (!imageRecord) {
          console.warn(`⚠️ 이미지 레코드를 찾을 수 없음: ID ${imageId}`);
          failedImages.push({ imageId, reason: '이미지 레코드 없음' });
          continue;
        }

        console.log(`🖼️ 이미지 처리 중 [${i+1}/${options.layout}]: ${imageRecord.title}`);

        try {
          // 다중 URL 시도로 이미지 다운로드 (더 안정적)
          const imageBuffer = await this.downloadImageWithFallback(imageRecord);
          
          // 이미지 리사이즈 (contain으로 변경하여 이미지 전체 표시)
          const resizedBuffer = await sharp(imageBuffer)
            .resize(config.imageWidth, config.imageHeight, {
              fit: 'contain',  // 이미지 전체를 보여주되, 여백이 생길 수 있음
              position: 'center',
              background: { r: 255, g: 255, b: 255, alpha: 1 }  // 여백을 흰색으로 채움
            })
            .toBuffer();

          // 위치 계산
          const col = i % config.cols;
          const row = Math.floor(i / config.cols);
          const left = col * (config.imageWidth + config.gap);
          const top = row * (config.imageHeight + config.gap);

          compositeImages.push({
            input: resizedBuffer,
            left,
            top
          });
          
          console.log(`✅ 이미지 처리 완료 [${i+1}/${options.layout}]: ${imageRecord.title}`);
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
          console.error(`❌ 이미지 처리 실패 [${i+1}/${options.layout}]: ${imageRecord.title} - ${errorMessage}`);
          failedImages.push({ 
            imageId, 
            title: imageRecord.title,
            reason: errorMessage 
          });
          
          // 대체 이미지 생성 (빈 사각형)
          const placeholderBuffer = await sharp({
            create: {
              width: config.imageWidth,
              height: config.imageHeight,
              channels: 4,
              background: { r: 240, g: 240, b: 240, alpha: 1 }
            }
          })
          .composite([{
            input: Buffer.from(`
              <svg width="${config.imageWidth}" height="${config.imageHeight}">
                <rect width="100%" height="100%" fill="#f0f0f0" stroke="#ccc" stroke-width="2"/>
                <text x="50%" y="50%" text-anchor="middle" dy="0.3em" font-family="Arial" font-size="14" fill="#999">
                  이미지 로드 실패
                </text>
              </svg>
            `),
            top: 0,
            left: 0
          }])
          .png()
          .toBuffer();

          // 위치 계산
          const col = i % config.cols;
          const row = Math.floor(i / config.cols);
          const left = col * (config.imageWidth + config.gap);
          const top = row * (config.imageHeight + config.gap);

          compositeImages.push({
            input: placeholderBuffer,
            left,
            top
          });
        }
      }

      // 모든 이미지가 실패한 경우
      if (compositeImages.length === 0) {
        throw new Error(`모든 이미지 처리에 실패했습니다. 실패한 이미지: ${failedImages.length}개`);
      }

      // 일부 이미지가 실패한 경우 로그
      if (failedImages.length > 0) {
        console.warn(`⚠️ 일부 이미지 처리 실패: ${failedImages.length}개 (성공: ${compositeImages.length}개)`);
        failedImages.forEach(failed => {
          console.warn(`   - ${failed.title || failed.imageId}: ${failed.reason}`);
        });
      }

      // 이미지 합성 및 Buffer 생성 (타임스탬프 추가로 고유한 파일명 보장)
      const timestamp = Date.now();
      const outputFileName = `${sessionId}_${timestamp}.${options.format}`;
      
      // MIME 타입 설정
      const mimeType = options.format === 'jpg' ? 'image/jpeg' : 
                       options.format === 'webp' ? 'image/webp' : 'image/png';

      // 콜라주 Buffer 생성 (요청된 포맷에 맞춰 생성)
      let sharpInstance = canvas
        .composite(compositeImages)
        .withMetadata({ density: dpi });

      // 요청된 포맷에 따라 인코딩 설정
      switch (options.format) {
        case 'jpg':
          sharpInstance = sharpInstance.jpeg({ quality: 95 });
          break;
        case 'webp':
          sharpInstance = sharpInstance.webp({ quality: 95 });
          break;
        default:
          sharpInstance = sharpInstance.png({ compressionLevel: 6 });
          break;
      }

      const collageBuffer = await sharpInstance.toBuffer();

      console.log(`✅ 콜라주 생성 완료: ${collageBuffer.length} bytes`);

      // GCS에 업로드
      const gcsPath = `collages/${options.userId || 'anonymous'}/${outputFileName}`;
      const collageUrl = await uploadBufferToGCS(collageBuffer, gcsPath, mimeType);
      console.log(`☁️ 콜라주 GCS 업로드 완료: ${collageUrl}`);

      // 콜라주를 images 테이블에 저장
      try {
        const collageTitle = `collage_${options.layout}x_${new Date().toLocaleDateString('ko-KR').replace(/\. /g, '').replace(/\./g, '')}`;
        
        // 썸네일 생성 (원본과 동일한 포맷으로 생성)
        let thumbnailSharp = sharp(collageBuffer)
          .resize(300, 300, { fit: 'cover' });

        // 원본과 동일한 포맷으로 썸네일 생성
        switch (options.format) {
          case 'jpg':
            thumbnailSharp = thumbnailSharp.jpeg({ quality: 85 });
            break;
          case 'webp':
            thumbnailSharp = thumbnailSharp.webp({ quality: 85 });
            break;
          default:
            thumbnailSharp = thumbnailSharp.png({ compressionLevel: 6 });
            break;
        }

        const thumbnailBuffer = await thumbnailSharp.toBuffer();
        
        // 썸네일 GCS 업로드
        const thumbnailFileName = `thumb_${outputFileName}`;
        const thumbnailGcsPath = `collages/${options.userId || 'anonymous'}/thumbnails/${thumbnailFileName}`;
        const thumbnailUrl = await uploadBufferToGCS(thumbnailBuffer, thumbnailGcsPath, mimeType);
        console.log(`☁️ 썸네일 GCS 업로드 완료: ${thumbnailUrl}`);
        
        // DB에 저장 (GCS URL 사용)
        await db.insert(images).values({
          title: collageTitle,
          style: 'collage',
          userId: options.userId ? String(options.userId) : null,
          originalUrl: collageUrl,
          transformedUrl: collageUrl,
          thumbnailUrl: thumbnailUrl,
          metadata: JSON.stringify({
            layout: options.layout,
            resolution: options.resolution,
            format: options.format,
            imageCount: options.imageIds.length,
            sourceImages: options.imageIds,
            sessionId: sessionId
          })
        });
        
        console.log(`📸 콜라주가 갤러리에 저장되었습니다: ${collageTitle}`);
      } catch (saveError) {
        console.error('콜라주 갤러리 저장 오류:', saveError);
        // 저장 실패해도 콜라주 생성은 성공했으므로 계속 진행
      }

      return {
        sessionId,
        status: 'completed',
        layout: options.layout,
        resolution: options.resolution,
        format: options.format,
        imageCount: options.imageIds.length,
        outputUrl: collageUrl,  // GCS URL 반환
        outputPath: gcsPath,    // GCS 경로 반환
        message: failedImages.length > 0 
          ? `콜라주 생성 완료 (일부 이미지 실패: ${failedImages.length}개)` 
          : '콜라주 생성 완료',
        failedImages: failedImages.length > 0 ? failedImages : undefined
      };
    } catch (error) {
      console.error('콜라주 생성 오류:', error);
      
      return {
        sessionId,
        status: 'failed',
        layout: options.layout,
        resolution: options.resolution,
        format: options.format,
        imageCount: 0,
        error: error instanceof Error ? error.message : '콜라주 생성 중 오류가 발생했습니다'
      };
    }
  }
}

export const collageServiceV2 = new CollageServiceV2();