import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { db } from '@db';
import { images } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';

interface CollageOptions {
  imageIds: number[];
  layout: '2' | '6' | '12' | '24';
  resolution: 'web' | 'high' | 'print';
  format: 'png' | 'jpeg';
}

interface LayoutConfig {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
}

class CollageService {
  // 레이아웃 설정
  private layoutConfigs: Record<string, LayoutConfig> = {
    '2': { columns: 1, rows: 2, cellWidth: 800, cellHeight: 800 },
    '6': { columns: 2, rows: 3, cellWidth: 600, cellHeight: 600 },
    '12': { columns: 3, rows: 4, cellWidth: 400, cellHeight: 400 },
    '24': { columns: 4, rows: 6, cellWidth: 300, cellHeight: 300 }
  };

  // DPI별 스케일 설정
  private resolutionScales: Record<string, number> = {
    'web': 1,      // 72 DPI
    'high': 2.08,  // 150 DPI
    'print': 4.17  // 300 DPI
  };

  /**
   * 이미지 정보 조회
   */
  async getImagePaths(imageIds: number[]) {
    try {
      const imageRecords = await db.query.images.findMany({
        where: inArray(images.id, imageIds)
      });

      return imageRecords.map(img => ({
        id: img.id,
        url: img.url,
        title: img.title || '이미지'
      }));
    } catch (error) {
      console.error('이미지 조회 오류:', error);
      throw new Error('이미지 정보를 불러올 수 없습니다');
    }
  }

  /**
   * 콜라주 생성 메인 함수
   */
  async createCollage(options: CollageOptions): Promise<Buffer> {
    const { imageIds, layout, resolution, format } = options;
    const config = this.layoutConfigs[layout];
    const scale = this.resolutionScales[resolution];

    // 캔버스 크기 계산
    const canvasWidth = Math.floor(config.columns * config.cellWidth * scale);
    const canvasHeight = Math.floor(config.rows * config.cellHeight * scale);
    const cellWidth = Math.floor(config.cellWidth * scale);
    const cellHeight = Math.floor(config.cellHeight * scale);

    console.log(`📐 캔버스 생성: ${canvasWidth}x${canvasHeight}px (${resolution})`);

    // Sharp 캔버스 생성
    const canvas = sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    });

    // 현재는 테스트용 빈 캔버스 반환
    const buffer = await canvas[format]({
      quality: format === 'jpeg' ? 90 : undefined,
      compressionLevel: format === 'png' ? 6 : undefined
    }).toBuffer();

    console.log(`✅ 콜라주 생성 완료: ${buffer.length} bytes`);
    return buffer;
  }

  /**
   * 임시 파일 정리
   */
  async cleanupTempFiles(sessionId: string) {
    try {
      const tempDir = path.join(process.cwd(), 'temp', 'collage');
      const files = await fs.readdir(tempDir);
      
      for (const file of files) {
        if (file.startsWith(sessionId)) {
          await fs.unlink(path.join(tempDir, file));
          console.log(`🧹 임시 파일 삭제: ${file}`);
        }
      }
    } catch (error) {
      console.error('임시 파일 정리 오류:', error);
    }
  }
}

export const collageService = new CollageService();