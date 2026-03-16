import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { db } from '@db';
import { collages, images } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { saveImageToGCS } from '../utils/gcs-image-storage';
import { resolveImageUrl } from '../utils/gcs';

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
    const rawUrls = [
      imageRecord.transformedUrl,
      imageRecord.originalUrl,
      imageRecord.thumbnailUrl
    ].filter(Boolean); // null/undefined 제거

    // URL 해결 (만료된 signed URL을 공개 URL로 변환)
    const urls = rawUrls.map(url => resolveImageUrl(url));

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
  async generateCollage(sessionId: string, options: CollageOptions, deviceBuffers: Buffer[] = []): Promise<CollageResult> {
    try {
      console.log('🎨 콜라주 생성 시작:', sessionId);
      
      // 갤러리 이미지 정보 조회 (갤러리 ID가 있을 때만)
      let imageRecords: any[] = [];
      if (options.imageIds.length > 0) {
        imageRecords = await db.query.images.findMany({
          where: inArray(images.id, options.imageIds)
        });
      }

      if (imageRecords.length === 0 && deviceBuffers.length === 0) {
        throw new Error('이미지를 찾을 수 없습니다');
      }

      console.log(`📊 갤러리: ${imageRecords.length}개, 디바이스: ${deviceBuffers.length}개`);

      // 레이아웃 설정
      const config = this.getLayoutConfig(options.layout, options.resolution);
      const dpi = this.getDPI(options.resolution);

      // 캔버스 크기 계산
      const canvasWidth = config.cols * config.imageWidth + (config.cols - 1) * config.gap;
      const canvasHeight = config.rows * config.imageHeight + (config.rows - 1) * config.gap;

      console.log(`📐 캔버스 크기: ${canvasWidth}x${canvasHeight}px`);

      // Sharp 캔버스 생성 (투명 배경)
      const canvas = sharp({
        create: {
          width: canvasWidth,
          height: canvasHeight,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      });

      // 이미지 합성 준비
      const compositeImages = [];
      const failedImages = [];
      const totalSlots = parseInt(options.layout);
      let slotIndex = 0;
      
      // ── 1단계: 갤러리 이미지 처리 ──
      for (let i = 0; i < options.imageIds.length && slotIndex < totalSlots; i++) {
        const imageId = options.imageIds[i];
        const imageRecord = imageRecords.find(img => img.id === imageId);
        
        if (!imageRecord) {
          console.warn(`⚠️ 이미지 레코드를 찾을 수 없음: ID ${imageId}`);
          failedImages.push({ imageId, reason: '이미지 레코드 없음' });
          slotIndex++;
          continue;
        }

        console.log(`🖼️ 갤러리 이미지 처리 중 [${slotIndex+1}/${totalSlots}]: ${imageRecord.title}`);

        try {
          const imageBuffer = await this.downloadImageWithFallback(imageRecord);
          const resizedBuffer = await sharp(imageBuffer)
            .resize(config.imageWidth, config.imageHeight, {
              fit: 'contain',
              position: 'center',
              background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toBuffer();

          const col = slotIndex % config.cols;
          const row = Math.floor(slotIndex / config.cols);
          compositeImages.push({
            input: resizedBuffer,
            left: col * (config.imageWidth + config.gap),
            top: row * (config.imageHeight + config.gap)
          });
          
          console.log(`✅ 갤러리 이미지 처리 완료 [${slotIndex+1}/${totalSlots}]`);
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
          console.error(`❌ 갤러리 이미지 처리 실패: ${imageRecord.title} - ${errorMessage}`);
          failedImages.push({ imageId, title: imageRecord.title, reason: errorMessage });
          
          const placeholderBuffer = await this.createPlaceholder(config.imageWidth, config.imageHeight);
          const col = slotIndex % config.cols;
          const row = Math.floor(slotIndex / config.cols);
          compositeImages.push({
            input: placeholderBuffer,
            left: col * (config.imageWidth + config.gap),
            top: row * (config.imageHeight + config.gap)
          });
        }
        slotIndex++;
      }

      // ── 2단계: 디바이스 업로드 이미지 처리 (휘발성) ──
      for (let i = 0; i < deviceBuffers.length && slotIndex < totalSlots; i++) {
        console.log(`📱 디바이스 이미지 처리 중 [${slotIndex+1}/${totalSlots}]`);
        try {
          const resizedBuffer = await sharp(deviceBuffers[i])
            .resize(config.imageWidth, config.imageHeight, {
              fit: 'contain',
              position: 'center',
              background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toBuffer();

          const col = slotIndex % config.cols;
          const row = Math.floor(slotIndex / config.cols);
          compositeImages.push({
            input: resizedBuffer,
            left: col * (config.imageWidth + config.gap),
            top: row * (config.imageHeight + config.gap)
          });
          
          console.log(`✅ 디바이스 이미지 처리 완료 [${slotIndex+1}/${totalSlots}]`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
          console.error(`❌ 디바이스 이미지 처리 실패 [${slotIndex+1}/${totalSlots}]: ${errorMessage}`);
          failedImages.push({ imageId: -1, title: `디바이스 이미지 ${i+1}`, reason: errorMessage });
          
          const placeholderBuffer = await this.createPlaceholder(config.imageWidth, config.imageHeight);
          const col = slotIndex % config.cols;
          const row = Math.floor(slotIndex / config.cols);
          compositeImages.push({
            input: placeholderBuffer,
            left: col * (config.imageWidth + config.gap),
            top: row * (config.imageHeight + config.gap)
          });
        }
        slotIndex++;
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

      // GCS에 업로드 (검증된 헬퍼 사용)
      const collageResult = await saveImageToGCS(collageBuffer, options.userId || 'anonymous', 'collages', outputFileName);
      console.log(`☁️ 콜라주 GCS 업로드 완료: ${collageResult.originalUrl}`);

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
        
        // 썸네일 GCS 업로드 (검증된 헬퍼 사용)
        const thumbnailFileName = `thumb_${outputFileName}`;
        const thumbnailResult = await saveImageToGCS(thumbnailBuffer, options.userId || 'anonymous', 'collages/thumbnails', thumbnailFileName);
        console.log(`☁️ 썸네일 GCS 업로드 완료: ${thumbnailResult.originalUrl}`);
        
        // DB에 저장 (GCS URL 사용)
        await db.insert(images).values({
          title: collageTitle,
          style: 'collage',
          userId: options.userId ? String(options.userId) : null,
          originalUrl: collageResult.originalUrl,
          transformedUrl: collageResult.originalUrl,
          thumbnailUrl: thumbnailResult.originalUrl,
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
        outputUrl: collageResult.originalUrl,  // GCS URL 반환
        outputPath: collageResult.gsPath || collageResult.originalUrl,    // GCS 경로 반환
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

  // 실패 시 대체 이미지(placeholder) 생성
  private async createPlaceholder(width: number, height: number): Promise<Buffer> {
    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 200, g: 200, b: 200, alpha: 0.3 }
      }
    })
    .composite([{
      input: Buffer.from(`
        <svg width="${width}" height="${height}">
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
  }
}

export const collageServiceV2 = new CollageServiceV2();