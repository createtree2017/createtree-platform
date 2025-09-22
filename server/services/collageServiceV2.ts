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

      // GCS URL인 경우 직접 다운로드
      if (url.includes('storage.googleapis.com')) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${url}`);
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
      
      // 로컬 파일인 경우
      if (url.startsWith('/')) {
        const localPath = path.join(process.cwd(), 'static', url);
        return await fs.readFile(localPath);
      }

      // 기타 URL (http://, https://)
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${url}`);
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }

      // 그 외의 경우 에러
      throw new Error(`지원하지 않는 URL 형식: ${url}`);
    } catch (error) {
      console.error('이미지 다운로드 실패:', error);
      throw error;
    }
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
      
      for (let i = 0; i < options.imageIds.length && i < parseInt(options.layout); i++) {
        const imageId = options.imageIds[i];
        const imageRecord = imageRecords.find(img => img.id === imageId);
        
        if (!imageRecord) continue;

        console.log(`🖼️ 이미지 처리 중 [${i+1}/${options.layout}]: ${imageRecord.title}`);

        // 이미지 URL 결정 (transformedUrl 우선, 없으면 originalUrl, 그것도 없으면 thumbnailUrl)
        const imageUrl = imageRecord.transformedUrl || imageRecord.originalUrl || imageRecord.thumbnailUrl;
        
        if (!imageUrl) {
          console.warn(`이미지 ${imageRecord.id}에 사용 가능한 URL이 없습니다`);
          continue;
        }

        // 이미지 다운로드
        const imageBuffer = await this.downloadImage(imageUrl);
        
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
      }

      // 이미지 합성 및 Buffer 생성 (타임스탬프 추가로 고유한 파일명 보장)
      const timestamp = Date.now();
      const outputFileName = `${sessionId}_${timestamp}.${options.format}`;
      
      // MIME 타입 설정
      const mimeType = options.format === 'jpg' ? 'image/jpeg' : 
                       options.format === 'webp' ? 'image/webp' : 'image/png';

      // 콜라주 Buffer 생성 (PNG 포맷으로 생성)
      const collageBuffer = await canvas
        .composite(compositeImages)
        .withMetadata({ density: dpi })
        .png()  // PNG 포맷 명시
        .toBuffer();

      console.log(`✅ 콜라주 생성 완료: ${collageBuffer.length} bytes`);

      // GCS에 업로드
      const gcsPath = `collages/${options.userId || 'anonymous'}/${outputFileName}`;
      const collageUrl = await uploadBufferToGCS(collageBuffer, gcsPath, mimeType);
      console.log(`☁️ 콜라주 GCS 업로드 완료: ${collageUrl}`);

      // 콜라주를 images 테이블에 저장
      try {
        const collageTitle = `collage_${options.layout}x_${new Date().toLocaleDateString('ko-KR').replace(/\. /g, '').replace(/\./g, '')}`;
        
        // 썸네일 생성 (기존 버퍼에서 직접 생성)
        const thumbnailBuffer = await sharp(collageBuffer)
          .png()  // PNG 포맷 명시
          .resize(300, 300, { fit: 'cover' })
          .toBuffer();
        
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
        message: '콜라주 생성 완료'
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